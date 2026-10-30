-- Until now a charge with a % in a payment plan was put on every booking of that plan. Charges now go on a booking when they are Mandatory or attached to the unit,
-- so the charges that already work the old way are marked Mandatory and keep behaving as before. Safe to repeat: it only marks, it never clears.
UPDATE addon_charge_master SET is_mandatory = true WHERE NOT is_mandatory AND is_active AND id IN (SELECT charge_master_id FROM plan_addon_charge_pct);
