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

import { resolveRate } from './gst-resolver.js';
import { computeInclusiveGstSplit } from './gst-backward-derive.js';
import { computeReceiptGstSplit } from './gst-receipt-split.js';

import { nextReceiptNumber } from './receipt-number.js';
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
    cgst_amount?: string | number | null;
    sgst_amount?: string | number | null;
  }>,
  demands: Array<{
    id: string;
    installment_index: number;
    installment_name: string;
    due_date: Date | string | null;
    amount_due_inr: string | number;
    interest_rate_percent?: number | null;
    cgst_amount?: string | number;
    sgst_amount?: string | number;
    addon_charge_amount?: string | number;
    addon_cgst_amount?: string | number;
    addon_sgst_amount?: string | number;
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

  // Interest runs on the BASIC amount, the way the client's own file does it: a receipt counts without its CGST and SGST, a demand without its tax.
  // Money is matched to the oldest installment first, by date received, whatever installment the receipt was filed under
  // (a receipt entered while an earlier cheque was still pending was filed under the wrong installment and charged interest that was not due).
  const pool: Array<{ remaining: number; received_date: Date | null }> = [];
  for (const r of sorted) {
    const gross = parseFloat(String(r.amount_received_inr));
    const amt = Math.max(0, gross - (parseFloat(String(r.cgst_amount ?? 0)) || 0) - (parseFloat(String(r.sgst_amount ?? 0)) || 0));
    pool.push({ remaining: amt, received_date: r.received_date ? new Date(r.received_date) : null });
  }
  const rows: InterestRow[] = [];

  for (const demand of sortedDemands) {
    // The basic amount of the installment (plus the base of an add-on charge), without GST
    const dueAmt  = parseFloat(String(demand.amount_due_inr || 0))
      + parseFloat(String(demand.addon_charge_amount || 0));
    const dueDate = demand.due_date ? new Date(demand.due_date) : null;
    let balance   = dueAmt;
    let isFirst   = true;
    let anyApplied = false;
    let lastEventDate = dueDate;

    const effectiveRate = (demand.interest_rate_percent != null && demand.interest_rate_percent > 0)
      ? Number(demand.interest_rate_percent)
      : penalRate;

    const applyCredit = (applied: number, rcvdDate: Date | null) => {
      const balanceBeforePayment = balance;
      balance -= applied;
      let delayDays = 0;
      if (dueDate && lastEventDate && rcvdDate) {
        const diff = Math.floor((rcvdDate.getTime() - lastEventDate.getTime()) / 86400000);
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
        delay_amount:      intAmt > 0 ? Math.max(0, delayAmt) : Math.max(0, balance),
        delay_days:        delayDays,
        grace_period:      graceDays,
        interest_period:   intPeriod,
        roi:               effectiveRate,
        interest_amount:   intAmt,
        is_first_receipt:  isFirst,
      });
      isFirst    = false;
      anyApplied = true;
      // A payment made before the due date does not start the clock: later delay is counted from the due date (same rule as the trailing row below)
      lastEventDate = rcvdDate && dueDate && rcvdDate < dueDate ? dueDate : rcvdDate;
    };

    // Oldest money first
    for (const entry of pool) {
      if (balance <= 0) break;
      if (entry.remaining <= 0) continue;
      const applied = Math.min(entry.remaining, balance);
      entry.remaining -= applied;
      applyCredit(applied, entry.received_date);
    }

    if (anyApplied && balance > 0) {
      const asOf = options?.asOfDate ?? null;
      let delayDays = 0;
      let intPeriod = 0;
      let intAmt = 0;
      if (dueDate) {
        const anchorDate = lastEventDate
          ? new Date(Math.max(lastEventDate.getTime(), dueDate.getTime()))
          : dueDate;
        delayDays = asOf
          ? Math.max(0, Math.floor((asOf.getTime() - anchorDate.getTime()) / 86400000))
          : 0;
        intPeriod = Math.max(0, delayDays - graceDays);
        intAmt = balance > 0 && intPeriod > 0
          ? Math.round(balance * effectiveRate / 100 / 365 * intPeriod * 100) / 100
          : 0;
      }
      rows.push({
        installment_name:  demand.installment_name,
        installment_index: demand.installment_index,
        installment_date:  dueDate,
        due_amount:        dueAmt,
        amount_received:   0,
        date_received:     null,
        delay_amount:      balance,
        delay_days:        delayDays,
        grace_period:      graceDays,
        interest_period:   intPeriod,
        roi:               effectiveRate,
        interest_amount:   intAmt,
        is_first_receipt:  false,
      });
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

// ── booking_amount auto-recompute ───────────────────────────────────────────

/**
 * Resolves the (unit_id, project_id) a receipt's payments apply to, so a
 * booking_amount recompute can be scoped to the single correct booking
 * instead of all of a consumer's bookings. booking_records.payment_plan_id
 * is never populated at booking creation, so this goes through payment_plans
 * instead of joining on it directly.
 */
export async function resolveBookingScope(
  client: any,
  receipt: { payment_plan_id: string | null; demand_id: string | null },
): Promise<{ unitId: string; projectId: string; paymentPlanId: string } | null> {
  let paymentPlanId = receipt.payment_plan_id;
  if (!paymentPlanId && receipt.demand_id) {
    const demandPlan = await client.query(
      `SELECT payment_plan_id FROM demands WHERE id = $1`,
      [receipt.demand_id]
    );
    paymentPlanId = demandPlan.rows[0]?.payment_plan_id;
  }
  if (!paymentPlanId) return null;

  const plan = await client.query(
    `SELECT unit_id, project_id FROM payment_plans WHERE id = $1`,
    [paymentPlanId]
  );
  if (plan.rows.length === 0) return null;

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
export async function recomputeBookingAmount(
  client: any,
  consumerId: string,
  unitId: string,
  projectId: string,
  paymentPlanId: string,
): Promise<void> {
  const result = await client.query(
    `SELECT amount_received_inr FROM receipts
     WHERE consumer_id = $1 AND status = 'cleared'
       AND (payment_plan_id = $2
            OR demand_id IN (SELECT id FROM demands WHERE payment_plan_id = $2))
     ORDER BY created_at ASC LIMIT 1`,
    [consumerId, paymentPlanId]
  );
  const newAmount = result.rows.length > 0 ? result.rows[0].amount_received_inr : 0;

  await client.query(
    `UPDATE booking_records
     SET booking_amount = $1
     WHERE consumer_id = $2 AND unit_id = $3
       AND project_id = $4 AND status != 'cancelled'`,
    [newAmount, consumerId, unitId, projectId]
  );
}

/**
 * Keeps booking_payment_taxes.cgst_amount/sgst_amount in sync with
 * booking_records.booking_amount after recomputeBookingAmount() runs (receipt
 * cancel / bounce paths). Without this, a receipt cancel/bounce silently
 * desyncs the stored tax amounts from the now-changed booking_amount --
 * the amounts stay frozen at whatever they were computed from at the last
 * PATCH /:id, permanently mismatched from the new booking_amount.
 *
 * No-op if the booking has no booking_payment_taxes row yet (never
 * confirmed via PATCH /:id).
 */
export async function recomputeBookingPaymentTaxes(
  client: any,
  consumerId: string,
  unitId: string,
  projectId: string,
): Promise<void> {
  const bookingRes = await client.query(
    `SELECT id, booking_amount, booking_date
     FROM booking_records
     WHERE consumer_id = $1 AND unit_id = $2 AND project_id = $3 AND status != 'cancelled'
     LIMIT 1`,
    [consumerId, unitId, projectId]
  );
  if (bookingRes.rows.length === 0) return;
  const booking = bookingRes.rows[0];

  const bptRes = await client.query(
    `SELECT id FROM booking_payment_taxes WHERE booking_record_id = $1`,
    [booking.id]
  );
  if (bptRes.rows.length === 0) return;

  const bookingDateForGst = booking.booking_date
    ? new Date(booking.booking_date).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  const projectRow = await client.query('SELECT name FROM projects WHERE id = $1', [projectId]);
  const projectName = projectRow.rows[0]?.name || projectId;

  const consumerRow = await client.query('SELECT nationality FROM consumers WHERE id = $1', [consumerId]);
  const isNri = ['nri', 'NRI', 'oci', 'OCI', 'pio', 'PIO'].includes(consumerRow.rows[0]?.nationality);

  const gstRate = isNri
    ? { cgstPct: 0, sgstPct: 0 }
    : await resolveRate(client, projectId, projectName, 'BASIC', bookingDateForGst);

  const gstSplit = computeInclusiveGstSplit(
    parseFloat(booking.booking_amount),
    gstRate.cgstPct * 100,
    gstRate.sgstPct * 100
  );

  await client.query(
    `UPDATE booking_payment_taxes
     SET cgst_amount = $1, sgst_amount = $2
     WHERE booking_record_id = $3`,
    [gstSplit.cgstAmount, gstSplit.sgstAmount, booking.id]
  );
}

// ── installment-1 auto-raise on first receipt ───────────────────────────────

/**
 * Fires when a newly-created receipt lands on installment_index=1. If no
 * OTHER receipt already holds a valid (non-bounced/cancelled) claim on
 * installment_index=1 for this plan, this receipt is the first valid one --
 * raise the installment 1 demand using this receipt's own received_date,
 * replicating PATCH /demands/activate's effect (payments.ts) exactly,
 * including its audit_logs entry and orphan-receipt-linking side effect.
 * No-op if installment 1's demand already has a due_date (either raised
 * manually by staff before this receipt existed, or already auto-raised --
 * both are treated as "already has its date", never overwritten), or if a
 * different valid idx1 receipt already exists (this receipt is a duplicate/
 * extra, not the first). Guarding on due_date rather than status also
 * covers the case where this same receipt fully covers the demand and the
 * pre-existing auto-match logic (payments.ts POST /receipts) has already
 * flipped it straight to 'paid' -- due_date still gets set in that case,
 * without downgrading status back to 'demanded'.
 */
export async function checkAndAutoRaiseInstallment1(
  client: any,
  paymentPlanId: string,
  receiptId: string,
  receivedDate: string,
  userId: string | null,
): Promise<void> {
  const otherValid = await client.query(
    `SELECT id FROM receipts
     WHERE payment_plan_id = $1 AND installment_index = 1
       AND id != $2 AND status NOT IN ('bounced', 'cancelled')
     LIMIT 1`,
    [paymentPlanId, receiptId]
  );
  if (otherValid.rows.length > 0) return;

  const demandRes = await client.query(
    `SELECT id, consumer_id, status, due_date FROM demands
     WHERE payment_plan_id = $1 AND installment_index = 1 AND demand_type IN ('installment', 'booking')
     ORDER BY created_at ASC LIMIT 1`,
    [paymentPlanId]
  );
  if (demandRes.rows.length === 0) return;
  const demand = demandRes.rows[0];
  if (demand.due_date != null) return;

  await client.query(
    `UPDATE demands
     SET due_date = $1, generated_at = NOW(), raised_at = NOW(),
         status = CASE WHEN status = 'pending' THEN 'demanded' ELSE status END,
         delivery_status = CASE WHEN status = 'pending' THEN 'queued' ELSE delivery_status END
     WHERE id = $2`,
    [receivedDate, demand.id]
  );

  await client.query(
    `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_values)
     VALUES ($1, 'DEMAND_RAISE', 'demand', $2, $3)`,
    [userId, demand.id, JSON.stringify({
      installment_date: receivedDate, due_date: receivedDate,
      consumer_id: demand.consumer_id, installment_index: 1,
      auto_raised: true, trigger_receipt_id: receiptId,
    })]
  );

  // Directly link the triggering receipt itself -- Step-G receipts always
  // carry installment_index = NULL, so the installment_index=1 query below
  // never matches them on its own.
  await client.query(
    `UPDATE receipts SET demand_id = $1, updated_at = NOW()
     WHERE id = $2 AND demand_id IS NULL`,
    [demand.id, receiptId]
  );

  const retroResult = await client.query(
    `UPDATE receipts
     SET demand_id = $1, updated_at = NOW()
     WHERE consumer_id = $2 AND installment_index = 1
       AND demand_id IS NULL AND status != 'cancelled'
     RETURNING receipt_number, amount_received_inr`,
    [demand.id, demand.consumer_id]
  );

  if (retroResult.rows.length > 0) {
    const totalLinked = retroResult.rows.reduce(
      (s: number, r: any) => s + parseFloat(r.amount_received_inr), 0
    );
    try {
      await client.query(
        `INSERT INTO financial_audit_logs
           (consumer_id, action_type, old_value, new_value, remarks)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          demand.consumer_id,
          'receipts_retroactively_linked',
          JSON.stringify({ demand_id: null }),
          JSON.stringify({ demand_id: demand.id }),
          `${retroResult.rows.length} receipt(s) totalling ₹${totalLinked} retroactively linked to demand ${demand.id} (installment_index=1, auto-raise)`,
        ]
      );
    } catch (auditErr: any) {
      console.error('Retro-link audit log failed (non-fatal):', auditErr.message);
    }
  }

  const [wfRcpts, wfDemands] = await Promise.all([
    client.query(
      `SELECT id, amount_received_inr, demand_id, installment_index, status
       FROM receipts WHERE consumer_id = $1 AND status != 'cancelled'`,
      [demand.consumer_id]
    ),
    client.query(
      `SELECT id, installment_index, amount_due_inr, cgst_amount, sgst_amount,
              addon_charge_amount, addon_cgst_amount, addon_sgst_amount
       FROM demands WHERE consumer_id = $1`,
      [demand.consumer_id]
    ),
  ]);

  const wfResult = applyWaterfall(wfRcpts.rows, wfDemands.rows)
    .find((w) => w.demand_id === demand.id);

  if (wfResult?.fully_covered) {
    await client.query(
      `UPDATE demands SET status = 'paid', delivery_status = 'paid', updated_at = NOW() WHERE id = $1`,
      [demand.id]
    );
    await client.query(
      `INSERT INTO financial_audit_logs
         (consumer_id, payment_plan_id, user_id, action_type, old_value, new_value, remarks)
       VALUES ($1, $2, $3, 'demand_auto_paid',
         '{"status":"demanded","delivery_status":"queued"}',
         '{"status":"paid","delivery_status":"paid"}',
         'Auto-marked paid: fully covered on installment-1 auto-raise')`,
      [demand.consumer_id, paymentPlanId, userId]
    );
  }
}

/**
 * Fires when a receipt with installment_index=1 is bounced/cancelled. If no
 * OTHER valid (non-bounced/cancelled) installment_index=1 receipt still
 * exists for this plan, reverts the installment 1 demand back to its
 * pre-raise state. Mirrors the manual PATCH /demands/:id/cancel reversal
 * (payments.ts), which is the only existing code path that nulls due_date --
 * neither the bounce nor the receipt-cancel endpoint does this today.
 */
export async function reverseInstallment1IfNoValidReceipt(
  client: any,
  paymentPlanId: string,
): Promise<void> {
  const stillValid = await client.query(
    `SELECT id FROM receipts
     WHERE payment_plan_id = $1 AND installment_index = 1
       AND status NOT IN ('bounced', 'cancelled')
     LIMIT 1`,
    [paymentPlanId]
  );
  if (stillValid.rows.length > 0) return;

  await client.query(
    `UPDATE demands
     SET status = 'pending', due_date = NULL, raised_at = NULL,
         delivery_status = 'pending', updated_at = NOW()
     WHERE payment_plan_id = $1 AND installment_index = 1
       AND demand_type IN ('installment', 'booking')
       AND (due_date IS NOT NULL OR status <> 'pending')`,
    [paymentPlanId]
  );
}

// ── overpayment cascade (shared by POST /payments/receipts and booking.ts's Step-G) ──

/**
 * Hops any excess beyond a just-fully-paid demand forward across as many
 * successive unpaid demands as needed, creating a synthetic is_advance
 * receipt at each hop, until the excess is fully absorbed or no further
 * demand remains. Extracted byte-for-byte from payments.ts POST /receipts'
 * inline cascade loop so booking.ts's Step-G receipt can trigger the same
 * behavior a manual receipt's overpayment already does. Transaction-agnostic:
 * takes whatever client/transaction the caller already has open.
 */
export async function cascadeOverpaymentExcess(
  client: any,
  consumerId: string,
  paymentPlanId: string,
  sourceDemandId: string,
  excessAmount: number,
  method: string,
  userId: string | null,
  sourceReceiptId: string | null = null,
): Promise<void> {
  const sourceRes = await client.query(
    `SELECT installment_index FROM demands WHERE id = $1`,
    [sourceDemandId]
  );
  if (sourceRes.rows.length === 0) return;

  // Synthetic advance receipts inherit the bank account of the receipt whose
  // overpayment triggered the cascade (same money, same account); null if
  // the source receipt has none set.
  let inheritedBankAccountId: string | null = null;
  let sourceDate: string | null = null;   // an advance part carries the date of the payment it came from, not today
  if (sourceReceiptId) {
    const sourceReceiptRes = await client.query(
      `SELECT company_bank_account_id, received_date::text AS received_date FROM receipts WHERE id = $1`,
      [sourceReceiptId]
    );
    inheritedBankAccountId = sourceReceiptRes.rows[0]?.company_bank_account_id || null;
    sourceDate = sourceReceiptRes.rows[0]?.received_date || null;
  }

  let excess = excessAmount;
  let sourceId = sourceDemandId;
  let cascadeFromIdx = sourceRes.rows[0].installment_index;

  while (excess > 0) {
    const nextDemand = await client.query(
      `SELECT id, installment_index, amount_due_inr, cgst_amount, sgst_amount FROM demands
       WHERE payment_plan_id = $1
         AND consumer_id = $2
         AND installment_index > $3
         AND status != 'paid'
       ORDER BY installment_index ASC
       LIMIT 1`,
      [paymentPlanId, consumerId, cascadeFromIdx]
    );
    if (!nextDemand.rows[0]) break;
    const nextId = nextDemand.rows[0].id;
    const nextIdx = nextDemand.rows[0].installment_index;
    const advanceNum = await nextReceiptNumber(client, '-ADV');
    const advanceReceiptRes = await client.query(
      `INSERT INTO receipts
         (consumer_id, payment_plan_id, demand_id, installment_index, amount_received_inr,
          payment_method, received_date, received_by_user_id, receipt_number,
          plc_amount, status, approval_status, print_status,
          is_advance, advance_from_demand_id, company_bank_account_id)
       VALUES ($1,$2,$3,$4,$5,$6,COALESCE($11::date, CURRENT_DATE),$7,$8,0,'pending','pending','not_printed',true,$9,$10)
       RETURNING id`,
      [consumerId, paymentPlanId, nextId, nextIdx, excess,
       method, userId, advanceNum, sourceId, inheritedBankAccountId, sourceDate]
    );
    const advanceReceiptId = advanceReceiptRes.rows[0].id;
    await client.query(
      `UPDATE payment_plans SET advance_amount = COALESCE(advance_amount, 0) + $1, updated_at = NOW() WHERE id = $2`,
      [excess, paymentPlanId]
    );

    const planProjectRes = await client.query(
      `SELECT project_id FROM payment_plans WHERE id = $1`,
      [paymentPlanId]
    );
    const advanceProjectId: string | null = planProjectRes.rows[0]?.project_id || null;
    const advanceReceivedDate = sourceDate || new Date().toISOString().split('T')[0];
    const advanceGstSplit = await computeReceiptGstSplit(client, excess, advanceProjectId, advanceReceivedDate);
    await client.query(
      `UPDATE receipts SET cgst_amount = $1, sgst_amount = $2 WHERE id = $3`,
      [advanceGstSplit.cgstAmount, advanceGstSplit.sgstAmount, advanceReceiptId]
    );

    const nextPaidResult = await client.query(
      `SELECT COALESCE(SUM(amount_received_inr), 0) as total_paid
       FROM receipts WHERE demand_id = $1 AND status != 'cancelled'`,
      [nextId]
    );
    const nextTotalPaid = parseFloat(nextPaidResult.rows[0].total_paid);
    const nextAmountDue = parseFloat(nextDemand.rows[0].amount_due_inr)
                        + parseFloat(nextDemand.rows[0].cgst_amount || 0)
                        + parseFloat(nextDemand.rows[0].sgst_amount || 0);

    if (nextTotalPaid >= nextAmountDue) {
      await client.query(
        `UPDATE demands SET status = 'paid', delivery_status = 'paid', updated_at = NOW() WHERE id = $1`,
        [nextId]
      );
      excess = nextTotalPaid - nextAmountDue;
      sourceId = nextId;
      cascadeFromIdx = nextIdx;
    } else {
      await client.query(
        `UPDATE demands SET delivery_status = 'partial', updated_at = NOW() WHERE id = $1`,
        [nextId]
      );
      excess = 0;
    }
  }
}
