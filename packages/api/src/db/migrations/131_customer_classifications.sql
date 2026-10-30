-- Customer Classification master per project (the client CRM keeps its own list per project; ours was a fixed EWS / LIG / MIG). Idempotent.
CREATE TABLE IF NOT EXISTS customer_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name varchar(50) NOT NULL,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_classifications ON customer_classifications (project_id, lower(name));
SELECT rof_apply_project_scope();
