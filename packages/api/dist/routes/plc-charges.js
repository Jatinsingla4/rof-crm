"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.plcAmount = void 0;
/**
 * Preferred Location Charges (PLC). A rate for each unit location of a project (flat, or per sq ft of carpet area) and the
 * location of each unit. Booking asks /quote for the amount to offer; the booking keeps the amount it was given.
 */
const express_1 = require("express");
const index_js_1 = require("../index.js");
const rbac_js_1 = require("../middleware/rbac.js");
const auditLogger_js_1 = require("../middleware/auditLogger.js");
const unitStatusAccess_js_1 = require("../middleware/unitStatusAccess.js");
const unit_grant_js_1 = require("../utils/unit-grant.js");
const input_js_1 = require("../utils/input.js");
const router = (0, express_1.Router)();
// Reading is open (the booking form asks for a quote); any change needs the Set Master permission
router.use((req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD')
        return next();
    const action = req.method === 'POST' ? 'create' : req.method === 'DELETE' ? 'delete' : 'edit';
    if ((0, rbac_js_1.hasPermission)(req.userRole, 'master_data', action))
        return next();
    res.status(403).json({ error: 'You do not have permission to change PLC charges' });
});
const fail = (err, res, next) => (0, input_js_1.failWith)(err, res, next, 'This location already has a PLC rate');
const one = async (c, sql, p) => (await c.query(sql, p)).rows[0];
const rateInput = (b, cur) => {
    const rateType = (0, input_js_1.has)(b.rateType) ? b.rateType : cur ? cur.rate_type : 'per_sqft';
    if (rateType !== 'flat' && rateType !== 'per_sqft')
        throw (0, input_js_1.bad)('Rate type must be flat or per_sqft');
    const value = (0, input_js_1.has)(b.rateValue) ? (0, input_js_1.num)(b.rateValue, 'Rate', 100000000, 2) : cur ? Number(cur.rate_value) : NaN;
    if (!Number.isFinite(value) || value <= 0)
        throw (0, input_js_1.bad)('Rate must be more than 0');
    return { rateType, value };
};
const plcAmount = (rateType, value, carpet) => (rateType === 'flat' ? (0, input_js_1.r2)(value) : (0, input_js_1.r2)(value * (carpet || 0)));
exports.plcAmount = plcAmount;
// GET /api/plc-charges?projectId= : the rates of a project, with the number of units at each location
router.get('/', async (req, res, next) => {
    try {
        const projectId = (0, input_js_1.uuid)(req.query.projectId, 'projectId');
        const rows = (await index_js_1.db.query(`SELECT pc.id, pc.project_id, pc.unit_location_id, ul.name AS location_name, pc.rate_type, pc.rate_value, pc.is_active,
              (SELECT count(*)::int FROM units u WHERE u.unit_location_id = pc.unit_location_id) AS unit_count
         FROM plc_charges pc JOIN unit_locations ul ON ul.id = pc.unit_location_id
        WHERE pc.project_id = $1 ORDER BY ul.name`, [projectId])).rows;
        res.json({ success: true, data: rows });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// GET /api/plc-charges/units?projectId=&locationId= : units of the project with their location (for the assign screen)
// The unit-status grant applies (owner-approved U-P): only the units the login's grant covers are listed (none: no unit).
router.get('/units', unitStatusAccess_js_1.applyUnitStatusFilter, async (req, res, next) => {
    try {
        const projectId = (0, input_js_1.uuid)(req.query.projectId, 'projectId');
        const params = [projectId];
        const grant = (0, unit_grant_js_1.grantClause)(req.unitStatusFilter, 'u.status', params);
        const rows = (await index_js_1.db.query(`SELECT u.id, u.unit_number, t.tower_name, u.floor, u.status::text AS status, u.carpet_area_sqft, u.unit_location_id, ul.name AS location_name
         FROM units u JOIN towers t ON t.id = u.tower_id LEFT JOIN unit_locations ul ON ul.id = u.unit_location_id
        WHERE u.project_id = $1${grant} ORDER BY t.tower_name, u.floor, u.unit_number LIMIT 5000`, params)).rows;
        res.json({ success: true, data: rows });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// GET /api/plc-charges/quote?unitId= : the PLC to offer for a unit (0 when its location has no active rate)
router.get('/quote', async (req, res, next) => {
    try {
        const unitId = (0, input_js_1.uuid)(req.query.unitId, 'unitId');
        const row = await one(index_js_1.db, `SELECT u.carpet_area_sqft, ul.name AS location_name, pc.rate_type, pc.rate_value
         FROM units u LEFT JOIN unit_locations ul ON ul.id = u.unit_location_id
         LEFT JOIN plc_charges pc ON pc.unit_location_id = u.unit_location_id AND pc.is_active
        WHERE u.id = $1`, [unitId]);
        if (!row)
            throw (0, input_js_1.bad)('Unit not found', 404);
        if (!row.rate_type)
            return res.json({ success: true, data: { amount: 0, location: row.location_name || null, basis: null } });
        const amount = (0, exports.plcAmount)(row.rate_type, Number(row.rate_value), row.carpet_area_sqft == null ? null : Number(row.carpet_area_sqft));
        res.json({ success: true, data: { amount, location: row.location_name, basis: row.rate_type === 'flat' ? 'flat' : `${Number(row.rate_value)} per sq ft` } });
    }
    catch (err) {
        fail(err, res, next);
    }
});
router.post('/', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        const projectId = (0, input_js_1.uuid)(b.projectId, 'projectId'), locationId = (0, input_js_1.uuid)(b.unitLocationId, 'unitLocationId');
        const f = rateInput(b);
        const made = await (0, input_js_1.inTx)(async (c) => {
            if (!(await one(c, `SELECT 1 AS x FROM unit_locations WHERE id = $1 AND project_id = $2`, [locationId, projectId])))
                throw (0, input_js_1.bad)('That location does not belong to this project');
            await c.query(`SELECT pg_advisory_xact_lock(hashtext('plc|' || $1))`, [locationId]);
            if (await one(c, `SELECT 1 AS x FROM plc_charges WHERE unit_location_id = $1`, [locationId]))
                throw (0, input_js_1.bad)('This location already has a PLC rate. Edit it instead.');
            return (await c.query(`INSERT INTO plc_charges (project_id, unit_location_id, rate_type, rate_value, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *`, [projectId, locationId, f.rateType, f.value, req.userId || null])).rows[0];
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'plc_charge', made.id, undefined, made);
        res.status(201).json({ success: true, data: made });
    }
    catch (err) {
        fail(err, res, next);
    }
});
router.patch('/:id', async (req, res, next) => {
    try {
        const pid = (0, input_js_1.uuid)(req.params.id, 'PLC id');
        const b = (0, input_js_1.body)(req);
        const active = (0, input_js_1.flag)(b.isActive, 'isActive');
        const out = await (0, input_js_1.inTx)(async (c) => {
            const cur = await one(c, `SELECT * FROM plc_charges WHERE id = $1 FOR UPDATE`, [pid]);
            if (!cur)
                throw (0, input_js_1.bad)('PLC rate not found', 404);
            const f = rateInput(b, cur);
            const upd = (await c.query(`UPDATE plc_charges SET rate_type = $2, rate_value = $3, is_active = $4, updated_at = now() WHERE id = $1 RETURNING *`, [pid, f.rateType, f.value, active ?? cur.is_active])).rows[0];
            return { cur, upd };
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'plc_charge', pid, out.cur, out.upd);
        res.json({ success: true, data: out.upd });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// A rate is removed for good; units keep their location, and bookings already made keep the amount they were given
router.delete('/:id', async (req, res, next) => {
    try {
        const pid = (0, input_js_1.uuid)(req.params.id, 'PLC id');
        const gone = (await index_js_1.db.query(`DELETE FROM plc_charges WHERE id = $1 RETURNING *`, [pid])).rows[0];
        if (!gone)
            throw (0, input_js_1.bad)('PLC rate not found', 404);
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'delete', 'plc_charge', pid, gone, undefined);
        res.json({ success: true });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// POST /api/plc-charges/assign { projectId, unitLocationId | null, unitIds: [] } : set (or clear) the location of many units
router.post('/assign', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        const projectId = (0, input_js_1.uuid)(b.projectId, 'projectId');
        const locationId = b.unitLocationId === null ? null : (0, input_js_1.uuid)(b.unitLocationId, 'unitLocationId');
        if (!Array.isArray(b.unitIds) || !b.unitIds.length)
            throw (0, input_js_1.bad)('Choose at least one unit');
        if (b.unitIds.length > 2000)
            throw (0, input_js_1.bad)('Choose at most 2000 units at a time');
        const ids = [...new Set(b.unitIds.map((x) => (0, input_js_1.uuid)(x, 'A unit id')))];
        const out = await (0, input_js_1.inTx)(async (c) => {
            if (locationId && !(await one(c, `SELECT 1 AS x FROM unit_locations WHERE id = $1 AND project_id = $2`, [locationId, projectId])))
                throw (0, input_js_1.bad)('That location does not belong to this project');
            const ok = (await c.query(`SELECT id FROM units WHERE project_id = $1 AND id = ANY($2::uuid[])`, [projectId, ids])).rows.length;
            if (ok !== ids.length)
                throw (0, input_js_1.bad)('Some of these units are not in this project');
            await c.query(`UPDATE units SET unit_location_id = $3, updated_at = now() WHERE project_id = $1 AND id = ANY($2::uuid[])`, [projectId, ids, locationId]);
            return ids.length;
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'plc_assignment', projectId, undefined, { unit_location_id: locationId, units: out });
        res.json({ success: true, data: { updated: out } });
    }
    catch (err) {
        fail(err, res, next);
    }
});
exports.default = router;
//# sourceMappingURL=plc-charges.js.map