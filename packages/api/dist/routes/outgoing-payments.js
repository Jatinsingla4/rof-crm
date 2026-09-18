"use strict";
/**
 * Outgoing Payments Routes — Phase 4
 * Basic CRUD for outgoing (bank-debit) payments. No maker/checker yet (deferred).
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_js_1 = require("../index.js");
const router = (0, express_1.Router)();
// POST /api/payments/outgoing-payments
router.post('/outgoing-payments', async (req, res, next) => {
    try {
        const { company_bank_account_id, amount_inr, payment_date, payee, status, reference_number, notes, } = req.body;
        if (!company_bank_account_id || !amount_inr) {
            return res.status(400).json({ success: false, error: 'company_bank_account_id and amount_inr are required' });
        }
        const result = await index_js_1.db.query(`INSERT INTO outgoing_payments
        (company_bank_account_id, amount_inr, payment_date, payee, status, reference_number, notes, created_by_user_id)
       VALUES ($1, $2, COALESCE($3, CURRENT_DATE), $4, COALESCE($5, 'pending'), $6, $7, $8)
       RETURNING *`, [
            company_bank_account_id,
            amount_inr,
            payment_date || null,
            payee || null,
            status || null,
            reference_number || null,
            notes || null,
            req.userId || null,
        ]);
        res.status(201).json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/payments/outgoing-payments
router.get('/outgoing-payments', async (req, res, next) => {
    try {
        const { company_bank_account_id, status, fromDate, toDate } = req.query;
        const params = [];
        const p = (v) => { params.push(v); return `$${params.length}`; };
        let where = 'WHERE 1=1';
        if (company_bank_account_id)
            where += ` AND op.company_bank_account_id = ${p(company_bank_account_id)}`;
        if (status)
            where += ` AND op.status = ${p(status)}`;
        if (fromDate)
            where += ` AND op.payment_date >= ${p(fromDate)}::date`;
        if (toDate)
            where += ` AND op.payment_date <= ${p(toDate)}::date`;
        const result = await index_js_1.db.query(`SELECT op.*
       FROM outgoing_payments op
       ${where}
       ORDER BY op.payment_date DESC, op.created_at DESC`, params);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=outgoing-payments.js.map