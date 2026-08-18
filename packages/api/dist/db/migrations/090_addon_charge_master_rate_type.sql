-- Migration 090: Per-sq.ft. rate option on addon_charge_master.
-- Existing charges keep working unchanged (rate_type defaults to 'flat',
-- default_amount untouched). Idempotent (IF NOT EXISTS).

ALTER TABLE addon_charge_master
  ADD COLUMN IF NOT EXISTS rate_type VARCHAR(20) NOT NULL DEFAULT 'flat'
    CHECK (rate_type IN ('flat', 'per_sqft')),
  ADD COLUMN IF NOT EXISTS rate_per_sqft_inr NUMERIC(12,2);
