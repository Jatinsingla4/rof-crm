# A. Master correction register

Base: build `976afd9` (deployed), worktree `rof-crm-wave0`, branch `fix/remediation-batch1`. Source: Independent Retest Report, 18 Nov 2026.
Status words: **CODE FIXED** (changed and checked by the tests named), **PARTIAL** (part fixed, part open), **DECISION** (blocked on an ROF decision, a safe boundary is in place), **DATA** (historical data issue, listed not repaired), **PASS** (already passed in the retest, not touched), **NOT REPRODUCED** (code gives no cause, needs a data row).
Nothing was run against the shared Neon database or the live site. "Checked" means the unit tests, or the HTTP checks on a throwaway local database. No browser test was run.
QA-019 and QA-028 are not in the report.

| QA | Sev | Root cause | Files | Fix | Migration | ROF decision | Test | Status |
|---|---|---|---|---|---|---|---|---|
| QA-032 | P0 | Applicant File took header GST from non-cancelled demands, the schedule table read all demands, the breakup read the booking rate | booking.ts, agreement-reconcile.ts | `billableDemands`: a cancelled booking or demand feeds no header, schedule or payable figure | no | no | agreement-reconcile.test (3), quote-schedule | CODE FIXED (not seen on ZZREG data) |
| QA-001 | P0 | Breakup used one booking rate on BASIC and PLC, schedule uses per-head mapped rates; consumers.ts resolved the rate for today, not the booking date | booking.ts, consumers.ts, agreement-reconcile.ts | `headGst` per head at booking date, same `resolveRate` as the schedule | no | BR-02, BR-07 (is PLC taxed, which rate) | agreement-reconcile.test | CODE FIXED, rate itself DECISION |
| QA-005 | P0 | With no demand rows the file schedule ignored discount and balcony, so principal differed from agreement value. The Rs 1,00,000 between 55,00,000 and 54,00,000 is `company_inaugural_disc` | booking.ts, quote.ts, golden | fallback row principal = price less discount plus balcony, GST stays on full price | no | discount basis (agreement 54,60,000 vs 55,60,000) | quote-schedule (new case) | PARTIAL, basis DECISION |
| QA-030 | P1 | Booking creation already enforces plan = 100%, so Sh Tester is an old or incomplete schedule | financial-measures.ts, reports-dues.ts, reports.js | `scheduleGap` exception, shown on Due Summary, counted in financial-measures | no | no | money-rules.test | DATA, detection added |
| QA-033 | P1 | Demand Status credit summed all cleared receipts including synthetic advance copies, the ledger excludes them | demands.ts | `is_advance IS NOT TRUE` on both queries, paid via `paidByDemand` (with approved credit allocations) | no | no | money-rules.test | CODE FIXED (the 777 is not confirmed to be the advance copy) |
| QA-034 | P2 | A (ex-GST) minus cleared (GST inclusive) | reports-dues.ts, reports.js | `received_clear_ex_gst`, ex-GST tabs use it, with-tax tab uses full cleared | no | no | none automated (code read only) | CODE FIXED, not tested |
| QA-002 | P0 | Receipt cancel is already blocked by a live invoice; INV/2026/00003 is a historical case | payments.ts | read-only `GET /gst-invoices/exceptions`; cancel with credit note already existed | no | accounting treatment | http-gst-invoices | PARTIAL, DATA |
| QA-003 | P0 | No GSTIN or financial year check, server default 18%, UI preselected 5% AHP | payments.ts, gst-invoicing.js | 409 without project GSTIN or financial year, 400 without a rate, neutral rate labels | no | approved FY, slabs, GSTIN, default labels | http-gst-invoices | CODE FIXED, config open |
| QA-004 | P1 | UI counted `active` but the server writes `generated`; Setup is all periods, Report one month; no cap on direct invoices | payments.ts, gst-invoicing.js | live count, scope labels, direct invoice cap against booking value | no | cap value | http-gst-invoices | CODE FIXED (Rs 1,000 gap not traced) |
| QA-031 | P0 UI | Server already refused uncleared receipts (gate `gst_invoice_requires_cleared`) | payments.ts | none needed, proved over HTTP | no | tax timing | http-gst-invoices | PASS (server proven) |
| QA-008 | P1 | By design unnamed money stays credit until a checker allocates it | demand-status.js | label only; `receipt_allocation_v1` left off | no | BR-09, allocation order | none | DECISION |
| QA-009 | P1 | Clearance gate is behind `commission_requires_cleared_v1` (off) | brokers.ts, brokers.js | list shows cleared money behind each commission, "Paid, no cleared receipt" label | no | commission base and trigger | http-security | PARTIAL, flag off |
| QA-010 | P1 | Server checks exist on every approval route; super_admin bypasses process rights by design; dashboard showed Approve to all | dashboard.js | Approve only for checker right, rest proved over HTTP | no | super_admin exemption | http-security | PARTIAL, policy DECISION |
| QA-011 | P1 | Applicant File uses a 60 second scoped link token (not the login token) | none | proved and documented in LINK_TOKENS.md | no | single use, binding | http-security | PASS (documented) |
| QA-012 | P1 | No cancelled-booking guard on receipt create, approve, deposit, clear, demand raise | booking-state.ts, receipts.ts, demands.ts, consumers.ts, consumer-detail.js, dashboard.js | 409 and skipped, buttons disabled, queue marked | no | no | http-cancelled-booking, db-cancelled-booking | CODE FIXED |
| QA-013 | P2 | Cancelled and no-plan money lumped; contract balance and O/S unlabelled | reports-dues.ts, reports.js, demand-status.js, dashboard.js | three separate cards, new labels | no | no | http-reports-batch5 | CODE FIXED |
| QA-014 | P2 | Approval queue showed advance copies the list hides | dashboard.js (route) | queue excludes advance copies | no | no | none for the queue count | PARTIAL (Rs 400 transfer NOT REPRODUCED) |
| QA-015 | P2 | `CHEQUE` included bank transfers and cancelled bookings | dashboard.ts | cheque only, live bookings only | no | no | http-cancelled-booking | CODE FIXED |
| QA-016 | - | passed | none | none | no | no | none | PASS (not re-run) |
| QA-017 | P1 | pending_payment bookings keep the unit Available by design, unique live booking index exists; zero rate and zero GST rows are data | reports-dues.ts | read-only `GET /reports/booking-exceptions` | no | repair of the rows | http-reports-batch5 | DATA, detection added |
| QA-018 | P1 policy | Cash limit | none | none | no | BR-11 | none | DECISION |
| QA-020 | P3 | Filter offered Approved and Rejected, not real statuses | receipts.js | real statuses | no | no | syntax check only | CODE FIXED (UI, not browser tested) |
| QA-021 | - | passed | none | none | no | no | none | PASS (not re-run) |
| QA-022 | P3 | Name formatting | none | none | no | what is correct | none | OPEN |
| QA-023 | P3 | A tower name shared by two projects shows twice with no project chosen | units.ts | project added to the shared name | no | no | http-reports-batch5 | CODE FIXED |
| QA-024 | P3 | Duplicate or orphan registrations | reports-dues.ts | listed in `booking-exceptions` | no | repair | http-reports-batch5 | DATA, detection added |
| QA-025 | P3 | Cash column not drawn (API had it) | reports.js | column, total, export | no | no | cash_amount over HTTP | CODE FIXED |
| QA-026 | policy | Interest on a same day receipt awaiting approval | none | none | no | BR-06 | none | DECISION |
| QA-027 | P3 | Full PAN and mobile shown to any role that can view | none | none | no | who sees what | none | OPEN, DECISION |
| QA-029 | P3 | RERA source | none | none | no | what source | none | OPEN |
| QA-035 | P3 | Area basis unlabelled | consumers.js, reports.js | labels Super Area, Carpet Area | no | no | syntax check only | CODE FIXED (label) |
| QA-006, QA-007 | - | passed | none | none | no | BR-06 for QA-007 | none | PASS |
