# GST invoices and the money behind them: what changed, and what finance must decide

Scope: CRM-CALC-019 / CRM-CALC-020 as stated in the Phase 4 brief (invoice amounts reconcile with valid source transactions; invalid invoices cannot be made;
duplicates controlled; receipt cancellation triggers the approved reversal; history kept; credit notes where required). The original blueprint text for these two IDs was not
available when this was written, so the work follows the brief and what the code does today.

## What already held (checked, not changed)

- An invoice for a receipt is that receipt's own tax: taxable + GST equals the receipt amount, GST is the one stored on the receipt, whatever rate the caller sends is ignored.
- A cancelled or bounced receipt cannot get an invoice. Taxable above the receipt amount is refused.
- A second live invoice for the same receipt is refused (409), also when four requests arrive at once (the receipt row is locked).
- Cancelling an invoice is checker-only, the maker of the invoice cannot do it herself, a credit note is issued in the same step, the invoice row is kept as `cancelled`.

## Defects found by running the flows (probe, local test database)

| # | What happened | Change |
|---|---|---|
| 1 | A pending receipt could be cancelled while a live invoice stood on it. The invoice stayed `generated` against money that was gone. | Cancelling a receipt that has a live invoice is refused (409) and names the invoice. A checker cancels the invoice first (credit note issued), then the receipt can be cancelled. |
| 2 | A bounced cheque left its invoice `generated`, silently. | The bounce is still recorded (it is a bank fact, it cannot be refused). The answer and the bulk-bounce screen now name the invoice that needs a checker. |
| 3 | After an approved bank return of 60,000 on a 1,00,000 receipt the invoice still charged 1,00,000 and nothing said so. | The return approval names the invoice to review. The reconciliation (`GET /booking/reconciliation`, key `invoices_charging_more_than_the_receipt_behind_them`) now nets approved returns and issued credit/debit notes, so a credit note for the returned part clears the row. |
| 4 | A credit or debit note raised without a rate assumed 5%, whatever the invoice's rate. | A note without a rate takes the invoice's own rate. A rate that is given is used as given. |

Nothing is reversed or credited automatically: cancelling an invoice and issuing a credit note stay with a checker, so maker-checker is unchanged and no tax document is made by the system.

## Tests

`docs/remediation/api-test-gst-invoices.mjs`: 21 checks (own-tax invoice, race, cancel guard, maker-checker, bounce, return and credit note, note rate, legacy rows, history kept).

## Decisions finance or the tax advisor must take (not decided in code)

| # | Question | Today |
|---|---|---|
| D4 | May a GST invoice be made for a receipt that is not yet cleared (pending, authorised, deposited)? BR-03 counts money as collected only when cleared; the invoice screen offers "Gen Invoice" for every receipt that is not cancelled or bounced. | Allowed, as before. If the answer is "cleared only", it is a one-line check in `POST /payments/gst-invoices`, and the screen list should be filtered the same way. |
| D5 | For a bank return after clearing, is a credit note for the returned part wanted in every case, and who raises it? | Reported only (defect 3). The note is raised by a maker and approved by a checker through the existing tab. |
| D6 | Invoices made without a receipt (direct invoices, base amount typed) can repeat for the same applicant and amount. Is a duplicate rule wanted there (same applicant, date, amount)? | No rule; each is a separate invoice. |
| D7 | The GST point of supply for an advance (receipt date versus clearing date) decides whether D4 is a tax question or only a control question. | Not changed. |

## For production (read-only)

`GET /booking/reconciliation` as a finance user lists every live invoice that charges more than the receipt behind it (including receipts already cancelled or bounced). Each row is for finance to cancel or credit through the normal checker tabs; no script changes invoice data.
