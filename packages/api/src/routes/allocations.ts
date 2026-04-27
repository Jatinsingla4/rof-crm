/**
 * Allocation Routes - Module C
 * E-draw import, allotments, waitlist, cancellations
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../index';
import { AuthRequest } from '../index';

const router = Router();

// POST /api/allocations - Create allocation (one-click allotment)
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { consumerId, unitId, projectId } = req.body;

    // Validate eligibility (SERIALIZABLE transaction)
    const client = await db.connect();

    try {
      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

      // Check unit status
      const unitResult = await client.query(
        `SELECT status FROM units WHERE id = $1 FOR UPDATE`,
        [unitId]
      );

      if (unitResult.rows.length === 0 || unitResult.rows[0].status !== 'available') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Unit not available for allocation' });
      }

      // Create allocation
      const allocationResult = await client.query(
        `INSERT INTO allocations (consumer_id, unit_id, project_id, created_by_user_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id, allocated_date`,
        [consumerId, unitId, projectId, req.userId]
      );

      // Update unit status
      await client.query(
        `UPDATE units SET status = 'allotted', status_changed_at = NOW() WHERE id = $1`,
        [unitId]
      );

      // Update consumer lead stage
      await client.query(
        `UPDATE consumers SET lead_stage = 'allotted', allocated_unit_id = $1 WHERE id = $2`,
        [unitId, consumerId]
      );

      // Log status change
      await client.query(
        `INSERT INTO unit_status_history (unit_id, previous_status, new_status, changed_by_user_id, reason)
         VALUES ($1, 'available', 'allotted', $2, 'Allotment created')`,
        [unitId, req.userId]
      );

      await client.query('COMMIT');

      res.status(201).json({
        success: true,
        data: allocationResult.rows[0],
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// GET /api/allocations - List allocations
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId, status = 'allotted', page = 1, pageSize = 20 } = req.query;

    let query = `SELECT a.id, a.consumer_id, a.unit_id, a.allocated_date, a.status,
                        c.name as consumer_name, c.mobile, u.unit_number
                 FROM allocations a
                 JOIN consumers c ON a.consumer_id = c.id
                 JOIN units u ON a.unit_id = u.id
                 WHERE 1=1`;

    const params: any[] = [];

    if (projectId) {
      query += ` AND a.project_id = $${params.length + 1}`;
      params.push(projectId);
    }

    if (status) {
      query += ` AND a.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY a.allocated_date DESC LIMIT ${pageSize} OFFSET ${((page as number) - 1) * (pageSize as number)}`;

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/allocations/:id/cancel - Cancel allocation
router.post('/:id/cancel', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Get allocation details
    const allocationResult = await db.query(
      `SELECT consumer_id, unit_id FROM allocations WHERE id = $1`,
      [id]
    );

    if (allocationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Allocation not found' });
    }

    const { consumer_id: consumerId, unit_id: unitId } = allocationResult.rows[0];

    // SERIALIZABLE transaction
    const client = await db.connect();

    try {
      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

      // Calculate forfeiture (₹25,000 + 18% GST = ₹29,500)
      const forfeitureAmountInr = 29500;

      // Get total received
      const paymentResult = await client.query(
        `SELECT COALESCE(SUM(amount_received_inr), 0) as total_received
         FROM receipts WHERE consumer_id = $1`,
        [consumerId]
      );

      const totalReceived = paymentResult.rows[0].total_received;
      const refundAmountInr = totalReceived - forfeitureAmountInr;

      // Create cancellation record
      const cancellationResult = await client.query(
        `INSERT INTO cancellations (allocation_id, consumer_id, cancellation_date, reason, forfeiture_amount_inr, refund_amount_inr)
         VALUES ($1, $2, NOW(), $3, $4, $5)
         RETURNING id, refund_amount_inr`,
        [id, consumerId, reason, forfeitureAmountInr, refundAmountInr]
      );

      // Update allocation status
      await client.query(`UPDATE allocations SET status = 'cancelled' WHERE id = $1`, [id]);

      // Reset unit status
      await client.query(
        `UPDATE units SET status = 'available', status_changed_at = NOW() WHERE id = $1`,
        [unitId]
      );

      // Update consumer lead stage
      await client.query(
        `UPDATE consumers SET lead_stage = 'cancelled', allocated_unit_id = NULL WHERE id = $1`,
        [consumerId]
      );

      await client.query('COMMIT');

      res.json({
        success: true,
        data: cancellationResult.rows[0],
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// POST /api/allocations/import-edraw - Import e-draw results
router.post('/import-edraw', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId, results } = req.body;

    // Parse e-draw CSV results and match to consumers
    let matched = 0;
    let mismatched = 0;
    const mismatches = [];

    for (const row of results) {
      // Try to find consumer by Aadhaar
      const consumerResult = await db.query(
        `SELECT id FROM consumers WHERE aadhaar_hash = $1 AND project_id = $2`,
        [row.applicantId, projectId]
      );

      if (consumerResult.rows.length > 0) {
        // Update consumer based on result
        if (row.result === 'allotted') {
          await db.query(
            `UPDATE consumers SET lead_stage = 'draw_entered' WHERE id = $1`,
            [consumerResult.rows[0].id]
          );
        }

        matched++;
      } else {
        mismatched++;
        mismatches.push({ applicantId: row.applicantId, reason: 'Applicant not found' });
      }
    }

    res.json({
      success: true,
      data: {
        totalResults: results.length,
        matched,
        mismatched,
        mismatches,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
