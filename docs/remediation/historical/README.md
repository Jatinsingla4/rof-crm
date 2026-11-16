# Historical repair kit (Phase 7)

Repairs for records made before migration 152. Everything here was tried on a disposable test database (`docs/remediation/api-test-historical.mjs`, 32 checks).
**None of it has been run on production, and nothing here touches an amount, a status or a date.** The repairs only add a link (`demands.booking_id`) or derived rows (`booking_agreement`, `receipt_allocation`). Running any of them on production needs the owner's written approval and a database backup first.

## Order

| Step | File | Writes? | Who |
|---|---|---|---|
| 1. Take the money checksums | `00-checksums.sql` | no | DBA |
| 2. Exception report (every record the rules say is wrong or ambiguous, one CSV per kind) | `01-exceptions-report.sql` | no | DBA, then finance reads the CSVs |
| 3. Demand to booking: dry run | `../backfill-demand-booking-DRYRUN.sql` | no | DBA, finance reviews `backfill-demand-booking-review.csv` |
| 3b. Finance writes the approved demand ids (header `demand_id`) | `approved-demand-ids.csv` | | Finance |
| 3c. Apply only the approved, unambiguous links | `02-demand-booking-APPLY.sql` | `demands.booking_id` only | DBA with `-v approved_by="Name"` |
| 4. Agreement snapshots: dry run, then apply | `node dist/scripts/historical-backfill.js snapshots [--apply --approved-by "Name"] [--project UUID]` | `booking_agreement` only | DBA |
| 5. Receipt allocation: dry run (the shadow report), then apply | `node dist/scripts/historical-backfill.js allocations [--apply --approved-by "Name"] [--project UUID]` | `receipt_allocation` only | DBA |
| 6. Take the checksums again and diff with step 1 | `00-checksums.sql` | no | DBA |

Every run of step 4 and 5 writes a review CSV (`agreement-snapshot-review.csv`, `receipt-allocation-summary.csv`, `receipt-allocation-mismatches.csv`) whether or not `--apply` is given. `--project` runs one project first as a pilot.

## What each repair refuses to do

- **Demand to booking**: links only demands that are in finance's approved file, have no link yet, and whose plan (same applicant and unit) matches exactly one non-cancelled booking. Several candidates (ambiguous) or none (unlinked) are skipped, never guessed. It checks inside the transaction that no demand amount, status or date changed, and aborts if one did. Without `approved_by` it refuses.
- **Snapshots**: writes one version 1 per live booking that has none, only where the server quote equals what the payment plan bills within Rs 1 (BR-07). A booking with no rate or carpet area, no plan, or a quote that differs from its plan is an exception for finance and is never written. It does not set `booking_records.total_price_inr` (the live confirm step does; a backfill must not move a price).
- **Allocation**: refused while the allocation and the status rules disagree on any demand (the shadow report lists them), so finance sees every mismatch first. It writes exactly what the live code writes (`writeAllocations`) and does not switch `receipt_allocation_v1` on.
- Both node tasks refuse `--apply` without `--approved-by`.

## Rollback

| Repair | Undo |
|---|---|
| Demand to booking | `03-demand-booking-ROLLBACK.sql < demand-booking-applied.csv` (the log that step 3c wrote): clears exactly those links, only where the link is still the one written |
| Allocation | `04-allocation-ROLLBACK.sql -v confirm=yes` (derived rows, nothing reads them while the flag is off) |
| Snapshots | `05-snapshot-ROLLBACK.sql -v confirm=yes`, database owner only: switches the immutability trigger off inside one transaction, deletes only rows with reason `historical backfill (Phase 7)`, switches it on again |
| Migration 152 | `src/db/migrations-down/152_remediation_agreement_allocation_tax.down.sql` (tested up twice, down, up again on a fresh database; flags come back as `off`) |

## Exceptions the report finds, and who decides

| Kind (CSV) | Meaning | Decision |
|---|---|---|
| `exc-demand-booking.csv` | demands with no booking link and their candidate bookings | finance approves the single ones; ambiguous and unlinked need a person |
| `exc-booking-no-rate-or-area.csv` | live booking with no rate or no carpet area (billed on the unit master price) | finance: correct the booking or accept the master price |
| `exc-plan-vs-demands.csv` | a plan whose total differs from its demands | finance |
| `exc-receipts.csv` | cleared with no authoriser, cleared with no plan, or a plan of another applicant | finance and audit |
| `exc-invoices.csv` | a live GST invoice charging more than the receipt behind it | checker cancels or credits (GST-INVOICE-FINANCE-REVIEW.md) |
| `exc-commissions.csv` | a commission paid with no cleared receipt behind it | owner (decision D9 in PHASE6-MODULES-REVIEW.md) |
| `exc-several-live-bookings.csv` | one applicant with several live bookings | sales and finance |

The cases that need the application's own money rules (a paid demand with a balance, a quote that differs from the plan, allocation against the status rules) are served read-only by `GET /booking/reconciliation`, `GET /booking/agreement-shadow` and `GET /payments/receipt-allocation-shadow`, and by `../allocation-invariants.sql`.

## A defect this kit found

The allocation shadow compared the planned rows with the status rules on the test database and showed one demand with 1,000 allocated and 0 paid. The cause was in the allocation code: it spread money that names no demand or instalment over the oldest gap, while the waterfall treats such money as customer credit. Fixed in the allocation (PR for Phase 3) and covered by the pure test; the shadow now reports 0 mismatches there.
