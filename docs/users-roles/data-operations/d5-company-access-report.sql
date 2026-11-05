-- D5 report (READ ONLY): who can see which projects and companies today, and where the mapping is missing, NULL or ambiguous.
-- Purpose: decision support for the owner's per-login mapping (data operation D5). Nothing here assigns, changes or grants anything.
-- Run ONLY on a scrubbed or synthetic copy:   PGOPTIONS='-c default_transaction_read_only=on' psql -X -f d5-company-access-report.sql
-- (the PGOPTIONS makes the session read-only, so even a mistake in this file cannot write.)
-- How the code reads the mapping today (index.ts loadAuthUser): a login with NO project assignment and NO company grant sees everything;
-- project assignments and company grants each narrow the project scope, together they intersect (a grant never widens an assignment);
-- a project that belongs to no company is outside any company limit. super_admin is never limited.
\pset null '<NULL>'
\echo '=== 1. Summary: active logins that are not super_admin, by how they are limited today'
WITH l AS (
  SELECT u.id, u.role,
         jsonb_array_length(COALESCE(u.assigned_project_ids, '[]'::jsonb)) AS n_proj,
         (SELECT count(*) FROM user_company_access c WHERE c.user_id = u.id) AS n_co
    FROM users u WHERE u.is_active AND u.role <> 'super_admin')
SELECT CASE WHEN n_proj = 0 AND n_co = 0 THEN '1 UNRESTRICTED today (no project, no company)'
            WHEN n_proj > 0 AND n_co = 0 THEN '2 projects only'
            WHEN n_proj = 0 AND n_co > 0 THEN '3 companies only'
            ELSE '4 projects and companies (intersection)' END AS how_limited_today,
       count(*) AS logins
  FROM l GROUP BY 1 ORDER BY 1;

\echo '=== 2. Per login (the review sheet): current limits and the projects the login can really reach'
SELECT u.id AS user_id, u.email, u.name, u.role, u.last_login_at,
       jsonb_array_length(COALESCE(u.assigned_project_ids, '[]'::jsonb)) AS assigned_projects,
       (SELECT count(*) FROM user_company_access c WHERE c.user_id = u.id) AS company_grants,
       CASE WHEN jsonb_array_length(COALESCE(u.assigned_project_ids, '[]'::jsonb)) = 0 AND NOT EXISTS (SELECT 1 FROM user_company_access c WHERE c.user_id = u.id)
            THEN (SELECT count(*) FROM projects)
            ELSE (SELECT count(*) FROM projects p
                   WHERE (jsonb_array_length(COALESCE(u.assigned_project_ids, '[]'::jsonb)) = 0 OR p.id::text IN (SELECT jsonb_array_elements_text(u.assigned_project_ids)))
                     AND (NOT EXISTS (SELECT 1 FROM user_company_access c WHERE c.user_id = u.id) OR p.company_id IN (SELECT company_id FROM user_company_access c WHERE c.user_id = u.id))) END AS projects_reachable_today,
       (SELECT count(*) FROM projects) AS projects_total
  FROM users u WHERE u.is_active AND u.role <> 'super_admin' ORDER BY u.role, u.email;

\echo '=== 3. MISSING: active logins that are unrestricted today (they see every project of every company). Each needs an owner decision'
SELECT u.id AS user_id, u.email, u.role, u.last_login_at
  FROM users u WHERE u.is_active AND u.role <> 'super_admin'
   AND jsonb_array_length(COALESCE(u.assigned_project_ids, '[]'::jsonb)) = 0 AND NOT EXISTS (SELECT 1 FROM user_company_access c WHERE c.user_id = u.id)
 ORDER BY u.role, u.email;

\echo '=== 4. NULL: projects that belong to no company (invisible to every company-limited login; visible to unrestricted ones)'
SELECT p.id AS project_id, p.name, p.group_name,
       (SELECT count(*) FROM consumers c WHERE c.project_id = p.id) AS applicants,
       (SELECT count(*) FROM units un WHERE un.project_id = p.id) AS units
  FROM projects p WHERE p.company_id IS NULL ORDER BY p.name;

\echo '=== 5. AMBIGUOUS: assigned projects that sit OUTSIDE the login''s own company grants (the assignment is cancelled by the company limit)'
SELECT u.id AS user_id, u.email, p.id AS project_id, p.name AS project, p.company_id AS project_company,
       CASE WHEN p.company_id IS NULL THEN 'project has no company' ELSE 'company not granted to this login' END AS why_unreachable
  FROM users u CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(u.assigned_project_ids, '[]'::jsonb)) a(pid)
  JOIN projects p ON p.id::text = a.pid
 WHERE u.is_active AND u.role <> 'super_admin' AND EXISTS (SELECT 1 FROM user_company_access c WHERE c.user_id = u.id)
   AND (p.company_id IS NULL OR p.company_id NOT IN (SELECT company_id FROM user_company_access c WHERE c.user_id = u.id))
 ORDER BY u.email, p.name;

\echo '=== 6. AMBIGUOUS: assigned project ids that no longer exist (a login assigned ONLY to such ids sees nothing, never everything)'
SELECT u.id AS user_id, u.email, a.pid AS missing_project_id
  FROM users u CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(u.assigned_project_ids, '[]'::jsonb)) a(pid)
 WHERE u.is_active AND NOT EXISTS (SELECT 1 FROM projects p WHERE p.id::text = a.pid) ORDER BY u.email;

\echo '=== 7. AMBIGUOUS: company grants to an inactive company'
SELECT u.id AS user_id, u.email, c.id AS company_id, c.name AS company, c.is_active
  FROM user_company_access uc JOIN users u ON u.id = uc.user_id JOIN companies c ON c.id = uc.company_id
 WHERE u.is_active AND c.is_active IS NOT TRUE ORDER BY u.email;

\echo '=== 8. AMBIGUOUS: a second, legacy project list on the login (users.project_ids) that the scope code does NOT read'
SELECT u.id AS user_id, u.email, u.project_ids AS legacy_project_ids, u.assigned_project_ids
  FROM users u WHERE u.project_ids IS NOT NULL AND cardinality(u.project_ids) > 0 ORDER BY u.email;

\echo '=== 9. Companies: how many projects, how many logins are limited to them'
SELECT c.id AS company_id, c.name, c.is_active,
       (SELECT count(*) FROM projects p WHERE p.company_id = c.id) AS projects,
       (SELECT count(*) FROM user_company_access uc JOIN users u ON u.id = uc.user_id WHERE uc.company_id = c.id AND u.is_active) AS limited_logins
  FROM companies c ORDER BY c.name;
\echo '    (a company with projects and limited_logins = 0 is reachable only by unrestricted logins and super_admin)'

\echo '=== 10. Company-level data that company grants do NOT cover today: legacy bank accounts with no company'
SELECT count(*) AS bank_accounts_with_no_company, count(*) FILTER (WHERE is_active) AS of_which_active FROM bank_accounts WHERE company_id IS NULL;
