-- Migration 073: Addon Charge Master + Consumer Addon Charges
-- Fully idempotent — safe to re-run.

-- TABLE 1: addon_charge_master
-- Defines available charge types per project
CREATE TABLE IF NOT EXISTS addon_charge_master (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id)
                  ON DELETE CASCADE,
  charge_name     VARCHAR(200) NOT NULL,
  default_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
  cgst_pct        NUMERIC(6,4) NOT NULL DEFAULT 9.0000,
  sgst_pct        NUMERIC(6,4) NOT NULL DEFAULT 9.0000,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID REFERENCES users(id)
);

-- TABLE 2: consumer_addon_charges
-- Actual charges assigned to individual consumers
CREATE TABLE IF NOT EXISTS consumer_addon_charges (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id      UUID NOT NULL REFERENCES consumers(id)
                   ON DELETE CASCADE,
  project_id       UUID NOT NULL REFERENCES projects(id),
  charge_master_id UUID REFERENCES addon_charge_master(id),
  charge_name      VARCHAR(200) NOT NULL,
  effective_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  amount           NUMERIC(12,2) NOT NULL DEFAULT 0,
  increase_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
  cgst_pct         NUMERIC(6,4) NOT NULL DEFAULT 9.0000,
  sgst_pct         NUMERIC(6,4) NOT NULL DEFAULT 9.0000,
  cgst_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  sgst_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  itc_cgst         NUMERIC(12,2) NOT NULL DEFAULT 0,
  itc_sgst         NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  remark           TEXT,
  status           VARCHAR(20) NOT NULL DEFAULT 'active',
  waive_remark     TEXT,
  cancelled_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       UUID REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_addon_charge_master_project
  ON addon_charge_master(project_id);

CREATE INDEX IF NOT EXISTS idx_consumer_addon_charges_consumer
  ON consumer_addon_charges(consumer_id);

CREATE INDEX IF NOT EXISTS idx_consumer_addon_charges_project
  ON consumer_addon_charges(project_id);
