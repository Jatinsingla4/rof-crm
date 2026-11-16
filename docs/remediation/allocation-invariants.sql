-- Receipt allocation invariants (Phase 3). READ ONLY. Every query lists the rows that BREAK a rule; an empty result means the rule holds.
-- Run:  psql -v ON_ERROR_STOP=1 -f allocation-invariants.sql   (works on a test database; on production only finance/DBA, nothing is written)
BEGIN READ ONLY;

\echo 'A1 a demand is allocated more than its total'
SELECT d.id AS demand_id, d.installment_index,
       (d.amount_due_inr + d.cgst_amount + d.sgst_amount + d.addon_charge_amount + d.addon_cgst_amount + d.addon_sgst_amount) AS demand_total,
       SUM(a.principal + a.cgst + a.sgst) AS allocated
  FROM receipt_allocation a JOIN demands d ON d.id = a.demand_id
 GROUP BY d.id HAVING SUM(a.principal + a.cgst + a.sgst) > (d.amount_due_inr + d.cgst_amount + d.sgst_amount + d.addon_charge_amount + d.addon_cgst_amount + d.addon_sgst_amount) + 0.01;

\echo 'A2 a receipt is allocated more than it received (less approved returns)'
SELECT r.id AS receipt_id, r.amount_received_inr,
       COALESCE((SELECT SUM(rr.amount) FROM receipt_returns rr WHERE rr.receipt_id = r.id AND rr.status = 'approved'), 0) AS returned,
       SUM(a.principal + a.cgst + a.sgst) AS allocated
  FROM receipt_allocation a JOIN receipts r ON r.id = a.receipt_id
 GROUP BY r.id HAVING SUM(a.principal + a.cgst + a.sgst) >
       r.amount_received_inr - COALESCE((SELECT SUM(rr.amount) FROM receipt_returns rr WHERE rr.receipt_id = r.id AND rr.status = 'approved'), 0) + 0.01;

\echo 'A3 allocation on a receipt that is not cleared or is an advance. The product cannot cancel a cleared receipt (it needs a return), so a hit here is a row changed by hand'
SELECT a.id, a.receipt_id, r.status, r.is_advance
  FROM receipt_allocation a JOIN receipts r ON r.id = a.receipt_id
 WHERE r.status <> 'cleared' OR r.is_advance IS TRUE;

\echo 'A4 (information, not a defect) allocation kept on a demand that a surrender/cancellation stopped. It is history; a restore brings the demand back with it. Finance to confirm this is wanted'
SELECT a.id, a.demand_id FROM receipt_allocation a JOIN demands d ON d.id = a.demand_id WHERE d.status = 'cancelled';

\echo 'A5 allocation between a receipt and a demand of a different plan'
SELECT a.id FROM receipt_allocation a JOIN receipts r ON r.id = a.receipt_id JOIN demands d ON d.id = a.demand_id
 WHERE r.payment_plan_id IS DISTINCT FROM d.payment_plan_id;

\echo 'A6/A7 a demand status that disagrees with what is covered (receipt allocation + approved credit allocation); only plans that have allocation rows'
SELECT x.demand_id, x.installment_index, x.status, x.tot AS demand_total, x.cov AS covered FROM (
  SELECT d.id AS demand_id, d.installment_index, d.status, (d.amount_due_inr + d.cgst_amount + d.sgst_amount + d.addon_charge_amount + d.addon_cgst_amount + d.addon_sgst_amount) AS tot,
         COALESCE((SELECT SUM(a.principal + a.cgst + a.sgst) FROM receipt_allocation a WHERE a.demand_id = d.id), 0)
       + COALESCE((SELECT SUM(ca.amount) FROM credit_allocations ca WHERE ca.demand_id = d.id AND ca.status = 'approved'), 0) AS cov
    FROM demands d
   WHERE d.status <> 'cancelled'
     AND d.payment_plan_id IN (SELECT d2.payment_plan_id FROM receipt_allocation a2 JOIN demands d2 ON d2.id = a2.demand_id)) x
 WHERE (x.status = 'paid' AND x.cov < x.tot - 0.01) OR (x.status = 'partial' AND x.cov <= 0.005) OR (x.status IN ('pending','demanded') AND x.cov > 0.005);

\echo 'A8 a cleared receipt that no checker authorised (money counted without maker-checker)'
SELECT r.id, r.receipt_number, r.amount_received_inr FROM receipts r WHERE r.status = 'cleared' AND r.authorized_by IS NULL;

ROLLBACK;
