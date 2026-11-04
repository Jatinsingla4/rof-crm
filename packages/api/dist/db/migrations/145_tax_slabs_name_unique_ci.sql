-- Tax slab names are unique without regard to letter case (Set Master audit SM-009).
-- tax_slabs only had UNIQUE (name), which treats "Slab 9" and "SLAB 9" as different, and the route's own check can be raced
-- by two requests at the same moment. The database now refuses the second one.
--
-- Preflight: if names that differ only by case already exist, the index cannot be built. This migration never deletes, merges
-- or renames a tax slab. It stops BEFORE changing anything and lists each conflicting group with the row ids so the owner can
-- decide which row to keep and fix it by hand.
-- Idempotent: CI runs every migration twice.
DO $$
DECLARE
  report text;
  groups int;
BEGIN
  SELECT count(*), string_agg(g.line, E'\n' ORDER BY g.line)
    INTO groups, report
    FROM (
      SELECT format('  name "%s" | %s rows | ids %s | percentages (cgst/sgst/igst) %s',
                    min(name), count(*), string_agg(id::text, ', ' ORDER BY created_at NULLS LAST, id::text),
                    string_agg(COALESCE(cgst_percent::text, '-') || '/' || COALESCE(sgst_percent::text, '-') || '/' || COALESCE(igst_percent::text, '-'), ' ; ' ORDER BY created_at NULLS LAST, id::text)) AS line
        FROM tax_slabs
       GROUP BY lower(name)
      HAVING count(*) > 1
    ) g;
  IF groups > 0 THEN
    RAISE EXCEPTION E'Migration 145 stopped, nothing was changed. % group(s) of tax slabs share a name apart from letter case:\n%\nRemediation (manual, choose per group): keep one row and rename or delete the others, for example UPDATE tax_slabs SET name = ''<new name>'' WHERE id = ''<id>''; then run this migration again. Nothing was changed by the migration.', groups, report;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tax_slabs_name_ci ON tax_slabs (lower(name));
