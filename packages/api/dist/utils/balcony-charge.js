"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeBalconyCharge = computeBalconyCharge;
/**
 * Balcony Charge — GST-inclusive paise-reconciliation formula.
 *
 * The configured rate is GST-INCLUSIVE: the cap applies to the final,
 * tax-included figure, and base/CGST/SGST are derived BACKWARD from it
 * using integer-paise arithmetic, guaranteeing base+cgst+sgst always sums
 * exactly to the capped/inclusive total (paisa-exact, not just
 * rupee-exact).
 *
 * Pure function — no I/O. Callers are responsible for resolving `rate`/
 * `cap` (charge_master_config) and `cgstPct`/`sgstPct` (gst-resolver.ts's
 * resolveRate, pre-zeroed by the caller for GST-exempt consumers) before
 * calling this.
 */
function computeBalconyCharge(area, rate, cap, cgstPct, sgstPct) {
    const balconyChargeRawExact = rate > 0 && area > 0 ? area * rate : 0;
    const balconyRawInclusivePaise = Math.round((cap != null ? Math.min(balconyChargeRawExact, cap) : balconyChargeRawExact) * 100);
    const gstPct = cgstPct + sgstPct;
    let basePaise;
    let cgstPaise;
    let sgstPaise;
    if (gstPct > 0) {
        basePaise = Math.floor(balconyRawInclusivePaise / (1 + gstPct));
        const totalTaxPaise = balconyRawInclusivePaise - basePaise;
        if (cgstPct === sgstPct) {
            cgstPaise = Math.floor(totalTaxPaise / 2);
            sgstPaise = totalTaxPaise - cgstPaise;
        }
        else {
            cgstPaise = Math.round(totalTaxPaise * (cgstPct / gstPct));
            sgstPaise = totalTaxPaise - cgstPaise;
        }
    }
    else {
        basePaise = balconyRawInclusivePaise;
        cgstPaise = 0;
        sgstPaise = 0;
    }
    return {
        balconyChargeAmount: basePaise / 100,
        balconyCgstAmount: cgstPaise / 100,
        balconySgstAmount: sgstPaise / 100,
    };
}
//# sourceMappingURL=balcony-charge.js.map