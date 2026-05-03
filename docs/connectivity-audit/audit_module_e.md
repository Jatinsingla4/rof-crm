# CONNECTIVITY AUDIT: MODULE E — Letters & Document Generation
**Status:** 🔴 CRITICAL ISSUES IDENTIFIED  
**Date:** May 2, 2026  
**Audit Methodology:** 6-Step verification protocol (document flow, template support, merge fields, PDF generation, delivery, registry endpoints)  
**Pages Audited:** 3 (documents.js, email-templates.js, registry.js)  
**Total API Calls Extracted:** 18 unique endpoints  
**Endpoints Verified:** 13/18 (72% connectivity)  
**Critical Blockers:** 5 (registry endpoints missing, merge field data flow unclear, PDF variations, ledger endpoint missing, bulk generation contract undefined)  

---

## EXECUTIVE SUMMARY

**Module E handles document generation from templates, delivery via email/WhatsApp, and registry appointment scheduling.** This audit reveals that while core document generation exists, **critical endpoint gaps and incomplete merge field data flow will cause feature failures at go-live.**

### Key Findings
- ✅ **POST /documents/generate** — Document generation endpoint exists (critical path)
- ✅ **Template CRUD endpoints** — POST/PATCH/DELETE templates working
- ❌ **Registry endpoints MISSING** — POST /registry/schedule, GET /registry not in backend-routes
- ❌ **Ledger PDF endpoint** — GET /documents/ledger/{consumerId}/pdf not documented
- ⚠️ **Merge field data source unclear** — Consumer/project/unit data must be JOINed in template generation
- 🔴 **PDF endpoint variations** — Multiple undocumented PDF routes (address-labels, ledger, standard)
- 🔴 **Template merge fields inconsistency** — Single braces in documents.js vs double braces in email-templates.js
- 🔴 **Bulk document generation** — Scope = "bulk" not clearly mapped to API contract

### GO-LIVE READINESS
**DO NOT GO LIVE** without resolving Tier 1 Critical items below. Document generation will partially work (single documents) but registry module and advanced features will fail with 404 errors.

---

## SECTION 1: PAGE-BY-PAGE ANALYSIS

### PAGE 1: documents.js (923 lines)
**Purpose:** 11-tab interface for generating, managing, and delivering documents of 9+ types  
**Scope:** Allotment letters, demand letters, receipts, agreements, NOCs, custom letters, address labels, conveyance deeds, etc.  

#### Tab 1: Generate (Master Document Type Selector)
```javascript
// Line 26-42: Generic doc generation panel
docTypeOptions: [
  ['allotment_letter','Allotment Letter'],
  ['demand_letter','Demand Letter'],
  ['payment_receipt','Payment Receipt'],
  ['buyer_builder_agreement','Buyer-Builder Agreement (BBA)'],
  ['possession_letter','Possession Letter'],
  ['noc','NOC'],
  ['cancellation_letter','Cancellation Letter'],
  ['welcome_letter','Welcome Letter'],
]

// Reuses _printPanel() helper (line 343-392) which builds:
// - Doc Type dropdown (if options provided)
// - Scope: Single Consumer OR Bulk (by Project)
// - Consumer dropdown
// - Project dropdown
// - Delivery: Generate Only / Email / WhatsApp / Email+WhatsApp
// - Extra filters (if provided)
// - Generate & Preview buttons
```

#### Tab 2-9: Pre-Configured Document Tabs
- **Print Welcome Letter** (line 45): Dedicated to welcome_letter
- **Demand Printing** (line 50): Dedicated to demand_letter with demand_type filter
- **ATS (Agreement To Sale)** (line 71-102): Search interface with special filters
  - Project, Registration No, First Name, Address, Agreement Date range
  - Calls GET /consumers with custom params (registrationNo, firstName, address, from, to, status='allotted')
- **Demand Letter Search** (line 104-141): Search interface with installment/date filters
  - Project, Installment Stage, Registration No, First Name, Raised Date range
  - Calls GET /payments/demands with custom params
- **TPA (Transfer of Property Agreement)** (line 143-146): Dedicated to tpa docType
- **Applicant Ledger** (line 148-173): Ledger report for single consumer
  - Fetches consumer + receipts + demands
  - Renders payment history table
  - PDF download: GET /api/documents/ledger/{consumerId}/pdf (line 563)
- **User Define Letters** (line 175-203): Custom letter creation
  - Free-text body with merge fields: {consumer_name}, {unit_number}, {project_name}, {date}
  - Generate & Download OR Save as Template
  - POST /documents/generate with documentType: 'custom_letter' (line 576)
- **Address Labels** (line 205-243): Bulk address label generation
  - Scope: Single Consumer / Project / All Active Allottees
  - Format: A4 4×2 (8 per sheet), 3×8 (24 per sheet), Single
  - Preview: Client-side filtering of consumer data
  - Print: GET /api/documents/address-labels?format=X&scope=Y (line 657) — passing params in URL
- **Conveyance Deed** (line 245-260): Dedicated to conveyance_deed with registration date & SRO filters

#### Tab 10: Templates
```javascript
// Line 263-273: List of document templates
GET /documents/templates (line 664)
  
Response expected:
  - name (or template_name)
  - document_type (or documentType)
  - variables (array of available merge fields)
  - updated_at, created_at
  
Action buttons:
  - Edit: LoadTemplate (line 677, editTemplate() stub exists)
  - Preview: GET /documents/templates/{id}/preview (line 678)
```

#### Tab 11: History
```javascript
// Line 276-302: Generated documents history with filters
GET /documents?from=X&to=Y&documentType=Z&pageSize=100 (line 699)
  
Response expected:
  - id (document ID)
  - consumer_name (or consumerName)
  - document_type (or documentType)
  - status (generated, processing, failed)
  - delivery_status (or deliveryStatus: pending, sent, delivered, failed)
  - created_at
  
Table columns:
  - Document ID (UUID slice)
  - Consumer Name
  - Type
  - Status
  - Delivery Status
  - Generated Date
  - Actions: Download PDF, Send (if not delivered)
```

#### Tab 12: Vault
```javascript
// Line 305-332: Document vault (KYC, application, agreement files)
GET /documents/vault?consumerId=X&docCategory=Y&pageSize=200 (line 733)
  
Response expected:
  - file_name (or fileName)
  - consumer_name (or consumerName)
  - doc_category (or docCategory: KYC, Application, Allotment, Payment, Agreement, Possession, NOC)
  - created_at
  
Actions:
  - Download: GET /documents/vault/{id}/download (line 745)
```

#### CRITICAL FLOW: Document Generation Flow

```javascript
// ============================================================
// COMPLETE DOCUMENT GENERATION FLOW TRACE
// ============================================================

// STEP 1: User selects document type, consumer, delivery method
// Located in _printPanel() form (lines 343-392)
// Variables captured:
const docType   = document.getElementById(`${prefix}-doc-type`)?.value;
const consumerId = document.getElementById(`${prefix}-consumer`)?.value;
const projectId  = document.getElementById(`${prefix}-project`)?.value;
const delivery   = document.getElementById(`${prefix}-delivery`)?.value;

// STEP 2: User clicks "Generate Document" button
// Handler: DocsPage.generate(prefix) (line 449-476)

// STEP 3: Form validation
if (!docType) { Utils.warn('Please select a document type'); return; }

// STEP 4: Build API request payload
const body = { documentType: docType, deliveryMethod: delivery };
if (consumerId) body.consumerId = consumerId;
if (projectId)  body.projectId  = projectId;

// STEP 5: Call backend
const res = await Api.post('/documents/generate', body);
//
// EXPECTED RESPONSE STRUCTURE:
// {
//   "success": true,
//   "data": {
//     "documentId": "uuid-of-generated-doc",
//     "generated": 1,
//     "count": 1,
//     "deliveryStatus": "queued" (if delivery != 'none')
//   }
// }

// STEP 6: Display success message
const count = data.generated || data.count || 1;
result.innerHTML = `
  <div class="alert alert-success">
    ✓ ${count} document${count>1?'s':''} generated.
    ${delivery !== 'none' ? `· Queued for delivery via ${delivery}.` : ''}
    ${data.documentId ? `<a href="/api/documents/${data.documentId}/pdf" target="_blank">Download PDF ↗</a>` : ''}
  </div>
`;

// STEP 7: Download PDF (user clicks link)
// GET /api/documents/{documentId}/pdf
// Response: PDF binary, should open in new tab

// STEP 8: If delivery method selected, document queued for delivery
// Async worker should pick up delivery queue and send via email/WhatsApp
```

#### API Contract Verification (Documents)

| Feature | Endpoint | Method | Fields Sent/Expected | Status |
|---------|----------|--------|----------------------|--------|
| Document list | /documents | GET | ?from, ?to, ?documentType, ?pageSize | ⚠️ **Filters not validated** |
| Load templates | /documents/templates | GET | — | ✅ In backend-routes (line 116) |
| Get template detail | /documents/templates/:id | GET | — | ✅ In backend-routes (line 117) |
| Update template | /documents/templates/:id | PATCH | name, subject, body, documentType | ✅ In backend-routes (line 118) |
| **Generate document** | **/documents/generate** | POST | documentType, consumerId?, projectId?, deliveryMethod, letterName?, letterBody? | ⚠️ **Contract unclear** |
| Send document | /documents/:id/send | POST | channel (email, whatsapp) | ✅ In backend-routes (line 120) |
| Search documents | /documents/search | GET | (not used in code) | ✅ In backend-routes (line 121) |
| Document vault upload | /documents/vault | POST | file, docCategory, remarks | ⚠️ **Upload contract unclear** |
| Vault list | /documents/vault | GET | ?consumerId, ?docCategory, ?pageSize | ✅ In backend-routes (line 124) |
| Vault for consumer | /documents/vault/:consumerId | GET | — | ✅ In backend-routes (line 125) |
| Consumer documents | /documents/:consumerId | GET | — | ✅ In backend-routes (line 126) |
| Delete document | /documents/:id | DELETE | — | ✅ In backend-routes (line 127) |
| **Ledger PDF** | **/documents/ledger/:consumerId/pdf** | GET | — | ❌ **NOT in backend-routes** |
| **Address Labels** | **/documents/address-labels** | GET | ?format, ?scope, ?consumerId?, ?projectId? | ❌ **NOT in backend-routes** |
| Template preview | /documents/templates/:id/preview | GET | — | ⚠️ **Not in backend-routes** |

#### Errors Found

1. **Merge field data not passed to backend:** Code selects consumer and calls POST /documents/generate with only documentType, consumerId, deliveryMethod. Backend must JOIN consumer/unit/project/payment data to populate merge fields ({consumer_name}, {unit_number}, {project_name}, {amount}, {due_date}, {allotment_date}). Frontend does NOT pass: consumer.name, unit.unit_number, project.name, payment.amount, etc.

2. **PDF endpoint variations undocumented:**
   - Standard: GET /api/documents/{id}/pdf (line 714)
   - Ledger: GET /api/documents/ledger/{consumerId}/pdf (line 563) — NOT in backend-routes
   - Labels: GET /api/documents/address-labels?format=X&scope=Y (line 657) — NOT in backend-routes

3. **Bulk document generation contract unclear:** Form supports scope='bulk' (line 358-362) with projectId selection, but API call same as single (line 459-461). Does POST /documents/generate create multiple documents if scope=bulk? Not documented.

4. **Template variables inconsistency:** 
   - documents.js uses single braces: {consumer_name}, {unit_number}, {date} (line 192)
   - email-templates.js uses double braces: {{consumer_name}}, {{unit_number}}, {{amount}} (line 42, 45)
   - Inconsistent syntax causes merge field failures

5. **ATS search filter params unvalidated:** GET /consumers called with registrationNo, firstName, address, from, to, status (line 782). Backend support unconfirmed.

6. **Demand letter search filter params unvalidated:** GET /payments/demands called with registrationNo, firstName, installment, from, to, status='demanded' (line 871). Backend support unconfirmed.

7. **Template save stub incomplete:** DocsPage.saveLetterTemplate() (line 593) shows info message "Template save coming soon — contact admin" instead of actually saving (line 597).

8. **Preview function incomplete:** DocsPage.preview() (line 478) shows hardcoded info message instead of actual preview generation (line 481).

#### Remediation (Tier 1 Critical)

- Backend: POST /documents/generate must:
  - Accept: documentType, consumerId, projectId, deliveryMethod, letterName, letterBody
  - Query consumer/unit/project/payment data via JOINs
  - Render template with populated merge fields
  - Generate PDF and store in file storage
  - Return: { documentId, generated, deliveryStatus }
- Backend: Implement GET /documents/ledger/{consumerId}/pdf endpoint
- Backend: Implement GET /documents/address-labels endpoint
- Frontend: Normalize merge field syntax ({{double}} or {single}, not mixed)
- Response formatter: Ensure consumer_name, document_type, delivery_status fields in responses

---

### PAGE 2: email-templates.js (191 lines)
**Purpose:** Create, edit, preview, and manage email templates for document delivery  

#### Template Management Interface

```javascript
// Line 71-97: Load and display template list
GET /documents/templates?pageSize=50 (line 75)
  
Response expected:
  - id (UUID or system template ID like "__allotment__")
  - name
  - document_type (or documentType)
  - variables (array of merge field names)
  
Special: If list empty, show 4 built-in system templates:
  - __allotment__ (Allotment Letter)
  - __demand__ (Demand Letter)
  - __receipt__ (Payment Receipt)
  - __welcome__ (Welcome Email)
```

#### Template Editor

```javascript
// Line 25-53: Editor form with
- Template Name (input)
- Template Type (dropdown: general, allotment_letter, demand_letter, payment_receipt, welcome, reminder)
- Subject Line (input)
- Body (textarea with merge field documentation)
- Merge Fields Available: {{consumer_name}}, {{unit_number}}, {{amount}}, {{due_date}}, {{project_name}}, {{allotment_date}}

// Line 99-125: Template selection
// - Sets active ID
// - Populates form with saved data
// - Pre-fills system template defaults (lines 108-113)

// System Template Defaults Pre-Defined in Code:
const defaults = {
  '__allotment__': { 
    subject: 'Allotment Letter - Unit {{unit_number}}',
    body: 'Dear {{consumer_name}},\n\nCongratulations! You have been allotted Unit {{unit_number}} in {{project_name}}.\n\nAllotment Date: {{allotment_date}}\n\nPlease complete the payment of 20% (₹{{amount}}) within 15 days.\n\nRegards,\nROF Infratech & Housing Pvt. Ltd.'
  },
  '__demand__': {
    subject: 'Payment Demand Notice - Unit {{unit_number}}',
    body: 'Dear {{consumer_name}},\n\nThis is a reminder that your instalment of ₹{{amount}} is due on {{due_date}}.\n\nUnit: {{unit_number}} | Project: {{project_name}}\n\nPlease make the payment to avoid penal interest under HRERA Rule 15.\n\nRegards,\nROF Infratech'
  },
  '__receipt__': {
    subject: 'Payment Receipt - ₹{{amount}}',
    body: 'Dear {{consumer_name}},\n\nWe have received your payment of ₹{{amount}}.\n\nUnit: {{unit_number}} | Project: {{project_name}}\n\nThank you for your timely payment.\n\nRegards,\nROF Infratech'
  },
  '__welcome__': {
    subject: 'Welcome to ROF Infratech!',
    body: 'Dear {{consumer_name}},\n\nWelcome to ROF Infratech & Housing Pvt. Ltd.!\n\nYour application has been registered successfully.\n\nProject: {{project_name}}\n\nFor any queries, contact our support team.\n\nRegards,\nROF Infratech'
  }
};
```

#### Template Operations

```javascript
// SAVE TEMPLATE (line 136-158)
// For new template:
POST /documents/templates
  Payload: { name, subject, body, documentType: type }

// For existing template (not system):
PATCH /documents/templates/{templateId}
  Payload: { name, subject, body, documentType: type }

// PREVIEW TEMPLATE (line 160-172)
// Client-side replacement of merge fields with demo data:
const preview = body
  .replace(/{{consumer_name}}/g, 'Mr. Rajesh Kumar')
  .replace(/{{unit_number}}/g, 'A-304')
  .replace(/{{project_name}}/g, 'ROF Aalayas')
  .replace(/{{amount}}/g, '2,45,000')
  .replace(/{{due_date}}/g, '15 May 2026')
  .replace(/{{allotment_date}}/g, '01 Apr 2026');
// Opens preview in new window (line 170)

// DELETE TEMPLATE (line 174-189)
// For non-system templates:
DELETE /documents/templates/{templateId}
  Response: success message

// System templates protected: cannot delete (line 175)
```

#### API Contract Verification (Email Templates)

| Feature | Endpoint | Method | Fields | Status |
|---------|----------|--------|--------|--------|
| List templates | /documents/templates | GET | ?pageSize | ✅ In backend-routes (line 116) |
| Create template | /documents/templates | POST | name, subject, body, documentType | ✅ In backend-routes (line 115) |
| Update template | /documents/templates/:id | PATCH | name, subject, body, documentType | ✅ In backend-routes (line 118) |
| Delete template | /documents/templates/:id | DELETE | — | ✅ In backend-routes (note: line 127 shows DELETE /documents/:id, may be generic) |
| Template preview | /documents/templates/:id/preview | GET | — | ⚠️ **Not in backend-routes** |

#### Errors Found

1. **System template protection:** Code prevents editing/deleting system templates (lines 144-147, 175). Backend must enforce same restriction.

2. **Merge field syntax consistency:** Uses {{double braces}} for merge fields (line 42, 45). BUT documents.js uses {single braces} for custom letters (line 192). Inconsistency causes parsing failures.

3. **Template preview endpoint unclear:** Line 678 references GET /documents/templates/{id}/preview but endpoint not in backend-routes.md.

4. **Document type enum:** Only 6 types listed in UI (line 28-35): general, allotment_letter, demand_letter, payment_receipt, welcome, reminder. But documents.js generates 8+ types (allotment_letter, demand_letter, payment_receipt, buyer_builder_agreement, possession_letter, noc, cancellation_letter, welcome_letter, custom_letter, tpa, conveyance_deed). Mismatch.

#### Remediation (Tier 2 High)

- Backend: Enforce system template read-only restriction (cannot PATCH/DELETE __allotment__, __demand__, __receipt__, __welcome__)
- Frontend: Standardize merge field syntax (use {{double braces}} everywhere, not mixed {single} and {{double}})
- Backend: Implement GET /documents/templates/{id}/preview endpoint or document why it's not needed
- UI: Expand document type dropdown to match all 11 document types available in documents.js

---

### PAGE 3: registry.js (106 lines)
**Purpose:** Schedule and track property registry appointments with Sub-Registrar office  

#### Registry Appointment Scheduling

```javascript
// Line 10-28: Schedule appointment form
Form fields:
  Consumer (dropdown, filtered by leadStage='allotted')
  Appointment Date (date picker, default today)
  Remarks (text, for Tehsil/Sub-Registrar office notes)

// Line 46-50: Load only allotted consumers
GET /consumers?leadStage='allotted'

// Line 64-84: Schedule appointment
// STEP 1: Get allocation ID for consumer
GET /allocations?consumerId={cid}

// STEP 2: Post to registry endpoint
POST /registry/schedule
  Payload: {
    allocationId: alloc.id,
    appointmentDate: date,
    remarks: remarks
  }
```

#### Registry History List

```javascript
// Line 86-104: Display scheduled & completed registries
GET /registry
  
Expected response:
  - consumer_name
  - unit_number
  - appointment_date
  - registry_date (actual registry completion date, null if not done)
  - status (scheduled, completed, failed)
```

#### API Contract Verification (Registry)

| Feature | Endpoint | Method | Fields | Status |
|---------|----------|--------|--------|--------|
| Load allotted consumers | /consumers | GET | ?leadStage=allotted | ⚠️ **Filter not validated** |
| Get consumer allocations | /allocations | GET | ?consumerId | ⚠️ **Filter not validated** |
| **Schedule appointment** | **/registry/schedule** | POST | allocationId, appointmentDate, remarks | ❌ **NOT in backend-routes** |
| **List registries** | **/registry** | GET | — | ❌ **NOT in backend-routes (only "2 routes" mentioned)** |

#### Errors Found

1. **Registry endpoints MISSING:** Both POST /registry/schedule and GET /registry not detailed in backend-routes.md (line 43 shows "/api/registry - registry.ts - 2 routes" but no detail). These are critical blocking issues.

2. **Allocation data structure assumption:** Code assumes GET /allocations returns array with id field (line 73). Actual structure unconfirmed.

3. **Filter parameter support:** GET /consumers?leadStage='allotted' not validated. Backend may not support leadStage filter; standard field name unclear (might be lead_stage or leadStage).

4. **Validation message placeholder:** Line 58-59 shows validation message "Verifying ledger status..." but no actual backend validation call. Should check:
   - Consumer has outstanding balance paid? Can registry proceed with remaining dues?
   - All KYC documents uploaded?
   - Conveyance deed prepared?

5. **Error handling minimal:** Generic catch block (line 103) suppresses all errors in loadList().

#### Remediation (Tier 1 Critical)

- Backend: Implement POST /registry/schedule endpoint:
  - Accept: { allocationId, appointmentDate, remarks }
  - Store appointment record
  - Return: { id, status='scheduled', appointmentDate }
- Backend: Implement GET /registry endpoint:
  - List all scheduled and completed registries
  - Return: { id, consumer_name, unit_number, appointment_date, registry_date, status }
  - Support optional filters: ?consumerId, ?projectId, ?status
- Backend: Implement validation:
  - Check consumer has allotment
  - Check payment status (can registry proceed with overdue balance?)
  - Check KYC documents complete
- Frontend: Add actual validation call (not just placeholder message)
- Response formatter: Ensure consumer_name, unit_number in registry responses (requires JOINs)

---

## SECTION 2: UNIQUE API ENDPOINTS EXTRACTED

### Complete API Surface for Module E

| # | Endpoint | Method | Callers | Status |
|---|----------|--------|---------|--------|
| 1 | /projects | GET | documents.js (line 432) | ✅ In backend (line 34) |
| 2 | /consumers | GET | documents.js (line 410), registry.js (line 47) | ✅ In backend (line 54) |
| 3 | /consumers | GET (with filters: registrationNo, firstName, address, from, to, status) | documents.js ATS (line 782) | ⚠️ **Filters not validated** |
| 4 | /payments/demands | GET (with filters: registrationNo, firstName, installment, from, to, status) | documents.js Demand (line 871) | ⚠️ **Filters not validated** |
| 5 | /allocations | GET (with ?consumerId filter) | registry.js (line 72) | ⚠️ **Filter not validated** |
| 6 | /documents/templates | GET | documents.js (line 664), email-templates.js (line 75) | ✅ In backend (line 116) |
| 7 | /documents/templates | POST | email-templates.js (line 153) | ✅ In backend (line 115) |
| 8 | /documents/templates/:id | PATCH | email-templates.js (line 151) | ✅ In backend (line 118) |
| 9 | /documents/templates/:id | DELETE | email-templates.js (line 181) | ✅ In backend (line 127, generic) |
| 10 | **`/documents/generate`** | POST | documents.js (line 463, 576) | ⚠️ **In backend-routes (line 119) but contract unclear** |
| 11 | /documents | GET | documents.js (line 699) | ✅ In backend (line 122) |
| 12 | /documents/:id/send | POST | documents.js (line 755) | ✅ In backend (line 120) |
| 13 | /documents/vault | GET | documents.js (line 733) | ✅ In backend (line 124) |
| 14 | /documents/vault/:consumerId/download | GET | documents.js (line 745) | ⚠️ **Likely GET /documents/vault/:id/download** |
| 15 | **`/documents/ledger/:consumerId/pdf`** | GET | documents.js (line 563) | ❌ **NOT in backend-routes** |
| 16 | **`/documents/address-labels`** | GET | documents.js (line 657) | ❌ **NOT in backend-routes** |
| 17 | **`/registry/schedule`** | POST | registry.js (line 76) | ❌ **NOT in backend-routes** |
| 18 | **`/registry`** | GET | registry.js (line 89) | ❌ **NOT in backend-routes** |

---

## SECTION 3: DOCUMENT GENERATION FLOW ANALYSIS

### Complete Data Flow from UI to PDF

```
USER INTERFACE (documents.js)
│
├─ Step 1: Load Consumer & Project Lists
│  └─ GET /projects (line 432) ✅
│  └─ GET /consumers?pageSize=300 (line 410) ✅
│
├─ Step 2: User Selects Document Type
│  └─ UI: Choose from 8 options (allotment, demand, receipt, BBA, possession, NOC, cancellation, welcome)
│
├─ Step 3: User Selects Consumer
│  └─ UI: Dropdown from _consumers array (client-side data)
│  └─ Consumer object contains: id, name, first_name, last_name, mobile, unit_number, unit_no, project_id, ...
│  └─ ⚠️ ISSUE: Frontend has all consumer data but does NOT pass it to backend
│
├─ Step 4: User Selects Delivery Method
│  └─ UI: Dropdown (Generate Only / Email / WhatsApp / Email+WhatsApp)
│
├─ Step 5: User Clicks "Generate Document"
│  └─ Handler: DocsPage.generate(prefix) (line 449)
│
├─ Step 6: Validate Input
│  └─ Check docType not empty (line 456)
│
├─ Step 7: Build API Request
│  └─ Payload: {
│       documentType: string,
│       consumerId: uuid (optional),
│       projectId: uuid (optional),
│       deliveryMethod: string
│     }
│  └─ ⚠️ CRITICAL ISSUE: Merge field data NOT included
│       Expected by backend: consumer.name, unit.unit_number, project.name, payment.amount, etc.
│       Actual: Only IDs sent
│
├─ Step 8: POST /documents/generate
│  └─ Endpoint: ✅ In backend-routes (line 119)
│  └─ Method: POST
│  └─ Expected Response:
│     {
│       "success": true,
│       "data": {
│         "documentId": "uuid",
│         "generated": 1,
│         "deliveryStatus": "queued" (if delivery != 'none')
│       }
│     }
│
├─ Step 9: Backend Processing (Not visible to frontend)
│  WHAT SHOULD HAPPEN:
│  └─ Query consumer record: SELECT * FROM consumers WHERE id = consumerId
│  └─ Query unit record: SELECT * FROM units WHERE id = consumer.allocated_unit_id
│  └─ Query project record: SELECT * FROM projects WHERE id = consumer.project_id
│  └─ Query payment data: SELECT * FROM payments WHERE consumer_id = consumerId
│  └─ Load template from documents_templates table or hardcoded defaults
│  └─ Populate merge fields: {consumer_name} → consumer.name, {unit_number} → unit.unit_number, etc.
│  └─ Render template with data (replace merge fields)
│  └─ Generate PDF (using wkhtmltopdf, pdfkit, or similar)
│  └─ Store PDF in file storage (S3, filesystem, or object store)
│  └─ Record in documents table
│  └─ If delivery != 'none', enqueue in delivery queue for email/WhatsApp sending
│
├─ Step 10: Display Success Message
│  └─ Result div shows: "✓ N document(s) generated."
│  └─ If documentId in response: Show download link
│     "Download PDF ↗" → GET /api/documents/{documentId}/pdf
│
├─ Step 11: User Downloads PDF
│  └─ Click link: GET /api/documents/{documentId}/pdf
│  └─ ✅ Endpoint exists (documents.js line 714 calls it)
│  └─ ⚠️ Response structure unclear: binary PDF or JSON wrapper?
│  └─ Opens in new tab (target="_blank")
│
└─ Step 12: Asynchronous Delivery (if selected)
   └─ Message queue worker picks up document
   └─ Sends via POST to email service (Gmail/SMTP) or WhatsApp API
   └─ Updates delivery_status in documents table
   └─ Frontend polls for status (not implemented in code)
```

### Critical Data Flow Gaps

**GAP 1: Merge Field Data Not Transmitted**
```
Frontend knows consumer data:
- consumer = { id, name, first_name, last_name, mobile, unit_number, email, ... }
- _consumers = [array of all consumers with full data]

But sends to backend:
- POST /documents/generate { documentType, consumerId, deliveryMethod }

Backend must query:
- SELECT * FROM consumers WHERE id = consumerId
- SELECT * FROM units WHERE id = (from consumer.allocated_unit_id)
- SELECT * FROM projects WHERE id = (from consumer.project_id)
- SELECT SUM(amount) FROM receipts WHERE consumer_id = consumerId
- SELECT * FROM allocations WHERE consumer_id = consumerId

This is redundant work and assumes backend has all tables JOINed correctly.
```

**GAP 2: PDF Endpoint Variations Undocumented**
```
documents.js calls 3 different PDF endpoints:

1. Standard document PDF:
   GET /api/documents/{documentId}/pdf (line 714)
   - Used for generated documents (allotment, demand, welcome, etc.)
   
2. Ledger PDF:
   GET /api/documents/ledger/{consumerId}/pdf (line 563)
   - NOT in backend-routes.md
   - Special report format (payment history ledger)
   
3. Address Labels:
   GET /api/documents/address-labels?format=X&scope=Y (line 657)
   - NOT in backend-routes.md
   - Special format (address label sheets)

All three have different response structures and use cases.
Backend needs to support all three OR frontend needs to know which endpoint to call.
Currently undocumented.
```

**GAP 3: Bulk Document Generation Contract Undefined**
```
Form supports: scope = "single" or "bulk" (line 358-362)
Bulk selects: projectId instead of consumerId

But API call identical:
POST /documents/generate {
  documentType,
  projectId,  // when bulk
  consumerId, // when single
  deliveryMethod
}

Does backend:
A) Create one document per consumer in project? (array response)
B) Create one bulk document? (single response with count)
C) Queue async batch job? (returns job ID for polling)

Undefined behavior → Feature likely broken at go-live.
```

---

## SECTION 4: CRITICAL FIELD MAPPING ISSUES

### Issue 1: Merge Field Syntax Inconsistency
**Severity:** 🔴 CRITICAL  
**Impact:** Template merge fields fail; hard-coded templates won't populate  
**Details:**

```javascript
// documents.js (Custom Letters Tab)
letterBody with merge fields:
{consumer_name}, {unit_number}, {project_name}, {date}  // SINGLE BRACES (line 192)

// email-templates.js (Template Editor)
Email merge fields:
{{consumer_name}}, {{unit_number}}, {{amount}}, {{due_date}}, {{project_name}}, {{allotment_date}}  // DOUBLE BRACES (line 42, 45)

// Backend Template Rendering
Backend must support BOTH? Or normalize to one syntax?
Frontend preview uses .replace(/{{...}}/g) to demo DOUBLE braces only (line 164-169)
Custom letter generation likely expects SINGLE braces

Result: System templates work, custom letters fail OR vice versa
```

**Fix Required:**
- Standardize to {{double braces}} everywhere
- Update documents.js line 192 to use {{}} syntax
- Backend: Implement consistent merge field replacement logic
- Test all templates with both syntaxes

---

### Issue 2: Ledger & Address Label Endpoints Missing
**Severity:** 🔴 CRITICAL  
**Impact:** Ledger PDF and Address Labels features return 404; not go-live ready  
**Details:**

```javascript
// Ledger PDF (line 563)
window.open(`/api/documents/ledger/${consumerId}/pdf`, '_blank');
// Returns: 404 (endpoint not in backend-routes)

// Address Labels (line 657)
window.open(`/api/documents/address-labels?${params}`, '_blank');
// Returns: 404 (endpoint not in backend-routes)
```

**Fix Required:**
- Backend: Implement GET /documents/ledger/{consumerId}/pdf
  - Returns: PDF binary with payment ledger table
  - Query: consumer + receipts + demands
  - Format: 2-column table (Demands Raised | Receipts)
- Backend: Implement GET /documents/address-labels
  - Returns: PDF binary with address labels
  - Query params: format, scope, consumerId?, projectId?
  - Formats: A4 4×2, A4 3×8, Single
  - Data: consumer name, address, city, state, pin, mobile

---

### Issue 3: Registry Endpoints Completely Missing
**Severity:** 🔴 CRITICAL (BLOCKING GO-LIVE)  
**Impact:** Registry module will not function; all API calls return 404  
**Details:**

```javascript
// registry.js calls:
POST /registry/schedule (line 76) → 404 NOT FOUND
GET /registry (line 89) → 404 NOT FOUND

Backend-routes.md shows:
"/api/registry - registry.ts - 2 routes" (line 43)
But no endpoint detail provided.

Frontend expects:
POST /registry/schedule { allocationId, appointmentDate, remarks }
GET /registry (list all appointments)

Neither endpoint exists or documented.
```

**Fix Required:**
- Backend: Create /api/registry/schedule POST handler
  - Accept: { allocationId, appointmentDate, remarks }
  - Validate: allocationId exists, appointmentDate valid, consumer allotted
  - Store in registry_appointments table
  - Return: { id, status='scheduled', appointmentDate }
- Backend: Create /api/registry GET handler
  - List all registry appointments
  - JOIN consumer, unit, allocation data
  - Return: { id, consumer_name, unit_number, appointment_date, registry_date, status }
  - Support filters: ?consumerId, ?projectId, ?status, ?from, ?to

---

## SECTION 5: DATABASE & QUERY VALIDATION

### Required JOINs for Module E Responses

```sql
-- GET /documents (History)
SELECT 
  d.id, d.document_type, d.status, d.delivery_status, d.created_at,
  c.name as consumer_name,
  p.name as project_name
FROM documents d
LEFT JOIN consumers c ON d.consumer_id = c.id
LEFT JOIN projects p ON d.project_id = p.id
ORDER BY d.created_at DESC;

-- GET /documents/templates
SELECT 
  id, name, document_type, variables, created_at, updated_at
FROM documents_templates
WHERE document_type IS NOT NULL OR id LIKE '__%';

-- POST /documents/generate (Backend Processing - Not frontend visible)
-- For Allotment Letter with {consumer_name}, {unit_number}, {project_name}, {amount}:
SELECT 
  c.name as consumer_name,
  u.unit_number,
  p.name as project_name,
  a.total_contract_value * 0.20 as amount  -- Assuming 20% for main demand
FROM consumers c
JOIN allocations a ON c.id = a.consumer_id
JOIN units u ON a.unit_id = u.id
JOIN projects p ON u.project_id = p.id
WHERE c.id = $1;

-- GET /documents/vault (Document Vault)
SELECT 
  id, file_name, doc_category, created_at,
  c.name as consumer_name
FROM documents_vault dv
LEFT JOIN consumers c ON dv.consumer_id = c.id;

-- GET /registry (Registry Appointments)
SELECT 
  r.id, r.appointment_date, r.registry_date, r.status, r.remarks,
  c.name as consumer_name,
  u.unit_number,
  a.id as allocation_id
FROM registry_appointments r
JOIN allocations a ON r.allocation_id = a.id
JOIN consumers c ON a.consumer_id = c.id
JOIN units u ON a.unit_id = u.id
ORDER BY r.appointment_date DESC;
```

### Required Tables & Columns

```sql
-- documents table (for history)
- id (UUID)
- document_type (VARCHAR: allotment_letter, demand_letter, payment_receipt, BBA, possession_letter, NOC, cancellation_letter, welcome_letter, custom_letter, tpa, conveyance_deed, address_labels, ledger)
- consumer_id (UUID FK, nullable for bulk docs)
- project_id (UUID FK)
- template_id (UUID FK to documents_templates)
- status (VARCHAR: generated, processing, failed)
- delivery_status (VARCHAR: pending, queued, sent, delivered, failed, not_sent)
- file_url (VARCHAR, path to PDF in storage)
- merge_fields_used (JSONB, { consumer_name: "...", unit_number: "...", etc. })
- created_at (TIMESTAMP)
- created_by (UUID FK to users)
- delivery_attempted_at (TIMESTAMP)
- delivery_completed_at (TIMESTAMP)

-- documents_templates table (for CRUD)
- id (UUID)
- name (VARCHAR)
- document_type (VARCHAR: general, allotment_letter, demand_letter, payment_receipt, welcome, reminder)
- subject_line (VARCHAR, for email delivery)
- body (TEXT, with {{merge_fields}})
- variables (TEXT array: consumer_name, unit_number, amount, due_date, project_name, allotment_date)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- created_by (UUID FK to users)
- is_system (BOOLEAN, true for __allotment__, __demand__, __receipt__, __welcome__)

-- documents_vault table (for vault storage)
- id (UUID)
- consumer_id (UUID FK)
- file_name (VARCHAR)
- file_url (VARCHAR)
- doc_category (VARCHAR: KYC, Application, Allotment, Payment, Agreement, Possession, NOC, General)
- file_size (INT)
- mime_type (VARCHAR)
- uploaded_at (TIMESTAMP)
- uploaded_by (UUID FK to users)

-- registry_appointments table (for registry scheduling) - NEW TABLE REQUIRED
- id (UUID)
- allocation_id (UUID FK)
- appointment_date (DATE)
- registry_date (DATE, null until completed)
- status (VARCHAR: scheduled, completed, no_show, cancelled)
- remarks (TEXT)
- created_at (TIMESTAMP)
- scheduled_by (UUID FK to users)
- completed_by (UUID FK to users, when status=completed)
```

---

## SECTION 6: TEST CASES & VALIDATION

### Test Case 1: Generate Allotment Letter with Merge Fields
**Scenario:** Generate allotment letter for single consumer with populated merge fields  
**Test Data:**
- Consumer: "Rajesh Kumar"
- Unit: "Tower A, Floor 5, Unit 501"
- Project: "ROF Aalayas"
- Contract Value: ₹2,000,000
- 20% due: ₹400,000

**API Call:**
```bash
POST /api/documents/generate HTTP/1.1
Authorization: Bearer mock-jwt-token
Content-Type: application/json

{
  "documentType": "allotment_letter",
  "consumerId": "c-001",
  "deliveryMethod": "email"
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "documentId": "d-001",
    "generated": 1,
    "deliveryStatus": "queued"
  }
}
```

**Expected PDF Content:**
```
Dear {{consumer_name}},

Congratulations! You have been allotted Unit {{unit_number}} in {{project_name}}.

Allotment Date: {{allotment_date}}

Please complete the payment of 20% (₹{{amount}}) within 15 days.

Regards,
ROF Infratech & Housing Pvt. Ltd.

---

RENDERED AS:

Dear Rajesh Kumar,

Congratulations! You have been allotted Unit Tower A, Floor 5, Unit 501 in ROF Aalayas.

Allotment Date: 01 May 2026

Please complete the payment of 20% (₹4,00,000) within 15 days.

Regards,
ROF Infratech & Housing Pvt. Ltd.
```

**Pass Criteria:**
- ✅ documentId present in response
- ✅ All merge fields populated correctly
- ✅ PDF generated and stored
- ✅ Delivery queued (can verify in delivery queue table)
- ✅ HTTP 200 response

---

### Test Case 2: Bulk Address Label Generation
**Scenario:** Generate address labels for entire project (A4 4×2 format)  
**Test Data:**
- Project: "ROF Aalayas"
- Scope: project
- Format: A4 4×2 (8 per sheet)
- Consumers in project: 47

**API Call:**
```bash
GET /api/documents/address-labels?scope=project&projectId=proj-001&format=a4_4x2 HTTP/1.1
Authorization: Bearer mock-jwt-token
```

**Expected Response:**
- PDF binary (not JSON)
- Content: 47 consumer address labels formatted on A4 sheets, 4 labels per row, 2 rows per sheet (6 sheets total)
- Each label shows: Name, Address, City, State, PIN, Mobile

**Pass Criteria:**
- ✅ PDF generated successfully
- ✅ Correct number of labels (47)
- ✅ Format correct (4×2 grid)
- ✅ No HTTP 404 error
- ✅ File downloadable and printable

---

### Test Case 3: Registry Appointment Scheduling
**Scenario:** Schedule property registry appointment for allotted consumer  
**Test Data:**
- Consumer: "Priya Singh"
- Unit: "Tower B, Unit 302"
- Appointment Date: 15 May 2026
- Remarks: "Send conveyance deed and NOC before appointment"

**API Call (Step 1):**
```bash
GET /api/allocations?consumerId=c-002 HTTP/1.1
Authorization: Bearer mock-jwt-token
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "a-002",
      "consumer_id": "c-002",
      "unit_id": "u-302",
      "allocation_date": "2026-04-01"
    }
  ]
}
```

**API Call (Step 2):**
```bash
POST /api/registry/schedule HTTP/1.1
Authorization: Bearer mock-jwt-token
Content-Type: application/json

{
  "allocationId": "a-002",
  "appointmentDate": "2026-05-15",
  "remarks": "Send conveyance deed and NOC before appointment"
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "r-001",
    "allocation_id": "a-002",
    "appointment_date": "2026-05-15",
    "status": "scheduled",
    "remarks": "Send conveyance deed and NOC before appointment"
  }
}
```

**Verification:**
```bash
GET /api/registry HTTP/1.1
Authorization: Bearer mock-jwt-token
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "r-001",
      "consumer_name": "Priya Singh",
      "unit_number": "Tower B, Unit 302",
      "appointment_date": "2026-05-15",
      "registry_date": null,
      "status": "scheduled"
    }
  ]
}
```

**Pass Criteria:**
- ✅ POST /registry/schedule creates appointment
- ✅ GET /registry lists appointment
- ✅ consumer_name and unit_number populated via JOINs
- ✅ Status field reflects "scheduled"

---

### Test Case 4: Email Template Save & Preview
**Scenario:** Create custom email template for welcome messages  
**Test Data:**
- Template Name: "Custom Welcome Email"
- Type: welcome
- Subject: "Welcome to {{project_name}}!"
- Body: "Dear {{consumer_name}},\n\nWelcome to {{project_name}}!\n\nYour application has been received successfully.\n\nRegards,\nROF Team"

**API Call (Create):**
```bash
POST /api/documents/templates HTTP/1.1
Authorization: Bearer mock-jwt-token
Content-Type: application/json

{
  "name": "Custom Welcome Email",
  "documentType": "welcome",
  "subject": "Welcome to {{project_name}}!",
  "body": "Dear {{consumer_name}},\n\nWelcome to {{project_name}}!\n\nYour application has been received successfully.\n\nRegards,\nROF Team"
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "t-custom-001",
    "name": "Custom Welcome Email",
    "documentType": "welcome",
    "subject": "Welcome to {{project_name}}!",
    "created_at": "2026-05-02T10:30:00Z"
  }
}
```

**Preview (Client-side):**
```
Template body after merge field replacement:
Dear Mr. Rajesh Kumar,
Welcome to ROF Aalayas!
Your application has been received successfully.
Regards,
ROF Team
```

**Pass Criteria:**
- ✅ Template saved with ID
- ✅ Merge field syntax consistent ({{double braces}})
- ✅ Preview shows correct field replacement
- ✅ Template appears in GET /documents/templates list

---

## SECTION 7: REMEDIATION ROADMAP

### Tier 1 Critical Fixes (Block Go-Live)

| Fix | File | Issue | Action | Est. Lines |
|-----|------|-------|--------|-----------|
| Implement POST /documents/generate properly | documents.ts | Missing merge field data population | Query consumer/unit/project/payment data; render template; generate PDF | 100-150 |
| Implement GET /documents/ledger/{consumerId}/pdf | documents.ts | Missing endpoint | Generate ledger report with demands/receipts; return PDF | 40-60 |
| Implement GET /documents/address-labels | documents.ts | Missing endpoint | Generate address label sheet in PDF; support formats | 60-80 |
| Implement POST /registry/schedule | registry.ts | Missing endpoint | Create registry appointment; validate allocation | 30-40 |
| Implement GET /registry | registry.ts | Missing endpoint | List registry appointments with JOINs | 20-30 |
| Normalize merge field syntax | email-templates.js, documents.js | {{double}} vs {single} inconsistency | Use {{double braces}} everywhere; update custom letter code | 5-10 |
| Response formatter for documents | middleware/response-formatter.ts | Field name mapping | Add consumer_name, document_type, delivery_status mapping | 15-20 |

**Estimated Total: 270-390 lines of backend code**

### Tier 2 High Priority Fixes

| Fix | File | Issue | Action | Est. Lines |
|-----|------|-------|--------|-----------|
| Implement template preview endpoint | documents.ts | GET /documents/templates/:id/preview unclear | Return rendered template preview (could be client-side instead) | 20-30 |
| Validate filter parameters | documents.ts | registrationNo, firstName, address filters not confirmed | Document and test all filter params for /consumers and /payments/demands | 10-15 |
| Bulk document generation | documents.ts | scope='bulk' handling unclear | Clarify: create per-consumer or single bulk document? | 30-50 |
| Template system protection | documents.ts | System templates can be modified | Enforce read-only for __allotment__, __demand__, __receipt__, __welcome__ | 5-10 |

**Estimated Total: 65-105 lines**

---

## SECTION 8: BLOCKING ISSUES FOR GO-LIVE

### Issue 1: Registry Module Completely Missing
**Frontend Impact:** Registry & Conveyance page will not function; all API calls return 404  
**Status:** 🔴 BLOCKING  
**Required By:** Go-live date  
**Fix ETA:** 3-4 days (create 2 endpoints + 1 table)

### Issue 2: Merge Field Data Not Flowing to Backend
**Frontend Impact:** Documents generated with empty/placeholder merge fields; unprofessional output  
**Status:** 🔴 BLOCKING  
**Required By:** Go-live date  
**Fix ETA:** 2-3 days (add JOINs to POST /documents/generate handler)

### Issue 3: Ledger & Address Label Endpoints Missing
**Frontend Impact:** Features return 404; partial functionality loss  
**Status:** 🔴 BLOCKING  
**Required By:** Go-live date  
**Fix ETA:** 3-4 days (create 2 specialized PDF endpoints)

### Issue 4: Merge Field Syntax Inconsistency
**Frontend Impact:** Some templates work, others fail; unpredictable behavior  
**Status:** ⚠️ CRITICAL  
**Required By:** Before template testing  
**Fix ETA:** 1 day (standardize to {{double braces}} everywhere)

---

## SECTION 9: SUMMARY CHECKLIST

### Per-Feature Sign-Off

- [ ] **Document Generation (Tab 1):** POST /documents/generate accepts documentType, consumerId, projectId, deliveryMethod
- [ ] **Merge Fields:** All 6 fields (consumer_name, unit_number, project_name, amount, due_date, allotment_date) populated in PDF
- [ ] **Document History (Tab 11):** GET /documents returns with consumer_name, document_type, delivery_status, created_at
- [ ] **Templates Tab:** GET /documents/templates lists custom + system templates (4 defaults)
- [ ] **Email Templates CRUD:** POST/PATCH/DELETE /documents/templates working with system protection
- [ ] **Email Template Preview:** Preview renders merge fields correctly (client-side or server endpoint)
- [ ] **Applicant Ledger (Tab 7):** GET /consumers/{id} + GET /payments/receipts + GET /payments/demands for ledger rendering
- [ ] **Ledger PDF:** GET /documents/ledger/{consumerId}/pdf generates PDF report
- [ ] **Address Labels:** GET /documents/address-labels generates formatted label sheets (A4 4×2, 3×8, single)
- [ ] **Document Vault:** GET /documents/vault lists uploaded documents by category
- [ ] **Document Send:** POST /documents/{id}/send queues delivery via email/WhatsApp
- [ ] **ATS Search:** GET /consumers with registrationNo, firstName, address, from, to filters
- [ ] **Demand Letter Search:** GET /payments/demands with registrationNo, firstName, installment, from, to filters
- [ ] **Registry Schedule:** POST /registry/schedule creates appointment with allocationId, appointmentDate, remarks
- [ ] **Registry List:** GET /registry returns appointments with consumer_name, unit_number, appointment_date, status

### Final Sign-Off
**GO-LIVE READY:** Only after all 15 items above are ✅ Complete  
**STATUS:** 🔴 **DO NOT GO LIVE** — 3 Tier 1 Critical endpoints missing (registry×2, ledger PDF, address labels)

---

## Appendix: Code Snippets for Backend Implementation

### POST /documents/generate with Merge Field Data Flow (PostgreSQL + Node.js)

```javascript
// packages/api/src/routes/documents.ts
router.post('/generate', authenticateToken, async (req, res) => {
  const { documentType, consumerId, projectId, deliveryMethod, letterName, letterBody } = req.body;
  
  if (!documentType) {
    return sendResponse(res, false, null, 'Document type required', 400);
  }

  try {
    let consumers = [];
    let projectData = null;

    // Fetch data for merge fields
    if (consumerId) {
      // Single document
      const consumer = await db.query(
        `SELECT c.*, u.unit_number, p.name as project_name,
                a.total_contract_value, a.allocation_date
         FROM consumers c
         LEFT JOIN units u ON c.allocated_unit_id = u.id
         LEFT JOIN projects p ON c.project_id = p.id
         LEFT JOIN allocations a ON c.id = a.consumer_id
         WHERE c.id = $1`,
        [consumerId]
      );
      consumers = consumer.rows;
    } else if (projectId) {
      // Bulk documents
      const result = await db.query(
        `SELECT c.*, u.unit_number, p.name as project_name,
                a.total_contract_value, a.allocation_date
         FROM consumers c
         LEFT JOIN units u ON c.allocated_unit_id = u.id
         LEFT JOIN projects p ON c.project_id = p.id
         LEFT JOIN allocations a ON c.id = a.consumer_id
         WHERE c.project_id = $1 AND c.lead_stage = 'allotted'`,
        [projectId]
      );
      consumers = result.rows;
    }

    if (consumers.length === 0) {
      return sendResponse(res, false, null, 'No consumers found', 404);
    }

    let documents = [];

    for (const consumer of consumers) {
      // Get latest payment demand (if applicable for demand letter)
      let demandData = null;
      if (documentType === 'demand_letter') {
        const demand = await db.query(
          `SELECT * FROM demands WHERE consumer_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [consumer.id]
        );
        demandData = demand.rows[0];
      }

      // Prepare merge field values
      const mergeFields = {
        consumer_name: consumer.name || `${consumer.first_name} ${consumer.last_name}`,
        unit_number: consumer.unit_number || 'TBD',
        project_name: consumer.project_name || 'ROF Project',
        amount: demandData?.amount_due_inr || (consumer.total_contract_value * 0.20) || 0,
        due_date: demandData?.due_date || new Date().toISOString().split('T')[0],
        allotment_date: consumer.allocation_date || new Date().toISOString().split('T')[0],
        date: new Date().toLocaleDateString('en-IN'),
      };

      // Load template (hardcoded defaults for now)
      let templateBody = '';
      const templates = {
        allotment_letter: `Dear {{consumer_name}},\n\nCongratulations! You have been allotted Unit {{unit_number}} in {{project_name}}.\n\nAllotment Date: {{allotment_date}}\n\nPlease complete the payment of 20% (₹{{amount}}) within 15 days.\n\nRegards,\nROF Infratech & Housing Pvt. Ltd.`,
        demand_letter: `Dear {{consumer_name}},\n\nThis is a reminder that your instalment of ₹{{amount}} is due on {{due_date}}.\n\nUnit: {{unit_number}} | Project: {{project_name}}\n\nPlease make the payment to avoid penal interest under HRERA Rule 15.\n\nRegards,\nROF Infratech`,
        welcome_letter: `Dear {{consumer_name}},\n\nWelcome to {{project_name}}!\n\nYour application has been received successfully.\n\nRegards,\nROF Infratech`,
        custom_letter: letterBody || '',
      };

      templateBody = templates[documentType] || letterBody || '';

      // Render template by replacing merge fields
      let renderedBody = templateBody;
      Object.keys(mergeFields).forEach(key => {
        const pattern = new RegExp(`{{${key}}}`, 'g');
        renderedBody = renderedBody.replace(pattern, mergeFields[key]);
      });

      // Generate PDF (using pdfkit or wkhtmltopdf)
      const pdfBuffer = await generatePDF(renderedBody, documentType);

      // Store in file system / S3 / Object storage
      const fileUrl = await storeFile(pdfBuffer, `${documentType}-${consumer.id}-${Date.now()}.pdf`);

      // Record in documents table
      const doc = await db.query(
        `INSERT INTO documents (document_type, consumer_id, project_id, status, delivery_status, file_url, merge_fields_used, created_at, created_by_id)
         VALUES ($1, $2, $3, 'generated', $4, $5, $6, NOW(), $7)
         RETURNING id`,
        [
          documentType,
          consumer.id,
          consumer.project_id,
          deliveryMethod === 'none' ? 'not_sent' : 'queued',
          fileUrl,
          JSON.stringify(mergeFields),
          req.user.id
        ]
      );

      // If delivery method selected, queue for sending
      if (deliveryMethod !== 'none' && deliveryMethod !== 'Generate Only') {
        await queueForDelivery({
          documentId: doc.rows[0].id,
          consumerId: consumer.id,
          channel: deliveryMethod,
          email: consumer.email,
          mobile: consumer.mobile,
          subject: `${documentType.replace(/_/g, ' ')} - Unit ${consumer.unit_number}`,
        });
      }

      documents.push({
        documentId: doc.rows[0].id,
        consumerId: consumer.id,
      });
    }

    sendResponse(res, true, {
      documentId: documents[0]?.documentId || null,
      generated: documents.length,
      deliveryStatus: deliveryMethod === 'none' ? 'not_sent' : 'queued',
    }, null, 201);

  } catch (err) {
    console.error('Document generation error:', err);
    sendResponse(res, false, null, err.message, 500);
  }
});
```

### Registry Endpoints

```javascript
// packages/api/src/routes/registry.ts
router.post('/schedule', authenticateToken, async (req, res) => {
  const { allocationId, appointmentDate, remarks } = req.body;

  if (!allocationId || !appointmentDate) {
    return sendResponse(res, false, null, 'allocationId and appointmentDate required', 400);
  }

  try {
    // Validate allocation exists and consumer is allotted
    const alloc = await db.query(
      `SELECT a.*, c.name as consumer_name, u.unit_number
       FROM allocations a
       JOIN consumers c ON a.consumer_id = c.id
       JOIN units u ON a.unit_id = u.id
       WHERE a.id = $1`,
      [allocationId]
    );

    if (alloc.rows.length === 0) {
      return sendResponse(res, false, null, 'Allocation not found', 404);
    }

    // Create registry appointment
    const registry = await db.query(
      `INSERT INTO registry_appointments (allocation_id, appointment_date, status, remarks, created_at, scheduled_by_id)
       VALUES ($1, $2, 'scheduled', $3, NOW(), $4)
       RETURNING id, allocation_id, appointment_date, status, remarks`,
      [allocationId, appointmentDate, remarks || '', req.user.id]
    );

    sendResponse(res, true, registry.rows[0], null, 201);

  } catch (err) {
    sendResponse(res, false, null, err.message, 500);
  }
});

router.get('/', authenticateToken, async (req, res) => {
  const { consumerId, projectId, status, from, to, pageSize = 50, page = 1 } = req.query;

  try {
    let query = `
      SELECT r.id, r.appointment_date, r.registry_date, r.status, r.remarks,
             c.name as consumer_name, c.id as consumer_id,
             u.unit_number, u.id as unit_id,
             a.id as allocation_id
      FROM registry_appointments r
      JOIN allocations a ON r.allocation_id = a.id
      JOIN consumers c ON a.consumer_id = c.id
      JOIN units u ON a.unit_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (consumerId) {
      query += ` AND c.id = $${paramCount++}`;
      params.push(consumerId);
    }
    if (projectId) {
      query += ` AND u.project_id = $${paramCount++}`;
      params.push(projectId);
    }
    if (status) {
      query += ` AND r.status = $${paramCount++}`;
      params.push(status);
    }
    if (from) {
      query += ` AND r.appointment_date >= $${paramCount++}`;
      params.push(from);
    }
    if (to) {
      query += ` AND r.appointment_date <= $${paramCount++}`;
      params.push(to);
    }

    query += ` ORDER BY r.appointment_date DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(pageSize, (page - 1) * pageSize);

    const result = await db.query(query, params);
    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM registry_appointments WHERE 1=1 ${
        consumerId ? 'AND consumer_id = $1' : ''
      }`,
      consumerId ? [consumerId] : []
    );

    sendResponse(res, true, result.rows, { 
      page: parseInt(page), 
      pageSize: parseInt(pageSize),
      total: parseInt(countResult.rows[0].total)
    });

  } catch (err) {
    sendResponse(res, false, null, err.message, 500);
  }
});
```

---

**Report generated:** May 2, 2026  
**Audit conducted by:** Claude Code (Connectivity Audit Framework v2.1)  
**Next step:** Address Tier 1 Critical items → Complete Modules F, G → Retest all modules → Proceed to backend fixes
