/**
 * Outgoing Payments Routes — Phase 4
 * Basic CRUD for outgoing (bank-debit) payments. No maker/checker yet (deferred).
 */

import { Router, Response, NextFunction } from 'express';
import { db } from '../index.js';
import { AuthRequest } from '../index.js';
import { bad, failWith, uuid, has, num, text, day, body } from '../utils/input.js';

const router = Router();

// POST /api/payments/outgoing-payments
router.post('/outgoing-payments', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const b = body(req);
    if (!has(b.company_bank_account_id)) throw bad('company_bank_account_id is required');
    const company_bank_account_id = uuid(b.company_bank_account_id, 'company_bank_account_id');
    if (!has(b.amount_inr)) throw bad('amount_inr is required');
    const amount_inr = num(b.amount_inr, 'Amount', 1_000_000_000, 2);
    if (!(amount_inr > 0)) throw bad('Amount must be more than 0');
    const payment_date = day(b.payment_date, 'Payment date');
    const payee = text(b.payee, 'Payee', 200, false), reference_number = text(b.reference_number, 'Reference number', 100, false), notes = text(b.notes, 'Notes', 1000, false);
    const status = has(b.status) ? String(b.status) : null;
    if (status && !['pending', 'paid', 'cancelled'].includes(status)) throw bad('status must be pending, paid or cancelled');
    if (!(await db.query(`SELECT 1 FROM company_bank_accounts WHERE id = $1`, [company_bank_account_id])).rows.length) throw bad('Bank account not found', 404);

    const result = await db.query(
      `INSERT INTO outgoing_payments
        (company_bank_account_id, amount_inr, payment_date, payee, status, reference_number, notes, created_by_user_id)
       VALUES ($1, $2, COALESCE($3, CURRENT_DATE), $4, COALESCE($5, 'pending'), $6, $7, $8)
       RETURNING *`,
      [
        company_bank_account_id,
        amount_inr,
        payment_date,
        payee,
        status,
        reference_number,
        notes,
        req.userId || null,
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { failWith(err, res, next); }
});

// GET /api/payments/outgoing-payments
router.get('/outgoing-payments', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = req.query as Record<string, any>;
    const company_bank_account_id = has(q.company_bank_account_id) ? uuid(q.company_bank_account_id, 'company_bank_account_id') : null;
    const status = Array.isArray(q.status) ? (() => { throw bad('status is not valid'); })() : text(q.status, 'status', 20, false);
    const fromDate = day(q.fromDate, 'fromDate'), toDate = day(q.toDate, 'toDate');

    const params: any[] = [];
    const p = (v: any) => { params.push(v); return `$${params.length}`; };
    let where = 'WHERE 1=1';

    if (company_bank_account_id) where += ` AND op.company_bank_account_id = ${p(company_bank_account_id)}`;
    if (status)                  where += ` AND op.status = ${p(status)}`;
    if (fromDate)                where += ` AND op.payment_date >= ${p(fromDate)}::date`;
    if (toDate)                  where += ` AND op.payment_date <= ${p(toDate)}::date`;

    const result = await db.query(
      `SELECT op.*
       FROM outgoing_payments op
       ${where}
       ORDER BY op.payment_date DESC, op.created_at DESC`,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (err) { failWith(err, res, next); }
});

export default router;
