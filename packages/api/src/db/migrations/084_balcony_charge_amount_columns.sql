-- Phase 2: Balcony Charge amount + GST columns, computed and stored at
-- booking creation time (single write-point: booking.ts's payment_plan
-- creation block). NULL for historical bookings created before this phase.

ALTER TABLE booking_records
  ADD COLUMN IF NOT EXISTS balcony_charge_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS balcony_cgst_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS balcony_sgst_amount NUMERIC(12,2);
