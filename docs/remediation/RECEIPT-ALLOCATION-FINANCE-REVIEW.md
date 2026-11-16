# Receipt allocation: what finance must review before `receipt_allocation_v1` is switched on

Status: flag is OFF in production. Nothing below changes any payment, demand or report while it is off.

## What the allocation does

`receipt_allocation` records, for each cleared receipt, how much of it settled which instalment, split into principal, CGST and SGST.
It follows the money rules already used for demand status (`money-basis.ts`): only cleared, non-advance money counts; approved returns are taken off the receipt;
money that names an instalment goes to it first; money that names none fills the oldest gap. It is rebuilt on every recompute of a plan, so it cannot drift.
The GST part of a row is the demand's own GST in proportion, never extracted again from the gross.

## Evidence (local disposable database, flag ON, run on 2026-11-16)

| Check | Result |
|---|---|
| Existing API suites with the flag ON (receipts, allocations, payments-rest, whole-flow, end-to-end, demands, money-integrity, money-decisions, TDS, reports, dashboard-recon) | all pass, about 3,480 checks, 0 failures |
| `docs/remediation/api-test-allocation-flows.mjs` (partial payments, several instalments, bounce, cancel, return, credit allocation, idempotence, shadow) | 23 pass, 0 fail |
| `GET /payments/receipt-allocation-shadow` on the test data | 69 plans, 236 demands: allocation and status rules agree on every demand, 0 receipts over-allocated |
| `docs/remediation/allocation-invariants.sql` | A1, A2, A5, A6/A7: no rows. A3, A4, A8: see "Rows that are not defects" |

The rules checked after every step do not use the allocation code: a demand is never allocated more than its total; a receipt is never allocated more than it holds
(less approved returns); only cleared non-advance receipts have rows; no row crosses plans; paid / partial / unpaid agree with receipt allocation plus approved credit allocation;
a row's GST is in proportion to its demand.

## What finance does before activation (production, read-only)

1. Call `GET /payments/receipt-allocation-shadow` as a finance user. It computes the allocation in memory for every plan with cleared money and compares it with what the status rules say each demand has paid.
   `mismatch_count` must be 0. Every row in `mismatches` is a demand to look at (`waterfall_paid` against `allocation_paid`).
2. Take a sample of 20 cleared receipts across projects, including one with a return, one split over two instalments and one with credit left. Check by hand that principal + CGST + SGST of the planned rows equal the receipt and that the GST agrees with the GST invoice.
3. Run `allocation-invariants.sql` after activation in a staging copy first.
4. Only then set `receipt_allocation_v1` to `on` (the developer does not do this).

## Decisions finance or the owner must take

| # | Question | Today |
|---|---|---|
| D1 | BR-04 says the overflow of a receipt goes to the next instalment, oldest first. The waterfall treats the overflow of money that names an instalment as customer credit and does not move it. Which is wanted? | Credit stays credit. Changing this changes the paid amounts in every report, so it was not changed. |
| D2 | When a surrender or cancellation stops an instalment that was part paid, should the allocation rows on it stay as history (today) or be cleared? | Stay. A restore brings the instalment back with its rows. |
| D3 | A cleared receipt cannot be cancelled; a bank return goes through the return workflow and takes the amount off the receipt's allocation, credit first. Is "credit first" the wanted order for a return? | Credit first. |

## Rows that are not defects (found in the local test database)

- A3: one allocation row on a cancelled receipt. The product cannot produce this (it refuses to cancel a cleared receipt and writes an audit entry on any cancel). The row had no audit entry; four older test scripts cancel receipts by direct SQL. Treat any hit in production as a hand edit.
- A4: allocation rows on instalments stopped by a surrender or cancellation (decision D2).
- A8: one cleared receipt with no authoriser, numbered `LEGACY-...-ADV`, created by a test fixture. In production any hit is a receipt that counted money without a checker and needs review.
