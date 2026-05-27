"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Inventory Hold Routes (Governance)
 */
const express_1 = require("express");
const index_js_1 = require("../index.js");
const router = (0, express_1.Router)();
// GET /api/inventory-hold
router.get('/', async (req, res, next) => {
    try {
        const { status = 'active' } = req.query;
        let query = `
      SELECT uh.*, u.unit_number, u.bhk_type, u.floor, t.tower_name, p.name as project_name, b.firm_name as broker_firm_name
      FROM unit_holds uh
      JOIN units u ON uh.unit_id = u.id
      JOIN towers t ON u.tower_id = t.id
      JOIN projects p ON u.project_id = p.id
      JOIN brokers b ON uh.broker_id = b.id
    `;
        const params = [];
        if (status && status !== 'all') {
            query += ` WHERE uh.status = $1`;
            params.push(status);
        }
        query += ` ORDER BY uh.held_at DESC`;
        const result = await index_js_1.db.query(query, params);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/inventory-hold
router.post('/', async (req, res, next) => {
    try {
        const { unitId, brokerId, clientName, clientMobile, holdHours = 24, notes } = req.body;
        if (!unitId || !brokerId)
            return res.status(400).json({ error: 'unitId and brokerId are required' });
        // Begin transaction
        await index_js_1.db.query('BEGIN');
        // Check if unit is available
        const unitRes = await index_js_1.db.query(`SELECT status FROM units WHERE id = $1 FOR UPDATE`, [unitId]);
        if (unitRes.rows.length === 0) {
            await index_js_1.db.query('ROLLBACK');
            return res.status(404).json({ error: 'Unit not found' });
        }
        if (unitRes.rows[0].status !== 'available') {
            await index_js_1.db.query('ROLLBACK');
            return res.status(400).json({ error: `Unit cannot be held. Current status: ${unitRes.rows[0].status}` });
        }
        // Insert hold
        const holdRes = await index_js_1.db.query(`INSERT INTO unit_holds (unit_id, broker_id, client_name, client_mobile, expires_at, status, notes, created_by)
       VALUES ($1, $2, $3, $4, NOW() + interval '1 hour' * $5, 'active', $6, $7)
       RETURNING *`, [unitId, brokerId, clientName, clientMobile, holdHours, notes, req.userId]);
        // Update unit status
        await index_js_1.db.query(`UPDATE units SET status = 'held', status_changed_at = NOW() WHERE id = $1`, [unitId]);
        // Insert history
        await index_js_1.db.query(`INSERT INTO unit_status_history (unit_id, previous_status, new_status, changed_by_user_id, reason)
       VALUES ($1, 'available', 'held', $2, 'Unit held by broker')`, [unitId, req.userId]);
        await index_js_1.db.query('COMMIT');
        res.status(201).json({ success: true, data: holdRes.rows[0] });
    }
    catch (error) {
        await index_js_1.db.query('ROLLBACK');
        next(error);
    }
});
// POST /api/inventory-hold/:id/unhold
router.post('/:id/unhold', async (req, res, next) => {
    try {
        const { id } = req.params;
        await index_js_1.db.query('BEGIN');
        const holdRes = await index_js_1.db.query(`SELECT unit_id, status FROM unit_holds WHERE id = $1 FOR UPDATE`, [id]);
        if (holdRes.rows.length === 0) {
            await index_js_1.db.query('ROLLBACK');
            return res.status(404).json({ error: 'Hold record not found' });
        }
        if (holdRes.rows[0].status !== 'active') {
            await index_js_1.db.query('ROLLBACK');
            return res.status(400).json({ error: 'Hold is not active' });
        }
        const unitId = holdRes.rows[0].unit_id;
        // Release hold
        await index_js_1.db.query(`UPDATE unit_holds SET status = 'cancelled' WHERE id = $1`, [id]);
        // Update unit status back to available
        await index_js_1.db.query(`UPDATE units SET status = 'available', status_changed_at = NOW() WHERE id = $1`, [unitId]);
        // Insert history
        await index_js_1.db.query(`INSERT INTO unit_status_history (unit_id, previous_status, new_status, changed_by_user_id, reason)
       VALUES ($1, 'held', 'available', $2, 'Hold manually cancelled')`, [unitId, req.userId]);
        await index_js_1.db.query('COMMIT');
        res.json({ success: true, message: 'Unit hold cancelled and unit is now available' });
    }
    catch (error) {
        await index_js_1.db.query('ROLLBACK');
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=inventory_hold.js.map