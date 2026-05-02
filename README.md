# ROF CRM — Haryana Affordable Housing Platform

A **production-grade, world-class CRM platform** built for ROF Group to manage the complete lifecycle of affordable housing sales in Haryana, from lead capture through e-draw, allotment, payment collection (HRERA-compliant), document generation, and possession handover.

## Project Status

**Phase 1: Core CRM Implementation (Complete)**
- ✅ Monorepo setup (pnpm workspaces)
- ✅ Backend API (Node.js + Express + PostgreSQL)
- ✅ Database schema (PostgreSQL, ACID-compliant, 30+ tables)
- ✅ Authentication (JWT tokens)
- ✅ Static HTML frontend (41 pages, vanilla JavaScript)
- ✅ All 7 core modules implemented
- ✅ Test data loaded (5 consumers with full workflow data)

## Technology Stack

### Backend
- **Node.js 20 LTS** + Express.js (RESTful API, TypeScript)
- **PostgreSQL 15+** (ACID, relational, immutable audit log)
- **Bull + Redis** (async job queues: demand letters, PDF generation, message delivery)
- **JWT** (15-min access tokens, development mock token)
- **bcryptjs** (password hashing, 12 rounds)
- **AES-256** (at-rest encryption for sensitive fields)
- **TLS 1.2+/1.3** (in-transit encryption)

### Frontend
- **Static HTML + CSS + JavaScript** (41 pages)
- **No build step required** (served directly by Express backend)
- **Vanilla JavaScript** (no frameworks, lightweight, fast)
- **Client-side routing** (Router.js for navigation)
- **Real-time data** (fetches from backend API via /api endpoints)

### Infrastructure
- **pnpm workspaces** (monorepo)
- **Docker** (PostgreSQL + Redis for local development)
- **Express.js** serves both API routes and static frontend

## Project Structure

```
rof-crm/
├── packages/
│   ├── api/                    # Node.js Express backend (TypeScript)
│   │   ├── src/
│   │   │   ├── db/             # Database schema + migrations (001-012)
│   │   │   ├── routes/         # API endpoint handlers
│   │   │   ├── middleware/     # Auth, RBAC, audit logging
│   │   │   └── index.ts        # Express server setup
│   │   ├── dist/               # Compiled JavaScript
│   │   └── .env.example        # Environment template
│   ├── web/                    # Static HTML frontend
│   │   └── public/             # Served directly by backend
│   │       ├── index.html      # SPA entry point
│   │       ├── js/
│   │       │   ├── app.js      # Router + page initialization
│   │       │   ├── api-client.js    # JWT auth + API wrapper
│   │       │   ├── constants.js     # Global enums + config
│   │       │   ├── auth.js     # Login/logout logic
│   │       │   ├── utils.js    # Formatting, modals, toasts
│   │       │   └── pages/      # 41 page modules (consumers.js, dashboard.js, etc.)
│   │       └── css/            # Styling
│   └── types/                  # Shared TypeScript interfaces
├── docs/                       # Project documentation
│   ├── README.md              # Documentation index
│   ├── GETTING_STARTED.md     # Setup guide
│   ├── IMPLEMENTATION_SUMMARY.md
│   └── PHASE1_FINAL_VALIDATION.md
├── docker-compose.yml         # PostgreSQL + Redis services
└── package.json              # Root monorepo config
```

## Quick Start

### Prerequisites
- Node.js 18+
- pnpm (`npm install -g pnpm`)
- PostgreSQL 15+ (or Docker)
- Redis (or Docker)

### 5-Minute Installation

```bash
# 1. Clone and navigate to project
cd rof-crm

# 2. Install dependencies
pnpm install

# 3. Start PostgreSQL + Redis (Docker)
docker-compose up -d

# 4. Configure environment
cp packages/api/.env.example packages/api/.env
# Edit .env if needed (defaults work with Docker services)

# 5. Run database migrations
cd packages/api
npm run migrate
cd ../..

# 6. Start the API (serves both backend + static frontend)
cd packages/api && npm run dev
```

**Result**: Full application running on **http://localhost:3001**
- API endpoints: http://localhost:3001/api/*
- Frontend: http://localhost:3001
- No separate frontend dev server needed

### Development

```bash
# Start backend API (frontend served from same server)
cd packages/api && npm run dev

# In another terminal, view logs
tail -f /tmp/api-server.log

# Visit http://localhost:3001 in your browser
```

### Build & Deploy

```bash
# Compile backend (TypeScript → JavaScript)
cd packages/api && npm run build

# Result: packages/api/dist/ contains compiled code
# Deploy dist/ folder to production server
```

## Modules

The CRM implements 7 core modules per the Statement of Work:

### Module A: Units & Inventory Management
- Multi-project support with tower/floor hierarchy
- 8-stage unit status engine (available → possession handed over)
- Color-coded inventory grid (visual status overview)
- Unit details: carpet area, super area, BHK type, facing, floor plan

### Module B: Consumer Records & Profiles
- 360° consumer profile with KYC document vault
- Lead pipeline (Enquiry → Interested → Allotted → Onboarded)
- Advanced search (name, mobile, Aadhaar, project, status)
- Document folder hierarchy per consumer
- Co-applicant + family linking

### Module C: Allocation & Allotment Management
- E-draw result import (CSV from TCP Haryana)
- One-click unit allotment with validation
- Allotment letter generation (dynamic templates)
- Waitlist management (ordered, auto-promotion)
- Cancellation workflow (forfeiture, refund, unit reset)

### Module D: Payments & Receipts Management
- **AHP-compliant payment plan**: 5% booking → 20% allotment → 6×12.5% installments
- **HRERA Rule 15 penal interest**: SBI MCLR + 2% (~11.10% per annum)
- **Demand letter automation**: Auto-send 15/7/3 days before due date
- Receipt recording (bank transfer, cheque, NEFT, UPI, cash)
- Bank reconciliation (CSV import, auto-match)
- Payment dashboard (KPIs: receivables, overdue, collection %)

### Module E: Letters & Document Generation
- **Template engine**: Rich-text editor with merge fields
- **Pre-built templates**: Allotment Letter, Demand Letter, Receipt, BBA, NOC, Possession Letter
- **PDF generation** (Puppeteer + Handlebars)
- **Delivery tracking**: Email + WhatsApp with sent/delivered/read status
- Scanned contract vault with version control

### Module F: Communications & Remarks Log
- **Omnichannel**: Email, WhatsApp Business API, SMS
- **Remarks log**: Per-consumer chronological log of interactions
- **AI-assisted responses**: Suggested replies (editable before sending)
- **Knowledge base**: FAQ, policies, process documentation
- **Ticket escalation**: Unresolved items auto-escalate

### Module G: Users, Analytics & Reporting
- **RBAC**: 6 pre-defined roles + custom role builder
  - Super Admin, Project Manager, Sales Executive, Accounts/Finance, Support Agent, Read-Only Viewer
- **Field-level masking**: Sensitive data (Aadhaar, PAN, bank details) hidden from junior staff
- **Dashboards**: Sales (pipeline, conversion), Financial (receivables, ageing), Project (fill rate)
- **Custom report builder**: Drag-and-drop, export Excel/PDF
- **Immutable audit log**: Append-only PostgreSQL, 1-year retention

## Database

PostgreSQL schema with 30+ tables covering:
- Projects, Towers, Units (with 8-stage status engine)
- Consumers, KYC Documents, Co-Applicants
- Allocations, Waitlists, Cancellations
- Payment Plans, Demands, Receipts, Penal Interest
- Documents, Remarks, Communications
- Users, Roles, Permissions
- Audit Log (append-only)

**Key characteristics**:
- SERIALIZABLE isolation for critical transactions
- All money values in paise (not rupees) to avoid floating-point errors
- Immutable audit log (UPDATE/DELETE revoked via GRANT)
- Full referential integrity (foreign key constraints)
- Comprehensive indexes for performance

## API Specification

50+ RESTful endpoints covering all modules:

### Key Endpoints
- **Consumers**: `POST /api/consumers`, `GET /api/consumers`, `GET /api/consumers/{id}`
- **Units**: `GET /api/units`, `GET /api/units/{id}`
- **Allocations**: `POST /api/allocations`, `GET /api/allocations`
- **Payments**: `POST /api/payments/receipts`, `GET /api/payments/demands`
- **Documents**: `POST /api/documents`, `GET /api/documents/{id}`
- **Communications**: `POST /api/communications/send`, `GET /api/communications`
- **Reports**: `GET /api/reports/dashboard`, `GET /api/reports/custom`
- **Users**: `GET /api/users`, `POST /api/users`

All endpoints require JWT authentication (mock token: `mock-jwt-token` in development).

## Frontend Pages (41 Total)

### Core Business
- Dashboard (KPIs, pending items)
- Consumers (list, detail, profile)
- Consumers Detail (5 tabs: overview, payments, documents, communications, history)
- Booking (9-section form, photo upload)
- Allotment (unit grid, status colors)
- Receipts (8 tabs: payments, approval, PDF)
- Demands (demand list, send, tracking)
- Demand Raise (7 tabs: schedule, email, WhatsApp)

### Documents & Communications
- Documents (11 tabs, bulk generation, vault)
- Customer Folders (folder grid, search)
- Unit Documents (two-panel viewer)
- Unit Status (inventory grid, floor-wise)
- Communications (6 channels: WhatsApp, Email, Instagram, Facebook, SMS, AI)
- WhatsApp Inbox (message threads)
- Email Templates (list + editor)
- Facebook Inbox (DM inbox)
- Instagram Inbox (DM inbox)

### Administration & Configuration
- Analytics (hardcoded demo charts)
- Reports (16 tabs, export options)
- Leads (pipeline stages)
- Set Master (7 tabs: countries, states, cities, banks, etc.)
- Set Projects (7 tabs: projects, units, payment plans)
- Automation (rule table with toggles)
- Import (drag-drop CSV)
- Users (staff + permissions matrix)
- Tasks (list, create, complete)
- Help (PDF embed + buttons)

### Finance & Operations
- GST Invoicing (9 tabs)
- Surrender (3 tabs)
- Parking (4 tabs with allotment modal)
- Brokers (5 tabs)
- Campaigns (campaign management)

## HRERA Compliance

This CRM is **fully compliant with HRERA Rule 15** (Penal Interest on Overdue Payments):

- Interest rate: SBI MCLR + 2% (~11.10% per annum)
- Calculation: Simple interest (P × R × T / 100)
- Auto-flagging: Overdue payments automatically calculated daily
- Escalation: Overdue > 7 days auto-escalates to Sales Manager

## Default Login

Development mode uses mock authentication:
- **URL**: http://localhost:3001
- **Token**: `mock-jwt-token` (auto-applied in dev mode, no login required)
- **Role**: super_admin (full access to all features)
- **Permissions**: All 50+ actions enabled by default

No password or email needed in development.

## Documentation

See the `docs/` folder for:
- **README.md** — Documentation index
- **GETTING_STARTED.md** — Detailed setup and development guide
- **IMPLEMENTATION_SUMMARY.md** — Complete feature list and architecture decisions
- **PHASE1_FINAL_VALIDATION.md** — Testing results and quality assurance

## License

**PROPRIETARY** — All source code, database schemas, and IP are exclusive property of ROF Group. Unauthorized copying, distribution, or modification is prohibited.

---

**Built with by Grapes Worldwide** | ROF CRM Phase 1 | May 2026
