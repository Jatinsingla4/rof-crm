-- Minimal reference data for a NEW database built from schema_baseline.sql.
-- System roles named in packages/api/src/middleware/rbac.ts. No users, no consumers, no secrets.
-- roles.name has no UNIQUE constraint, so the insert is guarded to stay idempotent.
INSERT INTO public.roles (name, label, description, is_active, is_system)
SELECT v.name, v.label, v.description, TRUE, TRUE
FROM (VALUES
  ('super_admin',      'Super Admin',      'Full access'),
  ('project_manager',  'Project Manager',  'Projects, bookings, payments, documents'),
  ('sales_executive',  'Sales Executive',  'Consumers, bookings, communications'),
  ('accounts_finance', 'Accounts and Finance', 'Payments, reports, brokers'),
  ('support_agent',    'Support Agent',    'Read access with communications'),
  ('read_only_viewer', 'Read Only Viewer', 'Read only')
) AS v(name, label, description)
WHERE NOT EXISTS (SELECT 1 FROM public.roles r WHERE r.name = v.name);
