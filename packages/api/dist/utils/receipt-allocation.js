"use strict";
// RC-3: which receipt settled which demand, and how much of it was principal and GST. Derived from the same money rules as the demand status
// (cleared receipts, approved returns taken off, linked money first, unlinked money to the oldest gap first), so the rows always add up to the paid
// amounts the screens show. Rebuilt on every recompute, so cancelling a receipt removes its rows. Written only while receipt_allocation_v1 is 'on'.
Object.defineProperty(exports, "__esModule", { value: true });
exports.allocationOn = void 0;
exports.allocateReceipts = allocateReceipts;
exports.splitLines = splitLines;
exports.planAllocationRows = planAllocationRows;
exports.writeAllocations = writeAllocations;
const allocationOn = async (db) => (await db.query(`SELECT value FROM global_settings WHERE key = 'receipt_allocation_v1'`)).rows[0]?.value === 'on';
exports.allocationOn = allocationOn;
const n = (v) => (v == null || v === '' ? 0 : Number(v));
const r2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
const total = (d) => n(d.amount_due_inr) + n(d.cgst_amount) + n(d.sgst_amount) + n(d.addon_charge_amount) + n(d.addon_cgst_amount) + n(d.addon_sgst_amount);
// receipts: eligible ones, oldest first. demands: live ones of one plan.
function allocateReceipts(receipts, demands) {
    const ds = [...demands].sort((a, b) => a.installment_index - b.installment_index);
    const gap = new Map(ds.map((d) => [String(d.id), total(d)]));
    const byIndex = new Map(ds.map((d) => [Number(d.installment_index), String(d.id)]));
    const out = [];
    const put = (receipt_id, demand_id, want) => {
        const take = r2(Math.min(want, gap.get(demand_id) || 0));
        if (take <= 0)
            return 0;
        gap.set(demand_id, r2((gap.get(demand_id) || 0) - take));
        out.push({ receipt_id, demand_id, amount: take });
        return take;
    };
    for (const r of receipts) { // money that names a demand, or an instalment, counts against it
        const target = r.demand_id ? String(r.demand_id) : r.installment_index != null ? byIndex.get(Number(r.installment_index)) : undefined;
        if (target && gap.has(target))
            put(r.id, target, r.amount);
    }
    for (const r of receipts) { // money that names neither fills the oldest gap first
        if (r.demand_id || r.installment_index != null)
            continue;
        let left = r.amount;
        for (const d of ds) {
            if (left <= 0.004)
                break;
            left = r2(left - put(r.id, String(d.id), left));
        }
    }
    return out;
}
// One row per receipt and demand: principal (instalment + add-on charge), CGST and SGST taken from the demand's own lines in proportion, never re-extracted from the gross.
function splitLines(amount, d) {
    const t = total(d) || 1;
    const cgst = r2(amount * (n(d.cgst_amount) + n(d.addon_cgst_amount)) / t), sgst = r2(amount * (n(d.sgst_amount) + n(d.addon_sgst_amount)) / t);
    return { principal: r2(amount - cgst - sgst), cgst, sgst };
}
// The rows one plan's cleared money would settle: the same eligible money and demands the status uses. Nothing is written.
async function planAllocationRows(client, planId, demands) {
    const rs = (await client.query(`SELECT r.id, r.demand_id, r.installment_index, r.amount_received_inr::float8 - (SELECT COALESCE(SUM(rr.amount),0)::float8 FROM receipt_returns rr WHERE rr.receipt_id = r.id AND rr.status = 'approved') AS amount
       FROM receipts r WHERE r.payment_plan_id = $1 AND r.status = 'cleared' AND r.is_advance IS NOT TRUE
      ORDER BY COALESCE(r.clearing_date, r.received_date, r.created_at), r.id`, [planId])).rows;
    const live = demands.filter((d) => d.status !== 'cancelled');
    const rows = allocateReceipts(rs.filter((r) => r.amount > 0.004).map((r) => ({ id: r.id, amount: r.amount, demand_id: r.demand_id, installment_index: r.installment_index })), live);
    return { rows, live };
}
async function writeAllocations(client, planId, demands) {
    const { rows, live } = await planAllocationRows(client, planId, demands);
    await client.query(`DELETE FROM receipt_allocation WHERE receipt_id IN (SELECT id FROM receipts WHERE payment_plan_id = $1)`, [planId]);
    const byId = new Map(live.map((d) => [String(d.id), d]));
    for (const a of rows) {
        const d = byId.get(a.demand_id), s = splitLines(a.amount, d);
        await client.query(`INSERT INTO receipt_allocation (receipt_id, demand_id, charge_head, principal, cgst, sgst) VALUES ($1, $2, $3, $4, $5, $6)`, [a.receipt_id, a.demand_id, d.demand_type || 'INSTALMENT', s.principal, s.cgst, s.sgst]);
    }
    return rows.length;
}
//# sourceMappingURL=receipt-allocation.js.map