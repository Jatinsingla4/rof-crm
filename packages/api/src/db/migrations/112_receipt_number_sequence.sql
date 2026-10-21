-- Receipt numbers run on a sequence (REC-<year>-00001, 00002 ...) instead of a random number that could collide
CREATE SEQUENCE IF NOT EXISTS receipt_number_seq;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rof_app') THEN
    GRANT USAGE, SELECT ON SEQUENCE receipt_number_seq TO rof_app;
  END IF;
END $$;
