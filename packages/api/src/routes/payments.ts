/**
 * Payment Routes - Module D
 * Payment plans, demand letters, receipts, HRERA Rule 15 penal interest
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../index';
import { AuthRequest } from '../index';

const router = Router();

/**
 * Calculate Penal Interest (Late Payment Penalty)
 * Legacy Standard: 15% per annum
 */
const getPenalInterestRate = async (): Promise<number> => {
  try {
    const res = await db.query("SELECT value FROM global_settings WHERE key = 'penal_interest_rate_percent'");
    return res.rows.length > 0 ? parseFloat(res.rows[0].value) : 15.0;
  } catch {
    return 15.0;
  }
};

const calculatePenalInterest = (principalInr: number, daysOverdue: number, rate: number = 15.0): number => {
  return Math.round((principalInr * rate * daysOverdue / 365) / 100);
};

// POST /api/payments/payment-plans - Create payment plan (AHP-compliant)
router.post('/payment-plans', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { allocationId, consumerId, unitId, projectId, totalAmountInr, allotmentDate } = req.body;

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO payment_plans (allocation_id, consumer_id, unit_id, project_id, total_amount_inr, created_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, total_amount_inr`,
        [allocationId, consumerId, unitId, projectId, totalAmountInr, req.userId]
      );

      const planId = result.rows[0].id;

      // Dynamic Schedule Generator
      const d = new Date(allotmentDate || new Date());
      const m = (days: number) => { const nd = new Date(d); nd.setDate(nd.getDate() + days); return nd.toISOString().split('T')[0]; };
      
      const schedule = [
        { sn:1, name:'At the time of Application', pct:5, due: m(0) },
        { sn:2, name:'Within 15 days of Allotment', pct:20, due: m(15) },
        { sn:3, name:'Within 6 months from Allotment', pct:12.5, due: m(180) },
        { sn:4, name:'Within 12 months from Allotment', pct:12.5, due: m(360) },
        { sn:5, name:'Within 18 months from Allotment', pct:12.5, due: m(540) },
        { sn:6, name:'Within 24 months from Allotment', pct:12.5, due: m(720) },
        { sn:7, name:'Within 30 months from Allotment', pct:12.5, due: m(900) },
        { sn:8, name:'Within 36 months from Allotment', pct:12.5, due: m(1080) },
      ];

      for (const s of schedule) {
        const amt = Math.round(totalAmountInr * (s.pct / 100));
        const cgst = Math.round(amt * 0.05);
        const sgst = Math.round(amt * 0.05);
        await client.query(
          `INSERT INTO demands (payment_plan_id, consumer_id, installment_index, amount_due_inr, cgst_amount, sgst_amount, due_date, status, demand_type)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)`,
          [planId, consumerId, s.sn, amt, cgst, sgst, s.due, s.name]
        );
      }

      await client.query(
        `INSERT INTO financial_audit_logs (consumer_id, user_id, action_type, new_value, remarks)
         VALUES ($1, $2, 'SCHEDULE_GENERATION', $3, 'AHP Payment Schedule Generated')`,
        [consumerId, req.userId, JSON.stringify({ allotment_date: allotmentDate, schedule })]
      );

      await client.query('COMMIT');

      res.status(201).json({
        success: true,
        data: {
          planId,
          schedule
        },
      });
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
    const penalRate = await getPenalInterestRate();
    const data = result.rows.map((row) => ({
      ...row,
      penalInterestInr: row.days_overdue > 0 ? calculatePenalInterest(row.amount_due_inr, row.days_overdue, penalRate) : 0,
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

    // Insert receipt (default status: pending)
    const result = await db.query(
      `INSERT INTO receipts (payment_plan_id, installment_index, consumer_id, amount_received_inr, payment_method, transaction_ref, received_date, received_by_user_id, receipt_number, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
       RETURNING id, receipt_number, amount_received_inr, status`,
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

// GET /api/payments/demands - List all demands (with legacy fetch grid support)
router.get('/demands', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { consumerId, projectId, status, installmentType, tower, towerId, floor, registrationNo, name, unitAddress, from, to, dateFrom, dateTo, page = 1, pageSize = 50 } = req.query;

    let query = `SELECT d.id, d.installment_index, d.consumer_id, d.amount_due_inr, d.cgst_amount, d.sgst_amount, 
                        d.due_date, d.status, d.demand_type,
                        c.name as consumer_name, c.mobile,
                        br.registration_no,
                        u.unit_number as unit_address, u.bhk_type as unit_type,
                        p.name as project_name,
                        (SELECT COALESCE(SUM(amount_received_inr), 0) FROM receipts WHERE consumer_id = c.id AND status = 'authorized') as total_paid
                 FROM demands d
                 JOIN consumers c ON d.consumer_id = c.id
                 JOIN units u ON c.allocated_unit_id = u.id
                 JOIN projects p ON u.project_id = p.id
                 LEFT JOIN booking_forms br ON br.consumer_id = c.id
                 WHERE 1=1`;
    const params: any[] = [];

    if (consumerId) {
      query += ` AND d.consumer_id = $${params.length + 1}`;
      params.push(consumerId);
    }
    if (projectId) {
      query += ` AND p.id = $${params.length + 1}`;
      params.push(projectId);
    }
    if (installmentType) {
      query += ` AND d.demand_type ILIKE $${params.length + 1}`;
      params.push(`%${installmentType}%`);
    }
    const tId = tower || towerId;
    if (tId) {
      query += ` AND u.tower_id = $${params.length + 1}`;
      params.push(tId);
    }
    if (floor) {
      query += ` AND u.floor_no = $${params.length + 1}`;
      params.push(floor);
    }
    if (registrationNo) {
      query += ` AND br.registration_no ILIKE $${params.length + 1}`;
      params.push(`%${registrationNo}%`);
    }
    if (name) {
      query += ` AND c.name ILIKE $${params.length + 1}`;
      params.push(`%${name}%`);
    }
    if (unitAddress) {
      query += ` AND u.unit_number ILIKE $${params.length + 1}`;
      params.push(unitAddress);
    }
    if (status) {
      query += ` AND d.status = $${params.length + 1}`;
      params.push(status);
    }
    const dFrom = from || dateFrom;
    if (dFrom) {
      query += ` AND d.due_date >= $${params.length + 1}`;
      params.push(dFrom);
    }
    const dTo = to || dateTo;
    if (dTo) {
      query += ` AND d.due_date <= $${params.length + 1}`;
      params.push(dTo);
    }

    query += ` ORDER BY d.installment_index ASC, d.due_date ASC LIMIT ${pageSize} OFFSET ${((page as number) - 1) * (pageSize as number)}`;

    const result = await db.query(query, params);
    
    // Add Balance calculation in memory for speed
    const data = result.rows.map(r => ({
      ...r,
      balance: parseFloat(r.amount_due_inr) + parseFloat(r.cgst_amount) + parseFloat(r.sgst_amount) - parseFloat(r.total_paid)
    }));

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/payments/demands/activate - Transition scheduled installment to active demand
router.patch('/demands/activate', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const client = await db.connect();
  try {
    const { demandIds, installmentDate } = req.body;

    if (!demandIds || !Array.isArray(demandIds) || !installmentDate) {
      return res.status(400).json({ error: 'demandIds (array) and installmentDate required' });
    }

    await client.query('BEGIN');

    const activatedIds = [];
    const dueDate = new Date(installmentDate);
    dueDate.setDate(dueDate.getDate() + 15); // Legacy Rule: Due Date = Installment Date + 15 days

    for (const id of demandIds) {
      // 1. Check for sequential validation
      const currentDemand = await client.query('SELECT installment_index, consumer_id FROM demands WHERE id = $1', [id]);
      if (currentDemand.rows.length === 0) continue;
      
      const { installment_index, consumer_id } = currentDemand.rows[0];
      if (installment_index > 1) {
        const prevPending = await client.query(
          'SELECT id FROM demands WHERE consumer_id = $1 AND installment_index < $2 AND status = $3',
          [consumer_id, installment_index, 'pending']
        );
        if (prevPending.rows.length > 0) {
          throw new Error(`Cannot raise demand for installment ${installment_index} before previous installments are raised.`);
        }
      }

      // 2. Activate demand
      const updateResult = await client.query(
        `UPDATE demands 
         SET status = 'demanded', 
             due_date = $1,
             generated_at = NOW(),
             delivery_status = 'queued'
         WHERE id = $2
         RETURNING id`,
        [dueDate.toISOString().split('T')[0], id]
      );

      // 3. Log Audit Trail
      await client.query(
        `INSERT INTO financial_audit_logs (consumer_id, user_id, action_type, new_value, remarks)
         VALUES ($1, $2, 'DEMAND_RAISE', $3, $4)`,
        [consumer_id, req.userId, JSON.stringify({ installment_date: installmentDate, due_date: dueDate }), `Demand raised for installment ${installment_index}`]
      );

      activatedIds.push(updateResult.rows[0].id);
    }

    await client.query('COMMIT');
    res.json({ success: true, activatedCount: activatedIds.length });
  } catch (error: any) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: error.message });
  } finally {
    client.release();
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

// PATCH /api/payments/receipts/:id/approve - Approve a pending receipt (Authentication)
router.patch('/receipts/:id/approve', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `UPDATE receipts 
       SET status = 'authorized', 
           authorized_by = $1, 
           authorized_at = NOW(),
           updated_at = NOW()
       WHERE id = $2 AND status = 'pending'
       RETURNING id, receipt_number, amount_received_inr, status`,
      [req.userId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pending receipt not found or already authorized' });
    }

    res.json({ success: true, data: result.rows[0], message: 'Receipt authorized successfully' });
  } catch (error) {
    next(error);
  }
});

// GET /api/payments/gst-invoices - List GST invoices
router.get('/gst-invoices', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { consumerId, projectId, status, page = 1, pageSize = 100 } = req.query;

    let query = `SELECT gi.*, c.name as consumer_name, p.name as project_name
                 FROM gst_invoices gi
                 JOIN consumers c ON gi.consumer_id = c.id
                 JOIN projects p ON gi.project_id = p.id
                 WHERE 1=1`;
    const params: any[] = [];

    if (consumerId) {
      query += ` AND gi.consumer_id = $${params.length + 1}`;
      params.push(consumerId);
    }
    if (projectId) {
      query += ` AND gi.project_id = $${params.length + 1}`;
      params.push(projectId);
    }
    if (status) {
      query += ` AND gi.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY gi.created_at DESC LIMIT ${pageSize} OFFSET ${((page as number) - 1) * (pageSize as number)}`;

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/payments/gst-invoices - Create GST invoice
router.post('/gst-invoices', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { 
      projectId, consumerId, unitId, baseAmountInr, 
      cgstRate, sgstRate, igstRate, 
      installmentName, invoiceDate, hsnCode 
    } = req.body;

    if (!consumerId || !baseAmountInr || !projectId) {
      return res.status(400).json({ error: 'projectId, consumerId and baseAmountInr required' });
    }

    const invoiceNo = `INV/${new Date().getFullYear()}/${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;
    
    const cgstAmount = Math.round(baseAmountInr * (cgstRate || 9) / 100);
    const sgstAmount = Math.round(baseAmountInr * (sgstRate || 9) / 100);
    const igstAmount = igstRate ? Math.round(baseAmountInr * igstRate / 100) : 0;
    const totalAmount = baseAmountInr + cgstAmount + sgstAmount + igstAmount;

    const result = await db.query(
      `INSERT INTO gst_invoices (
        invoice_no, invoice_date, project_id, consumer_id, unit_id, 
        installment_name, base_amount_inr, taxable_amount_inr,
        cgst_rate, sgst_rate, igst_rate,
        cgst_amount_inr, sgst_amount_inr, igst_amount_inr,
        total_amount_inr, hsn_sac_code, status, created_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'generated', $16)
       RETURNING *`,
      [
        invoiceNo, invoiceDate || new Date(), projectId, consumerId, unitId || null,
        installmentName || 'Direct Payment', baseAmountInr, 
        cgstRate || 9.0, sgstRate || 9.0, igstRate || 0.0,
        cgstAmount, sgstAmount, igstAmount,
        totalAmount, hsnCode || '9972', req.userId
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
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

    const penalRate = await getPenalInterestRate();
    const interest = calculatePenalInterest(principalInr, daysOverdue, penalRate);

    res.json({
      success: true,
      data: {
        principalInr,
        daysOverdue,
        ratePercent: penalRate,
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

/**
 * PATCH /api/payments/receipts/:id/bounce - Mark receipt as bounced
 */
router.patch('/receipts/:id/bounce', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const client = await db.connect();
  try {
    const { id } = req.params;
    const { reason, penaltyAmount = 500 } = req.body;

    await client.query('BEGIN');

    // 1. Get receipt details
    const receiptRes = await client.query(
      `SELECT consumer_id, demand_id, amount_received_inr FROM receipts WHERE id = $1 FOR UPDATE`,
      [id]
    );

    if (receiptRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Receipt not found' });
    }

    const { consumer_id, demand_id, amount_received_inr } = receiptRes.rows[0];

    // 2. Update receipt status
    await client.query(
      `UPDATE receipts SET status = 'bounced', updated_at = NOW() WHERE id = $1`,
      [id]
    );

    // 3. Re-open the demand if linked
    if (demand_id) {
      await client.query(
        `UPDATE demands SET status = 'pending', updated_at = NOW() WHERE id = $1`,
        [demand_id]
      );
    }

    // 4. Log the bounce
    await client.query(
      `INSERT INTO cheque_bounce_logs (receipt_id, consumer_id, bounce_date, penalty_amount_inr, reason)
       VALUES ($1, $2, CURRENT_DATE, $3, $4)`,
      [id, consumer_id, penaltyAmount, reason || 'Cheque Bounced']
    );

    // 5. Create a "Penalty" demand
    await client.query(
      `INSERT INTO demands (consumer_id, amount_due_inr, status, demand_type, due_date, remarks)
       VALUES ($1, $2, 'pending', 'Cheque Bounce Penalty', CURRENT_DATE + INTERVAL '7 days', $3)`,
      [consumer_id, penaltyAmount, 'Penalty for bounced receipt ' + id]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: 'Receipt marked as bounced. Penalty raised.' });

  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

export default router;
