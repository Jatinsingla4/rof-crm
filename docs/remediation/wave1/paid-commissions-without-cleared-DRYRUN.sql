-- READ ONLY. QA-009: broker commissions already marked Paid whose booking is not backed by cleared money
-- (the register reports 3 such records, Rs 2,44,274.16). Run on a copy or read replica first. Nothing here changes data.
-- "Backed" = cleared, non-advance receipts of the applicant (approved returns taken off) add up to at least the booking amount: the same test the payout gate,
-- the commission list (cleared_basis_ok) and the reconciliation list use (money-basis.ts commissionBackedSql).
-- A paid commission is NEVER changed by the software. What to do with each row (recover, regularise after the receipt clears, or accept) is a finance decision.
SELECT bc.id, b.name AS broker, c.name AS applicant, c.registration_no, bk.status AS booking_status, bk.booking_amount,
       bc.commission_amount_inr, bc.gst_amount, bc.tds_amount, bc.net_amount_inr, bc.paid_at, bc.paid_by,
       COALESCE((SELECT SUM(r.amount_received_inr - COALESCE((SELECT SUM(x.amount) FROM receipt_returns x WHERE x.receipt_id = r.id AND x.status = 'approved'), 0))
                   FROM receipts r WHERE r.consumer_id = bc.consumer_id AND r.status = 'cleared' AND r.is_advance IS NOT TRUE), 0) AS cleared_money_inr,
       (SELECT COUNT(*) FROM receipts r WHERE r.consumer_id = bc.consumer_id AND r.status = 'cleared' AND r.approval_status IS DISTINCT FROM 'approved') AS cleared_but_unapproved_receipts,
       (SELECT COUNT(*) FROM receipts r WHERE r.consumer_id = bc.consumer_id AND r.status IN ('pending','authorized','deposited','on_hold')) AS receipts_still_in_progress
  FROM broker_commissions bc
  LEFT JOIN brokers b ON b.id = bc.broker_id
  LEFT JOIN consumers c ON c.id = bc.consumer_id
  LEFT JOIN booking_records bk ON bk.id = bc.booking_id
 WHERE bc.status = 'paid'
   AND NOT (COALESCE((SELECT SUM(r.amount_received_inr - COALESCE((SELECT SUM(x.amount) FROM receipt_returns x WHERE x.receipt_id = r.id AND x.status = 'approved'), 0))
                        FROM receipts r WHERE r.consumer_id = bc.consumer_id AND r.status = 'cleared' AND r.is_advance IS NOT TRUE), 0) + 0.005
            >= GREATEST(COALESCE(bk.booking_amount, 0), 0.01))
 ORDER BY bc.paid_at;

SELECT COUNT(*) AS paid_without_cleared_backing, COALESCE(SUM(bc.commission_amount_inr), 0) AS commission_total, COALESCE(SUM(bc.net_amount_inr), 0) AS net_total
  FROM broker_commissions bc LEFT JOIN booking_records bk ON bk.id = bc.booking_id
 WHERE bc.status = 'paid'
   AND NOT (COALESCE((SELECT SUM(r.amount_received_inr - COALESCE((SELECT SUM(x.amount) FROM receipt_returns x WHERE x.receipt_id = r.id AND x.status = 'approved'), 0))
                        FROM receipts r WHERE r.consumer_id = bc.consumer_id AND r.status = 'cleared' AND r.is_advance IS NOT TRUE), 0) + 0.005
            >= GREATEST(COALESCE(bk.booking_amount, 0), 0.01));

-- Current value of the gate (a missing row means off). Only finance switches it, after the checks above are reviewed.
SELECT key, value FROM global_settings WHERE key = 'commission_requires_cleared_v1';
