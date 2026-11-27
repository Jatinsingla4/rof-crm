/**
 * Customer credit allocations (mounted at /api/payments), owner decisions Q13 and D4.
 * The excess of cleared money stays customer credit. It pays a demand only through an allocation that one person requests (maker) and another
 * approves (checker); the maker can never approve their own request, super admin included. A reversal is a second maker-checker step.
 *  - GET  /credit-allocations/summary?consumerId=   eligible money, used on demands, allocated, credit left
 *  - GET  /credit-allocations?consumerId=&status=
 *  - POST /credit-allocations                       (maker)   { demand_id, amount, reason, idempotency_key }
 *  - POST /credit-allocations/:id/approve | /reject (checker)
 *  - POST /credit-allocations/:id/reversal          (maker)   { reason, idempotency_key }
 *  - POST /credit-allocation-reversals/:id/approve | /reject (checker)
 * Same lock order as every money path: the consumer lock first (also taken when a receipt is recorded), then the rows, then the status recompute.
 */
import { planIsCancelled, CANCELLED_MSG } from '../utils/booking-state.js';
import { Router, Response, NextFunction } from 'express';
import { db, AuthRequest } from '../index.js';
import { requireProcess } from '../middleware/processPermission.js';
import { bad, failWith, uuid, has, num, text, body, inTx } from '../utils/input.js';
import { businessToday } from '../utils/business-date.js';
import { notOwn } from './financial-ops.js';
import { auditChange } from '../middleware/auditLogger.js';
import { recomputePlan, creditSummary, loadEligible, loadAllocations, paidByDemand, demandTotal } from '../utils/money-basis.js';
import { lockConsumer } from './receipt-returns.js';

const router = Router();
const fail = (err: any, res: Response, next: NextFunction) => failWith(err, res, next, 'This request was already made');
const gate = () => { if ((process.env.CREDIT_ALLOCATIONS || 'on').toLowerCase() === 'off') throw bad('Credit allocation is temporarily disabled', 409); };
const round2 = (n: number) => Math.round(n * 100) / 100;
const COLS = `id, consumer_id, payment_plan_id, demand_id, amount, reason, status, requested_by, requested_at, approved_by, posted_at, rejected_reason, version`;
const RCOLS = `id, allocation_id, origin_return_id, reason, status, requested_by, requested_at, approved_by, posted_at, version`;

// A demand can take allocated credit when it is not cancelled, not already paid, due (raised or its date reached: D1), and for at most what is still outstanding
const checkDemand = async (c: any, demandId: string, planId: string, amount: number) => {
  const d = (await c.query(
    `SELECT id, payment_plan_id, consumer_id, installment_index, status, due_date::text AS due_date, (raised_at IS NOT NULL) AS raised,
            amount_due_inr, cgst_amount, sgst_amount, addon_charge_amount, addon_cgst_amount, addon_sgst_amount FROM demands WHERE id = $1 FOR UPDATE`, [demandId])).rows[0];
  if (!d || d.payment_plan_id !== planId) throw bad('Demand not found on this plan', 404);
  if (d.status === 'cancelled') throw bad('A cancelled demand cannot take credit', 409);
  if (d.status === 'paid') throw bad('This demand is already paid', 409);
  if (!(d.raised || ['demanded', 'raised'].includes(d.status) || (d.due_date && d.due_date <= businessToday()))) throw bad('Credit can only be allocated to a demand that is due: raised, or its due date reached', 409);
  const all = (await c.query(`SELECT id, status, amount_due_inr, cgst_amount, sgst_amount, addon_charge_amount, addon_cgst_amount, addon_sgst_amount FROM demands WHERE payment_plan_id = $1 AND status <> 'cancelled'`, [planId])).rows;
  const paid = paidByDemand(await loadEligible(c, planId), await loadAllocations(c, planId), all).get(demandId) || 0;
  const outstanding = round2(demandTotal(d) - paid);
  if (amount > outstanding + 0.005) throw bad(`The allocation (${amount}) is more than what is still outstanding on this demand (${outstanding})`, 409);
};

router.get('/credit-allocations/summary', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const consumerId = uuid(req.query.consumerId, 'consumerId');
    const plans = (await db.query(`SELECT id, unit_id FROM payment_plans WHERE consumer_id = $1 ORDER BY created_at DESC`, [consumerId])).rows;
    const out = [];
    for (const p of plans) out.push({ payment_plan_id: p.id, unit_id: p.unit_id, ...(await creditSummary(db, p.id)) });
    res.json({ success: true, data: out });
  } catch (err) { fail(err, res, next); }
});

router.get('/credit-allocations', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = req.query; const params: any[] = []; let where = 'WHERE TRUE';
    if (has(q.status)) { if (!['pending', 'approved', 'rejected', 'reversed'].includes(String(q.status))) throw bad('status must be pending, approved, rejected or reversed'); params.push(String(q.status)); where += ` AND status = $${params.length}`; }
    if (has(q.consumerId)) { params.push(uuid(q.consumerId, 'consumerId')); where += ` AND consumer_id = $${params.length}`; }
    res.json({ success: true, data: (await db.query(`SELECT ${COLS} FROM credit_allocations ${where} ORDER BY requested_at DESC LIMIT 500`, params)).rows });
  } catch (err) { fail(err, res, next); }
});

// ---- request ----
router.post('/credit-allocations', requireProcess('credit_allocation', 'maker'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    gate();
    if (!req.userId) throw bad('Sign in again', 401);
    const b = body(req);
    const demandId = uuid(b.demand_id, 'demand_id');
    const amount = num(b.amount, 'amount', 1_000_000_000, 0);
    if (!(amount > 0)) throw bad('amount must be more than 0');
    const reason = text(b.reason, 'reason', 500, true)!;
    const key = text(b.idempotency_key, 'idempotency_key', 120, true)!;
    const out = await inTx(async (c) => {
      const d0 = (await c.query(`SELECT consumer_id, payment_plan_id FROM demands WHERE id = $1`, [demandId])).rows[0];
      if (!d0) throw bad('Demand not found', 404);
      await lockConsumer(c, d0.consumer_id);
      const dup = (await c.query(`SELECT ${COLS} FROM credit_allocations WHERE requested_by = $1 AND idempotency_key = $2`, [req.userId, key])).rows[0];
      if (dup) {
        if (dup.demand_id !== demandId || Number(dup.amount) !== amount) throw bad('This idempotency key was already used for a different request', 409);
        return { row: dup, replay: true };
      }
      if (await planIsCancelled(c, d0.payment_plan_id)) throw bad(CANCELLED_MSG, 409);   // QA-012/044
      await checkDemand(c, demandId, d0.payment_plan_id, amount);
      const sum = await creditSummary(c, d0.payment_plan_id);
      if (amount > sum.credit + 0.005) throw bad(`The allocation (${amount}) is more than the customer credit available (${Math.max(0, sum.credit)})`, 409);
      const ins = await c.query(
        `INSERT INTO credit_allocations (consumer_id, payment_plan_id, demand_id, amount, reason, requested_by, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${COLS}`, [d0.consumer_id, d0.payment_plan_id, demandId, amount, reason, req.userId, key]);
      await auditChange(c, req, res, 'create', 'credit_allocation', ins.rows[0].id, undefined, { demand_id: demandId, amount, reason });
      return { row: ins.rows[0], replay: false };
    });
    res.status(out.replay ? 200 : 201).json({ success: true, data: out.row, replay: out.replay });
  } catch (err) { fail(err, res, next); }
});

// ---- approve / reject an allocation ----
const decide = (verb: 'approve' | 'reject') => async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    gate();
    const id = uuid(req.params.id, 'Allocation id');
    const reason = verb === 'reject' ? text(body(req).reason, 'reason', 500, true)! : null;
    const row = await inTx(async (c) => {
      const a0 = (await c.query(`SELECT consumer_id FROM credit_allocations WHERE id = $1`, [id])).rows[0];
      if (!a0) throw bad('Allocation not found', 404);
      await lockConsumer(c, a0.consumer_id);
      const a = (await c.query(`SELECT ${COLS} FROM credit_allocations WHERE id = $1 FOR UPDATE`, [id])).rows[0];
      if (a.status !== 'pending') throw bad(`This allocation is already ${a.status}`, 409);
      notOwn(req, a.requested_by);
      if (verb === 'reject') {
        const up = await c.query(`UPDATE credit_allocations SET status = 'rejected', rejected_reason = $2, version = version + 1, updated_at = NOW() WHERE id = $1 RETURNING ${COLS}`, [id, reason]);
        await auditChange(c, req, res, 'update', 'credit_allocation', id, { status: 'pending' }, { status: 'rejected', reason });
        return up.rows[0];
      }
      if (await planIsCancelled(c, a.payment_plan_id)) throw bad(CANCELLED_MSG, 409);   // QA-012/044: approving would move money on a cancelled booking; rejecting it stays possible
      await checkDemand(c, a.demand_id, a.payment_plan_id, Number(a.amount));
      const sum = await creditSummary(c, a.payment_plan_id);
      if (Number(a.amount) > sum.credit + 0.005) throw bad(`The customer credit available (${Math.max(0, sum.credit)}) is now less than the allocation (${a.amount})`, 409);
      const up = await c.query(
        `UPDATE credit_allocations SET status = 'approved', approved_by = $2, posted_at = NOW(), version = version + 1, updated_at = NOW()
          WHERE id = $1 AND status = 'pending' AND version = $3 RETURNING ${COLS}`, [id, req.userId, a.version]);
      if (!up.rows.length) throw bad('The allocation changed while it was being approved, try again', 409);
      await recomputePlan(c, a.payment_plan_id, req.userId || null);
      await auditChange(c, req, res, 'update', 'credit_allocation', id, { status: 'pending' }, { status: 'approved', amount: a.amount, demand_id: a.demand_id });
      return up.rows[0];
    });
    res.json({ success: true, data: row });
  } catch (err) { fail(err, res, next); }
};
router.post('/credit-allocations/:id/approve', requireProcess('credit_allocation', 'checker'), decide('approve'));
router.post('/credit-allocations/:id/reject', requireProcess('credit_allocation', 'checker'), decide('reject'));

// ---- reversal of an approved allocation (a second maker-checker step) ----
router.post('/credit-allocations/:id/reversal', requireProcess('credit_allocation', 'maker'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    gate();
    if (!req.userId) throw bad('Sign in again', 401);
    const id = uuid(req.params.id, 'Allocation id');
    const b = body(req);
    const reason = text(b.reason, 'reason', 500, true)!;
    const key = text(b.idempotency_key, 'idempotency_key', 120, true)!;
    const out = await inTx(async (c) => {
      const a0 = (await c.query(`SELECT consumer_id FROM credit_allocations WHERE id = $1`, [id])).rows[0];
      if (!a0) throw bad('Allocation not found', 404);
      await lockConsumer(c, a0.consumer_id);
      const dup = (await c.query(`SELECT ${RCOLS} FROM credit_allocation_reversals WHERE requested_by = $1 AND idempotency_key = $2`, [req.userId, key])).rows[0];
      if (dup) {
        if (dup.allocation_id !== id) throw bad('This idempotency key was already used for a different request', 409);
        return { row: dup, replay: true };
      }
      const a = (await c.query(`SELECT status FROM credit_allocations WHERE id = $1 FOR UPDATE`, [id])).rows[0];
      if (a.status !== 'approved') throw bad(`Only an approved allocation can be reversed, this one is ${a.status}`, 409);
      if ((await c.query(`SELECT 1 FROM credit_allocation_reversals WHERE allocation_id = $1 AND status IN ('pending', 'approved')`, [id])).rows.length) throw bad('This allocation already has a reversal', 409);
      const ins = await c.query(`INSERT INTO credit_allocation_reversals (allocation_id, reason, requested_by, idempotency_key) VALUES ($1, $2, $3, $4) RETURNING ${RCOLS}`, [id, reason, req.userId, key]);
      await auditChange(c, req, res, 'create', 'credit_allocation_reversal', ins.rows[0].id, undefined, { allocation_id: id, reason });
      return { row: ins.rows[0], replay: false };
    });
    res.status(out.replay ? 200 : 201).json({ success: true, data: out.row, replay: out.replay });
  } catch (err) { fail(err, res, next); }
});

const decideReversal = (verb: 'approve' | 'reject') => async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    gate();
    const id = uuid(req.params.id, 'Reversal id');
    const row = await inTx(async (c) => {
      const r0 = (await c.query(`SELECT a.consumer_id FROM credit_allocation_reversals r JOIN credit_allocations a ON a.id = r.allocation_id WHERE r.id = $1`, [id])).rows[0];
      if (!r0) throw bad('Reversal not found', 404);
      await lockConsumer(c, r0.consumer_id);
      const r = (await c.query(`SELECT ${RCOLS} FROM credit_allocation_reversals WHERE id = $1 FOR UPDATE`, [id])).rows[0];
      if (r.status !== 'pending') throw bad(`This reversal is already ${r.status}`, 409);
      notOwn(req, r.requested_by);
      if (verb === 'reject') {
        const up = await c.query(`UPDATE credit_allocation_reversals SET status = 'rejected', version = version + 1, updated_at = NOW() WHERE id = $1 RETURNING ${RCOLS}`, [id]);
        await auditChange(c, req, res, 'update', 'credit_allocation_reversal', id, { status: 'pending' }, { status: 'rejected' });
        return up.rows[0];
      }
      const a = (await c.query(`SELECT ${COLS} FROM credit_allocations WHERE id = $1 FOR UPDATE`, [r.allocation_id])).rows[0];
      if (a.status !== 'approved') throw bad(`The allocation is ${a.status}, nothing to reverse`, 409);
      const up = await c.query(
        `UPDATE credit_allocation_reversals SET status = 'approved', approved_by = $2, posted_at = NOW(), version = version + 1, updated_at = NOW()
          WHERE id = $1 AND status = 'pending' AND version = $3 RETURNING ${RCOLS}`, [id, req.userId, r.version]);
      if (!up.rows.length) throw bad('The reversal changed while it was being approved, try again', 409);
      await c.query(`UPDATE credit_allocations SET status = 'reversed', version = version + 1, updated_at = NOW() WHERE id = $1`, [a.id]);
      await recomputePlan(c, a.payment_plan_id, req.userId || null);
      await auditChange(c, req, res, 'update', 'credit_allocation_reversal', id, { status: 'pending' }, { status: 'approved', allocation_id: a.id });
      return up.rows[0];
    });
    res.json({ success: true, data: row });
  } catch (err) { fail(err, res, next); }
};
router.post('/credit-allocation-reversals/:id/approve', requireProcess('credit_allocation', 'checker'), decideReversal('approve'));
router.post('/credit-allocation-reversals/:id/reject', requireProcess('credit_allocation', 'checker'), decideReversal('reject'));

export default router;
