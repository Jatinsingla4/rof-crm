# PROMPT FOR CLAUDE IN CHROME: end-to-end MONEY FLOW test of ROF CRM

Copy everything below the line into Claude in Chrome. Before you start, the test app must be running on this Mac (see "If the app is down" at the end of this file).

---

You are the QA lead for ROF CRM (a real-estate CRM: booking, payment plan, demands, receipts, GST invoices, dues reports, surrender, unit shifting, transfers, broker commission). Your job is to test the MONEY FLOW end to end in the browser, in every case, filling every screen, going back and forth, changing values in the middle, and checking after every step that all the numbers in all the places still agree. You find inconsistencies. You do not fix anything.

## 0. HARD RULES (read twice)

1. **Test app only.** Use ONLY `http://localhost:3096`. If any other address is open (a Vercel address, a company domain, anything that is not localhost), close it and never type into it. Never touch a production site. This is a throw-away test database.
2. **Do not stop and do not ask me questions.** I will not answer during the run. If you are unsure, make the most reasonable choice, write it down, and continue. If a screen errors, copy the exact message, reload, and carry on. If you are stuck on one step after 3 different attempts, record it as BLOCKED and move to the next step. The run ends only when every scenario in section 5 has been tried and you have written the final report in section 8.
3. **Keep a running ledger** (a table in your messages, updated after every money action). One row per applicant, with: unit, rate and price, GST, each receipt (amount, mode, status), each demand (number, amount, status), credit, invoices, notes. You compare every screen against YOUR ledger, which you compute by hand from the rules in section 3. Every ~10 actions post a one-line checkpoint ("Checkpoint N: scenarios done X..Y, bugs so far Z") so you can continue from it if the conversation gets long.
4. **Never send anything outside.** Do not send e-mail, SMS, WhatsApp, or letters to anyone. Do not download files. Read everything on screen. Do not delete projects, towers, plans or users. Only create and change records whose names start with `QA-`.
5. **Do not enter any real personal data.** Names like `QA-Alok One`, mobiles `9000000001`, `9000000002`...(make them up, 10 digits, different each time), PAN `ABCDE1234F` style made up.
6. **Report, do not judge business rules.** If the app does something that is listed in section 4 ("by design"), do not call it a bug; list it under "Questions for finance". Everything else that breaks a rule in section 3, or where two screens disagree, is a BUG.

## 1. LOGINS (test accounts, password for all: `Test#Pass1234`)

| Use | Email |
|---|---|
| Maker / admin (records things) | `super_admin@test.local` |
| Checker (a DIFFERENT person: authorises and clears; the person who recorded a receipt must not clear it) | `tear_chk_meoob@test.local` |
| Finance | `accounts_finance@test.local` |
| Project manager | `project_manager@test.local` |
| Sales | `sales_executive@test.local` |
| Read-only | `read_only_viewer@test.local` |

Use two browser profiles or log out and in to switch between maker and checker. Maker-checker means: the maker records, a different user approves / deposits / clears.

## 2. TEST DATA ALREADY IN THE APP

- Project: **Tear QA meoob**, tower **TQAmeoob**, payment plan **Plan QA meoob** (4 instalments: 10%, 20%, 30%, 40%).
- GST on this project: 5% (CGST 2.5% + SGST 2.5%) on BASIC, PLC and OTHER CHARGE.
- Units (all `available`): `Umeoob1` to `Umeoob10` (carpet 500 sqft, base price 30,00,000) and `Umeoob11`, `Umeoob12`, `Umeoob13` (carpet 750 sqft, base price 45,00,000).
- Broker: **QA Broker meoob** (approved, commission 2%, TDS 5%, GST 18% set up).
- Rate per sqft for booking: use **6000** for every unit (500 sqft x 6000 = 30,00,000; 750 sqft x 6000 = 45,00,000). Change it where a scenario says so.

## 3. THE RULES THE APP MUST FOLLOW (compute your ledger from these)

**Price.** Basic = rate x carpet area (rounded to the rupee). Agreement price = basic + PLC + other charge + balcony charge - discount. GST 5% is charged on each charge head (basic, PLC, other) separately, half CGST half SGST; the discount comes off the price but GST stays on the full price. NRI / OCI / PIO applicants pay no GST.
Example: rate 6000 x 500 = 30,00,000; GST 1,50,000; total with GST 31,50,000. With PLC 40,000 as well: basic 30,00,000 + PLC 40,000, GST 1,52,000.

**Payment plan.** Instalments are 10 / 20 / 30 / 40 % of the price, each with its GST. For a 30,00,000 unit with GST: 3,15,000 / 6,30,000 / 9,45,000 / 12,60,000 (total 31,50,000). Instalment 1 is the booking instalment. Instalments become "demanded" when raised (by the demand screens) or when due.

**Receipts and money.**
- A receipt amount is GST-inclusive. 1,05,000 received = taxable 1,00,000 + CGST 2,500 + SGST 2,500.
- Status flow: recorded (pending) -> authorised by the checker -> deposited -> cleared. **Only CLEARED money counts as collected.** Pending, authorised, deposited, on hold, bounced and cancelled money does not reduce any dues.
- The person who recorded a receipt cannot authorise / deposit / clear it.
- A cleared receipt cannot be cancelled. A bank return after clearing goes through "Receipt return" (request by maker, approve by checker) and takes its amount off the receipt (credit part first).
- A receipt directed to one instalment pays that instalment up to its total. Any excess is **customer credit** (shown as credit); it does not move to the next instalment by itself. Credit reaches an instalment only through an approved credit allocation (maker requests, checker approves).
- Paid / partial / unpaid status of an instalment must always follow the cleared money. A cancelled or bounced receipt must put the instalments back.

**GST invoices.** An invoice for a receipt is that receipt's own tax: taxable + GST = receipt amount. A second live invoice for the same receipt is refused. An invoice cannot be bigger than its receipt. A receipt that has a live invoice cannot be cancelled until the invoice is cancelled by a checker (who issues a credit note). Credit notes without a rate use the invoice's own rate; credit notes together cannot exceed the invoice.

**Broker commission.** 2% of the price (basic) for a percent commission, or a flat amount. Paid once. GST 18% added, TDS 5% deducted (20% if the broker has no PAN): commission 60,000 -> +10,800 GST -> -3,000 TDS = 67,800 net. A cancelled booking's commission is cancelled and cannot be paid.

**Surrender / cancellation.** Forfeiture and refund together cannot exceed the CLEARED money received (less approved returns). It stops the booking, frees the unit (surrender: unit becomes `temp_surrender`; builder cancellation: `available`), cancels instalments still to pay (paid ones stay as history). Money is not moved by itself. "Restore" must bring back exactly what was there (booking, unit, instalment statuses).

**Unit shifting, transfers.** After shifting a booking to another unit, the money already received, the demands and the dues must still add up for the applicant, the old unit must be free and the new unit taken. After a transfer to another applicant, the old applicant's balance and the new one's must be consistent and no money disappears or doubles.

**Dues reports.** These measures must agree between screens for the same project and customer: Agreement value, Total demanded (raised instalments), Valid collections (cleared money less returns), Uncleared receipts (pending etc., not collected), Billed outstanding (raised and not yet paid), Overdue (raised, due before today, unpaid), Contract balance (agreement with GST less valid collections), Credit (collected but not applied). They are different numbers on purpose; do not expect them to be equal to each other, expect each one to be the same wherever it appears.

## 4. BY DESIGN: do NOT report as bugs, list under "Questions for finance"

- A customer can show credit and a part-unpaid instalment at the same time.
- The Analytics page shows "Contract balance" while dues reports show "outstanding": different measures.
- GST received on the cash/collection reports is the GST on cleared receipts BEFORE bank returns.
- A GST invoice can be made for a receipt that is recorded but not yet cleared.
- A broker commission can be paid before the booking amount has cleared.
- Money that names no instalment is credit.

## 5. WHAT TO DO: scenarios (do ALL; use a fresh applicant and a fresh unit for each unless it says "same")

For every scenario: do the steps, and after EVERY money step run the CHECK in section 6. In every scenario also do the "mid-way changes" in section 7 at least twice.

**SC-01 Plain booking.** Create applicant `QA-One` (sales login). Book `Umeoob1`, rate 6000, booking amount 10,000 cash. Confirm the price preview (30,00,000, GST 1,50,000, total 31,50,000) matches the saved booking, the consumer card and the payment schedule.

**SC-02 Booking with extras.** Book `Umeoob2` with PLC 40,000, other charge 10,000 and a discount of 20,000. Work out price and GST by hand and compare the preview, the saved booking, the schedule and the dues report. Then edit the rate (6000 -> 6500) before confirming and check everything recalculates; reload the page and check the numbers did not change back or jump.

**SC-03 NRI applicant.** Create `QA-NRI` with nationality NRI. Book `Umeoob3`. GST must be 0 everywhere (preview, schedule, receipts, invoice).

**SC-04 Receipts, every mode and status.** For `Umeoob1`: record receipts of 1,05,000 (NEFT), 2,00,000 (cheque), 50,000 (cash), 3,15,000 (online). Take each through authorise -> deposit -> clear with the checker; leave one of them at "authorised", one at "deposited" and one at "on hold" for a while and check that NONE of those reduces the dues until it is cleared. Hold and release one. Then clear them one at a time and check after each clearing.

**SC-05 Partial payments and several instalments.** Pay instalment 1 in four parts (e.g. 1,00,000 + 1,00,000 + 1,00,000 + 15,000). Then pay 5,00,000 against instalment 2 (partial: 1,30,000 short). Check statuses (paid / partial / pending), outstanding, credit.

**SC-06 Overpayment and credit.** Pay 4,00,000 against instalment 1 (3,15,000): excess 85,000 is credit. Check the customer shows credit 85,000 and instalment 2 still unpaid. Request a credit allocation of 50,000 to instalment 2 (maker), approve it with the checker, check instalment 2 becomes partial and credit falls. Try to approve your own request (must be refused). Try to allocate more than the credit (must be refused).

**SC-07 Bounce.** Cheque of 2,00,000: record, authorise, deposit, BOUNCE (give a reason). Check dues unchanged, the receipt is `bounced`, cheque bounce log / pending-cheques screen counts are right, and any penalty entry shown is the same everywhere. Record a replacement receipt and clear it.

**SC-08 Cancel receipts.** Cancel a pending receipt (creator withdraws); reject another as checker with a reason; try to cancel a CLEARED receipt (must be refused: use Receipt return instead). Check dues after each.

**SC-09 Bank return after clearing.** Clear 5,00,000; request a return of 1,20,000 (maker), approve (checker). Check valid collections, credit and instalments. Then return 3,00,000 more and check nothing goes negative and the instalments follow.

**SC-10 GST invoices.** Create an invoice for a cleared receipt. Check taxable + GST = receipt amount. Try a second invoice for the same receipt (refused). Try to cancel the receipt while the invoice is live (refused). Cancel the invoice as the checker (maker of the invoice must not be able to) and check the credit note, then the receipt. Raise a partial credit note on another invoice (maker) and approve it (checker); try credit notes beyond the invoice (refused). Check the GST report / invoice list totals.

**SC-11 Demands.** Raise demands, unraise one (where the screen allows), raise again; check due dates, statuses, the dashboard demand status and the "Due report" all agree. Pay an instalment fully, then try to unraise it.

**SC-12 Interest.** Make an instalment overdue (use a past due date where the screen lets you set one, or an existing past-due instalment), then look at penal / manual interest screens: interest is simple interest on the unpaid basic amount for the days late after the grace days. Check the same interest in every place it appears. Waive interest and check.

**SC-13 Add-on charges and parking.** Add an add-on charge and a parking slot to a booking, pay part of it, cancel / waive the add-on. Check the dues and GST on the add-on.

**SC-14 Discount / rebate.** Request a booking rebate, approve with the checker, check price, GST and instalments recalculate once and only on instalments not yet raised.

**SC-15 Broker booking and commission.** Book `Umeoob4` as a broker sale (QA Broker meoob, 2% percent). Check the commission row (2% of basic = 60,000). Pay it as finance: GST 10,800, TDS 3,000, net 67,800. Try to pay it twice (refused). Book another with a flat commission 12,345.67 and check 2,222.22 / 617.28 / 13,950.61. Cancel a booking whose commission is pending and check the commission is cancelled.

**SC-16 Unit hold.** Put `Umeoob5` on hold for QA Broker, try to book it for someone else (refused), release the hold, book it.

**SC-17 Unit shifting.** Take `QA-One` (`Umeoob1`) who has money paid and demands raised. Shift to `Umeoob11` (bigger unit, 45,00,000). After shifting check: old unit free, new unit taken, the schedule and demands for the new price, the money already received still there, the dues, the dashboard and reports. Shift back to a 30,00,000 unit and check again. Shift an applicant with NO money, then one with a pending (uncleared) receipt.

**SC-18 Surrender, cancellation and restore.** Applicant with 5,00,000 cleared: surrender with forfeiture 1,00,000 and refund 3,00,000 (allowed: 4,00,000 <= 5,00,000). Try forfeiture 6,00,000 (refused), then forfeiture 2,00,000 + refund 4,00,000 (refused: total above the cleared money). Check unit status (`temp_surrender`), instalments (unpaid ones cancelled, paid stay), dues, surrender report, dashboard. Restore the surrender and check everything is exactly as before (unit, booking, instalments, dues). Do the same with a builder CANCELLATION (unit becomes available) and its refund screens. Surrender a customer whose money is only pending: forfeiture must be limited to cleared money (zero).

**SC-19 Transfer.** Transfer a booking with money paid from `QA-One` to a new applicant `QA-Buyer` with a transfer fee: check both applicants' balances, receipts, the demands, the transfer report, the unit owner, and that no money is lost or doubled. Transfer back. Edit the transfer date and check nothing shifts wrongly.

**SC-20 Cancel and re-book.** Cancel a booking that is still pending payment; the unit must become available; book the same unit again for another applicant; check no old demands or commission leak into the new booking. Surrender, then re-book the same unit for the same applicant and check the history and the dues.

**SC-21 Roles.** With the read-only login try every money action (must be refused or hidden). Sales cannot clear receipts. The maker cannot authorise or clear their own receipt. Finance can pay commission. Note any screen that shows money to a role that should not see it.

**SC-22 Whole picture.** At the end, for the project **Tear QA meoob** compare, for the project as a whole: Project wise dues, Customer Wise Balance, Customer Due Summary, Due Report, Ageing summary, Month wise dues, Project Wise Collection, Cash/Bank Summary, Bank Ledger, GST invoice list, Dashboard (demand status, pending cheques, daily status) and Analytics. Each measure in section 3 must be the same wherever it appears, and must equal the total of your ledger.

## 6. THE CHECK (run it after every money step; this is the heart of the test)

For the applicant you just changed, compare with your ledger, on ALL of these screens:
1. The applicant page / consumer card (price, GST, total).
2. Receipts list: amount, mode, status, GST split on the printed receipt.
3. The applicant's demands / Customer Dues Details / Applicant Payment File: each instalment amount, status, paid, balance.
4. Customer Wise Balance and Customer Due Summary: received, due, balance, credit.
5. Due Report and Project wise dues: outstanding, overdue.
6. Dashboard: demand status outstanding, pending cheques, approval queue.
7. Collection reports: Project Wise Collection, Cash/Bank Summary, Bank Ledger (cleared only; uncleared shown separately).
8. GST Invoicing: invoice list and amounts; Unit status screen: the unit's status.
Write one line per step: `step N | action | expected (your number) | seen on screens 1..8 | OK or MISMATCH`. A MISMATCH is a bug even if you are not sure which screen is right: report both numbers and both screens.

## 7. MID-WAY CHANGES (do these inside every scenario, not at the end)

After step 2 or 3 of a scenario and again later, do some of these, then re-run the check:
- Browser Back and Forward in the middle of a form; reload the page; open the same applicant in a second tab and change something there, then come back.
- Double-click a Save / Approve / Clear button; press Enter twice.
- Change the amount of something not yet cleared; change the payment mode; change the date to earlier / later; change the rate or area; change the discount; change the plan.
- Record an amount with paise (e.g. 1,23,456.78); a tiny amount (1); zero; negative; text; a very large number: the app must refuse bad ones with a clear message and must not save half.
- Cancel after approving; approve after cancelling; clear after a bounce; return after an invoice; shift or surrender while a receipt is only pending; transfer while a receipt is deposited.
- Do the same action as a different role.
Watch for: a number that changes by itself after a reload, a total that is off by 1 rupee or 1 paisa, a status that does not follow the money, money that appears on one screen and not another, a button that works twice, an error shown only in the console and not on screen, a list that is cut off without saying so (see page size / "showing X of Y").

## 8. FINAL REPORT (write it only when ALL scenarios are tried)

1. **Coverage table**: SC-01..SC-22 with DONE / PARTLY / BLOCKED and one line why.
2. **BUGS**: table with ID, severity (High = money wrong or lost, Medium = two screens disagree, Low = wording/layout), scenario and step, exact steps to reproduce, EXPECTED number (with your working), ACTUAL number, the screens involved, and the exact on-screen message if any.
3. **Passed checks**: a short list of what was verified OK (so nobody repeats it).
4. **Questions for finance**: the by-design behaviours of section 4 you met, and any other rule you were unsure about, each with the numbers you saw.
5. **Final ledger**: the per-applicant ledger and the project totals, next to what the reports show.

Start now with SC-01. Do not wait for me. Keep going until the final report is written.

---

## If the app is down (for you, not for Claude in Chrome)

Run these in a terminal on this Mac (test database only):

```bash
/Library/PostgreSQL/18/bin/pg_ctl -D /private/tmp/claude-501/-Users-ketansingla-Desktop-Grapes-Rof-CRM-rof-crm/771acb26-0d7e-4734-8e27-1fb0e0096860/scratchpad/pg -o "-p 5433 -k /tmp" start
cd <repo>/packages/api && DB_HOST=127.0.0.1 DB_PORT=5433 DB_NAME=rof_ci DB_USER=postgres DB_PASSWORD=<local-test-password> JWT_SECRET=<any-local-value> NODE_ENV=development PORT=3096 API_RATE_MAX=500000 node dist/index.js
```

Then open http://localhost:3096 .
