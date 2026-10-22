"use strict";
/**
 * Parking Routes
 * Parking slot inventory, allotment, release, the price list per type, and reporting
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_js_1 = require("../index.js");
const input_js_1 = require("../utils/input.js");
const router = (0, express_1.Router)();
const TYPES = ['covered', 'open', 'stilt', 'ev', 'visitor'];
const STATUS = ['available', 'allotted'];
// Who may be given a slot: a customer who holds a unit
const HOLDERS = ['allotted', 'onboarded'];
const floorOf = (v) => {
    if (!(0, input_js_1.has)(v))
        return 0;
    const n = typeof v === 'number' ? v : typeof v === 'string' && /^-?\d{1,3}$/.test(v) ? Number(v) : NaN;
    if (!Number.isInteger(n) || n < -10 || n > 200)
        throw (0, input_js_1.bad)('Floor must be a whole number from -10 to 200');
    return n;
};
const slotNo = (v) => (0, input_js_1.text)(v, 'Slot number', 50, true);
const projectOf = async (c, id) => {
    if (!(await c.query(`SELECT 1 FROM projects WHERE id = $1`, [id])).rows.length)
        throw (0, input_js_1.bad)('Project not found', 404);
};
// The price list entry for a type in a project, when there is one
const priceFor = async (c, projectId, type) => (await c.query(`SELECT price_inr FROM parking_prices WHERE project_id = $1 AND parking_type = $2`, [projectId, type])).rows[0]?.price_inr;
// A customer and unit that may take a slot of this project
const holder = async (c, projectId, consumerId, unitId) => {
    const r = await c.query(`SELECT id, lead_stage, allocated_unit_id FROM consumers WHERE id = $1 AND project_id = $2`, [consumerId, projectId]);
    if (!r.rows.length)
        throw (0, input_js_1.bad)('This customer is not in this project', 404);
    if (!HOLDERS.includes(r.rows[0].lead_stage))
        throw (0, input_js_1.bad)('Parking can only be given to a customer who has been allotted a unit', 409);
    if (unitId && r.rows[0].allocated_unit_id !== unitId)
        throw (0, input_js_1.bad)('That unit is not the unit of this customer', 409);
    return r.rows[0];
};
const LIST = `SELECT ps.id, ps.project_id, p.name as project_name,
             ps.slot_number, ps.parking_type, ps.floor, ps.status,
             ps.amount_inr, ps.allotted_at,
             ps.allotted_to_consumer_id, c.name as consumer_name, c.mobile as consumer_mobile,
             ps.allotted_unit_id, u.unit_number
      FROM parking_slots ps
      LEFT JOIN projects p ON ps.project_id = p.id
      LEFT JOIN consumers c ON ps.allotted_to_consumer_id = c.id
      LEFT JOIN units u ON ps.allotted_unit_id = u.id`;
// GET /api/parking
router.get('/', async (req, res, next) => {
    try {
        const q = req.query;
        const projectId = (0, input_js_1.has)(q.projectId) ? (0, input_js_1.uuid)(q.projectId, 'projectId') : null;
        const status = (0, input_js_1.oneOf)(q.status, 'status', STATUS), parkingType = (0, input_js_1.oneOf)(q.parkingType, 'parkingType', TYPES);
        const { size, offset } = (0, input_js_1.paging)(q, 200, 1000);
        const params = [];
        let where = '';
        if (projectId) {
            params.push(projectId);
            where += ` AND ps.project_id = $${params.length}`;
        }
        if (status) {
            params.push(status);
            where += ` AND ps.status = $${params.length}`;
        }
        if (parkingType) {
            params.push(parkingType);
            where += ` AND ps.parking_type = $${params.length}`;
        }
        params.push(size, offset);
        const result = await index_js_1.db.query(`${LIST} WHERE 1=1${where} ORDER BY ps.slot_number, ps.id LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// POST /api/parking — create a slot, and allot it when a customer is given
router.post('/', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        const projectId = (0, input_js_1.uuid)(b.projectId, 'projectId'), slotNumber = slotNo(b.slotNumber);
        const parkingType = (0, input_js_1.has)(b.parkingType) ? (0, input_js_1.oneOf)(b.parkingType, 'parkingType', TYPES) : 'covered';
        const floor = floorOf(b.floor);
        const consumerId = (0, input_js_1.has)(b.consumerId) ? (0, input_js_1.uuid)(b.consumerId, 'consumerId') : null;
        const unitId = (0, input_js_1.has)(b.unitId) ? (0, input_js_1.uuid)(b.unitId, 'unitId') : null;
        if (unitId && !consumerId)
            throw (0, input_js_1.bad)('A unit can only be given together with a customer');
        const given = (0, input_js_1.has)(b.amount) ? (0, input_js_1.num)(b.amount, 'Amount', 1000000000, 2) : null;
        const row = await (0, input_js_1.inTx)(async (c) => {
            await projectOf(c, projectId);
            await (0, input_js_1.lock)(c, `parking:${projectId}:${slotNumber}`);
            if (consumerId)
                await holder(c, projectId, consumerId, unitId);
            if (unitId && !(await c.query(`SELECT 1 FROM units WHERE id = $1 AND project_id = $2`, [unitId, projectId])).rows.length)
                throw (0, input_js_1.bad)('That unit is not in this project', 404);
            const old = (await c.query(`SELECT id, status FROM parking_slots WHERE project_id = $1 AND slot_number = $2 FOR UPDATE`, [projectId, slotNumber])).rows[0];
            if (old && !consumerId)
                throw (0, input_js_1.bad)(`Slot ${slotNumber} already exists in this project`, 409);
            if (old && old.status === 'allotted')
                throw (0, input_js_1.bad)(`Slot ${slotNumber} is already allotted. Release it first.`, 409);
            const amount = given ?? (await priceFor(c, projectId, parkingType)) ?? 0;
            if (old) {
                return (await c.query(`UPDATE parking_slots SET status = 'allotted', allotted_to_consumer_id = $2, allotted_unit_id = $3, allotted_at = NOW(), amount_inr = COALESCE($4, amount_inr)
            WHERE id = $1 RETURNING id, slot_number, parking_type, status, allotted_at`, [old.id, consumerId, unitId, given])).rows[0];
            }
            return (await c.query(`INSERT INTO parking_slots (project_id, slot_number, parking_type, floor, status, allotted_to_consumer_id, allotted_unit_id, amount_inr, allotted_at, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CASE WHEN $6::UUID IS NOT NULL THEN NOW() END, $9)
         RETURNING id, slot_number, parking_type, status, allotted_at`, [projectId, slotNumber, parkingType, floor, consumerId ? 'allotted' : 'available', consumerId, unitId, amount, req.userId])).rows[0];
        });
        res.status(201).json({ success: true, data: row });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next, 'This slot already exists');
    }
});
// POST /api/parking/bulk — slots P001 .. P0NN in one go; numbers that exist are skipped
router.post('/bulk', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        const projectId = (0, input_js_1.uuid)(b.projectId, 'projectId');
        const count = (0, input_js_1.num)(b.count, 'Count', 500, 0);
        if (count < 1)
            throw (0, input_js_1.bad)('Count must be at least 1');
        const from = (0, input_js_1.has)(b.from) ? (0, input_js_1.num)(b.from, 'From', 100000, 0) : 1;
        const prefix = (0, input_js_1.has)(b.prefix) ? (0, input_js_1.text)(b.prefix, 'Prefix', 10, true) : 'P';
        const parkingType = (0, input_js_1.has)(b.parkingType) ? (0, input_js_1.oneOf)(b.parkingType, 'parkingType', TYPES) : 'covered';
        const floor = floorOf(b.floor);
        const given = (0, input_js_1.has)(b.amount) ? (0, input_js_1.num)(b.amount, 'Amount', 1000000000, 2) : null;
        const out = await (0, input_js_1.inTx)(async (c) => {
            await projectOf(c, projectId);
            await (0, input_js_1.lock)(c, `parking-bulk:${projectId}`);
            const amount = given ?? (await priceFor(c, projectId, parkingType)) ?? 0;
            const numbers = Array.from({ length: count }, (_, i) => `${prefix}${String(from + i).padStart(3, '0')}`);
            if (numbers.some((n) => n.length > 50))
                throw (0, input_js_1.bad)('A slot number would be longer than 50 characters');
            const r = await c.query(`INSERT INTO parking_slots (project_id, slot_number, parking_type, floor, status, amount_inr, created_by)
         SELECT $1, n, $3, $4, 'available', $5, $6 FROM unnest($2::text[]) AS n
         ON CONFLICT (project_id, slot_number) DO NOTHING RETURNING id`, [projectId, numbers, parkingType, floor, amount, req.userId]);
            return { requested: count, created: r.rowCount, skipped: count - (r.rowCount || 0), first: numbers[0], last: numbers[numbers.length - 1] };
        });
        res.status(201).json({ success: true, data: out });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// ---- the price list per type and project ----
// GET /api/parking/types
router.get('/types', async (req, res, next) => {
    try {
        const projectId = (0, input_js_1.has)(req.query.projectId) ? (0, input_js_1.uuid)(req.query.projectId, 'projectId') : null;
        const r = await index_js_1.db.query(`SELECT t.id, t.project_id, p.name AS project_name, t.parking_type, t.price_inr, t.description
         FROM parking_prices t JOIN projects p ON p.id = t.project_id
        WHERE ($1::uuid IS NULL OR t.project_id = $1) ORDER BY p.name, t.parking_type`, [projectId]);
        res.json({ success: true, data: r.rows });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// PUT /api/parking/types — one price per type per project (saved again = changed)
router.put('/types', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        const projectId = (0, input_js_1.uuid)(b.projectId, 'projectId'), parkingType = (0, input_js_1.oneOf)(b.parkingType, 'parkingType', TYPES);
        if (!parkingType)
            throw (0, input_js_1.bad)('parkingType is required');
        const price = (0, input_js_1.num)(b.priceInr, 'Price', 1000000000, 2), description = (0, input_js_1.text)(b.description, 'Description', 255, false);
        const row = await (0, input_js_1.inTx)(async (c) => {
            await projectOf(c, projectId);
            return (await c.query(`INSERT INTO parking_prices (project_id, parking_type, price_inr, description, created_by) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (project_id, parking_type) DO UPDATE SET price_inr = EXCLUDED.price_inr, description = EXCLUDED.description, updated_at = NOW()
         RETURNING id, project_id, parking_type, price_inr, description`, [projectId, parkingType, price, description, req.userId])).rows[0];
        });
        res.json({ success: true, data: row });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// DELETE /api/parking/types/:id
router.delete('/types/:id', async (req, res, next) => {
    try {
        const r = await index_js_1.db.query(`DELETE FROM parking_prices WHERE id = $1 RETURNING id`, [(0, input_js_1.uuid)(req.params.id, 'Type id')]);
        if (!r.rows.length)
            return res.status(404).json({ error: 'Price entry not found' });
        res.json({ success: true, data: { id: r.rows[0].id } });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// PATCH /api/parking/:id/release — an allotted slot goes back to available
router.patch('/:id/release', async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Slot id');
        const row = await (0, input_js_1.inTx)(async (c) => {
            const s = (await c.query(`SELECT id, status FROM parking_slots WHERE id = $1 FOR UPDATE`, [id])).rows[0];
            if (!s)
                throw (0, input_js_1.bad)('Slot not found', 404);
            if (s.status !== 'allotted')
                throw (0, input_js_1.bad)('This slot is not allotted', 409);
            return (await c.query(`UPDATE parking_slots SET status = 'available', allotted_to_consumer_id = NULL, allotted_unit_id = NULL, allotted_at = NULL WHERE id = $1
         RETURNING id, slot_number, status`, [id])).rows[0];
        });
        res.json({ success: true, data: row });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// PATCH /api/parking/:id — type, floor or amount of a slot that is not allotted
router.patch('/:id', async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Slot id'), b = (0, input_js_1.body)(req);
        const parkingType = (0, input_js_1.has)(b.parkingType) ? (0, input_js_1.oneOf)(b.parkingType, 'parkingType', TYPES) : null;
        const floor = (0, input_js_1.has)(b.floor) ? floorOf(b.floor) : null;
        const amount = (0, input_js_1.has)(b.amount) ? (0, input_js_1.num)(b.amount, 'Amount', 1000000000, 2) : null;
        if (parkingType === null && floor === null && amount === null)
            throw (0, input_js_1.bad)('Nothing to change');
        const row = await (0, input_js_1.inTx)(async (c) => {
            const s = (await c.query(`SELECT id, status FROM parking_slots WHERE id = $1 FOR UPDATE`, [id])).rows[0];
            if (!s)
                throw (0, input_js_1.bad)('Slot not found', 404);
            if (s.status === 'allotted')
                throw (0, input_js_1.bad)('An allotted slot cannot be changed. Release it first.', 409);
            return (await c.query(`UPDATE parking_slots SET parking_type = COALESCE($2, parking_type), floor = COALESCE($3, floor), amount_inr = COALESCE($4, amount_inr) WHERE id = $1
         RETURNING id, slot_number, parking_type, floor, amount_inr, status`, [id, parkingType, floor, amount])).rows[0];
        });
        res.json({ success: true, data: row });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// DELETE /api/parking/:id — only a slot nobody holds
router.delete('/:id', async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Slot id');
        const r = await index_js_1.db.query(`DELETE FROM parking_slots WHERE id = $1 AND status = 'available' RETURNING id`, [id]);
        if (!r.rows.length) {
            const s = await index_js_1.db.query(`SELECT status FROM parking_slots WHERE id = $1`, [id]);
            if (!s.rows.length)
                return res.status(404).json({ error: 'Slot not found' });
            return res.status(409).json({ error: 'An allotted slot cannot be deleted. Release it first.' });
        }
        res.json({ success: true, data: { id } });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
exports.default = router;
//# sourceMappingURL=parking.js.map