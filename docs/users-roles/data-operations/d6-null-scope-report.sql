-- D4 to D6 report (READ ONLY): every table where a row can have no project, consumer or unit, and how many rows do. These are the rows that stay
-- super-admin-only under the approved strict policy until they are mapped (migration draft M10a). The owner decides, per table, "map the rows" or
-- "this is a global catalogue: put it on the allow-list". Restored, scrubbed copy first.   psql -X -f d6-null-scope-report.sql
SELECT c.relname AS table_name, a.attname AS column_name,
       (xpath('/row/n/text()', query_to_xml(format('SELECT count(*) AS n FROM public.%I WHERE %I IS NULL', c.relname, a.attname), false, true, '')))[1]::text::bigint AS null_rows,
       (xpath('/row/n/text()', query_to_xml(format('SELECT count(*) AS n FROM public.%I', c.relname), false, true, '')))[1]::text::bigint AS total_rows
  FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relispartition AND a.attname IN ('project_id', 'consumer_id', 'unit_id')
   AND a.atttypid = 'uuid'::regtype AND NOT a.attnotnull AND NOT a.attisdropped
 ORDER BY null_rows DESC, c.relname, a.attname;
