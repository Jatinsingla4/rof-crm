-- A surrender / cancellation remembers what it changed (booking, allocation and applicant stage, unit link, broker commissions) so a restore puts back exactly that.
ALTER TABLE surrender_applications ADD COLUMN IF NOT EXISTS pre_state JSONB;
ALTER TABLE cancellations ADD COLUMN IF NOT EXISTS pre_state JSONB;
ALTER TABLE cancellations ADD COLUMN IF NOT EXISTS pre_surrender_unit_status TEXT;
ALTER TABLE cancellations ADD COLUMN IF NOT EXISTS cancelled_demand_snapshot JSONB;
-- Refund and forfeiture keep paise, as on the surrender table
ALTER TABLE cancellations
  ALTER COLUMN forfeiture_amount_inr TYPE NUMERIC(15,2),
  ALTER COLUMN refund_amount_inr TYPE NUMERIC(15,2);
