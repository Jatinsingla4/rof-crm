/**
 * Brokers Routes
 * Broker registration, listing, and commission management
 */

import { Router, Response, NextFunction } from 'express';
import { db } from '../index';
import { AuthRequest } from '../index';

const router = Router();

// GET /api/brokers/commission
router.get('/commission', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId, brokerId, status, page = 1, pageSize = 100 } = req.query;

    let query = `
      SELECT bc.id, bc.broker_id, b.name as broker_name, b.firm_name,
             bc.consumer_id, c.name as consumer_name,
             bc.project_id, p.name as project_name,
             bc.unit_id, u.unit_number,
             bc.commission_amount_inr, bc.status, bc.paid_at, bc.created_at
      FROM broker_commissions bc
      LEFT JOIN brokers b ON bc.broker_id = b.id
      LEFT JOIN consumers c ON bc.consumer_id = c.id
      LEFT JOIN projects p ON bc.project_id = p.id
      LEFT JOIN units u ON bc.unit_id = u.id
      WHERE 1=1`;
    const params: any[] = [];

    if (brokerId) { query += ` AND bc.broker_id = $${params.length + 1}`; params.push(brokerId); }
    if (projectId) { query += ` AND bc.project_id = $${params.length + 1}`; params.push(projectId); }
    if (status) { query += ` AND bc.status = $${params.length + 1}`; params.push(status); }

    query += ` ORDER BY bc.created_at DESC LIMIT ${pageSize} OFFSET ${((page as number) - 1) * (pageSize as number)}`;

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/brokers/commission/:id
router.patch('/commission/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const result = await db.query(
      `UPDATE broker_commissions
       SET status = COALESCE($1, status),
           notes = COALESCE($2, notes),
           paid_at = CASE WHEN $1 = 'paid' THEN NOW() ELSE paid_at END
       WHERE id = $3
       RETURNING id, status, paid_at`,
      [status || null, notes || null, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Commission record not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// GET /api/brokers
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, search, page = 1, pageSize = 100 } = req.query;

    let query = `
      SELECT b.id, b.name, b.firm_name, b.mobile, b.email, b.rera_number,
             b.status, b.commission_pct, b.total_referrals, b.created_at,
             COALESCE(SUM(bc.commission_amount_inr) FILTER (WHERE bc.status = 'paid'), 0) as total_paid_inr,
             COALESCE(SUM(bc.commission_amount_inr) FILTER (WHERE bc.status = 'pending'), 0) as total_pending_inr
      FROM brokers b
      LEFT JOIN broker_commissions bc ON b.id = bc.broker_id
      WHERE 1=1`;
    const params: any[] = [];

    if (status) { query += ` AND b.status = $${params.length + 1}`; params.push(status); }
    if (search) {
      query += ` AND (b.name ILIKE $${params.length + 1} OR b.mobile ILIKE $${params.length + 1} OR b.firm_name ILIKE $${params.length + 1})`;
      params.push(`%${search}%`);
    }

    query += ` GROUP BY b.id ORDER BY b.created_at DESC LIMIT ${pageSize} OFFSET ${((page as number) - 1) * (pageSize as number)}`;

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/brokers
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, firmName, mobile, email, reraNumber, pan, address, commissionPct = 2.00 } = req.body;

    if (!name || !mobile) return res.status(400).json({ error: 'name and mobile are required' });

    const result = await db.query(
      `INSERT INTO brokers (name, firm_name, mobile, email, rera_number, pan, address, commission_pct, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9)
       RETURNING id, name, firm_name, mobile, status, commission_pct, created_at`,
      [name, firmName || null, mobile, email || null, reraNumber || null, pan || null,
       address || null, commissionPct, req.userId]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

export default router;
