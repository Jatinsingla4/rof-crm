-- DRY RUN ONLY. Changes nothing. Proposes demands.booking_id for review by finance (blueprint section 9, Wave 6).
-- A demand belongs to the booking of the same applicant and unit as its payment plan. When that match is exactly one booking the link is "single";
-- several bookings (e.g. one applicant who booked, cancelled and booked the same unit again) is "ambiguous" and must be decided by a person; none is "unlinked".
-- Run:  psql "$DB" -f backfill-demand-booking-DRYRUN.sql   (writes the review file to the current folder)
\set ON_ERROR_STOP on
BEGIN READ ONLY;
\echo Counts by verdict (nothing is written to the database):
WITH proposal AS (
  SELECT d.id AS demand_id, d.installment_index, d.status AS demand_status, d.booking_id AS current_booking_id, pp.consumer_id, pp.unit_id,
         (SELECT array_agg(br.id ORDER BY br.created_at) FROM booking_records br WHERE br.consumer_id = pp.consumer_id AND br.unit_id = pp.unit_id AND br.status <> 'cancelled') AS candidates
    FROM demands d JOIN payment_plans pp ON pp.id = d.payment_plan_id
), review AS (
  SELECT demand_id, installment_index, demand_status, consumer_id, unit_id,
         CASE WHEN current_booking_id IS NOT NULL THEN 'already_linked' WHEN cardinality(candidates) = 1 THEN 'single' WHEN cardinality(candidates) > 1 THEN 'ambiguous' ELSE 'unlinked' END AS verdict,
         CASE WHEN cardinality(candidates) = 1 THEN candidates[1] END AS proposed_booking_id, COALESCE(cardinality(candidates), 0) AS candidate_count
    FROM proposal
)
SELECT verdict, COUNT(*) FROM review GROUP BY verdict ORDER BY verdict;
\copy (WITH proposal AS (   SELECT d.id AS demand_id, d.installment_index, d.status AS demand_status, d.booking_id AS current_booking_id, pp.consumer_id, pp.unit_id,          (SELECT array_agg(br.id ORDER BY br.created_at) FROM booking_records br WHERE br.consumer_id = pp.consumer_id AND br.unit_id = pp.unit_id AND br.status <> 'cancelled') AS candidates     FROM demands d JOIN payment_plans pp ON pp.id = d.payment_plan_id ), review AS (   SELECT demand_id, installment_index, demand_status, consumer_id, unit_id,          CASE WHEN current_booking_id IS NOT NULL THEN 'already_linked' WHEN cardinality(candidates) = 1 THEN 'single' WHEN cardinality(candidates) > 1 THEN 'ambiguous' ELSE 'unlinked' END AS verdict,          CASE WHEN cardinality(candidates) = 1 THEN candidates[1] END AS proposed_booking_id, COALESCE(cardinality(candidates), 0) AS candidate_count     FROM proposal ) SELECT * FROM review ORDER BY verdict, consumer_id, installment_index) TO 'backfill-demand-booking-review.csv' CSV HEADER
ROLLBACK;
