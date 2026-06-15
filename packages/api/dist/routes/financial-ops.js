"use strict";
/**
 * Financial Operations Routes — Phase 2
 * Interest waivers, payment refunds, cancellation refunds, credit/debit notes
 * All mutating routes enforce maker/checker via requireProcess middleware.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_js_1 = require("../index.js");
const processPermission_js_1 = require("../middleware/processPermission.js");
const router = (0, express_1.Router)();
// ============================================
// INTEREST WAIVERS
// ============================================
// GET /api/payments/interest-waivers
router.get('/interest-waivers', async (req, res, next) => {
    try {
        const { consumer_id, status } = req.query;
        const params = [];
        let where = 'WHERE 1=1';
        if (consumer_id) {
            params.push(consumer_id);
            where += ` AND iw.consumer_id = $${params.length}`;
        }
        if (status) {
            params.push(status);
            where += ` AND iw.status = $${params.length}`;
        }
        const result = await index_js_1.db.query(`
      SELECT
        iw.*,
        c.name AS consumer_name,
        c.registration_no,
        u1.name AS requested_by_name,
        u2.name AS approved_by_name,
        pi.amount_inr AS interest_amount_inr,
        pi.interest_waived_inr AS already_waived
      FROM interest_waivers iw
      JOIN consumers c ON c.id = iw.consumer_id
      LEFT JOIN users u1 ON u1.id = iw.requested_by
      LEFT JOIN users u2 ON u2.id = iw.approved_by
      LEFT JOIN penal_interests pi ON pi.id = iw.penal_interest_id
      ${where}
      ORDER BY iw.created_at DESC
    `, params);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/payments/interest-waivers/direct
// Direct waive-off: creates approved waiver AND updates penal_interests atomically.
// No separate checker approval step needed.
router.post('/interest-waivers/direct', async (req, res, next) => {
    const client = await index_js_1.db.connect();
    try {
        const { consumer_id, payment_plan_id, installment_index, waiver_amount_inr, reason, authorized_by_name, document_path } = req.body;
        if (!consumer_id)
            return res.status(400).json({ error: 'consumer_id is required' });
        const waiverAmt = parseFloat(waiver_amount_inr);
        if (!waiverAmt || waiverAmt <= 0)
            return res.status(400).json({ error: 'waiver_amount_inr must be > 0' });
        await client.query('BEGIN');
        const waiverRes = await client.query(`INSERT INTO interest_waivers
         (consumer_id, payment_plan_id, installment_index, waiver_amount_inr, reason,
          status, requested_by, requested_at, approved_by, approved_at,
          authorized_by_name, document_path)
       VALUES ($1,$2,$3,$4,$5,'approved',$6,NOW(),$6,NOW(),$7,$8)
       RETURNING *`, [consumer_id, payment_plan_id || null, installment_index || null, Math.round(waiverAmt),
            reason || null, req.userId || null, authorized_by_name || null, document_path || null]);
        if (installment_index) {
            await client.query(`UPDATE penal_interests
         SET interest_waived_inr = LEAST(amount_inr, COALESCE(interest_waived_inr, 0) + $1)
         WHERE consumer_id = $2 AND installment_index = $3 AND status = 'calculated'`, [Math.round(waiverAmt), consumer_id, installment_index]);
        }
        else {
            const piRes = await client.query(`SELECT id, amount_inr, COALESCE(interest_waived_inr, 0) AS already_waived
         FROM penal_interests
         WHERE consumer_id = $1 AND status = 'calculated'
         ORDER BY installment_index ASC`, [consumer_id]);
            let remaining = Math.round(waiverAmt);
            for (const pi of piRes.rows) {
                if (remaining <= 0)
                    break;
                const maxWaiveable = parseInt(pi.amount_inr) - parseInt(pi.already_waived);
                if (maxWaiveable <= 0)
                    continue;
                const apply = Math.min(remaining, maxWaiveable);
                await client.query(`UPDATE penal_interests SET interest_waived_inr = COALESCE(interest_waived_inr, 0) + $1 WHERE id = $2`, [apply, pi.id]);
                remaining -= apply;
            }
        }
        await client.query(`INSERT INTO financial_audit_logs (consumer_id, user_id, action_type, new_value, remarks)
       VALUES ($1,$2,$3,$4,$5)`, [consumer_id, req.userId, 'interest_waiver_direct', JSON.stringify({ waiver_amount_inr: Math.round(waiverAmt), reason, installment_index }), `Direct waiver of Rs.${Math.round(waiverAmt)} applied`]);
        await client.query('COMMIT');
        res.json({ success: true, message: 'Waiver applied successfully', data: waiverRes.rows[0] });
    }
    catch (error) {
        await client.query('ROLLBACK');
        next(error);
    }
    finally {
        client.release();
    }
});
// POST /api/payments/interest-waivers — MAKER
router.post('/interest-waivers', (0, processPermission_js_1.requireProcess)('interest_waiver', 'maker'), async (req, res, next) => {
    try {
        const { consumer_id, penal_interest_id, payment_plan_id, installment_index, waiver_amount_inr, reason, document_path, authorized_by_name } = req.body;
        if (!consumer_id || !waiver_amount_inr) {
            return res.status(400).json({ error: 'consumer_id and waiver_amount_inr are required' });
        }
        if (Number(waiver_amount_inr) <= 0) {
            return res.status(400).json({ error: 'waiver_amount_inr must be greater than 0' });
        }
        const result = await index_js_1.db.query(`INSERT INTO interest_waivers
         (consumer_id, penal_interest_id, payment_plan_id, installment_index, waiver_amount_inr, reason, status, requested_by, requested_at, document_path, authorized_by_name)
       VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,NOW(),$8,$9)
       RETURNING *`, [consumer_id, penal_interest_id || null, payment_plan_id || null, installment_index || null, waiver_amount_inr, reason || null, req.userId, document_path || null, authorized_by_name || null]);
        await index_js_1.db.query(`INSERT INTO financial_audit_logs (consumer_id, user_id, action_type, new_value, remarks)
       VALUES ($1,$2,$3,$4,$5)`, [consumer_id, req.userId, 'interest_waiver_requested', JSON.stringify({ waiver_amount_inr, reason }), `Interest waiver of Rs.${waiver_amount_inr} requested`]);
        res.status(201).json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/payments/interest-waivers/:id
router.get('/interest-waivers/:id', async (req, res, next) => {
    try {
        const result = await index_js_1.db.query(`
      SELECT
        iw.*,
        c.name AS consumer_name,
        c.registration_no,
        u1.name AS requested_by_name,
        u2.name AS approved_by_name,
        u3.name AS rejected_by_name,
        pi.amount_inr AS interest_amount_inr,
        pi.interest_waived_inr AS already_waived
      FROM interest_waivers iw
      JOIN consumers c ON c.id = iw.consumer_id
      LEFT JOIN users u1 ON u1.id = iw.requested_by
      LEFT JOIN users u2 ON u2.id = iw.approved_by
      LEFT JOIN users u3 ON u3.id = iw.rejected_by
      LEFT JOIN penal_interests pi ON pi.id = iw.penal_interest_id
      WHERE iw.id = $1
    `, [req.params.id]);
        if (!result.rows[0])
            return res.status(404).json({ error: 'Waiver not found' });
        res.json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
// PATCH /api/payments/interest-waivers/:id/approve — CHECKER
router.patch('/interest-waivers/:id/approve', (0, processPermission_js_1.requireProcess)('interest_waiver', 'checker'), async (req, res, next) => {
    const client = await index_js_1.db.connect();
    try {
        await client.query('BEGIN');
        const waiverRes = await client.query(`SELECT * FROM interest_waivers WHERE id = $1 AND status = 'pending'`, [req.params.id]);
        if (!waiverRes.rows[0]) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Waiver not found or already processed' });
        }
        const waiver = waiverRes.rows[0];
        await client.query(`UPDATE interest_waivers SET status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW() WHERE id = $2`, [req.userId, req.params.id]);
        if (waiver.penal_interest_id) {
            await client.query(`UPDATE penal_interests SET interest_waived_inr = interest_waived_inr + $1 WHERE id = $2`, [waiver.waiver_amount_inr, waiver.penal_interest_id]);
        }
        await client.query(`INSERT INTO financial_audit_logs (consumer_id, user_id, action_type, new_value, remarks)
       VALUES ($1,$2,$3,$4,$5)`, [waiver.consumer_id, req.userId, 'interest_waiver_approved', JSON.stringify({ waiver_id: req.params.id, waiver_amount_inr: waiver.waiver_amount_inr }), `Interest waiver of Rs.${waiver.waiver_amount_inr} approved`]);
        await client.query('COMMIT');
        res.json({ success: true, message: `Waiver of Rs.${waiver.waiver_amount_inr} approved and applied` });
    }
    catch (err) {
        await client.query('ROLLBACK');
        next(err);
    }
    finally {
        client.release();
    }
});
// PATCH /api/payments/interest-waivers/:id/reject — CHECKER
router.patch('/interest-waivers/:id/reject', (0, processPermission_js_1.requireProcess)('interest_waiver', 'checker'), async (req, res, next) => {
    try {
        const { rejection_reason } = req.body;
        if (!rejection_reason)
            return res.status(400).json({ error: 'rejection_reason is required' });
        const result = await index_js_1.db.query(`UPDATE interest_waivers
       SET status = 'rejected', rejected_by = $1, rejected_at = NOW(), rejection_reason = $2, updated_at = NOW()
       WHERE id = $3 AND status = 'pending'
       RETURNING *`, [req.userId, rejection_reason, req.params.id]);
        if (!result.rows[0])
            return res.status(404).json({ error: 'Waiver not found or already processed' });
        res.json({ success: true, message: 'Waiver rejected' });
    }
    catch (err) {
        next(err);
    }
});
// ============================================
// PAYMENT REFUNDS
// ============================================
// GET /api/payments/refunds
router.get('/refunds', async (req, res, next) => {
    try {
        const { consumer_id, status } = req.query;
        const params = [];
        let where = 'WHERE 1=1';
        if (consumer_id) {
            params.push(consumer_id);
            where += ` AND pr.consumer_id = $${params.length}`;
        }
        if (status) {
            params.push(status);
            where += ` AND pr.status = $${params.length}`;
        }
        const result = await index_js_1.db.query(`
      SELECT
        pr.*,
        c.name AS consumer_name,
        c.registration_no,
        u1.name AS requested_by_name,
        u2.name AS approved_by_name,
        u3.name AS processed_by_name
      FROM payment_refunds pr
      JOIN consumers c ON c.id = pr.consumer_id
      LEFT JOIN users u1 ON u1.id = pr.requested_by
      LEFT JOIN users u2 ON u2.id = pr.approved_by
      LEFT JOIN users u3 ON u3.id = pr.processed_by
      ${where}
      ORDER BY pr.created_at DESC
    `, params);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/payments/refunds — MAKER
router.post('/refunds', (0, processPermission_js_1.requireProcess)('jv_refund_drcr', 'maker'), async (req, res, next) => {
    try {
        const { consumer_id, payment_plan_id, original_receipt_id, refund_amount_inr, reason, refund_mode } = req.body;
        if (!consumer_id || !refund_amount_inr) {
            return res.status(400).json({ error: 'consumer_id and refund_amount_inr are required' });
        }
        if (Number(refund_amount_inr) <= 0) {
            return res.status(400).json({ error: 'refund_amount_inr must be greater than 0' });
        }
        const result = await index_js_1.db.query(`INSERT INTO payment_refunds
         (consumer_id, payment_plan_id, original_receipt_id, refund_amount_inr, reason, refund_mode, status, requested_by)
       VALUES ($1,$2,$3,$4,$5,$6,'pending',$7)
       RETURNING *`, [consumer_id, payment_plan_id || null, original_receipt_id || null, refund_amount_inr, reason || null, refund_mode || null, req.userId]);
        res.status(201).json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/payments/refunds/:id
router.get('/refunds/:id', async (req, res, next) => {
    try {
        const result = await index_js_1.db.query(`
      SELECT
        pr.*,
        c.name AS consumer_name,
        c.registration_no,
        u1.name AS requested_by_name,
        u2.name AS approved_by_name,
        u3.name AS processed_by_name
      FROM payment_refunds pr
      JOIN consumers c ON c.id = pr.consumer_id
      LEFT JOIN users u1 ON u1.id = pr.requested_by
      LEFT JOIN users u2 ON u2.id = pr.approved_by
      LEFT JOIN users u3 ON u3.id = pr.processed_by
      WHERE pr.id = $1
    `, [req.params.id]);
        if (!result.rows[0])
            return res.status(404).json({ error: 'Refund not found' });
        res.json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
// PATCH /api/payments/refunds/:id/approve — CHECKER
router.patch('/refunds/:id/approve', (0, processPermission_js_1.requireProcess)('jv_refund_drcr', 'checker'), async (req, res, next) => {
    try {
        const result = await index_js_1.db.query(`UPDATE payment_refunds
       SET status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND status = 'pending'
       RETURNING *`, [req.userId, req.params.id]);
        if (!result.rows[0])
            return res.status(404).json({ error: 'Refund not found or already processed' });
        res.json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
// PATCH /api/payments/refunds/:id/process — CHECKER
router.patch('/refunds/:id/process', (0, processPermission_js_1.requireProcess)('jv_refund_drcr', 'checker'), async (req, res, next) => {
    try {
        const { refund_mode, refund_reference, refund_date } = req.body;
        if (!refund_mode)
            return res.status(400).json({ error: 'refund_mode is required' });
        const result = await index_js_1.db.query(`UPDATE payment_refunds
       SET status = 'processed', processed_by = $1, processed_at = NOW(),
           refund_mode = COALESCE($2, refund_mode),
           refund_reference = $3,
           refund_date = $4,
           updated_at = NOW()
       WHERE id = $5 AND status = 'approved'
       RETURNING *`, [req.userId, refund_mode, refund_reference || null, refund_date || null, req.params.id]);
        if (!result.rows[0])
            return res.status(404).json({ error: 'Refund not found or not in approved state' });
        res.json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
// ============================================
// CANCELLATION REFUND WORKFLOW
// ============================================
// PATCH /api/payments/cancellations/:id/refund/initiate — MAKER
router.patch('/cancellations/:id/refund/initiate', (0, processPermission_js_1.requireProcess)('jv_refund_drcr', 'maker'), async (req, res, next) => {
    try {
        const result = await index_js_1.db.query(`UPDATE cancellations SET refund_status = 'initiated' WHERE id = $1 RETURNING id, refund_status, refund_amount_inr`, [req.params.id]);
        if (!result.rows[0])
            return res.status(404).json({ error: 'Cancellation not found' });
        res.json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
// PATCH /api/payments/cancellations/:id/refund/complete — CHECKER
router.patch('/cancellations/:id/refund/complete', (0, processPermission_js_1.requireProcess)('jv_refund_drcr', 'checker'), async (req, res, next) => {
    try {
        const result = await index_js_1.db.query(`UPDATE cancellations SET refund_status = 'completed' WHERE id = $1 AND refund_status = 'initiated' RETURNING id, refund_status, refund_amount_inr`, [req.params.id]);
        if (!result.rows[0])
            return res.status(404).json({ error: 'Cancellation not found or refund not yet initiated' });
        res.json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
// ============================================
// CREDIT / DEBIT NOTES (DrCr)
// ============================================
// GET /api/payments/credit-debit-notes
router.get('/credit-debit-notes', async (req, res, next) => {
    try {
        const { consumer_id, note_type, status } = req.query;
        const params = [];
        let where = 'WHERE 1=1';
        if (consumer_id) {
            params.push(consumer_id);
            where += ` AND cdn.consumer_id = $${params.length}`;
        }
        if (note_type) {
            params.push(note_type);
            where += ` AND cdn.note_type = $${params.length}`;
        }
        if (status) {
            params.push(status);
            where += ` AND cdn.status = $${params.length}`;
        }
        const result = await index_js_1.db.query(`
      SELECT
        cdn.*,
        c.name AS consumer_name,
        c.registration_no,
        u1.name AS created_by_name,
        u2.name AS approved_by_name
      FROM credit_debit_notes cdn
      LEFT JOIN consumers c ON c.id = cdn.consumer_id
      LEFT JOIN users u1 ON u1.id = cdn.created_by_user_id
      LEFT JOIN users u2 ON u2.id = cdn.approved_by
      ${where}
      ORDER BY cdn.created_at DESC
    `, params);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/payments/credit-debit-notes — MAKER
router.post('/credit-debit-notes', (0, processPermission_js_1.requireProcess)('jv_refund_drcr', 'maker'), async (req, res, next) => {
    try {
        const { consumer_id, note_type, adjustment_amount, reason, gst_rate = 5, invoice_id, original_invoice_no } = req.body;
        if (!consumer_id || !note_type || !adjustment_amount || !reason) {
            return res.status(400).json({ error: 'consumer_id, note_type, adjustment_amount, and reason are required' });
        }
        if (!['credit', 'debit'].includes(note_type)) {
            return res.status(400).json({ error: 'note_type must be credit or debit' });
        }
        const year = new Date().getFullYear();
        const countRes = await index_js_1.db.query(`SELECT COUNT(*) AS cnt FROM credit_debit_notes WHERE note_number LIKE $1`, [`CDN/${year}/%`]);
        const seq = String(Number(countRes.rows[0].cnt) + 1).padStart(4, '0');
        const noteNumber = `CDN/${year}/${seq}`;
        const gstAmt = (Number(adjustment_amount) * Number(gst_rate)) / 100;
        const totalAmt = Number(adjustment_amount) + gstAmt;
        const result = await index_js_1.db.query(`INSERT INTO credit_debit_notes
         (consumer_id, invoice_id, note_number, note_type, original_invoice_no, adjustment_amount, gst_rate, gst_amount, total_amount, reason, status, created_by_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',$11)
       RETURNING *`, [consumer_id, invoice_id || null, noteNumber, note_type, original_invoice_no || null, adjustment_amount, gst_rate, gstAmt, totalAmt, reason, req.userId]);
        res.status(201).json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/payments/credit-debit-notes/:id
router.get('/credit-debit-notes/:id', async (req, res, next) => {
    try {
        const result = await index_js_1.db.query(`
      SELECT
        cdn.*,
        c.name AS consumer_name,
        c.registration_no,
        u1.name AS created_by_name,
        u2.name AS approved_by_name,
        u3.name AS rejected_by_name
      FROM credit_debit_notes cdn
      LEFT JOIN consumers c ON c.id = cdn.consumer_id
      LEFT JOIN users u1 ON u1.id = cdn.created_by_user_id
      LEFT JOIN users u2 ON u2.id = cdn.approved_by
      LEFT JOIN users u3 ON u3.id = cdn.rejected_by
      WHERE cdn.id = $1
    `, [req.params.id]);
        if (!result.rows[0])
            return res.status(404).json({ error: 'Credit/debit note not found' });
        res.json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
// PATCH /api/payments/credit-debit-notes/:id/approve — CHECKER
router.patch('/credit-debit-notes/:id/approve', (0, processPermission_js_1.requireProcess)('jv_refund_drcr', 'checker'), async (req, res, next) => {
    try {
        const result = await index_js_1.db.query(`UPDATE credit_debit_notes
       SET status = 'issued', approved_by = $1, approved_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND status = 'pending'
       RETURNING *`, [req.userId, req.params.id]);
        if (!result.rows[0])
            return res.status(404).json({ error: 'Note not found or already processed' });
        res.json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
// PATCH /api/payments/credit-debit-notes/:id/cancel — CHECKER
router.patch('/credit-debit-notes/:id/cancel', (0, processPermission_js_1.requireProcess)('jv_refund_drcr', 'checker'), async (req, res, next) => {
    try {
        const { reason } = req.body;
        if (!reason)
            return res.status(400).json({ error: 'reason is required' });
        const result = await index_js_1.db.query(`UPDATE credit_debit_notes
       SET status = 'cancelled', rejected_by = $1, rejected_at = NOW(), rejection_reason = $2, updated_at = NOW()
       WHERE id = $3 AND status IN ('pending','issued')
       RETURNING *`, [req.userId, reason, req.params.id]);
        if (!result.rows[0])
            return res.status(404).json({ error: 'Note not found or already cancelled' });
        res.json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=financial-ops.js.map