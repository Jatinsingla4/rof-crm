"use strict";
/**
 * Projects Routes
 * Project CRUD, tower management, unit locations, rate reports
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_js_1 = require("../index.js");
const pg_errors_js_1 = require("../middleware/pg-errors.js");
const master_js_1 = require("./master.js");
const project_settings_js_1 = require("../utils/project-settings.js");
const pool_js_1 = require("../db/pool.js");
const processPermission_js_1 = require("../middleware/processPermission.js");
const timely_discount_js_1 = require("../utils/timely-discount.js");
const auditLogger_js_1 = require("../middleware/auditLogger.js");
const unitStatusAccess_js_1 = require("../middleware/unitStatusAccess.js");
const unit_grant_js_1 = require("../utils/unit-grant.js");
const input_js_1 = require("../utils/input.js");
const router = (0, express_1.Router)();
// GET /api/projects
// Unit and floor figures on these routes count only the units the login's unit-status grant covers (owner-approved U-C): none -> zero, partial -> covered units only,
// all and super_admin -> every unit as before. The grant sits in the JOIN so projects, towers and floors are still listed.
router.get('/', unitStatusAccess_js_1.applyUnitStatusFilter, async (req, res, next) => {
    try {
        const gp = [];
        const grant = (0, unit_grant_js_1.grantClause)(req.unitStatusFilter, 'u.status', gp);
        const result = await index_js_1.db.query(`SELECT p.id, p.name, p.rera_number, p.tcp_licence, p.location,
              p.land_area_sqft, p.total_units, p.group_name, p.possession_date, p.created_at,
              p.company_id, comp.name AS company_name,
              COUNT(DISTINCT t.id) as tower_count,
              COUNT(DISTINCT u.id) as unit_count,
              COUNT(DISTINCT u.id) FILTER (WHERE u.status::text = 'available') as available_units,
              COUNT(DISTINCT u.id) FILTER (WHERE u.status::text = 'allotted') as allotted_units
       FROM projects p
       LEFT JOIN companies comp ON comp.id = p.company_id
       LEFT JOIN towers t ON p.id = t.project_id
       LEFT JOIN units u ON p.id = u.project_id${grant}
       GROUP BY p.id, comp.name
       ORDER BY p.created_at DESC`, gp);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/projects
router.post('/', async (req, res, next) => {
    // A login limited to some projects could not see the project it creates; an admin creates projects
    if ((0, pool_js_1.isScoped)())
        return res.status(403).json({ error: 'Your login is limited to assigned projects. Ask an admin to create a new project.' });
    try {
        const pb = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
        const landAreaSqft = (0, input_js_1.has)(pb.landAreaSqft) ? (0, input_js_1.num)(pb.landAreaSqft, 'Land area', 10000000000, 4) : null;
        const totalUnits = (0, input_js_1.has)(pb.totalUnits) ? (0, input_js_1.num)(pb.totalUnits, 'Total units', 100000, 0) : null;
        const possessionDate = (0, input_js_1.day)(pb.possessionDate, 'Possession date');
        const incomeCategory = (0, input_js_1.text)(pb.incomeCategory, 'Category', 100, false);
        const companyId = pb.companyId;
        const cleaned = (0, master_js_1.cleanBody)(req.body, ['name', 'reraNumber', 'tcpLicence', 'location']);
        if ('error' in cleaned)
            return res.status(400).json({ error: cleaned.error });
        const { name, reraNumber, tcpLicence, location } = cleaned.values;
        if (!name || !reraNumber || !tcpLicence) {
            return res.status(400).json({ error: 'name, reraNumber, and tcpLicence are required' });
        }
        // Receipts, demand letters and allotment letters print the project's company, so every project needs one
        if (!companyId)
            return res.status(400).json({ error: 'companyId is required' });
        const company = await index_js_1.db.query('SELECT 1 FROM companies WHERE id = $1', [companyId]);
        if (!company.rows.length)
            return res.status(400).json({ error: 'This company does not exist' });
        const sameName = await index_js_1.db.query('SELECT 1 FROM projects WHERE lower(name) = lower($1)', [name]);
        if (sameName.rows.length)
            return res.status(409).json({ error: 'A project with this name already exists' });
        if ((await index_js_1.db.query('SELECT 1 FROM projects WHERE lower(rera_number) = lower($1)', [reraNumber])).rows.length)
            return res.status(409).json({ error: 'Another project already has this RERA number' });
        const result = await index_js_1.db.query(`INSERT INTO projects (name, rera_number, tcp_licence, location, land_area_sqft, total_units,
                             group_name, possession_date, company_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, name, rera_number, tcp_licence, location, group_name, possession_date, created_at`, [name, reraNumber, tcpLicence, location || null, landAreaSqft || null, totalUnits || null,
            incomeCategory || 'Affordable', possessionDate || null, companyId || null]);
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'project', result.rows[0].id, undefined, result.rows[0]);
        res.status(201).json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        planFail(error, res, next);
    }
});
// GET /api/projects/reports/rates?projectId= — rate report (MUST be before /:id)
// One row per project / BHK type / tower. Units with no price are counted (no_price_count) instead of silently left out.
router.get('/reports/rates', async (req, res, next) => {
    try {
        const q = req.query.projectId;
        if (q !== undefined && (typeof q !== 'string' || !idOk(q)))
            throw bad('projectId is not valid');
        const result = await index_js_1.db.query(`
      SELECT
        p.id AS project_id,
        p.name AS project_name,
        u.bhk_type,
        t.tower_name AS tower,
        COUNT(u.id)::int AS unit_count,
        COUNT(u.id) FILTER (WHERE COALESCE(u.base_price_inr, 0) > 0)::int AS priced_count,
        COUNT(u.id) FILTER (WHERE COALESCE(u.base_price_inr, 0) = 0)::int AS no_price_count,
        COUNT(u.id) FILTER (WHERE u.status::text = 'available')::int AS available_count,
        COUNT(u.id) FILTER (WHERE u.status::text NOT IN ('available', 'locked', 'held'))::int AS sold_count,
        MIN(u.base_price_inr) FILTER (WHERE u.base_price_inr > 0) AS min_price,
        MAX(u.base_price_inr) FILTER (WHERE u.base_price_inr > 0) AS max_price,
        ROUND(AVG(u.base_price_inr) FILTER (WHERE u.base_price_inr > 0)) AS avg_price,
        -- the rate is per the area the unit's type charges on (super, built-up, plot); a unit without a type, or without that area, uses its carpet area
        ROUND(AVG(u.base_price_inr / ra.area) FILTER (WHERE u.base_price_inr > 0 AND ra.area > 0)) AS avg_rate_per_sqft,
        MIN(ra.basis) AS rate_basis,
        COALESCE(bool_or(ut.rate_type = 'In Fix'), false) AS fixed_price,
        MIN(u.carpet_area_sqft) AS min_carpet,
        MAX(u.carpet_area_sqft) AS max_carpet
      FROM projects p
      JOIN units u ON u.project_id = p.id
      LEFT JOIN towers t ON u.tower_id = t.id
      LEFT JOIN unit_types ut ON ut.id = u.unit_type_id
      CROSS JOIN LATERAL (SELECT CASE WHEN ut.rate_basis = 'Super Area' AND u.super_area_sqft > 0 THEN u.super_area_sqft
                                      WHEN ut.rate_basis = 'Built Up Area' AND ut.built_up_area_sqft > 0 THEN ut.built_up_area_sqft
                                      WHEN ut.rate_basis = 'Plot Area' AND ut.plot_area > 0 THEN ut.plot_area
                                      ELSE u.carpet_area_sqft END AS area,
                                 CASE WHEN ut.rate_basis = 'Super Area' AND u.super_area_sqft > 0 THEN 'Super'
                                      WHEN ut.rate_basis = 'Built Up Area' AND ut.built_up_area_sqft > 0 THEN 'Built-up'
                                      WHEN ut.rate_basis = 'Plot Area' AND ut.plot_area > 0 THEN 'Plot'
                                      ELSE 'Carpet' END AS basis) ra
      WHERE ($1::uuid IS NULL OR p.id = $1)
      GROUP BY p.id, p.name, u.bhk_type, t.id, t.tower_name
      ORDER BY p.name, u.bhk_type, t.tower_name
    `, [q ?? null]);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        planFail(err, res, next);
    }
});
// GET /api/projects/:id/floors?towerId=
router.get('/:id/floors', unitStatusAccess_js_1.applyUnitStatusFilter, async (req, res, next) => {
    try {
        const { towerId } = req.query;
        const params = [req.params.id];
        let extra = '';
        if (towerId) {
            extra = ' AND tower_id = $2';
            params.push(towerId);
        }
        extra += (0, unit_grant_js_1.grantClause)(req.unitStatusFilter, 'status', params);
        const result = await index_js_1.db.query(`SELECT DISTINCT floor FROM units WHERE project_id = $1${extra} ORDER BY floor ASC`, params);
        res.json({ success: true, data: result.rows.map((r) => r.floor) });
    }
    catch (err) {
        next(err);
    }
});
// ─── Payment plans ───────────────────────────────────────────────────────────
// A plan is the set of rows in plan_schedule_templates that share (project_id, plan_name). Booking turns each row
// into a demand: amount = price x percentage. So the percentages of one plan must add up to 100.
// Once a booking uses a plan, its numbers are frozen (reports read the rows live); change a copy instead.
const PLAN_TYPES = ['installment', 'booking', 'possession', 'plc', 'other_charge'];
const bad = (message) => Object.assign(new Error(message), { http: 400 });
const clash = (message) => Object.assign(new Error(message), { http: 409 });
const planFail = (err, res, next) => (err?.http ? res.status(err.http).json({ error: err.message }) : next(err));
// Only a JSON number or a plain digit string counts as a number: "1e2", "0x10", " 5 ", [5], true and {} are refused
const plainNumber = (v, decimals) => {
    if (typeof v === 'number')
        return v;
    if (typeof v === 'string' && new RegExp(decimals ? `^[0-9]+(\\.[0-9]{1,${decimals}})?$` : '^[0-9]+$').test(v))
        return Number(v);
    return NaN;
};
const wholeNumber = (v, label, min, max) => {
    if (v === undefined || v === null || v === '')
        return null;
    const n = plainNumber(v, 0);
    if (!Number.isInteger(n) || n < min || n > max)
        throw bad(`${label} must be a whole number from ${min} to ${max}`);
    return n;
};
// Names are plain text: no control characters, line breaks or text-direction tricks
const plainText = (v, label) => {
    if (/[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069]/.test(v))
        throw bad(`${label} contains characters that are not allowed`);
};
const planName = (v) => {
    if (v !== undefined && v !== null && typeof v !== 'string')
        throw bad('Plan name must be text');
    const c = (0, master_js_1.cleanBody)({ plan_name: v }, ['plan_name']);
    if ('error' in c)
        throw bad(c.error.replace('Plan name', 'Plan name'));
    const n = c.values.plan_name;
    if (!n)
        throw bad('Plan name is required');
    if (n.length > 100)
        throw bad('Plan name can be at most 100 characters');
    plainText(n, 'Plan name');
    return n;
};
const idOk = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
// Reads and checks one row. `cur` is the saved row when editing: fields not sent keep their value.
function readPlanRow(body, cur) {
    body = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
    for (const [k, label] of [['installment_name', 'Installment name'], ['notes', 'Notes']]) {
        if (body[k] !== undefined && body[k] !== null && typeof body[k] !== 'string')
            throw bad(`${label} must be text`);
    }
    const c = (0, master_js_1.cleanBody)(body, ['installment_name', 'notes'], cur);
    if ('error' in c)
        throw bad(c.error);
    const name = c.values.installment_name !== undefined ? c.values.installment_name : cur?.installment_name;
    if (!name)
        throw bad('Installment name is required');
    if (name.length > 100)
        throw bad('Installment name can be at most 100 characters');
    plainText(name, 'Installment name');
    const notes = c.values.notes !== undefined ? c.values.notes : cur?.notes ?? null;
    if (notes && notes.length > 500)
        throw bad('Notes can be at most 500 characters');
    const type = body.installment_type !== undefined ? body.installment_type : cur?.installment_type || 'installment';
    if (!PLAN_TYPES.includes(type))
        throw bad(`Type must be one of: ${PLAN_TYPES.join(', ')}`);
    let pct = cur ? (cur.percentage === null ? null : Number(cur.percentage)) : null;
    if (body.percentage !== undefined) {
        if (body.percentage === null || body.percentage === '')
            pct = null;
        else {
            pct = plainNumber(body.percentage, 3);
            if (typeof body.percentage === 'string' && !Number.isNaN(Number(body.percentage)) && Number.isNaN(pct))
                throw bad('Percentage must be a number from 0 to 100 with at most 3 decimals');
            if (!Number.isFinite(pct) || pct < 0 || pct > 100)
                throw bad('Percentage must be a number from 0 to 100');
            if (Math.round(pct * 1000) / 1000 !== pct)
                throw bad('Percentage can have at most 3 decimals');
        }
    }
    let flat = cur ? (cur.flat_amount_inr === null ? null : Number(cur.flat_amount_inr)) : null;
    if (body.flat_amount_inr !== undefined)
        flat = wholeNumber(body.flat_amount_inr, 'Amount', 0, 100000000000);
    if (type === 'other_charge') {
        if (!flat)
            throw bad('An Other Charge row needs a fixed amount');
        pct = null;
    }
    else {
        flat = null;
        if (pct === null)
            throw bad('Percentage is required');
        // only the possession row may be 0% (it takes what is left); any other row at 0% would raise a demand of nothing
        if (pct === 0 && type !== 'possession')
            throw bad('Percentage must be more than 0 for this type of row');
    }
    const days = body.due_date_offset_days !== undefined ? wholeNumber(body.due_date_offset_days, 'Due days', 0, 3650) : null;
    const index = body.installment_index !== undefined ? wholeNumber(body.installment_index, 'Order number', 1, 999) : null;
    return {
        installment_name: name, installment_type: type, percentage: pct, flat_amount_inr: flat, notes,
        due_date_offset_days: days ?? cur?.due_date_offset_days ?? 0, installment_index: index ?? cur?.installment_index ?? null,
    };
}
async function planUse(q, projectId, name) {
    const r = await q.query(`SELECT COUNT(*)::int AS n FROM booking_records WHERE project_id = $1 AND selected_plan_name = $2 AND COALESCE(status, '') NOT IN ('cancelled', 'canceled')`, [projectId, name]);
    return r.rows[0].n;
}
// One writer at a time per plan: the 100% cap, the unique names and order numbers are checked and written under this lock.
// Without it two requests at once could both pass the check and push a plan past 100%.
async function inPlanTx(projectId, name, fn) {
    const client = await index_js_1.db.connect();
    try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`plan|${projectId}|${name.toLowerCase()}`]);
        const out = await fn(client);
        await client.query('COMMIT');
        return out;
    }
    catch (e) {
        await client.query('ROLLBACK').catch(() => { });
        throw e;
    }
    finally {
        client.release();
    }
}
// A plan name that exists in another letter case is the same plan
const canonPlan = async (q, projectId, name) => (await q.query(`SELECT plan_name FROM plan_schedule_templates WHERE project_id = $1 AND lower(plan_name) = lower($2) ORDER BY plan_name LIMIT 1`, [projectId, name])).rows[0]?.plan_name || name;
const frozen = (n) => clash(`${n} booking${n === 1 ? ' uses' : 's use'} this plan, so its numbers are fixed. Make a copy of the plan and change the copy.`);
async function projectOk(id) {
    if (!idOk(id))
        throw bad('Invalid project');
    if (!(await index_js_1.db.query('SELECT 1 FROM projects WHERE id = $1', [id])).rows.length)
        throw Object.assign(new Error('Project not found'), { http: 404 });
}
// The percentages of the other rows of the plan plus `pct` must not pass 100
async function checkCap(q, projectId, name, pct, exceptId) {
    if (!pct)
        return;
    const r = await q.query(`SELECT COALESCE(SUM(percentage), 0)::numeric AS t FROM plan_schedule_templates WHERE project_id = $1 AND plan_name = $2 AND ($3::uuid IS NULL OR id <> $3)`, [projectId, name, exceptId || null]);
    const have = Number(r.rows[0].t);
    if (have + pct > 100.0005)
        throw bad(`This would bring the plan to ${(have + pct).toFixed(3)}%. The other rows already add up to ${have.toFixed(3)}%, and a plan can be 100% at most.`);
}
async function checkUnique(q, projectId, name, row, exceptId) {
    const r = await q.query(`SELECT installment_name, installment_index FROM plan_schedule_templates
      WHERE project_id = $1 AND plan_name = $2 AND ($5::uuid IS NULL OR id <> $5) AND (lower(installment_name) = lower($3) OR installment_index = $4)`, [projectId, name, row.installment_name, row.installment_index, exceptId || null]);
    for (const x of r.rows) {
        if (x.installment_name.toLowerCase() === row.installment_name.toLowerCase())
            throw clash(`This plan already has a row called "${x.installment_name}"`);
        throw clash(`Order number ${x.installment_index} is already used by "${x.installment_name}"`);
    }
}
// GET /api/projects/:id/plan-templates  (rows; used by Booking, Demand and the interest screens)
router.get('/:id/plan-templates', async (req, res, next) => {
    try {
        const { planName: pn } = req.query;
        const params = [req.params.id];
        let extra = '';
        if (pn) {
            extra = ' AND plan_name = $2';
            params.push(pn);
        }
        const result = await index_js_1.db.query(`SELECT * FROM plan_schedule_templates WHERE project_id = $1${extra} ORDER BY plan_name, installment_index`, params);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/projects/:id/plans  (one line per plan: rows, total, bookings that use it)
router.get('/:id/plans', async (req, res, next) => {
    try {
        await projectOk(req.params.id);
        const r = await index_js_1.db.query(`SELECT t.plan_name, COUNT(*)::int AS rows, COALESCE(SUM(t.percentage), 0)::float AS total_pct,
              COALESCE(SUM(t.flat_amount_inr), 0)::bigint AS flat_total, MAX(t.updated_at) AS updated_at,
              (SELECT COUNT(*)::int FROM booking_records b WHERE b.project_id = t.project_id AND b.selected_plan_name = t.plan_name
                 AND COALESCE(b.status, '') NOT IN ('cancelled', 'canceled')) AS bookings,
              COALESCE(h.plan_type, 'Time Linked') AS plan_type, h.description, COALESCE(h.timely_discount, false) AS timely_discount, COALESCE(h.discount_pct, 0)::float AS discount_pct
         FROM plan_schedule_templates t LEFT JOIN plan_headers h ON h.project_id = t.project_id AND lower(h.plan_name) = lower(t.plan_name)
         WHERE t.project_id = $1 GROUP BY t.project_id, t.plan_name, h.plan_type, h.description, h.timely_discount, h.discount_pct ORDER BY t.plan_name`, [req.params.id]);
        res.json({ success: true, data: r.rows.map((x) => ({ ...x, complete: Math.abs(x.total_pct - 100) < 0.001 })) });
    }
    catch (err) {
        planFail(err, res, next);
    }
});
// PUT /api/projects/:id/plans/header  { plan_name, plan_type, description }  (plan type and a note; the rows stay as they are)
const PLAN_KINDS = ['Construction Linked', 'Down Payment', 'Flexi', 'Time Linked'];
router.put('/:id/plans/header', async (req, res, next) => {
    try {
        await projectOk(req.params.id);
        const b = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
        const name = await canonPlan(index_js_1.db, req.params.id, planName(b.plan_name));
        const type = (0, input_js_1.oneOf)(b.plan_type ?? 'Time Linked', 'Plan type', PLAN_KINDS);
        const descr = b.description == null || b.description === '' ? null : (0, input_js_1.text)(b.description, 'Description', 500, false);
        if (!(await index_js_1.db.query('SELECT 1 FROM plan_schedule_templates WHERE project_id = $1 AND plan_name = $2 LIMIT 1', [req.params.id, name])).rows.length)
            return res.status(404).json({ error: 'Plan not found' });
        // Timely discount: a field left out keeps what the plan has
        if ('timely_discount' in b && typeof b.timely_discount !== 'boolean')
            throw bad('timely_discount must be true or false');
        const curH = (await index_js_1.db.query('SELECT timely_discount, discount_pct FROM plan_headers WHERE project_id = $1 AND lower(plan_name) = lower($2)', [req.params.id, name])).rows[0];
        const timely = 'timely_discount' in b ? b.timely_discount : curH?.timely_discount ?? false;
        const discPct = 'discount_pct' in b ? ((0, input_js_1.has)(b.discount_pct) ? (0, input_js_1.num)(b.discount_pct, 'Discount %', 100, 4) : 0) : curH ? Number(curH.discount_pct) : 0;
        if (timely && !(discPct > 0))
            throw bad('Discount % must be more than 0 when timely discount is on');
        const r = (await index_js_1.db.query(`INSERT INTO plan_headers (project_id, plan_name, plan_type, description, updated_by, timely_discount, discount_pct) VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (project_id, lower(plan_name)) DO UPDATE SET plan_type = EXCLUDED.plan_type, description = EXCLUDED.description, updated_by = EXCLUDED.updated_by, timely_discount = EXCLUDED.timely_discount, discount_pct = EXCLUDED.discount_pct, updated_at = now() RETURNING plan_name, plan_type, description, timely_discount, discount_pct::float AS discount_pct`, [req.params.id, name, type, descr, req.userId, timely, discPct])).rows[0];
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'payment_plan', req.params.id, undefined, r);
        res.json({ success: true, data: r });
    }
    catch (err) {
        planFail(err, res, next);
    }
});
// POST /api/projects/:id/plan-templates
router.post('/:id/plan-templates', async (req, res, next) => {
    try {
        await projectOk(req.params.id);
        const asked = planName(req.body?.plan_name ?? 'Standard AHP Plan');
        const row = readPlanRow(req.body);
        const made = await inPlanTx(req.params.id, asked, async (c) => {
            const name = await canonPlan(c, req.params.id, asked);
            const used = await planUse(c, req.params.id, name);
            if (used)
                throw frozen(used);
            if (row.installment_index === null) {
                row.installment_index = (await c.query(`SELECT COALESCE(MAX(installment_index), 0) + 1 AS n FROM plan_schedule_templates WHERE project_id = $1 AND plan_name = $2`, [req.params.id, name])).rows[0].n;
            }
            await checkUnique(c, req.params.id, name, row);
            await checkCap(c, req.params.id, name, row.percentage);
            return (await c.query(`INSERT INTO plan_schedule_templates
           (project_id, plan_name, installment_name, installment_type, percentage, flat_amount_inr, due_date_offset_days, installment_index, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, [req.params.id, name, row.installment_name, row.installment_type, row.percentage, row.flat_amount_inr, row.due_date_offset_days, row.installment_index, row.notes, req.userId])).rows[0];
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'payment_plan_row', made.id, undefined, made);
        res.status(201).json({ success: true, data: made });
    }
    catch (err) {
        planFail(err, res, next);
    }
});
// PATCH /api/projects/:id/plan-templates/:itemId  (only the fields sent change)
router.patch('/:id/plan-templates/:itemId', async (req, res, next) => {
    try {
        if (!idOk(req.params.id) || !idOk(req.params.itemId))
            throw bad('Invalid id');
        const first = (await index_js_1.db.query(`SELECT project_id, plan_name FROM plan_schedule_templates WHERE id = $1 AND project_id = $2`, [req.params.itemId, req.params.id])).rows[0];
        if (!first)
            return res.status(404).json({ error: 'Plan row not found' });
        const out = await inPlanTx(first.project_id, first.plan_name, async (c) => {
            const cur = (await c.query(`SELECT * FROM plan_schedule_templates WHERE id = $1 AND project_id = $2`, [req.params.itemId, req.params.id])).rows[0];
            if (!cur)
                throw Object.assign(new Error('Plan row not found'), { http: 404 });
            const row = readPlanRow(req.body, cur);
            const used = await planUse(c, cur.project_id, cur.plan_name);
            const numbersChanged = row.installment_type !== cur.installment_type || Number(row.percentage ?? -1) !== Number(cur.percentage ?? -1)
                || Number(row.flat_amount_inr ?? -1) !== Number(cur.flat_amount_inr ?? -1) || row.due_date_offset_days !== cur.due_date_offset_days
                || row.installment_index !== cur.installment_index;
            if (used && numbersChanged)
                throw frozen(used);
            await checkUnique(c, cur.project_id, cur.plan_name, row, cur.id);
            await checkCap(c, cur.project_id, cur.plan_name, row.percentage, cur.id);
            const upd = (await c.query(`UPDATE plan_schedule_templates SET installment_name = $1, installment_type = $2, percentage = $3, flat_amount_inr = $4,
                due_date_offset_days = $5, installment_index = $6, notes = $7, updated_at = NOW()
          WHERE id = $8 RETURNING *`, [row.installment_name, row.installment_type, row.percentage, row.flat_amount_inr, row.due_date_offset_days, row.installment_index, row.notes, cur.id])).rows[0];
            return { cur, upd };
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'payment_plan_row', out.cur.id, out.cur, out.upd);
        res.json({ success: true, data: out.upd });
    }
    catch (err) {
        planFail(err, res, next);
    }
});
// DELETE /api/projects/:id/plan-templates/:itemId
router.delete('/:id/plan-templates/:itemId', async (req, res, next) => {
    try {
        if (!idOk(req.params.id) || !idOk(req.params.itemId))
            throw bad('Invalid id');
        const cur = (await index_js_1.db.query(`SELECT * FROM plan_schedule_templates WHERE id = $1 AND project_id = $2`, [req.params.itemId, req.params.id])).rows[0];
        if (!cur)
            return res.status(404).json({ error: 'Plan row not found' });
        await inPlanTx(cur.project_id, cur.plan_name, async (c) => {
            const used = await planUse(c, cur.project_id, cur.plan_name);
            if (used)
                throw frozen(used);
            const gone = await c.query(`DELETE FROM plan_schedule_templates WHERE id = $1`, [cur.id]);
            if (!gone.rowCount)
                throw Object.assign(new Error('Plan row not found'), { http: 404 });
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'delete', 'payment_plan_row', cur.id, cur, undefined);
        res.json({ success: true });
    }
    catch (err) {
        planFail(err, res, next);
    }
});
// DELETE /api/projects/:id/plans?planName=...  (the whole plan)
router.delete('/:id/plans', async (req, res, next) => {
    try {
        await projectOk(req.params.id);
        const asked = planName(req.query.planName);
        const name = await canonPlan(index_js_1.db, req.params.id, asked);
        const r = await inPlanTx(req.params.id, name, async (c) => {
            const used = await planUse(c, req.params.id, name);
            if (used)
                throw frozen(used);
            await c.query(`DELETE FROM plan_headers WHERE project_id = $1 AND lower(plan_name) = lower($2)`, [req.params.id, name]);
            return c.query(`DELETE FROM plan_schedule_templates WHERE project_id = $1 AND plan_name = $2 RETURNING id`, [req.params.id, name]);
        });
        if (!r.rowCount)
            return res.status(404).json({ error: 'Plan not found' });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'delete', 'payment_plan', req.params.id, { plan_name: name, rows: r.rowCount }, undefined);
        res.json({ success: true, deleted: r.rowCount });
    }
    catch (err) {
        planFail(err, res, next);
    }
});
// POST /api/projects/:id/plans/copy  { from, to, toProjectId? }  (add-on percentages come along inside the same project)
router.post('/:id/plans/copy', async (req, res, next) => {
    try {
        await projectOk(req.params.id);
        const from = planName(req.body?.from), to = planName(req.body?.to);
        const target = req.body?.toProjectId || req.params.id;
        await projectOk(target);
        if (target === req.params.id && from.toLowerCase() === to.toLowerCase())
            throw bad('Give the copy a different name');
        const client = await index_js_1.db.connect();
        try {
            await client.query('BEGIN');
            await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`plan|${target}|${to.toLowerCase()}`]);
            if ((await client.query(`SELECT 1 FROM plan_schedule_templates WHERE project_id = $1 AND lower(plan_name) = lower($2) LIMIT 1`, [target, to])).rows.length)
                throw clash(`A plan called "${to}" already exists in that project`);
            const fromName = await canonPlan(client, req.params.id, from);
            const made = await client.query(`INSERT INTO plan_schedule_templates (project_id, plan_name, installment_name, installment_type, percentage, flat_amount_inr, due_date_offset_days, installment_index, notes, created_by)
         SELECT $1, $2, installment_name, installment_type, percentage, flat_amount_inr, due_date_offset_days, installment_index, notes, $5
           FROM plan_schedule_templates WHERE project_id = $3 AND plan_name = $4 ORDER BY installment_index RETURNING id, installment_index`, [target, to, req.params.id, fromName, req.userId]);
            if (!made.rowCount) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Plan to copy not found' });
            }
            await client.query(`INSERT INTO plan_headers (project_id, plan_name, plan_type, description, updated_by, timely_discount, discount_pct) SELECT $1, $2, plan_type, description, $5, timely_discount, discount_pct FROM plan_headers WHERE project_id = $3 AND lower(plan_name) = lower($4)`, [target, to, req.params.id, fromName, req.userId]);
            if (target === req.params.id) {
                await client.query(`INSERT INTO plan_addon_charge_pct (plan_schedule_template_id, charge_master_id, pct, created_by)
           SELECT n.id, a.charge_master_id, a.pct, $4
             FROM plan_schedule_templates o
             JOIN plan_schedule_templates n ON n.project_id = $1 AND n.plan_name = $2 AND n.installment_index = o.installment_index
             JOIN plan_addon_charge_pct a ON a.plan_schedule_template_id = o.id
            WHERE o.project_id = $1 AND o.plan_name = $3`, [target, to, fromName, req.userId]);
            }
            await client.query('COMMIT');
            await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'payment_plan', target, undefined, { plan_name: to, copied_from: from, rows: made.rowCount });
            res.status(201).json({ success: true, data: { plan_name: to, rows: made.rowCount } });
        }
        catch (e) {
            await client.query('ROLLBACK').catch(() => { });
            throw e;
        }
        finally {
            client.release();
        }
    }
    catch (err) {
        planFail(err, res, next);
    }
});
// POST /api/projects/:id/plans/standard  { plan_name }  (the usual 9-row schedule: 5 + 20 + 6 x 12.5 + possession = 100%)
const STANDARD_PLAN = [
    ['Booking Amount', 'booking', 5, 0], ['On Allotment', 'installment', 20, 15], ['1st Half-Yearly', 'installment', 12.5, 180],
    ['2nd Half-Yearly', 'installment', 12.5, 360], ['3rd Half-Yearly', 'installment', 12.5, 540], ['4th Half-Yearly', 'installment', 12.5, 720],
    ['5th Half-Yearly', 'installment', 12.5, 900], ['6th Half-Yearly', 'installment', 12.5, 1080], ['On Possession', 'possession', 0, 0],
];
router.post('/:id/plans/standard', async (req, res, next) => {
    try {
        await projectOk(req.params.id);
        const name = planName(req.body?.plan_name);
        const client = await index_js_1.db.connect();
        try {
            await client.query('BEGIN');
            await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`plan|${req.params.id}|${name.toLowerCase()}`]);
            if ((await client.query(`SELECT 1 FROM plan_schedule_templates WHERE project_id = $1 AND lower(plan_name) = lower($2) LIMIT 1`, [req.params.id, name])).rows.length)
                throw clash(`A plan called "${name}" already exists in this project`);
            for (const [i, [n, type, pct, days]] of STANDARD_PLAN.entries()) {
                await client.query(`INSERT INTO plan_schedule_templates (project_id, plan_name, installment_name, installment_type, percentage, due_date_offset_days, installment_index, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [req.params.id, name, n, type, pct, days, i + 1, req.userId]);
            }
            await client.query('COMMIT');
        }
        catch (e) {
            await client.query('ROLLBACK').catch(() => { });
            throw e;
        }
        finally {
            client.release();
        }
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'payment_plan', req.params.id, undefined, { plan_name: name, standard: true, rows: STANDARD_PLAN.length });
        res.status(201).json({ success: true, data: { plan_name: name, rows: STANDARD_PLAN.length } });
    }
    catch (err) {
        planFail(err, res, next);
    }
});
// Add-on charge percentages of one row. The row must belong to this project and the charge to the same project.
async function addonRow(projectId, templateId) {
    if (!idOk(projectId) || !idOk(templateId))
        throw bad('Invalid id');
    const t = (await index_js_1.db.query(`SELECT * FROM plan_schedule_templates WHERE id = $1 AND project_id = $2`, [templateId, projectId])).rows[0];
    if (!t)
        throw Object.assign(new Error('Plan row not found'), { http: 404 });
    return t;
}
// GET /api/projects/:id/plan-templates/:templateId/addon-charges
router.get('/:id/plan-templates/:templateId/addon-charges', async (req, res, next) => {
    try {
        await addonRow(req.params.id, req.params.templateId);
        const result = await index_js_1.db.query(`SELECT pacp.id, pacp.plan_schedule_template_id, pacp.charge_master_id, pacp.pct, acm.charge_name, acm.cgst_pct, acm.sgst_pct, acm.default_amount
         FROM plan_addon_charge_pct pacp JOIN addon_charge_master acm ON acm.id = pacp.charge_master_id
        WHERE pacp.plan_schedule_template_id = $1 ORDER BY acm.charge_name ASC`, [req.params.templateId]);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        planFail(err, res, next);
    }
});
// POST /api/projects/:id/addon-charge-billing   { charge_master_id, when: 'booking' | 'possession' | 'equal' }
// Says when a charge is billed, in every plan of the project at once: with the booking row, with the last row, or in equal shares over all the installments.
// A plan that already has bookings is fixed, so it is skipped and listed; the answer says which plans were set and which were not.
router.post('/:id/addon-charge-billing', async (req, res, next) => {
    try {
        const id = req.params.id;
        await projectOk(id);
        const b = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
        if (!idOk(b.charge_master_id))
            throw bad('Choose an add-on charge');
        const when = (0, input_js_1.oneOf)(b.when, 'When', ['booking', 'possession', 'equal']);
        if (!when)
            throw bad('Say when the charge is billed: booking, possession or equal');
        if (!(await index_js_1.db.query(`SELECT 1 FROM addon_charge_master WHERE id = $1 AND project_id = $2`, [b.charge_master_id, id])).rows.length)
            throw bad('That add-on charge does not belong to this project');
        const plans = (await index_js_1.db.query(`SELECT DISTINCT plan_name FROM plan_schedule_templates WHERE project_id = $1 ORDER BY plan_name`, [id])).rows.map((r) => r.plan_name);
        const applied = [], skipped = [];
        for (const name of plans) {
            const done = await inPlanTx(id, name, async (c) => {
                if (await planUse(c, id, name))
                    return false;
                const rows = (await c.query(`SELECT id, installment_type FROM plan_schedule_templates WHERE project_id = $1 AND plan_name = $2 ORDER BY installment_index, created_at`, [id, name])).rows;
                if (!rows.length)
                    return false;
                const first = rows.find((r) => r.installment_type === 'booking') ?? rows[0], last = [...rows].reverse().find((r) => r.installment_type === 'possession') ?? rows[rows.length - 1];
                const parts = when === 'booking' ? [{ row: first, pct: 100 }] : when === 'possession' ? [{ row: last, pct: 100 }]
                    : (() => { const rs = rows.filter((r) => r.installment_type === 'booking' || r.installment_type === 'installment'), each = Math.floor(100000 / rs.length) / 1000; return rs.map((row, i) => ({ row, pct: i === rs.length - 1 ? Math.round((100 - each * (rs.length - 1)) * 1000) / 1000 : each })); })();
                await c.query(`DELETE FROM plan_addon_charge_pct WHERE charge_master_id = $1 AND plan_schedule_template_id = ANY($2::uuid[])`, [b.charge_master_id, rows.map((r) => r.id)]);
                for (const x of parts)
                    await c.query(`INSERT INTO plan_addon_charge_pct (plan_schedule_template_id, charge_master_id, pct, created_by) VALUES ($1, $2, $3, $4)`, [x.row.id, b.charge_master_id, x.pct, req.userId || null]);
                return true;
            });
            (done ? applied : skipped).push(name);
        }
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'payment_plan_addon_pct', id, undefined, { charge_master_id: b.charge_master_id, when, applied, skipped });
        res.json({ success: true, data: { when, applied, skipped } });
    }
    catch (err) {
        planFail(err, res, next);
    }
});
// POST /api/projects/:id/plan-templates/:templateId/addon-charges   { charge_master_id, pct }
// Over all rows of the plan, one charge can total 100% at most.
router.post('/:id/plan-templates/:templateId/addon-charges', async (req, res, next) => {
    try {
        const { id, templateId } = req.params;
        const t = await addonRow(id, templateId);
        const { charge_master_id, pct } = req.body || {};
        const pctNum = plainNumber(pct, 3);
        if (!Number.isFinite(pctNum) || pctNum < 0 || pctNum > 100)
            throw bad('Percentage must be a number from 0 to 100 with at most 3 decimals');
        if (!idOk(charge_master_id))
            throw bad('Choose an add-on charge');
        if (!(await index_js_1.db.query(`SELECT 1 FROM addon_charge_master WHERE id = $1 AND project_id = $2`, [charge_master_id, id])).rows.length)
            throw bad('That add-on charge does not belong to this project');
        const saved = await inPlanTx(id, t.plan_name, async (c) => {
            const used = await planUse(c, id, t.plan_name);
            if (used)
                throw frozen(used);
            const sum = await c.query(`SELECT COALESCE(SUM(a.pct), 0)::numeric AS s FROM plan_addon_charge_pct a JOIN plan_schedule_templates p ON p.id = a.plan_schedule_template_id
          WHERE p.plan_name = $1 AND p.project_id = $2 AND a.charge_master_id = $3 AND a.plan_schedule_template_id <> $4`, [t.plan_name, id, charge_master_id, templateId]);
            const have = Number(sum.rows[0].s);
            if (have + pctNum > 100.0005)
                throw bad(`This add-on charge would total ${(have + pctNum).toFixed(3)}% in this plan. The other rows already have ${have.toFixed(3)}%.`);
            return (await c.query(`INSERT INTO plan_addon_charge_pct (plan_schedule_template_id, charge_master_id, pct, created_by) VALUES ($1, $2, $3, $4)
         ON CONFLICT (plan_schedule_template_id, charge_master_id) DO UPDATE SET pct = EXCLUDED.pct, updated_at = NOW() RETURNING *`, [templateId, charge_master_id, pctNum, req.userId || null])).rows[0];
        });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'payment_plan_addon_pct', saved.id, undefined, saved);
        res.json({ success: true, data: saved });
    }
    catch (err) {
        planFail(err, res, next);
    }
});
// DELETE /api/projects/:id/plan-templates/:templateId/addon-charges/:chargeId
router.delete('/:id/plan-templates/:templateId/addon-charges/:chargeId', async (req, res, next) => {
    try {
        const t = await addonRow(req.params.id, req.params.templateId);
        if (!idOk(req.params.chargeId))
            throw bad('Invalid id');
        const used = await planUse(index_js_1.db, req.params.id, t.plan_name);
        if (used)
            throw frozen(used);
        const r = await index_js_1.db.query(`DELETE FROM plan_addon_charge_pct WHERE id = $1 AND plan_schedule_template_id = $2 RETURNING id`, [req.params.chargeId, req.params.templateId]);
        if (!r.rowCount)
            return res.status(404).json({ error: 'Add-on percentage not found' });
        res.json({ success: true });
    }
    catch (err) {
        planFail(err, res, next);
    }
});
// GET /api/projects/:id/plan-addon-pcts?planName=CLP@92
// Returns all addon pcts for all installments in a plan (used by Stage 2 demand creation)
router.get('/:id/plan-addon-pcts', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { planName } = req.query;
        const result = await index_js_1.db.query(`SELECT
         pacp.plan_schedule_template_id,
         pacp.charge_master_id,
         pacp.pct,
         pst.installment_index,
         acm.charge_name,
         acm.cgst_pct,
         acm.sgst_pct
       FROM plan_addon_charge_pct pacp
       JOIN plan_schedule_templates pst ON pst.id = pacp.plan_schedule_template_id
       JOIN addon_charge_master acm ON acm.id = pacp.charge_master_id
       WHERE pst.project_id = $1
         AND pst.plan_name = $2
       ORDER BY pst.installment_index, acm.charge_name`, [id, planName]);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/projects/:id
router.get('/:id', unitStatusAccess_js_1.applyUnitStatusFilter, async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await index_js_1.db.query(`SELECT * FROM projects WHERE id = $1`, [id]);
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Project not found' });
        const tp = [id];
        const towers = await index_js_1.db.query(`SELECT t.id, t.tower_name, COUNT(u.id) as unit_count
       FROM towers t LEFT JOIN units u ON t.id = u.tower_id${(0, unit_grant_js_1.grantClause)(req.unitStatusFilter, 'u.status', tp)}
       WHERE t.project_id = $1 GROUP BY t.id ORDER BY t.tower_name`, tp);
        // DATE columns arrive as JS Dates (local midnight); send the plain day so a screen in any time zone shows the day that was saved
        const row = { ...result.rows[0] };
        for (const k of Object.keys(row))
            if (row[k] instanceof Date && /date$/.test(k))
                row[k] = `${row[k].getFullYear()}-${String(row[k].getMonth() + 1).padStart(2, '0')}-${String(row[k].getDate()).padStart(2, '0')}`;
        res.json({ success: true, data: { ...row, towers: towers.rows } });
    }
    catch (error) {
        next(error);
    }
});
// PATCH /api/projects/:id
router.patch('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const cleanedNames = (0, master_js_1.cleanBody)(req.body, ['name', 'location']);
        if ('error' in cleanedNames)
            return res.status(400).json({ error: cleanedNames.error });
        const { name, location } = cleanedNames.values;
        if (req.body && 'name' in req.body && !name)
            return res.status(400).json({ error: 'Project name is required' });
        if (name) {
            const sameName = await index_js_1.db.query('SELECT 1 FROM projects WHERE lower(name) = lower($1) AND id::text <> $2', [name, id]);
            if (sameName.rows.length)
                return res.status(409).json({ error: 'A project with this name already exists' });
        }
        // Every field is checked before anything is saved; a field left out keeps its stored value
        const rb = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
        const vb = { ...rb };
        const TEXT_LIMITS = { envClearanceNo: 200, buildingPlanMemoNo: 200, landOwnerName: 300, landOwnerLlpin: 50, landOwnerAddress: 1000, landOwnerGpaVasikaNo: 100, saleDeedNo: 100,
            occupationCertMemoNo: 200, deedOfDeclarationVasikaNo: 100, khasraDetails: 2000, villageName: 200, sectorName: 100, subRegistrarOffice: 200, authorisedSignatoryName: 200 };
        for (const [k, max] of Object.entries(TEXT_LIMITS))
            if ((0, input_js_1.has)(rb[k]))
                vb[k] = (0, input_js_1.text)(rb[k], k, max, false);
        for (const k of ['licenseDate', 'envClearanceDate', 'buildingPlanDate', 'collaborationAgreementDate', 'landOwnerGpaDate', 'saleDeedDate', 'occupationCertDate', 'deedOfDeclarationDate', 'boardResolutionDate'])
            if ((0, input_js_1.has)(rb[k]))
                vb[k] = (0, input_js_1.day)(rb[k], k);
        if ((0, input_js_1.has)(rb.landOwnerPan)) {
            const p = (0, input_js_1.text)(rb.landOwnerPan, 'PAN', 20, false);
            if (p && !/^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/.test(p))
                throw bad('PAN must look like ABCDE1234F');
            vb.landOwnerPan = p && p.toUpperCase();
        }
        if ((0, input_js_1.has)(rb.authorisedSignatoryAadhaar)) {
            const a = (0, input_js_1.text)(rb.authorisedSignatoryAadhaar, 'Aadhaar', 20, false);
            if (a && !/^\d{4} ?\d{4} ?\d{4}$/.test(a))
                throw bad('Aadhaar must be 12 digits');
            vb.authorisedSignatoryAadhaar = a;
        }
        if ((0, input_js_1.has)(rb.companyId)) {
            vb.companyId = (0, input_js_1.uuid)(rb.companyId, 'companyId');
            if (!(await index_js_1.db.query('SELECT 1 FROM companies WHERE id = $1', [vb.companyId])).rows.length)
                throw bad('This company does not exist');
        }
        // RERA and licence are required on a new project, so a blank edit is refused (a field left out keeps its value); RERA stays unique
        for (const [k, label] of [['reraNumber', 'RERA number'], ['tcpLicence', 'TCP licence']])
            if (k in rb) {
                vb[k] = (0, input_js_1.text)(rb[k], label, 100, true);
            }
        if (vb.reraNumber && (await index_js_1.db.query('SELECT 1 FROM projects WHERE lower(rera_number) = lower($1) AND id::text <> $2', [vb.reraNumber, id])).rows.length)
            return res.status(409).json({ error: 'Another project already has this RERA number' });
        if ((0, input_js_1.has)(rb.landAreaSqft))
            vb.landAreaSqft = (0, input_js_1.num)(rb.landAreaSqft, 'Land area', 10000000000, 4);
        if ((0, input_js_1.has)(rb.possessionDate))
            vb.possessionDate = (0, input_js_1.day)(rb.possessionDate, 'Possession date');
        if ((0, input_js_1.has)(rb.incomeCategory))
            vb.incomeCategory = (0, input_js_1.text)(rb.incomeCategory, 'Category', 100, false);
        if ((0, input_js_1.has)(rb.totalUnits)) {
            vb.totalUnits = (0, input_js_1.num)(rb.totalUnits, 'Total units', 100000, 0);
            const have = Number((await index_js_1.db.query('SELECT count(*) AS n FROM units WHERE project_id = $1', [id])).rows[0].n);
            if (vb.totalUnits < have)
                throw bad(`The project already has ${have} units, so Total units cannot be less than that`);
        }
        const { totalUnits, licenseDate, envClearanceNo, envClearanceDate, buildingPlanMemoNo, buildingPlanDate, collaborationAgreementDate, landOwnerName, landOwnerLlpin, landOwnerPan, landOwnerAddress, landOwnerGpaVasikaNo, landOwnerGpaDate, saleDeedNo, saleDeedDate, occupationCertMemoNo, occupationCertDate, deedOfDeclarationVasikaNo, deedOfDeclarationDate, khasraDetails, villageName, sectorName, subRegistrarOffice, authorisedSignatoryName, authorisedSignatoryAadhaar, boardResolutionDate, companyId, reraNumber, tcpLicence, landAreaSqft, possessionDate, incomeCategory, } = vb;
        const result = await index_js_1.db.query(`UPDATE projects SET
         name = COALESCE($1, name),
         location = COALESCE($2, location),
         total_units = COALESCE($3, total_units),
         license_date = COALESCE($4::date, license_date),
         env_clearance_no = COALESCE($5, env_clearance_no),
         env_clearance_date = COALESCE($6::date, env_clearance_date),
         building_plan_memo_no = COALESCE($7, building_plan_memo_no),
         building_plan_date = COALESCE($8::date, building_plan_date),
         collaboration_agreement_date = COALESCE($9::date, collaboration_agreement_date),
         land_owner_name = COALESCE($10, land_owner_name),
         land_owner_llpin = COALESCE($11, land_owner_llpin),
         land_owner_pan = COALESCE($12, land_owner_pan),
         land_owner_address = COALESCE($13, land_owner_address),
         land_owner_gpa_vasika_no = COALESCE($14, land_owner_gpa_vasika_no),
         land_owner_gpa_date = COALESCE($15::date, land_owner_gpa_date),
         sale_deed_no = COALESCE($16, sale_deed_no),
         sale_deed_date = COALESCE($17::date, sale_deed_date),
         occupation_cert_memo_no = COALESCE($18, occupation_cert_memo_no),
         occupation_cert_date = COALESCE($19::date, occupation_cert_date),
         deed_of_declaration_vasika_no = COALESCE($20, deed_of_declaration_vasika_no),
         deed_of_declaration_date = COALESCE($21::date, deed_of_declaration_date),
         khasra_details = COALESCE($22, khasra_details),
         village_name = COALESCE($23, village_name),
         sector_name = COALESCE($24, sector_name),
         sub_registrar_office = COALESCE($25, sub_registrar_office),
         authorised_signatory_name = COALESCE($26, authorised_signatory_name),
         authorised_signatory_aadhaar = COALESCE($27, authorised_signatory_aadhaar),
         board_resolution_date = COALESCE($28::date, board_resolution_date),
         company_id = COALESCE($29::uuid, company_id),
         rera_number = COALESCE($31, rera_number),
         tcp_licence = COALESCE($32, tcp_licence),
         land_area_sqft = COALESCE($33, land_area_sqft),
         possession_date = COALESCE($34::date, possession_date),
         group_name = COALESCE($35, group_name),
         updated_at = NOW()
       WHERE id = $30
       RETURNING *`, [
            name || null,
            location || null,
            (0, input_js_1.has)(totalUnits) ? Number(totalUnits) : null,
            licenseDate || null,
            envClearanceNo || null,
            envClearanceDate || null,
            buildingPlanMemoNo || null,
            buildingPlanDate || null,
            collaborationAgreementDate || null,
            landOwnerName || null,
            landOwnerLlpin || null,
            landOwnerPan || null,
            landOwnerAddress || null,
            landOwnerGpaVasikaNo || null,
            landOwnerGpaDate || null,
            saleDeedNo || null,
            saleDeedDate || null,
            occupationCertMemoNo || null,
            occupationCertDate || null,
            deedOfDeclarationVasikaNo || null,
            deedOfDeclarationDate || null,
            khasraDetails || null,
            villageName || null,
            sectorName || null,
            subRegistrarOffice || null,
            authorisedSignatoryName || null,
            authorisedSignatoryAadhaar || null,
            boardResolutionDate || null,
            companyId || null,
            id,
            reraNumber || null, tcpLicence || null,
            (0, input_js_1.has)(landAreaSqft) ? Number(landAreaSqft) : null, possessionDate || null, incomeCategory || null,
        ]);
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Project not found' });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'project', id, undefined, result.rows[0]);
        res.json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        planFail(error, res, next);
    }
});
// GET /api/projects/:id/towers
router.get('/:id/towers', unitStatusAccess_js_1.applyUnitStatusFilter, async (req, res, next) => {
    try {
        const tp = [req.params.id];
        const result = await index_js_1.db.query(`SELECT t.id, t.tower_name, t.project_id, t.address_prefix, t.sort_order, t.completion_date::text AS completion_date, COUNT(u.id) as unit_count
       FROM towers t LEFT JOIN units u ON t.id = u.tower_id${(0, unit_grant_js_1.grantClause)(req.unitStatusFilter, 'u.status', tp)}
       WHERE t.project_id = $1 GROUP BY t.id ORDER BY t.sort_order NULLS LAST, t.tower_name`, tp);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/projects/:id/towers
router.post('/:id/towers', async (req, res, next) => {
    try {
        const { id } = req.params;
        const cleaned = (0, master_js_1.cleanBody)(req.body, ['towerName']);
        if ('error' in cleaned)
            return res.status(400).json({ error: cleaned.error });
        const { towerName } = cleaned.values;
        if (!towerName)
            return res.status(400).json({ error: 'towerName is required' });
        const exists = await index_js_1.db.query(`SELECT 1 FROM towers WHERE project_id = $1 AND lower(tower_name) = lower($2)`, [id, towerName]);
        if (exists.rows.length)
            return res.status(409).json({ error: 'A tower with this name already exists in this project' });
        const result = await index_js_1.db.query(`INSERT INTO towers (project_id, tower_name) VALUES ($1, $2)
       RETURNING id, tower_name, project_id`, [id, towerName]);
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'tower', result.rows[0].id, undefined, result.rows[0]);
        res.status(201).json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/projects/:id/towers/:towerId
router.get('/:id/towers/:towerId', unitStatusAccess_js_1.applyUnitStatusFilter, async (req, res, next) => {
    try {
        const tp = [req.params.id, req.params.towerId];
        const result = await index_js_1.db.query(`SELECT t.id, t.tower_name, t.project_id, COUNT(u.id) as unit_count
       FROM towers t LEFT JOIN units u ON t.id = u.tower_id${(0, unit_grant_js_1.grantClause)(req.unitStatusFilter, 'u.status', tp)}
       WHERE t.project_id = $1 AND t.id = $2
       GROUP BY t.id
       LIMIT 1`, tp);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Tower not found' });
        }
        res.json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
// DELETE /api/projects/:id/towers/:towerId
router.delete('/:id/towers/:towerId', async (req, res, next) => {
    try {
        const unitCheck = await index_js_1.db.query(`SELECT COUNT(*) as count FROM units WHERE tower_id = $1`, [req.params.towerId]);
        const unitCount = parseInt(unitCheck.rows[0].count);
        if (unitCount > 0) {
            return res.status(400).json({
                success: false,
                error: `Cannot delete tower. It has ${unitCount} unit(s) linked to it. Please remove all units first.`
            });
        }
        const result = await index_js_1.db.query(`DELETE FROM towers WHERE id = $1 AND project_id = $2`, [req.params.towerId, req.params.id]);
        if (!result.rowCount)
            return res.status(404).json({ error: 'Tower not found' });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'delete', 'tower', req.params.towerId, undefined, { project_id: req.params.id });
        res.json({ success: true });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/projects/:id/payment-plans
router.get('/:id/payment-plans', async (req, res, next) => {
    try {
        const result = await index_js_1.db.query(`SELECT
         pp.id,
         pp.total_amount_inr AS total_amount,
         pp.created_at,
         u.unit_number,
         c.name AS consumer_name,
         c.mobile,
         COALESCE(paid.total_paid, 0) AS total_paid,
         pp.total_amount_inr - COALESCE(paid.total_paid, 0) AS outstanding,
         CASE
           WHEN pp.total_amount_inr = 0 THEN 'active'
           WHEN COALESCE(paid.total_paid, 0) >= pp.total_amount_inr THEN 'completed'
           ELSE 'active'
         END AS status
       FROM payment_plans pp
       LEFT JOIN units u ON u.id = pp.unit_id
       LEFT JOIN consumers c ON c.id = pp.consumer_id
       LEFT JOIN (
         SELECT payment_plan_id, SUM(amount_received_inr) AS total_paid
         FROM receipts
         GROUP BY payment_plan_id
       ) paid ON paid.payment_plan_id = pp.id
       WHERE pp.project_id = $1
       ORDER BY pp.created_at DESC`, [req.params.id]);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/projects/:id/unit-locations
router.get('/:id/unit-locations', async (req, res, next) => {
    try {
        const result = await index_js_1.db.query(`SELECT * FROM unit_locations WHERE project_id = $1 ORDER BY name`, [req.params.id]);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/projects/:id/unit-locations
router.post('/:id/unit-locations', async (req, res, next) => {
    try {
        const cleaned = (0, master_js_1.cleanBody)(req.body, ['name', 'description']);
        if ('error' in cleaned)
            return res.status(400).json({ error: cleaned.error });
        const { name, description } = cleaned.values;
        if (!name)
            return res.status(400).json({ error: 'name is required' });
        const dup = await index_js_1.db.query(`SELECT 1 FROM unit_locations WHERE project_id = $1 AND lower(name) = lower($2)`, [req.params.id, name]);
        if (dup.rows.length)
            return res.status(409).json({ error: 'A unit location with this name already exists in this project' });
        const result = await index_js_1.db.query(`INSERT INTO unit_locations (project_id, name, description) VALUES ($1, $2, $3) RETURNING *`, [req.params.id, name, description || null]);
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'unit_location', result.rows[0].id, undefined, result.rows[0]);
        res.status(201).json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
// PATCH /api/projects/:id/unit-locations/:locId (rename or change the description)
router.patch('/:id/unit-locations/:locId', async (req, res, next) => {
    try {
        const cleaned = (0, master_js_1.cleanBody)(req.body, ['name', 'description']);
        if ('error' in cleaned)
            return res.status(400).json({ error: cleaned.error });
        const { name, description } = cleaned.values;
        if (!name)
            return res.status(400).json({ error: 'name is required' });
        const dup = await index_js_1.db.query(`SELECT 1 FROM unit_locations WHERE project_id = $1 AND lower(name) = lower($2) AND id::text <> $3`, [req.params.id, name, req.params.locId]);
        if (dup.rows.length)
            return res.status(409).json({ error: 'A unit location with this name already exists in this project' });
        const before = (await index_js_1.db.query('SELECT * FROM unit_locations WHERE id = $1 AND project_id = $2', [req.params.locId, req.params.id])).rows[0];
        if (!before)
            return res.status(404).json({ error: 'Unit location not found' });
        const result = await index_js_1.db.query(`UPDATE unit_locations SET name = $1, description = $2 WHERE id = $3 RETURNING *`, [name, description || null, req.params.locId]);
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'unit_location', req.params.locId, before, result.rows[0]);
        res.json({ success: true, data: result.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
// DELETE /api/projects/:id/unit-locations/:locId
router.delete('/:id/unit-locations/:locId', async (req, res, next) => {
    try {
        const used = Number((await index_js_1.db.query(`SELECT (SELECT count(*) FROM units WHERE unit_location_id = $1) + (SELECT count(*) FROM plc_charges WHERE unit_location_id = $1) AS n`, [req.params.locId])).rows[0].n);
        if (used)
            return res.status(409).json({ error: 'This location is used by units or a PLC rate. Remove those first.' });
        const result = await index_js_1.db.query(`DELETE FROM unit_locations WHERE id = $1 AND project_id = $2`, [req.params.locId, req.params.id]);
        if (!result.rowCount)
            return res.status(404).json({ error: 'Unit location not found' });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'delete', 'unit_location', req.params.locId, undefined, { project_id: req.params.id });
        res.json({ success: true });
    }
    catch (err) {
        next(err);
    }
});
// ── Numbering settings of one project ──
const prefixOf = (v, label) => {
    if (v == null || v === '')
        return null;
    const x = (0, input_js_1.text)(v, label, 10, true).toUpperCase();
    if (!/^[A-Z0-9-]{1,10}$/.test(x))
        throw bad(`${label} can have only letters, digits and a dash`);
    return x;
};
router.get('/:id/settings', async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Project id');
        if (!(await index_js_1.db.query('SELECT 1 FROM projects WHERE id = $1', [id])).rows.length)
            return res.status(404).json({ error: 'Project not found' });
        res.json({ success: true, data: await (0, project_settings_js_1.projectSettings)(index_js_1.db, id) });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
router.put('/:id/settings', async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Project id'), b = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
        if (!(await index_js_1.db.query('SELECT 1 FROM projects WHERE id = $1', [id])).rows.length)
            return res.status(404).json({ error: 'Project not found' });
        const cur = await (0, project_settings_js_1.projectSettings)(index_js_1.db, id);
        const next_ = {
            receipt_prefix: 'receipt_prefix' in b ? prefixOf(b.receipt_prefix, 'Receipt prefix') : cur.receipt_prefix,
            receipt_number_mode: 'receipt_number_mode' in b ? (0, input_js_1.oneOf)(b.receipt_number_mode, 'Receipt number mode', ['Automatic', 'Manual']) : cur.receipt_number_mode,
            registration_prefix: 'registration_prefix' in b ? prefixOf(b.registration_prefix, 'Registration prefix') : cur.registration_prefix,
            registration_number_mode: 'registration_number_mode' in b ? (0, input_js_1.oneOf)(b.registration_number_mode, 'Registration number mode', ['Automatic', 'Manual']) : cur.registration_number_mode,
            registration_number_size: 'registration_number_size' in b ? (0, input_js_1.num)(b.registration_number_size, 'Registration number size', 8, 0) : cur.registration_number_size,
            broker_auth_mode: 'broker_auth_mode' in b ? (0, input_js_1.oneOf)(b.broker_auth_mode, 'Broker authentication', ['Automatic', 'Manual']) : cur.broker_auth_mode,
            journal_auth_mode: 'journal_auth_mode' in b ? (0, input_js_1.oneOf)(b.journal_auth_mode, 'Journal / credit and debit note authentication', ['Automatic', 'Manual']) : cur.journal_auth_mode,
            // blank = no project rule; a number must be more than 0
            balcony_max_charge_inr: 'balcony_max_charge_inr' in b ? ((0, input_js_1.has)(b.balcony_max_charge_inr) ? (0, input_js_1.num)(b.balcony_max_charge_inr, 'Largest balcony charge', 1000000000, 2) : null) : cur.balcony_max_charge_inr,
            balcony_max_area_sqft: 'balcony_max_area_sqft' in b ? ((0, input_js_1.has)(b.balcony_max_area_sqft) ? (0, input_js_1.num)(b.balcony_max_area_sqft, 'Balcony area charged', 100000, 3) : null) : cur.balcony_max_area_sqft,
        };
        for (const [k, label] of [['balcony_max_charge_inr', 'Largest balcony charge'], ['balcony_max_area_sqft', 'Balcony area charged']])
            if (next_[k] === 0)
                throw bad(`${label} must be more than 0, or left blank for no limit`);
        if (!Number.isInteger(next_.registration_number_size) || next_.registration_number_size < 3)
            throw bad('Registration number size must be a whole number from 3 to 8');
        const r = (await index_js_1.db.query(`INSERT INTO project_settings (project_id, receipt_prefix, receipt_number_mode, registration_prefix, registration_number_mode, registration_number_size, balcony_max_charge_inr, balcony_max_area_sqft, updated_by, broker_auth_mode, journal_auth_mode)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (project_id) DO UPDATE SET receipt_prefix = EXCLUDED.receipt_prefix, receipt_number_mode = EXCLUDED.receipt_number_mode, registration_prefix = EXCLUDED.registration_prefix,
         registration_number_mode = EXCLUDED.registration_number_mode, registration_number_size = EXCLUDED.registration_number_size, balcony_max_charge_inr = EXCLUDED.balcony_max_charge_inr, balcony_max_area_sqft = EXCLUDED.balcony_max_area_sqft, broker_auth_mode = EXCLUDED.broker_auth_mode, journal_auth_mode = EXCLUDED.journal_auth_mode, updated_by = EXCLUDED.updated_by, updated_at = now()
       RETURNING receipt_prefix, receipt_number_mode, registration_prefix, registration_number_mode, registration_number_size, broker_auth_mode, journal_auth_mode, balcony_max_charge_inr::float8, balcony_max_area_sqft::float8`, [id, next_.receipt_prefix, next_.receipt_number_mode, next_.registration_prefix, next_.registration_number_mode, next_.registration_number_size, next_.balcony_max_charge_inr, next_.balcony_max_area_sqft, req.userId, next_.broker_auth_mode, next_.journal_auth_mode])).rows[0];
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'project_settings', id, cur, r);
        res.json({ success: true, data: r });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
router.use(pg_errors_js_1.pgErrorHandler);
// ── Project type, the unit of the land area, and the tower fields of the client's Edit Tower screen ──────────────────────
const PROJECT_TYPES = ['Commercial', 'Residential', 'Plotting', 'Group Housing', 'SCO'];
const cardInput = async (b) => {
    const out = {};
    if ('projectType' in b)
        out.project_type = b.projectType === null || b.projectType === '' ? null : (0, input_js_1.oneOf)(b.projectType, 'Project type', PROJECT_TYPES);
    if ('landAreaUnit' in b) {
        const u = b.landAreaUnit === null || b.landAreaUnit === '' ? null : (0, input_js_1.text)(b.landAreaUnit, 'Land area unit', 50, true);
        if (u && !(await index_js_1.db.query('SELECT 1 FROM area_types WHERE lower(name) = lower($1)', [u])).rows.length)
            throw bad('Land area unit must be one of the Area Types in Set Master');
        out.land_area_unit = u;
    }
    return out;
};
router.patch('/:id/card', async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Project id');
        const b = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
        const f = await cardInput(b);
        if (!Object.keys(f).length)
            throw bad('Nothing to update');
        const cur = (await index_js_1.db.query('SELECT project_type, land_area_unit FROM projects WHERE id = $1', [id])).rows[0];
        if (!cur)
            return res.status(404).json({ error: 'Project not found' });
        const keys = Object.keys(f);
        const r = await index_js_1.db.query(`UPDATE projects SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_at = now() WHERE id = $1 RETURNING id, name, project_type, land_area_unit`, [id, ...keys.map(k => f[k])]);
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'project', id, cur, f);
        res.json({ success: true, data: r.rows[0] });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
router.patch('/:id/towers/:towerId', async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Project id'), tid = (0, input_js_1.uuid)(req.params.towerId, 'Tower id');
        const b = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
        const f = {};
        if ('towerName' in b) {
            f.tower_name = (0, input_js_1.text)(b.towerName, 'Tower name', 100, true);
        }
        if ('addressPrefix' in b)
            f.address_prefix = (0, input_js_1.text)(b.addressPrefix, 'Prefix for unit address', 20, false);
        if ('sortOrder' in b)
            f.sort_order = b.sortOrder === null || b.sortOrder === '' ? null : (0, input_js_1.num)(b.sortOrder, 'Sort order', 100000, 0);
        if (f.sort_order != null && !Number.isInteger(f.sort_order))
            throw bad('Sort order must be a whole number');
        if ('completionDate' in b)
            f.completion_date = b.completionDate === null || b.completionDate === '' ? null : (0, input_js_1.day)(b.completionDate, 'Completion date');
        if (!Object.keys(f).length)
            throw bad('Nothing to update');
        const cur = (await index_js_1.db.query('SELECT tower_name, address_prefix, sort_order, completion_date::text AS completion_date FROM towers WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL', [tid, id])).rows[0];
        if (!cur)
            return res.status(404).json({ error: 'Tower not found in this project' });
        if (f.tower_name && (await index_js_1.db.query('SELECT 1 FROM towers WHERE project_id = $1 AND lower(tower_name) = lower($2) AND id <> $3 AND deleted_at IS NULL', [id, f.tower_name, tid])).rows.length)
            return res.status(409).json({ error: 'A tower with this name already exists in this project' });
        const keys = Object.keys(f);
        const r = await index_js_1.db.query(`UPDATE towers SET ${keys.map((k, i) => `${k} = $${i + 3}`).join(', ')}, updated_at = now() WHERE id = $1 AND project_id = $2 RETURNING id, tower_name, address_prefix, sort_order, completion_date::text AS completion_date`, [tid, id, ...keys.map(k => f[k])]);
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'tower', tid, cur, r.rows[0]);
        res.json({ success: true, data: r.rows[0] });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// ── Floors: a tower's floors with the name each one shows (Ground Floor, 1st Floor, First Floor ...) ──
// A unit stores its floor as a number; the name of a floor is kept in `floors` per tower and used where a floor is printed.
const ordinalNo = (n) => { const v = n % 100, sfx = ['th', 'st', 'nd', 'rd']; return n + (sfx[(v - 20) % 10] || sfx[v] || sfx[0]); };
const ONES = ['', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth', 'Thirteenth', 'Fourteenth', 'Fifteenth', 'Sixteenth', 'Seventeenth', 'Eighteenth', 'Nineteenth'];
const TENS_TH = ['', '', 'Twentieth', 'Thirtieth', 'Fortieth', 'Fiftieth', 'Sixtieth', 'Seventieth', 'Eightieth', 'Ninetieth'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const ordinalWords = (n) => n === 100 ? 'Hundredth' : n < 20 ? ONES[n] : n % 10 === 0 ? TENS_TH[n / 10] : `${TENS[Math.floor(n / 10)]}-${ONES[n % 10]}`;
const defaultFloorLabel = (n) => n === 0 ? 'Ground Floor' : n < 0 ? `Basement ${-n}` : `${ordinalNo(n)} Floor`;
const FLOOR_STYLES = ['number', 'ordinal', 'words'];
const floorPart = (style, n) => n === 0 ? 'Ground' : n < 0 ? `Basement ${-n}` : style === 'number' ? String(n) : style === 'ordinal' ? ordinalNo(n) : ordinalWords(n);
const floorNo = (v, label) => { const n = typeof v === 'number' ? v : typeof v === 'string' && /^-?\d{1,3}$/.test(v) ? Number(v) : NaN; if (!Number.isInteger(n) || n < -5 || n > 300)
    throw bad(`${label} must be a whole number from -5 to 300`); return n; };
const towerOf = async (projectId, towerId) => {
    const t = (await index_js_1.db.query('SELECT id, tower_name FROM towers WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL', [towerId, projectId])).rows[0];
    if (!t)
        throw Object.assign(bad('Tower not found in this project'), { http: 404 });
    return t;
};
// GET /api/projects/:id/towers/:towerId/floors  (every floor that has a unit or a name, with its unit count)
router.get('/:id/towers/:towerId/floors', unitStatusAccess_js_1.applyUnitStatusFilter, async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Project id'), tid = (0, input_js_1.uuid)(req.params.towerId, 'Tower id');
        await towerOf(id, tid);
        const fp = [tid]; // the floor list is the tower's structure (kept); only the per-floor unit count follows the grant
        const rows = (await index_js_1.db.query(`SELECT n.floor_number, f.floor_name, COALESCE(u.units, 0)::int AS units
         FROM (SELECT floor_number FROM floors WHERE tower_id = $1 UNION SELECT floor FROM units WHERE tower_id = $1 AND floor IS NOT NULL) n
         LEFT JOIN floors f ON f.tower_id = $1 AND f.floor_number = n.floor_number
         LEFT JOIN (SELECT floor, count(*) AS units FROM units WHERE tower_id = $1${(0, unit_grant_js_1.grantClause)(req.unitStatusFilter, 'status', fp)} GROUP BY floor) u ON u.floor = n.floor_number
        ORDER BY n.floor_number`, fp)).rows;
        res.json({ success: true, data: rows.map((r) => ({ ...r, default_label: defaultFloorLabel(r.floor_number), label: r.floor_name || defaultFloorLabel(r.floor_number) })) });
    }
    catch (error) {
        planFail(error, res, next);
    }
});
// PUT /api/projects/:id/towers/:towerId/floors/:floorNumber  { floorName }  (a blank name goes back to the default label)
router.put('/:id/towers/:towerId/floors/:floorNumber', async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Project id'), tid = (0, input_js_1.uuid)(req.params.towerId, 'Tower id');
        const fn = floorNo(req.params.floorNumber, 'Floor');
        const b = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
        if (!('floorName' in b))
            throw bad('floorName is required (blank clears the name)');
        const name = (0, input_js_1.has)(b.floorName) ? (0, input_js_1.text)(b.floorName, 'Floor name', 50, true) : null;
        await towerOf(id, tid);
        const before = (await index_js_1.db.query('SELECT floor_name FROM floors WHERE tower_id = $1 AND floor_number = $2', [tid, fn])).rows[0];
        if (name && (await index_js_1.db.query('SELECT 1 FROM floors WHERE tower_id = $1 AND lower(floor_name) = lower($2) AND floor_number <> $3', [tid, name, fn])).rows.length)
            throw Object.assign(bad('Another floor of this tower already has this name'), { http: 409 });
        if (!name)
            await index_js_1.db.query('DELETE FROM floors WHERE tower_id = $1 AND floor_number = $2', [tid, fn]);
        else
            await index_js_1.db.query('INSERT INTO floors (tower_id, floor_number, floor_name) VALUES ($1, $2, $3) ON CONFLICT (tower_id, floor_number) DO UPDATE SET floor_name = EXCLUDED.floor_name', [tid, fn, name]);
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'floor', tid, before || {}, { floor_number: fn, floor_name: name });
        res.json({ success: true, data: { floor_number: fn, floor_name: name, label: name || defaultFloorLabel(fn) } });
    }
    catch (error) {
        planFail(error, res, next);
    }
});
// POST /api/projects/:id/towers/:towerId/floors/pattern  { from, to, style: number | ordinal | words, prefix, suffix, preview }
// Names every floor from..to in one go: "1, 2, 3", "1st, 2nd, 3rd" or "First, Second, Third", with an optional prefix and suffix. Floor 0 is Ground, below 0 is Basement 1, 2 ...
router.post('/:id/towers/:towerId/floors/pattern', async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Project id'), tid = (0, input_js_1.uuid)(req.params.towerId, 'Tower id');
        const b = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
        const from = floorNo(b.from, 'From floor'), to = floorNo(b.to, 'To floor');
        if (from > to)
            throw bad('From floor cannot be above To floor');
        const style = (0, input_js_1.oneOf)(b.style ?? 'ordinal', 'Style', FLOOR_STYLES);
        if (style === 'words' && to > 100)
            throw bad('First, Second ... names go up to the 100th floor');
        // spaces matter here ("1st" + " Floor"), so these are checked as they are instead of being trimmed
        const affix = (v, label) => { if (v === undefined || v === null || v === '')
            return ''; if (typeof v !== 'string' || !/^[A-Za-z0-9 .\-_()#&/]{1,20}$/.test(v))
            throw bad(`${label} can be up to 20 letters, digits, spaces or . - _ ( ) # & /`); return v; };
        const prefix = affix(b.prefix, 'Prefix'), suffix = affix(b.suffix, 'Suffix');
        if (b.preview !== undefined && typeof b.preview !== 'boolean')
            throw bad('preview must be true or false');
        await towerOf(id, tid);
        const nums = [];
        for (let n = from; n <= to; n++)
            nums.push(n);
        const names = nums.map((n) => `${prefix}${floorPart(style, n)}${suffix}`.trim());
        if (names.some((x) => x.length > 50))
            throw bad('A floor name would be longer than 50 characters');
        const clash = (await index_js_1.db.query('SELECT floor_number, floor_name FROM floors WHERE tower_id = $1 AND NOT (floor_number = ANY($2::int[])) AND lower(floor_name) = ANY($3::text[])', [tid, nums, names.map((x) => x.toLowerCase())])).rows[0];
        if (clash)
            throw Object.assign(bad(`Floor ${clash.floor_number} of this tower is already named "${clash.floor_name}"`), { http: 409 });
        const out = nums.map((n, i) => ({ floor_number: n, floor_name: names[i] }));
        if (b.preview === true)
            return res.json({ success: true, data: { preview: true, floors: out } });
        await index_js_1.db.query('INSERT INTO floors (tower_id, floor_number, floor_name) SELECT $1::uuid, x.n, x.nm FROM unnest($2::int[], $3::text[]) AS x(n, nm) ON CONFLICT (tower_id, floor_number) DO UPDATE SET floor_name = EXCLUDED.floor_name', [tid, nums, names]);
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'floor', tid, {}, { pattern: { from, to, style, prefix, suffix } });
        res.json({ success: true, data: { preview: false, floors: out } });
    }
    catch (error) {
        planFail(error, res, next);
    }
});
// ── Customer Wise Timely Discount ──
// A plan with timely discount on gives its % on every installment paid in full by its due date; a customer can have his own % instead (0 = none for him).
// The earned discount is raised as a credit note on the installment's invoice (see utils/timely-discount.ts).
const timelyCustomer = async (projectId, consumerId) => {
    const r = (await index_js_1.db.query(`SELECT br.consumer_id, h.discount_pct FROM booking_records br JOIN plan_headers h ON h.project_id = br.project_id AND lower(h.plan_name) = lower(br.selected_plan_name) AND h.timely_discount
      WHERE br.project_id = $1 AND br.consumer_id = $2 AND COALESCE(br.status, '') NOT IN ('cancelled', 'canceled') LIMIT 1`, [projectId, consumerId])).rows[0];
    if (!r)
        throw Object.assign(bad('This customer has no active booking in this project on a plan with timely discount'), { http: 409 });
    return r;
};
// GET /api/projects/:id/timely-discount  the plans with timely discount and the customers on them
router.get('/:id/timely-discount', async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Project id');
        await projectOk(id);
        const plans = (await index_js_1.db.query(`SELECT plan_name, discount_pct::float AS discount_pct FROM plan_headers WHERE project_id = $1 AND timely_discount ORDER BY plan_name`, [id])).rows;
        const customers = (await index_js_1.db.query(`SELECT DISTINCT ON (br.consumer_id) br.consumer_id, c.name AS consumer_name, c.registration_no, u.unit_number, br.selected_plan_name AS plan_name, h.discount_pct::float AS plan_pct, ct.discount_pct::float AS own_pct, ct.note,
              (SELECT COALESCE(SUM(a.discount_amount), 0)::float FROM timely_discount_awards a WHERE a.consumer_id = br.consumer_id AND a.project_id = br.project_id AND a.status = 'issued') AS earned,
              (SELECT COUNT(*)::int FROM timely_discount_awards a WHERE a.consumer_id = br.consumer_id AND a.project_id = br.project_id AND a.status = 'waiting') AS waiting
         FROM booking_records br JOIN plan_headers h ON h.project_id = br.project_id AND lower(h.plan_name) = lower(br.selected_plan_name) AND h.timely_discount
         JOIN consumers c ON c.id = br.consumer_id LEFT JOIN units u ON u.id = br.unit_id LEFT JOIN customer_timely_discount ct ON ct.consumer_id = br.consumer_id AND ct.project_id = br.project_id
        WHERE br.project_id = $1 AND COALESCE(br.status, '') NOT IN ('cancelled', 'canceled') ORDER BY br.consumer_id, br.created_at DESC`, [id])).rows;
        res.json({ success: true, data: { plans, customers: customers.map((x) => ({ ...x, effective_pct: x.own_pct ?? x.plan_pct })).sort((a, z) => String(a.consumer_name).localeCompare(String(z.consumer_name))) } });
    }
    catch (error) {
        planFail(error, res, next);
    }
});
// PUT /api/projects/:id/timely-discount/customers/:consumerId  { discountPct, note }
router.put('/:id/timely-discount/customers/:consumerId', async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Project id'), cid = (0, input_js_1.uuid)(req.params.consumerId, 'Customer id'), b = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
        const pct = (0, input_js_1.num)(b.discountPct, 'Discount %', 100, 4), note = (0, input_js_1.has)(b.note) ? (0, input_js_1.text)(b.note, 'Note', 300, false) : null;
        await projectOk(id);
        await timelyCustomer(id, cid);
        const before = (await index_js_1.db.query('SELECT discount_pct FROM customer_timely_discount WHERE consumer_id = $1 AND project_id = $2', [cid, id])).rows[0];
        const r = (await index_js_1.db.query(`INSERT INTO customer_timely_discount (consumer_id, project_id, discount_pct, note, set_by) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (consumer_id, project_id) DO UPDATE SET discount_pct = EXCLUDED.discount_pct, note = EXCLUDED.note, set_by = EXCLUDED.set_by, set_at = now() RETURNING discount_pct::float AS discount_pct, note`, [cid, id, pct, note, req.userId])).rows[0];
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'customer_timely_discount', cid, before || {}, r);
        res.json({ success: true, data: r });
    }
    catch (error) {
        planFail(error, res, next);
    }
});
// DELETE /api/projects/:id/timely-discount/customers/:consumerId   back to the plan's %
router.delete('/:id/timely-discount/customers/:consumerId', async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Project id'), cid = (0, input_js_1.uuid)(req.params.consumerId, 'Customer id');
        await projectOk(id);
        const r = await index_js_1.db.query('DELETE FROM customer_timely_discount WHERE consumer_id = $1 AND project_id = $2 RETURNING discount_pct::float AS discount_pct', [cid, id]);
        if (!r.rowCount)
            return res.status(404).json({ error: 'This customer has no own discount to remove' });
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'delete', 'customer_timely_discount', cid, r.rows[0], {});
        res.json({ success: true });
    }
    catch (error) {
        planFail(error, res, next);
    }
});
// POST /api/projects/:id/timely-discount/run  { consumerId? }   raise the credit notes of the installments paid in time (a checker's note step still follows unless the project's journal authentication is Automatic)
router.post('/:id/timely-discount/run', (0, processPermission_js_1.requireProcess)('jv_refund_drcr', 'maker'), async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Project id'), b = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
        const cid = (0, input_js_1.has)(b.consumerId) ? (0, input_js_1.uuid)(b.consumerId, 'Customer id') : undefined;
        await projectOk(id);
        const out = await (0, timely_discount_js_1.runTimelyDiscounts)(index_js_1.db, req, id, cid);
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'timely_discount_run', id, undefined, { issued: out.issued, waiting: out.waiting, checked: out.checked });
        res.json({ success: true, data: out });
    }
    catch (error) {
        planFail(error, res, next);
    }
});
// GET /api/projects/:id/timely-discount/awards?consumerId=
router.get('/:id/timely-discount/awards', async (req, res, next) => {
    try {
        const id = (0, input_js_1.uuid)(req.params.id, 'Project id'), cid = (0, input_js_1.has)(req.query.consumerId) ? (0, input_js_1.uuid)(req.query.consumerId, 'Customer id') : null;
        await projectOk(id);
        const rows = (await index_js_1.db.query(`SELECT a.id, a.consumer_id, c.name AS consumer_name, a.installment_name, a.base_amount::float AS base_amount, a.discount_pct::float AS discount_pct, a.discount_amount::float AS discount_amount, a.due_date::text AS due_date, a.paid_on::text AS paid_on,
              a.status, a.note, n.note_number, n.status AS note_status
         FROM timely_discount_awards a JOIN consumers c ON c.id = a.consumer_id LEFT JOIN credit_debit_notes n ON n.id = a.credit_note_id
        WHERE a.project_id = $1 AND ($2::uuid IS NULL OR a.consumer_id = $2) ORDER BY a.created_at DESC LIMIT 500`, [id, cid])).rows;
        res.json({ success: true, data: rows });
    }
    catch (error) {
        planFail(error, res, next);
    }
});
exports.default = router;
//# sourceMappingURL=projects.js.map