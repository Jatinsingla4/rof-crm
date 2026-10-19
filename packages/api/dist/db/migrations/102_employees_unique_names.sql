-- Employees: names and codes are unique ignoring letter case. The API already refuses duplicates; this adds the
-- same rule in the database so two requests at the same moment cannot both succeed.
-- Each index is created only when the data has no duplicates yet, so existing data can never make a deploy fail.
-- Safe to run more than once.
DO $$
DECLARE
  r RECORD;
  dups INT;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('uq_departments_name_ci',    'departments',        'lower(name)',                                   NULL),
    ('uq_teams_name_ci',          'teams',              'COALESCE(department_id::text, ''''), lower(name)', NULL),
    ('uq_employee_code_ci',       'employee_profiles',  'lower(employee_code)',                          'employee_code IS NOT NULL')
  ) AS t(idx, tbl, cols, pred)
  LOOP
    IF to_regclass('public.' || r.tbl) IS NULL THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = r.idx) THEN CONTINUE; END IF;
    EXECUTE format('SELECT count(*) FROM (SELECT 1 FROM public.%I %s GROUP BY %s HAVING count(*) > 1) d',
                   r.tbl, CASE WHEN r.pred IS NULL THEN '' ELSE 'WHERE ' || r.pred END,
                   r.cols) INTO dups;
    IF dups > 0 THEN
      RAISE NOTICE 'Skipped %: % duplicate group(s) in %. Clean the data, then run this migration again.', r.idx, dups, r.tbl;
    ELSE
      EXECUTE format('CREATE UNIQUE INDEX %I ON public.%I (%s)%s', r.idx, r.tbl,
                     r.cols, CASE WHEN r.pred IS NULL THEN '' ELSE ' WHERE ' || r.pred END);
    END IF;
  END LOOP;
END $$;
