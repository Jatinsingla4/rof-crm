import { Router, Response } from 'express';
import { db } from '../index.js';
import { AuthRequest } from '../index.js';

const router = Router();

// ═══════════════════════════════════════════════════════════
// DEPARTMENTS  (all static routes before /:id)
// ═══════════════════════════════════════════════════════════

router.get('/departments', async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.query(`
      SELECT d.*, u.name AS head_name
      FROM   departments d
      LEFT JOIN users u ON u.id = d.head_user_id
      ORDER BY d.name
    `);
    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    console.error('GET /departments:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/departments', async (req: AuthRequest, res: Response) => {
  const { name, description, head_user_id } = req.body;
  if (!name) return res.status(400).json({ error: 'Department name is required' });
  try {
    const r = await db.query(
      `INSERT INTO departments (name, description, head_user_id, created_by)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [name.trim(), description || null, head_user_id || null, req.userId]
    );
    res.status(201).json({ success: true, data: r.rows[0] });
  } catch (err: any) {
    if (err.code === '23505') return res.status(400).json({ error: 'Department name already exists' });
    res.status(500).json({ error: err.message });
  }
});

router.patch('/departments/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, description, head_user_id, is_active } = req.body;
  try {
    const r = await db.query(
      `UPDATE departments
       SET name = COALESCE($1, name), description = COALESCE($2, description),
           head_user_id = $3, is_active = COALESCE($4, is_active), updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [name || null, description || null, head_user_id || null, is_active ?? null, id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Department not found' });
    res.json({ success: true, data: r.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/departments/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const r = await db.query(`DELETE FROM departments WHERE id = $1 RETURNING id`, [id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Department not found' });
    res.json({ success: true, data: { id } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// TEAMS  (static — before /:id)
// ═══════════════════════════════════════════════════════════

router.get('/teams', async (req: AuthRequest, res: Response) => {
  const { department_id } = req.query;
  try {
    const cond = department_id ? 'WHERE t.department_id = $1' : '';
    const params = department_id ? [department_id] : [];
    const result = await db.query(`
      SELECT t.*, d.name AS department_name, u.name AS team_head_name,
             COUNT(tm.id) AS member_count
      FROM   teams t
      LEFT JOIN departments d  ON d.id  = t.department_id
      LEFT JOIN users u        ON u.id  = t.team_head_id
      LEFT JOIN team_members tm ON tm.team_id = t.id
      ${cond}
      GROUP BY t.id, d.name, u.name
      ORDER BY t.name
    `, params);
    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/teams', async (req: AuthRequest, res: Response) => {
  const { name, department_id, team_head_id, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Team name is required' });
  try {
    const r = await db.query(
      `INSERT INTO teams (name, department_id, team_head_id, description, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name.trim(), department_id || null, team_head_id || null, description || null, req.userId]
    );
    res.status(201).json({ success: true, data: r.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/teams/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, department_id, team_head_id, description, is_active } = req.body;
  try {
    const r = await db.query(
      `UPDATE teams SET
         name = COALESCE($1, name), department_id = COALESCE($2, department_id),
         team_head_id = $3, description = COALESCE($4, description),
         is_active = COALESCE($5, is_active), updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [name || null, department_id || null, team_head_id || null,
       description || null, is_active ?? null, id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Team not found' });
    res.json({ success: true, data: r.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/teams/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const r = await db.query(`DELETE FROM teams WHERE id = $1 RETURNING id`, [id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Team not found' });
    res.json({ success: true, data: { id } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/teams/:id/members', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const result = await db.query(`
      SELECT tm.*, u.name, u.email, u.role, ep.designation, ep.employee_code
      FROM   team_members tm
      JOIN   users u ON u.id = tm.user_id
      LEFT JOIN employee_profiles ep ON ep.user_id = tm.user_id
      WHERE  tm.team_id = $1
      ORDER BY u.name
    `, [id]);
    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/teams/:id/members', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { user_id, role_in_team } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });
  try {
    const r = await db.query(
      `INSERT INTO team_members (team_id, user_id, role_in_team)
       VALUES ($1,$2,$3)
       ON CONFLICT (team_id, user_id) DO UPDATE SET role_in_team = EXCLUDED.role_in_team
       RETURNING *`,
      [id, user_id, role_in_team || 'member']
    );
    res.status(201).json({ success: true, data: r.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/teams/:id/members/:userId', async (req: AuthRequest, res: Response) => {
  const { id, userId } = req.params;
  try {
    await db.query(`DELETE FROM team_members WHERE team_id = $1 AND user_id = $2`, [id, userId]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/teams/:id/set-head', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { team_head_id } = req.body;
  try {
    const r = await db.query(
      `UPDATE teams SET team_head_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [team_head_id || null, id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Team not found' });
    res.json({ success: true, data: r.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// EMPLOYEE PROFILES — static routes BEFORE /:id
// ═══════════════════════════════════════════════════════════

// GET /api/employees  (list all)
router.get('/', async (req: AuthRequest, res: Response) => {
  const { department_id, is_active, search } = req.query;
  try {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (department_id) { conditions.push(`ep.department_id = $${idx++}`); params.push(department_id); }
    if (is_active !== undefined) { conditions.push(`ep.is_active = $${idx++}`); params.push(is_active === 'true'); }
    if (search) {
      conditions.push(`(u.name ILIKE $${idx} OR u.email ILIKE $${idx} OR ep.employee_code ILIKE $${idx} OR ep.designation ILIKE $${idx})`);
      params.push(`%${search}%`); idx++;
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await db.query(`
      SELECT ep.*, u.name, u.email, u.role, d.name AS department_name, m.name AS manager_name
      FROM   employee_profiles ep
      JOIN   users u        ON u.id  = ep.user_id
      LEFT JOIN departments d ON d.id = ep.department_id
      LEFT JOIN users m        ON m.id = ep.manager_id
      ${where}
      ORDER BY u.name
    `, params);

    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/employees/report  — department summary (static, must be before /:id)
router.get('/report', async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.query(`
      SELECT d.name AS department,
             COUNT(ep.id)                               AS total,
             COUNT(ep.id) FILTER (WHERE ep.is_active)   AS active,
             COUNT(ep.id) FILTER (WHERE NOT ep.is_active) AS inactive
      FROM   departments d
      LEFT JOIN employee_profiles ep ON ep.department_id = d.id
      GROUP BY d.name
      ORDER BY d.name
    `);
    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/employees/tree  — org hierarchy (static, must be before /:id)
router.get('/tree', async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.query(`
      SELECT ep.user_id AS id, u.name, u.email, ep.designation,
             ep.manager_id, ep.employee_code, d.name AS department_name, ep.is_active
      FROM   employee_profiles ep
      JOIN   users u ON u.id = ep.user_id
      LEFT JOIN departments d ON d.id = ep.department_id
      WHERE  ep.is_active = TRUE
      ORDER BY u.name
    `);

    const all = result.rows;
    const byId: Record<string, any> = {};
    all.forEach(e => { byId[e.id] = { ...e, children: [] }; });

    const roots: any[] = [];
    all.forEach(e => {
      if (e.manager_id && byId[e.manager_id]) {
        byId[e.manager_id].children.push(byId[e.id]);
      } else {
        roots.push(byId[e.id]);
      }
    });

    res.json({ success: true, data: roots });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/employees  — create/upsert profile
router.post('/', async (req: AuthRequest, res: Response) => {
  const {
    user_id, department_id, employee_code, designation, joining_date,
    salary_grade, manager_id, mobile_office, mobile_personal,
    emergency_contact, address, city, state,
  } = req.body;

  if (!user_id) return res.status(400).json({ error: 'user_id is required' });

  try {
    const r = await db.query(
      `INSERT INTO employee_profiles
         (user_id, department_id, employee_code, designation, joining_date,
          salary_grade, manager_id, mobile_office, mobile_personal,
          emergency_contact, address, city, state, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (user_id) DO UPDATE SET
         department_id     = EXCLUDED.department_id,
         employee_code     = EXCLUDED.employee_code,
         designation       = EXCLUDED.designation,
         joining_date      = EXCLUDED.joining_date,
         salary_grade      = EXCLUDED.salary_grade,
         manager_id        = EXCLUDED.manager_id,
         mobile_office     = EXCLUDED.mobile_office,
         mobile_personal   = EXCLUDED.mobile_personal,
         emergency_contact = EXCLUDED.emergency_contact,
         address           = EXCLUDED.address,
         city              = EXCLUDED.city,
         state             = EXCLUDED.state,
         updated_at        = NOW()
       RETURNING *`,
      [user_id, department_id || null, employee_code || null, designation || null,
       joining_date || null, salary_grade || null, manager_id || null,
       mobile_office || null, mobile_personal || null, emergency_contact || null,
       address || null, city || null, state || null, req.userId]
    );
    res.status(201).json({ success: true, data: r.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/employees/:id  (single, after all static routes)
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const r = await db.query(`
      SELECT ep.*, u.name, u.email, u.role, d.name AS department_name, m.name AS manager_name
      FROM   employee_profiles ep
      JOIN   users u ON u.id = ep.user_id
      LEFT JOIN departments d ON d.id = ep.department_id
      LEFT JOIN users m        ON m.id = ep.manager_id
      WHERE  ep.user_id = $1 OR ep.id = $1
    `, [id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Employee profile not found' });
    res.json({ success: true, data: r.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/employees/:id/set-manager
router.patch('/:id/set-manager', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { manager_id } = req.body;
  try {
    const r = await db.query(
      `UPDATE employee_profiles SET manager_id = $1, updated_at = NOW()
       WHERE user_id = $2 OR id = $2 RETURNING *`,
      [manager_id || null, id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Employee not found' });
    res.json({ success: true, data: r.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/employees/:id
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const {
    department_id, employee_code, designation, joining_date, salary_grade,
    manager_id, mobile_office, mobile_personal, emergency_contact,
    address, city, state, is_active,
  } = req.body;
  try {
    const r = await db.query(
      `UPDATE employee_profiles SET
         department_id     = COALESCE($1,  department_id),
         employee_code     = COALESCE($2,  employee_code),
         designation       = COALESCE($3,  designation),
         joining_date      = COALESCE($4,  joining_date),
         salary_grade      = COALESCE($5,  salary_grade),
         manager_id        = $6,
         mobile_office     = COALESCE($7,  mobile_office),
         mobile_personal   = COALESCE($8,  mobile_personal),
         emergency_contact = COALESCE($9,  emergency_contact),
         address           = COALESCE($10, address),
         city              = COALESCE($11, city),
         state             = COALESCE($12, state),
         is_active         = COALESCE($13, is_active),
         updated_at        = NOW()
       WHERE user_id = $14 OR id = $14 RETURNING *`,
      [department_id || null, employee_code || null, designation || null,
       joining_date || null, salary_grade || null, manager_id || null,
       mobile_office || null, mobile_personal || null, emergency_contact || null,
       address || null, city || null, state || null, is_active ?? null, id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Employee not found' });
    res.json({ success: true, data: r.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
