# QA register, business decisions and A-101 readiness

Branch `fix/qa-v1.1-wave1` (PR 16, draft). Build under test in the V1.1 report: `851f7bf`. The V1.1 report file was not available; this register uses the IDs and cases named in the remediation brief. Rows for QA-036 to QA-049 are partly "report required". Nothing here is deployed, independently verified or formally closed.

Status words used below, in order of strength: **not started**, **partial** (part of the ID is done, the rest is listed), **impl + tested** (code written, automated checks passed locally on throwaway databases), then **deployed**, **independently verified**, **closed**. No row has reached "deployed" or beyond. A green automated suite does not close a defect.

## 1. QA register (IDs named in the brief)

| QA | Topic | Status | What is done / what is left |
|---|---|---|---|
| 001 | Booking price, GST basis | partial | Reports, Applicant File, Pricing card, rebate, receipt form, surrender, booking-edit checks read the plan price, not the unit master. Left: percent add-ons basis, quote and shadow on current area. Needs D1, D2 |
| 002 | Invoice dated 2099 | partial | create already refused it; credit note and reversal dates now refused (future or before the invoice). Left: period lock (D9) |
| 003 | GST setup defaults | partial | readiness check and checklist; no rate is assumed. Left: client configuration (checklist A) |
| 004 | Direct invoice maximum | no change | enforced as the booking value less already invoiced; ROF to confirm (D10) |
| 005 | Discount basis | partial | plan total is the sold price; Applicant File Net Basic now takes the rebate off. Left: D2 |
| 006, 011, 015, 016, 020, 021, 023, 025, 034, 035 | passed in V1.1 | not retested independently | the docs suites that cover them still pass locally; no independent retest was done |
| 007 | Interest "PAID" column | preserved | PAID is still the sum of cleared receipts' `interest_amount` |
| 008, 014, 033, 037, 039 | Allocation | partial | credit split into advance on unraised instalments and surplus; one "raised" rule. derived read-only allocation ledger and reconciliation (implementation complete, tested locally, not deployed). Left: persisted ledger, flag `receipt_allocation_v1` still off, shadow reconciliation on real data, D5 |
| 009 | Commission trigger | partial | one "backed by cleared money" definition for payout, list and reconciliation; receipt lock; dry-run for paid-without-backing. Gate flag still off (D6) |
| 010 | Receipt maker-checker | impl + tested | cleared needs approved, in DB and API. Left: Super Admin policy (D8) |
| 012 | Cancelled booking | partial | API refuses receipt edit, hold, credit allocation, tax invoices on a cancelled booking. Left: screens, pending-receipt refund-or-reject policy (D11) |
| 013, 043 | Report definitions | partial | refund labels removed, dashboard on canonical measures, overdue vs Demand Status relation pinned. Left: merge or label the remaining differences (D12) |
| 017, 019, 044, 045 | Lifecycle sync | partial | reconciliation lists, allotment and stage guards, unit history. Left: D13, D14, DB backstops after a production-copy check |
| 018, 022, 024, 027, 028 | Wave 4 | partial | registration and form numbers can no longer be duplicated by an edit; duplicate finder and plan (no merge); one display-name fragment; Audit Log filter by every login, by system and by e-mail; identity numbers masked in the audit log; cash limit and role-based ID masking built but OFF. Left: D17 and the Wave 4 decisions in WAVE1_STATUS (uniqueness scope, cash limit, who sees what) |
| 026, 038 | Interest | partial | `/payments/overdue` on the engine; no whole-instalment figure; waiver and letters double counts. Left: D15 (weekend rule, receipt date, GST on interest, allocation order) |
| 029 | RERA | partial | readiness check lists the dead RERA tab; no typed-in number. Left: D3 |
| 030, 032, 040, 048 | Schedule, Sh Tester price | partial | tested on the Sh Tester shape; real data not examined. 040 and 048 need the report |
| 031 | GST Report totals | partial | totals from one server query with notes netted; flat 5% estimate removed. Server side verified locally; screens not opened in a browser |
| 036 | Cleared but unapproved receipts | partial | new ones impossible. The 12 historical receipts (Rs 30,54,936) are untouched; dry-run SQL only |
| 041, 047 | Invoice eligibility | partial | cancelled booking refused. 047 needs the report |
| 042 | Receipt approval paths | impl + tested | same as 010 |
| 046, 049 | Statutory masters, invoice data | partial | GSTIN check character, place of supply, HSN/SAC from configuration, readiness check. Left: D1 to D7 of the checklist, software items S1 to S11 |

## 2. Business decisions (nothing was decided here)

| # | Decision | Affects | Today | Options | Who decides | Tests blocked until then |
|---|---|---|---|---|---|---|
| D1 | Which financial years may take a tax invoice; is a closed period locked | invoices, A-101 dates | only the Active year; 2026-27 not set up | any configured year, with or without a period lock | ROF Finance + tax adviser | historical invoice runs |
| D2 | Pricing basis: net basic with or without rebate, discount basis, percent add-on basis (unit price or sold price) | price, schedule, add-ons | plan total is the sold price; add-ons on the unit price | per item | ROF Finance | ZZREG, QACY pricing checks |
| D3 | Where RERA is entered (project or the tab per tower) | letters, receipts | the project; the tab is unused | either | ROF | none |
| D4 | NRI, OCI, PIO GST exemption | all bookings and demands | zero GST for all three, one rule | confirm or change | ROF Finance + tax adviser | none |
| D5 | Surplus credit: allocate, refund or hold; order of allocation (BR-09) | credit, interest | credit stays credit until a checker allocates | per policy | ROF Finance | Zf Tester treatment, A-101 excess |
| D6 | Commission: switch the gate on; checker on payout; commission base; fate of paid-without-backing | commission | gate off; one user pays | on/off, maker-checker | ROF Finance | QA-009 closure |
| D7 | Rounding basis for instalments: billed (269) or contract (272) | A-101 | both computed, neither chosen | one | ROF Finance | A-101 reconciliation |
| D8 | Super Admin and process rights (receipt approval) | maker-checker | unchanged | keep, restrict, or document exceptions | ROF owner | QA-010 independent retest |
| D9 | Period lock for invoices and notes | invoices | none | lock by month or year | ROF Finance | |
| D10 | Direct invoice maximum | invoices | booking value less invoiced | confirm | ROF Finance | |
| D11 | Pending receipts of a cancelled booking (Rs 8,24,220): refund or reject; is the advance copy the same cash | cancelled bookings | checker can cancel or bounce through the API only | refund, reject, reassign | ROF Finance | QA-012 closure |
| D12 | Which report differences are merged (ageing bucket schemes, due today as overdue, Demand Status raw fields) | reports | labelled, not merged | merge or keep | ROF Finance | |
| D13 | Does a booking waiting for payment reserve the unit (hold, allotment) | inventory | blocks a second booking and an allotment, not a broker hold | reserve or not | ROF owner | |
| D14 | Release of a `temp_surrender` unit; approval step for a surrender; stage on booking confirmation | lifecycle | dead end; applied at once; stage moves on allotment | per policy | ROF owner | re-booking after surrender |
| D15 | Interest: weekend or holiday due dates (BR-05), receipt date vs clearing date (BR-06), GST on interest (BR-08), interest first or principal first | interest | none of these | per rule | ROF Finance + tax adviser | A-101 interest and GST on interest |
| D16 | Historical financial years, GST slabs, project GSTIN, rates per charge head | A-101 | blocked until configured | enter them | ROF Finance | all of A-101 |
| D17 | Who may see PAN, Aadhaar, mobile; cash receipt limit (QA-018, 027) | Wave 4 | unchanged | role matrix, limit | ROF | Wave 4 |
| D18 | Link token: single use, bound to address, or authenticated fetch (QA-011) | security | 60 s, one path | per policy | ROF owner | |

The seven statutory decisions D1 to D7 of [STATUTORY_CONFIGURATION_CHECKLIST.md](STATUTORY_CONFIGURATION_CHECKLIST.md) overlap D1, D3, D4, D9 and D15 here.

## 3. A-101 readiness (ROF Alante, historical simulation)

Not ready to enter client data. The historical A-101 data is not in the CRM and its absence is not a defect. Reference values only (not hard-coded anywhere): nine receipts totalling Rs 28,10,787; excess Rs 269 on the billed basis or Rs 272 on the contract basis.

| Needed | State |
|---|---|
| Historical booking and receipt dates accepted by the API | dates are accepted; effective-dated GST is resolved by the date; invoices need a configured and Active financial year (D1) |
| Effective-dated GST, project GSTIN, charge-head taxation | engine is date-driven; configuration is the client's (checklist A, items 1 to 8). `GET /api/gst-configuration/readiness?from=2019-04-01` says what is missing |
| Instalment rounding | per head, to the rupee; billed vs contract basis not chosen (D7) |
| Receipt allocation, excess | allocation ledger not built; flag off; surplus treatment open (D5) |
| Partial-payment interest | engine is interval based and tested on the Dup Mobile shape; weekend rule, receipt-date basis and GST on interest open (D15) |
| Excess payment | credit stays credit; refund or adjust not decided (D5) |

Before the simulation: ROF enters the historical financial years, GST slabs, project GSTIN, RERA, HSN/SAC and rate mappings; the implementation team runs the readiness check for the first date of the client statement and attaches it; ROF answers D1, D5, D7, D15, D16; the simulation runs on a separate database with the authorised test entry plan.

## 4. What is not done (so nobody reads this as "finished")

- Wave 4 (QA-018, 022, 024, 027, 028): first part done (see WAVE1_STATUS, Wave 4 pass); the cash limit and the role-based masking are OFF until ROF decides; duplicate customers are only listed, never merged.
- The authoritative allocation ledger (reversals, bounces, refunds, cancellation adjustments, GST/principal split, one receipt over several instalments) and its shadow reconciliation against production.
- Invoice financial-year series, charge-head taxability on receipt invoices, place of supply for buyers without a GSTIN.
- Statutory software items S1 to S11 in the checklist.
- Screens: no page was opened in a browser; Playwright was not run locally.
- Real data: none of the dry-run SQL files, the reconciliation lists or the readiness check was run against a copy of production.
- Feature flags `agreement_snapshot_v1`, `receipt_allocation_v1`, `commission_requires_cleared_v1`: all off in code; their production values are unknown from here.
- Deployment: nothing deployed. CI on PR 16 decides; release only through the authorised process after the owner says so.
