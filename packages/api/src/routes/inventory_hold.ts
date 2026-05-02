/**
 * Inventory Hold Routes (Governance)
 */
import { Router, Response, NextFunction } from 'express';
import { db } from '../index';
import { AuthRequest } from '../index';

const router = Router();

// GET /api/inventory-hold
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status = 'active' } = req.query;
    let query = `
      SELECT uh.*, u.unit_number, u.bhk_type, u.floor, t.tower_name, p.name as project_name, b.firm_name as broker_firm_name
      FROM unit_holds uh
      JOIN units u ON uh.unit_id = u.id
      JOIN towers t ON u.tower_id = t.id
      JOIN projects p ON u.project_id = p.id
      JOIN brokers b ON uh.broker_id = b.id
    `;
    const params: any[] = [];
    if (status && status !== 'all') {
      query += ` WHERE uh.status = $1`;
      params.push(status);
    }
    query += ` ORDER BY uh.held_at DESC`;
    
    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/inventory-hold
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { unitId, brokerId, clientName, clientMobile, holdHours = 24, notes } = req.body;

    if (!unitId || !brokerId) return res.status(400).json({ error: 'unitId and brokerId are required' });

    // Begin transaction
    await db.query('BEGIN');

    // Check if unit is available
    const unitRes = await db.query(`SELECT status FROM units WHERE id = $1 FOR UPDATE`, [unitId]);
    if (unitRes.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Unit not found' });
    }
    if (unitRes.rows[0].status !== 'available') {
      await db.query('ROLLBACK');
      return res.status(400).json({ error: `Unit cannot be held. Current status: ${unitRes.rows[0].status}` });
    }

    // Insert hold
    const holdRes = await db.query(
      `INSERT INTO unit_holds (unit_id, broker_id, client_name, client_mobile, expires_at, status, notes, created_by)
       VALUES ($1, $2, $3, $4, NOW() + interval '1 hour' * $5, 'active', $6, $7)
       RETURNING *`,
      [unitId, brokerId, clientName, clientMobile, holdHours, notes, req.userId]
    );

    // Update unit status
    await db.query(`UPDATE units SET status = 'held', status_changed_at = NOW() WHERE id = $1`, [unitId]);

    // Insert history
    await db.query(
      `INSERT INTO unit_status_history (unit_id, previous_status, new_status, changed_by_user_id, reason)
       VALUES ($1, 'available', 'held', $2, 'Unit held by broker')`,
      [unitId, req.userId]
    );

    await db.query('COMMIT');
    res.status(201).json({ success: true, data: holdRes.rows[0] });
  } catch (error) {
    await db.query('ROLLBACK');
    next(error);
  }
});

// POST /api/inventory-hold/:id/unhold
router.post('/:id/unhold', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    await db.query('BEGIN');

    const holdRes = await db.query(`SELECT unit_id, status FROM unit_holds WHERE id = $1 FOR UPDATE`, [id]);
    if (holdRes.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Hold record not found' });
    }
    if (holdRes.rows[0].status !== 'active') {
      await db.query('ROLLBACK');
      return res.status(400).json({ error: 'Hold is not active' });
    }

    const unitId = holdRes.rows[0].unit_id;

    // Release hold
    await db.query(`UPDATE unit_holds SET status = 'cancelled' WHERE id = $1`, [id]);
    
    // Update unit status back to available
    await db.query(`UPDATE units SET status = 'available', status_changed_at = NOW() WHERE id = $1`, [unitId]);

    // Insert history
    await db.query(
      `INSERT INTO unit_status_history (unit_id, previous_status, new_status, changed_by_user_id, reason)
       VALUES ($1, 'held', 'available', $2, 'Hold manually cancelled')`,
      [unitId, req.userId]
    );

    await db.query('COMMIT');
    res.json({ success: true, message: 'Unit hold cancelled and unit is now available' });
  } catch (error) {
    await db.query('ROLLBACK');
    next(error);
  }
});

export default router;
