# 🌱 ROF CRM Demo Data Seed Guide

Complete guide to generating and managing demo data for ROF CRM demonstration to stakeholders.

---

## 📋 Overview

This seed script creates **3 realistic demonstration scenarios** with complete workflows, allowing you to showcase the full CRM functionality to management and senior staff.

### Available Scenarios

| Scenario | Purpose | Use Case |
|----------|---------|----------|
| **FRESH_PROJECT** | New project launch | Show early-stage lead management, initial allocations |
| **ACTIVE_PROJECT** | Mid-stage operations | Demonstrate payment flows, overdue handling, active workflows |
| **MATURE_PROJECT** | Near completion | Display high collection rates, final stages, possession handover |

---

## 🚀 Quick Start

### Run Default Scenario (ACTIVE_PROJECT)
```bash
cd packages/api
npm run seed:demo
```

### Run Specific Scenario
```bash
# Fresh/New Project
npm run seed:fresh

# Active Project (Recommended for demos)
npm run seed:active

# Mature/Completed Project
npm run seed:mature
```

---

## 📊 Scenario Details

### Scenario 1: FRESH_PROJECT
**"ROF Harmony Heights - Phase 1"**

**Status:** Project just launched
- **Total Units:** 50
- **Consumers:** 15 (mostly in early stages)
- **Allocations:** 3 (20% rate)
- **Milestones:** 13 (1-2 in progress, rest pending)

**Demo Highlights:**
- ✅ Enquiry and application pipeline
- ✅ E-Draw process (draw_entered status)
- ✅ Initial unit inventory
- ✅ Construction milestones just starting
- ✅ Minimal payment collection (early bookings only)

**Good For:** Explaining lead stages, unit management, early-stage CRM

---

### Scenario 2: ACTIVE_PROJECT ⭐ RECOMMENDED
**"ROF Serenity Residences - Phase 2"**

**Status:** Mid-way through project lifecycle
- **Total Units:** 80
- **Consumers:** 40 (most allotted)
- **Allocations:** 32 (80% rate)
- **Payment Stages:** Multiple (booking paid, allotments, mid-stage, overdue, completed)
- **Milestones:** 13 (5 completed, 1 in progress, 7 pending)

**Demo Highlights:**
- ✅ Active payment collection (₹50L+ collected)
- ✅ Multiple payment stages showing flow
- ✅ **Overdue payments** with penal interest calculation
- ✅ Demand letters and reminders
- ✅ Waitlist management (8 consumers waiting)
- ✅ Construction progress (4/13 milestones complete)
- ✅ Multiple consumer communications needed

**Good For:** Full end-to-end workflow demo, payment dashboard, collections metrics

---

### Scenario 3: MATURE_PROJECT
**"ROF Elite Park - Phase 1 (Complete)"**

**Status:** Near completion, possession handover in progress
- **Total Units:** 120
- **Consumers:** 60 (95% allotted)
- **Allocations:** 57 (95% rate)
- **Payment Status:** ~95% of consumers fully paid
- **Milestones:** 13 (12 completed, 1 handover in progress)

**Demo Highlights:**
- ✅ High collection rate (excellent metrics)
- ✅ Possession handovers happening
- ✅ Low overdue rate
- ✅ Majority of milestones complete
- ✅ Final stages of project lifecycle
- ✅ Strong completion percentage

**Good For:** Success story showcase, final stage workflows, closing metrics

---

## 📈 Data Characteristics by Scenario

### Consumer Distribution
```
FRESH_PROJECT:
  - Enquiry: 30%
  - Interested: 20%
  - Application Filed: 30%
  - Draw Entered: 20%

ACTIVE_PROJECT:
  - Allotted: 80%
  - Onboarded: 20%

MATURE_PROJECT:
  - Allotted: 95%
  - Onboarded: 5%
```

### Payment Distribution
```
FRESH_PROJECT:
  - Booking paid: 20%
  - No further payments: 80%

ACTIVE_PROJECT:
  - Full payment: 40%
  - Mid-stage (3 installments paid): 35%
  - Overdue: 15%
  - Awaiting first payment: 10%

MATURE_PROJECT:
  - All paid: 90%
  - Awaiting possession: 8%
  - Possession completed: 2%
```

---

## 🎯 What Gets Created

Each scenario generates:

### Projects
- ✅ 1 complete project with RERA number, TCP licence
- ✅ Realistic location data (Gurugram sectors)

### Units
- ✅ 50-120 residential units
- ✅ Mixed BHK types (1BHK, 1.5BHK, 2BHK)
- ✅ Realistic pricing (₹35L-₹50L base)
- ✅ Carpet area, super area, GST calculation
- ✅ Status tracking (available → allotted)

### Consumers
- ✅ 15-60 realistic Indian consumers
- ✅ Income categories (EWS, LIG, MIG)
- ✅ Contact information (mobile, email)
- ✅ Lead stage tracking
- ✅ Allocated units mapping

### Allocations
- ✅ E-draw allotment records
- ✅ Allocation dates (spread over timeline)
- ✅ Status tracking (allotted)

### Payment Plans & Receipts
- ✅ **AHP-compliant payment schedule:**
  - Booking: 10% (₹3.5L)
  - Allotment: 20% (₹7L within 15 days)
  - 6 Installments: 12.5% each (₹4.375L)
- ✅ Payment methods (bank transfer, cheque, NEFT, RTGS, UPI)
- ✅ Transaction references
- ✅ Received dates tracking

### Demand Letters
- ✅ Auto-generated for due/overdue amounts
- ✅ 15-day, 7-day, 3-day reminders
- ✅ Penal interest calculations for overdue (11.10% per annum)

### Milestones
- ✅ 13 construction milestones per project
- ✅ Types: Foundation, Structure, MEP, Finishing, Legal, Handover
- ✅ Planned vs. Actual dates
- ✅ Completion percentage
- ✅ Status tracking (pending, in-progress, completed)

### Waitlist
- ✅ Ordered queue for unallocated consumers
- ✅ Position tracking for promotion scenarios

---

## 💡 Demo Flows to Showcase

### Flow 1: Allocation Dashboard
**Page: `/allocations`**
- Show all allocations by status
- Filter by project, stage
- Display success metrics

### Flow 2: Consumer Profiles
**Page: `/consumers`**
- Complete 360° profile view
- Allocated unit details
- Lead stage progression

### Flow 3: Payment Collection Dashboard
**Page: `/payments`**
- Total receivables (₹2-3 Crores depending on scenario)
- Collection rate % (20% fresh, 80% active, 95% mature)
- Overdue aging report
- Penal interest calculations

### Flow 4: Bank Reconciliation
**Page: `/payments/reconciliation`**
- Import sample bank statements
- Auto-match received payments
- Flag discrepancies

### Flow 5: Construction Progress
**Page: `/projects/milestones`**
- Visual timeline of milestones
- Completion percentage progress
- Actual vs. planned dates
- Status updates

### Flow 6: Payments & Receipts
**Page: `/payments`**
- Demand letter generation
- Receipt recording
- Payment method tracking

---

## 🔄 Running Seed Scripts

### Installation
```bash
cd packages/api
npm install
```

### Execute Seed
```bash
# Default (ACTIVE_PROJECT recommended)
npm run seed:demo

# Or specific scenario
npm run seed:active
npm run seed:fresh
npm run seed:mature
```

### Expected Output
```
🌱 Starting seed: Active Project
📝 Description: Mid-way through project lifecycle with active payments and some issues

📦 Creating Project: ROF Serenity Residences - Phase 2
   📐 Creating 80 units...
   👥 Creating 40 consumers...
   🎯 Creating 32 allocations (80% rate)...
   💰 Creating payment plans and receipts...
   🏗️ Creating milestones...
   ⏳ Creating waitlist entries...

✅ Seed completed successfully!
```

---

## 📊 Demo Metrics by Scenario

### FRESH_PROJECT
- Total Receivables: ₹25 Crores
- Collected: ₹5 Crores (20%)
- Outstanding: ₹20 Crores (80%)
- Construction Progress: 5% complete

### ACTIVE_PROJECT ⭐
- Total Receivables: ₹80 Crores
- Collected: ₹40 Crores (50%)
- Outstanding: ₹40 Crores (50%)
- **Overdue: ₹8 Crores (10%)**
- Construction Progress: 38% complete
- Milestones Complete: 4/13

### MATURE_PROJECT
- Total Receivables: ₹120 Crores
- Collected: ₹114 Crores (95%)
- Outstanding: ₹6 Crores (5%)
- Overdue: <₹1 Crore (<1%)
- Construction Progress: 92% complete
- Milestones Complete: 12/13

---

## 🎬 Recommended Demo Script

1. **Start with ACTIVE_PROJECT** - Best for showing full features
   ```bash
   npm run seed:active
   ```

2. **Show Allocations Dashboard** (`/allocations`)
   - "We have 40 consumers, 32 allotted, 8 on waitlist"

3. **Navigate to Payments** (`/payments`)
   - "₹80 Crores total receivable, ₹40 Crores collected"
   - Show the overdue section - "₹8 Crores overdue, requiring follow-up"

4. **Show Construction Progress** (`/projects/milestones`)
   - Timeline of 13 milestones
   - "38% complete, on track for possession in 6 months"

5. **Bank Reconciliation** (`/payments/reconciliation`)
   - "Import bank statements, auto-match payments"

6. **Demand Letters** (within Payment Dashboard)
   - "Auto-generated, sent via email/WhatsApp"

---

## ⚙️ Database Notes

- **Connection:** Uses .env settings (DB_HOST, DB_USER, etc.)
- **Data:** Inserted with `ON CONFLICT DO NOTHING` (safe for re-runs)
- **No Data Loss:** Script doesn't truncate existing data (optional)
- **Rollback:** Delete records manually or recreate database

---

## 🚨 Important Notes

✅ **All data is realistic** - Proper Indian names, addresses, formats
✅ **No backend logic modified** - Pure data insertion
✅ **Frontend displays as-is** - Uses existing hooks and components
✅ **Idempotent** - Can run multiple times safely
✅ **Scenario-based** - Choose right scenario for your audience

---

## 📞 Support

For issues with seed data:
1. Check database connection in `.env`
2. Ensure PostgreSQL is running
3. Verify tables exist (run migrations first)
4. Run `npm run seed:active` for full workflow demo

---

**Ready for demo? Run: `npm run seed:active` and navigate to `http://localhost:5173/payments`** 🎉
