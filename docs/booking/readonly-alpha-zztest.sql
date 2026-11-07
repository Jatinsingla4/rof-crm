-- READ ONLY. Closes the open points in QUOTE_PARITY.md section 6. Changes nothing.
-- Run: see the command in the chat. The transaction below is READ ONLY, so a write would fail.
BEGIN READ ONLY;

\echo '== 1. Alpha (ZZREG-2026-000014) and Beta (ZZREG-2026-000015): the stored price fields =='
SELECT br.registration_no, p.name AS project, u.unit_number,
       br.basic_rate_inr_sqft, br.carpet_area_sqft AS br_carpet, u.carpet_area_sqft AS unit_carpet,
       u.balcony_area_sqft, u.base_price_inr,
       br.plc_amount, br.other_charge_amount,
       br.company_inaugural_disc, br.approved_rebate_amount,
       br.balcony_charge_amount, br.balcony_cgst_amount, br.balcony_sgst_amount, br.balcony_rate_applied_inr_sqft,
       bpt.cgst_pct, bpt.sgst_pct, bpt.cgst_amount, bpt.sgst_amount
  FROM booking_records br
  JOIN consumers c ON c.id = br.consumer_id
  JOIN units u ON u.id = br.unit_id
  JOIN projects p ON p.id = br.project_id
  LEFT JOIN booking_payment_taxes bpt ON bpt.booking_record_id = br.id
 WHERE br.registration_no IN ('ZZREG-2026-000014','ZZREG-2026-000015')
    OR c.registration_no IN ('ZZREG-2026-000014','ZZREG-2026-000015');

\echo '== 2. Balcony terms: Charge Master and per-project limits (ZZ TEST and QA Cycle3) =='
SELECT rate_value, cap_value FROM charge_master_config WHERE charge_key = 'balcony_charge';
SELECT p.name, ps.balcony_max_charge_inr, ps.balcony_max_area_sqft
  FROM projects p LEFT JOIN project_settings ps ON ps.project_id = p.id
 WHERE p.name ILIKE 'ZZ TEST%' OR p.name ILIKE 'QA Cycle3%';

\echo '== 3. Demand rows behind the file GST (sums decide the file tax when within 1000) =='
SELECT c.registration_no, d.installment_index, d.amount_due_inr, d.cgst_amount, d.sgst_amount, d.status
  FROM demands d JOIN consumers c ON c.id = d.consumer_id
 WHERE c.registration_no IN ('ZZREG-2026-000014','ZZREG-2026-000015')
 ORDER BY c.registration_no, d.installment_index;

\echo '== 4. Audit trail on those bookings (was the price edited after save?) =='
SELECT "timestamp", action, resource_type, left(coalesce(previous_values::text, ''), 200) AS previous_values, left(coalesce(new_values::text, ''), 300) AS new_values
  FROM audit_logs
 WHERE resource_id::text IN (SELECT br.id::text FROM booking_records br JOIN consumers c ON c.id = br.consumer_id
                      WHERE c.registration_no IN ('ZZREG-2026-000014','ZZREG-2026-000015'))
 ORDER BY "timestamp" DESC LIMIT 40;

ROLLBACK;
