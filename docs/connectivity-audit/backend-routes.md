# Backend API Routes — Complete Reference
Generated: May 2, 2026

## Executive Summary
- **Total Route Files**: 30
- **Total API Endpoints**: 261
- **Base URL**: http://localhost:3001/api
- **Authentication**: JWT Bearer token (mock-jwt-token in dev)
- **Response Format**: All responses wrapped in `{ success, data, pagination }`

---

## Route Prefixes & Files (from packages/api/src/index.ts)

| Route Prefix | Handler File | Endpoints | Purpose |
|---|---|---|---|
| `/api/consumers` | consumers.ts | 8 | Consumer profiles, KYC, remarks |
| `/api/units` | units.ts | 8 | Unit inventory, floor-wise view |
| `/api/allocations` | allocations.ts | 8 | Allotment, waitlist, cancellation |
| `/api/payments` | payments.ts | 21 | Payment plans, demands, receipts, GST |
| `/api/documents` | documents.ts | 13 | Document templates, generation, vault |
| `/api/communications` | communications.ts | 17 | Remarks, emails, WhatsApp, SMS, tickets |
| `/api/users` | users.ts | 10 | User management, roles, permissions |
| `/api/reports` | reports.ts | 13 | Dashboards, analytics, custom reports |
| `/api/milestones` | milestones.ts | 3 | Project milestones |
| `/api/reconciliation` | reconciliation.ts | 5 | Bank reconciliation |
| `/api/smtp-configs` | smtp_config.ts | 2 | SMTP configuration |
| `/api/faq` | faq.ts | 6 | FAQ articles and categories |
| `/api/tasks` | tasks.ts | 4 | Task management |
| `/api/automation` | automation.ts | 5 | Automation rules |
| `/api/brokers` | brokers.ts | 10 | Broker management, commission |
| `/api/parking` | parking.ts | 2 | Parking slot allocation |
| `/api/import` | import.ts | 3 | Data import (CSV, e-draw) |
| `/api/projects` | projects.ts | 16 | Project configuration, towers |
| `/api/broker-setup` | broker_setup.ts | 3 | Broker onboarding |
| `/api/inventory-hold` | inventory_hold.ts | 3 | Inventory hold management |
| `/api/dashboard` | dashboard.ts | 8 | Dashboard data endpoints |
| `/api/master` | master.ts | 51 | Master data (countries, states, cities, banks) |
| `/api/booking` | booking.ts | 3 | Booking workflow |
| `/api/employees` | employees.ts | 19 | Employee records and organization |
| `/api/operations` | operations.ts | 2 | Operations management |
| `/api/transfers` | transfers.ts | 2 | Unit transfers |
| `/api/registry` | registry.ts | 2 | Registry management |
| `/api/loans` | loans.ts | 2 | Loan management |
| `/api/payments` | receipt-process.ts | 5 | Receipt processing (mounted on /api/payments) |
| `/api/test-data` | test-data-import.ts | 7 | Test data loading |

---

## Detailed Routes by Module

### MODULE A: Consumers (consumers.ts)
```
POST   /api/consumers                     Create new consumer
GET    /api/consumers                     List all consumers (paginated, filterable)
GET    /api/consumers/:id                 Get consumer detail
PATCH  /api/consumers/:id                 Update consumer profile
POST   /api/consumers/:id/kyc-documents   Upload KYC documents
POST   /api/consumers/:id/remarks         Add consumer remark
GET    /api/consumers/:id/remarks         Get consumer remarks timeline
POST   /api/consumers/:id/base-rate       Set base rate for consumer
```

### MODULE B: Units (units.ts)
```
POST   /api/units                         Create new unit
GET    /api/units                         List all units
GET    /api/units/tower/:projectId        Get units by tower
GET    /api/units/inventory-summary/:projectId  Get inventory summary
GET    /api/units/projects                Get all projects (reference)
GET    /api/units/:id                     Get unit detail
PATCH  /api/units/:id                     Update unit details
POST   /api/units/bulk-import             Bulk import units from CSV
```

### MODULE C: Allocations (allocations.ts)
```
POST   /api/allocations                   Create allotment
GET    /api/allocations/waitlist          Get waitlist
GET    /api/allocations                   List all allocations
POST   /api/allocations/:id/cancel        Cancel allotment (with forfeiture)
POST   /api/allocations/import-edraw      Import e-draw results
POST   /api/allocations/shift             Shift unit to another consumer
GET    /api/allocations/shifts            Get all shifts history
POST   /api/allocations/generate-letters  Generate allotment letters (bulk)
```

### MODULE D: Payments & Receipts (payments.ts)
```
POST   /api/payments/payment-plans        Create payment plan
GET    /api/payments/overdue              Get overdue payments
POST   /api/payments/receipts             Record receipt
GET    /api/payments/dashboard            Dashboard KPIs
GET    /api/payments/demands              List all demands
PATCH  /api/payments/demands/activate     Activate demand
POST   /api/payments/demands/bulk         Create bulk demands
PATCH  /api/payments/demands/:id/send     Send demand letter
GET    /api/payments/receipts             List all receipts
PATCH  /api/payments/receipts/:id/approve Approve receipt
GET    /api/payments/gst-invoices         Get GST invoices
POST   /api/payments/gst-invoices         Create GST invoice
POST   /api/payments/gst-invoices/cancel  Cancel GST invoice
GET    /api/payments/gst-invoices/:id/pdf Get GST invoice PDF
GET    /api/payments/:paymentPlanId/demands  Get demands for payment plan
POST   /api/payments/calculate-interest   Calculate HRERA penal interest
GET    /api/payments/draw-refunds         Get draw refunds
GET    /api/payments/draw-refunds/overdue Get overdue refunds
PATCH  /api/payments/draw-refunds/:id/initiate  Initiate refund
PATCH  /api/payments/draw-refunds/:id/complete  Complete refund
```

### MODULE E: Documents (documents.ts)
```
POST   /api/documents/templates           Create document template
GET    /api/documents/templates           List all templates
GET    /api/documents/templates/:id       Get template detail
PATCH  /api/documents/templates/:id       Update template
POST   /api/documents/generate            Generate document from template
POST   /api/documents/:id/send            Send document (email/WhatsApp)
GET    /api/documents/search              Search documents
GET    /api/documents                     List all documents
POST   /api/documents/vault               Upload to document vault
GET    /api/documents/vault               List vault documents
GET    /api/documents/vault/:consumerId   Get consumer's vault
GET    /api/documents/:consumerId         Get consumer's documents
DELETE /api/documents/:id                 Delete document
```

### MODULE F: Communications (communications.ts)
```
GET    /api/communications/status-codes   Get communication status codes
GET    /api/communications/calling-list   Get calling list
POST   /api/communications/log-call       Log call interaction
POST   /api/communications/remarks        Add system remark
GET    /api/communications/remarks/:consumerId  Get consumer remarks
POST   /api/communications/emails         Send email
POST   /api/communications/whatsapp       Send WhatsApp message
POST   /api/communications/sms            Send SMS
POST   /api/communications/tickets        Create support ticket
GET    /api/communications/tickets        List tickets
PATCH  /api/communications/tickets/:id    Update ticket
POST   /api/communications/ai-suggestions Get AI-suggested replies
POST   /api/communications/broadcast      Send broadcast campaign
GET    /api/communications/campaigns      Get campaign history
POST   /api/communications/:consumerId/send   Send to consumer
POST   /api/communications/:consumerId/ai-draft  AI draft message
GET    /api/communications/:consumerId    Get consumer communication history
```

### MODULE G: Reports & Analytics (reports.ts)
```
GET    /api/reports/sales-dashboard       Sales KPIs & conversion funnel
GET    /api/reports/financial-dashboard   Receivables, ageing, collection %
GET    /api/reports/project-dashboard     Fill rate, allotment progress
GET    /api/reports/campaign-roi          Campaign effectiveness metrics
GET    /api/reports/lead-source-analysis  Lead source attribution
GET    /api/reports/payment-ageing        Payment ageing buckets
GET    /api/reports/monthly-collection    Monthly collection trend
POST   /api/reports/custom-report         Build custom report (drag-drop)
GET    /api/reports/custom-reports        List saved custom reports
GET    /api/reports/allotment-dashboard   Allotment-specific dashboard
GET    /api/reports/inventory-full        Full inventory with all statuses
GET    /api/reports/applicant-payment-file  Generate applicant payment file
GET    /api/reports/collection-pivot      Collection pivot table
```

### Other Modules
```
[FAQ]
GET    /api/faq/categories                Get FAQ categories
GET    /api/faq/articles                  List FAQ articles
GET    /api/faq/articles/:id              Get article detail
POST   /api/faq/articles                  Create article
PATCH  /api/faq/articles/:id              Update article
POST   /api/faq/articles/:id/feedback     Submit feedback on article

[MASTER DATA]
Contains 51 routes for:
- Countries, States, Cities (CRUD)
- Banks, Payment methods
- Income categories (EWS/LIG/MIG)
- Document types, categories
- Unit status reference
- Lead stages reference
- Payment plan templates
(See master.ts for full list)

[DASHBOARD]
GET    /api/dashboard/pending-cheques     Cheques awaiting approval
GET    /api/dashboard/demand-status       Demand send status
GET    /api/dashboard/pending-approval    Documents pending approval
GET    /api/dashboard/daily-status        Daily project status
GET    /api/dashboard/parking-detail      Parking inventory
GET    /api/dashboard/forthcoming-due     Upcoming due dates
GET    /api/dashboard/employee-tickets    Employee task tickets
GET    /api/dashboard/summary             Overall summary metrics

[EMPLOYEES]
19 routes for employee management, org hierarchy, document vault

[PROJECTS]
16 routes for project config, towers, units, payment plan setup

[AUTOMATION]
5 routes for automation rule creation, execution, status

[TASKS]
GET    /api/tasks                         List tasks
POST   /api/tasks                         Create task
PATCH  /api/tasks/:id                     Update task status
DELETE /api/tasks/:id                     Delete task

[BROKERS]
GET    /api/brokers/commission            Get commission structure
PATCH  /api/brokers/commission/:id        Update commission
GET    /api/brokers                       List brokers
POST   /api/brokers                       Create broker
GET    /api/brokers/:id                   Get broker detail
PATCH  /api/brokers/:id/approve           Approve broker
PATCH  /api/brokers/:id/reject            Reject broker
GET    /api/brokers/:id/projects          Get broker projects
POST   /api/brokers/:id/projects          Link project to broker
GET    /api/brokers/:id/sub-brokers       Get sub-brokers

[ADDITIONAL MODULES]
- Reconciliation (5 routes)
- Milestones (3 routes)
- Parking (2 routes)
- Inventory Hold (3 routes)
- Import (3 routes)
- Loans (2 routes)
- Operations (2 routes)
- Transfers (2 routes)
- Registry (2 routes)
- Receipt Process (5 routes)
- Test Data Import (7 routes)
- Broker Setup (3 routes)
- SMTP Config (2 routes)
- Booking (3 routes)
```

---

## Frontend Integration Points

### API Client (packages/web/public/js/api-client.js)
- **Base URL**: ROF.API_BASE (set to '/api' in constants.js)
- **Auth**: Adds `Authorization: Bearer ${token}` header
- **Methods**: get(), post(), patch(), put(), delete(), uploadFile()
- **Response**: Automatically unwraps `{ success, data }` envelope

### Frontend Pages Making API Calls (41 total pages)
Each page in packages/web/public/js/pages/ calls specific endpoints:
- **consumers.js** → GET /api/consumers, GET /api/consumers/:id, PATCH, POST
- **dashboard.js** → GET /api/payments/dashboard, /api/dashboard/*, GET /api/reports/*
- **allocations.js** → POST /api/allocations, GET /api/allocations, POST /cancel, POST /generate-letters
- **receipts.js** → POST /api/payments/receipts, GET /api/payments/receipts, PATCH /approve
- **demands.js** → GET /api/payments/demands, PATCH /send
- **documents.js** → POST /api/documents/templates, POST /generate, GET /vault
- **communications.js** → POST /remarks, /emails, /whatsapp, /sms, POST /tickets, /ai-suggestions
- **reports.js** → GET /api/reports/*, POST /custom-report, GET /custom-reports
- **master.ts** → GET/POST all master data endpoints
- **employees.js** → GET/POST /api/employees routes
- **projects.js** → GET/POST /api/projects routes
- **brokers.js** → GET/POST /api/brokers routes
- And 29 other pages...

---

## API Response Format

All endpoints return:
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100
  }
}
```

Error responses:
```json
{
  "success": false,
  "error": "Invalid email or password",
  "details": {}
}
```

---

## Authentication & Authorization

- **Auth Endpoint**: POST /api/auth/login
- **Dev Token**: mock-jwt-token (auto-applied)
- **Middleware Stack**: authenticateToken → rbac(resource) → route handler
- **Rate Limiting**: 
  - Auth: 10 attempts per 15 minutes (production)
  - API: 300 requests per minute (production)

---

## Database Mapping

30 database tables map to these route prefixes:
- consumers → consumers, allocations, payments, remarks
- units → units, allocations, parking, inventory_hold
- projects → projects, units, towers
- payments → payment_plans, demands, receipts, gst_invoices
- documents → documents, templates
- communications → emails, whatsapps, sms, remarks, tickets
- users → users, roles, permissions
- audit_logs (immutable append-only)
- And 22 more supporting tables

---

## Notes for Auditors

1. **All routes require JWT authentication** except POST /api/auth/login and GET /health
2. **RBAC checks** happen per-resource (consumers, units, allocations, etc.)
3. **Response formatter** in middleware/response-formatter.ts maps field names
4. **Auto-audit** middleware logs all POST/PATCH/PUT/DELETE to audit_logs
5. **Static HTML frontend** uses relative URLs (/api), no build step
6. **Frontend routing** handled by Router.js (client-side navigation)

---

Generated for audit: [Date: May 2, 2026 | Commit: b1c009e]
