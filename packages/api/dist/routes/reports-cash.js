"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Reports: money that came in (collection) and the bank views.
 * Collection = CLEARED receipts, not the synthetic "advance" copy of an overpayment (that would count the money twice).
 * Pending, deposited, on-hold, bounced and cancelled receipts are not collection; the receipt wise list shows them with their status.
 * A receipt belongs to the project of its payment plan, else to the project of the applicant.
 */
const express_1 = require("express");
const pool_js_1 = require("../db/pool.js");
const input_js_1 = require("../utils/input.js");
const report_input_js_1 = require("../utils/report-input.js");
const reports_dues_js_1 = require("./reports-dues.js");
const report_ledger_js_1 = require("../utils/report-ledger.js");
const company_bank_js_1 = require("../utils/company-bank.js");
const business_date_js_1 = require("../utils/business-date.js");
const router = (0, express_1.Router)();
const CASH = `r.status = 'cleared' AND r.is_advance IS NOT TRUE`;
const PROJECT = `COALESCE(pp.project_id, c.project_id)`;
const RECEIPT_FROM = `FROM receipts r JOIN consumers c ON c.id = r.consumer_id LEFT JOIN payment_plans pp ON pp.id = r.payment_plan_id`;
const RECEIPT_STATUS = ['pending', 'authorized', 'deposited', 'on_hold', 'cleared', 'bounced', 'cancelled'];
const PAYMENT_METHOD = ['cash', 'cheque', 'demand_draft', 'neft', 'rtgs', 'upi', 'bank_transfer', 'card', 'tds_challan'];
const num = (v) => (v === null || v === undefined ? 0 : Number(v));
// banks are company wide (outgoing payments have no project), so a login limited to projects cannot see them
const notScoped = (what) => { if ((0, pool_js_1.isScoped)())
    throw (0, input_js_1.bad)(`${what} is company wide and is not available to a login limited to projects`, 403); };
router.get('/monthly-collection', (0, reports_dues_js_1.h)(async (req, res) => {
    const x = (0, reports_dues_js_1.Q)(req);
    const r = await pool_js_1.db.query(`SELECT TO_CHAR(DATE_TRUNC('month', r.received_date), 'YYYY-MM-DD') AS month, COUNT(*)::int AS receipt_count, SUM(r.amount_received_inr) AS amount_collected_inr
       ${RECEIPT_FROM} WHERE ${CASH} AND ($1::uuid IS NULL OR ${PROJECT} = $1::uuid)
      GROUP BY 1 ORDER BY 1 DESC`, [x.projectId || null]);
    res.json({ success: true, data: r.rows.map((m) => ({ ...m, amount_collected_inr: num(m.amount_collected_inr) })) });
}));
router.get('/year-month-collection', (0, reports_dues_js_1.h)(async (req, res) => {
    const x = (0, reports_dues_js_1.Q)(req);
    const r = await pool_js_1.db.query(`SELECT EXTRACT(YEAR FROM r.received_date)::int AS yr, EXTRACT(MONTH FROM r.received_date)::int AS mo, SUM(r.amount_received_inr) AS total
       ${RECEIPT_FROM} WHERE ${CASH} AND ($1::uuid IS NULL OR ${PROJECT} = $1::uuid) GROUP BY 1, 2 ORDER BY 1, 2`, [x.projectId || null]);
    const cur = (0, business_date_js_1.businessYear)();
    const years = r.rows.map((a) => a.yr);
    const minYear = years.length ? Math.min(...years) : cur, maxYear = years.length ? Math.max(...years) : cur;
    const cell = new Map(r.rows.map((a) => [`${a.yr}-${a.mo}`, num(a.total)]));
    const monthTotals = Array(12).fill(0);
    const grid = [];
    for (let y = minYear; y <= maxYear; y++) {
        const months = Array.from({ length: 12 }, (_, i) => cell.get(`${y}-${i + 1}`) || 0);
        months.forEach((v, i) => { monthTotals[i] += v; });
        grid.push({ year: y, months, total: (0, report_ledger_js_1.r2)(months.reduce((a, b) => a + b, 0)) });
    }
    res.json({ success: true, data: grid, monthTotals: monthTotals.map(report_ledger_js_1.r2), grandTotal: (0, report_ledger_js_1.r2)(grid.reduce((a, g) => a + g.total, 0)) });
}));
router.get('/project-collection', (0, reports_dues_js_1.h)(async (req, res) => {
    const x = (0, reports_dues_js_1.Q)(req);
    const from = x.fromDate || null, to = x.toDate || null, pid = x.projectId || null;
    const inRange = (col) => `($2::date IS NULL OR ${col} >= $2::date) AND ($3::date IS NULL OR ${col} <= $3::date)`;
    const rows = (await pool_js_1.db.query(`WITH pr AS (SELECT r.id, r.status, r.payment_method::text AS pm, r.amount_received_inr, r.received_date, r.is_advance, ${PROJECT} AS project_id ${RECEIPT_FROM})
     SELECT p.id AS project_id, p.name AS project_name,
        COALESCE(SUM(pr.amount_received_inr) FILTER (WHERE pr.status = 'cleared' AND pr.is_advance IS NOT TRUE AND pr.pm = 'cheque' AND ${inRange('pr.received_date')}), 0) AS cheque_amount,
        COALESCE(SUM(pr.amount_received_inr) FILTER (WHERE pr.status = 'cleared' AND pr.is_advance IS NOT TRUE AND pr.pm = 'demand_draft' AND ${inRange('pr.received_date')}), 0) AS draft_amount,
        COALESCE(SUM(pr.amount_received_inr) FILTER (WHERE pr.status = 'cleared' AND pr.is_advance IS NOT TRUE AND pr.pm IN ('neft','rtgs','upi','bank_transfer','card') AND ${inRange('pr.received_date')}), 0) AS online_amount,
        COALESCE(SUM(pr.amount_received_inr) FILTER (WHERE pr.status = 'cleared' AND pr.is_advance IS NOT TRUE AND pr.pm = 'cash' AND ${inRange('pr.received_date')}), 0) AS cash_amount,
        COALESCE(SUM(pr.amount_received_inr) FILTER (WHERE pr.status = 'cleared' AND pr.is_advance IS NOT TRUE AND (pr.pm IS NULL OR pr.pm NOT IN ('cheque','demand_draft','neft','rtgs','upi','bank_transfer','card','cash')) AND ${inRange('pr.received_date')}), 0) AS other_amount,
        COALESCE(SUM(pr.amount_received_inr) FILTER (WHERE pr.status = 'cleared' AND pr.is_advance IS NOT TRUE AND ${inRange('pr.received_date')}), 0) AS total_amount,
        COALESCE(SUM(pr.amount_received_inr) FILTER (WHERE pr.status IN ('pending','authorized','deposited','on_hold') AND pr.is_advance IS NOT TRUE AND ${inRange('pr.received_date')}), 0) AS uncleared_amount,
        COUNT(*) FILTER (WHERE pr.status = 'cleared' AND pr.is_advance IS NOT TRUE AND ${inRange('pr.received_date')}) AS normal_count,
        COUNT(*) FILTER (WHERE pr.status = 'cancelled' AND ${inRange('pr.received_date')}) AS cancel_count,
        COUNT(*) FILTER (WHERE pr.status = 'bounced' AND ${inRange('pr.received_date')}) AS bounce_count
       FROM projects p LEFT JOIN pr ON pr.project_id = p.id
      WHERE ($1::uuid IS NULL OR p.id = $1::uuid)
      GROUP BY p.id, p.name ORDER BY p.name`, [pid, from, to])).rows.map((r) => ({
        project_id: r.project_id, project_name: r.project_name,
        cheque_amount: num(r.cheque_amount), draft_amount: num(r.draft_amount), online_amount: num(r.online_amount), cash_amount: num(r.cash_amount), other_amount: num(r.other_amount),
        total_amount: num(r.total_amount), uncleared_amount: num(r.uncleared_amount), normal_count: num(r.normal_count), cancel_count: num(r.cancel_count), bounce_count: num(r.bounce_count),
        total_collection: num(r.total_amount),
    }));
    const T = (k) => (0, report_ledger_js_1.r2)(rows.reduce((a, r) => a + r[k], 0));
    const totals = Object.fromEntries(['cheque_amount', 'draft_amount', 'online_amount', 'cash_amount', 'other_amount', 'total_amount', 'uncleared_amount', 'normal_count', 'cancel_count', 'bounce_count', 'total_collection'].map((k) => [k, T(k)]));
    const co = rows.length ? await pool_js_1.db.query(`SELECT DISTINCT c.name FROM projects p JOIN companies c ON c.id = p.company_id WHERE p.id = ANY($1::uuid[])`, [rows.map((r) => r.project_id)]) : { rows: [] };
    const dflt = (await pool_js_1.db.query(`SELECT value FROM global_settings WHERE key = 'company_name' LIMIT 1`)).rows[0]?.value || 'Company';
    res.json({ success: true, data: rows, totals, companyName: co.rows.length === 1 ? co.rows[0].name : dflt });
}));
const LIST_CAP = 20000;
router.get('/receipt-wise-collection', (0, reports_dues_js_1.h)(async (req, res) => {
    const x = (0, reports_dues_js_1.Q)(req);
    const status = (0, report_input_js_1.pick)(x.status, 'status', RECEIPT_STATUS, '');
    const method = (0, report_input_js_1.pick)(x.paymentMethod, 'paymentMethod', PAYMENT_METHOD, '');
    const r = await pool_js_1.db.query(`SELECT r.id, r.receipt_number, r.received_date::text AS received_date, TRIM(CONCAT_WS(' ', c.salutation, c.first_name, c.last_name)) AS consumer_name, c.name AS consumer_full_name, c.registration_no,
            pr.name AS project_name, t.tower_name, u.unit_number, r.payment_method, r.amount_received_inr, r.status, r.is_advance, r.bank_name,
            CASE WHEN r.payment_method = 'cheque' THEN r.cheque_no ELSE r.transaction_ref END AS reference
       ${RECEIPT_FROM}
       LEFT JOIN projects pr ON pr.id = ${PROJECT}
       LEFT JOIN units u ON u.id = pp.unit_id
       LEFT JOIN towers t ON t.id = u.tower_id
      WHERE ($1::uuid IS NULL OR ${PROJECT} = $1::uuid) AND ($2::date IS NULL OR r.received_date >= $2::date) AND ($3::date IS NULL OR r.received_date <= $3::date)
        AND ($4::text IS NULL OR r.status = $4::text) AND ($5::text IS NULL OR r.payment_method::text = $5::text)
      ORDER BY r.received_date DESC, r.receipt_number DESC LIMIT ${LIST_CAP + 1}`, [x.projectId || null, x.fromDate || null, x.toDate || null, status || null, method || null]);
    const truncated = r.rows.length > LIST_CAP;
    const rows = r.rows.slice(0, LIST_CAP).map((a) => ({ ...a, consumer_name: a.consumer_name || a.consumer_full_name }));
    res.json({ success: true, data: rows, truncated, total: rows.length });
}));
router.get('/cash-bank-summary', (0, reports_dues_js_1.h)(async (req, res) => {
    notScoped('The cash and bank summary');
    const x = (0, reports_dues_js_1.Q)(req);
    const r = await pool_js_1.db.query(`SELECT cba.id, cba.bank_name, cba.account_name, cba.account_number,
            COALESCE((SELECT SUM(r.amount_received_inr) FROM receipts r WHERE r.company_bank_account_id = cba.id AND ${CASH} AND ($4::date IS NULL OR r.received_date >= $4::date) AND ($5::date IS NULL OR r.received_date <= $5::date)), 0) AS credit,
            COALESCE((SELECT SUM(op.amount_inr) FROM outgoing_payments op WHERE op.company_bank_account_id = cba.id AND op.status = 'cleared' AND ($4::date IS NULL OR op.payment_date >= $4::date) AND ($5::date IS NULL OR op.payment_date <= $5::date)), 0) AS debit
       FROM company_bank_accounts cba
      WHERE cba.is_active = true AND ($1::uuid IS NULL OR cba.company_id = $1::uuid)
        AND ($2::uuid IS NULL OR cba.company_id = (SELECT company_id FROM projects WHERE id = $2::uuid)) AND ($3::uuid IS NULL OR cba.id = $3::uuid)
      ORDER BY cba.is_primary DESC, cba.bank_name`, [x.companyId || null, x.projectId || null, x.companyBankAccountId || null, x.fromDate || null, x.toDate || null]);
    res.json({ success: true, data: r.rows.map((a) => ({ id: a.id, bank_name: a.bank_name, account_name: a.account_name, account_number: (0, company_bank_js_1.forRole)(req.userRole, a).account_number, credit: num(a.credit), debit: num(a.debit), closing_balance: (0, report_ledger_js_1.r2)(num(a.credit) - num(a.debit)) })) });
}));
router.get('/ledger-monthly-summary/:companyBankAccountId', (0, reports_dues_js_1.h)(async (req, res) => {
    notScoped('The ledger summary');
    const x = (0, reports_dues_js_1.Q)(req);
    const id = req.params.companyBankAccountId;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
        throw (0, input_js_1.bad)('companyBankAccountId is not valid');
    const [cr, dr] = await Promise.all([
        pool_js_1.db.query(`SELECT EXTRACT(YEAR FROM r.received_date)::int AS yr, EXTRACT(MONTH FROM r.received_date)::int AS mo, SUM(r.amount_received_inr) AS credit FROM receipts r
               WHERE r.company_bank_account_id = $1 AND ${CASH} AND ($2::date IS NULL OR r.received_date >= $2::date) AND ($3::date IS NULL OR r.received_date <= $3::date) GROUP BY 1, 2`, [id, x.fromDate || null, x.toDate || null]),
        pool_js_1.db.query(`SELECT EXTRACT(YEAR FROM op.payment_date)::int AS yr, EXTRACT(MONTH FROM op.payment_date)::int AS mo, SUM(op.amount_inr) AS debit FROM outgoing_payments op
               WHERE op.company_bank_account_id = $1 AND op.status = 'cleared' AND ($2::date IS NULL OR op.payment_date >= $2::date) AND ($3::date IS NULL OR op.payment_date <= $3::date) GROUP BY 1, 2`, [id, x.fromDate || null, x.toDate || null]),
    ]);
    const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const m = new Map();
    for (const a of cr.rows)
        m.set(`${a.yr}-${a.mo}`, { yr: a.yr, mo: a.mo, credit: num(a.credit), debit: 0 });
    for (const a of dr.rows) {
        const e = m.get(`${a.yr}-${a.mo}`);
        if (e)
            e.debit = num(a.debit);
        else
            m.set(`${a.yr}-${a.mo}`, { yr: a.yr, mo: a.mo, credit: 0, debit: num(a.debit) });
    }
    let run = 0;
    const rows = [...m.values()].sort((a, b) => a.yr - b.yr || a.mo - b.mo).map((a) => {
        run = (0, report_ledger_js_1.r2)(run + a.credit - a.debit);
        return { label: `${MON[a.mo - 1]} ${a.yr}`, year: a.yr, month: a.mo, debit: (0, report_ledger_js_1.r2)(a.debit), credit: (0, report_ledger_js_1.r2)(a.credit), closing_balance: Math.abs(run), closing_notation: run >= 0 ? 'Cr' : 'Dr' };
    });
    res.json({ success: true, data: [{ label: 'Opening Balance', year: null, month: null, debit: 0, credit: 0, closing_balance: 0, closing_notation: 'Cr' }, ...rows] });
}));
router.get('/bank-ledger', (0, reports_dues_js_1.h)(async (req, res) => {
    const x = (0, reports_dues_js_1.Q)(req);
    const dateType = (0, report_input_js_1.pick)(x.dateType, 'dateType', ['received', 'clearing'], 'received');
    const col = dateType === 'clearing' ? 'r.clearing_date' : 'r.received_date';
    const r = await pool_js_1.db.query(`SELECT r.id, c.registration_no, c.name, COALESCE(u.unit_number,'') || COALESCE(', Floor ' || u.floor::text, '') || COALESCE(', ' || t.tower_name, '') AS unit_address,
            r.payment_method AS mode, r.receipt_number, r.received_date::text AS receipt_date, r.amount_received_inr AS amount, r.cheque_no, r.cheque_date::text AS cheque_date, r.bank_name, r.branch, r.clearing_date::text AS clearing_date, r.status,
            cba.id AS company_bank_account_id, cba.bank_name AS company_bank_name, cba.account_name AS company_account_name
       ${RECEIPT_FROM}
       LEFT JOIN units u ON u.id = COALESCE(pp.unit_id, c.allocated_unit_id)
       LEFT JOIN towers t ON t.id = u.tower_id
       LEFT JOIN company_bank_accounts cba ON cba.id = r.company_bank_account_id
      WHERE r.is_advance IS NOT TRUE AND ($1::uuid IS NULL OR ${PROJECT} = $1::uuid) AND ($2::uuid IS NULL OR r.company_bank_account_id = $2::uuid)
        AND ($3::date IS NULL OR ${col} >= $3::date) AND ($4::date IS NULL OR ${col} <= $4::date)
      ORDER BY ${col} NULLS LAST, r.receipt_number LIMIT ${LIST_CAP + 1}`, [x.projectId || null, x.companyBankAccountId || null, x.dateFrom || null, x.dateTo || null]);
    res.json({ success: true, data: r.rows.slice(0, LIST_CAP), truncated: r.rows.length > LIST_CAP });
}));
exports.default = router;
//# sourceMappingURL=reports-cash.js.map