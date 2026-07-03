-- Prevent 2+ active (non-cancelled) bookings
-- on the same unit at the DB level.
-- 'pending_payment', 'active', and 'complete' all count
-- as active. 'cancelled' excluded so surrender
-- → re-book continues to work.
CREATE UNIQUE INDEX IF NOT EXISTS
  uq_booking_records_active_unit
ON booking_records(unit_id)
WHERE status IN ('pending_payment', 'active', 'complete');
