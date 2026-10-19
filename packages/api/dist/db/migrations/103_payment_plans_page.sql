-- Payment Plans is a page of its own now (before: tabs inside Set Projects).
-- Roles that may open Set Projects may open it. Safe to run again.
INSERT INTO public.nav_pages (route, label, category, sort_order, is_active)
SELECT '/payment-plans', 'Payment Plans', 'Set Projects', 2, TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.nav_pages WHERE route = '/payment-plans');

INSERT INTO public.role_page_access (role_name, page_id, can_view)
SELECT x.role_name, (SELECT id FROM public.nav_pages WHERE route = '/payment-plans'), TRUE
FROM public.role_page_access x JOIN public.nav_pages n ON n.id = x.page_id AND n.route = '/set-projects'
WHERE x.can_view
ON CONFLICT (role_name, page_id) DO NOTHING;

-- Two rows of one plan cannot share a name or an order number (the app checks this too; the index stops two requests at once).
-- An index is created only when the table has no such duplicates yet (old data), so a deploy can never fail on it.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.plan_schedule_templates GROUP BY project_id, lower(plan_name), installment_index HAVING COUNT(*) > 1) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_plan_row_order ON public.plan_schedule_templates (project_id, lower(plan_name), installment_index);
  ELSE
    RAISE NOTICE 'Skipped uq_plan_row_order: some plans already repeat an order number';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.plan_schedule_templates GROUP BY project_id, lower(plan_name), lower(installment_name) HAVING COUNT(*) > 1) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_plan_row_name ON public.plan_schedule_templates (project_id, lower(plan_name), lower(installment_name));
  ELSE
    RAISE NOTICE 'Skipped uq_plan_row_name: some plans already repeat a row name';
  END IF;
END $$;

