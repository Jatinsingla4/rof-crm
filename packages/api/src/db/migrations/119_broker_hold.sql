-- Broker and Investor / Hold hardening. Safe to run twice.

-- 1. Broker application fields the form always sent but the table had no place for
ALTER TABLE brokers
  ADD COLUMN IF NOT EXISTS contact_person VARCHAR(255),
  ADD COLUMN IF NOT EXISTS alt_mobile VARCHAR(20),
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS state VARCHAR(100),
  ADD COLUMN IF NOT EXISTS pin_code VARCHAR(10),
  ADD COLUMN IF NOT EXISTS remarks TEXT;

-- 2. What was paid: commission, GST on it, TDS cut from it, and the net amount that went to the broker
ALTER TABLE broker_commissions
  ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS tds_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS net_amount_inr NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS paid_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES booking_records(id);
-- the booking a commission belongs to (it used to be guessed from applicant + unit); old rows get the booking made closest in time
UPDATE broker_commissions bc SET booking_id = (
  SELECT b.id FROM booking_records b WHERE b.consumer_id = bc.consumer_id AND b.unit_id IS NOT DISTINCT FROM bc.unit_id
   ORDER BY abs(extract(epoch FROM (b.created_at - bc.created_at))) LIMIT 1) WHERE bc.booking_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_broker_commissions_booking ON broker_commissions (booking_id);

-- 3. A unit can be held, released and held again: only ONE ACTIVE hold per unit (it was one row per unit and status,
--    so the second release of the same unit failed with a duplicate-key error)
ALTER TABLE unit_holds DROP CONSTRAINT IF EXISTS unit_holds_unit_id_status_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_unit_holds_one_active ON unit_holds (unit_id) WHERE status = 'active';
ALTER TABLE unit_holds
  ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS released_by UUID REFERENCES users(id);

-- 4. Value rules (NOT VALID: rows that are already there are not re-checked)
ALTER TABLE brokers DROP CONSTRAINT IF EXISTS brokers_commission_pct_check;
ALTER TABLE brokers ADD CONSTRAINT brokers_commission_pct_check CHECK (commission_pct IS NULL OR (commission_pct >= 0 AND commission_pct <= 100)) NOT VALID;
ALTER TABLE broker_tax_config DROP CONSTRAINT IF EXISTS broker_tax_config_rates_check;
ALTER TABLE broker_tax_config ADD CONSTRAINT broker_tax_config_rates_check CHECK (tds_rate_pct BETWEEN 0 AND 100 AND gst_rate_pct BETWEEN 0 AND 100) NOT VALID;
ALTER TABLE broker_commissions DROP CONSTRAINT IF EXISTS broker_commissions_status_check;
ALTER TABLE broker_commissions ADD CONSTRAINT broker_commissions_status_check CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')) NOT VALID;
ALTER TABLE broker_commissions DROP CONSTRAINT IF EXISTS broker_commissions_amount_check;
ALTER TABLE broker_commissions ADD CONSTRAINT broker_commissions_amount_check CHECK (commission_amount_inr >= 0) NOT VALID;
ALTER TABLE unit_holds DROP CONSTRAINT IF EXISTS unit_holds_status_check;
ALTER TABLE unit_holds ADD CONSTRAINT unit_holds_status_check CHECK (status IN ('active', 'expired', 'converted', 'cancelled')) NOT VALID;
