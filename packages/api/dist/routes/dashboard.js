"use strict";
/**
 * Dashboard Routes
 * Every panel is one query, written once; the single routes and /summary both call it, so a number cannot differ between them.
 * "Today" is the date in India (the server runs in UTC). Cancelled demands and receipts are never counted.
 * Project scope applies (a user sees only the projects given to them).
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_js_1 = require("../index.js");
const input_js_1 = require("../utils/input.js");
const business_date_js_1 = require("../utils/business-date.js");
const router = (0, express_1.Router)();
const TODAY = business_date_js_1.SQL_TODAY; // the business day (Asia/Kolkata), shared with every other module
const RAISED = `d.status IN ('demanded','raised')`; // a demand that was raised (pending = not yet raised, paid / cancelled are done)
const LIVE_RECEIPT = `r.status NOT IN ('cancelled','bounced')`;
const GROSS = `(d.amount_due_inr + COALESCE(d.cgst_amount,0) + COALESCE(d.sgst_amount,0) + COALESCE(d.addon_charge_amount,0) + COALESCE(d.addon_cgst_amount,0) + COALESCE(d.addon_sgst_amount,0))`;
const SALE = `br.status IN ('complete','pending_payment','active')`; // the same rule the reports use for a sale
const CHEQUE = `r.payment_method::text IN ('cheque','bank_transfer')`;
// What a Daily Status number counts, written once: the card sums these and the list behind a number shows these rows.
const SALE_DAY = `COALESCE(br.booking_date, (br.created_at AT TIME ZONE 'Asia/Kolkata')::date)`;
const COLLECTED = `r.status = 'cleared'
           AND NOT (EXISTS (SELECT 1 FROM booking_records x WHERE x.consumer_id = r.consumer_id AND x.unit_id = pp.unit_id AND x.status = 'cancelled')
                    AND NOT EXISTS (SELECT 1 FROM booking_records y WHERE y.consumer_id = r.consumer_id AND y.unit_id = pp.unit_id AND y.status IN ('complete','pending_payment','active')))`;
const PERIOD = (col, period) => period === 'today' ? `${col} = ${TODAY}` : period === 'month' ? `date_trunc('month', ${col}) = date_trunc('month', ${TODAY})` : 'TRUE';
const IN_FLIGHT = `r.status NOT IN ('cancelled','bounced','cleared') AND NOT COALESCE(r.is_advance, false)`; // an advance receipt only splits money another receipt already holds             // not yet in the bank
const panels = {
    // cheques and demand drafts that are not in the bank yet, per project
    pendingCheques: () => index_js_1.db.query(`
    SELECT p.id AS project_id, p.name AS project,
           COUNT(r.id) FILTER (WHERE ${CHEQUE} AND r.status <> 'deposited')::int AS pending,   -- not yet deposited (pending or authorized), so pending + deposited = total
           COUNT(r.id) FILTER (WHERE ${CHEQUE} AND r.status = 'deposited')::int AS deposite,
           COUNT(r.id) FILTER (WHERE ${CHEQUE})::int                            AS total,
           COUNT(r.id) FILTER (WHERE r.payment_method::text = 'demand_draft')::int AS pdc,
           COALESCE(SUM(r.amount_received_inr) FILTER (WHERE ${CHEQUE}), 0)::float AS amount,
           COALESCE(SUM(r.amount_received_inr) FILTER (WHERE r.payment_method::text = 'demand_draft'), 0)::float AS pdc_amount
      FROM projects p
      JOIN payment_plans pp ON pp.project_id = p.id
      JOIN receipts r ON r.payment_plan_id = pp.id AND ${IN_FLIGHT}
     GROUP BY p.id, p.name ORDER BY p.name`),
    // raised demands per project: letters sent and not sent for instalment 1, 2, 3 and 4+, and what is overdue
    demandStatus: () => index_js_1.db.query(`
    SELECT p.id AS project_id, p.name AS project,
           COUNT(d.id) FILTER (WHERE d.installment_index = 1 AND COALESCE(d.delivery_status, '') <> 'sent')::int AS demand_unsend,
           COUNT(d.id) FILTER (WHERE d.installment_index = 1 AND d.delivery_status = 'sent')::int  AS demand_send,
           COUNT(d.id) FILTER (WHERE d.installment_index = 2 AND COALESCE(d.delivery_status, '') <> 'sent')::int AS rem1_unsend,
           COUNT(d.id) FILTER (WHERE d.installment_index = 2 AND d.delivery_status = 'sent')::int  AS rem1_send,
           COUNT(d.id) FILTER (WHERE d.installment_index = 3 AND COALESCE(d.delivery_status, '') <> 'sent')::int AS rem2_unsend,
           COUNT(d.id) FILTER (WHERE d.installment_index = 3 AND d.delivery_status = 'sent')::int  AS rem2_send,
           COUNT(d.id) FILTER (WHERE d.installment_index >= 4 AND COALESCE(d.delivery_status, '') <> 'sent')::int AS term_unsend,
           COUNT(d.id) FILTER (WHERE d.installment_index >= 4 AND d.delivery_status = 'sent')::int  AS term_send,
           COUNT(d.id)::int AS total,
           COALESCE(SUM(${GROSS}) FILTER (WHERE d.due_date < ${TODAY}), 0)::float AS outstanding
      FROM projects p
      JOIN payment_plans pp ON pp.project_id = p.id
      JOIN demands d ON d.payment_plan_id = pp.id AND ${RAISED}
     GROUP BY p.id, p.name ORDER BY p.name`),
    // receipts waiting for the checker (the newest 50, and how many there are in all)
    pendingApproval: async () => {
        const rows = await index_js_1.db.query(`
      SELECT r.id, r.amount_received_inr, r.payment_method, r.received_date, r.received_date AS payment_date, r.transaction_ref AS reference_number, r.status,
             c.name AS consumer_name, c.mobile, p.name AS project_name, u.unit_number
        FROM receipts r
        JOIN consumers c ON c.id = r.consumer_id
        LEFT JOIN payment_plans pp ON pp.id = r.payment_plan_id
        LEFT JOIN projects p ON p.id = pp.project_id
        LEFT JOIN units u ON u.id = pp.unit_id
       WHERE r.status = 'pending' ORDER BY r.received_date DESC, r.created_at DESC, r.id LIMIT 50`);
        const n = (await index_js_1.db.query(`SELECT COUNT(*)::int AS n FROM receipts WHERE status = 'pending'`)).rows[0].n;
        return { rows: rows.rows, count: n };
    },
    // sales (live bookings) and collection (cleared receipts) per project: today, this month, in all. Two separate sums, so a booking is never counted once per receipt.
    dailyStatus: () => index_js_1.db.query(`
    SELECT p.id AS project_id, p.name AS project,
           COALESCE(s.today, 0)::int AS sales_today, COALESCE(c.today, 0)::float AS coll_today,
           COALESCE(s.month, 0)::int AS sales_month, COALESCE(c.month, 0)::float AS coll_month,
           COALESCE(s.total, 0)::int AS sales_total, COALESCE(c.total, 0)::float AS coll_total
      FROM projects p
      LEFT JOIN (
        SELECT br.project_id,
               COUNT(*) FILTER (WHERE ${PERIOD(SALE_DAY, 'today')}) AS today,
               COUNT(*) FILTER (WHERE ${PERIOD(SALE_DAY, 'month')}) AS month,
               COUNT(*) AS total
          FROM booking_records br WHERE ${SALE} GROUP BY br.project_id) s ON s.project_id = p.id
      LEFT JOIN (
        SELECT pp.project_id,
               SUM(r.amount_received_inr) FILTER (WHERE ${PERIOD('r.received_date', 'today')}) AS today,
               SUM(r.amount_received_inr) FILTER (WHERE ${PERIOD('r.received_date', 'month')}) AS month,
               SUM(r.amount_received_inr) AS total
          FROM receipts r JOIN payment_plans pp ON pp.id = r.payment_plan_id
         WHERE ${COLLECTED}
         GROUP BY pp.project_id) c ON c.project_id = p.id
     WHERE s.project_id IS NOT NULL OR c.project_id IS NOT NULL
     ORDER BY p.name`),
    // parking slots per project and type
    parkingDetail: () => index_js_1.db.query(`
    SELECT p.name AS project, ps.parking_type, COUNT(ps.id)::int AS total,
           COUNT(ps.id) FILTER (WHERE ps.status = 'allotted')::int  AS allotted,
           COUNT(ps.id) FILTER (WHERE ps.status = 'available')::int AS available
      FROM projects p JOIN parking_slots ps ON ps.project_id = p.id
     GROUP BY p.id, p.name, ps.parking_type ORDER BY p.name, ps.parking_type`),
    // raised, unpaid demands falling due today and in the next four weeks
    forthcomingDue: () => index_js_1.db.query(`
    SELECT p.name AS project_name,
           COUNT(d.id) FILTER (WHERE d.due_date = ${TODAY})::int AS today_dues,
           COUNT(d.id) FILTER (WHERE d.due_date > ${TODAY} AND d.due_date <= ${TODAY} + 7)::int AS days_1_7,
           COUNT(d.id) FILTER (WHERE d.due_date > ${TODAY} + 7 AND d.due_date <= ${TODAY} + 14)::int AS days_8_14,
           COUNT(d.id) FILTER (WHERE d.due_date > ${TODAY} + 14 AND d.due_date <= ${TODAY} + 21)::int AS days_15_21,
           COUNT(d.id) FILTER (WHERE d.due_date > ${TODAY} + 21 AND d.due_date <= ${TODAY} + 28)::int AS days_22_28
      FROM projects p
      JOIN payment_plans pp ON pp.project_id = p.id
      JOIN demands d ON d.payment_plan_id = pp.id AND ${RAISED}
     GROUP BY p.id, p.name ORDER BY p.name`),
    // the tasks of each active employee (the dashboard calls them tickets; the screen behind it is Tasks)
    employeeTasks: () => index_js_1.db.query(`
    SELECT u.name AS employee_name, COUNT(t.id)::int AS total,
           COUNT(t.id) FILTER (WHERE t.status = 'pending')::int   AS pending,
           COUNT(t.id) FILTER (WHERE t.status = 'completed')::int AS completed,
           COUNT(t.id) FILTER (WHERE t.status = 'pending' AND t.due_date < ${TODAY})::int AS overdue
      FROM users u JOIN tasks t ON t.assigned_to = u.id
     WHERE u.is_active = true
     GROUP BY u.id, u.name ORDER BY pending DESC, u.name, u.id LIMIT 20`),
};
const send = (run, shape) => async (_req, res, next) => {
    try {
        const r = await run();
        res.json(shape ? shape(r) : { success: true, data: r.rows });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
};
router.get('/pending-cheques', send(panels.pendingCheques, (r) => ({
    success: true, data: r.rows,
    totals: r.rows.reduce((a, x) => ({ pending: a.pending + x.pending, deposite: a.deposite + x.deposite, total: a.total + x.total, pdc: a.pdc + x.pdc, amount: a.amount + x.amount, pdc_amount: a.pdc_amount + x.pdc_amount }), { pending: 0, deposite: 0, total: 0, pdc: 0, amount: 0, pdc_amount: 0 }),
})));
router.get('/demand-status', send(panels.demandStatus));
// ---- the list behind a number on the cards ---------------------------------------------------------------------------------------------
// projectId is a project, or "all" for the Total row. At most 500 rows are returned; "count" is the true number so the screen can say so.
const listArgs = (q) => {
    const projectId = String(q.projectId || '');
    if (projectId !== 'all' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId))
        throw Object.assign(new Error('projectId must be a project id or "all"'), { http: 400 });
    return projectId;
};
const oneOf = (v, name, list) => { if (!list.includes(v))
    throw Object.assign(new Error(`${name} must be one of ${list.join(', ')}`), { http: 400 }); return v; };
const LIST_MAX = 500;
const PERSON = `COALESCE(NULLIF(TRIM(CONCAT_WS(' ', c.first_name, c.last_name)), ''), c.name)`;
// GET /api/dashboard/demand-status/list?projectId=&bucket=demand|rem1|rem2|term&sent=sent|unsent  (the raised demands one Send or UnSend number counts)
const BUCKETS = { demand: 'd.installment_index = 1', rem1: 'd.installment_index = 2', rem2: 'd.installment_index = 3', term: 'd.installment_index >= 4' };
router.get('/demand-status/list', async (req, res, next) => {
    try {
        const projectId = listArgs(req.query);
        const bucket = oneOf(req.query.bucket, 'bucket', Object.keys(BUCKETS));
        const sent = oneOf(req.query.sent, 'sent', ['sent', 'unsent']) === 'sent';
        const where = `${RAISED} AND ${BUCKETS[bucket]} AND ${sent ? `d.delivery_status = 'sent'` : `COALESCE(d.delivery_status, '') <> 'sent'`} AND ($1::text = 'all' OR p.id = $1::uuid)`;
        const base = `FROM projects p JOIN payment_plans pp ON pp.project_id = p.id JOIN demands d ON d.payment_plan_id = pp.id
                   JOIN consumers c ON c.id = d.consumer_id LEFT JOIN units u ON u.id = pp.unit_id LEFT JOIN towers t ON t.id = u.tower_id WHERE ${where}`;
        const [rows, n] = await Promise.all([
            index_js_1.db.query(`SELECT d.id, p.name AS project, c.id AS consumer_id, c.registration_no, ${PERSON} AS name, c.mobile, t.tower_name, u.unit_number, d.installment_index,
                       d.demand_type, d.status, d.due_date::text AS due_date, d.delivery_status, ${GROSS}::float AS amount
                  ${base} ORDER BY p.name, c.name, d.installment_index, d.id LIMIT ${LIST_MAX}`, [projectId]),
            index_js_1.db.query(`SELECT COUNT(*)::int AS n, COALESCE(SUM(${GROSS}), 0)::float AS amount ${base}`, [projectId]),
        ]);
        res.json({ success: true, data: rows.rows, count: n.rows[0].n, amount: n.rows[0].amount, truncated: n.rows[0].n > rows.rows.length });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
// GET /api/dashboard/daily-status/list?projectId=&kind=sales|collection&period=today|month|total  (the bookings, or the cleared receipts, one number counts)
router.get('/daily-status/list', async (req, res, next) => {
    try {
        const projectId = listArgs(req.query);
        const kind = oneOf(req.query.kind, 'kind', ['sales', 'collection']);
        const period = oneOf(req.query.period, 'period', ['today', 'month', 'total']);
        if (kind === 'sales') {
            const base = `FROM booking_records br JOIN consumers c ON c.id = br.consumer_id LEFT JOIN units u ON u.id = br.unit_id LEFT JOIN towers t ON t.id = u.tower_id JOIN projects p ON p.id = br.project_id
                     WHERE ${SALE} AND ${PERIOD(SALE_DAY, period)} AND ($1::text = 'all' OR br.project_id = $1::uuid)`;
            const [rows, n] = await Promise.all([
                index_js_1.db.query(`SELECT br.id, p.name AS project, c.id AS consumer_id, c.registration_no, ${PERSON} AS name, c.mobile, t.tower_name, u.unit_number, ${SALE_DAY}::text AS booking_date,
                         br.booking_amount::float AS booking_amount, br.status
                    ${base} ORDER BY ${SALE_DAY} DESC, br.created_at DESC, br.id LIMIT ${LIST_MAX}`, [projectId]),
                index_js_1.db.query(`SELECT COUNT(*)::int AS n ${base}`, [projectId]),
            ]);
            return res.json({ success: true, kind, data: rows.rows, count: n.rows[0].n, amount: null, truncated: n.rows[0].n > rows.rows.length });
        }
        const base = `FROM receipts r JOIN payment_plans pp ON pp.id = r.payment_plan_id JOIN projects p ON p.id = pp.project_id JOIN consumers c ON c.id = r.consumer_id
                   LEFT JOIN units u ON u.id = pp.unit_id LEFT JOIN towers t ON t.id = u.tower_id
                   WHERE ${COLLECTED} AND ${PERIOD('r.received_date', period)} AND ($1::text = 'all' OR pp.project_id = $1::uuid)`;
        const [rows, n] = await Promise.all([
            index_js_1.db.query(`SELECT r.id, p.name AS project, c.id AS consumer_id, c.registration_no, ${PERSON} AS name, t.tower_name, u.unit_number, r.receipt_number, r.received_date::text AS received_date,
                       r.payment_method::text AS payment_method, r.amount_received_inr::float AS amount
                  ${base} ORDER BY r.received_date DESC, r.created_at DESC, r.id LIMIT ${LIST_MAX}`, [projectId]),
            index_js_1.db.query(`SELECT COUNT(*)::int AS n, COALESCE(SUM(r.amount_received_inr), 0)::float AS amount ${base}`, [projectId]),
        ]);
        res.json({ success: true, kind, data: rows.rows, count: n.rows[0].n, amount: n.rows[0].amount, truncated: n.rows[0].n > rows.rows.length });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
router.get('/pending-approval', send(panels.pendingApproval, (r) => ({ success: true, data: r.rows, count: r.count })));
router.get('/daily-status', send(panels.dailyStatus));
router.get('/parking-detail', send(panels.parkingDetail));
router.get('/forthcoming-due', send(panels.forthcomingDue));
router.get('/employee-tickets', send(panels.employeeTasks));
// GET /api/dashboard/summary - the four panels the home screen shows, in one call
router.get('/summary', async (_req, res, next) => {
    try {
        const [cheques, demandStatus, approval, forthcoming] = await Promise.all([panels.pendingCheques(), panels.demandStatus(), panels.pendingApproval(), panels.forthcomingDue()]);
        res.json({
            success: true,
            data: { pendingCheques: cheques.rows, demandStatus: demandStatus.rows, pendingApproval: approval.rows, pendingApprovalCount: approval.count, forthcomingDue: forthcoming.rows },
        });
    }
    catch (error) {
        (0, input_js_1.failWith)(error, res, next);
    }
});
exports.default = router;
//# sourceMappingURL=dashboard.js.map