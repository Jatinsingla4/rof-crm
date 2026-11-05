-- D7 review sheet query (ONE read-only SELECT, no trailing semicolon: the generator wraps it in \copy). It lists every ACTIVE login that is not
-- super_admin with: what the login holds today, what that becomes at release under the fail-closed code, a few ACTIVITY SIGNALS to help the owner
-- judge need, and three blank columns for the owner's decision. It assigns nothing; the activity columns are facts, not recommendations.
SELECT u.id AS user_id, u.email, u.name, u.role,
       to_char(u.last_login_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS last_login_ist,
       u.authorized_print   AS print_today,
       u.authorized_download AS download_today,
       COALESCE(u.unit_status_access, '<NULL>') AS unit_status_today,
       CASE WHEN u.authorized_print    IS TRUE THEN 'keeps printing'  ELSE 'LOSES printing at release'  END AS print_at_release,
       CASE WHEN u.authorized_download IS TRUE THEN 'keeps downloads' ELSE 'LOSES downloads at release' END AS download_at_release,
       CASE WHEN u.unit_status_access IN ('none','unit_hold','available','available_hold','all') THEN 'keeps ' || u.unit_status_access
            ELSE 'becomes none (NULL or unknown today)' END AS unit_status_at_release,
       (SELECT count(*) FROM receipts r WHERE r.received_by_user_id = u.id)               AS receipts_recorded,
       (SELECT count(*) FROM documents d WHERE d.created_by_user_id = u.id)               AS documents_generated,
       (SELECT count(*) FROM booking_records b WHERE b.created_by = u.id)                 AS bookings_made,
       (SELECT count(*) FROM audit_logs a WHERE a.user_id = u.id AND a.timestamp > now() - interval '90 days') AS audit_events_last_90_days,
       (SELECT string_agg(p.process_name || ':' || CASE WHEN p.is_maker THEN 'M' ELSE '' END || CASE WHEN p.is_checker THEN 'C' ELSE '' END, ' ' ORDER BY p.process_name)
          FROM user_process_permissions p WHERE p.user_id = u.id) AS process_rights,
       ''::text AS owner_print_yes_no,
       ''::text AS owner_download_yes_no,
       ''::text AS owner_unit_status_none_available_available_hold_unit_hold_all,
       ''::text AS owner_note
  FROM users u
 WHERE u.is_active AND u.role <> 'super_admin'
 ORDER BY u.role, u.email
