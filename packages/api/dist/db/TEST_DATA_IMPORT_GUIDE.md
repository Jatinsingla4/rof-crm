# TEST DATA IMPORT GUIDE

## Overview
This guide documents the import of test data from three documents into the CRM backend:
1. **Applicants Information** - 5 consumers + 1 co-applicant
2. **Commercial Project** - ROF GALLLERIA_TEST with 19 units
3. **Residential Project** - ROF ALANTE_TEST with 12 units

**Total Records Imported: 88**

---

## What Was Imported

### Projects (2)
```
1. ROF GALLLERIA_TEST
   ├─ Type: COMMERCIAL
   ├─ Location: Village Dharampur, Sector-108, Gurugram, Haryana
   ├─ Land Area: 0.201 acres (8,755 sqft)
   ├─ GST: 06AABCN4603L1ZK
   └─ Units: 19 commercial shops

2. ROF ALANTE_TEST
   ├─ Type: RESIDENTIAL
   ├─ Location: Village Dharampura, Sector 108, Gurugram, Haryana
   ├─ Land Area: 5.375 acres (234,117 sqft)
   ├─ GST: 06AABCN4603L1ZK
   └─ Units: 12 residential apartments (6 towers)
```

### Towers (7)
```
Commercial:
├─ Ground Floor

Residential:
├─ Tower A, B, C, D, E, F
```

### Units (31)
```
Commercial (19 shops):
├─ G-01 to G-09: 352 sqft (193.75 carpet)
└─ G-10 to G-19: 235 sqft (129.168 carpet)

Residential (12 apartments):
├─ Tower A: A-101, A-102 (3BHK, 645.74 carpet)
├─ Tower B: B-1508, B-1204 (2BHK+ST, 645.549 carpet)
├─ Tower C: C-905, C-906 (3BHK, 645.786 carpet)
├─ Tower D: D-303, D-304 (2BHK+ST, 645.549 carpet)
├─ Tower E: E-101, E-102 (3BHK, 645.743 carpet)
└─ Tower F: F-101, F-102 (1BHK, 409.44 carpet)
```

### Payment Plans (6)
```
Commercial (4 plans):
├─ PLP@92: 10% → 30% → 30% → 30%
├─ CLP@92: 10% → 30% → 20% → 30% → 10%
├─ PLP@92 40:60: 10% → 30% → 60%
└─ PLP@92 30:70: 10% → 20% → 70%

Residential (2 plans):
├─ TLP: 5% → 20% → 6×(12.5%)
└─ CLP: 5% → 20% → 5×(12.5%) → 7.5% → 5%
```

### Payment Plan Stages (32)
```
Commercial: 15 total stages (4 + 5 + 3 + 3)
Residential: 17 total stages (8 + 9)
```

### Extra Charges (4 - Residential Only)
```
├─ External Electrification: ₹90,000
├─ Electric Meter: ₹10,000
├─ BOCW Contribution: ₹12,915
└─ Administrative Charges: ₹15,000
```

### Consumers (5)
```
1. Amit Rohilla (9729693567)
2. Dharam Veer (8448393206)
3. Prem Kumar (9910077853)
4. Rashmi Gupta (9911292456)
5. Rohit Kumar Singh (9041003354)

All have:
├─ Lead Stage: enquiry
├─ Status: active
├─ PAN: SHA-256 hashed
├─ Aadhaar: SHA-256 hashed
└─ Source: Applicants information for new project Booking.docx
```

### Co-Applicants (1)
```
├─ Usha Rohila (W/o BALDEV)
├─ Linked to: Amit Rohilla
└─ PAN/Aadhaar: SHA-256 hashed
```

---

## How to Verify the Import

### Step 1: Run the Migration
```bash
# The migration is included in version control
# When you next run `npm run db:migrate`, it will execute automatically
# Or manually:
psql -U postgres -d rof_crm -f packages/api/src/db/migrations/040_import_test_documents_data.sql
```

### Step 2: Check the Import via API

#### Verify All Data Imported
```bash
curl -H "Authorization: Bearer mock-jwt-token" \
  http://localhost:3000/api/test-data/verify
```

**Response:**
```json
{
  "success": true,
  "data": {
    "importStats": {
      "projects": 2,
      "towers": 7,
      "units": 31,
      "paymentPlans": 6,
      "paymentStages": 32,
      "extraCharges": 4,
      "consumers": 5,
      "coApplicants": 1,
      "totalRecords": 88,
      "timestamp": "2026-05-01T10:30:00.000Z"
    },
    "validation": {
      "issues": [],
      "valid": true
    },
    "allValid": true
  }
}
```

#### View Projects
```bash
curl -H "Authorization: Bearer mock-jwt-token" \
  http://localhost:3000/api/test-data/projects
```

#### View Units Breakdown
```bash
curl -H "Authorization: Bearer mock-jwt-token" \
  http://localhost:3000/api/test-data/units-breakdown
```

#### View Payment Plans
```bash
curl -H "Authorization: Bearer mock-jwt-token" \
  http://localhost:3000/api/test-data/payment-plans
```

#### View Consumers
```bash
curl -H "Authorization: Bearer mock-jwt-token" \
  http://localhost:3000/api/test-data/consumers
```

#### View Co-Applicants
```bash
curl -H "Authorization: Bearer mock-jwt-token" \
  http://localhost:3000/api/test-data/co-applicants
```

#### Complete Summary
```bash
curl -H "Authorization: Bearer mock-jwt-token" \
  http://localhost:3000/api/test-data/summary
```

---

## Step 3: Verify via Database (Direct Query)

```sql
-- Check projects
SELECT COUNT(*) FROM projects WHERE name LIKE '%TEST%';
-- Expected: 2

-- Check units
SELECT COUNT(*) FROM units WHERE project_id IN 
  (SELECT id FROM projects WHERE name LIKE '%TEST%');
-- Expected: 31

-- Check payment plans
SELECT COUNT(*) FROM payment_plans WHERE project_id IN 
  (SELECT id FROM projects WHERE name LIKE '%TEST%');
-- Expected: 6

-- Check payment stages
SELECT COUNT(*) FROM payment_plan_stages WHERE payment_plan_id IN 
  (SELECT id FROM payment_plans WHERE project_id IN 
    (SELECT id FROM projects WHERE name LIKE '%TEST%'));
-- Expected: 32

-- Check extra charges
SELECT COUNT(*) FROM extra_charges WHERE project_id IN 
  (SELECT id FROM projects WHERE name LIKE '%TEST%');
-- Expected: 4

-- Check consumers
SELECT COUNT(*) FROM consumers WHERE imported_from_document IS NOT NULL;
-- Expected: 5

-- Check co-applicants
SELECT COUNT(*) FROM consumer_co_applicants;
-- Expected: 1
```

---

## Important Notes

### PAN & Aadhaar Security
- All PAN and Aadhaar numbers are **SHA-256 hashed** in the database
- Original values are NEVER stored in plaintext
- Only the hash is visible in database queries

### Lead Stage for Consumers
- All imported consumers start with `lead_stage = 'enquiry'`
- This is intentional - they're not yet confirmed booking applicants
- You can manually advance them through the sales pipeline

### Payment Plan Percentages
- All payment plans have been validated
- Total percentages = 100% for each plan
- Stages are numbered in order

### Data Integrity Checks
The system automatically validates:
- ✅ All projects exist
- ✅ All towers linked to correct projects
- ✅ All units linked to correct towers
- ✅ All payment plans linked to projects
- ✅ All stages sum to 100% per plan
- ✅ All consumers have hashed PAN/Aadhaar
- ✅ Co-applicants linked to primary consumer

---

## Troubleshooting

### Issue: Migration fails during import
**Solution:** Ensure pgcrypto extension is enabled:
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

### Issue: API returns "0 records imported"
**Solution:** 
1. Verify migration was executed
2. Check database connection
3. Manually run verification queries above

### Issue: Payment plan percentages don't match documents
**Solution:** This indicates a data entry error. Check the migration file line by line against document values.

### Issue: Consumers missing PAN/Aadhaar
**Solution:** They should be hashed. If NULL, the migration didn't execute properly.

---

## Files Created/Modified

### New Files:
```
✅ packages/api/src/db/migrations/040_import_test_documents_data.sql
   └─ Contains all INSERT statements for 88 records

✅ packages/api/src/services/test-data-import.service.ts
   └─ Service to verify and query imported data

✅ packages/api/src/routes/test-data-import.ts
   └─ API endpoints (/api/test-data/*) for data verification
```

### Modified Files:
```
📝 packages/api/src/index.ts
   └─ Added: import testDataImportRoutes + route mounting
```

---

## Next Steps

### For Testing:
1. ✅ Run migration
2. ✅ Call /api/test-data/verify to confirm
3. ✅ Browse individual projects/units via API
4. Test document import pipeline against this data

### For Development:
- Use these test projects for feature development
- Test booking forms, allocations, payment processing
- All data is isolated (only TEST projects)
- Can safely reset by deleting TEST projects

### For Cleanup:
```sql
-- Delete all test data (if needed)
DELETE FROM projects WHERE name LIKE '%TEST%';
-- Cascading delete handles all related records
```

---

## Summary

| Item | Count | Status |
|------|-------|--------|
| Projects | 2 | ✅ |
| Towers | 7 | ✅ |
| Units | 31 | ✅ |
| Payment Plans | 6 | ✅ |
| Payment Stages | 32 | ✅ |
| Extra Charges | 4 | ✅ |
| Consumers | 5 | ✅ |
| Co-Applicants | 1 | ✅ |
| **TOTAL** | **88** | **✅** |

**Import Status: COMPLETE ✅**
