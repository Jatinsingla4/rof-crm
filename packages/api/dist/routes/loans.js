"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_js_1 = require("../index.js");
const pg_errors_js_1 = require("../middleware/pg-errors.js");
const auditLogger_js_1 = require("../middleware/auditLogger.js");
const input_js_1 = require("../utils/input.js");
const router = (0, express_1.Router)();
const fail = (e, res, next) => (0, input_js_1.failWith)(e, res, next);
/**
 * POST /api/loans - Record Loan Sanction (mounted with rbac('consumers'): needs consumers:create)
 */
router.post('/', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        if (!(0, input_js_1.has)(b.consumerId))
            throw (0, input_js_1.bad)('consumerId is required');
        const consumerId = (0, input_js_1.uuid)(b.consumerId, 'consumerId'), bankName = (0, input_js_1.text)(b.bankName, 'bankName', 255, true), branchName = (0, input_js_1.text)(b.branchName, 'branchName', 255, false);
        const loanAmount = (0, input_js_1.has)(b.loanAmount) ? (0, input_js_1.pos)(typeof b.loanAmount === 'string' ? b.loanAmount.trim() : b.loanAmount, 'loanAmount', 0) : null;
        const sanction = (0, input_js_1.day)(b.sanctionLetterDate, 'sanctionLetterDate'), tpa = (0, input_js_1.day)(b.tpaSignedDate, 'tpaSignedDate'), remarks = (0, input_js_1.text)(b.remarks, 'remarks', 500, false);
        if (sanction && tpa && tpa < sanction)
            throw (0, input_js_1.bad)('The TPA cannot be signed before the sanction letter date');
        // a letter or agreement that is dated tomorrow or later has not happened yet (one day of room for the time zone)
        const soon = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
        if (sanction && sanction > soon)
            throw (0, input_js_1.bad)('The sanction letter date cannot be in the future');
        if (tpa && tpa > soon)
            throw (0, input_js_1.bad)('The TPA signed date cannot be in the future');
        const row = await (0, input_js_1.inTx)(async (c) => {
            if (!(await c.query(`SELECT 1 FROM consumers WHERE id = $1`, [consumerId])).rows.length)
                throw (0, input_js_1.bad)('Applicant not found', 404);
            await (0, input_js_1.lock)(c, 'loan:' + consumerId);
            // a loan many times the price of the applicant's unit is a typing mistake (GST and add-ons ride on top, so 20% room)
            const price = (await c.query(`SELECT GREATEST(COALESCE(u.total_price_inr, 0), COALESCE(u.base_price_inr, 0)) AS p FROM allocations a JOIN units u ON u.id = a.unit_id WHERE a.consumer_id = $1 AND a.status NOT IN ('cancelled', 'transferred') ORDER BY a.created_at DESC LIMIT 1`, [consumerId])).rows[0];
            if (loanAmount && price && Number(price.p) > 0 && loanAmount > Number(price.p) * 1.2)
                throw (0, input_js_1.bad)(`The loan is far more than the price of the unit (about Rs ${Number(price.p).toLocaleString('en-IN')}). Please check it.`);
            if ((await c.query(`SELECT 1 FROM loan_details WHERE consumer_id = $1 AND bank_name = $2 AND loan_amount IS NOT DISTINCT FROM $3 AND sanction_letter_date IS NOT DISTINCT FROM $4::date`, [consumerId, bankName, loanAmount, sanction])).rows.length)
                throw (0, input_js_1.bad)('This loan is already recorded', 409);
            return (await c.query(`INSERT INTO loan_details (consumer_id, bank_name, branch_name, loan_amount, sanction_letter_date, tpa_signed_date, remarks, loan_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'sanctioned') RETURNING id`, [consumerId, bankName, branchName, loanAmount, sanction, tpa, remarks])).rows[0];
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'loan_detail', row.id, undefined, { consumer_id: consumerId, bank_name: bankName, loan_amount: loanAmount });
        res.status(201).json({ success: true, data: row });
    }
    catch (error) {
        fail(error, res, next);
    }
});
/**
 * GET /api/loans - every recorded loan with the applicant's name (the Loans screen list)
 */
router.get('/', async (req, res, next) => {
    try {
        const { size, offset } = (0, input_js_1.paging)(req.query, 200, 1000);
        const result = await index_js_1.db.query(`SELECT l.*, c.name AS consumer_name FROM loan_details l JOIN consumers c ON c.id = l.consumer_id ORDER BY l.created_at DESC LIMIT ${size} OFFSET ${offset}`);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        fail(error, res, next);
    }
});
/**
 * GET /api/loans/:consumerId - Get loan details for a consumer
 */
router.get('/:consumerId', async (req, res, next) => {
    try {
        const result = await index_js_1.db.query(`SELECT * FROM loan_details WHERE consumer_id = $1 ORDER BY created_at DESC`, [(0, input_js_1.uuid)(req.params.consumerId, 'Consumer id')]);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        fail(error, res, next);
    }
});
router.use(pg_errors_js_1.pgErrorHandler);
exports.default = router;
//# sourceMappingURL=loans.js.map