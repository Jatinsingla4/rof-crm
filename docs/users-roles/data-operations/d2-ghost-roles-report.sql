-- D2 report (READ ONLY): logins whose role has no exact roles row (ghost role) or differs only in case, and other role inconsistencies
-- that block migration M3 (users_role_fkey). Restored, scrubbed copy first.   psql -X -f d2-ghost-roles-report.sql
\echo '== R1: logins whose role has no roles row with exactly that name'
SELECT u.id AS user_id, u.email, u.name, u.role AS stored_role, u.is_active,
       EXISTS (SELECT 1 FROM roles r WHERE lower(r.name) = lower(u.role)) AS differs_only_in_case,
       (SELECT r.name FROM roles r WHERE lower(r.name) = lower(u.role) LIMIT 1) AS roles_row_name,
       (SELECT r.is_active FROM roles r WHERE lower(r.name) = lower(u.role) LIMIT 1) AS that_role_active
  FROM users u WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.name = u.role)
 ORDER BY u.is_active DESC, u.role, u.email;
\echo '== R1 summary'
SELECT role AS stored_role, count(*) AS logins, count(*) FILTER (WHERE is_active) AS active_logins FROM users u
 WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.name = u.role) GROUP BY 1 ORDER BY 2 DESC;
\echo '== Roles that logins could be moved to (active roles; a decision picks one per ghost role)'
SELECT name, label, base_role, is_system FROM roles WHERE is_active ORDER BY is_system DESC, name;
\echo '== R2: duplicate role names (any case) and the unique constraints that exist'
SELECT lower(name) AS n, count(*), array_agg(name) FROM roles GROUP BY 1 HAVING count(*) > 1;
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'roles'::regclass AND contype IN ('u', 'p');
\echo '== R4: logins holding an inactive role, and page access rows of roles that do not exist'
SELECT u.role, count(*) AS logins FROM users u JOIN roles r ON r.name = u.role AND NOT r.is_active GROUP BY 1;
SELECT role_name, count(*) AS page_rows FROM role_page_access x WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.name = x.role_name) GROUP BY 1;
