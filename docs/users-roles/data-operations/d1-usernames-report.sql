-- D1 report (READ ONLY): duplicate usernames that block migration M1 (users_username_lower_btrim_key).
-- Run on a restored, scrubbed copy first, never on Neon or production without the owner's approval:
--   psql -X -f d1-usernames-report.sql
-- Nothing here writes. The owner decides, per group, which login keeps the name; this file only lists the facts to decide with.

\echo '== U1: usernames that collide after trimming spaces and ignoring case'
SELECT lower(btrim(username)) AS normalized_username, count(*) AS logins,
       array_agg(id ORDER BY created_at)        AS user_ids,
       array_agg(email ORDER BY created_at)     AS emails,
       array_agg(is_active ORDER BY created_at) AS active,
       array_agg(role ORDER BY created_at)      AS roles,
       array_agg(last_login_at ORDER BY created_at) AS last_logins
  FROM users
 WHERE username IS NOT NULL AND btrim(username) <> ''
 GROUP BY 1 HAVING count(*) > 1
 ORDER BY logins DESC, 1;

\echo '== U1 detail: one row per login in a colliding group, with what a decision needs'
SELECT lower(btrim(u.username)) AS normalized_username, u.id AS user_id, u.username AS stored_username, u.email, u.name, u.role, u.is_active,
       u.last_login_at, u.created_at,
       row_number() OVER (PARTITION BY lower(btrim(u.username)) ORDER BY u.is_active DESC, u.last_login_at DESC NULLS LAST, u.created_at) AS suggested_rank
  FROM users u
 WHERE u.username IS NOT NULL AND btrim(u.username) <> ''
   AND lower(btrim(u.username)) IN (SELECT lower(btrim(username)) FROM users WHERE username IS NOT NULL AND btrim(username) <> '' GROUP BY 1 HAVING count(*) > 1)
 ORDER BY 1, suggested_rank;

\echo '== U2: NULL or blank usernames (ignored by the index, nothing to fix)'
SELECT count(*) FILTER (WHERE username IS NULL) AS null_username, count(*) FILTER (WHERE username IS NOT NULL AND btrim(username) = '') AS blank_username, count(*) AS all_users FROM users;

\echo '== Usernames that differ from their trimmed form (the index trims; the application trims on write)'
SELECT id, email, '[' || username || ']' AS stored FROM users WHERE username IS NOT NULL AND username <> btrim(username) ORDER BY email;
