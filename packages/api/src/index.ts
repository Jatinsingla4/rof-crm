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
import surrenderRoutes from './routes/surrender.js';
import transfersRoutes from './routes/transfers.js';
import registryRoutes from './routes/registry.js';
import loansRoutes from './routes/loans.js';
import receiptProcessRoutes from './routes/receipt-process.js';
import financialOpsRoutes from './routes/financial-ops.js';
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
app.use('/api/gst-configuration',   authenticateToken, gstConfigRoutes);
app.use('/api/surrender', authenticateToken, surrenderRoutes);
app.use('/api/transfers', authenticateToken, transfersRoutes);
app.use('/api/registry', authenticateToken, registryRoutes);
app.use('/api/loans', authenticateToken, loansRoutes);
app.use('/api/payments', authenticateToken, receiptProcessRoutes);
app.use('/api/payments', authenticateToken, financialOpsRoutes);
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

export default app;
