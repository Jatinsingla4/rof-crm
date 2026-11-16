-- WRITES demands.booking_id, and nothing else, for the demands finance approved, where the booking is unambiguous. One transaction; it checks that no amount, status
-- or date of any demand moved and aborts if one did. Idempotent: a demand already linked is skipped.
-- Needs the file of approved demands (header demand_id) on STDIN and who approved:
--   psql "$DB" -v approved_by="Name" -v log_file=demand-booking-applied.csv -f 02-demand-booking-APPLY.sql < approved-demand-ids.csv
-- Take 00-checksums.sql before and after. Undo: 03-demand-booking-ROLLBACK.sql with the log file written here. Not for production without the owner's written approval.
\set ON_ERROR_STOP on
\if :{?approved_by}
\else
  \echo 'Refused: give who approved this run, -v approved_by="Name"'
  \quit
\endif
\if :{?log_file}
\else
  \set log_file demand-booking-applied.csv
\endif
BEGIN;
CREATE TEMP TABLE approved (demand_id uuid) ON COMMIT DROP;
\copy approved FROM pstdin CSV HEADER
SELECT md5(string_agg(id::text || ':' || amount_due_inr || ':' || cgst_amount || ':' || sgst_amount || ':' || addon_charge_amount || ':' || status || ':' || COALESCE(due_date::text,'') || ':' || COALESCE(raised_at::text,''), ',' ORDER BY id)) AS before_md5 FROM demands \gset
CREATE TEMP TABLE todo ON COMMIT DROP AS
  SELECT d.id AS demand_id, cand.booking_id, :'approved_by'::text AS approved_by, now() AS applied_at
    FROM approved a JOIN demands d ON d.id = a.demand_id JOIN payment_plans pp ON pp.id = d.payment_plan_id
    JOIN LATERAL (SELECT (array_agg(br.id))[1] AS booking_id, count(*) AS n FROM booking_records br WHERE br.consumer_id = pp.consumer_id AND br.unit_id = pp.unit_id AND br.status <> 'cancelled') cand ON cand.n = 1
   WHERE d.booking_id IS NULL;
\echo approved demands in the file, and how many of them are unambiguous and not yet linked:
SELECT (SELECT count(*) FROM approved) AS in_file, (SELECT count(*) FROM todo) AS will_link;
UPDATE demands d SET booking_id = t.booking_id FROM todo t WHERE d.id = t.demand_id AND d.booking_id IS NULL;
SELECT md5(string_agg(id::text || ':' || amount_due_inr || ':' || cgst_amount || ':' || sgst_amount || ':' || addon_charge_amount || ':' || status || ':' || COALESCE(due_date::text,'') || ':' || COALESCE(raised_at::text,''), ',' ORDER BY id)) AS after_md5 FROM demands \gset
SELECT (:'before_md5' = :'after_md5') AS money_unchanged \gset
\if :money_unchanged
  \pset format csv
  \o :log_file
  SELECT demand_id, booking_id, approved_by, applied_at FROM todo ORDER BY demand_id;
  \o
  \pset format aligned
  \echo 'linked; the log for the rollback is in' :log_file
  COMMIT;
\else
  \echo 'ABORTED: an amount, status or date of a demand changed. Nothing was written.'
  ROLLBACK;
\endif
