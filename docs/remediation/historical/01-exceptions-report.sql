-- READ ONLY. The finance-reviewable exception report: every record the money rules say is wrong or ambiguous, one CSV per kind, plus counts.
-- Nothing is changed or deleted. Run:  psql "$DB" -v ON_ERROR_STOP=1 -f 01-exceptions-report.sql   (writes the CSVs to the current folder)
-- The cases that need the application's own money rules (paid demand with a balance, quote differing from the plan) are in GET /booking/reconciliation
-- and GET /booking/agreement-shadow (finance users); the allocation rules are in ../allocation-invariants.sql.
\set ON_ERROR_STOP on
BEGIN READ ONLY;

\echo === counts per exception kind ===
SELECT kind, n FROM (
  SELECT 'demand_booking_single' AS kind, count(*) AS n FROM demands d JOIN payment_plans pp ON pp.id = d.payment_plan_id WHERE d.booking_id IS NULL AND (SELECT count(*) FROM booking_records br WHERE br.consumer_id = pp.consumer_id AND br.unit_id = pp.unit_id AND br.status <> 'cancelled') = 1
  UNION ALL SELECT 'demand_booking_ambiguous', count(*) FROM demands d JOIN payment_plans pp ON pp.id = d.payment_plan_id WHERE d.booking_id IS NULL AND (SELECT count(*) FROM booking_records br WHERE br.consumer_id = pp.consumer_id AND br.unit_id = pp.unit_id AND br.status <> 'cancelled') > 1
  UNION ALL SELECT 'demand_booking_unlinked', count(*) FROM demands d JOIN payment_plans pp ON pp.id = d.payment_plan_id WHERE d.booking_id IS NULL AND (SELECT count(*) FROM booking_records br WHERE br.consumer_id = pp.consumer_id AND br.unit_id = pp.unit_id AND br.status <> 'cancelled') = 0
  UNION ALL SELECT 'live_booking_no_rate_or_area', count(*) FROM booking_records br JOIN units u ON u.id = br.unit_id WHERE br.status IN ('pending_payment','active','complete') AND (COALESCE(br.basic_rate_inr_sqft,0) <= 0 OR COALESCE(u.carpet_area_sqft,0) <= 0)
  UNION ALL SELECT 'live_booking_no_snapshot', count(*) FROM booking_records br WHERE br.status IN ('pending_payment','active','complete') AND NOT EXISTS (SELECT 1 FROM booking_agreement ba WHERE ba.booking_id = br.id AND ba.is_current)
  UNION ALL SELECT 'plan_total_differs_from_demands', count(*) FROM (SELECT pp.id FROM payment_plans pp JOIN demands d ON d.payment_plan_id = pp.id WHERE d.status <> 'cancelled' GROUP BY pp.id, pp.total_amount_inr HAVING abs(sum(d.amount_due_inr + d.addon_charge_amount) - pp.total_amount_inr) > 1) x
  UNION ALL SELECT 'cleared_receipt_without_authoriser', count(*) FROM receipts WHERE status = 'cleared' AND authorized_by IS NULL
  UNION ALL SELECT 'receipt_consumer_differs_from_plan', count(*) FROM receipts r JOIN payment_plans pp ON pp.id = r.payment_plan_id WHERE r.consumer_id <> pp.consumer_id
  UNION ALL SELECT 'cleared_receipt_without_plan', count(*) FROM receipts WHERE status = 'cleared' AND is_advance IS NOT TRUE AND payment_plan_id IS NULL
  UNION ALL SELECT 'live_invoice_charging_more_than_the_receipt', count(*) FROM gst_invoices gi JOIN receipts r ON r.id = gi.receipt_id
        WHERE gi.status <> 'cancelled' AND (r.status IN ('cancelled','bounced') OR gi.total_amount_inr > r.amount_received_inr - COALESCE((SELECT SUM(x.amount) FROM receipt_returns x WHERE x.receipt_id = r.id AND x.status = 'approved'),0) + 0.01)
  UNION ALL SELECT 'commission_paid_without_cleared_receipt', count(*) FROM broker_commissions bc WHERE bc.status = 'paid' AND NOT EXISTS (SELECT 1 FROM receipts r WHERE r.consumer_id = bc.consumer_id AND r.status = 'cleared')
  UNION ALL SELECT 'consumer_with_several_live_bookings', count(*) FROM (SELECT consumer_id FROM booking_records WHERE status IN ('pending_payment','active','complete') GROUP BY consumer_id HAVING count(*) > 1) x
  UNION ALL SELECT 'duplicate_receipt_reference', count(*) FROM (SELECT transaction_ref FROM receipts WHERE status <> 'cancelled' AND COALESCE(transaction_ref,'') <> '' GROUP BY transaction_ref, payment_method HAVING count(*) > 1) x
) k ORDER BY kind;

\echo === writing the CSV files ===
\copy (SELECT d.id AS demand_id, d.installment_index, d.status, pp.consumer_id, pp.unit_id, (SELECT string_agg(br.id::text, ' ' ORDER BY br.created_at) FROM booking_records br WHERE br.consumer_id = pp.consumer_id AND br.unit_id = pp.unit_id AND br.status <> 'cancelled') AS candidate_bookings FROM demands d JOIN payment_plans pp ON pp.id = d.payment_plan_id WHERE d.booking_id IS NULL ORDER BY pp.consumer_id, d.installment_index) TO 'exc-demand-booking.csv' CSV HEADER
\copy (SELECT br.id AS booking_id, br.registration_no, br.status, br.basic_rate_inr_sqft AS rate, u.carpet_area_sqft AS carpet FROM booking_records br JOIN units u ON u.id = br.unit_id WHERE br.status IN ('pending_payment','active','complete') AND (COALESCE(br.basic_rate_inr_sqft,0) <= 0 OR COALESCE(u.carpet_area_sqft,0) <= 0)) TO 'exc-booking-no-rate-or-area.csv' CSV HEADER
\copy (SELECT pp.id AS plan_id, pp.consumer_id, pp.total_amount_inr AS plan_total, sum(d.amount_due_inr + d.addon_charge_amount) AS demands_total FROM payment_plans pp JOIN demands d ON d.payment_plan_id = pp.id WHERE d.status <> 'cancelled' GROUP BY pp.id, pp.consumer_id, pp.total_amount_inr HAVING abs(sum(d.amount_due_inr + d.addon_charge_amount) - pp.total_amount_inr) > 1) TO 'exc-plan-vs-demands.csv' CSV HEADER
\copy (SELECT r.id AS receipt_id, r.receipt_number, r.status, r.amount_received_inr, r.consumer_id, r.payment_plan_id, r.authorized_by IS NULL AS no_authoriser, r.payment_plan_id IS NULL AS no_plan, pp.consumer_id <> r.consumer_id AS plan_of_another_applicant FROM receipts r LEFT JOIN payment_plans pp ON pp.id = r.payment_plan_id WHERE (r.status = 'cleared' AND r.authorized_by IS NULL) OR (r.status = 'cleared' AND r.is_advance IS NOT TRUE AND r.payment_plan_id IS NULL) OR pp.consumer_id <> r.consumer_id) TO 'exc-receipts.csv' CSV HEADER
\copy (SELECT gi.id AS invoice_id, gi.invoice_no, gi.total_amount_inr, r.id AS receipt_id, r.status AS receipt_status, r.amount_received_inr FROM gst_invoices gi JOIN receipts r ON r.id = gi.receipt_id WHERE gi.status <> 'cancelled' AND (r.status IN ('cancelled','bounced') OR gi.total_amount_inr > r.amount_received_inr - COALESCE((SELECT SUM(x.amount) FROM receipt_returns x WHERE x.receipt_id = r.id AND x.status = 'approved'),0) + 0.01)) TO 'exc-invoices.csv' CSV HEADER
\copy (SELECT bc.id AS commission_id, bc.broker_id, bc.consumer_id, bc.commission_amount_inr, bc.net_amount_inr, bc.paid_at FROM broker_commissions bc WHERE bc.status = 'paid' AND NOT EXISTS (SELECT 1 FROM receipts r WHERE r.consumer_id = bc.consumer_id AND r.status = 'cleared')) TO 'exc-commissions.csv' CSV HEADER
\copy (SELECT consumer_id, count(*) AS live_bookings, string_agg(id::text, ' ') AS booking_ids FROM booking_records WHERE status IN ('pending_payment','active','complete') GROUP BY consumer_id HAVING count(*) > 1) TO 'exc-several-live-bookings.csv' CSV HEADER
ROLLBACK;
