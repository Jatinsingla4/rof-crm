# Payments, the rest (refunds, waivers, notes, interest, GST invoices, plans, banks, receipt pages)

Routes under `/api/payments` in `packages/api/src/routes/financial-ops.ts` and `payments.ts`, plus `loans.ts`, `registry.ts`, `faq.ts` and the dashboard mount.
Helpers: `utils/input.ts` (`paging`, `qtext`, `oneOf`, `lock`, `financeOnly`, `pos`), `utils/penal-interest.ts` (`persistInterest`, `nextNumber`). Migrations `117_payments_rest.sql`, `118_payments_makers_gstin.sql`.
Screens: Interest Master, Installment Interest, Interest Scheduler, Customer Wise Interest, Grace Period, Interest Waiver, GST Invoicing, Loans, Registry, Dashboard (`packages/web/public/js/pages`).

## Who can do what
| Action | Who |
|---|---|
| Read everything here (project scope still applies, see below) | every signed-in role with payments access |
| Waiver request, refund request, credit / debit note request, cancellation refund initiate | process access *maker* (Interest Waiver, or JV / Refund / Dr-Cr) |
| Approve, reject, process, cancel of those | process access *checker* of the same process; the person who raised a request cannot approve it (super_admin exempt) |
| Direct waive-off (one step), cancel / reverse a GST invoice (credit note issued in one step) | *checker* access, because the step acts as the approval |
| Create a GST invoice, payment plan, interest rate, installment rates, grace days, interest start date, manual interest, saved interest calculation, draw refund initiate / complete | `super_admin` and `accounts_finance` only |
| Delete stored interest (scheduler, one applicant) | `super_admin` only (payments:delete) |
| Loans: record | `consumers:create` (super_admin, project_manager, sales_executive) |
| Registry: schedule | `allocations:create` (super_admin, project_manager) |
| FAQ | per route `communications` view / create / edit; a draft is visible only to editors |

Project scope (a user limited to some projects) is enforced by the database policies: an applicant, invoice or refund of another project does not exist for that user (404, empty list).

## Money rules (decided)
- **Waiver** never goes above the interest still unwaived. A direct waiver locks the applicant's interest rows, takes the amount from the installments in order and writes one approved waiver per installment. A request counts requests still waiting, so two requests cannot add up to more than the interest. Approving checks again and finds the installment again if the interest was recalculated in between (row ids change then).
- **A recalculation never loses a waiver.** Saving interest (scheduler, applicant detail, grace days, start date) goes through `persistInterest`: calculated rows are replaced, the waived amount per installment comes back from the approved waivers (up to the new interest), manual interest rows are never touched.
- **Refund** (pending, approved, processed, or rejected): all refunds that are not rejected, per applicant, stay within what the applicant paid (live receipts); with a receipt chosen also within that receipt. Checked at request, at approve and at process (a receipt may have been cancelled meanwhile). Reject frees the amount. New reject step (migration 117 adds who, when and why).
- **Credit note**: all credit notes on an invoice (not cancelled) stay within the invoice's taxable amount. A debit note has no ceiling. GST and total are worked out on the server to the paisa. Numbers `CDN/yyyy/0001` and `INV/yyyy/00001` come from one writer at a time (they used to be a count and a random number).
- **Cancelling or reversing an invoice** issues a credit note for what is left (taxable less credit notes already issued), withdraws notes still pending, and refuses a second cancel.
- **GST invoice**: tax is worked out from base and rate, what the screen sends as tax or total is ignored; one live invoice per receipt (database index); the receipts list says which receipt already has one.
- **Payment plan**: one per allocation, the 8 installments add up to the total to the rupee (the last takes the rounding).
- **Interest master**: one rate per project per date, 0 to 100 with 2 decimals. Installment rates likewise, an unknown installment refuses the whole save.
- The database also refuses non-positive waivers, refunds and notes, a waived amount above the interest, rates outside 0 to 100, and unknown statuses (checks are NOT VALID, so old rows are not re-checked).

## Found and fixed here (real bugs)
High: `pageSize` of gst-invoices and draw-refunds was pasted into the SQL (injection by any signed-in user); financial-ops had no input checks at all (refund or waiver of any amount, any text); direct waiver needed no process access and recorded waivers even when there was no interest; waivers were lost when interest was recalculated or grace days / start date set; GST invoice cancel could never work (wrong column names, 500) and the Reverse and Credit-Debit-Note tabs called routes that did not exist; credit / debit note create always failed (invoice columns are required); invoice numbers were random (a clash gave a 500).
Medium: any signed-in user could create invoices, plans, rates, manual interest, draw-refund steps; refund and waiver could be approved twice in parallel or by their own maker; draw refund could be completed before it was initiated; the scheduler save crashed for an applicant without a payment plan and wiped manual interest; interest master `created_by` was never set and two rates on one date made the rate ambiguous; payment plan ignored allocation, duplicates and rounding; overdue list and the payments dashboard counted paid and cancelled money; the registry check counted cancelled demands and bounced receipts, and the Registry screen booked a random allocation when no applicant was picked.
Low: receipt html, form and detail pages answered 500 for a bad id and put names, banks and installment names into the page without escaping; faq lists took `pageSize` unchecked, showed drafts and counted their views.
Screens: Invoice Generation had no amount field and the receipt list read fields that do not exist (`amount`, `payment_date`), so Generate and Pending Invoice could never work; GST Invoice Totals added two text values together; Pending Invoice sent date filters under the wrong names; Generate on the Manual or Advance tab picked up the receipt or GSTIN left on another tab; the month report asked for the 31st of every month; Setup and User Rights said "saved" without saving (now honest); Loans list never showed saved loans (new `GET /api/loans`); Installment Interest showed 4 decimals of a 2-decimal column; Interest Scheduler delete ignored a refusal.

## Added in the second pass
- A paid refund (refund processed, cancellation refund completed, draw refund completed) posts an approved journal entry (head Refund, debit) in the applicant's ledger. Once, under the row lock.
- Cancellation refunds and draw refunds remember who initiated them (migration 118); the person who initiated cannot complete (super_admin exempt).
- The buyer GSTIN is stored on the invoice (migration 118) and shown on the invoice page.
- `GET /gst-invoices/:id/html` (also `/pdf`) is a printable invoice page, escaped; the screen has a "Print invoice" link. `GET /gst-invoices-export?type=gstr1|gstr3b&month=YYYY-MM` is a CSV (cancelled invoices left out, issued credit / debit notes netted); the Report tab buttons download it.
- FAQ is mounted with `rbac('communications')`; voting on an article (POST feedback) stays open to everyone with communications access, as before.

## Not changed on purpose
- The invoice "PDF" is a print page, not a PDF file (no PDF library in the project).
- GSTR files are a plain CSV summary, not the portal's JSON format.
- Receipts HTML (`/receipts/:id/html`) already escaped with `pmtEsc`; it is covered by the test.

## Tests
`node docs/payments-rest/api-test-payments-rest.mjs` against a local test API (`BASE=http://localhost:3010/api`, psql env set, `SEED=n` repeats a random run). Own data, cleaned up at the end, last line `RESULT: N passed, M failed`.
Browser: `e2e/payments-rest.spec.ts` (needs psql env for set-up; every screen listed above, each filter and button; JavaScript error, console error, 5xx, `undefined` or `NaN` fail the test).
Demo data: `BASE=http://localhost:3020/api node docs/demo-seed-payments-rest.mjs` after `demo-seed-receipts.mjs`.
