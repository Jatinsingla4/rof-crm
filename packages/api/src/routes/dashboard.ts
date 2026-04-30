/**
 * Dashboard Routes
 * Provides all panels: Pending Cheques, Demand Status, Pending Approval,
 * Employee Ticket Details, Daily Status, Parking Detail, Forthcoming Due
 */

import { Router, Response, NextFunction } from 'express';
import { db } from '../index';
import { AuthRequest } from '../index';

const router = Router();

// GET /api/dashboard/pending-cheques
router.get('/pending-cheques', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(`
      SELECT
        p.name as project,
        COUNT(r.id) FILTER (WHERE r.payment_method = 'cheque' AND r.status = 'pending') as pending,
        COUNT(r.id) FILTER (WHERE r.payment_method = 'cheque' AND r.status = 'deposited') as deposite,
        COUNT(r.id) FILTER (WHERE r.payment_method = 'cheque') as total,
        COUNT(r.id) FILTER (WHERE r.payment_method = 'demand_draft') as pdc,
        COALESCE(SUM(r.amount_received_inr) FILTER (WHERE r.payment_method = 'cheque'), 0) as amount,
        COALESCE(SUM(r.amount_received_inr) FILTER (WHERE r.payment_method = 'demand_draft'), 0) as pdc_amount
      FROM projects p
      LEFT JOIN payment_plans pp ON pp.project_id = p.id
      LEFT JOIN receipts r ON r.payment_plan_id = pp.id
      GROUP BY p.id, p.name
      HAVING COUNT(r.id) > 0
      ORDER BY p.name
    `);

    const totals = result.rows.reduce((acc: any, row: any) => ({
      pending:    (acc.pending || 0)    + parseInt(row.pending    || 0),
      deposite:   (acc.deposite || 0)   + parseInt(row.deposite   || 0),
      total:      (acc.total || 0)      + parseInt(row.total      || 0),
      pdc:        (acc.pdc || 0)        + parseInt(row.pdc        || 0),
      amount:     (acc.amount || 0)     + parseFloat(row.amount   || 0),
      pdc_amount: (acc.pdc_amount || 0) + parseFloat(row.pdc_amount || 0),
    }), {});

    res.json({ success: true, data: result.rows, totals });
  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/demand-status
router.get('/demand-status', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(`
      SELECT
        p.name as project,
        COUNT(d.id) FILTER (WHERE d.installment_index = 1 AND d.delivery_status = 'pending') as demand_unsend,
        COUNT(d.id) FILTER (WHERE d.installment_index = 1 AND d.delivery_status = 'sent') as demand_send,
        COUNT(d.id) FILTER (WHERE d.installment_index = 2 AND d.delivery_status = 'pending') as rem1_unsend,
        COUNT(d.id) FILTER (WHERE d.installment_index = 2 AND d.delivery_status = 'sent') as rem1_send,
        COUNT(d.id) FILTER (WHERE d.installment_index = 3 AND d.delivery_status = 'pending') as rem2_unsend,
        COUNT(d.id) FILTER (WHERE d.installment_index = 3 AND d.delivery_status = 'sent') as rem2_send,
        COUNT(d.id) FILTER (WHERE d.installment_index = 4 AND d.delivery_status = 'pending') as term_unsend,
        COUNT(d.id) FILTER (WHERE d.installment_index = 4 AND d.delivery_status = 'sent') as term_send,
        COUNT(d.id) as total,
        COALESCE(SUM(d.amount_due_inr) FILTER (WHERE d.due_date < NOW()), 0) as outstanding
      FROM projects p
      LEFT JOIN payment_plans pp ON pp.project_id = p.id
      LEFT JOIN demands d ON d.payment_plan_id = pp.id
      GROUP BY p.id, p.name
      ORDER BY p.name
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/pending-approval
router.get('/pending-approval', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(`
      SELECT
        r.id, r.amount_received_inr, r.payment_method, r.payment_date,
        r.reference_number, r.status,
        c.name as consumer_name, c.mobile,
        p.name as project_name,
        u.unit_number
      FROM receipts r
      JOIN consumers c ON r.consumer_id = c.id
      LEFT JOIN payment_plans pp ON r.payment_plan_id = pp.id
      LEFT JOIN projects p ON pp.project_id = p.id
      LEFT JOIN units u ON pp.unit_id = u.id
      WHERE r.status = 'pending'
      ORDER BY r.payment_date DESC
      LIMIT 50
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/daily-status
router.get('/daily-status', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const result = await db.query(`
      SELECT
        p.name as project,
        COUNT(bf.id) FILTER (WHERE bf.created_at::date = CURRENT_DATE) as sales_today,
        COALESCE(SUM(r.amount_received_inr) FILTER (WHERE r.payment_date::date = CURRENT_DATE), 0) as coll_today,
        COUNT(bf.id) FILTER (WHERE DATE_TRUNC('month', bf.created_at) = DATE_TRUNC('month', CURRENT_DATE)) as sales_month,
        COALESCE(SUM(r.amount_received_inr) FILTER (WHERE DATE_TRUNC('month', r.payment_date) = DATE_TRUNC('month', CURRENT_DATE)), 0) as coll_month,
        COUNT(bf.id) as sales_total,
        COALESCE(SUM(r.amount_received_inr), 0) as coll_total
      FROM projects p
      LEFT JOIN booking_forms bf ON bf.project_id = p.id
      LEFT JOIN payment_plans pp ON pp.project_id = p.id
      LEFT JOIN receipts r ON r.payment_plan_id = pp.id
      GROUP BY p.id, p.name
      ORDER BY p.name
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    // Fallback if booking_forms doesn't have data yet
    try {
      const result2 = await db.query(`
        SELECT
          p.name as project,
          0 as sales_today, 0 as sales_month, 0 as sales_total,
          COALESCE(SUM(r.amount_received_inr) FILTER (WHERE r.payment_date::date = CURRENT_DATE), 0) as coll_today,
          COALESCE(SUM(r.amount_received_inr) FILTER (WHERE DATE_TRUNC('month', r.payment_date) = DATE_TRUNC('month', CURRENT_DATE)), 0) as coll_month,
          COALESCE(SUM(r.amount_received_inr), 0) as coll_total
        FROM projects p
        LEFT JOIN payment_plans pp ON pp.project_id = p.id
        LEFT JOIN receipts r ON r.payment_plan_id = pp.id
        GROUP BY p.id, p.name
        ORDER BY p.name
      `);
      res.json({ success: true, data: result2.rows });
    } catch (e2) {
      next(e2);
    }
  }
});

// GET /api/dashboard/parking-detail
router.get('/parking-detail', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(`
      SELECT
        p.name as project,
        pt.name as parking_type,
        COUNT(ps.id) as total,
        COUNT(ps.id) FILTER (WHERE ps.status = 'allotted') as paid,
        COUNT(ps.id) FILTER (WHERE ps.status = 'available') as free,
        COUNT(ps.id) as total_issued,
        COUNT(ps.id) FILTER (WHERE ps.status = 'available') - COUNT(ps.id) FILTER (WHERE ps.status = 'allotted') as remaining
      FROM projects p
      LEFT JOIN parking_slots ps ON ps.project_id = p.id
      LEFT JOIN parking_types pt ON pt.id = ps.parking_type_id
      GROUP BY p.id, p.name, pt.name
      HAVING COUNT(ps.id) > 0
      ORDER BY p.name, pt.name
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/forthcoming-due
router.get('/forthcoming-due', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(`
      SELECT
        p.name as project_name,
        COUNT(d.id) FILTER (WHERE d.due_date = CURRENT_DATE) as today_dues,
        COUNT(d.id) FILTER (WHERE d.due_date > CURRENT_DATE AND d.due_date <= CURRENT_DATE + INTERVAL '7 days') as days_1_7,
        COUNT(d.id) FILTER (WHERE d.due_date > CURRENT_DATE + INTERVAL '7 days' AND d.due_date <= CURRENT_DATE + INTERVAL '14 days') as days_8_14,
        COUNT(d.id) FILTER (WHERE d.due_date > CURRENT_DATE + INTERVAL '14 days' AND d.due_date <= CURRENT_DATE + INTERVAL '21 days') as days_15_21,
        COUNT(d.id) FILTER (WHERE d.due_date > CURRENT_DATE + INTERVAL '21 days' AND d.due_date <= CURRENT_DATE + INTERVAL '28 days') as days_22_28
      FROM projects p
      LEFT JOIN payment_plans pp ON pp.project_id = p.id
      LEFT JOIN demands d ON d.payment_plan_id = pp.id AND d.delivery_status != 'paid'
      GROUP BY p.id, p.name
      ORDER BY p.name
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/employee-tickets
router.get('/employee-tickets', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(`
      SELECT
        u.name as employee_name,
        COUNT(t.id) as total_tickets,
        COUNT(t.id) FILTER (WHERE t.status = 'open') as open_tickets,
        COUNT(t.id) FILTER (WHERE t.status = 'in_progress') as in_progress,
        COUNT(t.id) FILTER (WHERE t.status = 'resolved') as resolved,
        COUNT(t.id) FILTER (WHERE t.due_date < NOW() AND t.status NOT IN ('completed','resolved')) as overdue
      FROM users u
      LEFT JOIN tasks t ON t.assigned_to = u.id
      WHERE u.is_active = true
      GROUP BY u.id, u.name
      HAVING COUNT(t.id) > 0
      ORDER BY open_tickets DESC
      LIMIT 20
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/summary - All panels in one call
router.get('/summary', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [cheques, demandStatus, pendingApproval, forthcomingDue] = await Promise.all([
      db.query(`
        SELECT p.name as project,
          COUNT(r.id) FILTER (WHERE r.payment_method = 'cheque' AND r.status = 'pending') as pending,
          COUNT(r.id) FILTER (WHERE r.payment_method = 'cheque' AND r.status = 'deposited') as deposite,
          COUNT(r.id) FILTER (WHERE r.payment_method = 'cheque') as total,
          COUNT(r.id) FILTER (WHERE r.payment_method = 'demand_draft') as pdc,
          COALESCE(SUM(r.amount_received_inr) FILTER (WHERE r.payment_method = 'cheque'), 0) as amount,
          COALESCE(SUM(r.amount_received_inr) FILTER (WHERE r.payment_method = 'demand_draft'), 0) as pdc_amount
        FROM projects p
        LEFT JOIN payment_plans pp ON pp.project_id = p.id
        LEFT JOIN receipts r ON r.payment_plan_id = pp.id
        GROUP BY p.id, p.name ORDER BY p.name
      `),
      db.query(`
        SELECT p.name as project,
          COUNT(d.id) FILTER (WHERE d.installment_index = 1 AND d.delivery_status = 'pending') as demand_unsend,
          COUNT(d.id) FILTER (WHERE d.installment_index = 1 AND d.delivery_status = 'sent') as demand_send,
          COUNT(d.id) FILTER (WHERE d.installment_index = 2 AND d.delivery_status = 'pending') as rem1_unsend,
          COUNT(d.id) FILTER (WHERE d.installment_index = 2 AND d.delivery_status = 'sent') as rem1_send,
          COUNT(d.id) FILTER (WHERE d.installment_index = 3 AND d.delivery_status = 'pending') as rem2_unsend,
          COUNT(d.id) FILTER (WHERE d.installment_index = 3 AND d.delivery_status = 'sent') as rem2_send,
          COUNT(d.id) FILTER (WHERE d.installment_index >= 4 AND d.delivery_status = 'pending') as term_unsend,
          COUNT(d.id) FILTER (WHERE d.installment_index >= 4 AND d.delivery_status = 'sent') as term_send,
          COUNT(d.id) as total,
          COALESCE(SUM(d.amount_due_inr) FILTER (WHERE d.due_date < NOW()), 0) as outstanding
        FROM projects p
        LEFT JOIN payment_plans pp ON pp.project_id = p.id
        LEFT JOIN demands d ON d.payment_plan_id = pp.id
        GROUP BY p.id, p.name ORDER BY p.name
      `),
      db.query(`
        SELECT r.id, r.amount_received_inr, r.payment_method, r.payment_date, r.reference_number,
               c.name as consumer_name, p.name as project_name
        FROM receipts r
        JOIN consumers c ON r.consumer_id = c.id
        LEFT JOIN payment_plans pp ON r.payment_plan_id = pp.id
        LEFT JOIN projects p ON pp.project_id = p.id
        WHERE r.status = 'pending' ORDER BY r.payment_date DESC LIMIT 20
      `),
      db.query(`
        SELECT p.name as project_name,
          COUNT(d.id) FILTER (WHERE d.due_date = CURRENT_DATE) as today_dues,
          COUNT(d.id) FILTER (WHERE d.due_date > CURRENT_DATE AND d.due_date <= CURRENT_DATE + INTERVAL '7 days') as days_1_7,
          COUNT(d.id) FILTER (WHERE d.due_date > CURRENT_DATE + INTERVAL '7 days' AND d.due_date <= CURRENT_DATE + INTERVAL '14 days') as days_8_14,
          COUNT(d.id) FILTER (WHERE d.due_date > CURRENT_DATE + INTERVAL '14 days' AND d.due_date <= CURRENT_DATE + INTERVAL '21 days') as days_15_21,
          COUNT(d.id) FILTER (WHERE d.due_date > CURRENT_DATE + INTERVAL '21 days' AND d.due_date <= CURRENT_DATE + INTERVAL '28 days') as days_22_28
        FROM projects p
        LEFT JOIN payment_plans pp ON pp.project_id = p.id
        LEFT JOIN demands d ON d.payment_plan_id = pp.id AND d.delivery_status != 'paid'
        GROUP BY p.id, p.name ORDER BY p.name
      `),
    ]);

    res.json({
      success: true,
      data: {
        pendingCheques:   cheques.rows,
        demandStatus:     demandStatus.rows,
        pendingApproval:  pendingApproval.rows,
        forthcomingDue:   forthcomingDue.rows,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
