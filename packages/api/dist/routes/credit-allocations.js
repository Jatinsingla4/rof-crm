"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
const express_1 = require("express");
const index_js_1 = require("../index.js");
const processPermission_js_1 = require("../middleware/processPermission.js");
const input_js_1 = require("../utils/input.js");
const business_date_js_1 = require("../utils/business-date.js");
const financial_ops_js_1 = require("./financial-ops.js");
const auditLogger_js_1 = require("../middleware/auditLogger.js");
const money_basis_js_1 = require("../utils/money-basis.js");
const receipt_returns_js_1 = require("./receipt-returns.js");
const router = (0, express_1.Router)();
const fail = (err, res, next) => (0, input_js_1.failWith)(err, res, next, 'This request was already made');
const gate = () => { if ((process.env.CREDIT_ALLOCATIONS || 'on').toLowerCase() === 'off')
    throw (0, input_js_1.bad)('Credit allocation is temporarily disabled', 409); };
const round2 = (n) => Math.round(n * 100) / 100;
const COLS = `id, consumer_id, payment_plan_id, demand_id, amount, reason, status, requested_by, requested_at, approved_by, posted_at, rejected_reason, version`;
const RCOLS = `id, allocation_id, origin_return_id, reason, status, requested_by, requested_at, approved_by, posted_at, version`;
// A demand can take allocated credit when it is not cancelled, not already paid, due (raised or its date reached: D1), and for at most what is still outstanding
const checkDemand = async (c, demandId, planId, amount) => {
    const d = (await c.query(`SELECT id, payment_plan_id, consumer_id, installment_index, status, due_date::text AS due_date, (raised_at IS NOT NULL) AS raised,
            amount_due_inr, cgst_amount, sgst_amount, addon_charge_amount, addon_cgst_amount, addon_sgst_amount FROM demands WHERE id = $1 FOR UPDATE`, [demandId])).rows[0];
    if (!d || d.payment_plan_id !== planId)
        throw (0, input_js_1.bad)('Demand not found on this plan', 404);
    if (d.status === 'cancelled')
        throw (0, input_js_1.bad)('A cancelled demand cannot take credit', 409);
    if (d.status === 'paid')
        throw (0, input_js_1.bad)('This demand is already paid', 409);
    if (!(d.raised || ['demanded', 'raised'].includes(d.status) || (d.due_date && d.due_date <= (0, business_date_js_1.businessToday)())))
        throw (0, input_js_1.bad)('Credit can only be allocated to a demand that is due: raised, or its due date reached', 409);
    const all = (await c.query(`SELECT id, status, amount_due_inr, cgst_amount, sgst_amount, addon_charge_amount, addon_cgst_amount, addon_sgst_amount FROM demands WHERE payment_plan_id = $1 AND status <> 'cancelled'`, [planId])).rows;
    const paid = (0, money_basis_js_1.paidByDemand)(await (0, money_basis_js_1.loadEligible)(c, planId), await (0, money_basis_js_1.loadAllocations)(c, planId), all).get(demandId) || 0;
    const outstanding = round2((0, money_basis_js_1.demandTotal)(d) - paid);
    if (amount > outstanding + 0.005)
        throw (0, input_js_1.bad)(`The allocation (${amount}) is more than what is still outstanding on this demand (${outstanding})`, 409);
};
router.get('/credit-allocations/summary', async (req, res, next) => {
    try {
        const consumerId = (0, input_js_1.uuid)(req.query.consumerId, 'consumerId');
        const plans = (await index_js_1.db.query(`SELECT id, unit_id FROM payment_plans WHERE consumer_id = $1 ORDER BY created_at DESC`, [consumerId])).rows;
        const out = [];
        for (const p of plans)
            out.push({ payment_plan_id: p.id, unit_id: p.unit_id, ...(await (0, money_basis_js_1.creditSummary)(index_js_1.db, p.id)) });
        res.json({ success: true, data: out });
    }
    catch (err) {
        fail(err, res, next);
    }
});
router.get('/credit-allocations', async (req, res, next) => {
    try {
        const q = req.query;
        const params = [];
        let where = 'WHERE TRUE';
        if ((0, input_js_1.has)(q.status)) {
            if (!['pending', 'approved', 'rejected', 'reversed'].includes(String(q.status)))
                throw (0, input_js_1.bad)('status must be pending, approved, rejected or reversed');
            params.push(String(q.status));
            where += ` AND status = $${params.length}`;
        }
        if ((0, input_js_1.has)(q.consumerId)) {
            params.push((0, input_js_1.uuid)(q.consumerId, 'consumerId'));
            where += ` AND consumer_id = $${params.length}`;
        }
        res.json({ success: true, data: (await index_js_1.db.query(`SELECT ${COLS} FROM credit_allocations ${where} ORDER BY requested_at DESC LIMIT 500`, params)).rows });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// ---- request ----
router.post('/credit-allocations', (0, processPermission_js_1.requireProcess)('credit_allocation', 'maker'), async (req, res, next) => {
    try {
        gate();
        if (!req.userId)
            throw (0, input_js_1.bad)('Sign in again', 401);
        const b = (0, input_js_1.body)(req);
        const demandId = (0, input_js_1.uuid)(b.demand_id, 'demand_id');
        const amount = (0, input_js_1.num)(b.amount, 'amount', 1000000000, 0);
        if (!(amount > 0))
            throw (0, input_js_1.bad)('amount must be more than 0');
        const reason = (0, input_js_1.text)(b.reason, 'reason', 500, true);
        const key = (0, input_js_1.text)(b.idempotency_key, 'idempotency_key', 120, true);
        const out = await (0, input_js_1.inTx)(async (c) => {
            const d0 = (await c.query(`SELECT consumer_id, payment_plan_id FROM demands WHERE id = $1`, [demandId])).rows[0];
            if (!d0)
                throw (0, input_js_1.bad)('Demand not found', 404);
            await (0, receipt_returns_js_1.lockConsumer)(c, d0.consumer_id);
            const dup = (await c.query(`SELECT ${COLS} FROM credit_allocations WHERE requested_by = $1 AND idempotency_key = $2`, [req.userId, key])).rows[0];
            if (dup) {
                if (dup.demand_id !== demandId || Number(dup.amount) !== amount)
                    throw (0, input_js_1.bad)('This idempotency key was already used for a different request', 409);
                return { row: dup, replay: true };
            }
            await checkDemand(c, demandId, d0.payment_plan_id, amount);
            const sum = await (0, money_basis_js_1.creditSummary)(c, d0.payment_plan_id);
            if (amount > sum.credit + 0.005)
                throw (0, input_js_1.bad)(`The allocation (${amount}) is more than the customer credit available (${Math.max(0, sum.credit)})`, 409);
            const ins = await c.query(`INSERT INTO credit_allocations (consumer_id, payment_plan_id, demand_id, amount, reason, requested_by, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${COLS}`, [d0.consumer_id, d0.payment_plan_id, demandId, amount, reason, req.userId, key]);
            await (0, auditLogger_js_1.auditChange)(c, req, res, 'create', 'credit_allocation', ins.rows[0].id, undefined, { demand_id: demandId, amount, reason });
            return { row: ins.rows[0], replay: false };
        });
        res.status(out.replay ? 200 : 201).json({ success: true, data: out.row, replay: out.replay });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// ---- approve / reject an allocation ----
const decide = (verb) => async (req, res, next) => {
    try {
        gate();
        const id = (0, input_js_1.uuid)(req.params.id, 'Allocation id');
        const reason = verb === 'reject' ? (0, input_js_1.text)((0, input_js_1.body)(req).reason, 'reason', 500, true) : null;
        const row = await (0, input_js_1.inTx)(async (c) => {
            const a0 = (await c.query(`SELECT consumer_id FROM credit_allocations WHERE id = $1`, [id])).rows[0];
            if (!a0)
                throw (0, input_js_1.bad)('Allocation not found', 404);
            await (0, receipt_returns_js_1.lockConsumer)(c, a0.consumer_id);
            const a = (await c.query(`SELECT ${COLS} FROM credit_allocations WHERE id = $1 FOR UPDATE`, [id])).rows[0];
            if (a.status !== 'pending')
                throw (0, input_js_1.bad)(`This allocation is already ${a.status}`, 409);
            (0, financial_ops_js_1.notOwn)(req, a.requested_by);
            if (verb === 'reject') {
                const up = await c.query(`UPDATE credit_allocations SET status = 'rejected', rejected_reason = $2, version = version + 1, updated_at = NOW() WHERE id = $1 RETURNING ${COLS}`, [id, reason]);
                await (0, auditLogger_js_1.auditChange)(c, req, res, 'update', 'credit_allocation', id, { status: 'pending' }, { status: 'rejected', reason });
                return up.rows[0];
            }
            await checkDemand(c, a.demand_id, a.payment_plan_id, Number(a.amount));
            const sum = await (0, money_basis_js_1.creditSummary)(c, a.payment_plan_id);
            if (Number(a.amount) > sum.credit + 0.005)
                throw (0, input_js_1.bad)(`The customer credit available (${Math.max(0, sum.credit)}) is now less than the allocation (${a.amount})`, 409);
            const up = await c.query(`UPDATE credit_allocations SET status = 'approved', approved_by = $2, posted_at = NOW(), version = version + 1, updated_at = NOW()
          WHERE id = $1 AND status = 'pending' AND version = $3 RETURNING ${COLS}`, [id, req.userId, a.version]);
            if (!up.rows.length)
                throw (0, input_js_1.bad)('The allocation changed while it was being approved, try again', 409);
            await (0, money_basis_js_1.recomputePlan)(c, a.payment_plan_id, req.userId || null);
            await (0, auditLogger_js_1.auditChange)(c, req, res, 'update', 'credit_allocation', id, { status: 'pending' }, { status: 'approved', amount: a.amount, demand_id: a.demand_id });
            return up.rows[0];
        });
        res.json({ success: true, data: row });
    }
    catch (err) {
        fail(err, res, next);
    }
};
router.post('/credit-allocations/:id/approve', (0, processPermission_js_1.requireProcess)('credit_allocation', 'checker'), decide('approve'));
router.post('/credit-allocations/:id/reject', (0, processPermission_js_1.requireProcess)('credit_allocation', 'checker'), decide('reject'));
// ---- reversal of an approved allocation (a second maker-checker step) ----
router.post('/credit-allocations/:id/reversal', (0, processPermission_js_1.requireProcess)('credit_allocation', 'maker'), async (req, res, next) => {
    try {
        gate();
        if (!req.userId)
            throw (0, input_js_1.bad)('Sign in again', 401);
        const id = (0, input_js_1.uuid)(req.params.id, 'Allocation id');
        const b = (0, input_js_1.body)(req);
        const reason = (0, input_js_1.text)(b.reason, 'reason', 500, true);
        const key = (0, input_js_1.text)(b.idempotency_key, 'idempotency_key', 120, true);
        const out = await (0, input_js_1.inTx)(async (c) => {
            const a0 = (await c.query(`SELECT consumer_id FROM credit_allocations WHERE id = $1`, [id])).rows[0];
            if (!a0)
                throw (0, input_js_1.bad)('Allocation not found', 404);
            await (0, receipt_returns_js_1.lockConsumer)(c, a0.consumer_id);
            const dup = (await c.query(`SELECT ${RCOLS} FROM credit_allocation_reversals WHERE requested_by = $1 AND idempotency_key = $2`, [req.userId, key])).rows[0];
            if (dup) {
                if (dup.allocation_id !== id)
                    throw (0, input_js_1.bad)('This idempotency key was already used for a different request', 409);
                return { row: dup, replay: true };
            }
            const a = (await c.query(`SELECT status FROM credit_allocations WHERE id = $1 FOR UPDATE`, [id])).rows[0];
            if (a.status !== 'approved')
                throw (0, input_js_1.bad)(`Only an approved allocation can be reversed, this one is ${a.status}`, 409);
            if ((await c.query(`SELECT 1 FROM credit_allocation_reversals WHERE allocation_id = $1 AND status IN ('pending', 'approved')`, [id])).rows.length)
                throw (0, input_js_1.bad)('This allocation already has a reversal', 409);
            const ins = await c.query(`INSERT INTO credit_allocation_reversals (allocation_id, reason, requested_by, idempotency_key) VALUES ($1, $2, $3, $4) RETURNING ${RCOLS}`, [id, reason, req.userId, key]);
            await (0, auditLogger_js_1.auditChange)(c, req, res, 'create', 'credit_allocation_reversal', ins.rows[0].id, undefined, { allocation_id: id, reason });
            return { row: ins.rows[0], replay: false };
        });
        res.status(out.replay ? 200 : 201).json({ success: true, data: out.row, replay: out.replay });
    }
    catch (err) {
        fail(err, res, next);
    }
});
const decideReversal = (verb) => async (req, res, next) => {
    try {
        gate();
        const id = (0, input_js_1.uuid)(req.params.id, 'Reversal id');
        const row = await (0, input_js_1.inTx)(async (c) => {
            const r0 = (await c.query(`SELECT a.consumer_id FROM credit_allocation_reversals r JOIN credit_allocations a ON a.id = r.allocation_id WHERE r.id = $1`, [id])).rows[0];
            if (!r0)
                throw (0, input_js_1.bad)('Reversal not found', 404);
            await (0, receipt_returns_js_1.lockConsumer)(c, r0.consumer_id);
            const r = (await c.query(`SELECT ${RCOLS} FROM credit_allocation_reversals WHERE id = $1 FOR UPDATE`, [id])).rows[0];
            if (r.status !== 'pending')
                throw (0, input_js_1.bad)(`This reversal is already ${r.status}`, 409);
            (0, financial_ops_js_1.notOwn)(req, r.requested_by);
            if (verb === 'reject') {
                const up = await c.query(`UPDATE credit_allocation_reversals SET status = 'rejected', version = version + 1, updated_at = NOW() WHERE id = $1 RETURNING ${RCOLS}`, [id]);
                await (0, auditLogger_js_1.auditChange)(c, req, res, 'update', 'credit_allocation_reversal', id, { status: 'pending' }, { status: 'rejected' });
                return up.rows[0];
            }
            const a = (await c.query(`SELECT ${COLS} FROM credit_allocations WHERE id = $1 FOR UPDATE`, [r.allocation_id])).rows[0];
            if (a.status !== 'approved')
                throw (0, input_js_1.bad)(`The allocation is ${a.status}, nothing to reverse`, 409);
            const up = await c.query(`UPDATE credit_allocation_reversals SET status = 'approved', approved_by = $2, posted_at = NOW(), version = version + 1, updated_at = NOW()
          WHERE id = $1 AND status = 'pending' AND version = $3 RETURNING ${RCOLS}`, [id, req.userId, r.version]);
            if (!up.rows.length)
                throw (0, input_js_1.bad)('The reversal changed while it was being approved, try again', 409);
            await c.query(`UPDATE credit_allocations SET status = 'reversed', version = version + 1, updated_at = NOW() WHERE id = $1`, [a.id]);
            await (0, money_basis_js_1.recomputePlan)(c, a.payment_plan_id, req.userId || null);
            await (0, auditLogger_js_1.auditChange)(c, req, res, 'update', 'credit_allocation_reversal', id, { status: 'pending' }, { status: 'approved', allocation_id: a.id });
            return up.rows[0];
        });
        res.json({ success: true, data: row });
    }
    catch (err) {
        fail(err, res, next);
    }
};
router.post('/credit-allocation-reversals/:id/approve', (0, processPermission_js_1.requireProcess)('credit_allocation', 'checker'), decideReversal('approve'));
router.post('/credit-allocation-reversals/:id/reject', (0, processPermission_js_1.requireProcess)('credit_allocation', 'checker'), decideReversal('reject'));
exports.default = router;
//# sourceMappingURL=credit-allocations.js.map