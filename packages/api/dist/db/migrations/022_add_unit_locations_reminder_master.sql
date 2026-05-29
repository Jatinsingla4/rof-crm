-- Migration 022: Ensure unit_locations and reminder_master tables exist
-- unit_locations was created in migration 018; reminder_master already exists with legacy schema

CREATE TABLE IF NOT EXISTS unit_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unit_locations_project ON unit_locations(project_id);

-- reminder_master already has: id, project_id, reminder_name, prefix_name, rank, days, is_active, created_at
-- Seed default reminder rules using the actual column names
INSERT INTO reminder_master (reminder_name, days, is_active)
SELECT * FROM (VALUES
  ('15-Day Demand Reminder', 15, true),
  ('7-Day Demand Reminder',   7, true),
  ('3-Day Demand Reminder',   3, true)
) AS v(reminder_name, days, is_active)
WHERE NOT EXISTS (SELECT 1 FROM reminder_master WHERE reminder_name = v.reminder_name);
