/**
 * Projects Routes
 * Project CRUD, tower management, unit locations, rate reports
 */

import { Router, Response, NextFunction } from 'express';
import { db } from '../index.js';
import { AuthRequest } from '../index.js';
import { pgErrorHandler } from '../middleware/pg-errors.js';
import { cleanBody } from './master.js';
import { isScoped } from '../db/pool.js';
import { auditChange } from '../middleware/auditLogger.js';
import { text as inText, day as inDay, num as inNum, uuid as inUuid, has as inHas } from '../utils/input.js';

const router = Router();

// GET /api/projects
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT p.id, p.name, p.rera_number, p.tcp_licence, p.location,
              p.land_area_sqft, p.total_units, p.group_name, p.possession_date, p.created_at,
              p.company_id, comp.name AS company_name,
              COUNT(DISTINCT t.id) as tower_count,
              COUNT(DISTINCT u.id) as unit_count,
              COUNT(DISTINCT u.id) FILTER (WHERE u.status::text = 'available') as available_units,
              COUNT(DISTINCT u.id) FILTER (WHERE u.status::text = 'allotted') as allotted_units
       FROM projects p
       LEFT JOIN companies comp ON comp.id = p.company_id
       LEFT JOIN towers t ON p.id = t.project_id
       LEFT JOIN units u ON p.id = u.project_id
       GROUP BY p.id, comp.name
       ORDER BY p.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/projects
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  // A login limited to some projects could not see the project it creates; an admin creates projects
  if (isScoped()) return res.status(403).json({ error: 'Your login is limited to assigned projects. Ask an admin to create a new project.' });
  try {
    const pb = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const landAreaSqft = inHas(pb.landAreaSqft) ? inNum(pb.landAreaSqft, 'Land area', 10_000_000_000, 0) : null;
    const totalUnits = inHas(pb.totalUnits) ? inNum(pb.totalUnits, 'Total units', 100000, 0) : null;
    const possessionDate = inDay(pb.possessionDate, 'Possession date');
    const incomeCategory = inText(pb.incomeCategory, 'Category', 100, false);
    const companyId = pb.companyId;
    const cleaned = cleanBody(req.body, ['name', 'reraNumber', 'tcpLicence', 'location']);
    if ('error' in cleaned) return res.status(400).json({ error: cleaned.error });
    const { name, reraNumber, tcpLicence, location } = cleaned.values;

    if (!name || !reraNumber || !tcpLicence) {
      return res.status(400).json({ error: 'name, reraNumber, and tcpLicence are required' });
    }
    // Receipts, demand letters and allotment letters print the project's company, so every project needs one
    if (!companyId) return res.status(400).json({ error: 'companyId is required' });
    const company = await db.query('SELECT 1 FROM companies WHERE id = $1', [companyId]);
    if (!company.rows.length) return res.status(400).json({ error: 'This company does not exist' });
    const sameName = await db.query('SELECT 1 FROM projects WHERE lower(name) = lower($1)', [name]);
    if (sameName.rows.length) return res.status(409).json({ error: 'A project with this name already exists' });

    const result = await db.query(
      `INSERT INTO projects (name, rera_number, tcp_licence, location, land_area_sqft, total_units,
                             group_name, possession_date, company_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, name, rera_number, tcp_licence, location, group_name, possession_date, created_at`,
      [name, reraNumber, tcpLicence, location || null, landAreaSqft || null, totalUnits || null,
       incomeCategory || 'Affordable', possessionDate || null, companyId || null]
    );

    await auditChange(db, req, res, 'create', 'project', result.rows[0].id, undefined, result.rows[0]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    planFail(error, res, next);
  }
});

// GET /api/projects/reports/rates?projectId= — rate report (MUST be before /:id)
// One row per project / BHK type / tower. Units with no price are counted (no_price_count) instead of silently left out.
router.get('/reports/rates', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = req.query.projectId;
    if (q !== undefined && (typeof q !== 'string' || !idOk(q))) throw bad('projectId is not valid');
    const result = await db.query(`
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
        ROUND(AVG(u.base_price_inr / u.carpet_area_sqft) FILTER (WHERE u.base_price_inr > 0 AND u.carpet_area_sqft > 0)) AS avg_rate_per_sqft,
        MIN(u.carpet_area_sqft) AS min_carpet,
        MAX(u.carpet_area_sqft) AS max_carpet
      FROM projects p
      JOIN units u ON u.project_id = p.id
      LEFT JOIN towers t ON u.tower_id = t.id
      WHERE ($1::uuid IS NULL OR p.id = $1)
      GROUP BY p.id, p.name, u.bhk_type, t.id, t.tower_name
      ORDER BY p.name, u.bhk_type, t.tower_name
    `, [q ?? null]);
    res.json({ success: true, data: result.rows });
  } catch (err) { planFail(err, res, next); }
});

// GET /api/projects/:id/floors?towerId=
router.get('/:id/floors', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { towerId } = req.query;
    const params: any[] = [req.params.id];
    let extra = '';
    if (towerId) { extra = ' AND tower_id = $2'; params.push(towerId); }
    const result = await db.query(
      `SELECT DISTINCT floor FROM units WHERE project_id = $1${extra} ORDER BY floor ASC`,
      params
    );
    res.json({ success: true, data: result.rows.map((r: any) => r.floor) });
  } catch (err) { next(err); }
});

// ─── Payment plans ───────────────────────────────────────────────────────────
// A plan is the set of rows in plan_schedule_templates that share (project_id, plan_name). Booking turns each row
// into a demand: amount = price x percentage. So the percentages of one plan must add up to 100.
// Once a booking uses a plan, its numbers are frozen (reports read the rows live); change a copy instead.
const PLAN_TYPES = ['installment', 'booking', 'possession', 'plc', 'other_charge'];
const bad = (message: string) => Object.assign(new Error(message), { http: 400 });
const clash = (message: string) => Object.assign(new Error(message), { http: 409 });
const planFail = (err: any, res: Response, next: NextFunction) => (err?.http ? res.status(err.http).json({ error: err.message }) : next(err));
// Only a JSON number or a plain digit string counts as a number: "1e2", "0x10", " 5 ", [5], true and {} are refused
const plainNumber = (v: any, decimals: number): number => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && new RegExp(decimals ? `^[0-9]+(\\.[0-9]{1,${decimals}})?$` : '^[0-9]+$').test(v)) return Number(v);
  return NaN;
};
const wholeNumber = (v: any, label: string, min: number, max: number): number | null => {
  if (v === undefined || v === null || v === '') return null;
  const n = plainNumber(v, 0);
  if (!Number.isInteger(n) || n < min || n > max) throw bad(`${label} must be a whole number from ${min} to ${max}`);
  return n;
};
// Names are plain text: no control characters, line breaks or text-direction tricks
const plainText = (v: string, label: string) => {
  if (/[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069]/.test(v)) throw bad(`${label} contains characters that are not allowed`);
};
const planName = (v: any): string => {
  if (v !== undefined && v !== null && typeof v !== 'string') throw bad('Plan name must be text');
  const c = cleanBody({ plan_name: v }, ['plan_name']);
  if ('error' in c) throw bad(c.error.replace('Plan name', 'Plan name'));
  const n = c.values.plan_name;
  if (!n) throw bad('Plan name is required');
  if (n.length > 100) throw bad('Plan name can be at most 100 characters');
  plainText(n, 'Plan name');
  return n;
};
const idOk = (v: any) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

// Reads and checks one row. `cur` is the saved row when editing: fields not sent keep their value.
function readPlanRow(body: any, cur?: any) {
  body = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  for (const [k, label] of [['installment_name', 'Installment name'], ['notes', 'Notes']]) {
    if (body[k] !== undefined && body[k] !== null && typeof body[k] !== 'string') throw bad(`${label} must be text`);
  }
  const c = cleanBody(body, ['installment_name', 'notes'], cur);
  if ('error' in c) throw bad(c.error);
  const name = c.values.installment_name !== undefined ? c.values.installment_name : cur?.installment_name;
  if (!name) throw bad('Installment name is required');
  if (name.length > 100) throw bad('Installment name can be at most 100 characters');
  plainText(name, 'Installment name');
  const notes = c.values.notes !== undefined ? c.values.notes : cur?.notes ?? null;
  if (notes && notes.length > 500) throw bad('Notes can be at most 500 characters');
  const type = body.installment_type !== undefined ? body.installment_type : cur?.installment_type || 'installment';
  if (!PLAN_TYPES.includes(type)) throw bad(`Type must be one of: ${PLAN_TYPES.join(', ')}`);
  let pct: number | null = cur ? (cur.percentage === null ? null : Number(cur.percentage)) : null;
  if (body.percentage !== undefined) {
    if (body.percentage === null || body.percentage === '') pct = null;
    else {
      pct = plainNumber(body.percentage, 3);
      if (typeof body.percentage === 'string' && !Number.isNaN(Number(body.percentage)) && Number.isNaN(pct)) throw bad('Percentage can have at most 3 decimals');
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) throw bad('Percentage must be a number from 0 to 100');
      if (Math.round(pct * 1000) / 1000 !== pct) throw bad('Percentage can have at most 3 decimals');
    }
  }
  let flat: number | null = cur ? (cur.flat_amount_inr === null ? null : Number(cur.flat_amount_inr)) : null;
  if (body.flat_amount_inr !== undefined) flat = wholeNumber(body.flat_amount_inr, 'Amount', 0, 100000000000);
  if (type === 'other_charge') {
    if (!flat) throw bad('An Other Charge row needs a fixed amount');
    pct = null;
  } else {
    flat = null;
    if (pct === null) throw bad('Percentage is required');
  }
  const days = body.due_date_offset_days !== undefined ? wholeNumber(body.due_date_offset_days, 'Due days', 0, 3650) : null;
  const index = body.installment_index !== undefined ? wholeNumber(body.installment_index, 'Order number', 1, 999) : null;
  return {
    installment_name: name, installment_type: type, percentage: pct, flat_amount_inr: flat, notes,
    due_date_offset_days: days ?? cur?.due_date_offset_days ?? 0, installment_index: index ?? cur?.installment_index ?? null,
  };
}

// Number of bookings (not cancelled) that picked this plan
type Q = { query: (s: string, p?: any[]) => Promise<any> };
async function planUse(q: Q, projectId: string, name: string): Promise<number> {
  const r = await q.query(
    `SELECT COUNT(*)::int AS n FROM booking_records WHERE project_id = $1 AND selected_plan_name = $2 AND COALESCE(status, '') NOT IN ('cancelled', 'canceled')`,
    [projectId, name]
  );
  return r.rows[0].n;
}
// One writer at a time per plan: the 100% cap, the unique names and order numbers are checked and written under this lock.
// Without it two requests at once could both pass the check and push a plan past 100%.
async function inPlanTx<T>(projectId: string, name: string, fn: (c: any) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`plan|${projectId}|${name.toLowerCase()}`]);
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
}
// A plan name that exists in another letter case is the same plan
const canonPlan = async (q: Q, projectId: string, name: string) =>
  (await q.query(`SELECT plan_name FROM plan_schedule_templates WHERE project_id = $1 AND lower(plan_name) = lower($2) ORDER BY plan_name LIMIT 1`, [projectId, name])).rows[0]?.plan_name || name;
const frozen = (n: number) => clash(`${n} booking${n === 1 ? ' uses' : 's use'} this plan, so its numbers are fixed. Make a copy of the plan and change the copy.`);
async function projectOk(id: string) {
  if (!idOk(id)) throw bad('Invalid project');
  if (!(await db.query('SELECT 1 FROM projects WHERE id = $1', [id])).rows.length) throw Object.assign(new Error('Project not found'), { http: 404 });
}
// The percentages of the other rows of the plan plus `pct` must not pass 100
async function checkCap(q: Q, projectId: string, name: string, pct: number | null, exceptId?: string) {
  if (!pct) return;
  const r = await q.query(
    `SELECT COALESCE(SUM(percentage), 0)::numeric AS t FROM plan_schedule_templates WHERE project_id = $1 AND plan_name = $2 AND ($3::uuid IS NULL OR id <> $3)`,
    [projectId, name, exceptId || null]
  );
  const have = Number(r.rows[0].t);
  if (have + pct > 100.0005) throw bad(`This would bring the plan to ${(have + pct).toFixed(3)}%. The other rows already add up to ${have.toFixed(3)}%, and a plan can be 100% at most.`);
}
async function checkUnique(q: Q, projectId: string, name: string, row: { installment_name: string; installment_index: number | null }, exceptId?: string) {
  const r = await q.query(
    `SELECT installment_name, installment_index FROM plan_schedule_templates
      WHERE project_id = $1 AND plan_name = $2 AND ($5::uuid IS NULL OR id <> $5) AND (lower(installment_name) = lower($3) OR installment_index = $4)`,
    [projectId, name, row.installment_name, row.installment_index, exceptId || null]
  );
  for (const x of r.rows) {
    if (x.installment_name.toLowerCase() === row.installment_name.toLowerCase()) throw clash(`This plan already has a row called "${x.installment_name}"`);
    throw clash(`Order number ${x.installment_index} is already used by "${x.installment_name}"`);
  }
}

// GET /api/projects/:id/plan-templates  (rows; used by Booking, Demand and the interest screens)
router.get('/:id/plan-templates', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { planName: pn } = req.query;
    const params: any[] = [req.params.id];
    let extra = '';
    if (pn) { extra = ' AND plan_name = $2'; params.push(pn); }
    const result = await db.query(
      `SELECT * FROM plan_schedule_templates WHERE project_id = $1${extra} ORDER BY plan_name, installment_index`,
      params
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});

// GET /api/projects/:id/plans  (one line per plan: rows, total, bookings that use it)
router.get('/:id/plans', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await projectOk(req.params.id);
    const r = await db.query(
      `SELECT t.plan_name, COUNT(*)::int AS rows, COALESCE(SUM(t.percentage), 0)::float AS total_pct,
              COALESCE(SUM(t.flat_amount_inr), 0)::bigint AS flat_total, MAX(t.updated_at) AS updated_at,
              (SELECT COUNT(*)::int FROM booking_records b WHERE b.project_id = t.project_id AND b.selected_plan_name = t.plan_name
                 AND COALESCE(b.status, '') NOT IN ('cancelled', 'canceled')) AS bookings
         FROM plan_schedule_templates t WHERE t.project_id = $1 GROUP BY t.project_id, t.plan_name ORDER BY t.plan_name`,
      [req.params.id]
    );
    res.json({ success: true, data: r.rows.map((x: any) => ({ ...x, complete: Math.abs(x.total_pct - 100) < 0.001 })) });
  } catch (err) { planFail(err, res, next); }
});

// POST /api/projects/:id/plan-templates
router.post('/:id/plan-templates', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await projectOk(req.params.id);
    const asked = planName(req.body?.plan_name ?? 'Standard AHP Plan');
    const row = readPlanRow(req.body);
    const made = await inPlanTx(req.params.id, asked, async (c) => {
      const name = await canonPlan(c, req.params.id, asked);
      const used = await planUse(c, req.params.id, name);
      if (used) throw frozen(used);
      if (row.installment_index === null) {
        row.installment_index = (await c.query(`SELECT COALESCE(MAX(installment_index), 0) + 1 AS n FROM plan_schedule_templates WHERE project_id = $1 AND plan_name = $2`, [req.params.id, name])).rows[0].n;
      }
      await checkUnique(c, req.params.id, name, row);
      await checkCap(c, req.params.id, name, row.percentage);
      return (await c.query(
        `INSERT INTO plan_schedule_templates
           (project_id, plan_name, installment_name, installment_type, percentage, flat_amount_inr, due_date_offset_days, installment_index, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [req.params.id, name, row.installment_name, row.installment_type, row.percentage, row.flat_amount_inr, row.due_date_offset_days, row.installment_index, row.notes, req.userId]
      )).rows[0];
    });
    await auditChange(db, req, res, 'create', 'payment_plan_row', made.id, undefined, made);
    res.status(201).json({ success: true, data: made });
  } catch (err) { planFail(err, res, next); }
});

// PATCH /api/projects/:id/plan-templates/:itemId  (only the fields sent change)
router.patch('/:id/plan-templates/:itemId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!idOk(req.params.id) || !idOk(req.params.itemId)) throw bad('Invalid id');
    const first = (await db.query(`SELECT project_id, plan_name FROM plan_schedule_templates WHERE id = $1 AND project_id = $2`, [req.params.itemId, req.params.id])).rows[0];
    if (!first) return res.status(404).json({ error: 'Plan row not found' });
    const out = await inPlanTx(first.project_id, first.plan_name, async (c) => {
      const cur = (await c.query(`SELECT * FROM plan_schedule_templates WHERE id = $1 AND project_id = $2`, [req.params.itemId, req.params.id])).rows[0];
      if (!cur) throw Object.assign(new Error('Plan row not found'), { http: 404 });
      const row = readPlanRow(req.body, cur);
      const used = await planUse(c, cur.project_id, cur.plan_name);
      const numbersChanged = row.installment_type !== cur.installment_type || Number(row.percentage ?? -1) !== Number(cur.percentage ?? -1)
        || Number(row.flat_amount_inr ?? -1) !== Number(cur.flat_amount_inr ?? -1) || row.due_date_offset_days !== cur.due_date_offset_days
        || row.installment_index !== cur.installment_index;
      if (used && numbersChanged) throw frozen(used);
      await checkUnique(c, cur.project_id, cur.plan_name, row, cur.id);
      await checkCap(c, cur.project_id, cur.plan_name, row.percentage, cur.id);
      const upd = (await c.query(
        `UPDATE plan_schedule_templates SET installment_name = $1, installment_type = $2, percentage = $3, flat_amount_inr = $4,
                due_date_offset_days = $5, installment_index = $6, notes = $7, updated_at = NOW()
          WHERE id = $8 RETURNING *`,
        [row.installment_name, row.installment_type, row.percentage, row.flat_amount_inr, row.due_date_offset_days, row.installment_index, row.notes, cur.id]
      )).rows[0];
      return { cur, upd };
    });
    await auditChange(db, req, res, 'update', 'payment_plan_row', out.cur.id, out.cur, out.upd);
    res.json({ success: true, data: out.upd });
  } catch (err) { planFail(err, res, next); }
});

// DELETE /api/projects/:id/plan-templates/:itemId
router.delete('/:id/plan-templates/:itemId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!idOk(req.params.id) || !idOk(req.params.itemId)) throw bad('Invalid id');
    const cur = (await db.query(`SELECT * FROM plan_schedule_templates WHERE id = $1 AND project_id = $2`, [req.params.itemId, req.params.id])).rows[0];
    if (!cur) return res.status(404).json({ error: 'Plan row not found' });
    await inPlanTx(cur.project_id, cur.plan_name, async (c) => {
      const used = await planUse(c, cur.project_id, cur.plan_name);
      if (used) throw frozen(used);
      const gone = await c.query(`DELETE FROM plan_schedule_templates WHERE id = $1`, [cur.id]);
      if (!gone.rowCount) throw Object.assign(new Error('Plan row not found'), { http: 404 });
    });
    await auditChange(db, req, res, 'delete', 'payment_plan_row', cur.id, cur, undefined);
    res.json({ success: true });
  } catch (err) { planFail(err, res, next); }
});

// DELETE /api/projects/:id/plans?planName=...  (the whole plan)
router.delete('/:id/plans', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await projectOk(req.params.id);
    const asked = planName(req.query.planName);
    const name = await canonPlan(db, req.params.id, asked);
    const r = await inPlanTx(req.params.id, name, async (c) => {
      const used = await planUse(c, req.params.id, name);
      if (used) throw frozen(used);
      return c.query(`DELETE FROM plan_schedule_templates WHERE project_id = $1 AND plan_name = $2 RETURNING id`, [req.params.id, name]);
    });
    if (!r.rowCount) return res.status(404).json({ error: 'Plan not found' });
    await auditChange(db, req, res, 'delete', 'payment_plan', req.params.id, { plan_name: name, rows: r.rowCount }, undefined);
    res.json({ success: true, deleted: r.rowCount });
  } catch (err) { planFail(err, res, next); }
});

// POST /api/projects/:id/plans/copy  { from, to, toProjectId? }  (add-on percentages come along inside the same project)
router.post('/:id/plans/copy', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await projectOk(req.params.id);
    const from = planName(req.body?.from), to = planName(req.body?.to);
    const target = req.body?.toProjectId || req.params.id;
    await projectOk(target);
    if (target === req.params.id && from.toLowerCase() === to.toLowerCase()) throw bad('Give the copy a different name');
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`plan|${target}|${to.toLowerCase()}`]);
      if ((await client.query(`SELECT 1 FROM plan_schedule_templates WHERE project_id = $1 AND lower(plan_name) = lower($2) LIMIT 1`, [target, to])).rows.length) throw clash(`A plan called "${to}" already exists in that project`);
      const fromName = await canonPlan(client, req.params.id, from);
      const made = await client.query(
        `INSERT INTO plan_schedule_templates (project_id, plan_name, installment_name, installment_type, percentage, flat_amount_inr, due_date_offset_days, installment_index, notes, created_by)
         SELECT $1, $2, installment_name, installment_type, percentage, flat_amount_inr, due_date_offset_days, installment_index, notes, $5
           FROM plan_schedule_templates WHERE project_id = $3 AND plan_name = $4 ORDER BY installment_index RETURNING id, installment_index`,
        [target, to, req.params.id, fromName, req.userId]
      );
      if (!made.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Plan to copy not found' }); }
      if (target === req.params.id) {
        await client.query(
          `INSERT INTO plan_addon_charge_pct (plan_schedule_template_id, charge_master_id, pct, created_by)
           SELECT n.id, a.charge_master_id, a.pct, $4
             FROM plan_schedule_templates o
             JOIN plan_schedule_templates n ON n.project_id = $1 AND n.plan_name = $2 AND n.installment_index = o.installment_index
             JOIN plan_addon_charge_pct a ON a.plan_schedule_template_id = o.id
            WHERE o.project_id = $1 AND o.plan_name = $3`,
          [target, to, fromName, req.userId]
        );
      }
      await client.query('COMMIT');
      await auditChange(db, req, res, 'create', 'payment_plan', target, undefined, { plan_name: to, copied_from: from, rows: made.rowCount });
      res.status(201).json({ success: true, data: { plan_name: to, rows: made.rowCount } });
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
  } catch (err) { planFail(err, res, next); }
});

// POST /api/projects/:id/plans/standard  { plan_name }  (the usual 9-row schedule: 5 + 20 + 6 x 12.5 + possession = 100%)
const STANDARD_PLAN: [string, string, number, number][] = [
  ['Booking Amount', 'booking', 5, 0], ['On Allotment', 'installment', 20, 15], ['1st Half-Yearly', 'installment', 12.5, 180],
  ['2nd Half-Yearly', 'installment', 12.5, 360], ['3rd Half-Yearly', 'installment', 12.5, 540], ['4th Half-Yearly', 'installment', 12.5, 720],
  ['5th Half-Yearly', 'installment', 12.5, 900], ['6th Half-Yearly', 'installment', 12.5, 1080], ['On Possession', 'possession', 0, 0],
];
router.post('/:id/plans/standard', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await projectOk(req.params.id);
    const name = planName(req.body?.plan_name);
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`plan|${req.params.id}|${name.toLowerCase()}`]);
      if ((await client.query(`SELECT 1 FROM plan_schedule_templates WHERE project_id = $1 AND lower(plan_name) = lower($2) LIMIT 1`, [req.params.id, name])).rows.length) throw clash(`A plan called "${name}" already exists in this project`);
      for (const [i, [n, type, pct, days]] of STANDARD_PLAN.entries()) {
        await client.query(
          `INSERT INTO plan_schedule_templates (project_id, plan_name, installment_name, installment_type, percentage, due_date_offset_days, installment_index, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [req.params.id, name, n, type, pct, days, i + 1, req.userId]
        );
      }
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
    await auditChange(db, req, res, 'create', 'payment_plan', req.params.id, undefined, { plan_name: name, standard: true, rows: STANDARD_PLAN.length });
    res.status(201).json({ success: true, data: { plan_name: name, rows: STANDARD_PLAN.length } });
  } catch (err) { planFail(err, res, next); }
});

// Add-on charge percentages of one row. The row must belong to this project and the charge to the same project.
async function addonRow(projectId: string, templateId: string) {
  if (!idOk(projectId) || !idOk(templateId)) throw bad('Invalid id');
  const t = (await db.query(`SELECT * FROM plan_schedule_templates WHERE id = $1 AND project_id = $2`, [templateId, projectId])).rows[0];
  if (!t) throw Object.assign(new Error('Plan row not found'), { http: 404 });
  return t;
}

// GET /api/projects/:id/plan-templates/:templateId/addon-charges
router.get('/:id/plan-templates/:templateId/addon-charges', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await addonRow(req.params.id, req.params.templateId);
    const result = await db.query(
      `SELECT pacp.id, pacp.plan_schedule_template_id, pacp.charge_master_id, pacp.pct, acm.charge_name, acm.cgst_pct, acm.sgst_pct, acm.default_amount
         FROM plan_addon_charge_pct pacp JOIN addon_charge_master acm ON acm.id = pacp.charge_master_id
        WHERE pacp.plan_schedule_template_id = $1 ORDER BY acm.charge_name ASC`,
      [req.params.templateId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { planFail(err, res, next); }
});

// POST /api/projects/:id/plan-templates/:templateId/addon-charges   { charge_master_id, pct }
// Over all rows of the plan, one charge can total 100% at most.
router.post('/:id/plan-templates/:templateId/addon-charges', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id, templateId } = req.params;
    const t = await addonRow(id, templateId);
    const { charge_master_id, pct } = req.body || {};
    const pctNum = plainNumber(pct, 3);
    if (!Number.isFinite(pctNum) || pctNum < 0 || pctNum > 100) throw bad('Percentage must be a number from 0 to 100 with at most 3 decimals');
    if (!idOk(charge_master_id)) throw bad('Choose an add-on charge');
    if (!(await db.query(`SELECT 1 FROM addon_charge_master WHERE id = $1 AND project_id = $2`, [charge_master_id, id])).rows.length) throw bad('That add-on charge does not belong to this project');
    const saved = await inPlanTx(id, t.plan_name, async (c) => {
      const used = await planUse(c, id, t.plan_name);
      if (used) throw frozen(used);
      const sum = await c.query(
        `SELECT COALESCE(SUM(a.pct), 0)::numeric AS s FROM plan_addon_charge_pct a JOIN plan_schedule_templates p ON p.id = a.plan_schedule_template_id
          WHERE p.plan_name = $1 AND p.project_id = $2 AND a.charge_master_id = $3 AND a.plan_schedule_template_id <> $4`,
        [t.plan_name, id, charge_master_id, templateId]
      );
      const have = Number(sum.rows[0].s);
      if (have + pctNum > 100.0005) throw bad(`This add-on charge would total ${(have + pctNum).toFixed(3)}% in this plan. The other rows already have ${have.toFixed(3)}%.`);
      return (await c.query(
        `INSERT INTO plan_addon_charge_pct (plan_schedule_template_id, charge_master_id, pct, created_by) VALUES ($1, $2, $3, $4)
         ON CONFLICT (plan_schedule_template_id, charge_master_id) DO UPDATE SET pct = EXCLUDED.pct, updated_at = NOW() RETURNING *`,
        [templateId, charge_master_id, pctNum, req.userId || null]
      )).rows[0];
    });
    await auditChange(db, req, res, 'update', 'payment_plan_addon_pct', saved.id, undefined, saved);
    res.json({ success: true, data: saved });
  } catch (err) { planFail(err, res, next); }
});

// DELETE /api/projects/:id/plan-templates/:templateId/addon-charges/:chargeId
router.delete('/:id/plan-templates/:templateId/addon-charges/:chargeId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const t = await addonRow(req.params.id, req.params.templateId);
    if (!idOk(req.params.chargeId)) throw bad('Invalid id');
    const used = await planUse(db, req.params.id, t.plan_name);
    if (used) throw frozen(used);
    const r = await db.query(`DELETE FROM plan_addon_charge_pct WHERE id = $1 AND plan_schedule_template_id = $2 RETURNING id`, [req.params.chargeId, req.params.templateId]);
    if (!r.rowCount) return res.status(404).json({ error: 'Add-on percentage not found' });
    res.json({ success: true });
  } catch (err) { planFail(err, res, next); }
});

// GET /api/projects/:id/plan-addon-pcts?planName=CLP@92
// Returns all addon pcts for all installments in a plan (used by Stage 2 demand creation)
router.get('/:id/plan-addon-pcts', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { planName } = req.query;
    const result = await db.query(
      `SELECT
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
       ORDER BY pst.installment_index, acm.charge_name`,
      [id, planName]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});

// GET /api/projects/:id
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT * FROM projects WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Project not found' });

    const towers = await db.query(
      `SELECT t.id, t.tower_name, COUNT(u.id) as unit_count
       FROM towers t LEFT JOIN units u ON t.id = u.tower_id
       WHERE t.project_id = $1 GROUP BY t.id ORDER BY t.tower_name`,
      [id]
    );

    res.json({ success: true, data: { ...result.rows[0], towers: towers.rows } });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/projects/:id
router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const cleanedNames = cleanBody(req.body, ['name', 'location']);
    if ('error' in cleanedNames) return res.status(400).json({ error: cleanedNames.error });
    const { name, location } = cleanedNames.values;
    if (name) {
      const sameName = await db.query('SELECT 1 FROM projects WHERE lower(name) = lower($1) AND id::text <> $2', [name, id]);
      if (sameName.rows.length) return res.status(409).json({ error: 'A project with this name already exists' });
    }
    // Every field is checked before anything is saved; a field left out keeps its stored value
    const rb = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const vb: Record<string, any> = { ...rb };
    const TEXT_LIMITS: Record<string, number> = { envClearanceNo: 200, buildingPlanMemoNo: 200, landOwnerName: 300, landOwnerLlpin: 50, landOwnerAddress: 1000, landOwnerGpaVasikaNo: 100, saleDeedNo: 100,
      occupationCertMemoNo: 200, deedOfDeclarationVasikaNo: 100, khasraDetails: 2000, villageName: 200, sectorName: 100, subRegistrarOffice: 200, authorisedSignatoryName: 200 };
    for (const [k, max] of Object.entries(TEXT_LIMITS)) if (inHas(rb[k])) vb[k] = inText(rb[k], k, max, false);
    for (const k of ['licenseDate', 'envClearanceDate', 'buildingPlanDate', 'collaborationAgreementDate', 'landOwnerGpaDate', 'saleDeedDate', 'occupationCertDate', 'deedOfDeclarationDate', 'boardResolutionDate']) if (inHas(rb[k])) vb[k] = inDay(rb[k], k);
    if (inHas(rb.landOwnerPan)) { const p = inText(rb.landOwnerPan, 'PAN', 20, false); if (p && !/^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/.test(p)) throw bad('PAN must look like ABCDE1234F'); vb.landOwnerPan = p && p.toUpperCase(); }
    if (inHas(rb.authorisedSignatoryAadhaar)) { const a = inText(rb.authorisedSignatoryAadhaar, 'Aadhaar', 20, false); if (a && !/^\d{4} ?\d{4} ?\d{4}$/.test(a)) throw bad('Aadhaar must be 12 digits'); vb.authorisedSignatoryAadhaar = a; }
    if (inHas(rb.companyId)) { vb.companyId = inUuid(rb.companyId, 'companyId'); if (!(await db.query('SELECT 1 FROM companies WHERE id = $1', [vb.companyId])).rows.length) throw bad('This company does not exist'); }
    if (inHas(rb.totalUnits)) {
      vb.totalUnits = inNum(rb.totalUnits, 'Total units', 100000, 0);
      const have = Number((await db.query('SELECT count(*) AS n FROM units WHERE project_id = $1', [id])).rows[0].n);
      if (vb.totalUnits < have) throw bad(`The project already has ${have} units, so Total units cannot be less than that`);
    }
    const {
      totalUnits,
      licenseDate,
      envClearanceNo,
      envClearanceDate,
      buildingPlanMemoNo,
      buildingPlanDate,
      collaborationAgreementDate,
      landOwnerName,
      landOwnerLlpin,
      landOwnerPan,
      landOwnerAddress,
      landOwnerGpaVasikaNo,
      landOwnerGpaDate,
      saleDeedNo,
      saleDeedDate,
      occupationCertMemoNo,
      occupationCertDate,
      deedOfDeclarationVasikaNo,
      deedOfDeclarationDate,
      khasraDetails,
      villageName,
      sectorName,
      subRegistrarOffice,
      authorisedSignatoryName,
      authorisedSignatoryAadhaar,
      boardResolutionDate,
      companyId,
    } = vb;

    const result = await db.query(
      `UPDATE projects SET
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
         updated_at = NOW()
       WHERE id = $30
       RETURNING *`,
      [
        name || null,
        location || null,
        inHas(totalUnits) ? Number(totalUnits) : null,
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
        id
      ]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    await auditChange(db, req, res, 'update', 'project', id, undefined, result.rows[0]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    planFail(error, res, next);
  }
});

// GET /api/projects/:id/towers
router.get('/:id/towers', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT t.id, t.tower_name, t.project_id, COUNT(u.id) as unit_count
       FROM towers t LEFT JOIN units u ON t.id = u.tower_id
       WHERE t.project_id = $1 GROUP BY t.id ORDER BY t.tower_name`,
      [req.params.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});

// POST /api/projects/:id/towers
router.post('/:id/towers', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const cleaned = cleanBody(req.body, ['towerName']);
    if ('error' in cleaned) return res.status(400).json({ error: cleaned.error });
    const { towerName } = cleaned.values;

    if (!towerName) return res.status(400).json({ error: 'towerName is required' });

    const exists = await db.query(
      `SELECT 1 FROM towers WHERE project_id = $1 AND lower(tower_name) = lower($2)`,
      [id, towerName]
    );
    if (exists.rows.length) return res.status(409).json({ error: 'A tower with this name already exists in this project' });

    const result = await db.query(
      `INSERT INTO towers (project_id, tower_name) VALUES ($1, $2)
       RETURNING id, tower_name, project_id`,
      [id, towerName]
    );

    await auditChange(db, req, res, 'create', 'tower', result.rows[0].id, undefined, result.rows[0]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// GET /api/projects/:id/towers/:towerId
router.get('/:id/towers/:towerId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT t.id, t.tower_name, t.project_id, COUNT(u.id) as unit_count
       FROM towers t LEFT JOIN units u ON t.id = u.tower_id
       WHERE t.project_id = $1 AND t.id = $2
       GROUP BY t.id
       LIMIT 1`,
      [req.params.id, req.params.towerId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tower not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

// DELETE /api/projects/:id/towers/:towerId
router.delete('/:id/towers/:towerId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const unitCheck = await db.query(
      `SELECT COUNT(*) as count FROM units WHERE tower_id = $1`,
      [req.params.towerId]
    );
    const unitCount = parseInt(unitCheck.rows[0].count);
    if (unitCount > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete tower. It has ${unitCount} unit(s) linked to it. Please remove all units first.`
      });
    }
    const result = await db.query(`DELETE FROM towers WHERE id = $1 AND project_id = $2`, [req.params.towerId, req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Tower not found' });
    await auditChange(db, req, res, 'delete', 'tower', req.params.towerId, undefined, { project_id: req.params.id });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /api/projects/:id/payment-plans
router.get('/:id/payment-plans', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT
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
       ORDER BY pp.created_at DESC`,
      [req.params.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});

// GET /api/projects/:id/unit-locations
router.get('/:id/unit-locations', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT * FROM unit_locations WHERE project_id = $1 ORDER BY name`,
      [req.params.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});

// POST /api/projects/:id/unit-locations
router.post('/:id/unit-locations', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const cleaned = cleanBody(req.body, ['name', 'description']);
    if ('error' in cleaned) return res.status(400).json({ error: cleaned.error });
    const { name, description } = cleaned.values;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const dup = await db.query(`SELECT 1 FROM unit_locations WHERE project_id = $1 AND lower(name) = lower($2)`, [req.params.id, name]);
    if (dup.rows.length) return res.status(409).json({ error: 'A unit location with this name already exists in this project' });
    const result = await db.query(
      `INSERT INTO unit_locations (project_id, name, description) VALUES ($1, $2, $3) RETURNING *`,
      [req.params.id, name, description || null]
    );
    await auditChange(db, req, res, 'create', 'unit_location', result.rows[0].id, undefined, result.rows[0]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

// DELETE /api/projects/:id/unit-locations/:locId
router.delete('/:id/unit-locations/:locId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(`DELETE FROM unit_locations WHERE id = $1 AND project_id = $2`, [req.params.locId, req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Unit location not found' });
    await auditChange(db, req, res, 'delete', 'unit_location', req.params.locId, undefined, { project_id: req.params.id });
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.use(pgErrorHandler);

export default router;
