/**
 * Employees: departments, teams, employee profiles, who reports to whom.
 * super_admin only (router guard below), except /directory.
 * /directory (names only) is open to every signed-in user for pick lists.
 */
import { Router, Response, NextFunction } from 'express';
import { db, AuthRequest } from '../index.js';
import { auditChange } from '../middleware/auditLogger.js';
import { pgErrorHandler } from '../middleware/pg-errors.js';
import { isUuid } from '../utils/security.js';
import { Bad, updateUser } from './users.js';
import { requireSuperAdmin } from '../middleware/superAdmin.js';

const router = Router();

// UR-001: every employees route is super_admin only except /directory (names for pick lists, open to every signed-in user).
router.use((req: AuthRequest, res: Response, next: NextFunction) =>
  req.method === 'GET' && req.path === '/directory' ? next() : requireSuperAdmin(req, res, next));

const fail = (status: number, message: string): never => { throw new Bad(status, message); };
const guard = (fn: (req: AuthRequest, res: Response) => Promise<unknown>) =>
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { await fn(req, res); }
    catch (e) { if (e instanceof Bad) return res.status(e.status).json({ error: e.message }); next(e); }
  };

// Reads the listed fields of the body that are present. Text is trimmed, blank becomes null, `<` and `>` are refused,
// and a text longer than its limit is refused. Returns only the fields that were sent.
type Spec = Record<string, { label: string; max: number; re?: RegExp; reMsg?: string }>;
function read(body: any, spec: Spec): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const [key, s] of Object.entries(spec)) {
    let v = body?.[key];
    if (v === undefined) continue;
    if (v !== null && typeof v !== 'string') fail(400, `Invalid ${s.label}`);
    if (typeof v === 'string') { v = v.replace(/[​-‍﻿]/g, '').trim(); if (v === '') v = null; }
    if (v !== null) {
      if (/[<>]/.test(v)) fail(400, `${s.label} cannot contain < or >`);
      if (v.length > s.max) fail(400, `${s.label} is longer than ${s.max} characters`);
      if (s.re && !s.re.test(v)) fail(400, s.reMsg || `Invalid ${s.label}`);
    }
    out[key] = v;
  }
  return out;
}

const PHONE = /^[0-9+\-\s()]{6,20}$/;
const DEPT_SPEC: Spec = { name: { label: 'Department name', max: 150 }, description: { label: 'Description', max: 500 } };
const TEAM_SPEC: Spec = { name: { label: 'Team name', max: 150 }, description: { label: 'Description', max: 500 } };
const EMP_SPEC: Spec = {
  employee_code: { label: 'Employee code', max: 50, re: /^[A-Za-z0-9._/-]+$/, reMsg: 'Employee code may have letters, digits and . _ / -' },
  designation: { label: 'Designation', max: 150 }, salary_grade: { label: 'Salary grade', max: 50 },
  mobile_office: { label: 'Office mobile', max: 20, re: PHONE, reMsg: 'Enter a valid office mobile number' },
  mobile_personal: { label: 'Personal mobile', max: 20, re: PHONE, reMsg: 'Enter a valid personal mobile number' },
  emergency_contact: { label: 'Emergency contact', max: 20, re: PHONE, reMsg: 'Enter a valid emergency contact number' },
  address: { label: 'Address', max: 500 }, city: { label: 'City', max: 100 }, state: { label: 'State', max: 100 },
};
// Only super_admin sees pay and private contact details
const SENSITIVE = ['salary_grade', 'mobile_personal', 'emergency_contact', 'address'];
const hide = (req: AuthRequest, row: Record<string, any>) => {
  if (req.userRole !== 'super_admin') for (const k of SENSITIVE) delete row[k];
  return row;
};

const idOr404 = (v: unknown, what: string) => { if (!isUuid(v)) fail(404, `${what} not found`); return v as string; };
async function activeUser(id: unknown, what: string): Promise<string> {
  if (!isUuid(id)) return fail(400, `${what} not found`);
  const r = await db.query(`SELECT 1 FROM users WHERE id = $1 AND is_active = true`, [id]);
  return r.rowCount ? (id as string) : fail(400, `${what} not found or not active`);
}
async function department(id: unknown): Promise<string> {
  if (!isUuid(id) || !(await db.query(`SELECT 1 FROM departments WHERE id = $1`, [id])).rowCount) return fail(400, 'Department not found');
  return id as string;
}
async function dateOrNull(v: unknown): Promise<string | null> {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) return fail(400, 'Joining date must be a date like 2026-01-31');
  return v;
}

// A manager must be an active user, not the person themselves, and not someone who reports to them (a loop)
async function checkManager(userId: string, managerId: string) {
  await activeUser(managerId, 'Manager');
  if (managerId === userId) fail(400, 'A person cannot be their own manager');
  const loop = await db.query(
    `WITH RECURSIVE below AS (
       SELECT user_id FROM employee_profiles WHERE manager_id = $1
       UNION SELECT e.user_id FROM employee_profiles e JOIN below b ON e.manager_id = b.user_id)
     SELECT 1 FROM below WHERE user_id = $2`, [userId, managerId]);
  if (loop.rowCount) fail(400, 'That manager reports to this person (directly or through others), which would make a loop');
}

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------
router.get('/departments', guard(async (_req, res) => {
  const r = await db.query(`
    SELECT d.*, u.name AS head_name,
           (SELECT COUNT(*)::int FROM employee_profiles ep WHERE ep.department_id = d.id AND ep.is_active) AS employee_count,
           (SELECT COUNT(*)::int FROM teams t WHERE t.department_id = d.id) AS team_count
    FROM departments d LEFT JOIN users u ON u.id = d.head_user_id
    ORDER BY d.name`);
  res.json({ success: true, data: r.rows });
}));

async function deptNameTaken(name: string, exceptId?: string) {
  return (await db.query(`SELECT 1 FROM departments WHERE lower(name) = lower($1) AND ($2::uuid IS NULL OR id <> $2)`, [name, exceptId ?? null])).rowCount! > 0;
}

router.post('/departments', guard(async (req, res) => {
  const v = read(req.body, DEPT_SPEC);
  if (!v.name) fail(400, 'Department name is required');
  if (await deptNameTaken(v.name!)) fail(409, 'A department with this name already exists');
  const head = req.body.head_user_id ? await activeUser(req.body.head_user_id, 'Department head') : null;
  const r = await db.query(`INSERT INTO departments (name, description, head_user_id, created_by) VALUES ($1,$2,$3,$4) RETURNING *`,
    [v.name, v.description ?? null, head, req.userId]);
  await auditChange(db, req, res, 'create', 'department', r.rows[0].id, undefined, r.rows[0]);
  res.status(201).json({ success: true, data: r.rows[0] });
}));

router.patch('/departments/:id', guard(async (req, res) => {
  const id = idOr404(req.params.id, 'Department');
  const old = (await db.query(`SELECT * FROM departments WHERE id = $1`, [id])).rows[0];
  if (!old) fail(404, 'Department not found');
  const v = read(req.body, DEPT_SPEC);
  if ('name' in v && !v.name) fail(400, 'Department name is required');
  if (v.name && await deptNameTaken(v.name, id)) fail(409, 'A department with this name already exists');
  const set: Record<string, unknown> = { ...v };
  if ('head_user_id' in req.body) set.head_user_id = req.body.head_user_id ? await activeUser(req.body.head_user_id, 'Department head') : null;
  if ('is_active' in req.body) { if (typeof req.body.is_active !== 'boolean') fail(400, 'is_active must be true or false'); set.is_active = req.body.is_active; }
  const keys = Object.keys(set);
  if (!keys.length) fail(400, 'Nothing to update');
  const r = await db.query(`UPDATE departments SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')}, updated_at = NOW() WHERE id = $${keys.length + 1} RETURNING *`,
    [...keys.map((k) => set[k]), id]);
  await auditChange(db, req, res, 'update', 'department', id, old, r.rows[0]);
  res.json({ success: true, data: r.rows[0] });
}));

router.delete('/departments/:id', guard(async (req, res) => {
  const id = idOr404(req.params.id, 'Department');
  const old = (await db.query(`SELECT * FROM departments WHERE id = $1`, [id])).rows[0];
  if (!old) fail(404, 'Department not found');
  const use = (await db.query(`SELECT (SELECT COUNT(*)::int FROM employee_profiles WHERE department_id = $1) AS e, (SELECT COUNT(*)::int FROM teams WHERE department_id = $1) AS t`, [id])).rows[0];
  if (use.e || use.t) fail(409, `${use.e} employee(s) and ${use.t} team(s) use this department. Move them first, or mark the department inactive instead.`);
  await db.query(`DELETE FROM departments WHERE id = $1`, [id]);
  await auditChange(db, req, res, 'delete', 'department', id, old, undefined);
  res.json({ success: true, data: { id } });
}));

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------
router.get('/teams', guard(async (req, res) => {
  const { department_id } = req.query;
  if (department_id && !isUuid(department_id)) fail(400, 'Invalid department_id');
  const r = await db.query(`
    SELECT t.*, d.name AS department_name, u.name AS team_head_name, COUNT(tm.id)::int AS member_count
    FROM teams t
    LEFT JOIN departments d ON d.id = t.department_id
    LEFT JOIN users u ON u.id = t.team_head_id
    LEFT JOIN team_members tm ON tm.team_id = t.id
    ${department_id ? 'WHERE t.department_id = $1' : ''}
    GROUP BY t.id, d.name, u.name ORDER BY t.name`, department_id ? [department_id] : []);
  res.json({ success: true, data: r.rows });
}));

async function teamNameTaken(name: string, departmentId: string | null, exceptId?: string) {
  return (await db.query(
    `SELECT 1 FROM teams WHERE lower(name) = lower($1) AND department_id IS NOT DISTINCT FROM $2::uuid AND ($3::uuid IS NULL OR id <> $3)`,
    [name, departmentId, exceptId ?? null])).rowCount! > 0;
}

// The team head is always a member of the team
async function makeHead(client: { query: typeof db.query }, teamId: string, userId: string | null, oldHead: string | null) {
  if (oldHead && oldHead !== userId) await client.query(`UPDATE team_members SET role_in_team = 'member' WHERE team_id = $1 AND user_id = $2 AND role_in_team = 'head'`, [teamId, oldHead]);
  if (userId) await client.query(
    `INSERT INTO team_members (team_id, user_id, role_in_team) VALUES ($1,$2,'head') ON CONFLICT (team_id, user_id) DO UPDATE SET role_in_team = 'head'`, [teamId, userId]);
}

router.post('/teams', guard(async (req, res) => {
  const v = read(req.body, TEAM_SPEC);
  if (!v.name) fail(400, 'Team name is required');
  const dept = req.body.department_id ? await department(req.body.department_id) : null;
  const head = req.body.team_head_id ? await activeUser(req.body.team_head_id, 'Team head') : null;
  if (await teamNameTaken(v.name!, dept)) fail(409, 'A team with this name already exists in this department');
  const r = await db.query(`INSERT INTO teams (name, department_id, team_head_id, description, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [v.name, dept, head, v.description ?? null, req.userId]);
  await makeHead(db, r.rows[0].id, head, null);
  await auditChange(db, req, res, 'create', 'team', r.rows[0].id, undefined, r.rows[0]);
  res.status(201).json({ success: true, data: r.rows[0] });
}));

router.patch('/teams/:id', guard(async (req, res) => {
  const id = idOr404(req.params.id, 'Team');
  const old = (await db.query(`SELECT * FROM teams WHERE id = $1`, [id])).rows[0];
  if (!old) fail(404, 'Team not found');
  const v = read(req.body, TEAM_SPEC);
  if ('name' in v && !v.name) fail(400, 'Team name is required');
  const set: Record<string, unknown> = { ...v };
  if ('department_id' in req.body) set.department_id = req.body.department_id ? await department(req.body.department_id) : null;
  if ('team_head_id' in req.body) set.team_head_id = req.body.team_head_id ? await activeUser(req.body.team_head_id, 'Team head') : null;
  if ('is_active' in req.body) { if (typeof req.body.is_active !== 'boolean') fail(400, 'is_active must be true or false'); set.is_active = req.body.is_active; }
  const keys = Object.keys(set);
  if (!keys.length) fail(400, 'Nothing to update');
  const name = (set.name as string) ?? old.name;
  const dept = 'department_id' in set ? (set.department_id as string | null) : old.department_id;
  if (await teamNameTaken(name, dept, id)) fail(409, 'A team with this name already exists in this department');
  const r = await db.query(`UPDATE teams SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')}, updated_at = NOW() WHERE id = $${keys.length + 1} RETURNING *`,
    [...keys.map((k) => set[k]), id]);
  if ('team_head_id' in set) await makeHead(db, id, set.team_head_id as string | null, old.team_head_id);
  await auditChange(db, req, res, 'update', 'team', id, old, r.rows[0]);
  res.json({ success: true, data: r.rows[0] });
}));

router.delete('/teams/:id', guard(async (req, res) => {
  const id = idOr404(req.params.id, 'Team');
  const r = await db.query(`DELETE FROM teams WHERE id = $1 RETURNING *`, [id]);
  if (!r.rows[0]) fail(404, 'Team not found');
  await auditChange(db, req, res, 'delete', 'team', id, r.rows[0], undefined);
  res.json({ success: true, data: { id } });
}));

router.get('/teams/:id/members', guard(async (req, res) => {
  const id = idOr404(req.params.id, 'Team');
  if (!(await db.query(`SELECT 1 FROM teams WHERE id = $1`, [id])).rowCount) fail(404, 'Team not found');
  const r = await db.query(`
    SELECT tm.*, u.name, u.email, u.role, ep.designation, ep.employee_code
    FROM team_members tm JOIN users u ON u.id = tm.user_id
    LEFT JOIN employee_profiles ep ON ep.user_id = tm.user_id
    WHERE tm.team_id = $1 ORDER BY (tm.role_in_team = 'head') DESC, u.name`, [id]);
  res.json({ success: true, data: r.rows });
}));

router.post('/teams/:id/members', guard(async (req, res) => {
  const id = idOr404(req.params.id, 'Team');
  if (!(await db.query(`SELECT 1 FROM teams WHERE id = $1`, [id])).rowCount) fail(404, 'Team not found');
  const userId = await activeUser(req.body?.user_id, 'Member');
  const v = read(req.body, { role_in_team: { label: 'Role in team', max: 100 } });
  const role = v.role_in_team || 'member';
  if (role === 'head') fail(400, 'Use Set head to choose the team head');
  const r = await db.query(
    `INSERT INTO team_members (team_id, user_id, role_in_team) VALUES ($1,$2,$3)
     ON CONFLICT (team_id, user_id) DO UPDATE SET role_in_team = CASE WHEN team_members.role_in_team = 'head' THEN 'head' ELSE EXCLUDED.role_in_team END
     RETURNING *`, [id, userId, role]);
  await auditChange(db, req, res, 'update', 'team', id, undefined, { memberAdded: userId });
  res.status(201).json({ success: true, data: r.rows[0] });
}));

router.delete('/teams/:id/members/:userId', guard(async (req, res) => {
  const id = idOr404(req.params.id, 'Team');
  const userId = idOr404(req.params.userId, 'Member');
  const r = await db.query(`DELETE FROM team_members WHERE team_id = $1 AND user_id = $2 RETURNING id`, [id, userId]);
  if (!r.rows[0]) fail(404, 'That person is not in this team');
  await db.query(`UPDATE teams SET team_head_id = NULL, updated_at = NOW() WHERE id = $1 AND team_head_id = $2`, [id, userId]);
  await auditChange(db, req, res, 'update', 'team', id, undefined, { memberRemoved: userId });
  res.json({ success: true });
}));

router.patch('/teams/:id/set-head', guard(async (req, res) => {
  const id = idOr404(req.params.id, 'Team');
  const old = (await db.query(`SELECT * FROM teams WHERE id = $1`, [id])).rows[0];
  if (!old) fail(404, 'Team not found');
  const head = req.body?.team_head_id ? await activeUser(req.body.team_head_id, 'Team head') : null;
  const r = await db.query(`UPDATE teams SET team_head_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *`, [head, id]);
  await makeHead(db, id, head, old.team_head_id);
  await auditChange(db, req, res, 'update', 'team', id, { team_head_id: old.team_head_id }, { team_head_id: head });
  res.json({ success: true, data: r.rows[0] });
}));

// ---------------------------------------------------------------------------
// Employee profiles. Static paths MUST stay before /:id
// ---------------------------------------------------------------------------

// GET /api/employees/directory: names for pick lists (no pay or private details). Open to every signed-in user.
router.get('/directory', guard(async (_req, res) => {
  const r = await db.query(`
    SELECT ep.user_id AS id, u.name
    FROM employee_profiles ep JOIN users u ON u.id = ep.user_id
    WHERE ep.is_active AND u.is_active AND u.role <> 'super_admin'
      AND NOT EXISTS (SELECT 1 FROM roles r WHERE lower(r.name) = lower(u.role) AND r.is_active AND r.base_role = 'super_admin') ORDER BY u.name`);
  res.json({ success: true, data: r.rows });
}));

router.get('/', guard(async (req, res) => {
  const { department_id, is_active, search } = req.query;
  const where: string[] = []; const params: any[] = [];
  if (department_id) { if (!isUuid(department_id)) fail(400, 'Invalid department_id'); params.push(department_id); where.push(`ep.department_id = $${params.length}`); }
  if (is_active !== undefined) { params.push(is_active === 'true'); where.push(`ep.is_active = $${params.length}`); }
  if (search) {
    params.push(`%${String(search).replace(/[\\%_]/g, (m) => '\\' + m)}%`);
    where.push(`(u.name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR ep.employee_code ILIKE $${params.length} OR ep.designation ILIKE $${params.length})`);
  }
  const r = await db.query(`
    SELECT ep.*, u.name, u.email, u.role, d.name AS department_name, m.name AS manager_name
    FROM employee_profiles ep JOIN users u ON u.id = ep.user_id
    LEFT JOIN departments d ON d.id = ep.department_id
    LEFT JOIN users m ON m.id = ep.manager_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY u.name`, params);
  res.json({ success: true, data: r.rows.map((row) => hide(req, row)) });
}));

// People per department, including those with no department
router.get('/report', guard(async (_req, res) => {
  const r = await db.query(`
    SELECT COALESCE(d.name, 'No department') AS department,
           COUNT(ep.id)::int AS total,
           COUNT(ep.id) FILTER (WHERE ep.is_active)::int AS active,
           COUNT(ep.id) FILTER (WHERE NOT ep.is_active)::int AS inactive
    FROM employee_profiles ep LEFT JOIN departments d ON d.id = ep.department_id
    GROUP BY d.name
    UNION ALL
    SELECT d.name, 0, 0, 0 FROM departments d WHERE NOT EXISTS (SELECT 1 FROM employee_profiles e WHERE e.department_id = d.id)
    ORDER BY 1`);
  res.json({ success: true, data: r.rows });
}));

// Who reports to whom. Someone whose manager is not an active employee shows at the top level.
router.get('/tree', guard(async (_req, res) => {
  const r = await db.query(`
    SELECT ep.user_id AS id, u.name, u.email, ep.designation, ep.manager_id, ep.employee_code, d.name AS department_name, ep.is_active
    FROM employee_profiles ep JOIN users u ON u.id = ep.user_id LEFT JOIN departments d ON d.id = ep.department_id
    WHERE ep.is_active = TRUE ORDER BY u.name`);
  const byId: Record<string, any> = {};
  r.rows.forEach((e) => { byId[e.id] = { ...e, children: [] }; });
  const roots: any[] = [];
  r.rows.forEach((e) => {
    if (e.manager_id && e.manager_id !== e.id && byId[e.manager_id]) byId[e.manager_id].children.push(byId[e.id]);
    else roots.push(byId[e.id]);
  });
  // Old data may hold a loop (A manages B manages A). Nobody in a loop is reachable from a top level, so one of them is put on top
  // and cut loose from the manager above it, which also keeps the answer a real tree.
  const seen = new Set<string>();
  const walk = (n: any) => { if (seen.has(n.id)) return; seen.add(n.id); n.children.forEach(walk); };
  roots.forEach(walk);
  for (const e of r.rows) {
    if (seen.has(e.id)) continue;
    const parent = byId[e.manager_id];
    if (parent) parent.children = parent.children.filter((c: any) => c.id !== e.id);
    roots.push(byId[e.id]);
    walk(byId[e.id]);
  }
  res.json({ success: true, data: roots });
}));

router.post('/', guard(async (req, res) => {
  const userId = await activeUser(req.body?.user_id, 'User');
  if ((await db.query(`SELECT 1 FROM employee_profiles WHERE user_id = $1`, [userId])).rowCount) fail(409, 'This person already has an employee profile. Edit it instead.');
  const v = read(req.body, EMP_SPEC);
  if (v.employee_code && (await db.query(`SELECT 1 FROM employee_profiles WHERE lower(employee_code) = lower($1)`, [v.employee_code])).rowCount) fail(409, 'This employee code is already used');
  const dept = req.body.department_id ? await department(req.body.department_id) : null;
  const joining = await dateOrNull(req.body.joining_date);
  if (req.body.manager_id) await checkManager(userId, req.body.manager_id);
  const r = await db.query(
    `INSERT INTO employee_profiles (user_id, department_id, employee_code, designation, joining_date, salary_grade, manager_id, mobile_office,
        mobile_personal, emergency_contact, address, city, state, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [userId, dept, v.employee_code ?? null, v.designation ?? null, joining, v.salary_grade ?? null, req.body.manager_id || null,
     v.mobile_office ?? null, v.mobile_personal ?? null, v.emergency_contact ?? null, v.address ?? null, v.city ?? null, v.state ?? null, req.userId]);
  await auditChange(db, req, res, 'create', 'employee', r.rows[0].id, undefined, { user_id: userId, employee_code: v.employee_code });
  res.status(201).json({ success: true, data: r.rows[0] });
}));

async function profileOf(idParam: string) {
  if (!isUuid(idParam)) return fail(404, 'Employee not found');
  const row = (await db.query(`SELECT * FROM employee_profiles WHERE user_id = $1 OR id = $1`, [idParam])).rows[0];
  return row ?? fail(404, 'Employee not found');
}

router.get('/:id', guard(async (req, res) => {
  if (!isUuid(req.params.id)) fail(404, 'Employee profile not found');
  const r = await db.query(`
    SELECT ep.*, u.name, u.email, u.role, d.name AS department_name, m.name AS manager_name
    FROM employee_profiles ep JOIN users u ON u.id = ep.user_id
    LEFT JOIN departments d ON d.id = ep.department_id LEFT JOIN users m ON m.id = ep.manager_id
    WHERE ep.user_id = $1 OR ep.id = $1`, [req.params.id]);
  if (!r.rows[0]) fail(404, 'Employee profile not found');
  res.json({ success: true, data: hide(req, r.rows[0]) });
}));

router.patch('/:id/set-manager', guard(async (req, res) => {
  const p = await profileOf(req.params.id);
  if (req.body?.manager_id) await checkManager(p.user_id, req.body.manager_id);
  const r = await db.query(`UPDATE employee_profiles SET manager_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *`, [req.body?.manager_id || null, p.id]);
  await auditChange(db, req, res, 'update', 'employee', p.id, { manager_id: p.manager_id }, { manager_id: r.rows[0].manager_id });
  res.json({ success: true, data: r.rows[0] });
}));

// Only the fields sent change (null clears a field). Switching an employee off also switches their login off.
router.patch('/:id', guard(async (req, res) => {
  const p = await profileOf(req.params.id);
  const v = read(req.body, EMP_SPEC);
  if (v.employee_code && (await db.query(`SELECT 1 FROM employee_profiles WHERE lower(employee_code) = lower($1) AND id <> $2`, [v.employee_code, p.id])).rowCount) fail(409, 'This employee code is already used');
  const set: Record<string, unknown> = { ...v };
  if ('department_id' in req.body) set.department_id = req.body.department_id ? await department(req.body.department_id) : null;
  if ('joining_date' in req.body) set.joining_date = await dateOrNull(req.body.joining_date);
  if ('manager_id' in req.body) {
    if (req.body.manager_id) await checkManager(p.user_id, req.body.manager_id);
    set.manager_id = req.body.manager_id || null;
  }
  if ('is_active' in req.body) {
    if (typeof req.body.is_active !== 'boolean') fail(400, 'is_active must be true or false');
    set.is_active = req.body.is_active;
    // The login follows. This refuses (400 or 409) when it is your own login or the last super admin.
    if (req.body.is_active !== p.is_active) await updateUser(req, res, p.user_id, { isActive: req.body.is_active, reviewedGrants: req.body.reviewedGrants }); // UR-011: switching a leaver back on needs the access review too
  }
  const keys = Object.keys(set);
  if (!keys.length) fail(400, 'Nothing to update');
  const r = await db.query(`UPDATE employee_profiles SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')}, updated_at = NOW() WHERE id = $${keys.length + 1} RETURNING *`,
    [...keys.map((k) => set[k]), p.id]);
  await auditChange(db, req, res, 'update', 'employee', p.id, { employee_code: p.employee_code, is_active: p.is_active, manager_id: p.manager_id }, { ...Object.fromEntries(keys.filter((k) => !SENSITIVE.includes(k)).map((k) => [k, set[k]])) });
  res.json({ success: true, data: hide(req, r.rows[0]) });
}));

router.use(pgErrorHandler);

export default router;
