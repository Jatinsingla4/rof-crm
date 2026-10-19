-- Project scope: a login assigned to projects sees and changes only those projects' rows.
-- The API runs such a request as the limited database role rof_app (no bypass, not the table owner) with the
-- allowed project ids in app.project_scope; row level security then filters every query: lists, details,
-- reports and writes alike. Super admin and logins with no project assigned do not use rof_app and are unchanged.
-- Safe to run more than once. Call rof_apply_project_scope() again from any later migration that adds a table
-- with project_id, consumer_id or unit_id (the API test fails until that is done).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rof_app') THEN
    CREATE ROLE rof_app NOLOGIN NOBYPASSRLS NOSUPERUSER;
  END IF;
  EXECUTE format('GRANT rof_app TO %I', current_user);
EXCEPTION WHEN insufficient_privilege THEN
  RAISE EXCEPTION 'Project scope needs a database user that may create roles. Run this migration as the database owner.';
END $$;

-- The limited role may use everything the app uses; row level security (below) narrows the project data
GRANT USAGE ON SCHEMA public TO rof_app;
GRANT ALL ON ALL TABLES IN SCHEMA public TO rof_app;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO rof_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO rof_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO rof_app;

-- true when the row's project is one of the request's allowed projects; a row with no project is open to all
CREATE OR REPLACE FUNCTION public.rof_in_scope(pid uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT pid IS NULL OR pid::text = ANY (string_to_array(COALESCE(current_setting('app.project_scope', true), ''), ','))
$$;

-- Puts a policy on every table that has project_id (or, failing that, consumer_id or unit_id).
-- A table that only points at a consumer or a unit follows that consumer or unit, so it is limited too.
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
               THEN 'rof_in_scope(project_id)'
             WHEN EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attname = 'consumer_id' AND a.atttypid = 'uuid'::regtype AND NOT a.attisdropped)
               THEN 'consumer_id IS NULL OR EXISTS (SELECT 1 FROM public.consumers sc WHERE sc.id = consumer_id)'
             WHEN EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attname = 'unit_id' AND a.atttypid = 'uuid'::regtype AND NOT a.attisdropped)
               THEN 'unit_id IS NULL OR EXISTS (SELECT 1 FROM public.units su WHERE su.id = unit_id)'
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
