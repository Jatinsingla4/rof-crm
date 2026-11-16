-- Remediation waves 2-5, tables only. Adds things; changes no row, amount or status. Safe to run twice.
-- Nothing reads these tables until the matching flag in global_settings is switched on (all default to 'off').
-- Undo: migrations-down/152_remediation_agreement_allocation_tax.down.sql

-- RC-1: one immutable agreement value per booking, versioned. Only is_current may change (true -> false) when a newer version is added.
CREATE TABLE IF NOT EXISTS booking_agreement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES booking_records(id),
  version int NOT NULL,
  is_current boolean NOT NULL DEFAULT true,
  rate_inr_sqft numeric(14,4) NOT NULL,
  rate_basis text,
  carpet_area_sqft numeric(14,3) NOT NULL,
  super_area_sqft numeric(14,3),
  balcony_area_sqft numeric(14,3),
  basic_inr numeric(16,2) NOT NULL,
  balcony_inr numeric(16,2) NOT NULL DEFAULT 0,
  plc_inr numeric(16,2) NOT NULL DEFAULT 0,
  other_charge_inr numeric(16,2) NOT NULL DEFAULT 0,
  discount_inr numeric(16,2) NOT NULL DEFAULT 0,
  agreement_value_inr numeric(16,2) NOT NULL CHECK (agreement_value_inr > 0),
  tax_lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  reason text,
  approved_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, version)
);
CREATE UNIQUE INDEX IF NOT EXISTS booking_agreement_one_current ON booking_agreement (booking_id) WHERE is_current;

CREATE OR REPLACE FUNCTION booking_agreement_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'booking_agreement rows are never deleted'; END IF;
  IF (to_jsonb(NEW) - 'is_current') IS DISTINCT FROM (to_jsonb(OLD) - 'is_current') THEN
    RAISE EXCEPTION 'booking_agreement rows are immutable: add a new version instead';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS booking_agreement_immutable ON booking_agreement;
CREATE TRIGGER booking_agreement_immutable BEFORE UPDATE OR DELETE ON booking_agreement FOR EACH ROW EXECUTE FUNCTION booking_agreement_immutable();

-- RC-3: what each counted receipt settled, per demand and charge head (written only when receipt_allocation_v1 is on)
CREATE TABLE IF NOT EXISTS receipt_allocation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES receipts(id),
  demand_id uuid NOT NULL REFERENCES demands(id),
  charge_head text NOT NULL,
  principal numeric(16,2) NOT NULL DEFAULT 0,
  cgst numeric(16,2) NOT NULL DEFAULT 0,
  sgst numeric(16,2) NOT NULL DEFAULT 0,
  igst numeric(16,2) NOT NULL DEFAULT 0,
  interest numeric(16,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS receipt_allocation_receipt ON receipt_allocation (receipt_id);
CREATE INDEX IF NOT EXISTS receipt_allocation_demand ON receipt_allocation (demand_id);

-- RC-5: which booking a demand belongs to. Nullable here; filled by a reviewed repair script, never by this migration.
ALTER TABLE demands ADD COLUMN IF NOT EXISTS booking_id uuid REFERENCES booking_records(id);
CREATE INDEX IF NOT EXISTS demands_booking_id ON demands (booking_id);

-- RC-6: dated tax rates. NO ROWS are added: the tax advisor must confirm every rate (BR-12) before any is entered. Statutory rates are not set by code.
CREATE TABLE IF NOT EXISTS tax_rate (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section text NOT NULL,
  rate_pct numeric(7,4) NOT NULL CHECK (rate_pct >= 0 AND rate_pct <= 100),
  condition text,
  effective_from date NOT NULL,
  effective_to date,
  confirmed_by text,
  confirmed_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

INSERT INTO global_settings (key, value, description) VALUES
  ('agreement_snapshot_v1', 'off', 'RC-1: store a booking_agreement snapshot when a booking is confirmed (on/off)'),
  ('receipt_allocation_v1', 'off', 'RC-3: write receipt_allocation rows (on/off). Not wired yet.')
ON CONFLICT (key) DO NOTHING;
