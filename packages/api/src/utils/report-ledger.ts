// One source of truth for what an applicant owes and has paid, for every dues / ageing / balance report.
// Rules (documented in docs/reports/README.md):
//  - A customer is a LIVE booking (complete / pending_payment / active) with its unit; a surrendered or cancelled booking is not a customer here.
//  - Demands of the booking's latest payment plan, cancelled ones left out. A demand is DUE once it is raised (status demanded / raised / paid);
//    a pending one is not due yet (it only shows as "undue").
//  - Total of a demand = amount + CGST + SGST + add-on + add-on GST.
//  - Paid = CLEARED receipts of that plan, spread over the demands by applyWaterfall (the same call the Demands screen uses), never above the demand.
//    Pending, deposited, on-hold, bounced and cancelled receipts are not paid.
//  - Received (cash) = cleared receipts of the plan that are not the synthetic "advance" copies of an overpayment (those would count the money twice).
import { db } from '../db/pool.js';
import { buildInterestRows } from './payment-waterfall.js';
import { allocateEligible, returnedSql } from './money-basis.js';
import { penalRateFrom } from './penal-rate.js';
import { SQL_TODAY } from './business-date.js';

export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (v: any) => (v === null || v === undefined || v === '' ? 0 : Number(v));

export const LIVE = `('complete','pending_payment','active')`;
export const RAISED = new Set(['demanded', 'raised', 'paid']);

export interface LedgerFilter {
  projectId?: string; towerId?: string; consumerId?: string; companyId?: string; bhkType?: string;
  planName?: string; brokerId?: string; bookingFrom?: string; bookingTo?: string; consumerIds?: string[];
}

export interface LedgerDemand {
  id: string; index: number; type: string | null; status: string; raised: boolean; due_date: string | null;
  base: number; cgst: number; sgst: number; addon: number; total: number; paid: number; balance: number;
}

export interface LedgerPlan {
  booking_id: string; plan_id: string | null; consumer_id: string; unit_id: string; project_id: string; project_name: string; company_id: string | null;
  tower_id: string | null; tower_name: string | null; unit_number: string; bhk_type: string | null; floor: number | null; carpet_area_sqft: number;
  registration_no: string | null; consumer_name: string; mobile: string | null; email: string | null; classification: string | null;
  booking_date: string | null; plan_name: string | null; broker_id: string | null; broker_name: string; self_or_loan: string | null;
  net_basic_price: number; plc_amount: number; other_charge_amount: number; unit_cost: number;
  demands: LedgerDemand[];
  received: number; received_cgst: number; received_sgst: number; received_interest: number; received_pending: number;
  pending_cgst: number; pending_sgst: number; pending_interest: number;
  today: string;
  rate: number; booking_gst: number; allotment_date: string | null;
  receipt_count: number; last_payment_date: string | null; last_payment_amount: number;
  raw: { receipts: any[]; demands: any[] };
}

// Basic price of a booking, the same rule Booking uses when it confirms the payment: rate x carpet area (plus the balcony charge it stored);
// a booking with no rate (made through the API or imported) is priced at the unit's base price. b = booking alias, u = unit alias.
// Owner decision (TA-06): money is in whole rupees (plan, demands, receipts), so the price is rounded to the rupee here exactly as Booking rounds it when it makes the plan.
export const baseCostSql = (b: string, u: string) => `ROUND((CASE
    WHEN COALESCE(${b}.basic_rate_inr_sqft,0) > 0 AND COALESCE(${u}.carpet_area_sqft,0) > 0 THEN
      CASE WHEN ${b}.balcony_charge_amount IS NOT NULL
        THEN ${b}.basic_rate_inr_sqft * ${u}.carpet_area_sqft + COALESCE(${b}.balcony_charge_amount,0)
        ELSE ${b}.basic_rate_inr_sqft * (${u}.carpet_area_sqft + COALESCE(${u}.balcony_area_sqft,0)) END
    ELSE COALESCE(${u}.base_price_inr,0) + COALESCE(${b}.balcony_charge_amount,0) END)::numeric, 0)`;
const BASE = baseCostSql('l', 'u');

export async function loadLedger(f: LedgerFilter = {}): Promise<LedgerPlan[]> {
  const params: any[] = [];
  const add = (v: any) => `$${params.push(v)}`;
  let where = 'WHERE TRUE';
  if (f.projectId) where += ` AND u.project_id = ${add(f.projectId)}::uuid`;
  if (f.towerId) where += ` AND u.tower_id = ${add(f.towerId)}::uuid`;
  if (f.consumerIds) where += ` AND l.consumer_id = ANY(${add(f.consumerIds)}::uuid[])`;
  if (f.consumerId) where += ` AND l.consumer_id = ${add(f.consumerId)}::uuid`;
  if (f.companyId) where += ` AND p.company_id = ${add(f.companyId)}::uuid`;
  if (f.bhkType) where += ` AND u.bhk_type = ${add(f.bhkType)}`;
  if (f.planName) where += ` AND l.selected_plan_name = ${add(f.planName)}`;
  if (f.brokerId) where += ` AND l.main_broker_id = ${add(f.brokerId)}::uuid`;
  if (f.bookingFrom) where += ` AND l.booking_date >= ${add(f.bookingFrom)}::date`;
  if (f.bookingTo) where += ` AND l.booking_date <= ${add(f.bookingTo)}::date`;

  const plans = (await db.query(
    `WITH l AS (
       SELECT DISTINCT ON (br.consumer_id, br.unit_id) br.*
         FROM booking_records br
        WHERE br.status IN ${LIVE} AND br.unit_id IS NOT NULL
        ORDER BY br.consumer_id, br.unit_id, br.created_at DESC)
     SELECT l.id AS booking_id, l.consumer_id, l.unit_id, u.project_id, p.name AS project_name, p.company_id,
            u.tower_id, t.tower_name, u.unit_number, u.bhk_type, u.floor, COALESCE(u.carpet_area_sqft, 0) AS carpet_area_sqft,
            c.registration_no, COALESCE(NULLIF(TRIM(CONCAT_WS(' ', c.first_name, c.last_name)), ''), c.name) AS consumer_name,
            c.mobile, c.email, c.customer_classification AS classification,
            l.booking_date::text AS booking_date, l.selected_plan_name AS plan_name, l.main_broker_id AS broker_id,
            COALESCE(bk.firm_name, bk.name, 'Direct') AS broker_name, l.self_or_loan,
            (${BASE} - COALESCE(l.dealer_adjustment_amount,0) - COALESCE(l.company_inaugural_disc,0) - COALESCE(l.approved_rebate_amount,0)) AS net_basic_price,
            COALESCE(l.plc_amount,0) AS plc_amount, COALESCE(l.other_charge_amount,0) AS other_charge_amount,
            pl.id AS plan_id, ${SQL_TODAY}::text AS today,
            COALESCE(l.basic_rate_inr_sqft,0) AS rate,
            (COALESCE(bpt.cgst_amount,0) + COALESCE(bpt.sgst_amount,0) + CASE WHEN l.balcony_charge_amount IS NOT NULL THEN COALESCE(l.balcony_cgst_amount,0) + COALESCE(l.balcony_sgst_amount,0) ELSE 0 END) AS booking_gst,
            (SELECT MAX(a.allotment_date)::text FROM allocations a WHERE a.consumer_id = l.consumer_id AND a.unit_id = l.unit_id AND a.status <> 'cancelled') AS allotment_date
       FROM l
       JOIN consumers c ON c.id = l.consumer_id
       JOIN units u ON u.id = l.unit_id
       JOIN projects p ON p.id = u.project_id
       LEFT JOIN towers t ON t.id = u.tower_id
       LEFT JOIN brokers bk ON bk.id = l.main_broker_id
       LEFT JOIN LATERAL (SELECT cgst_amount, sgst_amount FROM booking_payment_taxes WHERE booking_record_id = l.id ORDER BY created_at DESC LIMIT 1) bpt ON TRUE
       LEFT JOIN LATERAL (SELECT id FROM payment_plans pp WHERE pp.consumer_id = l.consumer_id AND pp.unit_id = l.unit_id ORDER BY pp.created_at DESC LIMIT 1) pl ON TRUE
      ${where}
      ORDER BY p.name, t.tower_name NULLS LAST, u.unit_number, c.registration_no`,
    params
  )).rows;
  if (!plans.length) return [];

  const planIds = plans.map((p: any) => p.plan_id).filter(Boolean);
  const [dRes, rRes] = planIds.length ? await Promise.all([
    db.query(
      `SELECT d.id, d.payment_plan_id, d.installment_index, d.demand_type, d.status, (d.raised_at IS NOT NULL) AS raised_flag, d.due_date::text AS due_date,
              d.amount_due_inr, COALESCE(d.cgst_amount,0) AS cgst_amount, COALESCE(d.sgst_amount,0) AS sgst_amount,
              COALESCE(d.addon_charge_amount,0) AS addon_charge_amount, COALESCE(d.addon_cgst_amount,0) AS addon_cgst_amount, COALESCE(d.addon_sgst_amount,0) AS addon_sgst_amount
         FROM demands d WHERE d.payment_plan_id = ANY($1::uuid[]) AND d.status <> 'cancelled'
        ORDER BY d.installment_index, d.created_at`, [planIds]),
    db.query(
      `SELECT id, payment_plan_id, amount_received_inr - ${returnedSql('receipts')} AS amount_received_inr, demand_id, installment_index, status, received_date, received_date::text AS received_date_text, created_at, is_advance,
              COALESCE(cgst_amount,0) AS cgst_amount, COALESCE(sgst_amount,0) AS sgst_amount, COALESCE(interest_amount,0) AS interest_amount
         FROM receipts WHERE payment_plan_id = ANY($1::uuid[]) AND status IN ('cleared','pending','authorized','deposited','on_hold')
        ORDER BY received_date, created_at`, [planIds]),
  ]) : [{ rows: [] as any[] }, { rows: [] as any[] }];

  // credit allocated to a demand (approved, not reversed) pays it like cleared money does
  const alRows = planIds.length ? (await db.query(`SELECT demand_id, SUM(amount) AS amount FROM credit_allocations WHERE payment_plan_id = ANY($1::uuid[]) AND status = 'approved' GROUP BY demand_id`, [planIds])).rows : [];
  const alByDemand = new Map<string, number>(alRows.map((r: any) => [String(r.demand_id), num(r.amount)]));
  const dByPlan = new Map<string, any[]>(), rByPlan = new Map<string, any[]>();
  for (const d of dRes.rows) { if (!dByPlan.has(d.payment_plan_id)) dByPlan.set(d.payment_plan_id, []); dByPlan.get(d.payment_plan_id)!.push(d); }
  for (const r of rRes.rows) { if (!rByPlan.has(r.payment_plan_id)) rByPlan.set(r.payment_plan_id, []); rByPlan.get(r.payment_plan_id)!.push(r); }

  return plans.map((p: any): LedgerPlan => {
    const ds = dByPlan.get(p.plan_id) || [];
    const rs = rByPlan.get(p.plan_id) || [];
    const cleared = rs.filter((r) => r.status === 'cleared');
    const wf = allocateEligible(cleared, ds);
    const cash = cleared.filter((r) => r.is_advance !== true);
    const open = rs.filter((r) => r.status !== 'cleared' && r.is_advance !== true);
    return {
      booking_id: p.booking_id, plan_id: p.plan_id, consumer_id: p.consumer_id, unit_id: p.unit_id, project_id: p.project_id,
      project_name: p.project_name, company_id: p.company_id, tower_id: p.tower_id, tower_name: p.tower_name, unit_number: p.unit_number,
      bhk_type: p.bhk_type, floor: p.floor, carpet_area_sqft: num(p.carpet_area_sqft), registration_no: p.registration_no,
      consumer_name: p.consumer_name, mobile: p.mobile, email: p.email, classification: p.classification, booking_date: p.booking_date,
      plan_name: p.plan_name, broker_id: p.broker_id, broker_name: p.broker_name, self_or_loan: p.self_or_loan,
      net_basic_price: r2(num(p.net_basic_price)), plc_amount: num(p.plc_amount), other_charge_amount: num(p.other_charge_amount),
      unit_cost: r2(num(p.net_basic_price) + num(p.plc_amount) + num(p.other_charge_amount)),
      today: p.today, rate: num(p.rate), booking_gst: num(p.booking_gst), allotment_date: p.allotment_date,
      receipt_count: cash.length,
      last_payment_date: cash.length ? cash[cash.length - 1].received_date_text : null,
      last_payment_amount: cash.length ? num(cash[cash.length - 1].amount_received_inr) : 0,
      raw: { receipts: cleared, demands: ds },
      demands: ds.map((d): LedgerDemand => {
        // cgst / sgst here include the GST on the add-on charge
        const base = num(d.amount_due_inr), cgst = r2(num(d.cgst_amount) + num(d.addon_cgst_amount)), sgst = r2(num(d.sgst_amount) + num(d.addon_sgst_amount));
        const addon = num(d.addon_charge_amount);
        const total = r2(base + cgst + sgst + addon), paid = r2(Math.min(total, (wf.get(String(d.id)) || 0) + (alByDemand.get(String(d.id)) || 0)));
        return { id: d.id, index: d.installment_index, type: d.demand_type, status: d.status, raised: RAISED.has(d.status) || (d.status === 'partial' && !!d.raised_flag), due_date: d.due_date,
          base, cgst, sgst, addon, total, paid, balance: r2(Math.max(0, total - paid)) };
      }),
      received: r2(cash.reduce((s, r) => s + num(r.amount_received_inr), 0)),
      received_cgst: r2(cash.reduce((s, r) => s + num(r.cgst_amount), 0)),
      received_sgst: r2(cash.reduce((s, r) => s + num(r.sgst_amount), 0)),
      received_interest: r2(cash.reduce((s, r) => s + num(r.interest_amount), 0)),
      received_pending: r2(open.reduce((s, r) => s + num(r.amount_received_inr), 0)),
      pending_cgst: r2(open.reduce((s, r) => s + num(r.cgst_amount), 0)),
      pending_sgst: r2(open.reduce((s, r) => s + num(r.sgst_amount), 0)),
      pending_interest: r2(open.reduce((s, r) => s + num(r.interest_amount), 0)),
    };
  });
}

// ---- helpers every dues report shares ----
// demands that count as due, optionally up to a date (dueDate / asOnDate filter of the screens)
export const dueOf = (p: LedgerPlan, upTo?: string | null) => p.demands.filter((d) => d.raised && (!upTo || (d.due_date !== null && d.due_date <= upTo)));
export const sum = <T>(xs: T[], f: (x: T) => number) => r2(xs.reduce((s, x) => s + f(x), 0));

// customer totals over the demands that count as due
export const customerTotals = (p: LedgerPlan, upTo?: string | null) => {
  const due = dueOf(p, upTo);
  const demanded = sum(due, (d) => d.total), paid = sum(due, (d) => d.paid);
  const paidAll = sum(p.demands, (d) => d.paid);
  const undue = sum(p.demands.filter((d) => !d.raised), (d) => d.total);
  return {
    demanded, base: sum(due, (d) => d.base + d.addon), cgst: sum(due, (d) => d.cgst), sgst: sum(due, (d) => d.sgst), gst: sum(due, (d) => d.cgst + d.sgst),
    paid, outstanding: r2(Math.max(0, demanded - paid)), undue, paidAll,
    credit: r2(Math.max(0, p.received - sum(p.demands.filter((d) => d.raised), (d) => d.paid))),
  };
};

export const daysBetween = (from: string, to: string) => Math.round((Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10)) - Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10))) / 86400000);

// overdue demands with their days late: due before asOn, still unpaid
export const overdueOf = (p: LedgerPlan, asOn?: string | null) => {
  const on = asOn || p.today;
  return p.demands.filter((d) => d.raised && d.due_date && d.balance > 0 && d.due_date < on).map((d) => ({ d, days: daysBetween(d.due_date!, on) }));
};

export const BUCKETS_A = [['bucket_0_30', 30], ['bucket_31_60', 60], ['bucket_61_90', 90], ['bucket_91_180', 180], ['bucket_180_plus', Infinity]] as const;
export const BUCKETS_B = [['bucket_0_30', 30], ['bucket_31_60', 60], ['bucket_61_120', 120], ['bucket_121_180', 180], ['bucket_180_plus', Infinity]] as const;
export const bucketOf = (days: number, scheme: readonly (readonly [string, number])[]) => scheme.find(([, hi]) => days <= hi)![0];

// ---- interest (penal) per customer, as the Applicant Payment File and the Company Summary show it ----
// Charged = per instalment the stored interest (interest scheduler) when there is one, else what buildInterestRows works out from the receipt dates.
// (A stored instalment is counted once; it used to be added once per receipt row, and was already net of the waiver that was then taken off again.)
export interface InterestCtx { penalRate: number; settings: Map<string, { grace: number; start: Date | null }>; stored: Map<string, { idx: number; amount: number; waived: number }[]> }

export async function loadInterestCtx(plans: LedgerPlan[]): Promise<InterestCtx> {
  const ids = [...new Set(plans.map((p) => p.consumer_id))];
  const planIds = plans.map((p) => p.plan_id).filter(Boolean);
  const [rate, cons, pi] = await Promise.all([
    db.query(`SELECT value FROM global_settings WHERE key = 'penal_interest_rate_percent' LIMIT 1`),
    ids.length ? db.query(`SELECT id, grace_period_days, interest_start_date::text AS interest_start_date FROM consumers WHERE id = ANY($1::uuid[])`, [ids]) : { rows: [] as any[] },
    planIds.length ? db.query(`SELECT payment_plan_id, installment_index, COALESCE(amount_inr,0) AS amount_inr, COALESCE(interest_waived_inr,0) AS waived FROM penal_interests WHERE payment_plan_id = ANY($1::uuid[])`, [planIds]) : { rows: [] as any[] },
  ]);
  const settings = new Map<string, { grace: number; start: Date | null }>();
  for (const c of cons.rows) settings.set(c.id, { grace: parseInt(String(c.grace_period_days || 0)) || 0, start: c.interest_start_date ? new Date(c.interest_start_date) : null });
  const stored = new Map<string, { idx: number; amount: number; waived: number }[]>();
  for (const r of pi.rows) { if (!stored.has(r.payment_plan_id)) stored.set(r.payment_plan_id, []); stored.get(r.payment_plan_id)!.push({ idx: Number(r.installment_index), amount: num(r.amount_inr), waived: num(r.waived) }); }
  return { penalRate: penalRateFrom({ penal_interest_rate_percent: rate.rows[0]?.value }), settings, stored };
}

export function interestOf(p: LedgerPlan, ctx: InterestCtx) {
  const st = ctx.settings.get(p.consumer_id) || { grace: 0, start: null };
  const rows = buildInterestRows(p.raw.receipts as any, p.raw.demands.filter((d: any) => RAISED.has(d.status)).map((d: any) => ({ ...d, installment_name: d.demand_type || String(d.installment_index), due_date: d.due_date })) as any,
    ctx.penalRate, { asOfDate: new Date(p.today), gracePeriodDays: st.grace, interestStartDate: st.start });
  const computed = new Map<number, number>();
  for (const r of rows) computed.set(r.installment_index, (computed.get(r.installment_index) || 0) + r.interest_amount);
  const stored = new Map<number, { amount: number; waived: number }>();
  for (const s of ctx.stored.get(p.plan_id || '') || []) { const e = stored.get(s.idx) || { amount: 0, waived: 0 }; stored.set(s.idx, { amount: e.amount + s.amount, waived: e.waived + s.waived }); }
  let charged = 0;
  for (const [idx, v] of computed) charged += stored.has(idx) && stored.get(idx)!.amount > 0 ? stored.get(idx)!.amount : v;
  for (const [idx, s] of stored) if (!computed.has(idx)) charged += s.amount;
  const waived = [...stored.values()].reduce((a, s) => a + s.waived, 0);
  const received = p.received_interest;
  return { charged: r2(charged), waived: r2(waived), received, outstanding: r2(Math.max(0, charged - waived - received)) };
}

// ---- small helpers shared by the report routes ----
export const pct = (a: number, b: number) => (b > 0 ? Math.round((a * 10000) / b) / 100 : 0);
export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthLabel = (iso: string) => `${MON[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
// case-insensitive "contains" with no wildcards (% and _ are plain characters)
export const contains = (v: string | null | undefined, needle?: string | null) => !needle || (v || '').toLowerCase().includes(needle.toLowerCase());
// the share of a payment that is not tax and not interest: what counts against the unit cost
export const principalOf = (cleared: number, cgst: number, sgst: number, interest: number) => r2(Math.max(0, cleared - cgst - sgst - interest));
// a due demand's outstanding split into amount / cgst / sgst in proportion to its parts (exact when nothing or everything is paid)
export const split = (d: LedgerDemand) => (d.total > 0 ? { amount: (d.balance * (d.base + d.addon)) / d.total, cgst: (d.balance * d.cgst) / d.total, sgst: (d.balance * d.sgst) / d.total } : { amount: 0, cgst: 0, sgst: 0 });
