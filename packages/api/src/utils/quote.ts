// PARITY-ONLY quote calculation. NOT wired into any route or screen yet.
//
// Today three places work out a booking's money, each with its own arithmetic:
//   preview : the browser preview in web/public/js/pages/booking.js (previewBooking, ~2517-2542)
//   save    : booking.ts PATCH /:id payment confirmation (~897-931)
//   file    : booking.ts applicant file builder (~1490-1531)
// This module reproduces each one exactly, line for line, and returns all three side by side.
// The differences between them are PRESERVED on purpose (see docs/booking/QUOTE_PARITY.md).
// Do not "fix" a difference here: change policy only after the sign-off in GST_QUOTE_ARCHITECTURE.md section 8.
// test/quote-parity.test.mjs proves this file matches the real source lines and the golden fixtures.

import { computeBalconyCharge } from './balcony-charge.js';
import { resolveGstForComponents, splitGstAcrossInstalments } from './gst-resolver.js';

export interface QuoteInput {
  // what the browser form holds (percent units, e.g. 0.5 means 0.5%)
  formBasicRate: number;        // [name=basic_price]
  formCarpetArea: number;       // #bk-carpet-area (the preview multiplies by this)
  formCgstPct: number;
  formSgstPct: number;
  // balcony as the preview endpoint returned it (0s when the fetch failed or area is 0)
  previewBalcony: { charge: number; cgst: number; sgst: number };
  // true unit values and booking row values
  bookingRate: number;          // booking_records.basic_rate_inr_sqft
  trueCarpetArea: number;       // units.carpet_area_sqft
  unitBasePrice: number;        // units.base_price_inr
  trueBalconyArea: number;      // units.balcony_area_sqft
  plc: number;
  other: number;
  inauguralDiscount: number;
  approvedRebate: number;
  addonTotal: number;
  // balcony terms as balconyTerms() resolves them, and the BASIC rate as a fraction (0.005 = 0.5%)
  balconyRate: number;
  balconyCap: number | null;
  balconyMaxArea: number | null;
  basicCgstFraction: number;
  basicSgstFraction: number;
  // applicant file inputs
  fileCgstPct: number;          // booking_payment_taxes.cgst_pct, percent units
  fileSgstPct: number;
  otherChargeCgstPct: number;   // percent units
  otherChargeSgstPct: number;
  isGstExempt: boolean;
  activeDemandCgstSum: number;
  activeDemandSgstSum: number;
  activeDemandCount: number;
}

export interface LegacyQuote {
  preview: { basicCost: number; subTotal: number; cgst: number; sgst: number; balconyInclusiveTotal: number; grandTotal: number };
  save: { basicCost: number; balconyChargeAmount: number; balconyCgstAmount: number; balconySgstAmount: number; totalAmount: number };
  file: {
    netBasicPrice: number; agreementValue: number; totalConsideration: number;
    cgst: number; sgst: number; totalTax: number; totalWithTax: number;
  };
}

export function quoteLegacy(i: QuoteInput): LegacyQuote {
  // ---- preview (browser): no discount, no rounding, one flat rate on basic+PLC+other, balcony added GST-inclusive
  const pBasicCost = i.formBasicRate * i.formCarpetArea;
  const pSub = pBasicCost + i.plc + i.other;
  const pCgst = pSub * i.formCgstPct / 100;
  const pSgst = pSub * i.formSgstPct / 100;
  const pBalcony = i.previewBalcony.charge + i.previewBalcony.cgst + i.previewBalcony.sgst;
  const preview = { basicCost: pBasicCost, subTotal: pSub, cgst: pCgst, sgst: pSgst, balconyInclusiveTotal: pBalcony, grandTotal: pSub - i.inauguralDiscount + pCgst + pSgst + pBalcony };

  // ---- save (server, payment confirmation): rounds basic, parseInt on the unit price, subtracts discount and rebate, balcony without GST
  const sBasic = (i.bookingRate > 0 && i.trueCarpetArea > 0) ? Math.round(i.bookingRate * i.trueCarpetArea) : parseInt(String(i.unitBasePrice || 0));
  const bal = computeBalconyCharge(i.trueBalconyArea, i.balconyRate, i.balconyCap, i.basicCgstFraction, i.basicSgstFraction, i.balconyMaxArea);
  const save = {
    basicCost: sBasic,
    balconyChargeAmount: bal.balconyChargeAmount, balconyCgstAmount: bal.balconyCgstAmount, balconySgstAmount: bal.balconySgstAmount,
    totalAmount: sBasic + i.plc + i.other - i.inauguralDiscount - i.approvedRebate + bal.balconyChargeAmount,
  };

  // ---- applicant file: the discount and rebate are NOT subtracted here; GST is the demand sums when within 1000 of the holistic figure
  const basePrice = (i.bookingRate > 0 && i.trueCarpetArea > 0) ? Math.round(i.bookingRate * i.trueCarpetArea) : i.unitBasePrice;
  const balCgst = bal.balconyCgstAmount; // the file reads the balcony GST that save stored
  const balSgst = bal.balconySgstAmount;
  const cgstPct = i.isGstExempt ? 0 : i.fileCgstPct;
  const sgstPct = i.isGstExempt ? 0 : i.fileSgstPct;
  const agreementValue = (basePrice - i.inauguralDiscount) + i.plc + i.other + bal.balconyChargeAmount;
  const totalConsideration = agreementValue + i.addonTotal;
  const basicPlusPLC = basePrice + i.plc;
  const holisticCgst = (!i.isGstExempt && cgstPct > 0) ? Math.round(basicPlusPLC * cgstPct / 100) + Math.round(i.other * i.otherChargeCgstPct / 100) + balCgst : 0;
  const holisticSgst = (!i.isGstExempt && sgstPct > 0) ? Math.round(basicPlusPLC * sgstPct / 100) + Math.round(i.other * i.otherChargeSgstPct / 100) + balSgst : 0;
  const cgst = (i.activeDemandCount > 0 && Math.abs(i.activeDemandCgstSum - holisticCgst) <= 1000) ? i.activeDemandCgstSum : holisticCgst;
  const sgst = (i.activeDemandCount > 0 && Math.abs(i.activeDemandSgstSum - holisticSgst) <= 1000) ? i.activeDemandSgstSum : holisticSgst;
  const file = { netBasicPrice: basePrice - i.inauguralDiscount, agreementValue, totalConsideration, cgst, sgst, totalTax: cgst + sgst, totalWithTax: totalConsideration + cgst + sgst };

  return { preview, save, file };
}

// ---------------------------------------------------------------------------------------------------------------
// Instalment schedules. Three more places turn a total into rows. Reproduced as they are, differences preserved.
//   saveSchedule   : booking.ts payment confirmation (~1001-1035): rows split on running shares, GST on the PRE-discount basic price
//   manualSchedule : demands.ts manual generator (~83-100): per-row rounding, basic = total minus the rest (so POST-discount), NRI only
//   fileSchedule   : booking.ts applicant file page 2 (buildApplicantPage2, per-row block): NET BSP column from the PRE-discount price
// ---------------------------------------------------------------------------------------------------------------

export interface Template { percentage: number; flat_amount_inr?: number | null }
export interface ScheduleInput {
  templates: Template[];
  totalAmount: number;          // booking_records.total_amount_inr (post discount, balcony without GST)
  basicCost: number;            // rounded basic price before discount
  plc: number; other: number; balconyCharge: number;
  isNri: boolean;               // save path: nri, oci and pio; manual path: nri only (see manualNri)
  manualNri?: boolean;
  rates: Record<string, { cgstPct: number; sgstPct: number }>;  // percent units, per charge type
  basePrice?: number;           // file: Math.round(rate x carpet), before discount
  fileCgstPct?: number; fileSgstPct?: number; fileDiscount?: number;
  demandRows?: Record<number, { amt: number; cgst: number; sgst: number; addon?: number; addonCgst?: number; addonSgst?: number }>;
}
const rateDb = (rates: ScheduleInput['rates']) => ({
  query: async (_sql: string, params: any[]) => {
    const r = rates[params[1]] || rates.BASIC;
    return { rows: [{ cgst_pct: r.cgstPct, sgst_pct: r.sgstPct }] };
  },
});

export async function saveSchedule(s: ScheduleInput) {
  const db = rateDb(s.rates);
  const runShares: number[] = []; { let run = 0; for (const tt of s.templates) runShares.push(Math.round((run += (tt.percentage || 0) / 100) * 1e6) / 1e6); }
  const byShare = s.templates.length > 0 && s.templates.every((tt) => !tt.flat_amount_inr) && Math.abs(runShares[runShares.length - 1] - 1) < 1e-6;
  const gstSplit = byShare ? await splitGstAcrossInstalments(db, 'p', 'p', '2026-01-01', s.isNri, [
    { chargeType: 'BASIC', amount: s.basicCost }, { chargeType: 'PLC', amount: s.plc },
    { chargeType: 'OTHER CHARGE', amount: s.other }, { chargeType: 'BALCONY', amount: s.balconyCharge },
  ], runShares) : null;
  const rows: { amountDue: number; cgst: number; sgst: number }[] = [];
  for (const [ti, tmpl] of s.templates.entries()) {
    const pct = (tmpl.percentage || 0) / 100;
    const amountDue = tmpl.flat_amount_inr ? Math.trunc(tmpl.flat_amount_inr)
      : byShare ? Math.round(s.totalAmount * runShares[ti]) - Math.round(s.totalAmount * (ti ? runShares[ti - 1] : 0)) : Math.round(s.totalAmount * pct);
    const basicPortion = tmpl.flat_amount_inr ? amountDue : Math.round(s.basicCost * pct);
    const plcPortion = tmpl.flat_amount_inr ? 0 : Math.round(s.plc * pct);
    const otherPortion = tmpl.flat_amount_inr ? 0 : Math.round(s.other * pct);
    const balconyPortion = tmpl.flat_amount_inr ? 0 : Math.round(s.balconyCharge * pct);
    const g = gstSplit ? { cgstAmount: gstSplit.cgst[ti], sgstAmount: gstSplit.sgst[ti] } : await resolveGstForComponents(db, 'p', 'p', '2026-01-01', s.isNri, [
      { chargeType: 'BASIC', amount: basicPortion }, { chargeType: 'PLC', amount: plcPortion },
      { chargeType: 'OTHER CHARGE', amount: otherPortion }, { chargeType: 'BALCONY', amount: balconyPortion },
    ]);
    rows.push({ amountDue, cgst: g.cgstAmount, sgst: g.sgstAmount });
  }
  return rows;
}

export async function manualSchedule(s: ScheduleInput) {
  const db = rateDb(s.rates);
  const total = s.totalAmount;
  const basic = total - s.plc - s.other - s.balconyCharge;
  const rows: { amountDue: number; cgst: number; sgst: number }[] = [];
  for (const t of s.templates) {
    const pct = Number(t.percentage) / 100;
    const g = await resolveGstForComponents(db, 'p', 'p', '2026-01-01', !!s.manualNri, [
      { chargeType: 'BASIC', amount: Math.round(basic * pct) },
      { chargeType: 'PLC', amount: Math.round(s.plc * pct) },
      { chargeType: 'OTHER CHARGE', amount: Math.round(s.other * pct) },
      { chargeType: 'BALCONY', amount: Math.round(s.balconyCharge * pct) },
    ]);
    rows.push({ amountDue: Math.round(total * pct), cgst: g.cgstAmount, sgst: g.sgstAmount });
  }
  return rows;
}

export function fileSchedule(s: ScheduleInput) {
  const basePrice = s.basePrice ?? s.basicCost;
  const cgstPct = s.fileCgstPct ?? 0, sgstPct = s.fileSgstPct ?? 0;
  const inauguralDisc = s.fileDiscount ?? (basePrice + s.plc + s.other + s.balconyCharge - s.totalAmount), balconyChargeAmount = s.balconyCharge;
  return s.templates.map((t) => {
    const pct = t.percentage || 0;
    const netBsp = basePrice * pct / 100;
    const otherInst = (s.plc + s.other) * pct / 100;
    const dbAmt = s.demandRows?.[(t as any).installment_index];
    const instAmt = dbAmt ? dbAmt.amt : Math.round(netBsp + otherInst - inauguralDisc * pct / 100 + (t.flat_amount_inr ? 0 : balconyChargeAmount * pct / 100));   // QA-005
    const addonInst = dbAmt ? (dbAmt.addon || 0) : 0;
    const independentBalcony = t.flat_amount_inr ? 0 : Math.round(s.balconyCharge * pct / 100);
    const remainderBalcony = t.flat_amount_inr ? 0 : Math.max(0, instAmt - netBsp - otherInst - addonInst);
    const balconyInst = Math.abs(remainderBalcony - independentBalcony) > 1000 ? independentBalcony : remainderBalcony;
    const instCgst = dbAmt ? dbAmt.cgst : Math.round((netBsp + otherInst) * cgstPct) / 100;
    const instSgst = dbAmt ? dbAmt.sgst : Math.round((netBsp + otherInst) * sgstPct) / 100;
    const addonCgstInst = dbAmt ? (dbAmt.addonCgst || 0) : 0;
    const addonSgstInst = dbAmt ? (dbAmt.addonSgst || 0) : 0;
    const netDue = instAmt + instCgst + instSgst + addonInst + addonCgstInst + addonSgstInst;
    return { netBsp, otherInst, instAmt, balconyInst, instCgst, instSgst, netDue };
  });
}
