# ROF CRM: Module by Module Verification Plan

Purpose: find where the system breaks, one module at a time, then check everything together. Every module gets its own flow document. Work that is found but not done in the moment goes into `DEFERRED_TASKS.md`, so it can be picked up in parallel later.

Status: plan only. Module 0 (Login and session) is already done, see `LOGIN_SYSTEM.md`.

---

## 1. Method

### Phase A: one module at a time

For each module, in the order of section 3:

1. **Map it.** Write down the screens, the API routes, the database tables it reads and writes, and its business rules. The facts come from the code, not from memory. Output: `docs/modules/NN-name.md` (template in `docs/modules/TEMPLATE.md`).
2. **Prepare data.** Use a local database or a Neon branch only. Never use production data or the live consumers (see `CLAUDE.md`).
3. **Run the flow in a browser.** Happy path, validation errors, each role that may use it, and edge cases (empty data, duplicates, cancelled or transferred records, dates around month end).
4. **Check the data.** After every action, read the database to confirm that the right rows changed and nothing else did.
5. **Log breakages.** Each one gets an ID (`M<module>-B<number>`) with steps to reproduce, the root cause, and a severity.
6. **Fix or defer.** Fix only what belongs to this module and is safe. Anything that touches another module, needs a business decision, or is large goes to `DEFERRED_TASKS.md` with an ID. Nothing is fixed silently and nothing is left unwritten.
7. **Close the module.** Re-run its flow, update its document, and record it in the tracker (section 4).

### Phase B: everything together

Run after the modules in a group are closed (section 5):

1. End to end journeys across modules (section 5).
2. Totals that must agree across screens and reports.
3. Regression: after any fix, re-run the smoke test of every module that depends on the changed one.

### Rules that keep this safe

- One module open at a time.
- Changes stay inside the module, in line with the project rule on surgical changes. Anything wider needs approval first.
- No commits without an explicit "commit it".
- Production and the live consumers are never used for testing.
- Every finding is written down with evidence (a request, a screenshot, a row), not described from memory.

---

## 2. Prerequisite: a database that matches the code

The local database cannot be rebuilt from the migration files (details in `LOGIN_SYSTEM.md`, section 6). Tables such as `companies`, `company_bank_accounts`, `document_field_overrides` and `nav_pages`, and the column `consumers.main_broker_id`, are used by the code but created by no migration. Until this is solved, pages that use them return 500 locally, and module results would be about local drift, not about real bugs.

Options (decision needed, tracked as DT-001):

| Option | What it means | Note |
|---|---|---|
| A. Schema only copy of Neon | `pg_dump --schema-only` from a Neon branch, restored locally, then add synthetic test data | Closest to production. Needs Neon access. No real data is copied. |
| B. Neon branch for testing | Test directly on a branch of the Neon database | `CLAUDE.md` recommends a branch. Contains real data unless it is scrubbed. |
| C. Write the missing migrations | Reconstruct the missing tables and columns from the code | Slower, and may differ from production. |

Recommended: A. Modules cannot start before this is decided.

---

## 3. Modules and order

The order follows the data: a module comes after the modules whose data it needs. Counts come from the navigation menu (`packages/web/public/index.html`) on 2026-10-14. The route files and tables for each module are confirmed in step 1 of that module, not guessed here.

| # | Module | Menu entries | Needs first | What it contains |
|---|---|---|---|---|
| 0 | Login and session | Login page, logout | none | Done. See `LOGIN_SYSTEM.md`. |
| 1 | Set Master | Set Up: country, state, city, salutation, profession, nationality, bank, source of enquiry, company; Documents: document type, dispatch | 0 | Reference data used everywhere. |
| 2 | Employees, Security, Roles | Employee login creation, Employee (department, information, manager, team, team head, tree), Security, Role and Menu, Customized Letters | 0, 1 | Users, permissions, role menus. Retest the login permission bootstrap here. |
| 3 | Set Projects | Create Project, Payment Plan Setup, New, Edit, Project Set Up, Charge Master, Addon Charges, GST, Set Rate | 1 | Projects, towers, units, plans, charges, GST, interest rates. |
| 4 | Broker | Broker setup, Broker Reports | 1, 3 | Brokers, commissions. |
| 5 | Inventory | Investor / Hold, Unit Status, Import, Parking | 3 | Unit holds, status, bulk import, parking. |
| 6 | Booking | Application: Booking | 1 to 5 | Consumer, co-applicants, booking form, documents. |
| 7 | Allotment | Allotment of Unit, e-draw | 6 | Allotment and allocation status. |
| 8 | Transactions and Receipts | Transaction, Receipt Process | 6, 7 | Payments, cheques, receipts, clearing, bounce. |
| 9 | Demand | Demand Raise, Printing of Document | 7, 8 | Demand letters and printed documents. |
| 10 | Interest | Interest Calculation, Project Wise, Customer Wise, Interest Waiver | 8, 9 | Interest rules, schedulers, waivers, grace period. |
| 11 | Collection | Collection Process, Calling | 8, 9 | Follow up on dues. |
| 12 | Transfer | Transfer, setup, report, detail, letter, date edit | 7, 8 | Ownership transfer. |
| 13 | GST Invoicing | GST Invoicing | 8, 3 | Invoices and GST ledgers. |
| 14 | Surrender / Cancellation | Surrender / Cancellation | 7, 8, 9 | Cancellations and refunds. |
| 15 | CRM | CRM menu | 6 | Leads, tasks, campaigns, communications, FAQ. |
| 16 | Reports | Inventory, Unit Status, Applicant Detail, Collection, Dues, Stage Wise Dues, Percentage Wise, Due Ageing, Charge Detail (35 links) | 6 to 14 | Read only views. Checked last, because they depend on everything. |
| 17 | Dashboard, Folders, Unit Docs, Help | Direct links | 6 to 14 | Summary widgets, document folders, unit documents. |

The order can change, but a module is never verified before the data it needs.

---

## 4. Tracker

Update this table as each module moves.

| # | Module | Flow doc | Status | Breakages found | Fixed | Deferred | Closed on |
|---|---|---|---|---|---|---|---|
| 0 | Login and session | `LOGIN_SYSTEM.md` | Done | 9 | 8 | 1 (F6, DT-002) | 2026-10-14 |
| 1 | Set Master | | Not started | | | | |
| 2 | Employees, Security, Roles | | Not started | | | | |
| 3 | Set Projects | | Not started | | | | |
| 4 | Broker | | Not started | | | | |
| 5 | Inventory | | Not started | | | | |
| 6 | Booking | | Not started | | | | |
| 7 | Allotment | | Not started | | | | |
| 8 | Transactions and Receipts | | Not started | | | | |
| 9 | Demand | | Not started | | | | |
| 10 | Interest | | Not started | | | | |
| 11 | Collection | | Not started | | | | |
| 12 | Transfer | | Not started | | | | |
| 13 | GST Invoicing | | Not started | | | | |
| 14 | Surrender / Cancellation | | Not started | | | | |
| 15 | CRM | | Not started | | | | |
| 16 | Reports | | Not started | | | | |
| 17 | Dashboard, Folders, Unit Docs, Help | | Not started | | | | |

Status values: Not started, Mapping, Testing, Fixing, Done, Blocked.

---

## 5. Phase B: integration journeys

Each journey is run only after every module it uses is Done. Each step records the expected rows and totals.

| ID | Journey | Modules | Must hold true at the end |
|---|---|---|---|
| J1 | Set up a project to a sellable unit | 1, 3, 5 | Unit appears in inventory with the right price, plan and charges. |
| J2 | Enquiry to booking to allotment | 6, 7 | Booking and allocation agree, unit status changes once, no double booking. |
| J3 | Booking money to receipt | 6, 8 | Receipt numbers are unique and in sequence, balance is correct, GST and TDS follow the rules. |
| J4 | Demand to payment | 9, 8 | Demand total, receipt allocation and outstanding agree. |
| J5 | Late payment to interest to waiver | 10, 8 | Interest follows the project rate and grace period, waiver reduces the right amount. |
| J6 | Transfer of a unit | 12, 8 | New owner gets the right dues, old owner is closed, unit has one active allocation. |
| J7 | Surrender and refund | 14, 8, 9 | Unit returns to stock, refund and cancelled demands are consistent. |
| J8 | Cheque bounce | 8, 10 | Receipt reversed, interest recalculated, status visible in reports. |
| J9 | Report reconciliation | 16 | Collection, dues, ageing and stage wise reports agree with the underlying tables and with each other. |
| J10 | Role walk through | 2, all | Each role sees only its menus and can only do what the RBAC table allows. |

### Cross module checks

- The same amount must give the same figure on the screen, the receipt, the letter and the report.
- One unit has at most one active allocation.
- Status enums (`lead_stage`, `allocation_status`, receipt status) are written and read with the same values everywhere.
- Deleting or cancelling a record never leaves an orphan in another module.

---

## 6. Per module output

Each module document (`docs/modules/NN-name.md`) follows `docs/modules/TEMPLATE.md`: purpose, screens, routes, tables, business rules, flow diagram, test cases with results, breakages, deferred items, regression list.

---

## 7. How a breakage is classified

| Severity | Meaning |
|---|---|
| S1 | Wrong money, wrong legal document, data loss, or a security hole. |
| S2 | A core flow cannot be completed. |
| S3 | A flow works but gives a wrong or confusing result. |
| S4 | Cosmetic or minor. |

S1 and S2 are fixed (or escalated) before the module is closed. S3 and S4 may be deferred with an ID.

---

## 8. Next step

1. Decide the database option in section 2 (DT-001).
2. Start with Module 1 (Set Master): it is small, has no dependencies, and exercises the template and the method.
