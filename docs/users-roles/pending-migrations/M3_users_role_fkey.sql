-- M3 (UR-008), draft number 152, Batch 3 (alone). NOT in the migrations folder on purpose: M2 must already be applied in an earlier batch
-- (the foreign key needs roles.name unique) and data operation D2 (ghost roles and case mismatches fixed by hand) must be done.
-- Idempotent. No data is changed; it fails closed with a readable message when a login holds a role that does not exist.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM users u WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.name = u.role)) THEN
    RAISE EXCEPTION 'a login holds a role that does not exist (or differs in case); fix it by hand (D2) before this migration';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_role_fkey' AND conrelid = 'users'::regclass) THEN
    ALTER TABLE users ADD CONSTRAINT users_role_fkey FOREIGN KEY (role) REFERENCES roles(name) ON DELETE RESTRICT ON UPDATE RESTRICT;
  END IF;
END $$;
