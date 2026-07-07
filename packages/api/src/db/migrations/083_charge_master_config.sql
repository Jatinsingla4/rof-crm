-- Phase 1: Balcony Charge config layer
-- Global admin-editable charge master config table + booking-time rate snapshot column

CREATE TABLE IF NOT EXISTS charge_master_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_key VARCHAR(100) UNIQUE NOT NULL,
  charge_name VARCHAR(200) NOT NULL,
  rate_value NUMERIC(12,2) NOT NULL,
  rate_unit VARCHAR(20) NOT NULL DEFAULT 'per_sqft',
  cap_value NUMERIC(12,2),
  is_cap_configurable BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

INSERT INTO charge_master_config
  (charge_key, charge_name, rate_value, rate_unit, cap_value, is_cap_configurable)
VALUES
  ('balcony_charge', 'Balcony Charge', 1300.00, 'per_sqft', 100000.00, false)
ON CONFLICT (charge_key) DO NOTHING;

ALTER TABLE booking_records
  ADD COLUMN IF NOT EXISTS balcony_rate_applied_inr_sqft NUMERIC(10,2);
