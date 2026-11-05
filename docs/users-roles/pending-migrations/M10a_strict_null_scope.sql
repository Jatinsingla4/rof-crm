-- M10a (UR-002 / decision 2, plan 3.6 and 3.8), draft, Batch 5 (with the strict code switch). NOT in packages/api/src/db/migrations on purpose:
-- today a row with no project (and a row with no consumer or unit) is open to every project-limited login (migration 100: rof_in_scope(NULL) is true).
-- The approved policy is that unassigned or unmapped records stay super-admin-only until they are mapped. Switching that on changes what every
-- limited login sees, so it waits for: the per-table allow-list below signed off by the owner (G4), the NULL-project mapping (D4 to D6) and a
-- staging run. The application sets app.scope_strict = 'on' for every limited request when SCOPE_MODE is strict (db/pool.ts); until this file is
-- applied the setting is ignored and nothing changes. Idempotent; no row is changed.

-- Tables whose NULL-project rows are a deliberate global catalogue every limited login may read. EMPTY until the owner signs a list line by line.
CREATE TABLE IF NOT EXISTS public.rof_scope_global_tables (
  table_name  text PRIMARY KEY,
  note        text,
  approved_by text,
  approved_at timestamptz
);
GRANT SELECT ON public.rof_scope_global_tables TO rof_app;

-- Is a NULL-scope row of this table visible to a limited login? Strict mode: only when the table is on the allow-list. Otherwise as before (open).
CREATE OR REPLACE FUNCTION public.rof_null_scope_open(tbl text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(current_setting('app.scope_strict', true), '') <> 'on'
      OR EXISTS (SELECT 1 FROM public.rof_scope_global_tables g WHERE g.table_name = tbl)
$$;

-- A row with a project: the project must be one of the request's allowed projects (unchanged). A row with none: rof_null_scope_open.
CREATE OR REPLACE FUNCTION public.rof_in_scope_tbl(pid uuid, tbl text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN pid IS NULL THEN public.rof_null_scope_open(tbl)
              ELSE pid::text = ANY (string_to_array(COALESCE(current_setting('app.project_scope', true), ''), ',')) END
$$;

-- The same generator as migration 100 with the NULL rule above; the old rof_in_scope(uuid) stays for anything that still calls it.
CREATE OR REPLACE FUNCTION public.rof_apply_project_scope() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.relname AS tbl,
           CASE
             WHEN c.relname = 'projects' THEN 'rof_in_scope(id)'
             WHEN EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attname = 'project_id' AND a.atttypid = 'uuid'::regtype AND NOT a.attisdropped)
               THEN format('public.rof_in_scope_tbl(project_id, %L)', c.relname)
             WHEN EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attname = 'consumer_id' AND a.atttypid = 'uuid'::regtype AND NOT a.attisdropped)
               THEN format('(consumer_id IS NULL AND public.rof_null_scope_open(%L)) OR (consumer_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.consumers sc WHERE sc.id = consumer_id))', c.relname)
             WHEN EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attname = 'unit_id' AND a.atttypid = 'uuid'::regtype AND NOT a.attisdropped)
               THEN format('(unit_id IS NULL AND public.rof_null_scope_open(%L)) OR (unit_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.units su WHERE su.id = unit_id))', c.relname)
           END AS cond
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relispartition
  LOOP
    CONTINUE WHEN r.cond IS NULL;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS rof_project_scope ON public.%I', r.tbl);
    EXECUTE format('CREATE POLICY rof_project_scope ON public.%I FOR ALL TO rof_app USING (%s) WITH CHECK (%s)', r.tbl, r.cond, r.cond);
  END LOOP;
END $$;

SELECT public.rof_apply_project_scope();
