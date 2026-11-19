# C. Code change report

Branch `fix/remediation-batch1` (from `fix/qa-17nov`, which is `976afd9` plus two test commits). **Nothing is committed, no pull request exists, nothing is deployed.**

## Files changed (21 modified, 14 new)
API: `routes/booking.ts`, `brokers.ts`, `consumers.ts`, `dashboard.ts`, `demands.ts`, `payments.ts`, `receipts.ts`, `reports-dues.ts`, `units.ts`; `utils/financial-measures.ts`, `utils/quote.ts`; new `utils/agreement-reconcile.ts`, `utils/booking-state.ts`.
Web: `brokers.js`, `consumer-detail.js`, `consumers.js`, `dashboard.js`, `demand-status.js`, `gst-invoicing.js`, `receipts.js`, `reports.js`.
Tests: `quote-schedule.test.mjs` and its golden file (signed-off change: only the `file` rows of the no-demand scenarios), new `agreement-reconcile`, `money-rules`, `a101-simulation` tests, five `*.check.mjs` database and HTTP checks, fixtures.
Existing tests adjusted for the intended QA-003 behaviour (test GSTIN and financial year, rate picked): `docs/receipt-allocation/lib.mjs`, `docs/payments-rest/api-test-payments-rest.mjs`, `docs/set-projects-parity/api-test-timely-discount.mjs`, `e2e/payments-rest.spec.ts`; money reader counts in `docs/money-integrity/api-test-money-guard.mjs`.
Docs: this folder.

## Migrations and flags
No migration. No flag changed: `receipt_allocation_v1`, `commission_requires_cleared_v1`, `agreement_snapshot_v1` stay as they are (off by default). `gst_invoice_requires_cleared` unchanged.

## API behaviour changes
| Endpoint | Change |
|---|---|
| POST /payments/receipts | 409 for a cancelled booking |
| PATCH /payments/receipts/:id/approve, deposit, clear | 409 for a cancelled booking |
| PATCH /payments/demands/activate | demand of a cancelled booking is skipped |
| POST /payments/gst-invoices | 409 without project GSTIN or financial year; 400 without a rate; 400 if a direct invoice plus what is already invoiced exceeds the booking value |
| GET /payments/gst-invoices/exceptions | new, read only |
| GET /dashboard/pending-approval | excludes advance copies; rows carry `booking_cancelled` |
| GET /dashboard/pending-cheques | cheques only, live bookings only |
| GET /reports/customer-due-summary | adds `received_clear_ex_gst`, `schedule_gap_excl_gst`, `schedule_exception` |
| GET /reports/customer-balance | summary adds `receivedCancelled`, `receivedNoPlan`, `receivedOther` |
| GET /reports/booking-exceptions | new, read only |
| GET /reports/financial-measures | adds `plans_with_schedule_gap` |
| GET /brokers/commission | rows carry `cleared_money_inr`, `cleared_basis_ok` |
| GET /units/towers | with no project, a name shared by two projects carries its project |
| GET /consumers/:id | adds `booking_cancelled` |

## Before merge
Rebuild the committed `packages/api/dist` (CI checks it matches the source), then review the diff. The existing `quote-parity.test.mjs` fails on the unmodified source too (`source drifted: preview basicCost start not found`), it was not touched.
