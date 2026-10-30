-- Payment plan header of the client CRM (plan type and description), one row per plan of a project. Idempotent.
CREATE TABLE IF NOT EXISTS plan_headers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  plan_name varchar(255) NOT NULL,
  plan_type varchar(30) NOT NULL DEFAULT 'Time Linked',
  description varchar(500),
  updated_by uuid REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plan_headers_type_chk CHECK (plan_type IN ('Construction Linked','Down Payment','Flexi','Time Linked'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_plan_headers ON plan_headers (project_id, lower(plan_name));
SELECT rof_apply_project_scope();
