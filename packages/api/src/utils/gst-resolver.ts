export interface GstComponents {
  cgstAmount: number;
  sgstAmount: number;
}

export interface ChargeComponent {
  chargeType: string;
  amount: number;
}

async function resolveRate(
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
    throw new Error(
      `No GST mapping found for project "${projectName}" (${projectId}), ` +
      `charge type "${chargeType}", as of ${bookingDate}. ` +
      `Please configure this in Set Master -> GST Configuration -> GST TAX CHARGE MAPPING before completing this booking.`
    );
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
