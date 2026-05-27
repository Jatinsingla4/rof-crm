"use strict";
/**
 * Parking Routes
 * Parking slot inventory, allotment, and reporting
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_js_1 = require("../index.js");
const router = (0, express_1.Router)();
// GET /api/parking
router.get('/', async (req, res, next) => {
    try {
        const { projectId, status, parkingType, page = 1, pageSize = 200 } = req.query;
        let query = `
      SELECT ps.id, ps.project_id, p.name as project_name,
             ps.slot_number, ps.parking_type, ps.floor, ps.status,
             ps.amount_inr, ps.allotted_at,
             ps.allotted_to_consumer_id, c.name as consumer_name, c.mobile as consumer_mobile,
             ps.allotted_unit_id, u.unit_number
      FROM parking_slots ps
      LEFT JOIN projects p ON ps.project_id = p.id
      LEFT JOIN consumers c ON ps.allotted_to_consumer_id = c.id
      LEFT JOIN units u ON ps.allotted_unit_id = u.id
      WHERE 1=1`;
        const params = [];
        if (projectId) {
            query += ` AND ps.project_id = $${params.length + 1}`;
            params.push(projectId);
        }
        if (status) {
            query += ` AND ps.status = $${params.length + 1}`;
            params.push(status);
        }
        if (parkingType) {
            query += ` AND ps.parking_type = $${params.length + 1}`;
            params.push(parkingType);
        }
        query += ` ORDER BY ps.slot_number LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
        const result = await index_js_1.db.query(query, params);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/parking — allot or create a parking slot
router.post('/', async (req, res, next) => {
    try {
        const { projectId, consumerId, slotNumber, parkingType = 'covered', amount, unitId, floor = 0 } = req.body;
        if (!projectId || !slotNumber) {
            return res.status(400).json({ error: 'projectId and slotNumber are required' });
        }
        // Upsert: create slot if it doesn't exist, then allot if consumerId provided
        const result = await index_js_1.db.query(`INSERT INTO parking_slots (project_id, slot_number, parking_type, floor, status,
         allotted_to_consumer_id, allotted_unit_id, amount_inr, allotted_at, created_by)
       VALUES ($1, $2, $3, $4,
         CASE WHEN $5::UUID IS NOT NULL THEN 'allotted' ELSE 'available' END,
         $5, $6, $7,
         CASE WHEN $5::UUID IS NOT NULL THEN NOW() ELSE NULL END,
         $8)
       ON CONFLICT (project_id, slot_number) DO UPDATE
         SET status = CASE WHEN $5::UUID IS NOT NULL THEN 'allotted' ELSE parking_slots.status END,
             allotted_to_consumer_id = COALESCE($5, parking_slots.allotted_to_consumer_id),
             allotted_unit_id = COALESCE($6, parking_slots.allotted_unit_id),
             amount_inr = COALESCE($7, parking_slots.amount_inr),
             allotted_at = CASE WHEN $5::UUID IS NOT NULL THEN NOW() ELSE parking_slots.allotted_at END
       RETURNING id, slot_number, parking_type, status, allotted_at`, [projectId, slotNumber, parkingType, floor, consumerId || null, unitId || null,
            amount || 0, req.userId]);
        res.status(201).json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=parking.js.map