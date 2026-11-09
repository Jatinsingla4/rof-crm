"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_js_1 = require("../index.js");
const rbac_js_1 = require("../middleware/rbac.js");
const superAdmin_js_1 = require("../middleware/superAdmin.js");
const auditLogger_js_1 = require("../middleware/auditLogger.js");
const pg_errors_js_1 = require("../middleware/pg-errors.js");
const security_js_1 = require("../utils/security.js");
const router = (0, express_1.Router)();
const isAdmin = (req) => (0, superAdmin_js_1.isSuperAdmin)(req);
const canSee = isAdmin; // UR-001: the role lists are super_admin only
const text = (v) => (typeof v === 'string' ? v.trim() : '');
// Every id must be the id of an active page; returns the unique ids or an error text
async function checkPageIds(pageIds) {
    if (pageIds === undefined)
        return { ids: [] };
    if (!Array.isArray(pageIds) || !pageIds.every(security_js_1.isUuid))
        return { error: 'pageIds must be a list of page ids' };
    const ids = [...new Set(pageIds)];
    if (!ids.length)
        return { ids };
    const found = await index_js_1.db.query(`SELECT id FROM nav_pages WHERE is_active = true AND id = ANY($1::uuid[])`, [ids]);
    return found.rowCount === ids.length ? { ids } : { error: 'One or more pages do not exist' };
}
async function findRole(name) {
    const r = await index_js_1.db.query(`SELECT id, name, label, is_system FROM roles WHERE lower(name) = lower($1) AND is_active = true LIMIT 1`, [name]);
    return r.rows[0];
}
// GET /api/roles/nav-pages — page list grouped by category. MUST be before /:roleName routes
router.get('/nav-pages', async (req, res, next) => {
    var _a;
    if (!canSee(req))
        return res.status(403).json({ error: 'Forbidden' });
    try {
        const result = await index_js_1.db.query(`SELECT id, route, label, category, sort_order FROM nav_pages WHERE is_active = true ORDER BY category, sort_order, label`);
        const grouped = {};
        for (const row of result.rows)
            (grouped[_a = row.category || 'Other'] || (grouped[_a] = [])).push(row);
        res.json({ success: true, data: grouped });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/roles/matrix — every role, every page and who may open what (one call for the Role Menu Access screen)
router.get('/matrix', async (req, res, next) => {
    var _a;
    if (!canSee(req))
        return res.status(403).json({ error: 'Forbidden' });
    try {
        const [roles, pages, access] = await Promise.all([
            index_js_1.db.query(`SELECT name, label, is_system FROM roles WHERE is_active = true ORDER BY is_system DESC, label`),
            index_js_1.db.query(`SELECT id, route, label, category, sort_order FROM nav_pages WHERE is_active = true ORDER BY category, sort_order, label`),
            index_js_1.db.query(`SELECT role_name, page_id FROM role_page_access WHERE can_view = true`),
        ]);
        const map = {};
        for (const a of access.rows)
            (map[_a = a.role_name] || (map[_a] = [])).push(a.page_id);
        res.json({ success: true, data: { roles: roles.rows, pages: pages.rows, access: map } });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/roles — list roles with user_count and page_count
router.get('/', async (req, res, next) => {
    if (!canSee(req))
        return res.status(403).json({ error: 'Forbidden' });
    try {
        const result = await index_js_1.db.query(`
      SELECT r.id, r.name, r.label, r.description, r.base_role, r.is_system, r.is_active, r.created_at,
             (SELECT COUNT(*)::int FROM users u WHERE u.role = r.name AND u.is_active = true) AS user_count,
             (SELECT COUNT(*)::int FROM role_page_access x WHERE x.role_name = r.name AND x.can_view = true) AS page_count
      FROM roles r
      WHERE r.is_active = true
      ORDER BY r.is_system DESC, r.label ASC
    `);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/roles — create a custom role (super_admin only)
router.post('/', async (req, res, next) => {
    if (!isAdmin(req))
        return res.status(403).json({ error: 'Only super_admin can create roles' });
    try {
        const name = text(req.body.name).toLowerCase();
        const label = text(req.body.label);
        const description = text(req.body.description);
        const baseRole = text(req.body.baseRole);
        if (!name || !label)
            return res.status(400).json({ error: 'name and label are required' });
        if (!/^[a-z][a-z0-9_]{2,49}$/.test(name))
            return res.status(400).json({ error: 'name must be 3 to 50 characters: lowercase letters, digits and underscores, starting with a letter' });
        if (rbac_js_1.SYSTEM_ROLES.includes(name))
            return res.status(409).json({ error: 'That name belongs to a system role' });
        if (label.length > 100)
            return res.status(400).json({ error: 'label must be at most 100 characters' });
        if (description.length > 500)
            return res.status(400).json({ error: 'description must be at most 500 characters' });
        if (!rbac_js_1.BASE_ROLES.includes(baseRole))
            return res.status(400).json({ error: `baseRole must be one of: ${rbac_js_1.BASE_ROLES.join(', ')}` });
        const pages = await checkPageIds(req.body.pageIds);
        if ('error' in pages)
            return res.status(400).json({ error: pages.error });
        if (await findRole(name))
            return res.status(409).json({ error: 'A role with this name already exists' });
        const client = await index_js_1.db.connect();
        try {
            await client.query('BEGIN');
            const roleRes = await client.query(`INSERT INTO roles (name, label, description, base_role, is_custom, is_system, is_active)
         VALUES ($1,$2,$3,$4,true,false,true) RETURNING id, name, label, description, base_role`, [name, label, description || null, baseRole]);
            if (pages.ids.length) {
                await client.query(`INSERT INTO role_page_access (role_name, page_id, can_view) SELECT $1, unnest($2::uuid[]), true`, [name, pages.ids]);
            }
            await client.query('COMMIT');
            await (0, auditLogger_js_1.auditChange)(client, req, res, 'create', 'role', roleRes.rows[0].id, {}, { ...roleRes.rows[0], pages: pages.ids.length });
            res.status(201).json({ success: true, data: roleRes.rows[0] });
        }
        catch (err) {
            await client.query('ROLLBACK');
            throw err;
        }
        finally {
            client.release();
        }
    }
    catch (err) {
        next(err);
    }
});
// PATCH /api/roles/:roleName — change label, description or base role of a custom role
router.patch('/:roleName', async (req, res, next) => {
    if (!isAdmin(req))
        return res.status(403).json({ error: 'Only super_admin can edit roles' });
    try {
        const role = await findRole(req.params.roleName);
        if (!role)
            return res.status(404).json({ error: 'Role not found' });
        if (role.is_system)
            return res.status(403).json({ error: 'System roles cannot be edited' });
        const { label, description, baseRole } = req.body;
        const previous = (await index_js_1.db.query(`SELECT label, description, base_role FROM roles WHERE id = $1`, [role.id])).rows[0];
        if (label !== undefined && (!text(label) || text(label).length > 100))
            return res.status(400).json({ error: 'label must be 1 to 100 characters' });
        if (description !== undefined && text(description).length > 500)
            return res.status(400).json({ error: 'description must be at most 500 characters' });
        if (baseRole !== undefined && !rbac_js_1.BASE_ROLES.includes(text(baseRole)))
            return res.status(400).json({ error: `baseRole must be one of: ${rbac_js_1.BASE_ROLES.join(', ')}` });
        const r = await index_js_1.db.query(`UPDATE roles SET label = COALESCE($1, label), description = COALESCE($2, description), base_role = COALESCE($3, base_role)
       WHERE id = $4 RETURNING id, name, label, description, base_role`, [label === undefined ? null : text(label), description === undefined ? null : text(description), baseRole === undefined ? null : text(baseRole), role.id]);
        (0, index_js_1.clearAuthUserCache)();
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'role', role.id, previous ?? {}, r.rows[0]);
        res.json({ success: true, data: r.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/roles/:roleName/pages — all pages with a has_access flag. Own role, or super_admin.
router.get('/:roleName/pages', async (req, res, next) => {
    try {
        const { roleName } = req.params;
        if (!canSee(req) && roleName.toLowerCase() !== (req.roleName || '').toLowerCase())
            return res.status(403).json({ error: 'Forbidden' });
        if (!(await findRole(roleName)))
            return res.status(404).json({ error: 'Role not found' });
        const result = await index_js_1.db.query(`SELECT np.id, np.route, np.label, np.category, np.sort_order,
              (rpa.id IS NOT NULL) AS has_access
       FROM nav_pages np
       LEFT JOIN role_page_access rpa ON rpa.page_id = np.id AND rpa.role_name = $1 AND rpa.can_view = true
       WHERE np.is_active = true
       ORDER BY np.category, np.sort_order, np.label`, [roleName]);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        next(err);
    }
});
// PUT /api/roles/:roleName/pages — replace page access for a role.
// Role Menu Access is MENU VISIBILITY ONLY: the browser hides or shows entries from it. It never grants or removes an API
// permission (that comes from the role's base role through rbac), so no server route reads role_page_access to allow or refuse.
router.put('/:roleName/pages', async (req, res, next) => {
    if (!isAdmin(req))
        return res.status(403).json({ error: 'Only super_admin can edit role pages' });
    try {
        const role = await findRole(req.params.roleName);
        if (!role)
            return res.status(404).json({ error: 'Role not found' });
        if (role.name === 'super_admin')
            return res.status(400).json({ error: 'super_admin always has access to every page' });
        if (req.body.pageIds === undefined)
            return res.status(400).json({ error: 'pageIds is required' });
        const pages = await checkPageIds(req.body.pageIds);
        if ('error' in pages)
            return res.status(400).json({ error: pages.error });
        const client = await index_js_1.db.connect();
        let oldIds = [];
        try {
            await client.query('BEGIN');
            oldIds = (await client.query(`SELECT page_id FROM role_page_access WHERE role_name = $1 AND can_view = true`, [role.name])).rows.map((r) => r.page_id);
            await client.query(`DELETE FROM role_page_access WHERE role_name = $1`, [role.name]);
            if (pages.ids.length) {
                await client.query(`INSERT INTO role_page_access (role_name, page_id, can_view) SELECT $1, unnest($2::uuid[]), true`, [role.name, pages.ids]);
            }
            await client.query('COMMIT');
        }
        catch (err) {
            await client.query('ROLLBACK');
            throw err;
        }
        finally {
            client.release();
        }
        // Before: how many pages. After: how many, and exactly which page ids were added and removed (old list = new list - added + removed)
        const added = pages.ids.filter((i) => !oldIds.includes(i)).sort();
        const removed = oldIds.filter((i) => !pages.ids.includes(i)).sort();
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'role', role.id, { role: role.name, pages: oldIds.length }, { role: role.name, pages: pages.ids.length, added, removed });
        res.json({ success: true, data: { pages: pages.ids.length } });
    }
    catch (err) {
        next(err);
    }
});
// DELETE /api/roles/:roleName — custom roles only, and only when nobody holds the role
router.delete('/:roleName', async (req, res, next) => {
    if (!isAdmin(req))
        return res.status(403).json({ error: 'Only super_admin can delete roles' });
    try {
        const role = await findRole(req.params.roleName);
        if (!role)
            return res.status(404).json({ error: 'Role not found' });
        if (role.is_system)
            return res.status(403).json({ error: 'Cannot delete system roles' });
        const client = await index_js_1.db.connect();
        try {
            await client.query('BEGIN');
            // UR-008: the exclusive lock waits for any login being given this role (they hold a shared lock), then the holders are counted
            // inside the same transaction, so a login can never be assigned a role that is being deleted
            await client.query(`SELECT 1 FROM roles WHERE id = $1 FOR UPDATE`, [role.id]);
            const inUse = await client.query(`SELECT COUNT(*)::int AS n FROM users WHERE role = $1`, [role.name]);
            if (inUse.rows[0].n > 0) {
                await client.query('ROLLBACK');
                return res.status(409).json({ error: `${inUse.rows[0].n} user(s) still have this role. Move them to another role first.` });
            }
            await client.query(`DELETE FROM role_page_access WHERE role_name = $1`, [role.name]);
            await client.query(`DELETE FROM roles WHERE id = $1`, [role.id]);
            await client.query('COMMIT');
        }
        catch (err) {
            await client.query('ROLLBACK');
            throw err;
        }
        finally {
            client.release();
        }
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'delete', 'role', role.id, { name: role.name, label: role.label }, {});
        res.json({ success: true });
    }
    catch (err) {
        next(err);
    }
});
router.use(pg_errors_js_1.pgErrorHandler);
exports.default = router;
//# sourceMappingURL=roles.js.map