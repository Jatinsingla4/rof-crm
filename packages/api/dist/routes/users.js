"use strict";
/**
 * Users routes: logins, permissions, IP allow list, audit log.
 * Every create and update goes through one validated path so the rules are the same everywhere.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const index_js_1 = require("../index.js");
const index_js_2 = require("../index.js");
const auditLogger_js_1 = require("../middleware/auditLogger.js");
const pg_errors_js_1 = require("../middleware/pg-errors.js");
const unitStatusAccess_js_1 = require("../middleware/unitStatusAccess.js");
const security_js_1 = require("../utils/security.js");
const router = (0, express_1.Router)();
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const like = (v) => v.replace(/[\\%_]/g, (c) => '\\' + c);
const clientIp = (req) => (req.ip || '').replace(/^::ffff:/, '');
// The processes the API really enforces (requireProcess in routes) and which of maker / checker each uses.
// Keep this list in step with the routes: a flag that no route checks would be a permission that does nothing.
const PROCESSES = [
    { name: 'new_applicant', label: 'New Applicant', has_maker: true, has_checker: false },
    { name: 'edit_applicant', label: 'Edit Applicant', has_maker: true, has_checker: false },
    { name: 'unit_shifting', label: 'Unit Shifting', has_maker: true, has_checker: false },
    { name: 'applicant_transfer', label: 'Applicant Transfer', has_maker: true, has_checker: false },
    { name: 'receipt', label: 'Receipt', has_maker: true, has_checker: true },
    { name: 'interest_waiver', label: 'Interest Waiver', has_maker: true, has_checker: true },
    { name: 'jv_refund_drcr', label: 'JV/Refund/DrCr', has_maker: true, has_checker: true },
    { name: 'broker_range_entry', label: 'Broker Range Entry', has_maker: true, has_checker: true },
    { name: 'broker_payment_entry', label: 'Broker Payment Entry', has_maker: true, has_checker: false },
];
const HOME_PAGE_WIDGETS = [
    { key: 'enquiry', label: 'Enquiry' },
    { key: 'pending_cheque', label: 'Pending Cheque' },
    { key: 'parking_detail', label: 'Parking Detail' },
    { key: 'demand_status', label: 'Demand Status' },
    { key: 'daily_status', label: 'Daily Status' },
    { key: 'forthcoming_due', label: 'Forthcoming Due' },
    { key: 'head_wise_task', label: 'Head Wise Task' },
    { key: 'birthday_message', label: 'Birthday Message' },
    { key: 'finance_voucher_approval', label: 'Finance Voucher Approval' },
    { key: 'unit_status', label: 'Unit Status' },
];
class Bad extends Error {
    constructor(status, message) {
        super(message);
        Object.defineProperty(this, "status", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: status
        });
    }
}
const fail = (status, message) => { throw new Bad(status, message); };
// Sends Bad errors as client errors, everything else on to the next handler
const guard = (fn) => async (req, res, next) => {
    try {
        await fn(req, res);
    }
    catch (e) {
        if (e instanceof Bad)
            return res.status(e.status).json({ error: e.message });
        next(e);
    }
};
async function roleName(name) {
    const r = await index_js_1.db.query(`SELECT name FROM roles WHERE lower(name) = lower($1) AND is_active = true LIMIT 1`, [name]);
    return r.rows[0]?.name ?? fail(400, 'Unknown role');
}
async function checkIds(table, ids, label) {
    if (!Array.isArray(ids) || !ids.every(security_js_1.isUuid))
        return fail(400, `${label} must be a list of ids`);
    const unique = [...new Set(ids)];
    if (!unique.length)
        return unique;
    const found = await index_js_1.db.query(`SELECT id FROM ${table} WHERE id = ANY($1::uuid[])`, [unique]);
    return found.rowCount === unique.length ? unique : fail(400, `One or more ${label} do not exist`);
}
function checkProcessPermissions(list) {
    if (!Array.isArray(list))
        return fail(400, 'processPermissions must be a list');
    const seen = new Set();
    const out = [];
    for (const raw of list) {
        const p = PROCESSES.find((x) => x.name === raw?.processName) ?? fail(400, `Unknown process: ${raw?.processName}`);
        if (seen.has(p.name))
            fail(400, `${p.label} is listed twice`);
        seen.add(p.name);
        const row = { processName: p.name, isMaker: raw.isMaker === true, isChecker: raw.isChecker === true, isApprover: raw.isApprover === true };
        if (row.isMaker && !p.has_maker)
            fail(400, `${p.label} has no maker step`);
        if (row.isChecker && !p.has_checker)
            fail(400, `${p.label} has no checker step`);
        if (row.isApprover)
            fail(400, 'Approver is not used by any process');
        if (row.isMaker || row.isChecker)
            out.push(row);
    }
    return out;
}
// ---------------------------------------------------------------------------
// Create and update a login (one place for both)
// ---------------------------------------------------------------------------
const MOBILE_RE = /^[0-9+\-\s()]{6,20}$/;
// Checks everything in body that is present and returns the columns to write
async function checkUserFields(body) {
    const set = {};
    if (body.name !== undefined) {
        const name = str(body.name);
        if (!name || name.length > 255)
            fail(400, 'Name is required (255 characters at most)');
        set.name = name;
    }
    if (body.email !== undefined)
        set.email = (0, security_js_1.cleanEmail)(body.email) ?? fail(400, 'Enter a valid email address');
    if (body.mobile !== undefined) {
        const m = str(body.mobile);
        if (m && !MOBILE_RE.test(m))
            fail(400, 'Enter a valid mobile number');
        set.mobile = m || null;
    }
    if (body.username !== undefined) {
        const u = str(body.username);
        if (!/^[A-Za-z0-9._-]{3,50}$/.test(u))
            fail(400, 'Username must be 3 to 50 characters: letters, digits, dot, dash, underscore');
        set.username = u;
    }
    if (body.role !== undefined)
        set.role = await roleName(str(body.role));
    if (body.isActive !== undefined) {
        if (typeof body.isActive !== 'boolean')
            fail(400, 'isActive must be true or false');
        set.is_active = body.isActive;
    }
    if (body.assignedProjectIds !== undefined)
        set.assigned_project_ids = JSON.stringify(await checkIds('projects', body.assignedProjectIds, 'assignedProjectIds'));
    for (const [key, col] of [['authorizedPrint', 'authorized_print'], ['authorizedDownload', 'authorized_download']]) {
        if (body[key] !== undefined) {
            if (typeof body[key] !== 'boolean')
                fail(400, `${key} must be true or false`);
            set[col] = body[key];
        }
    }
    if (body.unitStatusAccess !== undefined) {
        if (!(str(body.unitStatusAccess) in unitStatusAccess_js_1.UNIT_STATUS_MAP))
            fail(400, `unitStatusAccess must be one of: ${Object.keys(unitStatusAccess_js_1.UNIT_STATUS_MAP).join(', ')}`);
        set.unit_status_access = str(body.unitStatusAccess);
    }
    if (body.homePageWidgets !== undefined) {
        const keys = HOME_PAGE_WIDGETS.map((w) => w.key);
        if (!Array.isArray(body.homePageWidgets) || !body.homePageWidgets.every((k) => keys.includes(k)))
            fail(400, 'homePageWidgets contains an unknown widget');
        set.home_page_widgets = JSON.stringify([...new Set(body.homePageWidgets)]);
    }
    if (body.password !== undefined) {
        const problem = (0, security_js_1.passwordProblem)(body.password);
        if (problem)
            fail(400, problem);
        set.password_hash = await bcryptjs_1.default.hash(body.password, 12);
    }
    return set;
}
async function updateUser(req, res, id, body) {
    if (!(0, security_js_1.isUuid)(id))
        return fail(404, 'User not found');
    const set = await checkUserFields(body);
    const perms = body.processPermissions === undefined ? null : checkProcessPermissions(body.processPermissions);
    const companyIds = body.companyIds === undefined ? null : await checkIds('companies', body.companyIds, 'companyIds');
    const client = await index_js_1.db.connect();
    try {
        await client.query('BEGIN');
        const cur = (await client.query(`SELECT id, name, email, role, is_active, username FROM users WHERE id = $1 FOR UPDATE`, [id])).rows[0];
        if (!cur)
            fail(404, 'User not found');
        const losesRole = set.role !== undefined && set.role !== cur.role;
        const losesAccess = set.is_active === false && cur.is_active;
        if (id === req.userId && (losesRole || losesAccess))
            fail(400, 'You cannot change your own role or deactivate yourself');
        if (cur.role === 'super_admin' && cur.is_active && (losesRole || losesAccess)) {
            const others = await client.query(`SELECT COUNT(*)::int AS n FROM users WHERE role = 'super_admin' AND is_active = true AND id <> $1`, [id]);
            if (others.rows[0].n === 0)
                fail(409, 'At least one active super_admin is required');
        }
        if (set.username !== undefined) {
            const dup = await client.query(`SELECT 1 FROM users WHERE lower(username) = lower($1) AND id <> $2`, [set.username, id]);
            if (dup.rowCount)
                fail(409, 'Username already exists');
        }
        if (set.email !== undefined) {
            const dup = await client.query(`SELECT 1 FROM users WHERE lower(email) = $1 AND id <> $2`, [set.email, id]);
            if (dup.rowCount)
                fail(409, 'Email already exists');
        }
        if (body.ipSecurityEnabled !== undefined) {
            if (typeof body.ipSecurityEnabled !== 'boolean')
                fail(400, 'ipSecurityEnabled must be true or false');
            if (body.ipSecurityEnabled) {
                const ips = (await client.query(`SELECT ip_address FROM user_ip_restrictions WHERE user_id = $1 AND is_active = true`, [id])).rows.map((r) => r.ip_address);
                if (!ips.length)
                    fail(400, 'Add at least one allowed IP address before switching IP security on');
                if (id === req.userId && !ips.includes(clientIp(req)))
                    fail(400, `Add your current IP address (${clientIp(req)}) first, or you would lock yourself out`);
            }
            set.ip_security_enabled = body.ipSecurityEnabled;
        }
        const cols = Object.keys(set);
        const sessionEnds = set.password_hash !== undefined || losesAccess || losesRole;
        if (cols.length || sessionEnds) {
            const assigns = cols.map((c, i) => `${c} = $${i + 1}`);
            if (sessionEnds)
                assigns.push('token_version = COALESCE(token_version, 0) + 1');
            assigns.push('updated_at = NOW()');
            await client.query(`UPDATE users SET ${assigns.join(', ')} WHERE id = $${cols.length + 1}`, [...cols.map((c) => set[c]), id]);
        }
        if (perms) {
            await client.query(`DELETE FROM user_process_permissions WHERE user_id = $1`, [id]);
            for (const p of perms) {
                await client.query(`INSERT INTO user_process_permissions (user_id, process_name, is_maker, is_checker, is_approver, created_by_user_id) VALUES ($1,$2,$3,$4,false,$5)`, [id, p.processName, p.isMaker, p.isChecker, req.userId]);
            }
        }
        if (companyIds) {
            await client.query(`DELETE FROM user_company_access WHERE user_id = $1`, [id]);
            if (companyIds.length)
                await client.query(`INSERT INTO user_company_access (user_id, company_id) SELECT $1, unnest($2::uuid[])`, [id, companyIds]);
        }
        await client.query('COMMIT');
        (0, index_js_2.invalidateAuthUser)(id);
        const { password_hash: _hash, ...shown } = set;
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'user', id, { name: cur.name, email: cur.email, role: cur.role, is_active: cur.is_active }, { ...shown, ...(perms ? { processPermissions: perms.length } : {}), ...(companyIds ? { companies: companyIds.length } : {}), ...(set.password_hash ? { passwordChanged: true } : {}) });
    }
    catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
    finally {
        client.release();
    }
}
// ---------------------------------------------------------------------------
// Lists that do not depend on one user
// ---------------------------------------------------------------------------
// GET /api/users/directory — names for pick lists (task owner, sales person). Open to every signed-in user.
router.get('/directory', guard(async (_req, res) => {
    const r = await index_js_1.db.query(`SELECT id, name, role FROM users WHERE is_active = true ORDER BY name`);
    res.json({ success: true, data: r.rows });
}));
// GET /api/users - list users
router.get('/', guard(async (req, res) => {
    const { role, projectId } = req.query;
    const pageSize = (0, security_js_1.intParam)(req.query.pageSize, 20, 1, 500);
    const page = (0, security_js_1.intParam)(req.query.page, 1, 1, 100000);
    const where = [];
    const params = [];
    if (role) {
        params.push(String(role));
        where.push(`role = $${params.length}`);
    }
    if (projectId) {
        if (!(0, security_js_1.isUuid)(projectId))
            return fail(400, 'Invalid projectId');
        params.push(JSON.stringify([projectId]));
        where.push(`assigned_project_ids @> $${params.length}::jsonb`);
    }
    params.push(pageSize, (page - 1) * pageSize);
    const result = await index_js_1.db.query(`SELECT id, name, email, mobile, role, assigned_project_ids, is_active, last_login_at, created_at
     FROM users ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    res.json({ success: true, data: result.rows });
}));
// GET /api/users/audit-logs - who did what
router.get('/audit-logs', guard(async (req, res) => {
    const { userId, action, resourceType, fromDate, toDate } = req.query;
    const pageSize = (0, security_js_1.intParam)(req.query.pageSize, 50, 1, 500);
    const page = (0, security_js_1.intParam)(req.query.page, 1, 1, 100000);
    const where = [];
    const params = [];
    const add = (sql, v) => { params.push(v); where.push(sql.replace('?', `$${params.length}`)); };
    if (userId) {
        if (!(0, security_js_1.isUuid)(userId))
            return fail(400, 'Invalid userId');
        add('a.user_id = ?', userId);
    }
    if (action)
        add('lower(a.action) = lower(?)', String(action));
    if (resourceType)
        add('a.resource_type = ?', String(resourceType));
    for (const [name, v, op] of [['fromDate', fromDate, '>='], ['toDate', toDate, '<']]) {
        if (!v)
            continue;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v)) || Number.isNaN(Date.parse(String(v))))
            return fail(400, `${name} must be a date like 2026-01-31`);
        add(op === '>=' ? `a."timestamp" >= ?::date` : `a."timestamp" < (?::date + 1)`, v);
    }
    params.push(pageSize, (page - 1) * pageSize);
    const result = await index_js_1.db.query(`SELECT a.id, a.user_id, u.name AS user_name, a.action, a.resource_type, a.resource_id, a.previous_values, a.new_values, a."timestamp"
     FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY a."timestamp" DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    res.json({ success: true, data: result.rows });
}));
// GET /api/users/activity - actions per user in the last N days
router.get('/activity', guard(async (req, res) => {
    const days = (0, security_js_1.intParam)(req.query.period, 30, 1, 365);
    const result = await index_js_1.db.query(`SELECT user_id, COUNT(*)::int AS action_count, COUNT(DISTINCT DATE("timestamp"))::int AS active_days, MAX("timestamp") AS last_activity
     FROM audit_logs WHERE "timestamp" > NOW() - make_interval(days => $1)
     GROUP BY user_id ORDER BY action_count DESC`, [days]);
    res.json({ success: true, data: result.rows });
}));
// ---------------------------------------------------------------------------
// Employee logins. Static paths MUST stay before /:id
// ---------------------------------------------------------------------------
// GET /api/users/employee-login/form-data
router.get('/employee-login/form-data', guard(async (_req, res) => {
    const [employees, companies, roles, projects] = await Promise.all([
        index_js_1.db.query(`SELECT ep.id, u.name, ep.designation, d.name AS department,
                     EXISTS (SELECT 1 FROM users l WHERE l.employee_id = ep.id) AS has_login
              FROM employee_profiles ep LEFT JOIN users u ON u.id = ep.user_id LEFT JOIN departments d ON d.id = ep.department_id
              WHERE ep.is_active = true OR ep.is_active IS NULL ORDER BY u.name`),
        index_js_1.db.query(`SELECT id, name FROM companies ORDER BY name`),
        index_js_1.db.query(`SELECT name AS value, label FROM roles WHERE is_active = true ORDER BY is_system DESC, label ASC`),
        index_js_1.db.query(`SELECT id, name FROM projects ORDER BY name`),
    ]);
    res.json({
        success: true,
        data: {
            employees: employees.rows, companies: companies.rows, roles: roles.rows, projects: projects.rows,
            processes: PROCESSES, homePageWidgets: HOME_PAGE_WIDGETS, unitStatusOptions: Object.keys(unitStatusAccess_js_1.UNIT_STATUS_MAP),
        },
    });
}));
// POST /api/users/employee-login — create a login
router.post('/employee-login', guard(async (req, res) => {
    const b = req.body || {};
    if (!str(b.username) || !b.email || !b.password || !b.role)
        return fail(400, 'Username, email, password and role are required');
    if (b.password !== b.confirmPassword)
        return fail(400, 'Passwords do not match');
    let employeeId = null;
    let name = str(b.name) || str(b.username);
    if (b.employeeId) {
        if (!(0, security_js_1.isUuid)(b.employeeId))
            return fail(400, 'Invalid employeeId');
        const emp = await index_js_1.db.query(`SELECT u.name, EXISTS (SELECT 1 FROM users l WHERE l.employee_id = ep.id) AS has_login
       FROM employee_profiles ep JOIN users u ON u.id = ep.user_id WHERE ep.id = $1`, [b.employeeId]);
        if (!emp.rows[0])
            return fail(400, 'Employee not found');
        if (emp.rows[0].has_login)
            return fail(409, 'This employee already has a login');
        employeeId = b.employeeId;
        name = emp.rows[0].name;
    }
    const fields = await checkUserFields({ ...b, name });
    const perms = checkProcessPermissions(b.processPermissions ?? []);
    const companyIds = await checkIds('companies', b.companyIds ?? [], 'companyIds');
    if (fields.is_active === undefined)
        fields.is_active = true;
    const client = await index_js_1.db.connect();
    try {
        await client.query('BEGIN');
        const dup = await client.query(`SELECT 1 FROM users WHERE lower(email) = $1 OR lower(username) = lower($2)`, [fields.email, fields.username]);
        if (dup.rowCount)
            fail(409, 'Username or email already exists');
        const created = await client.query(`INSERT INTO users (email, name, username, employee_id, role, password_hash, authorized_print, authorized_download,
                          unit_status_access, home_page_widgets, assigned_project_ids, is_active, created_by_user_id, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,$12,NOW()) RETURNING id`, [fields.email, name, fields.username, employeeId, fields.role, fields.password_hash,
            fields.authorized_print ?? false, fields.authorized_download ?? false, fields.unit_status_access ?? 'all',
            fields.home_page_widgets ?? '[]', fields.assigned_project_ids ?? '[]', req.userId]);
        const userId = created.rows[0].id;
        for (const p of perms) {
            await client.query(`INSERT INTO user_process_permissions (user_id, process_name, is_maker, is_checker, is_approver, created_by_user_id) VALUES ($1,$2,$3,$4,false,$5)`, [userId, p.processName, p.isMaker, p.isChecker, req.userId]);
        }
        if (companyIds.length)
            await client.query(`INSERT INTO user_company_access (user_id, company_id, created_by_user_id) SELECT $1, unnest($2::uuid[]), $3`, [userId, companyIds, req.userId]);
        await client.query('COMMIT');
        await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'create', 'user', userId, {}, { username: fields.username, email: fields.email, role: fields.role });
        res.status(201).json({ success: true, data: { userId, username: fields.username } });
    }
    catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
    finally {
        client.release();
    }
}));
// GET /api/users/employee-login — logins with their permissions
router.get('/employee-login', guard(async (req, res) => {
    const { username, role, status } = req.query;
    const params = [];
    let where = 'WHERE 1=1';
    if (username) {
        params.push(`%${like(String(username))}%`);
        where += ` AND (u.username ILIKE $${params.length} OR u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
    }
    if (role) {
        params.push(String(role));
        where += ` AND u.role = $${params.length}`;
    }
    if (status === 'active')
        where += ` AND u.is_active = true`;
    else if (status === 'inactive')
        where += ` AND u.is_active = false`;
    const result = await index_js_1.db.query(`
    SELECT u.id, u.name, u.username, u.email, u.mobile, u.role, r.label AS role_label,
           u.unit_status_access, u.authorized_print, u.authorized_download, u.home_page_widgets,
           u.is_active, u.last_login_at, u.created_at, u.assigned_project_ids, u.ip_security_enabled,
           eu.name AS employee_name, ep.designation,
           COALESCE((SELECT json_agg(jsonb_build_object('process_name', upp.process_name, 'is_maker', upp.is_maker, 'is_checker', upp.is_checker, 'is_approver', upp.is_approver))
                     FROM user_process_permissions upp WHERE upp.user_id = u.id), '[]') AS process_permissions,
           COALESCE((SELECT json_agg(uca.company_id) FROM user_company_access uca WHERE uca.user_id = u.id), '[]') AS company_ids,
           COALESCE((SELECT array_agg(c.name ORDER BY c.name) FROM user_company_access uca JOIN companies c ON c.id = uca.company_id WHERE uca.user_id = u.id), '{}') AS company_names,
           COALESCE((SELECT string_agg(p.name, ', ' ORDER BY p.name) FROM projects p
                     WHERE p.id::text IN (SELECT jsonb_array_elements_text(COALESCE(u.assigned_project_ids, '[]'::jsonb)))), '') AS project_names,
           (SELECT COUNT(*)::int FROM user_ip_restrictions uir WHERE uir.user_id = u.id AND uir.is_active = true) AS ip_count
    FROM users u
    LEFT JOIN roles r ON lower(r.name) = lower(u.role) AND r.is_active
    LEFT JOIN employee_profiles ep ON ep.id = u.employee_id
    LEFT JOIN users eu ON eu.id = ep.user_id
    ${where}
    ORDER BY u.created_at DESC`, params);
    res.json({ success: true, data: result.rows });
}));
// PATCH /api/users/employee-login/:id — role, permissions, companies, projects, status, password
router.patch('/employee-login/:id', guard(async (req, res) => {
    await updateUser(req, res, req.params.id, req.body || {});
    res.json({ success: true });
}));
// POST /api/users/employee-login/:id/sign-out — end every session of this user now
router.post('/employee-login/:id/sign-out', guard(async (req, res) => {
    if (!(0, security_js_1.isUuid)(req.params.id))
        return fail(404, 'User not found');
    const r = await index_js_1.db.query(`UPDATE users SET token_version = COALESCE(token_version, 0) + 1 WHERE id = $1 RETURNING id, name`, [req.params.id]);
    if (!r.rows[0])
        return fail(404, 'User not found');
    (0, index_js_2.invalidateAuthUser)(req.params.id);
    await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'user', req.params.id, {}, { action: 'signed out everywhere' });
    res.json({ success: true });
}));
// IP allow list ---------------------------------------------------------------
async function ipTarget(id) {
    if (!(0, security_js_1.isUuid)(id))
        return fail(404, 'User not found');
    const u = await index_js_1.db.query(`SELECT id FROM users WHERE id = $1`, [id]);
    if (!u.rows[0])
        fail(404, 'User not found');
}
router.get('/employee-login/:id/ips', guard(async (req, res) => {
    await ipTarget(req.params.id);
    const r = await index_js_1.db.query(`SELECT id, ip_address, description, is_active, created_at FROM user_ip_restrictions WHERE user_id = $1 ORDER BY created_at DESC`, [req.params.id]);
    res.json({ success: true, data: r.rows });
}));
router.post('/employee-login/:id/ips', guard(async (req, res) => {
    await ipTarget(req.params.id);
    const ip = (0, security_js_1.cleanIp)(req.body?.ip_address);
    if (!ip)
        return fail(400, 'Enter a valid IPv4 or IPv6 address');
    const description = str(req.body?.description).slice(0, 200) || null;
    const r = await index_js_1.db.query(`INSERT INTO user_ip_restrictions (user_id, ip_address, description) VALUES ($1,$2,$3)
     ON CONFLICT (user_id, ip_address) DO UPDATE SET is_active = true, description = COALESCE($3, user_ip_restrictions.description)
     RETURNING id, ip_address, description, is_active`, [req.params.id, ip, description]);
    (0, index_js_2.invalidateAuthUser)(req.params.id);
    await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'user', req.params.id, {}, { ipAdded: ip });
    res.status(201).json({ success: true, data: r.rows[0] });
}));
router.delete('/employee-login/:id/ips/:ipId', guard(async (req, res) => {
    await ipTarget(req.params.id);
    if (!(0, security_js_1.isUuid)(req.params.ipId))
        return fail(404, 'IP address not found');
    const left = await index_js_1.db.query(`SELECT COUNT(*) FILTER (WHERE is_active AND id <> $2)::int AS others, bool_or(id = $2) AS found, (SELECT ip_security_enabled FROM users WHERE id = $1) AS on_
     FROM user_ip_restrictions WHERE user_id = $1`, [req.params.id, req.params.ipId]);
    if (!left.rows[0].found)
        return fail(404, 'IP address not found');
    if (left.rows[0].on_ && left.rows[0].others === 0)
        return fail(409, 'Switch IP security off before removing the last allowed address');
    await index_js_1.db.query(`DELETE FROM user_ip_restrictions WHERE id = $1 AND user_id = $2`, [req.params.ipId, req.params.id]);
    (0, index_js_2.invalidateAuthUser)(req.params.id);
    await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'user', req.params.id, {}, { ipRemoved: req.params.ipId });
    res.json({ success: true });
}));
// ---------------------------------------------------------------------------
// Own profile and single users
// ---------------------------------------------------------------------------
// GET /api/users/me - current user with process permissions
router.get('/me', guard(async (req, res) => {
    if (!req.userId)
        return fail(401, 'Not authenticated');
    const u = await index_js_1.db.query(`SELECT id, name, email, mobile, role, assigned_project_ids, is_active FROM users WHERE id = $1`, [req.userId]);
    if (!u.rows[0])
        return fail(404, 'User not found');
    const [perm, companies] = await Promise.all([
        index_js_1.db.query(`SELECT process_name, is_maker, is_checker, is_approver FROM user_process_permissions WHERE user_id = $1`, [req.userId]),
        index_js_1.db.query(`SELECT company_id FROM user_company_access WHERE user_id = $1`, [req.userId]),
    ]);
    const processPermissions = {};
    for (const row of perm.rows) {
        const roles = [];
        if (row.is_maker)
            roles.push('maker');
        if (row.is_checker)
            roles.push('checker');
        if (row.is_approver)
            roles.push('approver');
        processPermissions[row.process_name] = roles;
    }
    res.json({ success: true, data: { ...u.rows[0], processPermissions, companyIds: companies.rows.map((r) => r.company_id) } });
}));
// GET /api/users/:id
router.get('/:id', guard(async (req, res) => {
    if (!(0, security_js_1.isUuid)(req.params.id))
        return fail(404, 'User not found');
    const r = await index_js_1.db.query(`SELECT id, name, email, mobile, role, assigned_project_ids, is_active, last_login_at, created_at FROM users WHERE id = $1`, [req.params.id]);
    if (!r.rows[0])
        return fail(404, 'User not found');
    res.json({ success: true, data: r.rows[0] });
}));
// PATCH /api/users/:id — same rules as employee-login/:id
router.patch('/:id', guard(async (req, res) => {
    await updateUser(req, res, req.params.id, req.body || {});
    const r = await index_js_1.db.query(`SELECT id, name, email, role, is_active, updated_at FROM users WHERE id = $1`, [req.params.id]);
    res.json({ success: true, data: r.rows[0] });
}));
// POST /api/users/:id/change-password
router.post('/:id/change-password', guard(async (req, res) => {
    const { id } = req.params;
    const { newPassword, currentPassword } = req.body || {};
    if (!(0, security_js_1.isUuid)(id))
        return fail(404, 'User not found');
    const problem = (0, security_js_1.passwordProblem)(newPassword);
    if (problem)
        return fail(400, problem);
    // Non-admins can only change their own password, and must give the current one
    if (req.userRole !== 'super_admin' && req.userId !== id)
        return fail(403, 'Forbidden: can only change your own password');
    if (req.userId === id && req.userRole !== 'super_admin') {
        if (!currentPassword || typeof currentPassword !== 'string')
            return fail(400, 'Current password is required');
        const hash = (await index_js_1.db.query(`SELECT password_hash FROM users WHERE id = $1`, [id])).rows[0]?.password_hash;
        const ok = hash?.startsWith('$2') ? await bcryptjs_1.default.compare(currentPassword, hash) : Buffer.from(currentPassword).toString('base64') === hash;
        if (!ok)
            return fail(401, 'Current password is incorrect');
    }
    const r = await index_js_1.db.query(`UPDATE users SET password_hash = $1, token_version = COALESCE(token_version, 0) + 1, updated_at = NOW() WHERE id = $2 RETURNING id, name, email`, [await bcryptjs_1.default.hash(newPassword, 12), id]);
    if (!r.rows[0])
        return fail(404, 'User not found');
    (0, index_js_2.invalidateAuthUser)(id);
    await (0, auditLogger_js_1.auditChange)(index_js_1.db, req, res, 'update', 'user', id, {}, { passwordChanged: true });
    res.json({ success: true, data: r.rows[0] });
}));
router.use(pg_errors_js_1.pgErrorHandler);
exports.default = router;
//# sourceMappingURL=users.js.map