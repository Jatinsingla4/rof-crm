"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.receivedBlock = exports.recvPct = exports.totalsOf = exports.flt = exports.Q = exports.h = void 0;
/**
 * Reports: customer and group wise dues, balance and percentage reports.
 * Every number comes from the shared ledger (utils/report-ledger.ts): cleared receipts only, cancelled demands out, GST and add-on in,
 * a surrendered booking is not a customer. Rules and decisions are in docs/reports/README.md.
 */
const express_1 = require("express");
const pool_js_1 = require("../db/pool.js");
const input_js_1 = require("../utils/input.js");
const report_input_js_1 = require("../utils/report-input.js");
const money_basis_js_1 = require("../utils/money-basis.js");
const report_ledger_js_1 = require("../utils/report-ledger.js");
const router = (0, express_1.Router)();
const h = (fn) => async (req, res, next) => {
    try {
        await fn(req, res);
    }
    catch (e) {
        (0, input_js_1.failWith)(e, res, next);
    }
};
exports.h = h;
const Q = (req) => req.query;
exports.Q = Q;
const flt = (x) => ({
    projectId: x.projectId || undefined, towerId: x.towerId || undefined, consumerId: x.consumerId || undefined, companyId: x.companyId || undefined,
    bhkType: x.bhkType || undefined, brokerId: x.brokerId || undefined, bookingFrom: x.bookingFromDate || undefined, bookingTo: x.bookingToDate || undefined,
});
exports.flt = flt;
// the demands a "dues" column counts: raised ones up to a date (default), or the not yet raised ones (criteria "pending")
const pickDemands = (p, upTo, criteria) => criteria === 'pending' ? p.demands.filter((d) => !d.raised && (!upTo || (d.due_date !== null && d.due_date <= upTo))) : (0, report_ledger_js_1.dueOf)(p, upTo);
// one customer's figures over a set of demands
const totalsOf = (p, ds) => {
    const demanded = (0, report_ledger_js_1.sum)(ds, (d) => d.total), paid = (0, report_ledger_js_1.sum)(ds, (d) => d.paid);
    const o = ds.reduce((a, d) => { const s = (0, report_ledger_js_1.split)(d); return { amount: a.amount + s.amount, cgst: a.cgst + s.cgst, sgst: a.sgst + s.sgst }; }, { amount: 0, cgst: 0, sgst: 0 });
    const raisedPaid = (0, report_ledger_js_1.sum)(p.demands.filter((d) => d.raised), (d) => d.paid);
    return {
        demanded, paid, amount: (0, report_ledger_js_1.sum)(ds, (d) => d.base + d.addon), cgst: (0, report_ledger_js_1.sum)(ds, (d) => d.cgst), sgst: (0, report_ledger_js_1.sum)(ds, (d) => d.sgst),
        outstanding: (0, report_ledger_js_1.r2)(demanded - paid), os_amount: (0, report_ledger_js_1.r2)(o.amount), os_cgst: (0, report_ledger_js_1.r2)(o.cgst), os_sgst: (0, report_ledger_js_1.r2)(o.sgst),
        credit: (0, report_ledger_js_1.r2)(Math.max(0, p.received - raisedPaid)),
        undue: (0, report_ledger_js_1.sum)(p.demands.filter((d) => !d.raised), (d) => d.total),
        last_due: ds.reduce((m, d) => (d.due_date && (!m || d.due_date > m) ? d.due_date : m), null),
    };
};
exports.totalsOf = totalsOf;
const recvPct = (p) => (0, report_ledger_js_1.pct)((0, report_ledger_js_1.principalOf)(p.received, p.received_cgst, p.received_sgst, p.received_interest), p.unit_cost);
exports.recvPct = recvPct;
const allGst = (p) => (0, report_ledger_js_1.sum)(p.demands, (d) => d.cgst + d.sgst);
// Pending / clear / total received block of the dues screens. Amount is what is left after GST and interest, so the rows add up to the total.
const receivedBlock = (ps) => {
    const mk = (gross, cgst, sgst, interest) => ({ amount: (0, report_ledger_js_1.r2)(gross - cgst - sgst - interest), cgst: (0, report_ledger_js_1.r2)(cgst), sgst: (0, report_ledger_js_1.r2)(sgst), interest: (0, report_ledger_js_1.r2)(interest), total: (0, report_ledger_js_1.r2)(gross) });
    const pend = mk((0, report_ledger_js_1.sum)(ps, (p) => p.received_pending), (0, report_ledger_js_1.sum)(ps, (p) => p.pending_cgst), (0, report_ledger_js_1.sum)(ps, (p) => p.pending_sgst), (0, report_ledger_js_1.sum)(ps, (p) => p.pending_interest));
    const clear = mk((0, report_ledger_js_1.sum)(ps, (p) => p.received), (0, report_ledger_js_1.sum)(ps, (p) => p.received_cgst), (0, report_ledger_js_1.sum)(ps, (p) => p.received_sgst), (0, report_ledger_js_1.sum)(ps, (p) => p.received_interest));
    const tot = { amount: (0, report_ledger_js_1.r2)(pend.amount + clear.amount), cgst: (0, report_ledger_js_1.r2)(pend.cgst + clear.cgst), sgst: (0, report_ledger_js_1.r2)(pend.sgst + clear.sgst), interest: (0, report_ledger_js_1.r2)(pend.interest + clear.interest), total: (0, report_ledger_js_1.r2)(pend.total + clear.total) };
    return { pending: pend, clear, total: tot };
};
exports.receivedBlock = receivedBlock;
// ---------------------------------------------------------------------------------------------------------------------
// GET /customer-balance
router.get('/customer-balance', (0, exports.h)(async (req, res) => {
    const x = (0, exports.Q)(req);
    const balanceType = (0, report_input_js_1.pick)(x.balanceType, 'balanceType', ['all', 'outstanding', 'overpaid'], 'all');
    const { size, page, offset } = (0, report_input_js_1.pageOf)(x, 1000, 5000);
    let plans = await (0, report_ledger_js_1.loadLedger)((0, exports.flt)(x));
    plans = plans.filter((p) => (0, report_ledger_js_1.contains)(p.registration_no, x.registrationNo) && (0, report_ledger_js_1.contains)(p.consumer_name, x.name));
    const rows = plans.map((p) => {
        const t = (0, exports.totalsOf)(p, p.demands.filter((d) => d.raised));
        const totalGst = allGst(p);
        return {
            consumer_id: p.consumer_id, registration_no: p.registration_no, consumer_name: p.consumer_name, mobile: p.mobile, project_id: p.project_id, project_name: p.project_name,
            tower_name: p.tower_name, unit_number: p.unit_number, bhk_type: p.bhk_type, floor: p.floor, booking_date: p.booking_date, allotment_date: p.allotment_date,
            plan_name: p.plan_name, broker_name: p.broker_name,
            unit_cost: p.unit_cost, total_gst: totalGst, total_cost: (0, report_ledger_js_1.r2)(p.unit_cost + totalGst),
            total_demanded: t.demanded, total_received: p.received, received_pct: (0, exports.recvPct)(p),
            last_payment_date: p.last_payment_date, last_payment_amount: p.last_payment_amount,
            balance: (0, report_ledger_js_1.r2)(t.demanded - p.received), receipt_count: p.receipt_count,
        };
    }).filter((r) => balanceType === 'all' || (balanceType === 'outstanding' ? r.balance > 0 : r.balance < 0));
    // This report is one row per LIVE booking, so cleared money of a cancelled booking or of a receipt with no plan is not in any row. It is shown as its own figure,
    // so the report can be tied to the dashboard's cleared collections instead of silently being lower (QA-013). Only when no row filter narrows the people.
    let receivedNotInRows = null;
    if (!x.name && !x.registrationNo && !x.towerId && !x.bhkType && !x.brokerId && !x.planName && !x.bookingFromDate && !x.bookingToDate && !x.companyId && !x.consumerId) {
        const clearedAll = Number((await pool_js_1.db.query(`SELECT ${(0, money_basis_js_1.eligibleSum)('r')} AS n FROM receipts r JOIN consumers c ON c.id = r.consumer_id WHERE ($1::uuid IS NULL OR c.project_id = $1::uuid)`, [x.projectId || null])).rows[0]?.n || 0);
        receivedNotInRows = (0, report_ledger_js_1.r2)(clearedAll - (0, report_ledger_js_1.sum)(plans, (p) => p.received));
    }
    res.json({
        success: true, data: rows.slice(offset, offset + size), total: rows.length, page, pageSize: size,
        summary: { totalConsumers: rows.length, totalUnitCost: (0, report_ledger_js_1.sum)(rows, (r) => r.unit_cost), totalReceived: (0, report_ledger_js_1.sum)(rows, (r) => r.total_received), totalBalance: (0, report_ledger_js_1.sum)(rows, (r) => r.balance),
            receivedNotInRows },
    });
}));
// ---------------------------------------------------------------------------------------------------------------------
// GET /customer-dues
router.get('/customer-dues', (0, exports.h)(async (req, res) => {
    const x = (0, exports.Q)(req);
    const criteria = (0, report_input_js_1.pick)(x.duesCriteria, 'duesCriteria', ['demanded', 'pending'], '');
    const dueDate = x.dueDate || null;
    const { size, page, offset } = (0, report_input_js_1.pageOf)(x, 1000, 5000);
    let plans = await (0, report_ledger_js_1.loadLedger)((0, exports.flt)(x));
    plans = plans.filter((p) => (0, report_ledger_js_1.contains)(p.registration_no, x.registrationNo) && (0, report_ledger_js_1.contains)(p.consumer_name, x.firstName) && (0, report_ledger_js_1.contains)(p.unit_number, x.unitAddress)
        && (!x.customerClassification || p.classification === x.customerClassification) && (!x.inPercent || (0, exports.recvPct)(p) <= +x.inPercent));
    const rows = plans.map((p) => {
        const t = (0, exports.totalsOf)(p, pickDemands(p, dueDate, criteria));
        const osTotal = t.outstanding;
        return {
            consumer_id: p.consumer_id, unit_id: p.unit_id, registration_no: p.registration_no, consumer_name: p.consumer_name, mobile: p.mobile, email: p.email,
            booking_date: p.booking_date, allotment_date: p.allotment_date, unit_number: p.unit_number, bhk_type: p.bhk_type, floor: p.floor, area: p.carpet_area_sqft,
            tower_name: p.tower_name, project_name: p.project_name, plan_name: p.plan_name, loan_type: p.self_or_loan, broker_name: p.broker_name,
            net_bsp: p.net_basic_price, unit_cost: p.unit_cost,
            dues_date: t.last_due, dues_amount: t.amount, dues_cgst: t.cgst, dues_sgst: t.sgst, dues_total: t.demanded,
            received_pending: p.received_pending, received_clear: p.received, received_cgst: p.received_cgst, received_sgst: p.received_sgst, received_total: (0, report_ledger_js_1.r2)(p.received + p.received_pending),
            credit_amount: t.credit,
            outstanding_amount: t.os_amount, outstanding_cgst: t.os_cgst, outstanding_sgst: t.os_sgst, outstanding_total: osTotal, outstanding_pct: (0, report_ledger_js_1.pct)(osTotal, t.demanded),
            undue_amount: t.undue, received_pct: (0, exports.recvPct)(p),
            _p: p,
        };
    });
    const sm = (0, exports.receivedBlock)(rows.map((r) => r._p));
    res.json({
        success: true, data: rows.slice(offset, offset + size).map(({ _p, ...r }) => r), total: rows.length, page, pageSize: size,
        summary: sm,
    });
}));
// ---------------------------------------------------------------------------------------------------------------------
// GET /customer-due-summary (Customer Due Details, one row per booking)
router.get('/customer-due-summary', (0, exports.h)(async (req, res) => {
    const x = (0, exports.Q)(req);
    const op = (0, report_input_js_1.pick)(x.pctOperator, 'pctOperator', ['gt', 'lt', 'eq', 'gte', 'lte'], '');
    const pv = x.pctValue !== undefined && x.pctValue !== '' ? +x.pctValue : null;
    const cmp = { gt: (a, b) => a > b, lt: (a, b) => a < b, eq: (a, b) => a === b, gte: (a, b) => a >= b, lte: (a, b) => a <= b };
    let plans = await (0, report_ledger_js_1.loadLedger)({ ...(0, exports.flt)(x), planName: x.planName || undefined });
    plans = plans.filter((p) => (0, report_ledger_js_1.contains)(p.unit_number, x.unitNo) && (0, report_ledger_js_1.contains)(p.broker_name, x.broker) && (0, report_ledger_js_1.contains)(p.registration_no, x.registrationNo) && (0, report_ledger_js_1.contains)(p.consumer_name, x.name)
        && (!op || pv === null || cmp[op]((0, exports.recvPct)(p), pv)));
    const data = plans.map((p) => {
        const t = (0, exports.totalsOf)(p, (0, report_ledger_js_1.dueOf)(p, x.dueDate || null));
        return {
            consumer_id: p.consumer_id, registration_no: p.registration_no, booking_date: p.booking_date, name: p.consumer_name, tower_name: p.tower_name, unit_number: p.unit_number,
            bhk_type: p.bhk_type, area: p.carpet_area_sqft, broker_name: p.broker_name, plan_name: p.plan_name, loan_type: p.self_or_loan, rate: p.rate,
            net_basic_price: p.net_basic_price, plc_amount: p.plc_amount, basic_with_plc: (0, report_ledger_js_1.r2)(p.net_basic_price + p.plc_amount), total_unit_cost: p.unit_cost,
            total_cost_with_gst: (0, report_ledger_js_1.r2)(p.unit_cost + allGst(p)), // D-TOTALCOST: unit cost plus the GST of ALL demands, the same figure as the balance report (not the GST of the booking payment alone)
            due_amount: t.amount, due_amount_with_tax: t.demanded, ten_pct_due: Math.round(p.unit_cost * 0.1),
            received_pending: p.received_pending, received_clear: p.received, received_total: (0, report_ledger_js_1.r2)(p.received + p.received_pending),
        };
    });
    res.json({ success: true, data, total: data.length });
}));
// ---------------------------------------------------------------------------------------------------------------------
// GET /due-report (one row per demand) and GET /customer-dues-detail (the same per customer)
const demandRow = (p, d) => ({
    registration_no: p.registration_no, consumer_id: p.consumer_id, unit_id: p.unit_id, consumer_name: p.consumer_name, mobile: p.mobile, unit_number: p.unit_number,
    tower_name: p.tower_name, floor: p.floor, bhk_type: p.bhk_type, project_name: p.project_name,
    demand_id: d.id, installment_name: d.type ? `${d.type} ${d.index}` : `Installment ${d.index}`, installment_index: d.index, due_date: d.due_date,
    amount_due_inr: (0, report_ledger_js_1.r2)(d.base + d.addon), cgst_amount: d.cgst, sgst_amount: d.sgst, total_due: d.total, demand_status: d.status === 'raised' ? 'demanded' : d.status,
    paid_amount: d.paid, balance_amount: d.balance,
    days_overdue: d.raised && d.balance > 0 && d.due_date && d.due_date < p.today ? (0, report_ledger_js_1.daysBetween)(d.due_date, p.today) : 0,
});
const DEMAND_STATUS = ['demanded', 'pending', 'partial', 'paid', 'raised'];
const statusOk = (d, s) => !s || (s === 'demanded' ? d.status === 'demanded' || d.status === 'raised' : d.status === s);
router.get('/due-report', (0, exports.h)(async (req, res) => {
    const x = (0, exports.Q)(req);
    const status = (0, report_input_js_1.pick)(x.status, 'status', DEMAND_STATUS, '');
    const { size, page, offset } = (0, report_input_js_1.pageOf)(x, 1000, 5000);
    const plans = await (0, report_ledger_js_1.loadLedger)((0, exports.flt)(x));
    const all = [];
    for (const p of plans)
        for (const d of p.demands) {
            if (!statusOk(d, status))
                continue;
            if (x.installmentIndex && d.index !== +x.installmentIndex)
                continue;
            if (x.fromDate && (!d.due_date || d.due_date < x.fromDate))
                continue;
            if (x.toDate && (!d.due_date || d.due_date > x.toDate))
                continue;
            all.push(demandRow(p, d));
        }
    all.sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999') || String(a.project_name).localeCompare(String(b.project_name)) || String(a.tower_name).localeCompare(String(b.tower_name)) || String(a.unit_number).localeCompare(String(b.unit_number)));
    res.json({
        success: true, data: all.slice(offset, offset + size), total: all.length, page, pageSize: size,
        summary: { totalDemands: all.length, totalDue: (0, report_ledger_js_1.sum)(all, (r) => r.amount_due_inr), totalDueWithGst: (0, report_ledger_js_1.sum)(all, (r) => r.total_due), totalPaid: (0, report_ledger_js_1.sum)(all, (r) => r.paid_amount), totalBalance: (0, report_ledger_js_1.sum)(all, (r) => r.balance_amount) },
    });
}));
router.get('/customer-dues-detail', (0, exports.h)(async (req, res) => {
    const x = (0, exports.Q)(req);
    const status = (0, report_input_js_1.pick)(x.status, 'status', DEMAND_STATUS, '');
    const plans = await (0, report_ledger_js_1.loadLedger)((0, exports.flt)(x));
    const rows = [];
    for (const p of plans)
        for (const d of p.demands) {
            if (!statusOk(d, status))
                continue;
            if (x.installmentIndex && d.index !== +x.installmentIndex)
                continue;
            const r = demandRow(p, d);
            rows.push({ ...r, cgst: r.cgst_amount, sgst: r.sgst_amount, paid: r.paid_amount, balance: r.balance_amount });
        }
    res.json({ success: true, data: rows, total: rows.length });
}));
// ---------------------------------------------------------------------------------------------------------------------
// GET /stage-wise-dues
router.get('/stage-wise-dues', (0, exports.h)(async (req, res) => {
    const x = (0, exports.Q)(req);
    const plans = await (0, report_ledger_js_1.loadLedger)((0, exports.flt)(x));
    const g = new Map();
    const all = new Set();
    for (const p of plans)
        for (const d of (0, report_ledger_js_1.dueOf)(p, x.dueDate || null)) {
            const key = `${d.index}:${d.type ?? ''}`;
            const e = g.get(key) || { installment_index: d.index, installment_name: d.type, consumers: new Set(), total_demanded: 0, total_cgst: 0, total_sgst: 0, total_due: 0, total_received: 0, total_outstanding: 0, paid_count: 0, unpaid_count: 0 };
            e.consumers.add(p.consumer_id);
            all.add(p.consumer_id);
            e.total_demanded += d.base + d.addon;
            e.total_cgst += d.cgst;
            e.total_sgst += d.sgst;
            e.total_due += d.total;
            e.total_received += d.paid;
            e.total_outstanding += d.balance;
            if (d.balance <= 0)
                e.paid_count++;
            else
                e.unpaid_count++;
            g.set(key, e);
        }
    const rows = [...g.values()].sort((a, b) => a.installment_index - b.installment_index || String(a.installment_name).localeCompare(String(b.installment_name))).map(({ consumers, ...e }) => ({
        ...e, consumer_count: consumers.size, total_demanded: (0, report_ledger_js_1.r2)(e.total_demanded), total_cgst: (0, report_ledger_js_1.r2)(e.total_cgst), total_sgst: (0, report_ledger_js_1.r2)(e.total_sgst), total_due: (0, report_ledger_js_1.r2)(e.total_due), total_received: (0, report_ledger_js_1.r2)(e.total_received), total_outstanding: (0, report_ledger_js_1.r2)(e.total_outstanding),
    }));
    const totals = {
        consumer_count: all.size, total_demanded: (0, report_ledger_js_1.sum)(rows, (r) => r.total_demanded), total_cgst: (0, report_ledger_js_1.sum)(rows, (r) => r.total_cgst), total_sgst: (0, report_ledger_js_1.sum)(rows, (r) => r.total_sgst), total_due: (0, report_ledger_js_1.sum)(rows, (r) => r.total_due),
        total_received: (0, report_ledger_js_1.sum)(rows, (r) => r.total_received), total_outstanding: (0, report_ledger_js_1.sum)(rows, (r) => r.total_outstanding), paid_count: (0, report_ledger_js_1.sum)(rows, (r) => r.paid_count), unpaid_count: (0, report_ledger_js_1.sum)(rows, (r) => r.unpaid_count),
    };
    res.json({ success: true, data: rows, totals });
}));
// ---------------------------------------------------------------------------------------------------------------------
// GET /percentage-wise-dues
const PCT_BUCKETS = [['0%', 0], ['0-10%', 10], ['10-20%', 20], ['20-30%', 30], ['30-40%', 40], ['40-50%', 50], ['50-60%', 60], ['60-70%', 70], ['70-80%', 80], ['80-90%', 90], ['90-100%', 99.99999], ['100%+', Infinity]];
router.get('/percentage-wise-dues', (0, exports.h)(async (req, res) => {
    const x = (0, exports.Q)(req);
    const plans = await (0, report_ledger_js_1.loadLedger)((0, exports.flt)(x));
    const buckets = PCT_BUCKETS.map(([label], i) => ({ pct_bucket: label, bucket_order: i, rows: [] }));
    for (const p of plans) {
        const rp = (0, exports.recvPct)(p);
        const i = rp === 0 ? 0 : rp >= 100 ? 11 : PCT_BUCKETS.findIndex(([, hi], k) => k > 0 && rp <= hi);
        const t = (0, exports.totalsOf)(p, (0, report_ledger_js_1.dueOf)(p, x.dueDate || null));
        buckets[i].rows.push({ consumer_id: p.consumer_id, consumer_name: p.consumer_name, registration_no: p.registration_no, unit_number: p.unit_number, tower_name: p.tower_name, bhk_type: p.bhk_type,
            total_cost: p.unit_cost, total_received: p.received, outstanding: t.outstanding, received_pct: rp });
    }
    const out = buckets.filter((b) => b.rows.length).map((b) => {
        const rs = b.rows.sort((a, c) => c.received_pct - a.received_pct);
        return { pct_bucket: b.pct_bucket, bucket_order: b.bucket_order, consumer_count: rs.length, total_cost: (0, report_ledger_js_1.sum)(rs, (r) => r.total_cost), total_received: (0, report_ledger_js_1.sum)(rs, (r) => r.total_received), total_outstanding: (0, report_ledger_js_1.sum)(rs, (r) => r.outstanding),
            min_pct: Math.min(...rs.map((r) => r.received_pct)), max_pct: Math.max(...rs.map((r) => r.received_pct)), avg_pct: (0, report_ledger_js_1.r2)((0, report_ledger_js_1.sum)(rs, (r) => r.received_pct) / rs.length), consumers: rs };
    });
    const totals = { total_consumers: (0, report_ledger_js_1.sum)(out, (b) => b.consumer_count), total_cost: (0, report_ledger_js_1.sum)(out, (b) => b.total_cost), total_received: (0, report_ledger_js_1.sum)(out, (b) => b.total_received), total_outstanding: (0, report_ledger_js_1.sum)(out, (b) => b.total_outstanding) };
    const consumers_by_bucket = {};
    for (const b of out)
        consumers_by_bucket[b.pct_bucket] = b.consumers;
    res.json({ success: true, buckets: out, consumers_by_bucket, totals });
}));
// ---------------------------------------------------------------------------------------------------------------------
// GET /project-wise-dues (groupBy project | tower | bhk_type | plan | broker)
router.get('/project-wise-dues', (0, exports.h)(async (req, res) => {
    const x = (0, exports.Q)(req);
    const gb = (0, report_input_js_1.pick)(x.groupBy, 'groupBy', ['project', 'tower', 'bhk_type', 'plan', 'broker'], 'project');
    const plans = await (0, report_ledger_js_1.loadLedger)({ projectId: x.projectId || undefined });
    const dd = x.dueDate || null;
    const groups = new Map();
    const ensure = (id, label, project, units = 0, plan) => { if (!groups.has(id))
        groups.set(id, { group_id: id, group_label: label, project_name: project, plan_name: plan, plans: [], units }); return groups.get(id); };
    const pid = x.projectId || null;
    // groups that exist even without a customer: every project, tower and unit type with its number of units
    if (gb === 'project')
        for (const r of (await pool_js_1.db.query(`SELECT p.id, p.name, COUNT(u.id)::int AS units FROM projects p LEFT JOIN units u ON u.project_id = p.id WHERE ($1::uuid IS NULL OR p.id = $1::uuid) GROUP BY p.id, p.name ORDER BY p.name`, [pid])).rows)
            ensure(r.id, r.name, r.name, r.units);
    if (gb === 'tower')
        for (const r of (await pool_js_1.db.query(`SELECT t.id, t.tower_name, p.name AS project_name, COUNT(u.id)::int AS units FROM towers t JOIN projects p ON p.id = t.project_id LEFT JOIN units u ON u.tower_id = t.id WHERE t.deleted_at IS NULL AND ($1::uuid IS NULL OR t.project_id = $1::uuid) GROUP BY t.id, t.tower_name, p.name ORDER BY p.name, t.tower_name`, [pid])).rows)
            ensure(r.id, r.tower_name, r.project_name, r.units);
    if (gb === 'bhk_type')
        for (const r of (await pool_js_1.db.query(`SELECT u.bhk_type, COUNT(*)::int AS units FROM units u JOIN towers t ON t.id = u.tower_id WHERE t.deleted_at IS NULL AND ($1::uuid IS NULL OR u.project_id = $1::uuid) GROUP BY u.bhk_type ORDER BY u.bhk_type`, [pid])).rows)
            ensure(String(r.bhk_type), r.bhk_type ?? 'Unspecified', null, r.units);
    for (const p of plans) {
        let gr;
        if (gb === 'project')
            gr = ensure(p.project_id, p.project_name, p.project_name);
        else if (gb === 'tower')
            gr = ensure(p.tower_id || 'no-tower', p.tower_name || 'No Tower', p.project_name);
        else if (gb === 'bhk_type')
            gr = ensure(String(p.bhk_type), p.bhk_type ?? 'Unspecified', null);
        else if (gb === 'plan')
            gr = ensure(`${p.plan_name || '(No Plan)'}|${p.project_id}`, `${p.plan_name || '(No Plan)'} (${p.project_name})`, p.project_name, 0, p.plan_name || '(No Plan)');
        else
            gr = ensure(p.broker_id || 'direct-null', p.broker_name, null);
        gr.plans.push(p);
    }
    const rows = [...groups.values()].filter((g) => !(gb === 'tower' && g.group_id === 'no-tower' && !g.plans.length)).map((g) => {
        const ts = g.plans.map((p) => ({ p, t: (0, exports.totalsOf)(p, (0, report_ledger_js_1.dueOf)(p, dd)) }));
        const demanded = (0, report_ledger_js_1.sum)(ts, (a) => a.t.amount), demandedTax = (0, report_ledger_js_1.sum)(ts, (a) => a.t.demanded);
        const totalCost = (0, report_ledger_js_1.sum)(g.plans, (p) => p.unit_cost);
        const rb = (0, exports.receivedBlock)(g.plans);
        const osTax = (0, report_ledger_js_1.sum)(ts, (a) => a.t.outstanding), osNet = (0, report_ledger_js_1.sum)(ts, (a) => a.t.os_amount);
        return {
            group_id: g.group_id, group_label: g.group_label, project_name: g.project_name, ...(g.plan_name !== undefined ? { plan_name: g.plan_name } : {}),
            consumer_count: new Set(g.plans.map((p) => p.consumer_id)).size, unit_count: g.units || new Set(g.plans.map((p) => p.unit_id)).size,
            total_cost: totalCost, total_demanded: demanded, total_demanded_cgst: (0, report_ledger_js_1.sum)(ts, (a) => a.t.cgst), total_demanded_sgst: (0, report_ledger_js_1.sum)(ts, (a) => a.t.sgst),
            received_pending: rb.pending.total, received_clear: rb.clear.total, total_received: rb.total.total,
            received_cgst: rb.clear.cgst, received_sgst: rb.clear.sgst, received_interest: rb.clear.interest,
            outstanding: osNet, outstanding_with_tax: osTax, credit_amount: (0, report_ledger_js_1.sum)(ts, (a) => a.t.credit),
            total_demanded_with_tax: demandedTax,
            due_pct: (0, report_ledger_js_1.pct)(demanded, totalCost), due_pct_with_tax: (0, report_ledger_js_1.pct)(demandedTax, totalCost),
            received_pct: (0, report_ledger_js_1.pct)((0, report_ledger_js_1.sum)(g.plans, (p) => (0, report_ledger_js_1.principalOf)(p.received, p.received_cgst, p.received_sgst, p.received_interest)), totalCost),
            outstanding_pct: (0, report_ledger_js_1.pct)(osNet, demanded), outstanding_pct_with_tax: (0, report_ledger_js_1.pct)(osTax, demandedTax),
            _plans: g.plans,
        };
    });
    const T = (f) => (0, report_ledger_js_1.sum)(rows, f);
    const totals = {
        consumer_count: T((r) => r.consumer_count), unit_count: T((r) => r.unit_count), total_cost: T((r) => r.total_cost), total_demanded: T((r) => r.total_demanded),
        total_demanded_with_tax: T((r) => r.total_demanded_with_tax), received_pending: T((r) => r.received_pending), received_clear: T((r) => r.received_clear), total_received: T((r) => r.total_received),
        received_cgst: T((r) => r.received_cgst), received_sgst: T((r) => r.received_sgst), received_interest: T((r) => r.received_interest),
        outstanding: T((r) => r.outstanding), outstanding_with_tax: T((r) => r.outstanding_with_tax), credit_amount: T((r) => r.credit_amount),
    };
    totals.due_pct = (0, report_ledger_js_1.pct)(totals.total_demanded, totals.total_cost);
    totals.due_pct_with_tax = (0, report_ledger_js_1.pct)(totals.total_demanded_with_tax, totals.total_cost);
    totals.received_pct = (0, report_ledger_js_1.pct)((0, report_ledger_js_1.sum)(rows, (r) => (0, report_ledger_js_1.sum)(r._plans, (p) => (0, report_ledger_js_1.principalOf)(p.received, p.received_cgst, p.received_sgst, p.received_interest))), totals.total_cost);
    totals.outstanding_pct = (0, report_ledger_js_1.pct)(totals.outstanding, totals.total_demanded);
    totals.outstanding_pct_with_tax = (0, report_ledger_js_1.pct)(totals.outstanding_with_tax, totals.total_demanded_with_tax);
    // a customer sits in exactly one group, so the screen total of consumers / units is the sum of the groups; the money summary is over the same customers
    const summary = (0, exports.receivedBlock)(rows.flatMap((r) => r._plans));
    res.json({ success: true, data: rows.map(({ _plans, ...r }) => r), totals, summary, groupBy: gb });
}));
exports.default = router;
//# sourceMappingURL=reports-dues.js.map