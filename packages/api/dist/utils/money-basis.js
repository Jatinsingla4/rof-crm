"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEMAND_COLS = exports.demandTotal = exports.eligibleSum = exports.eligibleAmountSql = exports.returnedSql = exports.eligibleReceipt = void 0;
exports.deriveDemandStatus = deriveDemandStatus;
exports.allocateEligible = allocateEligible;
exports.loadEligible = loadEligible;
exports.loadAllocations = loadAllocations;
exports.paidByDemand = paidByDemand;
exports.creditSummary = creditSummary;
exports.recomputePlan = recomputePlan;
// One definition of money for the whole CRM (owner decision Q13, "cleared payment basis").
//  - Eligible money = receipts with status 'cleared' that are not ADV copies, less the approved returns of those receipts (receipt_returns).
//    Pending, authorized, deposited, on-hold, bounced and cancelled receipts are not money. Old ADV rows stay in the database as legacy records and are never counted.
//  - A cleared receipt covers its own instalment up to that instalment's total. The excess is customer credit; it reaches another instalment
//    only through an approved credit allocation (credit_allocations), never by itself.
//  - A demand's status follows from that money and from its dates (D1): paid, partial, demanded (raised_at set or due_date reached, business
//    timezone), otherwise pending. raised_at and due_date are never cleared here (D8).
const payment_waterfall_js_1 = require("./payment-waterfall.js");
const receipt_allocation_js_1 = require("./receipt-allocation.js");
const business_date_js_1 = require("./business-date.js");
// SQL predicate for eligible money on a receipts alias (before approved returns are taken off)
const eligibleReceipt = (a = 'r') => `${a}.status = 'cleared' AND ${a}.is_advance IS NOT TRUE`;
exports.eligibleReceipt = eligibleReceipt;
// SQL expression: the approved returns of one receipt, optionally only those posted by a cutoff (as-of reports, D6)
const returnedSql = (a = 'r', asOf) => `COALESCE((SELECT SUM(x.amount) FROM receipt_returns x WHERE x.receipt_id = ${a}.id AND x.status = 'approved'${asOf ? ` AND x.posted_at < (${asOf}::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'` : ''}), 0)`;
exports.returnedSql = returnedSql;
// SQL expression: the amount of one receipt that counts as money (0 when it is not eligible)
const eligibleAmountSql = (a = 'r', asOf) => `CASE WHEN ${(0, exports.eligibleReceipt)(a)} THEN ${a}.amount_received_inr - ${(0, exports.returnedSql)(a, asOf)} ELSE 0 END`;
exports.eligibleAmountSql = eligibleAmountSql;
// SQL expression: sum of eligible money of the receipts in scope
const eligibleSum = (a = 'r') => `COALESCE(SUM(${(0, exports.eligibleAmountSql)(a)}), 0)`;
exports.eligibleSum = eligibleSum;
// The status rules in the order the owner approved them (D1, D3)
function deriveDemandStatus(d, paid, today = (0, business_date_js_1.businessToday)()) {
    if (d.status === 'cancelled')
        return 'cancelled';
    if (d.total > 0 && paid >= d.total - 0.005)
        return 'paid';
    if (paid > 0.005)
        return 'partial';
    if (d.raised || (d.due_date != null && d.due_date <= today))
        return 'demanded';
    return 'pending';
}
const num = (v) => (v == null || v === '' ? 0 : Number(v));
const demandTotal = (d) => num(d.amount_due_inr) + num(d.cgst_amount) + num(d.sgst_amount) + num(d.addon_charge_amount) + num(d.addon_cgst_amount) + num(d.addon_sgst_amount);
exports.demandTotal = demandTotal;
// Paid per demand from eligible receipts. Receipts with neither a demand nor an instalment are credit, not payment, so they are left out of the allocation.
function allocateEligible(receipts, demands) {
    const rs = receipts.filter((r) => r.status === 'cleared' && r.is_advance !== true && (r.demand_id || (r.installment_index !== null && r.installment_index !== undefined)));
    const live = demands.filter((d) => d.status !== 'cancelled');
    return new Map((0, payment_waterfall_js_1.applyWaterfall)(rs, live).map((w) => [String(w.demand_id), w.paid]));
}
// The eligible receipts of a plan with their approved returns already taken off (optionally one receipt reduced further, to test a return before it is approved)
async function loadEligible(client, planId, further) {
    const rs = (await client.query(`SELECT r.id, r.demand_id, r.installment_index, r.status, r.is_advance, r.amount_received_inr - ${(0, exports.returnedSql)('r')} AS amount_received_inr
       FROM receipts r WHERE r.payment_plan_id = $1 AND ${(0, exports.eligibleReceipt)('r')}`, [planId])).rows;
    return rs.map((r) => (further && r.id === further.receiptId ? { ...r, amount_received_inr: num(r.amount_received_inr) - further.amount } : r)).filter((r) => num(r.amount_received_inr) > 0.005);
}
// Approved credit allocations of a plan, by demand
async function loadAllocations(client, planId) {
    const rows = (await client.query(`SELECT demand_id, SUM(amount) AS amount FROM credit_allocations WHERE payment_plan_id = $1 AND status = 'approved' GROUP BY demand_id`, [planId])).rows;
    return new Map(rows.map((r) => [String(r.demand_id), num(r.amount)]));
}
// Paid per demand: cleared money linked to it plus the credit allocated to it, never above its total
function paidByDemand(receipts, allocations, demands) {
    const cleared = allocateEligible(receipts, demands);
    const out = new Map();
    for (const d of demands)
        if (d.status !== 'cancelled')
            out.set(String(d.id), Math.min((0, exports.demandTotal)(d), (cleared.get(String(d.id)) || 0) + (allocations.get(String(d.id)) || 0)));
    return out;
}
exports.DEMAND_COLS = `id, consumer_id, installment_index, status, delivery_status, due_date::text AS due_date, (raised_at IS NOT NULL) AS raised,
            amount_due_inr, cgst_amount, sgst_amount, addon_charge_amount, addon_cgst_amount, addon_sgst_amount`;
// Eligible money, what it paid on demands, what was allocated, and the credit left (>= 0 when the books are consistent)
async function creditSummary(client, planId, further) {
    const ds = (await client.query(`SELECT ${exports.DEMAND_COLS} FROM demands WHERE payment_plan_id = $1 AND status <> 'cancelled'`, [planId])).rows;
    const rs = await loadEligible(client, planId, further);
    const al = await loadAllocations(client, planId);
    const cleared = allocateEligible(rs, ds);
    const eligible = rs.reduce((s, r) => s + num(r.amount_received_inr), 0);
    const used = [...cleared.values()].reduce((s, v) => s + v, 0);
    const allocated = [...al.values()].reduce((s, v) => s + v, 0);
    return { eligible, used, allocated, credit: Math.round((eligible - used - allocated) * 100) / 100 };
}
// Rewrites the status of every demand of a plan from the money rules. Idempotent: it derives everything from receipts, approved returns,
// approved credit allocations and the demand dates.
async function recomputePlan(client, planId, userId = null) {
    if (!planId)
        return 0;
    const ds = (await client.query(`SELECT ${exports.DEMAND_COLS} FROM demands WHERE payment_plan_id = $1 ORDER BY installment_index, created_at FOR UPDATE`, [planId])).rows;
    if (!ds.length)
        return 0;
    const paid = paidByDemand(await loadEligible(client, planId), await loadAllocations(client, planId), ds);
    const today = (0, business_date_js_1.businessToday)();
    let changed = 0;
    for (const d of ds) {
        if (d.status === 'cancelled')
            continue;
        const p = paid.get(String(d.id)) || 0;
        const next = deriveDemandStatus({ status: d.status, raised: d.raised, due_date: d.due_date, total: (0, exports.demandTotal)(d) }, p, today);
        const same = next === d.status || (next === 'demanded' && d.status === 'raised');
        // delivery_status follows payment only: paid / partial are set, a leftover paid / partial mark is reset, letter states (queued, sent) are kept
        let delivery = d.delivery_status;
        if (next === 'paid' || next === 'partial')
            delivery = next;
        else if (d.delivery_status === 'paid' || d.delivery_status === 'partial')
            delivery = next === 'demanded' ? 'queued' : 'pending';
        if (same && delivery === d.delivery_status)
            continue;
        await client.query(`UPDATE demands SET status = $2, delivery_status = $3, updated_at = NOW() WHERE id = $1`, [d.id, same ? d.status : next, delivery]);
        if (!same) {
            await client.query(`INSERT INTO financial_audit_logs (consumer_id, payment_plan_id, user_id, action_type, old_value, new_value, remarks)
         VALUES ($1, $2, COALESCE($3::uuid, (SELECT id FROM users WHERE role = 'super_admin' ORDER BY created_at LIMIT 1)), 'demand_status_recomputed', $4, $5, $6)`, [d.consumer_id, planId, userId, JSON.stringify({ status: d.status, delivery_status: d.delivery_status }), JSON.stringify({ status: next, delivery_status: delivery }),
                `Instalment ${d.installment_index}: status follows cleared money (paid ${p})`]);
        }
        changed++;
    }
    if (await (0, receipt_allocation_js_1.allocationOn)(client))
        await (0, receipt_allocation_js_1.writeAllocations)(client, planId, ds); // flag receipt_allocation_v1 (off by default): which receipt settled which demand
    return changed;
}
//# sourceMappingURL=money-basis.js.map