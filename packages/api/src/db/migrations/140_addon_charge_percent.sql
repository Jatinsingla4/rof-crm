-- An add-on charge can be a percentage of the unit's basic price (the client's "In %"), on the basic price or on the basic price after the company inaugural discount and dealer adjustment. Idempotent.
ALTER TABLE addon_charge_master ADD COLUMN IF NOT EXISTS percent_value numeric(7,4);
ALTER TABLE addon_charge_master ADD COLUMN IF NOT EXISTS percent_basis varchar(20) NOT NULL DEFAULT 'basic';
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'addon_charge_master'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%rate_type%' LOOP
    EXECUTE format('ALTER TABLE addon_charge_master DROP CONSTRAINT %I', c.conname);
  END LOOP;
  ALTER TABLE addon_charge_master ADD CONSTRAINT addon_charge_master_rate_type_check CHECK (rate_type IN ('flat', 'per_sqft', 'percent'));
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'addon_charge_master_percent_chk') THEN
    ALTER TABLE addon_charge_master ADD CONSTRAINT addon_charge_master_percent_chk CHECK (percent_basis IN ('basic', 'after_discount') AND (percent_value IS NULL OR (percent_value > 0 AND percent_value <= 100)) AND (rate_type <> 'percent' OR percent_value IS NOT NULL));
  END IF;
END $$;
