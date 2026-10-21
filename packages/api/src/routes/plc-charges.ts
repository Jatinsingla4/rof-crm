/**
 * Preferred Location Charges (PLC). A rate for each unit location of a project (flat, or per sq ft of carpet area) and the
 * location of each unit. Booking asks /quote for the amount to offer; the booking keeps the amount it was given.
 */
import { Router, Response, NextFunction } from 'express';
import { db } from '../index.js';
import { AuthRequest } from '../index.js';
import { hasPermission } from '../middleware/rbac.js';
import { auditChange } from '../middleware/auditLogger.js';
import { bad, failWith, uuid, has, num, flag, body, r2, inTx } from '../utils/input.js';

const router = Router();

// Reading is open (the booking form asks for a quote); any change needs the Set Master permission
router.use((req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  const action = req.method === 'POST' ? 'create' : req.method === 'DELETE' ? 'delete' : 'edit';
  if (hasPermission(req.userRole, 'master_data', action)) return next();
  res.status(403).json({ error: 'You do not have permission to change PLC charges' });
});
const fail = (err: any, res: Response, next: NextFunction) => failWith(err, res, next, 'This location already has a PLC rate');
const one = async (c: any, sql: string, p: any[]) => (await c.query(sql, p)).rows[0];
const rateInput = (b: any, cur?: any) => {
  const rateType = has(b.rateType) ? b.rateType : cur ? cur.rate_type : 'per_sqft';
  if (rateType !== 'flat' && rateType !== 'per_sqft') throw bad('Rate type must be flat or per_sqft');
  const value = has(b.rateValue) ? num(b.rateValue, 'Rate', 100_000_000, 2) : cur ? Number(cur.rate_value) : NaN;
  if (!Number.isFinite(value) || value <= 0) throw bad('Rate must be more than 0');
  return { rateType, value };
};
export const plcAmount = (rateType: string, value: number, carpet: number | null) => (rateType === 'flat' ? r2(value) : r2(value * (carpet || 0)));

// GET /api/plc-charges?projectId= : the rates of a project, with the number of units at each location
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const projectId = uuid(req.query.projectId, 'projectId');
    const rows = (await db.query(
      `SELECT pc.id, pc.project_id, pc.unit_location_id, ul.name AS location_name, pc.rate_type, pc.rate_value, pc.is_active,
              (SELECT count(*)::int FROM units u WHERE u.unit_location_id = pc.unit_location_id) AS unit_count
         FROM plc_charges pc JOIN unit_locations ul ON ul.id = pc.unit_location_id
        WHERE pc.project_id = $1 ORDER BY ul.name`, [projectId])).rows;
    res.json({ success: true, data: rows });
  } catch (err) { fail(err, res, next); }
});

// GET /api/plc-charges/units?projectId=&locationId= : units of the project with their location (for the assign screen)
router.get('/units', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const projectId = uuid(req.query.projectId, 'projectId');
    const rows = (await db.query(
      `SELECT u.id, u.unit_number, t.tower_name, u.floor, u.status::text AS status, u.carpet_area_sqft, u.unit_location_id, ul.name AS location_name
         FROM units u JOIN towers t ON t.id = u.tower_id LEFT JOIN unit_locations ul ON ul.id = u.unit_location_id
        WHERE u.project_id = $1 ORDER BY t.tower_name, u.floor, u.unit_number LIMIT 5000`, [projectId])).rows;
    res.json({ success: true, data: rows });
  } catch (err) { fail(err, res, next); }
});

// GET /api/plc-charges/quote?unitId= : the PLC to offer for a unit (0 when its location has no active rate)
router.get('/quote', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const unitId = uuid(req.query.unitId, 'unitId');
    const row = await one(db,
      `SELECT u.carpet_area_sqft, ul.name AS location_name, pc.rate_type, pc.rate_value
         FROM units u LEFT JOIN unit_locations ul ON ul.id = u.unit_location_id
         LEFT JOIN plc_charges pc ON pc.unit_location_id = u.unit_location_id AND pc.is_active
        WHERE u.id = $1`, [unitId]);
    if (!row) throw bad('Unit not found', 404);
    if (!row.rate_type) return res.json({ success: true, data: { amount: 0, location: row.location_name || null, basis: null } });
    const amount = plcAmount(row.rate_type, Number(row.rate_value), row.carpet_area_sqft == null ? null : Number(row.carpet_area_sqft));
    res.json({ success: true, data: { amount, location: row.location_name, basis: row.rate_type === 'flat' ? 'flat' : `${Number(row.rate_value)} per sq ft` } });
  } catch (err) { fail(err, res, next); }
});

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const b = body(req); const projectId = uuid(b.projectId, 'projectId'), locationId = uuid(b.unitLocationId, 'unitLocationId'); const f = rateInput(b);
    const made = await inTx(async (c) => {
      if (!(await one(c, `SELECT 1 AS x FROM unit_locations WHERE id = $1 AND project_id = $2`, [locationId, projectId]))) throw bad('That location does not belong to this project');
      await c.query(`SELECT pg_advisory_xact_lock(hashtext('plc|' || $1))`, [locationId]);
      if (await one(c, `SELECT 1 AS x FROM plc_charges WHERE unit_location_id = $1`, [locationId])) throw bad('This location already has a PLC rate. Edit it instead.');
      return (await c.query(`INSERT INTO plc_charges (project_id, unit_location_id, rate_type, rate_value, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *`, [projectId, locationId, f.rateType, f.value, req.userId || null])).rows[0];
    });
    await auditChange(db, req, res, 'create', 'plc_charge', made.id, undefined, made);
    res.status(201).json({ success: true, data: made });
  } catch (err) { fail(err, res, next); }
});

router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const pid = uuid(req.params.id, 'PLC id'); const b = body(req); const active = flag(b.isActive, 'isActive');
    const out = await inTx(async (c) => {
      const cur = await one(c, `SELECT * FROM plc_charges WHERE id = $1 FOR UPDATE`, [pid]);
      if (!cur) throw bad('PLC rate not found', 404);
      const f = rateInput(b, cur);
      const upd = (await c.query(`UPDATE plc_charges SET rate_type = $2, rate_value = $3, is_active = $4, updated_at = now() WHERE id = $1 RETURNING *`, [pid, f.rateType, f.value, active ?? cur.is_active])).rows[0];
      return { cur, upd };
    });
    await auditChange(db, req, res, 'update', 'plc_charge', pid, out.cur, out.upd);
    res.json({ success: true, data: out.upd });
  } catch (err) { fail(err, res, next); }
});

// A rate is removed for good; units keep their location, and bookings already made keep the amount they were given
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const pid = uuid(req.params.id, 'PLC id');
    const gone = (await db.query(`DELETE FROM plc_charges WHERE id = $1 RETURNING *`, [pid])).rows[0];
    if (!gone) throw bad('PLC rate not found', 404);
    await auditChange(db, req, res, 'delete', 'plc_charge', pid, gone, undefined);
    res.json({ success: true });
  } catch (err) { fail(err, res, next); }
});

// POST /api/plc-charges/assign { projectId, unitLocationId | null, unitIds: [] } : set (or clear) the location of many units
router.post('/assign', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const b = body(req); const projectId = uuid(b.projectId, 'projectId');
    const locationId = b.unitLocationId === null ? null : uuid(b.unitLocationId, 'unitLocationId');
    if (!Array.isArray(b.unitIds) || !b.unitIds.length) throw bad('Choose at least one unit');
    if (b.unitIds.length > 2000) throw bad('Choose at most 2000 units at a time');
    const ids: string[] = [...new Set<string>(b.unitIds.map((x: any) => uuid(x, 'A unit id')))];
    const out = await inTx(async (c) => {
      if (locationId && !(await one(c, `SELECT 1 AS x FROM unit_locations WHERE id = $1 AND project_id = $2`, [locationId, projectId]))) throw bad('That location does not belong to this project');
      const ok = (await c.query(`SELECT id FROM units WHERE project_id = $1 AND id = ANY($2::uuid[])`, [projectId, ids])).rows.length;
      if (ok !== ids.length) throw bad('Some of these units are not in this project');
      await c.query(`UPDATE units SET unit_location_id = $3, updated_at = now() WHERE project_id = $1 AND id = ANY($2::uuid[])`, [projectId, ids, locationId]);
      return ids.length;
    });
    await auditChange(db, req, res, 'update', 'plc_assignment', projectId, undefined, { unit_location_id: locationId, units: out });
    res.json({ success: true, data: { updated: out } });
  } catch (err) { fail(err, res, next); }
});

export default router;
