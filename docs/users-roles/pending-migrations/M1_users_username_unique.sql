-- M1 (UR-005), draft number 150, Batch 2. NOT in packages/api/src/db/migrations on purpose: it fails closed while two logins share a
-- username, so it may join `main` only after data operation D1 (owner resolves duplicates by hand) is approved.
-- Idempotent (CI runs migrations twice). No data is changed.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE username IS NOT NULL AND btrim(username) <> '' GROUP BY lower(btrim(username)) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'users has duplicate usernames (ignoring case and surrounding spaces); resolve them by hand (D1) before this migration';
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_btrim_key ON users (lower(btrim(username))) WHERE username IS NOT NULL AND btrim(username) <> '';
