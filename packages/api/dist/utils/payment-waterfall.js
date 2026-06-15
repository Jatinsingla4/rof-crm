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
        const dueAmt = parseFloat(String(demand.amount_due_inr));
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
            rows.push({
                installment_name: demand.installment_name,
                installment_index: demand.installment_index,
                installment_date: dueDate,
                due_amount: dueAmt,
                amount_received: 0,
                date_received: null,
                delay_amount: dueAmt,
                delay_days: 0,
                grace_period: graceDays,
                interest_period: 0,
                roi: effectiveRate,
                interest_amount: 0,
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
        const totalDue = Number(d.amount_due_inr) + Number(d.cgst_amount) + Number(d.sgst_amount);
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
//# sourceMappingURL=payment-waterfall.js.map