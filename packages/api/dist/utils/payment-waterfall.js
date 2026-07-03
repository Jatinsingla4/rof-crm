"use strict";
/**
 * Payment Waterfall Allocation
 *
 * Distributes advance/booking receipts (those with no demand_id and no
 * installment_index) across demands in installment_index ASC order, filling
 * each demand fully before moving to the next.
 *
 * Receipts that already carry a demand_id are counted directly against that
 * demand and do not enter the advance pool.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildInterestRows = buildInterestRows;
exports.applyWaterfall = applyWaterfall;
exports.resolveBookingScope = resolveBookingScope;
exports.recomputeBookingAmount = recomputeBookingAmount;
function buildInterestRows(receipts, demands, penalRate, options) {
    const sortedDemands = [...demands].sort((a, b) => a.installment_index - b.installment_index);
    const startDate = options?.interestStartDate ?? null;
    const graceDays = options?.gracePeriodDays ?? 0;
    const active = receipts.filter(r => !['cancelled', 'bounced'].includes(r.status));
    const sorted = [...active].sort((a, b) => {
        const ta = new Date(a.received_date || a.created_at || 0).getTime();
        const tb = new Date(b.received_date || b.created_at || 0).getTime();
        return ta - tb;
    });
    // demand_id → installment_index lookup for linked receipts
    const demandIdToIdx = {};
    sortedDemands.forEach(d => { demandIdToIdx[d.id] = d.installment_index; });
    // Per-installment pre-allocated credits (linked + index-orphan receipts)
    const creditsByIdx = {};
    // Advance pool: receipts with no demand_id AND no installment_index
    const pool = [];
    for (const r of sorted) {
        const amt = parseFloat(String(r.amount_received_inr));
        const rcvdDate = r.received_date ? new Date(r.received_date) : null;
        if (r.demand_id && demandIdToIdx[r.demand_id] !== undefined) {
            const idx = demandIdToIdx[r.demand_id];
            if (!creditsByIdx[idx])
                creditsByIdx[idx] = [];
            creditsByIdx[idx].push({ amount: amt, received_date: rcvdDate });
        }
        else if (!r.demand_id && r.installment_index !== null) {
            const idx = Number(r.installment_index);
            if (!creditsByIdx[idx])
                creditsByIdx[idx] = [];
            creditsByIdx[idx].push({ amount: amt, received_date: rcvdDate });
        }
        else {
            pool.push({ remaining: amt, received_date: rcvdDate });
        }
    }
    const rows = [];
    for (const demand of sortedDemands) {
        // Full NET DUE = BSP + GST + addon
        // + addon GST (Option B — interest
        // on complete installment amount).
        // Non-addon bookings unaffected:
        // optional fields default via || 0.
        const dueAmt = parseFloat(String(demand.amount_due_inr || 0))
            + parseFloat(String(demand.cgst_amount || 0))
            + parseFloat(String(demand.sgst_amount || 0))
            + parseFloat(String(demand.addon_charge_amount || 0))
            + parseFloat(String(demand.addon_cgst_amount || 0))
            + parseFloat(String(demand.addon_sgst_amount || 0));
        const dueDate = demand.due_date ? new Date(demand.due_date) : null;
        let balance = dueAmt;
        let isFirst = true;
        let anyApplied = false;
        const effectiveRate = (demand.interest_rate_percent != null && demand.interest_rate_percent > 0)
            ? Number(demand.interest_rate_percent)
            : penalRate;
        const applyCredit = (applied, rcvdDate) => {
            const balanceBeforePayment = balance;
            balance -= applied;
            let delayDays = 0;
            if (dueDate && rcvdDate) {
                const diff = Math.floor((rcvdDate.getTime() - dueDate.getTime()) / 86400000);
                delayDays = Math.max(0, diff);
            }
            const delayAmt = Math.max(0, balanceBeforePayment);
            const afterStartDate = startDate ? (rcvdDate != null && rcvdDate >= startDate) : true;
            const intPeriod = Math.max(0, delayDays - graceDays);
            const intAmt = delayAmt > 0 && intPeriod > 0 && afterStartDate
                ? Math.round(delayAmt * effectiveRate / 100 / 365 * intPeriod * 100) / 100
                : 0;
            rows.push({
                installment_name: demand.installment_name,
                installment_index: demand.installment_index,
                installment_date: dueDate,
                due_amount: dueAmt,
                amount_received: applied,
                date_received: rcvdDate,
                delay_amount: delayAmt,
                delay_days: delayDays,
                grace_period: graceDays,
                interest_period: intPeriod,
                roi: effectiveRate,
                interest_amount: intAmt,
                is_first_receipt: isFirst,
            });
            isFirst = false;
            anyApplied = true;
        };
        // Pre-allocated credits first
        for (const credit of (creditsByIdx[demand.installment_index] || [])) {
            if (balance <= 0)
                break;
            applyCredit(Math.min(credit.amount, balance), credit.received_date);
        }
        // Then advance pool in waterfall order
        for (const entry of pool) {
            if (balance <= 0)
                break;
            if (entry.remaining <= 0)
                continue;
            const applied = Math.min(entry.remaining, balance);
            entry.remaining -= applied;
            applyCredit(applied, entry.received_date);
        }
        if (!anyApplied) {
            const asOf = options?.asOfDate ?? null;
            const delayDays = asOf && dueDate
                ? Math.max(0, Math.floor((asOf.getTime() - dueDate.getTime()) / 86400000))
                : 0;
            const intPeriod = Math.max(0, delayDays - graceDays);
            const intAmt = dueAmt > 0 && intPeriod > 0
                ? Math.round(dueAmt * effectiveRate / 100 / 365 * intPeriod * 100) / 100
                : 0;
            rows.push({
                installment_name: demand.installment_name,
                installment_index: demand.installment_index,
                installment_date: dueDate,
                due_amount: dueAmt,
                amount_received: 0,
                date_received: null,
                delay_amount: dueAmt,
                delay_days: delayDays,
                grace_period: graceDays,
                interest_period: intPeriod,
                roi: effectiveRate,
                interest_amount: intAmt,
                is_first_receipt: true,
            });
        }
    }
    return rows;
}
function applyWaterfall(receipts, demands) {
    const sorted = [...demands].sort((a, b) => a.installment_index - b.installment_index);
    // Linked receipts → count directly against their demand
    const linkedMap = {};
    for (const r of receipts) {
        if (r.demand_id && r.status !== 'cancelled') {
            linkedMap[r.demand_id] = (linkedMap[r.demand_id] || 0) + Number(r.amount_received_inr);
        }
    }
    // Index-targeted orphans: demand_id=NULL but installment_index is set
    // These were recorded before the demand existed; credit them by matching index
    const indexOrphanMap = {};
    for (const r of receipts) {
        if (!r.demand_id && r.installment_index !== null && r.status !== 'cancelled') {
            const idx = Number(r.installment_index);
            indexOrphanMap[idx] = (indexOrphanMap[idx] || 0) + Number(r.amount_received_inr);
        }
    }
    // Advance pool: receipts with no demand_id AND no installment_index
    let pool = receipts
        .filter(r => !r.demand_id && r.installment_index === null && r.status !== 'cancelled')
        .reduce((s, r) => s + Number(r.amount_received_inr), 0);
    const results = [];
    for (const d of sorted) {
        // Addon charges included so waterfall
        // fills installment to its real capacity
        // (BSP+OC+GST+addon+addonGST) before
        // overflowing to the next installment.
        // Non-addon bookings unaffected:
        // addon columns default 0 (mig 081).
        const totalDue = Number(d.amount_due_inr)
            + Number(d.cgst_amount)
            + Number(d.sgst_amount)
            + Number(d.addon_charge_amount || 0)
            + Number(d.addon_cgst_amount || 0)
            + Number(d.addon_sgst_amount || 0);
        // Merge demand-linked + index-orphan amounts for this installment
        const linked = (linkedMap[d.id] || 0) + (indexOrphanMap[d.installment_index] || 0);
        const gap = Math.max(0, totalDue - linked);
        const fromPool = Math.min(pool, gap);
        pool -= fromPool;
        const rawPaid = linked + fromPool;
        const paid = Math.min(rawPaid, totalDue);
        results.push({
            installment_index: d.installment_index,
            demand_id: d.id,
            paid,
            fully_covered: totalDue > 0 && rawPaid >= totalDue,
        });
    }
    return results;
}
// ── booking_amount auto-recompute ───────────────────────────────────────────
/**
 * Resolves the (unit_id, project_id) a receipt's payments apply to, so a
 * booking_amount recompute can be scoped to the single correct booking
 * instead of all of a consumer's bookings. booking_records.payment_plan_id
 * is never populated at booking creation, so this goes through payment_plans
 * instead of joining on it directly.
 */
async function resolveBookingScope(client, receipt) {
    let paymentPlanId = receipt.payment_plan_id;
    if (!paymentPlanId && receipt.demand_id) {
        const demandPlan = await client.query(`SELECT payment_plan_id FROM demands WHERE id = $1`, [receipt.demand_id]);
        paymentPlanId = demandPlan.rows[0]?.payment_plan_id;
    }
    if (!paymentPlanId)
        return null;
    const plan = await client.query(`SELECT unit_id, project_id FROM payment_plans WHERE id = $1`, [paymentPlanId]);
    if (plan.rows.length === 0)
        return null;
    return { unitId: plan.rows[0].unit_id, projectId: plan.rows[0].project_id, paymentPlanId };
}
/**
 * booking_amount = amount of the earliest CLEARED receipt (by created_at) tied
 * to this specific booking's payment plan (directly via payment_plan_id, or
 * indirectly via a demand belonging to that plan). Scoping by payment_plan_id
 * (not just consumer_id) prevents a receipt from an unrelated booking of the
 * same consumer from being picked up. Zero cleared receipts → booking_amount = 0.
 * Auto-recompute always wins over any manual document-writeback edit.
 */
async function recomputeBookingAmount(client, consumerId, unitId, projectId, paymentPlanId) {
    const result = await client.query(`SELECT amount_received_inr FROM receipts
     WHERE consumer_id = $1 AND status = 'cleared'
       AND (payment_plan_id = $2
            OR demand_id IN (SELECT id FROM demands WHERE payment_plan_id = $2))
     ORDER BY created_at ASC LIMIT 1`, [consumerId, paymentPlanId]);
    const newAmount = result.rows.length > 0 ? result.rows[0].amount_received_inr : 0;
    await client.query(`UPDATE booking_records
     SET booking_amount = $1
     WHERE consumer_id = $2 AND unit_id = $3
       AND project_id = $4 AND status != 'cancelled'`, [newAmount, consumerId, unitId, projectId]);
}
//# sourceMappingURL=payment-waterfall.js.map