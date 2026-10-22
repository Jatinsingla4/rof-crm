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
const input_js_1 = require("../utils/input.js");
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
// POST /api/units - Create unit
router.post('/', async (req, res, next) => {
    try {
        const b = (0, input_js_1.body)(req);
        const projectId = (0, input_js_1.uuid)(b.projectId, 'projectId'), towerId = (0, input_js_1.uuid)(b.towerId, 'towerId');
        const unitNumber = (0, input_js_1.text)(b.unitNumber, 'Unit number', 50, true);
        const bhkType = (0, input_js_1.text)(b.bhkType, 'BHK type', 50, true);
        if (!(0, input_js_1.has)(b.floor))
            throw (0, input_js_1.bad)('Floor number is required for each unit');
        const floor = (0, exports.floorNo)(b.floor);
        const facing = (0, input_js_1.text)(b.facing, 'Facing', 30, false), floorPlanUrl = planUrl(b.floorPlanUrl);
        const unitTypeId = (0, input_js_1.has)(b.unitTypeId) ? (0, input_js_1.uuid)(b.unitTypeId, 'unitTypeId') : null;
        const f = (0, exports.unitFields)(b);
        const tower = await index_js_1.db.query('SELECT 1 FROM towers WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL', [towerId, projectId]);
        if (!tower.rows.length)
            throw (0, input_js_1.bad)('This tower does not belong to the selected project');
        if (unitTypeId && !(await index_js_1.db.query('SELECT 1 FROM unit_types WHERE id = $1 AND project_id = $2', [unitTypeId, projectId])).rows.length)
            throw (0, input_js_1.bad)('This unit type does not belong to the selected project');
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
           base_price_inr, total_price_inr, facing, floor_plan_url, status, created_by_user_id, unit_type_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'available',$13,$14)
         RETURNING id, unit_number, bhk_type, status, total_price_inr, created_at`, [projectId, towerId, floor, unitNumber, bhkType, f.carpet, f.sup, f.balcony || null, f.base, f.total, facing, floorPlanUrl, req.userId, unitTypeId])).rows[0];
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
router.get('/', unitStatusAccess_js_1.applyUnitStatusFilter, async (req, res, next) => {
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
            const placeholders = req.unitStatusFilter.map((_, i) => `$${innerParams.length + i + 1}`).join(', ');
            innerWhere += ` AND u.status::text IN (${placeholders})`;
            innerParams.push(...req.unitStatusFilter);
        }
        const innerQuery = `
      SELECT DISTINCT ON (u.id)
        u.id, u.project_id, p.name as project_name,
        u.tower_id, t.tower_name, t.tower_name AS tower,
        u.floor, u.unit_number, u.bhk_type,
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
        (SELECT ut.name FROM unit_types ut
         WHERE ut.id = u.unit_type_id LIMIT 1) AS unit_group
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
});
// GET /api/units/tower/:projectId - Tower-wise breakdown
router.get('/tower/:projectId', async (req, res, next) => {
    try {
        const { projectId } = req.params;
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
       WHERE u.project_id = $1
       GROUP BY t.id, t.tower_name
       ORDER BY t.tower_name ASC`, [projectId]);
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
       WHERE project_id = $1`, [projectId]);
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
        const result = await index_js_1.db.query(`SELECT id, name, rera_number, tcp_licence, location, land_area_sqft, total_units, created_at
       FROM projects
       ORDER BY name ASC`);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        next(error);
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
       ${statusFilter}
       ORDER BY COALESCE(br.booking_date, a.allotment_date) ASC NULLS LAST, u.unit_number ASC`, queryParams);
        const units = result.rows;
        const projectName = units[0]?.project_name || '';
        const towerName = units[0]?.tower_name || '';
        const today = new Date().toLocaleDateString('en-GB');
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
              u.status, u.status_changed_at, u.created_at
       FROM units u
       JOIN towers t ON u.tower_id = t.id
       JOIN projects p ON u.project_id = p.id
       WHERE u.id = $1`, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Unit not found' });
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
            const facing = (0, input_js_1.has)(b.facing) ? (0, input_js_1.text)(b.facing, 'Facing', 30, false) : cur.facing;
            const floorPlanUrl = (0, input_js_1.has)(b.floorPlanUrl) ? planUrl(b.floorPlanUrl) : cur.floor_plan_url;
            const f = (0, exports.unitFields)({ basePriceInr: b.basePriceInr, totalPriceInr: b.totalPriceInr, balconyAreaSqft: b.balconyAreaSqft, carpetAreaSqft: b.carpetAreaSqft, superAreaSqft: b.superAreaSqft }, cur);
            const same = (a, v) => (a === null && v == null) || (a !== null && v != null && Number(v) === a);
            const moneyChanged = !same(f.base, cur.base_price_inr) || !same(f.total, cur.total_price_inr) || !same(f.balcony, cur.balcony_area_sqft) || !same(f.carpet, cur.carpet_area_sqft) || !same(f.sup, cur.super_area_sqft);
            if (moneyChanged) {
                // Booking, demands and receipts were priced from these figures, so they stay as they are once the unit is sold
                const sold = cur.status !== 'available' && cur.status !== 'locked' && cur.status !== 'held'
                    || (await client.query(`SELECT 1 FROM booking_records WHERE unit_id = $1 AND COALESCE(status, '') <> 'cancelled' LIMIT 1`, [id])).rows.length > 0;
                if (sold)
                    throw Object.assign((0, input_js_1.bad)('This unit already has a booking, so its price and areas can no longer be changed.'), { http: 409 });
            }
            const upd = (await client.query(`UPDATE units SET floor = $2, facing = $3, floor_plan_url = $4, base_price_inr = $5, total_price_inr = $6, balcony_area_sqft = $7, carpet_area_sqft = $8, super_area_sqft = $9, updated_at = NOW()
         WHERE id = $1 RETURNING id, unit_number, bhk_type, status, total_price_inr, updated_at`, [id, floor, facing, floorPlanUrl, f.base, f.total, f.balcony, f.carpet, f.sup])).rows[0];
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
                const unitNumber = (0, input_js_1.text)(row.unitNumber, 'Unit number', 50, true), bhkType = (0, input_js_1.text)(row.bhkType, 'BHK type', 50, true);
                if (!(0, input_js_1.has)(row.floor))
                    throw (0, input_js_1.bad)('Floor number is required for each unit');
                const floor = (0, exports.floorNo)(row.floor), facing = (0, input_js_1.text)(row.facing, 'Facing', 30, false);
                const f = (0, exports.unitFields)({ carpetAreaSqft: row.carpetAreaSqft ?? row.carpetAreaSqm, superAreaSqft: row.superAreaSqft ?? row.superAreaSqm, basePriceInr: row.basePriceInr, totalPriceInr: row.totalPriceInr });
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
                const inserted = await index_js_1.db.query(`INSERT INTO units (project_id, tower_id, floor, unit_number, bhk_type, carpet_area_sqft, super_area_sqft, base_price_inr, total_price_inr, facing, status, created_by_user_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'available',$11) ON CONFLICT (tower_id, unit_number) DO NOTHING`, [projectId, towerId, floor, unitNumber, bhkType, f.carpet, f.sup, f.base, f.total, facing, req.userId]);
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
router.use(pg_errors_js_1.pgErrorHandler);
exports.default = router;
//# sourceMappingURL=units.js.map