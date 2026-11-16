-- READ ONLY. Money checksums: run before and after any repair and diff the two outputs. Every line must be identical,
-- because no repair in this folder changes an amount, a status or a date; they only add links (demands.booking_id) or derived rows (booking_agreement, receipt_allocation).
--   psql "$DB" -qAt -f 00-checksums.sql > before.txt   ...repair...   psql "$DB" -qAt -f 00-checksums.sql > after.txt   diff before.txt after.txt
BEGIN READ ONLY;
SELECT 'demands rows|sum|status md5',  count(*) || '|' || COALESCE(sum(amount_due_inr + cgst_amount + sgst_amount + addon_charge_amount + addon_cgst_amount + addon_sgst_amount), 0) || '|' || md5(string_agg(id::text || ':' || status || ':' || COALESCE(due_date::text, '') || ':' || COALESCE(raised_at::text, ''), ',' ORDER BY id)) FROM demands;
SELECT 'receipts rows|sum|status md5',  count(*) || '|' || COALESCE(sum(amount_received_inr), 0) || '|' || md5(string_agg(id::text || ':' || status || ':' || COALESCE(cgst_amount, 0) || ':' || COALESCE(sgst_amount, 0), ',' ORDER BY id)) FROM receipts;
SELECT 'receipt_returns rows|sum',      count(*) || '|' || COALESCE(sum(amount), 0) FROM receipt_returns;
SELECT 'payment_plans rows|sum',        count(*) || '|' || COALESCE(sum(total_amount_inr), 0) FROM payment_plans;
SELECT 'booking_records rows|sum|status md5', count(*) || '|' || COALESCE(sum(total_price_inr), 0) || '|' || md5(string_agg(id::text || ':' || status || ':' || COALESCE(basic_rate_inr_sqft, 0), ',' ORDER BY id)) FROM booking_records;
SELECT 'gst_invoices rows|sum',         count(*) || '|' || COALESCE(sum(total_amount_inr), 0) FROM gst_invoices;
SELECT 'credit_debit_notes rows|sum',   count(*) || '|' || COALESCE(sum(total_amount), 0) FROM credit_debit_notes;
SELECT 'broker_commissions rows|sum',   count(*) || '|' || COALESCE(sum(commission_amount_inr), 0) || '|' || COALESCE(sum(net_amount_inr), 0) FROM broker_commissions;
SELECT 'credit_allocations rows|sum',   count(*) || '|' || COALESCE(sum(amount), 0) FROM credit_allocations;
-- not money: the derived tables the repairs fill (these are expected to change)
SELECT 'info: demands with booking_id', count(*) FROM demands WHERE booking_id IS NOT NULL;
SELECT 'info: booking_agreement rows',  count(*) FROM booking_agreement;
SELECT 'info: receipt_allocation rows', count(*) FROM receipt_allocation;
ROLLBACK;
