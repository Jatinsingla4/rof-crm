"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_js_1 = require("../index.js");
const router = (0, express_1.Router)();
/**
 * POST /api/transfers - Initiate Ownership Transfer
 * Steps:
 * 1. Validate both consumers and unit.
 * 2. Update unit ownership in consumers table.
 * 3. Update allocation record.
 * 4. Log the transfer.
 */
router.post('/', async (req, res, next) => {
    const client = await index_js_1.db.connect();
    try {
        const { unitId, oldConsumerId, newConsumerId, transferFee, adminCharges, remarks } = req.body;
        if (!unitId || !oldConsumerId || !newConsumerId) {
            return res.status(400).json({ error: 'unitId, oldConsumerId, and newConsumerId are required' });
        }
        await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
        // 1. Verify old consumer owns the unit
        const unitRes = await client.query(`SELECT allocated_unit_id FROM consumers WHERE id = $1`, [oldConsumerId]);
        if (unitRes.rows.length === 0 || unitRes.rows[0].allocated_unit_id !== unitId) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Old consumer does not own this unit' });
        }
        // 2. Clear old consumer's allocation
        await client.query(`UPDATE consumers SET allocated_unit_id = NULL, lead_stage = 'transferred' WHERE id = $1`, [oldConsumerId]);
        // 3. Assign unit to new consumer
        await client.query(`UPDATE consumers SET allocated_unit_id = $1, lead_stage = 'allotted' WHERE id = $2`, [unitId, newConsumerId]);
        // 4. Update the allocation record status
        await client.query(`UPDATE allocations SET status = 'transferred' WHERE unit_id = $1 AND consumer_id = $2`, [unitId, oldConsumerId]);
        // 5. Create new allocation record for new consumer
        await client.query(`INSERT INTO allocations (consumer_id, unit_id, project_id, status, created_by_user_id)
       SELECT $1, $2, project_id, 'allotted', $3 FROM units WHERE id = $2`, [newConsumerId, unitId, req.userId]);
        // 6. Log the transfer event
        const transferRes = await client.query(`INSERT INTO ownership_transfers (unit_id, old_consumer_id, new_consumer_id, transfer_fee_inr, admin_charges_inr, transfer_remarks, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`, [unitId, oldConsumerId, newConsumerId, transferFee || 0, adminCharges || 0, remarks || null, req.userId]);
        await client.query('COMMIT');
        res.status(201).json({ success: true, data: transferRes.rows[0] });
    }
    catch (error) {
        await client.query('ROLLBACK');
        next(error);
    }
    finally {
        client.release();
    }
});
/**
 * GET /api/transfers/history/:unitId - Get ownership history for a unit
 */
router.get('/history/:unitId', async (req, res, next) => {
    try {
        const { unitId } = req.params;
        const result = await index_js_1.db.query(`SELECT t.*, 
              oc.name as old_consumer_name, nc.name as new_consumer_name,
              u.unit_number
       FROM ownership_transfers t
       JOIN consumers oc ON t.old_consumer_id = oc.id
       JOIN consumers nc ON t.new_consumer_id = nc.id
       JOIN units u ON t.unit_id = u.id
       WHERE t.unit_id = $1
       ORDER BY t.transfer_date DESC`, [unitId]);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=transfers.js.map