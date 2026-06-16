-- Migration 074: Seed common addon charges
-- for all existing projects.
-- Idempotent — uses INSERT ... ON CONFLICT DO NOTHING

-- For each project, insert standard charges
-- if they don't already exist.

INSERT INTO addon_charge_master
  (project_id, charge_name, default_amount,
   cgst_pct, sgst_pct, is_active)
SELECT
  p.id,
  charges.charge_name,
  charges.default_amount,
  9.0000,
  9.0000,
  true
FROM projects p
CROSS JOIN (VALUES
  ('Cheque Bounce Charge', 0),
  ('External Electrification Charge @18%', 0),
  ('Electric Meter Charge @18%', 0),
  ('BOCW @18%', 0),
  ('Admin Charges @18%', 0),
  ('Restoration Charge', 0),
  ('Transfer Charges', 0),
  ('Documentation Charges', 0),
  ('IFMS Charges @18%', 0)
) AS charges(charge_name, default_amount)
WHERE NOT EXISTS (
  SELECT 1 FROM addon_charge_master acm
  WHERE acm.project_id = p.id
  AND acm.charge_name = charges.charge_name
);
