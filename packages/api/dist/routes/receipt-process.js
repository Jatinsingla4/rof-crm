"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_js_1 = require("../index.js");
const processPermission_js_1 = require("../middleware/processPermission.js");
const router = (0, express_1.Router)();
// --- JOURNAL ENTRIES ---
// GET /api/payments/journals
router.get('/journals', async (req, res, next) => {
    try {
        const { consumerId, page = 1, pageSize = 50 } = req.query;
        let query = `
      SELECT je.*, c.name AS consumer_name,
             u1.name AS created_by_name,
             u2.name AS approved_by_name
      FROM journal_entries je
      LEFT JOIN consumers c ON je.consumer_id = c.id
      LEFT JOIN users u1 ON u1.id = je.created_by_user_id
      LEFT JOIN users u2 ON u2.id = je.approved_by
      WHERE 1=1`;
        const params = [];
        if (consumerId) {
            params.push(consumerId);
            query += ` AND je.consumer_id = $${params.length}`;
        }
        query += ` ORDER BY je.created_at DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
        const result = await index_js_1.db.query(query, params);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/payments/journals — MAKER
router.post('/journals', (0, processPermission_js_1.requireProcess)('jv_refund_drcr', 'maker'), async (req, res, next) => {
    try {
        const { consumerId, consumer_id, entryDate, debitAmount, creditAmount, ledgerHead, remarks } = req.body;
        const resolvedConsumerId = consumerId || consumer_id;
        if (!resolvedConsumerId || !ledgerHead) {
            return res.status(400).json({ error: 'consumerId and ledgerHead are required' });
        }
        const seqResult = await index_js_1.db.query(`SELECT nextval('journal_entry_seq') AS seq`);
        const seq = String(seqResult.rows[0].seq).padStart(4, '0');
        const entryNo = `JE/${new Date().getFullYear()}/${seq}`;
        const result = await index_js_1.db.query(`INSERT INTO journal_entries
         (entry_number, entry_date, consumer_id, debit_amount, credit_amount, ledger_head, remarks, status, created_by_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8)
       RETURNING *`, [entryNo, entryDate || new Date(), resolvedConsumerId, debitAmount || 0, creditAmount || 0, ledgerHead, remarks || null, req.userId]);
        res.status(201).json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/payments/journals/:id
router.get('/journals/:id', async (req, res, next) => {
    try {
        const result = await index_js_1.db.query(`
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
    `, [req.params.id]);
        if (!result.rows[0])
            return res.status(404).json({ error: 'Journal entry not found' });
        res.json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        next(error);
    }
});
// PATCH /api/payments/journals/:id/approve — CHECKER
router.patch('/journals/:id/approve', (0, processPermission_js_1.requireProcess)('jv_refund_drcr', 'checker'), async (req, res, next) => {
    try {
        const result = await index_js_1.db.query(`UPDATE journal_entries
       SET status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND status = 'pending'
       RETURNING *`, [req.userId, req.params.id]);
        if (!result.rows[0])
            return res.status(404).json({ error: 'Entry not found or already processed' });
        res.json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        next(error);
    }
});
// PATCH /api/payments/journals/:id/reject — CHECKER
router.patch('/journals/:id/reject', (0, processPermission_js_1.requireProcess)('jv_refund_drcr', 'checker'), async (req, res, next) => {
    try {
        const { rejection_reason } = req.body;
        if (!rejection_reason)
            return res.status(400).json({ error: 'rejection_reason is required' });
        const result = await index_js_1.db.query(`UPDATE journal_entries
       SET status = 'rejected', rejected_by = $1, rejected_at = NOW(), rejection_reason = $2, updated_at = NOW()
       WHERE id = $3 AND status = 'pending'
       RETURNING *`, [req.userId, rejection_reason, req.params.id]);
        if (!result.rows[0])
            return res.status(404).json({ error: 'Entry not found or already processed' });
        res.json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        next(error);
    }
});
// --- TDS MANAGEMENT ---
// GET /api/payments/tds/challans
router.get('/tds/challans', async (req, res, next) => {
    try {
        const result = await index_js_1.db.query(`SELECT * FROM tds_challans ORDER BY challan_date DESC`);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/payments/tds/challans
router.post('/tds/challans', async (req, res, next) => {
    try {
        const { challanNumber, challanDate, amount, bankName, fileUrl } = req.body;
        const result = await index_js_1.db.query(`INSERT INTO tds_challans (challan_number, challan_date, amount, bank_name, file_url)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`, [challanNumber, challanDate, amount, bankName, fileUrl]);
        res.status(201).json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/payments/tds/assign
router.post('/tds/assign', async (req, res, next) => {
    const client = await index_js_1.db.connect();
    try {
        const { challanId, receiptId, amount } = req.body;
        await client.query('BEGIN');
        const rRes = await client.query('SELECT consumer_id FROM receipts WHERE id = $1', [receiptId]);
        if (rRes.rows.length === 0)
            throw new Error('Receipt not found');
        const consumerId = rRes.rows[0].consumer_id;
        const result = await client.query(`INSERT INTO tds_assignments (challan_id, consumer_id, receipt_id, amount_assigned)
       VALUES ($1,$2,$3,$4)
       RETURNING *`, [challanId, consumerId, receiptId, amount]);
        await client.query('COMMIT');
        res.json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        await client.query('ROLLBACK');
        next(error);
    }
    finally {
        client.release();
    }
});
exports.default = router;
//# sourceMappingURL=receipt-process.js.map