-- Land area is often a decimal in acres (4.5), but the column was a whole number, so 4.5 could not be saved. Safe to repeat: it only changes the type while it is still a whole number.
DO $$ BEGIN
  IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'land_area_sqft') = 'bigint' THEN
    ALTER TABLE projects ALTER COLUMN land_area_sqft TYPE numeric(16,4);
  END IF;
END $$;
