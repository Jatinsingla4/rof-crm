-- D7 report (READ ONLY): what every login holds today for print, download and unit status, and what changes when the fail-closed code is released.
-- The code treats NULL, missing or unknown as "none" (unit status) and anything but true as "no" (print, download). A login whose value is NULL or
-- unknown therefore LOSES access at release unless the owner grants it first (data operation D7: individual grants, no mass grant).
-- Restored, scrubbed copy first.   psql -X -f d7-capability-report.sql
\echo '== per login: current values and what they become at release'
SELECT u.id AS user_id, u.email, u.role, u.is_active,
       u.authorized_print, u.authorized_download, u.unit_status_access,
       (u.role <> 'super_admin' AND u.authorized_print IS NOT TRUE)    AS print_denied_at_release,
       (u.role <> 'super_admin' AND u.authorized_download IS NOT TRUE) AS download_denied_at_release,
       (u.role <> 'super_admin' AND (u.unit_status_access IS NULL OR u.unit_status_access NOT IN ('none', 'unit_hold', 'available', 'available_hold', 'all'))) AS unit_status_becomes_none_by_default
  FROM users u WHERE u.is_active ORDER BY u.role, u.email;
\echo '== summary of ACTIVE non-super-admin logins'
SELECT count(*) AS active_logins,
       count(*) FILTER (WHERE authorized_print IS TRUE)    AS print_granted,
       count(*) FILTER (WHERE authorized_print IS NOT TRUE) AS print_denied_at_release,
       count(*) FILTER (WHERE authorized_download IS TRUE)    AS download_granted,
       count(*) FILTER (WHERE authorized_download IS NOT TRUE) AS download_denied_at_release,
       count(*) FILTER (WHERE unit_status_access IS NULL) AS unit_status_null,
       count(*) FILTER (WHERE unit_status_access IS NOT NULL AND unit_status_access NOT IN ('none', 'unit_hold', 'available', 'available_hold', 'all')) AS unit_status_unknown,
       count(*) FILTER (WHERE unit_status_access = 'all') AS unit_status_all
  FROM users WHERE is_active AND role <> 'super_admin';
\echo '== unit status values in use'
SELECT coalesce(unit_status_access, '<NULL>') AS value, count(*) FROM users WHERE is_active AND role <> 'super_admin' GROUP BY 1 ORDER BY 2 DESC;
