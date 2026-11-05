import { Router, Response, NextFunction } from 'express';
import { db } from '../index.js';
import { AuthRequest } from '../index.js';
import multer from 'multer';
import { requireProcess } from '../middleware/processPermission.js';
import { auditChange } from '../middleware/auditLogger.js';
import { bad, failWith, uuid, has, num, text, day, body, inTx } from '../utils/input.js';
import { challanStatus } from '../utils/tds.js';
import { businessToday, businessTomorrow, businessYear } from '../utils/business-date.js';
import { notOwn } from './financial-ops.js';
import { requireDownload } from '../middleware/printDownload.js';

const router = Router();
const MAX = 1_000_000_000;
const fail = (e: any, res: Response, next: NextFunction) => failWith(e, res, next, 'This already exists');

// --- JOURNAL ENTRIES ---

// GET /api/payments/journals
router.get('/journals', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { consumerId } = req.query;
    const whole = (v: any, label: string, max: number, d: number) => { if (!has(v)) return d; if (typeof v !== 'string' || !/^\d+$/.test(v) || +v < 1 || +v > max) throw bad(`${label} must be a whole number from 1 to ${max}`); return +v; };
    const page = whole(req.query.page, 'page', 100000, 1), pageSize = whole(req.query.pageSize, 'pageSize', 500, 50);
    let query = `
      SELECT je.*, c.name AS consumer_name,
             u1.name AS created_by_name,
             u2.name AS approved_by_name
      FROM journal_entries je
      LEFT JOIN consumers c ON je.consumer_id = c.id
      LEFT JOIN users u1 ON u1.id = je.created_by_user_id
      LEFT JOIN users u2 ON u2.id = je.approved_by
      WHERE 1=1`;
    const params: any[] = [];

    if (has(consumerId)) {
      params.push(uuid(consumerId, 'consumerId'));
      query += ` AND je.consumer_id = $${params.length}`;
    }

    query += ` ORDER BY je.created_at DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) { fail(error, res, next); }
});

// POST /api/payments/journals — MAKER
router.post('/journals', requireProcess('jv_refund_drcr', 'maker'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const b = body(req);
    if (!has(b.consumerId ?? b.consumer_id)) throw bad('consumerId is required');
    const resolvedConsumerId = uuid(b.consumerId ?? b.consumer_id, 'consumerId');
    const ledgerHead = text(b.ledgerHead, 'ledgerHead', 100, true)!;
    const remarks = text(b.remarks, 'remarks', 500, false);
    const entryDate = day(b.entryDate, 'Entry date');
    const debitAmount = has(b.debitAmount) ? num(b.debitAmount, 'Debit amount', MAX, 2) : 0, creditAmount = has(b.creditAmount) ? num(b.creditAmount, 'Credit amount', MAX, 2) : 0;
    if (!(debitAmount > 0) && !(creditAmount > 0)) throw bad('Enter a debit or a credit amount');
    if (debitAmount > 0 && creditAmount > 0) throw bad('An entry is either a debit or a credit, not both');
    if (!(await db.query(`SELECT 1 FROM consumers WHERE id = $1`, [resolvedConsumerId])).rows.length) throw bad('Applicant not found', 404);

    const seqResult = await db.query(`SELECT nextval('journal_entry_seq') AS seq`);
    const seq = String(seqResult.rows[0].seq).padStart(4, '0');
    const entryNo = `JE/${businessYear()}/${seq}`;

    const result = await db.query(
      `INSERT INTO journal_entries
         (entry_number, entry_date, consumer_id, debit_amount, credit_amount, ledger_head, remarks, status, created_by_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8)
       RETURNING *`,
      [entryNo, entryDate || businessToday(), resolvedConsumerId, debitAmount, creditAmount, ledgerHead, remarks, req.userId]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) { fail(error, res, next); }
});

// GET /api/payments/journals/:id
router.get('/journals/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const jid = uuid(req.params.id, 'Entry id');
    const result = await db.query(`
      SELECT je.*,
             c.name AS consumer_name,
             u1.name AS created_by_name,
             u2.name AS approved_by_name,
             u3.name AS rejected_by_name
      FROM journal_entries je
      LEFT JOIN consumers c ON c.id = je.consumer_id
      LEFT JOIN users u1 ON u1.id = je.created_by_user_id
      LEFT JOIN users u2 ON u2.id = je.approved_by
      LEFT JOIN users u3 ON u3.id = je.rejected_by
      WHERE je.id = $1
    `, [jid]);

    if (!result.rows[0]) return res.status(404).json({ error: 'Journal entry not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) { fail(error, res, next); }
});

// PATCH /api/payments/journals/:id/approve — CHECKER
router.patch('/journals/:id/approve', requireProcess('jv_refund_drcr', 'checker'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Strict maker-checker: the person who made the entry cannot approve it (super_admin included); an entry with no known maker waits for remediation
    const jid = uuid(req.params.id, 'Entry id');
    const result = await db.query(
      `UPDATE journal_entries
       SET status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND status = 'pending' AND created_by_user_id IS NOT NULL AND created_by_user_id <> $1
       RETURNING *`,
      [req.userId, jid]
    );
    if (!result.rows[0]) {
      const cur = (await db.query(`SELECT status, created_by_user_id FROM journal_entries WHERE id = $1`, [jid])).rows[0];
      if (cur && cur.status === 'pending') notOwn(req, cur.created_by_user_id);
      return res.status(404).json({ error: 'Entry not found or already processed' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) { fail(error, res, next); }
});

// PATCH /api/payments/journals/:id/reject — CHECKER
router.patch('/journals/:id/reject', requireProcess('jv_refund_drcr', 'checker'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const rejection_reason = text(body(req).rejection_reason, 'rejection_reason', 500, true);
    const jid = uuid(req.params.id, 'Entry id');

    const result = await db.query(
      `UPDATE journal_entries
       SET status = 'rejected', rejected_by = $1, rejected_at = NOW(), rejection_reason = $2, updated_at = NOW()
       WHERE id = $3 AND status = 'pending' AND created_by_user_id IS NOT NULL AND created_by_user_id <> $1
       RETURNING *`,
      [req.userId, rejection_reason, jid]
    );
    if (!result.rows[0]) {
      const cur = (await db.query(`SELECT status, created_by_user_id FROM journal_entries WHERE id = $1`, [jid])).rows[0];
      if (cur && cur.status === 'pending') notOwn(req, cur.created_by_user_id);
      return res.status(404).json({ error: 'Entry not found or already processed' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) { fail(error, res, next); }
});

// --- TDS MANAGEMENT ---
// Anyone with payments:view reads; only accounts_finance and super_admin add a challan, assign it or take an assignment back.
// A challan's balance is amount - assigned_amount; assigned_amount moves only while the challan row is locked (see utils/tds.ts).
const financeOnly = (req: AuthRequest, res: Response, next: NextFunction) =>
  ['super_admin', 'accounts_finance'].includes(req.userRole || '') ? next() : res.status(403).json({ error: 'Only accounts and finance can add or assign TDS challans' });
const today = () => businessTomorrow();   // a day of grace for the browser/server clock gap
const q1 = (v: any, label: string, max = 100) => { if (Array.isArray(v)) throw bad(`${label} is not valid`); return text(v, label, max, false); };

const FILE_TYPES: [string, number[]][] = [['application/pdf', [0x25, 0x50, 0x44, 0x46]], ['image/png', [0x89, 0x50, 0x4e, 0x47]], ['image/jpeg', [0xff, 0xd8, 0xff]]];
const memory = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
const fileUpload = (req: AuthRequest, res: Response, next: NextFunction) =>
  memory.single('file')(req, res, (err: any) => err
    ? res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File is too large, the maximum is 5 MB' : 'Upload is not valid' })
    : next());

const LIST = `c.id, c.challan_number, c.challan_date, c.amount, c.assigned_amount, (c.amount - c.assigned_amount) AS balance, c.bank_name, c.bsr_code,
  c.status, c.file_name, (c.file_data IS NOT NULL) AS has_file, c.created_at`;

// GET /api/payments/tds/challans?status=&search=&page=&pageSize=
router.get('/tds/challans', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = req.query, params: any[] = []; let where = '';
    const status = q1(q.status, 'status', 30);
    if (status && status !== 'all') { if (!['available', 'partially_assigned', 'fully_assigned'].includes(status)) throw bad('status must be available, partially_assigned or fully_assigned'); where += ` AND c.status = $${params.push(status)}`; }
    const search = q1(q.search, 'search'); if (search) where += ` AND (c.challan_number ILIKE $${params.push('%' + search.replace(/[\\%_]/g, '\\$&') + '%')} OR c.bank_name ILIKE $${params.length})`;
    const intq = (v: any, label: string, max: number, d: number) => { if (!has(v)) return d; if (typeof v !== 'string' || !/^\d+$/.test(v) || +v < 1 || +v > max) throw bad(`${label} must be a whole number from 1 to ${max}`); return +v; };
    const size = intq(q.pageSize, 'pageSize', 500, 100), page = intq(q.page, 'page', 100000, 1);
    const rows = (await db.query(`SELECT ${LIST} FROM tds_challans c WHERE true ${where} ORDER BY c.challan_date DESC, c.created_at DESC LIMIT ${size} OFFSET ${(page - 1) * size}`, params)).rows;
    const tot = (await db.query(`SELECT COUNT(*)::int AS n, COALESCE(SUM(amount),0) AS amount, COALESCE(SUM(assigned_amount),0) AS assigned FROM tds_challans c WHERE true ${where}`, params)).rows[0];
    res.json({ success: true, data: rows, total: tot.n, totals: { amount: tot.amount, assigned: tot.assigned, balance: Number(tot.amount) - Number(tot.assigned) } });
  } catch (error) { fail(error, res, next); }
});

// GET /api/payments/tds/receipts?search= - live receipts to pick from when assigning (number or applicant name)
router.get('/tds/receipts', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const search = q1(req.query.search, 'search');
    if (!search || search.length < 2) return res.json({ success: true, data: [] });
    const r = await db.query(
      `SELECT r.id, r.receipt_number, r.amount_received_inr, r.status, r.received_date, c.name AS consumer_name,
              COALESCE((SELECT SUM(a.amount_assigned) FROM tds_assignments a WHERE a.receipt_id = r.id AND a.released_at IS NULL), 0) AS tds_assigned
         FROM receipts r JOIN consumers c ON c.id = r.consumer_id
        WHERE r.status NOT IN ('cancelled', 'bounced') AND (r.receipt_number ILIKE $1 OR c.name ILIKE $1)
        ORDER BY r.received_date DESC LIMIT 20`, ['%' + search.replace(/[\\%_]/g, '\\$&') + '%']);
    res.json({ success: true, data: r.rows });
  } catch (error) { fail(error, res, next); }
});

// GET /api/payments/tds/challans/:id - one challan with every assignment (released ones too)
router.get('/tds/challans/:id', requireDownload, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = uuid(req.params.id, 'Challan id');
    const c = (await db.query(`SELECT ${LIST} FROM tds_challans c WHERE c.id = $1`, [id])).rows[0];
    if (!c) throw bad('Challan not found', 404);
    const a = await db.query(
      `SELECT a.id, a.receipt_id, a.consumer_id, a.amount_assigned, a.assigned_at, a.released_at, a.release_reason, r.receipt_number, cs.name AS consumer_name
         FROM tds_assignments a LEFT JOIN receipts r ON r.id = a.receipt_id LEFT JOIN consumers cs ON cs.id = a.consumer_id
        WHERE a.challan_id = $1 ORDER BY a.assigned_at DESC`, [id]);
    res.json({ success: true, data: { ...c, assignments: a.rows } });
  } catch (error) { fail(error, res, next); }
});

// GET /api/payments/tds/challans/:id/file - the scanned copy
router.get('/tds/challans/:id/file', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const r = (await db.query(`SELECT file_name, file_type, file_data FROM tds_challans WHERE id = $1`, [uuid(req.params.id, 'Challan id')])).rows[0];
    if (!r?.file_data) throw bad('No file was uploaded for this challan', 404);
    res.set({ 'Content-Type': r.file_type, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'", 'Content-Disposition': `inline; filename="challan.${r.file_type === 'application/pdf' ? 'pdf' : r.file_type === 'image/png' ? 'png' : 'jpg'}"` }).send(r.file_data);
  } catch (error) { fail(error, res, next); }
});

// POST /api/payments/tds/challans - JSON or multipart (the scanned copy is the "file" part)
router.post('/tds/challans', financeOnly, fileUpload, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const b = body(req);
    const no = text(b.challanNumber ?? b.challan_number, 'Challan number', 50, true)!;
    if (!/^[A-Za-z0-9][A-Za-z0-9\/_.\- ]*$/.test(no)) throw bad('Challan number can only have letters, digits, space and / _ . -');
    const date = day(b.challanDate ?? b.challan_date, 'Challan date');
    if (!date) throw bad('Challan date is required');
    if (date > today()) throw bad('Challan date cannot be in the future');
    const amount = num(b.amount, 'Amount', MAX, 2);
    if (!(amount > 0)) throw bad('Amount must be more than 0');
    const bank = text(b.bankName ?? b.bank_name, 'Bank name', 255, false);
    const bsr = text(b.bsrCode ?? b.bsr_code, 'BSR code', 7, false);
    if (bsr && !/^\d{7}$/.test(bsr)) throw bad('BSR code must be 7 digits');
    if (has(b.fileUrl) || has(b.file_url)) throw bad('Send the scanned copy as a file, not as an address');
    let type: string | null = null;
    if (req.file) {
      type = FILE_TYPES.find(([, sig]) => sig.every((x, i) => req.file!.buffer[i] === x))?.[0] ?? null;
      if (!type) throw bad('The file must be a PDF, PNG or JPEG');
    }
    const row = await inTx(async (c) => {
      const r = (await c.query(
        `INSERT INTO tds_challans (challan_number, challan_date, amount, bank_name, bsr_code, file_name, file_type, file_data, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [no, date, amount, bank, bsr, req.file ? req.file.originalname.replace(/[^\w.\- ]/g, '_').slice(0, 100) : null, type, req.file?.buffer ?? null, req.userId])).rows[0];
      if (req.file) await c.query(`UPDATE tds_challans SET file_url = $2 WHERE id = $1`, [r.id, `/api/payments/tds/challans/${r.id}/file`]);
      await auditChange(c, req, res, 'create', 'tds_challan', r.id, {}, { challan_number: no, amount, challan_date: date, has_file: !!req.file });
      return (await c.query(`SELECT ${LIST} FROM tds_challans c WHERE c.id = $1`, [r.id])).rows[0];
    });
    res.status(201).json({ success: true, data: row });
  } catch (error) { fail(error, res, next); }
});

// POST /api/payments/tds/assign - { challanId, receiptId, amount }
// Locks the receipt, then the challan (cancel / bounce lock them in the same order), so parallel assigns cannot overdraw the challan.
router.post('/tds/assign', financeOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const b = body(req);
    if (!has(b.challanId)) throw bad('challanId is required');
    if (!has(b.receiptId)) throw bad('receiptId is required');
    const challanId = uuid(b.challanId, 'challanId'), receiptId = uuid(b.receiptId, 'receiptId');
    if (!has(b.amount)) throw bad('amount is required');
    const amount = num(b.amount, 'Amount', MAX, 2);
    if (!(amount > 0)) throw bad('Amount must be more than 0');
    const out = await inTx(async (c) => {
      const rc = (await c.query(`SELECT id, consumer_id, receipt_number, status, amount_received_inr FROM receipts WHERE id = $1 FOR UPDATE`, [receiptId])).rows[0];
      if (!rc) throw bad('Receipt not found', 404);
      if (['cancelled', 'bounced'].includes(rc.status)) throw bad(`A ${rc.status} receipt cannot take a TDS challan`, 409);
      const ch = (await c.query(`SELECT id, challan_number, amount, assigned_amount FROM tds_challans WHERE id = $1 FOR UPDATE`, [challanId])).rows[0];
      if (!ch) throw bad('Challan not found', 404);
      const left = Math.round((Number(ch.amount) - Number(ch.assigned_amount)) * 100) / 100;
      if (amount > left + 0.001) throw bad(`Challan ${ch.challan_number} has only ${left.toLocaleString('en-IN')} left`, 409);
      const live = (await c.query(`SELECT COALESCE(SUM(amount_assigned),0) AS s, COUNT(*) FILTER (WHERE challan_id = $2) AS same FROM tds_assignments WHERE receipt_id = $1 AND released_at IS NULL`, [receiptId, challanId])).rows[0];
      if (Number(live.same) > 0) throw bad('This challan is already assigned to this receipt. Take that assignment back first to change the amount.', 409);
      if (Number(live.s) + amount > Number(rc.amount_received_inr) + 0.001) throw bad(`TDS on receipt ${rc.receipt_number} cannot be more than its amount (${Number(rc.amount_received_inr).toLocaleString('en-IN')}, ${Number(live.s).toLocaleString('en-IN')} already assigned)`, 409);
      const a = (await c.query(
        `INSERT INTO tds_assignments (challan_id, consumer_id, receipt_id, amount_assigned, assigned_by) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [challanId, rc.consumer_id, receiptId, amount, req.userId])).rows[0];
      await c.query(`UPDATE tds_challans SET assigned_amount = assigned_amount + $2, status = ${challanStatus.replace(/assigned_amount/g, '(assigned_amount + $2)')} WHERE id = $1`, [challanId, amount]);
      await auditChange(c, req, res, 'create', 'tds_assignment', a.id, {}, { challan_id: challanId, receipt_id: receiptId, amount });
      return a;
    });
    res.json({ success: true, data: out });
  } catch (error) { fail(error, res, next); }
});

// POST /api/payments/tds/assignments/:id/release - take an assignment back; the challan balance returns
router.post('/tds/assignments/:id/release', financeOnly, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = uuid(req.params.id, 'Assignment id');
    const reason = text(body(req).reason, 'reason', 200, false) || 'Released by user';
    await inTx(async (c) => {
      const a0 = (await c.query(`SELECT receipt_id, challan_id FROM tds_assignments WHERE id = $1`, [id])).rows[0];
      if (!a0) throw bad('Assignment not found', 404);
      if (a0.receipt_id) await c.query(`SELECT 1 FROM receipts WHERE id = $1 FOR UPDATE`, [a0.receipt_id]);
      await c.query(`SELECT 1 FROM tds_challans WHERE id = $1 FOR UPDATE`, [a0.challan_id]);
      const a = (await c.query(`UPDATE tds_assignments SET released_at = NOW(), release_reason = $2 WHERE id = $1 AND released_at IS NULL RETURNING challan_id, amount_assigned`, [id, reason])).rows[0];
      if (!a) throw bad('This assignment was already released', 409);
      await c.query(`UPDATE tds_challans SET assigned_amount = GREATEST(assigned_amount - $2, 0), status = ${challanStatus.replace(/assigned_amount/g, 'GREATEST(assigned_amount - $2, 0)')} WHERE id = $1`, [a.challan_id, a.amount_assigned]);
      await auditChange(c, req, res, 'update', 'tds_assignment', id, { released: false }, { released: true, reason });
    });
    res.json({ success: true, message: 'Assignment released' });
  } catch (error) { fail(error, res, next); }
});

export default router;
