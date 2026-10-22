/**
 * Ownership transfer routes (mounted at /api/transfers): fee set-up, the transfer itself (a unit moves from one applicant to another together
 * with its plan, demands and receipts), history, reports, the transfer letter. Every id, date, amount and filter is checked before it reaches SQL.
 */
import { Router, Response, NextFunction } from 'express';
import { db, AuthRequest } from '../index.js';
import { requirePermission } from '../middleware/rbac.js';
import { requireProcess } from '../middleware/processPermission.js';
import { auditChange } from '../middleware/auditLogger.js';
import { pgErrorHandler } from '../middleware/pg-errors.js';
import { bad, failWith, uuid, has, num, text, day, flag, body, inTx } from '../utils/input.js';
import { gstinNo, likeOf } from '../utils/applicant.js';

function fmtDateIndia(d: any): string {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${dt.getFullYear()}`;
}

function fmtIndianNumber(n: number): string {
  if (!n) return '0';
  return Math.round(n).toLocaleString('en-IN');
}

function fmtIndianMoneyDecimal(n: number): string {
  return (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Every text a user typed is escaped before it goes into the printable letter
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const escRow = (row: Record<string, any>) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v === 'string' ? esc(v) : v]));

const router = Router();

const TYPES = ['Individual', 'Multiple', 'Company', 'Private Firms'];
const MAX_MONEY = 1_000_000_000;
const fail = (err: any, res: Response, next: NextFunction) => failWith(err, res, next, 'This transfer number already exists');
const query = (v: any, label: string, max = 100): string | null => {
  if (Array.isArray(v)) throw bad(`${label} is not valid`);
  return text(v, label, max, false);
};
const int = (v: any, label: string, min: number, max: number, dflt: number): number => {
  if (!has(v)) return dflt;
  if (typeof v !== 'string' && typeof v !== 'number') throw bad(`${label} is not valid`);
  const n = Number(v);
  if (!/^-?\d+$/.test(String(v)) || n < min || n > max) throw bad(`${label} must be a whole number from ${min} to ${max}`);
  return n;
};
const money = (v: any, label: string): number => (has(v) ? num(v, label, MAX_MONEY, 2) : 0);
// A date that is not in the future (one day of grace for the clock difference between browser and server)
const pastDay = (v: any, label: string): string | null => {
  const d = day(v, label);
  if (d && d > new Date(Date.now() + 864e5).toISOString().slice(0, 10)) throw bad(`${label} cannot be in the future`);
  return d;
};

/** GET /api/transfers/fee-master?projectId=uuid - transfer fee config of a project */
router.get('/fee-master', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!has(req.query.projectId)) throw bad('projectId is required');
    const projectId = uuid(req.query.projectId, 'projectId');
    const result = await db.query(`SELECT * FROM transfer_fee_master WHERE project_id = $1`, [projectId]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'No fee config for this project' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { fail(err, res, next); }
});

/** POST /api/transfers/fee-master - set (create or replace) the transfer fee config of a project. Needs master-data edit access. */
router.post('/fee-master', requirePermission('master_data', 'edit'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const b = body(req);
    if (!has(b.projectId)) throw bad('projectId is required');
    const projectId = uuid(b.projectId, 'projectId');
    const pct = (v: any, label: string, dflt = 0) => (has(v) ? num(v, label, 100, 4) : dflt);
    const v = {
      fee: money(b.transferFeeInr, 'Transfer fee'), admin: money(b.adminChargesInr, 'Admin charges'),
      cgst: pct(b.cgstPct, 'CGST %'), sgst: pct(b.sgstPct, 'SGST %'), igst: pct(b.igstPct, 'IGST %'), ugst: pct(b.ugstPct, 'UGST %'), stax: pct(b.servicetaxPct, 'Service tax %', 12.36),
      foc: flag(b.isFoc, 'isFoc') ?? false, from: day(b.effectiveFrom, 'effectiveFrom'),
    };
    const out = await inTx(async (c) => {
      if (!(await c.query(`SELECT 1 FROM projects WHERE id = $1`, [projectId])).rows.length) throw bad('Project not found', 404);
      const old = (await c.query(`SELECT * FROM transfer_fee_master WHERE project_id = $1`, [projectId])).rows[0];
      const r = await c.query(
        `INSERT INTO transfer_fee_master (project_id, transfer_fee_inr, admin_charges_inr, cgst_pct, sgst_pct, igst_pct, ugst_pct, service_tax_pct, is_foc, effective_from, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
         ON CONFLICT (project_id) DO UPDATE SET transfer_fee_inr = EXCLUDED.transfer_fee_inr, admin_charges_inr = EXCLUDED.admin_charges_inr, cgst_pct = EXCLUDED.cgst_pct,
           sgst_pct = EXCLUDED.sgst_pct, igst_pct = EXCLUDED.igst_pct, ugst_pct = EXCLUDED.ugst_pct, service_tax_pct = EXCLUDED.service_tax_pct, is_foc = EXCLUDED.is_foc,
           effective_from = EXCLUDED.effective_from, updated_at = now()
         RETURNING *`,
        [projectId, v.fee, v.admin, v.cgst, v.sgst, v.igst, v.ugst, v.stax, v.foc, v.from]
      );
      await auditChange(c, req, res, old ? 'update' : 'create', 'transfer_fee_master', r.rows[0].id, old && { transfer_fee_inr: old.transfer_fee_inr, admin_charges_inr: old.admin_charges_inr, is_foc: old.is_foc },
        { transfer_fee_inr: v.fee, admin_charges_inr: v.admin, is_foc: v.foc });
      return r.rows[0];
    });
    res.json({ success: true, data: out });
  } catch (err) { fail(err, res, next); }
});

/**
 * POST /api/transfers - transfer a unit from one applicant to another. The plan, demands, receipts, booking and add-on charges go with the unit;
 * the seller's paid / due / balance are written down first for the letter. All in one transaction, the unit and both applicants locked.
 */
router.post('/', requireProcess('applicant_transfer', 'maker'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const b = body(req);
    if (!has(b.unitId) || !has(b.oldConsumerId) || !has(b.newConsumerId)) throw bad('unitId, oldConsumerId, and newConsumerId are required');
    const unitId = uuid(b.unitId, 'unitId'), oldId = uuid(b.oldConsumerId, 'oldConsumerId'), newId = uuid(b.newConsumerId, 'newConsumerId');
    if (oldId === newId) throw bad('The buyer must be a different applicant from the seller');
    const f = {
      fee: money(b.transferFee, 'Transfer fee'), admin: money(b.adminCharges, 'Admin charges'), amount: money(b.transferAmountInr, 'Transfer amount'),
      stax: money(b.staxAmount, 'Service tax'), cgst: money(b.cgstAmount, 'CGST'), sgst: money(b.sgstAmount, 'SGST'), igst: money(b.igstAmount, 'IGST'), ugst: money(b.ugstAmount, 'UGST'),
      basic: money(b.basicPrice, 'Basic price'),
      remarks: text(b.remarks, 'Remarks', 1000, false), no: text(b.transferNo, 'Transfer number', 50, false), receiptNo: text(b.transferReceiptNo, 'Transfer receipt number', 50, false),
      gstin: gstinNo(b.gstin), broker: text(b.brokerCompany, 'Broker company', 150, false), mainBroker: text(b.mainBroker, 'Main broker', 150, false), sales: text(b.salesPersonName, 'Sales person', 150, false),
      type: has(b.transferType) ? String(b.transferType) : 'Individual', app: pastDay(b.applicationDate, 'Application date'), date: pastDay(b.transferDate, 'Transfer date'),
    };
    if (!TYPES.concat('individual').includes(f.type)) throw bad(`transferType must be one of ${TYPES.join(', ')}`);
    if (f.app && f.date && f.app > f.date) throw bad('The application date cannot be after the transfer date');

    const out = await inTx(async (c) => {
      // One transfer of a unit at a time, and one transfer number at a time
      await c.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`transfer-unit:${unitId}`]);
      if (f.no) await c.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`transfer-no:${f.no.toLowerCase()}`]);
      const unit = (await c.query(`SELECT id, project_id FROM units WHERE id = $1`, [unitId])).rows[0];
      if (!unit) throw bad('Unit not found', 404);
      // Both applicants are locked, lower id first, so two transfers cannot wait on each other
      const people = (await c.query(`SELECT id, allocated_unit_id, project_id, name FROM consumers WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`, [[oldId, newId]])).rows;
      const oldC = people.find((p: any) => p.id === oldId), newC = people.find((p: any) => p.id === newId);
      if (!oldC) throw bad('Seller (old applicant) not found', 404);
      if (!newC) throw bad('Buyer (new applicant) not found', 404);
      if (oldC.allocated_unit_id !== unitId) throw bad('Old consumer does not own this unit');
      if (newC.allocated_unit_id) throw bad('The buyer already owns a unit; a transfer cannot replace it', 409);
      if (newC.project_id && newC.project_id !== unit.project_id) throw bad('The buyer belongs to a different project than the unit');
      if (f.no && (await c.query(`SELECT 1 FROM ownership_transfers WHERE lower(transfer_no) = lower($1)`, [f.no])).rows.length) throw bad(`Transfer number "${f.no}" is already used`, 409);

      // What the seller has paid and owes on this unit (cancelled / bounced receipts and cancelled demands left out), before anything moves
      const plans = `SELECT id FROM payment_plans WHERE consumer_id = $1 AND unit_id = $2`;
      const snap = (await c.query(
        `SELECT COALESCE((SELECT SUM(r.amount_received_inr) FROM receipts r WHERE r.payment_plan_id IN (${plans}) AND r.status NOT IN ('cancelled', 'bounced')), 0) AS paid,
                COALESCE((SELECT SUM(d.amount_due_inr + COALESCE(d.cgst_amount,0) + COALESCE(d.sgst_amount,0) + COALESCE(d.addon_charge_amount,0) + COALESCE(d.addon_cgst_amount,0) + COALESCE(d.addon_sgst_amount,0))
                           FROM demands d WHERE d.payment_plan_id IN (${plans}) AND d.status <> 'cancelled'), 0) AS due`, [oldId, unitId]
      )).rows[0];
      const paid = parseFloat(snap.paid), dueAmt = parseFloat(snap.due);

      const move = (sql: string, p: any[]) => c.query(sql, p);
      await move(`UPDATE demands SET consumer_id = $1, updated_at = NOW() WHERE payment_plan_id IN (SELECT id FROM payment_plans WHERE consumer_id = $2 AND unit_id = $3)`, [newId, oldId, unitId]);
      await move(`UPDATE receipts SET consumer_id = $1, updated_at = NOW() WHERE payment_plan_id IN (SELECT id FROM payment_plans WHERE consumer_id = $2 AND unit_id = $3)`, [newId, oldId, unitId]);
      await move(`UPDATE tds_assignments SET consumer_id = $1 WHERE consumer_id = $2 AND receipt_id IN (SELECT id FROM receipts WHERE consumer_id = $1)`, [newId, oldId]);   // TDS follows its receipts
      await move(`UPDATE payment_plans SET consumer_id = $1 WHERE consumer_id = $2 AND unit_id = $3`, [newId, oldId, unitId]);
      await move(`UPDATE booking_records SET consumer_id = $1 WHERE consumer_id = $2 AND unit_id = $3`, [newId, oldId, unitId]);
      await move(`UPDATE penal_interests SET consumer_id = $1 WHERE consumer_id = $2`, [newId, oldId]);
      await move(`UPDATE interest_waivers SET consumer_id = $1 WHERE consumer_id = $2`, [newId, oldId]);
      await move(`UPDATE consumer_addon_charges SET consumer_id = $1 WHERE consumer_id = $2`, [newId, oldId]);
      await move(`UPDATE consumers SET allocated_unit_id = NULL, lead_stage = 'transferred' WHERE id = $1`, [oldId]);
      await move(`UPDATE consumers SET allocated_unit_id = $1, lead_stage = 'allotted' WHERE id = $2`, [unitId, newId]);
      await move(`UPDATE allocations SET status = 'transferred' WHERE unit_id = $1 AND consumer_id = $2 AND status NOT IN ('cancelled', 'transferred')`, [unitId, oldId]);
      await move(`INSERT INTO allocations (consumer_id, unit_id, project_id, status, created_by_user_id) VALUES ($1, $2, $3, 'allotted', $4)`, [newId, unitId, unit.project_id, req.userId]);

      const t = await c.query(
        `INSERT INTO ownership_transfers (
           unit_id, old_consumer_id, new_consumer_id, transfer_fee_inr, admin_charges_inr, transfer_remarks, created_by_user_id,
           transfer_no, application_date, transfer_type, transfer_amount_inr, stax_amount, cgst_amount, sgst_amount, igst_amount, ugst_amount,
           basic_price, gstin, broker_company, main_broker, sales_person_name, transfer_receipt_no, seller_total_paid_inr, seller_total_due_inr, seller_balance_inr, transfer_date
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25, COALESCE($26::date, CURRENT_DATE)) RETURNING id`,
        [unitId, oldId, newId, f.fee, f.admin, f.remarks, req.userId, f.no, f.app, f.type, f.amount, f.stax, f.cgst, f.sgst, f.igst, f.ugst, f.basic, f.gstin, f.broker, f.mainBroker, f.sales, f.receiptNo,
         paid, dueAmt, dueAmt - paid, f.date]
      );
      await auditChange(c, req, res, 'create', 'ownership_transfer', t.rows[0].id, undefined,
        { unit_id: unitId, old_consumer_id: oldId, new_consumer_id: newId, transfer_no: f.no, transfer_fee_inr: f.fee, seller_balance_inr: dueAmt - paid });
      return t.rows[0];
    });
    res.status(201).json({ success: true, data: out });
  } catch (err) { fail(err, res, next); }
});

/** GET /api/transfers/list?projectId=&search=&page=&pageSize= */
router.get('/list', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = req.query;
    const params: any[] = [];
    const add = (v: any) => `$${params.push(v)}`;
    let where = '';
    if (has(q.projectId)) where += ` AND u.project_id = ${add(uuid(q.projectId, 'projectId'))}`;
    const search = query(q.search, 'search');
    if (search) { const s = add(likeOf(search)); where += ` AND (oc.name ILIKE ${s} OR nc.name ILIKE ${s} OR u.unit_number ILIKE ${s} OR t.transfer_no ILIKE ${s} OR oc.registration_no ILIKE ${s} OR nc.registration_no ILIKE ${s})`; }
    const from = day(q.dateFrom, 'dateFrom'); if (from) where += ` AND t.transfer_date >= ${add(from)}`;
    const to = day(q.dateTo, 'dateTo');       if (to) where += ` AND t.transfer_date <= ${add(to)}`;
    if (from && to && from > to) throw bad('dateFrom must not be after dateTo');
    const pageSize = int(q.pageSize, 'pageSize', 1, 200, 20), page = int(q.page, 'page', 1, 100000, 1);
    const FROM = `FROM ownership_transfers t JOIN consumers oc ON t.old_consumer_id = oc.id JOIN consumers nc ON t.new_consumer_id = nc.id
                  JOIN units u ON t.unit_id = u.id JOIN projects p ON p.id = u.project_id WHERE TRUE ${where}`;
    const count = await db.query(`SELECT COUNT(*)::int AS total ${FROM}`, params);
    const data = await db.query(
      `SELECT t.id, t.transfer_no, t.application_date, t.transfer_date, t.transfer_type, t.transfer_amount_inr, t.transfer_fee_inr, t.admin_charges_inr,
              t.stax_amount, t.cgst_amount, t.sgst_amount, t.igst_amount, t.ugst_amount, t.basic_price, t.gstin, t.broker_company, t.main_broker,
              t.sales_person_name, t.transfer_receipt_no, t.transfer_remarks,
              oc.id AS seller_id, oc.name AS seller_name, oc.registration_no AS seller_reg_no, nc.id AS buyer_id, nc.name AS buyer_name,
              u.id AS unit_id, u.unit_number, u.bhk_type, p.id AS project_id, p.name AS project_name
         ${FROM} ORDER BY t.transfer_date DESC, t.created_at DESC, t.id LIMIT ${add(pageSize)} OFFSET ${add((page - 1) * pageSize)}`, params
    );
    res.json({ success: true, data: data.rows, total: count.rows[0].total });
  } catch (err) { fail(err, res, next); }
});

/** GET /api/transfers/history/:unitId - ownership history of a unit */
router.get('/history/:unitId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const unitId = uuid(req.params.unitId, 'Unit id');
    const result = await db.query(
      `SELECT t.*, oc.name AS old_consumer_name, nc.name AS new_consumer_name, u.unit_number
         FROM ownership_transfers t JOIN consumers oc ON t.old_consumer_id = oc.id JOIN consumers nc ON t.new_consumer_id = nc.id JOIN units u ON t.unit_id = u.id
        WHERE t.unit_id = $1 ORDER BY t.transfer_date DESC, t.created_at DESC`, [unitId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { fail(err, res, next); }
});

/** GET /api/transfers/unit-owner/:unitId - current owner of a unit (a cancelled or transferred allocation is not an owner) */
router.get('/unit-owner/:unitId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const unitId = uuid(req.params.unitId, 'Unit id');
    const result = await db.query(
      `SELECT c.id, c.name, c.first_name, c.last_name, c.salutation, c.registration_no, c.mobile, c.pan_no, c.aadhaar_no, c.present_address,
              c.present_city, c.present_state, c.present_pin, c.applicant_type, c.project_id,
              u.unit_number, u.bhk_type, u.floor, u.super_area_sqft, u.base_price_inr,
              a.id AS allocation_id, a.allotment_date, a.status AS allocation_status, p.name AS project_name,
              COALESCE((SELECT COUNT(*)::int FROM ownership_transfers ot WHERE ot.unit_id = $1), 0) AS transfer_count
         FROM consumers c
         JOIN allocations a ON a.consumer_id = c.id
         JOIN units u ON u.id = a.unit_id
         JOIN projects p ON p.id = c.project_id
        WHERE a.unit_id = $1 AND a.status NOT IN ('transferred', 'cancelled') AND c.allocated_unit_id = $1
        ORDER BY a.created_at DESC LIMIT 1`, [unitId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'No active owner for this unit' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { fail(err, res, next); }
});

/** GET /api/transfers/report - units that have been transferred, with the current owner and transfer details */
router.get('/report', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = req.query;
    const params: any[] = [has(q.projectId) ? uuid(q.projectId, 'projectId') : null];
    const add = (v: any) => `$${params.push(v)}`;
    let extra = '';
    const reg = query(q.registrationNo, 'registrationNo'); if (reg) extra += ` AND c.registration_no ILIKE ${add(likeOf(reg))}`;
    const first = query(q.firstName, 'firstName');         if (first) extra += ` AND c.name ILIKE ${add(likeOf(first))}`;
    const unit = query(q.unitAddress, 'unitAddress');      if (unit) extra += ` AND u.unit_number ILIKE ${add(likeOf(unit))}`;
    const result = await db.query(
      `SELECT c.id AS consumer_id,
              COALESCE(c.registration_no,
                (SELECT oc.registration_no || 'T' || (SELECT COUNT(*)::text FROM ownership_transfers ot2 WHERE ot2.unit_id = u.id AND ot2.created_at <= ot_latest.created_at)
                   FROM ownership_transfers ot_latest JOIN consumers oc ON oc.id = ot_latest.old_consumer_id
                  WHERE ot_latest.unit_id = u.id ORDER BY ot_latest.created_at DESC LIMIT 1)) AS registration_no,
              c.name, c.booking_date, u.unit_number, u.floor, u.bhk_type, u.super_area_sqft, u.base_price_inr, a.allotment_date,
              p.name AS project_name, p.id AS project_id, br.firm_name AS broker_company,
              (SELECT pst2.plan_name FROM plan_schedule_templates pst2 WHERE pst2.project_id = p.id ORDER BY pst2.installment_index ASC LIMIT 1) AS payment_plan,
              (SELECT COUNT(*)::int FROM ownership_transfers ot_count WHERE ot_count.unit_id = u.id) AS no_of_transfers,
              (SELECT MAX(ot3.transfer_date) FROM ownership_transfers ot3 WHERE ot3.unit_id = u.id) AS last_transfer_date,
              (SELECT MAX(ot4.created_at) FROM ownership_transfers ot4 WHERE ot4.unit_id = u.id) AS last_transfer_at
         FROM consumers c
         JOIN allocations a ON a.consumer_id = c.id AND a.status NOT IN ('cancelled', 'transferred')
         JOIN units u ON u.id = a.unit_id AND c.allocated_unit_id = u.id
         JOIN projects p ON p.id = u.project_id
         LEFT JOIN brokers br ON br.id = (SELECT main_broker_id FROM booking_records WHERE consumer_id = c.id ORDER BY created_at DESC LIMIT 1)
        WHERE EXISTS (SELECT 1 FROM ownership_transfers ot WHERE ot.unit_id = u.id)
          AND ($1::uuid IS NULL OR p.id = $1::uuid) ${extra}
        ORDER BY last_transfer_at DESC NULLS LAST, c.id`, params
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { fail(err, res, next); }
});

const TRANSFER_DETAIL_QUERY = `
  SELECT
    ot.id,
    ot.transfer_no,
    ot.transfer_date,
    ot.application_date,
    ot.transfer_type,
    ot.transfer_amount_inr,
    ot.transfer_fee_inr,
    ot.admin_charges_inr,
    ot.stax_amount,
    ot.cgst_amount,
    ot.sgst_amount,
    ot.igst_amount,
    ot.ugst_amount,
    ot.basic_price,
    ot.gstin,
    ot.broker_company,
    ot.main_broker,
    ot.sales_person_name,
    ot.transfer_receipt_no,
    ot.transfer_remarks,
    oc.id as seller_id,
    oc.name as seller_name,
    oc.registration_no as seller_reg_no,
    oc.pan_no as seller_pan,
    oc.present_address as seller_address,
    oc.present_city as seller_city,
    oc.present_state as seller_state,
    oc.present_pin as seller_pin,
    oc.mobile as seller_mobile,
    oc.email as seller_email,
    nc.id as buyer_id,
    nc.name as buyer_name,
    nc.registration_no as buyer_reg_no,
    nc.pan_no as buyer_pan,
    nc.present_address as buyer_address,
    nc.present_city as buyer_city,
    nc.present_state as buyer_state,
    nc.present_pin as buyer_pin,
    nc.mobile as buyer_mobile,
    nc.email as buyer_email,
    u.id as unit_id,
    u.unit_number,
    u.floor,
    u.bhk_type,
    u.super_area_sqft,
    u.base_price_inr,
    p.id as project_id,
    p.name as project_name,
    p.location as project_location,
    p.rera_number,
    p.authorised_signatory_name,
    p.village_name,
    p.sector_name,
    comp.name as company_name,
    comp.address1 as company_address,
    comp.cin as company_cin,
    comp.gstin as company_gstin,
    comp.phone as company_phone,
    (SELECT pst.plan_name
     FROM plan_schedule_templates pst
     WHERE pst.project_id = p.id
     ORDER BY pst.installment_index ASC
     LIMIT 1) as payment_plan,
    COALESCE(ot.seller_total_paid_inr, 0) AS seller_total_received,
    COALESCE(ot.seller_total_due_inr,  0) AS seller_total_due,
    COALESCE(ot.seller_balance_inr,    0) AS seller_balance,
    COALESCE(
      (SELECT COUNT(*)::int
       FROM ownership_transfers ot2
       WHERE ot2.unit_id = u.id
       AND ot2.created_at <= ot.created_at), 0
    ) as transfer_sequence
  FROM ownership_transfers ot
  JOIN consumers oc ON oc.id = ot.old_consumer_id
  JOIN consumers nc ON nc.id = ot.new_consumer_id
  JOIN units u ON u.id = ot.unit_id
  JOIN projects p ON p.id = u.project_id
  LEFT JOIN companies comp ON comp.id = p.company_id
  WHERE ot.id = $1`;

/**
 * PATCH /api/transfers/:id - change the transfer date and / or the application date of one transfer.
 * Only the dates that are sent change; application_date may be cleared with null.
 */
router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = uuid(req.params.id, 'Transfer id');
    const b = body(req);
    const hasT = b.transfer_date !== undefined, hasA = b.application_date !== undefined;
    if (!hasT && !hasA) throw bad('transfer_date or application_date is required');
    const tDate = hasT ? pastDay(b.transfer_date, 'transfer_date') : null;
    if (hasT && !tDate) throw bad('transfer_date cannot be empty');
    const aDate = hasA ? pastDay(b.application_date, 'application_date') : null;
    const out = await inTx(async (c) => {
      const cur = (await c.query(`SELECT id, to_char(transfer_date, 'YYYY-MM-DD') AS transfer_date, to_char(application_date, 'YYYY-MM-DD') AS application_date FROM ownership_transfers WHERE id = $1 FOR UPDATE`, [id])).rows[0];
      if (!cur) throw bad('Transfer not found', 404);
      const nt = tDate ?? cur.transfer_date, na = hasA ? aDate : cur.application_date;
      if (na && nt && na > nt) throw bad('The application date cannot be after the transfer date');
      const r = await c.query(`UPDATE ownership_transfers SET transfer_date = $2::date, application_date = $3::date WHERE id = $1 RETURNING id, transfer_date, application_date`, [id, nt, na]);
      await auditChange(c, req, res, 'update', 'ownership_transfer', id, { transfer_date: cur.transfer_date, application_date: cur.application_date }, { transfer_date: nt, application_date: na });
      return r.rows[0];
    });
    res.json({ success: true, data: out });
  } catch (err) { fail(err, res, next); }
});

/**
 * GET /api/transfers/:id/letter - printable HTML transfer letter for one transfer.
 * Must be defined before /:id to avoid Express matching "letter" as the id.
 */
router.get('/:id/letter', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = uuid(req.params.id, 'Transfer id');
    const result = await db.query(TRANSFER_DETAIL_QUERY, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Transfer not found' });
    }
    const t = escRow(result.rows[0]);

    const staxPct = t.stax_amount && Number(t.transfer_fee_inr) > 0
      ? ((Number(t.stax_amount) / Number(t.transfer_fee_inr)) * 100).toFixed(2)
      : '12.36';

    const sellerAddr = [t.seller_address, t.seller_city, t.seller_state, t.seller_pin]
      .filter(Boolean).join(', ');
    const buyerAddr = [t.buyer_address, t.buyer_city, t.buyer_state, t.buyer_pin]
      .filter(Boolean).join(', ');

    const sellerDue      = Number(t.seller_total_due      || 0);
    const sellerReceived = Number(t.seller_total_received || 0);
    const sellerBalance  = sellerDue - sellerReceived;
    const transferFee    = Number(t.transfer_fee_inr || 0);
    const staxAmt        = Number(t.stax_amount      || 0);

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Transfer/Sale Entry Register</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #e0e0e0;
    font-family: Arial, sans-serif;
    font-size: 11pt;
    color: #000;
    padding: 30px 20px;
    min-height: 100vh;
  }
  .page {
    background: #fff;
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    padding: 15mm 18mm;
    box-shadow: 0 4px 24px rgba(0,0,0,0.18);
    position: relative;
  }
  h2 {
    text-align: center;
    font-size: 15pt;
    text-decoration: underline;
    margin-bottom: 18px;
    letter-spacing: 0.5px;
  }
  .info-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  .info-table td { padding: 3px 6px; vertical-align: top; font-size: 10.5pt; }
  .info-table .lbl { font-weight: bold; white-space: nowrap; width: 130px; color: #222; }
  .party-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; border: 1px solid #999; }
  .party-table td { padding: 5px 8px; border: 1px solid #ccc; vertical-align: top; font-size: 10.5pt; }
  .party-table .lbl { font-weight: bold; width: 170px; background: #f5f5f5; color: #222; }
  .dues-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  .dues-table th { background: #1d3a6e; color: #fff; padding: 6px 8px; text-align: left; border: 1px solid #1d3a6e; font-size: 10.5pt; }
  .dues-table td { padding: 5px 8px; border: 1px solid #ccc; font-size: 10.5pt; }
  .dues-table tr:nth-child(even) td { background: #fafafa; }
  .footer { display: flex; justify-content: space-between; margin-top: 50px; font-size: 10.5pt; font-weight: bold; }
  .print-bar { text-align: center; margin-top: 24px; padding-bottom: 10px; }
  @media print {
    body { background: #fff; padding: 0; }
    .page { box-shadow: none; width: 100%; padding: 10mm 12mm; min-height: unset; }
    .print-bar { display: none; }
  }
</style>
</head>
<body>

<div class="page">

<h2>TRANSFER/SALE ENTRY REGISTER</h2>

<table class="info-table">
  <tr>
    <td class="lbl">Project Name:</td>
    <td><b>${t.project_name || ''}</b></td>
    <td class="lbl">Location:</td>
    <td>${t.project_location || ''}</td>
  </tr>
  <tr>
    <td class="lbl">Unit No.:</td>
    <td>${t.unit_number || ''}</td>
    <td class="lbl">Floor:</td>
    <td>${t.floor || ''}</td>
  </tr>
  <tr>
    <td class="lbl">Tower No.:</td>
    <td></td>
    <td class="lbl">Super Area:</td>
    <td>${t.super_area_sqft ? t.super_area_sqft + ' Sq. Yrd.' : ''}</td>
  </tr>
  <tr>
    <td class="lbl">Sale Amount:</td>
    <td>${t.transfer_amount_inr ? fmtIndianMoneyDecimal(Number(t.transfer_amount_inr)) : ''}</td>
    <td class="lbl">Rate Per Sq.Ft.:</td>
    <td>${t.base_price_inr ? fmtIndianMoneyDecimal(Number(t.base_price_inr)) + '/-' : ''}</td>
  </tr>
  <tr>
    <td class="lbl">Booking Date:</td>
    <td>${fmtDateIndia(t.application_date)}</td>
    <td class="lbl">Payment Plan:</td>
    <td><b>${t.payment_plan || ''}</b></td>
  </tr>
  <tr>
    <td class="lbl">Date of TRF AG.:</td>
    <td>${fmtDateIndia(t.transfer_date)}</td>
    <td colspan="2"><b>First End: ${t.seller_name || ''} To ${t.buyer_name || ''}</b></td>
  </tr>
</table>

<table class="party-table">
  <tr>
    <td class="lbl">Name of Transferor</td>
    <td>${t.seller_name || ''}</td>
    <td class="lbl">PAN:</td>
    <td>${t.seller_pan || ''}</td>
  </tr>
  <tr>
    <td class="lbl">Address of Transferor</td>
    <td colspan="3">${sellerAddr}</td>
  </tr>
  <tr>
    <td class="lbl">Contact No.</td>
    <td></td>
    <td class="lbl">Mobile</td>
    <td>${t.seller_mobile || ''}</td>
  </tr>
  <tr>
    <td class="lbl">E-Mail Id:</td>
    <td colspan="3">${t.seller_email || ''}</td>
  </tr>
</table>

<table class="party-table">
  <tr>
    <td class="lbl">Name of Transferee</td>
    <td>${t.buyer_name || ''}</td>
    <td class="lbl">PAN:</td>
    <td>${t.buyer_pan || ''}</td>
  </tr>
  <tr>
    <td class="lbl">Address of Transferee</td>
    <td colspan="3">${buyerAddr}</td>
  </tr>
  <tr>
    <td class="lbl">Contact No.</td>
    <td></td>
    <td class="lbl">Mobile</td>
    <td>${t.buyer_mobile || ''}</td>
  </tr>
  <tr>
    <td class="lbl">E-Mail Id:</td>
    <td colspan="3">${t.buyer_email || ''}</td>
  </tr>
</table>

<table class="dues-table">
  <thead>
    <tr>
      <th>Name Of Dues (In Rs.)</th>
      <th>Total Due</th>
      <th>Received</th>
      <th>Balance</th>
      <th>No Dues - CERTIFIED BY (NAME)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Total Amount/Received</td>
      <td>${fmtIndianMoneyDecimal(sellerDue)}</td>
      <td>${fmtIndianMoneyDecimal(sellerReceived)}</td>
      <td>${fmtIndianMoneyDecimal(sellerBalance)}</td>
      <td></td>
    </tr>
    <tr>
      <td>Interest to be paid</td>
      <td>0</td><td>0</td><td>0</td><td></td>
    </tr>
    <tr>
      <td>Transfer Charge</td>
      <td>${fmtIndianMoneyDecimal(transferFee)}</td>
      <td>0</td>
      <td>${fmtIndianMoneyDecimal(transferFee)}</td>
      <td></td>
    </tr>
    <tr>
      <td>Service Tax Till Date</td>
      <td>0</td><td>0</td><td>0</td><td></td>
    </tr>
    <tr>
      <td>Service Tax on Transfer Charge @${staxPct}%</td>
      <td>${fmtIndianMoneyDecimal(staxAmt)}</td>
      <td>0</td>
      <td>${fmtIndianMoneyDecimal(staxAmt)}</td>
      <td></td>
    </tr>
  </tbody>
</table>

<div class="footer">
  <div>Prepared by CRM</div>
  <div>Authorized Signatory</div>
</div>

</div>

<div class="print-bar">
  <button onclick="window.print()"
    style="padding:8px 20px;background:#1d3a6e;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:13px;margin-right:8px">Print</button>
  <button onclick="window.close()"
    style="padding:8px 20px;background:#666;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:13px">Close</button>
</div>

</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) { fail(err, res, next); }
});

/**
 * GET /api/transfers/:id - full detail for one transfer
 */
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = uuid(req.params.id, 'Transfer id');
    const result = await db.query(TRANSFER_DETAIL_QUERY, [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Transfer not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { fail(err, res, next); }
});

router.use(pgErrorHandler);

export default router;
