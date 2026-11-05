/**
 * Consumer Routes - Module B
 * All consumer endpoints: create, list, get, update, KYC, remarks, co-applicants
 */

import { classificationOk } from '../utils/classification.js';
import { Router, Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import multer from 'multer';
import { db } from '../index.js';
import { buildApplicantFileHtml } from './booking.js';
import { AuthRequest } from '../index.js';
import { pgErrorHandler } from '../middleware/pg-errors.js';
import { requireProcess } from '../middleware/processPermission.js';
import { hasPermission } from '../middleware/rbac.js';
import { auditChange } from '../middleware/auditLogger.js';
import { buildEditScript, applyOverridesToHtml } from '../utils/document-recalc.js';
import { applyWaterfall, buildInterestRows } from '../utils/payment-waterfall.js';
import { bad, failWith, uuid, has, num, text, day, body, inTx } from '../utils/input.js';
import {
  mobileNo, emailAddr, panNo, aadhaarNo, gstinNo, passportNo, pastDay, birthDay, genderOf, pinCode, phoneNo,
  children, titleCase, LEAD_STAGES, INCOME_CATS, likeOf,
} from '../utils/applicant.js';
import { FIELDS, ALIAS, CO_COLS, cleanFields, coSource, asText, mask, forAudit, sha, lock, conflict, checkIdentity, personName, hasLetter } from '../utils/applicant-fields.js';
import { penalRateFrom } from '../utils/penal-rate.js';
import { SQL_TODAY, businessDayStart } from '../utils/business-date.js';
import { requirePrint } from '../middleware/printDownload.js';

// ---------- photo uploads: kept in the database; the image type is read from the file itself ----------
const MAGIC: [string, number[]][] = [['image/jpeg', [0xff, 0xd8, 0xff]], ['image/png', [0x89, 0x50, 0x4e, 0x47]], ['image/gif', [0x47, 0x49, 0x46, 0x38]]];
const sniff = (b: Buffer) => MAGIC.find(([, sig]) => sig.every((x, i) => b[i] === x))?.[0] ?? null;
const memory = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const photoUpload = (req: Request, res: Response, next: NextFunction) =>
  memory.single('photo')(req, res, (err: any) => err
    ? res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File too large — maximum size is 5MB' : err.message })
    : next());
// Saves the uploaded file for one owner and returns the address the page shows it from
const savePhoto = async (req: Request, kind: 'consumer' | 'co' | 'addl', ownerId: string): Promise<string> => {
  const type = req.file && sniff(req.file.buffer);
  if (!req.file) throw bad('Image file is required (jpeg, jpg, png, gif, max 5MB)');
  if (!type) throw bad('Only jpeg, jpg, png, gif images are allowed');
  await db.query(
    `INSERT INTO applicant_photos (kind, owner_id, content_type, data) VALUES ($1, $2, $3, $4)
     ON CONFLICT (kind, owner_id) DO UPDATE SET content_type = EXCLUDED.content_type, data = EXCLUDED.data, updated_at = NOW()`,
    [kind, ownerId, type, req.file.buffer]);
  return `/api/photos/${kind}/${ownerId}?v=${Date.now()}`;
};

const router = Router();

// Every route with :id first checks that the applicant id is a real id and visible to this login (project scope applies)
router.param('id', async (req, res, next, id) => {
  try {
    uuid(id, 'Applicant id');
    if (!(await db.query(`SELECT 1 FROM consumers WHERE id = $1`, [id])).rows.length) return res.status(404).json({ error: 'Applicant not found' });
    next();
  } catch (e) { failWith(e, res, next); }
});
router.param('applicantId', async (req, res, next, applicantId) => {
  try {
    uuid(applicantId, 'Additional applicant id');
    if (!(await db.query(`SELECT 1 FROM co_applicants WHERE id = $1 AND consumer_id = $2 AND applicant_number > 2`, [applicantId, req.params.id])).rows.length) return res.status(404).json({ error: 'Additional applicant not found for this applicant' });
    next();
  } catch (e) { failWith(e, res, next); }
});

// ---------- field rules live in utils/applicant-fields.ts ----------
const fail = (err: any, res: Response, next: NextFunction) => (err?.http ? res.status(err.http).json({ error: err.message }) : next(err));

const prepCo = (b: any, main: { mobile: string; pan: string | null; aadhaar: string | null }) => {
  if (b.applicant_type !== 'multiple' || !has(b.co_applicant_first_name)) return null;
  const co = cleanFields(coSource(b), CO_COLS);
  const mob = has(b.co_applicant_mobile) ? mobileNo(b.co_applicant_mobile, 'Co-applicant mobile') : null;
  if (mob) co.mobile = mob;
  if (!co.first_name) throw bad('Co-applicant first name is required');
  if (co.pan_no && co.pan_no === main.pan) throw bad('The co-applicant PAN is the same as the main applicant PAN');
  if (co.aadhaar_no && co.aadhaar_no === main.aadhaar) throw bad('The co-applicant Aadhaar is the same as the main applicant Aadhaar');
  if (co.mobile && co.mobile === main.mobile) throw bad('The co-applicant mobile is the same as the main applicant mobile');
  co.name = [co.first_name, co.last_name].filter(Boolean).join(' ');
  co.applicant_type = co.applicant_type || 'co_applicant';
  co.marital_status = co.marital_status || 'not_specified'; co.no_of_children = co.no_of_children ?? 0; co.has_poa = co.has_poa ?? false;
  for (const p of ['present', 'office', 'perm']) co[`${p}_country`] = co[`${p}_country`] || 'India';
  co.mailing_address_type = co.mailing_address_type || 'present'; co.communication_mode = co.communication_mode || 'email';
  return co;
};
const insertCols = (client: any, table: string, row: Record<string, any>, conflictTarget?: string) => {
  const cols = Object.keys(row);
  const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})`
    + (conflictTarget ? ` ON CONFLICT ${conflictTarget} DO UPDATE SET ${cols.filter(c => c !== 'consumer_id' && c !== 'applicant_number').map(c => `${c} = EXCLUDED.${c}`).join(', ')}, updated_at = NOW()` : '')
    + ' RETURNING id';
  return client.query(sql, cols.map(c => row[c]));
};

// POST /api/consumers - Create an applicant. The same mobile in the same project returns the existing applicant (details are filled in, never blanked).
router.post('/', requireProcess('new_applicant', 'maker'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const b = body(req);
    const mobile = mobileNo(b.mobile, 'Mobile number', true)!;
    const project = has(b.projectId ?? b.project_id) ? uuid(b.projectId ?? b.project_id, 'Project') : null;
    const f = cleanFields(b);
    const name = personName(b.name, f.first_name, f.last_name, f.applicant_type);
    if (!name || !hasLetter(name)) throw bad('Applicant name is required');
    const inc = b.incomeCategory ?? b.income_category;
    await classificationOk(project, has(inc) ? inc : null);
    const stage = b.lead_stage ?? b.leadStage;
    if (has(stage) && !LEAD_STAGES.includes(stage)) throw bad(`Lead stage must be one of ${LEAD_STAGES.join(', ')}`);
    if (has(stage) && stage !== 'enquiry' && stage !== 'interested') throw bad('A new applicant can only start as enquiry or interested');
    const co = prepCo({ ...b, applicant_type: f.applicant_type || 'individual' }, { mobile, pan: f.pan_no ?? null, aadhaar: f.aadhaar_no ?? null });
    const row: Record<string, any> = {
      present_country: 'India', office_country: 'India', perm_country: 'India', comm_country: 'India',
      mailing_address_type: 'present', communication_mode: 'email', nominee_share: 100, applicant_type: 'individual',
      marital_status: 'not_specified', no_of_children: 0, has_poa: false,
    };
    for (const [k, v] of Object.entries(f)) if (v !== null) row[k] = v;
    Object.assign(row, { name, mobile, project_id: project, lead_stage: stage || 'enquiry', income_category: inc || null, parivar_pehchan_patra: f.ppp_id ?? null, created_by_user_id: req.userId });
    delete row.ppp_id;
    if (row.pan_no) row.pan_hash = sha(row.pan_no);
    if (row.aadhaar_no) row.aadhaar_hash = sha(row.aadhaar_no);

    const out = await inTx(async (c) => {
      if (project && !(await c.query(`SELECT 1 FROM projects WHERE id = $1`, [project])).rows.length) throw bad('Project not found', 404);
      await lock(c, `consumer:${project || ''}:${mobile}`);
      if (row.pan_no) await lock(c, `consumer-pan:${project || ''}:${row.pan_no}`);
      const ex = (await c.query(`SELECT id, pan_no FROM consumers WHERE project_id IS NOT DISTINCT FROM $1 AND mobile = $2 FOR UPDATE`, [project, mobile])).rows[0];
      let id: string, reused = false;
      if (ex) {
        if (ex.pan_no && row.pan_no && ex.pan_no.toUpperCase() !== row.pan_no) throw conflict('This mobile number already belongs to an applicant with a different PAN.');
        await checkIdentity(c, project, ex.id, null, row.pan_no ?? null);
        const upd: Record<string, any> = {};
        for (const [k, v] of Object.entries(row)) if (v !== null && !['project_id', 'mobile', 'created_by_user_id', 'lead_stage', 'income_category', 'name'].includes(k) && !/_country$|^mailing_address_type$|^communication_mode$|^nominee_share$|^applicant_type$|^marital_status$|^no_of_children$|^has_poa$/.test(k)) upd[k] = v;
        for (const k of ['applicant_type', 'marital_status', 'no_of_children', 'has_poa']) if (f[k] !== undefined && f[k] !== null) upd[k] = row[k];
        const cols = Object.keys(upd);
        if (cols.length) await c.query(`UPDATE consumers SET ${cols.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_at = NOW() WHERE id = $1`, [ex.id, ...cols.map(k => upd[k])]);
        id = ex.id; reused = true;
      } else {
        await checkIdentity(c, project, null, null, row.pan_no ?? null);
        id = (await insertCols(c, 'consumers', row)).rows[0].id;
      }
      if (co) await insertCols(c, 'co_applicants', { ...co, consumer_id: id, applicant_number: 2 }, '(consumer_id, applicant_number)');
      const data = (await c.query(`SELECT id, name, mobile, email, lead_stage, project_id, created_at FROM consumers WHERE id = $1`, [id])).rows[0];
      return { data, reused };
    });
    await auditChange(db, req, res, out.reused ? 'update' : 'create', 'consumer', out.data.id, {}, forAudit({ name: out.data.name, mobile: out.data.mobile, project_id: project, ...(out.reused ? { reused: true } : {}) }));
    res.status(out.reused ? 200 : 201).json({ success: true, reused: out.reused, data: out.data });
  } catch (error) {
    fail(error, res, next);
  }
});

// GET /api/consumers - List applicants (search, filters, paging)
const SORTS: Record<string, string> = {
  created_at: 'c.created_at', name: 'c.name', mobile: 'c.mobile', email: 'c.email', lead_stage: 'c.lead_stage',
  unit_number: 'u.unit_number', project_name: 'p.name', allotment_date: 'al.allotment_date',
  registration_no: 'COALESCE(c.registration_no, br.registration_no)', registration_date: 'br.booking_date',
};
const LIST_FROM = `FROM consumers c
                 LEFT JOIN units u ON c.allocated_unit_id = u.id
                 LEFT JOIN towers t ON u.tower_id = t.id
                 LEFT JOIN LATERAL (
                   SELECT registration_no, booking_date, main_broker_id
                   FROM booking_records WHERE consumer_id = c.id
                   ORDER BY created_at DESC LIMIT 1
                 ) br ON true
                 LEFT JOIN brokers b ON br.main_broker_id = b.id
                 LEFT JOIN LATERAL (
                   SELECT name FROM co_applicants WHERE consumer_id = c.id ORDER BY applicant_number LIMIT 1
                 ) co ON true
                 LEFT JOIN projects p ON c.project_id = p.id
                 LEFT JOIN LATERAL (
                   SELECT allotment_date FROM allocations
                   WHERE consumer_id = c.id AND unit_id = c.allocated_unit_id
                   ORDER BY (status = 'allotted') DESC, created_at DESC LIMIT 1
                 ) al ON true`;
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = req.query as Record<string, any>;
    for (const [k, v] of Object.entries(q)) if (typeof v !== 'string') throw bad(`${k} is not valid`);
    const intIn = (v: any, label: string, dflt: number, min: number, max: number) => {
      if (v === undefined || v === '') return dflt;
      if (!/^\d{1,9}$/.test(v) || Number(v) < min || Number(v) > max) throw bad(`${label} must be a whole number from ${min} to ${max}`);
      return Number(v);
    };
    const page = intIn(q.page, 'page', 1, 1, 1000000), pageSize = intIn(q.pageSize, 'pageSize', 20, 1, 1000);
    const sortCol = q.sortBy === undefined || q.sortBy === '' ? SORTS.created_at : SORTS[q.sortBy];
    if (!sortCol) throw bad(`sortBy must be one of ${Object.keys(SORTS).join(', ')}`);
    if (q.sortOrder !== undefined && q.sortOrder !== '' && !['asc', 'desc'].includes(q.sortOrder)) throw bad('sortOrder must be asc or desc');
    const params: any[] = [];
    const w: string[] = [];
    const add = (sql: string, ...vals: any[]) => { let i = params.length; params.push(...vals); w.push(sql.replace(/\?/g, () => `$${++i}`)); };
    if (q.projectId) add('c.project_id = ?', uuid(q.projectId, 'projectId'));
    if (q.leadStage) { if (!LEAD_STAGES.includes(q.leadStage)) throw bad(`leadStage must be one of ${LEAD_STAGES.join(', ')}`); add('c.lead_stage = ?', q.leadStage); }
    if (q.unitNo) add(`u.unit_number ILIKE ? ESCAPE '\\'`, likeOf(q.unitNo));
    if (q.mobile) add(`c.mobile LIKE ? ESCAPE '\\'`, likeOf(q.mobile));
    if (q.regNo) add(`COALESCE(c.registration_no, br.registration_no) ILIKE ? ESCAPE '\\'`, likeOf(q.regNo));
    if (q.dob) add('c.dob = ?', pastDay(q.dob, 'dob'));
    if (q.pan) add(`c.pan_no ILIKE ? ESCAPE '\\'`, likeOf(q.pan));
    if (q.city) add(`c.present_city ILIKE ? ESCAPE '\\'`, likeOf(q.city));
    if (q.address) add(`c.present_address ILIKE ? ESCAPE '\\'`, likeOf(q.address));
    if (q.state) add(`c.present_state ILIKE ? ESCAPE '\\'`, likeOf(q.state));
    if (q.email) add(`c.email ILIKE ? ESCAPE '\\'`, likeOf(q.email));
    if (q.firstName) add(`c.first_name ILIKE ? ESCAPE '\\'`, likeOf(q.firstName));
    if (q.middleName) add(`c.middle_name ILIKE ? ESCAPE '\\'`, likeOf(q.middleName));
    if (q.lastName) add(`c.last_name ILIKE ? ESCAPE '\\'`, likeOf(q.lastName));
    if (q.secondApplicant) add(`co.name ILIKE ? ESCAPE '\\'`, likeOf(q.secondApplicant));
    if (q.secondApplicantPan) add(`EXISTS (SELECT 1 FROM co_applicants ca WHERE ca.consumer_id = c.id AND ca.pan_no ILIKE ? ESCAPE '\\')`, likeOf(q.secondApplicantPan));
    if (q.search) { const s = likeOf(q.search); add(`(c.name ILIKE ? ESCAPE '\\' OR c.mobile LIKE ? ESCAPE '\\' OR c.email ILIKE ? ESCAPE '\\' OR u.unit_number ILIKE ? ESCAPE '\\')`, s, s, s, s); }
    if (q.hasConfirmedBooking === 'true') w.push(`EXISTS (SELECT 1 FROM booking_records br2 WHERE br2.consumer_id = c.id AND br2.status IN ('active','complete'))`);
    if (q.hasLoan === 'true') w.push(`c.loan_amount > 0`);
    const where = w.length ? 'WHERE ' + w.join(' AND ') : '';
    const sql = `SELECT c.id, c.name, c.first_name, c.last_name, c.mobile, c.email, c.lead_stage, c.project_id, c.allocated_unit_id, c.created_at,
                        u.unit_number, u.super_area_sqft as unit_area, t.tower_name,
                        COALESCE(c.registration_no, br.registration_no) as registration_no, br.booking_date as registration_date,
                        b.name as broker_name, b.firm_name as broker_company_name,
                        co.name as second_applicant_name,
                        p.name as project_name,
                        al.allotment_date,
                        (SELECT COUNT(*) FROM documents WHERE consumer_id = c.id) as document_count
                 ${LIST_FROM} ${where}
                 ORDER BY ${sortCol} ${q.sortOrder === 'asc' ? 'ASC' : 'DESC'} NULLS LAST, c.id
                 LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
    const [dataResult, countResult] = await Promise.all([
      db.query(sql, params),
      db.query(`SELECT COUNT(*) ${LIST_FROM} ${where}`, params),
    ]);
    res.json({ success: true, data: dataResult.rows, pagination: { page, pageSize, total: parseInt(countResult.rows[0].count) } });
  } catch (error) {
    fail(error, res, next);
  }
});

// GET /api/consumers/:id - Get consumer detail
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT c.id, c.name, c.first_name, c.last_name, c.middle_name, c.photo_url,
              c.salutation, to_char(c.dob, 'YYYY-MM-DD') AS dob, c.gender, c.profession, c.nationality,
              c.annual_income, c.education, c.company, c.ppp_id, c.alt_mobile,
              c.mobile, c.email, c.email_2,
              c.aadhaar_no, c.pan_no, c.parivar_pehchan_patra,
              c.registration_no, c.form_no, c.project_id,
              c.income_category, c.lead_stage, c.allocated_unit_id, c.created_at,
              c.father_name, to_char(c.anniversary_date, 'YYYY-MM-DD') AS anniversary_date, c.marital_status,
              c.no_of_children, c.passport_no, c.designation, c.has_poa,
              c.present_address, c.present_address_line2, c.present_city, c.present_state, c.present_pin, c.present_country,
              c.present_phone_no, c.present_fax_no, c.present_mobile_no,
              c.office_address, c.office_city, c.office_state, c.office_pin, c.office_country,
              c.office_phone_no, c.office_fax_no, c.office_mobile_no,
              c.perm_address, c.perm_city, c.perm_state, c.perm_pin, c.perm_country,
              c.perm_phone_no, c.perm_fax_no, c.perm_mobile_no,
              c.comm_address_line1, c.comm_pin, c.comm_city, c.comm_state, c.comm_country,
              c.comm_phone_no, c.comm_fax_no, c.comm_mobile_no,
              c.phone_no, c.fax_no,
              c.nominee_name, c.nominee_relation, to_char(c.nominee_dob, 'YYYY-MM-DD') AS nominee_dob, c.nominee_share,
              c.finance_bank, c.loan_amount, to_char(c.loan_sanction_date, 'YYYY-MM-DD') AS loan_sanction_date,
              c.applicant_type, c.company_name, c.company_reg_no, c.company_gstin,
              c.authorized_person, c.authorized_designation,
              c.mailing_address_type, c.communication_mode,
              u.unit_number, u.bhk_type, u.carpet_area_sqft, u.balcony_area_sqft, u.base_price_inr,
              COALESCE((SELECT br.basic_rate_inr_sqft FROM booking_records br WHERE br.consumer_id = c.id AND COALESCE(br.status,'') <> 'cancelled' ORDER BY br.created_at DESC LIMIT 1), u.basic_price) AS basic_price,
              p.name as project_name
       FROM consumers c
       LEFT JOIN units u ON c.allocated_unit_id = u.id
       LEFT JOIN projects p ON c.project_id = p.id
       WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Consumer not found' });
    }

    // Fetch KYC documents
    const kycResult = await db.query(
      `SELECT id, document_type, file_url, expiry_date, verified FROM kyc_documents WHERE consumer_id = $1`,
      [id]
    );

    // Fetch payment summary
    const paymentResult = await db.query(
      `SELECT
        SUM(total_amount_inr) as total_due,
        (SELECT COALESCE(SUM(amount_received_inr), 0) FROM receipts WHERE consumer_id = $1 AND status = 'cleared') as collected
       FROM payment_plans WHERE consumer_id = $1`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...result.rows[0],
        kycDocuments: kycResult.rows,
        paymentSummary: paymentResult.rows[0],
      },
    });
  } catch (error) {
    next(error);
  }
});


// PATCH /api/consumers/:id - Update an applicant. Only the fields sent are changed; sending a blank clears an optional field.
const STAGE_NEEDS_UNIT = ['allotted', 'onboarded'], STAGE_NEEDS_PROCESS = ['cancelled', 'transferred'];
router.patch('/:id', requireProcess('edit_applicant', 'maker'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const b = body(req);
    const errs: Record<string, { e: any; raw: any }> = {};
    const f = cleanFields(b, undefined, errs);
    const upd: Record<string, any> = {};
    for (const [k, v] of Object.entries(f)) {
      // These always keep a value
      if (v === null && k === 'applicant_type') upd[k] = 'individual';
      else if (v === null && k === 'marital_status') upd[k] = 'not_specified';
      else if (v === null && k === 'no_of_children') upd[k] = 0;
      else if (v === null && k === 'nominee_share') upd[k] = 100;
      else upd[k] = v;
    }
    delete upd.ppp_id;
    if (f.ppp_id !== undefined) upd.parivar_pehchan_patra = f.ppp_id;
    if (b.mobile !== undefined) { try { upd.mobile = mobileNo(b.mobile, 'Mobile number', true); } catch (e: any) { if (!e?.http || !has(b.mobile)) throw e; errs.mobile = { e, raw: b.mobile }; } }
    const inc = b.incomeCategory ?? b.income_category;
    if (inc !== undefined) { await classificationOk((await db.query('SELECT project_id FROM consumers WHERE id = $1', [id])).rows[0]?.project_id, inc); upd.income_category = inc || null; }
    const stage = b.leadStage ?? b.lead_stage;
    if (stage !== undefined) { if (!LEAD_STAGES.includes(stage)) throw bad(`Lead stage must be one of ${LEAD_STAGES.join(', ')}`); upd.lead_stage = stage; }
    if (upd.pan_no !== undefined) upd.pan_hash = upd.pan_no ? sha(upd.pan_no) : null;
    if (upd.aadhaar_no !== undefined) upd.aadhaar_hash = upd.aadhaar_no ? sha(upd.aadhaar_no) : null;
    if (b.name !== undefined && !has(b.name) && f.first_name === undefined && f.last_name === undefined) throw bad('Name cannot be blank');

    const out = await inTx(async (c) => {
      const cur0 = (await c.query(`SELECT project_id FROM consumers WHERE id = $1`, [id])).rows[0];
      if (!cur0) throw bad('Applicant not found', 404);
      // same lock names as create, so two people taking one mobile / PAN at once are told apart
      if (upd.mobile) await lock(c, `consumer:${cur0.project_id || ''}:${upd.mobile}`);
      if (upd.pan_no) await lock(c, `consumer-pan:${cur0.project_id || ''}:${upd.pan_no}`);
      const cur = (await c.query(`SELECT * FROM consumers WHERE id = $1 FOR UPDATE`, [id])).rows[0];
      if (!cur) throw bad('Applicant not found', 404);
      // The present address is asked for on every booking, so it cannot be wiped while the applicant holds one
      if (upd.present_address === null && (await c.query("SELECT 1 FROM booking_records WHERE consumer_id = $1 AND status <> 'cancelled' LIMIT 1", [id])).rows.length) throw bad('The present address cannot be cleared while the applicant has a booking');
      // Old records may hold values that today's rules refuse; sending such a value back unchanged is fine, a new bad value is not
      for (const [col, { e, raw }] of Object.entries(errs)) if (asText(typeof raw === 'string' ? raw.trim() : raw) !== asText(cur[col])) throw e;
      if (f.first_name !== undefined || f.last_name !== undefined || b.name !== undefined) {
        const nm = personName(b.name, f.first_name !== undefined ? f.first_name : cur.first_name, f.last_name !== undefined ? f.last_name : cur.last_name, upd.applicant_type ?? cur.applicant_type)
          ?? (b.name === undefined ? cur.name : null);
        if (!nm || !hasLetter(nm)) throw bad('Name cannot be blank');
        upd.name = nm;
      }
      if (upd.mobile !== undefined || upd.pan_no) await checkIdentity(c, cur.project_id, id, upd.mobile && upd.mobile !== cur.mobile ? upd.mobile : null, upd.pan_no && String(upd.pan_no).toUpperCase() !== String(cur.pan_no || '').toUpperCase() ? upd.pan_no : null);
      if (upd.dob !== undefined && cur.applicant_type === 'company') delete upd.dob;
      if (upd.lead_stage && upd.lead_stage !== cur.lead_stage) {
        if (STAGE_NEEDS_UNIT.includes(upd.lead_stage) && !cur.allocated_unit_id) throw conflict(`An applicant can be moved to "${upd.lead_stage}" only after a unit is allotted.`);
        if (STAGE_NEEDS_PROCESS.includes(upd.lead_stage) && (await c.query(`SELECT 1 FROM booking_records WHERE consumer_id = $1 AND COALESCE(status,'') IN ('active','complete') LIMIT 1`, [id])).rows.length) {
          throw conflict(`This applicant has a live booking. Use the ${upd.lead_stage === 'cancelled' ? 'Surrender / Cancellation' : 'Transfer'} process instead of changing the stage here.`);
        }
      }
      const cols = Object.keys(upd).filter(k => upd[k] !== undefined && asText(upd[k]) !== asText(cur[k]));
      const shown = `id, name, email, income_category, lead_stage, mailing_address_type, communication_mode,
                  comm_address_line1, comm_pin, comm_city, comm_state, comm_country, updated_at`;
      if (!cols.length) return { cur, row: (await c.query(`SELECT ${shown} FROM consumers WHERE id = $1`, [id])).rows[0], changed: [] as string[] };
      const row = (await c.query(`UPDATE consumers SET ${cols.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_at = NOW() WHERE id = $1
        RETURNING ${shown}`, [id, ...cols.map(k => upd[k])])).rows[0];
      return { cur, row, changed: cols };
    });
    if (out.changed.length) {
      const pick = (o: any) => forAudit(Object.fromEntries(out.changed.filter(k => !k.endsWith('_hash')).map(k => [k, o[k] instanceof Date ? o[k].toLocaleDateString('en-CA') : o[k] ?? null])));
      await auditChange(db, req, res, 'update', 'consumer', id, pick(out.cur), forAudit(Object.fromEntries(out.changed.filter(k => !k.endsWith('_hash')).map(k => [k, upd[k]]))));
    }
    res.locals.auditLogged = true; // nothing worth logging when nothing changed
    res.json({ success: true, data: out.row, changed: out.changed.filter(k => !k.endsWith('_hash')) });
  } catch (error) {
    fail(error, res, next);
  }
});

// POST /api/consumers/:id/photo - Upload applicant photo
router.post('/:id/photo', photoUpload, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const photoUrl = await savePhoto(req, 'consumer', req.params.id);
    await db.query(`UPDATE consumers SET photo_url = $1, updated_at = NOW() WHERE id = $2`, [photoUrl, req.params.id]);
    res.json({ success: true, data: { photo_url: photoUrl } });
  } catch (err) { fail(err, res, next); }
});

// POST /api/consumers/:id/co-applicant-photo - Upload co-applicant (second applicant) photo
router.post('/:id/co-applicant-photo', photoUpload, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const co = (await db.query(`SELECT id FROM co_applicants WHERE consumer_id = $1 AND applicant_number = 2`, [req.params.id])).rows[0];
    if (!co) return res.status(404).json({ error: 'This applicant has no co-applicant' });
    const photoUrl = await savePhoto(req, 'co', req.params.id);
    await db.query(`UPDATE co_applicants SET photo_url = $1 WHERE id = $2`, [photoUrl, co.id]);
    res.json({ success: true, data: { photo_url: photoUrl } });
  } catch (err) { fail(err, res, next); }
});

// POST /api/consumers/:id/kyc-documents - Register a KYC document
const KYC_TYPES = ['aadhaar', 'pan', 'income_cert', 'affidavit', 'bank_details', 'photo', 'address_proof'];
router.post('/:id/kyc-documents', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const b = body(req);
    if (typeof b.documentType !== 'string' || !KYC_TYPES.includes(b.documentType)) throw bad(`documentType must be one of ${KYC_TYPES.join(', ')}`);
    const url = text(b.fileUrl, 'fileUrl', 1000, true)!;
    if (!/^(\/uploads\/[\w./-]+|https:\/\/[^\s]+)$/.test(url) || url.includes('..')) throw bad('fileUrl must be an uploaded file path or an https link');
    const expiry = day(b.expiryDate, 'expiryDate');
    const result = await db.query(
      `INSERT INTO kyc_documents (consumer_id, document_type, file_url, expiry_date, uploaded_by_user_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, document_type, file_url, to_char(expiry_date, 'YYYY-MM-DD') AS expiry_date`,
      [req.params.id, b.documentType, url, expiry, req.userId]
    );
    await auditChange(db, req, res, 'create', 'consumer_kyc_document', result.rows[0].id, {}, { consumer_id: req.params.id, document_type: b.documentType });
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) { fail(error, res, next); }
});

// POST /api/consumers/:id/remarks - Add remark
router.post('/:id/remarks', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const b = body(req);
    const channel = text(b.channel, 'channel', 50, false), subject = text(b.subject, 'subject', 255, false);
    const notes = text(b.notes, 'notes', 5000, true);
    const follow = day(b.followUpDate, 'followUpDate');
    if (b.tags !== undefined && b.tags !== null && (!Array.isArray(b.tags) || b.tags.length > 20)) throw bad('tags must be a list of at most 20 words');
    const tags = (b.tags || []).map((t: any) => text(t, 'tag', 40, true));
    const result = await db.query(
      `INSERT INTO remarks (consumer_id, user_id, channel, subject, notes, follow_up_date, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, channel, subject, notes, timestamp`,
      [req.params.id, req.userId, channel, subject, notes, follow, tags]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) { fail(error, res, next); }
});

// GET /api/consumers/:id/remarks - Get remarks log
router.get('/:id/remarks', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT id, channel, subject, notes, timestamp, to_char(follow_up_date, 'YYYY-MM-DD') AS follow_up_date, tags
       FROM remarks WHERE consumer_id = $1
       ORDER BY timestamp DESC`,
      [req.params.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) { next(error); }
});

// POST /api/consumers/:id/base-rate - Update the unit's basic price from the Pricing Matrix. A unit that already has a booking keeps its price.
router.post('/:id/base-rate', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!hasPermission(req.userRole, 'master_data', 'edit')) return res.status(403).json({ error: 'Changing a unit price needs the master data permission' });
    const id = req.params.id;
    const rate = num(body(req).baseRate, 'baseRate', 1e10, 2);
    if (rate <= 0) throw bad('baseRate must be more than 0');
    const out = await inTx(async (c) => {
      const cons = (await c.query(`SELECT allocated_unit_id FROM consumers WHERE id = $1`, [id])).rows[0];
      if (!cons?.allocated_unit_id) throw bad('Consumer has no allocated unit');
      const u = (await c.query(`SELECT id, basic_price, status FROM units WHERE id = $1 FOR UPDATE`, [cons.allocated_unit_id])).rows[0];
      if (!u) throw bad('Unit not found', 404);
      if ((await c.query(`SELECT 1 FROM booking_records WHERE unit_id = $1 AND COALESCE(status,'') <> 'cancelled' LIMIT 1`, [u.id])).rows.length) {
        throw conflict('This unit already has a booking, so its price can no longer be changed.');
      }
      await c.query(`UPDATE units SET basic_price = $1, updated_at = NOW() WHERE id = $2`, [rate, u.id]);
      await c.query(
        `INSERT INTO financial_audit_logs (consumer_id, user_id, action_type, old_value, new_value, remarks)
         VALUES ($1, $2, 'BASE_RATE_UPDATE', $3, $4, 'Manual update from Pricing Matrix')`,
        [id, req.userId, JSON.stringify({ basic_price: u.basic_price }), JSON.stringify({ basic_price: rate })]
      );
      return { unitId: u.id, old: u.basic_price };
    });
    await auditChange(db, req, res, 'update', 'unit', out.unitId, { basic_price: out.old }, { basic_price: rate });
    res.json({ success: true, message: 'Base rate updated successfully' });
  } catch (error) { fail(error, res, next); }
});

// POST /api/consumers/:id/multi-applicants - Save/replace all additional applicants (applicant_number 3 and up)
router.post('/:id/multi-applicants', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const list = body(req).applicants ?? [];
    if (!Array.isArray(list) || list.length > 10) throw bad('applicants must be a list of at most 10 people');
    const main = (await db.query(`SELECT mobile, pan_no, aadhaar_no FROM consumers WHERE id = $1`, [id])).rows[0];
    const seen = { pan: new Set<string>(), mobile: new Set<string>(), aadhaar: new Set<string>() };
    const rows = list.map((a: any, i: number) => {
      if (!a || typeof a !== 'object' || Array.isArray(a)) throw bad(`Applicant ${i + 3} is not valid`);
      const who = `Applicant ${i + 3}`;
      let r: Record<string, any>;
      try {
        r = cleanFields(a, CO_COLS);
        if (has(a.mobile)) r.mobile = mobileNo(a.mobile, 'Mobile');
        if (!r.first_name) throw bad('First name is required');
      } catch (e: any) { throw e?.http ? bad(`${who}: ${e.message}`) : e; }
      for (const [label, key, set, mainVal] of [['PAN', 'pan_no', seen.pan, main.pan_no && String(main.pan_no).toUpperCase()], ['mobile', 'mobile', seen.mobile, main.mobile], ['Aadhaar', 'aadhaar_no', seen.aadhaar, main.aadhaar_no]] as const) {
        const v = r[key];
        if (!v) continue;
        if (v === mainVal) throw bad(`${who}: the ${label} is the same as the main applicant`);
        if (set.has(v)) throw bad(`${who}: the ${label} is repeated for another applicant in this list`);
        set.add(v);
      }
      r.name = [r.first_name, r.last_name].filter(Boolean).join(' ');
      r.marital_status = r.marital_status || 'not_specified'; r.no_of_children = r.no_of_children ?? 0; r.has_poa = r.has_poa ?? false;
      return { ...r, consumer_id: id, applicant_number: i + 3 };
    });
    const inserted = await inTx(async (c) => {
      await lock(c, `multi:${id}`);
      await c.query(`DELETE FROM co_applicants WHERE consumer_id = $1 AND applicant_number > 2`, [id]);
      const out: any[] = [];
      for (const r of rows) out.push({ id: (await insertCols(c, 'co_applicants', r)).rows[0].id, applicant_number: r.applicant_number });
      return out;
    });
    await auditChange(db, req, res, 'update', 'consumer_applicants', id, {}, { additional_applicants: rows.map((r: any) => r.name) });
    res.status(201).json({ success: true, data: inserted });
  } catch (error) { fail(error, res, next); }
});

// GET /api/consumers/:id/multi-applicants - List additional applicants
router.get('/:id/multi-applicants', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT id, consumer_id, name, first_name, last_name, salutation, relationship,
              pan_no, aadhaar_no, mobile, email, to_char(dob, 'YYYY-MM-DD') AS dob,
              middle_name, gender, father_name, to_char(anniversary_date, 'YYYY-MM-DD') AS anniversary_date, marital_status,
              no_of_children, passport_no, email_2, designation, has_poa,
              nationality, profession, photo_url, applicant_number
       FROM co_applicants
       WHERE consumer_id = $1 AND applicant_number > 2
       ORDER BY applicant_number`,
      [req.params.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) { next(error); }
});

// DELETE /api/consumers/:id/multi-applicants/:applicantId - Delete one additional applicant and renumber the rest
router.delete('/:id/multi-applicants/:applicantId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id, applicantId } = req.params;
    await inTx(async (c) => {
      await lock(c, `multi:${id}`);
      await c.query(`DELETE FROM co_applicants WHERE id = $1 AND consumer_id = $2 AND applicant_number > 2`, [applicantId, id]);
      const remaining = await c.query(`SELECT id FROM co_applicants WHERE consumer_id = $1 AND applicant_number > 2 ORDER BY applicant_number`, [id]);
      // two steps: moving straight to the new numbers could meet the (consumer, number) unique rule halfway
      await c.query(`UPDATE co_applicants SET applicant_number = applicant_number + 1000 WHERE consumer_id = $1 AND applicant_number > 2`, [id]);
      for (let i = 0; i < remaining.rows.length; i++) await c.query(`UPDATE co_applicants SET applicant_number = $1 WHERE id = $2`, [i + 3, remaining.rows[i].id]);
    });
    await auditChange(db, req, res, 'delete', 'consumer_applicants', applicantId, {}, {});
    res.json({ success: true });
  } catch (error) { fail(error, res, next); }
});

// POST /api/consumers/:id/multi-applicant-photo/:applicantId - Upload photo for one additional applicant
router.post('/:id/multi-applicant-photo/:applicantId', photoUpload, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { applicantId } = req.params;
    const photoUrl = await savePhoto(req, 'addl', applicantId);
    await db.query(`UPDATE co_applicants SET photo_url = $1 WHERE id = $2 AND consumer_id = $3`, [photoUrl, applicantId, req.params.id]);
    res.json({ success: true, data: { photo_url: photoUrl } });
  } catch (err) { fail(err, res, next); }
});

// GET /api/consumers/:id/applicant-file
// Returns a 3-page applicant file as HTML for printing.
// Supports ?token= query param for window.open() navigation.
router.get('/:id/applicant-file', requirePrint, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const consumerId = req.params.id;

    // ── parallel queries ─────────────────
    const [settingsRes, consumerBookingRes, coApplicantsRes, parkingRes] = await Promise.all([
      db.query(`SELECT key, value FROM global_settings`),
      db.query(`
        SELECT br.*, br.communication_mode, br.mailing_address_type,
          c.first_name, c.last_name, c.middle_name, c.salutation,
          c.father_name, c.dob, c.mobile, c.email, c.email_2,
          c.pan_no, c.aadhaar_no, c.passport_no, c.nationality,
          c.gender, c.profession, c.designation, c.company,
          c.no_of_children, c.has_poa, c.marital_status,
          c.present_address, c.present_city, c.present_state,
          c.present_pin, c.present_country, c.present_phone_no,
          c.office_address, c.office_city, c.office_state, c.office_pin, c.office_country,
          c.perm_address, c.perm_city, c.perm_state, c.perm_pin, c.perm_country,
          c.comm_address_line1, c.comm_city, c.comm_state, c.comm_pin, c.comm_country,
          c.form_no AS consumer_form_no, c.registration_no AS consumer_reg_no,
          c.income_category, c.lead_stage, c.annual_income,
          c.grace_period_days, c.interest_start_date,
          u.unit_number, u.floor, u.bhk_type,
          -- the deal was priced on the booking's own area: a unit shift must not change it
          COALESCE(NULLIF(br.carpet_area_sqft, 0), u.carpet_area_sqft) AS carpet_area_sqft, u.super_area_sqft, u.balcony_area_sqft,
          u.base_price_inr, u.total_price_inr, u.facing,
          t.tower_name,
          p.name AS project_name, p.location AS project_location,
          p.rera_number,
          bpt.cgst_pct, bpt.sgst_pct,
          bpt.cgst_amount, bpt.sgst_amount,
          bpt.tds_amount, bpt.gst_interest_pct, bpt.s_tax_pct,
          b.name AS broker_name, b.rera_number AS broker_rera,
          e.name AS employee_name,
          u2.name AS created_by_name,
          COALESCE((
            SELECT SUM(r.amount_received_inr)
            FROM receipts r
            WHERE r.consumer_id = c.id
            AND r.status = 'cleared' AND NOT COALESCE(r.is_advance, false)
          ), 0) AS total_received_inr,
          COALESCE((
            SELECT json_agg(json_build_object(
              'installment_index', rr.installment_index,
              'total_paid', rr.total_paid
            ))
            FROM (
              SELECT installment_index,
                     SUM(amount_received_inr) AS total_paid
              FROM receipts
              WHERE consumer_id = c.id
                AND status = 'cleared'
              GROUP BY installment_index
            ) rr
          ), '[]'::json) AS installment_payments
        FROM consumers c
        LEFT JOIN booking_records br
          ON br.consumer_id = c.id
          AND br.status IN ('complete','pending_payment','active')
        LEFT JOIN units u ON u.id = br.unit_id
        LEFT JOIN towers t ON t.id = u.tower_id
        LEFT JOIN projects p ON p.id = br.project_id
        LEFT JOIN booking_payment_taxes bpt ON bpt.booking_record_id = br.id
        LEFT JOIN brokers b ON b.id = br.broker_id
        LEFT JOIN users e ON e.id = br.sales_employee_id
        LEFT JOIN users u2 ON u2.id = br.created_by
        WHERE c.id = $1
        ORDER BY br.created_at DESC
        LIMIT 1`,
        [consumerId],
      ),
      db.query(
        `SELECT * FROM co_applicants WHERE consumer_id = $1 ORDER BY applicant_number ASC`,
        [consumerId],
      ),
      db.query(
        `SELECT slot_number, parking_type AS type, floor, amount_inr
         FROM parking_slots WHERE allotted_to_consumer_id = $1`,
        [consumerId],
      ),
    ]);

    if (consumerBookingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Consumer not found' });
    }

    const row = consumerBookingRes.rows[0];

    // ── build flat settings object ────────
    const settings: Record<string, string> = {};
    settingsRes.rows.forEach((r: any) => { settings[r.key] = r.value; });

    // ── separate consumer from booking ────
    const consumer = {
      id:                  consumerId,
      first_name:          row.first_name,
      last_name:           row.last_name,
      middle_name:         row.middle_name,
      salutation:          row.salutation,
      father_name:         row.father_name,
      dob:                 row.dob,
      mobile:              row.mobile,
      email:               row.email,
      email_2:             row.email_2,
      pan_no:              row.pan_no,
      aadhaar_no:          row.aadhaar_no,
      passport_no:         row.passport_no,
      nationality:         row.nationality,
      gender:              row.gender,
      profession:          row.profession,
      designation:         row.designation,
      company:             row.company,
      no_of_children:      row.no_of_children,
      has_poa:             row.has_poa,
      marital_status:      row.marital_status,
      present_address:     row.present_address,
      present_city:        row.present_city,
      present_state:       row.present_state,
      present_pin:         row.present_pin,
      present_country:     row.present_country,
      present_phone_no:    row.present_phone_no,
      office_address:      row.office_address,
      office_city:         row.office_city,
      office_state:        row.office_state,
      office_pin:          row.office_pin,
      office_country:      row.office_country,
      perm_address:        row.perm_address,
      perm_city:           row.perm_city,
      perm_state:          row.perm_state,
      perm_pin:            row.perm_pin,
      perm_country:        row.perm_country,
      comm_address_line1:  row.comm_address_line1,
      comm_city:           row.comm_city,
      comm_state:          row.comm_state,
      comm_pin:            row.comm_pin,
      comm_country:        row.comm_country,
      mailing_address_type:row.mailing_address_type,
      communication_mode:  row.communication_mode,
      form_no:             row.consumer_form_no,
      registration_no:     row.consumer_reg_no,
      income_category:     row.income_category,
      lead_stage:          row.lead_stage,
      interest_start_date: row.interest_start_date ?? null,
      grace_period_days:   row.grace_period_days   ?? 0,
    };

    // ── sequential queries needing project_id ─
    const projectId      = row.project_id     || null;
    const selectedPlan   = row.selected_plan_name || null;

    const [templatesRes, allocationRes, dispatchRes, receiptsRes, demandsRes] = await Promise.all([
      projectId && selectedPlan
        ? db.query(
            `SELECT * FROM plan_schedule_templates
             WHERE project_id = $1 AND plan_name = $2
             ORDER BY installment_index ASC`,
            [projectId, selectedPlan],
          )
        : Promise.resolve({ rows: [] }),
      db.query(
        `SELECT * FROM allocations WHERE consumer_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [consumerId],
      ),
      db.query(
        `SELECT * FROM document_dispatch WHERE consumer_id = $1 ORDER BY dispatched_at DESC`,
        [consumerId],
      ),
      db.query(
        `SELECT r.receipt_number, r.received_date, r.amount_received_inr,
                r.payment_method, r.cheque_no, r.transaction_ref, r.cheque_date,
                r.bank_name, r.branch, r.interest_amount, r.status,
                r.deposit_date, r.clearing_date, r.hold_remark,
                r.cgst_amount AS cgst_amount,
                r.sgst_amount AS sgst_amount,
                COALESCE(d.demand_type, NULLIF(TRIM(r.other_charge_desc), ''), 'Booking') AS on_account_of
         FROM receipts r
         LEFT JOIN demands d ON d.id = r.demand_id
         LEFT JOIN payment_plans pp2 ON pp2.id = r.payment_plan_id
         LEFT JOIN projects proj ON proj.id = pp2.project_id
         LEFT JOIN LATERAL (
           SELECT gts.cgst_pct, gts.sgst_pct
           FROM gst_tax_charge_mapping gcm
           JOIN gst_slabs gs ON gs.id = gcm.slab_id
             AND gs.from_date <= ${SQL_TODAY} AND gs.to_date >= ${SQL_TODAY}
           JOIN gst_tax_setup gts ON gts.id = gcm.gst_tax_id
           WHERE gcm.project_id = proj.id AND gcm.charge_type = 'BASIC'
           LIMIT 1
         ) grate ON true
         LEFT JOIN LATERAL (
           SELECT
             (ROUND(r.amount_received_inr * 100) -
               FLOOR(ROUND(r.amount_received_inr * 100) / (1 + (COALESCE(grate.cgst_pct,0.5) + COALESCE(grate.sgst_pct,0.5)) / 100.0))
             )::bigint AS total_tax_paise
         ) ttax ON true
         LEFT JOIN LATERAL (
           SELECT
             CASE
               WHEN COALESCE(grate.cgst_pct,0.5) = COALESCE(grate.sgst_pct,0.5)
                 THEN FLOOR(ttax.total_tax_paise / 2.0)
               ELSE ROUND(ttax.total_tax_paise * COALESCE(grate.cgst_pct,0.5) / (COALESCE(grate.cgst_pct,0.5) + COALESCE(grate.sgst_pct,0.5)))
             END::bigint AS cgst_paise
         ) gtax ON true
         WHERE r.consumer_id = $1
           AND r.status != 'cancelled'
           AND r.payment_plan_id = (
             SELECT id FROM payment_plans
             WHERE consumer_id = $1
               AND unit_id = $2
             ORDER BY created_at DESC
             LIMIT 1
           )
         ORDER BY r.received_date ASC, r.created_at ASC`,
        [consumerId, row.unit_id],
      ),
      db.query(
        `SELECT id, installment_index, due_date, status, amount_due_inr, addon_charge_amount, addon_cgst_amount, addon_sgst_amount, cgst_amount, sgst_amount
         FROM demands
         WHERE consumer_id = $1
           AND status != 'cancelled'
           AND payment_plan_id = (
             SELECT id FROM payment_plans
             WHERE consumer_id = $1
               AND unit_id = $2
             ORDER BY created_at DESC
             LIMIT 1
           )
         ORDER BY installment_index ASC`,
        [consumerId, row.unit_id],
      ),
    ]);

    // Interest/base-price GST is never charged to NRI/OCI/PIO consumers --
    // the fallback backward-derive above computes a rate regardless of
    // nationality, so zero it out here for NRI (mirrors the existing
    // isNri gate used elsewhere for demand-linked amounts).
    if (['nri', 'oci', 'pio'].includes((row.nationality || '').toLowerCase())) {
      receiptsRes.rows.forEach((rr: any) => {
        rr.cgst_amount = 0;
        rr.sgst_amount = 0;
      });
    }

    // Waterfall allocation: replace installment_payments with accurate per-installment paid amounts.
    // The SQL subquery groups by installment_index which loses NULL-indexed advance receipts.
    const [wfRcptsRes, wfDemandsRes] = await Promise.all([
      db.query(
        `SELECT id, amount_received_inr, demand_id, installment_index, status, received_date, created_at, cgst_amount, sgst_amount
         FROM receipts WHERE consumer_id = $1 AND status = 'cleared'
           AND payment_plan_id = (
             SELECT id FROM payment_plans
             WHERE consumer_id = $1
               AND unit_id = $2
             ORDER BY created_at DESC
             LIMIT 1
           )
         ORDER BY received_date ASC, created_at ASC`,
        [consumerId, row.unit_id]
      ),
      db.query(
        `SELECT id, installment_index, amount_due_inr, cgst_amount, sgst_amount,
                addon_charge_amount, addon_cgst_amount, addon_sgst_amount
         FROM demands WHERE consumer_id = $1
           AND status != 'cancelled'
           AND payment_plan_id = (
             SELECT id FROM payment_plans
             WHERE consumer_id = $1
               AND unit_id = $2
             ORDER BY created_at DESC
             LIMIT 1
           )`,
        [consumerId, row.unit_id]
      ),
    ]);
    row.installment_payments = applyWaterfall(wfRcptsRes.rows, wfDemandsRes.rows).map(w => ({
      installment_index: w.installment_index,
      total_paid: w.paid,
    }));

    // ── Addon charges ─────────────────────────
    const addonChargesRes = await db.query(
      `SELECT
         cac.id,
         cac.charge_name,
         cac.effective_date,
         cac.amount,
         cac.increase_amount,
         cac.cgst_pct,
         cac.sgst_pct,
         cac.cgst_amount,
         cac.sgst_amount,
         cac.itc_cgst,
         cac.itc_sgst,
         cac.total_amount,
         cac.remark,
         cac.status
       FROM consumer_addon_charges cac
       WHERE cac.consumer_id = $1
       AND cac.status = 'active'
       ORDER BY cac.effective_date ASC,
                cac.created_at ASC`,
      [consumerId],
    );
    const addonCharges = addonChargesRes.rows;

    // ── Interest calculation rows ─────────────
    let penalRate = penalRateFrom(settings);
    if (projectId) {
      try {
        const projRateRes = await db.query(
          `SELECT rate_percent FROM project_interest_rates WHERE project_id = $1 AND effective_from <= ${SQL_TODAY} ORDER BY effective_from DESC LIMIT 1`,
          [projectId]
        );
        if (projRateRes.rows.length > 0) penalRate = parseFloat(projRateRes.rows[0].rate_percent);
      } catch { /* fall through to global rate */ }
    }
    const templateNameMap: Record<number, string> = {};
    const templateRateMap: Record<number, number | null> = {};
    templatesRes.rows.forEach((t: any) => {
      templateNameMap[t.installment_index] = t.installment_name;
      templateRateMap[t.installment_index] = t.interest_rate_percent != null ? parseFloat(t.interest_rate_percent) : null;
    });
    const demandsForInterest = demandsRes.rows.map((d: any) => ({
      ...d,
      installment_name:      templateNameMap[d.installment_index] || `Installment ${d.installment_index}`,
      interest_rate_percent: templateRateMap[d.installment_index] ?? null,
    }));
    const interestCalcRows = buildInterestRows(wfRcptsRes.rows, demandsForInterest, penalRate, {
      interestStartDate: consumer.interest_start_date ? new Date(String(consumer.interest_start_date)) : null,
      gracePeriodDays:   parseInt(String(consumer.grace_period_days || 0)),
      asOfDate:          businessDayStart(),
    });
    // ─────────────────────────────────────────

    const waiverRes = await db.query(
      `SELECT COALESCE(SUM(waiver_amount_inr), 0) AS total_waived
       FROM interest_waivers
       WHERE consumer_id = $1
         AND status = 'approved'`,
      [consumerId]
    );
    const totalWaivedInr = parseFloat(waiverRes.rows[0]?.total_waived || 0);

    // Fetch OTHER CHARGE GST rate for correct Page 1 Pricing Summary GST
    // (other charges carry different GST rate than basic price)
    const otherChargeGstRes = await db.query(
      `SELECT gts.cgst_pct, gts.sgst_pct
       FROM gst_tax_charge_mapping gcm
       JOIN gst_slabs gs
         ON gs.id = gcm.slab_id
        AND gs.from_date <= ${SQL_TODAY}
        AND gs.to_date   >= ${SQL_TODAY}
       JOIN gst_tax_setup gts
         ON gts.id = gcm.gst_tax_id
       WHERE gcm.project_id  = $1
         AND gcm.charge_type = 'OTHER CHARGE'
       LIMIT 1`,
      [projectId],
    );
    let otherChargeCgstPct = parseFloat(otherChargeGstRes.rows[0]?.cgst_pct || 0);
    let otherChargeSgstPct = parseFloat(otherChargeGstRes.rows[0]?.sgst_pct || 0);

    if (otherChargeGstRes.rows.length === 0) {
      const basicFallback = await db.query(
        `SELECT gts.cgst_pct, gts.sgst_pct
         FROM gst_tax_charge_mapping gcm
         JOIN gst_slabs gs
           ON gs.id = gcm.slab_id
          AND gs.from_date <= ${SQL_TODAY}
          AND gs.to_date   >= ${SQL_TODAY}
         JOIN gst_tax_setup gts
           ON gts.id = gcm.gst_tax_id
         WHERE gcm.project_id  = $1
           AND gcm.charge_type = 'BASIC'
         LIMIT 1`,
        [projectId],
      );
      otherChargeCgstPct = parseFloat(basicFallback.rows[0]?.cgst_pct || 0);
      otherChargeSgstPct = parseFloat(basicFallback.rows[0]?.sgst_pct || 0);
      if (basicFallback.rows.length > 0) {
        console.warn(
          `[GST] No OTHER CHARGE mapping for project ${projectId} — using BASIC rate for APF display.`
        );
      }
    }

    const html = await buildApplicantFileHtml(
      row,
      consumer,
      coApplicantsRes.rows,
      settings,
      allocationRes.rows[0] || null,
      parkingRes.rows,
      templatesRes.rows,
      dispatchRes.rows,
      receiptsRes.rows,
      demandsRes.rows,
      interestCalcRows,
      addonCharges,
      totalWaivedInr,
      otherChargeCgstPct,
      otherChargeSgstPct,
      consumerId,
    );

    // Persist to documents table on first view so it can be edited later
    let applicantDocId: string | null = null;
    try {
      const existing = await db.query(
        `SELECT id FROM documents WHERE document_type = 'applicant_file' AND consumer_id = $1 AND reference_id = COALESCE($2::uuid, $1::uuid) LIMIT 1`,
        [consumerId, row.unit_id || null]
      );
      if (existing.rows.length === 0) {
        const docInsert = await db.query(
          `INSERT INTO documents (document_type, consumer_id, html_content, reference_id, document_subtype, version_number, edit_count, is_edited, created_by_user_id)
           VALUES ('applicant_file', $1, $2, COALESCE($4::uuid, $1::uuid), 'applicant_file', 1, 0, FALSE, $3) RETURNING id`,
          [consumerId, html, req.userId || 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', row.unit_id || null]
        );
        applicantDocId = docInsert.rows[0].id;
        await db.query(
          `INSERT INTO document_versions (document_id, version_number, html_content, is_original, edit_reason)
           VALUES ($1, 1, $2, TRUE, 'Original generation')`,
          [applicantDocId, html]
        );
      } else {
        applicantDocId = existing.rows[0].id;
      }
    } catch { /* non-fatal — don't block the response */ }

    // Apply any active field overrides so edits persist across re-renders
    let finalHtml = html;
    if (applicantDocId) {
      try {
        const overridesRes = await db.query(
          `SELECT field_key, current_value FROM document_field_overrides
           WHERE document_id = $1 AND is_active = TRUE`,
          [applicantDocId]
        );
        if (overridesRes.rows.length > 0) {
          const overridesMap: Record<string, string> = {};
          overridesRes.rows.forEach((o: { field_key: string; current_value: string }) => {
            overridesMap[o.field_key] = o.current_value;
          });
          finalHtml = applyOverridesToHtml(html, overridesMap);
          // Keep stored html_content in sync with override-applied version
          await db.query(
            `UPDATE documents SET html_content = $1, updated_at = NOW() WHERE id = $2`,
            [finalHtml, applicantDocId]
          );
        }
      } catch { /* non-fatal */ }
    }

    const token = (req.headers.authorization?.split(' ')[1] || req.query.token as string || '');
    const htmlWithEdit = applicantDocId
      ? finalHtml.replace('</body>', buildEditScript(applicantDocId, token, 'applicant_file') + '\n</body>')
      : finalHtml;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(htmlWithEdit);
  } catch (err) {
    next(err);
  }
});

router.use(pgErrorHandler);

export default router;
