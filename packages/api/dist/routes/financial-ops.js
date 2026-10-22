"use strict";
/**
 * Financial Operations Routes
 * Interest waivers, payment refunds, cancellation refunds, credit/debit notes.
 * Mounted with rbac('payments'); every change also needs the maker / checker access of its process (requireProcess, super_admin exempt).
 * Money rules: a waiver never exceeds the interest still unwaived, a refund never exceeds what the applicant paid (all refunds together),
 * a credit note never exceeds its invoice, and the person who raised a request cannot approve it (super_admin exempt). Every state change locks the row.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.raiseNote = exports.postRefundJournal = exports.notOwn = void 0;
const express_1 = require("express");
const index_js_1 = require("../index.js");
const processPermission_js_1 = require("../middleware/processPermission.js");
const pg_errors_js_1 = require("../middleware/pg-errors.js");
const auditLogger_js_1 = require("../middleware/auditLogger.js");
const input_js_1 = require("../utils/input.js");
const penal_interest_js_1 = require("../utils/penal-interest.js");
const router = (0, express_1.Router)();
const fail = (e, res, next) => (0, input_js_1.failWith)(e, res, next);
const MODES = ['cash', 'cheque', 'demand_draft', 'bank_transfer', 'neft', 'rtgs', 'upi', 'card'];
const tomorrow = () => new Date(Date.now() + 864e5).toISOString().slice(0, 10); // a day of grace for the browser/server clock gap
const index = (v) => { if (!(0, input_js_1.has)(v))
    return null; if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 999)
    throw (0, input_js_1.bad)('installment_index must be a whole number from 1 to 999'); return v; };
const optId = (v, label) => ((0, input_js_1.has)(v) ? (0, input_js_1.uuid)(v, label) : null);
// The person who raised a request cannot approve it
const notOwn = (req, raisedBy) => { if (req.userRole !== 'super_admin' && raisedBy && raisedBy === req.userId)
    throw (0, input_js_1.bad)('You raised this yourself, someone else has to approve it', 403); };
exports.notOwn = notOwn;
const finLog = (c, consumerId, userId, action, value, remarks) => c.query(`INSERT INTO financial_audit_logs (consumer_id, user_id, action_type, new_value, remarks) VALUES ($1,$2,$3,$4,$5)`, [consumerId, userId, action, JSON.stringify(value), remarks]);
// A refund that is paid goes into the applicant's ledger as an approved journal entry (debit, head "Refund")
const postRefundJournal = async (c, req, consumerId, amount, remarks, madeBy) => {
    const seq = String((await c.query(`SELECT nextval('journal_entry_seq') AS n`)).rows[0].n).padStart(4, '0');
    await c.query(`INSERT INTO journal_entries (entry_number, entry_date, consumer_id, debit_amount, credit_amount, ledger_head, remarks, status, created_by_user_id, approved_by, approved_at)
     VALUES ($1, CURRENT_DATE, $2, $3, 0, 'Refund', $4, 'approved', $5, $6, NOW())`, [`JE/${new Date().getFullYear()}/${seq}`, consumerId, amount, remarks, madeBy || req.userId, req.userId]);
};
exports.postRefundJournal = postRefundJournal;
const consumerExists = async (c, id) => { if (!(await c.query(`SELECT 1 FROM consumers WHERE id = $1`, [id])).rows.length)
    throw (0, input_js_1.bad)('Applicant not found', 404); };
// ============================================
// INTEREST WAIVERS
// ============================================
const WAIVER_STATUS = ['pending', 'approved', 'rejected'];
// GET /api/payments/interest-waivers
router.get('/interest-waivers', async (req, res, next) => {
    try {
        const consumerId = (0, input_js_1.has)(req.query.consumer_id) ? (0, input_js_1.uuid)(req.query.consumer_id, 'consumer_id') : null;
        const status = (0, input_js_1.oneOf)(req.query.status, 'status', WAIVER_STATUS);
        const { size, offset } = (0, input_js_1.paging)(req.query, 500, 1000);
        const params = [];
        let where = 'WHERE 1=1';
        if (consumerId)
            where += ` AND iw.consumer_id = $${params.push(consumerId)}`;
        if (status)
            where += ` AND iw.status = $${params.push(status)}`;
        const result = await index_js_1.db.query(`
      SELECT iw.*, c.name AS consumer_name, c.registration_no, u1.name AS requested_by_name, u2.name AS approved_by_name,
             pi.amount_inr AS interest_amount_inr, pi.interest_waived_inr AS already_waived
      FROM interest_waivers iw
      JOIN consumers c ON c.id = iw.consumer_id
      LEFT JOIN users u1 ON u1.id = iw.requested_by
      LEFT JOIN users u2 ON u2.id = iw.approved_by
      LEFT JOIN penal_interests pi ON pi.id = iw.penal_interest_id
      ${where}
      ORDER BY iw.created_at DESC LIMIT ${size} OFFSET ${offset}`, params);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// Reads the fields of a waiver request or a direct waiver
const waiverInput = (req) => {
    const b = (0, input_js_1.body)(req);
    if (!(0, input_js_1.has)(b.consumer_id))
        throw (0, input_js_1.bad)('consumer_id is required');
    return {
        b, consumerId: (0, input_js_1.uuid)(b.consumer_id, 'consumer_id'), amount: (0, input_js_1.pos)(b.waiver_amount_inr, 'waiver_amount_inr', 0), installmentIndex: index(b.installment_index),
        planId: optId(b.payment_plan_id, 'payment_plan_id'), reason: (0, input_js_1.text)(b.reason, 'reason', 500, false), by: (0, input_js_1.text)(b.authorized_by_name, 'authorized_by_name', 100, false), doc: (0, input_js_1.text)(b.document_path, 'document_path', 255, false),
    };
};
// POST /api/payments/interest-waivers/direct
// Waive-off in one step (the person acts as checker, so checker access is needed): the interest is reduced and one approved waiver is recorded per installment it was taken from.
router.post('/interest-waivers/direct', (0, processPermission_js_1.requireProcess)('interest_waiver', 'checker'), async (req, res, next) => {
    try {
        const w = waiverInput(req);
        const out = await (0, input_js_1.inTx)(async (c) => {
            await consumerExists(c, w.consumerId);
            await (0, input_js_1.lock)(c, 'pi:' + w.consumerId);
            const params = [w.consumerId];
            let more = '';
            if (w.installmentIndex)
                more = ` AND installment_index = $${params.push(w.installmentIndex)}`;
            const rows = (await c.query(`SELECT id, payment_plan_id, installment_index, amount_inr, COALESCE(interest_waived_inr, 0) AS waived FROM penal_interests
          WHERE consumer_id = $1 AND status IN ('calculated','manual') AND COALESCE(amount_inr, 0) > COALESCE(interest_waived_inr, 0)${more}
          ORDER BY installment_index, calculated_at FOR UPDATE`, params)).rows;
            const room = rows.reduce((s, r) => s + Number(r.amount_inr) - Number(r.waived), 0);
            if (!rows.length)
                throw (0, input_js_1.bad)('There is no unwaived interest to waive' + (w.installmentIndex ? ' on this installment' : ''), 409);
            if (w.amount > room)
                throw (0, input_js_1.bad)(`Waiver (Rs ${w.amount}) is more than the interest still unwaived (Rs ${room})`, 409);
            let left = w.amount;
            const made = [];
            for (const pi of rows) {
                if (left <= 0)
                    break;
                const take = Math.min(left, Number(pi.amount_inr) - Number(pi.waived));
                await c.query(`UPDATE penal_interests SET interest_waived_inr = COALESCE(interest_waived_inr, 0) + $1 WHERE id = $2`, [take, pi.id]);
                made.push((await c.query(`INSERT INTO interest_waivers (consumer_id, penal_interest_id, payment_plan_id, installment_index, waiver_amount_inr, reason, status, requested_by, requested_at, approved_by, approved_at, authorized_by_name, document_path)
           VALUES ($1,$2,$3,$4,$5,$6,'approved',$7,NOW(),$7,NOW(),$8,$9) RETURNING *`, [w.consumerId, pi.id, w.planId || pi.payment_plan_id, pi.installment_index, take, w.reason, req.userId, w.by, w.doc])).rows[0]);
                left -= take;
            }
            await finLog(c, w.consumerId, req.userId, 'interest_waiver_direct', { waiver_amount_inr: w.amount, reason: w.reason, installment_index: w.installmentIndex }, `Direct waiver of Rs.${w.amount} applied`);
            return made;
        });
        for (const m of out)
            await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'interest_waiver', m.id, undefined, { consumer_id: m.consumer_id, waiver_amount_inr: m.waiver_amount_inr, installment_index: m.installment_index, direct: true });
        res.json({ success: true, message: 'Waiver applied successfully', data: out[0], rows: out });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// POST /api/payments/interest-waivers — MAKER (a request that a checker approves)
router.post('/interest-waivers', (0, processPermission_js_1.requireProcess)('interest_waiver', 'maker'), async (req, res, next) => {
    try {
        const w = waiverInput(req), piId = optId(w.b.penal_interest_id, 'penal_interest_id');
        if (!piId && !w.installmentIndex)
            throw (0, input_js_1.bad)('Pick the interest to waive (penal_interest_id or installment_index)');
        const row = await (0, input_js_1.inTx)(async (c) => {
            await consumerExists(c, w.consumerId);
            await (0, input_js_1.lock)(c, 'pi:' + w.consumerId);
            const pi = (await c.query(piId ? `SELECT * FROM penal_interests WHERE id = $1 AND consumer_id = $2 FOR UPDATE`
                : `SELECT * FROM penal_interests WHERE installment_index = $1 AND consumer_id = $2 AND status IN ('calculated','manual') ORDER BY calculated_at DESC LIMIT 1 FOR UPDATE`, [piId || w.installmentIndex, w.consumerId])).rows[0];
            if (!pi)
                throw (0, input_js_1.bad)('Interest not found for this applicant', 404);
            const asked = Number((await c.query(`SELECT COALESCE(SUM(waiver_amount_inr), 0) AS n FROM interest_waivers WHERE penal_interest_id = $1 AND status = 'pending'`, [pi.id])).rows[0].n);
            const room = Number(pi.amount_inr || 0) - Number(pi.interest_waived_inr || 0) - asked;
            if (w.amount > room)
                throw (0, input_js_1.bad)(`Waiver (Rs ${w.amount}) is more than the interest still open on this installment (Rs ${Math.max(room, 0)}, including requests waiting for approval)`, 409);
            const r = (await c.query(`INSERT INTO interest_waivers (consumer_id, penal_interest_id, payment_plan_id, installment_index, waiver_amount_inr, reason, status, requested_by, requested_at, document_path, authorized_by_name)
         VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,NOW(),$8,$9) RETURNING *`, [w.consumerId, pi.id, w.planId || pi.payment_plan_id, pi.installment_index, w.amount, w.reason, req.userId, w.doc, w.by])).rows[0];
            await finLog(c, w.consumerId, req.userId, 'interest_waiver_requested', { waiver_amount_inr: w.amount, reason: w.reason }, `Interest waiver of Rs.${w.amount} requested`);
            return r;
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'interest_waiver', row.id, undefined, { consumer_id: row.consumer_id, waiver_amount_inr: row.waiver_amount_inr, status: 'pending' });
        res.status(201).json({ success: true, data: row });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// GET /api/payments/interest-waivers/:id
router.get('/interest-waivers/:id', async (req, res, next) => {
    try {
        const result = await index_js_1.db.query(`
      SELECT iw.*, c.name AS consumer_name, c.registration_no, u1.name AS requested_by_name, u2.name AS approved_by_name, u3.name AS rejected_by_name,
             pi.amount_inr AS interest_amount_inr, pi.interest_waived_inr AS already_waived
      FROM interest_waivers iw
      JOIN consumers c ON c.id = iw.consumer_id
      LEFT JOIN users u1 ON u1.id = iw.requested_by
      LEFT JOIN users u2 ON u2.id = iw.approved_by
      LEFT JOIN users u3 ON u3.id = iw.rejected_by
      LEFT JOIN penal_interests pi ON pi.id = iw.penal_interest_id
      WHERE iw.id = $1`, [(0, input_js_1.uuid)(req.params.id, 'Waiver id')]);
        if (!result.rows[0])
            throw (0, input_js_1.bad)('Waiver not found', 404);
        res.json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// PATCH /api/payments/interest-waivers/:id/approve — CHECKER
router.patch('/interest-waivers/:id/approve', (0, processPermission_js_1.requireProcess)('interest_waiver', 'checker'), async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Waiver id');
        const waiver = await (0, input_js_1.inTx)(async (c) => {
            const w = (await c.query(`SELECT * FROM interest_waivers WHERE id = $1 FOR UPDATE`, [id])).rows[0];
            if (!w)
                throw (0, input_js_1.bad)('Waiver not found', 404);
            if (w.status !== 'pending')
                throw (0, input_js_1.bad)(`Waiver is already ${w.status}`, 409);
            (0, exports.notOwn)(req, w.requested_by);
            await (0, input_js_1.lock)(c, 'pi:' + w.consumer_id);
            // The interest may have been recalculated since the request (new row ids): find it again by installment
            const pi = (await c.query(`SELECT id, amount_inr, COALESCE(interest_waived_inr, 0) AS waived FROM penal_interests
          WHERE consumer_id = $1 AND (id = $2 OR (installment_index = $3 AND status IN ('calculated','manual')))
          ORDER BY (id = $2) DESC, calculated_at DESC LIMIT 1 FOR UPDATE`, [w.consumer_id, w.penal_interest_id, w.installment_index])).rows[0];
            if (!pi)
                throw (0, input_js_1.bad)('The interest for this request no longer exists (it was recalculated or removed). Reject the request and raise it again', 409);
            const room = Number(pi.amount_inr || 0) - Number(pi.waived);
            if (Number(w.waiver_amount_inr) > room)
                throw (0, input_js_1.bad)(`Waiver (Rs ${w.waiver_amount_inr}) is more than the interest still unwaived (Rs ${room}). Reject the request`, 409);
            await c.query(`UPDATE penal_interests SET interest_waived_inr = COALESCE(interest_waived_inr, 0) + $1 WHERE id = $2`, [w.waiver_amount_inr, pi.id]);
            await c.query(`UPDATE interest_waivers SET status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW(), penal_interest_id = $3 WHERE id = $2`, [req.userId, id, pi.id]);
            await finLog(c, w.consumer_id, req.userId, 'interest_waiver_approved', { waiver_id: id, waiver_amount_inr: w.waiver_amount_inr }, `Interest waiver of Rs.${w.waiver_amount_inr} approved`);
            return w;
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'interest_waiver', id, { status: 'pending' }, { status: 'approved' });
        res.json({ success: true, message: `Waiver of Rs.${waiver.waiver_amount_inr} approved and applied` });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// PATCH /api/payments/interest-waivers/:id/reject — CHECKER
router.patch('/interest-waivers/:id/reject', (0, processPermission_js_1.requireProcess)('interest_waiver', 'checker'), async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Waiver id'), reason = (0, input_js_1.text)((0, input_js_1.body)(req).rejection_reason, 'rejection_reason', 500, true);
        await (0, input_js_1.inTx)(async (c) => {
            const w = (await c.query(`SELECT status FROM interest_waivers WHERE id = $1 FOR UPDATE`, [id])).rows[0];
            if (!w)
                throw (0, input_js_1.bad)('Waiver not found', 404);
            if (w.status !== 'pending')
                throw (0, input_js_1.bad)(`Waiver is already ${w.status}`, 409);
            await c.query(`UPDATE interest_waivers SET status = 'rejected', rejected_by = $1, rejected_at = NOW(), rejection_reason = $2, updated_at = NOW() WHERE id = $3`, [req.userId, reason, id]);
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'interest_waiver', id, { status: 'pending' }, { status: 'rejected', reason });
        res.json({ success: true, message: 'Waiver rejected' });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// ============================================
// PAYMENT REFUNDS  (pending -> approved -> processed, or rejected)
// ============================================
const REFUND_STATUS = ['pending', 'approved', 'processed', 'rejected'];
const REFUND_SELECT = `
  SELECT pr.*, c.name AS consumer_name, c.registration_no, u1.name AS requested_by_name, u2.name AS approved_by_name, u3.name AS processed_by_name
  FROM payment_refunds pr
  JOIN consumers c ON c.id = pr.consumer_id
  LEFT JOIN users u1 ON u1.id = pr.requested_by
  LEFT JOIN users u2 ON u2.id = pr.approved_by
  LEFT JOIN users u3 ON u3.id = pr.processed_by`;
// What may still be refunded: money received (live receipts only) minus the other refunds that are open or paid. Call with the applicant locked.
const refundRoom = async (c, consumerId, receiptId, exceptId) => {
    const open = `status IN ('pending','approved','processed') AND id IS DISTINCT FROM $2`;
    const all = (await c.query(`SELECT COALESCE((SELECT SUM(amount_received_inr) FROM receipts WHERE consumer_id = $1 AND status NOT IN ('cancelled','bounced')), 0) AS paid,
            COALESCE((SELECT SUM(refund_amount_inr) FROM payment_refunds WHERE consumer_id = $1 AND ${open}), 0) AS taken`, [consumerId, exceptId])).rows[0];
    let room = Number(all.paid) - Number(all.taken), what = 'what the applicant has paid';
    if (receiptId) {
        const rc = (await c.query(`SELECT r.amount_received_inr AS paid, r.status, COALESCE((SELECT SUM(refund_amount_inr) FROM payment_refunds WHERE original_receipt_id = r.id AND ${open}), 0) AS taken
         FROM receipts r WHERE r.id = $3 AND r.consumer_id = $1`, [consumerId, exceptId, receiptId])).rows[0];
        if (!rc)
            throw (0, input_js_1.bad)('That receipt does not belong to this applicant', 400);
        if (['cancelled', 'bounced'].includes(rc.status))
            throw (0, input_js_1.bad)(`That receipt is ${rc.status}, there is nothing to refund on it`, 409);
        if (Number(rc.paid) - Number(rc.taken) < room) {
            room = Number(rc.paid) - Number(rc.taken);
            what = 'what that receipt can still return';
        }
    }
    return { room: (0, input_js_1.r2)(room), what };
};
// GET /api/payments/refunds
router.get('/refunds', async (req, res, next) => {
    try {
        const consumerId = (0, input_js_1.has)(req.query.consumer_id) ? (0, input_js_1.uuid)(req.query.consumer_id, 'consumer_id') : null;
        const status = (0, input_js_1.oneOf)(req.query.status, 'status', REFUND_STATUS);
        const { size, offset } = (0, input_js_1.paging)(req.query, 500, 1000);
        const params = [];
        let where = 'WHERE 1=1';
        if (consumerId)
            where += ` AND pr.consumer_id = $${params.push(consumerId)}`;
        if (status)
            where += ` AND pr.status = $${params.push(status)}`;
        const result = await index_js_1.db.query(`${REFUND_SELECT} ${where} ORDER BY pr.created_at DESC LIMIT ${size} OFFSET ${offset}`, params);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// POST /api/payments/refunds — MAKER
router.post('/refunds', (0, processPermission_js_1.requireProcess)('jv_refund_drcr', 'maker'), async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        if (!(0, input_js_1.has)(b.consumer_id))
            throw (0, input_js_1.bad)('consumer_id is required');
        const consumerId = (0, input_js_1.uuid)(b.consumer_id, 'consumer_id'), amount = (0, input_js_1.pos)(b.refund_amount_inr, 'refund_amount_inr'), planId = optId(b.payment_plan_id, 'payment_plan_id'), receiptId = optId(b.original_receipt_id, 'original_receipt_id');
        const reason = (0, input_js_1.text)(b.reason, 'reason', 500, false), mode = (0, input_js_1.oneOf)(b.refund_mode, 'refund_mode', MODES);
        const row = await (0, input_js_1.inTx)(async (c) => {
            await consumerExists(c, consumerId);
            if (planId && !(await c.query(`SELECT 1 FROM payment_plans WHERE id = $1 AND consumer_id = $2`, [planId, consumerId])).rows.length)
                throw (0, input_js_1.bad)('That payment plan does not belong to this applicant');
            await (0, input_js_1.lock)(c, 'refund:' + consumerId);
            const { room, what } = await refundRoom(c, consumerId, receiptId, null);
            if (amount > room)
                throw (0, input_js_1.bad)(`Refund (Rs ${amount}) is more than ${what} less the refunds already raised (Rs ${Math.max(room, 0)} left)`, 409);
            return (await c.query(`INSERT INTO payment_refunds (consumer_id, payment_plan_id, original_receipt_id, refund_amount_inr, reason, refund_mode, status, requested_by) VALUES ($1,$2,$3,$4,$5,$6,'pending',$7) RETURNING *`, [consumerId, planId, receiptId, amount, reason, mode, req.userId])).rows[0];
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'payment_refund', row.id, undefined, { consumer_id: consumerId, refund_amount_inr: amount, status: 'pending' });
        res.status(201).json({ success: true, data: row });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// GET /api/payments/refunds/:id
router.get('/refunds/:id', async (req, res, next) => {
    try {
        const r = (await index_js_1.db.query(`${REFUND_SELECT} WHERE pr.id = $1`, [(0, input_js_1.uuid)(req.params.id, 'Refund id')])).rows[0];
        if (!r)
            throw (0, input_js_1.bad)('Refund not found', 404);
        res.json({ success: true, data: r });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// Moves a refund from one state to another. The row is locked, the applicant's refunds are serialised and the amount is checked again
// against what has been paid and refunded by then (a receipt may have been cancelled since the request).
const refundStep = (from, to, extra, checkRoom = true, ownCheck = false) => async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Refund id'), ex = extra ? extra(req, null) : null;
        const row = await (0, input_js_1.inTx)(async (c) => {
            const cur = (await c.query(`SELECT * FROM payment_refunds WHERE id = $1`, [id])).rows[0];
            if (!cur)
                throw (0, input_js_1.bad)('Refund not found', 404);
            await (0, input_js_1.lock)(c, 'refund:' + cur.consumer_id);
            const r = (await c.query(`SELECT * FROM payment_refunds WHERE id = $1 FOR UPDATE`, [id])).rows[0];
            if (!from.split('|').includes(r.status))
                throw (0, input_js_1.bad)(`Refund is ${r.status}, it must be ${from.replace('|', ' or ')} for this step`, 409);
            if (ownCheck)
                (0, exports.notOwn)(req, r.requested_by);
            if (checkRoom) {
                const { room, what } = await refundRoom(c, r.consumer_id, r.original_receipt_id, id);
                if (Number(r.refund_amount_inr) > room)
                    throw (0, input_js_1.bad)(`Refund (Rs ${r.refund_amount_inr}) is now more than ${what} less the other refunds (Rs ${Math.max(room, 0)} left). Reject it`, 409);
            }
            const out = (await c.query(`UPDATE payment_refunds SET status = '${to}', ${ex ? ex.set : ''} updated_at = NOW() WHERE id = $1 RETURNING *`, [id, ...(ex ? ex.params : [])])).rows[0];
            if (to === 'processed')
                await (0, exports.postRefundJournal)(c, req, r.consumer_id, Number(r.refund_amount_inr), `Refund ${id} paid`, r.requested_by);
            return out;
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'payment_refund', id, { status: from }, { status: to });
        res.json({ success: true, data: row });
    }
    catch (err) {
        fail(err, res, next);
    }
};
// PATCH /api/payments/refunds/:id/approve — CHECKER
router.patch('/refunds/:id/approve', (0, processPermission_js_1.requireProcess)('jv_refund_drcr', 'checker'), refundStep('pending', 'approved', (req) => ({ set: 'approved_by = $2, approved_at = NOW(),', params: [req.userId] }), true, true));
// PATCH /api/payments/refunds/:id/process — CHECKER
router.patch('/refunds/:id/process', (0, processPermission_js_1.requireProcess)('jv_refund_drcr', 'checker'), refundStep('approved', 'processed', (req) => {
    const b = (0, input_js_1.body)(req);
    if (!(0, input_js_1.has)(b.refund_mode))
        throw (0, input_js_1.bad)('refund_mode is required');
    const mode = (0, input_js_1.oneOf)(b.refund_mode, 'refund_mode', MODES), ref = (0, input_js_1.text)(b.refund_reference, 'refund_reference', 255, false), date = (0, input_js_1.day)(b.refund_date, 'refund_date');
    if (date && date > tomorrow())
        throw (0, input_js_1.bad)('refund_date cannot be in the future');
    return { set: 'processed_by = $2, processed_at = NOW(), refund_mode = $3, refund_reference = $4, refund_date = $5,', params: [req.userId, mode, ref, date] };
}));
// PATCH /api/payments/refunds/:id/reject — CHECKER (a pending or approved refund that will not be paid; it frees its amount)
router.patch('/refunds/:id/reject', (0, processPermission_js_1.requireProcess)('jv_refund_drcr', 'checker'), refundStep('pending|approved', 'rejected', (req) => ({ set: 'rejected_by = $2, rejected_at = NOW(), rejection_reason = $3,', params: [req.userId, (0, input_js_1.text)((0, input_js_1.body)(req).rejection_reason, 'rejection_reason', 500, true)] }), false));
// ============================================
// CANCELLATION REFUND WORKFLOW
// ============================================
// PATCH /api/payments/cancellations/:id/refund/initiate — MAKER
router.patch('/cancellations/:id/refund/initiate', (0, processPermission_js_1.requireProcess)('jv_refund_drcr', 'maker'), async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Cancellation id');
        const row = await (0, input_js_1.inTx)(async (c) => {
            const cur = (await c.query(`SELECT id, refund_status, refund_amount_inr FROM cancellations WHERE id = $1 FOR UPDATE`, [id])).rows[0];
            if (!cur)
                throw (0, input_js_1.bad)('Cancellation not found', 404);
            if (cur.refund_status && cur.refund_status !== 'pending')
                throw (0, input_js_1.bad)(`Refund is already ${cur.refund_status}`, 409);
            if (!(Number(cur.refund_amount_inr) > 0))
                throw (0, input_js_1.bad)('This cancellation has no refund amount', 409);
            return (await c.query(`UPDATE cancellations SET refund_status = 'initiated', refund_initiated_by = $2 WHERE id = $1 RETURNING id, refund_status, refund_amount_inr`, [id, req.userId])).rows[0];
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'cancellation_refund', id, { refund_status: 'pending' }, { refund_status: 'initiated' });
        res.json({ success: true, data: row });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// PATCH /api/payments/cancellations/:id/refund/complete — CHECKER
router.patch('/cancellations/:id/refund/complete', (0, processPermission_js_1.requireProcess)('jv_refund_drcr', 'checker'), async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Cancellation id');
        const row = await (0, input_js_1.inTx)(async (c) => {
            const cur = (await c.query(`SELECT refund_status, refund_initiated_by, consumer_id, refund_amount_inr FROM cancellations WHERE id = $1 FOR UPDATE`, [id])).rows[0];
            if (!cur)
                throw (0, input_js_1.bad)('Cancellation not found', 404);
            if (cur.refund_status !== 'initiated')
                throw (0, input_js_1.bad)('The refund must be initiated before it is completed' + (cur.refund_status ? ` (it is ${cur.refund_status})` : ''), 409);
            (0, exports.notOwn)(req, cur.refund_initiated_by);
            await (0, exports.postRefundJournal)(c, req, cur.consumer_id, Number(cur.refund_amount_inr), `Cancellation refund ${id} paid`, cur.refund_initiated_by);
            return (await c.query(`UPDATE cancellations SET refund_status = 'completed' WHERE id = $1 RETURNING id, refund_status, refund_amount_inr`, [id])).rows[0];
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'cancellation_refund', id, { refund_status: 'initiated' }, { refund_status: 'completed' });
        res.json({ success: true, data: row });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// ============================================
// CREDIT / DEBIT NOTES (DrCr)
// ============================================
const NOTE_STATUS = ['pending', 'issued', 'cancelled'];
// GET /api/payments/credit-debit-notes
router.get('/credit-debit-notes', async (req, res, next) => {
    try {
        const consumerId = (0, input_js_1.has)(req.query.consumer_id) ? (0, input_js_1.uuid)(req.query.consumer_id, 'consumer_id') : null;
        const type = (0, input_js_1.oneOf)(req.query.note_type, 'note_type', ['credit', 'debit']), status = (0, input_js_1.oneOf)(req.query.status, 'status', NOTE_STATUS);
        const { size, offset } = (0, input_js_1.paging)(req.query, 500, 1000);
        const params = [];
        let where = 'WHERE 1=1';
        if (consumerId)
            where += ` AND cdn.consumer_id = $${params.push(consumerId)}`;
        if (type)
            where += ` AND cdn.note_type = $${params.push(type)}`;
        if (status)
            where += ` AND cdn.status = $${params.push(status)}`;
        const result = await index_js_1.db.query(`
      SELECT cdn.*, c.name AS consumer_name, c.registration_no, u1.name AS created_by_name, u2.name AS approved_by_name
      FROM credit_debit_notes cdn
      LEFT JOIN consumers c ON c.id = cdn.consumer_id
      LEFT JOIN users u1 ON u1.id = cdn.created_by_user_id
      LEFT JOIN users u2 ON u2.id = cdn.approved_by
      ${where} ORDER BY cdn.created_at DESC LIMIT ${size} OFFSET ${offset}`, params);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// Raises a pending note against one invoice. Shared with POST /gst-invoices/credit-debit-note (the Credit / Debit Note tab).
// A credit note can only take back what the invoice charged: all credit notes on the invoice together stay within its taxable amount.
const raiseNote = async (req, b) => {
    if (!(0, input_js_1.has)(b.invoice_id) && !(0, input_js_1.has)(b.original_invoice_no))
        throw (0, input_js_1.bad)('invoice_id or original_invoice_no is required');
    const invoiceId = optId(b.invoice_id, 'invoice_id'), invoiceNo = (0, input_js_1.text)(b.original_invoice_no, 'original_invoice_no', 50, false);
    if (!(0, input_js_1.has)(b.note_type))
        throw (0, input_js_1.bad)('note_type is required');
    const type = (0, input_js_1.oneOf)(b.note_type, 'note_type', ['credit', 'debit']), amount = (0, input_js_1.pos)(b.adjustment_amount, 'adjustment_amount'), reason = (0, input_js_1.text)(b.reason, 'reason', 500, true);
    const gstRate = (0, input_js_1.has)(b.gst_rate) ? (0, input_js_1.num)(b.gst_rate, 'gst_rate', 28, 2) : 5, noteDate = (0, input_js_1.day)(b.note_date, 'note_date'), consumerId = optId(b.consumer_id, 'consumer_id');
    return (0, input_js_1.inTx)(async (c) => {
        const inv = (await c.query(`SELECT id, invoice_no, consumer_id, status, taxable_amount_inr FROM gst_invoices WHERE ${invoiceId ? 'id' : 'invoice_no'} = $1 FOR UPDATE`, [invoiceId || invoiceNo])).rows[0];
        if (!inv)
            throw (0, input_js_1.bad)('Invoice not found', 404);
        if (inv.status === 'cancelled')
            throw (0, input_js_1.bad)('That invoice is cancelled', 409);
        if (consumerId && consumerId !== inv.consumer_id)
            throw (0, input_js_1.bad)('That invoice belongs to another applicant');
        if (type === 'credit') {
            const used = Number((await c.query(`SELECT COALESCE(SUM(adjustment_amount), 0) AS n FROM credit_debit_notes WHERE invoice_id = $1 AND note_type = 'credit' AND status <> 'cancelled'`, [inv.id])).rows[0].n);
            if (used + amount > Number(inv.taxable_amount_inr))
                throw (0, input_js_1.bad)(`Credit notes (Rs ${(0, input_js_1.r2)(used + amount)} with this one) would be more than the invoice (Rs ${inv.taxable_amount_inr})`, 409);
        }
        const gst = (0, input_js_1.r2)(amount * gstRate / 100);
        const no = await (0, penal_interest_js_1.nextNumber)(c, 'credit_debit_notes', 'note_number', 'CDN', 4);
        return (await c.query(`INSERT INTO credit_debit_notes (consumer_id, invoice_id, note_number, note_type, original_invoice_no, adjustment_amount, gst_rate, gst_amount, total_amount, note_date, reason, status, created_by_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,COALESCE($10::date, CURRENT_DATE),$11,'pending',$12) RETURNING *`, [inv.consumer_id, inv.id, no, type, inv.invoice_no, amount, gstRate, gst, (0, input_js_1.r2)(amount + gst), noteDate, reason, req.userId])).rows[0];
    });
};
exports.raiseNote = raiseNote;
// POST /api/payments/credit-debit-notes — MAKER
router.post('/credit-debit-notes', (0, processPermission_js_1.requireProcess)('jv_refund_drcr', 'maker'), async (req, res, next) => {
    try {
        const row = await (0, exports.raiseNote)(req, (0, input_js_1.body)(req));
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'credit_debit_note', row.id, undefined, { note_number: row.note_number, note_type: row.note_type, total_amount: row.total_amount });
        res.status(201).json({ success: true, data: row });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// GET /api/payments/credit-debit-notes/:id
router.get('/credit-debit-notes/:id', async (req, res, next) => {
    try {
        const result = await index_js_1.db.query(`
      SELECT cdn.*, c.name AS consumer_name, c.registration_no, u1.name AS created_by_name, u2.name AS approved_by_name, u3.name AS rejected_by_name
      FROM credit_debit_notes cdn
      LEFT JOIN consumers c ON c.id = cdn.consumer_id
      LEFT JOIN users u1 ON u1.id = cdn.created_by_user_id
      LEFT JOIN users u2 ON u2.id = cdn.approved_by
      LEFT JOIN users u3 ON u3.id = cdn.rejected_by
      WHERE cdn.id = $1`, [(0, input_js_1.uuid)(req.params.id, 'Note id')]);
        if (!result.rows[0])
            throw (0, input_js_1.bad)('Credit/debit note not found', 404);
        res.json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// PATCH /api/payments/credit-debit-notes/:id/approve — CHECKER
router.patch('/credit-debit-notes/:id/approve', (0, processPermission_js_1.requireProcess)('jv_refund_drcr', 'checker'), async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Note id');
        const row = await (0, input_js_1.inTx)(async (c) => {
            const n = (await c.query(`SELECT n.*, i.status AS invoice_status FROM credit_debit_notes n LEFT JOIN gst_invoices i ON i.id = n.invoice_id WHERE n.id = $1 FOR UPDATE OF n`, [id])).rows[0];
            if (!n)
                throw (0, input_js_1.bad)('Note not found', 404);
            if (n.status !== 'pending')
                throw (0, input_js_1.bad)(`Note is already ${n.status}`, 409);
            (0, exports.notOwn)(req, n.created_by_user_id);
            if (n.invoice_status === 'cancelled')
                throw (0, input_js_1.bad)('The invoice of this note was cancelled. Cancel the note', 409);
            return (await c.query(`UPDATE credit_debit_notes SET status = 'issued', approved_by = $1, approved_at = NOW(), updated_at = NOW() WHERE id = $2 RETURNING *`, [req.userId, id])).rows[0];
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'credit_debit_note', id, { status: 'pending' }, { status: 'issued' });
        res.json({ success: true, data: row });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// PATCH /api/payments/credit-debit-notes/:id/cancel — CHECKER
router.patch('/credit-debit-notes/:id/cancel', (0, processPermission_js_1.requireProcess)('jv_refund_drcr', 'checker'), async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Note id'), reason = (0, input_js_1.text)((0, input_js_1.body)(req).reason, 'reason', 500, true);
        const row = await (0, input_js_1.inTx)(async (c) => {
            const n = (await c.query(`SELECT status FROM credit_debit_notes WHERE id = $1 FOR UPDATE`, [id])).rows[0];
            if (!n)
                throw (0, input_js_1.bad)('Note not found', 404);
            if (n.status === 'cancelled')
                throw (0, input_js_1.bad)('Note is already cancelled', 409);
            return (await c.query(`UPDATE credit_debit_notes SET status = 'cancelled', rejected_by = $1, rejected_at = NOW(), rejection_reason = $2, updated_at = NOW() WHERE id = $3 RETURNING *`, [req.userId, reason, id])).rows[0];
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'credit_debit_note', id, { status: 'pending/issued' }, { status: 'cancelled', reason });
        res.json({ success: true, data: row });
    }
    catch (err) {
        fail(err, res, next);
    }
});
router.use(pg_errors_js_1.pgErrorHandler);
exports.default = router;
//# sourceMappingURL=financial-ops.js.map