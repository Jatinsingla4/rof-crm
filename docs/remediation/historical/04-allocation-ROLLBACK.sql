-- Undoes the allocation backfill: receipt_allocation holds only derived rows (nothing reads them while receipt_allocation_v1 is off), so they are simply cleared.
-- It does not touch the flag. Needs -v confirm=yes.   psql "$DB" -v confirm=yes -f 04-allocation-ROLLBACK.sql
\set ON_ERROR_STOP on
\if :{?confirm}
  BEGIN;
  SELECT count(*) AS rows_before FROM receipt_allocation;
  DELETE FROM receipt_allocation;
  COMMIT;
\else
  \echo 'Refused: add -v confirm=yes'
\endif
