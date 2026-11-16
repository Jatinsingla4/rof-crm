// One read-only price quote for a booking: the same arithmetic the schedule uses when a booking is confirmed
// (basic = rate x the unit's true carpet area; GST per charge head from the project's GST mapping; discount taken off the price, GST stays on the full price).
// The booking form and the consumer card show this instead of working out tax in the browser (CRM-CALC-002, 006, 012).
import { resolveRate } from './gst-resolver.js';
import { computeBalconyCharge } from './balcony-charge.js';
import { balconyTerms } from './project-settings.js';

export interface QuoteIn {
  projectId: string; projectName: string; bookingDate: string; isNri: boolean;
  rate: number; carpetArea: number; balconyArea: number;
  plc: number; other: number; discount: number; rebate?: number;
}
export interface QuoteLine { charge_head: string; taxable: number; cgst_pct: number; sgst_pct: number; cgst: number; sgst: number }

export async function priceQuote(db: any, q: QuoteIn) {
  const basic = Math.round(q.rate * q.carpetArea);
  const heads: [string, number][] = [['BASIC', basic], ['PLC', q.plc], ['OTHER CHARGE', q.other]];
  const basicRate = q.isNri ? { cgstPct: 0, sgstPct: 0 } : await resolveRate(db, q.projectId, q.projectName, 'BASIC', q.bookingDate);
  const { rate: bRate, cap, maxArea } = await balconyTerms(db, q.projectId);
  const bal = computeBalconyCharge(q.balconyArea, bRate, cap, basicRate.cgstPct, basicRate.sgstPct, maxArea);
  heads.push(['BALCONY', bal.balconyChargeAmount]);
  const lines: QuoteLine[] = [];
  for (const [charge_head, taxable] of heads) {
    if (!taxable) continue;
    const r = q.isNri ? { cgstPct: 0, sgstPct: 0 } : await resolveRate(db, q.projectId, q.projectName, charge_head, q.bookingDate);
    lines.push({ charge_head, taxable, cgst_pct: r.cgstPct * 100, sgst_pct: r.sgstPct * 100, cgst: Math.round(taxable * r.cgstPct), sgst: Math.round(taxable * r.sgstPct) });
  }
  const price = basic + q.plc + q.other + bal.balconyChargeAmount - q.discount - (q.rebate || 0);
  const gst = lines.reduce((s, l) => s + l.cgst + l.sgst, 0);
  return { basic_inr: basic, balcony_inr: bal.balconyChargeAmount, plc_inr: q.plc, other_charge_inr: q.other, discount_inr: q.discount,
    agreement_value_inr: Math.round(price), tax_lines: lines, gst_inr: gst, total_with_gst_inr: Math.round(price) + gst };
}
