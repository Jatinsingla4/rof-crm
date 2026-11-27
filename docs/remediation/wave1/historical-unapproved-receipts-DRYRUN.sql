-- READ ONLY. QA-036: cleared receipts that no checker approved (the register reports 12 worth Rs 30,54,936).
-- Run on a copy or read replica first. Nothing here changes data. Repair (approve, reverse or cancel) needs ROF finance approval, one receipt at a time.
SELECT r.id, r.receipt_number, r.consumer_id, c.name AS consumer, r.amount_received_inr, r.received_date, r.clearing_date,
       r.approval_status, r.authorized_by, r.received_by_user_id,
       (SELECT COALESCE(SUM(x.amount),0) FROM receipt_returns x WHERE x.receipt_id = r.id AND x.status = 'approved') AS returned,
       EXISTS (SELECT 1 FROM gst_invoices gi WHERE gi.receipt_id = r.id AND gi.status <> 'cancelled') AS has_live_invoice
  FROM receipts r LEFT JOIN consumers c ON c.id = r.consumer_id
 WHERE r.status = 'cleared' AND r.approval_status IS DISTINCT FROM 'approved'
 ORDER BY r.clearing_date, r.receipt_number;

SELECT COUNT(*) AS receipts, SUM(amount_received_inr) AS total_inr
  FROM receipts WHERE status = 'cleared' AND approval_status IS DISTINCT FROM 'approved';
