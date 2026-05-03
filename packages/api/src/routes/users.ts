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
