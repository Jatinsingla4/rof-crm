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

export interface WaterfallReceipt {
  id: string;
  amount_received_inr: number;
  demand_id: string | null;
  installment_index: number | null;
  status: string;
  received_date?: string | Date | null;
  payment_method?: string | null;
}

export interface WaterfallDemand {
  id: string;
  installment_index: number;
  amount_due_inr: number;
  cgst_amount: number;
  sgst_amount: number;
  addon_charge_amount: number;
  addon_cgst_amount: number;
  addon_sgst_amount: number;
}

export interface WaterfallResult {
  installment_index: number;
  demand_id: string;
  paid: number;
  fully_covered: boolean; // paid >= totalDue (and totalDue > 0)
}

export interface InterestRow {
  installment_name: string;
  installment_index: number;
  installment_date: Date | null;
  due_amount: number;
  amount_received: number;
  date_received: Date | null;
  delay_amount: number;
  delay_days: number;
  grace_period: number;
  interest_period: number;
  roi: number;
  interest_amount: number;
  is_first_receipt: boolean;
}

export function buildInterestRows(
  receipts: Array<{
    id: string;
    amount_received_inr: string | number;
    demand_id: string | null;
    installment_index: number | null;
    status: string;
    received_date?: Date | string | null;
    created_at?: Date | string | null;
  }>,
  demands: Array<{
    id: string;
    installment_index: number;
    installment_name: string;
    due_date: Date | string | null;
    amount_due_inr: string | number;
    interest_rate_percent?: number | null;
  }>,
  penalRate: number,
  options?: {
    interestStartDate?: Date | null;
    gracePeriodDays?: number;
    asOfDate?: Date | null;
  }
): InterestRow[] {
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
  const demandIdToIdx: Record<string, number> = {};
  sortedDemands.forEach(d => { demandIdToIdx[d.id] = d.installment_index; });

  // Per-installment pre-allocated credits (linked + index-orphan receipts)
  const creditsByIdx: Record<number, Array<{ amount: number; received_date: Date | null }>> = {};
  // Advance pool: receipts with no demand_id AND no installment_index
  const pool: Array<{ remaining: number; received_date: Date | null }> = [];

  for (const r of sorted) {
    const amt      = parseFloat(String(r.amount_received_inr));
    const rcvdDate = r.received_date ? new Date(r.received_date) : null;
    if (r.demand_id && demandIdToIdx[r.demand_id] !== undefined) {
      const idx = demandIdToIdx[r.demand_id];
      if (!creditsByIdx[idx]) creditsByIdx[idx] = [];
      creditsByIdx[idx].push({ amount: amt, received_date: rcvdDate });
    } else if (!r.demand_id && r.installment_index !== null) {
      const idx = Number(r.installment_index);
      if (!creditsByIdx[idx]) creditsByIdx[idx] = [];
      creditsByIdx[idx].push({ amount: amt, received_date: rcvdDate });
    } else {
      pool.push({ remaining: amt, received_date: rcvdDate });
    }
  }

  const rows: InterestRow[] = [];

  for (const demand of sortedDemands) {
    const dueAmt  = parseFloat(String(demand.amount_due_inr));
    const dueDate = demand.due_date ? new Date(demand.due_date) : null;
    let balance   = dueAmt;
    let isFirst   = true;
    let anyApplied = false;

    const effectiveRate = (demand.interest_rate_percent != null && demand.interest_rate_percent > 0)
      ? Number(demand.interest_rate_percent)
      : penalRate;

    const applyCredit = (applied: number, rcvdDate: Date | null) => {
      const balanceBeforePayment = balance;
      balance -= applied;
      let delayDays = 0;
      if (dueDate && rcvdDate) {
        const diff = Math.floor((rcvdDate.getTime() - dueDate.getTime()) / 86400000);
        delayDays  = Math.max(0, diff);
      }
      const delayAmt  = Math.max(0, balanceBeforePayment);
      const afterStartDate = startDate ? (rcvdDate != null && rcvdDate >= startDate) : true;
      const intPeriod = Math.max(0, delayDays - graceDays);
      const intAmt    = delayAmt > 0 && intPeriod > 0 && afterStartDate
        ? Math.round(delayAmt * effectiveRate / 100 / 365 * intPeriod * 100) / 100
        : 0;
      rows.push({
        installment_name:  demand.installment_name,
        installment_index: demand.installment_index,
        installment_date:  dueDate,
        due_amount:        dueAmt,
        amount_received:   applied,
        date_received:     rcvdDate,
        delay_amount:      delayAmt,
        delay_days:        delayDays,
        grace_period:      graceDays,
        interest_period:   intPeriod,
        roi:               effectiveRate,
        interest_amount:   intAmt,
        is_first_receipt:  isFirst,
      });
      isFirst    = false;
      anyApplied = true;
    };

    // Pre-allocated credits first
    for (const credit of (creditsByIdx[demand.installment_index] || [])) {
      if (balance <= 0) break;
      applyCredit(Math.min(credit.amount, balance), credit.received_date);
    }

    // Then advance pool in waterfall order
    for (const entry of pool) {
      if (balance <= 0) break;
      if (entry.remaining <= 0) continue;
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
        installment_name:  demand.installment_name,
        installment_index: demand.installment_index,
        installment_date:  dueDate,
        due_amount:        dueAmt,
        amount_received:   0,
        date_received:     null,
        delay_amount:      dueAmt,
        delay_days:        delayDays,
        grace_period:      graceDays,
        interest_period:   intPeriod,
        roi:               effectiveRate,
        interest_amount:   intAmt,
        is_first_receipt:  true,
      });
    }
  }

  return rows;
}

export function applyWaterfall(
  receipts: WaterfallReceipt[],
  demands: WaterfallDemand[],
): WaterfallResult[] {
  const sorted = [...demands].sort((a, b) => a.installment_index - b.installment_index);

  // Linked receipts → count directly against their demand
  const linkedMap: Record<string, number> = {};
  for (const r of receipts) {
    if (r.demand_id && r.status !== 'cancelled') {
      linkedMap[r.demand_id] = (linkedMap[r.demand_id] || 0) + Number(r.amount_received_inr);
    }
  }

  // Index-targeted orphans: demand_id=NULL but installment_index is set
  // These were recorded before the demand existed; credit them by matching index
  const indexOrphanMap: Record<number, number> = {};
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

  const results: WaterfallResult[] = [];

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
      + Number(d.addon_cgst_amount   || 0)
      + Number(d.addon_sgst_amount   || 0);
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
