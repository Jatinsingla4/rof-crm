/**
 * ROF CRM API
 * Node.js + Express RESTful API
 * PostgreSQL database, Bull/Redis for async jobs, JWT authentication
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Route imports
import consumerRoutes from './routes/consumers';
import unitRoutes from './routes/units';
import allocationRoutes from './routes/allocations';
import paymentRoutes from './routes/payments';
import documentRoutes from './routes/documents';
import communicationRoutes from './routes/communications';
import userRoutes from './routes/users';
import reportRoutes from './routes/reports';
import milestonesRoutes from './routes/milestones';
import reconciliationRoutes from './routes/reconciliation';
import faqRoutes from './routes/faq';
import tasksRoutes from './routes/tasks';
import automationRoutes from './routes/automation';
import brokersRoutes from './routes/brokers';
import parkingRoutes from './routes/parking';
import importRoutes from './routes/import';
import projectsRoutes from './routes/projects';
import dashboardRoutes from './routes/dashboard';
import masterRoutes from './routes/master';
import bookingRoutes from './routes/booking';
import employeesRoutes from './routes/employees';
import { requirePermission } from './middleware/rbac';
import { logAudit } from './middleware/auditLogger';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;
const isDev = process.env.NODE_ENV !== 'production';

// Database connection pool
export const db = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'rof_crm',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

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
  userRole?: string;
  userPermissions?: string[];
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // Development: Allow mock token
  if (isDev && token === 'mock-jwt-token') {
    req.userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
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
// STATIC FILES — SPA frontend
// ============================================

const webPublicDir = path.join(__dirname, '../../web/public');
app.use(express.static(webPublicDir));

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
// API ROUTES (with auth + RBAC + auto-audit)
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
app.use('/api/faq',            authenticateToken,                         faqRoutes);
app.use('/api/tasks',         authenticateToken, rbac('consumers'),       tasksRoutes);
app.use('/api/automation',    authenticateToken, rbac('reports'),         automationRoutes);
app.use('/api/brokers',       authenticateToken, rbac('consumers'),       brokersRoutes);
app.use('/api/parking',       authenticateToken, rbac('units'),           parkingRoutes);
app.use('/api/import',        authenticateToken, rbac('units'),           importRoutes);
app.use('/api/projects',      authenticateToken, rbac('units'),           projectsRoutes);
app.use('/api/dashboard',     authenticateToken,                          dashboardRoutes);
app.use('/api/master',        authenticateToken,                          masterRoutes);
app.use('/api/booking',       authenticateToken,                          bookingRoutes);
app.use('/api/employees',     authenticateToken,                          employeesRoutes);

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

app.listen(PORT, () => {
  console.log(`ROF CRM API running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
