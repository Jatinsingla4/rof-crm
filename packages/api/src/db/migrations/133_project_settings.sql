-- Per-project numbering of the client CRM: receipt number prefix and Automatic / Manual, registration number prefix, size and Automatic / Manual. Idempotent.
CREATE TABLE IF NOT EXISTS project_settings (
  project_id uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  receipt_prefix varchar(10),
  receipt_number_mode varchar(10) NOT NULL DEFAULT 'Automatic',
  registration_prefix varchar(10),
  registration_number_mode varchar(10) NOT NULL DEFAULT 'Automatic',
  registration_number_size smallint NOT NULL DEFAULT 4,
  updated_by uuid REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_settings_chk CHECK (receipt_number_mode IN ('Automatic','Manual') AND registration_number_mode IN ('Automatic','Manual') AND registration_number_size BETWEEN 3 AND 8)
);
SELECT rof_apply_project_scope();
