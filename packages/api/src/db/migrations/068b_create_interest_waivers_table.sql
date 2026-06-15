-- Migration: 068b_create_interest_waivers_table
-- Creates the interest_waivers table for the Interest Waiver module.
-- Columns document_path and authorized_by_name are included here;
-- migration 069 will ADD COLUMN IF NOT EXISTS (no-op if already present).

CREATE TABLE IF NOT EXISTS interest_waivers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id         UUID NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
  penal_interest_id   UUID,
  payment_plan_id     UUID,
  installment_index   INTEGER,
  waiver_amount_inr   BIGINT NOT NULL DEFAULT 0,
  reason              TEXT,
  status              VARCHAR(20) NOT NULL DEFAULT 'pending',
  requested_by        UUID,
  requested_at        TIMESTAMPTZ DEFAULT NOW(),
  approved_by         UUID,
  approved_at         TIMESTAMPTZ,
  document_path       TEXT DEFAULT NULL,
  authorized_by_name  TEXT DEFAULT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interest_waivers_consumer ON interest_waivers(consumer_id);
CREATE INDEX IF NOT EXISTS idx_interest_waivers_status   ON interest_waivers(status);
