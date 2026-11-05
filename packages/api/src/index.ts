/**
 * ROF CRM API
 * Node.js + Express RESTful API
 * PostgreSQL database, Bull/Redis for async jobs, JWT authentication
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import jwt from 'jsonwebtoken';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';

// Route imports
import consumerRoutes from './routes/consumers.js';
import photoRoutes from './routes/photos.js';
import unitRoutes from './routes/units.js';
import allocationRoutes from './routes/allocations.js';
import paymentRoutes from './routes/payments.js';
import demandRoutes from './routes/demands.js';
import receiptRoutes from './routes/receipts.js';
import documentRoutes from './routes/documents.js';
import communicationRoutes from './routes/communications.js';
import userRoutes from './routes/users.js';
import reportRoutes from './routes/reports.js';
import milestonesRoutes from './routes/milestones.js';
import reconciliationRoutes from './routes/reconciliation.js';
import smtpRoutes from './routes/smtp_config.js';
import faqRoutes from './routes/faq.js';
import tasksRoutes from './routes/tasks.js';
import automationRoutes from './routes/automation.js';
import emailTemplatesRoutes from './routes/email-templates.js';
import brokersRoutes from './routes/brokers.js';
import parkingRoutes from './routes/parking.js';
import importRoutes from './routes/import.js';
import projectsRoutes from './routes/projects.js';
import brokerSetupRoutes from './routes/broker_setup.js';
import inventoryHoldRoutes from './routes/inventory_hold.js';
import dashboardRoutes from './routes/dashboard.js';
import masterRoutes from './routes/master.js';
import bookingRoutes from './routes/booking.js';
import bookingDocumentsRoutes from './routes/booking_documents.js';
import employeesRoutes from './routes/employees.js';
import addonChargesRoutes from './routes/addon-charges.js';
import chargeMasterRoutes from './routes/charge-master.js';
import plcChargesRoutes from './routes/plc-charges.js';
import surrenderRoutes from './routes/surrender.js';
import transfersRoutes from './routes/transfers.js';
import registryRoutes from './routes/registry.js';
import loansRoutes from './routes/loans.js';
import receiptProcessRoutes from './routes/receipt-process.js';
import financialOpsRoutes from './routes/financial-ops.js';
import outgoingPaymentsRoutes from './routes/outgoing-payments.js';
import testDataImportRoutes from './routes/test-data-import.js';
import rolesRoutes from './routes/roles.js';
import companiesRoutes from './routes/companies.js';
import customLettersRoutes from './routes/custom-letters.js';
import gstConfigRoutes from './routes/gst-configuration.js';
import { requirePermission, hasPermission } from './middleware/rbac.js';
import { logAudit } from './middleware/auditLogger.js';
import { cleanIp } from './utils/security.js';
import { loadAppConfig } from './utils/app-config.js';
// import { responseFormatter } from './middleware/responseFormatter.js'; // DISABLED: Using route-level transformations instead

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;
const isDev = process.env.NODE_ENV !== 'production';

// Auth config. No fallback secret: a missing JWT_SECRET must stop the server, not sign tokens with a known value.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET is not set. Refusing to start.');
// Which deployment this is (APP_ENV) and how project scope is applied (SCOPE_MODE); a bad combination stops the start.
export const appConfig = loadAppConfig();
// Dev shortcuts (mock token, passwordless login) need an explicit opt-in on top of a non-production NODE_ENV.
const DEV_AUTH = isDev && process.env.ALLOW_DEV_AUTH === 'true';
// Behind the host's proxy (Vercel), req.ip must be the client address or every user shares one rate-limit bucket.
if (!isDev) app.set('trust proxy', 1);

import { db, scopeStore } from './db/pool';
import { runMigrations } from './db/migrations';
export { db } from './db/pool';

// ============================================
// SECURITY HEADERS (helmet)
// ============================================

app.use(helmet({
  contentSecurityPolicy: false, // SPA serves from same origin; CSP configured separately if needed
  crossOriginEmbedderPolicy: false,
}));

// ============================================
// RATE LIMITING
// ============================================

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 1000 : 10,    // relax in dev so mock-token testing is unaffected
  message: { error: 'Too many login attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isDev ? Number(process.env.API_RATE_MAX || 5000) : 300,   // API_RATE_MAX: the click-through test sends more than 5000 a minute
  message: { error: 'Too many requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================
// BODY PARSING
// ============================================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// CORS
// ============================================

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:5173'];

app.use((req: Request, res: Response, next: NextFunction) => {
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

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

export interface AuthRequest extends Request {
  userId?: string;
  userName?: string;
  userRole?: string;   // role the API checks permissions against (a custom role resolves to its base role)
  roleName?: string;   // the role name stored on the user
  companyIds?: string[] | null;   // the companies this login is limited to (user_company_access); null = no company limit
  authorizedPrint?: boolean;      // users.authorized_print; only an explicit true counts (middleware/printDownload.ts)
  authorizedDownload?: boolean;   // users.authorized_download
  userPermissions?: string[];
  unitStatusFilter?: string[] | null;
}

export interface DocumentFieldOverride {
  id: string;
  document_id: string;
  field_key: string;
  field_label: string;
  section: string;
  original_value: string;
  current_value: string;
  value_type: 'text' | 'number' | 'date' | 'percentage' | 'currency';
  edit_reason: string;
  edited_by_user_id: string;
  edited_at: string;
  is_active: boolean;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  html_content: string;
  created_by_user_id: string;
  created_at: string;
  edit_reason: string;
  fields_changed: Array<{
    field_key: string;
    field_label: string;
    old_value: string;
    new_value: string;
  }>;
  is_original: boolean;
}

// Role, active flag and token_version are read from the DB (cached briefly) so that
// deactivation, role changes and logout take effect without waiting for the JWT to expire.
const AUTH_CACHE_MS = 15_000;
const authUserCache = new Map<string, { at: number; user: { role: string; eff_role: string | null; company_ids: string[] | null; authorized_print: boolean | null; authorized_download: boolean | null; is_active: boolean; token_version: number; ip_rules: string[] | null; project_scope: string | null } | null }>();

export const invalidateAuthUser = (userId: string) => { authUserCache.delete(userId); };
export const clearAuthUserCache = () => authUserCache.clear(); // after a role definition changes

const loadAuthUser = async (userId: string) => {
  const hit = authUserCache.get(userId);
  if (hit && Date.now() - hit.at < AUTH_CACHE_MS) return hit.user;
  const r = await db.query(
    `SELECT u.role,
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
       FROM users u WHERE u.id = $1`,
    [userId]
  );
  const user = r.rows[0] || null;
  authUserCache.set(userId, { at: Date.now(), user });
  if (authUserCache.size > 2000) authUserCache.clear();
  return user;
};

// IP security: a user with it switched on may only work from the addresses on their allow list
export const clientIp = (req: Request) => cleanIp(req.ip) ?? '';
// Stored addresses are compared in canonical form, so a row saved in another spelling still matches
const ipBlocked = (user: { ip_rules: string[] | null } | null, req: Request) => !!user?.ip_rules && !user.ip_rules.map((a) => cleanIp(a) ?? a).includes(clientIp(req));
// UR-006: a blocked address looks like any other failed sign-in from outside; the real reason goes to the audit log only
const blockedLogged = new Map<string, number>(); // one audit row a minute per login and channel, so a retrying client cannot flood the log
const auditBlocked = (userId: string, req: Request, channel: 'login' | 'request') => {
  const k = userId + channel; const now = Date.now();
  if ((blockedLogged.get(k) ?? 0) > now - 60_000) return;
  blockedLogged.set(k, now); if (blockedLogged.size > 2000) blockedLogged.clear();
  logAudit(db, userId, 'auth_blocked', 'auth', userId, {}, { ip: clientIp(req), reason: 'ip_not_allowed', channel }).catch(() => {});
};

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  // ?token= is accepted for GET only (window.open() navigations such as letters and receipts)
  const queryToken = req.method === 'GET' ? (req.query.token as string) : null;
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

  let decoded: any;
  try {
    decoded = jwt.verify(token, JWT_SECRET!, { algorithms: ['HS256'] });
  } catch {
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
    if (ipBlocked(user, req)) { auditBlocked(decoded.userId, req, 'request'); return res.status(401).json({ error: 'Authentication required' }); }
    req.userId = decoded.userId;
    req.userName = decoded.name || decoded.email || 'Unknown';
    req.userRole = user.eff_role ?? undefined;
    req.roleName = user.role;
    req.companyIds = user.eff_role !== 'super_admin' && user.company_ids && user.company_ids.length ? user.company_ids : null;
    req.authorizedPrint = user.authorized_print === true;
    req.authorizedDownload = user.authorized_download === true;
    if (user.eff_role !== 'super_admin' && user.project_scope) scopeStore.enterWith({ projectIds: user.project_scope });
    req.userPermissions = decoded.permissions || [];
    next();
  } catch (err) {
    console.error('Auth lookup failed:', err);
    return res.status(503).json({ error: 'Authentication service unavailable' });
  }
};

// ============================================
// RBAC HELPER — maps HTTP method → action
// ============================================

const rbac = (resource: string) => (req: AuthRequest, res: Response, next: NextFunction) => {
  const methodToAction: Record<string, string> = {
    GET: 'view', POST: 'create', PATCH: 'edit', PUT: 'edit', DELETE: 'delete',
  };
  const action = methodToAction[req.method] || 'view';
  // Every signed-in user may read the name list used by pick lists
  if (resource === 'users' && req.method === 'GET' && req.path === '/directory') return next();
  // Every signed-in user may read their own profile and process permissions
  if (resource === 'users' && req.method === 'GET' && req.path === '/me') return next();
  // Every signed-in user may change their own password (the route itself checks the current password)
  if (resource === 'users' && req.method === 'POST' && req.path === `/${req.userId}/change-password`) return next();
  return requirePermission(resource, action)(req, res, next);
};

// ============================================
// AUTO AUDIT MIDDLEWARE
// Intercepts mutating responses and writes to audit_logs
// ============================================

const autoAudit = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
    return next();
  }

  const origJson = res.json.bind(res);
  res.json = (data: any) => {
    if (data?.success && data?.data?.id && !res.locals.auditLogged) {
      const pathParts = req.path.split('/').filter(Boolean);
      const resourceType = pathParts[0] || 'unknown';
      const action = req.method === 'POST' ? 'create' : req.method === 'DELETE' ? 'delete' : 'update';
      logAudit(db, req.userId || null, action as any, resourceType, data.data.id, {}, data.data);
    }
    return origJson(data);
  };
  next();
};

// ============================================
// STATIC FILES — Static HTML frontend
// ============================================

const webPublicDir = path.join(__dirname, '../../web/public');
app.use(express.static(webPublicDir));

// Serve uploaded consumer photos
const uploadsDir = path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsDir));
app.use('/api/photos', photoRoutes);

// ============================================
// HEALTH CHECK
// ============================================

app.get('/api/health', (req: Request, res: Response) => {
  // commit lets the deploy pipeline confirm which version is live (DEPLOY_SHA is set by the pipeline's deploy)
  res.json({ status: 'ok', timestamp: new Date().toISOString(), commit: (process.env.DEPLOY_SHA || process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || null });
});

// ============================================
// PUBLIC ENDPOINTS (No Auth Required)
// ============================================

app.get('/api/import/template/units', (req: Request, res: Response) => {
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
const LOGIN_MAX_FAILS = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000;
const loginFailures = new Map<string, { count: number; until: number }>();

// Tokens must never be cached by browsers or proxies
app.use('/api/auth', (req: Request, res: Response, next: NextFunction) => { res.setHeader('Cache-Control', 'no-store'); next(); });

// Opening a letter, receipt or applicant file in a new tab needs a link: valid 2 minutes, for that one page only
app.post('/api/auth/link-token', authenticateToken, (req: AuthRequest, res: Response) => {
  const path = (req.body || {}).path;
  if (typeof path !== 'string' || !/^\/api\/[A-Za-z0-9/_.\-]+$/.test(path) || path.includes('..')) return res.status(400).json({ error: 'path is not valid' });
  const { iat, exp, purpose, p, ...claims } = jwt.decode(req.headers['authorization']!.split(' ')[1]) as any;
  res.json({ token: jwt.sign({ ...claims, purpose: 'link', p: path }, JWT_SECRET!, { algorithm: 'HS256', expiresIn: '2m' }) });
});

app.post('/api/auth/login', authLimiter, async (req: Request, res: Response) => {
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
  const fails = loginFailures.get(failKey);
  if (fails && fails.until > Date.now()) {
    return res.status(429).json({ error: 'Too many failed attempts. Try again in 15 minutes.' });
  }
  if (fails && fails.until && fails.until <= Date.now()) loginFailures.delete(failKey);
  if (loginFailures.size > 5000) loginFailures.clear();

  try {
    const result = await db.query(
      `SELECT id, name, email, role, password_hash, is_active, COALESCE(token_version, 0) AS token_version FROM users WHERE lower(email) = $1 LIMIT 1`,
      [email.toLowerCase().trim()]
    );

    const user = result.rows[0];

    // Always return same error to prevent email enumeration
    if (!user || user.is_active === false) {
      await bcrypt.compare(password, DUMMY_HASH);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    let validPassword = false;
    if (!user.password_hash) {
      // No password set: only with the explicit dev opt-in
      validPassword = DEV_AUTH;
    } else if (user.password_hash.startsWith('$2')) {
      // bcrypt hash
      validPassword = await bcrypt.compare(password, user.password_hash);
    } else {
      // Legacy base64 placeholder — compare and migrate on success
      const base64Attempt = Buffer.from(password).toString('base64');
      validPassword = user.password_hash === base64Attempt || user.password_hash === password;

      if (validPassword) {
        // Silently migrate to bcrypt on successful login
        const newHash = await bcrypt.hash(password, 12);
        db.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [newHash, user.id]).catch(() => {});
      }
    }

    if (!validPassword) {
      const f = loginFailures.get(failKey) || { count: 0, until: 0 };
      f.count += 1;
      if (f.count >= LOGIN_MAX_FAILS) f.until = Date.now() + LOGIN_LOCK_MS;
      loginFailures.set(failKey, f);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    loginFailures.delete(failKey);
    if (ipBlocked(await loadAuthUser(user.id), req)) {
      auditBlocked(user.id, req, 'login');
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    db.query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [user.id]).catch(() => {});
    logAudit(db, user.id, 'login', 'auth', user.id, {}, { ip: clientIp(req) }).catch(() => {});
    const token = jwt.sign(
      { userId: user.id, email: user.email, name: user.name, role: user.role, tv: user.token_version },
      JWT_SECRET!,
      { expiresIn: '8h', algorithm: 'HS256' }
    );

    return res.json({
      success: true,
      token,
      data: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Server side sign out: bumping token_version invalidates every token issued so far for this user
app.post('/api/auth/logout', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userId && req.userId !== 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') {
      await db.query(`UPDATE users SET token_version = COALESCE(token_version, 0) + 1 WHERE id = $1`, [req.userId]);
      invalidateAuthUser(req.userId);
    }
    return res.json({ success: true });
  } catch (err) {
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

let lastMigrationLog: string[] = [];

const adminDiagnostics = [
  apiLimiter,
  authenticateToken,
  (req: AuthRequest, res: Response, next: NextFunction) => (req.userRole === 'super_admin' ? next() : res.status(403).json({ error: 'Forbidden' })),
];

app.get('/api/health/debug', ...adminDiagnostics, async (req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    lastMigrationLog,
    databaseUrl: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
  });
});

app.get('/api/health/templates', ...adminDiagnostics, async (req: AuthRequest, res: Response) => {
  try {
    const fs = require('fs');
    const path = require('path');
    console.log('[HEALTH] Templates diagnostic endpoint called');

    // Check if template files exist
    const templateFiles = [
      { name: 'ats_rof_alante.html', path: path.join(__dirname, 'templates/legal/ats_rof_alante.html') },
      { name: 'conveyance_rof_alante.html', path: path.join(__dirname, 'templates/legal/conveyance_rof_alante.html') },
    ];

    const filesStatus: Record<string, boolean> = {};
    for (const file of templateFiles) {
      filesStatus[file.name] = fs.existsSync(file.path);
      console.log(`[HEALTH] File ${file.name}: ${filesStatus[file.name] ? 'EXISTS' : 'MISSING'} at ${file.path}`);
    }

    // Which templates exist (type, project, name, how many). The stored template text is never returned here.
    const dbRes = await db.query(`
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
  } catch (error) {
    console.error('[HEALTH] Diagnostic failed:', error);
    res.status(500).json({ success: false, error: 'Diagnostic failed' });
  }
});

// ============================================
// API ROUTES (with auth + RBAC + auto-audit + response formatter)
// ============================================

app.use('/api', apiLimiter);
app.use('/api', autoAudit);

app.use('/api/consumers',      authenticateToken, rbac('consumers'),      consumerRoutes);
app.use('/api/units',          authenticateToken, rbac('units'),          unitRoutes);
app.use('/api/allocations',    authenticateToken, rbac('allocations'),    allocationRoutes);
app.use('/api/payments',       authenticateToken, rbac('payments'),       demandRoutes);
app.use('/api/payments',       authenticateToken, rbac('payments'),       receiptRoutes);
app.use('/api/payments',       authenticateToken, rbac('payments'),       paymentRoutes);
app.use('/api/documents',      authenticateToken, rbac('documents'),      documentRoutes);
// The calling screen is also for finance (permission "calling"): they may open the list, the status codes and log a call
app.use('/api/communications', authenticateToken, (req: AuthRequest, res: Response, next: NextFunction) => {
  const calling = /^\/(calling-list|status-codes)$/.test(req.path) && req.method === 'GET' || req.path === '/log-call' && req.method === 'POST';
  if (calling && hasPermission(req.userRole, 'calling', req.method === 'GET' ? 'view' : 'create')) return next();
  return rbac('communications')(req, res, next);
}, communicationRoutes);
app.use('/api/users',          authenticateToken, rbac('users'),          userRoutes);
app.use('/api/reports',        authenticateToken, rbac('reports'),        reportRoutes);
app.use('/api/milestones',     authenticateToken, rbac('payments'),       milestonesRoutes);
app.use('/api/reconciliation', authenticateToken, rbac('payments'),       reconciliationRoutes);
app.use('/api/smtp-configs',   authenticateToken, rbac('smtp_configs'),   smtpRoutes);
// Staff need communications access for the FAQ; anyone with it may still vote on an article (POST feedback), as before
app.use('/api/faq', authenticateToken, (req: AuthRequest, res: Response, next: NextFunction) => (/^\/articles\/[^/]+\/feedback$/.test(req.path) ? next() : rbac('communications')(req, res, next)), faqRoutes);
app.use('/api/tasks',         authenticateToken, rbac('consumers'),       tasksRoutes);
app.use('/api/automation',    authenticateToken, rbac('communications'),  automationRoutes);
app.use('/api/email-templates', authenticateToken, rbac('communications'), emailTemplatesRoutes);
// Brokers: registering and approving needs consumers rights; the commission list and its payment are payments rights (Accounts pay them)
app.use('/api/brokers',       authenticateToken, (req: AuthRequest, res: Response, next: NextFunction) => rbac(req.path.startsWith('/commission') ? 'payments' : 'consumers')(req, res, next), brokersRoutes);
app.use('/api/parking',       authenticateToken, rbac('units'),           parkingRoutes);
app.use('/api/import',        authenticateToken, rbac('units'),           importRoutes);
app.use('/api/projects',      authenticateToken, rbac('units'),           projectsRoutes);
app.use('/api/broker-setup',  authenticateToken, rbac('broker_setup'),    brokerSetupRoutes);
app.use('/api/inventory-hold',authenticateToken, rbac('inventory_hold'),  inventoryHoldRoutes);
app.use('/api/dashboard',     authenticateToken, rbac('payments'),       dashboardRoutes);
app.use('/api/master',        authenticateToken,                          masterRoutes);
app.use('/api/booking',           authenticateToken,                      bookingRoutes);
app.use('/api/booking-documents', authenticateToken,                      bookingDocumentsRoutes);
app.use('/api/employees', authenticateToken, rbac('users'), employeesRoutes);
app.use('/api/addon-charges',       authenticateToken, addonChargesRoutes);
app.use('/api/charge-master',       authenticateToken, chargeMasterRoutes);
app.use('/api/plc-charges',         authenticateToken, plcChargesRoutes);
app.use('/api/gst-configuration',   authenticateToken, gstConfigRoutes);
app.use('/api/surrender', authenticateToken, rbac('allocations'), surrenderRoutes);
app.use('/api/transfers', authenticateToken, rbac('allocations'), transfersRoutes);
app.use('/api/registry', authenticateToken, rbac('allocations'), registryRoutes);
app.use('/api/loans', authenticateToken, rbac('consumers'), loansRoutes);
app.use('/api/payments', authenticateToken, rbac('payments'), receiptProcessRoutes);
app.use('/api/payments', authenticateToken, rbac('payments'), financialOpsRoutes);
app.use('/api/payments', authenticateToken, rbac('payments'), outgoingPaymentsRoutes);
// Leftover read-only check of the test data import: it lists customers and projects, super_admin only
app.use('/api/test-data', authenticateToken, (req: AuthRequest, res: Response, next: NextFunction) => (req.userRole === 'super_admin' ? next() : res.status(403).json({ error: 'Forbidden' })), testDataImportRoutes);
app.use('/api/roles',          authenticateToken, rolesRoutes);
app.use('/api/companies',      authenticateToken, companiesRoutes);
app.use('/api/custom-letters', authenticateToken, rbac('documents'), customLettersRoutes);

// An API path no route handled answers in JSON, like every other API error
app.use('/api', (req: Request, res: Response) => { res.status(404).json({ error: 'Not found' }); });

// ============================================
// SPA FALLBACK
// ============================================

app.get(/^(?!\/api\/).*/, (req: Request, res: Response) => {
  res.sendFile(path.join(webPublicDir, 'index.html'));
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  // Body parser errors (bad JSON, body too large) are client errors, not server errors
  const clientStatus = (err as any).status || (err as any).statusCode;
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

  // On Vercel the exported app is the request handler; only bind a port elsewhere
  if (!process.env.VERCEL) {
    app.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`ROF CRM API running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'} (APP_ENV ${appConfig.appEnv ?? 'not set'}, SCOPE_MODE ${appConfig.scopeMode})`);
    });
  }
})();

export default app;
