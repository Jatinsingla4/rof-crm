"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.split = exports.principalOf = exports.contains = exports.monthLabel = exports.MON = exports.pct = exports.bucketOf = exports.BUCKETS_B = exports.BUCKETS_A = exports.overdueOf = exports.daysBetween = exports.customerTotals = exports.sum = exports.dueOf = exports.baseCostSql = exports.isRaised = exports.RAISED = exports.LIVE = exports.r2 = void 0;
exports.loadLedger = loadLedger;
exports.loadInterestCtx = loadInterestCtx;
exports.liveInterestByInstalment = liveInterestByInstalment;
exports.interestOf = interestOf;
// One source of truth for what an applicant owes and has paid, for every dues / ageing / balance report.
// Rules (documented in docs/reports/README.md):
//  - A customer is a LIVE booking (complete / pending_payment / active) with its unit; a surrendered or cancelled booking is not a customer here.
//  - Demands of the booking's latest payment plan, cancelled ones left out. A demand is DUE once it is raised (status demanded / raised / paid);
//    a pending one is not due yet (it only shows as "undue").
//  - Total of a demand = amount + CGST + SGST + add-on + add-on GST.
//  - Paid = CLEARED receipts of that plan, spread over the demands by applyWaterfall (the same call the Demands screen uses), never above the demand.
//    Pending, deposited, on-hold, bounced and cancelled receipts are not paid.
//  - Received (cash) = cleared receipts of the plan that are not the synthetic "advance" copies of an overpayment (those would count the money twice).
const pool_js_1 = require("../db/pool.js");
const payment_waterfall_js_1 = require("./payment-waterfall.js");
const money_basis_js_1 = require("./money-basis.js");
const penal_rate_js_1 = require("./penal-rate.js");
const business_date_js_1 = require("./business-date.js");
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
exports.r2 = r2;
const num = (v) => (v === null || v === undefined || v === '' ? 0 : Number(v));
exports.LIVE = `('complete','pending_payment','active')`;
exports.RAISED = new Set(['demanded', 'raised', 'paid']);
// QA-008/014/033: ONE rule for "this instalment has been raised", the same as the status rules (money-basis deriveDemandStatus): raised_at is set, or its due date has been reached.
// Payment status must not decide it. A paid status used to count as raised, so an instalment fully covered by an advance (a booking amount on an unraised instalment) jumped into the
// raised demands, while the same instalment part covered did not: the credit then changed with the amount paid. 'demanded' / 'raised' are raised by definition.
const isRaised = (status, raisedFlag, dueDate, today) => status === 'demanded' || status === 'raised' || ((status === 'paid' || status === 'partial') && (raisedFlag || (!!dueDate && dueDate <= today)));
exports.isRaised = isRaised;
// Basic price of a booking (with the balcony charge it stored), one definition for every report and the Applicant File. b = booking alias, u = unit alias.
// QA-001/005/030/032: the price a booking was SOLD at is what its payment plan was cut from, so it is read back from payment_plans.total_amount_inr
//   (plan total = basic + plc + other + balcony - inaugural discount - approved rebate, the same sum Booking confirms with), never recomputed from the CURRENT unit master.
//   A unit edited, re-measured or shifted after booking therefore cannot move a historical booking's price.
// Only a booking with no plan yet falls back to the old rule: rate x unit carpet (plus the stored balcony charge), else the unit's base price.
// Owner decision (TA-06): money is in whole rupees, so the price is rounded to the rupee exactly as Booking rounds it when it makes the plan.
const PLAN_TOTAL = (b) => `(SELECT pp.total_amount_inr FROM payment_plans pp WHERE pp.consumer_id = ${b}.consumer_id AND pp.unit_id = ${b}.unit_id ORDER BY pp.created_at DESC LIMIT 1)`;
const baseCostSql = (b, u) => `ROUND((CASE
    WHEN COALESCE(${PLAN_TOTAL(b)}, 0) > 0 THEN
      ${PLAN_TOTAL(b)} - COALESCE(${b}.plc_amount,0) - COALESCE(${b}.other_charge_amount,0) + COALESCE(${b}.company_inaugural_disc,0) + COALESCE(${b}.approved_rebate_amount,0)
    WHEN COALESCE(${b}.basic_rate_inr_sqft,0) > 0 AND COALESCE(${u}.carpet_area_sqft,0) > 0 THEN
      CASE WHEN ${b}.balcony_charge_amount IS NOT NULL
        THEN ${b}.basic_rate_inr_sqft * ${u}.carpet_area_sqft + COALESCE(${b}.balcony_charge_amount,0)
        ELSE ${b}.basic_rate_inr_sqft * (${u}.carpet_area_sqft + COALESCE(${u}.balcony_area_sqft,0)) END
    ELSE COALESCE(${u}.base_price_inr,0) + COALESCE(${b}.balcony_charge_amount,0) END)::numeric, 0)`;
exports.baseCostSql = baseCostSql;
const BASE = (0, exports.baseCostSql)('l', 'u');
async function loadLedger(f = {}) {
    const params = [];
    const add = (v) => `$${params.push(v)}`;
    let where = 'WHERE TRUE';
    if (f.projectId)
        where += ` AND u.project_id = ${add(f.projectId)}::uuid`;
    if (f.towerId)
        where += ` AND u.tower_id = ${add(f.towerId)}::uuid`;
    if (f.consumerIds)
        where += ` AND l.consumer_id = ANY(${add(f.consumerIds)}::uuid[])`;
    if (f.consumerId)
        where += ` AND l.consumer_id = ${add(f.consumerId)}::uuid`;
    if (f.companyId)
        where += ` AND p.company_id = ${add(f.companyId)}::uuid`;
    if (f.bhkType)
        where += ` AND u.bhk_type = ${add(f.bhkType)}`;
    if (f.planName)
        where += ` AND l.selected_plan_name = ${add(f.planName)}`;
    if (f.brokerId)
        where += ` AND l.main_broker_id = ${add(f.brokerId)}::uuid`;
    if (f.bookingFrom)
        where += ` AND l.booking_date >= ${add(f.bookingFrom)}::date`;
    if (f.bookingTo)
        where += ` AND l.booking_date <= ${add(f.bookingTo)}::date`;
    const plans = (await pool_js_1.db.query(`WITH l AS (
       SELECT DISTINCT ON (br.consumer_id, br.unit_id) br.*
         FROM booking_records br
        WHERE br.status IN ${exports.LIVE} AND br.unit_id IS NOT NULL
        ORDER BY br.consumer_id, br.unit_id, br.created_at DESC)
     SELECT l.id AS booking_id, l.consumer_id, l.unit_id, u.project_id, p.name AS project_name, p.company_id,
            u.tower_id, t.tower_name, u.unit_number, u.bhk_type, u.floor, COALESCE(u.carpet_area_sqft, 0) AS carpet_area_sqft,
            c.registration_no, COALESCE(NULLIF(TRIM(CONCAT_WS(' ', c.first_name, c.last_name)), ''), c.name) AS consumer_name,
            c.mobile, c.email, c.customer_classification AS classification,
            l.booking_date::text AS booking_date, l.selected_plan_name AS plan_name, l.main_broker_id AS broker_id,
            COALESCE(bk.firm_name, bk.name, 'Direct') AS broker_name, l.self_or_loan,
            (${BASE} - COALESCE(l.dealer_adjustment_amount,0) - COALESCE(l.company_inaugural_disc,0) - COALESCE(l.approved_rebate_amount,0)) AS net_basic_price,
            COALESCE(l.plc_amount,0) AS plc_amount, COALESCE(l.other_charge_amount,0) AS other_charge_amount,
            pl.id AS plan_id, ${business_date_js_1.SQL_TODAY}::text AS today,
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
      ORDER BY p.name, t.tower_name NULLS LAST, u.unit_number, c.registration_no`, params)).rows;
    if (!plans.length)
        return [];
    const planIds = plans.map((p) => p.plan_id).filter(Boolean);
    const [dRes, rRes] = planIds.length ? await Promise.all([
        pool_js_1.db.query(`SELECT d.id, d.payment_plan_id, d.installment_index, d.demand_type, d.status, (d.raised_at IS NOT NULL) AS raised_flag, d.due_date::text AS due_date,
              d.amount_due_inr, COALESCE(d.cgst_amount,0) AS cgst_amount, COALESCE(d.sgst_amount,0) AS sgst_amount,
              COALESCE(d.addon_charge_amount,0) AS addon_charge_amount, COALESCE(d.addon_cgst_amount,0) AS addon_cgst_amount, COALESCE(d.addon_sgst_amount,0) AS addon_sgst_amount
         FROM demands d WHERE d.payment_plan_id = ANY($1::uuid[]) AND d.status <> 'cancelled'
        ORDER BY d.installment_index, d.created_at`, [planIds]),
        pool_js_1.db.query(`SELECT id, payment_plan_id, amount_received_inr - ${(0, money_basis_js_1.returnedSql)('receipts')} AS amount_received_inr, demand_id, installment_index, status, received_date, received_date::text AS received_date_text, clearing_date, created_at, is_advance,
              COALESCE(cgst_amount,0) AS cgst_amount, COALESCE(sgst_amount,0) AS sgst_amount, COALESCE(interest_amount,0) AS interest_amount
         FROM receipts WHERE payment_plan_id = ANY($1::uuid[]) AND status IN ('cleared','pending','authorized','deposited','on_hold')
        ORDER BY received_date, created_at`, [planIds]),
    ]) : [{ rows: [] }, { rows: [] }];
    // credit allocated to a demand (approved, not reversed) pays it like cleared money does
    const alRows = planIds.length ? (await pool_js_1.db.query(`SELECT demand_id, SUM(amount) AS amount FROM credit_allocations WHERE payment_plan_id = ANY($1::uuid[]) AND status = 'approved' GROUP BY demand_id`, [planIds])).rows : [];
    const alByDemand = new Map(alRows.map((r) => [String(r.demand_id), num(r.amount)]));
    const dByPlan = new Map(), rByPlan = new Map();
    for (const d of dRes.rows) {
        if (!dByPlan.has(d.payment_plan_id))
            dByPlan.set(d.payment_plan_id, []);
        dByPlan.get(d.payment_plan_id).push(d);
    }
    for (const r of rRes.rows) {
        if (!rByPlan.has(r.payment_plan_id))
            rByPlan.set(r.payment_plan_id, []);
        rByPlan.get(r.payment_plan_id).push(r);
    }
    return plans.map((p) => {
        const ds = dByPlan.get(p.plan_id) || [];
        const rs = rByPlan.get(p.plan_id) || [];
        const cleared = rs.filter((r) => r.status === 'cleared');
        const wf = (0, money_basis_js_1.allocateEligible)(cleared, ds);
        const cash = cleared.filter((r) => r.is_advance !== true);
        const open = rs.filter((r) => r.status !== 'cleared' && r.is_advance !== true);
        return {
            booking_id: p.booking_id, plan_id: p.plan_id, consumer_id: p.consumer_id, unit_id: p.unit_id, project_id: p.project_id,
            project_name: p.project_name, company_id: p.company_id, tower_id: p.tower_id, tower_name: p.tower_name, unit_number: p.unit_number,
            bhk_type: p.bhk_type, floor: p.floor, carpet_area_sqft: num(p.carpet_area_sqft), registration_no: p.registration_no,
            consumer_name: p.consumer_name, mobile: p.mobile, email: p.email, classification: p.classification, booking_date: p.booking_date,
            plan_name: p.plan_name, broker_id: p.broker_id, broker_name: p.broker_name, self_or_loan: p.self_or_loan,
            net_basic_price: (0, exports.r2)(num(p.net_basic_price)), plc_amount: num(p.plc_amount), other_charge_amount: num(p.other_charge_amount),
            unit_cost: (0, exports.r2)(num(p.net_basic_price) + num(p.plc_amount) + num(p.other_charge_amount)),
            today: p.today, rate: num(p.rate), booking_gst: num(p.booking_gst), allotment_date: p.allotment_date,
            receipt_count: cash.length,
            last_payment_date: cash.length ? cash[cash.length - 1].received_date_text : null,
            last_payment_amount: cash.length ? num(cash[cash.length - 1].amount_received_inr) : 0,
            raw: { receipts: cleared, demands: ds },
            demands: ds.map((d) => {
                // cgst / sgst here include the GST on the add-on charge
                const base = num(d.amount_due_inr), cgst = (0, exports.r2)(num(d.cgst_amount) + num(d.addon_cgst_amount)), sgst = (0, exports.r2)(num(d.sgst_amount) + num(d.addon_sgst_amount));
                const addon = num(d.addon_charge_amount);
                const total = (0, exports.r2)(base + cgst + sgst + addon), paid = (0, exports.r2)(Math.min(total, (wf.get(String(d.id)) || 0) + (alByDemand.get(String(d.id)) || 0)));
                return { id: d.id, index: d.installment_index, type: d.demand_type, status: d.status, raised: (0, exports.isRaised)(d.status, !!d.raised_flag, d.due_date, p.today), due_date: d.due_date,
                    base, cgst, sgst, addon, total, paid, balance: (0, exports.r2)(Math.max(0, total - paid)) };
            }),
            received: (0, exports.r2)(cash.reduce((s, r) => s + num(r.amount_received_inr), 0)),
            received_cgst: (0, exports.r2)(cash.reduce((s, r) => s + num(r.cgst_amount), 0)),
            received_sgst: (0, exports.r2)(cash.reduce((s, r) => s + num(r.sgst_amount), 0)),
            received_interest: (0, exports.r2)(cash.reduce((s, r) => s + num(r.interest_amount), 0)),
            received_pending: (0, exports.r2)(open.reduce((s, r) => s + num(r.amount_received_inr), 0)),
            pending_cgst: (0, exports.r2)(open.reduce((s, r) => s + num(r.cgst_amount), 0)),
            pending_sgst: (0, exports.r2)(open.reduce((s, r) => s + num(r.sgst_amount), 0)),
            pending_interest: (0, exports.r2)(open.reduce((s, r) => s + num(r.interest_amount), 0)),
        };
    });
}
// ---- helpers every dues report shares ----
// demands that count as due, optionally up to a date (dueDate / asOnDate filter of the screens)
const dueOf = (p, upTo) => p.demands.filter((d) => d.raised && (!upTo || (d.due_date !== null && d.due_date <= upTo)));
exports.dueOf = dueOf;
const sum = (xs, f) => (0, exports.r2)(xs.reduce((s, x) => s + f(x), 0));
exports.sum = sum;
// customer totals over the demands that count as due
const customerTotals = (p, upTo) => {
    const due = (0, exports.dueOf)(p, upTo);
    const demanded = (0, exports.sum)(due, (d) => d.total), paid = (0, exports.sum)(due, (d) => d.paid);
    const paidAll = (0, exports.sum)(p.demands, (d) => d.paid);
    const undue = (0, exports.sum)(p.demands.filter((d) => !d.raised), (d) => d.total);
    return {
        demanded, base: (0, exports.sum)(due, (d) => d.base + d.addon), cgst: (0, exports.sum)(due, (d) => d.cgst), sgst: (0, exports.sum)(due, (d) => d.sgst), gst: (0, exports.sum)(due, (d) => d.cgst + d.sgst),
        paid, outstanding: (0, exports.r2)(Math.max(0, demanded - paid)), undue, paidAll,
        credit: (0, exports.r2)(Math.max(0, p.received - (0, exports.sum)(p.demands.filter((d) => d.raised), (d) => d.paid))),
        // The credit is made of two different things, shown apart so no screen adds one to the other (QA-008/014/037, the Zf Tester Rs 777):
        //  advanceOnUnraised: money that already paid instalments which have not been raised yet (a booking amount on the first instalment). It is settled, not spare cash.
        //  surplusCredit: money that has settled no instalment: the excess of a receipt over the instalment it names, or money naming none. Only this part is free credit a checker can allocate or refund.
        // credit = advanceOnUnraised + surplusCredit, always.
        advanceOnUnraised: (0, exports.r2)(Math.min((0, exports.sum)(p.demands.filter((d) => !d.raised), (d) => d.paid), Math.max(0, p.received - (0, exports.sum)(p.demands.filter((d) => d.raised), (d) => d.paid)))),
        surplusCredit: (0, exports.r2)(Math.max(0, Math.max(0, p.received - (0, exports.sum)(p.demands.filter((d) => d.raised), (d) => d.paid)) - (0, exports.sum)(p.demands.filter((d) => !d.raised), (d) => d.paid))),
    };
};
exports.customerTotals = customerTotals;
const daysBetween = (from, to) => Math.round((Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10)) - Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10))) / 86400000);
exports.daysBetween = daysBetween;
// overdue demands with their days late: due before asOn, still unpaid
const overdueOf = (p, asOn) => {
    const on = asOn || p.today;
    return p.demands.filter((d) => d.raised && d.due_date && d.balance > 0 && d.due_date < on).map((d) => ({ d, days: (0, exports.daysBetween)(d.due_date, on) }));
};
exports.overdueOf = overdueOf;
exports.BUCKETS_A = [['bucket_0_30', 30], ['bucket_31_60', 60], ['bucket_61_90', 90], ['bucket_91_180', 180], ['bucket_180_plus', Infinity]];
exports.BUCKETS_B = [['bucket_0_30', 30], ['bucket_31_60', 60], ['bucket_61_120', 120], ['bucket_121_180', 180], ['bucket_180_plus', Infinity]];
const bucketOf = (days, scheme) => scheme.find(([, hi]) => days <= hi)[0];
exports.bucketOf = bucketOf;
async function loadInterestCtx(plans) {
    const ids = [...new Set(plans.map((p) => p.consumer_id))];
    const planIds = plans.map((p) => p.plan_id).filter(Boolean);
    const [rate, cons, pi] = await Promise.all([
        pool_js_1.db.query(`SELECT value FROM global_settings WHERE key = 'penal_interest_rate_percent' LIMIT 1`),
        ids.length ? pool_js_1.db.query(`SELECT id, grace_period_days, interest_start_date::text AS interest_start_date FROM consumers WHERE id = ANY($1::uuid[])`, [ids]) : { rows: [] },
        planIds.length ? pool_js_1.db.query(`SELECT payment_plan_id, installment_index, COALESCE(amount_inr,0) AS amount_inr, COALESCE(interest_waived_inr,0) AS waived FROM penal_interests WHERE payment_plan_id = ANY($1::uuid[])`, [planIds]) : { rows: [] },
    ]);
    const settings = new Map();
    for (const c of cons.rows)
        settings.set(c.id, { grace: parseInt(String(c.grace_period_days || 0)) || 0, start: c.interest_start_date ? new Date(c.interest_start_date) : null });
    const stored = new Map();
    for (const r of pi.rows) {
        if (!stored.has(r.payment_plan_id))
            stored.set(r.payment_plan_id, []);
        stored.get(r.payment_plan_id).push({ idx: Number(r.installment_index), amount: num(r.amount_inr), waived: num(r.waived) });
    }
    return { penalRate: (0, penal_rate_js_1.penalRateFrom)({ penal_interest_rate_percent: rate.rows[0]?.value }), settings, stored };
}
// Interest of each instalment worked out live by the one engine (buildInterestRows): chronological intervals of the outstanding basic amount, part payments on their own dates.
function liveInterestByInstalment(p, ctx) {
    const st = ctx.settings.get(p.consumer_id) || { grace: 0, start: null };
    const rows = (0, payment_waterfall_js_1.buildInterestRows)(p.raw.receipts, p.raw.demands.filter((d) => d.raised_flag).map((d) => ({ ...d, raised: true, installment_name: d.demand_type || String(d.installment_index), due_date: d.due_date })), ctx.penalRate, { asOfDate: new Date(p.today), gracePeriodDays: st.grace, interestStartDate: st.start });
    const computed = new Map();
    for (const r of rows)
        computed.set(r.installment_index, (0, exports.r2)((computed.get(r.installment_index) || 0) + r.interest_amount));
    return computed;
}
function interestOf(p, ctx) {
    const computed = liveInterestByInstalment(p, ctx);
    const stored = new Map();
    for (const s of ctx.stored.get(p.plan_id || '') || []) {
        const e = stored.get(s.idx) || { amount: 0, waived: 0 };
        stored.set(s.idx, { amount: e.amount + s.amount, waived: e.waived + s.waived });
    }
    let charged = 0;
    for (const [idx, v] of computed)
        charged += stored.has(idx) && stored.get(idx).amount > 0 ? stored.get(idx).amount : v;
    for (const [idx, s] of stored)
        if (!computed.has(idx))
            charged += s.amount;
    const waived = [...stored.values()].reduce((a, s) => a + s.waived, 0);
    const received = p.received_interest;
    return { charged: (0, exports.r2)(charged), waived: (0, exports.r2)(waived), received, outstanding: (0, exports.r2)(Math.max(0, charged - waived - received)) };
}
// ---- small helpers shared by the report routes ----
const pct = (a, b) => (b > 0 ? Math.round((a * 10000) / b) / 100 : 0);
exports.pct = pct;
exports.MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (iso) => `${exports.MON[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
exports.monthLabel = monthLabel;
// case-insensitive "contains" with no wildcards (% and _ are plain characters)
const contains = (v, needle) => !needle || (v || '').toLowerCase().includes(needle.toLowerCase());
exports.contains = contains;
// the share of a payment that is not tax and not interest: what counts against the unit cost
const principalOf = (cleared, cgst, sgst, interest) => (0, exports.r2)(Math.max(0, cleared - cgst - sgst - interest));
exports.principalOf = principalOf;
// a due demand's outstanding split into amount / cgst / sgst in proportion to its parts (exact when nothing or everything is paid)
const split = (d) => (d.total > 0 ? { amount: (d.balance * (d.base + d.addon)) / d.total, cgst: (d.balance * d.cgst) / d.total, sgst: (d.balance * d.sgst) / d.total } : { amount: 0, cgst: 0, sgst: 0 });
exports.split = split;
//# sourceMappingURL=report-ledger.js.map