-- Migration 147: a unit can have only one live allocation (booked, allotted or agreement signed) at a time.
-- Migration 072 dropped the old unique rule on (unit_id, status) because a unit is transferred many times and keeps one history row per owner.
-- That left nothing in the database to stop two applicants holding the same unit; the booking code locks the unit row, but the database should refuse it too.
-- Only the live statuses are limited, so cancelled and transferred history rows are unaffected.
-- Safe to run twice, and safe on data that already has a duplicate: then the index is skipped with a notice and the duplicates are listed for review.
DO $$
DECLARE dup integer;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uq_allocations_one_live_per_unit') THEN RETURN; END IF;
  SELECT COUNT(*) INTO dup FROM (
    SELECT unit_id FROM allocations WHERE status IN ('booked', 'allotted', 'agreement_signed') GROUP BY unit_id HAVING COUNT(*) > 1
  ) d;
  IF dup > 0 THEN
    RAISE NOTICE 'Migration 147 skipped: % unit(s) already have more than one live allocation. Review them, then run this file again.', dup;
  ELSE
    CREATE UNIQUE INDEX uq_allocations_one_live_per_unit ON allocations (unit_id) WHERE status IN ('booked', 'allotted', 'agreement_signed');
  END IF;
END $$;
