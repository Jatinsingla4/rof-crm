-- Customized Letters: a register of every letter produced (reference number, applicant, who, when),
-- and the Customized Letters screen on the page list.
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.custom_letter_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id    uuid REFERENCES public.document_templates(id) ON DELETE SET NULL,
  template_name  varchar(150) NOT NULL,          -- kept even if the template is renamed or deleted later
  consumer_id    uuid NOT NULL REFERENCES public.consumers(id),
  project_id     uuid REFERENCES public.projects(id),
  subject        varchar(255),
  ref_no         varchar(100),
  ref_prefix     varchar(30),                    -- the number series: PREFIX/year/running number
  ref_seq        integer,                        -- running number behind ref_no; null for a duplicate copy
  financial_year varchar(7),                     -- e.g. 2026-27
  is_duplicate   boolean NOT NULL DEFAULT false,
  generated_by   uuid REFERENCES public.users(id),
  generated_at   timestamptz NOT NULL DEFAULT now()
);

-- A number is never given twice in a series (same prefix, same financial year), even by two templates that share a prefix
CREATE UNIQUE INDEX IF NOT EXISTS uq_custom_letter_ref ON public.custom_letter_log (ref_prefix, financial_year, ref_seq) WHERE ref_seq IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_custom_letter_log_consumer ON public.custom_letter_log (consumer_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_custom_letter_log_when ON public.custom_letter_log (generated_at DESC);

-- Letter names are unique within a project, ignoring letter case
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uq_custom_letter_name_ci') THEN
    IF EXISTS (SELECT 1 FROM public.document_templates WHERE document_type = 'custom_letter'
               GROUP BY project_id, lower(name) HAVING count(*) > 1) THEN
      RAISE NOTICE 'Skipped uq_custom_letter_name_ci: two letters of one project share a name. Rename one, then run this migration again.';
    ELSE
      CREATE UNIQUE INDEX uq_custom_letter_name_ci ON public.document_templates (project_id, lower(name)) WHERE document_type = 'custom_letter';
    END IF;
  END IF;
END $$;

-- The screen is a page of its own now. Roles that already open Documents may open it.
INSERT INTO public.nav_pages (route, label, category, sort_order, is_active)
SELECT '/custom-letters', 'Customized Letters', 'Application', 31, TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.nav_pages WHERE route = '/custom-letters');

INSERT INTO public.role_page_access (role_name, page_id, can_view)
SELECT x.role_name, (SELECT id FROM public.nav_pages WHERE route = '/custom-letters'), TRUE
FROM public.role_page_access x JOIN public.nav_pages n ON n.id = x.page_id AND n.route = '/documents'
WHERE x.can_view
  AND NOT EXISTS (SELECT 1 FROM public.role_page_access y
                  WHERE y.role_name = x.role_name AND y.page_id = (SELECT id FROM public.nav_pages WHERE route = '/custom-letters'))
ON CONFLICT (role_name, page_id) DO NOTHING;

SELECT public.rof_apply_project_scope();
GRANT ALL ON public.custom_letter_log TO rof_app;
