# Regression coverage ledger

Built from the running app (sidebar crawl in the real browser, local stack). One row per menu item; later stages add the deeper checks.

Stages
- S1 Opens: the screen loads in the real browser, no JavaScript error, no `undefined`, `NaN`, `Infinity` or `[object Object]` in the text (hostile test data excluded, see notes).
- S2 Fields: every field tried with normal and hostile values.
- S3 Numbers: every figure checked against the reference model in `docs/regression/reference/`.
- S4 Cross screen: the same figure on every screen that shows it.

Status key: ok = done and clean, todo = not yet done in this run.

## S1 result: 164 of 164 menu items opened, 0 JavaScript errors, 0 failed navigations

Notes on 4 flags (not defects): Edit Project, Reminder Master, Demand Status and Add Extra Addon Charge showed the words `undefined`, `NaN` or `Infinity`. All four come from hostile rows that earlier tests stored on purpose as names (a project licence "undefined", a reminder named "undefined", a unit type "NaN"). They are data, not rendering bugs.

| # | Menu item | Route | Fields | Buttons | S1 | S2 | S3 | S4 |
|---|-----------|-------|--------|---------|----|----|----|----|
| 0 | Home | /dashboard | 0 | 81 | ok | todo | todo | todo |
| 1 | Locations | /set-master locations | 3 | 42 | ok | todo | - | - |
| 2 | Salutation | /set-master lists | 2 | 56 | ok | todo | - | - |
| 3 | Profession | /set-master lists | 2 | 56 | ok | todo | - | - |
| 4 | Nationality | /set-master lists | 2 | 54 | ok | todo | - | - |
| 5 | Source of Enquiry | /set-master lists | 3 | 54 | ok | todo | - | - |
| 6 | Banks | /set-master banks | 5 | 54 | ok | todo | - | - |
| 7 | Companies | /set-master companies | 23 | 28 | ok | todo | - | - |
| 8 | Department | /employees departments | 1 | 51 | ok | todo | - | - |
| 9 | Employee Information | /employees employees | 3 | 68 | ok | todo | - | - |
| 10 | Team Master | /employees teams | 1 | 23 | ok | todo | - | - |
| 11 | Employee Tree | /employees tree | 0 | 22 | ok | todo | - | - |
| 12 | Employee Report | /employees report | 0 | 22 | ok | todo | - | - |
| 13 | Document Checklist | /set-master checklist | 2 | 40 | ok | todo | - | - |
| 14 | Document Dispatch Log | /set-master dispatch | 8 | 25 | ok | todo | - | - |
| 15 | Customized Letters | /custom-letters | 2 | 285 | ok | todo | todo | todo |
| 16 | Logins and Permissions | /users permissions | 3 | 402 | ok | todo | - | - |
| 17 | Roles | /users roles | 0 | 28 | ok | todo | - | - |
| 18 | Role Menu Access | /users role-menu | 376 | 33 | ok | todo | - | - |
| 19 | Audit Log | /users audit | 5 | 23 | ok | todo | - | - |
| 20 | New Project | /set-projects new-project | 186 | 74 | ok | todo | todo | todo |
| 21 | Edit Project | /set-projects edit-project | 186 | 891 | ok | todo | todo | todo |
| 22 | Plans (view and edit) | /payment-plans | 1 | 18 | ok | todo | todo | todo |
| 23 | New Plan | /payment-plans new | 7 | 21 | ok | todo | todo | todo |
| 24 | Add Tower / Plot | /set-projects add-tower | 192 | 77 | ok | todo | - | - |
| 25 | Add Unit | /set-projects add-unit | 192 | 77 | ok | todo | todo | todo |
| 26 | Unit Address | /set-projects unit-address | 192 | 77 | ok | todo | - | - |
| 27 | Unit Location Master | /set-projects unit-location | 192 | 77 | ok | todo | - | - |
| 28 | Reminder Master | /set-projects reminder-master | 192 | 195 | ok | todo | - | - |
| 29 | Other Charge | /charge-master | 7 | 21 | ok | todo | todo | todo |
| 30 | Preferred Location Charges | /plc-charges | 8 | 21 | ok | todo | todo | todo |
| 31 | Extra Add On Charge Master | /addon-charge-master | 30 | 22 | ok | todo | todo | todo |
| 32 | Set Extra Add On Charge | /set-addon-charge | 16 | 26 | ok | todo | todo | todo |
| 33 | Add On on Bulk Customer | /bulk-addon-charge | 15 | 22 | ok | todo | todo | todo |
| 34 | Cancel Extra Add On | /cancel-addon-charge | 12 | 22 | ok | todo | todo | todo |
| 35 | Waiveoff Add On | /waiveoff-addon-charge | 12 | 22 | ok | todo | todo | todo |
| 36 | GST Configuration | /gst-configuration | 9 | 31 | ok | todo | todo | todo |
| 37 | Rate Report | /set-projects rate-report | 193 | 77 | ok | todo | todo | todo |
| 38 | Broker Application Form | /brokers form | 32 | 32 | ok | todo | - | - |
| 39 | Broker List | /brokers list | 32 | 74 | ok | todo | - | - |
| 40 | Commission Setup | /brokers commission | 32 | 81 | ok | todo | todo | todo |
| 41 | Broker Setup (Tax Masters) | /broker-setup | 6 | 34 | ok | todo | todo | - |
| 42 | Broker Sold-Unit Report | /brokers sold-unit-report | 32 | 74 | ok | todo | todo | todo |
| 43 | Inventory Governance (hold) | /inventory-hold | 14 | 24 | ok | todo | - | todo |
| 44 | Booking Form | /booking | 220 | 84 | ok | todo | todo | todo |
| 45 | Edit Booking Form | /edit-booking | 10 | 21 | ok | todo | todo | todo |
| 46 | Customer Register | /consumers | 7 | 37 | ok | todo | - | todo |
| 47 | Allotment Form | /allotment | 44 | 139 | ok | todo | - | todo |
| 48 | Allotment Letter | /allotment letter | 44 | 139 | ok | todo | - | todo |
| 49 | Unit Shifting Process | /allotment shifting | 44 | 139 | ok | todo | todo | todo |
| 50 | Unit Shifting Report | /allotment shifting-report | 44 | 139 | ok | todo | - | todo |
| 51 | Cancel Allotment | /allotment cancel | 44 | 239 | ok | todo | todo | todo |
| 52 | Waitlist | /allotment waitlist | 44 | 139 | ok | todo | - | - |
| 53 | Edit Customer Address | /allotment edit-address | 44 | 139 | ok | todo | - | todo |
| 54 | Receipt Generation | /receipts | 76 | 66 | ok | todo | todo | todo |
| 55 | Receipt Print | /receipts print | 76 | 66 | ok | todo | todo | todo |
| 56 | Journal Entry | /receipts journal | 76 | 66 | ok | todo | todo | todo |
| 57 | Edit Receipt | /receipts edit | 76 | 116 | ok | todo | todo | todo |
| 58 | Cancel Receipt | /receipts cancel | 76 | 115 | ok | todo | todo | todo |
| 59 | TDS Challan Report | /receipts tds-report | 76 | 120 | ok | todo | todo | todo |
| 60 | Assign Receipt Challan | /receipts assign-tds | 76 | 66 | ok | todo | todo | - |
| 61 | Upload TDS Challan | /receipts upload-tds | 76 | 66 | ok | todo | - | - |
| 62-66 | Demand Raise (stage, tower, customer, installment, unit/stage) | /demand-raise | 9-16 | 35 | ok | todo | todo | todo |
| 67 | Demand Unraise | /demand-raise unraise | 14 | 35 | ok | todo | todo | todo |
| 68-69 | Print Welcome, Demand Printing | /documents | 62 | 69 | ok | todo | todo | todo |
| 70 | Demand Status | /demand-status | 16 | 32 | ok | todo | todo | todo |
| 71-76 | ATS, TPA, Applicant Ledger, User Letters, Address Labels, Conveyance Deed | /documents | 62 | 69 | ok | todo | todo | todo |
| 77-82 | Interest Scheduler, Interest Master, Installment Interest, Particular Date, Delete, Manual | /interest-*, /customer-wise-interest | 8-12 | 21-23 | ok | todo | todo | todo |
| 83-85 | Interest Waive Off Letter, Customer Waiver Report, Interest Waive Off | /interest-waiver | 7-11 | 21 | ok | todo | todo | todo |
| 86 | Grace Period | /grace-period | 10 | 21 | ok | todo | todo | - |
| 87 | Month Wise Dues Report | /reports | 11 | 26 | ok | todo | todo | todo |
| 88 | Calling List | /calling | 17 | 21 | ok | todo | - | - |
| 89 | Communication Setup | /collection-setup | 15 | 21 | ok | todo | - | - |
| 90 | Loan Process | /loans | 11 | 21 | ok | todo | todo | todo |
| 91-95 | Transfer Fee, Transfer, Report, Detail, Date Edit | /transfer* | 9-16 | 21-23 | ok | todo | todo | todo |
| 96 | Registry Report | /registry | 9 | 21 | ok | todo | todo | todo |
| 97-106 | GST Invoicing (setup, generation, manual, reversal, cancel, advance, credit/debit, pending, report, rights) | /gst-invoicing | 246 | 46-316 | ok | todo | todo | todo |
| 107-109 | Surrender, Surrender Report, Surrender Restore | /surrender* | 9-10 | 24-26 | ok | todo | todo | todo |
| 110-119 | Project Details, Project/Tower/Unit-type wise, Inventory Summary, Availability, Unit Wise PLC, Sold/Avail Area, Unit Cost, Inventory Details | /unit-status, /reports | 7-14 | 21-34 | ok | todo | todo | todo |
| 120-141 | All Applicants ... Extra Add-on Charge reports (22 reports) | /reports | 10-28 | 25-31 | ok | todo | todo | todo |
| 142 | Edits | /reports/edits | 11 | 22 | ok | todo | - | - |
| 143 | Analytics Dashboard | /analytics | 9 | 24 | ok | todo | todo | todo |
| 144-147 | Parking (type master, inventory, assign, report) | /parking | 27 | 32 | ok | todo | todo | - |
| 148 | Sales Pipeline / Leads | /leads | 470 | 24 | ok | todo | - | - |
| 149 | Tasks and Reminders | /tasks | 11 | 28 | ok | todo | - | - |
| 150 | Campaign Marketing | /campaigns | 10 | 27 | ok | todo | - | - |
| 151 | Automation and Workflows | /automation | 25 | 53 | ok | todo | - | - |
| 152 | Email Templates | /email-templates | 13 | 25 | ok | todo | - | - |
| 153-155 | WhatsApp, Instagram, Facebook inbox | /*-inbox | 8 | 21-22 | ok | todo | - | - |
| 156 | Communications and FAQ | /communications | 10 | 29 | ok | todo | - | - |
| 157 | Import | /import | 9 | 26 | ok | todo | - | - |
| 158 | Folders | /customer-folders | 9 | 21 | ok | todo | - | - |
| 159 | Unit Docs | /unit-documents | 9 | 20 | ok | todo | - | - |
| 160 | Help | /help | 6 | 23 | ok | todo | - | - |
| 161-163 | Demands, Reports, Manage (parking) | /demands, /reports, /parking | 14-27 | 26-426 | ok | todo | todo | todo |

## Findings so far in this ledger
None new. The earlier money defects found and fixed in this session are listed in the final report (advance part counted twice, booking-type first row demand, surrender totals, Agreement Value, null byte in letter templates).

## S2 sweep (hostile input on every screen), local stack, real browser
For 163 of the 164 menu items (all except Home) the sweep typed hostile values into every free input (script tag, SQL text, minus one, a 20 digit number, a tiny decimal, 1e309, emoji and Hindi, 400 characters, a null character, spaces only, date in year 2999) and pressed every non destructive button (save, submit, add, create, generate, fetch, search, update, apply, show, calculate, preview, export, raise, print). Delete, cancel, remove, surrender, unraise, reverse and bulk buttons were left alone on purpose.

Result: 0 responses with status 500 or above, 0 JavaScript errors, 0 broken navigations. The words `NaN`, `Infinity`, `undefined` showed only as stored hostile names inside drop downs (test data, not rendering errors).

Not yet done (honest list):
- S2 for the destructive buttons (delete, cancel, remove, surrender, unraise, reverse, bulk).
- S2 that checks the saved value reads back the same on the next screen (the sweep proves no crash, not that the value is kept).
- Role by role permission pass (only super admin used here).
- Phone width and dark mode pass on every screen.
- S3 and S4 for the money chain were run on deals made through the UI and API on the live test project and with `docs/owner-flow-audit/flow-audit.mjs` (3 deals, 99 checks, all pass). Not yet run for: interest and waiver, TDS, GST invoicing, loans, transfer and fee, parking charges, broker commission, add-on charges, reports totals one by one.

## Reference model notes
`reference/deal-model.mjs` is the independent calculator. One difference found against the CRM, judged a model assumption and not a CRM defect: the CRM rounds GST per charge line (basic and balcony separately), the model first rounded per instalment. On a file with a balcony charge this is up to about Rs 12 in total tax (live test customer: CRM 27,070, model 27,058). Billing each charge as its own line is how GST invoices are made, so the CRM is kept as is.

## Run 2 additions (new prompt: every field, every button)
- Phone width 375: all 164 menu items, 0 with horizontal page overflow.
- Role matrix (`role-matrix.mjs`, plus a pass over 32 real write endpoints for 5 roles): read only viewer got 403 on every write; support agent and sales executive blocked where expected; no token gives 401. Writes that need a maker or checker process right (new applicant, receipt, interest waiver) refuse a role that was not given that process, as designed.
- Decision for the owner (not changed): a project manager can create a global GST slab (POST /gst-configuration/gst-slabs, 201), because GST configuration uses the master data permission, while accounts and finance cannot (403). A slab changes tax for every project. Suggest restricting it to super admin and accounts and finance.
- Save and read back (`readback.mjs`): company, project, project settings, unit, applicant and applicant edit, 36 of 36 fields came back identical. The API silently ignores field names it does not know (a company sent with `pan` instead of `pan_no` is created without the PAN); the screens send the right names.
- Interest (`interest-deal.mjs`, model `lateInterest`): instalment of 20,00,000 at 12% paid in two late parts. CRM 15,616.43, model 15,616.44 (the CRM rounds per row, 1 paisa). Interest runs on the unpaid balance per day: confirmed. First reading of my model was wrong (it charged each payment separately); the model is fixed.
- Destructive button, cancel receipt: receipt cancelled, demand reverted to demanded, interest back to 16,438.36 (model 16,438.36), receipt form Paid 20,00,000 and Balance 30,00,000 (model the same).

Still not done: destructive buttons on the other screens through the UI, light mode, GST invoicing, TDS, loans, transfer and its fee, broker commission, add-on charge billing, per report totals.

## Run 3 (decisions taken by the tester, nothing left open)
Decisions and fixes
- GST configuration (slabs, tax setup, mapping, HSN, financial years) can now be changed only by super admin and accounts and finance, because a change alters the tax of every project. Project manager, sales executive, support agent and the read only viewer get 403. Tests updated.
- Company create now refuses a field name the API does not know (400, "Unknown field: pan"), so a mistyped name cannot be accepted and silently dropped. The company form sends only known names.
- Add-on charges (decision: left as designed): a charge that sits in no plan row is on the customer but on no demand. An older test states this on purpose ("in no plan row it is on the customer but not on any demand"), so it was not changed. Side effect to know: the customer file counts such a charge in what is owed, the receipt form and the registry check do not.

Module checks, `modules-deal.mjs` on a fresh database (72 checks, 0 failed)
- Broker commission: percent (2.5% of basic) and flat, TDS 5% and GST 18% at payout, net = amount + GST - TDS, a second payout refused.
- Transfer: seller paid, due and balance snapshot equal the model; the buyer inherits the same balance; the seller has no demands left; the unit moves; the same transfer number and seller equal to buyer are refused.
- Loans: above 120% of the price, same loan twice, future sanction date and TPA before sanction all refused; a normal loan saved.
- Add-on charges: flat and per sqft (33.5 x 520), 9% and 5% GST, the demands carry exactly the charges with GST; cancelling one removes exactly its share; zero refused.
- GST invoice: five base and rate combinations (intrastate and interstate, 5.5%, 28%, 1 rupee, 999,999.99) all match the model; IGST with CGST, a future date, zero or negative base, a rate above 28 all refused.
- TDS challan: part assignment, the same challan twice, more than what is left, TDS above the receipt amount, a release and re-use, future date, zero amount, 6 digit BSR.
- Report totals against my own sums from the database: Due Report (demanded 10,463,962, paid 783,360, balance 9,680,602), Project Wise Collection (783,360), Customer Balance and Stage Wise Dues match their own definitions (raised demands only). The Pending and Clear blocks of the dues screens are received money, not dues; both happened to be 783,360 in that run.

Still not done in this ledger: light mode, destructive buttons through the UI other than cancel receipt (surrender, hold and unhold, cancel booking and cancel allotment were done through the UI and API in earlier runs).
