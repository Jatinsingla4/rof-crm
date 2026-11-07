export interface GstComponents {
  cgstAmount: number;
  sgstAmount: number;
}

export interface ChargeComponent {
  chargeType: string;
  amount: number;
}

export async function resolveRate(
  db: any,
  projectId: string,
  projectName: string,
  chargeType: string,
  bookingDate: string
): Promise<{ cgstPct: number; sgstPct: number }> {
  const r = await db.query(
    `SELECT gts.cgst_pct, gts.sgst_pct
     FROM gst_tax_charge_mapping gcm
     JOIN gst_slabs gs ON gs.id = gcm.slab_id
       AND gs.from_date <= $3::date
       AND gs.to_date   >= $3::date
     JOIN gst_tax_setup gts ON gts.id = gcm.gst_tax_id
     WHERE gcm.project_id = $1
       AND gcm.charge_type = $2
     LIMIT 1`,
    [projectId, chargeType, bookingDate]
  );
  if (r.rows.length === 0) {
    // For non-BASIC charge types, fall back to the BASIC rate rather than
    // crashing the booking. BASIC itself must always be configured — if
    // missing, still throw.
    if (chargeType !== 'BASIC') {
      const fallbackRes = await db.query(
        `SELECT gts.cgst_pct, gts.sgst_pct
         FROM gst_tax_charge_mapping gcm
         JOIN gst_slabs gs ON gs.id = gcm.slab_id
           AND gs.from_date <= $2::date
           AND gs.to_date   >= $2::date
         JOIN gst_tax_setup gts ON gts.id = gcm.gst_tax_id
         WHERE gcm.project_id = $1
           AND gcm.charge_type = 'BASIC'
         LIMIT 1`,
        [projectId, bookingDate]
      );
      const fallback = fallbackRes.rows[0];
      if (fallback) {
        console.warn(
          `[GST] No mapping for charge type "${chargeType}" on project "${projectName}" ` +
          `— falling back to BASIC rate (${fallback.cgst_pct}% CGST). ` +
          `Configure OTHER CHARGE mapping in Set Master > Set Up > GST Configuration.`
        );
        return {
          cgstPct: parseFloat(fallback.cgst_pct) / 100,
          sgstPct: parseFloat(fallback.sgst_pct) / 100,
        };
      }
    }
    throw Object.assign(new Error(
      `No GST mapping found for project "${projectName}" (${projectId}), ` +
      `charge type "${chargeType}", as of ${bookingDate}. ` +
      `Please configure this in Set Master > Set Up > GST Configuration > GST TAX CHARGE MAPPING before completing this booking.`
    ), { http: 422 });
  }
  return {
    cgstPct: parseFloat(r.rows[0].cgst_pct) / 100,
    sgstPct: parseFloat(r.rows[0].sgst_pct) / 100,
  };
}

export async function resolveGstForComponents(
  db: any,
  projectId: string,
  projectName: string,
  bookingDate: string,
  isNri: boolean,
  components: ChargeComponent[]
): Promise<GstComponents> {
  if (isNri) {
    return { cgstAmount: 0, sgstAmount: 0 };
  }
  let cgstAmount = 0;
  let sgstAmount = 0;
  for (const comp of components) {
    if (comp.amount === 0) continue;
    const { cgstPct, sgstPct } = await resolveRate(
      db, projectId, projectName, comp.chargeType, bookingDate
    );
    cgstAmount += Math.round(comp.amount * cgstPct);
    sgstAmount += Math.round(comp.amount * sgstPct);
  }
  return { cgstAmount, sgstAmount };
}

// GST of every instalment of one booking, so that the instalments add up to the GST of the whole price.
// Rounding each instalment on its own drifts by a rupee or more (half a rupee each time); here each component's GST is rounded on the running total
// (cumulative share of the plan) and an instalment gets the difference, so the last one absorbs the leftover and the sum is exact.
// cumShares: the running share of the plan after each instalment (0.2, 0.5, 1 for a 20/30/50 plan).
export async function splitGstAcrossInstalments(
  db: any,
  projectId: string,
  projectName: string,
  bookingDate: string,
  isNri: boolean,
  components: ChargeComponent[],
  cumShares: number[]
): Promise<{ cgst: number[]; sgst: number[] }> {
  const n = cumShares.length;
  const cgst = new Array<number>(n).fill(0), sgst = new Array<number>(n).fill(0);
  if (isNri) return { cgst, sgst };
  for (const comp of components) {
    if (!comp.amount) continue;
    const { cgstPct, sgstPct } = await resolveRate(db, projectId, projectName, comp.chargeType, bookingDate);
    let prevC = 0, prevS = 0;
    for (let i = 0; i < n; i++) {
      const c = Math.round(comp.amount * cgstPct * cumShares[i]), s = Math.round(comp.amount * sgstPct * cumShares[i]);
      cgst[i] += c - prevC; sgst[i] += s - prevS; prevC = c; prevS = s;
    }
  }
  return { cgst, sgst };
}
