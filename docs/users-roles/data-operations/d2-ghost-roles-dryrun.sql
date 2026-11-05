-- D2 data operation (DRY RUN by default): move logins off ghost or case-mismatched roles, by the owner's decisions only.
-- Decisions file (CSV with a header):  user_id,target_role      target_role must be the exact name of an existing role.
--   psql -X -v decisions=/path/decisions.csv -f d2-ghost-roles-dryrun.sql              -- dry run (ROLLBACK)
--   psql -X -v decisions=/path/decisions.csv -v apply=1 -f d2-ghost-roles-dryrun.sql   -- then COMMIT (approved environment only)
-- There is NO automatic reassignment: a login that is not in the decisions file is never touched, and a case-only mismatch is also an
-- explicit row (the owner confirms the role). Each change writes an audit row with the old and the new role and ends the login's sessions.
\set ON_ERROR_STOP on
\if :{?apply} \else \set apply 0 \endif
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('users:super_admin_guard'));
CREATE TEMP TABLE decisions (user_id uuid, target_role text) ON COMMIT DROP;
-- The decisions file is read with the shell (psql's \copy does not expand variables): plain CSV, a header line, no quotes and no commas inside a value.
\set csv `cat :decisions`
INSERT INTO decisions SELECT NULLIF(btrim(split_part(l, ',', 1), E' \r'), '')::uuid, NULLIF(btrim(split_part(l, ',', 2), E' \r'), '') FROM string_to_table(:'csv', E'\n') WITH ORDINALITY t(l, n) WHERE n > 1 AND btrim(l, E' \r') <> '';

\echo '== Checks (every count must be 0 before apply)'
SELECT 'decision for a login that does not exist' AS problem, count(*) FROM decisions d LEFT JOIN users u ON u.id = d.user_id WHERE u.id IS NULL
UNION ALL SELECT 'target role does not exist (exact name)', count(*) FROM decisions d WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.name = d.target_role)
UNION ALL SELECT 'target role is inactive', count(*) FROM decisions d JOIN roles r ON r.name = d.target_role WHERE NOT r.is_active
UNION ALL SELECT 'target role has a super_admin base (never granted by a data operation)', count(*) FROM decisions d JOIN roles r ON r.name = d.target_role WHERE r.base_role = 'super_admin' OR (r.is_system AND r.name = 'super_admin')
UNION ALL SELECT 'same login listed twice', count(*) FROM (SELECT user_id FROM decisions GROUP BY 1 HAVING count(*) > 1) x
UNION ALL SELECT 'login already holds an existing role (not a ghost)', count(*) FROM decisions d JOIN users u ON u.id = d.user_id WHERE EXISTS (SELECT 1 FROM roles r WHERE r.name = u.role);

CREATE TEMP TABLE before_move ON COMMIT DROP AS SELECT u.id, u.role AS old_role FROM users u JOIN decisions d ON d.user_id = u.id;
UPDATE users u SET role = d.target_role, token_version = COALESCE(u.token_version, 0) + 1, updated_at = NOW() FROM decisions d WHERE d.user_id = u.id;
INSERT INTO audit_logs (user_id, action, resource_type, resource_id, previous_values, new_values, timestamp)
SELECT NULL, 'update', 'user', b.id, jsonb_build_object('role', b.old_role), jsonb_build_object('role', d.target_role, 'dataOperation', 'D2'), NOW()
  FROM before_move b JOIN decisions d ON d.user_id = b.id;

\echo '== Result: moved logins'
SELECT b.id AS user_id, b.old_role, u.role AS new_role FROM before_move b JOIN users u ON u.id = b.id ORDER BY 2, 1;
\echo '== Ghost or case-mismatched logins still left (must be empty before migration M3)'
SELECT u.id, u.email, u.role FROM users u WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.name = u.role);

\if :apply
  \echo 'APPLY=1: committing'
  COMMIT;
\else
  \echo 'DRY RUN: rolled back, nothing was changed'
  ROLLBACK;
\endif
