# ROF CRM - Haryana Affordable Housing Management Platform

A **production-grade, world-class CRM platform** built for ROF Group to manage the complete lifecycle of affordable housing sales in Haryana, from lead capture through e-draw, allotment, payment collection (HRERA-compliant), document generation, and possession handover.

## Project Status

**Phase 1: Core CRM Build (In Progress)**
- ✅ Monorepo setup (pnpm workspaces)
- ✅ Design system with design tokens & components
- ✅ TypeScript types for all domain entities
- ✅ Database schema (PostgreSQL, ACID-compliant)
- ✅ API structure (Node.js + Express)
- ✅ Web frontend (React 18 + Tailwind CSS)
- 🔄 Component implementation (in progress)
- 🔄 API endpoint development (in progress)

## Technology Stack

### Backend
- **Node.js 20 LTS** + Express.js (RESTful API)
- **PostgreSQL 15+** (ACID, relational, immutable audit log)
- **Bull + Redis** (async job queues: demand letters, PDF generation, WhatsApp delivery)
- **JWT** (15-min access tokens, 7-day refresh tokens)
- **Puppeteer + Handlebars** (PDF document generation)
- **bcryptjs** (password hashing, 12 rounds)
- **AES-256** (at-rest encryption for sensitive fields)
- **TLS 1.2+/1.3** (in-transit encryption)

### Frontend
- **React 18+** (UI library)
- **Ant Design 5.x** (component library, 60+ components, enterprise-grade)
- **Tailwind CSS v4** (design tokens, responsive utilities)
- **React Hook Form v7+** (form handling)
- **Zod** (runtime form validation)
- **Zustand** (state management, 3KB, minimal boilerplate)
- **React Query** (data fetching, caching, refetching)
- **TanStack Table v8** (headless data tables)
- **Recharts** (data visualization)
- **Framer Motion v12** (animations, 120fps)
- **Lucide React** (1500+ icons)
- **date-fns v3** (date handling)

### Development
- **TypeScript** (strict mode, no 'any' types)
- **Vite** (fast build tool)
- **Storybook** (component documentation)
- **ESLint 9+** (flat config, strict rules preventing vibe-coding)
- **Prettier v3** (code formatting)

## Project Structure

```
rof-crm/
├── packages/
│   ├── design-system/        # React components + design tokens + Storybook
│   │   ├── src/components/   # 60+ components (Button, Card, DataTable, etc.)
│   │   ├── src/theme/        # colors, typography, spacing, shadows, motion
│   │   └── .storybook/       # Component documentation
│   ├── types/                # Shared TypeScript interfaces (Consumer, Unit, Payment, etc.)
│   ├── api/                  # Backend API (Node.js + Express + PostgreSQL)
│   │   ├── src/db/           # Database schema, migrations
│   │   └── src/              # API routes, business logic
│   └── web/                  # Frontend (React 18 + Vite)
│       ├── src/pages/        # Page components (Dashboard, Consumers, Units, etc.)
│       ├── src/components/   # Reusable components (Layout, ProtectedRoute, etc.)
│       ├── src/hooks/        # Custom hooks (useConsumer, usePayment, etc.)
│       ├── src/store/        # Zustand stores (auth, ui)
│       └── src/api/          # API client + React Query setup
└── pnpm-workspace.yaml       # Monorepo configuration
```

## Getting Started

### Prerequisites
- Node.js 20+ LTS
- pnpm (npm install -g pnpm)
- PostgreSQL 15+
- Redis (for job queues)

### Installation

```bash
# Clone repository
git clone <repo-url>
cd rof-crm

# Install dependencies (all packages)
pnpm install

# Set up environment variables
cp packages/api/.env.example packages/api/.env
# Edit packages/api/.env with your configuration

# Create database and run migrations
pnpm -F @rof-crm/api db:migrate

# Build design-system and types packages
pnpm build
```

### Development

```bash
# Start all services in parallel (API on :3000, Web on :5173, Storybook on :6006)
pnpm dev

# Or start individually:
pnpm -F @rof-crm/api dev      # API server
pnpm -F @rof-crm/web dev      # Web frontend
pnpm storybook:dev            # Design system components
```

### Build

```bash
# Build all packages
pnpm build

# Build specific package
pnpm -F @rof-crm/web build

# Build Storybook
pnpm storybook:build
```

## Anti-Vibe-Coding Enforcement

This codebase is **designed from the ground up to prevent "vibe-coding"** (hastily-assembled, inconsistent UI):

1. **Design System**: Every color, spacing, shadow, font, animation is pre-defined in tokens
2. **Storybook**: All components documented with 3–60 stories per component
3. **ESLint Rules**: No arbitrary colors, spacing, or shadows allowed
4. **TypeScript Strict Mode**: No 'any' types, all props typed
5. **Component Library**: 60+ pre-built components, all variants in Storybook
6. **Accessibility**: WCAG 2.1 AA enforced (4.5:1 contrast, keyboard nav, ARIA labels)
7. **Code Review Checklist**: 20-item checklist covers colors, spacing, forms, modals, accessibility

## Key Features

### Module A: Units & Inventory Management
- 8-stage unit status engine (available → draw pending → allotted → possession handed over)
- Color-coded inventory grid (visual status overview)
- Tower-wise breakdown
- Bulk CSV/Excel import
- Floor plan attachment

### Module B: Consumer Records & Profiles
- 360° consumer profile with KYC vault
- Lead pipeline stages (Enquiry → Allotted → Onboarded)
- One-application-per-family rule (via Parivar Pehchan Patra)
- Advanced search (name, mobile, Aadhaar, application ID)
- Document folder hierarchy (Project → Tower → Unit → Consumer → Document Category)

### Module C: Allocation & Allotment Management
- E-draw result import (CSV from TCP Haryana)
- One-click allotment with atomic transactions
- AllotmentLetter generation (dynamic Handlebars template)
- Waitlist management (ordered, auto-promotion on cancellation)
- Atomic cancellation workflow (forfeiture calc, refund initiation, waitlist promotion)

### Module D: Payments & Receipts Management
- **AHP-compliant payment plan**: 5% booking → 20% allotment → 6×12.5% half-yearly
- **HRERA Rule 15 interest**: SBI MCLR + 2% (~11.10% per annum, simple interest)
- **Demand letter automation**: Bull cron at 2 AM IST, send 15/7/3 days before due
- Receipt recording (bank transfer, cheque, NEFT, UPI)
- Bank reconciliation (CSV import, auto-match)
- Payment dashboard (KPIs: receivables, collection %, ageing buckets)

### Module E: Letters & Document Generation
- **Template engine**: Rich-text editor with merge fields
- **Pre-built templates**: Allotment Letter, Demand Letter, Receipt, BBA, NOC, Possession Letter, etc.
- **PDF generation**: Puppeteer + Handlebars
- **Delivery tracking**: Email + WhatsApp with sent/delivered/read status
- **Scanned contract vault**: OCR + full-text search, version control

### Module F: Communications & Remarks Log
- **Omnichannel**: Email (Gmail/Outlook), WhatsApp Business API, SMS (Twilio)
- **Remarks log**: Per-consumer chronological log, auto-logged system events
- **AI-assisted responses**: Claude API suggests replies (editable before sending)
- **Knowledge base**: FAQ, policies, process steps
- **Ticket escalation**: Unresolved > 24 hrs auto-escalates to Sales Manager

### Module G: Users, Analytics & Reporting
- **RBAC**: 6 pre-defined roles + custom role builder
  - Super Admin, Project Manager, Sales Executive, Accounts/Finance, Support Agent, Read-Only Viewer
- **Field-level masking**: Aadhaar, PAN, bank details hidden from junior staff
- **3 dashboards**: Sales (pipeline, conversion), Financial (receivables, ageing, collection %), Project (fill rate, allotment progress)
- **Custom report builder**: Drag-and-drop, export Excel/PDF, scheduled delivery
- **Immutable audit log**: Append-only (PostgreSQL GRANT), 1-year retention

## Database Schema

30+ tables covering:
- Projects, Towers, Units (with 8-stage status engine)
- Consumers, KYC Documents, Co-Applicants
- Allocations, Waitlists, Cancellations
- Payment Plans, Demands, Receipts, Penal Interests
- Documents, Remarks, Emails, WhatsApps
- Users, Roles, Audit Logs (append-only)

**Key characteristics**:
- SERIALIZABLE isolation for critical transactions (e-draw import, allotment, cancellation)
- All money values in paise (not rupees) to avoid floating-point errors
- Immutable audit log (UPDATE/DELETE revoked via GRANT)
- Full referential integrity (FK constraints)
- Comprehensive indexes for performance

## API Specification

**50+ RESTful endpoints** covering all modules:

### Consumer APIs
- `POST /consumers` - Create lead
- `GET /consumers` - List with search + filter
- `GET /consumers/:id` - Profile view
- `POST /consumers/:id/kyc-documents` - Upload KYC
- `POST /consumers/bulk-import-edraw` - Import e-draw results

### Payment APIs
- `POST /payment-plans` - Create AHP payment plan
- `GET /payments/overdue` - List overdue (with HRERA interest)
- `POST /receipts` - Record payment
- `GET /payments/dashboard` - KPIs + charts

### Document APIs
- `POST /document-templates` - Create template
- `POST /documents/generate` - Generate PDF
- `POST /documents/bulk-generate` - Bulk generate (async job)

### Communication APIs
- `POST /remarks` - Add remark
- `GET /remarks` - Chronological log
- `POST /whatsapp/send` - Send WhatsApp message
- `POST /ai-suggestions` - Get Claude API suggestions

### Reporting APIs
- `GET /dashboards/sales` - Sales KPIs + charts
- `POST /reports/custom-builder` - Build custom report
- `GET /audit-log` - Immutable audit trail

## Design System Token Reference

### Colors
```typescript
colors.neutral[50-900]    // Grayscale (11 shades)
colors.success[50-700]    // Green (#52C41A)
colors.warning[50-700]    // Amber (#FAAD14)
colors.error[50-700]      // Red (#FF4D4F)
colors.info[50-700]       // Blue (#1890FF)
colors.primary[50-700]    // Purple (#722ED1)
```

### Spacing
```typescript
8px, 16px, 24px, 32px, 48px, 64px, 80px, 96px
// Multiples of 8px (enforced by ESLint)
```

### Shadows
```typescript
elevation-0  // Border only (1px #E8E8E8)
elevation-1  // Subtle (0 2px 4px)
elevation-2  // Elevated (0 4px 8px)
elevation-3  // Raised (0 8px 16px)
elevation-4  // Floating (0 12px 24px)
elevation-5  // Modal (0 16px 32px)
```

### Typography
```typescript
h1: 48px / bold / -0.01em    // Page titles
h2: 32px / bold
h3: 24px / semibold
body: 16px / regular / 1.5   // Default text
small: 14px / regular
caption: 12px / regular
```

## HRERA Compliance

This CRM is **fully compliant with HRERA Rule 15** (Penal Interest on Overdue Payments):

- Interest rate: SBI MCLR + 2% (~11.10% per annum)
- Calculation: Simple interest (P × R × T / 100)
- Auto-flagging: Overdue payments automatically calculated daily
- Escalation: Overdue > 7 days auto-escalates to Sales Manager

## Non-Negotiable Requirements

- ✅ All money in paise (not rupees)
- ✅ AHP payment structure hardcoded (no variations)
- ✅ SERIALIZABLE transactions for atomic operations
- ✅ Immutable audit log (append-only)
- ✅ AES-256 encryption at rest for sensitive fields
- ✅ TLS 1.2+/1.3 encryption in transit
- ✅ JWT 15-min access tokens
- ✅ bcrypt 12-round password hashing
- ✅ RBAC with field-level masking
- ✅ Forfeiture amount hardcoded (₹29,500)

## Contributing

See `CONTRIBUTING.md` for:
- Code standards (TypeScript strict, ESLint, Prettier)
- PR checklist (20-item anti-vibe-coding validation)
- Component documentation (Storybook mandatory)
- Testing requirements
- Accessibility compliance (WCAG 2.1 AA)

## License

**PROPRIETARY** - All source code, database schemas, and IP are exclusive property of ROF Group. Unauthorized copying, distribution, or modification is prohibited.

---

**Built with ❤️ by Grapes Worldwide** | ROF CRM Phase 1 | April 2026
