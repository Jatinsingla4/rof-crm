-- M2 (UR-008, UR-001 2.4), draft number 151, Batch 2. NOT in the migrations folder on purpose: it needs data operation D11 first
-- (the owner reviews every role whose base role is super_admin) and no two roles with the same name in any case.
-- Idempotent. No data is changed.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM roles GROUP BY name HAVING count(*) > 1) OR EXISTS (SELECT 1 FROM roles GROUP BY lower(name) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'roles has duplicate names; resolve them by hand before this migration';
  END IF;
  IF EXISTS (SELECT 1 FROM roles WHERE base_role = 'super_admin') THEN
    RAISE EXCEPTION 'a role has base_role super_admin; the owner must review it (D11) before this migration';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'roles_name_key' AND conrelid = 'roles'::regclass) THEN
    ALTER TABLE roles ADD CONSTRAINT roles_name_key UNIQUE (name);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'roles_base_role_not_super_admin' AND conrelid = 'roles'::regclass) THEN
    ALTER TABLE roles ADD CONSTRAINT roles_base_role_not_super_admin CHECK (base_role IS NULL OR base_role <> 'super_admin');
  END IF;
END $$;
