"use strict";
/**
 * Outgoing Payments Routes — Phase 4
 * Basic CRUD for outgoing (bank-debit) payments. No maker/checker yet (deferred).
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_js_1 = require("../index.js");
const input_js_1 = require("../utils/input.js");
const business_date_js_1 = require("../utils/business-date.js");
const router = (0, express_1.Router)();
// POST /api/payments/outgoing-payments
router.post('/outgoing-payments', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        if (!(0, input_js_1.has)(b.company_bank_account_id))
            throw (0, input_js_1.bad)('company_bank_account_id is required');
        const company_bank_account_id = (0, input_js_1.uuid)(b.company_bank_account_id, 'company_bank_account_id');
        if (!(0, input_js_1.has)(b.amount_inr))
            throw (0, input_js_1.bad)('amount_inr is required');
        const amount_inr = (0, input_js_1.num)(b.amount_inr, 'Amount', 1000000000, 2);
        if (!(amount_inr > 0))
            throw (0, input_js_1.bad)('Amount must be more than 0');
        const payment_date = (0, input_js_1.day)(b.payment_date, 'Payment date');
        const payee = (0, input_js_1.text)(b.payee, 'Payee', 200, false), reference_number = (0, input_js_1.text)(b.reference_number, 'Reference number', 100, false), notes = (0, input_js_1.text)(b.notes, 'Notes', 1000, false);
        const status = (0, input_js_1.has)(b.status) ? String(b.status) : null;
        if (status && !['pending', 'paid', 'cancelled'].includes(status))
            throw (0, input_js_1.bad)('status must be pending, paid or cancelled');
        if (!(await index_js_1.db.query(`SELECT 1 FROM company_bank_accounts WHERE id = $1 AND ($2::uuid[] IS NULL OR company_id = ANY($2::uuid[]))`, [company_bank_account_id, req.companyIds ?? null])).rows.length)
            throw (0, input_js_1.bad)('Bank account not found', 404);
        const result = await index_js_1.db.query(`INSERT INTO outgoing_payments
        (company_bank_account_id, amount_inr, payment_date, payee, status, reference_number, notes, created_by_user_id)
       VALUES ($1, $2, COALESCE($3, ${business_date_js_1.SQL_TODAY}), $4, COALESCE($5, 'pending'), $6, $7, $8)
       RETURNING *`, [
            company_bank_account_id,
            amount_inr,
            payment_date,
            payee,
            status,
            reference_number,
            notes,
            req.userId || null,
        ]);
        res.status(201).json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        (0, input_js_1.failWith)(err, res, next);
    }
});
// GET /api/payments/outgoing-payments
router.get('/outgoing-payments', async (req, res, next) => {
    try {
        const q = req.query;
        const company_bank_account_id = (0, input_js_1.has)(q.company_bank_account_id) ? (0, input_js_1.uuid)(q.company_bank_account_id, 'company_bank_account_id') : null;
        const status = Array.isArray(q.status) ? (() => { throw (0, input_js_1.bad)('status is not valid'); })() : (0, input_js_1.text)(q.status, 'status', 20, false);
        const fromDate = (0, input_js_1.day)(q.fromDate, 'fromDate'), toDate = (0, input_js_1.day)(q.toDate, 'toDate');
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
        (0, input_js_1.failWith)(err, res, next);
    }
});
exports.default = router;
//# sourceMappingURL=outgoing-payments.js.map