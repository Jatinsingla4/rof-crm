-- Change Rate history of the client CRM: every rate a unit type has had, with its rate basis and date. Idempotent.
CREATE TABLE IF NOT EXISTS unit_type_rate_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_type_id uuid NOT NULL REFERENCES unit_types(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  base_rate numeric(14,2) NOT NULL,
  rate_basis varchar(20),
  rate_date date,
  changed_by uuid REFERENCES users(id),
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_utrh_type ON unit_type_rate_history (unit_type_id, changed_at DESC);
SELECT rof_apply_project_scope();
