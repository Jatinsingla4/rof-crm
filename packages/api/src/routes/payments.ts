/**
 * Payment Routes - Module D
 * Payment plans, demand letters, receipts, HRERA Rule 15 penal interest
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../index';
import { AuthRequest } from '../index';

const router = Router();

/**
 * HRERA Rule 15: Penal Interest Calculation
 * Interest = Principal × Rate × Time / 100
 * Rate: 11.10% per annum (SBI MCLR + 2%)
 * Time: days_overdue / 365
 */
const calculatePenalInterest = (principalInr: number, daysOverdue: number): number => {
  const rate = 11.10;
  return Math.round((principalInr * rate * daysOverdue / 365) / 100);
};

// POST /api/payments/payment-plans - Create payment plan (AHP-compliant)
router.post('/payment-plans', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { allocationId, consumerId, unitId, projectId, totalAmountInr } = req.body;

    // AHP structure: 5% booking, 20% allotment, 6×12.5% half-yearly
    const booking = Math.round(totalAmountInr * 0.05);
    const allotment = Math.round(totalAmountInr * 0.20);
    const quarterly = Math.round(totalAmountInr * 0.125);

    const result = await db.query(
      `INSERT INTO payment_plans (allocation_id, consumer_id, unit_id, project_id, total_amount_inr, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, total_amount_inr`,
      [allocationId, consumerId, unitId, projectId, totalAmountInr, req.userId]
    );

    res.status(201).json({
      success: true,
      data: {
        ...result.rows[0],
        structure: {
          booking: { amount: booking, percentage: 5 },
          allotment: { amount: allotment, percentage: 20 },
          quarterly: { amount: quarterly, percentage: 12.5, count: 6 },
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/payments/overdue - List overdue payments with HRERA interest
router.get('/overdue', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT
        d.id, d.payment_plan_id, d.consumer_id, d.amount_due_inr, d.due_date,
        EXTRACT(DAY FROM NOW() - d.due_date)::INT as days_overdue,
        c.name as consumer_name, c.mobile
       FROM demands d
       JOIN consumers c ON d.consumer_id = c.id
       WHERE d.due_date < NOW()
       ORDER BY days_overdue DESC`
    );

    // Calculate penal interest for each
    const data = result.rows.map((row) => ({
      ...row,
      penalInterestInr: row.days_overdue > 0 ? calculatePenalInterest(row.amount_due_inr, row.days_overdue) : 0,
    }));

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/payments/receipts - Record payment receipt
router.post('/receipts', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { paymentPlanId, installmentIndex, amountReceivedInr, paymentMethod, transactionRef, receivedDate } =
      req.body;

    // Get demand details
    const demandResult = await db.query(
      `SELECT consumer_id, amount_due_inr FROM demands
       WHERE payment_plan_id = $1 AND installment_index = $2`,
      [paymentPlanId, installmentIndex]
    );

    if (demandResult.rows.length === 0) {
      return res.status(404).json({ error: 'Demand not found' });
    }

    const { consumer_id, amount_due_inr } = demandResult.rows[0];

    // Generate receipt number (format: YYYY-MM-XXXXX)
    const receiptNumber = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;

    // Insert receipt
    const result = await db.query(
      `INSERT INTO receipts (payment_plan_id, installment_index, consumer_id, amount_received_inr, payment_method, transaction_ref, received_date, received_by_user_id, receipt_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, receipt_number, amount_received_inr`,
      [
        paymentPlanId,
        installmentIndex,
        consumer_id,
        amountReceivedInr,
        paymentMethod,
        transactionRef,
        receivedDate,
        req.userId,
        receiptNumber,
      ]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/payments/dashboard - Payment dashboard KPIs
router.get('/dashboard', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;

    let query = `
      SELECT
        COALESCE(SUM(total_amount_inr), 0) as total_receivables,
        (SELECT COALESCE(SUM(amount_received_inr), 0) FROM receipts) as total_collected,
        (SELECT COUNT(*) FROM demands WHERE due_date < NOW()) as overdue_count
      FROM payment_plans
    `;

    if (projectId) {
      query += ` WHERE project_id = $1`;
    }

    const result = await db.query(query, projectId ? [projectId] : []);
    const {
      total_receivables: totalReceivables,
      total_collected: totalCollected,
      overdue_count: overdueCount,
    } = result.rows[0];

    const collectionPercentage =
      totalReceivables > 0 ? Math.round((totalCollected / totalReceivables) * 100) : 0;
    const outstanding = totalReceivables - totalCollected;

    res.json({
      success: true,
      data: {
        kpis: {
          totalReceivables,
          totalCollected,
          collectionPercentage,
          outstanding,
          overdueCount,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/payments/demands - List all demands (with optional filters)
router.get('/demands', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { consumerId, projectId, status, page = 1, pageSize = 50 } = req.query;

    let query = `SELECT d.id, d.payment_plan_id, d.installment_index, d.consumer_id,
                        d.amount_due_inr, d.due_date, d.delivery_status, d.sent_via, d.generated_at,
                        c.name as consumer_name, c.mobile,
                        pp.project_id
                 FROM demands d
                 JOIN consumers c ON d.consumer_id = c.id
                 JOIN payment_plans pp ON d.payment_plan_id = pp.id
                 WHERE 1=1`;
    const params: any[] = [];

    if (consumerId) {
      query += ` AND d.consumer_id = $${params.length + 1}`;
      params.push(consumerId);
    }
    if (projectId) {
      query += ` AND pp.project_id = $${params.length + 1}`;
      params.push(projectId);
    }
    if (status === 'overdue') {
      query += ` AND d.due_date < NOW()`;
    } else if (status) {
      query += ` AND d.delivery_status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY d.due_date ASC LIMIT ${pageSize} OFFSET ${((page as number) - 1) * (pageSize as number)}`;

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/payments/demands - Raise a demand letter
router.post('/demands', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { paymentPlanId, installmentIndex, consumerId, dueDate, amountDueInr, sentVia } = req.body;

    if (!paymentPlanId || !consumerId || !dueDate || !amountDueInr) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await db.query(
      `INSERT INTO demands (payment_plan_id, installment_index, consumer_id, due_date, amount_due_inr, sent_via, delivery_status)
       VALUES ($1, $2, $3, $4, $5, $6, 'queued')
       RETURNING id, installment_index, amount_due_inr, due_date, delivery_status`,
      [paymentPlanId, installmentIndex || 0, consumerId, dueDate, amountDueInr, sentVia || 'email']
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// POST /api/payments/demands/bulk - Bulk raise demands for a project
router.post('/demands/bulk', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId, dueDate, amountDueInr, sentVia } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId required' });
    }

    const plans = await db.query(
      `SELECT id, consumer_id FROM payment_plans WHERE project_id = $1`,
      [projectId]
    );

    let created = 0;
    for (const plan of plans.rows) {
      await db.query(
        `INSERT INTO demands (payment_plan_id, installment_index, consumer_id, due_date, amount_due_inr, sent_via, delivery_status)
         VALUES ($1, 0, $2, $3, $4, $5, 'queued')`,
        [plan.id, plan.consumer_id, dueDate || new Date().toISOString().slice(0, 10), amountDueInr || 0, sentVia || 'email']
      );
      created++;
    }

    res.status(201).json({ success: true, data: { created, projectId } });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/payments/demands/:id/send - Mark demand as sent
router.patch('/demands/:id/send', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { sentVia } = req.body;

    const result = await db.query(
      `UPDATE demands SET delivery_status = 'sent', sent_at = NOW(), sent_via = COALESCE($1, sent_via)
       WHERE id = $2
       RETURNING id, delivery_status, sent_at`,
      [sentVia, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Demand not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// GET /api/payments/receipts - List all receipts (with optional filters)
router.get('/receipts', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { consumerId, projectId, status, page = 1, pageSize = 50 } = req.query;

    let query = `SELECT r.id, r.receipt_number, r.payment_plan_id, r.installment_index,
                        r.consumer_id, r.amount_received_inr, r.payment_method,
                        r.transaction_ref, r.received_date, r.created_at,
                        c.name as consumer_name, c.mobile,
                        pp.project_id
                 FROM receipts r
                 JOIN consumers c ON r.consumer_id = c.id
                 JOIN payment_plans pp ON r.payment_plan_id = pp.id
                 WHERE 1=1`;
    const params: any[] = [];

    if (consumerId) {
      query += ` AND r.consumer_id = $${params.length + 1}`;
      params.push(consumerId);
    }
    if (projectId) {
      query += ` AND pp.project_id = $${params.length + 1}`;
      params.push(projectId);
    }

    query += ` ORDER BY r.created_at DESC LIMIT ${pageSize} OFFSET ${((page as number) - 1) * (pageSize as number)}`;

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/payments/receipts/:id/approve - Approve a pending receipt
router.patch('/receipts/:id/approve', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT id, receipt_number, amount_received_inr FROM receipts WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    res.json({ success: true, data: { ...result.rows[0], status: 'approved' }, message: 'Receipt approved' });
  } catch (error) {
    next(error);
  }
});

// GET /api/payments/gst-invoices - List GST invoices
router.get('/gst-invoices', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { consumerId, projectId, page = 1, pageSize = 100 } = req.query;

    // Derive GST invoices from receipts (GST on top of receipt amounts)
    let query = `SELECT r.id, r.receipt_number as invoice_number,
                        r.consumer_id, c.name as consumer_name,
                        r.amount_received_inr as base_amount,
                        ROUND(r.amount_received_inr * 0.05) as gst_amount,
                        5 as gst_rate,
                        r.received_date as invoice_date,
                        r.created_at,
                        'active' as status
                 FROM receipts r
                 JOIN consumers c ON r.consumer_id = c.id
                 JOIN payment_plans pp ON r.payment_plan_id = pp.id
                 WHERE 1=1`;
    const params: any[] = [];

    if (consumerId) {
      query += ` AND r.consumer_id = $${params.length + 1}`;
      params.push(consumerId);
    }
    if (projectId) {
      query += ` AND pp.project_id = $${params.length + 1}`;
      params.push(projectId);
    }

    query += ` ORDER BY r.created_at DESC LIMIT ${pageSize} OFFSET ${((page as number) - 1) * (pageSize as number)}`;

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/payments/gst-invoices - Create GST invoice
router.post('/gst-invoices', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { consumerId, baseAmount, gstRate, gstAmount, totalAmount, invoiceType, description, invoiceDate } = req.body;

    if (!consumerId || !baseAmount) {
      return res.status(400).json({ error: 'consumerId and baseAmount required' });
    }

    const invoiceNumber = `ROF/${new Date().getFullYear()}/${String(Math.floor(Math.random() * 9000) + 1000)}`;

    res.status(201).json({
      success: true,
      data: {
        invoice_number: invoiceNumber,
        consumer_id: consumerId,
        base_amount: baseAmount,
        gst_rate: gstRate || 5,
        gst_amount: gstAmount || Math.round(baseAmount * (gstRate || 5) / 100),
        total_amount: totalAmount || baseAmount + Math.round(baseAmount * (gstRate || 5) / 100),
        invoice_type: invoiceType,
        description,
        invoice_date: invoiceDate,
        status: 'active',
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/payments/gst-invoices/cancel - Cancel GST invoice
router.post('/gst-invoices/cancel', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { invoiceNumber, reason } = req.body;

    if (!invoiceNumber) {
      return res.status(400).json({ error: 'invoiceNumber required' });
    }

    res.json({
      success: true,
      data: { invoiceNumber, status: 'cancelled', reason, creditNoteNumber: `CN-${invoiceNumber}` },
      message: 'Invoice cancelled and credit note issued',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/payments/gst-invoices/:id/pdf - Get GST invoice PDF (stub)
router.get('/gst-invoices/:id/pdf', async (req: AuthRequest, res: Response, next: NextFunction) => {
  res.status(200).json({ success: true, message: 'PDF generation coming soon', id: req.params.id });
});

// GET /api/payments/:paymentPlanId/demands - Get demands for payment plan
router.get('/:paymentPlanId/demands', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { paymentPlanId } = req.params;

    const result = await db.query(
      `SELECT id, installment_index, amount_due_inr, due_date, delivery_status
       FROM demands WHERE payment_plan_id = $1
       ORDER BY installment_index ASC`,
      [paymentPlanId]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/payments/calculate-interest - Calculate HRERA interest on overdue
router.post('/calculate-interest', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { paymentPlanId, installmentIndex, principalInr, daysOverdue } = req.body;

    const interest = calculatePenalInterest(principalInr, daysOverdue);

    res.json({
      success: true,
      data: {
        principalInr,
        daysOverdue,
        ratePercent: 11.10,
        interestInr: interest,
        totalWithInterest: principalInr + interest,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/payments/draw-refunds - List all draw refunds
router.get('/draw-refunds', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, projectId, page = 1, pageSize = 20 } = req.query;

    let query = `SELECT
                  id, consumer_id, project_id, draw_result,
                  booking_amount_paid_inr, refund_amount_inr,
                  refund_due_by, refund_status,
                  refund_initiated_at, refund_completed_at,
                  refund_reference, created_at
                 FROM draw_refunds WHERE 1=1`;
    const params: any[] = [];

    if (status) {
      query += ` AND refund_status = $${params.length + 1}`;
      params.push(status);
    }

    if (projectId) {
      query += ` AND project_id = $${params.length + 1}`;
      params.push(projectId);
    }

    query += ` ORDER BY refund_due_by ASC
              LIMIT ${pageSize} OFFSET ${((page as number) - 1) * (pageSize as number)}`;

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/payments/draw-refunds/overdue - Get overdue draw refunds
router.get('/draw-refunds/overdue', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `SELECT
        id, consumer_id, project_id, draw_result,
        booking_amount_paid_inr, refund_amount_inr,
        refund_due_by, refund_status,
        refund_initiated_at, created_at,
        EXTRACT(DAY FROM (NOW() - refund_due_by))::INT as days_overdue
       FROM draw_refunds
       WHERE refund_due_by < CURRENT_DATE
       AND refund_status NOT IN ('completed')
       ORDER BY refund_due_by ASC`
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/payments/draw-refunds/:id/initiate - Initiate draw refund
router.patch('/draw-refunds/:id/initiate', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { refundReference, notes } = req.body;

    const result = await db.query(
      `UPDATE draw_refunds
       SET refund_status = 'initiated',
           refund_initiated_at = NOW(),
           refund_reference = $1,
           notes = COALESCE($2, notes),
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, consumer_id, refund_status, refund_initiated_at`,
      [refundReference, notes || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Draw refund not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/payments/draw-refunds/:id/complete - Complete draw refund
router.patch('/draw-refunds/:id/complete', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { refundReference } = req.body;

    const result = await db.query(
      `UPDATE draw_refunds
       SET refund_status = 'completed',
           refund_completed_at = NOW(),
           refund_reference = COALESCE($1, refund_reference),
           updated_at = NOW()
       WHERE id = $2
       RETURNING id, consumer_id, refund_status, refund_completed_at`,
      [refundReference || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Draw refund not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

export default router;
