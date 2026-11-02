"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Inventory Hold Routes (Governance)
 * A broker can hold an available unit for a few hours. Rules:
 *  - one active hold per unit (database index), the unit is locked while the hold is made
 *  - the broker has to be active; hold time is a whole number of hours, 1 to 72
 *  - only the person who made a hold, a project manager or a super admin can release it
 *  - a held unit can be booked only by the broker who holds it (the hold becomes 'converted'), or after the hold expired or was released
 */
const express_1 = require("express");
const index_js_1 = require("../index.js");
const input_js_1 = require("../utils/input.js");
const applicant_js_1 = require("../utils/applicant.js");
const holds_js_1 = require("../utils/holds.js");
const broker_js_1 = require("../utils/broker.js");
const auditLogger_js_1 = require("../middleware/auditLogger.js");
const pg_errors_js_1 = require("../middleware/pg-errors.js");
const router = (0, express_1.Router)();
const fail = (e, res, next) => (0, input_js_1.failWith)(e, res, next, 'This unit is already held');
// GET /api/inventory-hold?status=active|expired|converted|cancelled|all
router.get('/', async (req, res, next) => {
    try {
        const status = (0, input_js_1.oneOf)(req.query.status, 'status', ['active', 'expired', 'converted', 'cancelled', 'all']) || 'active';
        const { size, offset } = (0, input_js_1.paging)(req.query, 200, 500);
        await (0, holds_js_1.expireDueHolds)();
        const params = [];
        let where = '';
        if (status !== 'all') {
            params.push(status);
            where = `WHERE uh.status = $1`;
        }
        params.push(size, offset);
        const result = await index_js_1.db.query(`SELECT uh.*, u.unit_number, u.bhk_type, u.floor, t.tower_name, p.name AS project_name, u.project_id,
              b.firm_name AS broker_firm_name, b.name AS broker_name, cu.name AS held_by_name
         FROM unit_holds uh
         JOIN units u ON uh.unit_id = u.id
         JOIN towers t ON u.tower_id = t.id
         JOIN projects p ON u.project_id = p.id
         JOIN brokers b ON uh.broker_id = b.id
         LEFT JOIN users cu ON cu.id = uh.created_by
         ${where}
        ORDER BY uh.held_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// POST /api/inventory-hold
router.post('/', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        const unitId = (0, input_js_1.uuid)(b.unitId, 'unitId'), brokerId = (0, input_js_1.uuid)(b.brokerId, 'brokerId');
        const clientName = (0, input_js_1.text)(b.clientName, 'Client name', 255, false);
        const clientMobile = (0, input_js_1.has)(b.clientMobile) ? (0, applicant_js_1.mobileNo)(b.clientMobile, 'Client mobile') : null;
        const notes = (0, input_js_1.text)(b.notes, 'Notes', 1000, false);
        let hours = 24;
        if ((0, input_js_1.has)(b.holdHours)) {
            const h = typeof b.holdHours === 'number' ? b.holdHours : typeof b.holdHours === 'string' && /^\d+$/.test(b.holdHours) ? Number(b.holdHours) : NaN;
            if (!Number.isInteger(h) || h < 1 || h > 72)
                throw (0, input_js_1.bad)('Hold time must be a whole number of hours from 1 to 72');
            hours = h;
        }
        await (0, holds_js_1.expireDueHolds)();
        const hold = await (0, input_js_1.inTx)(async (c) => {
            const unit = (await c.query(`SELECT id, status, project_id FROM units WHERE id = $1 FOR UPDATE`, [unitId])).rows[0];
            if (!unit)
                throw (0, input_js_1.bad)('Unit not found', 404);
            const brk = (await c.query(`SELECT status FROM brokers WHERE id = $1`, [brokerId])).rows[0];
            if (!brk)
                throw (0, input_js_1.bad)('Broker not found', 404);
            // Broker authentication of the project: Automatic lets a broker nobody has approved yet hold units here; Manual (the default) needs an active broker
            const brokerMode = (await c.query(`SELECT broker_auth_mode FROM project_settings WHERE project_id = $1`, [unit.project_id])).rows[0]?.broker_auth_mode ?? 'Manual';
            if (brk.status !== 'active' && !(brokerMode === 'Automatic' && brk.status === 'pending'))
                throw (0, input_js_1.bad)(`This broker is ${brk.status}, only an active broker can hold a unit`);
            await (0, broker_js_1.mappedOk)(c, brokerId, unit.project_id);
            if (unit.status !== 'available')
                throw (0, input_js_1.bad)(`Unit cannot be held. Current status: ${unit.status}`, 409);
            const h = (await c.query(`INSERT INTO unit_holds (unit_id, broker_id, client_name, client_mobile, expires_at, status, notes, created_by)
         VALUES ($1, $2, $3, $4, NOW() + interval '1 hour' * $5, 'active', $6, $7) RETURNING *`, [unitId, brokerId, clientName, clientMobile, hours, notes, req.userId])).rows[0];
            await c.query(`UPDATE units SET status = 'held', status_changed_at = NOW() WHERE id = $1`, [unitId]);
            await c.query(`INSERT INTO unit_status_history (unit_id, previous_status, new_status, changed_by_user_id, reason) VALUES ($1, 'available', 'held', $2, 'Unit held by broker')`, [unitId, req.userId]);
            return h;
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'unit_hold', hold.id, undefined, { unitId, brokerId, hours });
        res.status(201).json({ success: true, data: hold });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// POST /api/inventory-hold/:id/unhold
router.post('/:id/unhold', async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Hold id');
        await (0, input_js_1.inTx)(async (c) => {
            const h = (await c.query(`SELECT unit_id, status, created_by FROM unit_holds WHERE id = $1`, [id])).rows[0];
            if (!h)
                throw (0, input_js_1.bad)('Hold record not found', 404);
            if (h.status !== 'active')
                throw (0, input_js_1.bad)('Hold is not active', 409);
            const own = h.created_by && h.created_by === req.userId;
            if (!own && !['super_admin', 'project_manager'].includes(req.userRole || ''))
                throw (0, input_js_1.bad)('Only the person who made this hold, a project manager or an admin can release it', 403);
            if (!(await (0, holds_js_1.closeHold)(c, id, 'cancelled', req.userId || null, 'Hold manually cancelled')))
                throw (0, input_js_1.bad)('Hold is not active', 409);
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'unit_hold', id, { status: 'active' }, { status: 'cancelled' });
        res.json({ success: true, message: 'Unit hold cancelled and unit is now available' });
    }
    catch (error) {
        fail(error, res, next);
    }
});
router.use(pg_errors_js_1.pgErrorHandler);
exports.default = router;
//# sourceMappingURL=inventory_hold.js.map