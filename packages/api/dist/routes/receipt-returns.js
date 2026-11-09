"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasProcessRight = exports.lockConsumer = void 0;
/**
 * Receipt returns (mounted at /api/payments): the bank sends back a receipt that was already CLEARED (owner decision 3, D6, D7, D8).
 * The cleared receipt is never changed or erased; a return is a separate record with a maker and an independent checker.
 *  - request:  POST /receipts/:id/returns            (receipt maker)
 *  - approve:  POST /receipt-returns/:id/approve     (receipt checker, never the requester, super admin included)
 *  - reject:   POST /receipt-returns/:id/reject
 *  - lists:    GET  /receipts/:id/returns, GET /receipt-returns
 * Approving a return that would leave approved credit allocations uncovered is refused with 409 and the list of affected allocations. The checker
 * must then name the allocations to reverse (reverse_allocation_ids); the system never picks or reverses one itself (D7).
 * Every money path takes the consumer lock first (the same lock as recording a receipt), then rows in a fixed order, so concurrent requests cannot deadlock.
 */
const express_1 = require("express");
const index_js_1 = require("../index.js");
const processPermission_js_1 = require("../middleware/processPermission.js");
const input_js_1 = require("../utils/input.js");
const business_date_js_1 = require("../utils/business-date.js");
const financial_ops_js_1 = require("./financial-ops.js");
const auditLogger_js_1 = require("../middleware/auditLogger.js");
const money_basis_js_1 = require("../utils/money-basis.js");
const router = (0, express_1.Router)();
const fail = (err, res, next) => {
    if (err?.extra)
        return res.status(err.http || 409).json({ error: err.message, ...err.extra });
    return (0, input_js_1.failWith)(err, res, next, 'This request was already made');
};
const gate = () => { if ((process.env.RECEIPT_RETURNS || 'on').toLowerCase() === 'off')
    throw (0, input_js_1.bad)('Return processing is temporarily disabled', 409); };
const lockConsumer = (c, consumerId) => c.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`receipt-consumer:${consumerId}`]);
exports.lockConsumer = lockConsumer;
const round2 = (n) => Math.round(n * 100) / 100;
const withExtra = (message, http, extra) => Object.assign((0, input_js_1.bad)(message, http), { extra });
// Does this user hold a process right? (super admin passes, as everywhere else)
const hasProcessRight = async (c, req, processName, role) => {
    if (req.userRole === 'super_admin')
        return true;
    const col = role === 'maker' ? 'is_maker' : 'is_checker';
    return !!(await c.query(`SELECT 1 FROM user_process_permissions WHERE user_id = $1 AND process_name = $2 AND ${col} = TRUE`, [req.userId, processName])).rows.length;
};
exports.hasProcessRight = hasProcessRight;
const COLS = `id, receipt_id, consumer_id, payment_plan_id, amount, reason, bank_return_date::text AS bank_return_date, status, requested_by, requested_at, approved_by, posted_at, rejected_reason, journal_entry_id, version`;
// ---- request ----
router.post('/receipts/:id/returns', (0, processPermission_js_1.requireProcess)('receipt', 'maker'), async (req, res, next) => {
    try {
        gate();
        if (!req.userId)
            throw (0, input_js_1.bad)('Sign in again', 401);
        const id = (0, input_js_1.uuid)(req.params.id, 'Receipt id');
        const b = (0, input_js_1.body)(req);
        const amount = (0, input_js_1.num)(b.amount, 'amount', 1000000000, 0);
        if (!(amount > 0))
            throw (0, input_js_1.bad)('amount must be more than 0');
        const reason = (0, input_js_1.text)(b.reason, 'reason', 500, true);
        const bankDate = (0, input_js_1.day)(b.bank_return_date, 'bank_return_date');
        if (!bankDate)
            throw (0, input_js_1.bad)('bank_return_date (the day the bank returned it) is required');
        if (bankDate > (0, business_date_js_1.businessTomorrow)())
            throw (0, input_js_1.bad)('The bank return date cannot be in the future');
        const key = (0, input_js_1.text)(b.idempotency_key, 'idempotency_key', 120, true);
        const out = await (0, input_js_1.inTx)(async (c) => {
            const r0 = (await c.query(`SELECT consumer_id FROM receipts WHERE id = $1`, [id])).rows[0];
            if (!r0)
                throw (0, input_js_1.bad)('Receipt not found', 404);
            await (0, exports.lockConsumer)(c, r0.consumer_id);
            const dup = (await c.query(`SELECT ${COLS}, idempotency_key FROM receipt_returns WHERE requested_by = $1 AND idempotency_key = $2`, [req.userId, key])).rows[0];
            if (dup) {
                if (dup.receipt_id !== id || Number(dup.amount) !== amount)
                    throw (0, input_js_1.bad)('This idempotency key was already used for a different request', 409);
                return { row: dup, replay: true };
            }
            const rc = (await c.query(`SELECT id, status, is_advance, amount_received_inr, payment_plan_id, consumer_id, clearing_date::text AS clearing_date FROM receipts WHERE id = $1 FOR UPDATE`, [id])).rows[0];
            if (rc.status !== 'cleared' || rc.is_advance)
                throw (0, input_js_1.bad)('Only a cleared receipt can be returned. A receipt that has not cleared is bounced or cancelled instead.', 409);
            if (rc.clearing_date && bankDate < rc.clearing_date)
                throw (0, input_js_1.bad)('The bank return date cannot be before the clearing date');
            if ((await c.query(`SELECT 1 FROM receipt_returns WHERE receipt_id = $1 AND status = 'pending'`, [id])).rows.length)
                throw (0, input_js_1.bad)('This receipt already has a return waiting for approval', 409);
            const taken = Number((await c.query(`SELECT COALESCE(SUM(amount), 0) AS s FROM receipt_returns WHERE receipt_id = $1 AND status = 'approved'`, [id])).rows[0].s);
            const room = round2(Number(rc.amount_received_inr) - taken);
            if (amount > room + 0.005)
                throw (0, input_js_1.bad)(`The return (${amount}) is more than what is left of this receipt (${room})`, 409);
            const ins = await c.query(`INSERT INTO receipt_returns (receipt_id, consumer_id, payment_plan_id, amount, reason, bank_return_date, requested_by, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING ${COLS}`, [id, rc.consumer_id, rc.payment_plan_id, amount, reason, bankDate, req.userId, key]);
            await (0, auditLogger_js_1.auditChange)(c, req, res, 'create', 'receipt_return', ins.rows[0].id, undefined, { receipt_id: id, amount, bank_return_date: bankDate, reason });
            return { row: ins.rows[0], replay: false };
        });
        res.status(out.replay ? 200 : 201).json({ success: true, data: out.row, replay: out.replay });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// ---- approve ----
router.post('/receipt-returns/:id/approve', (0, processPermission_js_1.requireProcess)('receipt', 'checker'), async (req, res, next) => {
    try {
        gate();
        const id = (0, input_js_1.uuid)(req.params.id, 'Return id');
        const b = (0, input_js_1.body)(req);
        let ids = [];
        if ((0, input_js_1.has)(b.reverse_allocation_ids)) {
            if (!Array.isArray(b.reverse_allocation_ids) || b.reverse_allocation_ids.length > 50)
                throw (0, input_js_1.bad)('reverse_allocation_ids must be a list of at most 50 allocation ids');
            ids = [...new Set(b.reverse_allocation_ids.map((x, i) => (0, input_js_1.uuid)(x, `reverse_allocation_ids[${i}]`)))];
        }
        const out = await (0, input_js_1.inTx)(async (c) => {
            const r0 = (await c.query(`SELECT consumer_id FROM receipt_returns WHERE id = $1`, [id])).rows[0];
            if (!r0)
                throw (0, input_js_1.bad)('Return not found', 404);
            await (0, exports.lockConsumer)(c, r0.consumer_id);
            const ret = (await c.query(`SELECT ${COLS} FROM receipt_returns WHERE id = $1 FOR UPDATE`, [id])).rows[0];
            if (ret.status !== 'pending')
                throw (0, input_js_1.bad)(`This return is already ${ret.status}`, 409);
            (0, financial_ops_js_1.notOwn)(req, ret.requested_by);
            const rc = (await c.query(`SELECT id, status, amount_received_inr, payment_plan_id FROM receipts WHERE id = $1 FOR UPDATE`, [ret.receipt_id])).rows[0];
            if (rc.status !== 'cleared')
                throw (0, input_js_1.bad)('The receipt is no longer cleared', 409);
            const taken = Number((await c.query(`SELECT COALESCE(SUM(amount), 0) AS s FROM receipt_returns WHERE receipt_id = $1 AND status = 'approved'`, [ret.receipt_id])).rows[0].s);
            if (Number(ret.amount) > round2(Number(rc.amount_received_inr) - taken) + 0.005)
                throw (0, input_js_1.bad)('The return is more than what is left of the receipt', 409);
            const planId = ret.payment_plan_id;
            let reversed = [];
            if (planId) {
                // approved allocations of the plan, locked in id order
                const als = (await c.query(`SELECT a.id, a.demand_id, a.amount, a.requested_by, a.approved_by, a.posted_at, d.installment_index
             FROM credit_allocations a JOIN demands d ON d.id = a.demand_id
            WHERE a.payment_plan_id = $1 AND a.status = 'approved' ORDER BY a.id FOR UPDATE OF a`, [planId])).rows;
                const after = await (0, money_basis_js_1.creditSummary)(c, planId, { receiptId: ret.receipt_id, amount: Number(ret.amount) });
                const shortfall = after.credit < -0.005 ? round2(-after.credit) : 0;
                const affected = als.map((a) => ({ id: a.id, demand_id: a.demand_id, installment_index: a.installment_index, amount: Number(a.amount), approved_by: a.approved_by, posted_at: a.posted_at }));
                if (ids.length) {
                    if (!shortfall)
                        throw (0, input_js_1.bad)('No allocation has to be reversed for this return. Remove reverse_allocation_ids.');
                    const unknown = ids.filter((x) => !als.some((a) => a.id === x));
                    if (unknown.length)
                        throw (0, input_js_1.bad)(`Not an approved allocation of this plan: ${unknown.join(', ')}`);
                    if (!(await (0, exports.hasProcessRight)(c, req, 'credit_allocation', 'checker')))
                        throw (0, input_js_1.bad)('Reversing allocations needs the credit allocation checker right', 403);
                    const freed = als.filter((a) => ids.includes(a.id)).reduce((s, a) => s + Number(a.amount), 0);
                    const left = round2(shortfall - freed);
                    if (left > 0.005)
                        throw withExtra(`The selected reversals do not cover the return: Rs ${left} would still be allocated beyond the money held. Nothing was changed.`, 409, { shortfall: left, affected_allocations: affected });
                    for (const aid of ids) {
                        await c.query(`INSERT INTO credit_allocation_reversals (allocation_id, origin_return_id, reason, status, requested_by, approved_by, posted_at, idempotency_key)
               VALUES ($1, $2, $3, 'approved', $4, $5, NOW(), $6)`, [aid, id, `Reversed with receipt return ${id}`, ret.requested_by, req.userId, `return:${id}:${aid}`]);
                        await c.query(`UPDATE credit_allocations SET status = 'reversed', version = version + 1, updated_at = NOW() WHERE id = $1`, [aid]);
                        await (0, auditLogger_js_1.auditChange)(c, req, res, 'update', 'credit_allocation', aid, { status: 'approved' }, { status: 'reversed', origin_return_id: id });
                    }
                    reversed = ids;
                }
                else if (shortfall) {
                    throw withExtra(`This return would leave Rs ${shortfall} of approved credit allocations uncovered. Name the allocations to reverse in reverse_allocation_ids. Nothing was changed.`, 409, { shortfall, affected_allocations: affected });
                }
            }
            else if (ids.length)
                throw (0, input_js_1.bad)('This receipt has no payment plan, so there is no allocation to reverse');
            const seq = String((await c.query(`SELECT nextval('journal_entry_seq') AS n`)).rows[0].n).padStart(4, '0');
            const je = await c.query(`INSERT INTO journal_entries (entry_number, entry_date, consumer_id, debit_amount, credit_amount, ledger_head, remarks, status, created_by_user_id, approved_by, approved_at)
         VALUES ($1, ${business_date_js_1.SQL_TODAY}, $2, $3, 0, 'Receipt Return', $4, 'approved', $5, $6, NOW()) RETURNING id`, [`JE/${(0, business_date_js_1.businessYear)()}/${seq}`, ret.consumer_id, ret.amount, `Bank return of receipt ${ret.receipt_id}: ${ret.reason}`, ret.requested_by, req.userId]);
            const up = await c.query(`UPDATE receipt_returns SET status = 'approved', approved_by = $2, posted_at = NOW(), journal_entry_id = $3, version = version + 1, updated_at = NOW()
          WHERE id = $1 AND status = 'pending' AND version = $4 RETURNING ${COLS}`, [id, req.userId, je.rows[0].id, ret.version]);
            if (!up.rows.length)
                throw (0, input_js_1.bad)('The return changed while it was being approved, try again', 409);
            await (0, money_basis_js_1.recomputePlan)(c, planId, req.userId || null); // statuses follow the money after the return; raised_at and due_date are never touched (D8)
            await (0, auditLogger_js_1.auditChange)(c, req, res, 'update', 'receipt_return', id, { status: 'pending' }, { status: 'approved', amount: ret.amount, reversed_allocations: reversed });
            return { row: up.rows[0], reversed_allocation_ids: reversed };
        });
        res.json({ success: true, data: out.row, reversed_allocation_ids: out.reversed_allocation_ids });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// ---- reject ----
router.post('/receipt-returns/:id/reject', (0, processPermission_js_1.requireProcess)('receipt', 'checker'), async (req, res, next) => {
    try {
        gate();
        const id = (0, input_js_1.uuid)(req.params.id, 'Return id');
        const reason = (0, input_js_1.text)((0, input_js_1.body)(req).reason, 'reason', 500, true);
        const row = await (0, input_js_1.inTx)(async (c) => {
            const r0 = (await c.query(`SELECT consumer_id FROM receipt_returns WHERE id = $1`, [id])).rows[0];
            if (!r0)
                throw (0, input_js_1.bad)('Return not found', 404);
            await (0, exports.lockConsumer)(c, r0.consumer_id);
            const ret = (await c.query(`SELECT ${COLS} FROM receipt_returns WHERE id = $1 FOR UPDATE`, [id])).rows[0];
            if (ret.status !== 'pending')
                throw (0, input_js_1.bad)(`This return is already ${ret.status}`, 409);
            (0, financial_ops_js_1.notOwn)(req, ret.requested_by);
            const up = await c.query(`UPDATE receipt_returns SET status = 'rejected', rejected_reason = $2, version = version + 1, updated_at = NOW() WHERE id = $1 RETURNING ${COLS}`, [id, reason]);
            await (0, auditLogger_js_1.auditChange)(c, req, res, 'update', 'receipt_return', id, { status: 'pending' }, { status: 'rejected', reason });
            return up.rows[0];
        });
        res.json({ success: true, data: row });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// ---- lists ----
router.get('/receipts/:id/returns', async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Receipt id');
        res.json({ success: true, data: (await index_js_1.db.query(`SELECT ${COLS} FROM receipt_returns WHERE receipt_id = $1 ORDER BY requested_at`, [id])).rows });
    }
    catch (err) {
        fail(err, res, next);
    }
});
router.get('/receipt-returns', async (req, res, next) => {
    try {
        const q = req.query;
        const params = [];
        let where = 'WHERE TRUE';
        if ((0, input_js_1.has)(q.status)) {
            if (!['pending', 'approved', 'rejected'].includes(String(q.status)))
                throw (0, input_js_1.bad)('status must be pending, approved or rejected');
            params.push(String(q.status));
            where += ` AND status = $${params.length}`;
        }
        if ((0, input_js_1.has)(q.consumerId)) {
            params.push((0, input_js_1.uuid)(q.consumerId, 'consumerId'));
            where += ` AND consumer_id = $${params.length}`;
        }
        res.json({ success: true, data: (await index_js_1.db.query(`SELECT ${COLS} FROM receipt_returns ${where} ORDER BY requested_at DESC LIMIT 500`, params)).rows });
    }
    catch (err) {
        fail(err, res, next);
    }
});
exports.default = router;
//# sourceMappingURL=receipt-returns.js.map