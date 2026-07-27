/**
 * Balcony Charge — GST-exclusive/additive formula.
 *
 * The configured rate is GST-EXCLUSIVE: MIN(area x rate, cap) IS the base
 * amount directly, and CGST/SGST are computed on top of that base and
 * ADDED, so the final payable total (base+cgst+sgst) is strictly greater
 * than the base alone.
 *
 * Pure function — no I/O. Callers are responsible for resolving `rate`/
 * `cap` (charge_master_config) and `cgstPct`/`sgstPct` (gst-resolver.ts's
 * resolveRate, pre-zeroed by the caller for GST-exempt consumers) before
 * calling this.
 */
export function computeBalconyCharge(
  area: number,
  rate: number,
  cap: number | null,
  cgstPct: number,
  sgstPct: number
): { balconyChargeAmount: number; balconyCgstAmount: number; balconySgstAmount: number } {
  const balconyChargeRawExact = rate > 0 && area > 0 ? area * rate : 0;
  const balconyBasePaise = Math.round(
    (cap != null ? Math.min(balconyChargeRawExact, cap) : balconyChargeRawExact) * 100
  );
  const gstPct = cgstPct + sgstPct;

  let basePaise: number;
  let cgstPaise: number;
  let sgstPaise: number;

  basePaise = balconyBasePaise;
  if (gstPct > 0) {
    if (cgstPct === sgstPct) {
      cgstPaise = Math.round(basePaise * cgstPct);
      sgstPaise = cgstPaise;
    } else {
      cgstPaise = Math.round(basePaise * cgstPct);
      sgstPaise = Math.round(basePaise * sgstPct);
    }
  } else {
    cgstPaise = 0;
    sgstPaise = 0;
  }

  return {
    balconyChargeAmount: basePaise / 100,
    balconyCgstAmount: cgstPaise / 100,
    balconySgstAmount: sgstPaise / 100,
  };
}
