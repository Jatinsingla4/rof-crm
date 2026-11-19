# ROF CRM exploratory QA, session 1 (cumulative register)

Date: 2026-11-06. Environment: local API on port 3051 against the disposable database `rof_qa_explore` (baseline, migrations 96 to 145, synthetic data built by `docs/end-to-end/api-test-end-to-end.mjs` seed 4242 plus my own rows). No source code was changed, nothing was committed or deployed, `rof_crm`, Neon, Vercel and production were never touched, and `git status --short` still shows the same 24 entries as before. The server on 3051 is stopped; the database `rof_qa_explore` is left in place (drop it when no longer needed).

## 0. Continuity: what could and could not be recovered

The brief says earlier QA testing exists. I searched this project's saved sessions, the repo, the Desktop and the memory notes for a QA register, screenshots or defect list. **None exists.** The earlier sessions are Set Master, Authentication, Users & Roles and module work (code audits and fixes), not a browser QA pass. So this is the first entry in the register. Nothing is claimed as "previously passed". The older audit findings (Set Master, Authentication, Users & Roles) are kept in their own reports and are not re-tested here.

## 1. Honest coverage statement

This session is **a start, not a full pass**. The CRM has about 66 screens and more than 40 API route files. In this session:

| Area | Status |
|---|---|
| Screen inventory | 66 routes found in the router. Opened and read with content settled: unit-status, receipts, consumers, demands, reports, dashboard, booking, users, set-projects, allotment (no `undefined`, `NaN`, `[object Object]` or `Invalid Date` text, no script errors). A first sweep of all 66 routes was unreliable (page content lagged one route behind) and is **discarded as evidence**. The other ~56 screens are **NOT TESTED** in the browser |
| Applicants (API) | name and mobile validation tested, duplicate mobile, name edge cases |
| Booking (API) | validation, future date, negative and zero amount, bad ids, double booking, parallel booking, cancel, rebook |
| Receipts (API) | amount edge cases, date edge cases, duplicate reference, parallel duplicate submit |
| Documents | one booking receipt HTML inspected against the database |
| Permissions | 20 endpoints x 6 roles (status codes only) |
| Inventory counts | unit-status screen compared with database (total, by status, total area) |
| Reports, GST invoices, demand letters, transfers, surrender, parking, brokers, loans, registry, charges, PDFs other than the one receipt | **NOT TESTED** |
| Field-by-field form testing in the browser, file uploads, responsive layouts, session expiry, two-tab edits | **NOT TESTED** |

Verdict from this session alone: **no release statement can be made.** What follows is only what was actually run.

## 2. Confirmed defects

| ID | Sev | Module | What happens | Reproduction (disposable DB) | Expected |
|---|---|---|---|---|---|
| QA-001 (**root cause corrected in section 8**) | P2 | Booking / Applicants | After a booking is cancelled the applicant cannot be booked again on the **same** project. The cancel clears `consumers.project_id` but keeps `registration_no`; the next booking then fails with 409 "already registered as EEPR-... under a different project" | New applicant, `POST /booking` (201), `POST /booking/:id/cancel` (200), `POST /booking` same applicant, same project, another or the same unit (409). Reproduced twice. The conflict check is `existingRegNo && consumerRow.project_id !== project_id` in `routes/booking.ts` (line 483 onward) | Rebooking on the same project allowed, or the message names the real cause |
| QA-002 | P2 | Booking documents | The booking receipt (`GET /api/booking/:id/receipt-html`) is produced for a **cancelled** booking and shows "Rs. 25,000.00 received in Cash" with no cancelled marker, while the receipts table holds no row for that payment | Booking with `booking_amount` 25000 and cash, cancel it, open `/receipt-html` (200, full receipt) | Cancelled booking should not print a normal receipt, or the page must say cancelled |
| QA-003 | P2 | Applicants / receipts | `POST /consumers` with only `name` (the path leads and imports use) leaves `first_name` and `last_name` empty. The receipt prints "Received with thanks from —", and the unit-status name filter and name column use first and last name only. The Leads screen falls back to `name`, so the same person shows with a name in one screen and blank in another | Create an applicant with `{name, mobile}`, book, open `/receipt-html` (name shows as a dash) | Every screen shows the same person name |
| QA-004 | P3 | Booking documents | Receipt page prints empty labels when company details are blank: "CIN No.:", "GSTIN:", "Place Of Supply:", "CIN: Regd. Office:" with no values | Same receipt as QA-002 (company has no CIN or address in the synthetic data) | Hide empty labels or flag missing company set-up |
| QA-005 | P3 | Receipts | Receipt date `1900-01-01` and `2999-12-31` are refused with "must be a real date", which is the wrong message (they are real dates, out of range) | `POST /payments/receipts` with those dates (400) | Message should say out of range |

## 3. Suspected issues and business questions (not confirmed as defects)

| ID | What was seen | Why not confirmed |
|---|---|---|
| QA-Q1 | Cancelling a booking that already has a received receipt (Rs 40,000) frees the unit and leaves the receipt "pending" and unlinked, with no refund row, no warning and no prompt | Maybe cancellation is only meant before money, with refunds going through Surrender. Needs the owner's rule. If money must be handled, this is P1 |
| QA-Q2 | A Rs 100 crore (1,00,00,00,000) receipt against a booking with about Rs 50 lakh of demands is accepted. The system then writes four extra "-ADV" receipt rows (996,883,000; 996,588,000; 995,290,000; 994,818,000), so the sum of the receipts column is about Rs 498 crore for one Rs 100 crore payment. GST on those rows is computed on the full amounts | These rows may be a running-balance record, not new money. I did not check which reports sum that column. **To check next:** the ledger, dues and cash reports with a normal advance amount (e.g. 20 lakh over four demands). If reports sum `amount_received_inr`, this is a P0/P1 money-multiplying defect |
| QA-Q3 | Discount: `discount_value` 50,000 with reason and authority, and 99,999,999 with no reason, were accepted (201) and the saved booking shows `discount_value` 0 | The booking has no price (`total_price_inr` empty) because my test booking sent no rates or areas. The discount may only apply to priced bookings. Needs a priced booking test |
| QA-Q4 | A receipt dated 2026-11-21 (future) exists, created by the seed script's booking path, while the receipt API refuses future dates | Probably a post-dated cheque. Rule not established |
| QA-Q5 | Roles: read-only viewer and support agent can list all receipts, bookings, applicants and banks (200). Project manager reached bank creation (409 duplicate, not 403) | Possibly intended (view access, project-scoped manager). Same theme as UR-001 and UR-007 from the earlier Users & Roles audit |
| QA-Q6 | Booked units (not yet allotted) show a blank applicant name and registration number on the Unit Status screen because it joins through allotments | Probably by design. Needs confirmation |
| QA-Q7 | A GST slab saved with `fromDate 2026-01-01` comes back as `2026-01-01T00:00:00.000Z` (timestamp). A server west of UTC could show the previous day | Not tested in another time zone |

## 4. What passed (evidence in this session)

- Receipts: amount 0, negative, fractions, 1e15, text, null, scientific notation: all 400 with clear messages. Invalid, leap-year and future dates refused (28 Feb 2027 test and 29 Feb 2027 both handled). A repeated reference is refused 409 naming the first receipt; five parallel identical submissions gave one 201 and four 409.
- Bookings: future date, negative and zero amount, nonexistent unit (400) and applicant (404) refused. Three parallel bookings on one unit gave one 201 and two 409, one active booking left, unit locked. A second applicant on a booked unit: 409 "no longer available". Cancel returns the unit to available and writes a status history row; a second cancel was not tested.
- Applicants: blank, whitespace, `<script>` and over-long names refused; apostrophes, SQL text and Hindi accepted and stored as text; mobile numbers 3, 5, 11 digits, letters and all zeros refused; `+91 99999 99999` and padded numbers normalised; same mobile again reuses the existing applicant (`reused: true`).
- Permissions: read-only viewer and support agent get 403 on creating a booking, unit, receipt or cancelling. User admin, roles, audit logs, employees and test-data import are blocked for non-admin roles.
- Inventory: Unit Status screen shows 17 units, 7 available, 7 booked, 3 on hold (database `locked`), total area 13,059 sq ft, all equal to the database.
- Booking receipt amount: Rs 25,000 splits as 23,809.52 + 595.24 CGST + 595.24 SGST = 25,000.00 (5% GST, matches the slab).

## 5. Environment limitations

- The disposable database has no company address, CIN or GSTIN, applicants have no applicant detail rows, and the e2e builder removes its own GST slab at the end (I recreated one: 2.5% + 2.5% from 2026-01-01 to 2027-12-31). Some blank fields above come from that.
- There is no printer or PDF engine in the test run. Documents are HTML pages, and only one was read.
- `/api/reports/*` paths I guessed returned 404, so report totals were not compared.

## 6. Next steps (in order of value)

1. Resolve QA-Q2: record a normal advance receipt and compare the ledger, dues, cash-bank and collection reports with the receipts table.
2. Priced booking: confirm discount (QA-Q3), then check booking value, GST, demands and payment plan totals by hand.
3. Browser pass over the remaining ~56 screens: forms, buttons, uploads, filters, pagination, responsive layouts.
4. Documents: demand letter, allotment letter, custom letters, GST invoice, reminders.
5. Transfer, surrender and registry flows, with money.
6. Decide QA-001 to QA-003 (all small fixes), and answer QA-Q1 and QA-Q4.

## 7. Round 2 (same day): money checks

Same disposable database, no code changes. Reports used: `project-collection`, `receipt-wise-collection`, `monthly-collection`, `customer-balance`, `customer-due-summary`, `project-wise-dues`.

**QA-Q2 resolved: not a multiplication defect.** The "-ADV" rows are excluded from every report I read. Receipts without them add up to 1,000,117,277 in the database; `project-wise-dues` shows 1,000,072,277 pending + 5,000 cleared = 1,000,077,277. The 40,000 gap is exactly the receipt of the cancelled booking (see QA-Q1). Remaining concern: Rs 100 crore was accepted against about Rs 50 lakh of demands with no overpayment warning or cap (question QA-Q8), and the report shows `credit_amount` 0 although about Rs 99.5 crore is paid in advance.

**QA-Q1 strengthened.** Money received on a cancelled booking drops out of every report and no refund row exists, so Rs 40,000 is recorded in the receipts table only.

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| QA-006 | P2 (formula to be confirmed) | Two reports give a different total cost for the same applicant. Unit E-0B, EEPR-2026-0001: `customer-balance` total cost 7,206,152 (cost 6,863,000 + GST 343,152); `customer-due-summary` "total cost with GST" 6,863,476.20 (cost + 476.20). For every test booking `customer-due-summary` adds only 476.20 (GST on the Rs 10,000 booking payment) whatever the price (3 lakh or 1.2 crore units both +476.20). With a 5% slab, GST on a Rs 30 lakh unit should be about 1,50,000 | `GET /reports/customer-due-summary` vs `/reports/customer-balance` |
| QA-007 | P2 | Company rebate is stored but not applied in the due summary. Rebates of 0, 50,000 and 20,00,00,000 on units of equal base price all show `net_basic_price` 3,000,000. A rebate larger than the unit price (Rs 20 crore on Rs 31 lakh) is accepted with 201 | `POST /booking` with `company_rebate_rs`, then `customer-due-summary` |
| QA-008 | P3 | The API silently ignores unknown or unused fields: `discount_value` of -1000 or "abc" returns 201 and stores 0. The booking uses rebate fields instead, which do validate (-1000 and "abc" give 400). Not harmful, but a screen or integration sending `discount_value` would believe it saved | `POST /booking` with `discount_value` |

Open question QA-Q8: overpayment rule. Open question QA-Q9: whether `net_basic_price` is meant to include rebates.

Coverage after round 2: still only the finance and booking API paths and 10 screens. The rest of section 6 is unchanged.

## 8. Round 3: owner decisions applied, root causes and proposed fixes (no code changed)

Same disposable database `rof_qa_explore` (I added one synthetic second super admin `qa_checker@test.local` to act as checker, because the maker-checker rule bars approving your own receipt). Nothing was committed, pushed, merged or deployed, no production data or migrations were touched, and `rof_crm`, Neon and Vercel were not used. The owner's decisions are the rule for everything below; they are not treated as proof of a defect. Each item says what was actually observed.

### 8.1 Owner decisions recorded

- **QA-Q8 (overpayment):** controlled advances allowed, no arbitrary hard cap. Excess must be a real customer advance/credit, shown correctly in the ledger and reports, abnormal amounts need a warning and authorised approval, totals must reconcile, and "-ADV" rows must never count as extra money. Investigate why the Rs 100 crore payment showed zero credit.
- **QA-Q9 (company rebate):** Net Basic Price = Basic Price - approved company rebate. Rebate cannot be negative or above the basic price, must be stored exactly, and the net price must be the same in booking, due summary, balance, demands and related reports. GST basis must be checked against the real tax logic, not assumed.

### 8.2 QA-007 company rebate: CONFIRMED (code and database)

Experiment: six units of identical base price Rs 30,00,000 (500 sq ft), one booking each, completed with `PATCH /api/booking/:id`.

| Booking | Stored | Plan total | Sum of 5 demands | Net basic in `customer-due-summary` | Unit cost in `customer-balance` |
|---|---|---|---|---|---|
| no rebate | none | 30,00,000 | 30,00,000 | 30,00,000 | 30,00,000 |
| company rebate Rs 1,00,000 | rebate_rs 100000 | 30,00,000 | 30,00,000 | 30,00,000 | 30,00,000 |
| company rebate 5% | rebate_pct 5 | 30,00,000 | 30,00,000 | 30,00,000 | 30,00,000 |
| company rebate 100 per sq ft | rebate_sqft 100 | 30,00,000 | 30,00,000 | 30,00,000 | 30,00,000 |
| company rebate Rs 90,00,000 (3x the price) | rebate_rs 9000000 | 30,00,000 | 30,00,000 | 30,00,000 | 30,00,000 |
| inaugural discount Rs 1,00,000 (control) | inaugural 100000 | 29,00,000 | 29,00,000 | 29,00,000 | 29,00,000 |

So the rebate is saved exactly but changes nothing; a different field (inaugural discount) does reduce price everywhere. Root cause in code: `routes/booking.ts` (around line 905) computes `totalAmount = basicCost + plc + other - company_inaugural_disc + balcony` and never reads `company_rebate_rs / _sqft / _pct`; `utils/report-ledger.ts` line 82 computes `net_basic_price = BASE - dealer_adjustment_amount - company_inaugural_disc`, also without the rebate. The rebate boxes exist on the booking form (`booking.js` lines 164 to 172) and the edit form, and the values travel to the server and are stored, but no calculation uses them.
Validation: negative and non-numeric rebate are refused (400, "must be a number from 0 to 10,00,00,00,000"). A rebate above the basic price is **accepted** (Rs 90 lakh on a Rs 30 lakh unit returned 201 and 200 on completion).
Second inconsistency, from code only (not run): the ledger subtracts `dealer_adjustment_amount` but the booking plan total does not, so those two would disagree whenever a dealer adjustment is entered.

**Proposed fix (needs your yes):**
1. One shared helper for "net basic price" (basic cost minus approved rebate minus inaugural discount minus dealer adjustment, in one place) used by booking completion, edit booking, the ledger SQL, `charge-area.ts` (percent charges "after discount") and surrender/transfer pricing.
2. Server-side validation: rebate between 0 and the basic price, on create, edit and the screens.
3. Tests that book with each rebate type and compare plan total, demands, due summary, balance and rebate-bearing reports.
Questions that block step 1: (a) the screen has three rebate boxes (Rs, per sq ft, %). Is the rebate their **sum** (Rs + sq ft x area + % x basic) or only one of them? (b) What marks a rebate as "approved"? There is no approval status on the booking today (only a free-text "authorised by" on the unused discount field).

### 8.3 GST basis: INCONSISTENCY CONFIRMED, correct rule needs a tax decision

With the Rs 1,00,000 inaugural discount, demand amounts fall but demand GST does not:

| Demand | Amount, no discount | Amount, Rs 1,00,000 off | CGST each, no discount | CGST each, discount |
|---|---|---|---|---|
| 1 | 15,90,000 | 15,37,000 | 39,750 | 39,750 |
| 2 | 1,50,000 | 1,45,000 | 3,750 | 3,750 |
| 3 | 6,60,000 | 6,38,000 | 16,500 | 16,500 |
| 4 | 2,40,000 | 2,32,000 | 6,000 | 6,000 |
| 5 | 3,60,000 | 3,48,000 | 9,000 | 9,000 |
| Total | 30,00,000 | 29,00,000 | 75,000 | 75,000 |

The slab is 2.5% + 2.5%, so GST is 1,50,000 on the full price (5% of Rs 30,00,000) whether or not the discount is given; on the discounted Rs 29,00,000 it would be 1,45,000. Root cause: in `booking.ts` the demand amount uses `totalAmount x %` (after the discount) but the GST uses `basicCost x %` (before it). The effective GST therefore overcharges by Rs 5,000 on a Rs 1,00,000 discount. I did **not** decide which basis is right: whether GST applies to the price before or after a rebate or discount is a tax-treatment question for your tax adviser. The code should at least use one basis everywhere and say which.
Also unreconciled: `customer-balance` shows GST 1,50,226.80 for the no-discount booking, while the demands carry 1,50,000 plus the booking-payment GST of 476.20 (= 1,50,476.20, difference 249.40). I did not trace this.

### 8.4 QA-Q8 overpayment and QA-Q1 cancel: FINDINGS

Experiment: one applicant (plan Rs 30,00,000, demand total with GST 31,50,000), one receipt of Rs 50,00,000, approved by a second login, then deposited and cleared.

1. **Why the Rs 100 crore showed zero credit:** credit and the overpaid balance are computed from **cleared** receipts only (`report-ledger.ts`, `reports-dues.ts` line 35). The earlier Rs 100 crore receipt was still pending, so it counted as nothing. After clearing, `customer-balance` shows received 50,00,000, demanded 31,51,486.80 and balance **-18,48,513.20** (correctly an overpayment). So credit is derived, not stored: there is no advance or credit record anywhere (`payment_plans.advance_amount` exists but is not used by these reports). **Not a reporting bug as such, but no real "advance balance" exists** (decision point 1).
2. **Approval marks demands paid before the money clears.** The moment the checker approved the receipt (status `authorized`, before deposit or clearing) all five demands became `paid`, including demands 2 to 5 that had not been raised yet ("pending"). A bounced cheque after approval was **not tested**, so I cannot say whether the demands revert.
3. **"-ADV" rows are excluded from the ledger and cash reports (good) but not from the Receipt List.** After the Rs 50,00,000 receipt, four "-ADV" rows (3,183,000; 3,340,500; 2,490,000; 2,238,000) were created and stay `pending` for ever, even after the parent receipt cleared. They are running balances, not payments. The receipt list API returns them with no advance flag, and `receipts.js` sums every row (lines 854, 988, 1106). Whole list: **Rs 500,00,07,777** against **Rs 100,51,77,277** of real receipts in the database, an overstatement of Rs 399.5 crore on screen. Decision point 5 is therefore broken in the Receipt List and its "Total Collection".
4. **No warning or approval for a large overpayment.** Rs 100 crore (to the limit of 1,00,00,00,000) and Rs 50 lakh against Rs 31.5 lakh were both accepted with no prompt.
5. **Project-wise dues `credit_amount` was not reconciled** (3,330,500 in the project, I did not break it down by customer).
6. **QA-Q1, cancel with money received:** `POST /booking/:id/cancel` (`booking.ts` line 3449) blocks only a complete booking or one with demands; it never looks at receipts. A booking with a Rs 40,000 receipt can be cancelled; the unit is freed, the receipt stays `pending`, and since reports exclude cancelled-booking customers the Rs 40,000 appears in none of them and no refund row is made (database: 1 receipt, 0 refund rows). Under the owner's rule that money must not vanish.

**Proposed fixes (needs your yes):**
- Add `is_advance` to the receipt list API and exclude those rows from every list total and card; or better, stop creating "-ADV" rows and record advance once on the receipt/ledger (a schema change, so a migration and a decision).
- A real advance/credit figure on the customer ledger (received cleared minus applied), shown in balance, due summary, project dues and the applicant file, reconciled by a test (received = applied + credit).
- Configurable overpayment threshold with a warning and an authorised-approver step; no hard cap.
- Decide whether demands should flip to `paid` at approval or at clearing; if at approval, define what happens on a bounce.
- Cancel: refuse or route to the refund/surrender path when non-cancelled, non-bounced receipts exist; otherwise show that money in a refund-due list.

### 8.5 QA-006 and QA-008

- **QA-006 confirmed, cause found.** `customer-due-summary` computes `total_cost_with_gst = unit_cost + booking_gst`, where `booking_gst` is only the GST on the first booking payment (and balcony). `customer-balance` computes `total_cost = unit_cost + total GST of all demands`. Example (no-discount booking, Rs 30 lakh): due summary 30,00,476.20 vs balance 31,50,226.80. The first label promises the full price with GST but returns a fraction of the GST. **Fix:** make the due summary use total demand GST (one shared helper with the balance report), or rename the column.
- **QA-008 confirmed.** The booking route does not read `discount_value` at all (no code path), so any value, including -1000 or text, returns 201 and is ignored. **Fix (low):** reject unknown fields, or remove the column and any form field that implies it.

### 8.6 Correction to QA-001

I attributed QA-001 to the cancel. That was wrong. Cancel does not touch the applicant's project link. The real cause: an applicant created **without a project** (the `name + mobile` path used by leads and imports) gets a registration number at the first booking, but the booking never stores the project on the applicant (`consumers.project_id` stays NULL). The conflict check at `booking.ts` line 483 (`existingRegNo && consumerRow.project_id !== project_id`) then fails the **second booking on the same project** (a second unit, with or without a cancel in between) with a false "different project" message. Verified: no-project applicant, second unit, no cancel: 409; applicant created with the project: book, cancel, rebook all pass (201). **Fix:** set `consumers.project_id` when the registration number is issued (near the `UPDATE consumers` at line 491), and backfill existing rows. Severity stays P2 for lead-created applicants, none for applicants created with a project.

### 8.7 Order I suggest for fixes (once you approve)

1. QA-007 rebate (blocked on the two questions in 8.2). 2. Receipt List "-ADV" totals (8.4 point 3), the biggest visible money error. 3. Cancel with money (QA-Q1). 4. GST basis (8.3, tax decision first). 5. Advance record and overpayment approval (design needed). 6. QA-006, QA-001, QA-008 (small).

New open questions: QA-Q10 rebate = sum of the three boxes or one? QA-Q11 what makes a rebate "approved"? QA-Q12 GST before or after discount? QA-Q13 should demands become `paid` at approval or at clearing? QA-Q14 who approves an abnormal overpayment and above what amount?

Not tested in this round: a bounced or cancelled receipt after approval, transfer and surrender money flows, rebate on edit booking, GST with the discount for NRI customers, any browser form.

## 9. Round 4: rebate fix (QA-007) implemented and verified on disposable databases

Decisions Q10 and Q11 are final and recorded here. Scope: company rebate only. GST basis (Q12), payment clearing and demand "paid" behaviour (Q13) and overpayment thresholds (Q14) were **not touched**. Work was done on `rof_qa_explore` and a fresh `rof_rebate_verify` (dropped afterwards, exact name checked, no open connection). `rof_crm`, Neon, Vercel and production were never used. Nothing was committed, pushed, merged or deployed.

### 9.1 Decisions
- **Q10:** fixed Rs, Rs per sq. ft. and % are mutually exclusive; exactly one non-zero method; Rs = amount, per sq. ft. = rate x unit area, % = basic price x % / 100; all zero = no rebate; reject several methods, negatives and a calculated rebate above the basic price. Net Basic Price = Basic Price - approved rebate.
- **Q11:** a rebate starts Pending Approval; pending or rejected rebates affect no price, demand, GST, balance or report; only a different authorised user approves; rejection keeps a reason and audit history; any change of method or amount after approval cancels the approval; enforced in the API.

### 9.2 What was built (proposal and implementation, smallest change)
- **Schema (migration 146, idempotent, run twice):** on `booking_records`: `company_rebate_status` (none, pending, approved, rejected, legacy), `approved_rebate_amount` (the rupee amount actually applied, 0 unless approved), requester, decider, timestamps and `rebate_decision_reason`. Two CHECK constraints (valid status; an amount only when approved). **No new table:** requests, approvals, rejections and changes are written to the existing audit log (`booking_rebate`). Existing bookings that had a rebate typed are marked `legacy` and **not applied** (6 rows in the QA database); they go through approval only when someone resubmits them.
- **One shared price rule:** every place that subtracted the inaugural discount now also subtracts `approved_rebate_amount`: booking confirmation (plan total), report ledger (due summary, balance), applicant payment file (new `company_rebate` column and total discount), stock and sold-value reports, and "after discount" percent add-on charges. Pending, rejected, legacy and none apply 0.
- **API:** `POST /booking/:id/rebate/approve` and `/reject` (reason required for reject). Permission is the new process `company_rebate` (checker only, listed in the user form), super admin included; a user can never decide the rebate they entered (403, also for reject). Enforced on the route, not in the screen. Entering a rebate needs no new permission.
- **Validation (create and edit):** one method only, no negatives, not above the basic price, and rebate plus inaugural discount not above the basic price. Re-checked at approval time.
- **After approval, any change** to the three rebate boxes (or the rate, area or discount they are calculated from) sets the status back to pending, removes the amount from the price and re-prices the demands again. Saving the same values again keeps the approval. `resubmit_rebate` sends a rejected or legacy rebate for approval.
- **Re-pricing a confirmed booking:** only the demand amounts change, never GST. A confirmed booking always has its first demand raised and the booking payment on it, so the rule is: refuse (409, nothing changes) if a demand is paid, its letter was sent to the customer, or the money received on it would exceed the new amount.
- **Screens (minimal):** Edit Booking shows the rebate status, Approve, Reject (asks for a reason) and "Send for approval"; the new booking form has a one-line note. The API refuses what the screen should not allow.

### 9.3 Test evidence
| Check | Result |
|---|---|
| New script `docs/booking-rebate/api-test-booking-rebate.mjs` (database values plus API) | **87 passed, 0 failed** |
| New browser spec `e2e/booking-rebate.spec.ts` (maker cannot approve, other user approves, edit sends it back) | **3 of 3 passed** |
| All repository API scripts on a fresh database (47) | 46 passed first time (8427 checks), the 47th (security) failed one check; the one failure (security script expected 9 processes, now 10 with `company_rebate`) was a test expectation I updated; rerun **156 of 156**, so  checks, 0 failing |
| Full Playwright suite, 15 spec files plus the new one | **248 passed, 0 failed** (10.6 min). The earlier `crm.spec.ts:300` fuzz-data failure did not appear in this run |
| `tsc --noEmit`, `git diff --check`, `node --check` on the changed scripts | clean |
| Migration 146 applied twice on the QA database and on the fresh one | no errors, backfill only the first time |

What the 87 checks cover: all three methods; two or three methods at once (four combinations); negative (three boxes) and text; fixed above basic; per sq. ft. above basic (6001 x 500); percent above 100; rebate plus inaugural above basic; zero; pending changes nothing in plan, demands or three reports; self-approval and self-rejection 403; sales executive, project manager, read-only, accounts finance without the permission and no login refused; accounts finance **with** the `company_rebate` checker permission approves (proves the API check, not the menu); approval applies the exact amount, a different approver is stored, GST on the demands unchanged, audit rows exist; repeat approval 409; rejection with and without reason, reason stored and in the audit log, no price effect, cannot approve a rejected one, resubmit then approve; edit after approval (same value keeps approval, new amount, new method, two methods refused, all zero clears it); first demand raised plus booking payment; letter sent, demand paid, over-received all refused with nothing changed; approval before confirmation; legacy not applied, not approvable, resubmit works; cancelled booking refused; two database invariants (an amount only on an approved rebate; an approved rebate always has a different approver).

### 9.4 Independent reconciliation (unit price Rs 30,00,000, 500 sq. ft., plan 10/20/30/40, GST 2.5% + 2.5%)
| Method | Rebate (my own arithmetic = database) | Net basic | Demands (10/20/30/40%) | Balance, due summary, applicant file |
|---|---|---|---|---|
| Fixed Rs 1,00,000 | 1,00,000 | 29,00,000 | 2,90,000 / 5,80,000 / 8,70,000 / 11,60,000 | 29,00,000 in all three |
| Rs 120 x 500 sq. ft. | 60,000 | 29,40,000 | 2,94,000 / 5,88,000 / 8,82,000 / 11,76,000 | 29,40,000 in all three |
| 5% | 1,50,000 | 28,50,000 | 2,85,000 / 5,70,000 / 8,55,000 / 11,40,000 | 28,50,000 in all three |
Before approval every one of these stayed at 30,00,000 and 3,00,000 / 6,00,000 / 9,00,000 / 12,00,000. Demand GST was identical before and after (7,500 / 15,000 / 22,500 / 30,000 each side), which is the unchanged Q12 behaviour.

### 9.5 Things to know and decide
1. **The first demand is re-priced although it is already raised**, because every confirmed booking has it raised automatically. If its letter was sent, approval is refused until it is unraised. Say if you want a different rule.
2. **Unit area for the per sq. ft. method is the carpet area**, the area the basic rate is applied to. Tell me if super area or another area is meant (QA-Q15).
3. **GST (Q12):** still computed on the basic price before any discount or rebate, exactly as for the inaugural discount. When the tax adviser decides, one change at the demand-creation point fixes both.
4. **Ledger versus plan total, dealer adjustment (code reading, not run):** the reports subtract `dealer_adjustment_amount`; the plan total does not. Not touched.
5. **Add-on charges "after discount"** now use the approved rebate when they are first made. For a booking that already has such a charge, approval is refused with a message (nothing is re-made silently).
6. **Not applied to existing bookings:** with the migration, any booking that has a rebate typed shows as "legacy" and keeps its old price until someone sends it for approval.
7. **Not tested:** an approval followed by a surrender or transfer (their pricing paths read the ledger so they should follow, unconfirmed), a browser run of the permission picker for the new process, and the Vercel/Neon database (migration 146 has not been applied anywhere except my two disposable databases).

Files changed: `routes/booking.ts`, `utils/rebate.ts` (new), migration 146 (new), `routes/reports.ts`, `routes/reports-applicant.ts`, `utils/report-ledger.ts`, `utils/charge-area.ts`, `middleware/processPermission.ts`, `routes/users.ts`, `edit-booking.js`, `booking.js`, `docs/security-setup/api-test-security.mjs` (one expectation), new `docs/booking-rebate/api-test-booking-rebate.mjs` and `e2e/booking-rebate.spec.ts`.

## 10. Round 5: owner decisions Q15 and the four remaining checks (rebate, before commit)

Owner decisions applied: (1) the per sq. ft. rebate uses **carpet area** (that is what the code already did, `units.carpet_area_sqft`; super area is not used); (2) first-demand re-pricing only if the demand letter was not sent, the demand is not paid, and the money received on it does not exceed the revised demand amount, otherwise 409 and no partial change (implemented that way in round 4, re-verified below); (3) receipts, allocations, receipt clearing and GST were not changed; (4) an existing "after discount" add-on charge keeps blocking approval and is never recreated or modified. Work was on disposable databases only (`rof_rebate_verify2` and the clean final `rof_rebate_verify3`, both dropped with exact-name checks and no open connection; `rof_qa_explore` still exists). Nothing was committed, pushed, merged or deployed, and **migration 146 was not run on Neon, Vercel or production**.

### 10.1 Permission picker (browser, Users screen) - 5 tests, all pass
- A super admin creates a login and ticks **Company Rebate, Checker**; the process has a checker box and no maker box.
- The row shows "Company Rebate C"; after a **page reload** the row and the edit form still show it (checkbox checked); database row `is_checker = true, is_maker = false`.
- That login's `/users/me` lists `company_rebate: ['checker']` and its API approval of a rebate entered by someone else returns 200, and the booking records that user as the approver.
- A login without the permission (accounts finance), a sales executive and a project manager each get **403 on approve and 403 on reject**; the booking stays pending and the plan total is unchanged.
- Unticking the box in the form and saving removes the right at once: after reload the row has no "Company Rebate", and that login now gets 403.

### 10.2 Transfer and surrender with an approved rebate (database and reports)
Approved fixed rebate Rs 1,00,000 on a Rs 30,00,000 unit, so net 29,00,000.
| Step | Result |
|---|---|
| Transfer to a new applicant -> 201 | Booking now belongs to the buyer; the rebate row (status approved, amount 1,00,000, requester, approver, reason) is **identical** apart from owner and timestamp. Plan total 29,00,000, demands 2,90,000 / 5,80,000 / 8,70,000 / 11,60,000, demand GST total and receipts (count and sum) moved unchanged |
| Reports after transfer | The buyer's balance, due summary and applicant file all show net basic price 29,00,000; the seller no longer appears; the balance report's demanded figure (raised demand only: 2,90,000 + GST 15,000 = 3,05,000) equals the database |
| Surrender screen before surrender | **Defect found and fixed (one line):** the surrender screen computed its net basic price as rate x area, so an approved rebate was ignored. It now subtracts the approved rebate; for the test booking (6,000 x 500) it shows net basic price and agreement value 29,00,000, equal to the plan total in the database |
| Surrender -> 201 | Booking is cancelled; every rebate field is untouched; receipts and demands are exactly as they were (count, amounts); the applicant is no longer a customer in the balance report |
| Restore -> 200 | Booking live again, rebate still approved (1,00,000), plan total and demands net (29,00,000), balance, due summary and applicant file all 29,00,000 |

### 10.3 First-demand re-pricing with money on it (receipts and allocations unchanged)
Booking with a 10,000 booking payment plus a Rs 1,00,000 receipt that was approved, deposited and cleared, then fixed rebate Rs 90,000 approved. The first demand (3,00,000, raised automatically, not sent, 1,10,000 received on it) became 2,91,000 (net 29,10,000). Row-by-row comparison before and after: **receipts identical** (amounts, status, demand link, GST, dates, numbers), **allocations identical**, the plan row differs only in its total, every demand row differs only in the amount, and the unit is untouched.

### 10.4 The 409 cases change nothing
For each refusal I compared a full dump before and after: booking row, plan row, every demand row, every receipt row, allocations, add-on charges, the unit, the count of audit entries for the booking, and the balance and due-summary report rows.
| Case | Result |
|---|---|
| Demand letter already sent | 409 "already sent to the customer"; everything identical; still pending |
| A demand already paid | 409 "already paid or closed"; identical |
| Money received on a demand above its new amount (4,00,000 on a 2,91,000 demand) | 409 "more money received on it than its new amount"; identical |
| Withdrawing an approved rebate (edit) after the letter was sent | 409; identical; the approval stands |
| Add-on charge worked out "after discount" | 409 "Change that charge first"; add-on row, demands, plan, receipts, audit history and totals untouched, nothing recreated |
| Self-approval | 403; no change |

### 10.5 Results
| Check | Result |
|---|---|
| `docs/booking-rebate/api-test-booking-rebate.mjs` (database values plus API) | **130 passed, 0 failed** (was 87; 43 new checks for transfer, surrender, first-demand and the 409 cases) |
| `e2e/booking-rebate.spec.ts` | **8 of 8 passed** (3 rebate screen tests plus 5 permission picker tests) |
| All 47 repository API scripts, clean database, fresh run after the last code change | **47 OK, 8,639 checks, 0 failed** (includes security 156 of 156) |
| Full Playwright suite, 16 spec files, clean database | **253 passed, 0 failed** (11.4 min) |
| `tsc --noEmit` | no errors |
| `git diff --check HEAD` | clean |
| `node --check` on the changed screens and test scripts | clean |
Not run: any Neon, Vercel or production step; the migration was applied only to local disposable databases (each twice, no errors).

### 10.6 Migration 146 details
`packages/api/src/db/migrations/146_booking_rebate_approval.sql`, idempotent. Adds to `booking_records`: `company_rebate_status text NOT NULL DEFAULT 'none'`, `approved_rebate_amount numeric(14,2) NOT NULL DEFAULT 0`, `rebate_requested_by`, `rebate_requested_at`, `rebate_decided_by`, `rebate_decided_at`, `rebate_decision_reason`; checks `booking_rebate_status_ck` (none, pending, approved, rejected, legacy) and `booking_rebate_amount_ck` (an amount only when approved). Existing rows with a non-zero rebate box become `legacy` (not applied) on the first run only. No data is deleted or rewritten, no table is created or dropped.

### 10.7 Changed files (rebate work, on top of the earlier uncommitted Set Master and Authentication work)
API: `routes/booking.ts`, `utils/rebate.ts` (new), `db/migrations/146_booking_rebate_approval.sql` (new), `routes/surrender.ts` (one line, the surrender screen net basic price), `routes/reports.ts`, `routes/reports-applicant.ts`, `utils/report-ledger.ts`, `utils/charge-area.ts`, `middleware/processPermission.ts`, `routes/users.ts` (new process `company_rebate`, checker only). Screens: `edit-booking.js`, `booking.js`. Tests: `docs/booking-rebate/api-test-booking-rebate.mjs` (new), `e2e/booking-rebate.spec.ts` (new), `docs/security-setup/api-test-security.mjs` (one expectation, 9 processes became 10). `routes/reports-cash.ts` and the others in `git status` belong to the earlier Set Master and Authentication work.

### 10.8 Remaining risks
1. **Not run on Neon, Vercel or production.** Migration 146 should be tried on a copy of the real data first; any booking that has a rebate typed will show as "legacy" and be priced exactly as before until someone resubmits it.
2. **Surrender screen has two older deviations that I did not change** (not rebate): when a booking has no rate it shows the booking amount as the net basic price, and with a rate it ignores the inaugural discount that the ledger subtracts. The approved rebate is now consistent, but those two should be reviewed separately.
3. **GST (Q12), payment clearing and demand "paid" at approval (Q13), overpayment threshold (Q14)** are unchanged and still open; demand GST is not recalculated when a rebate is approved, so GST and net price follow the existing basis (the same behaviour as the inaugural discount).
4. A rebate cannot be approved or withdrawn once a demand letter has been sent; the user must unraise it first. That is by decision and gives a clear 409.
5. The approver permission is a process right: nobody except super admin has it until it is granted in the Users screen.
6. Dealer adjustment is subtracted by the reports but not by the plan total (older, not touched).
