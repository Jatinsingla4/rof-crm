"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_js_1 = require("../index.js");
const pg_errors_js_1 = require("../middleware/pg-errors.js");
const auditLogger_js_1 = require("../middleware/auditLogger.js");
const input_js_1 = require("../utils/input.js");
const money_basis_js_1 = require("../utils/money-basis.js");
const router = (0, express_1.Router)();
const fail = (e, res, next) => (0, input_js_1.failWith)(e, res, next);
/**
 * GET /api/registry - List registry status (mounted with rbac('allocations'))
 */
router.get('/', async (req, res, next) => {
    try {
        const params = [];
        let where = '';
        if ((0, input_js_1.has)(req.query.projectId))
            where += ` AND u.project_id = $${params.push((0, input_js_1.uuid)(req.query.projectId, 'projectId'))}`;
        const status = (0, input_js_1.qtext)(req.query.status, 'status', 50);
        if (status)
            where += ` AND rd.status = $${params.push(status)}`;
        const { size, offset } = (0, input_js_1.paging)(req.query, 500, 1000);
        const result = await index_js_1.db.query(`SELECT rd.*, c.name as consumer_name, u.unit_number, p.name as project_name
         FROM registry_details rd
         JOIN consumers c ON rd.consumer_id = c.id
         JOIN units u ON rd.unit_id = u.id
         JOIN projects p ON u.project_id = p.id
        WHERE 1=1 ${where} ORDER BY rd.created_at DESC LIMIT ${size} OFFSET ${offset}`, params);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        fail(error, res, next);
    }
});
/**
 * POST /api/registry/schedule - Schedule Registry (only when every demand is paid; one open appointment per allocation)
 */
router.post('/schedule', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        if (!(0, input_js_1.has)(b.allocationId))
            throw (0, input_js_1.bad)('allocationId is required');
        const allocationId = (0, input_js_1.uuid)(b.allocationId, 'allocationId'), appointmentDate = (0, input_js_1.day)(b.appointmentDate, 'appointmentDate'), remarks = (0, input_js_1.text)(b.remarks, 'remarks', 500, false);
        if (!appointmentDate)
            throw (0, input_js_1.bad)('appointmentDate is required');
        const row = await (0, input_js_1.inTx)(async (c) => {
            const al = (await c.query(`SELECT id, unit_id, consumer_id, status FROM allocations WHERE id = $1 FOR UPDATE`, [allocationId])).rows[0];
            if (!al)
                throw (0, input_js_1.bad)('Allocation not found', 404);
            if (['cancelled', 'transferred'].includes(al.status))
                throw (0, input_js_1.bad)(`This allocation is ${al.status}`, 409);
            if ((await c.query(`SELECT 1 FROM registry_details WHERE allocation_id = $1 AND status = 'scheduled'`, [allocationId])).rows.length)
                throw (0, input_js_1.bad)('A registry appointment is already scheduled for this allocation', 409);
            // Ledger balance: every live demand (tax and add-on charges included) less every live receipt
            const balance = Number((await c.query(`SELECT COALESCE((SELECT SUM(amount_due_inr + COALESCE(cgst_amount,0) + COALESCE(sgst_amount,0) + COALESCE(addon_charge_amount,0) + COALESCE(addon_cgst_amount,0) + COALESCE(addon_sgst_amount,0))
                            FROM demands WHERE consumer_id = $1 AND status <> 'cancelled'), 0)
              - COALESCE((SELECT SUM(r.amount_received_inr - ${(0, money_basis_js_1.returnedSql)('r')}) FROM receipts r WHERE r.consumer_id = $1 AND r.status = 'cleared' AND NOT COALESCE(r.is_advance, false)), 0) AS balance`, [al.consumer_id])).rows[0].balance);
            if (balance > 0)
                throw (0, input_js_1.bad)('Registry cannot be scheduled until all dues are cleared. Current balance: ' + Math.round(balance * 100) / 100);
            return (await c.query(`INSERT INTO registry_details (allocation_id, unit_id, consumer_id, appointment_date, remarks, status) VALUES ($1, $2, $3, $4, $5, 'scheduled') RETURNING id, status`, [allocationId, al.unit_id, al.consumer_id, appointmentDate, remarks])).rows[0];
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'registry', row.id, undefined, { allocation_id: allocationId, appointment_date: appointmentDate });
        res.status(201).json({ success: true, data: row });
    }
    catch (error) {
        fail(error, res, next);
    }
});
router.use(pg_errors_js_1.pgErrorHandler);
exports.default = router;
//# sourceMappingURL=registry.js.map