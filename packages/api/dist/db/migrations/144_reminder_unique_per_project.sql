-- Reminder rules are per project: the same name and days may exist in two projects (Set Master audit SM-002).
-- Migration 107 made (lower(name), days) unique across ALL projects, which blocked "Reminder 1 = 10 days" in a second project.
-- The new key adds the project (a rule with no project counts as the global scope), so it is looser than the old one:
-- every row that satisfied the old index satisfies the new one.
--
-- Preflight: migration 107 skipped its index on a database that already held duplicates, so such a database may still have
-- two reminders with the same name and days in the SAME project (or both global). The new index cannot be built over them.
-- This migration never deletes, merges or edits a reminder. If it finds a conflict it stops BEFORE changing anything and
-- lists every conflicting group with the row ids, so the owner can decide which row to keep and fix it by hand.
-- Idempotent: CI runs every migration twice.
DO $$
DECLARE
  report text;
  groups int;
BEGIN
  SELECT count(*), string_agg(g.line, E'\n' ORDER BY g.line)
    INTO groups, report
    FROM (
      SELECT format('  project %s | name "%s" | days %s | %s rows | ids %s',
                    COALESCE(min(project_id::text), 'GLOBAL (no project)'), min(reminder_name), days, count(*),
                    string_agg(id::text, ', ' ORDER BY created_at NULLS LAST, id::text)) AS line
        FROM reminder_master
       GROUP BY lower(reminder_name), days, COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::uuid)
      HAVING count(*) > 1
    ) g;
  IF groups > 0 THEN
    RAISE EXCEPTION E'Migration 144 stopped, nothing was changed. % group(s) of duplicate reminders exist (same name, days and project):\n%\nRemediation (manual, choose per group): keep one row and delete or rename the others, for example DELETE FROM reminder_master WHERE id = ''<id to remove>''; then run this migration again. Nothing was deleted by the migration.', groups, report;
  END IF;
END $$;

DROP INDEX IF EXISTS uq_reminder_name_days;
CREATE UNIQUE INDEX IF NOT EXISTS uq_reminder_name_days_project
  ON reminder_master (lower(reminder_name), days, COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::uuid));
