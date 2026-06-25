"use strict";
/**
 * Dashboard Routes
 * Provides all panels: Pending Cheques, Demand Status, Pending Approval,
 * Employee Ticket Details, Daily Status, Parking Detail, Forthcoming Due
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_js_1 = require("../index.js");
const router = (0, express_1.Router)();
// GET /api/dashboard/pending-cheques
router.get('/pending-cheques', async (req, res, next) => {
    try {
        const result = await index_js_1.db.query(`
      SELECT
        p.id as project_id,
        p.name as project,
        COUNT(r.id) FILTER (WHERE r.payment_method::text = 'cheque' AND r.status::text = 'pending') as pending,
        COUNT(r.id) FILTER (WHERE r.payment_method::text = 'cheque' AND r.status::text = 'deposited') as deposite,
        COUNT(r.id) FILTER (WHERE r.payment_method::text = 'cheque') as total,
        COUNT(r.id) FILTER (WHERE r.payment_method::text = 'demand_draft') as pdc,
        COALESCE(SUM(r.amount_received_inr) FILTER (WHERE r.payment_method::text = 'cheque'), 0) as amount,
        COALESCE(SUM(r.amount_received_inr) FILTER (WHERE r.payment_method::text = 'demand_draft'), 0) as pdc_amount
      FROM projects p
      LEFT JOIN payment_plans pp ON pp.project_id = p.id
      LEFT JOIN receipts r ON r.payment_plan_id = pp.id
      GROUP BY p.id, p.name
      HAVING COUNT(r.id) > 0
      ORDER BY p.name
    `);
        const totals = result.rows.reduce((acc, row) => ({
            pending: (acc.pending || 0) + parseInt(row.pending || 0),
            deposite: (acc.deposite || 0) + parseInt(row.deposite || 0),
            total: (acc.total || 0) + parseInt(row.total || 0),
            pdc: (acc.pdc || 0) + parseInt(row.pdc || 0),
            amount: (acc.amount || 0) + parseFloat(row.amount || 0),
            pdc_amount: (acc.pdc_amount || 0) + parseFloat(row.pdc_amount || 0),
        }), {});
        res.json({ success: true, data: result.rows, totals });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/dashboard/demand-status
router.get('/demand-status', async (req, res, next) => {
    try {
        const result = await index_js_1.db.query(`
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
    }
    catch (error) {
        next(error);
    }
});
// GET /api/dashboard/pending-approval
router.get('/pending-approval', async (req, res, next) => {
    try {
        const result = await index_js_1.db.query(`
      SELECT
        r.id, r.amount_received_inr, r.payment_method, r.received_date,
        r.transaction_ref as reference_number, r.status,
        c.name as consumer_name, c.mobile,
        p.name as project_name,
        u.unit_number
      FROM receipts r
      JOIN consumers c ON r.consumer_id = c.id
      LEFT JOIN payment_plans pp ON r.payment_plan_id = pp.id
      LEFT JOIN projects p ON pp.project_id = p.id
      LEFT JOIN units u ON r.consumer_id = u.id -- Simple join for display
      WHERE r.status::text = 'pending'
      ORDER BY r.received_date DESC
      LIMIT 50
    `);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/dashboard/daily-status
router.get('/daily-status', async (req, res, next) => {
    try {
        const result = await index_js_1.db.query(`
      SELECT
        p.name as project,
        COUNT(br.id) FILTER (WHERE br.created_at::date = CURRENT_DATE) as sales_today,
        COALESCE(SUM(r.amount_received_inr) FILTER (WHERE r.received_date::date = CURRENT_DATE), 0) as coll_today,
        COUNT(br.id) FILTER (WHERE DATE_TRUNC('month', br.created_at) = DATE_TRUNC('month', CURRENT_DATE)) as sales_month,
        COALESCE(SUM(r.amount_received_inr) FILTER (WHERE DATE_TRUNC('month', r.received_date) = DATE_TRUNC('month', CURRENT_DATE)), 0) as coll_month,
        COUNT(br.id) as sales_total,
        COALESCE(SUM(r.amount_received_inr), 0) as coll_total
      FROM projects p
      LEFT JOIN booking_records br ON br.project_id = p.id
      LEFT JOIN payment_plans pp ON pp.project_id = p.id
      LEFT JOIN receipts r ON r.payment_plan_id = pp.id
        AND r.status = 'cleared'
        AND r.consumer_id NOT IN (
          SELECT brc.consumer_id FROM booking_records brc WHERE brc.status = 'cancelled'
        )
      GROUP BY p.id, p.name
      ORDER BY p.name
    `);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        // Fallback if booking_records doesn't have data yet
        try {
            const result2 = await index_js_1.db.query(`
        SELECT
          p.name as project,
          0 as sales_today, 0 as sales_month, 0 as sales_total,
          COALESCE(SUM(r.amount_received_inr) FILTER (WHERE r.received_date::date = CURRENT_DATE), 0) as coll_today,
          COALESCE(SUM(r.amount_received_inr) FILTER (WHERE DATE_TRUNC('month', r.received_date) = DATE_TRUNC('month', CURRENT_DATE)), 0) as coll_month,
          COALESCE(SUM(r.amount_received_inr), 0) as coll_total
        FROM projects p
        LEFT JOIN payment_plans pp ON pp.project_id = p.id
        LEFT JOIN receipts r ON r.payment_plan_id = pp.id
          AND r.status = 'cleared'
          AND r.consumer_id NOT IN (
            SELECT brc.consumer_id FROM booking_records brc WHERE brc.status = 'cancelled'
          )
        GROUP BY p.id, p.name
        ORDER BY p.name
      `);
            res.json({ success: true, data: result2.rows });
        }
        catch (e2) {
            next(e2);
        }
    }
});
// GET /api/dashboard/parking-detail
router.get('/parking-detail', async (req, res, next) => {
    try {
        const result = await index_js_1.db.query(`
      SELECT
        p.name as project,
        ps.parking_type,
        COUNT(ps.id) as total,
        COUNT(ps.id) FILTER (WHERE ps.status = 'allotted') as paid,
        COUNT(ps.id) FILTER (WHERE ps.status = 'available') as free,
        COUNT(ps.id) as total_issued,
        (COUNT(ps.id) FILTER (WHERE ps.status = 'available')) as remaining
      FROM projects p
      LEFT JOIN parking_slots ps ON ps.project_id = p.id
      GROUP BY p.id, p.name, ps.parking_type
      HAVING COUNT(ps.id) > 0
      ORDER BY p.name, ps.parking_type
    `);
        res.json({ success: true, data: result.rows });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/dashboard/forthcoming-due
router.get('/forthcoming-due', async (req, res, next) => {
    try {
        const result = await index_js_1.db.query(`
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
    }
    catch (error) {
        next(error);
    }
});
// GET /api/dashboard/employee-tickets
router.get('/employee-tickets', async (req, res, next) => {
    try {
        const result = await index_js_1.db.query(`
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
    }
    catch (error) {
        next(error);
    }
});
// GET /api/dashboard/summary - All panels in one call
router.get('/summary', async (req, res, next) => {
    try {
        const [cheques, demandStatus, pendingApproval, forthcomingDue] = await Promise.all([
            index_js_1.db.query(`
        SELECT p.id as project_id, p.name as project,
          COUNT(r.id) FILTER (WHERE r.payment_method::text = 'cheque' AND r.status::text = 'pending') as pending,
          COUNT(r.id) FILTER (WHERE r.payment_method::text = 'cheque' AND r.status::text = 'deposited') as deposite,
          COUNT(r.id) FILTER (WHERE r.payment_method::text = 'cheque') as total,
          COUNT(r.id) FILTER (WHERE r.payment_method::text = 'demand_draft') as pdc,
          COALESCE(SUM(r.amount_received_inr) FILTER (WHERE r.payment_method::text = 'cheque'), 0) as amount,
          COALESCE(SUM(r.amount_received_inr) FILTER (WHERE r.payment_method::text = 'demand_draft'), 0) as pdc_amount
        FROM projects p
        LEFT JOIN payment_plans pp ON pp.project_id = p.id
        LEFT JOIN receipts r ON r.payment_plan_id = pp.id
        GROUP BY p.id, p.name ORDER BY p.name
      `),
            index_js_1.db.query(`
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
            index_js_1.db.query(`
        SELECT r.id, r.amount_received_inr, r.payment_method, r.received_date, r.transaction_ref as reference_number,
               c.name as consumer_name, p.name as project_name, r.status
        FROM receipts r
        JOIN consumers c ON r.consumer_id = c.id
        LEFT JOIN payment_plans pp ON r.payment_plan_id = pp.id
        LEFT JOIN projects p ON pp.project_id = p.id
        WHERE r.status::text = 'pending' ORDER BY r.received_date DESC LIMIT 20
      `),
            index_js_1.db.query(`
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
                pendingCheques: cheques.rows,
                demandStatus: demandStatus.rows,
                pendingApproval: pendingApproval.rows,
                forthcomingDue: forthcomingDue.rows,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=dashboard.js.map