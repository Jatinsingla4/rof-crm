-- Migration 012: Construction milestone tracking
-- Tracks construction progress and enables customer notifications

CREATE TABLE IF NOT EXISTS construction_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  milestone_name VARCHAR(255) NOT NULL,
  milestone_type VARCHAR(100) NOT NULL,
  description TEXT,
  planned_date DATE,
  actual_date DATE,
  completion_percentage INTEGER DEFAULT 0
    CHECK (completion_percentage BETWEEN 0 AND 100),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  notify_allottees BOOLEAN DEFAULT true,
  notification_sent_at TIMESTAMPTZ,
  photos_urls TEXT[],
  created_by_user_id UUID REFERENCES users(id),
  updated_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_milestones_project
  ON construction_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_milestones_status
  ON construction_milestones(status);
CREATE INDEX IF NOT EXISTS idx_milestones_project_status
  ON construction_milestones(project_id, status);

-- Seed standard milestone types for all projects
INSERT INTO construction_milestones
(project_id, milestone_name, milestone_type, status, notify_allottees)
SELECT
  p.id,
  m.name,
  m.type,
  'pending',
  true
FROM projects p
CROSS JOIN (VALUES
  ('Foundation Complete', 'foundation'),
  ('Plinth Level Complete', 'structure'),
  ('Ground Floor Slab Cast', 'structure'),
  ('Structure Complete', 'structure'),
  ('Brickwork Complete', 'finishing'),
  ('Plaster Complete', 'finishing'),
  ('Flooring Complete', 'finishing'),
  ('Electrical Complete', 'mep'),
  ('Plumbing Complete', 'mep'),
  ('Painting Complete', 'finishing'),
  ('Occupation Certificate Applied', 'legal'),
  ('Occupation Certificate Received', 'legal'),
  ('Possession Ready', 'handover')
) AS m(name, type);
