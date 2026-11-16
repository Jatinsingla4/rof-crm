-- Undoes 02: clears demands.booking_id for exactly the demands in the log file that 02 wrote, and only where the link is still the one that was written.
--   psql "$DB" -f 03-demand-booking-ROLLBACK.sql < demand-booking-applied.csv
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE logged (demand_id uuid, booking_id uuid, approved_by text, applied_at timestamptz) ON COMMIT DROP;
\copy logged FROM pstdin CSV HEADER
WITH r AS (UPDATE demands d SET booking_id = NULL FROM logged l WHERE d.id = l.demand_id AND d.booking_id = l.booking_id RETURNING d.id)
SELECT (SELECT count(*) FROM logged) AS in_log, (SELECT count(*) FROM r) AS cleared;
COMMIT;
