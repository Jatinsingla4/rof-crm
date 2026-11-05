-- T1 (timezone policy), draft. NOT in packages/api/src/db/migrations on purpose: it is a schema change and goes through a release batch.
-- Every DATE column whose default is CURRENT_DATE takes the day from the DATABASE SESSION timezone. The business calendar is Asia/Kolkata
-- (src/utils/business-date.ts), so those defaults are moved to the same expression the application uses. Defaults only: no row is changed.
-- Idempotent (a second run finds nothing left to change), generic (it reads the columns from the catalogue), and compatible with old code.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT n.nspname AS sch, cl.relname AS tbl, a.attname AS col
      FROM pg_attrdef d
      JOIN pg_class cl ON cl.oid = d.adrelid
      JOIN pg_namespace n ON n.oid = cl.relnamespace
      JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
     WHERE n.nspname = 'public' AND cl.relkind = 'r' AND NOT a.attisdropped
       AND a.atttypid = 'date'::regtype
       AND pg_get_expr(d.adbin, d.adrelid) = 'CURRENT_DATE'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I SET DEFAULT ((NOW() AT TIME ZONE ''Asia/Kolkata'')::date)', c.sch, c.tbl, c.col);
  END LOOP;
END $$;
