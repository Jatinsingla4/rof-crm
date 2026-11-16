# Financial measures: one name, one meaning

Every dues, ageing, collection and dashboard report is built from the same ledger (`utils/report-ledger.ts`).
`GET /reports/financial-measures[?projectId=&asOn=]` now returns the measures below by name, with their definitions, from that ledger.
`docs/remediation/api-test-financial-measures.mjs` checks that the reports agree with them on a project with four bookings in different states (28 checks, all pass).

## The measures

| Measure | Meaning | Reports that carry it (field) |
|---|---|---|
| Agreement value excl. GST | basic + PLC + other charges | project-wise dues (`total_cost`) |
| Agreement value incl. GST | every instalment with GST, billed or not | financial dashboard (`total_receivables`), customer balance (`total_cost`) |
| Total demanded | raised instalments, excl. and incl. GST | project-wise dues (`total_demanded`, `total_demanded_with_tax`), stage-wise dues (`total_due`), ageing (`due_amount`), collection pivot (`due`) |
| Valid collections | cleared, non-advance receipts less approved bank returns | project-wise dues (`received_clear`), project collection (`total_collection`), monthly collection, financial dashboard (`total_collected`), customer balance (`total_received`) |
| Uncleared receipts | recorded, not cleared; not collected | project-wise dues (`received_pending`), project collection (`uncleared_amount`) |
| Applied to billed | the part of the collections that has paid raised instalments | ageing (`received_amount`) |
| Unallocated credit | collections not applied to a raised instalment | project-wise dues (`credit_amount`), ageing (`credit_amount`) |
| Billed outstanding | raised instalments with GST less the money applied | project-wise dues (`outstanding_with_tax`), ageing (`outstanding_amount`), stage-wise dues (`total_outstanding`), collection pivot (`os`) |
| Due outstanding | billed outstanding due on or before the day | dashboard demand status (`outstanding`) |
| Overdue | raised, due before the day, unpaid | ageing buckets, due report (`days_overdue`) |
| Contract balance | agreement value incl. GST less valid collections | financial dashboard (`outstanding`, now also `contract_balance`) |
| GST demanded | CGST and SGST on raised instalments | project-wise dues (`total_demanded_cgst/sgst`) |
| GST received | GST stored on cleared receipts, before bank returns | project-wise dues (`received_cgst/sgst`) |

Identities the test enforces: applied to billed + unallocated credit = valid collections; billed outstanding = demanded incl. GST - applied to billed;
overdue <= due outstanding <= billed outstanding <= contract balance; the ageing buckets add up to overdue.

## Why the "outstanding" numbers differ (worked example: the test project)

Agreement incl. GST 1,26,00,000; raised 31,50,000; valid collections 23,00,000; applied to billed 10,25,000; credit 12,75,000.
- Contract balance = 1,26,00,000 - 23,00,000 = 1,03,00,000 (includes instalments not yet raised).
- Billed outstanding = 31,50,000 - 10,25,000 = 21,25,000.
- Overdue = 3,15,000 (one instalment that fell due 40 days ago).
They are different questions, so they stay separate. The same customer can show billed outstanding and credit at once
(a receipt directed to one instalment does not move to the next on its own; see decision D1 in RECEIPT-ALLOCATION-FINANCE-REVIEW.md).

## Naming that misleads (changed or kept)

- Financial dashboard `outstanding` was the contract balance. Its value and key are unchanged (nothing breaks); `contract_balance`, `billed_outstanding`, `overdue_amount` and `unallocated_credit` are added. The Analytics page now labels the number "Contract balance" and shows the billed and overdue amounts beside it.
- Customer balance `balance` = demanded less ALL money received, so a customer with credit is negative. It is not the outstanding of the dues reports. Kept; the difference is documented here.
- Ageing `received_amount` is the money applied to raised instalments, not the collections. Kept; collections = `received_amount` + `credit_amount` (checked).

## Open decision

D8: GST received (`received_cgst/sgst`) is the GST stored on the cleared receipts and is not reduced when a bank return takes money back. On the test project
valid collections are 23,00,000 (25,00,000 less 2,00,000 returned) but the GST shown is that of 25,00,000. Whether GST on returned money reverses (credit note, return of tax)
is a tax treatment, so it is reported as it is and `approved_bank_returns` is shown beside it. Same question as D5 in GST-INVOICE-FINANCE-REVIEW.md.

## Not covered in this phase

Booking reports, payment-plan reports, the GST invoice report and the broker commission reports were not rebuilt on these measures. They keep their own queries and the checks
already in the suites (`api-test-reports`, `api-test-payments-rest`). The broker commission base and TDS stay on current rules until BR-12 is confirmed by the tax advisor.
