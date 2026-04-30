-- Migration 023: Payment Plan Schedule Templates
-- Stores project-level installment schedule templates (NOT per-consumer payment plans)

CREATE TABLE IF NOT EXISTS plan_schedule_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  plan_name VARCHAR(255) NOT NULL DEFAULT 'Standard AHP Plan',
  installment_index INT NOT NULL DEFAULT 1,
  installment_name VARCHAR(255) NOT NULL,
  installment_type VARCHAR(50) NOT NULL DEFAULT 'installment',
  -- installment | plc | other_charge | booking | possession
  percentage NUMERIC(7,3),
  flat_amount_inr BIGINT,
  due_date_offset_days INT DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_templates_project ON plan_schedule_templates(project_id);
CREATE INDEX IF NOT EXISTS idx_plan_templates_plan ON plan_schedule_templates(project_id, plan_name);
