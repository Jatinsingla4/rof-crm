-- READ-ONLY. Lists the existing records behind the findings of the 17 November 2026 browser QA, for finance to review. It changes nothing.
-- Run on a copy or on production with a read-only login:   psql -v ON_ERROR_STOP=1 -f 06-qa17-exceptions.sql
-- Each block is one finding. An empty block is a clean result. Nothing here is corrected automatically: every row needs a finance decision first.

\echo '== QA-002: a live GST invoice whose receipt is cancelled or bounced (a credit note or reversal is for a checker to issue)'
SELECT gi.invoice_no, gi.status AS invoice_status, gi.total_amount_inr, r.receipt_number, r.status AS receipt_status, gi.invoice_date
  FROM gst_invoices gi JOIN receipts r ON r.id = gi.receipt_id
 WHERE gi.status <> 'cancelled' AND r.status IN ('cancelled', 'bounced')
 ORDER BY gi.invoice_date;

\echo '== QA-031: a live GST invoice on a receipt that has not cleared'
SELECT gi.invoice_no, gi.total_amount_inr, r.receipt_number, r.status AS receipt_status, r.amount_received_inr
  FROM gst_invoices gi JOIN receipts r ON r.id = gi.receipt_id
 WHERE gi.status <> 'cancelled' AND r.status NOT IN ('cleared', 'cancelled', 'bounced')
 ORDER BY gi.invoice_date;

\echo '== QA-004: invoices that tax more than the receipt behind them, and invoices with no receipt at all'
SELECT gi.invoice_no, gi.status, gi.total_amount_inr, gi.taxable_amount_inr, r.amount_received_inr,
       CASE WHEN gi.receipt_id IS NULL THEN 'no receipt' ELSE 'more than the receipt' END AS issue
  FROM gst_invoices gi LEFT JOIN receipts r ON r.id = gi.receipt_id
 WHERE gi.status <> 'cancelled' AND (gi.receipt_id IS NULL OR gi.taxable_amount_inr > r.amount_received_inr)
 ORDER BY gi.invoice_date;

\echo '== QA-009: a commission marked paid on a booking with no cleared receipt'
SELECT bc.id, bc.status, bc.commission_amount_inr, bc.paid_at, c.registration_no, c.name
  FROM broker_commissions bc JOIN consumers c ON c.id = bc.consumer_id
 WHERE bc.status = 'paid'
   AND NOT EXISTS (SELECT 1 FROM receipts r WHERE r.consumer_id = bc.consumer_id AND r.status = 'cleared')
 ORDER BY bc.paid_at;

\echo '== QA-017: a unit that has a live booking but is still marked Available'
SELECT u.unit_number, u.status AS unit_status, br.status AS booking_status, c.registration_no, c.name
  FROM booking_records br JOIN units u ON u.id = br.unit_id JOIN consumers c ON c.id = br.consumer_id
 WHERE br.status IN ('complete', 'pending_payment', 'active') AND u.status::text = 'available'
 ORDER BY u.unit_number;

\echo '== QA-017: a live booking with rate 0 or with no GST on a priced unit'
SELECT br.id, c.registration_no, c.name, u.unit_number, br.basic_rate_inr_sqft AS rate,
       COALESCE(bpt.cgst_amount, 0) + COALESCE(bpt.sgst_amount, 0) AS booking_gst,
       CASE WHEN COALESCE(br.basic_rate_inr_sqft, 0) = 0 THEN 'rate 0' ELSE 'no GST' END AS issue
  FROM booking_records br JOIN consumers c ON c.id = br.consumer_id JOIN units u ON u.id = br.unit_id
  LEFT JOIN LATERAL (SELECT cgst_amount, sgst_amount FROM booking_payment_taxes WHERE booking_record_id = br.id ORDER BY created_at DESC LIMIT 1) bpt ON TRUE
 WHERE br.status IN ('complete', 'pending_payment', 'active')
   AND (COALESCE(br.basic_rate_inr_sqft, 0) = 0 OR COALESCE(bpt.cgst_amount, 0) + COALESCE(bpt.sgst_amount, 0) = 0)
 ORDER BY c.registration_no;

\echo '== QA-012: a cancelled booking that still has raised demands, an unpaid balance or receipts waiting for approval'
SELECT br.id AS booking_id, c.registration_no, c.name, br.status AS booking_status,
       (SELECT COUNT(*) FROM demands d JOIN payment_plans pp ON pp.id = d.payment_plan_id
         WHERE pp.consumer_id = br.consumer_id AND pp.unit_id = br.unit_id AND d.status <> 'cancelled') AS live_demands,
       (SELECT COUNT(*) FROM receipts r WHERE r.consumer_id = br.consumer_id AND r.status IN ('pending', 'authorized', 'deposited', 'on_hold')) AS receipts_not_cleared
  FROM booking_records br JOIN consumers c ON c.id = br.consumer_id
 WHERE br.status = 'cancelled'
   AND (EXISTS (SELECT 1 FROM demands d JOIN payment_plans pp ON pp.id = d.payment_plan_id
                 WHERE pp.consumer_id = br.consumer_id AND pp.unit_id = br.unit_id AND d.status <> 'cancelled')
        OR EXISTS (SELECT 1 FROM receipts r WHERE r.consumer_id = br.consumer_id AND r.status IN ('pending', 'authorized', 'deposited', 'on_hold')))
 ORDER BY c.registration_no;

\echo '== QA-024: the same registration number on more than one customer'
SELECT registration_no, COUNT(*) AS customers, string_agg(name, ', ') AS names
  FROM consumers WHERE registration_no IS NOT NULL AND registration_no <> ''
 GROUP BY registration_no HAVING COUNT(*) > 1 ORDER BY registration_no;

\echo '== QA-018: cash receipts of 2,00,000 or more (the cash limit is a policy for finance to set)'
SELECT r.receipt_number, r.amount_received_inr, r.status, r.received_date
  FROM receipts r WHERE r.payment_method = 'cash' AND r.amount_received_inr >= 200000 AND r.status <> 'cancelled'
 ORDER BY r.received_date;
