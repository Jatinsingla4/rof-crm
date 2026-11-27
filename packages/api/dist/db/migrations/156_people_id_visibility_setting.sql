-- QA-027: who sees PAN, Aadhaar and passport numbers in full. Empty = every role, as before. ROF decides the list (for example 'super_admin,accounts_finance').
INSERT INTO global_settings (key, value, description)
VALUES ('people_id_full_roles', '', 'QA-027: comma separated roles that see applicant PAN, Aadhaar and passport in full; empty = all roles')
ON CONFLICT (key) DO NOTHING;
