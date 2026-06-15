-- Migration 070: Transfer Module — schema additions
-- PART A: Extend ownership_transfers with new fields
-- PART B: Create transfer_fee_master table
-- Fully idempotent — safe to re-run.

-- ─────────────────────────────────────────────────────────────────────────────
-- PART A: ALTER ownership_transfers (ADD COLUMN IF NOT EXISTS)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE ownership_transfers
  ADD COLUMN IF NOT EXISTS transfer_no         VARCHAR,
  ADD COLUMN IF NOT EXISTS application_date    DATE,
  ADD COLUMN IF NOT EXISTS transfer_type       VARCHAR DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS transfer_amount_inr BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stax_amount         NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cgst_amount         NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sgst_amount         NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS igst_amount         NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ugst_amount         NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS basic_price         NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gstin               VARCHAR,
  ADD COLUMN IF NOT EXISTS broker_company      VARCHAR,
  ADD COLUMN IF NOT EXISTS main_broker         VARCHAR,
  ADD COLUMN IF NOT EXISTS sales_person_name   VARCHAR,
  ADD COLUMN IF NOT EXISTS transfer_receipt_no VARCHAR,
  ADD COLUMN IF NOT EXISTS approved_by         VARCHAR,
  ADD COLUMN IF NOT EXISTS approved_at         TIMESTAMPTZ;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART B: CREATE transfer_fee_master
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS transfer_fee_master (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  transfer_fee_inr  NUMERIC(12,2) NOT NULL DEFAULT 0,
  admin_charges_inr NUMERIC(12,2) NOT NULL DEFAULT 0,
  cgst_pct          NUMERIC(6,4)  NOT NULL DEFAULT 0,
  sgst_pct          NUMERIC(6,4)  NOT NULL DEFAULT 0,
  igst_pct          NUMERIC(6,4)  NOT NULL DEFAULT 0,
  ugst_pct          NUMERIC(6,4)  NOT NULL DEFAULT 0,
  service_tax_pct   NUMERIC(6,4)  NOT NULL DEFAULT 12.3600,
  is_foc            BOOLEAN       NOT NULL DEFAULT false,
  effective_from    DATE,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT transfer_fee_master_project_unique UNIQUE (project_id)
);

CREATE INDEX IF NOT EXISTS idx_transfer_fee_master_project ON transfer_fee_master(project_id);
