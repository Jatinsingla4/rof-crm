-- The client's Unit Wise Area has 12 area fields. Super, carpet and the first balcony stay on the unit (billing reads them);
-- the rest are kept here, one row per unit, with a history that records what changed and from which date. Idempotent.
CREATE TABLE IF NOT EXISTS unit_areas (
  unit_id uuid PRIMARY KEY REFERENCES units(id) ON DELETE CASCADE,
  area_measurement varchar(50),
  built_up_area_sqft numeric(14,4),
  udsl_area_sqft numeric(14,4),
  plot_area numeric(14,4),
  balcony_2_area_sqft numeric(14,4),
  balcony_3_area_sqft numeric(14,4),
  basement_area_sqft numeric(14,4),
  stilt_area_sqft numeric(14,4),
  common_area_sqft numeric(14,4),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS unit_area_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  effective_date date NOT NULL,
  before jsonb NOT NULL,
  after jsonb NOT NULL,
  note varchar(500),
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_unit_area_history_unit ON unit_area_history (unit_id, changed_at DESC);
GRANT ALL ON unit_areas, unit_area_history TO rof_app;
SELECT public.rof_apply_project_scope();
