"use strict";
/**
 * ROF CRM API
 * Node.js + Express RESTful API
 * PostgreSQL database, Bull/Redis for async jobs, JWT authentication
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = exports.clientIp = exports.clearAuthUserCache = exports.invalidateAuthUser = exports.db = exports.appConfig = void 0;
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
// Route imports
const consumers_js_1 = __importDefault(require("./routes/consumers.js"));
const photos_js_1 = __importDefault(require("./routes/photos.js"));
const units_js_1 = __importDefault(require("./routes/units.js"));
const allocations_js_1 = __importDefault(require("./routes/allocations.js"));
const payments_js_1 = __importDefault(require("./routes/payments.js"));
const demands_js_1 = __importDefault(require("./routes/demands.js"));
const receipts_js_1 = __importDefault(require("./routes/receipts.js"));
const documents_js_1 = __importDefault(require("./routes/documents.js"));
const communications_js_1 = __importDefault(require("./routes/communications.js"));
const users_js_1 = __importDefault(require("./routes/users.js"));
const reports_js_1 = __importDefault(require("./routes/reports.js"));
const milestones_js_1 = __importDefault(require("./routes/milestones.js"));
const reconciliation_js_1 = __importDefault(require("./routes/reconciliation.js"));
const smtp_config_js_1 = __importDefault(require("./routes/smtp_config.js"));
const faq_js_1 = __importDefault(require("./routes/faq.js"));
const tasks_js_1 = __importDefault(require("./routes/tasks.js"));
const automation_js_1 = __importDefault(require("./routes/automation.js"));
const email_templates_js_1 = __importDefault(require("./routes/email-templates.js"));
const brokers_js_1 = __importDefault(require("./routes/brokers.js"));
const parking_js_1 = __importDefault(require("./routes/parking.js"));
const import_js_1 = __importDefault(require("./routes/import.js"));
const projects_js_1 = __importDefault(require("./routes/projects.js"));
const broker_setup_js_1 = __importDefault(require("./routes/broker_setup.js"));
const inventory_hold_js_1 = __importDefault(require("./routes/inventory_hold.js"));
const dashboard_js_1 = __importDefault(require("./routes/dashboard.js"));
const master_js_1 = __importDefault(require("./routes/master.js"));
const booking_js_1 = __importDefault(require("./routes/booking.js"));
const booking_documents_js_1 = __importDefault(require("./routes/booking_documents.js"));
const employees_js_1 = __importDefault(require("./routes/employees.js"));
const addon_charges_js_1 = __importDefault(require("./routes/addon-charges.js"));
const charge_master_js_1 = __importDefault(require("./routes/charge-master.js"));
const plc_charges_js_1 = __importDefault(require("./routes/plc-charges.js"));
const surrender_js_1 = __importDefault(require("./routes/surrender.js"));
const transfers_js_1 = __importDefault(require("./routes/transfers.js"));
const registry_js_1 = __importDefault(require("./routes/registry.js"));
const loans_js_1 = __importDefault(require("./routes/loans.js"));
const receipt_process_js_1 = __importDefault(require("./routes/receipt-process.js"));
const financial_ops_js_1 = __importDefault(require("./routes/financial-ops.js"));
const outgoing_payments_js_1 = __importDefault(require("./routes/outgoing-payments.js"));
const test_data_import_js_1 = __importDefault(require("./routes/test-data-import.js"));
const roles_js_1 = __importDefault(require("./routes/roles.js"));
const companies_js_1 = __importDefault(require("./routes/companies.js"));
const custom_letters_js_1 = __importDefault(require("./routes/custom-letters.js"));
const gst_configuration_js_1 = __importDefault(require("./routes/gst-configuration.js"));
const rbac_js_1 = require("./middleware/rbac.js");
const auditLogger_js_1 = require("./middleware/auditLogger.js");
const security_js_1 = require("./utils/security.js");
const throttle_js_1 = require("./utils/throttle.js");
const app_config_js_1 = require("./utils/app-config.js");
// import { responseFormatter } from './middleware/responseFormatter.js'; // DISABLED: Using route-level transformations instead
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
const isDev = process.env.NODE_ENV !== 'production';
// Auth config. No fallback secret: a missing JWT_SECRET must stop the server, not sign tokens with a known value.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET)
    throw new Error('JWT_SECRET is not set. Refusing to start.');
// Which deployment this is (APP_ENV) and how project scope is applied (SCOPE_MODE); a bad combination stops the start.
exports.appConfig = (0, app_config_js_1.loadAppConfig)();
// Dev shortcuts (mock token, passwordless login) need an explicit opt-in on top of a non-production NODE_ENV.
const DEV_AUTH = isDev && process.env.ALLOW_DEV_AUTH === 'true';
// Behind the host's proxy (Vercel), req.ip must be the client address or every user shares one rate-limit bucket.
if (!isDev)
    app.set('trust proxy', 1);
const pool_1 = require("./db/pool");
var pool_2 = require("./db/pool");
Object.defineProperty(exports, "db", { enumerable: true, get: function () { return pool_2.db; } });
// ============================================
// SECURITY HEADERS (helmet)
// ============================================
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false, // SPA serves from same origin; CSP configured separately if needed
    crossOriginEmbedderPolicy: false,
}));
// ============================================
// RATE LIMITING
// ============================================
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isDev ? 1000 : 10, // relax in dev so mock-token testing is unaffected
    message: { error: 'Too many login attempts, please try again after 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
});
const apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: isDev ? Number(process.env.API_RATE_MAX || 5000) : 300, // API_RATE_MAX: the click-through test sends more than 5000 a minute
    message: { error: 'Too many requests, please slow down' },
    standardHeaders: true,
    legacyHeaders: false,
});
// ============================================
// BODY PARSING
// ============================================
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// ============================================
// CORS
// ============================================
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3000', 'http://localhost:5173'];
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (!origin || allowedOrigins.includes(origin) || isDev) {
        res.header('Access-Control-Allow-Origin', origin || '*');
    }
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});
// Role, active flag and token_version are read from the DB (cached briefly) so that
// deactivation, role changes and logout take effect without waiting for the JWT to expire.
const AUTH_CACHE_MS = 15000;
const authUserCache = new Map();
const invalidateAuthUser = (userId) => { authUserCache.delete(userId); };
exports.invalidateAuthUser = invalidateAuthUser;
const clearAuthUserCache = () => authUserCache.clear(); // after a role definition changes
exports.clearAuthUserCache = clearAuthUserCache;
const loadAuthUser = async (userId) => {
    const hit = authUserCache.get(userId);
    if (hit && Date.now() - hit.at < AUTH_CACHE_MS)
        return hit.user;
    const r = await pool_1.db.query(`SELECT u.role,
            -- UR-001: only a login whose own role is super_admin gets the super_admin bypass; a custom role whose base role is
            -- super_admin resolves to null (unknown role, refused by rbac) and never to super_admin
            CASE WHEN u.role = 'super_admin' THEN 'super_admin'
                 ELSE NULLIF(COALESCE((SELECT r.base_role FROM roles r WHERE lower(r.name) = lower(u.role) AND r.is_active LIMIT 1), u.role), 'super_admin')
            END AS eff_role,
            u.is_active, u.authorized_print, u.authorized_download, COALESCE(u.token_version, 0) AS token_version,
            CASE WHEN u.ip_security_enabled IS TRUE
                 THEN ARRAY(SELECT ip_address FROM user_ip_restrictions WHERE user_id = u.id AND is_active) END AS ip_rules,
            -- project ids the login is limited to, as one comma separated text; null when it may see every project.
            -- Assigned projects and company grants both narrow it (a project must satisfy every limit the login has); a project that belongs
            -- to no company is outside any company limit. Granting a company never widens anything.
            CASE WHEN jsonb_array_length(COALESCE(u.assigned_project_ids, '[]'::jsonb)) > 0
                   OR EXISTS (SELECT 1 FROM user_company_access uc WHERE uc.user_id = u.id) THEN
              -- limited to nothing that exists: see nothing, never everything
              COALESCE((SELECT string_agg(DISTINCT p.id::text, ',') FROM projects p
                         WHERE (jsonb_array_length(COALESCE(u.assigned_project_ids, '[]'::jsonb)) = 0
                                OR p.id::text IN (SELECT jsonb_array_elements_text(u.assigned_project_ids)))
                           AND (NOT EXISTS (SELECT 1 FROM user_company_access uc WHERE uc.user_id = u.id)
                                OR p.company_id IN (SELECT uc.company_id FROM user_company_access uc WHERE uc.user_id = u.id))), '00000000-0000-0000-0000-000000000000')
            END AS project_scope,
            ARRAY(SELECT uc.company_id::text FROM user_company_access uc WHERE uc.user_id = u.id) AS company_ids
       FROM users u WHERE u.id = $1`, [userId]);
    const user = r.rows[0] || null;
    authUserCache.set(userId, { at: Date.now(), user });
    if (authUserCache.size > 2000)
        authUserCache.clear();
    return user;
};
// IP security: a user with it switched on may only work from the addresses on their allow list
const clientIp = (req) => (0, security_js_1.cleanIp)(req.ip) ?? '';
exports.clientIp = clientIp;
// Stored addresses are compared in canonical form, so a row saved in another spelling still matches
const ipBlocked = (user, req) => !!user?.ip_rules && !user.ip_rules.map((a) => (0, security_js_1.cleanIp)(a) ?? a).includes((0, exports.clientIp)(req));
// UR-006: a blocked address looks like any other failed sign-in from outside; the real reason goes to the audit log only
const blockedLogged = new Map(); // one audit row a minute per login and channel, so a retrying client cannot flood the log
const auditBlocked = (userId, req, channel) => {
    const k = userId + channel;
    const now = Date.now();
    if ((blockedLogged.get(k) ?? 0) > now - 60000)
        return;
    blockedLogged.set(k, now);
    if (blockedLogged.size > 2000)
        blockedLogged.clear();
    (0, auditLogger_js_1.logAudit)(pool_1.db, userId, 'auth_blocked', 'auth', userId, {}, { ip: (0, exports.clientIp)(req), reason: 'ip_not_allowed', channel }).catch(() => { });
};
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    // ?token= is accepted for GET only (window.open() navigations such as letters and receipts)
    const queryToken = req.method === 'GET' ? req.query.token : null;
    const token = (authHeader && authHeader.split(' ')[1]) || queryToken || null;
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    // Development only, and only with ALLOW_DEV_AUTH=true
    if (DEV_AUTH && token === 'mock-jwt-token') {
        req.userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
        req.userName = 'Test User';
        req.userRole = 'super_admin';
        req.roleName = 'super_admin';
        req.userPermissions = [];
        return next();
    }
    let decoded;
    try {
        decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    }
    catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
    // A web address may only carry a short-lived link token made for exactly that page; the login token never goes in a URL
    const viaQuery = !(authHeader && authHeader.split(' ')[1]);
    if (viaQuery ? decoded.purpose !== 'link' || decoded.p !== req.originalUrl.split('?')[0] : decoded.purpose === 'link') {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
    try {
        const user = await loadAuthUser(decoded.userId);
        if (!user || user.is_active === false || user.token_version !== (decoded.tv ?? 0)) {
            return res.status(401).json({ error: 'Session is no longer valid. Please sign in again.' });
        }
        if (ipBlocked(user, req)) {
            auditBlocked(decoded.userId, req, 'request');
            return res.status(401).json({ error: 'Authentication required' });
        }
        req.userId = decoded.userId;
        req.userName = decoded.name || decoded.email || 'Unknown';
        req.userRole = user.eff_role ?? undefined;
        req.roleName = user.role;
        req.companyIds = user.eff_role !== 'super_admin' && user.company_ids && user.company_ids.length ? user.company_ids : null;
        req.authorizedPrint = user.authorized_print === true;
        req.authorizedDownload = user.authorized_download === true;
        if (user.eff_role !== 'super_admin' && user.project_scope)
            pool_1.scopeStore.enterWith({ projectIds: user.project_scope });
        req.userPermissions = decoded.permissions || [];
        next();
    }
    catch (err) {
        console.error('Auth lookup failed:', err);
        return res.status(503).json({ error: 'Authentication service unavailable' });
    }
};
exports.authenticateToken = authenticateToken;
// ============================================
// RBAC HELPER — maps HTTP method → action
// ============================================
const rbac = (resource) => (req, res, next) => {
    const methodToAction = {
        GET: 'view', POST: 'create', PATCH: 'edit', PUT: 'edit', DELETE: 'delete',
    };
    const action = methodToAction[req.method] || 'view';
    // Every signed-in user may read the name list used by pick lists
    if (resource === 'users' && req.method === 'GET' && req.path === '/directory')
        return next();
    // Every signed-in user may read their own profile and process permissions
    if (resource === 'users' && req.method === 'GET' && req.path === '/me')
        return next();
    // Every signed-in user may change their own password (the route itself checks the current password)
    if (resource === 'users' && req.method === 'POST' && req.path === `/${req.userId}/change-password`)
        return next();
    return (0, rbac_js_1.requirePermission)(resource, action)(req, res, next);
};
// ============================================
// AUTO AUDIT MIDDLEWARE
// Intercepts mutating responses and writes to audit_logs
// ============================================
const autoAudit = (req, res, next) => {
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
        return next();
    }
    const origJson = res.json.bind(res);
    res.json = (data) => {
        if (data?.success && data?.data?.id && !res.locals.auditLogged) {
            const pathParts = req.path.split('/').filter(Boolean);
            const resourceType = pathParts[0] || 'unknown';
            const action = req.method === 'POST' ? 'create' : req.method === 'DELETE' ? 'delete' : 'update';
            (0, auditLogger_js_1.logAudit)(pool_1.db, req.userId || null, action, resourceType, data.data.id, {}, data.data);
        }
        return origJson(data);
    };
    next();
};
// ============================================
// STATIC FILES — Static HTML frontend
// ============================================
const webPublicDir = path_1.default.join(__dirname, '../../web/public');
app.use(express_1.default.static(webPublicDir));
// Serve uploaded consumer photos
const uploadsDir = path_1.default.join(__dirname, '../uploads');
app.use('/uploads', express_1.default.static(uploadsDir));
app.use('/api/photos', photos_js_1.default);
// ============================================
// HEALTH CHECK
// ============================================
app.get('/api/health', (req, res) => {
    // commit lets the deploy pipeline confirm which version is live (DEPLOY_SHA is set by the pipeline's deploy)
    res.json({ status: 'ok', timestamp: new Date().toISOString(), commit: (process.env.DEPLOY_SHA || process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || null });
});
// ============================================
// PUBLIC ENDPOINTS (No Auth Required)
// ============================================
app.get('/api/import/template/units', (req, res) => {
    const headers = 'tower,floor,unitNumber,bhkType,carpetAreaSqft,superAreaSqft,balconyAreaSqft,basePriceInr,totalPriceInr,facing\n';
    const example = 'Tower A,1,A-101,2BHK,650,750,100,5000000,5000000,North\n';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="units_import_template.csv"');
    res.send(headers + example);
});
// ============================================
// AUTH ENDPOINT
// ============================================
// Compared against when the account does not exist, so response time does not reveal which emails are registered
const DUMMY_HASH = '$2a$12$sa7LeROPXNZkq2afAye6LuncKbiuFGc0Qx7OUrtgNja4dbiffmqkC';
// Five failures lock one address and account for 15 minutes. The counts live in the shared store when it exists (utils/throttle.ts), else per process.
const loginThrottle = (0, throttle_js_1.makeThrottle)('login', 5, 24 * 60 * 60 * 1000, 15 * 60 * 1000);
// Tokens must never be cached by browsers or proxies
app.use('/api/auth', (req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
// Opening a letter, receipt or applicant file in a new tab needs a link: valid 2 minutes, for that one page only
app.post('/api/auth/link-token', exports.authenticateToken, (req, res) => {
    const path = (req.body || {}).path;
    if (typeof path !== 'string' || !/^\/api\/[A-Za-z0-9/_.\-]+$/.test(path) || path.includes('..'))
        return res.status(400).json({ error: 'path is not valid' });
    const { iat, exp, purpose, p, ...claims } = jsonwebtoken_1.default.decode(req.headers['authorization'].split(' ')[1]);
    res.json({ token: jsonwebtoken_1.default.sign({ ...claims, purpose: 'link', p: path }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '2m' }) });
});
app.post('/api/auth/login', authLimiter, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }
    if (typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: 'Invalid input' });
    }
    // Postgres rejects NUL bytes; treat such input as a failed login, not a server error
    if (email.includes('\u0000') || email.length > 320) {
        return res.status(401).json({ error: 'Invalid email or password' });
    }
    // Per account and per IP lockout on top of the per IP limiter
    const failKey = `${req.ip}|${email.toLowerCase().trim()}`;
    if ((await loginThrottle.blockedFor(failKey)) > 0) {
        return res.status(429).json({ error: 'Too many failed attempts. Try again in 15 minutes.' });
    }
    try {
        const result = await pool_1.db.query(`SELECT id, name, email, role, password_hash, is_active, COALESCE(token_version, 0) AS token_version FROM users WHERE lower(email) = $1 LIMIT 1`, [email.toLowerCase().trim()]);
        const user = result.rows[0];
        // Always return same error to prevent email enumeration
        if (!user || user.is_active === false) {
            await bcryptjs_1.default.compare(password, DUMMY_HASH);
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        let validPassword = false;
        if (!user.password_hash) {
            // No password set: only with the explicit dev opt-in
            validPassword = DEV_AUTH;
        }
        else if (user.password_hash.startsWith('$2')) {
            // bcrypt hash
            validPassword = await bcryptjs_1.default.compare(password, user.password_hash);
        }
        else {
            // Legacy base64 placeholder — compare and migrate on success
            const base64Attempt = Buffer.from(password).toString('base64');
            validPassword = user.password_hash === base64Attempt || user.password_hash === password;
            if (validPassword) {
                // Silently migrate to bcrypt on successful login
                const newHash = await bcryptjs_1.default.hash(password, 12);
                pool_1.db.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [newHash, user.id]).catch(() => { });
            }
        }
        if (!validPassword) {
            await loginThrottle.fail(failKey);
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        await loginThrottle.clear(failKey);
        if (ipBlocked(await loadAuthUser(user.id), req)) {
            auditBlocked(user.id, req, 'login');
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        pool_1.db.query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [user.id]).catch(() => { });
        (0, auditLogger_js_1.logAudit)(pool_1.db, user.id, 'login', 'auth', user.id, {}, { ip: (0, exports.clientIp)(req) }).catch(() => { });
        const token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email, name: user.name, role: user.role, tv: user.token_version }, JWT_SECRET, { expiresIn: '8h', algorithm: 'HS256' });
        return res.json({
            success: true,
            token,
            data: { id: user.id, name: user.name, email: user.email, role: user.role },
        });
    }
    catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// Server side sign out: bumping token_version invalidates every token issued so far for this user
app.post('/api/auth/logout', exports.authenticateToken, async (req, res) => {
    try {
        if (req.userId && req.userId !== 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') {
            await pool_1.db.query(`UPDATE users SET token_version = COALESCE(token_version, 0) + 1 WHERE id = $1`, [req.userId]);
            (0, exports.invalidateAuthUser)(req.userId);
        }
        return res.json({ success: true });
    }
    catch (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// ============================================
// DIAGNOSTIC ENDPOINTS
// The only public health answer is GET /api/health (status, time, short commit) for deployment checks.
// The two diagnostics below need a login with the super_admin role and are rate limited, and neither returns
// document text or an internal error message.
// ============================================
let lastMigrationLog = [];
const adminDiagnostics = [
    apiLimiter,
    exports.authenticateToken,
    (req, res, next) => (req.userRole === 'super_admin' ? next() : res.status(403).json({ error: 'Forbidden' })),
];
app.get('/api/health/debug', ...adminDiagnostics, async (req, res) => {
    res.json({
        success: true,
        timestamp: new Date().toISOString(),
        lastMigrationLog,
        databaseUrl: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
        throttle: (0, throttle_js_1.throttleBackend)(), // 'shared' once migration T2 is applied, else 'process-local' (a production blocker)
    });
});
app.get('/api/health/templates', ...adminDiagnostics, async (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        console.log('[HEALTH] Templates diagnostic endpoint called');
        // Check if template files exist
        const templateFiles = [
            { name: 'ats_rof_alante.html', path: path.join(__dirname, 'templates/legal/ats_rof_alante.html') },
            { name: 'conveyance_rof_alante.html', path: path.join(__dirname, 'templates/legal/conveyance_rof_alante.html') },
        ];
        const filesStatus = {};
        for (const file of templateFiles) {
            filesStatus[file.name] = fs.existsSync(file.path);
            console.log(`[HEALTH] File ${file.name}: ${filesStatus[file.name] ? 'EXISTS' : 'MISSING'} at ${file.path}`);
        }
        // Which templates exist (type, project, name, how many). The stored template text is never returned here.
        const dbRes = await pool_1.db.query(`
      SELECT
        document_type,
        project_id,
        name,
        COUNT(*) as count
      FROM document_templates
      WHERE document_type IN ('buyer_builder_agreement', 'conveyance_deed')
      GROUP BY document_type, project_id, name
      ORDER BY document_type, project_id NULLS FIRST
    `);
        const dbTemplates = dbRes.rows;
        console.log(`[HEALTH] Found ${dbTemplates.length} template variants in database`);
        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            environment: {
                nodeEnv: process.env.NODE_ENV,
            },
            files: filesStatus,
            database_templates: dbTemplates,
        });
    }
    catch (error) {
        console.error('[HEALTH] Diagnostic failed:', error);
        res.status(500).json({ success: false, error: 'Diagnostic failed' });
    }
});
// ============================================
// API ROUTES (with auth + RBAC + auto-audit + response formatter)
// ============================================
app.use('/api', apiLimiter);
app.use('/api', autoAudit);
app.use('/api/consumers', exports.authenticateToken, rbac('consumers'), consumers_js_1.default);
app.use('/api/units', exports.authenticateToken, rbac('units'), units_js_1.default);
app.use('/api/allocations', exports.authenticateToken, rbac('allocations'), allocations_js_1.default);
app.use('/api/payments', exports.authenticateToken, rbac('payments'), demands_js_1.default);
app.use('/api/payments', exports.authenticateToken, rbac('payments'), receipts_js_1.default);
app.use('/api/payments', exports.authenticateToken, rbac('payments'), payments_js_1.default);
app.use('/api/documents', exports.authenticateToken, rbac('documents'), documents_js_1.default);
// The calling screen is also for finance (permission "calling"): they may open the list, the status codes and log a call
app.use('/api/communications', exports.authenticateToken, (req, res, next) => {
    const calling = /^\/(calling-list|status-codes)$/.test(req.path) && req.method === 'GET' || req.path === '/log-call' && req.method === 'POST';
    if (calling && (0, rbac_js_1.hasPermission)(req.userRole, 'calling', req.method === 'GET' ? 'view' : 'create'))
        return next();
    return rbac('communications')(req, res, next);
}, communications_js_1.default);
app.use('/api/users', exports.authenticateToken, rbac('users'), users_js_1.default);
app.use('/api/reports', exports.authenticateToken, rbac('reports'), reports_js_1.default);
app.use('/api/milestones', exports.authenticateToken, rbac('payments'), milestones_js_1.default);
app.use('/api/reconciliation', exports.authenticateToken, rbac('payments'), reconciliation_js_1.default);
app.use('/api/smtp-configs', exports.authenticateToken, rbac('smtp_configs'), smtp_config_js_1.default);
// Staff need communications access for the FAQ; anyone with it may still vote on an article (POST feedback), as before
app.use('/api/faq', exports.authenticateToken, (req, res, next) => (/^\/articles\/[^/]+\/feedback$/.test(req.path) ? next() : rbac('communications')(req, res, next)), faq_js_1.default);
app.use('/api/tasks', exports.authenticateToken, rbac('consumers'), tasks_js_1.default);
app.use('/api/automation', exports.authenticateToken, rbac('communications'), automation_js_1.default);
app.use('/api/email-templates', exports.authenticateToken, rbac('communications'), email_templates_js_1.default);
// Brokers: registering and approving needs consumers rights; the commission list and its payment are payments rights (Accounts pay them)
app.use('/api/brokers', exports.authenticateToken, (req, res, next) => rbac(req.path.startsWith('/commission') ? 'payments' : 'consumers')(req, res, next), brokers_js_1.default);
app.use('/api/parking', exports.authenticateToken, rbac('units'), parking_js_1.default);
app.use('/api/import', exports.authenticateToken, rbac('units'), import_js_1.default);
app.use('/api/projects', exports.authenticateToken, rbac('units'), projects_js_1.default);
app.use('/api/broker-setup', exports.authenticateToken, rbac('broker_setup'), broker_setup_js_1.default);
app.use('/api/inventory-hold', exports.authenticateToken, rbac('inventory_hold'), inventory_hold_js_1.default);
app.use('/api/dashboard', exports.authenticateToken, rbac('payments'), dashboard_js_1.default);
app.use('/api/master', exports.authenticateToken, master_js_1.default);
app.use('/api/booking', exports.authenticateToken, booking_js_1.default);
app.use('/api/booking-documents', exports.authenticateToken, booking_documents_js_1.default);
app.use('/api/employees', exports.authenticateToken, rbac('users'), employees_js_1.default);
app.use('/api/addon-charges', exports.authenticateToken, addon_charges_js_1.default);
app.use('/api/charge-master', exports.authenticateToken, charge_master_js_1.default);
app.use('/api/plc-charges', exports.authenticateToken, plc_charges_js_1.default);
app.use('/api/gst-configuration', exports.authenticateToken, gst_configuration_js_1.default);
app.use('/api/surrender', exports.authenticateToken, rbac('allocations'), surrender_js_1.default);
app.use('/api/transfers', exports.authenticateToken, rbac('allocations'), transfers_js_1.default);
app.use('/api/registry', exports.authenticateToken, rbac('allocations'), registry_js_1.default);
app.use('/api/loans', exports.authenticateToken, rbac('consumers'), loans_js_1.default);
app.use('/api/payments', exports.authenticateToken, rbac('payments'), receipt_process_js_1.default);
app.use('/api/payments', exports.authenticateToken, rbac('payments'), financial_ops_js_1.default);
app.use('/api/payments', exports.authenticateToken, rbac('payments'), outgoing_payments_js_1.default);
// Leftover read-only check of the test data import: it lists customers and projects, super_admin only
app.use('/api/test-data', exports.authenticateToken, (req, res, next) => (req.userRole === 'super_admin' ? next() : res.status(403).json({ error: 'Forbidden' })), test_data_import_js_1.default);
app.use('/api/roles', exports.authenticateToken, roles_js_1.default);
app.use('/api/companies', exports.authenticateToken, companies_js_1.default);
app.use('/api/custom-letters', exports.authenticateToken, rbac('documents'), custom_letters_js_1.default);
// An API path no route handled answers in JSON, like every other API error
app.use('/api', (req, res) => { res.status(404).json({ error: 'Not found' }); });
// ============================================
// SPA FALLBACK
// ============================================
app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path_1.default.join(webPublicDir, 'index.html'));
});
// ============================================
// ERROR HANDLING
// ============================================
app.use((err, req, res, next) => {
    // Body parser errors (bad JSON, body too large) are client errors, not server errors
    const clientStatus = err.status || err.statusCode;
    if (clientStatus >= 400 && clientStatus < 500) {
        return res.status(clientStatus).json({ error: clientStatus === 413 ? 'Request too large' : 'Bad request' });
    }
    console.error('Error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: isDev ? err.message : undefined,
    });
});
// ============================================
// SERVER STARTUP
// ============================================
(async () => {
    // Migrations are not run at startup: awaiting runMigrations() here blocked app.listen() on Neon cold starts
    // (80+ sequential queries). Vercel only builds the code, so new migrations are applied with the
    // "Run migrations" workflow (.github/workflows/migrate.yml) or `npm run db:migrate`.
    lastMigrationLog = ['[STARTUP] Migrations are not run at startup; see .github/workflows/migrate.yml'];
    console.log('[STARTUP] Skipping runtime migrations (applied separately)');
    // The sign-in throttles need the shared store (draft migration T2). Without it every instance counts on its own: say so, loudly, in production.
    if ((await (0, throttle_js_1.refreshThrottleBackend)(true)) !== 'shared') {
        const msg = '[SECURITY] Login and current-password throttles are PROCESS-LOCAL (table auth_throttle is missing): on a multi-instance host the limits are weaker than they look. Apply migration T2 (docs/users-roles/pending-migrations).';
        if (exports.appConfig.appEnv === 'production')
            console.error(msg);
        else
            console.warn(msg);
    }
    // On Vercel the exported app is the request handler; only bind a port elsewhere
    if (!process.env.VERCEL) {
        app.listen(Number(PORT), '0.0.0.0', () => {
            console.log(`ROF CRM API running on port ${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV || 'development'} (APP_ENV ${exports.appConfig.appEnv ?? 'not set'}, SCOPE_MODE ${exports.appConfig.scopeMode})`);
        });
    }
})();
exports.default = app;
//# sourceMappingURL=index.js.map