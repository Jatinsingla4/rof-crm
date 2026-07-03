"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveRate = resolveRate;
exports.resolveGstForComponents = resolveGstForComponents;
async function resolveRate(db, projectId, projectName, chargeType, bookingDate) {
    const r = await db.query(`SELECT gts.cgst_pct, gts.sgst_pct
     FROM gst_tax_charge_mapping gcm
     JOIN gst_slabs gs ON gs.id = gcm.slab_id
       AND gs.from_date <= $3::date
       AND gs.to_date   >= $3::date
     JOIN gst_tax_setup gts ON gts.id = gcm.gst_tax_id
     WHERE gcm.project_id = $1
       AND gcm.charge_type = $2
     LIMIT 1`, [projectId, chargeType, bookingDate]);
    if (r.rows.length === 0) {
        // For non-BASIC charge types, fall back to the BASIC rate rather than
        // crashing the booking. BASIC itself must always be configured — if
        // missing, still throw.
        if (chargeType !== 'BASIC') {
            const fallbackRes = await db.query(`SELECT gts.cgst_pct, gts.sgst_pct
         FROM gst_tax_charge_mapping gcm
         JOIN gst_slabs gs ON gs.id = gcm.slab_id
           AND gs.from_date <= $2::date
           AND gs.to_date   >= $2::date
         JOIN gst_tax_setup gts ON gts.id = gcm.gst_tax_id
         WHERE gcm.project_id = $1
           AND gcm.charge_type = 'BASIC'
         LIMIT 1`, [projectId, bookingDate]);
            const fallback = fallbackRes.rows[0];
            if (fallback) {
                console.warn(`[GST] No mapping for charge type "${chargeType}" on project "${projectName}" ` +
                    `— falling back to BASIC rate (${fallback.cgst_pct}% CGST). ` +
                    `Configure OTHER CHARGE mapping in Set Master -> GST Configuration.`);
                return {
                    cgstPct: parseFloat(fallback.cgst_pct) / 100,
                    sgstPct: parseFloat(fallback.sgst_pct) / 100,
                };
            }
        }
        throw new Error(`No GST mapping found for project "${projectName}" (${projectId}), ` +
            `charge type "${chargeType}", as of ${bookingDate}. ` +
            `Please configure this in Set Master -> GST Configuration -> GST TAX CHARGE MAPPING before completing this booking.`);
    }
    return {
        cgstPct: parseFloat(r.rows[0].cgst_pct) / 100,
        sgstPct: parseFloat(r.rows[0].sgst_pct) / 100,
    };
}
async function resolveGstForComponents(db, projectId, projectName, bookingDate, isNri, components) {
    if (isNri) {
        return { cgstAmount: 0, sgstAmount: 0 };
    }
    let cgstAmount = 0;
    let sgstAmount = 0;
    for (const comp of components) {
        if (comp.amount === 0)
            continue;
        const { cgstPct, sgstPct } = await resolveRate(db, projectId, projectName, comp.chargeType, bookingDate);
        cgstAmount += Math.round(comp.amount * cgstPct);
        sgstAmount += Math.round(comp.amount * sgstPct);
    }
    return { cgstAmount, sgstAmount };
}
//# sourceMappingURL=gst-resolver.js.map