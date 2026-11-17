# Response to the Final Browser QA & Financial Acceptance Report, 17 November 2026

Branch `fix/qa-17nov`. Nothing here is deployed yet. Production is `main` at da18a8e. No production data, flag, migration or credential was touched.

## A. Why the earlier "fixed" reports did not show in the browser

Vercel's newest `rof-crm` production deployment is da18a8e (CI run 44027404718 green), and `/api/health` reports `commit: da18a8e`. The report's "further deploy at 16:41 IST" is not in Vercel's deployment list. So the QA tested the code that CI had passed, and **the earlier fixes were incomplete or in the wrong place**, not undeployed:

| Reported fixed | What was actually wrong |
|---|---|
| Interest paid from cleared receipts (QA-007) | The fix went into a different query. The Applicant File "Interest Summary" printed the **total interest in the PAID column** (hardcoded). |
| GST rounding (QA-001) | The Applicant File recomputed GST at one booking rate, then hid any gap up to 1,000 rupees under the name "Rounding". |
| Customer search (QA-016) | The First Name tab sent `name`; the API reads `firstName`, so the filter was ignored. The list also never selected the unit type. |
| Pending not counted (QA-006) | Customer Due Summary took balance = cost minus (pending + cleared). |
| Tokens out of URLs (QA-011) | The page links use a 60-second link token (see D), but the booking receipt Print button put the login token in the address. |

My earlier statement that these were fixed was wrong for those paths. CI passed because no test covered those exact outputs.

## B. Change register (this branch)

| Defect | Root cause | Files | Test | Status |
|---|---|---|---|---|
| QA-007 interest paid | PAID column printed total interest | `routes/booking.ts` | `api-test-qa17.mjs` | FIXED, CODE VERIFIED |
| QA-012 interest after cancel | `asOfDate` was always today | `routes/consumers.ts` | not covered by a test | FIXED, NOT TESTED |
| QA-001 GST labelled rounding | 1,000 rupee tolerance, billed GST not authoritative | `routes/booking.ts` | `api-test-qa17.mjs` (800 gap, 0 gap) | FIXED, CODE VERIFIED (display). Which rate is right for QAAU-2026-0002 is BLOCKED, see H |
| QA-031 invoice on pending receipt | server allowed any non-cancelled receipt | `routes/payments.ts`, `gst-invoicing.js` | `api-test-invoice-cleared.mjs` (5), `payments-rest.spec.ts` | FIXED, CODE VERIFIED (default decision, see H) |
| QA-006 pending deducted | balance used pending + cleared | `reports.js` | `reports.spec.ts` (Due Summary screen opens, labels) | FIXED, CODE VERIFIED |
| QA-013 report totals | rows are live bookings only | `reports-dues.ts`, `reports.js` | `api-test-qa17.mjs`, `reports.spec.ts` | PARTIAL: the gap is now shown and labelled, Project Wise Collection card not restored |
| QA-012 cancelled on Demand Status | join had no booking status filter | `routes/demands.ts` | `api-test-qa17.mjs` | FIXED, CODE VERIFIED. Customer page and Applicant File agreement not checked |
| QA-016 search, type column | wrong key; column not selected | `consumers.js`, `routes/consumers.ts` | `api-test-qa17.mjs` (4) | FIXED, CODE VERIFIED. Unit search missing a cancelled booking not changed |
| QA-011 login token in URL | Print button used `localStorage` JWT | `booking-payment.js` | `link-token.spec.ts` (existing) | FIXED for that button |
| Build ID (QA brief item 11) | none shown | `login.html` | none | DONE, NOT TESTED |
| A-101 | nine receipts and both excess bases | `api-test-a101.mjs` (11 checks) | | arithmetic reproduced; entry in the CRM BLOCKED |

Test runs on a local disposable database with this branch built: `api-test-qa17` 14 of 14, `api-test-invoice-cleared` 5 of 5, `api-test-gst-invoices` 21 of 21, `api-test-payments-rest` 1006 of 1006, `api-test-receipt-allocation` 19 of 19, `api-test-a101` 11 of 11; browser `payments-rest` and `reports` specs: 77 passed, 3 skipped, 1 failed (a selector in my own spec, fixed); then `payments-rest`, `booking-small` and `link-token` 18 of 18. **The full suite (all 85 API files, all specs) has not been run locally; CI on the pull request does that.**

## C. Financial reconciliation (A-101)

From the report's section F and the client file, all in integer arithmetic (`api-test-a101.mjs`):

| Item | Value |
|---|---|
| Basic price 645.743 x 4,000 | 25,82,972 |
| Agreement (with balcony 50,000) | 26,32,972 |
| Add-ons / GST on everything | 1,27,915 / 49,354 |
| Contract basis liability | 28,10,241 |
| Billed basis liability (26,59,305 + 1,50,939) | 28,10,244 |
| Nine receipts (net) | 28,10,787.00 (checked to the paisa) |
| Excess, billed basis, after interest 271 and GST 3 | **269** |
| Excess, contract basis | **272** |
| Gap between bases | 3 rupees: instalment rounding (schedule 26,32,975 against 26,32,972) |

Neither figure is hardcoded in the application. The nine receipts are not entered in the CRM: financial years and GST slabs before FY 2026-27 and a project GSTIN are not configured, and the historical GST treatment, weekend due date (BR-05) and allotment date are ROF decisions.

## D. Security

- The links for letters, receipts and the Applicant File carry a token that is **60 seconds, bound to that single path, and holds only user id and session version** (no email, role or permissions). The server rejects a login token sent in a URL and a link token sent as a header (`index.ts`). `Referrer-Policy: no-referrer` comes from helmet. This is the "short-lived scoped token" the brief allows, so the address bar still shows `token=`. The QA read the parameter name, not its value. **If management wants no token at all in any address, that needs a different mechanism (authenticated fetch into the page), a larger change, not made here.**
- Self-approval is refused by the server for receipts, interest waivers, refunds, rebates, brokers, returns and credit allocations (existing tests, Super Admin included).
- Not fixed: Approve buttons are still shown to a Super Admin with process rights "None", because Super Admin is exempt from process rights by documented policy (self-approval stays blocked). Removing the exemption is an owner decision.
- Credential rotation and the malware clean-up are the owner's: no live credential was rotated.

## F. Historical data

`docs/remediation/historical/06-qa17-exceptions.sql` is **read-only** and lists the existing records behind the findings: live invoices on cancelled or uncleared receipts, invoices taxing more than the receipt or with no receipt, paid commissions with no cleared receipt, booked units still Available, bookings with rate 0 or no GST, cancelled bookings with live demands, duplicate registration numbers, large cash receipts. It ran without errors on the test database. Run it on production with a read-only login, give the output to finance, and nothing is corrected until finance decides each row. The earlier repair kit (`00` to `05`) is unchanged and has never run on real data.

## G. Deployment checklist

1. Merge the pull request after CI is green. CI applies no new migration (none was added).
2. Check `/api/health` shows the new commit and the login page footer shows "build <sha>".
3. Run `06-qa17-exceptions.sql` on production (read-only) and hand it to finance.
4. Flags stay off: `agreement_snapshot_v1`, `receipt_allocation_v1`, `commission_requires_cleared_v1`. Before any is turned on: shadow report with 0 mismatches, backup, finance sign-off.
5. Rollback: revert the merge commit; no data change to undo. The invoice gate is switched off by setting `gst_invoice_requires_cleared` to `false` in `global_settings`.

## H. Decisions that need ROF (finance, tax or management)

1. Invoice on a pending receipt: I set the default to **cleared only**, switchable with `gst_invoice_requires_cleared`. Finance must confirm the tax-timing rule.
2. Which GST rate applies to booking QAAU-2026-0002 (header 1% on 90,000 against schedule 5% on basic and 0% on PLC). The CRM now shows the billed figure and names the gap; whether 900 or 2,500 is right is a tax question.
3. Historical GST for A-101 (1% affordable housing eligibility, add-on rate by charge head), allotment date, weekend due date rule, rounding per instalment or on the total, excess treatment (269 or 272).
4. Commission base and the flag `commission_requires_cleared_v1`; receipt allocation flag `receipt_allocation_v1`; agreement snapshot flag `agreement_snapshot_v1`.
5. Cash limit amount for receipts (QA-018), and whether Super Admin stays exempt from process rights (QA-010).

## I. Final status of every QA item

| Item | Status |
|---|---|
| QA-001 | FIXED, CODE VERIFIED (display); rate question BLOCKED, BUSINESS DECISION |
| QA-002 | NOT FIXED for existing data (INV/2026/00003): BLOCKED, BUSINESS DECISION (a checker issues the credit note); new cases are prevented by the earlier fix |
| QA-003 | NOT FIXED (GSTIN and financial year not required before invoicing; labels not changed) |
| QA-004 | NOT FIXED (counts differ between Setup and Report) |
| QA-005 | BLOCKED, BUSINESS DECISION (flag off; repair needs approval) |
| QA-006 | FIXED, CODE VERIFIED |
| QA-007 | FIXED, CODE VERIFIED |
| QA-008 | BLOCKED, BUSINESS DECISION (flag off) |
| QA-009 | BLOCKED, BUSINESS DECISION (flag off) |
| QA-010 | Server: FIXED, CODE VERIFIED. Buttons: NOT FIXED, BLOCKED, BUSINESS DECISION |
| QA-011 | FIXED for the print button; scoped 60-second tokens remain by design, BLOCKED, BUSINESS DECISION |
| QA-012 | FIXED, CODE VERIFIED for Demand Status and interest stop; customer page and Applicant File not checked |
| QA-013 | PARTIAL |
| QA-014, QA-015, QA-017 to QA-030 (except QA-016, QA-018, QA-024) | NOT FIXED |
| QA-016 | FIXED, CODE VERIFIED |
| QA-018, QA-024 | listed in `06-qa17-exceptions.sql`; BLOCKED, BUSINESS DECISION |
| QA-031 | FIXED, CODE VERIFIED (default needs finance confirmation) |
| R-01 to R-36 | NOT RUN: the blueprint is still not available; the report's own provisional PR-01 to PR-24 were not mapped |
