-- Migration 079: Per-installment addon charge percentage allocations
-- Allows payment plans to specify what % of each addon charge type
-- is due in each installment

CREATE TABLE IF NOT EXISTS plan_addon_charge_pct (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_schedule_template_id UUID NOT NULL
                            REFERENCES plan_schedule_templates(id)
                            ON DELETE CASCADE,
  charge_master_id          UUID NOT NULL
                            REFERENCES addon_charge_master(id)
                            ON DELETE CASCADE,
  pct                       NUMERIC(7,3) NOT NULL DEFAULT 0,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by                UUID REFERENCES users(id),
  CONSTRAINT plan_addon_pct_unique
    UNIQUE (plan_schedule_template_id, charge_master_id)
);

CREATE INDEX IF NOT EXISTS idx_plan_addon_pct_template
  ON plan_addon_charge_pct(plan_schedule_template_id);

CREATE INDEX IF NOT EXISTS idx_plan_addon_pct_master
  ON plan_addon_charge_pct(charge_master_id);

-- Add addon_charge_amount to demands (used in Stage 2 — demand creation)
ALTER TABLE demands
  ADD COLUMN IF NOT EXISTS addon_charge_amount NUMERIC(12,2) NOT NULL DEFAULT 0;
