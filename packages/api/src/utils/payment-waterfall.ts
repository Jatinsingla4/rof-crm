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
}

export interface WaterfallResult {
  installment_index: number;
  demand_id: string;
  paid: number;
  fully_covered: boolean; // paid >= totalDue (and totalDue > 0)
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
