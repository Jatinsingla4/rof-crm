"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeInclusiveGstSplit = computeInclusiveGstSplit;
/**
 * BASIC-charge GST-inclusive paise-reconciliation formula.
 *
 * booking_amount is GST-INCLUSIVE: base/CGST/SGST are derived BACKWARD from
 * it using integer-paise arithmetic, guaranteeing base+cgst+sgst always sums
 * exactly to the inclusive gross amount (paisa-exact, not just rupee-exact).
 * Mirrors balcony-charge.ts's computeBalconyCharge() formula.
 *
 * Pure function — no I/O. Callers are responsible for resolving cgstPct/
 * sgstPct (gst-resolver.ts's resolveRate(), pre-zeroed by the caller for
 * GST-exempt consumers) before calling this. cgstPct/sgstPct are PERCENTAGE
 * POINTS (e.g. 0.5 for 0.5%), matching how booking_payment_taxes.cgst_pct/
 * sgst_pct are stored — not fractions.
 */
function computeInclusiveGstSplit(grossAmount, cgstPct, sgstPct) {
    const grossPaise = Math.round((grossAmount || 0) * 100);
    const combinedRate = cgstPct + sgstPct;
    let basePaise;
    let cgstPaise;
    let sgstPaise;
    if (combinedRate > 0) {
        basePaise = Math.floor(grossPaise / (1 + combinedRate / 100));
        const totalTaxPaise = grossPaise - basePaise;
        if (cgstPct === sgstPct) {
            cgstPaise = Math.floor(totalTaxPaise / 2);
            sgstPaise = totalTaxPaise - cgstPaise;
        }
        else {
            cgstPaise = Math.round(totalTaxPaise * (cgstPct / combinedRate));
            sgstPaise = totalTaxPaise - cgstPaise;
        }
    }
    else {
        basePaise = grossPaise;
        cgstPaise = 0;
        sgstPaise = 0;
    }
    return {
        baseAmount: basePaise / 100,
        cgstAmount: cgstPaise / 100,
        sgstAmount: sgstPaise / 100,
    };
}
//# sourceMappingURL=gst-backward-derive.js.map