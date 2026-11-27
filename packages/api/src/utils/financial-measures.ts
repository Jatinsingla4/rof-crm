// The money measures every report and dashboard is built from, each with one name and one meaning, worked out from the same ledger (report-ledger.ts).
// They are different numbers on purpose and are never added or relabelled into one "outstanding":
//   contract_balance   everything still to be paid on the contract (all instalments, billed or not, less money collected)
//   billed_outstanding what was billed (raised) and is not yet paid by the money applied to it
//   due_outstanding    billed_outstanding that is due on or before the day
//   overdue            billed, due before the day and still unpaid
import { LedgerPlan, customerTotals, overdueOf, sum, r2 } from './report-ledger.js';

export const MEASURE_DEFINITIONS: Record<string, string> = {
  agreement_value_excl_gst: 'Price of the unit(s): basic + PLC + other charges, before GST',
  agreement_value_incl_gst: 'Every instalment of the payment plan with its GST (billed or not)',
  total_demanded_excl_gst: 'Raised instalments, before GST',
  total_demanded_incl_gst: 'Raised instalments with GST',
  valid_collections: 'Cleared, non-advance receipts less approved bank returns. Pending, deposited, bounced and cancelled money is not in it',
  uncleared_receipts: 'Receipts recorded but not cleared yet (not collected)',
  applied_to_billed: 'Part of the valid collections that has paid raised instalments',
  unallocated_credit: 'Valid collections not applied to a raised instalment: unallocated_credit_advance_on_unraised + unallocated_credit_surplus. It stays credit until a checker allocates it',
  unallocated_credit_advance_on_unraised: 'Part of unallocated_credit that has already paid instalments not yet raised (for example a booking amount on the first instalment). Settled, not spare cash',
  unallocated_credit_surplus: 'Part of unallocated_credit that has settled no instalment (the excess of a receipt over the instalment it names, or money naming none). The only part that is free credit (allocation or refund needs a checker)',
  billed_outstanding: 'Raised instalments with GST less the money applied to them',
  due_outstanding: 'billed_outstanding on instalments due on or before the day (what the dashboard calls outstanding)',
  overdue: 'Raised instalments due before the day and still unpaid',
  contract_balance: 'agreement_value_incl_gst less valid_collections (not the same as outstanding)',
  plans_with_schedule_gap: 'Bookings whose payment schedule does not add up to the price before GST (historical exceptions, listed, not repaired)',
  demanded_cgst: 'CGST on raised instalments', demanded_sgst: 'SGST on raised instalments',
  received_cgst: 'CGST stored on the cleared receipts, before approved bank returns', received_sgst: 'SGST stored on the cleared receipts, before approved bank returns',
};

// QA-030: the price of a booking against what its payment schedule asks for, before GST. A gap beyond 1 rupee per instalment means the schedule is
// incomplete or stale (a historical reconciliation exception): it is reported, never repaired here, and it is why contract_balance can be below the real cost.
export function scheduleGap(p: LedgerPlan) {
  const rows = p.demands.filter((d) => d.status !== 'cancelled');
  if (!rows.length) return { gap: 0, exception: false };
  const gap = r2(p.unit_cost - sum(rows, (d) => d.base));
  return { gap, exception: Math.abs(gap) > Math.max(1, rows.length) };
}

export function financialMeasures(plans: LedgerPlan[], asOn?: string | null) {
  const day = asOn || plans[0]?.today || null;
  const t = plans.map((p) => customerTotals(p));
  const td = plans.map((p) => customerTotals(p, day));
  const agreementIncl = sum(plans, (p) => sum(p.demands, (d) => d.total));
  const collections = sum(plans, (p) => p.received);
  const m = {
    plans: plans.length,
    agreement_value_excl_gst: sum(plans, (p) => p.unit_cost),
    agreement_value_incl_gst: agreementIncl,
    total_demanded_excl_gst: sum(t, (x) => x.base),
    total_demanded_incl_gst: sum(t, (x) => x.demanded),
    valid_collections: collections,
    uncleared_receipts: sum(plans, (p) => p.received_pending),
    applied_to_billed: sum(t, (x) => x.paid),
    unallocated_credit: sum(t, (x) => x.credit),
    unallocated_credit_advance_on_unraised: sum(t, (x) => x.advanceOnUnraised),
    unallocated_credit_surplus: sum(t, (x) => x.surplusCredit),
    billed_outstanding: sum(t, (x) => x.outstanding),
    due_outstanding: sum(td, (x) => x.outstanding),
    overdue: sum(plans, (p) => sum(overdueOf(p, day), (o) => o.d.balance)),
    contract_balance: r2(agreementIncl - collections),
    plans_with_schedule_gap: plans.filter((p) => scheduleGap(p).exception).length,   // QA-030
    demanded_cgst: sum(t, (x) => x.cgst), demanded_sgst: sum(t, (x) => x.sgst),
    received_cgst: sum(plans, (p) => p.received_cgst), received_sgst: sum(plans, (p) => p.received_sgst),
  };
  return m;
}
