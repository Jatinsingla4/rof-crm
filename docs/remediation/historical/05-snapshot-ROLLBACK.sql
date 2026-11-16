-- Undoes the snapshot backfill. booking_agreement rows are immutable (a trigger refuses delete), so this is for the DATABASE OWNER only: it switches that trigger off
-- inside one transaction, deletes ONLY the rows the backfill wrote (reason 'historical backfill (Phase 7)', version 1, no creator, no later version), and switches it on again.
-- Needs -v confirm=yes.   psql "$DB" -v confirm=yes -f 05-snapshot-ROLLBACK.sql
\set ON_ERROR_STOP on
\if :{?confirm}
  BEGIN;
  ALTER TABLE booking_agreement DISABLE TRIGGER booking_agreement_immutable;
  WITH gone AS (DELETE FROM booking_agreement ba WHERE ba.reason = 'historical backfill (Phase 7)' AND ba.version = 1 AND ba.created_by IS NULL
                  AND NOT EXISTS (SELECT 1 FROM booking_agreement n WHERE n.booking_id = ba.booking_id AND n.version > 1) RETURNING 1)
  SELECT count(*) AS snapshots_removed FROM gone;
  ALTER TABLE booking_agreement ENABLE TRIGGER booking_agreement_immutable;
  COMMIT;
\else
  \echo 'Refused: add -v confirm=yes'
\endif
