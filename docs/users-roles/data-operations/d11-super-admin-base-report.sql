-- D11 report (READ ONLY): roles whose base_role is super_admin or not a known system role, and who holds them. They block migration M2
-- (CHECK base_role <> 'super_admin') and today they are refused by the code (a custom role never inherits super_admin, UR-001).
--   psql -X -f d11-super-admin-base-report.sql
\echo '== R3: roles with a super_admin or unknown base role'
SELECT r.id, r.name, r.label, r.base_role, r.is_system, r.is_active,
       (SELECT count(*) FROM users u WHERE u.role = r.name) AS holders,
       (SELECT count(*) FROM users u WHERE u.role = r.name AND u.is_active) AS active_holders,
       (SELECT count(*) FROM role_page_access x WHERE x.role_name = r.name AND x.can_view) AS menu_pages
  FROM roles r
 WHERE r.base_role = 'super_admin' OR (r.base_role IS NOT NULL AND r.base_role NOT IN (SELECT name FROM roles WHERE is_system))
 ORDER BY r.is_active DESC, r.name;
\echo '== R3b: the holders of those roles (the owner reviews each before choosing a valid base role)'
SELECT r.name AS role_name, r.base_role, u.id AS user_id, u.email, u.name, u.is_active, u.last_login_at
  FROM roles r JOIN users u ON u.role = r.name
 WHERE r.base_role = 'super_admin' OR (r.base_role IS NOT NULL AND r.base_role NOT IN (SELECT name FROM roles WHERE is_system))
 ORDER BY r.name, u.email;
\echo '== The valid base roles to choose from'
SELECT name, label FROM roles WHERE is_system AND name <> 'super_admin' ORDER BY name;
\echo '== Roles with a NULL base role that are not system roles (resolve to their own name today; informational)'
SELECT name, label, is_active, (SELECT count(*) FROM users u WHERE u.role = r.name) AS holders FROM roles r WHERE base_role IS NULL AND NOT is_system ORDER BY name;
