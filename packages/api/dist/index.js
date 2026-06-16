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
exports.authenticateToken = exports.db = void 0;
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
// Route imports
const consumers_js_1 = __importDefault(require("./routes/consumers.js"));
const units_js_1 = __importDefault(require("./routes/units.js"));
const allocations_js_1 = __importDefault(require("./routes/allocations.js"));
const payments_js_1 = __importDefault(require("./routes/payments.js"));
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
const operations_js_1 = __importDefault(require("./routes/operations.js"));
const addon_charges_js_1 = __importDefault(require("./routes/addon-charges.js"));
const transfers_js_1 = __importDefault(require("./routes/transfers.js"));
const registry_js_1 = __importDefault(require("./routes/registry.js"));
const loans_js_1 = __importDefault(require("./routes/loans.js"));
const receipt_process_js_1 = __importDefault(require("./routes/receipt-process.js"));
const financial_ops_js_1 = __importDefault(require("./routes/financial-ops.js"));
const test_data_import_js_1 = __importDefault(require("./routes/test-data-import.js"));
const roles_js_1 = __importDefault(require("./routes/roles.js"));
const companies_js_1 = __importDefault(require("./routes/companies.js"));
const custom_letters_js_1 = __importDefault(require("./routes/custom-letters.js"));
const rbac_js_1 = require("./middleware/rbac.js");
const auditLogger_js_1 = require("./middleware/auditLogger.js");
// import { responseFormatter } from './middleware/responseFormatter.js'; // DISABLED: Using route-level transformations instead
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
const isDev = process.env.NODE_ENV !== 'production';
const pool_1 = require("./db/pool");
const migrations_1 = require("./db/migrations");
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
    max: isDev ? 5000 : 300,
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
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    // Accept ?token= query param as fallback for window.open() navigations (e.g. receipt HTML)
    const token = (authHeader && authHeader.split(' ')[1]) || req.query.token || null;
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    // Development: Allow mock token
    if (isDev && token === 'mock-jwt-token') {
        req.userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
        req.userName = 'Test User';
        req.userRole = 'super_admin';
        req.userPermissions = [
            'view_consumers', 'create_consumers', 'edit_consumers', 'delete_consumers',
            'view_units', 'create_units', 'edit_units', 'delete_units',
            'view_allotments', 'create_allotments', 'edit_allotments', 'cancel_allotments',
            'view_payments', 'record_payments', 'view_overdue', 'calculate_interest',
            'view_documents', 'generate_documents', 'upload_documents', 'delete_documents',
            'view_communications', 'send_email', 'send_whatsapp', 'send_sms',
            'view_reports', 'export_reports',
            'manage_users', 'manage_roles', 'view_audit_logs',
        ];
        return next();
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'secret');
        req.userId = decoded.userId;
        req.userName = decoded.name || decoded.email || 'Unknown';
        req.userRole = decoded.role;
        req.userPermissions = decoded.permissions || [];
        next();
    }
    catch (err) {
        return res.status(403).json({ error: 'Invalid or expired token' });
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
        if (data?.success && data?.data?.id) {
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
// ============================================
// HEALTH CHECK
// ============================================
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// ============================================
// PUBLIC ENDPOINTS (No Auth Required)
// ============================================
app.get('/api/import/template/units', (req, res) => {
    const headers = 'tower,floor,unitNumber,bhkType,carpetAreaSqft,superAreaSqft,balconyAreaSqft,basePriceInr,totalPriceInr,facing\n';
    const example = 'GalleriaA,1,A-101,2BHK,650,750,100,5000000,5000000,North\n';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="units_import_template.csv"');
    res.send(headers + example);
});
// ============================================
// AUTH ENDPOINT
// ============================================
app.post('/api/auth/login', authLimiter, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }
    if (typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: 'Invalid input' });
    }
    try {
        const result = await pool_1.db.query(`SELECT id, name, email, role, password_hash, is_active FROM users WHERE email = $1 LIMIT 1`, [email.toLowerCase().trim()]);
        const user = result.rows[0];
        // Always return same error to prevent email enumeration
        if (!user || user.is_active === false) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        let validPassword = false;
        if (!user.password_hash) {
            // No password set — allow login in dev only
            validPassword = isDev;
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
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        const secret = process.env.JWT_SECRET || 'secret';
        const token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email, name: user.name, role: user.role }, secret, { expiresIn: '8h' });
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
// ============================================
// PUBLIC HEALTH / DIAGNOSTIC ENDPOINTS (before auth)
// ============================================
let lastMigrationLog = [];
app.get('/api/health/debug', async (req, res) => {
    res.json({
        success: true,
        timestamp: new Date().toISOString(),
        lastMigrationLog,
        databaseUrl: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
    });
});
app.get('/api/health/templates', async (req, res) => {
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
        // Check database templates
        const dbRes = await pool_1.db.query(`
      SELECT
        document_type,
        project_id,
        name,
        body_html,
        COUNT(*) as count
      FROM document_templates
      WHERE document_type IN ('buyer_builder_agreement', 'conveyance_deed')
      GROUP BY document_type, project_id, name, body_html
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
        res.status(500).json({
            success: false,
            error: error.message,
        });
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
app.use('/api/payments', exports.authenticateToken, rbac('payments'), payments_js_1.default);
app.use('/api/documents', exports.authenticateToken, rbac('documents'), documents_js_1.default);
app.use('/api/communications', exports.authenticateToken, rbac('communications'), communications_js_1.default);
app.use('/api/users', exports.authenticateToken, rbac('users'), users_js_1.default);
app.use('/api/reports', exports.authenticateToken, rbac('reports'), reports_js_1.default);
app.use('/api/milestones', exports.authenticateToken, rbac('payments'), milestones_js_1.default);
app.use('/api/reconciliation', exports.authenticateToken, rbac('payments'), reconciliation_js_1.default);
app.use('/api/smtp-configs', exports.authenticateToken, rbac('smtp_configs'), smtp_config_js_1.default);
app.use('/api/faq', exports.authenticateToken, faq_js_1.default);
app.use('/api/tasks', exports.authenticateToken, rbac('consumers'), tasks_js_1.default);
app.use('/api/automation', exports.authenticateToken, rbac('reports'), automation_js_1.default);
app.use('/api/brokers', exports.authenticateToken, rbac('consumers'), brokers_js_1.default);
app.use('/api/parking', exports.authenticateToken, rbac('units'), parking_js_1.default);
app.use('/api/import', exports.authenticateToken, rbac('units'), import_js_1.default);
app.use('/api/projects', exports.authenticateToken, rbac('units'), projects_js_1.default);
app.use('/api/broker-setup', exports.authenticateToken, rbac('broker_setup'), broker_setup_js_1.default);
app.use('/api/inventory-hold', exports.authenticateToken, rbac('inventory_hold'), inventory_hold_js_1.default);
app.use('/api/dashboard', exports.authenticateToken, dashboard_js_1.default);
app.use('/api/master', exports.authenticateToken, master_js_1.default);
app.use('/api/booking', exports.authenticateToken, booking_js_1.default);
app.use('/api/booking-documents', exports.authenticateToken, booking_documents_js_1.default);
app.use('/api/employees', exports.authenticateToken, employees_js_1.default);
app.use('/api/operations', exports.authenticateToken, operations_js_1.default);
app.use('/api/addon-charges', exports.authenticateToken, addon_charges_js_1.default);
app.use('/api/transfers', exports.authenticateToken, transfers_js_1.default);
app.use('/api/registry', exports.authenticateToken, registry_js_1.default);
app.use('/api/loans', exports.authenticateToken, loans_js_1.default);
app.use('/api/payments', exports.authenticateToken, receipt_process_js_1.default);
app.use('/api/payments', exports.authenticateToken, financial_ops_js_1.default);
app.use('/api/test-data', exports.authenticateToken, test_data_import_js_1.default);
app.use('/api/roles', exports.authenticateToken, roles_js_1.default);
app.use('/api/companies', exports.authenticateToken, companies_js_1.default);
app.use('/api/custom-letters', exports.authenticateToken, custom_letters_js_1.default);
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
    try {
        console.log('[STARTUP] Running migrations...');
        lastMigrationLog = await (0, migrations_1.runMigrations)();
        console.log('[STARTUP] ✅ Migrations completed successfully');
    }
    catch (error) {
        console.error('[STARTUP] ⚠️ Migration error:', error.message);
        lastMigrationLog.push(`[STARTUP] FAILED: ${error.message}`);
        console.error('[STARTUP] Continuing with app startup (migrations may not be critical)');
    }
    app.listen(Number(PORT), '0.0.0.0', () => {
        console.log(`ROF CRM API running on port ${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
})();
exports.default = app;
//# sourceMappingURL=index.js.map