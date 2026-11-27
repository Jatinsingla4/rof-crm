// RC-1: the agreed price of a booking, stored once per version (booking_agreement). Written only while the flag agreement_snapshot_v1 is 'on'.
import { priceQuote } from './price-quote.js';
import { isGstExempt } from './gst-exempt.js';

export const snapshotOn = async (db: any): Promise<boolean> =>
  (await db.query(`SELECT value FROM global_settings WHERE key = 'agreement_snapshot_v1'`)).rows[0]?.value === 'on';


// The price a confirmed booking is billed on, from the booking's own rate and the unit's true areas (the same inputs the schedule uses).
export async function quoteBookingRow(db: any, b: any, unit: any) {
  const rate = Number(b.basic_rate_inr_sqft) || 0, carpet = Number(unit.carpet_area_sqft) || 0;
  if (!(rate > 0 && carpet > 0)) return null;   // no rate on the booking: the schedule falls back to the unit master price, which a snapshot must not copy silently
  const proj = (await db.query(`SELECT name FROM projects WHERE id = $1`, [b.project_id])).rows[0];
  const nat = (await db.query(`SELECT nationality FROM consumers WHERE id = $1`, [b.consumer_id])).rows[0]?.nationality;
  const day = b.booking_date ? new Date(b.booking_date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  return priceQuote(db, { projectId: b.project_id, projectName: proj?.name || b.project_id, bookingDate: day, isNri: isGstExempt(nat),
    rate, carpetArea: carpet, balconyArea: Number(unit.balcony_area_sqft) || 0, plc: Number(b.plc_amount) || 0, other: Number(b.other_charge_amount) || 0,
    discount: Number(b.company_inaugural_disc) || 0, rebate: Number(b.approved_rebate_amount) || 0 });
}

// Version 1 for a booking that has none. Does nothing if a current version exists (a repeat confirm must not add a copy).
export async function writeSnapshot(db: any, b: any, unit: any, userId: string | null) {
  if ((await db.query(`SELECT 1 FROM booking_agreement WHERE booking_id = $1 AND is_current`, [b.id])).rows.length) return null;
  const q = await quoteBookingRow(db, b, unit);
  if (!q || q.agreement_value_inr <= 0) return null;
  await db.query(
    `INSERT INTO booking_agreement (booking_id, version, is_current, rate_inr_sqft, carpet_area_sqft, super_area_sqft, balcony_area_sqft, basic_inr, balcony_inr, plc_inr, other_charge_inr, discount_inr, agreement_value_inr, tax_lines, reason, created_by)
     VALUES ($1, 1, true, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, 'booking confirmed', $13)`,
    [b.id, b.basic_rate_inr_sqft, unit.carpet_area_sqft, unit.super_area_sqft ?? null, unit.balcony_area_sqft ?? null, q.basic_inr, q.balcony_inr, q.plc_inr, q.other_charge_inr, q.discount_inr, q.agreement_value_inr, JSON.stringify(q.tax_lines), userId]);
  await db.query(`UPDATE booking_records SET total_price_inr = $1 WHERE id = $2`, [q.agreement_value_inr, b.id]);
  return q;
}
