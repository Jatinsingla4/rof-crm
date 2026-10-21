-- One active add-on charge per name in a project, and one active charge per master for a customer.
-- Created only when the data has no duplicates yet (otherwise a NOTICE says which; clean them up and run this again).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM addon_charge_master WHERE is_active GROUP BY project_id, lower(charge_name) HAVING count(*) > 1) THEN
    RAISE NOTICE 'uq_addon_master_active_name not created: duplicate active add-on charge names exist';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uq_addon_master_active_name ON addon_charge_master (project_id, lower(charge_name)) WHERE is_active;
  END IF;
  IF EXISTS (SELECT 1 FROM consumer_addon_charges WHERE status = 'active' AND charge_master_id IS NOT NULL GROUP BY consumer_id, project_id, charge_master_id HAVING count(*) > 1) THEN
    RAISE NOTICE 'uq_consumer_addon_active not created: a customer has the same active add-on charge twice';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uq_consumer_addon_active ON consumer_addon_charges (consumer_id, project_id, charge_master_id) WHERE status = 'active' AND charge_master_id IS NOT NULL;
  END IF;
END $$;
