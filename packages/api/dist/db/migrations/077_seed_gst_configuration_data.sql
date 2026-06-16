-- ============================================
-- Migration 077: Seed GST Configuration Data
-- Seeds financial years, HSN/SAC codes,
-- GST slabs and tax setup with standard data.
-- Fully idempotent — INSERT ... WHERE NOT EXISTS
-- ============================================

-- FINANCIAL YEARS (2017-18 through 2025-26)
INSERT INTO financial_years
  (name, from_date, to_date, is_active)
SELECT name, from_date::date,
       to_date::date, is_active
FROM (VALUES
  ('2017-18',   '2017-04-01', '2018-03-31', false),
  ('2018-2019', '2018-04-01', '2019-03-31', false),
  ('2019-2020', '2019-04-01', '2020-03-31', false),
  ('2020-2021', '2020-04-01', '2021-03-31', false),
  ('2021-22',   '2021-04-01', '2022-03-31', false),
  ('2022-23',   '2022-04-01', '2023-03-31', false),
  ('2023-24',   '2023-04-01', '2024-03-31', false),
  ('2024-25',   '2024-04-01', '2025-03-31', false),
  ('2025-26',   '2025-04-01', '2026-03-31', true)
) AS v(name, from_date, to_date, is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM financial_years fy
  WHERE fy.name = v.name
);

-- HSN/SAC CODES (from legacy CRM screenshots)
INSERT INTO hsn_sac_codes (code, type)
SELECT code, type FROM (VALUES
  ('995411', 'Service'),
  ('995419', 'Service'),
  ('999723', 'Service'),
  ('995414', 'Service')
) AS v(code, type)
WHERE NOT EXISTS (
  SELECT 1 FROM hsn_sac_codes h
  WHERE h.code = v.code
);

-- GST SLAB (01 Apr 2019 — 31 Mar 2024)
INSERT INTO gst_slabs (from_date, to_date)
SELECT '2019-04-01'::date, '2024-03-31'::date
WHERE NOT EXISTS (
  SELECT 1 FROM gst_slabs
  WHERE from_date = '2019-04-01'
  AND to_date = '2024-03-31'
);

-- GST TAX SETUP
-- 5 standard INTRA rates for the slab above
-- (matching legacy CRM: 0%, 1%, 5%, 12%, 18%)
INSERT INTO gst_tax_setup
  (slab_id, gst_code, type,
   cgst_pct, sgst_pct, utgst_pct, igst_pct)
SELECT
  gs.id,
  rates.gst_code,
  'INTRA',
  rates.cgst_pct,
  rates.sgst_pct,
  0,
  0
FROM gst_slabs gs
CROSS JOIN (VALUES
  ('0%_Apr_2019',  0.000, 0.000),
  ('1%_Apr_2019',  0.500, 0.500),
  ('5%_Apr_2019',  2.500, 2.500),
  ('12%_Apr_2019', 6.000, 6.000),
  ('18%_Apr_2019', 9.000, 9.000)
) AS rates(gst_code, cgst_pct, sgst_pct)
WHERE gs.from_date = '2019-04-01'
AND gs.to_date = '2024-03-31'
AND NOT EXISTS (
  SELECT 1 FROM gst_tax_setup gts
  WHERE gts.slab_id = gs.id
  AND gts.gst_code = rates.gst_code
);
