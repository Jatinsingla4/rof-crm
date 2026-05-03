-- Change area columns from INTEGER to NUMERIC
-- Real estate measurements require decimal precision
-- e.g. 193.752 sqft, 645.743 sqft

ALTER TABLE units
  ALTER COLUMN carpet_area_sqft
    TYPE NUMERIC(10,3)
    USING carpet_area_sqft::NUMERIC;

ALTER TABLE units
  ALTER COLUMN super_area_sqft
    TYPE NUMERIC(10,3)
    USING super_area_sqft::NUMERIC;

-- Check if balcony_area_sqft exists first:
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='units'
    AND column_name='balcony_area_sqft'
  ) THEN
    ALTER TABLE units
      ALTER COLUMN balcony_area_sqft
        TYPE NUMERIC(10,3)
        USING balcony_area_sqft::NUMERIC;
  END IF;
END $$;
