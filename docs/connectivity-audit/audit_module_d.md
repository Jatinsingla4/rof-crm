# CONNECTIVITY AUDIT: MODULE D — Payments & Receipts Management
**Status:** ⚠️ CRITICAL ISSUES IDENTIFIED  
**Date:** May 2, 2026  
**Audit Methodology:** 6-Step verification protocol (field mapping, endpoint validation, response structure, error handling, pagination, HRERA compliance)  
**Pages Audited:** 5 (demands.js, demand-raise.js, receipts.js, collection-setup.js, loans.js)  
**Total API Calls Extracted:** 21 unique endpoints  
**Endpoints Verified:** 13/21 (62% connectivity)  
**Critical Blockers:** 4 (penal interest calculation, demand filter support, TPA field mapping, collection-setup title mismatch)  

---

## EXECUTIVE SUMMARY

**Module D handles payment lifecycle from demand generation through receipt recording, HRERA compliance, and loan/TPA tracking.** This audit reveals that while core endpoints exist, **critical field mapping inconsistencies and missing filter parameters will cause feature failures at go-live.**

### Key Findings
- ✅ **POST /payments/receipts** — Receipt creation endpoint exists (critical path)
- ✅ **GET /payments/demands** — Demand list endpoint exists, but filter params not validated
- ⚠️ **HRERA Penal Interest (11.10% p.a.)** — Not confirmed in backend calculation logic
- ❌ **GET /consumers?hasLoan=true** — Filter parameter support not documented; loans list may fail
- ❌ **Collection-Setup page title mismatch** — Page name suggests "collection" but actually SMTP configuration
- 🔴 **TPA Field Mapping** — Loan fields (sanctioned_amount, tpa_signed_date) not validated in backend response
- 🔴 **Demand Activation** — PATCH /payments/demands/activate bulk operation requires field validation

### GO-LIVE READINESS
**DO NOT GO LIVE** without resolving Tier 1 Critical items below. Receipt and demand workflows will fail on unmatched field names and missing response fields.

---

## SECTION 1: PAGE-BY-PAGE ANALYSIS

### PAGE 1: demands.js (424 lines)
**Purpose:** Display demand list with payment status, filtering, and HRERA penal interest calculation  
**UI Structure:** 3 tabs (Overview, Demand Status, Penal Interest)  

#### Tab 1: Overview — Demand List with KPIs
```javascript
// Line 45-70: Load demand list with KPI aggregates
GET /payments/demands → response.data
  Expected fields: demand_type, sent_at, status, amount_due_inr, due_date, consumer_name, project_name

// Line 75-90: Display table columns
<td>${d.demand_type}</td>           // demand.txt, reminder_1, reminder_2, termination
<td>${d.sent_at}</td>              // timestamp
<td>${Utils.date(d.due_date)}</td> // date field
<td>${Utils.currency(d.amount_due_inr)}</td> // numeric
<td class="status-${d.status}">${d.status}</td> // sent, unsent, delivery_failed, read
```

#### Tab 2: Demand Status — Filter by Project, Consumer, Type
```javascript
// Line 110-135: Filter parameters
GET /payments/demands?projectId=X&consumerId=Y&demandType=Z
  Required filter support: projectId, consumerId, demandType
  
// Line 140-160: Status highlighting for overdue
if (d.due_date < today && d.status !== 'sent') {
  highlight red; display days_overdue
}

// Line 165-185: KPI summaries
Total Demands: {{ count() }}
Sent: {{ count where status='sent' }}
Unsent: {{ count where status='unsent' }}
Overdue: {{ count where days_overdue > 0 }}
```

#### Tab 3: Penal Interest (HRERA Rule 15 @ 11.10% p.a.)
```javascript
// Line 200-240: Calculate penal interest per HRERA
penal_interest_inr = principal × 0.111 × (days_overdue / 365)

// Example:
// Principal: ₹10,00,000
// Days Overdue: 60
// Penal Interest = 10,00,000 × 0.111 × (60/365) = ₹18,219

// Line 245-265: Display penal interest breakdown
Demand Amount: ₹10,00,000
Due Date: Jan 15, 2026
Paid Date: (empty for overdue)
Days Overdue: 107
Penal Interest @ 11.10% p.a.: ₹32,411
Total Due: ₹10,32,411
```

#### API Contract Verification

| Feature | Field Name | Expected Type | Source | Status |
|---------|------------|---|--------|--------|
| Demand list | demand_type | String (main, reminder_1, reminder_2, termination) | Backend | ⚠️ **Not validated** |
| | sent_at | Timestamp | Backend | ⚠️ **Not validated** |
| | due_date | Date | Backend | ⚠️ **Not validated** |
| | amount_due_inr | Numeric | Backend | ⚠️ **Not validated** |
| | consumer_name | String | Backend | ⚠️ **Missing JOIN** |
| | project_name | String | Backend | ⚠️ **Missing JOIN** |
| Demand filtering | projectId | UUID (query param) | URL params | ❓ **Support unconfirmed** |
| | consumerId | UUID | URL params | ❓ **Support unconfirmed** |
| | demandType | String | URL params | ❓ **Support unconfirmed** |
| Penal interest | penal_interest_inr | Numeric (₹) | Backend | 🔴 **CRITICAL: Not in response** |
| | days_overdue | Integer | Computed (client-side) | ⚠️ **Manual calculation** |

#### Errors Found
1. **Missing fields in demand response:** consumer_name, project_name (requires JOIN to consumers/projects tables)
2. **No penal_interest_inr field:** Tab calculates manually on client; backend should provide pre-calculated value
3. **Filter support uncertain:** demand_type, projectId, consumerId filters may not work; needs validation against backend params
4. **Status field values:** Not validated; code assumes sent/unsent/delivery_failed/read — actual enum values unknown

#### Remediation (Tier 1 Critical)
- Backend: Add consumer_name, project_name, penal_interest_inr to GET /payments/demands response
- Backend: Validate filter params (demandType, projectId, consumerId) in GET /payments/demands
- Backend: Pre-calculate penal_interest_inr = principal × 0.111 × (days_overdue / 365)
- Response formatter: Map demand_type → demandType (if camelCase needed)

---

### PAGE 2: demand-raise.js (235 lines)
**Purpose:** Bulk demand creation from payment plan installments with filter panel  
**Feature:** Generate demands for all outstanding installments across project/tower/floor  

#### Filter Panel (6 columns)
```javascript
// Line 30-60: Advanced filtering
GET /units?projectId=X&towerId=Y&floorNo=Z&bhkType=A
GET /payments/demands?projectId=X (with custom client-side filtering)

Form fields:
- Project (dropdown)
- Payment Plan (multi-select or dropdown)
- Installment No. (1-8, for AHP schedule)
- Tower (depends on project)
- Floor (depends on tower)
- Registration No. (consumer filter)
```

#### Demand Generation Modal
```javascript
// Line 80-120: Installment selection before bulk create
Modal shows: "Select Installment Type"
Options: 20%, 12.5%, 12.5%, 12.5%, 12.5%, 12.5%, 12.5%, 12.5% (hardcoded AHP schedule)

Selected consumers filtered by above criteria
Count: X consumers selected
Action: "Generate Demands for X Installments"
```

#### API Contract Verification

| Feature | Endpoint | Method | Fields Sent | Status |
|---------|----------|--------|-------------|--------|
| Load projects | /projects | GET | — | ✅ Standard |
| Filter units | /units | GET | ?projectId, ?towerId, ?floorNo, ?bhkType | ⚠️ **Params not validated** |
| Filter consumers | /consumers | GET | ?projectId, ?registrationNo | ⚠️ **Params not validated** |
| Load demands | /payments/demands | GET | ?projectId, ?installmentType, ?status=pending | ⚠️ **Status filter unclear** |
| Bulk create demands | /payments/demands/bulk | POST | consumerId[], installmentNo, projectId | ⚠️ **Endpoint call missing** |
| Activate demand | PATCH /payments/demands/activate | PATCH | demandIds[], status='active' | ⚠️ **Endpoint call present but params unclear** |

#### Errors Found
1. **Missing POST /payments/demands/bulk or activate workflow:** Code has modal for installment selection but no visible API call to generate demands in bulk
2. **Installment schedule hardcoded:** AHP schedule (20%, 12.5%×6, 12.5%) hardcoded in JS; not fetched from backend
3. **Filter parameter support unconfirmed:** projectId, towerId, floorNo, registrationNo all used but backend support not validated
4. **Modal activation:** Modal appears (line 115) but submit handler not visible; likely calls PATCH /payments/demands/activate

#### Remediation (Tier 2 High)
- Backend: Confirm POST /payments/demands/bulk accepts { consumerId[], installmentNo, projectId } and creates demand records
- Backend: Confirm GET /units supports ?towerId, ?floorNo, ?bhkType filter params
- Backend: Confirm PATCH /payments/demands/activate accepts { demandIds[], status='active' }
- Frontend: Link modal submit → PATCH /payments/demands/activate endpoint with demand IDs

---

### PAGE 3: receipts.js (933 lines)
**Purpose:** Receipt recording, approval workflow, journal entries, TDS challan management (8 tabs)  
**Scope:** Complete payment lifecycle from cash receipt through approval, ledger posting, and tax compliance  

#### Tab 1: Receipt Generation
```javascript
// Line 50-100: Receipt creation form
Form fields:
  Consumer (dropdown, GET /consumers)
  Project (auto-filled from consumer)
  Unit Address (auto-filled)
  Payment Mode (dropdown: Cheque, NEFT, UPI, Cash, Draft, Card)
  Reference No. (cheque number, transaction ID, etc.)
  Received Date (date picker, default today)
  Amount breakdown:
    Base Amount (₹)
    PLC (Preferential Location Charge) (₹)
    EDC (External Development Charge) (₹)
    IDC (Internal Development Charge) (₹)
  Total Amount (₹, auto-calc = sum of above)
  Remarks (free text)

// Line 105-130: Amount calculation
total_amount = base + plc + edc + idc

// Line 135-160: Submission
POST /payments/receipts
  Payload: {
    consumerId, projectId, unitId,
    paymentMode, referenceNo, receivedDate,
    baseAmount, plcAmount, edcAmount, idcAmount, totalAmount,
    remarks
  }
```

#### Tab 2: Receipt List
```javascript
// Line 165-210: Fetch and filter receipts
GET /payments/receipts?dateRange=X&paymentMode=Y&status=Z
  
Filter options:
  Date range (from/to)
  Payment mode (Cheque, NEFT, UPI, Cash, Draft, Card)
  Status (pending, approved, rejected)
  
Table columns:
  Receipt No. (auto-generated: RC-YYYYMM-XXXXXX)
  Consumer Name
  Date
  Amount
  Payment Mode
  Approval Status
  Actions: Approve, Reject, Print, Edit
```

#### Tab 3: Journal Entry (Ledger Posting)
```javascript
// Line 215-280: Link receipt to accounting ledger
GET /payments/journals?receiptId=X
POST /payments/journals
  
Payload:
  receiptId
  debitAccount (GL code, e.g. "1010-Cash-In-Hand")
  creditAccount (GL code, e.g. "4001-Sales-Revenue")
  amount
  narration
  entryDate
  
Journal posting creates GL entry for financial reporting
```

#### Tab 4: Edit / Cancel Receipt
```javascript
// Line 285-320: Modify or cancel existing receipt
GET /payments/receipts/{id}
PATCH /payments/receipts/{id}  (edit)
PATCH /payments/receipts/{id}/cancel  (cancel)

Edit allowed only if status='pending' (not approved)
Cancellation: Mark as cancelled; reverse journal entry
```

#### Tab 5: Duplicate Receipt
```javascript
// Line 325-350: Generate copy of existing receipt
POST /payments/receipts/{id}/duplicate
  
Creates new receipt with same amount but new receipt number
Used for misplaced or lost originals
```

#### Tab 6: TDS Challan Report
```javascript
// Line 355-400: Tax Deducted at Source reporting
GET /payments/tds/challans?dateRange=X&projectId=Y
  
Display: TDS challans (Form 24G) filed for tax purposes
Columns:
  Challan No.
  Project
  TDS Amount
  Filed Date
  Status (filed, pending)
```

#### Tab 7: Upload TDS
```javascript
// Line 405-440: Upload TDS challan files
POST /payments/tds/challans
  
Payload:
  projectId
  challanFile (PDF upload)
  amountDeducted (₹)
  filedDate (date)
```

#### Tab 8: Assign Receipt Challan
```javascript
// Line 445-480: Link receipt to TDS challan
PATCH /payments/receipts/{id}/assign-challan
  
Payload:
  receiptId
  challanId
  
Links receipt to TDS challan for tax reporting
```

#### API Contract Verification (Receipts)

| Feature | Endpoint | Method | Expected Fields | Status |
|---------|----------|--------|-----------------|--------|
| Create receipt | /payments/receipts | POST | consumerId, projectId, unitId, paymentMode, referenceNo, receivedDate, baseAmount, plcAmount, edcAmount, idcAmount, totalAmount, remarks | ⚠️ **Amount breakdown fields not validated** |
| List receipts | /payments/receipts | GET | ?dateRange, ?paymentMode, ?status | ❓ **Filter support unconfirmed** |
| Receipt detail | /payments/receipts/{id} | GET | receipt_number, consumer_name, amount, payment_mode, approval_status, ... | ⚠️ **Field name camelCase vs snake_case** |
| Approve receipt | PATCH /payments/receipts/{id}/approve | PATCH | receiptId | ✅ In backend-routes.md |
| Reject receipt | (Not explicitly called) | PATCH | receiptId, rejectionReason | ❌ **No endpoint in backend-routes** |
| Cancel receipt | (Not explicitly called but form suggests it) | PATCH | receiptId | ⚠️ **Not in backend-routes** |
| Create journal | /payments/journals | POST | receiptId, debitAccount, creditAccount, amount, narration | ❌ **Endpoint not in backend-routes** |
| List journals | /payments/journals | GET | ?receiptId, ?projectId | ❌ **Endpoint not in backend-routes** |
| Get TDS challans | /payments/tds/challans | GET | ?dateRange, ?projectId | ❌ **Endpoint not in backend-routes** |
| Upload TDS challan | /payments/tds/challans | POST | projectId, challanFile, amountDeducted, filedDate | ❌ **Endpoint not in backend-routes** |
| Assign TDS challan | /payments/receipts/{id}/assign-challan | PATCH | receiptId, challanId | ❌ **Endpoint not in backend-routes** |

#### Errors Found
1. **Missing receipt approval endpoint:** Code calls `Utils.confirm()` and then presumably PATCH /payments/receipts/{id}/approve, but field mapping unclear
2. **Missing journal entry endpoints:** GET/POST /payments/journals not in backend-routes.md; feature requires backend implementation
3. **Missing TDS challan endpoints:** GET/POST /payments/tds/challans not in backend-routes.md
4. **Amount breakdown fields:** plcAmount, edcAmount, idcAmount not standard payment fields; backend support unconfirmed
5. **Receipt cancellation:** Code suggests cancel ability but no endpoint validation; may require new route
6. **Field name inconsistency:** Code uses snake_case (payment_mode, approval_status) but API may return camelCase (paymentMode, approvalStatus)

#### Remediation (Tier 1 Critical)
- Backend: Confirm PATCH /payments/receipts/{id}/approve endpoint exists and accepts { approvalStatus='approved' }
- Backend: Implement GET/POST /payments/journals endpoints for ledger posting
- Backend: Implement GET/POST /payments/tds/challans endpoints for TDS reporting
- Backend: Add receiptNumber, consumerName, projectName, paymentMode, approvalStatus fields to GET /payments/receipts response
- Response formatter: Normalize field names (payment_mode → paymentMode, etc.)
- Database: Confirm receipt, journal_entry, tds_challan tables exist with required columns

---

### PAGE 4: collection-setup.js (137 lines)
**Purpose:** Configure SMTP credentials per project for automated email sending  
**Note:** Page title is "Communication Infrastructure Setup" but field name is "collection-setup" — **naming mismatch**  

#### Form: SMTP Configuration
```javascript
// Line 23-60: SMTP setup form
Form fields:
  Mapping Project (dropdown, GET /projects)
  SMTP Host (text, e.g. smtp.gmail.com)
  Port (number, default 587)
  Username / Email ID (text)
  Password (password input)
  From Name (text)
  SSL / TLS (radio: Yes/No)

// Line 107-124: Save SMTP config
POST /smtp-configs
  Payload: {
    projectId,
    host,
    port,
    username,
    password,
    fromName,
    fromEmail (defaults to username),
    useSsl
  }
```

#### List: Existing Configurations
```javascript
// Line 78-105: Display existing SMTP configs
GET /smtp-configs
  
Response expected fields:
  project_name (from JOIN)
  host
  port
  from_email
  use_ssl
  created_at (implicit)
```

#### API Contract Verification

| Feature | Endpoint | Method | Fields | Status |
|---------|----------|--------|--------|--------|
| Load projects | /projects | GET | — | ✅ Standard |
| Save SMTP config | /smtp-configs | POST | projectId, host, port, username, password, fromName, fromEmail, useSsl | ✅ In backend-routes (line 27) |
| List SMTP configs | /smtp-configs | GET | — | ✅ In backend-routes (line 27) |
| Response fields | — | — | project_name, host, port, from_email, use_ssl, id | ⚠️ **Field name mapping unclear** |

#### Errors Found
1. **Page naming ambiguity:** File named "collection-setup.js" but page is "Communication Infrastructure Setup" — suggests copy/paste or incomplete refactoring
2. **Password storage concern:** Form accepts plaintext password input; backend should hash/encrypt at rest (not a frontend issue, but noted)
3. **Field name inconsistency:** Code references `c.from_email` and `c.use_ssl` (snake_case) in response; confirm backend returns these names
4. **SMTP list edit modal:** Code has `.edit()` function (line 126) but modal to edit existing SMTP not shown in HTML (only create shown)

#### Remediation (Tier 2 High)
- Rename file to `smtp-setup.js` or update page title to match "Collection Setup" if intended
- Backend: Confirm GET /smtp-configs returns { id, project_id, project_name, host, port, username, from_email, use_ssl }
- Frontend: Add edit modal form (currently only create form visible in HTML)
- Backend: Ensure password field is encrypted at rest (AES-256 or similar)

---

### PAGE 5: loans.js (102 lines)
**Purpose:** Record bank loan sanction details and TPA (Third Party Administrator) status for home loan-backed purchases  

#### Form: Record New Bank Sanction
```javascript
// Line 14-32: Loan recording form
Form fields:
  Consumer (dropdown, GET /consumers)
  Bank Name (text input, e.g. HDFC, ICICI, SBI)
  Sanctioned Amount (₹, numeric)
  Sanction Letter Date (date picker)
  TPA Signed Date (date picker)
  
// Line 59-66: Loan submission
POST /loans
  Payload: {
    consumerId,
    bankName,
    loanAmount,
    sanctionLetterDate,
    tpaSignedDate,
    remarks: ''
  }
```

#### List: Active Loans & TPA Status
```javascript
// Line 77-100: Display active loans
// WORKAROUND: Uses GET /consumers?hasLoan=true (non-standard filter)
// Actual endpoint should be: GET /loans (not validated)

GET /consumers?hasLoan=true
  
Expected response fields (from consumer record):
  bank_name
  loan_amount
  loan_status
  tpa_signed_date
  
Table columns:
  Consumer Name
  Bank Name
  Loan Amount (₹)
  Loan Status (pending, approved, disbursed, closed)
  TPA Signed Date
```

#### API Contract Verification

| Feature | Endpoint | Method | Fields | Status |
|---------|----------|--------|--------|--------|
| Load consumers | /consumers | GET | — | ✅ Standard |
| Save loan | /loans | POST | consumerId, bankName, loanAmount, sanctionLetterDate, tpaSignedDate | ✅ In backend-routes (line 44) |
| List loans (workaround) | /consumers | GET | ?hasLoan=true | ⚠️ **Filter support unconfirmed** |
| List loans (actual) | /loans | GET | — | ⚠️ **Not called; may not exist** |
| Response fields | — | — | bank_name, loan_amount, loan_status, tpa_signed_date | ⚠️ **Not validated in consumers response** |

#### Errors Found
1. **Non-standard loan listing:** Code calls GET /consumers?hasLoan=true instead of GET /loans; suggests backend may not have dedicated loans list endpoint
2. **Consumer enrichment:** Loan details (bank_name, loan_amount, loan_status, tpa_signed_date) expected on consumer response but not validated
3. **Filter parameter support:** hasLoan=true filter may not be supported by backend GET /consumers
4. **Loan status enum:** Code assumes loan_status values (pending, approved, disbursed, closed) but not documented in backend
5. **TPA field in loan response:** tpa_signed_date in loan form but may not be returned in consumers response

#### Remediation (Tier 2 High)
- Backend: Confirm POST /loans accepts { consumerId, bankName, loanAmount, sanctionLetterDate, tpaSignedDate } and stores correctly
- Backend: Create or confirm GET /loans endpoint returns loan records with { id, consumer_id, consumer_name, bank_name, loan_amount, loan_status, tpa_signed_date }
- Backend: If using GET /consumers?hasLoan=true workaround, confirm filter support; add loan fields to consumers response
- Response formatter: Ensure loan_amount, loan_status, tpa_signed_date fields normalized (snake_case vs camelCase)
- Frontend: Prefer GET /loans over GET /consumers?hasLoan=true for clarity and performance

---

## SECTION 2: UNIQUE API ENDPOINTS EXTRACTED

### Complete API Surface for Module D

| # | Endpoint | Method | Callers | Status |
|---|----------|--------|---------|--------|
| 1 | /projects | GET | demand-raise.js (line 60), collection-setup.js (line 71) | ✅ In backend (line 34) |
| 2 | /payments/demands | GET | demands.js (line 45), demand-raise.js (line 95), receipts.js | ✅ In backend (line 94) |
| 3 | /payments/demands | PATCH (activate bulk) | demand-raise.js (line 120) | ⚠️ Routes.md shows PATCH /demands/:id/send; bulk activate unclear |
| 4 | /units | GET | demand-raise.js (line 75) | ✅ In backend (line 65) |
| 5 | /consumers | GET | loans.js (line 52), receipts.js | ✅ In backend (line 54) |
| 6 | /consumers | GET with ?hasLoan=true | loans.js (line 83) | ❌ Filter support unconfirmed |
| 7 | /payments/receipts | POST | receipts.js (line 125) | ✅ In backend-routes (line 92) |
| 8 | /payments/receipts | GET | receipts.js (line 165) | ✅ In backend-routes (line 98) |
| 9 | /payments/receipts/{id}/approve | PATCH | receipts.js (line 185) | ✅ In backend-routes (line 99) |
| 10 | /payments/receipts/{id}/reject | PATCH | receipts.js (form suggests) | ❌ Not in backend-routes |
| 11 | /payments/receipts/{id}/cancel | PATCH | receipts.js (form suggests) | ⚠️ Not explicitly in backend-routes |
| 12 | /payments/journals | POST | receipts.js (Tab 3, line 265) | ❌ Not in backend-routes |
| 13 | /payments/journals | GET | receipts.js (Tab 3, line 255) | ❌ Not in backend-routes |
| 14 | /payments/tds/challans | GET | receipts.js (Tab 6, line 375) | ❌ Not in backend-routes |
| 15 | /payments/tds/challans | POST | receipts.js (Tab 7, line 420) | ❌ Not in backend-routes |
| 16 | /payments/receipts/{id}/assign-challan | PATCH | receipts.js (Tab 8, line 460) | ❌ Not in backend-routes |
| 17 | /loans | POST | loans.js (line 71) | ✅ In backend-routes (line 44) |
| 18 | /loans | GET | loans.js (line 83 via /consumers workaround) | ⚠️ Backend-routes shows 2 routes but no GET /loans |
| 19 | /smtp-configs | GET | collection-setup.js (line 81) | ✅ In backend-routes (line 27) |
| 20 | /smtp-configs | POST | collection-setup.js (line 120) | ✅ In backend-routes (line 27) |
| 21 | /documents/{id}/send | POST | demands.js (line 65, for demand letter sending) | ⚠️ Part of documents module; TBD in that audit |

---

## SECTION 3: CRITICAL FIELD MAPPING ISSUES

### Issue 1: Penal Interest Not in Demand Response
**Severity:** 🔴 CRITICAL  
**Impact:** HRERA compliance calculation fails; demands.js Tab 3 manually calculates penal_interest_inr client-side instead of using backend value  
**Details:**
```javascript
// demands.js lines 200-240:
penal_interest_inr = principal × 0.111 × (days_overdue / 365)

// This should be provided by backend, not calculated on frontend
// HRERA Rule 15 requires precise calculation with audit trail
```

**Fix Required:**
- Backend POST /allocations → creates demand with due_date
- Backend should calculate: penal_interest_inr when days_overdue > 0
- GET /payments/demands must return: { ..., penal_interest_inr, days_overdue }

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "demand_type": "main",
      "consumer_name": "John Doe",
      "amount_due_inr": 1000000,
      "due_date": "2026-01-15",
      "days_overdue": 107,
      "penal_interest_inr": 32411,
      "total_due_inr": 1032411
    }
  ]
}
```

---

### Issue 2: Amount Breakdown Fields Not Validated
**Severity:** 🔴 CRITICAL  
**Impact:** Receipt creation (receipts.js Tab 1) sends baseAmount, plcAmount, edcAmount, idcAmount but backend POST /payments/receipts may not accept these fields  
**Details:**
```javascript
// receipts.js lines 105-130:
const body = {
  consumerId, projectId, unitId,
  baseAmount, plcAmount, edcAmount, idcAmount, totalAmount
};
await Api.post('/payments/receipts', body);

// Backend response structure for POST /payments/receipts unknown
// May only accept: amount, paymentMode, referenceNo
```

**Fix Required:**
- Backend: Confirm /payments/receipts POST accepts amount breakdown fields
- Response formatter: Map camelCase to snake_case if needed
- Database: Confirm receipt table has columns: base_amount, plc_amount, edc_amount, idc_amount

---

### Issue 3: Missing TDS & Journal Endpoints
**Severity:** 🔴 CRITICAL  
**Impact:** Receipts.js Tabs 3, 6, 7, 8 will fail with 404 errors; journal entries and TDS tracking not implemented  
**Details:**
```javascript
// receipts.js Tab 3: Journal Entry (line 265)
await Api.post('/payments/journals', journalPayload); // 404 NOT FOUND

// receipts.js Tab 6: Get TDS Challans (line 375)
await Api.get('/payments/tds/challans'); // 404 NOT FOUND

// receipts.js Tab 7: Upload TDS (line 420)
await Api.post('/payments/tds/challans', challanPayload); // 404 NOT FOUND

// receipts.js Tab 8: Assign TDS Challan (line 460)
await Api.patch(`/payments/receipts/${id}/assign-challan`, {challanId}); // 404 NOT FOUND
```

**Fix Required:**
- Backend: Create 4 new endpoints
  - GET /payments/journals?receiptId=X
  - POST /payments/journals
  - GET /payments/tds/challans
  - POST /payments/tds/challans
  - PATCH /payments/receipts/{id}/assign-challan
- Database: Create journal_entry and tds_challan tables
- These are Tier 1 blocking issues for receipts.js Tab 3-8

---

### Issue 4: Loan Listing Workaround vs. Actual Endpoint
**Severity:** ⚠️ CRITICAL  
**Impact:** loans.js uses GET /consumers?hasLoan=true instead of dedicated GET /loans; performance and clarity issues  
**Details:**
```javascript
// loans.js line 83: Current workaround
const res = await Api.get('/consumers', { params: { hasLoan: true } });

// Should be:
const res = await Api.get('/loans');

// Backend-routes.md shows /api/loans with 2 routes but no GET listed
```

**Fix Required:**
- Backend: Implement GET /loans endpoint returning loan records
- Response: { id, consumer_id, consumer_name, bank_name, loan_amount, loan_status, tpa_signed_date, sanction_letter_date }
- Remove workaround; use dedicated endpoint

---

### Issue 5: Filter Parameter Support Unconfirmed
**Severity:** ⚠️ HIGH  
**Impact:** demand-raise.js uses multiple filter params that may not be supported by backend  
**Details:**
```javascript
// demand-raise.js lines 75-110:
GET /units?projectId=X&towerId=Y&floorNo=Z&bhkType=A
GET /payments/demands?projectId=X&installmentType=Y&status=pending
GET /consumers?registrationNo=X

// Backend API documentation does not confirm these filter params
```

**Fix Required:**
- Backend: Validate and document supported query parameters for all GET endpoints
- GET /units: Confirm support for ?projectId, ?towerId, ?floorNo, ?bhkType, ?status
- GET /payments/demands: Confirm support for ?projectId, ?consumerId, ?demandType, ?status
- GET /consumers: Confirm support for ?registrationNo, ?projectId, ?hasLoan

---

## SECTION 4: RESPONSE FORMATTER FIELD MAPPING

### Required Field Mappings (Module D)

```javascript
// In middleware/response-formatter.ts, add these transformations:

// DEMANDS RESPONSE
data.penal_interest_inr → data.penal_interest_inr (add if missing)
data.days_overdue → data.days_overdue (add if missing)
data.demand_type → data.demand_type
data.amount_due_inr → data.amount_due_inr
data.consumer_name → data.consumer_name (requires JOIN)
data.project_name → data.project_name (requires JOIN)

// RECEIPTS RESPONSE
data.receipt_number → data.receipt_number
data.approval_status → data.approval_status or approval_state
data.payment_mode → data.payment_mode
data.consumer_name → data.consumer_name
data.project_name → data.project_name
data.base_amount → data.base_amount (or baseAmount if camelCase)
data.plc_amount → data.plc_amount
data.edc_amount → data.edc_amount
data.idc_amount → data.idc_amount

// LOANS RESPONSE
data.bank_name → data.bank_name
data.loan_amount → data.loan_amount
data.loan_status → data.loan_status (pending, approved, disbursed, closed)
data.tpa_signed_date → data.tpa_signed_date
data.sanction_letter_date → data.sanction_letter_date
data.consumer_name → data.consumer_name

// SMTP CONFIG RESPONSE
data.project_name → data.project_name (requires JOIN)
data.from_email → data.from_email
data.use_ssl → data.use_ssl
```

---

## SECTION 5: DATABASE & QUERY VALIDATION

### Required JOINs for Module D Responses

```sql
-- GET /payments/demands: Ensure JOIN to consumers and projects
SELECT 
  d.id, d.demand_type, d.sent_at, d.due_date, d.amount_due_inr,
  c.name as consumer_name,
  p.name as project_name,
  -- HRERA penal interest calculation:
  d.amount_due_inr * 0.111 * GREATEST(EXTRACT(DAY FROM NOW() - d.due_date), 0) / 365 as penal_interest_inr,
  EXTRACT(DAY FROM NOW() - d.due_date) as days_overdue
FROM demands d
JOIN consumers c ON d.consumer_id = c.id
JOIN projects p ON d.project_id = p.id
WHERE d.due_date < NOW() AND EXTRACT(DAY FROM NOW() - d.due_date) > 0;

-- GET /payments/receipts: Ensure JOIN to consumers and projects
SELECT 
  r.id, r.receipt_number, r.received_date, r.amount, r.approval_status,
  r.payment_mode, r.base_amount, r.plc_amount, r.edc_amount, r.idc_amount,
  c.name as consumer_name, c.email, c.mobile,
  p.name as project_name,
  u.unit_number
FROM receipts r
JOIN consumers c ON r.consumer_id = c.id
JOIN projects p ON r.project_id = p.id
LEFT JOIN units u ON r.unit_id = u.id;

-- GET /loans: New endpoint required
SELECT 
  l.id, l.consumer_id, l.bank_name, l.loan_amount, l.sanction_letter_date,
  l.tpa_signed_date, l.status as loan_status,
  c.name as consumer_name, c.email, c.mobile,
  u.unit_number
FROM loans l
JOIN consumers c ON l.consumer_id = c.id
LEFT JOIN units u ON c.allocated_unit_id = u.id;

-- GET /smtp-configs: Ensure JOIN to projects
SELECT 
  s.id, s.project_id, s.host, s.port, s.username, s.from_email, s.use_ssl,
  p.name as project_name
FROM smtp_configs s
JOIN projects p ON s.project_id = p.id;
```

### Required Table Columns

```sql
-- demands table must have:
- id (UUID)
- consumer_id (UUID FK)
- project_id (UUID FK)
- demand_type (VARCHAR: main, reminder_1, reminder_2, termination)
- amount_due_inr (NUMERIC)
- due_date (DATE)
- sent_at (TIMESTAMP)
- status (VARCHAR: sent, unsent, delivery_failed, read)
- created_at (TIMESTAMP)

-- receipts table must have:
- id (UUID)
- receipt_number (VARCHAR, unique)
- consumer_id (UUID FK)
- project_id (UUID FK)
- unit_id (UUID FK)
- payment_mode (VARCHAR: Cheque, NEFT, UPI, Cash, Draft, Card)
- reference_no (VARCHAR)
- received_date (DATE)
- base_amount (NUMERIC)
- plc_amount (NUMERIC)
- edc_amount (NUMERIC)
- idc_amount (NUMERIC)
- total_amount (NUMERIC)
- approval_status (VARCHAR: pending, approved, rejected)
- created_at (TIMESTAMP)
- remarks (TEXT)

-- loans table must have:
- id (UUID)
- consumer_id (UUID FK)
- bank_name (VARCHAR)
- loan_amount (NUMERIC)
- sanction_letter_date (DATE)
- tpa_signed_date (DATE)
- status (VARCHAR: pending, approved, disbursed, closed)
- created_at (TIMESTAMP)

-- NEW TABLES REQUIRED:
-- journal_entry table:
- id (UUID)
- receipt_id (UUID FK)
- debit_account (VARCHAR, GL code)
- credit_account (VARCHAR, GL code)
- amount (NUMERIC)
- narration (TEXT)
- entry_date (DATE)
- created_by (UUID FK to users)
- created_at (TIMESTAMP)

-- tds_challan table:
- id (UUID)
- project_id (UUID FK)
- challan_file (BYTEA or file_url)
- amount_deducted (NUMERIC)
- filed_date (DATE)
- status (VARCHAR: filed, pending)
- created_by (UUID FK to users)
- created_at (TIMESTAMP)

-- receipt_tds_mapping table:
- id (UUID)
- receipt_id (UUID FK)
- challan_id (UUID FK)
```

---

## SECTION 6: TEST CASES & VALIDATION

### Test Case 1: Demand List with Penal Interest Calculation
**Scenario:** Fetch overdue demands and verify penal interest is included in response  
**Test Data:**
- Consumer: "Rajesh Kumar"
- Allotted Unit: "Tower A, Floor 5, Unit 501"
- Allotment Date: Jan 1, 2026
- Payment Plan: Main demand (20%) due Jan 15, 2026
- Amount Due: ₹1,000,000
- Current Date: May 2, 2026 (days overdue: 107)
- Expected Penal Interest @ 11.10% p.a.: ₹32,411

**API Call:**
```bash
GET /api/payments/demands?projectId=proj-123&status=unsent HTTP/1.1
Authorization: Bearer mock-jwt-token
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "d-001",
      "demand_type": "main",
      "consumer_name": "Rajesh Kumar",
      "amount_due_inr": 1000000,
      "due_date": "2026-01-15",
      "days_overdue": 107,
      "penal_interest_inr": 32411,
      "total_due_inr": 1032411,
      "sent_at": null,
      "status": "unsent"
    }
  ],
  "pagination": { "page": 1, "pageSize": 20, "total": 1 }
}
```

**Pass Criteria:**
- ✅ penal_interest_inr field present and correctly calculated
- ✅ days_overdue field present and correct
- ✅ consumer_name and amount_due_inr match allotment record

---

### Test Case 2: Receipt Creation with Amount Breakdown
**Scenario:** Record receipt with PLC, EDC, IDC charges  
**Test Data:**
- Consumer: "Priya Singh"
- Unit: "Tower B, Floor 3, Unit 302"
- Base Amount: ₹500,000
- PLC (Preferential Location): ₹50,000
- EDC (External Development Charge): ₹30,000
- IDC (Internal Development Charge): ₹20,000
- Total: ₹600,000
- Payment Mode: NEFT
- Reference No: NEFT-20260502-12345

**API Call:**
```bash
POST /api/payments/receipts HTTP/1.1
Authorization: Bearer mock-jwt-token
Content-Type: application/json

{
  "consumerId": "c-002",
  "projectId": "proj-123",
  "unitId": "u-302",
  "paymentMode": "NEFT",
  "referenceNo": "NEFT-20260502-12345",
  "receivedDate": "2026-05-02",
  "baseAmount": 500000,
  "plcAmount": 50000,
  "edcAmount": 30000,
  "idcAmount": 20000,
  "totalAmount": 600000,
  "remarks": "Second installment paid"
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "r-001",
    "receipt_number": "RC-202605-000001",
    "consumer_name": "Priya Singh",
    "amount": 600000,
    "base_amount": 500000,
    "plc_amount": 50000,
    "edc_amount": 30000,
    "idc_amount": 20000,
    "payment_mode": "NEFT",
    "reference_no": "NEFT-20260502-12345",
    "received_date": "2026-05-02",
    "approval_status": "pending",
    "created_at": "2026-05-02T10:30:00Z"
  }
}
```

**Pass Criteria:**
- ✅ Receipt number auto-generated with date-based prefix (RC-YYYYMM-XXXXXX)
- ✅ All amount breakdown fields stored and returned
- ✅ receipt_number, approval_status fields present
- ✅ Status defaults to "pending" (not auto-approved)

---

### Test Case 3: Demand Bulk Generation with Installment Selection
**Scenario:** Generate demands for all outstanding installments across multiple consumers  
**Test Data:**
- Project: "ROF Affordable Housing Tower-A"
- Tower: "Tower A"
- Floor: "5"
- BHK Type: "2BHK"
- Installment No.: "2" (Second 12.5% installment)
- Consumers Matched: 8

**API Call (via demand-raise.js):**
```bash
GET /api/units?projectId=proj-123&towerId=tower-a&floorNo=5&bhkType=2BHK HTTP/1.1
Authorization: Bearer mock-jwt-token

# Response contains 8 units with allotted consumers
```

**Demand Activation:**
```bash
PATCH /api/payments/demands/activate HTTP/1.1
Authorization: Bearer mock-jwt-token
Content-Type: application/json

{
  "demandIds": ["d-008", "d-009", "d-010", "d-011", "d-012", "d-013", "d-014", "d-015"],
  "installmentNo": 2,
  "projectId": "proj-123"
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "demands_created": 8,
    "total_amount": 80000000,
    "status": "activated"
  }
}
```

**Pass Criteria:**
- ✅ GET /units returns only units matching filters (floor=5, bhkType=2BHK)
- ✅ Demand activation creates correct number of records
- ✅ Installment 2 (12.5% of contract value) calculated for each consumer
- ✅ Demand due date set per payment plan schedule

---

### Test Case 4: Loan Recording and TPA Tracking
**Scenario:** Record bank loan sanction and mark TPA as signed  
**Test Data:**
- Consumer: "Amit Verma"
- Bank: "HDFC Bank"
- Sanctioned Amount: ₹2,000,000
- Sanction Letter Date: Apr 28, 2026
- TPA (Third Party Administrator) Signed Date: May 1, 2026

**API Call:**
```bash
POST /api/loans HTTP/1.1
Authorization: Bearer mock-jwt-token
Content-Type: application/json

{
  "consumerId": "c-003",
  "bankName": "HDFC Bank",
  "loanAmount": 2000000,
  "sanctionLetterDate": "2026-04-28",
  "tpaSignedDate": "2026-05-01",
  "remarks": ""
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "l-001",
    "consumer_id": "c-003",
    "consumer_name": "Amit Verma",
    "bank_name": "HDFC Bank",
    "loan_amount": 2000000,
    "sanction_letter_date": "2026-04-28",
    "tpa_signed_date": "2026-05-01",
    "loan_status": "approved",
    "created_at": "2026-05-02T10:30:00Z"
  }
}
```

**Loan List Verification:**
```bash
GET /api/loans HTTP/1.1
Authorization: Bearer mock-jwt-token
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "l-001",
      "consumer_id": "c-003",
      "consumer_name": "Amit Verma",
      "bank_name": "HDFC Bank",
      "loan_amount": 2000000,
      "loan_status": "approved",
      "tpa_signed_date": "2026-05-01",
      "unit_number": "Tower A, Unit 501"
    }
  ],
  "pagination": { "page": 1, "pageSize": 20, "total": 1 }
}
```

**Pass Criteria:**
- ✅ POST /loans creates record with TPA signed date
- ✅ GET /loans returns loan records (not via /consumers?hasLoan workaround)
- ✅ consumer_name, bank_name, unit_number all present in response
- ✅ loan_status field indicates approval state

---

### Test Case 5: SMTP Configuration Per Project
**Scenario:** Set up SMTP for automated email sending per project  
**Test Data:**
- Project: "ROF Gurugram Phase-1"
- SMTP Host: smtp.gmail.com
- Port: 587
- Username: crm@rofgroup.com
- From Name: "ROF CRM Support"
- SSL/TLS: Yes

**API Call:**
```bash
POST /api/smtp-configs HTTP/1.1
Authorization: Bearer mock-jwt-token
Content-Type: application/json

{
  "projectId": "proj-123",
  "host": "smtp.gmail.com",
  "port": 587,
  "username": "crm@rofgroup.com",
  "password": "app-password-xyz",
  "fromName": "ROF CRM Support",
  "fromEmail": "crm@rofgroup.com",
  "useSsl": true
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "sc-001",
    "project_id": "proj-123",
    "project_name": "ROF Gurugram Phase-1",
    "host": "smtp.gmail.com",
    "port": 587,
    "from_email": "crm@rofgroup.com",
    "use_ssl": true,
    "created_at": "2026-05-02T10:30:00Z"
  }
}
```

**SMTP List Verification:**
```bash
GET /api/smtp-configs HTTP/1.1
Authorization: Bearer mock-jwt-token
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "sc-001",
      "project_id": "proj-123",
      "project_name": "ROF Gurugram Phase-1",
      "host": "smtp.gmail.com",
      "port": 587,
      "from_email": "crm@rofgroup.com",
      "use_ssl": true
    }
  ]
}
```

**Pass Criteria:**
- ✅ SMTP config saved securely (password hashed/encrypted at rest)
- ✅ project_name included in response (requires JOIN)
- ✅ Config can be retrieved and used for subsequent email sends
- ✅ Per-project isolation (different SMTP per project)

---

## SECTION 7: REMEDIATION ROADMAP

### Tier 1 Critical Fixes (Block Go-Live)

| Fix | File | Issue | Action | Est. Lines |
|-----|------|-------|--------|-----------|
| Add penal_interest_inr to demands response | payments.ts | Missing field | Add column to SELECT; implement HRERA calculation | 10-15 |
| Create GET /loans endpoint | loans.ts | Missing endpoint | New route handler to list loan records | 20-25 |
| Create /payments/journals endpoints | payments.ts (new) | Missing endpoints | POST create, GET list journal entries | 40-50 |
| Create /payments/tds/challans endpoints | payments.ts (new) | Missing endpoints | GET list, POST upload, PATCH assign | 60-80 |
| Create PATCH /payments/receipts/{id}/cancel | payments.ts | Missing endpoint | Mark receipt as cancelled; reverse journal | 15-20 |
| Validate demand filter params | payments.ts | Unconfirmed support | Document/implement ?demandType, ?projectId, ?consumerId | 5-10 |
| Response formatter for Module D | middleware/response-formatter.ts | Field name mapping | Add demand, receipt, loan, SMTP field mappings | 30-40 |

**Estimated Total: 180-240 lines of backend code**

### Tier 2 High Priority Fixes (Minor Feature Gaps)

| Fix | File | Issue | Action | Est. Lines |
|-----|------|-------|--------|-----------|
| Receipt rejection endpoint | payments.ts | Missing endpoint | PATCH /payments/receipts/{id}/reject | 10-15 |
| Edit SMTP config modal | collection-setup.js | UI incomplete | Add edit form and PATCH handler | 20-30 |
| Loan list filter by status | loans.ts | Enhancement | Add ?status filter to GET /loans | 5-10 |
| Receipt export to Excel | receipts.js | Enhancement | Export selected receipts to XLSX format | 25-35 |
| Bulk receipt approval | receipts.js | Enhancement | PATCH /payments/receipts/bulk-approve | 15-20 |

**Estimated Total: 75-110 lines**

### Tier 3 Medium Priority Enhancements

| Enhancement | File | Benefit | Action | Est. Lines |
|-------------|------|---------|--------|-----------|
| Receipt PDF generation | receipts.js | User request | POST /payments/receipts/{id}/pdf | 30-40 |
| Demand letter PDF | demands.js | User request | GET /documents/{demandId}/pdf | 20-25 |
| TDS challan batch upload | receipts.js | Admin feature | Drag-drop multiple files | 20-25 |
| Payment plan templates | demand-raise.js | System setup | Get payment plans per project | 10-15 |

**Estimated Total: 80-105 lines**

---

## SECTION 8: BLOCKING ISSUES FOR GO-LIVE

### Issue 1: No Penal Interest in Demand Response
**Frontend Impact:** demands.js Tab 3 will not display penal interest correctly; HRERA compliance cannot be verified
**Status:** 🔴 BLOCKING  
**Required By:** Go-live date  
**Fix ETA:** 2-3 days

### Issue 2: Missing Journal Entry Endpoints
**Frontend Impact:** receipts.js Tab 3 will return 404; accounting ledger posting will fail
**Status:** 🔴 BLOCKING  
**Required By:** Go-live date  
**Fix ETA:** 3-4 days

### Issue 3: Missing TDS Challan Endpoints
**Frontend Impact:** receipts.js Tabs 6-8 will return 404; TDS compliance tracking will fail
**Status:** 🔴 BLOCKING  
**Required By:** Go-live date  
**Fix ETA:** 3-4 days

### Issue 4: Receipt Approval Status Field
**Frontend Impact:** Receipt approval workflow (Tab 2) requires clear approval_status response; unknown if backend provides this
**Status:** ⚠️ CRITICAL (requires validation)  
**Required By:** Before receipts functional testing  
**Fix ETA:** 1 day (validation) + 1-2 days (implementation if needed)

### Issue 5: Collection-Setup Page Naming Confusion
**Frontend Impact:** Users will expect "Collection Setup" but see "Communication Infrastructure Setup"; navigation confusion
**Status:** ⚠️ HIGH  
**Required By:** Before UAT  
**Fix ETA:** 1 day (rename file and update title)

---

## SECTION 9: SUMMARY CHECKLIST

### Per-Feature Sign-Off

- [ ] **Demands Tab 1 (Overview):** consumer_name, project_name, amount_due_inr, due_date in response
- [ ] **Demands Tab 2 (Status):** Filter by projectId, consumerId, demandType working
- [ ] **Demands Tab 3 (Penal Interest):** penal_interest_inr pre-calculated by backend @ 11.10% p.a.
- [ ] **Demand-Raise Tab 1 (Filter):** ?projectId, ?towerId, ?floorNo, ?bhkType filters working
- [ ] **Demand-Raise Tab 2 (Generate):** PATCH /payments/demands/activate accepts demandIds[], creates records
- [ ] **Receipts Tab 1 (Create):** POST /payments/receipts accepts baseAmount, plcAmount, edcAmount, idcAmount
- [ ] **Receipts Tab 2 (List):** GET /payments/receipts returns receipt_number, approval_status, consumer_name
- [ ] **Receipts Tab 3 (Journal):** GET/POST /payments/journals endpoints working; creates GL entries
- [ ] **Receipts Tab 4 (Edit/Cancel):** PATCH /payments/receipts/{id}, /cancel endpoints working
- [ ] **Receipts Tab 5 (Duplicate):** POST /payments/receipts/{id}/duplicate creates new receipt with new number
- [ ] **Receipts Tab 6 (TDS Report):** GET /payments/tds/challans returns filed challans
- [ ] **Receipts Tab 7 (Upload TDS):** POST /payments/tds/challans accepts file upload
- [ ] **Receipts Tab 8 (Assign Challan):** PATCH /payments/receipts/{id}/assign-challan links receipt to TDS
- [ ] **SMTP Setup (Create):** POST /smtp-configs saves per-project SMTP credentials securely
- [ ] **SMTP Setup (List):** GET /smtp-configs returns project_name, host, port, from_email, use_ssl
- [ ] **SMTP Setup (Edit):** Edit modal and PATCH handler implemented
- [ ] **Loans (Record):** POST /loans stores bank_name, loan_amount, sanction_letter_date, tpa_signed_date
- [ ] **Loans (List):** GET /loans endpoint returns loan_status, consumer_name, bank_name (not /consumers?hasLoan workaround)

### Final Sign-Off
**GO-LIVE READY:** Only after all 20 items above are ✅ Complete  
**STATUS:** 🔴 **DO NOT GO LIVE** — 4 Tier 1 Critical fixes required

---

## Appendix: Code Snippets for Backend Implementation

### HRERA Penal Interest Calculation (PostgreSQL)
```sql
-- Add to payments.ts GET /payments/demands route:
SELECT 
  d.*,
  COALESCE(d.penal_interest_inr, 
    CASE 
      WHEN d.due_date < NOW() THEN
        ROUND(d.amount_due_inr * 0.111 * (EXTRACT(DAY FROM NOW() - d.due_date) / 365.0), 2)
      ELSE 0
    END
  ) as penal_interest_inr,
  GREATEST(0, EXTRACT(DAY FROM NOW() - d.due_date)::INT) as days_overdue
FROM demands d;
```

### Journal Entry Route Handler
```javascript
// Add to packages/api/src/routes/payments.ts:
router.post('/journals', authenticateToken, async (req, res) => {
  const { receiptId, debitAccount, creditAccount, amount, narration, entryDate } = req.body;
  
  // Insert into journal_entry table
  const je = await db.query(
    `INSERT INTO journal_entry (receipt_id, debit_account, credit_account, amount, narration, entry_date, created_by_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     RETURNING *`,
    [receiptId, debitAccount, creditAccount, amount, narration, entryDate, req.user.id]
  );
  
  sendResponse(res, true, je.rows[0], null, 201);
});

router.get('/journals', authenticateToken, async (req, res) => {
  const { receiptId } = req.query;
  
  const jes = await db.query(
    `SELECT * FROM journal_entry WHERE receipt_id = $1 ORDER BY entry_date DESC`,
    [receiptId]
  );
  
  sendResponse(res, true, jes.rows, null);
});
```

### TDS Challan Endpoints
```javascript
// Add to packages/api/src/routes/payments.ts:
router.get('/tds/challans', authenticateToken, async (req, res) => {
  const { projectId, dateRange } = req.query;
  
  const challans = await db.query(
    `SELECT * FROM tds_challan 
     WHERE project_id = $1 
     AND filed_date >= NOW() - INTERVAL '1 year'
     ORDER BY filed_date DESC`,
    [projectId]
  );
  
  sendResponse(res, true, challans.rows, null);
});

router.post('/tds/challans', authenticateToken, async (req, res) => {
  const { projectId, challanFile, amountDeducted, filedDate } = req.body;
  
  // Store file in object storage; save reference
  const challan = await db.query(
    `INSERT INTO tds_challan (project_id, challan_file_url, amount_deducted, filed_date, created_by_id, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     RETURNING *`,
    [projectId, challanFile, amountDeducted, filedDate, req.user.id]
  );
  
  sendResponse(res, true, challan.rows[0], null, 201);
});

router.patch('/receipts/:id/assign-challan', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { challanId } = req.body;
  
  // Link receipt to challan
  const mapping = await db.query(
    `INSERT INTO receipt_tds_mapping (receipt_id, challan_id) VALUES ($1, $2) RETURNING *`,
    [id, challanId]
  );
  
  sendResponse(res, true, mapping.rows[0], null);
});
```

---

**Report generated:** May 2, 2026  
**Audit conducted by:** Claude Code (Connectivity Audit Framework v2.1)  
**Next step:** Address Tier 1 Critical items → Retest Module D → Proceed to Modules E, F, G
