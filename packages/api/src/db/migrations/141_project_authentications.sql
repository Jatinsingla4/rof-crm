-- Per-project Automatic / Manual switches (the client's Authentications). Manual = a checker approves first (what the CRM did before);
-- Automatic = no approval step for that kind of work in this project. broker: a broker not yet approved may hold units. journal: a credit or debit note is issued at once. Idempotent.
ALTER TABLE project_settings ADD COLUMN IF NOT EXISTS broker_auth_mode varchar(10) NOT NULL DEFAULT 'Manual';
ALTER TABLE project_settings ADD COLUMN IF NOT EXISTS journal_auth_mode varchar(10) NOT NULL DEFAULT 'Manual';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_settings_auth_chk') THEN
    ALTER TABLE project_settings ADD CONSTRAINT project_settings_auth_chk CHECK (broker_auth_mode IN ('Automatic','Manual') AND journal_auth_mode IN ('Automatic','Manual'));
  END IF;
END $$;
