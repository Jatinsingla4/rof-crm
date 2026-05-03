/**
 * Allocation Routes - Module C
 * E-draw import, allotments, waitlist, cancellations
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../index.js';
import { AuthRequest } from '../index.js';

const router = Router();

// POST /api/allocations - Create allocation (one-click allotment)
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { consumerId, unitId, projectId, allotmentDate, remarks } = req.body;

    const isValidUUID = (str: string): boolean => {
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    };

    const uuidFields = { consumerId, unitId, projectId };
    for (const [field, value] of Object.entries(uuidFields)) {
      if (!value || !isValidUUID(value)) {
        return res.status(400).json({
          error: 'INVALID_INPUT',
          message: `${field} must be a valid UUID`,
        });
      }
    }

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
        `INSERT INTO allocations (consumer_id, unit_id, project_id, created_by_user_id, allotment_date, remarks)
         VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_DATE), $6)
         RETURNING id, allocated_date, allotment_date, remarks`,
        [consumerId, unitId, projectId, req.userId, allotmentDate || null, remarks || null]
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

// GET /api/allocations/waitlist - List waitlist entries
router.get('/waitlist', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;

    let query = `SELECT
                  w.id,
                  w.consumer_id,
                  w.project_id,
                  w.position_ordered as position,
                  CASE WHEN w.promoted_to_allocation_id IS NOT NULL THEN 'promoted' ELSE 'waiting' END as status,
                  w.created_at as applied_date,
                  c.name as consumer_name,
                  c.mobile as consumer_mobile,
                  p.name as project_name
                 FROM waitlists w
                 JOIN consumers c ON w.consumer_id = c.id
                 JOIN projects p ON w.project_id = p.id
                 WHERE 1=1`;

    const params: any[] = [];

    if (projectId) {
      params.push(projectId);
      query += ` AND w.project_id = $${params.length}`;
    }

    query += ` ORDER BY w.position_ordered ASC`;

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      total: result.rowCount,
    });
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

      // Check for waitlist
      const waitlistResult = await client.query(
        `SELECT id, consumer_id FROM waitlists 
         WHERE project_id = (SELECT project_id FROM units WHERE id = $1)
         AND promoted_to_allocation_id IS NULL
         ORDER BY position_ordered ASC LIMIT 1`,
        [unitId]
      );

      if (waitlistResult.rows.length > 0) {
        const promotedWaitlistId = waitlistResult.rows[0].id;
        const promotedConsumerId = waitlistResult.rows[0].consumer_id;

        // Create new allocation for waitlisted consumer
        const newAllocation = await client.query(
          `INSERT INTO allocations (consumer_id, unit_id, project_id, created_by_user_id)
           VALUES ($1, $2, (SELECT project_id FROM units WHERE id = $2), $3)
           RETURNING id`,
          [promotedConsumerId, unitId, req.userId]
        );
        const newAllocId = newAllocation.rows[0].id;

        // Update waitlist entry
        await client.query(
          `UPDATE waitlists SET promoted_to_allocation_id = $1 WHERE id = $2`,
          [newAllocId, promotedWaitlistId]
        );

        // Unit stays 'allotted' but to the new consumer
        await client.query(
          `UPDATE units SET status = 'allotted', status_changed_at = NOW() WHERE id = $1`,
          [unitId]
        );

        // Update consumer lead stage
        await client.query(
          `UPDATE consumers SET lead_stage = 'allotted', allocated_unit_id = $1 WHERE id = $2`,
          [unitId, promotedConsumerId]
        );

        // Log status change
        await client.query(
          `INSERT INTO unit_status_history (unit_id, previous_status, new_status, changed_by_user_id, reason)
           VALUES ($1, 'allotted', 'allotted', $2, 'Auto-promoted from waitlist on cancellation')`,
          [unitId, req.userId]
        );

      } else {
        // No waitlist, reset unit status to available
        await client.query(
          `UPDATE units SET status = 'available', status_changed_at = NOW() WHERE id = $1`,
          [unitId]
        );
      }

      // Update cancelled consumer lead stage
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
    let refundsCreated = 0;
    const mismatches = [];

    for (const row of results) {
      // Try to find consumer by Aadhaar
      const consumerResult = await db.query(
        `SELECT id, lead_stage FROM consumers WHERE aadhaar_hash = $1 AND project_id = $2`,
        [row.applicantId, projectId]
      );

      if (consumerResult.rows.length > 0) {
        const consumerId = consumerResult.rows[0].id;
        const currentLeadStage = consumerResult.rows[0].lead_stage;

        // Auto-advance from application_filed to draw_entered
        if (currentLeadStage === 'application_filed') {
          await db.query(
            `UPDATE consumers SET lead_stage = 'draw_entered' WHERE id = $1`,
            [consumerId]
          );
        }

        // Handle unsuccessful draw applicants - create refund record
        if (row.result === 'unsuccessful' || row.result === 'unsuccessful_draw') {
          // Get booking amount from receipts
          const bookingResult = await db.query(
            `SELECT COALESCE(SUM(r.amount_received_inr), 0) as total_paid
             FROM receipts r
             WHERE r.consumer_id = $1`,
            [consumerId]
          );

          const bookingAmountPaid = bookingResult.rows[0].total_paid || 0;

          if (bookingAmountPaid > 0) {
            // Create draw refund record (due within 30 days per AHP policy)
            await db.query(
              `INSERT INTO draw_refunds (
                consumer_id, project_id, draw_result,
                booking_amount_paid_inr, refund_amount_inr,
                refund_due_by, refund_status, created_by_user_id
               ) VALUES ($1, $2, 'unsuccessful', $3, $4, CURRENT_DATE + INTERVAL '30 days', 'pending', $5)`,
              [consumerId, projectId, bookingAmountPaid, bookingAmountPaid, req.userId]
            );

            // Update consumer lead_stage to cancelled
            await db.query(
              `UPDATE consumers SET lead_stage = 'cancelled' WHERE id = $1`,
              [consumerId]
            );

            refundsCreated++;
          }
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
        refundsCreated,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/allocations/shift — Unit shifting process
router.post('/shift', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { consumerId, newUnitId, reason, shiftDate } = req.body;
    if (!consumerId || !newUnitId) {
      return res.status(400).json({ error: 'consumerId and newUnitId are required' });
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

      // Verify consumer has current allocation
      const consumerRes = await client.query(
        `SELECT allocated_unit_id FROM consumers WHERE id = $1 FOR UPDATE`,
        [consumerId]
      );
      if (!consumerRes.rows[0]?.allocated_unit_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Consumer has no active unit allocation' });
      }
      const oldUnitId = consumerRes.rows[0].allocated_unit_id;

      // Verify new unit is available
      const newUnitRes = await client.query(
        `SELECT status, unit_number FROM units WHERE id = $1 FOR UPDATE`,
        [newUnitId]
      );
      if (!newUnitRes.rows[0] || newUnitRes.rows[0].status !== 'available') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'New unit is not available' });
      }
      const newUnitNumber = newUnitRes.rows[0].unit_number;

      // Record shift history
      await client.query(
        `INSERT INTO unit_shifts (consumer_id, old_unit_id, new_unit_id, reason, shift_date, shifted_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING`,
        [consumerId, oldUnitId, newUnitId, reason || null, shiftDate || new Date().toISOString().split('T')[0], req.userId]
      );

      // Release old unit
      await client.query(`UPDATE units SET status = 'available', status_changed_at = NOW() WHERE id = $1`, [oldUnitId]);

      // Allocate new unit
      await client.query(`UPDATE units SET status = 'allotted', status_changed_at = NOW() WHERE id = $1`, [newUnitId]);

      // Update consumer allocation
      await client.query(
        `UPDATE consumers SET allocated_unit_id = $1 WHERE id = $2`,
        [newUnitId, consumerId]
      );

      // Update existing allocation record
      await client.query(
        `UPDATE allocations SET unit_id = $1 WHERE consumer_id = $2 AND status = 'allotted'`,
        [newUnitId, consumerId]
      );

      await client.query('COMMIT');
      res.json({ success: true, data: { consumer_id: consumerId, old_unit_id: oldUnitId, new_unit_id: newUnitId, new_unit_number: newUnitNumber } });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// GET /api/allocations/shifts — Unit shift history
router.get('/shifts', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId, from, to, pageSize = 100 } = req.query;
    const params: any[] = [];
    let where = 'WHERE 1=1';
    if (from) { params.push(from); where += ` AND us.shift_date >= $${params.length}`; }
    if (to)   { params.push(to);   where += ` AND us.shift_date <= $${params.length}`; }

    // Try unit_shifts table, fall back gracefully
    const result = await db.query(`
      SELECT us.*, c.name as consumer_name, c.mobile,
             ou.unit_number as old_unit_number, nu.unit_number as new_unit_number,
             p.name as project_name
      FROM unit_shifts us
      JOIN consumers c ON c.id = us.consumer_id
      LEFT JOIN units ou ON ou.id = us.old_unit_id
      LEFT JOIN units nu ON nu.id = us.new_unit_id
      LEFT JOIN projects p ON p.id = nu.project_id
      ${where}
      ORDER BY us.shift_date DESC, us.created_at DESC
      LIMIT $${params.length + 1}
    `, [...params, pageSize]).catch(() => ({ rows: [] }));

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/allocations/generate-letters — generate allotment letters for allotted consumers
router.post('/generate-letters', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.body;

    let query = `
      SELECT a.id, a.consumer_id, c.name as consumer_name,
             a.unit_id, u.unit_number, u.bhk_type, u.total_price_inr,
             p.name as project_name, a.allotment_date
      FROM allocations a
      JOIN consumers c ON a.consumer_id = c.id
      JOIN units u ON a.unit_id = u.id
      JOIN projects p ON u.project_id = p.id
      WHERE a.status::text = 'allotted' AND a.allotment_letter_id IS NULL`;
    const params: any[] = [];

    if (projectId) {
      query += ` AND u.project_id = $${params.length + 1}`;
      params.push(projectId);
    }

    const result = await db.query(query, params);
    let generated = 0;

    for (const allotment of result.rows) {
      // Insert into allotment_letters and link back
      const letterRes = await db.query(
        `INSERT INTO allotment_letters (allocation_id, consumer_id, unit_id, letter_date)
         VALUES ($1, $2, $3, COALESCE($4, CURRENT_DATE)) RETURNING id`,
        [allotment.id, allotment.consumer_id, allotment.unit_id, allotment.allotment_date || null]
      );
      const letterId = letterRes.rows[0].id;
      await db.query(`UPDATE allocations SET allotment_letter_id = $1 WHERE id = $2`, [letterId, allotment.id]);
      generated++;
    }

    res.json({
      success: true,
      data: { total: result.rows.length, generated, message: `${generated} allotment letter(s) queued for generation` },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
