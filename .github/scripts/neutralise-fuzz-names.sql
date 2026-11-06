-- The API fuzz scripts throw junk at every field, and a few fields accept the plain text "NaN" or "undefined" as a name (a project, a person,
-- a tower). The browser tests then fail on any screen that lists them, because they treat those words as a rendering error. That depends on
-- the random values of one run, so the same commit passes on one run and fails on the next. This runs after the API tests and before the
-- browser tests, on the throw-away CI database only: it rewrites those words in the name columns to "n/a" so the screens stay readable.
-- A row that cannot be renamed (a unique name already taken) is skipped, never an error.
DO $$
DECLARE
  c record;
  n bigint;
  total bigint := 0;
BEGIN
  FOR c IN
    SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND data_type IN ('text', 'character varying')
       AND column_name IN ('name', 'first_name', 'last_name', 'middle_name', 'tower_name', 'unit_number', 'firm_name', 'plan_name', 'charge_name', 'location', 'city')
       AND table_name IN (SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE')
  LOOP
    BEGIN
      EXECUTE format('UPDATE %I SET %I = regexp_replace(%I, %L, %L, ''g'') WHERE %I ~ %L', c.table_name, c.column_name, c.column_name, '\m(NaN|undefined)\M', 'n/a', c.column_name, '\m(NaN|undefined)\M');
      GET DIAGNOSTICS n = ROW_COUNT;
      total := total + n;
      IF n > 0 THEN RAISE NOTICE 'renamed % value(s) in %.%', n, c.table_name, c.column_name; END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'skipped %.% (%)', c.table_name, c.column_name, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE 'NaN/undefined names rewritten: %', total;
END $$;
