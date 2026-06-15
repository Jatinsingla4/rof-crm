-- Migration 067: Project-wise and installment-wise interest rates

-- Per-project interest rate history (most recent effective_from wins)
CREATE TABLE IF NOT EXISTS project_interest_rates (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID          NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  rate_percent   NUMERIC(6,2)  NOT NULL,
  effective_from DATE          NOT NULL DEFAULT CURRENT_DATE,
  created_by     UUID          REFERENCES users(id),
  created_at     TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_interest_rates_project
  ON project_interest_rates (project_id, effective_from DESC);

-- Per-installment rate override: NULL = inherit from project/global
ALTER TABLE plan_schedule_templates
  ADD COLUMN IF NOT EXISTS interest_rate_percent NUMERIC(6,2) DEFAULT NULL;
