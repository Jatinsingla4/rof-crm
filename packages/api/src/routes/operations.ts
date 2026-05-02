import { Router, Response, NextFunction } from 'express';
import { db } from '../index';
import { AuthRequest } from '../index';

const router = Router();

/**
 * UNIT SHIFTING LOGIC
 * Transfers a consumer from one unit to another within the same or different project.
 */
router.post('/unit-shift', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const client = await db.connect();
  try {
    const { consumerId, oldUnitId, newUnitId, reason } = req.body;
    
    if (!consumerId || !oldUnitId || !newUnitId) {
      return res.status(400).json({ error: 'consumerId, oldUnitId, and newUnitId are required' });
    }

    await client.query('BEGIN');

    // 1. Verify consumer's current allocation
    const allocationCheck = await client.query(
      `SELECT * FROM allocations WHERE consumer_id = $1 AND unit_id = $2 AND status = 'allotted'`,
      [consumerId, oldUnitId]
    );
    if (!allocationCheck.rows[0]) {
      throw new Error('No active allotment found for this consumer and unit');
    }

    // 2. Verify new unit availability
    const unitCheck = await client.query(
      `SELECT status FROM units WHERE id = $1`,
      [newUnitId]
    );
    if (!unitCheck.rows[0] || unitCheck.rows[0].status !== 'available') {
      throw new Error('New unit is not available');
    }

    // 3. Mark old unit as available
    await client.query(
      `UPDATE units SET status = 'available', updated_at = NOW() WHERE id = $1`,
      [oldUnitId]
    );

    // 4. Mark new unit as allotted
    await client.query(
      `UPDATE units SET status = 'allotted', updated_at = NOW() WHERE id = $1`,
      [newUnitId]
    );

    // 5. Update allocation record
    await client.query(
      `UPDATE allocations SET unit_id = $1, updated_at = NOW() WHERE id = $2`,
      [newUnitId, allocationCheck.rows[0].id]
    );

    // 6. Log the shift
    await client.query(
      `INSERT INTO unit_shifts (consumer_id, old_unit_id, new_unit_id, reason, shifted_by_user_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [consumerId, oldUnitId, newUnitId, reason || 'Routine Shift', req.userId]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: 'Unit shifted successfully' });
  } catch (err: any) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

/**
 * APPLICATION TRANSFER LOGIC
 * Transfers a booking from one consumer to another (e.g., resale or family transfer).
 */
router.post('/application-transfer', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const client = await db.connect();
  try {
    const { oldConsumerId, newConsumerId, unitId, reason } = req.body;

    if (!oldConsumerId || !newConsumerId || !unitId) {
      return res.status(400).json({ error: 'oldConsumerId, newConsumerId, and unitId are required' });
    }

    await client.query('BEGIN');

    // 1. Update allocation
    const result = await client.query(
      `UPDATE allocations SET consumer_id = $1, updated_at = NOW() 
       WHERE consumer_id = $2 AND unit_id = $3 AND status = 'allotted'
       RETURNING id`,
      [newConsumerId, oldConsumerId, unitId]
    );

    if (result.rowCount === 0) {
      throw new Error('Allocation not found for transfer');
    }

    // 2. Update consumer on units table if applicable
    await client.query(
      `UPDATE units SET updated_at = NOW() WHERE id = $1`,
      [unitId]
    );

    // 3. Log in remarks for both consumers
    const remarkNote = `Application for Unit ${unitId} transferred from ${oldConsumerId} to ${newConsumerId}. Reason: ${reason}`;
    await client.query(
      `INSERT INTO remarks (consumer_id, notes, user_id, subject) VALUES ($1, $2, $3, 'Application Transfer')`,
      [oldConsumerId, remarkNote, req.userId]
    );
    await client.query(
      `INSERT INTO remarks (consumer_id, notes, user_id, subject) VALUES ($1, $2, $3, 'Application Transfer')`,
      [newConsumerId, remarkNote, req.userId]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: 'Application transferred successfully' });
  } catch (err: any) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

export default router;
