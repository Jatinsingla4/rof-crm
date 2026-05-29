-- Migration 051: Store staff-entered basic rate and carpet area on booking_records
-- Allows the booking form's manually entered price to override units.base_price_inr
-- for payment plan total calculation.

ALTER TABLE booking_records
  ADD COLUMN IF NOT EXISTS basic_rate_inr_sqft NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS carpet_area_sqft     NUMERIC(10,3);
