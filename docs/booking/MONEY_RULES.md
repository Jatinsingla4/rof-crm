# Money rules (owner decisions from the local tear-apart review)

| # | Rule | Where it is enforced |
|---|---|---|
| TA-06 | Money is held in **whole rupees**: price, plan total, demands and receipts. Reports round the price to the rupee exactly as Booking does when it makes the plan, so every screen shows the figure the customer is billed. A receipt with paise is refused. | `booking.ts` (plan), `utils/report-ledger.ts` `baseCostSql` |
| TA-07 | GST of the plan is worked out **per charge component and rounded to the rupee**; the last instalment absorbs the remainder so the demands add up to the plan total exactly. Billed GST can therefore differ from the exact percentage by under 50 paise per component. This is intended. A receipt's own GST (the part inside the money received) is kept **to the paisa** and is what the receipt, print, ledger and invoice show. | `utils/gst-resolver.ts`, `utils/gst-receipt-split.ts` |
| TA-09 | A booking is **not cancelled while the applicant has live money** (a receipt that is not cancelled or bounced). Cancel or bounce the receipts first, or settle through Surrender. | `POST /booking/:id/cancel` |
| TA-10 | One applicant has **one unfinished booking** at a time. Confirm or cancel it before booking another unit. | `POST /booking` |
| TA-12 | Automations, email templates and FAQ articles are configuration: changing them needs the **edit** right on Communications. A support agent (view, create) can read and send, not configure. | `index.ts` `configEdit`, `routes/faq.ts` |
| Q16 | Deposit, clear, hold and bounce need the **receipt checker** process right (super admin has it). The person who recorded a receipt **cannot clear or bounce it**. | `routes/receipts.ts` `move`, `routes/payments.ts` bounce |
| TA-03/04 | A receipt with no instalment goes to the **first open instalment**. Bouncing or cancelling a receipt allocates the plan again from the receipts still valid, so every demand it paid (the overpayment cascade included) reopens and its helper rows are cancelled. | `routes/receipts.ts`, `utils/payment-waterfall.ts` `reallocatePlan` |
| TA-14 | A GST invoice made for a receipt is that receipt's own tax; the screen and the caller cannot choose another rate. | `routes/payments.ts` `POST /gst-invoices` |

## Cleared payment basis (owner decisions Q13 and D1 to D8)

| # | Rule | Where it is enforced |
|---|---|---|
| Q13 | **Only cleared money counts.** Pending, authorized, deposited, on-hold, bounced and cancelled receipts are not money. Cleared money is called eligible money; approved returns are taken off it. Old ADV rows stay in the database as legacy records and are never counted. | `utils/money-basis.ts` (`eligibleReceipt`, `eligibleAmountSql`, `loadEligible`) and every reader of receipt amounts |
| Q13 | **Recording a receipt never marks a demand paid or partial.** A demand is paid when cleared money covers it (`partial` when it covers part), and the status is recomputed when a receipt clears, bounces or is cancelled, and when a return or an allocation is approved. | `recomputePlan`, `receipts.ts` (clear), `payments.ts` (bounce, cancel), `receipt-returns.ts`, `credit-allocations.ts` |
| Q13 | **The excess of a cleared receipt is customer credit.** It is never passed on to another instalment by itself; no ADV row is made. A cleared receipt with no demand and no instalment is credit too. | `allocateEligible`, `creditSummary` |
| D1, D3 | A demand is **due** when `raised_at` is set or its `due_date` has been reached (Asia/Kolkata). Status: `paid`, `partial`, `demanded` (due and unpaid), `pending` (not due and unpaid). | `deriveDemandStatus` |
| D2, D8 | The first receipt against instalment 1 still raises it, but never marks it paid. A bounce, a cancellation or a return **never clears** `raised_at` or `due_date`; only the staff Unraise does. | `checkAndAutoRaiseInstallment1`, `demands.ts` unraise |
| decision 3 | A **cleared receipt is never bounced or cancelled** (409). A bank return after clearing is a separate, linked return with a maker and an independent checker; the receipt row is not changed. | `payments.ts`, `routes/receipt-returns.ts` |
| D6 | A return keeps the **bank return date** and the **posting time** apart. As-of reports use only returns posted by the cutoff. | `receipt_returns.bank_return_date`, `posted_at` |
| D4 | **Credit moves to a demand only through an allocation** requested by a maker (`credit_allocation` process) and approved by a different checker, super admin included. A reversal is a second maker-checker step. | `routes/credit-allocations.ts`, `notOwn` |
| D7 | A return that would leave approved allocations uncovered is **refused with 409 and the list**. The checker names the allocations to reverse (`reverse_allocation_ids`); they are reversed in the same transaction as ordinary reversal records. The system never picks or reverses an allocation by itself. | `routes/receipt-returns.ts` |
| Surrender | Refund + forfeiture is checked against eligible money (the existing Rs 1 tolerance stays). | `surrender.ts`, `allocations.ts`, `financial-ops.ts` |

Switches: `RECEIPT_RETURNS=off` and `CREDIT_ALLOCATIONS=off` refuse new requests and approvals with 409 and change nothing; existing records stay and stay counted.
Tests: `docs/money-integrity/api-test-money-integrity.mjs`, `docs/money-integrity/api-test-returns-credit.mjs`.
Not decided here: Q12 (GST before or after the rebate), Q14 (overpayment approval threshold), the interest engine basis, and the accounting, tax and cheque-clearing treatment (CA).

## Delegated owner decisions applied in batch 1 (9 to 10 November 2026)

Source: `ROF_CRM_OWNER_CA_DECISIONS_FINAL.md` (decisions 11 and 12, defect DEF-03 priority P0, plus small defects). Tests: `docs/money-decisions/`.

| Rule | Where it is enforced |
|---|---|
| An approved receipt return is taken off the money in every reader: surrender cap, allocation cancel, refund room, transfer snapshot, registry gate, dashboard, Project Collection and cash reports, customer balance, consumer, unit, project and letter figures, rebate re-pricing, demand waterfall loaders | `returnedSql` from `utils/money-basis.ts` in each query |
| Cleared money of a surrendered or cancelled unit and a receipt with no payment plan both count in the dashboard collection (the project comes from the plan, else from the customer) | `routes/dashboard.ts` |
| Surrender, allocation cancel and refund requests take the same consumer lock as clearing and returns, so the money they read cannot go stale | `routes/surrender.ts`, `routes/financial-ops.ts` |
| A legacy ADV receipt never feeds the booking amount | `utils/payment-waterfall.ts` (`recomputeBookingAmount`) |
| `authorized` means approved: approving sets `approval_status = approved`. Nothing is deposited or cleared before it is authorized; deposit, hold and release are never by the creator; a held receipt returns to authorized | `routes/receipts.ts`, migration 151 (fills the field for receipts a checker already authorized) |
| The creator may withdraw a pending receipt; a pending receipt is rejected, and an authorized one cancelled, only by another user with the receipt checker right and a reason; a cleared receipt is never cancelled | `routes/payments.ts` (cancel) |
| Rebate approval splits the demands exactly like the booking confirmation (the demands add up to the plan total), compares money received with the new demand total including GST, and recomputes demand statuses | `utils/rebate.ts` |
| Total cost with GST in the due summary is the same as in the balance report (unit cost plus the GST of all demands) | `routes/reports-dues.ts` |

Not yet applied (separate batches, some need a design first): the approval matrix as request-then-approve for allocation cancel, surrender, transfer, unraise, interest save and reconciliation match; the common refund lifecycle; the transfer ownership model; the GST basis on the net taxable value (statutory validation required); interest only on cleared money from the clearing date and only on raised demands; TDS rules; the overpayment threshold approval; Vercel Cron and read-time due status; the financial screens.
