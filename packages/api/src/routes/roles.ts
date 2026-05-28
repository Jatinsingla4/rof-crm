import { Router, Response, NextFunction } from 'express';
import { db } from '../index.js';
import { AuthRequest } from '../index.js';

const router = Router();

// GET /api/roles/nav-pages — full page tree grouped by category
// MUST be before /:roleName routes
router.get('/nav-pages', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT id, route, label, category, sort_order
       FROM nav_pages WHERE is_active = true
       ORDER BY category, sort_order`
    );
    const grouped: Record<string, any[]> = {};
    for (const row of result.rows) {
      if (!grouped[row.category]) grouped[row.category] = [];
      grouped[row.category].push(row);
    }
    res.json({ success: true, data: grouped });
  } catch (err) { next(err); }
});

// GET /api/roles — list all roles with user_count and page_count
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(`
      SELECT
        r.id, r.name, r.label, r.description,
        r.is_system, r.is_active, r.created_at,
        COUNT(DISTINCT u.id)::int  AS user_count,
        COUNT(DISTINCT rpa.id)::int AS page_count
      FROM roles r
      LEFT JOIN users u   ON u.role = r.name AND u.is_active = true
      LEFT JOIN role_page_access rpa ON rpa.role_name = r.name
      WHERE r.is_active = true
      GROUP BY r.id
      ORDER BY r.is_system DESC, r.label ASC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});

// POST /api/roles — create custom role (super_admin only)
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.userRole !== 'super_admin') {
    return res.status(403).json({ error: 'Only super_admin can create roles' });
  }
  try {
    const { name, label, description, pageIds } = req.body;
    if (!name || !label) return res.status(400).json({ error: 'name and label are required' });
    if (!/^[a-z_]+$/.test(name)) return res.status(400).json({ error: 'name must be lowercase letters and underscores only' });

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const roleRes = await client.query(
        `INSERT INTO roles (name, label, description, is_system, is_active)
         VALUES ($1,$2,$3,false,true) RETURNING *`,
        [name, label, description || null]
      );
      if (Array.isArray(pageIds) && pageIds.length > 0) {
        for (const pageId of pageIds) {
          await client.query(
            `INSERT INTO role_page_access (role_name, page_id, can_view)
             VALUES ($1,$2,true) ON CONFLICT DO NOTHING`,
            [name, pageId]
          );
        }
      }
      await client.query('COMMIT');
      res.status(201).json({ success: true, data: roleRes.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
});

// GET /api/roles/:roleName/pages — all pages with has_access flag
router.get('/:roleName/pages', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { roleName } = req.params;
    const result = await db.query(
      `SELECT
         np.id, np.route, np.label, np.category, np.sort_order,
         CASE WHEN rpa.id IS NOT NULL THEN true ELSE false END AS has_access
       FROM nav_pages np
       LEFT JOIN role_page_access rpa
         ON rpa.page_id = np.id AND rpa.role_name = $1 AND rpa.can_view = true
       WHERE np.is_active = true
       ORDER BY np.category, np.sort_order`,
      [roleName]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});

// PUT /api/roles/:roleName/pages — replace page access for a role
router.put('/:roleName/pages', async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.userRole !== 'super_admin') {
    return res.status(403).json({ error: 'Only super_admin can edit role pages' });
  }
  try {
    const { roleName } = req.params;
    const { pageIds } = req.body;

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM role_page_access WHERE role_name = $1`, [roleName]);
      for (const pageId of (pageIds || [])) {
        await client.query(
          `INSERT INTO role_page_access (role_name, page_id, can_view)
           VALUES ($1,$2,true) ON CONFLICT DO NOTHING`,
          [roleName, pageId]
        );
      }
      await client.query('COMMIT');
      res.json({ success: true });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
});

// DELETE /api/roles/:roleName — delete custom role only
router.delete('/:roleName', async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.userRole !== 'super_admin') {
    return res.status(403).json({ error: 'Only super_admin can delete roles' });
  }
  try {
    const { roleName } = req.params;
    const roleRes = await db.query(`SELECT is_system FROM roles WHERE name = $1`, [roleName]);
    if (roleRes.rows[0]?.is_system) {
      return res.status(403).json({ error: 'Cannot delete system roles' });
    }
    const userRes = await db.query(`SELECT COUNT(*) FROM users WHERE role = $1`, [roleName]);
    if (parseInt(userRes.rows[0].count) > 0) {
      return res.status(409).json({ error: 'Cannot delete role with assigned users' });
    }
    await db.query(`DELETE FROM roles WHERE name = $1`, [roleName]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
