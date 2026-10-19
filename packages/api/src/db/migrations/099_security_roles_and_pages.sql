-- Security module: custom roles that work, a page list that exists, unique login emails.
-- Safe to run more than once. Never overwrites data that is already there.

-- 1. A custom role borrows the API permissions of one system role (base_role). Without this the API
--    answers "Unknown role" for every request from a custom role.
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS base_role VARCHAR(50);
ALTER TABLE public.roles ALTER COLUMN is_active SET DEFAULT TRUE;
ALTER TABLE public.roles ALTER COLUMN is_system SET DEFAULT FALSE;
UPDATE public.roles SET is_active = TRUE WHERE is_active IS NULL;
UPDATE public.roles SET is_system = (name IN ('super_admin','project_manager','sales_executive','accounts_finance','support_agent','read_only_viewer'))
 WHERE is_system IS NULL;

-- Role names are unique ignoring case (the old key was name + is_custom, which allowed two roles with one name).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='uq_roles_name_ci') THEN
    IF EXISTS (SELECT 1 FROM public.roles GROUP BY lower(name) HAVING count(*) > 1) THEN
      RAISE NOTICE 'Skipped uq_roles_name_ci: duplicate role names exist. Clean the data, then run this migration again.';
    ELSE
      CREATE UNIQUE INDEX uq_roles_name_ci ON public.roles (lower(name));
    END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='uq_users_email_ci') THEN
    IF EXISTS (SELECT 1 FROM public.users GROUP BY lower(email) HAVING count(*) > 1) THEN
      RAISE NOTICE 'Skipped uq_users_email_ci: two users share an email that differs only in letter case. Clean the data, then run this migration again.';
    ELSE
      CREATE UNIQUE INDEX uq_users_email_ci ON public.users (lower(email));
    END IF;
  END IF;
END $$;

-- 2. The list of pages that Role Menu Access works on: one row per screen the app can open.
INSERT INTO public.nav_pages (route, label, category, sort_order, is_active)
SELECT v.route, v.label, v.category, v.ord, TRUE
FROM (VALUES
  ('/dashboard','Home','CRM',1), ('/consumers','Applicants','CRM',2), ('/consumer','Applicant Detail','CRM',3),
  ('/leads','Leads','CRM',4), ('/search-customer','Search Customer','CRM',5), ('/communications','Communications','CRM',6),
  ('/whatsapp-inbox','WhatsApp Inbox','CRM',7), ('/facebook-inbox','Facebook Inbox','CRM',8), ('/instagram-inbox','Instagram Inbox','CRM',9),
  ('/email-templates','Email Templates','CRM',10), ('/campaigns','Campaigns','CRM',11), ('/calling','Calling','CRM',12),
  ('/automation','Automation','CRM',13), ('/tasks','Tasks','CRM',14), ('/help','Help','CRM',15),
  ('/booking','Booking','Application',1), ('/booking-payment','Booking Payment','Application',2), ('/edit-booking','Edit Booking','Application',3),
  ('/allotment','Allotment','Application',4), ('/receipts','Receipts','Application',5), ('/demands','Demands','Application',6),
  ('/demand-raise','Raise Demand','Application',7), ('/demand-status','Demand Status','Application',8), ('/gst-invoicing','GST Invoicing','Application',9),
  ('/surrender','Surrender','Application',10), ('/surrender-report','Surrender Report','Application',11), ('/surrender-restore','Surrender Restore','Application',12),
  ('/transfers','Transfers','Application',13), ('/transfer-report','Transfer Report','Application',14), ('/transfer-detail','Transfer Detail','Application',15),
  ('/transfer-date-edit','Transfer Date Edit','Application',16), ('/registry','Registry','Application',17), ('/loans','Loans','Application',18),
  ('/documents','Documents','Application',19), ('/customer-folders','Customer Folders','Application',20), ('/unit-documents','Unit Documents','Application',21),
  ('/unit-status','Unit Status','Application',22), ('/interest-scheduler','Interest Scheduler','Application',23), ('/installment-interest','Installment Interest','Application',24),
  ('/customer-wise-interest','Customer Wise Interest','Application',25), ('/interest-waiver','Interest Waiver','Application',26),
  ('/set-addon-charge','Set Add-on Charge','Application',27), ('/cancel-addon-charge','Cancel Add-on Charge','Application',28),
  ('/waiveoff-addon-charge','Waive Off Add-on Charge','Application',29), ('/bulk-addon-charge','Bulk Add-on Charge','Application',30),
  ('/reports','Reports','Reports',1), ('/reports/edits','Edit Reports','Reports',2), ('/analytics','Analytics','Reports',3),
  ('/brokers','Brokers','Broker',1), ('/broker-setup','Broker Setup','Broker',2),
  ('/parking','Parking','Parking',1), ('/inventory-hold','Inventory Hold','Investor / Hold',1),
  ('/set-master','Set Master','Set Master',1), ('/employees','Employees','Set Master',2), ('/users','Security','Set Master',3),
  ('/import','Import','Set Master',4), ('/collection-setup','Collection Setup','Set Master',5), ('/interest-master','Interest Master','Set Master',6),
  ('/grace-period','Grace Period','Set Master',7), ('/transfer-fee-setup','Transfer Fee Setup','Set Master',8), ('/charge-master','Charge Master','Set Master',9),
  ('/addon-charge-master','Add-on Charge Master','Set Master',10), ('/gst-configuration','GST Configuration','Set Master',11),
  ('/set-projects','Set Projects','Set Projects',1)
) AS v(route,label,category,ord)
WHERE NOT EXISTS (SELECT 1 FROM public.nav_pages n WHERE n.route = v.route);

-- 3. Starting page access for each system role, only for a role that has none yet. super_admin sees everything
--    without rows. Change it any time in Security > Role Menu Access.
INSERT INTO public.role_page_access (role_name, page_id, can_view)
SELECT r.role_name, n.id, TRUE
FROM public.nav_pages n
JOIN (VALUES
  ('project_manager',  ARRAY['CRM','Application','Reports','Broker','Parking','Investor / Hold','Set Master','Set Projects'], ARRAY[]::text[]),
  ('sales_executive',  ARRAY['CRM','Parking','Investor / Hold'], ARRAY['/booking','/consumers','/unit-status','/documents','/reports','/allotment','/unit-documents','/customer-folders']),
  ('accounts_finance', ARRAY['Reports','Broker'], ARRAY['/dashboard','/consumers','/consumer','/search-customer','/communications','/calling','/help','/tasks','/receipts','/demands','/demand-raise','/demand-status','/gst-invoicing','/booking-payment','/interest-scheduler','/installment-interest','/customer-wise-interest','/interest-waiver','/unit-status','/documents']),
  ('support_agent',    ARRAY[]::text[], ARRAY['/dashboard','/consumers','/consumer','/search-customer','/communications','/whatsapp-inbox','/facebook-inbox','/instagram-inbox','/email-templates','/tasks','/help','/documents','/unit-status']),
  ('read_only_viewer', ARRAY['Reports'], ARRAY['/dashboard','/consumers','/consumer','/search-customer','/unit-status','/documents','/help'])
) AS r(role_name, cats, routes)
  ON (n.category = ANY (r.cats) OR n.route = ANY (r.routes))
 AND NOT (r.role_name = 'project_manager' AND n.route = '/users')
WHERE n.is_active
  AND NOT EXISTS (SELECT 1 FROM public.role_page_access x WHERE x.role_name = r.role_name)
ON CONFLICT (role_name, page_id) DO NOTHING;
