-- A project can name its own Customer Classification, so the customer's income_category is text instead of the fixed EWS / LIG / MIG enum. Idempotent.
DO $$ BEGIN
  IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'consumers' AND column_name = 'income_category') = 'USER-DEFINED' THEN
    ALTER TABLE consumers ALTER COLUMN income_category TYPE varchar(50) USING income_category::text;
  END IF;
END $$;
