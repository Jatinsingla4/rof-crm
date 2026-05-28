/**
 * Users Routes - Module G
 * RBAC, user management, role definitions, permissions, audit logs
 */

import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../index.js';
import { AuthRequest } from '../index.js';

const router = Router();

// Pre-defined roles
const ROLES = {
  SUPER_ADMIN: 'super_admin',
  PROJECT_MANAGER: 'project_manager',
  SALES_EXECUTIVE: 'sales_executive',
  ACCOUNTS_FINANCE: 'accounts_finance',
  SUPPORT_AGENT: 'support_agent',
  READ_ONLY_VIEWER: 'read_only_viewer',
};

// POST /api/users - Create user
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, email, mobile, role, assignedProjectIds, password } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!Object.values(ROLES).includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    let passwordHash: string | null = null;
    if (password && typeof password === 'string' && password.length >= 8) {
      passwordHash = await bcrypt.hash(password, 12);
    }

    const result = await db.query(
      `INSERT INTO users (name, email, mobile, role, password_hash, assigned_project_ids, is_active, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, true, $7)
       RETURNING id, name, email, role, assigned_project_ids, created_at`,
      [name, email, mobile || null, role, passwordHash, JSON.stringify(assignedProjectIds || []), req.userId]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/users - List users
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { role, projectId, page = 1, pageSize = 20 } = req.query;

    let query = `SELECT id, name, email, mobile, role, assigned_project_ids, is_active, created_at
                 FROM users WHERE 1=1`;
    const params: any[] = [];

    if (role) {
      query += ` AND role = $${params.length + 1}`;
      params.push(role);
    }

    // Filter users assigned to specific project
    if (projectId) {
      query += ` AND assigned_project_ids::text LIKE $${params.length + 1}`;
      params.push(`%"${projectId}"%`);
    }

    query += ` ORDER BY created_at DESC`;
    query += ` LIMIT ${pageSize} OFFSET ${((page as number) - 1) * (pageSize as number)}`;

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/users/roles - Get role definitions
router.get('/roles', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Return predefined roles with permissions
    const rolePermissions = {
      super_admin: {
        modules: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
        actions: ['view', 'create', 'edit', 'delete'],
        projectScoping: false,
      },
      project_manager: {
        modules: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
        actions: ['view', 'create', 'edit'],
        projectScoping: true,
      },
      sales_executive: {
        modules: ['B', 'C', 'D', 'F'],
        actions: ['view', 'create', 'edit'],
        projectScoping: true,
        scopedTo: 'assigned_consumers',
      },
      accounts_finance: {
        modules: ['D', 'E', 'G'],
        actions: ['view', 'create', 'edit'],
        projectScoping: true,
      },
      support_agent: {
        modules: ['B', 'F'],
        actions: ['view', 'create'],
        projectScoping: true,
      },
      read_only_viewer: {
        modules: ['G'],
        actions: ['view'],
        projectScoping: true,
      },
    };

    res.json({
      success: true,
      data: rolePermissions,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/users/permissions - Check user permission
router.post('/permissions', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { userId, module, action, resourceId } = req.body;

    // Get user role
    const userResult = await db.query(`SELECT role FROM users WHERE id = $1`, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userRole = userResult.rows[0].role;

    // Check permissions (simplified)
    const hasPermission =
      (userRole === ROLES.SUPER_ADMIN) ||
      (userRole === ROLES.PROJECT_MANAGER && ['view', 'create', 'edit'].includes(action)) ||
      (userRole === ROLES.SALES_EXECUTIVE && ['view', 'create', 'edit'].includes(action)) ||
      (userRole === ROLES.ACCOUNTS_FINANCE && ['view', 'create', 'edit'].includes(action)) ||
      (userRole === ROLES.SUPPORT_AGENT && ['view', 'create'].includes(action)) ||
      (userRole === ROLES.READ_ONLY_VIEWER && action === 'view');

    res.json({
      success: true,
      data: {
        hasPermission,
        userId,
        module,
        action,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/users/audit-logs - Get system audit logs
router.get('/audit-logs', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { userId, action, resourceType, page = 1, pageSize = 50 } = req.query;

    let query = `SELECT id, user_id, action, resource_type, resource_id, previous_values, new_values, timestamp
                 FROM audit_logs WHERE 1=1`;
    const params: any[] = [];

    if (userId) {
      query += ` AND user_id = $${params.length + 1}`;
      params.push(userId);
    }

    if (action) {
      query += ` AND action = $${params.length + 1}`;
      params.push(action);
    }

    if (resourceType) {
      query += ` AND resource_type = $${params.length + 1}`;
      params.push(resourceType);
    }

    query += ` ORDER BY timestamp DESC`;
    query += ` LIMIT ${pageSize} OFFSET ${((page as number) - 1) * (pageSize as number)}`;

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/users/audit-logs - Log action (internal)
router.post('/audit-logs', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { action, resourceType, resourceId, newValues, previousValues } = req.body;

    await db.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_values, previous_values)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.userId, action, resourceType, resourceId || null, JSON.stringify(newValues || {}), JSON.stringify(previousValues || {})]
    );

    res.json({
      success: true,
      message: 'Audit logged',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/users/activity - Get user activity summary
router.get('/activity', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId, period = '30' } = req.query;

    const result = await db.query(
      `SELECT user_id, COUNT(*) as action_count,
              COUNT(DISTINCT DATE(timestamp)) as active_days,
              MAX(timestamp) as last_activity
       FROM audit_logs
       WHERE timestamp > NOW() - INTERVAL '${period} days'
       ${projectId ? `AND resource_type = 'project' AND resource_id = $1` : ''}
       GROUP BY user_id
       ORDER BY action_count DESC`,
      projectId ? [projectId] : []
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// EMPLOYEE LOGIN CREATION â€” static routes MUST be before /:id
// ============================================================

const PROCESSES = [
  { name: 'new_applicant',         label: 'New Applicant',         has_checker: true,  has_maker: true  },
  { name: 'edit_applicant',        label: 'Edit Applicant',        has_checker: false, has_maker: true  },
  { name: 'unit_shifting',         label: 'Unit Shifting',         has_checker: false, has_maker: true  },
  { name: 'applicant_transfer',    label: 'Applicant Transfer',    has_checker: false, has_maker: true  },
  { name: 'receipt',               label: 'Receipt',               has_checker: true,  has_maker: false },
  { name: 'interest_waiver',       label: 'Interest Waiver',       has_checker: false, has_maker: true  },
  { name: 'jv_refund_drcr',        label: 'JV/Refund/DrCr',        has_checker: false, has_maker: true  },
  { name: 'broker_range_entry',    label: 'Broker Range Entry',    has_checker: true,  has_maker: true  },
  { name: 'broker_payment_entry',  label: 'Broker Payment Entry',  has_checker: true,  has_maker: true  },
];

const HOME_PAGE_WIDGETS = [
  { key: 'enquiry',                   label: 'Enquiry' },
  { key: 'pending_cheque',            label: 'Pending Cheque' },
  { key: 'parking_detail',            label: 'Parking Detail' },
  { key: 'demand_status',             label: 'Demand Status' },
  { key: 'daily_status',              label: 'Daily Status' },
  { key: 'forthcoming_due',           label: 'Forthcoming Due' },
  { key: 'head_wise_task',            label: 'Head Wise Task' },
  { key: 'birthday_message',          label: 'Birthday Message' },
  { key: 'finance_voucher_approval',  label: 'Finance Voucher Approval' },
  { key: 'unit_status',               label: 'Unit Status' },
];

const ROLE_LABELS = [
  { value: 'super_admin',       label: 'Super Admin' },
  { value: 'project_manager',   label: 'Project Manager' },
  { value: 'sales_executive',   label: 'Sales Executive' },
  { value: 'accounts_finance',  label: 'Accounts / Finance' },
  { value: 'support_agent',     label: 'Support Agent' },
  { value: 'read_only_viewer',  label: 'Viewer' },
];

// GET /api/users/employee-login/form-data
router.get('/employee-login/form-data', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [employeesRes, companiesRes, rolesRes] = await Promise.all([
      db.query(`SELECT ep.id, u.name, ep.designation, d.name as department FROM employee_profiles ep LEFT JOIN users u ON u.id = ep.user_id LEFT JOIN departments d ON d.id = ep.department_id WHERE ep.is_active = true OR ep.is_active IS NULL ORDER BY u.name`),
      db.query(`SELECT id, name FROM companies ORDER BY name`),
      db.query(`SELECT name AS value, label FROM roles WHERE is_active = true ORDER BY is_system DESC, label ASC`),
    ]);
    return res.json({
      success: true,
      data: {
        employees:       employeesRes.rows,
        companies:       companiesRes.rows,
        roles:           rolesRes.rows,
        processes:       PROCESSES,
        homePageWidgets: HOME_PAGE_WIDGETS,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/users/employee-login
router.post('/employee-login', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      employeeId, role, username, email, password, confirmPassword,
      authorizedPrint, authorizedDownload, unitStatusAccess,
      homePageWidgets, processPermissions, companyIds,
    } = req.body;

    if (!username || !email || !password || !role) {
      return res.status(400).json({ error: 'Username, email, password and role are required' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const hash = await bcrypt.hash(password, 12);
    let userName = username;
    if (employeeId) {
      const empRes = await db.query(`SELECT u.name FROM employee_profiles ep JOIN users u ON u.id = ep.user_id WHERE ep.id = $1`, [employeeId]);
      if (empRes.rows[0]) userName = empRes.rows[0].name;
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const userRes = await client.query(`
        INSERT INTO users (email, name, username, employee_id, role, password_hash,
          authorized_print, authorized_download, unit_status_access, home_page_widgets, is_active, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,NOW())
        RETURNING id
      `, [email, userName, username, employeeId || null, role, hash,
          authorizedPrint || false, authorizedDownload || false,
          unitStatusAccess || 'all', JSON.stringify(homePageWidgets || [])]);

      const userId = userRes.rows[0].id;

      if (Array.isArray(processPermissions)) {
        for (const pp of processPermissions) {
          if (pp.isMaker || pp.isChecker || pp.isApprover) {
            await client.query(`
              INSERT INTO user_process_permissions (user_id, process_name, is_maker, is_checker, is_approver)
              VALUES ($1,$2,$3,$4,$5)
              ON CONFLICT (user_id, process_name) DO UPDATE SET
                is_maker = $3, is_checker = $4, is_approver = $5, updated_at = NOW()
            `, [userId, pp.processName, pp.isMaker || false, pp.isChecker || false, pp.isApprover || false]);
          }
        }
      }

      if (Array.isArray(companyIds)) {
        for (const companyId of companyIds) {
          await client.query(`INSERT INTO user_company_access (user_id, company_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [userId, companyId]);
        }
      }

      await client.query('COMMIT');
      return res.json({ success: true, data: { userId, username } });
    } catch (err: any) {
      await client.query('ROLLBACK');
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Username or email already exists' });
      }
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// GET /api/users/employee-login
router.get('/employee-login', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(`
      SELECT
        u.id, u.name, u.username, u.email, u.role,
        u.unit_status_access, u.authorized_print, u.authorized_download,
        u.home_page_widgets, u.is_active, u.created_at,
        eu.name as employee_name, ep.designation,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'process_name', upp.process_name,
            'is_maker', upp.is_maker,
            'is_checker', upp.is_checker,
            'is_approver', upp.is_approver
          )) FILTER (WHERE upp.id IS NOT NULL),
          '[]'
        ) as process_permissions,
        COALESCE(
          array_agg(DISTINCT c.name) FILTER (WHERE c.id IS NOT NULL),
          '{}'
        ) as company_names
      FROM users u
      LEFT JOIN employee_profiles ep ON ep.id = u.employee_id
      LEFT JOIN users eu ON eu.id = ep.user_id
      LEFT JOIN user_process_permissions upp ON upp.user_id = u.id
      LEFT JOIN user_company_access uca ON uca.user_id = u.id
      LEFT JOIN companies c ON c.id = uca.company_id
      GROUP BY u.id, eu.name, ep.designation
      ORDER BY u.created_at DESC
    `);
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/users/employee-login/:id
router.patch('/employee-login/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const {
      role, authorizedPrint, authorizedDownload, unitStatusAccess,
      homePageWidgets, processPermissions, companyIds, isActive, password,
    } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (role !== undefined)               { updates.push(`role = $${idx++}`);                values.push(role); }
    if (authorizedPrint !== undefined)    { updates.push(`authorized_print = $${idx++}`);    values.push(authorizedPrint); }
    if (authorizedDownload !== undefined) { updates.push(`authorized_download = $${idx++}`); values.push(authorizedDownload); }
    if (unitStatusAccess !== undefined)   { updates.push(`unit_status_access = $${idx++}`);  values.push(unitStatusAccess); }
    if (homePageWidgets !== undefined)    { updates.push(`home_page_widgets = $${idx++}`);   values.push(JSON.stringify(homePageWidgets)); }
    if (isActive !== undefined)           { updates.push(`is_active = $${idx++}`);           values.push(isActive); }
    if (password) {
      const hash = await bcrypt.hash(password, 12);
      updates.push(`password_hash = $${idx++}`);
      values.push(hash);
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      if (updates.length) {
        values.push(id);
        await client.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}`, values);
      }
      if (Array.isArray(processPermissions)) {
        await client.query(`DELETE FROM user_process_permissions WHERE user_id = $1`, [id]);
        for (const pp of processPermissions) {
          if (pp.isMaker || pp.isChecker || pp.isApprover) {
            await client.query(`
              INSERT INTO user_process_permissions (user_id, process_name, is_maker, is_checker, is_approver)
              VALUES ($1,$2,$3,$4,$5)
            `, [id, pp.processName, pp.isMaker || false, pp.isChecker || false, pp.isApprover || false]);
          }
        }
      }
      if (Array.isArray(companyIds)) {
        await client.query(`DELETE FROM user_company_access WHERE user_id = $1`, [id]);
        for (const companyId of companyIds) {
          await client.query(`INSERT INTO user_company_access (user_id, company_id) VALUES ($1,$2)`, [id, companyId]);
        }
      }
      await client.query('COMMIT');
      return res.json({ success: true });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// ============================================================

// GET /api/users/me - Get current user with process permissions
router.get('/me', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const userResult = await db.query(
      `SELECT id, name, email, mobile, role, assigned_project_ids, is_active
       FROM users WHERE id = $1`,
      [userId]
    );
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = userResult.rows[0];

    const permResult = await db.query(
      `SELECT process_name, is_maker, is_checker, is_approver
       FROM user_process_permissions
       WHERE user_id = $1`,
      [userId]
    );

    const companyResult = await db.query(
      `SELECT company_id FROM user_company_access WHERE user_id = $1`,
      [userId]
    ).catch(() => ({ rows: [] }));

    const processPermissions: Record<string, string[]> = {};
    for (const row of permResult.rows) {
      const roles: string[] = [];
      if (row.is_maker) roles.push('maker');
      if (row.is_checker) roles.push('checker');
      if (row.is_approver) roles.push('approver');
      processPermissions[row.process_name] = roles;
    }

    res.json({
      success: true,
      data: {
        ...user,
        processPermissions,
        companyIds: companyResult.rows.map((r: any) => r.company_id),
      },
    });
  } catch (error) { next(error); }
});

// ============================================================

// GET /api/users/:id - Get user detail
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT id, name, email, mobile, role, assigned_project_ids, is_active, last_login_at, created_at
       FROM users WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/users/:id - Update user
router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, email, mobile, role, assignedProjectIds, isActive } = req.body;

    const result = await db.query(
      `UPDATE users
       SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           mobile = COALESCE($3, mobile),
           role = COALESCE($4, role),
           assigned_project_ids = COALESCE($5, assigned_project_ids),
           is_active = COALESCE($6, is_active),
           updated_at = NOW()
       WHERE id = $7
       RETURNING id, name, email, role, is_active, updated_at`,
      [
        name,
        email,
        mobile,
        role,
        assignedProjectIds ? JSON.stringify(assignedProjectIds) : null,
        isActive,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/users/:id/change-password - Change user password
router.post('/:id/change-password', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { newPassword, currentPassword } = req.body;

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Non-admins can only change their own password
    if (req.userRole !== 'super_admin' && req.userId !== id) {
      return res.status(403).json({ error: 'Forbidden: can only change your own password' });
    }

    // Require current password when user is changing their own password
    if (req.userId === id && req.userRole !== 'super_admin') {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required' });
      }
      const userRes = await db.query(`SELECT password_hash FROM users WHERE id = $1`, [id]);
      const existingHash = userRes.rows[0]?.password_hash;
      let currentValid = false;
      if (existingHash?.startsWith('$2')) {
        currentValid = await bcrypt.compare(currentPassword, existingHash);
      } else {
        currentValid = Buffer.from(currentPassword).toString('base64') === existingHash;
      }
      if (!currentValid) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    const result = await db.query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2
       RETURNING id, name, email`,
      [hashedPassword, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});


export default router;
