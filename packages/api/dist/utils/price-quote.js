"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.priceQuote = priceQuote;
// One read-only price quote for a booking: the same arithmetic the schedule uses when a booking is confirmed
// (basic = rate x the unit's true carpet area; GST per charge head from the project's GST mapping; discount taken off the price, GST stays on the full price).
// The booking form and the consumer card show this instead of working out tax in the browser (CRM-CALC-002, 006, 012).
const gst_resolver_js_1 = require("./gst-resolver.js");
const balcony_charge_js_1 = require("./balcony-charge.js");
const project_settings_js_1 = require("./project-settings.js");
async function priceQuote(db, q) {
    const basic = Math.round(q.rate * q.carpetArea);
    const heads = [['BASIC', basic], ['PLC', q.plc], ['OTHER CHARGE', q.other]];
    const basicRate = q.isNri ? { cgstPct: 0, sgstPct: 0 } : await (0, gst_resolver_js_1.resolveRate)(db, q.projectId, q.projectName, 'BASIC', q.bookingDate);
    const { rate: bRate, cap, maxArea } = await (0, project_settings_js_1.balconyTerms)(db, q.projectId);
    const bal = (0, balcony_charge_js_1.computeBalconyCharge)(q.balconyArea, bRate, cap, basicRate.cgstPct, basicRate.sgstPct, maxArea);
    heads.push(['BALCONY', bal.balconyChargeAmount]);
    const lines = [];
    for (const [charge_head, taxable] of heads) {
        if (!taxable)
            continue;
        const r = q.isNri ? { cgstPct: 0, sgstPct: 0 } : await (0, gst_resolver_js_1.resolveRate)(db, q.projectId, q.projectName, charge_head, q.bookingDate);
        lines.push({ charge_head, taxable, cgst_pct: r.cgstPct * 100, sgst_pct: r.sgstPct * 100, cgst: Math.round(taxable * r.cgstPct), sgst: Math.round(taxable * r.sgstPct) });
    }
    const price = basic + q.plc + q.other + bal.balconyChargeAmount - q.discount - (q.rebate || 0);
    const gst = lines.reduce((s, l) => s + l.cgst + l.sgst, 0);
    return { basic_inr: basic, balcony_inr: bal.balconyChargeAmount, plc_inr: q.plc, other_charge_inr: q.other, discount_inr: q.discount,
        agreement_value_inr: Math.round(price), tax_lines: lines, gst_inr: gst, total_with_gst_inr: Math.round(price) + gst };
}
//# sourceMappingURL=price-quote.js.map