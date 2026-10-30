# Their project entered into ours: what fits and what does not
Project: **ROF GALLERIA@78** (structure only; no customer data was copied). Data: `captured/09-project-galleria78.md`. Script: `import-galleria78.mjs` (local API only; run again on a fresh database, it makes one project and a few global rows).
Method: the script logged in to **our local demo** (http://localhost:3020, test admin) and created each item through our own API, then the Booking Form was opened in the browser, the new project chosen, a unit and a plan picked, and every field compared with the client's Booking Form list (`captured/01`, `README.md`). Result of the script: 18 rows fit, 26 rows do not, 2 rows are "not decided by the script" (CHK).
The demo database now holds the imported project (name has a 4-letter suffix) so it can be opened: Set Projects, Unit Status, Payment Plans, Booking Form.

## What entered cleanly (read back: 32 units, 10 plans)
Company, project card (name, location, land area, total units, company), tower "Ground", floor "Ground Floor", unit types 510 and 550 Sq. Ft., all 32 units G-01 to G-32 (type, super area, carpet area, base price), all 10 payment plans with their installments and percentages (each totals 100), project interest 15% from 01 Jan 2022 (accounts login only), 6 of 7 documents. In the Booking Form the project shows its tower, 32 units with area, and the 10 plans.

## What did NOT fit (real gaps, each shown by a failed save or a missing field)
1. **Project card**: no project type (Commercial / Residential / Plotting / Group Housing / SCO); land area has no unit (they store 2.45 Acres, 5.38 Sq. Ft., 201 Acres, 2819 Sq. Yrd.); **RERA no and TCP licence are required** but the client's project has neither on its card (RERA is per tower in GST setup).
2. **Tower**: no New Name, Prefix for unit address, Sort Order, Completion Certificate date.
3. **Unit type** (biggest gap): only name, description, carpet, balcony, rate. Missing: super area, built-up, UDSL, plot area + unit, **group** ("Shop"), Per Area / In Fix, Salable / Non-salable, **rate effective on Super / Carpet / Built-up / Plot**, areas shown on the payment file, construction cost, UDSL cost, unit of measurement, rate date, unit map. Also **carpet area accepts only 2 decimals**, but their data has 475.735 (3 decimals) and our own unit table accepts 4: the unit type for the 950 Sq. Ft. shop was refused.
4. **Reminder master is one global list**: the route saves only name, days and prefix (no project, no rank), so "Reminder 1 = 10 days, Reminder 2 = 20 days" for this project cannot be kept per project, and two projects cannot differ. (The table has project_id and rank columns; the route does not write them.)
5. **Document master**: a document name is unique across all projects and across Individual / Company. They have "Physical Application Form" once for Individual and once for Company (and the same names in every project). Ours refused the second one.
6. **Interest**: only rate and start date. Missing Simple / Compound, compound frequency, "Calculated On: Receipt Date Wise".
7. **Per-project switches** (none found): receipt number prefix + mode per receipt type, registration number mode + size, booking authentication, transfer authentication.
8. **Payment plan screen**: not decided by the script (open the screen). The API took name, installment name, type (installment / booking / possession / plc / other_charge), %, flat amount, offset days: no plan type (Construction / Down payment / Flexi / Time), no timely discount, no "100% or 100-discount" switch, no description.

## Booking Form, field against field (ours opened at /#/booking)
Present in both: applicant kind (Individual / Multiple / Company), project, tower, floor, unit, booking date, registration no, form no, payment plan, basic price, GSTIN, company discount, broker (Broker / Direct, main broker), broker discount, applicant name with S/o, DOB, anniversary, gender, marital status, profession, PAN, Aadhaar, passport, nationality (Resident / PIO / NRI / OCI), 2 emails, designation, children, company, power of attorney, photo, present / office / permanent address with "same as" ticks, mailing address, preferred communication (5 modes), 3rd to 5th applicant, PLC and other charges, documents table with bar code / storage / scan reference / attach, sales employee, nominee, finance bank, PREVIEW / SAVE AND PROCEED / CLOSE.
Differences found:
- **Unit Type is a fixed BHK list** (Studio, 1BHK, 2BHK, 3BHK) instead of the project's own unit types ("510 Sq. Ft.", "Shop"). A shop or plot project cannot choose its type. (The unit's own type "Shop" was not shown in the form.)
- **Customer Classification is fixed** (EWS / LIG / MIG); theirs is a per-project master.
- **Rate List** pick list: missing.
- **Title list**: ours Dr., M/s, Mr., Mrs., Ms.; theirs adds Major, Colonel, Brig., Captain, Advocate, LT.COL., Mohd, Group Captain.
- **Relation** next to the name: ours only "S/O"; theirs S/o, W/o, D/o, C/o, A/s.
- **State list**: ours has 13 states (Haryana, Delhi, UP, Rajasthan, Punjab, Maharashtra, Karnataka, Tamil Nadu, Gujarat, MP, West Bengal, Telangana, Himachal, Uttarakhand); theirs has all 37 including Bihar, Odisha, Kerala, Goa, Jharkhand, Assam. A customer from Bihar cannot be entered.
- **Profession list** differs (ours Business, Government Service, Retired, Salaried, Self Employed; theirs Business Man, Doctor, Engineer, Sports Man ...): both are masters; theirs is editable.
- **Other costs**: ours PLC and Other Charges; theirs also Alteration/Scheme, IFMS/Fire fighting, Additional and Extra charge (shown when the project has them).
- **Finance**: ours Bank, Loan amount, Sanction date; theirs Bank, Branch, Contact person, Contact no, File no, **File date***, **Employee***, Sanctioned amount, Remarks.
- **Area and rate**: after choosing unit G-02 our form shows "Carpet Area 510.000" (that is the unit's **super** area; its carpet area is 255) and "Basic Price 10,000": the server prices a unit as rate x **carpet** area, so 5,000 per super sq ft became 10,000 per carpet sq ft. The total (25.5 lakh) is right, but the label and the rate are not what the client's staff expect. The client fixes this with "Effective Rate on" per unit type (gap 3).
- Ours also has things they lack: Communication address, Address line 2, Source of enquiry, Reference by, nominee relation / DOB / share, broker commission, "Rebate per sq ft" splits.

## Order to fix (my suggestion)
1. Unit type: add the missing fields incl. effective-rate basis and 3 to 4 decimal areas; make the booking form use the project's unit types and show area and rate on the same basis.
2. Reminder master per project with rank (route fix: write project_id and rank).
3. Document master uniqueness per project and "document from".
4. Project card: type, area unit, optional RERA / TCP.
5. Booking form: titles, relation, full state list, finance fields, extra cost heads, Rate List.
6. Interest type / frequency / basis; per-project switches; tower extras.

## End to end: a customer on their project, against their real file (`e2e-payment-file-parity.mjs`)
Their file (captured/05): unit 510 sq ft, rate 11,500 on super area, plan 9 / 10 / 81, GST 5%, installments due 23 Jan and 22 Feb 2023, three cleared receipts. The script set GST for the imported project, made a synthetic customer, booked a free 510 sq ft unit at 23,000 per **carpet** sq ft (ours prices on carpet area: 255 x 23,000 = 58,65,000), tried to raise the two demands, entered the three receipts, cleared them, and read our own Applicant File.
**Matches to the rupee**: net basic 58,65,000; CGST 1,46,625 and SGST 1,46,625; total with tax 61,58,250; demands 5,27,850 / 5,86,500 / 47,50,650; receipts counted 15,24,921.
**Differences** (script says 7 passed, 3 failed):
1. **Interest: ours 20,119.78, theirs 3,111.** Two causes. (a) Ours calculates interest on the whole installment **including GST** (5,54,242 for installment 1; the code comment calls this "Option B"), theirs on the **basic amount only** (5,27,850) and then adds 5% GST on the interest. (b) In ours the 3,54,853 paid on 17 Feb is applied to installment 1 and shown 25 days late, while in theirs the first receipt (23 Jan) clears installment 1 first and the 17 Feb payment is early for installment 2 (delay -5, no interest); ours seems to put the booking-step receipt behind the later ones. (a) is a business rule to decide with the owner; (b) looks like a real ordering fault to investigate. The earlier one-line fix (early payments do not start the clock) is already in: with their inputs the helper gives 3,111.
2. **The "Interest" box at the top of our Applicant File shows 0.00 while our interest table shows 20,119.78** (two numbers for one thing inside the same file).
3. **Balance**: theirs = total with tax + interest - receipts (46,36,441); ours leaves interest out of the balance (46,33,329).
Also found on the way: our API **refuses a demand dated in the past** ("The due date cannot be in the past"), so a back-dated or legacy demand (their data has 2023 demands) cannot be created except through import; **receipts take whole rupees only** (theirs has paise, 4,94,317.50); a receipt entered with the booking shows its date one day earlier in a JSON date (display of a DATE column, known).
