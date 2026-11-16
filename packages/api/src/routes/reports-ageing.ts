/**
 * Reports: ageing, month wise dues, forecast, pivot and the money part of the dashboards.
 * Same ledger and same rules as reports-dues.ts (cleared receipts only, raised demands are dues, cancelled demands and surrendered bookings are out).
 * Overdue = raised, not fully paid, due date before the "as on" date (default today). Days late = as-on date minus due date.
 */
import { Router } from 'express';
import { db } from '../db/pool.js';
import { bad } from '../utils/input.js';
import { h, Q, flt, totalsOf } from './reports-dues.js';
import { financialMeasures, MEASURE_DEFINITIONS } from '../utils/financial-measures.js';
import { loadLedger, LedgerPlan, LedgerDemand, dueOf, overdueOf, sum, r2, pct, BUCKETS_A, BUCKETS_B, bucketOf, MON, monthLabel } from '../utils/report-ledger.js';

const router = Router();

// ---- overdue buckets, one function for the four group views and the payment-ageing summary ----
type Key = { id: string; label: string; extra: Record<string, any> };
const ageingRows = (plans: LedgerPlan[], asOn: string | null, keyOf: (p: LedgerPlan, d: LedgerDemand) => Key, order: (a: any, b: any) => number) => {
  const g = new Map<string, any>();
  for (const p of plans) for (const { d, days } of overdueOf(p, asOn)) {
    const k = keyOf(p, d);
    const e = g.get(k.id) || { ...k.extra, total_overdue: 0, ...Object.fromEntries(BUCKETS_A.flatMap(([b]) => [[b, 0], ['c_' + b, new Set<string>()]])) };
    const b = bucketOf(days, BUCKETS_A);
    e[b] += d.balance; e.total_overdue += d.balance; e['c_' + b].add(p.consumer_id);
    g.set(k.id, e);
  }
  const rows = [...g.values()].map((e) => {
    const o: any = { ...Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith('c_'))) };
    for (const [b] of BUCKETS_A) { o[b] = r2(e[b]); o['count_' + b.slice(7)] = e['c_' + b].size; }
    o.total_overdue = r2(e.total_overdue);
    return o;
  }).sort(order);
  const totals: any = { total_overdue: sum(rows, (r) => r.total_overdue) };
  for (const [b] of BUCKETS_A) totals[b] = sum(rows, (r) => r[b]);
  return { rows, totals };
};
const byName = (...f: string[]) => (a: any, b: any) => { for (const k of f) { const c = String(a[k] ?? '').localeCompare(String(b[k] ?? '')); if (c) return c; } return 0; };

router.get('/ageing-project', h(async (req, res) => {
  const x = Q(req);
  const { rows, totals } = ageingRows(await loadLedger({ projectId: x.projectId || undefined }), x.asOnDate || null,
    (p) => ({ id: p.project_id, label: p.project_name, extra: { project_id: p.project_id, project_name: p.project_name } }), byName('project_name'));
  res.json({ success: true, data: rows, totals });
}));
router.get('/ageing-installment', h(async (req, res) => {
  const x = Q(req);
  const { rows, totals } = ageingRows(await loadLedger({ projectId: x.projectId || undefined }), x.asOnDate || null,
    (_p, d) => ({ id: `${d.index}|${d.type}`, label: '', extra: { installment_index: d.index, demand_type: d.type } }), (a, b) => (a.installment_index ?? 0) - (b.installment_index ?? 0));
  res.json({ success: true, data: rows, totals });
}));
router.get('/ageing-tower', h(async (req, res) => {
  const x = Q(req);
  const { rows, totals } = ageingRows(await loadLedger({ projectId: x.projectId || undefined }), x.asOnDate || null,
    (p) => ({ id: `${p.project_id}|${p.tower_id}`, label: '', extra: { project_name: p.project_name, tower_name: p.tower_name || 'No Tower' } }), byName('project_name', 'tower_name'));
  res.json({ success: true, data: rows, totals });
}));
router.get('/ageing-plan', h(async (req, res) => {
  const x = Q(req);
  const { rows, totals } = ageingRows(await loadLedger({ projectId: x.projectId || undefined }), x.asOnDate || null,
    (p) => ({ id: `${p.project_id}|${p.plan_name}`, label: '', extra: { project_name: p.project_name, plan_name: p.plan_name || 'No Plan' } }), byName('project_name', 'plan_name'));
  res.json({ success: true, data: rows, totals });
}));

// payment-ageing: overdue amount per age band (1-30, 31-90, 91-180, 180+ days)
router.get('/payment-ageing', h(async (req, res) => {
  const x = Q(req);
  const scheme = [['1-30 days', 30], ['31-90 days', 90], ['91-180 days', 180], ['180+ days', Infinity]] as const;
  const acc = new Map<string, { ageing_bucket: string; count_demands: number; total_due_inr: number }>(scheme.map(([b]) => [b, { ageing_bucket: b, count_demands: 0, total_due_inr: 0 }]));
  for (const p of await loadLedger({ projectId: x.projectId || undefined })) for (const { d, days } of overdueOf(p)) {
    const a = acc.get(bucketOf(days, scheme))!; a.count_demands++; a.total_due_inr = r2(a.total_due_inr + d.balance);
  }
  res.json({ success: true, data: [...acc.values()].filter((a) => a.count_demands > 0) });
}));

// ---- ageing summary (due / received / credit / outstanding + legacy buckets 0-30, 31-60, 61-120, 121-180, 180+) ----
// A = raised demands up to the as-on date, B = paid on them, C = credit (cash received beyond what was demanded), D = A - B, E = D / A
const summaryRows = async (x: Record<string, string>, keyOf: (p: LedgerPlan) => Key, order: (a: any, b: any) => number) => {
  const plans = await loadLedger({ projectId: x.projectId || undefined });
  const asOn = x.asOnDate || null;
  const g = new Map<string, any>();
  for (const p of plans) {
    const k = keyOf(p);
    const e = g.get(k.id) || { group_id: k.id, group_label: k.label, ...k.extra, customers: new Set<string>(), due_amount: 0, received_amount: 0, credit_amount: 0, ...Object.fromEntries(BUCKETS_B.map(([b]) => [b, 0])) };
    const t = totalsOf(p, dueOf(p, asOn));
    e.customers.add(p.consumer_id); e.due_amount += t.demanded; e.received_amount += t.paid; e.credit_amount += t.credit;
    for (const { d, days } of overdueOf(p, asOn)) e[bucketOf(days, BUCKETS_B)] += d.balance;
    g.set(k.id, e);
  }
  const rows = [...g.values()].map(({ customers, ...e }) => {
    const due = r2(e.due_amount), rec = r2(e.received_amount), os = r2(due - rec);
    const o: any = { ...e, consumer_count: customers.size, due_amount: due, received_amount: rec, credit_amount: r2(e.credit_amount), outstanding_amount: os, outstanding_pct: pct(os, due) };
    for (const [b] of BUCKETS_B) o[b] = r2(e[b]);
    return o;
  }).sort(order);
  const totals: any = { consumer_count: sum(rows, (r) => r.consumer_count), due_amount: sum(rows, (r) => r.due_amount), received_amount: sum(rows, (r) => r.received_amount), credit_amount: sum(rows, (r) => r.credit_amount), outstanding_amount: sum(rows, (r) => r.outstanding_amount) };
  for (const [b] of BUCKETS_B) totals[b] = sum(rows, (r) => r[b]);
  totals.outstanding_pct = pct(totals.outstanding_amount, totals.due_amount);
  return { rows, totals };
};
router.get('/ageing-summary-project', h(async (req, res) => {
  const { rows, totals } = await summaryRows(Q(req), (p) => ({ id: p.project_id, label: p.project_name, extra: {} }), byName('group_label'));
  res.json({ success: true, data: rows, totals });
}));
router.get('/ageing-summary-tower', h(async (req, res) => {
  const { rows, totals } = await summaryRows(Q(req), (p) => ({ id: p.tower_id || `no-tower|${p.project_id}`, label: p.tower_name || 'No Tower', extra: { project_name: p.project_name } }), byName('project_name', 'group_label'));
  res.json({ success: true, data: rows, totals });
}));
router.get('/ageing-summary-plan', h(async (req, res) => {
  const { rows, totals } = await summaryRows(Q(req), (p) => ({ id: `${p.plan_name || '(No Plan)'}|${p.project_id}`, label: `${p.plan_name || '(No Plan)'} (${p.project_name})`, extra: { plan_name: p.plan_name || '(No Plan)', project_name: p.project_name } }), byName('project_name', 'plan_name'));
  res.json({ success: true, data: rows, totals });
}));
router.get('/ageing-summary-customer', h(async (req, res) => {
  const { rows, totals } = await summaryRows(Q(req), (p) => ({ id: p.consumer_id, label: p.consumer_name, extra: { registration_no: p.registration_no, unit_no: p.unit_number, booking_date: p.booking_date, project_name: p.project_name } }), byName('group_label'));
  res.json({ success: true, data: rows, totals });
}));

// ---- month wise dues ----
// Every raised demand (open or paid) with a due date, by the month it falls due. Received = what the receipts paid on those demands.
router.get('/month-wise-dues', h(async (req, res) => {
  const x = Q(req);
  const plans = await loadLedger({ projectId: x.projectId || undefined });
  const g = new Map<string, any>();
  const everyone = new Set<string>();
  for (const p of plans) for (const d of dueOf(p)) {
    if (!d.due_date) continue;
    if (x.year && d.due_date.slice(0, 4) !== x.year) continue;
    const key = d.due_date.slice(0, 7);
    const e = g.get(key) || { month_label: monthLabel(d.due_date), month_date: key + '-01', customers: new Set<string>(), demand_count: 0, total_due: 0, total_gst: 0, total_due_with_gst: 0, total_received: 0 };
    e.customers.add(p.consumer_id); everyone.add(p.consumer_id); e.demand_count++; e.total_due += d.base + d.addon; e.total_gst += d.cgst + d.sgst; e.total_due_with_gst += d.total; e.total_received += d.paid;
    g.set(key, e);
  }
  const rows = [...g.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, { customers, ...e }]) => ({
    ...e, consumer_count: customers.size, total_due: r2(e.total_due), total_gst: r2(e.total_gst), total_due_with_gst: r2(e.total_due_with_gst), total_received: r2(e.total_received),
    total_outstanding: r2(e.total_due_with_gst - e.total_received),
  }));
  const totals = {
    consumer_count: everyone.size,
    demand_count: sum(rows, (r) => r.demand_count), total_due: sum(rows, (r) => r.total_due), total_gst: sum(rows, (r) => r.total_gst), total_due_with_gst: sum(rows, (r) => r.total_due_with_gst),
    total_received: sum(rows, (r) => r.total_received), total_outstanding: sum(rows, (r) => r.total_outstanding),
  };
  res.json({ success: true, data: rows, totals });
}));

router.get('/month-wise-dues-customer', h(async (req, res) => {
  const x = Q(req);
  if (!x.fromMonth || !x.fromYear || !x.toMonth || !x.toYear) throw bad('fromMonth, fromYear, toMonth, toYear are required');
  const fMon = +x.fromMonth, fYr = +x.fromYear, tMon = +x.toMonth, tYr = +x.toYear;
  if (fYr * 12 + fMon > tYr * 12 + tMon) throw bad('The from month must not be after the to month');
  if ((tYr * 12 + tMon) - (fYr * 12 + fMon) > 60) throw bad('Choose at most 60 months');
  const months: { key: string; label: string }[] = [];
  for (let i = fYr * 12 + fMon - 1; i <= tYr * 12 + tMon - 1; i++) { const y = Math.floor(i / 12), m = (i % 12) + 1; months.push({ key: `${y}-${String(m).padStart(2, '0')}`, label: `${MON[m - 1]} ${y}` }); }
  const plans = await loadLedger({ projectId: x.projectId || undefined, towerId: x.towerId || undefined });
  const rows = plans.map((p) => {
    const cols: Record<string, { dues: number; paid: number; os: number }> = Object.fromEntries(months.map((m) => [m.key, { dues: 0, paid: 0, os: 0 }]));
    for (const d of dueOf(p)) { const c = d.due_date && cols[d.due_date.slice(0, 7)]; if (c) { c.dues += d.total; c.paid += d.paid; } }
    let td = 0, tp = 0;
    for (const m of months) { const c = cols[m.key]; c.dues = r2(c.dues); c.paid = r2(c.paid); c.os = r2(c.dues - c.paid); td += c.dues; tp += c.paid; }
    return { consumer_id: p.consumer_id, consumer_name: p.consumer_name, registration_no: p.registration_no, unit_no: p.unit_number, booking_date: p.booking_date, months: cols, total_dues: r2(td), total_paid: r2(tp), total_os: r2(td - tp) };
  });
  const monthTotals: Record<string, { dues: number; paid: number; os: number }> = {};
  for (const m of months) monthTotals[m.key] = { dues: sum(rows, (r) => r.months[m.key].dues), paid: sum(rows, (r) => r.months[m.key].paid), os: sum(rows, (r) => r.months[m.key].os) };
  res.json({ success: true, months, data: rows, totals: { months: monthTotals, total_dues: sum(rows, (r) => r.total_dues), total_paid: sum(rows, (r) => r.total_paid), total_os: sum(rows, (r) => r.total_os) } });
}));

// ---- forecast: what is still to come in from demands due today or later (the unpaid part) ----
router.get('/customer-forecasting', h(async (req, res) => {
  const x = Q(req);
  const plans = await loadLedger({ projectId: x.projectId || undefined });
  const detail: any[] = [];
  const g = new Map<string, any>();
  for (const p of plans) for (const d of p.demands) {
    if (!d.due_date || d.due_date < p.today || d.balance <= 0) continue;
    detail.push({ consumer_name: p.consumer_name, registration_no: p.registration_no, mobile: p.mobile, project_name: p.project_name, tower_name: p.tower_name || '—', unit_number: p.unit_number,
      installment_name: d.type, installment_index: d.index, due_date: d.due_date, amount: r2(d.base + d.addon), cgst_amount: d.cgst, sgst_amount: d.sgst, total_with_gst: d.total, paid: d.paid, balance: d.balance, status: d.status });
    const key = d.due_date.slice(0, 7);
    const e = g.get(key) || { month_label: monthLabel(d.due_date), month_date: key + '-01', customers: new Set<string>(), installment_count: 0, projected_amount: 0, demanded_amount: 0, pending_amount: 0 };
    e.customers.add(p.consumer_id); e.installment_count++; e.projected_amount += d.balance;
    if (d.raised) e.demanded_amount += d.balance; else e.pending_amount += d.balance;
    g.set(key, e);
  }
  detail.sort((a, b) => a.due_date.localeCompare(b.due_date) || String(a.registration_no).localeCompare(String(b.registration_no)) || a.installment_index - b.installment_index);
  const monthly = [...g.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, { customers, ...e }]) => ({ ...e, consumer_count: customers.size, projected_amount: r2(e.projected_amount), demanded_amount: r2(e.demanded_amount), pending_amount: r2(e.pending_amount) }));
  res.json({ success: true, monthly, detail, totals: { projected: sum(monthly, (m) => m.projected_amount), demanded: sum(monthly, (m) => m.demanded_amount), pending: sum(monthly, (m) => m.pending_amount), months: monthly.length } });
}));

// ---- pivot: per customer, dues and outstanding by month of the due date ----
router.get('/collection-pivot', h(async (req, res) => {
  const x = Q(req);
  const plans = await loadLedger({ projectId: x.projectId || undefined, towerId: x.towerId || undefined });
  const months = new Set<string>();
  const consumers = plans.map((p) => {
    const m: Record<string, { due: number; os: number }> = {};
    for (const d of dueOf(p)) {
      if (x.dateFrom && (!d.due_date || d.due_date < x.dateFrom)) continue;
      if (x.dateTo && (!d.due_date || d.due_date > x.dateTo)) continue;
      const label = d.due_date ? `${MON[+d.due_date.slice(5, 7) - 1].toUpperCase()}-${d.due_date.slice(0, 4)}` : 'NO DUE DATE';
      months.add(label);
      const c = m[label] || (m[label] = { due: 0, os: 0 });
      c.due = r2(c.due + d.total); c.os = r2(c.os + d.balance);
    }
    return { consumer_id: p.consumer_id, registration_no: p.registration_no, name: p.consumer_name, unit_number: p.unit_number, months: m };
  }).filter((c) => Object.keys(c.months).length);
  const key = (s: string) => (s === 'NO DUE DATE' ? '9999-99' : `${s.slice(-4)}-${String(MON.map((m) => m.toUpperCase()).indexOf(s.slice(0, 3)) + 1).padStart(2, '0')}`);
  res.json({ success: true, data: { consumers, months: [...months].sort((a, b) => key(a).localeCompare(key(b))) } });
}));

// ---- dashboards (money part) ----
const dashboardMoney = (plans: LedgerPlan[]) => {
  const receivables = sum(plans, (p) => sum(p.demands, (d) => d.total)), collected = sum(plans, (p) => p.received);
  const fm = financialMeasures(plans);
  // `outstanding` has always been receivables less collected (the contract balance); the named measures say which "outstanding" is which
  return { total_receivables: receivables, total_collected: collected, outstanding: r2(receivables - collected),
    contract_balance: fm.contract_balance, billed_outstanding: fm.billed_outstanding, overdue_amount: fm.overdue, unallocated_credit: fm.unallocated_credit };
};

// GET /reports/financial-measures[?projectId=&asOn=]: every money measure with one name and one meaning (see utils/financial-measures.ts)
router.get('/financial-measures', h(async (req, res) => {
  const x = Q(req);
  const plans = await loadLedger({ projectId: x.projectId || undefined });
  const returned = Number((await db.query(`SELECT COALESCE(SUM(rr.amount), 0)::float8 AS n FROM receipt_returns rr JOIN receipts r ON r.id = rr.receipt_id
      LEFT JOIN payment_plans pp ON pp.id = r.payment_plan_id WHERE rr.status = 'approved' AND ($1::uuid IS NULL OR pp.project_id = $1::uuid)`, [x.projectId || null])).rows[0].n);
  res.json({ success: true, data: { as_on: x.asOn || plans[0]?.today || null, ...financialMeasures(plans, x.asOn || null), approved_bank_returns: r2(returned) }, definitions: MEASURE_DEFINITIONS });
}));

router.get('/financial-dashboard', h(async (req, res) => {
  const plans = await loadLedger({ projectId: Q(req).projectId || undefined });
  const m = dashboardMoney(plans);
  res.json({ success: true, data: { metrics: {
    ...m,
    total_demands: sum(plans, (p) => p.demands.length),
    overdue_count: sum(plans, (p) => overdueOf(p).length),
    collectionPercentage: m.total_receivables > 0 ? Math.round((m.total_collected / m.total_receivables) * 100) : 0,
  } } });
}));

router.get('/project-dashboard', h(async (req, res) => {
  const pid = Q(req).projectId || null;
  const [inv, ms, plans] = await Promise.all([
    db.query(`SELECT COUNT(*)::int AS total_units, COUNT(CASE WHEN status::text = 'available' THEN 1 END)::int AS available, COUNT(CASE WHEN status::text = 'allotted' THEN 1 END)::int AS allotted,
                     COUNT(CASE WHEN status::text = 'possession_handed_over' THEN 1 END)::int AS possession_handed_over,
                     ROUND(100.0 * COUNT(CASE WHEN status::text = 'allotted' THEN 1 END) / NULLIF(COUNT(*), 0), 2) AS fill_percentage
                FROM units WHERE ($1::uuid IS NULL OR project_id = $1::uuid)`, [pid]),
    db.query(`SELECT COUNT(*)::int AS total_milestones, COUNT(CASE WHEN status = 'completed' THEN 1 END)::int AS completed_milestones,
                     ROUND(AVG(CASE WHEN status = 'completed' THEN completion_percentage ELSE 0 END), 1) AS avg_completion
                FROM construction_milestones WHERE ($1::uuid IS NULL OR project_id = $1::uuid)`, [pid]),
    loadLedger({ projectId: pid || undefined }),
  ]);
  const m = dashboardMoney(plans);
  res.json({ success: true, data: {
    inventory: { ...inv.rows[0], fill_percentage: Number(inv.rows[0].fill_percentage) || 0 },
    payment: { total_receivables: m.total_receivables, total_collected: m.total_collected, collectionPercentage: m.total_receivables > 0 ? Math.round((m.total_collected / m.total_receivables) * 100) : 0 },
    milestones: { total: ms.rows[0].total_milestones, completed: ms.rows[0].completed_milestones, progressPercentage: Number(ms.rows[0].avg_completion) || 0 },
  } });
}));

export default router;
