-- Names that differ only in letter case count as duplicates. The API already refuses them; this adds the same rule
-- in the database so two requests at the same moment cannot both succeed.
-- Each index is created only when the table has no duplicates yet, so existing data can never make a deploy fail.
DO $$
DECLARE
  r RECORD;
  dup_groups INT;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('uq_countries_name_ci',      'countries',          'lower(name)'),
    ('uq_banks_name_ci',          'banks',              'lower(name)'),
    ('uq_salutations_name_ci',    'salutations',        'lower(name)'),
    ('uq_professions_name_ci',    'professions',        'lower(name)'),
    ('uq_nationalities_name_ci',  'nationalities',      'lower(name)'),
    ('uq_sources_name_ci',        'sources_of_enquiry', 'lower(name)'),
    ('uq_companies_name_ci',      'companies',          'lower(name)'),
    ('uq_projects_name_ci',       'projects',           'lower(name)'),
    ('uq_states_name_ci',         'states',             'country_id, lower(name)'),
    ('uq_cities_name_ci',         'cities',             'state_id, lower(name)'),
    ('uq_towers_name_ci',         'towers',             'project_id, lower(tower_name)'),
    ('uq_unit_types_name_ci',     'unit_types',         'project_id, lower(name)'),
    ('uq_unit_locations_name_ci', 'unit_locations',     'project_id, lower(name)')
  ) AS t(idx, tbl, cols)
  LOOP
    IF to_regclass('public.' || r.tbl) IS NULL THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = r.idx) THEN CONTINUE; END IF;
    EXECUTE format('SELECT count(*) FROM (SELECT 1 FROM public.%I GROUP BY %s HAVING count(*) > 1) d', r.tbl, r.cols) INTO dup_groups;
    IF dup_groups > 0 THEN
      RAISE NOTICE 'Skipped %: % duplicate group(s) in %. Clean the data, then run this migration again.', r.idx, dup_groups, r.tbl;
    ELSE
      EXECUTE format('CREATE UNIQUE INDEX %I ON public.%I (%s)', r.idx, r.tbl, r.cols);
    END IF;
  END LOOP;
END $$;
