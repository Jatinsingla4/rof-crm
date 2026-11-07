"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.quoteLegacy = quoteLegacy;
exports.saveSchedule = saveSchedule;
exports.manualSchedule = manualSchedule;
exports.fileSchedule = fileSchedule;
const balcony_charge_js_1 = require("./balcony-charge.js");
const gst_resolver_js_1 = require("./gst-resolver.js");
function quoteLegacy(i) {
    // ---- preview (browser): no discount, no rounding, one flat rate on basic+PLC+other, balcony added GST-inclusive
    const pBasicCost = i.formBasicRate * i.formCarpetArea;
    const pSub = pBasicCost + i.plc + i.other;
    const pCgst = pSub * i.formCgstPct / 100;
    const pSgst = pSub * i.formSgstPct / 100;
    const pBalcony = i.previewBalcony.charge + i.previewBalcony.cgst + i.previewBalcony.sgst;
    const preview = { basicCost: pBasicCost, subTotal: pSub, cgst: pCgst, sgst: pSgst, balconyInclusiveTotal: pBalcony, grandTotal: pSub - i.inauguralDiscount + pCgst + pSgst + pBalcony };
    // ---- save (server, payment confirmation): rounds basic, parseInt on the unit price, subtracts discount and rebate, balcony without GST
    const sBasic = (i.bookingRate > 0 && i.trueCarpetArea > 0) ? Math.round(i.bookingRate * i.trueCarpetArea) : parseInt(String(i.unitBasePrice || 0));
    const bal = (0, balcony_charge_js_1.computeBalconyCharge)(i.trueBalconyArea, i.balconyRate, i.balconyCap, i.basicCgstFraction, i.basicSgstFraction, i.balconyMaxArea);
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
const rateDb = (rates) => ({
    query: async (_sql, params) => {
        const r = rates[params[1]] || rates.BASIC;
        return { rows: [{ cgst_pct: r.cgstPct, sgst_pct: r.sgstPct }] };
    },
});
async function saveSchedule(s) {
    const db = rateDb(s.rates);
    const runShares = [];
    {
        let run = 0;
        for (const tt of s.templates)
            runShares.push(Math.round((run += (tt.percentage || 0) / 100) * 1e6) / 1e6);
    }
    const byShare = s.templates.length > 0 && s.templates.every((tt) => !tt.flat_amount_inr) && Math.abs(runShares[runShares.length - 1] - 1) < 1e-6;
    const gstSplit = byShare ? await (0, gst_resolver_js_1.splitGstAcrossInstalments)(db, 'p', 'p', '2026-01-01', s.isNri, [
        { chargeType: 'BASIC', amount: s.basicCost }, { chargeType: 'PLC', amount: s.plc },
        { chargeType: 'OTHER CHARGE', amount: s.other }, { chargeType: 'BALCONY', amount: s.balconyCharge },
    ], runShares) : null;
    const rows = [];
    for (const [ti, tmpl] of s.templates.entries()) {
        const pct = (tmpl.percentage || 0) / 100;
        const amountDue = tmpl.flat_amount_inr ? Math.trunc(tmpl.flat_amount_inr)
            : byShare ? Math.round(s.totalAmount * runShares[ti]) - Math.round(s.totalAmount * (ti ? runShares[ti - 1] : 0)) : Math.round(s.totalAmount * pct);
        const basicPortion = tmpl.flat_amount_inr ? amountDue : Math.round(s.basicCost * pct);
        const plcPortion = tmpl.flat_amount_inr ? 0 : Math.round(s.plc * pct);
        const otherPortion = tmpl.flat_amount_inr ? 0 : Math.round(s.other * pct);
        const balconyPortion = tmpl.flat_amount_inr ? 0 : Math.round(s.balconyCharge * pct);
        const g = gstSplit ? { cgstAmount: gstSplit.cgst[ti], sgstAmount: gstSplit.sgst[ti] } : await (0, gst_resolver_js_1.resolveGstForComponents)(db, 'p', 'p', '2026-01-01', s.isNri, [
            { chargeType: 'BASIC', amount: basicPortion }, { chargeType: 'PLC', amount: plcPortion },
            { chargeType: 'OTHER CHARGE', amount: otherPortion }, { chargeType: 'BALCONY', amount: balconyPortion },
        ]);
        rows.push({ amountDue, cgst: g.cgstAmount, sgst: g.sgstAmount });
    }
    return rows;
}
async function manualSchedule(s) {
    const db = rateDb(s.rates);
    const total = s.totalAmount;
    const basic = total - s.plc - s.other - s.balconyCharge;
    const rows = [];
    for (const t of s.templates) {
        const pct = Number(t.percentage) / 100;
        const g = await (0, gst_resolver_js_1.resolveGstForComponents)(db, 'p', 'p', '2026-01-01', !!s.manualNri, [
            { chargeType: 'BASIC', amount: Math.round(basic * pct) },
            { chargeType: 'PLC', amount: Math.round(s.plc * pct) },
            { chargeType: 'OTHER CHARGE', amount: Math.round(s.other * pct) },
            { chargeType: 'BALCONY', amount: Math.round(s.balconyCharge * pct) },
        ]);
        rows.push({ amountDue: Math.round(total * pct), cgst: g.cgstAmount, sgst: g.sgstAmount });
    }
    return rows;
}
function fileSchedule(s) {
    const basePrice = s.basePrice ?? s.basicCost;
    const cgstPct = s.fileCgstPct ?? 0, sgstPct = s.fileSgstPct ?? 0;
    return s.templates.map((t) => {
        const pct = t.percentage || 0;
        const netBsp = basePrice * pct / 100;
        const otherInst = (s.plc + s.other) * pct / 100;
        const dbAmt = s.demandRows?.[t.installment_index];
        const instAmt = dbAmt ? dbAmt.amt : Math.round(netBsp + otherInst);
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
//# sourceMappingURL=quote.js.map