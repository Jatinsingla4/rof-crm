# ROF CRM: consolidated engineering report (Phases 0 to 9)

Date: 2026-11-16. Branch of record: `rc/internal-qa` (draft PR #12), which is `main` plus the Phase 2 to 7 branches (PRs #6 to #11).
Everything below was run on a local disposable database. **No production database, Neon, staging or credential was used. Nothing was merged, deployed, or switched on in production by this work after PR #5.**

## E. Release readiness (the short answer)

| Level | Verdict | Why |
|---|---|---|
| Safe to test internally | **Yes** | The release candidate passes 9,751 API checks and 274 browser checks locally; production flags stay off. |
| Ready for finance review | **Yes**, for the notes in `docs/remediation/` | Allocation (RECEIPT-ALLOCATION-FINANCE-REVIEW), GST invoices (GST-INVOICE-FINANCE-REVIEW), measures (FINANCIAL-MEASURES), Phase 6 and the repair kit READMEs each carry the evidence and the open decisions. |
| Ready for controlled staging | **Not yet** | CI has not run on the release candidate; the developer must approve the merge; staging data and the owner's decisions D1 to D10 are needed first. |
| Ready for production | **No** | Unit reservation and BR-12 / BR-13 are not built (decisions missing), the R-01..R-36 set was not run as such, the production flags are untested in production, and the repair kit has never run on real data. |

## A. Completed work

PR #4 and #5 were merged and deployed earlier (CI verify, deploy and live all green). PRs #6 to #12 are open and unmerged.

| Phase | Module and defects | Where | Tests |
|---|---|---|---|
| Wave 0 and 1 to 6 (PR #4, #5, merged) | SEC-01 link tokens, rate 0 refused, demands list total, login throttle, hidden-code CI guard; server price quote (CALC-002, 006, 012), dashboard outstanding equal to project-wise dues, receipts quote, interest preview, migration 152 (additive, flags off), snapshot and reconciliation endpoints | `utils/price-quote.ts`, `routes/booking.ts`, `routes/payments.ts`, migration 152, `docs/remediation/*` | in the 85 files below |
| 0 Security | `agentation-mcp` was connected to 95.135.181.15:443 again on 2026-11-16 (and a stray `node -` process). Both killed, 0 connections after. Cause found: `~/.mcp.json` (created 8 June) plus `enableAllProjectMcpServers: true` in `~/.claude/settings.local.json`. Both removed, npx cache quarantined, evidence kept in the session scratchpad. Six infected remote branches deleted on the owner's order after a scan. | machine, GitHub | scans: `main` and `fix/e08-e11-ui` 0 hits |
| 2 Booking (PR #6) | Payment-entry GST computed in the browser on amount + interest at editable rates, while the confirm step saves GST on the amount only at the server rate (nil for NRI). New `POST /booking/:id/payment-quote`; the page calls it. | `routes/booking.ts`, `booking-payment.js` | booking 319 |
| 3 Receipts (PR #7) | Allocation with the flag ON through partial, multi-instalment, bounce, cancel, return, credit allocation; read-only shadow report; invariants SQL. Defect: allocation spread money that names no demand or instalment over the oldest gap while the waterfall treats it as credit. Fixed. | `utils/receipt-allocation.ts`, `receipt-allocation-shadow.ts`, `routes/payments.ts` | allocation-flows 23, allocation 8 |
| 4 GST invoices (PR #8) | Receipt with a live invoice was cancellable; bounce and bank return left invoices charging more than the money; credit/debit notes assumed 5%. Now: cancel refused while an invoice is live, bounce and return name the invoice for a checker, reconciliation nets returns and notes, a note takes the invoice's own rate. Nothing is reversed automatically (maker-checker kept). | `utils/invoice-exposure.ts`, `payments.ts`, `receipt-returns.ts`, `financial-ops.ts`, `pending-cheques.js` | gst-invoices 21 |
| 5 Reports (PR #9) | 14 reports agree on one ledger; the confusion was naming (dashboard "outstanding" is the contract balance). Added `GET /reports/financial-measures` and named keys; Analytics KPI relabelled. | `utils/financial-measures.ts`, `reports-ageing.ts`, `analytics.js` | financial-measures 28 |
| 6 Modules (PR #10) | A commission was payable with no cleared money: flag `commission_requires_cleared_v1` (off). Five paged lists had no total: now `pagination.total`. | `routes/brokers.ts`, `booking.ts`, `receipts.ts`, `units.ts`, `users.ts`, `utils/input.ts` | commission-payout 16, pagination 33 |
| 7 Database (PR #11) | Repair kit: checksums, exception report (7 CSVs), approved-only demand-to-booking apply with rollback, snapshot and allocation backfill scripts (dry run default, approver required, per-project pilot), rollbacks, migration 152 cycle verified. | `docs/remediation/historical/`, `src/scripts/historical-backfill.ts` | historical 32 |
| 8 QA (PR #12) | Release candidate built, full suites run, report written. | `docs/remediation/QA-REGRESSION-REPORT.md` | below |

## B. Remaining blockers

| Item | Needs | Effort once decided |
|---|---|---|
| Unit reservation and auto-release (BR-09) | Owner: the number of days N | small: hold on creation and a release job behind a flag, about 1 to 2 days with tests |
| Broker commission base and TDS table, surrender-penalty GST (BR-12, BR-13) | Tax advisor: confirmed rates and conditions. The `tax_rate` table is empty on purpose; no statutory rate was set | small to medium once rates exist: read the table at payment date, tests per section |
| Switch ON `receipt_allocation_v1`, `agreement_snapshot_v1` | Finance: run `GET /payments/receipt-allocation-shadow` and sign off a 20-receipt GST sample | none in code |
| Switch ON `commission_requires_cleared_v1` | Owner and finance (D9), after reading the list of commissions already paid without cleared money | none in code |
| Run the repair kit on real data | Owner's written approval, backup, finance approving each demand-booking row; DBA to run | a day with finance review |
| R-01..R-36 as a set | The blueprint PDF (its text is no longer on this machine) | 1 to 2 days to map each ID to a check and add the missing ones |
| Environment | CI on PR #12; the developer's approval to merge; replace PRs #6 to #11 by #12 | n/a |
| Browser tests for payment-entry GST, commission screen, bounce warning, Analytics figures | none | about 1 day |
| Fixed-size pickers can cut a long list (units 500 / 300, receipts 50, users 50) | decision to show the new total or page | small |
| Transfers, parking, add-on charges, interest, general error handling | a defect-hunting pass (only their suites ran) | 2 to 3 days |

Open decisions, each with its question and the current behaviour in the finance notes:
D1 receipt overflow to the next instalment (BR-04) or stays credit; D2 allocation rows on a surrendered instalment; D3 a bank return takes credit first; D4 invoice on a receipt not yet cleared; D5 credit note after a bank return; D6 duplicate rule for direct invoices; D7 GST point of supply for an advance; D8 GST received before or after bank returns; D9 commission before or after the booking amount clears; D10 recovery entry for a commission paid on a booking later cancelled.

## C. QA results

| Level | Executed | Passed | Failed | Blocked or not executed |
|---|---|---|---|---|
| CI static checks by hand (hidden code, tax literals, frontend syntax, dist sync) | 4 | 4 | 0 | |
| Migrations from 096, twice each, on a fresh database | all | all | 0 | |
| API files `docs/*/api-test-*.mjs` | 85 files, 9,751 checks | 9,751 | 0 | |
| Playwright `e2e/*.spec.ts` | 22 specs, 274 tests | 274 | 0 | |
| CI on GitHub | 0 | | | not run |
| R-01..R-36 | 0 as such | | | text unavailable |
| Production or staging | 0 | | | no access, by rule |

Failures met on the way, all explained: perf-timing and "under 1000 rows" checks on a database with thousands of accumulated rows (pass on a fresh one); one `reports.spec.ts:337` failure that did not repeat; an Analytics e2e that expected the old label (spec updated); `api-test-throttle` needs `DB_NAME` set locally. Defects the tests themselves exposed in this work: allocation of unlinked money (Phase 3 code, fixed), missing amount accepted by the payment quote (fixed), a rollback log written to the screen instead of the file (fixed).

## D. Financial reconciliation (what was verified, how)

| Link | Result | Evidence |
|---|---|---|
| Booking and agreement | Server quote equals what the plan bills where the booking has a rate; bookings with no rate are billed on the unit master price and are listed, not snapshotted | `/booking/agreement-shadow`, historical test, exceptions CSV |
| Agreement and instalments | Demands add up to the quote (price and GST) | booking suite "quote = schedule" |
| Demands and collections | Valid collections = cleared, non-advance receipts less approved returns; applied to billed + unallocated credit = valid collections | financial-measures 28 checks |
| Collections and outstanding | Contract balance, billed, due and overdue are four different numbers with fixed identities; every report agrees | financial-measures, dashboard-recon 198 |
| Receipts and GST invoices | An invoice is the receipt's own tax; no invoice without a receipt that can bear it; invoices charging more than the money are listed | gst-invoices 21, reconciliation |
| Dashboard and reports | Dashboard demand status = project-wise dues for the day; 14 reports match the measures | financial-measures, dashboard-recon |
| Allocation and status | Planned allocation equals the status rules on every demand (0 mismatches after the fix) | shadow report, allocation-flows |
| Known difference | GST received is the GST stored on cleared receipts, before bank returns (D8) | measures note |

## Security checklist for the owner (Phase 0)

The exposure window (about 2.5 days, then again 16 November) means credentials that were readable on that Mac may be compromised. The owner declined rotation earlier; the list stands:
rotate or revoke GitHub tokens and SSH keys, Vercel and Neon tokens and database passwords, npm tokens, the 21st.dev `magic` key (it was printed once in a tool output), any API keys held in shell profiles or `.env` files on that Mac, and review browser sessions. Delete `~/.claude.json.bak-before-mcp-cleanup`. Never re-add `agentation-mcp`; keep `enableAllProjectMcpServers` off. Run a malware scan. The six infected branches are gone from GitHub; local copies may remain and must not be run. The global `Bash(curl:*)` and `Bash(python3:*)` allow rules in `~/.claude/settings.local.json` were left as they were and are worth removing.

## What went wrong during this work

Conflict markers were committed once in the release candidate and fixed before any run; shell backticks inside an unquoted heredoc executed some commands (no data changed) and a document was rewritten; a test script ran twice and left test rows in the disposable database; a safety check refused one edit command that contained no deletion. None touched anything outside the local test database and the repository branches.
