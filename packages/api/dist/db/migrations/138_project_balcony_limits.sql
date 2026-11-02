-- Balcony charge limits a project can set for itself. Blank = no project rule: the Charge Master cap (if any) applies and the whole balcony area is charged. Idempotent.
ALTER TABLE project_settings ADD COLUMN IF NOT EXISTS balcony_max_charge_inr numeric(14,2);
ALTER TABLE project_settings ADD COLUMN IF NOT EXISTS balcony_max_area_sqft numeric(12,3);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_settings_balcony_chk') THEN
    ALTER TABLE project_settings ADD CONSTRAINT project_settings_balcony_chk CHECK ((balcony_max_charge_inr IS NULL OR balcony_max_charge_inr > 0) AND (balcony_max_area_sqft IS NULL OR balcony_max_area_sqft > 0));
  END IF;
END $$;
