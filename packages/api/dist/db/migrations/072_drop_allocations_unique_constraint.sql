-- Migration 072: Drop unique constraint on allocations(unit_id, status)
-- A unit can be transferred multiple times — each transfer creates
-- a new 'transferred' row for the old owner. The unique constraint
-- on (unit_id, status) blocks second and subsequent transfers.
-- Dropping it allows full transfer history to be preserved.

-- Idempotent: only drop if constraint exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'allocations'
    AND constraint_name = 'allocations_unit_id_status_key'
  ) THEN
    ALTER TABLE allocations
      DROP CONSTRAINT allocations_unit_id_status_key;
  END IF;
END $$;
