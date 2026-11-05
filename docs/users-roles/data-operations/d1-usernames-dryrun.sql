-- D1 data operation (DRY RUN by default): rename the losing logins of duplicate usernames, by the owner's decisions only.
-- Decisions file (CSV with a header):  user_id,new_username        one row per login that must change; a login that keeps its name is not listed.
--   psql -X -v decisions=/path/decisions.csv -f d1-usernames-dryrun.sql              -- shows what would happen, then ROLLBACK
--   psql -X -v decisions=/path/decisions.csv -v apply=1 -f d1-usernames-dryrun.sql   -- the same, then COMMIT (approved environment only)
-- No automatic choice is made: a login that is not in the decisions file is never touched. Every change writes an audit row with the old
-- and the new value. Nothing here runs against production unless a person points psql at it.
\set ON_ERROR_STOP on
\if :{?apply} \else \set apply 0 \endif
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('users:super_admin_guard'));

CREATE TEMP TABLE decisions (user_id uuid, new_username text) ON COMMIT DROP;
-- The decisions file is read with the shell (psql's \copy does not expand variables): plain CSV, a header line, no quotes and no commas inside a value.
\set csv `cat :decisions`
INSERT INTO decisions SELECT NULLIF(btrim(split_part(l, ',', 1), E' \r'), '')::uuid, NULLIF(btrim(split_part(l, ',', 2), E' \r'), '') FROM string_to_table(:'csv', E'\n') WITH ORDINALITY t(l, n) WHERE n > 1 AND btrim(l, E' \r') <> '';

\echo '== Checks (every count must be 0 before apply)'
SELECT 'decision for a login that does not exist' AS problem, count(*) FROM decisions d LEFT JOIN users u ON u.id = d.user_id WHERE u.id IS NULL
UNION ALL SELECT 'new username blank', count(*) FROM decisions WHERE btrim(coalesce(new_username, '')) = ''
UNION ALL SELECT 'same login listed twice', count(*) FROM (SELECT user_id FROM decisions GROUP BY 1 HAVING count(*) > 1) x
UNION ALL SELECT 'two decisions give the same new username (any case)', count(*) FROM (SELECT lower(btrim(new_username)) FROM decisions GROUP BY 1 HAVING count(*) > 1) x
UNION ALL SELECT 'new username already taken by a login not being renamed', count(*) FROM decisions d JOIN users u ON lower(btrim(u.username)) = lower(btrim(d.new_username)) AND u.id NOT IN (SELECT user_id FROM decisions);

CREATE TEMP TABLE before_rename ON COMMIT DROP AS SELECT u.id, u.username AS old_username FROM users u JOIN decisions d ON d.user_id = u.id;
UPDATE users u SET username = btrim(d.new_username), updated_at = NOW() FROM decisions d WHERE d.user_id = u.id;
INSERT INTO audit_logs (user_id, action, resource_type, resource_id, previous_values, new_values, timestamp)
SELECT NULL, 'update', 'user', b.id, jsonb_build_object('username', b.old_username), jsonb_build_object('username', btrim(d.new_username), 'dataOperation', 'D1'), NOW()
  FROM before_rename b JOIN decisions d ON d.user_id = b.id;

\echo '== Result: renamed logins'
SELECT b.id AS user_id, b.old_username, u.username AS new_username FROM before_rename b JOIN users u ON u.id = b.id ORDER BY 3;
\echo '== Still colliding after this run (must be empty before migration M1)'
SELECT lower(btrim(username)) AS normalized_username, count(*) FROM users WHERE username IS NOT NULL AND btrim(username) <> '' GROUP BY 1 HAVING count(*) > 1;

\if :apply
  \echo 'APPLY=1: committing'
  COMMIT;
\else
  \echo 'DRY RUN: rolled back, nothing was changed'
  ROLLBACK;
\endif
