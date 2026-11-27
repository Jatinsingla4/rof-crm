-- READ ONLY. QA-022, QA-028 (V1.1): finds applicants that look like duplicates, so ROF can decide each case. Nothing here changes data and nothing merges customers.
-- Run on a copy or a read replica first. See DUPLICATE_CUSTOMER_RECONCILIATION_PLAN.md for what happens after.

-- 1. The same PAN on more than one applicant in a project (the software refuses a new one since the applicant rules were added; old records may have it)
SELECT c.project_id, upper(c.pan_no) AS pan, COUNT(*) AS applicants, array_agg(c.id ORDER BY c.created_at) AS ids, array_agg(c.name ORDER BY c.created_at) AS names
  FROM consumers c WHERE c.pan_no IS NOT NULL AND btrim(c.pan_no) <> '' GROUP BY c.project_id, upper(c.pan_no) HAVING COUNT(*) > 1 ORDER BY applicants DESC;

-- 2. The same mobile number in a project (or with no project)
SELECT c.project_id, c.mobile, COUNT(*) AS applicants, array_agg(c.id ORDER BY c.created_at) AS ids, array_agg(c.name ORDER BY c.created_at) AS names
  FROM consumers c WHERE c.mobile IS NOT NULL AND btrim(c.mobile) <> '' GROUP BY c.project_id, c.mobile HAVING COUNT(*) > 1 ORDER BY applicants DESC;

-- 3. The same Aadhaar (compared through its hash, the number itself is not shown)
SELECT c.aadhaar_hash, COUNT(*) AS applicants, array_agg(c.id ORDER BY c.created_at) AS ids, array_agg(c.name ORDER BY c.created_at) AS names
  FROM consumers c WHERE c.aadhaar_hash IS NOT NULL GROUP BY c.aadhaar_hash HAVING COUNT(*) > 1 ORDER BY applicants DESC;

-- 4. The same e-mail address
SELECT lower(btrim(c.email)) AS email, COUNT(*) AS applicants, array_agg(c.id ORDER BY c.created_at) AS ids, array_agg(c.name ORDER BY c.created_at) AS names
  FROM consumers c WHERE c.email IS NOT NULL AND btrim(c.email) <> '' GROUP BY lower(btrim(c.email)) HAVING COUNT(*) > 1 ORDER BY applicants DESC;

-- 5. The same registration number or form number on more than one applicant, case and spaces ignored
SELECT 'registration_no' AS number_kind, lower(btrim(c.registration_no)) AS number, COUNT(*) AS applicants, array_agg(c.id ORDER BY c.created_at) AS ids
  FROM consumers c WHERE c.registration_no IS NOT NULL AND btrim(c.registration_no) <> '' GROUP BY lower(btrim(c.registration_no)) HAVING COUNT(*) > 1
UNION ALL
SELECT 'form_no', lower(btrim(c.form_no)), COUNT(*), array_agg(c.id ORDER BY c.created_at)
  FROM consumers c WHERE c.form_no IS NOT NULL AND btrim(c.form_no) <> '' GROUP BY lower(btrim(c.form_no)) HAVING COUNT(*) > 1;

-- 6. A registration number on a booking that belongs to another applicant than the one holding that number on their own record
SELECT br.id AS booking_id, br.registration_no AS booking_registration_no, br.consumer_id AS booking_applicant, c.id AS applicant_holding_number, c.name
  FROM booking_records br JOIN consumers c ON lower(btrim(c.registration_no)) = lower(btrim(br.registration_no)) AND c.id <> br.consumer_id
 WHERE br.registration_no IS NOT NULL;

-- 7. The booking numbers of one applicant that differ from the number on the applicant record
SELECT c.id AS consumer_id, c.name, c.registration_no AS applicant_registration_no, br.registration_no AS booking_registration_no, br.status
  FROM consumers c JOIN booking_records br ON br.consumer_id = c.id
 WHERE br.registration_no IS NOT NULL AND c.registration_no IS NOT NULL AND lower(btrim(br.registration_no)) <> lower(btrim(c.registration_no));

-- 8. The same name with the same project but a different identity (possible people with one name; review only, NOT proof of a duplicate)
SELECT c.project_id, lower(btrim(c.name)) AS name, COUNT(*) AS applicants, array_agg(c.id ORDER BY c.created_at) AS ids
  FROM consumers c GROUP BY c.project_id, lower(btrim(c.name)) HAVING COUNT(*) > 1 ORDER BY applicants DESC LIMIT 200;

-- 9. Display name out of step with the stored parts (a document edit used to leave `name` stale)
SELECT c.id, c.name, c.first_name, c.last_name FROM consumers c
 WHERE c.first_name IS NOT NULL AND btrim(concat_ws(' ', c.first_name, c.last_name)) <> ''
   AND lower(btrim(c.name)) <> lower(btrim(concat_ws(' ', c.first_name, c.last_name))) LIMIT 500;

-- 10. What hangs on each applicant in the groups above (the weight of a merge): bookings, plans, receipts, demands, allocations
SELECT c.id, c.name, c.registration_no,
       (SELECT COUNT(*) FROM booking_records b WHERE b.consumer_id = c.id) AS bookings,
       (SELECT COUNT(*) FROM payment_plans p WHERE p.consumer_id = c.id) AS plans,
       (SELECT COUNT(*) FROM receipts r WHERE r.consumer_id = c.id) AS receipts,
       (SELECT COUNT(*) FROM demands d WHERE d.consumer_id = c.id) AS demands,
       (SELECT COUNT(*) FROM allocations a WHERE a.consumer_id = c.id) AS allocations
  FROM consumers c
 WHERE c.id IN (SELECT unnest(array_agg(x.id)) FROM consumers x WHERE x.mobile IS NOT NULL GROUP BY x.project_id, x.mobile HAVING COUNT(*) > 1)
    OR c.id IN (SELECT unnest(array_agg(x.id)) FROM consumers x WHERE x.pan_no IS NOT NULL GROUP BY x.project_id, upper(x.pan_no) HAVING COUNT(*) > 1)
 ORDER BY c.name LIMIT 500;
