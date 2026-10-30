# Client CRM vs ours: screen-by-screen gap list

Source of the client side: all 207 menu pages of the client system were loaded read-only and their labels, buttons and filters read (#number = position in `MENU-MAP.md` order). 3 are PDF help files, 1 is a server error on their side (Collection Chart Report), 1 asks for a "security code" (Edit > Installment), and 1 shows a SQL error on their side (Ageing report: "Invalid object name master.dbo.customer_ageing_details"). Only ~12 screens were opened to the bottom (see README).
Source of our side: `index.html` menu (158 entries), `app.js` (67 routes), the routers' endpoint lists, and name searches in web, API and migrations.

**How sure is this?** HAVE = the same screen or feature is in our menu or API. GAP = no trace anywhere in web, API or migrations (a search for the feature's words returned nothing). PARTIAL = something exists but not the same scope. These are code findings; **our app was not run side by side** (the local test database is not running now), so every GAP and PARTIAL must be opened in our app once before work starts.

## 1. Set Master
| Client | Ours | Status |
|---|---|---|
| Area Type (Acres / Sq Ft / Sq Mt / Sq Yrd) | not a master | GAP (small) |
| Currency | currency field exists in bookings and GST | HAVE (no master screen, INR) |
| Profession, Country/State/City | Set Master lists, Locations | HAVE |
| Company Bank (company, bank, A/c, branch, IFSC) | Companies, company bank accounts | HAVE |
| Customer Bank | Banks | HAVE |
| Loan Bank + "project wise approved loan bank" | Loans module | PARTIAL: no per-project approved bank list found |
| Letter Head Format (computer header or own header, height, per project) | Customized Letters | PARTIAL |
| Department, Team Master, Set Manager, Set Team Head, Team Head Detail, Employee Tree, Employee Report | Employees tabs | HAVE (verify Team Head Detail) |
| Employee-wise report (project, employee, dates) | none | GAP |
| Document Type (per project, individual/company, mandatory, stage: on booking, allotment, possession, transfer) / Dispatch | Document Checklist, Dispatch Log | HAVE |
| Password / Security code | change password in Users | PARTIAL: no "security code" |
| Role Category Wise Page Hierarchy | Role Menu Access | HAVE |

## 2. Set Projects
| Client | Ours | Status |
|---|---|---|
| Add Tower/Plot (count) | Add Tower / Plot | HAVE |
| Add Base Floor with naming pattern (1,2,3 / 1st,2nd / First,Second; prefix or suffix) | floors exist; no pattern generator found | PARTIAL |
| Floor Creation: copy base floor, units per floor, **copy floor to other towers** | Add Unit | GAP for copy |
| **Unit Type master**: type per area or fixed, salable/non-salable, super/built-up/carpet/**UDSL**/plot/balcony area, rate, effective rate on (super/carpet/built-up/plot), areas shown on payment file, construction cost, UDSL cost, date, unit of measure, **Unit Type Group** | unit types exist (areas, rate) | PARTIAL: no UDSL, no effective-rate basis, no group, no construction cost |
| Floor wise unit allocation + address order preview + copy address from another floor | Add Unit, Unit Address | PARTIAL |
| Pre-Attach PLC / Other charges to units (by tower) | not found | GAP |
| Address Owner Master | not found | GAP |
| Unit Location | Unit Location Master | HAVE |
| Edit Tower / Floor / Number of plots or villas | Edit Project | HAVE (verify edit floor) |
| Change Unit Area (one unit, with effective date) + Unit Wise Area + report | not found | GAP |
| Payment Plan (type Construction/Down/Flexi/Time, % or fixed, timely discount, discount calculate 100% or 100-discount) | Plans | PARTIAL: **timely discount** not found anywhere |
| Stage Master | stages in plans | HAVE |
| Set Booking Amount (unit type group x unit type x plan) + copy | booking amount in booking/waterfall | PARTIAL |
| Create / Edit Installment, Edit PLC / Other Charge installments | Plans (view and edit), New Plan | HAVE |
| **Customer Wise Timely Discount** | none | GAP |
| Personalise Installment, Edit Personal Installment | plan-personalise tab | HAVE (verify edit) |
| Edit Installment guarded by a security code | none | GAP (design choice, see section 8) |
| Raised Demand Stage view, View Payment Plan | Plans view, Demand Raise | PARTIAL |
| Reminder Days (name, prefix, rank, days) | Reminder Master | HAVE |
| Demand Format Customization (letter types: Welcome, Receipt, Demand, Allotment, Name/Address change, Interest, Area increase, Offer of possession, No dues, Possession, Handover; content top/bottom; variables like @Company@ @Project@) | Customized Letters | HAVE (verify list of letter types) |
| Other Charge master (% / per area / fixed; calculate on basic or after discount; mandatory, parking, inventory based, multiple booking, **alteration**, agreement) | Charge Master | PARTIAL: alteration flag not found |
| PLC master, IFMS master | PLC, charge master | HAVE |
| Add-on charges (master, set, bulk, cancel, waive off) | all 5 screens | HAVE |
| Tax Master (service tax, surcharge, education cess, demand/receipt basis), Tax Information, Tax Report, Completion Certificate Master | pre-GST; not built | GAP (old law, low value, owner to decide) |
| GST: user rights, configuration (FY, HSN/SAC, slab, tax setup, charge mapping, project GSTIN, project RERA no), ITC configuration (project / charge / customer), invoice prefix, **customer wise GST discount**, GST number with effective date | GST Configuration, GST Invoicing | HAVE except customer wise GST discount (GAP) and invoice prefix per FY (PARTIAL) |
| Automated/Manual switches per project: booking authentication (applicant add/delete, journal, unit shifting, receipt type), receipt number prefix and mode, **registration number mode and size**, broker, transfer | "Booking Authentication" is only a report | GAP: no per-project switches found |
| Customer Classification master, Project Configuration Detail | classification used in reports | PARTIAL |
| **Change Rate** (per project), **Change Charges Rate** (PLC / Other / IFMS), Rate Report | Rate Report only | GAP for the two change screens |

## 3. Broker
| Client | Ours | Status |
|---|---|---|
| Application form (company, code, tax block with GST state and effective date, TAN, PAN, service tax, POA date, sales force, manager, officer, contact, bank) | Broker Application Form | HAVE (verify each field) |
| View/Edit list, Project mapping, **Sub Broker mapping (broker manager)**, Address label | list, projects, sub-brokers API | PARTIAL: no sub-broker or address-label screen in menu |
| Broker reports: Summary, Sold-Unit, Broker wise customer detail, Broker wise booking, **Broker Hierarchy** | Sold-Unit only | GAP x4 |

## 4. Application (the sale flow)
| Client | Ours | Status |
|---|---|---|
| Booking Form | Booking Form | HAVE; but **Rate List**, Alteration/Scheme, IFMS and Physical-application flag are not in ours (README) |
| Shift Units + report | Unit Shifting + report | HAVE |
| Booking Status, **Editing Status** (edit needs approval: pending / unapproved / approved / rejected) | Edit Booking Form, booking approval | PARTIAL: no edit-approval workflow found |
| Head Wise Cost | none in menu | PARTIAL |
| Applicant Addition/Deletion, Edit Customer Address | booking, Edit Customer Address | HAVE |
| Customer Register | Customer Register | HAVE |
| Allotment Form, Letter, Cancellation, Information (address choice, e-stamp no, administrative charge, escalation, penalty, possession by period or date, grace days), RERA Agreement, Conveyance Deed Date | Allotment tabs, Reports | PARTIAL: verify Allotment Information fields |
| Allotment & Agreement Status, Pending Allotment Ageing, Allotment Cancel Report | allotment dashboard | PARTIAL |
| Receipt Generation (8 modes), Receipt Print (summary/detail, issued/unissued, approval) | Receipts, Print | HAVE |
| Journal Entry, Debit/Credit/Refund Note, Journal Report, Reversal, Cancel Receipt report | Receipts tabs | HAVE (verify Journal Report with project from/to) |
| TDS Challan report, Assign Receipt Challan, Upload TDS Challan | Receipts tabs | HAVE |
| Demand Raise (stage, tower, customer, installment, unit/stage, unraise) | 6 views | HAVE |
| Print Welcome (welcome call with remark), Print Demand (many filters), Installment Wise Demand Status, Print Demand Manually | Documents, Demand Status | HAVE (verify filters: loan type, communication, physical form, due amount) |
| **Demand Email Notification** (send / un-send) | none | GAP (no sender is connected anywhere) |
| ATS (agreement date), TPA/PTM, Applicant Ledger, User Define Letters, Address Labels, Conveyance Deed | Documents tabs | HAVE |
| GST Invoicing: set opening, ITC for customer, generate (tower/customer wise), manual, reversal, cancel, against advance, credit/debit, pending | GST Invoicing tabs | HAVE; **Set Customer Opening** GAP |
| Invoice reports: details, opening balance, invoice receipts, month wise, **HSN and charge wise** | GST report | PARTIAL |
| Surrender / Cancellation: application, report (NOC bank/broker, temp/final), restore | Surrender screens | HAVE |

### 4b. Receipt modes, field by field (their form opened and each tab clicked, nothing saved)
Every mode has Amount, Interest, GST Interest (5%), Paid, S.Tax, CGST, SGST (read-only, calculated) and TDS%.
| Mode | Their own fields | Ours | Status |
|---|---|---|---|
| Cheque | Cheque No, Date, Bank, Branch, Employee | same | HAVE |
| Draft | Draft No, Draft Date, Bank, Branch, Employee | same | HAVE |
| Online | Ref No, Date, Bank, Employee | Transaction Ref, Date, Bank, Employee | HAVE |
| Cash | Cash Date, Employee | Employee, Remarks | HAVE |
| Adjust | Employee, **Adjustment Type** (pick list) | Employee, Remarks | GAP: no adjustment type list |
| Dealer Adjustment | Employee | Employee, Remarks | HAVE |
| TDS Challan | Challan No, Date, **Challan Document (file), Certificate No, Certificate Document (file)**, Bank, Branch, Employee | Challan No, BSR Code, Deposit Date | PARTIAL: no certificate no or the two file uploads |
| Card | Card No, Date, Bank, Branch, Employee | Terminal ID, Approval Code, Employee | PARTIAL: different fields |
The "Self / Bank Loan" switch is greyed out for a customer whose loan information is "Self".

## 5. Reports
| Client | Ours | Status |
|---|---|---|
| Project Details, Unit Status (project, tower, unit type), Inventory Summary, Availability Sheet, Unit Wise PLC, Sold/Available Area, Unit Cost | all | HAVE |
| Applicant Payment File, Master Report (**template builder: Add/Edit Template**), Search Customer | payment-file, custom-report API | PARTIAL for template builder |
| **Applicant History, Applicant Birthday/Marriage, Customer Detail (print by choice of columns), Broker Corporate Report (customer classification), Customers Names, Increase/Decrease Area report** | all-applicants only | GAP x5 |
| Collection: Project wise, Company wise, **Collection Report (project, tower, unit type, broker, customer, employee; yearly / monthly / date wise)**, Customer Wise, Customer Balance, Receipt Wise (receipt date or clear/bounce date), Year-Month | project, receipt-wise, year-month, balance | PARTIAL: company wise and the tower/unit type/broker/employee views are GAP |
| Charges wise collection (vertical with/without interest, horizontal by customer or receipt), Tower vs Unit Type, **Collection Against Dues**, Collection Chart (broken on their side) | none | GAP x3 |
| Dues: customer wise, due report (project/tower/unit type/plan/broker), date wise, stage wise (tower, plan), percentage wise (3 reports), ageing (4 views + installment wise), month wise, forecasting, customer dues detail | ageing, dues, forecasting tabs | HAVE (verify "with tax / without tax" switch) |
| Charge detail: Other Charge, **Parking/Power backup, IFMS, PLC, Extra Charge, Customer PLC, Customer Alteration**, Extra Addon | Other Charge, Extra Addon | PARTIAL: 6 reports GAP |
| Parking: type master, inventory master, assign, inventory report | Parking tabs | HAVE |
| Header: Task Assignment, Reminder | Tasks and Reminders | HAVE |

## 6. Counts
Not counted: the tables above group screens, and a total would be a guess until each row is opened in our app.

## 7. Things we have that they do not
CRM (leads, campaigns, automation, WhatsApp / Instagram / Facebook inboxes, email templates), Analytics, Bank Reconciliation, Milestones, Interest suite (scheduler, waiver, grace), Transfers module, Inventory Hold / Waitlist, TDS and broker tax masters, audit log, role-based permissions with project scope, dashboard on India time.

## 8. Decisions that belong to the owner (not copied by default)
1. Legacy **Service Tax screens** (tax master, cess, surcharge, completion certificate): old law, only copy if the CA still needs them.
2. The **security code** on Edit Installment: we already audit every edit; a code gate is an extra step.
3. **Automatic / manual numbering switches** per project: copy, but as one "Project numbering" card instead of 5 menus.
4. **Demand email notification**: needs a real sender first.

## 9. Their problems we should not repeat
Collection Chart report and the ageing report crash with server errors; "Edit Installment" asks for a code before showing anything; filters on 13 projects but a user is given only 3; every list needs a FETCH click; masters hold duplicates (see README).

## 10. Added after the deeper pass (see `captured/` parts 3 to 8)
- **Customer file Lock / Unlock** (bulk, from Customer Register, with counts): not in ours (searched routes, migrations and baseline schema).
- **Track** button (change history) on every master screen, and a **Chart Report** shortcut: ours has an audit log but no per-screen Track.
- Receipt: **Adjustment Type** list on Adjust, **certificate no + challan and certificate documents** on TDS Challan, Card No (see 4b).
- Letters: variable **@CustomerWithCoApp@** (customer with co-applicant) is not in ours; everything else in the letter model exists.
- Unit Cost report lists project-specific charges (Ad, Balcony, Restoration, Scooter Parking) as columns; ours has only fixed columns (verify).
- Unit Wise Area has 12 area fields (3 balconies, basement, stilt, common area); ours has super, carpet and balcony only.
- Booking: the **PREVIEW** step before "Save and Proceed", and a 3-step booking approval trail (entered, checked, approved) with who and when for each step.
- Pricing basis per project (rate on carpet area for one project, on super area for another): check that ours lets a project choose.
- **Bug found and fixed in ours** while checking their Applicant Payment File: interest was charged for the days between two early payments (8,221 instead of 3,111 on their example). Fixed in `payment-waterfall.ts`; check script `check-interest-parity.mts`.

## 11. Added: Broker, Parking and report columns (see `captured/14-broker-parking-reports-rest.md`)
- Broker application: GSTIN, GST state, GST effective date, service tax no, deposit amount, pin code, licence no and bank block are not on our application form (bank is on the broker record).
- Broker reports: Broker Summary by unit type, the per-broker customer list with BSP, discount per sq ft, paid BSP % and paid unit cost %, Broker Wise Booking, Broker Hierarchy: not in ours.
- Parking: types are per project in theirs (global in ours); stock is a count per type (ours one row per slot); slot number pattern, Possession Assign step and the printable parking allotment letter to be checked.
- Inventory Summary with Total / Non Salable / Salable / Sold / Unsold; Installment Wise Demand Status with Demand Status; Other Charge report one row per customer and charge: to be compared with our reports.
