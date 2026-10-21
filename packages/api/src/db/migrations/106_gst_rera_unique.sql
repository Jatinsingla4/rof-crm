-- One RERA number for the project itself (no tower). The table's own unique key does not cover rows with no tower.
-- Created only when there are no duplicates yet (otherwise a NOTICE says so; clean them up and run this again).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM project_rera_numbers WHERE tower_id IS NULL GROUP BY project_id HAVING count(*) > 1) THEN
    RAISE NOTICE 'uq_project_rera_no_tower not created: a project has more than one project-level RERA number';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uq_project_rera_no_tower ON project_rera_numbers (project_id) WHERE tower_id IS NULL;
  END IF;
END $$;
