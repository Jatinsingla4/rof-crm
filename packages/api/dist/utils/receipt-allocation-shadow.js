"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.allocationShadow = allocationShadow;
// Before the allocation is switched on: what it WOULD settle on every plan, set against what the waterfall (the status rules) says each demand has paid.
// Reads only. A mismatch means the two do not agree for that demand and finance must look at it before the flag is turned on.
const receipt_allocation_js_1 = require("./receipt-allocation.js");
const money_basis_js_1 = require("./money-basis.js");
const r2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
const num = (v) => (v == null || v === '' ? 0 : Number(v));
async function allocationShadow(db) {
    const plans = (await db.query(`SELECT DISTINCT payment_plan_id FROM receipts WHERE payment_plan_id IS NOT NULL AND status = 'cleared' AND is_advance IS NOT TRUE`)).rows;
    const mismatches = [];
    let demandsChecked = 0, rowsPlanned = 0, receiptsOverAllocated = 0;
    for (const { payment_plan_id: planId } of plans) {
        const ds = (await db.query(`SELECT ${money_basis_js_1.DEMAND_COLS} FROM demands WHERE payment_plan_id = $1`, [planId])).rows;
        if (!ds.length)
            continue;
        const { rows, live } = await (0, receipt_allocation_js_1.planAllocationRows)(db, planId, ds);
        const credit = await (0, money_basis_js_1.loadAllocations)(db, planId);
        const waterfall = (0, money_basis_js_1.paidByDemand)(await (0, money_basis_js_1.loadEligible)(db, planId), credit, ds);
        const planned = new Map(), byReceipt = new Map();
        for (const a of rows) {
            planned.set(a.demand_id, r2((planned.get(a.demand_id) || 0) + a.amount));
            byReceipt.set(a.receipt_id, r2((byReceipt.get(a.receipt_id) || 0) + a.amount));
        }
        rowsPlanned += rows.length;
        for (const d of live) {
            demandsChecked++;
            const total = num(d.amount_due_inr) + num(d.cgst_amount) + num(d.sgst_amount) + num(d.addon_charge_amount) + num(d.addon_cgst_amount) + num(d.addon_sgst_amount);
            const fromAllocation = r2(Math.min(total, (planned.get(String(d.id)) || 0) + (credit.get(String(d.id)) || 0)));
            const fromWaterfall = r2(waterfall.get(String(d.id)) || 0);
            if (Math.abs(fromAllocation - fromWaterfall) > 0.011)
                mismatches.push({ payment_plan_id: planId, demand_id: d.id, installment_index: d.installment_index, demand_total: r2(total), waterfall_paid: fromWaterfall, allocation_paid: fromAllocation, difference: r2(fromAllocation - fromWaterfall) });
        }
        const elig = await (0, money_basis_js_1.loadEligible)(db, planId);
        for (const e of elig)
            if ((byReceipt.get(String(e.id)) || 0) > num(e.amount_received_inr) + 0.011)
                receiptsOverAllocated++;
    }
    return { plans_checked: plans.length, demands_checked: demandsChecked, rows_planned: rowsPlanned, receipts_over_allocated: receiptsOverAllocated, mismatch_count: mismatches.length, mismatches };
}
//# sourceMappingURL=receipt-allocation-shadow.js.map