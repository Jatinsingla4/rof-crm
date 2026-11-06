/**
 * Receipt routes (mounted at /api/payments): record a receipt, list / open / edit it, authorise it, print it,
 * and move a cheque through deposit, hold and clearing. Bounce, cancel and the printable page stay in payments.ts.
 * Every id, date, amount and filter is checked before it reaches SQL.
 */
import { Router, Response, NextFunction } from 'express';
import { db, AuthRequest } from '../index.js';
import { requireProcess } from '../middleware/processPermission.js';
import { cascadeOverpaymentExcess, checkAndAutoRaiseInstallment1 } from '../utils/payment-waterfall.js';
import { computeReceiptGstSplit } from '../utils/gst-receipt-split.js';
import { nextReceiptNumber } from '../utils/receipt-number.js';
import { projectSettings } from '../utils/project-settings.js';
import { runTimelyDiscounts } from '../utils/timely-discount.js';
import { auditChange } from '../middleware/auditLogger.js';
import { pgErrorHandler } from '../middleware/pg-errors.js';
import { bad, failWith, uuid, has, num, text, day, body, inTx } from '../utils/input.js';
import { likeOf } from '../utils/applicant.js';
import { businessToday, businessTomorrow, sqlDay } from '../utils/business-date.js';
import { notOwn } from './financial-ops.js';
import { requirePrint } from '../middleware/printDownload.js';

const router = Router();

// What the receipt form sends -> what the database keeps
export const RECEIPT_MODES: Record<string, string> = {
  cheque: 'cheque', cash: 'cash', card: 'card', upi: 'upi', neft: 'neft', rtgs: 'rtgs', neft_rtgs: 'neft', bank_transfer: 'bank_transfer', online: 'bank_transfer',
  demand_draft: 'demand_draft', draft: 'demand_draft', tds_challan: 'tds_challan',
};
// Every payment mode is an instrument that has to be confirmed by the bank (NEFT, RTGS and UPI used to be left out, so they could never be cleared)
const INSTRUMENTS = ['cheque', 'bank_transfer', 'demand_draft', 'cash', 'card', 'tds_challan', 'neft', 'rtgs', 'upi'];
const STATUSES = ['pending', 'authorized', 'deposited', 'on_hold', 'cleared', 'bounced', 'cancelled'];
const MAX_AMOUNT = 1_000_000_000;
const fail = (err: any, res: Response, next: NextFunction) => failWith(err, res, next, 'A receipt with the same number or reference already exists');

const query = (v: any, label: string, max = 100): string | null => {
  if (Array.isArray(v)) throw bad(`${label} is not valid`);
  return text(v, label, max, false);
};
const int = (v: any, label: string, min: number, max: number, dflt?: number): number | undefined => {
  if (!has(v)) return dflt;
  if (typeof v !== 'string' && typeof v !== 'number') throw bad(`${label} is not valid`);
  const n = Number(v);
  if (!/^-?\d+$/.test(String(v)) || n < min || n > max) throw bad(`${label} must be a whole number from ${min} to ${max}`);
  return n;
};
const mode = (v: any, label = 'Payment mode'): string => {
  const m = RECEIPT_MODES[String(typeof v === 'string' ? v : '').toLowerCase()];
  if (!m) throw bad(`${label} must be one of ${Object.keys(RECEIPT_MODES).join(', ')}`);
  return m;
};
// A date that is not in the future (one day of grace for the clock difference between browser and server)
const pastDay = (v: any, label: string): string | null => {
  const d = day(v, label);
  if (d && d > businessTomorrow()) throw bad(`${label} cannot be in the future`);
  return d;
};
const money = (v: any, label: string): number | null => (has(v) ? num(v, label, MAX_AMOUNT, 2) : null);
const parts = (b: any, total: number) => {
  const p = {
    plc_amount: money(b.plcAmount, 'PLC amount'), edc_amount: money(b.edcAmount, 'EDC amount'), idc_amount: money(b.idcAmount, 'IDC amount'),
    other_charge_amount: money(b.otherChargeAmount, 'Other charge amount'), interest_amount: money(b.interestAmount, 'Interest amount'),
    other_charge_desc: text(b.otherChargeDesc, 'Other charge description', 200, false),
  };
  const sum = [p.plc_amount, p.edc_amount, p.idc_amount, p.other_charge_amount, p.interest_amount].reduce<number>((s, x) => s + (x || 0), 0);
  if (sum > total + 0.005) throw bad('The PLC, EDC, IDC, interest and other charge parts add up to more than the receipt amount');
  return p;
};
// Someone else holding the same cheque number or bank reference on a live receipt
const reference = async (c: any, col: 'cheque_no' | 'transaction_ref', value: string, selfId: string | null, label: string) => {
  await c.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`receipt-ref:${col}:${value}`]);
  const dup = (await c.query(
    `SELECT receipt_number, status FROM receipts WHERE ${col} = $1 AND status NOT IN ('bounced', 'cancelled') AND ($2::uuid IS NULL OR id <> $2) LIMIT 1`, [value, selfId]
  )).rows[0];
  if (dup) throw bad(`${label} "${value}" is already used on receipt ${dup.receipt_number} (${dup.status}). Only bounced or cancelled ones can be reused.`, 409);
};

// POST /receipts - record a receipt and match it to the demand of its instalment
router.post('/receipts', requireProcess('receipt', 'maker'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const b = body(req);
    if (!has(b.consumerId)) throw bad('consumerId is required');
    const consumerId = uuid(b.consumerId, 'consumerId');
    const rawAmount = b.amountReceivedInr ?? b.baseAmount;
    if (!has(rawAmount)) throw bad('amountReceivedInr is required');
    const amount = num(rawAmount, 'Amount', MAX_AMOUNT, 0);
    if (amount < 1) throw bad('Amount must be at least 1 rupee');
    const planGiven = has(b.paymentPlanId) ? uuid(b.paymentPlanId, 'paymentPlanId') : null;
    const idxGiven = int(b.installmentIndex, 'installmentIndex', 0, 500);
    const date = pastDay(b.paymentDate ?? b.receivedDate, 'Receipt date') || businessToday();
    const method = mode(b.paymentMode ?? b.paymentMethod ?? 'cash');
    const ref = text(b.referenceNumber ?? b.transactionRef, 'Reference', 100, false);
    const bankName = text(b.bankName, 'Bank name', 255, false);
    const branch = text(b.branch, 'Branch', 255, false);
    const chequeNo = text(b.chequeNo ?? b.cheque_no, 'Cheque number', 50, false);
    const chequeDate = day(b.chequeDate ?? b.cheque_date, 'Cheque date');   // a post-dated cheque is fine
    const bankAccount = has(b.companyBankAccountId) ? uuid(b.companyBankAccountId, 'companyBankAccountId') : null;
    text(b.remarks, 'Remarks', 1000, false);
    const p = parts(b, amount);
    const isOther = b.isOtherPayment === true, isAdjustment = b.isAdjustment === true;
    const warnings: string[] = [];   // not refusals: the receipt is recorded, the screen tells the person what happened to the money

    const out = await inTx(async (c) => {
      // Receipts of one customer are recorded one at a time so the instalment numbering and demand matching cannot cross
      await c.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`receipt-consumer:${consumerId}`]);
      const consumerRow = (await c.query(`SELECT project_id FROM consumers WHERE id = $1`, [consumerId])).rows[0];
      if (!consumerRow) throw bad('Applicant not found', 404);

      let planId: string | null = null;
      if (planGiven) {
        if (!(await c.query(`SELECT 1 FROM payment_plans WHERE id = $1 AND consumer_id = $2`, [planGiven, consumerId])).rows.length) throw bad('That payment plan does not belong to this applicant', 400);
        planId = planGiven;
      } else {
        planId = (await c.query(`SELECT id FROM payment_plans WHERE consumer_id = $1 ORDER BY created_at DESC LIMIT 1`, [consumerId])).rows[0]?.id || null;
      }
      if (bankAccount && !(await c.query(`SELECT 1 FROM company_bank_accounts WHERE id = $1 AND ($2::uuid[] IS NULL OR company_id = ANY($2::uuid[]))`, [bankAccount, req.companyIds ?? null])).rows.length) throw bad('Company bank account not found', 400);
      if (chequeNo) await reference(c, 'cheque_no', chequeNo, null, 'Cheque number');
      if (ref) await reference(c, 'transaction_ref', ref, null, 'Reference');

      let idx: number | null = idxGiven ?? null;
      if (planId && idx == null && !isOther) {
        idx = (await c.query(`SELECT COALESCE(MAX(installment_index), 0) + 1 AS n FROM receipts WHERE payment_plan_id = $1 AND installment_index IS NOT NULL`, [planId])).rows[0].n;
      }

      // A project set to Manual numbering needs the number typed on the receipt; otherwise the next one is made
      let receiptNumber: string;
      if ((await projectSettings(c, consumerRow.project_id)).receipt_number_mode === 'Manual') {
        receiptNumber = text(b.receiptNumber, 'Receipt number', 40, true)!;
        await c.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`receipt-no:${receiptNumber.toLowerCase()}`]);
        if ((await c.query(`SELECT 1 FROM receipts WHERE lower(receipt_number) = lower($1)`, [receiptNumber])).rows.length) throw bad(`Receipt number "${receiptNumber}" is already used`, 409);
      } else receiptNumber = await nextReceiptNumber(c, '', consumerRow.project_id);
      const ins = await c.query(
        `INSERT INTO receipts
           (payment_plan_id, installment_index, consumer_id, amount_received_inr, payment_method, transaction_ref, received_date, received_by_user_id, receipt_number,
            plc_amount, edc_amount, idc_amount, other_charge_amount, other_charge_desc, interest_amount,
            bank_name, branch, cheque_no, cheque_date, status, approval_status, print_status, is_adjustment, company_bank_account_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'pending','pending','not_printed',$20,$21)
         RETURNING id, receipt_number, amount_received_inr, plc_amount, edc_amount, idc_amount, other_charge_amount, interest_amount, status`,
        [planId, idx, consumerId, amount, method, ref, date, req.userId, receiptNumber,
         p.plc_amount ?? 0, p.edc_amount ?? 0, p.idc_amount ?? 0, p.other_charge_amount ?? 0, p.other_charge_desc, p.interest_amount ?? 0,
         bankName, branch, chequeNo, chequeDate, isAdjustment, bankAccount]
      );
      const receiptId = ins.rows[0].id;

      // Match to the demand of this instalment, then mark it partly / fully paid and pass any excess on to the next ones
      if (planId && idx != null) {
        const demand = (await c.query(
          `SELECT id, amount_due_inr, cgst_amount, sgst_amount, consumer_id FROM demands
            WHERE payment_plan_id = $1 AND installment_index = $2 AND status NOT IN ('paid', 'cancelled') ORDER BY created_at ASC LIMIT 1 FOR UPDATE`,
          [planId, idx]
        )).rows[0];
        if (!demand) warnings.push(`There is no open demand for instalment ${idx}, so this receipt is not matched to any instalment yet. It will be matched when that demand is raised.`);
        if (demand) {
          await c.query(`UPDATE receipts SET demand_id = $1 WHERE id = $2`, [demand.id, receiptId]);
          const paid = parseFloat((await c.query(`SELECT COALESCE(SUM(amount_received_inr), 0) AS s FROM receipts WHERE demand_id = $1 AND status != 'cancelled'`, [demand.id])).rows[0].s);
          const due = parseFloat(demand.amount_due_inr) + parseFloat(demand.cgst_amount || 0) + parseFloat(demand.sgst_amount || 0);
          const before = paid - amount;   // what the demand had received before this receipt
          if (paid > due + 0.005) warnings.push(`This receipt is more than what instalment ${idx} still needed (Rs ${Math.max(0, due - before).toLocaleString('en-IN')}). The extra Rs ${(paid - due).toLocaleString('en-IN')} is carried to the next instalments as an advance.`);
          if (paid >= due) {
            await c.query(`UPDATE demands SET status = 'paid', delivery_status = 'paid', updated_at = NOW() WHERE id = $1`, [demand.id]);
            if (paid - due > 0) await cascadeOverpaymentExcess(c, demand.consumer_id, planId, demand.id, paid - due, method, req.userId || null, receiptId);
          } else {
            await c.query(`UPDATE demands SET delivery_status = 'partial', updated_at = NOW() WHERE id = $1`, [demand.id]);
          }
        }
      }

      // GST part of the receipt, from the project and date of the receipt
      const projectId = (await c.query(`SELECT project_id FROM booking_records WHERE consumer_id = $1 ORDER BY created_at ASC LIMIT 1`, [consumerId])).rows[0]?.project_id || null;
      const gst = await computeReceiptGstSplit(c, amount, projectId, date);
      await c.query(`UPDATE receipts SET cgst_amount = $1, sgst_amount = $2 WHERE id = $3`, [gst.cgstAmount, gst.sgstAmount, receiptId]);

      // The first valid receipt against instalment 1 raises that demand
      if (planId && idx === 1) await checkAndAutoRaiseInstallment1(c, planId, receiptId, date, req.userId || null);

      await auditChange(c, req, res, 'create', 'receipt', receiptId, undefined, { receipt_number: receiptNumber, consumer_id: consumerId, amount, payment_method: method, received_date: date, installment_index: idx });
      return ins.rows[0];
    });
    res.status(201).json({ success: true, data: out, warnings });
  } catch (err) { fail(err, res, next); }
});

// GET /receipts - list with filters
router.get('/receipts', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = req.query;
    const params: any[] = [];
    const add = (v: any) => `$${params.push(v)}`;
    let where = '';
    if (has(q.consumerId)) {
      const id = add(uuid(q.consumerId, 'consumerId'));
      where += ` AND r.consumer_id = ${id} AND r.payment_plan_id = (
        SELECT pp2.id FROM payment_plans pp2 WHERE pp2.consumer_id = ${id}
           AND pp2.unit_id = COALESCE(
             (SELECT b2.unit_id FROM booking_records b2 WHERE b2.consumer_id = ${id} AND b2.status IN ('complete','pending_payment','active') ORDER BY b2.created_at DESC LIMIT 1),
             (SELECT b3.unit_id FROM booking_records b3 WHERE b3.consumer_id = ${id} ORDER BY b3.created_at DESC LIMIT 1))   -- a surrendered or cancelled booking keeps its receipts on the applicant file
         ORDER BY pp2.created_at DESC LIMIT 1)`;
    }
    // An advance receipt only splits the extra money of another receipt over the next instalments (the same cash is already on that receipt):
    // it is kept out of every receipt list, total and approval queue unless asked for (includeAdvance=true).
    if (q.includeAdvance !== 'true') where += ' AND NOT COALESCE(r.is_advance, false)';
    if (has(q.projectId)) where += ` AND pp.project_id = ${add(uuid(q.projectId, 'projectId'))}`;
    if (has(q.towerId)) where += ` AND t.id = ${add(uuid(q.towerId, 'towerId'))}`;
    if (has(q.brokerId)) where += ` AND b.id = ${add(uuid(q.brokerId, 'brokerId'))}`;
    const from = day(q.fromDate, 'fromDate'); if (from) where += ` AND r.received_date >= ${add(from)}`;
    const to = day(q.toDate, 'toDate');       if (to) where += ` AND r.received_date <= ${add(to)}`;
    if (from && to && from > to) throw bad('fromDate must not be after toDate');
    const reg = query(q.registrationNo, 'registrationNo');  if (reg) where += ` AND c.registration_no ILIKE ${add(likeOf(reg))}`;
    const first = query(q.firstName, 'firstName');          if (first) where += ` AND c.first_name ILIKE ${add(likeOf(first))}`;
    const unit = query(q.unitAddress, 'unitAddress');       if (unit) where += ` AND u.unit_number ILIKE ${add(likeOf(unit))}`;
    const no = query(q.receiptNo, 'receiptNo');             if (no) where += ` AND r.receipt_number ILIKE ${add(likeOf(no))}`;
    const status = query(q.status, 'status', 20);
    if (status && status !== 'all') { if (!STATUSES.includes(status)) throw bad(`status must be one of ${STATUSES.join(', ')}`); where += ` AND r.status = ${add(status)}`; }
    const print = query(q.printStatus, 'printStatus', 20);
    if (print) { if (!['printed', 'not_printed'].includes(print)) throw bad('printStatus must be printed or not_printed'); where += ` AND r.print_status = ${add(print)}`; }
    const appr = query(q.approvalStatus, 'approvalStatus', 20);
    if (appr) { if (!['pending', 'approved', 'rejected'].includes(appr)) throw bad('approvalStatus must be pending, approved or rejected'); where += ` AND r.approval_status = ${add(appr)}`; }
    const pageSize = int(q.pageSize, 'pageSize', 1, 1000, 50)!;
    const page = int(q.page, 'page', 1, 100000, 1)!;

    const result = await db.query(
      `SELECT r.id, r.receipt_number, r.payment_plan_id, r.installment_index, r.consumer_id, r.amount_received_inr, r.payment_method, r.cgst_amount, r.sgst_amount,
              r.transaction_ref, r.received_date, r.created_at, r.status, r.approval_status, r.bank_name, r.print_status, r.printed_at,
              r.plc_amount, r.edc_amount, r.idc_amount, r.other_charge_amount, r.other_charge_desc, r.interest_amount,
              COALESCE(r.is_advance, false) AS is_advance,
              c.name AS consumer_name, c.mobile, c.registration_no, c.first_name, c.last_name,
              pp.project_id, p.name AS project_name, u.unit_number, t.id::text AS tower_id, t.tower_name,
              u_creator.name AS generated_by_name, u_printer.name AS printed_by_name,
              COALESCE(b.firm_name, b.name, 'Direct') AS broker_name, b.id AS broker_id,
              (SELECT gi.invoice_no FROM gst_invoices gi WHERE gi.receipt_id = r.id AND gi.status <> 'cancelled' LIMIT 1) AS invoice_number
         FROM receipts r
         JOIN consumers c ON r.consumer_id = c.id
         LEFT JOIN payment_plans pp ON r.payment_plan_id = pp.id
         LEFT JOIN projects p ON p.id = pp.project_id
         LEFT JOIN units u ON u.id = pp.unit_id
         LEFT JOIN towers t ON t.id = u.tower_id
         LEFT JOIN users u_creator ON u_creator.id = r.received_by_user_id
         LEFT JOIN users u_printer ON u_printer.id = r.printed_by
         LEFT JOIN LATERAL (SELECT br2.main_broker_id FROM booking_records br2 WHERE br2.consumer_id = r.consumer_id ORDER BY br2.created_at DESC LIMIT 1) latest_booking ON true
         LEFT JOIN brokers b ON b.id = latest_booking.main_broker_id
        WHERE TRUE ${where}
        ORDER BY r.created_at DESC, r.id DESC
        LIMIT ${add(pageSize)} OFFSET ${add((page - 1) * pageSize)}`,
      params
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { fail(err, res, next); }
});

// GET /receipts/pending-cheques - cheques and other instruments still to deposit or clear
router.get('/receipts/pending-cheques', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = req.query;
    const params: any[] = [];
    const add = (v: any) => `$${params.push(v)}`;
    let where = '';
    if (has(q.project_id)) where += ` AND p.id = ${add(uuid(q.project_id, 'project_id'))}`;
    if (has(q.tower_id)) where += ` AND t.id = ${add(uuid(q.tower_id, 'tower_id'))}`;
    const unit = query(q.unit_address, 'unit_address');       if (unit) where += ` AND u.unit_number ILIKE ${add(likeOf(unit))}`;
    const from = day(q.from_date, 'from_date');               if (from) where += ` AND ${sqlDay('r.created_at')} >= ${add(from)}`;
    const to = day(q.to_date, 'to_date');                     if (to) where += ` AND ${sqlDay('r.created_at')} <= ${add(to)}`;
    if (from && to && from > to) throw bad('from_date must not be after to_date');
    const cheque = query(q.cheque_no, 'cheque_no');           if (cheque) where += ` AND r.cheque_no ILIKE ${add(likeOf(cheque))}`;
    const reg = query(q.registration_no, 'registration_no');  if (reg) where += ` AND c.registration_no ILIKE ${add(likeOf(reg))}`;
    const first = query(q.first_name, 'first_name');          if (first) where += ` AND c.name ILIKE ${add(likeOf(first))}`;

    // The unit comes from the receipt's own payment plan, so a customer with several allocations does not repeat the receipt
    const result = await db.query(
      `SELECT r.id, r.receipt_number, r.cheque_no, r.amount_received_inr AS amount, r.payment_method, r.status, r.cheque_date, r.deposit_date, r.clearing_date,
              r.hold_remark, r.clearing_bank_id, r.bank_name, r.branch, r.created_at AS receipt_date,
              c.name AS consumer_name, c.registration_no AS registration_number, u.unit_number AS unit_address, t.tower_name,
              ba.name AS clearing_bank_name, comp.name AS company_name
         FROM receipts r
         JOIN consumers c ON c.id = r.consumer_id
         LEFT JOIN payment_plans pp ON pp.id = r.payment_plan_id
         LEFT JOIN units u ON u.id = pp.unit_id
         LEFT JOIN towers t ON t.id = u.tower_id
         LEFT JOIN banks ba ON ba.id = r.clearing_bank_id
         LEFT JOIN projects p ON p.id = pp.project_id
         LEFT JOIN companies comp ON comp.id = p.company_id
        WHERE r.payment_method::text = ANY($${params.length + 1}::text[])
          AND r.status IN ('pending', 'authorized', 'deposited', 'on_hold') ${where}
        ORDER BY r.created_at DESC, r.id DESC`,
      [...params, INSTRUMENTS]
    );
    res.json({ success: true, data: result.rows, total: result.rows.length });
  } catch (err) { fail(err, res, next); }
});

// GET /receipts/:id
router.get('/receipts/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = uuid(req.params.id, 'Receipt id');
    const r = await db.query(`SELECT r.*, c.name AS consumer_name, c.mobile FROM receipts r JOIN consumers c ON r.consumer_id = c.id WHERE r.id = $1`, [id]);
    if (!r.rows.length) throw bad('Receipt not found', 404);
    res.json({ success: true, data: r.rows[0] });
  } catch (err) { fail(err, res, next); }
});

// PATCH /receipts/:id - correct the instrument, date and parts of a receipt. The amount itself cannot change: cancel the receipt and record it again.
router.patch('/receipts/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = uuid(req.params.id, 'Receipt id');
    const b = body(req);
    if (has(b.amountReceivedInr)) num(b.amountReceivedInr, 'Amount', MAX_AMOUNT, 2);   // checked, but not applied
    const method = has(b.paymentMethod) ? mode(b.paymentMethod, 'Payment method') : null;
    const ref = text(b.transactionRef, 'Reference', 100, false);
    const bankName = text(b.bankName, 'Bank name', 255, false);
    const branch = text(b.branch, 'Branch', 255, false);
    const chequeNo = text(b.chequeNo, 'Cheque number', 50, false);
    const chequeDate = day(b.chequeDate, 'Cheque date');
    const received = pastDay(b.receivedDate, 'Receipt date');

    const out = await inTx(async (c) => {
      const cur = (await c.query(
        `SELECT id, receipt_number, consumer_id, approval_status, status, transaction_ref, cheque_no, received_date, amount_received_inr, payment_method, plc_amount, edc_amount, idc_amount, interest_amount, other_charge_amount
           FROM receipts WHERE id = $1 FOR UPDATE`, [id]
      )).rows[0];
      if (!cur) throw bad('Receipt not found', 404);
      if (cur.approval_status === 'approved') throw bad('Cannot edit an approved receipt', 403);
      if (cur.status === 'cancelled' || cur.status === 'bounced') throw bad(`Cannot edit a ${cur.status} receipt`, 403);
      const editParts = cur.approval_status === 'pending';   // the charge parts are locked once approved (kept as before)
      const p = parts(b, parseFloat(cur.amount_received_inr));
      if (ref && ref !== cur.transaction_ref) await reference(c, 'transaction_ref', ref, id, 'Reference');
      if (chequeNo && chequeNo !== cur.cheque_no) await reference(c, 'cheque_no', chequeNo, id, 'Cheque number');

      // The date drives GST: when it changes the GST part is worked out again for the new date
      let cgst: number | null = null, sgst: number | null = null;
      const was = cur.received_date ? new Date(cur.received_date).toISOString().slice(0, 10) : null;
      if (received && received !== was) {
        const projectId = (await c.query(`SELECT project_id FROM booking_records WHERE consumer_id = $1 ORDER BY created_at ASC LIMIT 1`, [cur.consumer_id])).rows[0]?.project_id || null;
        const gst = await computeReceiptGstSplit(c, parseFloat(cur.amount_received_inr), projectId, received);
        cgst = gst.cgstAmount; sgst = gst.sgstAmount;
      }
      const r = await c.query(
        `UPDATE receipts SET
           payment_method = COALESCE($1, payment_method), transaction_ref = COALESCE($2, transaction_ref), bank_name = COALESCE($3, bank_name), branch = COALESCE($4, branch),
           cheque_no = COALESCE($5, cheque_no), cheque_date = COALESCE($6::date, cheque_date), received_date = COALESCE($7::date, received_date),
           cgst_amount = COALESCE($9::numeric, cgst_amount), sgst_amount = COALESCE($10::numeric, sgst_amount),
           plc_amount = CASE WHEN $8::boolean THEN COALESCE($11::numeric, plc_amount) ELSE plc_amount END,
           edc_amount = CASE WHEN $8::boolean THEN COALESCE($12::numeric, edc_amount) ELSE edc_amount END,
           idc_amount = CASE WHEN $8::boolean THEN COALESCE($13::numeric, idc_amount) ELSE idc_amount END,
           interest_amount = CASE WHEN $8::boolean THEN COALESCE($14::numeric, interest_amount) ELSE interest_amount END,
           other_charge_amount = CASE WHEN $8::boolean THEN COALESCE($15::numeric, other_charge_amount) ELSE other_charge_amount END,
           other_charge_desc = CASE WHEN $8::boolean THEN COALESCE($16, other_charge_desc) ELSE other_charge_desc END,
           updated_at = NOW()
         WHERE id = $17 RETURNING *`,
        [method, ref, bankName, branch, chequeNo, chequeDate, received, editParts, cgst, sgst,
         p.plc_amount, p.edc_amount, p.idc_amount, p.interest_amount, p.other_charge_amount, p.other_charge_desc, id]
      );
      await auditChange(c, req, res, 'update', 'receipt', id,
        { payment_method: cur.payment_method, transaction_ref: cur.transaction_ref, cheque_no: cur.cheque_no, received_date: was },
        { payment_method: r.rows[0].payment_method, transaction_ref: r.rows[0].transaction_ref, cheque_no: r.rows[0].cheque_no, received_date: r.rows[0].received_date });
      return r.rows[0];
    });
    res.json({ success: true, receipt: out });
  } catch (err) { fail(err, res, next); }
});

// PATCH /receipts/:id/approve - the checker authorises a pending receipt
router.patch('/receipts/:id/approve', requireProcess('receipt', 'checker'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = uuid(req.params.id, 'Receipt id');
    // Strict maker-checker: whoever recorded the receipt cannot authorize it (super_admin included); a receipt with no known recorder waits for remediation.
    // One statement, so the check and the change cannot be separated by a concurrent request.
    const r = await db.query(
      `UPDATE receipts SET status = 'authorized', authorized_by = $1, authorized_at = NOW(), updated_at = NOW()
        WHERE id = $2 AND status = 'pending' AND received_by_user_id IS NOT NULL AND received_by_user_id <> $1
        RETURNING id, receipt_number, amount_received_inr, status`, [req.userId, id]
    );
    if (!r.rows.length) {
      const cur = (await db.query(`SELECT status, received_by_user_id FROM receipts WHERE id = $1`, [id])).rows[0];
      if (cur && cur.status === 'pending') notOwn(req, cur.received_by_user_id);
      throw bad('Pending receipt not found or already authorized', 404);
    }
    await auditChange(db, req, res, 'update', 'receipt', id, { status: 'pending' }, { status: 'authorized' });
    res.json({ success: true, data: r.rows[0], message: 'Receipt authorized successfully' });
  } catch (err) { fail(err, res, next); }
});

// PATCH /receipts/:id/mark-printed
router.patch('/receipts/:id/mark-printed', requirePrint, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = uuid(req.params.id, 'Receipt id');
    const r = await db.query(`UPDATE receipts SET print_status = 'printed', printed_by = $1, printed_at = NOW() WHERE id = $2 AND status <> 'cancelled' RETURNING id`, [req.userId, id]);
    if (!r.rows.length) {
      const exists = await db.query(`SELECT status FROM receipts WHERE id = $1`, [id]);
      throw bad(exists.rows.length ? 'A cancelled receipt cannot be printed' : 'Receipt not found', exists.rows.length ? 409 : 404);
    }
    res.json({ success: true, printedBy: req.userName, printedAt: new Date() });
  } catch (err) { fail(err, res, next); }
});

// Moves a receipt to a new status when it is in one of the allowed ones; the row is locked so two clicks cannot both win
const move = async (req: AuthRequest, res: Response, next: NextFunction, o: {
  from: string[]; to: string; set: (b: any) => { sql: string; values: any[] }; action: string; verb: string; message: string;
}) => {
  try {
    const id = uuid(req.params.id, 'Receipt id');
    const set = o.set(body(req));
    const data = await inTx(async (c) => {
      const cur = (await c.query(`SELECT id, payment_method, status FROM receipts WHERE id = $1 FOR UPDATE`, [id])).rows[0];
      if (!cur) throw bad('Receipt not found', 404);
      if (!INSTRUMENTS.includes(cur.payment_method)) throw bad(`This payment mode cannot be ${o.verb}`);
      if (!o.from.includes(cur.status)) throw bad(`Cannot ${o.action}: receipt is '${cur.status}', must be ${o.from.map((s) => `'${s}'`).join(' or ')}`);
      const r = await c.query(
        `UPDATE receipts SET status = '${o.to}', ${set.sql}, updated_at = NOW() WHERE id = $${set.values.length + 1}
         RETURNING id, receipt_number, status, amount_received_inr, deposit_date, clearing_date, clearing_bank_id, hold_remark`, [...set.values, id]
      );
      await auditChange(c, req, res, 'update', 'receipt', id, { status: cur.status }, { status: o.to });
      return r.rows[0];
    });
    // A cheque that clears may complete an installment paid in time: raise its timely-discount credit note (never allowed to fail the clearing itself)
    if (o.to === 'cleared') {
      try {
        const who = (await db.query('SELECT r.consumer_id, pp.project_id FROM receipts r JOIN payment_plans pp ON pp.id = r.payment_plan_id WHERE r.id = $1', [id])).rows[0];
        if (who?.project_id) await runTimelyDiscounts(db, req, who.project_id, who.consumer_id);
      } catch (e) { console.error('timely discount after clearing failed:', (e as any)?.message); }
    }
    res.json({ success: true, message: o.message, data });
  } catch (err) { fail(err, res, next); }
};

router.patch('/receipts/:id/deposit', (req: AuthRequest, res: Response, next: NextFunction) => move(req, res, next, {
  from: ['pending', 'authorized'], to: 'deposited', action: 'deposit', verb: 'deposited', message: 'Cheque marked as deposited',
  set: (b) => { const d = pastDay(b.deposit_date, 'deposit_date'); if (!d) throw bad('deposit_date is required'); return { sql: 'deposit_date = $1', values: [d] }; },
}));
router.patch('/receipts/:id/clear', (req: AuthRequest, res: Response, next: NextFunction) => move(req, res, next, {
  from: ['pending', 'authorized', 'deposited', 'on_hold'], to: 'cleared', action: 'clear', verb: 'cleared', message: 'Cheque marked as cleared',
  set: (b) => {
    const d = pastDay(b.clearing_date, 'clearing_date'); if (!d) throw bad('clearing_date is required');
    return { sql: 'clearing_date = $1, clearing_bank_id = $2', values: [d, has(b.clearing_bank_id) ? uuid(b.clearing_bank_id, 'clearing_bank_id') : null] };
  },
}));
router.patch('/receipts/:id/hold', (req: AuthRequest, res: Response, next: NextFunction) => move(req, res, next, {
  from: ['pending', 'authorized', 'deposited', 'on_hold'], to: 'on_hold', action: 'hold', verb: 'put on hold', message: 'Cheque put on hold',
  set: (b) => ({ sql: 'hold_remark = $1', values: [text(b.hold_remark, 'hold_remark', 500, true)] }),
}));
router.patch('/receipts/:id/release-hold', (req: AuthRequest, res: Response, next: NextFunction) => move(req, res, next, {
  from: ['on_hold'], to: 'pending', action: 'release', verb: 'released from hold', message: 'Cheque released from hold',
  set: () => ({ sql: 'hold_remark = NULL', values: [] }),
}));

router.use(pgErrorHandler);

export default router;
