-- D11 data operation (DRY RUN by default): give each role with a super_admin or unknown base role a valid base role, or deactivate it,
-- by the owner's decisions only.
-- Decisions file (CSV with a header):  role_name,action,base_role
--   action = set_base    base_role = a system role other than super_admin  (the role keeps its holders and menu pages)
--   action = deactivate  base_role left empty                              (only when the role has no active holders; its base role is cleared)
--   psql -X -v decisions=/path/decisions.csv -f d11-super-admin-base-dryrun.sql              -- dry run (ROLLBACK)
--   psql -X -v decisions=/path/decisions.csv -v apply=1 -f d11-super-admin-base-dryrun.sql   -- then COMMIT (approved environment only)
-- No role is reassigned automatically and no holder is moved here (moving holders is a D2-style decision of its own). Each change writes an
-- audit row with the old and new base role and the holders list; the holders' sessions end because their effective role changes.
\set ON_ERROR_STOP on
\if :{?apply} \else \set apply 0 \endif
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('users:super_admin_guard'));
CREATE TEMP TABLE decisions (role_name text, action text, base_role text) ON COMMIT DROP;
-- The decisions file is read with the shell (psql's \copy does not expand variables): plain CSV, a header line, no quotes and no commas inside a value.
\set csv `cat :decisions`
INSERT INTO decisions SELECT NULLIF(btrim(split_part(l, ',', 1), E' \r'), ''), NULLIF(btrim(split_part(l, ',', 2), E' \r'), ''), NULLIF(btrim(split_part(l, ',', 3), E' \r'), '') FROM string_to_table(:'csv', E'\n') WITH ORDINALITY t(l, n) WHERE n > 1 AND btrim(l, E' \r') <> '';

\echo '== Checks (every count must be 0 before apply)'
SELECT 'role does not exist' AS problem, count(*) FROM decisions d WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.name = d.role_name)
UNION ALL SELECT 'role is a system role (never changed here)', count(*) FROM decisions d JOIN roles r ON r.name = d.role_name WHERE r.is_system
UNION ALL SELECT 'role is not one of the roles D11 covers', count(*) FROM decisions d JOIN roles r ON r.name = d.role_name WHERE NOT (r.base_role = 'super_admin' OR (r.base_role IS NOT NULL AND r.base_role NOT IN (SELECT name FROM roles WHERE is_system)))
UNION ALL SELECT 'action is neither set_base nor deactivate', count(*) FROM decisions WHERE action NOT IN ('set_base', 'deactivate')
UNION ALL SELECT 'set_base with a base role that is not a system role other than super_admin', count(*) FROM decisions d WHERE d.action = 'set_base' AND NOT EXISTS (SELECT 1 FROM roles s WHERE s.is_system AND s.name = d.base_role AND s.name <> 'super_admin')
UNION ALL SELECT 'deactivate while the role still has active holders', count(*) FROM decisions d WHERE d.action = 'deactivate' AND EXISTS (SELECT 1 FROM users u WHERE u.role = d.role_name AND u.is_active)
UNION ALL SELECT 'same role listed twice', count(*) FROM (SELECT role_name FROM decisions GROUP BY 1 HAVING count(*) > 1) x;

CREATE TEMP TABLE before_roles ON COMMIT DROP AS
  SELECT r.id, r.name, r.base_role AS old_base, r.is_active AS old_active,
         COALESCE((SELECT jsonb_agg(u.id ORDER BY u.id) FROM users u WHERE u.role = r.name), '[]'::jsonb) AS holders
    FROM roles r JOIN decisions d ON d.role_name = r.name;
-- a deactivated role also loses its blocking base role: the CHECK of M2 applies to inactive rows too (the audit row keeps the old base)
UPDATE roles r SET base_role = CASE WHEN d.action = 'set_base' THEN d.base_role ELSE NULL END,
                   is_active = CASE WHEN d.action = 'deactivate' THEN false ELSE r.is_active END
  FROM decisions d WHERE d.role_name = r.name;
UPDATE users u SET token_version = COALESCE(u.token_version, 0) + 1 WHERE u.role IN (SELECT role_name FROM decisions);
INSERT INTO audit_logs (user_id, action, resource_type, resource_id, previous_values, new_values, timestamp)
SELECT NULL, 'update', 'role', b.id, jsonb_build_object('base_role', b.old_base, 'is_active', b.old_active, 'holders', b.holders),
       jsonb_build_object('base_role', r.base_role, 'is_active', r.is_active, 'dataOperation', 'D11'), NOW()
  FROM before_roles b JOIN roles r ON r.id = b.id;

\echo '== Result'
SELECT b.name AS role_name, b.old_base, r.base_role AS new_base, b.old_active, r.is_active AS new_active, jsonb_array_length(b.holders) AS holders FROM before_roles b JOIN roles r ON r.id = b.id ORDER BY 1;
\echo '== Roles still blocking migration M2 (must be empty)'
SELECT name, base_role FROM roles WHERE base_role = 'super_admin' OR (base_role IS NOT NULL AND base_role NOT IN (SELECT name FROM roles WHERE is_system));

\if :apply
  \echo 'APPLY=1: committing'
  COMMIT;
\else
  \echo 'DRY RUN: rolled back, nothing was changed'
  ROLLBACK;
\endif
