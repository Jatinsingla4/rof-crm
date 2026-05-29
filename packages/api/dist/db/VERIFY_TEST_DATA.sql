-- TEST DATA VERIFICATION SCRIPT
-- Run this to verify all test data was imported correctly
-- Expected Result: All counts should match specified values

\echo '====================================================================='
\echo 'TEST DATA IMPORT VERIFICATION REPORT'
\echo '====================================================================='
\echo ''

-- 1. PROJECTS
\echo '1. PROJECTS (Expected: 2)'
SELECT 'Projects' as category, COUNT(*) as count FROM projects WHERE name LIKE '%TEST%';
\echo ''

-- 2. TOWERS
\echo '2. TOWERS (Expected: 7)'
SELECT 'Towers' as category, COUNT(*) as count FROM towers
WHERE project_id IN (SELECT id FROM projects WHERE name LIKE '%TEST%');
\echo ''

-- 3. UNITS
\echo '3. UNITS (Expected: 31)'
SELECT 'Units' as category, COUNT(*) as count FROM units
WHERE project_id IN (SELECT id FROM projects WHERE name LIKE '%TEST%');
\echo ''

-- 4. PAYMENT PLANS
\echo '4. PAYMENT PLANS (Expected: 6)'
SELECT 'Payment Plans' as category, COUNT(*) as count FROM payment_plans
WHERE project_id IN (SELECT id FROM projects WHERE name LIKE '%TEST%');
\echo ''

-- 5. PAYMENT PLAN STAGES
\echo '5. PAYMENT PLAN STAGES (Expected: 32)'
SELECT 'Payment Stages' as category, COUNT(*) as count FROM payment_plan_stages
WHERE payment_plan_id IN (
  SELECT id FROM payment_plans WHERE project_id IN
  (SELECT id FROM projects WHERE name LIKE '%TEST%')
);
\echo ''

-- 6. EXTRA CHARGES
\echo '6. EXTRA CHARGES (Expected: 4)'
SELECT 'Extra Charges' as category, COUNT(*) as count FROM extra_charges
WHERE project_id IN (SELECT id FROM projects WHERE name LIKE '%TEST%');
\echo ''

-- 7. CONSUMERS
\echo '7. CONSUMERS (Expected: 5)'
SELECT 'Consumers' as category, COUNT(*) as count FROM consumers
WHERE imported_from_document IS NOT NULL;
\echo ''

-- 8. CO-APPLICANTS
\echo '8. CO-APPLICANTS (Expected: 1)'
SELECT 'Co-Applicants' as category, COUNT(*) as count FROM consumer_co_applicants;
\echo ''

-- 9. TOTAL RECORDS
\echo '9. TOTAL RECORDS (Expected: 88)'
WITH counts AS (
  SELECT 'Projects' as cat, COUNT(*) as cnt FROM projects WHERE name LIKE '%TEST%'
  UNION ALL
  SELECT 'Towers', COUNT(*) FROM towers WHERE project_id IN (SELECT id FROM projects WHERE name LIKE '%TEST%')
  UNION ALL
  SELECT 'Units', COUNT(*) FROM units WHERE project_id IN (SELECT id FROM projects WHERE name LIKE '%TEST%')
  UNION ALL
  SELECT 'Payment Plans', COUNT(*) FROM payment_plans WHERE project_id IN (SELECT id FROM projects WHERE name LIKE '%TEST%')
  UNION ALL
  SELECT 'Payment Stages', COUNT(*) FROM payment_plan_stages WHERE payment_plan_id IN (SELECT id FROM payment_plans WHERE project_id IN (SELECT id FROM projects WHERE name LIKE '%TEST%'))
  UNION ALL
  SELECT 'Extra Charges', COUNT(*) FROM extra_charges WHERE project_id IN (SELECT id FROM projects WHERE name LIKE '%TEST%')
  UNION ALL
  SELECT 'Consumers', COUNT(*) FROM consumers WHERE imported_from_document IS NOT NULL
  UNION ALL
  SELECT 'Co-Applicants', COUNT(*) FROM consumer_co_applicants
)
SELECT 'TOTAL' as category, SUM(cnt) as count FROM counts;
\echo ''

-- DETAILED BREAKDOWN

\echo '====================================================================='
\echo 'DETAILED PROJECT INFORMATION'
\echo '====================================================================='
SELECT id, name, location, project_type, state, city, land_area_sqft, gst_number, created_at
FROM projects
WHERE name LIKE '%TEST%'
ORDER BY created_at;
\echo ''

\echo '====================================================================='
\echo 'UNITS BREAKDOWN BY PROJECT'
\echo '====================================================================='
SELECT
  p.name as project_name,
  COUNT(u.id) as total_units,
  COUNT(DISTINCT u.bhk_type) as bhk_types,
  ROUND(AVG(u.carpet_area_sqft)::numeric, 2) as avg_carpet_area,
  ROUND(AVG(u.super_area_sqft)::numeric, 2) as avg_super_area
FROM projects p
LEFT JOIN units u ON p.id = u.project_id
WHERE p.name LIKE '%TEST%'
GROUP BY p.id, p.name
ORDER BY p.name;
\echo ''

\echo '====================================================================='
\echo 'PAYMENT PLANS VERIFICATION (Percentages should sum to 100%)'
\echo '====================================================================='
SELECT
  p.name as project_name,
  pp.plan_name,
  COUNT(pps.id) as total_stages,
  ROUND(SUM(pps.percentage_of_basic)::numeric, 2) as total_percentage,
  CASE
    WHEN ROUND(SUM(pps.percentage_of_basic)::numeric, 2) = 100 THEN '✓ VALID'
    ELSE '✗ INVALID'
  END as status
FROM projects p
INNER JOIN payment_plans pp ON p.id = pp.project_id
LEFT JOIN payment_plan_stages pps ON pp.id = pps.payment_plan_id
WHERE p.name LIKE '%TEST%'
GROUP BY p.id, p.name, pp.id, pp.plan_name
ORDER BY p.name, pp.plan_name;
\echo ''

\echo '====================================================================='
\echo 'CONSUMERS FROM IMPORT'
\echo '====================================================================='
SELECT
  id, name, mobile, email, lead_stage, status,
  imported_from_document,
  CASE
    WHEN pan_no IS NOT NULL THEN 'Hashed'
    ELSE 'MISSING'
  END as pan_status,
  CASE
    WHEN aadhaar_no IS NOT NULL THEN 'Hashed'
    ELSE 'MISSING'
  END as aadhaar_status,
  created_at
FROM consumers
WHERE imported_from_document IS NOT NULL
ORDER BY created_at;
\echo ''

\echo '====================================================================='
\echo 'CO-APPLICANTS'
\echo '====================================================================='
SELECT
  c.name as primary_consumer,
  cca.name as co_applicant,
  cca.relation,
  cca.date_of_birth,
  CASE
    WHEN cca.pan_no IS NOT NULL THEN 'Hashed'
    ELSE 'MISSING'
  END as pan_status,
  CASE
    WHEN cca.aadhaar_no IS NOT NULL THEN 'Hashed'
    ELSE 'MISSING'
  END as aadhaar_status,
  cca.created_at
FROM consumer_co_applicants cca
INNER JOIN consumers c ON cca.primary_consumer_id = c.id
ORDER BY cca.created_at;
\echo ''

\echo '====================================================================='
\echo 'DATA INTEGRITY CHECKS'
\echo '====================================================================='

-- Check 1: All towers linked to projects
\echo 'Check 1: Towers linked to projects'
SELECT
  CASE
    WHEN COUNT(*) = 7 THEN '✓ All 7 towers linked'
    ELSE '✗ Missing towers'
  END as status
FROM towers
WHERE project_id IN (SELECT id FROM projects WHERE name LIKE '%TEST%');
\echo ''

-- Check 2: All units linked to towers
\echo 'Check 2: Units linked to towers'
SELECT
  CASE
    WHEN COUNT(*) = 31 THEN '✓ All 31 units linked'
    ELSE '✗ Missing units'
  END as status
FROM units
WHERE tower_id IN (
  SELECT t.id FROM towers t
  WHERE t.project_id IN (SELECT id FROM projects WHERE name LIKE '%TEST%')
);
\echo ''

-- Check 3: All payment plans linked to projects
\echo 'Check 3: Payment plans linked to projects'
SELECT
  CASE
    WHEN COUNT(*) = 6 THEN '✓ All 6 payment plans linked'
    ELSE '✗ Missing payment plans'
  END as status
FROM payment_plans
WHERE project_id IN (SELECT id FROM projects WHERE name LIKE '%TEST%');
\echo ''

-- Check 4: All payment stages linked to plans
\echo 'Check 4: Payment stages linked to plans'
SELECT
  CASE
    WHEN COUNT(*) = 32 THEN '✓ All 32 payment stages linked'
    ELSE '✗ Missing payment stages'
  END as status
FROM payment_plan_stages
WHERE payment_plan_id IN (
  SELECT id FROM payment_plans
  WHERE project_id IN (SELECT id FROM projects WHERE name LIKE '%TEST%')
);
\echo ''

-- Check 5: Extra charges only for residential
\echo 'Check 5: Extra charges only for residential'
SELECT
  p.name as project_name,
  p.project_type,
  COUNT(ec.id) as charge_count
FROM projects p
LEFT JOIN extra_charges ec ON p.id = ec.project_id
WHERE p.name LIKE '%TEST%'
GROUP BY p.id, p.name, p.project_type
ORDER BY p.name;
\echo ''

-- Check 6: Consumers have required fields
\echo 'Check 6: Consumer data completeness'
SELECT
  CASE
    WHEN COUNT(*) = 5 THEN '✓ All 5 consumers present'
    ELSE '✗ Missing consumers'
  END as status,
  COUNT(*) as total,
  SUM(CASE WHEN pan_no IS NOT NULL THEN 1 ELSE 0 END) as pan_hashed,
  SUM(CASE WHEN aadhaar_no IS NOT NULL THEN 1 ELSE 0 END) as aadhaar_hashed,
  SUM(CASE WHEN mobile IS NOT NULL THEN 1 ELSE 0 END) as with_mobile,
  SUM(CASE WHEN email IS NOT NULL THEN 1 ELSE 0 END) as with_email
FROM consumers
WHERE imported_from_document IS NOT NULL;
\echo ''

\echo '====================================================================='
\echo 'SUMMARY'
\echo '====================================================================='
\echo 'Test Data Import Verification Complete'
\echo 'Check above for any ✗ marks indicating issues'
\echo '====================================================================='
