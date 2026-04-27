/**
 * ROF CRM API
 * Node.js + Express RESTful API
 * PostgreSQL database, Bull/Redis for async jobs, JWT authentication
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

// Route imports
import consumerRoutes from './routes/consumers';
import unitRoutes from './routes/units';
import allocationRoutes from './routes/allocations';
import paymentRoutes from './routes/payments';
import documentRoutes from './routes/documents';
import communicationRoutes from './routes/communications';
import userRoutes from './routes/users';
import reportRoutes from './routes/reports';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Database connection pool
export const db = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'rof_crm',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin || '*';
  res.header('Access-Control-Allow-Origin', origin);
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

const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // Development: Allow mock token
  if (token === 'mock-jwt-token') {
    req.userId = '1';
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
// HEALTH CHECK
// ============================================

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// API ROUTES
// ============================================

app.use('/api/consumers', authenticateToken, consumerRoutes);
app.use('/api/units', authenticateToken, unitRoutes);
app.use('/api/allocations', authenticateToken, allocationRoutes);
app.use('/api/payments', authenticateToken, paymentRoutes);
app.use('/api/documents', authenticateToken, documentRoutes);
app.use('/api/communications', authenticateToken, communicationRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/reports', authenticateToken, reportRoutes);

// ============================================
// ERROR HANDLING
// ============================================

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
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
