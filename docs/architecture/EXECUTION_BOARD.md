# ROF CRM execution board (final completion sprint)

Built from the code and a full local run, not from earlier documents. Branch `integration/rof-crm-stabilization`, base commit `fe5857c`.
Nothing here ran against production or Neon. Local disposable database only.

## Measured state at `fe5857c` (fresh database `rof_full`, migrations 096-145 applied twice, build exit 0, committed `dist` identical)
| Suite | Result |
|---|---|
| All API scripts (`docs/*/api-test-*.mjs`, 57) | 57 of 57 OK, 0 failed; 8,596 checks in the 48 scripts that print a total |
| All Playwright specs (15 files, 1 worker, no retries) | 245 passed, 0 failed |

Passing tests prove what the tests cover, not that a module is finished. Gaps below were found by reading the code.

## Module inventory (49 route files, 69 screens, 142 migrations)
Status: **Verified** = behaviour covered by runtime tests and no known functional gap; **Partial** = works but a known gap remains; **Blocked** = needs an owner decision.

| # | Module | Code | Tests (API / browser) | Status | Gaps |
|---|---|---|---|---|---|
| 1 | Sign-in, sessions, throttle, IP rules | `index.ts`, `auth.ts` | auth-phase1 68, phase1 50, ur006 24, throttle / auth-phase1 3 | Verified | shared throttle table is a pending migration (T2) |
| 2 | Users, roles, employees, security | `users.ts`, `roles.ts`, `employees.ts` | security 157, employees 116, ur001 40, ur011 26, ur005-008 18 | Partial | username/role integrity constraints are pending migrations M1-M3; D7 grant review before release |
| 3 | Companies, Set Master, Set Up lists, documents checklist | `master.ts`, `companies.ts` | set-master-* 77+171+92, setup 138 / 4 | Verified | none found |
| 4 | Company and project access | `db/pool.ts`, middleware | scope 34, company-access | Partial | strict NULL-scope model is a pending migration (M10a) |
| 5 | Projects, towers, floors, units, unit types, locations, import | `projects.ts`, `units.ts`, `import.ts` | set-projects-parity 267, units-rates 247, project-setup 81, parking-import 194 / 14 | Verified | none found |
| 6 | Unit availability, status grant, hold, brokers | `units.ts`, `inventory_hold.ts`, `brokers.ts`, `broker_setup.ts` | broker-hold 569, unit-status 46, unit-status-flows 25 / 12 | Partial | U-R report access, partial-grant paperwork (owner decisions) |
| 7 | Payment plans, charge master, add-on charges, GST configuration, PLC | `payment-plans`, `charge-master`, `addon-charges`, `gst-configuration`, `plc-charges` | plans 180, charge-master 63, addon-charges 152, gst 271, plc 92, unit-charges 62 / 6 | Partial | GST add-on configuration page was a dead button (removed) |
| 8 | Applicants, leads, CRM, tasks, campaigns, automation, calling | `consumers.ts`, `tasks`, `automation`, `communications` | applicants 348, crm 285 / 28 | Partial | **no message is ever sent** (see P1-2) |
| 9 | Booking and edit booking | `booking.ts` | booking 276 / 5 | Verified | print page had 5 dead buttons (removed); reminder and termination letters have no template |
| 10 | Allocation, transfer, surrender, restore, registry | `allocations`, `transfers`, `surrender`, `registry` | allocations 201, transfers 286, surrender 183 / part of 53 lifecycle | Verified | Q-U2 decided: unchanged |
| 11 | Demands, interest, waivers, grace | `demands`, `financial-ops`, `timely discount` | demands 189, timely-discount 42 | Verified | none found |
| 12 | Receipts, payments, TDS, outgoing, refunds, GST invoices | `receipts`, `payments`, `receipt-process`, `outgoing-payments` | receipts 283, payments-rest 1006, tds 246, outgoing 39 / 12 | **Blocked** | journal and debit/credit entries have no accounting effect (P1-1); receipt returns F1-F17 not built |
| 13 | Documents, vault, custom letters, templates, email templates | `documents/*`, `custom-letters`, `email-templates` | documents 132, documents-core 153, email-templates 87 / 5 | Partial | no template editor; no PDF preview |
| 14 | Reports, dashboard, analytics, reconciliation, milestones | `reports-*`, `dashboard`, `reconciliation`, `milestones` | reports 956, reports-lifecycle 24, dashboard-recon 197 / 69+4 | Partial | no Export Excel on the demand and receipt lists; U-R classification |
| 15 | Print, download gates, audit log, notifications | middleware, `communications` | print-download | Partial | notifications: P1-2 |
| 16 | Platform: migrations, pipeline, dist | `.github`, `db/` | whole-flow, end-to-end 68, regression | Partial | pending migrations need an owner-approved release batch |

## Prioritised findings
**P0 (data loss, vulnerability, broken core workflow): none confirmed.** Every core workflow tested end to end passes. Release blockers that are security-relevant but need the owner: strict NULL-scope model (M10a), shared throttle (T2), username and role integrity (M1-M3), D7 grants.

**P1 (required functionality not working)**
- **P1-1 Journal and debit/credit entries have no accounting effect.** `receipt-process.ts:101-120` only changes `journal_entries.status`; no demand, receipt or ledger changes, and the wizard's final TRANSFER, POST DEBIT/CREDIT and register FETCH were dead buttons (now replaced by a "switched off until the owner approves the accounting rule" note). Blocked on Finance Part B: what a journal, debit note and credit note must do to the ledger.
- **P1-2 Notifications are never sent.** `queues/` (email, sms, demand-letter workers, scheduler) is not imported by `index.ts`; messages are stored as `queued` and stay so. Blocked on an owner decision: provider (the per-project SMTP setup exists), WhatsApp/SMS vendor, and where the sender runs (the host is serverless, so a worker needs a scheduled job).
- **P1-3 Receipt returns (F1-F17)** are policy-approved but not built (Finance Part B).

**P2 (important UX or integration defect)**
- Dead "coming soon" controls on 11 screens: **fixed in this sprint** and guarded by a test (see below).
- Missing, not built: Export Excel on the demand list, the receipt list and the demand/payment reminder list; invoice PDF preview; letter template editor; reminder 1, reminder 2 and termination letters (need owner wording); campaign details view; GST add-on configuration page.
- `consumers.js` project filter is built from the first 100 units (existing flaw, harmless today).

**P3:** cosmetic only; none recorded.

## Done in this sprint
1. Removed or wired every dead control (a button must work or not be shown): booking print page (LOCK, DOCUMENT, RESET INTEREST, HISTORY, INVOICE and the three letter rows without templates), Documents (PDF preview, Save as Template, Template edit, DPR export), campaigns (Details), receipts list and demand list (Export Excel), GST configuration (add-on page), GST invoicing (PDF preview), finance journal screens (switched off with the reason), consumer detail (receipt Print now opens the real receipt), the orphan Surrender Report page (now opens the working report tab).
2. New regression guard in `docs/web-guards/api-test-web-guards.mjs`: no screen or generated page may contain a "coming soon" control.

## Needs the owner (not guessed)
Finance Part B (journal, debit/credit, receipt returns); notification provider and runtime; U-R report classification; partial-grant paperwork approach; reminder/termination letter wording; template editor and exports (confirm wanted); D7 grants; staging (Q-D5); APP_ENV rule (Q-D1); release order of the pending migrations (M1-M3, M9, M10a, T1, T2).

## Verification after the changes (local disposable database, API run from the rebuilt `dist`)
- `tsc --noEmit` clean, build exit 0, `dist` regenerated.
- API: web-guards 9, booking 276, receipts 283, demands 189, gst-configuration 271, surrender 183, documents-core 153, crm 285, unit-status 46, unit-status-flows 25 (now also checks the PLC rate-list `unit_count` per grant), plc 92: all 0 failed.
- Playwright, full run after the change: 240 passed, 3 timed out, 2 not run. The two journal/campaign tests that encoded the old "coming soon" behaviour were updated to the new behaviour and pass. The 3 timeouts (two `reports.spec.ts` screens, `SM-001`) are 90-second and longer waits while the machine was swapping; the same tests pass when run alone (5 of 5), although that rerun also took 17 minutes of wall time, so a clean full run on a quiet machine is still owed. The report endpoints themselves answer in about 40 ms.
- Independent read-only review of `1687881` (separate reviewer agent, code reading only): no critical or high issue; one low gap, the PLC rate list `unit_count` was not under the grant, now fixed under U-C and tested.
