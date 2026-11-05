"use strict";
/**
 * Units Routes - Module A
 * Unit inventory, status management, floor plans, bulk import
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.unitFields = exports.floorNo = void 0;
const express_1 = require("express");
const index_js_1 = require("../index.js");
const unitStatusAccess_js_1 = require("../middleware/unitStatusAccess.js");
const pg_errors_js_1 = require("../middleware/pg-errors.js");
const auditLogger_js_1 = require("../middleware/auditLogger.js");
const unit_type_price_js_1 = require("../utils/unit-type-price.js");
const charge_stock_js_1 = require("../utils/charge-stock.js");
const input_js_1 = require("../utils/input.js");
const business_date_js_1 = require("../utils/business-date.js");
// Facing is one of the eight directions; short codes (N, SE ...) are accepted and stored in full
const FACINGS = ['East', 'West', 'North', 'South', 'North-East', 'South-East', 'North-West', 'South-West'];
const FACING_CODES = { e: 'East', w: 'West', n: 'North', s: 'South', ne: 'North-East', se: 'South-East', nw: 'North-West', sw: 'South-West' };
const facingOf = (v) => {
    const t = (0, input_js_1.text)(v, 'Facing', 30, false);
    if (!t)
        return null;
    const k = t.toLowerCase().replace(/[\s_]+/g, '-');
    const hit = FACINGS.find((f) => f.toLowerCase() === k) || FACING_CODES[k.replace('-', '')];
    if (!hit)
        throw (0, input_js_1.bad)(`Facing must be one of: ${FACINGS.join(', ')}`);
    return hit;
};
const router = (0, express_1.Router)();
const fail = (err, res, next) => (err?.http ? res.status(err.http).json({ error: err.message }) : next(err));
const PRICE_MAX = 100000000000; // ₹ 10,000 crore, the column is a whole-rupee bigint
const AREA_MAX = 1000000;
const floorNo = (v) => {
    const n = typeof v === 'number' ? v : typeof v === 'string' && /^-?\d{1,3}$/.test(v) ? Number(v) : NaN;
    if (!Number.isInteger(n) || n < -5 || n > 300)
        throw (0, input_js_1.bad)('Floor must be a whole number from -5 to 300');
    return n;
};
exports.floorNo = floorNo;
const planUrl = (v) => {
    const u = (0, input_js_1.text)(v, 'Floor plan link', 500, false);
    if (u && !/^https?:\/\/[^\s]+$/i.test(u))
        throw (0, input_js_1.bad)('Floor plan link must start with http:// or https://');
    return u;
};
// One set of rules for a new unit, an edit and a bulk-import row. `cur` is the stored row on edit (unchanged fields keep their value).
const unitFields = (b, cur) => {
    const pick = (k, col, label, max, dec) => (0, input_js_1.has)(b[k]) ? (0, input_js_1.num)(b[k], label, max, dec) : cur ? (cur[col] == null ? null : Number(cur[col])) : null;
    const f = {
        carpet: pick('carpetAreaSqft', 'carpet_area_sqft', 'Carpet area', AREA_MAX, 4), sup: pick('superAreaSqft', 'super_area_sqft', 'Super area', AREA_MAX, 4),
        balcony: pick('balconyAreaSqft', 'balcony_area_sqft', 'Balcony area', AREA_MAX, 4), base: pick('basePriceInr', 'base_price_inr', 'Base price', PRICE_MAX, 0), total: pick('totalPriceInr', 'total_price_inr', 'Total price', PRICE_MAX, 0),
    };
    if (f.carpet !== null && f.sup !== null && f.sup < f.carpet)
        throw (0, input_js_1.bad)('Super area cannot be less than the carpet area');
    if (f.base !== null && f.total !== null && f.total < f.base)
        throw (0, input_js_1.bad)('Total price cannot be less than the base price');
    return f;
};
exports.unitFields = unitFields;
// The charges a unit carries in advance: [{ chargeMasterId, quantity }]. A Mandatory charge is not stored; it goes on every booking by itself.
const chargeList = (v) => {
    if (v === undefined)
        return undefined;
    if (!Array.isArray(v) || v.length > 50)
        throw (0, input_js_1.bad)('charges must be a list of up to 50 charges');
    const seen = new Set();
    return v.map((x) => {
        if (!x || typeof x !== 'object' || Array.isArray(x))
            throw (0, input_js_1.bad)('Each charge needs chargeMasterId and quantity');
        const id = (0, input_js_1.uuid)(x.chargeMasterId, 'chargeMasterId'), q = (0, input_js_1.has)(x.quantity) ? (0, input_js_1.num)(x.quantity, 'Quantity', 20, 0) : 1;
        if (!Number.isInteger(q) || q < 1)
            throw (0, input_js_1.bad)('Quantity must be a whole number from 1 to 20');
        if (seen.has(id))
            throw (0, input_js_1.bad)('A charge is listed twice');
        seen.add(id);
        return { id, q };
    });
};
const saveUnitCharges = async (c, unitId, projectId, list, userId) => {
    const masters = (await c.query('SELECT id, charge_name, is_mandatory, multiple_booking, inventory_base FROM addon_charge_master WHERE project_id = $1 AND is_active AND id = ANY($2::uuid[])', [projectId, list.map(x => x.id)])).rows;
    // a charge with a stock is locked first, so two units cannot take the last piece together
    const stocked = masters.filter((m) => m.inventory_base && !m.is_mandatory).map((m) => m.id);
    await (0, charge_stock_js_1.lockCharges)(c, stocked);
    await c.query('DELETE FROM unit_addon_charges WHERE unit_id = $1', [unitId]);
    for (const x of list) {
        const m = masters.find((r) => r.id === x.id);
        if (!m)
            throw (0, input_js_1.bad)('A charge does not belong to this project or is switched off');
        if (m.is_mandatory)
            continue;
        if (x.q > 1 && !m.multiple_booking)
            throw (0, input_js_1.bad)(`"${m.charge_name}" is not set for multiple booking, so its quantity must be 1`);
        await c.query('INSERT INTO unit_addon_charges (unit_id, charge_master_id, project_id, quantity, created_by) VALUES ($1,$2,$3,$4,$5)', [unitId, x.id, projectId, x.q, userId || null]);
    }
    for (const id of stocked)
        await (0, charge_stock_js_1.requireStock)(c, id);
};
// GET /api/units/:id/charges - what the unit carries in advance, and what every booking adds by itself
// Inventory views (details, counts, summaries, tower maps, area reports): the unit-status grant is loaded here and every view applies it to its own
// query, so a login sees exactly the statuses its grant covers (NULL, unknown or none = no unit, zero counts, empty selectors, 404 on a unit detail).
// '/' loads it itself, '/lookup' ignores it by design, '/:id/charges' is unit set-up and waits for the owner's answer Q-U1.
router.use((req, res, next) => {
    if (req.method !== 'GET' || req.path === '/' || req.path === '/lookup' || /\/charges$/.test(req.path))
        return next();
    return (0, unitStatusAccess_js_1.applyUnitStatusFilter)(req, res, next);
});
// The grant as a SQL clause on a status column: nothing for 'all' and super_admin (null), otherwise the status must be one of the granted ones;
// a grant that was not loaded counts as none (fail closed). The list is pushed as the next parameter.
const grantSql = (req, col, params) => {
    const f = req.unitStatusFilter;
    if (f === null)
        return '';
    params.push(f ?? []);
    return ` AND ${col}::text = ANY($${params.length}::text[])`;
};
const grantCovers = (req, status) => req.unitStatusFilter === null || (Array.isArray(req.unitStatusFilter) && req.unitStatusFilter.includes(String(status)));
router.get('/:id/charges', async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Unit id');
        const u = (await index_js_1.db.query('SELECT project_id FROM units WHERE id = $1', [id])).rows[0];
        if (!u)
            return res.status(404).json({ error: 'Unit not found' });
        const attached = (await index_js_1.db.query('SELECT charge_master_id, quantity FROM unit_addon_charges WHERE unit_id = $1', [id])).rows;
        const mandatory = (await index_js_1.db.query('SELECT id AS charge_master_id, charge_name FROM addon_charge_master WHERE project_id = $1 AND is_active AND is_mandatory ORDER BY charge_name', [u.project_id])).rows;
        res.json({ success: true, data: { attached, mandatory } });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// PUT /api/units/:id/charges  { charges: [{ chargeMasterId, quantity }] } - replaces the list; not after the unit is booked
router.put('/:id/charges', async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Unit id'), list = chargeList((0, input_js_1.body)(req).charges);
        if (!list)
            throw (0, input_js_1.bad)('charges is required');
        const out = await (0, input_js_1.inTx)(async (c) => {
            const u = (await c.query('SELECT project_id, status FROM units WHERE id = $1 FOR UPDATE', [id])).rows[0];
            if (!u)
                throw Object.assign((0, input_js_1.bad)('Unit not found'), { http: 404 });
            if ((u.status !== 'available' && u.status !== 'locked' && u.status !== 'held') || (await c.query(`SELECT 1 FROM booking_records WHERE unit_id = $1 AND COALESCE(status, '') <> 'cancelled' LIMIT 1`, [id])).rows.length)
                throw Object.assign((0, input_js_1.bad)('This unit already has a booking, so its charges can no longer be changed here. Use Set Add-on Charge for the customer.'), { http: 409 });
            await saveUnitCharges(c, id, u.project_id, list, req.userId);
            return list.length;
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'unit_charges', id, undefined, { charges: out });
        res.json({ success: true, data: { saved: out } });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// POST /api/units - Create unit
router.post('/', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        const projectId = (0, input_js_1.uuid)(b.projectId, 'projectId'), towerId = (0, input_js_1.uuid)(b.towerId, 'towerId');
        const unitNumber = (0, input_js_1.text)(b.unitNumber, 'Unit number', 50, true);
        if (!(0, input_js_1.has)(b.floor))
            throw (0, input_js_1.bad)('Floor number is required for each unit');
        const floor = (0, exports.floorNo)(b.floor);
        const facing = facingOf(b.facing), floorPlanUrl = planUrl(b.floorPlanUrl);
        const unitTypeId = (0, input_js_1.has)(b.unitTypeId) ? (0, input_js_1.uuid)(b.unitTypeId, 'unitTypeId') : null;
        const locationId = (0, input_js_1.has)(b.unitLocationId) ? (0, input_js_1.uuid)(b.unitLocationId, 'unitLocationId') : null;
        const charges = chargeList(b.charges);
        // The type is the unit type's name when a unit type is chosen and no type is typed
        const bhkType = (0, input_js_1.has)(b.bhkType) || !unitTypeId ? (0, input_js_1.text)(b.bhkType, 'BHK type', 50, true) : ((await index_js_1.db.query('SELECT name FROM unit_types WHERE id = $1', [unitTypeId])).rows[0]?.name ?? (0, input_js_1.text)(b.bhkType, 'BHK type', 50, true));
        const f = (0, exports.unitFields)(b);
        const tower = await index_js_1.db.query('SELECT 1 FROM towers WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL', [towerId, projectId]);
        if (!tower.rows.length)
            throw (0, input_js_1.bad)('This tower does not belong to the selected project');
        if (unitTypeId && !(await index_js_1.db.query('SELECT 1 FROM unit_types WHERE id = $1 AND project_id = $2', [unitTypeId, projectId])).rows.length)
            throw (0, input_js_1.bad)('This unit type does not belong to the selected project');
        if (locationId && !(await index_js_1.db.query('SELECT 1 FROM unit_locations WHERE id = $1 AND project_id = $2', [locationId, projectId])).rows.length)
            throw (0, input_js_1.bad)('This unit location does not belong to the selected project');
        const client = await index_js_1.db.connect();
        let made;
        try {
            await client.query('BEGIN');
            await client.query(`SELECT pg_advisory_xact_lock(hashtext('unit|' || $1 || '|' || lower($2)))`, [towerId, unitNumber]);
            if ((await client.query('SELECT 1 FROM units WHERE tower_id = $1 AND lower(unit_number) = lower($2)', [towerId, unitNumber])).rows.length) {
                await client.query('ROLLBACK');
                return res.status(409).json({ success: false, error: 'A unit with this number already exists in this tower. Please use a different unit number.' });
            }
            made = (await client.query(`INSERT INTO units (project_id, tower_id, floor, unit_number, bhk_type, carpet_area_sqft, super_area_sqft, balcony_area_sqft,
           base_price_inr, total_price_inr, facing, floor_plan_url, status, created_by_user_id, unit_type_id, unit_location_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'available',$13,$14,$15)
         RETURNING id, unit_number, bhk_type, status, total_price_inr, created_at`, [projectId, towerId, floor, unitNumber, bhkType, f.carpet, f.sup, f.balcony || null, f.base, f.total, facing, floorPlanUrl, req.userId, unitTypeId, locationId])).rows[0];
            if (charges?.length)
                await saveUnitCharges(client, made.id, projectId, charges, req.userId);
            await client.query('COMMIT');
        }
        catch (e) {
            await client.query('ROLLBACK').catch(() => { });
            throw e;
        }
        finally {
            client.release();
        }
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'unit', made.id, undefined, made);
        res.status(201).json({ success: true, data: made });
    }
    catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ success: false, error: 'A unit with this number already exists in this tower. Please use a different unit number.' });
        }
        fail(error, res, next);
    }
});
// GET /api/units - List units with filters
// '/lookup' is the same list for screens that are not inventory screens (documents, applicant forms): it follows project scope and the module
// permission but ignores the inventory grant, so a sold unit can still be found for its own paperwork. '/' follows the grant.
const listUnits = async (req, res, next) => {
    try {
        const { projectId, towerId, status, bhkType, consumerName, registrationNo } = req.query;
        // Paging is a number we check ourselves (it used to be pasted into the SQL text)
        const intParam = (v, label, dflt, min, max) => {
            if (v === undefined || v === '')
                return dflt;
            const n = typeof v === 'string' && /^\d{1,6}$/.test(v) ? Number(v) : NaN;
            if (!Number.isInteger(n) || n < min || n > max)
                throw (0, input_js_1.bad)(`${label} must be a whole number from ${min} to ${max}`);
            return n;
        };
        const page = intParam(req.query.page, 'page', 1, 1, 100000), pageSize = intParam(req.query.pageSize, 'pageSize', 200, 1, 1000);
        for (const [k, v] of Object.entries({ projectId, towerId, status, bhkType, consumerName, registrationNo }))
            if (v !== undefined && typeof v !== 'string')
                throw (0, input_js_1.bad)(`${k} must be given once`);
        const innerParams = [];
        let innerWhere = `WHERE 1=1`;
        if (projectId) {
            innerParams.push(projectId);
            innerWhere += ` AND u.project_id = $${innerParams.length}`;
        }
        if (towerId) {
            innerParams.push(towerId);
            innerWhere += ` AND u.tower_id = $${innerParams.length}`;
        }
        if (status) {
            innerParams.push(status);
            innerWhere += ` AND u.status::text = $${innerParams.length}`;
        }
        if (bhkType && bhkType !== 'any') {
            // Pattern matching: frontend sends "3BHK", database has "Type-A (3 BHK)"
            const bhkStr = String(bhkType);
            innerParams.push(bhkStr);
            innerParams.push(`%${bhkStr.replace(/(\d)(BHK)/i, '$1 $2')}%`);
            innerWhere += ` AND (u.bhk_type = $${innerParams.length - 1} OR u.bhk_type ILIKE $${innerParams.length})`;
        }
        if (consumerName) {
            innerParams.push(`%${consumerName}%`);
            const idx = innerParams.length;
            innerWhere += ` AND (c.first_name ILIKE $${idx} OR c.last_name ILIKE $${idx})`;
        }
        if (registrationNo) {
            innerParams.push(`%${registrationNo}%`);
            innerWhere += ` AND c.registration_no ILIKE $${innerParams.length}`;
        }
        if (req.unitStatusFilter !== null && req.unitStatusFilter !== undefined) {
            // 'none' is an empty list: the inventory screen shows no unit at all (an empty IN () would be a syntax error)
            if (!req.unitStatusFilter.length)
                innerWhere += ' AND FALSE';
            else {
                const placeholders = req.unitStatusFilter.map((_, i) => `$${innerParams.length + i + 1}`).join(', ');
                innerWhere += ` AND u.status::text IN (${placeholders})`;
                innerParams.push(...req.unitStatusFilter);
            }
        }
        const innerQuery = `
      SELECT DISTINCT ON (u.id)
        u.id, u.project_id, p.name as project_name,
        u.tower_id, t.tower_name, t.tower_name AS tower,
        u.floor, u.unit_number, u.bhk_type, u.unit_type_id,
        u.carpet_area_sqft, u.super_area_sqft, u.total_price_inr,
        u.base_price_inr, u.facing, u.status, u.created_at,
        u.balcony_area_sqft, u.balcony_rate_inr_sqft, u.balcony_rate_cap_inr,
        u.registry_date,
        u.hold_status,
        u.status_changed_at,
        c.id AS consumer_id,
        NULLIF(TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')), '') AS consumer_name,
        c.registration_no,
        a.allotment_date,
        CASE WHEN c.id IS NOT NULL
          THEN COALESCE(bk.firm_name, bk.name, 'Direct')
          ELSE NULL
        END AS broker_name,
        (SELECT br_u.booking_date FROM booking_records br_u
         WHERE br_u.unit_id = u.id ORDER BY br_u.created_at DESC LIMIT 1) AS booking_date,
        (SELECT uh.client_name FROM unit_holds uh
         WHERE uh.unit_id = u.id AND uh.status = 'active' LIMIT 1) AS hold_client,
        (SELECT uh.expires_at FROM unit_holds uh
         WHERE uh.unit_id = u.id AND uh.status = 'active' LIMIT 1) AS hold_expires_at,
        (SELECT COALESCE(NULLIF(ut.group_name, ''), ut.name) FROM unit_types ut
         WHERE ut.id = u.unit_type_id LIMIT 1) AS unit_group,
        (SELECT ul.name FROM unit_locations ul WHERE ul.id = u.unit_location_id) AS location_name,
        (SELECT f.floor_name FROM floors f WHERE f.tower_id = u.tower_id AND f.floor_number = u.floor) AS floor_name
      FROM units u
      JOIN towers t ON u.tower_id = t.id
      JOIN projects p ON u.project_id = p.id
      LEFT JOIN allocations a ON a.unit_id = u.id AND a.status = 'allotted'
      LEFT JOIN consumers c ON c.id = a.consumer_id
      LEFT JOIN LATERAL (
        SELECT br2.main_broker_id FROM booking_records br2
        WHERE br2.consumer_id = c.id ORDER BY br2.created_at DESC LIMIT 1
      ) br ON true
      LEFT JOIN brokers bk ON bk.id = br.main_broker_id
      ${innerWhere}
      ORDER BY u.id, a.allotment_date DESC NULLS LAST
    `;
        innerParams.push(pageSize, (page - 1) * pageSize);
        const query = `SELECT * FROM (${innerQuery}) sub ORDER BY sub.tower_name, sub.floor, sub.unit_number LIMIT $${innerParams.length - 1} OFFSET $${innerParams.length}`;
        const result = await index_js_1.db.query(query, innerParams);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        fail(error, res, next);
    }
};
router.get('/', unitStatusAccess_js_1.applyUnitStatusFilter, listUnits);
router.get('/lookup', (req, _res, next) => { req.unitStatusFilter = null; next(); }, listUnits);
// GET /api/units/tower/:projectId - Tower-wise breakdown
router.get('/tower/:projectId', async (req, res, next) => {
    try {
        const { projectId } = req.params;
        const tp = [projectId];
        const grant = grantSql(req, 'u.status', tp);
        const result = await index_js_1.db.query(`SELECT
        t.id as tower_id,
        t.tower_name,
        COUNT(*) as total_units,
        ROUND(SUM(u.carpet_area_sqft)::numeric, 4) as total_area,
        COUNT(CASE WHEN u.status = 'available' THEN 1 END) as available_count,
        ROUND(SUM(CASE WHEN u.status = 'available' THEN u.carpet_area_sqft ELSE 0 END)::numeric, 4) as available_area,
        COUNT(CASE WHEN u.status IN ('application_received','draw_pending','booked') THEN 1 END) as booked_count,
        ROUND(SUM(CASE WHEN u.status IN ('application_received','draw_pending','booked') THEN u.carpet_area_sqft ELSE 0 END)::numeric, 4) as booked_area,
        COUNT(CASE WHEN u.status IN ('allotted','agreement_signed','under_construction','oc_received','possession_handed_over') THEN 1 END) as allotted_count,
        ROUND(SUM(CASE WHEN u.status IN ('allotted','agreement_signed','under_construction','oc_received','possession_handed_over') THEN u.carpet_area_sqft ELSE 0 END)::numeric, 4) as allotted_area,
        COUNT(CASE WHEN u.status IN ('locked','held') THEN 1 END) as hold_count,
        ROUND(SUM(CASE WHEN u.status IN ('locked','held') THEN u.carpet_area_sqft ELSE 0 END)::numeric, 4) as hold_area,
        COUNT(CASE WHEN u.status = 'temp_surrender' THEN 1 END) as temp_surrender_count,
        ROUND(SUM(CASE WHEN u.status = 'temp_surrender' THEN u.carpet_area_sqft ELSE 0 END)::numeric, 4) as temp_surrender_area,
        COALESCE(SUM(r_total.received), 0) as received_amount
       FROM units u
       JOIN towers t ON u.tower_id = t.id
       LEFT JOIN LATERAL (
         -- money against THIS unit: receipts on its payment plan; a receipt with no plan counts only when the customer has one unit
         SELECT COALESCE(SUM(r.amount_received_inr), 0) as received
         FROM receipts r
         WHERE COALESCE(r.status, '') NOT IN ('cancelled', 'bounced')
           AND (r.payment_plan_id IN (SELECT pp.id FROM payment_plans pp WHERE pp.unit_id = u.id)
                OR (r.payment_plan_id IS NULL
                    AND r.consumer_id IN (SELECT a.consumer_id FROM allocations a WHERE a.unit_id = u.id AND a.status = 'allotted')
                    AND (SELECT count(*) FROM allocations a2 WHERE a2.consumer_id = r.consumer_id AND a2.status = 'allotted') = 1))
       ) r_total ON true
       WHERE u.project_id = $1${grant}
       GROUP BY t.id, t.tower_name
       ORDER BY t.tower_name ASC`, tp);
        const towers = result.rows;
        const totals = towers.reduce((acc, t) => {
            acc.total_units += parseInt(t.total_units) || 0;
            acc.total_area += parseFloat(t.total_area) || 0;
            acc.available_count += parseInt(t.available_count) || 0;
            acc.available_area += parseFloat(t.available_area) || 0;
            acc.booked_count += parseInt(t.booked_count) || 0;
            acc.booked_area += parseFloat(t.booked_area) || 0;
            acc.allotted_count += parseInt(t.allotted_count) || 0;
            acc.allotted_area += parseFloat(t.allotted_area) || 0;
            acc.hold_count += parseInt(t.hold_count) || 0;
            acc.hold_area += parseFloat(t.hold_area) || 0;
            acc.temp_surrender_count += parseInt(t.temp_surrender_count) || 0;
            acc.temp_surrender_area += parseFloat(t.temp_surrender_area) || 0;
            acc.received_amount += parseFloat(t.received_amount) || 0;
            return acc;
        }, { total_units: 0, total_area: 0, available_count: 0, available_area: 0,
            booked_count: 0, booked_area: 0, allotted_count: 0, allotted_area: 0,
            hold_count: 0, hold_area: 0, temp_surrender_count: 0, temp_surrender_area: 0,
            received_amount: 0 });
        totals.unmapped_count = totals.total_units - (totals.available_count + totals.booked_count + totals.allotted_count +
            totals.hold_count + totals.temp_surrender_count);
        res.json({ success: true, towers, totals });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/units/inventory-summary/:projectId - Project inventory summary
router.get('/inventory-summary/:projectId', async (req, res, next) => {
    try {
        const { projectId } = req.params;
        const sp = [projectId];
        const grant = grantSql(req, 'status', sp);
        const result = await index_js_1.db.query(`SELECT
        COUNT(*) as total_units,
        COUNT(CASE WHEN status::text = 'available' THEN 1 END) as available,
        COUNT(CASE WHEN status::text = 'allotted' THEN 1 END) as allotted,
        COUNT(CASE WHEN status::text = 'possession_handed_over' THEN 1 END) as possession_handed_over,
        COUNT(CASE WHEN status::text = 'available' THEN 1 END) as available_count,
        COUNT(CASE WHEN status::text IN ('application_received','draw_pending','booked') THEN 1 END) as booked_count,
        COUNT(CASE WHEN status::text IN ('allotted','agreement_signed','under_construction','oc_received','possession_handed_over') THEN 1 END) as allotted_count,
        COUNT(CASE WHEN status::text IN ('locked','held') THEN 1 END) as hold_count,
        COUNT(CASE WHEN status::text = 'temp_surrender' THEN 1 END) as temp_surrender_count,
        COUNT(DISTINCT tower_id) as total_towers,
        SUM(total_price_inr) as total_project_value_inr,
        ROUND(100.0 * COUNT(CASE WHEN status::text = 'allotted' THEN 1 END) / NULLIF(COUNT(*), 0), 2) as fill_percentage
       FROM units
       WHERE project_id = $1${grant}`, sp);
        const row = result.rows[0];
        row.unmapped_count = parseInt(row.total_units) - (parseInt(row.available_count) + parseInt(row.booked_count) +
            parseInt(row.allotted_count) + parseInt(row.hold_count) +
            parseInt(row.temp_surrender_count));
        delete row.available_count;
        delete row.booked_count;
        delete row.allotted_count;
        delete row.hold_count;
        res.json({ success: true, data: row });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/units/projects - List all distinct projects (must be before /:id)
router.get('/projects', async (req, res, next) => {
    try {
        const pp = [];
        const g = grantSql(req, 'un.status', pp);
        // A project is listed only when it has a unit the grant covers, and its unit count is that of the covered units (none: an empty selector)
        const result = g
            ? await index_js_1.db.query(`SELECT p.id, p.name, p.rera_number, p.tcp_licence, p.location, p.land_area_sqft,
                  (SELECT COUNT(*)::int FROM units un WHERE un.project_id = p.id${g}) AS total_units, p.created_at
             FROM projects p
            WHERE EXISTS (SELECT 1 FROM units un WHERE un.project_id = p.id${g})
            ORDER BY p.name ASC`, pp)
            : await index_js_1.db.query(`SELECT id, name, rera_number, tcp_licence, location, land_area_sqft, total_units, created_at
           FROM projects
           ORDER BY name ASC`);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/units/towers?projectId= - Tower list for the tower filters on reports and charge pages (must be before /:id).
// Gives the name under both keys because the pages read either one.
router.get('/towers', async (req, res, next) => {
    try {
        const projectId = (0, input_js_1.has)(req.query.projectId) ? (0, input_js_1.uuid)(req.query.projectId, 'projectId') : null;
        const tp = projectId ? [projectId] : [];
        const g = grantSql(req, 'un.status', tp);
        // only towers that hold a unit the grant covers (none: an empty selector)
        const result = await index_js_1.db.query(`SELECT id, tower_name, tower_name AS name, project_id FROM towers
       WHERE deleted_at IS NULL ${projectId ? 'AND project_id = $1' : ''}
       ${g ? `AND EXISTS (SELECT 1 FROM units un WHERE un.tower_id = towers.id${g})` : ''} ORDER BY sort_order, tower_name`, tp);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        fail(err, res, next);
    }
});
// GET /api/units/status-counts - Count per status (must be before /:id)
router.get('/status-counts', async (req, res, next) => {
    try {
        const { projectId } = req.query;
        const params = [];
        let where = 'WHERE 1=1';
        if (projectId) {
            params.push(projectId);
            where += ` AND u.project_id = $${params.length}`;
        }
        where += grantSql(req, 'u.status', params);
        const result = await index_js_1.db.query(`SELECT u.status::text as status, COUNT(*)::int as count,
              COALESCE(SUM(u.carpet_area_sqft), 0) as total_area
       FROM units u ${where}
       GROUP BY u.status ORDER BY u.status`, params);
        const rows = result.rows;
        const total = rows.reduce((s, r) => s + r.count, 0);
        const available = rows.find((r) => r.status === 'available')?.count || 0;
        const totalArea = rows.reduce((s, r) => s + parseFloat(r.total_area || 0), 0);
        res.json({
            success: true,
            data: { byStatus: rows, total_units: total, available, total_sold: total - available, total_area: Math.round(totalArea) },
        });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/units/tower-detail - Tower drill-down: units for a specific tower + status group
router.get('/tower-detail', async (req, res, next) => {
    try {
        const { projectId, towerId, statusGroup } = req.query;
        if (!projectId || !towerId || !statusGroup) {
            return res.status(400).json({ error: 'projectId, towerId, statusGroup are required' });
        }
        const STATUS_MAP = {
            allotted: ['allotted', 'agreement_signed', 'under_construction', 'oc_received', 'possession_handed_over'],
            booked: ['application_received', 'draw_pending', 'booked'],
            hold: ['locked', 'held'],
            available: ['available'],
            temp_surrender: ['temp_surrender'],
            all: [],
        };
        const statuses = STATUS_MAP[statusGroup] ?? [];
        const statusFilter = statuses.length > 0
            ? 'AND u.status::text = ANY($3)'
            : '';
        const queryParams = statuses.length > 0
            ? [projectId, towerId, statuses]
            : [projectId, towerId];
        const grant = grantSql(req, 'u.status', queryParams);
        const result = await index_js_1.db.query(`SELECT
        u.unit_number,
        u.bhk_type as unit_type,
        ROUND(u.carpet_area_sqft::numeric, 4) as area,
        ROUND(u.super_area_sqft::numeric, 4) as super_area_sqft,
        ROUND(u.balcony_area_sqft::numeric, 4) as balcony_area_sqft,
        u.floor,
        u.facing,
        u.base_price_inr,
        u.status,
        t.tower_name,
        p.name as project_name,
        c.registration_no,
        TRIM(c.first_name || ' ' || COALESCE(c.last_name, '')) as consumer_name,
        COALESCE(br.booking_date, a.allotment_date) as booking_date,
        a.allotment_date,
        COALESCE(b.firm_name, b.name, 'Direct') as broker_name,
        COALESCE(br.self_or_loan, 'self') as loan_type,
        COALESCE(NULLIF(br.selected_plan_name, ''), 'Payment Plan') as payment_plan
       FROM units u
       JOIN towers t ON t.id = u.tower_id
       JOIN projects p ON p.id = u.project_id
       LEFT JOIN allocations a ON a.unit_id = u.id AND a.status = 'allotted'
       LEFT JOIN consumers c ON c.id = a.consumer_id
       LEFT JOIN LATERAL (
         SELECT br2.booking_date, br2.selected_plan_name, br2.main_broker_id, br2.self_or_loan
         FROM booking_records br2
         WHERE br2.consumer_id = c.id
         ORDER BY br2.created_at DESC LIMIT 1
       ) br ON true
       LEFT JOIN brokers b ON b.id = br.main_broker_id
       WHERE u.project_id = $1
       AND u.tower_id = $2
       ${statusFilter}${grant}
       ORDER BY COALESCE(br.booking_date, a.allotment_date) ASC NULLS LAST, u.unit_number ASC`, queryParams);
        const units = result.rows;
        const projectName = units[0]?.project_name || '';
        const towerName = units[0]?.tower_name || '';
        const today = (0, business_date_js_1.businessDayStart)().toLocaleDateString('en-GB');
        res.json({ success: true, project_name: projectName, tower_name: towerName,
            status_group: statusGroup, date: today, units });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/units/status - Alias for /status-counts (must be before /:id)
router.get('/status', async (req, res, next) => {
    try {
        const { projectId } = req.query;
        const params = [];
        let where = 'WHERE 1=1';
        if (projectId) {
            params.push(projectId);
            where += ` AND u.project_id = $${params.length}`;
        }
        where += grantSql(req, 'u.status', params);
        const result = await index_js_1.db.query(`SELECT u.status::text as status, COUNT(*)::int as count,
              COALESCE(SUM(u.carpet_area_sqft), 0) as total_area
       FROM units u ${where}
       GROUP BY u.status ORDER BY u.status`, params);
        const rows = result.rows;
        const total = rows.reduce((s, r) => s + r.count, 0);
        const available = rows.find((r) => r.status === 'available')?.count || 0;
        const totalArea = rows.reduce((s, r) => s + parseFloat(r.total_area || 0), 0);
        res.json({
            success: true,
            data: { byStatus: rows, total_units: total, available, total_sold: total - available, total_area: Math.round(totalArea) },
        });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/units/:id - Get unit detail
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await index_js_1.db.query(`SELECT u.id, u.project_id, p.name as project_name,
              u.tower_id, t.tower_name,
              u.floor, u.unit_number, u.bhk_type,
              u.carpet_area_sqft, u.super_area_sqft, u.base_price_inr,
              u.total_price_inr, u.facing, u.floor_plan_url,
              u.balcony_area_sqft, u.balcony_rate_inr_sqft, u.balcony_rate_cap_inr,
              u.status, u.status_changed_at, u.created_at, u.unit_type_id, u.unit_location_id
       FROM units u
       JOIN towers t ON u.tower_id = t.id
       JOIN projects p ON u.project_id = p.id
       WHERE u.id = $1`, [id]);
        if (result.rows.length === 0 || !grantCovers(req, result.rows[0].status)) {
            return res.status(404).json({ error: 'Unit not found' }); // a unit outside the login's unit-status grant is not found
        }
        const historyResult = await index_js_1.db.query(`SELECT previous_status, new_status, changed_by_user_id, reason, changed_at
       FROM unit_status_history WHERE unit_id = $1
       ORDER BY changed_at DESC`, [id]);
        res.json({
            success: true,
            data: { ...result.rows[0], statusHistory: historyResult.rows },
        });
    }
    catch (error) {
        next(error);
    }
});
// DELETE /api/units/:id - remove a unit made by mistake. Only an available unit that nothing else uses can go; the database refuses the rest
router.delete('/:id', async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Unit id');
        const client = await index_js_1.db.connect();
        try {
            await client.query('BEGIN');
            const cur = (await client.query('SELECT * FROM units WHERE id = $1 FOR UPDATE', [id])).rows[0];
            if (!cur) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Unit not found' });
            }
            if (cur.status !== 'available')
                throw Object.assign((0, input_js_1.bad)(`Only an available unit can be deleted; this one is ${cur.status}.`), { http: 409 });
            if ((await client.query(`SELECT 1 FROM booking_records WHERE unit_id = $1 AND COALESCE(status, '') <> 'cancelled' LIMIT 1`, [id])).rows.length)
                throw Object.assign((0, input_js_1.bad)('This unit has a booking, so it cannot be deleted.'), { http: 409 });
            try {
                await client.query('DELETE FROM units WHERE id = $1', [id]);
            }
            catch (e) {
                if (e?.code === '23503')
                    throw Object.assign((0, input_js_1.bad)('This unit is used in other records (a cancelled booking, parking, a shift or a document), so it cannot be deleted.'), { http: 409 });
                throw e;
            }
            await (0, auditLogger_js_1.auditChange)(client, req, res, 'delete', 'unit', id, cur, undefined);
            await client.query('COMMIT');
            res.json({ success: true });
        }
        catch (e) {
            await client.query('ROLLBACK').catch(() => { });
            throw e;
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        fail(error, res, next);
    }
});
// PATCH /api/units/:id - Update unit details
router.patch('/:id', async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Unit id');
        const b = (0, input_js_1.body)(req);
        const client = await index_js_1.db.connect();
        let out;
        try {
            await client.query('BEGIN');
            const cur = (await client.query('SELECT * FROM units WHERE id = $1 FOR UPDATE', [id])).rows[0];
            if (!cur) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Unit not found' });
            }
            const floor = (0, input_js_1.has)(b.floor) ? (0, exports.floorNo)(b.floor) : cur.floor;
            const facing = 'facing' in b ? facingOf(b.facing) : cur.facing;
            const floorPlanUrl = (0, input_js_1.has)(b.floorPlanUrl) ? planUrl(b.floorPlanUrl) : cur.floor_plan_url;
            const unitNumber = (0, input_js_1.has)(b.unitNumber) ? (0, input_js_1.text)(b.unitNumber, 'Unit number', 50, true) : cur.unit_number;
            if (unitNumber.toLowerCase() !== cur.unit_number.toLowerCase()) {
                await client.query(`SELECT pg_advisory_xact_lock(hashtext('unit|' || $1 || '|' || lower($2)))`, [cur.tower_id, unitNumber]);
                if ((await client.query('SELECT 1 FROM units WHERE tower_id = $1 AND lower(unit_number) = lower($2) AND id <> $3', [cur.tower_id, unitNumber, id])).rows.length)
                    throw Object.assign((0, input_js_1.bad)('A unit with this number already exists in this tower. Please use a different unit number.'), { http: 409 });
            }
            const locationId = 'unitLocationId' in b ? ((0, input_js_1.has)(b.unitLocationId) ? (0, input_js_1.uuid)(b.unitLocationId, 'unitLocationId') : null) : cur.unit_location_id;
            if (locationId && locationId !== cur.unit_location_id && !(await client.query('SELECT 1 FROM unit_locations WHERE id = $1 AND project_id = $2', [locationId, cur.project_id])).rows.length)
                throw (0, input_js_1.bad)('This unit location does not belong to the unit\'s project');
            const typeId = 'unitTypeId' in b ? ((0, input_js_1.has)(b.unitTypeId) ? (0, input_js_1.uuid)(b.unitTypeId, 'unitTypeId') : null) : cur.unit_type_id;
            if (typeId && typeId !== cur.unit_type_id && !(await client.query('SELECT 1 FROM unit_types WHERE id = $1 AND project_id = $2', [typeId, cur.project_id])).rows.length)
                throw (0, input_js_1.bad)('This unit type does not belong to the unit\'s project');
            const f = (0, exports.unitFields)({ basePriceInr: b.basePriceInr, totalPriceInr: b.totalPriceInr, balconyAreaSqft: b.balconyAreaSqft, carpetAreaSqft: b.carpetAreaSqft, superAreaSqft: b.superAreaSqft }, cur);
            const same = (a, v) => (a === null && v == null) || (a !== null && v != null && Number(v) === a);
            const moneyChanged = !same(f.base, cur.base_price_inr) || !same(f.total, cur.total_price_inr) || !same(f.balcony, cur.balcony_area_sqft) || !same(f.carpet, cur.carpet_area_sqft) || !same(f.sup, cur.super_area_sqft);
            const identityChanged = typeId !== cur.unit_type_id || unitNumber !== cur.unit_number;
            if (moneyChanged || identityChanged) {
                // Booking, demands and receipts were priced from these figures, so they stay as they are once the unit is sold
                const sold = cur.status !== 'available' && cur.status !== 'locked' && cur.status !== 'held'
                    || (await client.query(`SELECT 1 FROM booking_records WHERE unit_id = $1 AND COALESCE(status, '') <> 'cancelled' LIMIT 1`, [id])).rows.length > 0;
                if (sold)
                    throw Object.assign((0, input_js_1.bad)('This unit already has a booking, so its number, type, price and areas can no longer be changed.'), { http: 409 });
            }
            const upd = (await client.query(`UPDATE units SET floor = $2, facing = $3, floor_plan_url = $4, base_price_inr = $5, total_price_inr = $6, balcony_area_sqft = $7, carpet_area_sqft = $8, super_area_sqft = $9, unit_number = $10, unit_location_id = $11, unit_type_id = $12, updated_at = NOW()
         WHERE id = $1 RETURNING id, unit_number, bhk_type, status, total_price_inr, updated_at`, [id, floor, facing, floorPlanUrl, f.base, f.total, f.balcony, f.carpet, f.sup, unitNumber, locationId, typeId])).rows[0];
            await client.query('COMMIT');
            out = { cur, upd };
        }
        catch (e) {
            await client.query('ROLLBACK').catch(() => { });
            throw e;
        }
        finally {
            client.release();
        }
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'unit', id, out.cur, out.upd);
        res.json({ success: true, data: out.upd });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// POST /api/units/bulk-price  { projectId, towerId?, unitTypeId?, mode: 'percent' | 'amount', value, preview? }
// Raises or lowers the price of the units that are not booked yet (a negative value lowers it). Total price moves by the same amount as the base price.
router.post('/bulk-price', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req), projectId = (0, input_js_1.uuid)(b.projectId, 'projectId'), preview = b.preview === true;
        const towerId = (0, input_js_1.has)(b.towerId) ? (0, input_js_1.uuid)(b.towerId, 'towerId') : null, typeId = (0, input_js_1.has)(b.unitTypeId) ? (0, input_js_1.uuid)(b.unitTypeId, 'unitTypeId') : null;
        const mode = b.mode === 'percent' || b.mode === 'amount' ? b.mode : (() => { throw (0, input_js_1.bad)("mode must be 'percent' or 'amount'"); })();
        const value = typeof b.value === 'number' ? b.value : typeof b.value === 'string' && /^-?\d+(\.\d{1,2})?$/.test(b.value.trim()) ? Number(b.value) : NaN;
        if (!Number.isFinite(value) || Math.round(value * 100) !== value * 100 && Math.abs(Math.round(value * 100) - value * 100) > 1e-6)
            throw (0, input_js_1.bad)('Value must be a number (minus lowers the price) with up to 2 decimals');
        if (Math.abs(value) > (mode === 'percent' ? 100 : 1000000000))
            throw (0, input_js_1.bad)(mode === 'percent' ? 'Percent cannot be more than 100' : 'Amount cannot be more than 100 crore');
        if (!value)
            throw (0, input_js_1.bad)('Value cannot be zero');
        if (mode === 'percent' && value <= -100)
            throw (0, input_js_1.bad)('A fall of 100% or more is not possible');
        const out = await (0, input_js_1.inTx)(async (c) => {
            if (!(await c.query('SELECT 1 FROM projects WHERE id = $1', [projectId])).rows.length)
                throw Object.assign((0, input_js_1.bad)('Project not found'), { http: 404 });
            const rows = (await c.query(`SELECT u.id, u.unit_number, u.base_price_inr, u.total_price_inr FROM units u
          WHERE u.project_id = $1 AND ($2::uuid IS NULL OR u.tower_id = $2) AND ($3::uuid IS NULL OR u.unit_type_id = $3)
            AND u.status IN ('available', 'locked', 'held') AND u.base_price_inr > 0
            AND NOT EXISTS (SELECT 1 FROM booking_records b WHERE b.unit_id = u.id AND COALESCE(b.status, '') <> 'cancelled') FOR UPDATE OF u`, [projectId, towerId, typeId])).rows;
            const delta = (x) => mode === 'percent' ? Math.round(x * value / 100) : Math.round(value);
            const bad1 = rows.find((r) => Number(r.base_price_inr) + delta(Number(r.base_price_inr)) <= 0);
            if (bad1)
                throw (0, input_js_1.bad)(`This change would take the price of unit ${bad1.unit_number} to zero or below`);
            if (!preview)
                for (const r of rows) {
                    const d = delta(Number(r.base_price_inr));
                    await c.query('UPDATE units SET base_price_inr = base_price_inr + $2, total_price_inr = COALESCE(total_price_inr, base_price_inr) + $2, updated_at = now() WHERE id = $1', [r.id, d]);
                }
            const sample = rows[0] ? { before: Number(rows[0].base_price_inr), after: Number(rows[0].base_price_inr) + delta(Number(rows[0].base_price_inr)) } : null;
            return { units: rows.length, updated: preview ? 0 : rows.length, sample };
        });
        if (!preview)
            await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'unit_bulk_price', projectId, undefined, { mode, value, towerId, typeId, units: out.units });
        res.json({ success: true, data: out });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// POST /api/units/bulk-import - Bulk import units from CSV (each row is checked with the same rules as Add Unit)
router.post('/bulk-import', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        const projectId = (0, input_js_1.uuid)(b.projectId, 'projectId');
        if (!Array.isArray(b.rows))
            throw (0, input_js_1.bad)('rows must be a list of units');
        if (b.rows.length === 0)
            throw (0, input_js_1.bad)('There are no rows to import');
        if (b.rows.length > 2000)
            throw (0, input_js_1.bad)('Import at most 2000 units at a time');
        if (!(await index_js_1.db.query('SELECT 1 FROM projects WHERE id = $1', [projectId])).rows.length)
            return res.status(404).json({ error: 'Project not found' });
        let created = 0, skipped = 0;
        const errors = [];
        for (const row of b.rows) {
            const label = row && typeof row === 'object' ? String(row.unitNumber ?? '').slice(0, 50) : '';
            try {
                if (!row || typeof row !== 'object' || Array.isArray(row))
                    throw (0, input_js_1.bad)('Row is not valid');
                // A row may name the unit type (its id); the unit is then tied to it, so a later change of that type reaches this unit
                const typeId = (0, input_js_1.has)(row.unitTypeId) ? (0, input_js_1.uuid)(row.unitTypeId, 'unitTypeId') : null;
                const typeRow = typeId ? (await index_js_1.db.query('SELECT name FROM unit_types WHERE id = $1 AND project_id = $2', [typeId, projectId])).rows[0] : null;
                if (typeId && !typeRow)
                    throw (0, input_js_1.bad)('This unit type does not belong to the project');
                const unitNumber = (0, input_js_1.text)(row.unitNumber, 'Unit number', 50, true), bhkType = (0, input_js_1.has)(row.bhkType) || !typeRow ? (0, input_js_1.text)(row.bhkType, 'BHK type', 50, true) : typeRow.name;
                if (!(0, input_js_1.has)(row.floor))
                    throw (0, input_js_1.bad)('Floor number is required for each unit');
                const floor = (0, exports.floorNo)(row.floor), facing = facingOf(row.facing);
                const f = (0, exports.unitFields)({ carpetAreaSqft: row.carpetAreaSqft ?? row.carpetAreaSqm, superAreaSqft: row.superAreaSqft ?? row.superAreaSqm, balconyAreaSqft: row.balconyAreaSqft, basePriceInr: row.basePriceInr, totalPriceInr: row.totalPriceInr });
                let towerId = null;
                if ((0, input_js_1.has)(row.towerId)) {
                    towerId = (0, input_js_1.uuid)(row.towerId, 'towerId');
                    if (!(await index_js_1.db.query('SELECT 1 FROM towers WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL', [towerId, projectId])).rows.length)
                        throw (0, input_js_1.bad)('This tower does not belong to the project');
                }
                else {
                    const tn = (0, input_js_1.text)(row.tower, 'Tower', 100, true);
                    towerId = (await index_js_1.db.query('SELECT id FROM towers WHERE project_id = $1 AND lower(tower_name) = lower($2) AND deleted_at IS NULL', [projectId, tn])).rows[0]?.id
                        ?? (await index_js_1.db.query('INSERT INTO towers (project_id, tower_name) VALUES ($1, $2) ON CONFLICT (project_id, tower_name) DO UPDATE SET tower_name = EXCLUDED.tower_name RETURNING id', [projectId, tn])).rows[0].id;
                }
                const dup = await index_js_1.db.query('SELECT 1 FROM units WHERE tower_id = $1 AND lower(unit_number) = lower($2)', [towerId, unitNumber]);
                if (dup.rows.length)
                    throw (0, input_js_1.bad)('A unit with this number already exists in this tower');
                const inserted = await index_js_1.db.query(`INSERT INTO units (project_id, tower_id, floor, unit_number, bhk_type, carpet_area_sqft, super_area_sqft, balcony_area_sqft, base_price_inr, total_price_inr, facing, status, created_by_user_id, unit_type_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'available',$12,$13) ON CONFLICT (tower_id, unit_number) DO NOTHING`, [projectId, towerId, floor, unitNumber, bhkType, f.carpet, f.sup, f.balcony || null, f.base, f.total, facing, req.userId, typeId]);
                if (inserted.rowCount)
                    created++;
                else {
                    skipped++;
                    errors.push({ unitNumber: label, reason: 'A unit with this number already exists in this tower' });
                }
            }
            catch (error) {
                skipped++;
                // our own messages are shown as they are; a database message is not passed on
                errors.push({ unitNumber: label, reason: error?.http ? error.message : 'This row could not be saved' });
            }
        }
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'unit_bulk_import', projectId, undefined, { totalRows: b.rows.length, created, skipped });
        res.json({ success: true, data: { totalRows: b.rows.length, created, skipped, errors } });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// ── Unit Wise Area: the 12 area fields of the client, with a history that says what changed and from which date ──
// Super area, carpet area and balcony 1 live on the unit (billing reads them, so a sold unit keeps them); the other areas are records and can be corrected any time.
const AREA_FIELDS = [
    ['superAreaSqft', 'super_area_sqft', 'Super area', 'unit'], ['carpetAreaSqft', 'carpet_area_sqft', 'Carpet area', 'unit'], ['balcony1AreaSqft', 'balcony_area_sqft', 'Balcony 1 area', 'unit'],
    ['builtUpAreaSqft', 'built_up_area_sqft', 'Built-up area', 'ext'], ['udslAreaSqft', 'udsl_area_sqft', 'UDSL area', 'ext'], ['plotArea', 'plot_area', 'Plot area', 'ext'],
    ['balcony2AreaSqft', 'balcony_2_area_sqft', 'Balcony 2 area', 'ext'], ['balcony3AreaSqft', 'balcony_3_area_sqft', 'Balcony 3 area', 'ext'],
    ['basementAreaSqft', 'basement_area_sqft', 'Basement area', 'ext'], ['stiltAreaSqft', 'stilt_area_sqft', 'Stilt area', 'ext'], ['commonAreaSqft', 'common_area_sqft', 'Common area', 'ext'],
];
const areaSelect = `SELECT u.id AS unit_id, u.project_id, u.tower_id, u.unit_number, u.floor, u.status, t.tower_name, u.super_area_sqft, u.carpet_area_sqft, u.balcony_area_sqft,
  a.area_measurement, a.built_up_area_sqft, a.udsl_area_sqft, a.plot_area, a.balcony_2_area_sqft, a.balcony_3_area_sqft, a.basement_area_sqft, a.stilt_area_sqft, a.common_area_sqft
  FROM units u JOIN towers t ON t.id = u.tower_id LEFT JOIN unit_areas a ON a.unit_id = u.id`;
const areaOut = (r) => ({
    unit_id: r.unit_id, project_id: r.project_id, tower_name: r.tower_name, unit_number: r.unit_number, floor: r.floor, status: r.status, areaMeasurement: r.area_measurement ?? null,
    ...Object.fromEntries(AREA_FIELDS.map(([k, col]) => [k, r[col] == null ? null : Number(r[col])])),
});
const unitIsSold = async (c, id, status) => (status !== 'available' && status !== 'locked' && status !== 'held') || (await c.query(`SELECT 1 FROM booking_records WHERE unit_id = $1 AND COALESCE(status, '') <> 'cancelled' LIMIT 1`, [id])).rows.length > 0;
// GET /api/units/areas/report?projectId=&towerId=   one row per unit with all 12 areas (the client's Unit Wise Area report)
router.get('/areas/report', async (req, res, next) => {
    try {
        const projectId = (0, input_js_1.uuid)(req.query.projectId, 'projectId'), towerId = (0, input_js_1.has)(req.query.towerId) ? (0, input_js_1.uuid)(req.query.towerId, 'towerId') : null;
        if (!(await index_js_1.db.query('SELECT 1 FROM projects WHERE id = $1', [projectId])).rows.length)
            return res.status(404).json({ error: 'Project not found' });
        const ap = [projectId, towerId];
        const grant = grantSql(req, 'u.status', ap);
        const rows = (await index_js_1.db.query(`${areaSelect} WHERE u.project_id = $1 AND ($2::uuid IS NULL OR u.tower_id = $2)${grant} ORDER BY t.tower_name, u.floor, u.unit_number`, ap)).rows;
        res.json({ success: true, data: rows.map(areaOut) });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// GET /api/units/:id/areas
router.get('/:id/areas', async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Unit id');
        const r = (await index_js_1.db.query(`${areaSelect} WHERE u.id = $1`, [id])).rows[0];
        if (!r || !grantCovers(req, r.status))
            return res.status(404).json({ error: 'Unit not found' });
        res.json({ success: true, data: { ...areaOut(r), sold: await unitIsSold(index_js_1.db, id, r.status) } });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// GET /api/units/:id/areas/history
router.get('/:id/areas/history', async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Unit id');
        const un = (await index_js_1.db.query('SELECT status FROM units WHERE id = $1', [id])).rows[0];
        if (!un || !grantCovers(req, un.status))
            return res.status(404).json({ error: 'Unit not found' });
        const rows = (await index_js_1.db.query(`SELECT h.id, h.effective_date::text AS effective_date, h.before, h.after, h.note, h.changed_at, u.name AS changed_by_name
        FROM unit_area_history h LEFT JOIN users u ON u.id = h.changed_by WHERE h.unit_id = $1 ORDER BY h.changed_at DESC LIMIT 100`, [id])).rows;
        res.json({ success: true, data: rows });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// PUT /api/units/:id/areas  { effectiveDate?, note?, areaMeasurement?, <any of the 11 areas> }   a field left out stays; null or blank clears it
router.put('/:id/areas', async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Unit id'), b = (0, input_js_1.body)(req);
        const effective = (0, input_js_1.has)(b.effectiveDate) ? (0, input_js_1.day)(b.effectiveDate, 'Effective date') : (0, business_date_js_1.businessToday)();
        const note = (0, input_js_1.has)(b.note) ? (0, input_js_1.text)(b.note, 'Note', 500, false) : null;
        const given = {};
        for (const [k, , label] of AREA_FIELDS)
            if (k in b)
                given[k] = (0, input_js_1.has)(b[k]) ? (0, input_js_1.num)(b[k], label, AREA_MAX, 4) : null;
        let measure;
        if ('areaMeasurement' in b) {
            measure = (0, input_js_1.has)(b.areaMeasurement) ? (0, input_js_1.text)(b.areaMeasurement, 'Area measurement', 50, true) : null;
            if (measure && !(await index_js_1.db.query('SELECT 1 FROM area_types WHERE lower(name) = lower($1)', [measure])).rows.length)
                throw (0, input_js_1.bad)('Area measurement must be one of the Area Types in Set Master');
        }
        if (!Object.keys(given).length && measure === undefined)
            throw (0, input_js_1.bad)('Nothing to update');
        const out = await (0, input_js_1.inTx)(async (c) => {
            const cur = (await c.query(`${areaSelect} WHERE u.id = $1 FOR UPDATE OF u`, [id])).rows[0];
            if (!cur)
                throw Object.assign((0, input_js_1.bad)('Unit not found'), { http: 404 });
            const before = areaOut(cur), after = { ...before };
            for (const k of Object.keys(given))
                after[k] = given[k];
            if (measure !== undefined)
                after.areaMeasurement = measure;
            if (after.superAreaSqft !== null && after.carpetAreaSqft !== null && after.superAreaSqft < after.carpetAreaSqft)
                throw (0, input_js_1.bad)('Super area cannot be less than the carpet area');
            const changed = [...AREA_FIELDS.map(([k]) => k), 'areaMeasurement'].filter((k) => before[k] !== after[k]);
            if (!changed.length)
                return { before, after, changed };
            if (changed.some((k) => ['superAreaSqft', 'carpetAreaSqft', 'balcony1AreaSqft'].includes(k)) && (await unitIsSold(c, id, cur.status)))
                throw Object.assign((0, input_js_1.bad)('This unit already has a booking, so its super, carpet and balcony 1 areas can no longer be changed. The other areas can.'), { http: 409 });
            await c.query('UPDATE units SET super_area_sqft = $2, carpet_area_sqft = $3, balcony_area_sqft = $4, updated_at = now() WHERE id = $1', [id, after.superAreaSqft, after.carpetAreaSqft, after.balcony1AreaSqft]);
            await c.query(`INSERT INTO unit_areas (unit_id, area_measurement, built_up_area_sqft, udsl_area_sqft, plot_area, balcony_2_area_sqft, balcony_3_area_sqft, basement_area_sqft, stilt_area_sqft, common_area_sqft, updated_by, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now())
         ON CONFLICT (unit_id) DO UPDATE SET area_measurement = EXCLUDED.area_measurement, built_up_area_sqft = EXCLUDED.built_up_area_sqft, udsl_area_sqft = EXCLUDED.udsl_area_sqft, plot_area = EXCLUDED.plot_area,
           balcony_2_area_sqft = EXCLUDED.balcony_2_area_sqft, balcony_3_area_sqft = EXCLUDED.balcony_3_area_sqft, basement_area_sqft = EXCLUDED.basement_area_sqft, stilt_area_sqft = EXCLUDED.stilt_area_sqft,
           common_area_sqft = EXCLUDED.common_area_sqft, updated_by = EXCLUDED.updated_by, updated_at = now()`, [id, after.areaMeasurement, after.builtUpAreaSqft, after.udslAreaSqft, after.plotArea, after.balcony2AreaSqft, after.balcony3AreaSqft, after.basementAreaSqft, after.stiltAreaSqft, after.commonAreaSqft, req.userId]);
            const pick = (o) => Object.fromEntries([...AREA_FIELDS.map(([k]) => k), 'areaMeasurement'].map((k) => [k, o[k]]));
            await c.query('INSERT INTO unit_area_history (unit_id, effective_date, before, after, note, changed_by) VALUES ($1,$2,$3,$4,$5,$6)', [id, effective, JSON.stringify(pick(before)), JSON.stringify(pick(after)), note, req.userId]);
            return { before, after, changed };
        });
        if (out.changed.length)
            await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'unit_area', id, out.before, out.after);
        res.json({ success: true, data: { ...out.after, changed: out.changed } });
    }
    catch (error) {
        fail(error, res, next);
    }
});
// POST /api/units/add-more  { projectId, towerId, unitTypeId, count, preview? }
// The client's "Change No. of Plot / Villa": more units of one type in one tower (a plot block has no floors, so they go on floor 0). Areas and price come from the type,
// the numbers continue the tower's own pattern (A-101, A-102 ... gives A-103 ...), and the count can be looked at first with preview.
router.post('/add-more', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req), projectId = (0, input_js_1.uuid)(b.projectId, 'projectId'), towerId = (0, input_js_1.uuid)(b.towerId, 'towerId'), typeId = (0, input_js_1.uuid)(b.unitTypeId, 'unitTypeId');
        const count = (0, input_js_1.num)(b.count, 'Number of units', 2000, 0);
        if (!Number.isInteger(count) || count < 1)
            throw (0, input_js_1.bad)('Number of units must be a whole number from 1 to 2000');
        if (b.preview !== undefined && typeof b.preview !== 'boolean')
            throw (0, input_js_1.bad)('preview must be true or false');
        const out = await (0, input_js_1.inTx)(async (c) => {
            const tower = (await c.query('SELECT id, tower_name, address_prefix FROM towers WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL FOR UPDATE', [towerId, projectId])).rows[0];
            if (!tower)
                throw Object.assign((0, input_js_1.bad)('This tower does not belong to the project'), { http: 404 });
            const ty = (await c.query('SELECT * FROM unit_types WHERE id = $1 AND project_id = $2', [typeId, projectId])).rows[0];
            if (!ty)
                throw Object.assign((0, input_js_1.bad)('This unit type does not belong to the project'), { http: 404 });
            const have = (await c.query('SELECT unit_number FROM units WHERE tower_id = $1', [towerId])).rows.map((r) => String(r.unit_number));
            const taken = new Set(have.map((x) => x.toLowerCase()));
            let pre = tower.address_prefix || '', next = 1, width = 3, post = '';
            const last = have.map((x) => x.match(/^(.*?)(\d+)(\D*)$/)).filter(Boolean).sort((a, z) => Number(z[2]) - Number(a[2]))[0];
            if (last) {
                pre = last[1];
                next = Number(last[2]) + 1;
                width = last[2].length;
                post = last[3];
            }
            const numbers = [];
            while (numbers.length < count) {
                const no = `${pre}${String(next++).padStart(width, '0')}${post}`;
                if (!taken.has(no.toLowerCase()))
                    numbers.push(no);
                if (next > 10000000)
                    throw (0, input_js_1.bad)('Could not find free unit numbers');
            }
            if (numbers.some((x) => x.length > 50))
                throw (0, input_js_1.bad)('A unit number would be longer than 50 characters');
            const base = (0, unit_type_price_js_1.typePrice)(ty);
            const sample = { first: numbers[0], last: numbers[numbers.length - 1], count, basePrice: base };
            if (b.preview === true)
                return { ...sample, created: 0 };
            await c.query(`INSERT INTO units (project_id, tower_id, floor, unit_number, bhk_type, carpet_area_sqft, super_area_sqft, balcony_area_sqft, base_price_inr, total_price_inr, status, created_by_user_id, unit_type_id)
         SELECT $1, $2, 0, x.no, $3, $4, $5, $6, $7, $7, 'available', $8, $9 FROM unnest($10::text[]) AS x(no)`, [projectId, towerId, ty.name, ty.carpet_area_sqft || null, ty.super_area_sqft || null, ty.balcony_area_sqft || null, base, req.userId, typeId, numbers]);
            return { ...sample, created: count };
        });
        if (b.preview !== true)
            await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'unit_add_more', projectId, undefined, { towerId, unitTypeId: typeId, count });
        res.status(b.preview === true ? 200 : 201).json({ success: true, data: out });
    }
    catch (error) {
        fail(error, res, next);
    }
});
router.use(pg_errors_js_1.pgErrorHandler);
exports.default = router;
//# sourceMappingURL=units.js.map