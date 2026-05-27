"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_js_1 = require("../index.js");
const router = (0, express_1.Router)();
/**
 * GET /api/registry - List registry status
 */
router.get('/', async (req, res, next) => {
    try {
        const { projectId, status } = req.query;
        let query = `
      SELECT rd.*, c.name as consumer_name, u.unit_number, p.name as project_name
      FROM registry_details rd
      JOIN consumers c ON rd.consumer_id = c.id
      JOIN units u ON rd.unit_id = u.id
      JOIN projects p ON u.project_id = p.id
      WHERE 1=1
    `;
        const params = [];
        if (projectId) {
            query += ` AND u.project_id = $${params.length + 1}`;
            params.push(projectId);
        }
        if (status) {
            query += ` AND rd.status = $${params.length + 1}`;
            params.push(status);
        }
        const result = await index_js_1.db.query(query, params);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/registry/schedule - Schedule Registry
 */
router.post('/schedule', async (req, res, next) => {
    try {
        const { allocationId, appointmentDate, remarks } = req.body;
        // Check if fully paid (Ledger Balance = 0)
        const ledgerRes = await index_js_1.db.query(`SELECT (COALESCE(SUM(amount_due_inr), 0) - (SELECT COALESCE(SUM(amount_received_inr), 0) FROM receipts WHERE consumer_id = a.consumer_id)) as balance
       FROM demands d
       JOIN allocations a ON d.consumer_id = a.consumer_id
       WHERE a.id = $1
       GROUP BY a.consumer_id`, [allocationId]);
        const balance = ledgerRes.rows[0]?.balance || 0;
        if (balance > 0) {
            return res.status(400).json({ error: 'Registry cannot be scheduled until all dues are cleared. Current balance: ' + balance });
        }
        const result = await index_js_1.db.query(`INSERT INTO registry_details (allocation_id, unit_id, consumer_id, appointment_date, remarks, status)
       SELECT id, unit_id, consumer_id, $2, $3, 'scheduled' FROM allocations WHERE id = $1
       RETURNING id, status`, [allocationId, appointmentDate, remarks]);
        res.status(201).json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=registry.js.map