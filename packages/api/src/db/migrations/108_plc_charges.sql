-- Preferred Location Charges (PLC): a rate per unit location (Set Projects, Charge Master, PLC), and the location of each unit.
-- Booking offers the amount worked out from these instead of a guess. Safe to run again.
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS unit_location_id UUID REFERENCES public.unit_locations(id);
CREATE INDEX IF NOT EXISTS idx_units_unit_location ON public.units(unit_location_id);

CREATE TABLE IF NOT EXISTS public.plc_charges (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  unit_location_id UUID NOT NULL REFERENCES public.unit_locations(id),
  rate_type        VARCHAR(20) NOT NULL DEFAULT 'per_sqft' CHECK (rate_type IN ('flat', 'per_sqft')),
  rate_value       NUMERIC(12,2) NOT NULL CHECK (rate_value > 0),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       UUID REFERENCES public.users(id),
  CONSTRAINT uq_plc_location UNIQUE (unit_location_id)
);
CREATE INDEX IF NOT EXISTS idx_plc_charges_project ON public.plc_charges(project_id);

INSERT INTO public.nav_pages (route, label, category, sort_order, is_active)
SELECT '/plc-charges', 'Preferred Location Charges', 'Set Projects', 3, TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.nav_pages WHERE route = '/plc-charges');

INSERT INTO public.role_page_access (role_name, page_id, can_view)
SELECT x.role_name, (SELECT id FROM public.nav_pages WHERE route = '/plc-charges'), TRUE
FROM public.role_page_access x JOIN public.nav_pages n ON n.id = x.page_id AND n.route = '/set-projects'
WHERE x.can_view
ON CONFLICT (role_name, page_id) DO NOTHING;

-- Logins limited to some projects only see the rates of their projects
SELECT rof_apply_project_scope();
