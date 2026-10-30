# Client CRM audit (4QT "Real Estate Manager") vs our ROF CRM

Date: 2026-10-29. Method: opened the client system in the owner's logged-in Chrome, read only (no save, no edit, no send). Screenshots are in `screens/` and are **not in git** (they show real customer names, see `.gitignore`). Full menu: `MENU-MAP.md`.

## What was really opened and read
| Screen | How | Result |
|---|---|---|
| Home dashboard | opened | 5 panels: Pending Cheques, Demand Status, Daily Status, Parking Detail, Forthcoming Due. We already have all 5 (module "dashboard") |
| Booking Form (`RegistrationForm_version.aspx`) | opened, full text + screenshot | one page, ~213 fields, field list below |
| Allotment, Receipt Generation, Demand Raise (customer wise), Demand Status, Applicant Payment File, Surrender Applicant | opened, screenshot + text | all use "pick filters, press FETCH, then act on a row" |
| Receipt form (`PaymentReceiptV1.aspx`) | opened for one customer, not saved | see receipt section |
| Payment Plan Master, Add Tower/Plot, Create Installment, Broker Application | opened | see setup section |
| Other ~195 menu links | page loaded (HTTP 200, 206 of 207), field count only | **not looked at one by one**, so nothing below claims anything about them |

Not done yet: no dummy project was created in the client CRM (allowed by owner, not needed so far); the Demand Raise, Allotment and Surrender result screens (after FETCH) were not opened.

## Their flow (what it feels like to use)
1. Set up a project through ~15 separate menus: Tower/Plot count -> Base Floor -> Floor Creation -> Unit Type -> Floor-wise Unit Allocation -> pre-attach PLC / other charges -> Payment Plan -> Stage -> Installments.
2. Broker application (company, tax, contact, bank blocks).
3. Booking Form: one long page.
4. Allotment -> Receipt -> Demand raise -> Demand print -> Surrender/Transfer.
5. Every list screen starts with 3 to 6 filters and a FETCH button; the grid is empty until you press it.

## Booking Form: their fields
- Unit information: upload application (Yes/No); applicant type Individual / Multiple / Company; Project*, Unit Type*, Customer Classification, Broker/Direct, Broker*, Main Broker, Normal Booking / Hold Unit, Tower, Floor, Unit No. (or type it), Payment Plan* (+View), Application Date*, Basic Price*, Form No., Registration No.*, GSTIN.
- Company discount: inaugural discount (+per area Rs), rebate Rs, per sq ft, %. Broker discount: rebate, per sq ft, %.
- Applicant: title (Mr, Ms, Mrs, M/S, Dr, Major, Colonel, Brig., Captain, Advocate, LT.COL., Mohd, Group Captain), first/middle/last, S/o W/o D/o C/o A/s, DOB, anniversary, nationality (Resident/PIO/NRI/OCI), marital status, gender (Male/Female/Transgender), children, passport, PAN, e-mail 1 and 2, profession, designation, company, Aadhaar, photo, power-of-attorney details.
- Three addresses (present, office, permanent) each with address, pin, country, state, city, mobile, phone, fax; "fill office/permanent address" copy buttons; mailing address choice; preferred communication (Courier, Email, SMS, No Communication, By Hand).
- Sales employee, remarks. Other costs: PLC, Other Charge, Alteration/Scheme, IFMS/Fire Fighting, Additional Charge, Extra Charge. Finance: nominee details.

## Receipt form: their fields
Header strip: name, reg no, tower, unit, **TDS applicable**, unit cost, S.Tax, GST, total, paid, balance, interest. Then: Self / Bank Loan; receipt date; **Received For** (5 legal entities of the group); account holder; remark; invoice date by (receipt date / posting date); On Account Of; interest inclusive/exclusive; extra add-on inclusive/exclusive; TDS (calculate exclusive / not). Eight payment modes as tabs: **Cheque, Draft, Online, Cash, Adjust, Dealer Adjustment, TDS Challan, Card**. Cheque tab: amount, interest, GST on interest (5%), paid, S.Tax, CGST, SGST, TDS, cheque no., date, bank (about 95 banks, many duplicates and typos), branch, employee.

## Setup forms
- Payment Plan Master: project, plan name, plan type (Construction / Down Payment / Flexi / Time), type (% or fixed), timely discount (No/Yes), discount per area, discount %, discount calculate (100% or 100-discount%), description 500 chars.
- Add Tower/Plot: project + number of towers/plots only. Create Installment: project, plan, number of installments, then FETCH.
- Broker Application: company name*, estd year, broker code*, name*, designation, DOB, anniversary, deposit money, GST registered or not, RERA no, TAN, PAN, service tax, references, POA date, strength of sales force, manager, officer, remark, address*, phone, city, mobile, state, e-mail, pincode, licence no, bank name, branch, A/C, IFSC.

## Where they are weak (we must not copy these)
- Data is dirty: states list has "Madhyapradesh" and "Madhya Pradesh", "Maharastra" and "Maharashtra", "Kolambo"; bank list has "Axis Bank Lts" and "AXIS BANK", "SBI" and "STATE BANK OF INDIA", "Nanital Bank" twice, "NA", "Online", "Other Bank" as banks; employee list has "Mr. Test 123", "Mr. BBA", "Mr. crm123", "Mr. Audit".
- One 213-field page for a booking; nothing is saved until the end.
- Empty grid until FETCH, so a user cannot just see "everything pending".
- Several customers show amount 0 and still appear in receipt list.

## Gap check: our CRM against theirs
Method: for every item I searched our web, API and migrations for the feature, then for the Booking Form checked each field by name. A text match is only a hint (it can be a different feature with the same word), so each row marked "to verify" must be opened in our app before we say it is done.

Booking Form: of 42 field groups, 36 exist in both UI and API. Real gaps:
- **Alteration / Scheme** cost line (no UI, no API; only a `has_alteration` column from an old migration)
- **IFMS / Fire fighting** line in booking (appears in reports and GST setup, not in the booking form)
- **Physical application form** flag (their Demand Status filter uses it)
- Customer classification is used in reports but the booking API does not take it (to verify)

Screens with no clear match in our code (to verify, may be named differently): Area Type master, Customer Bank master, Floor-wise unit allocation screen, Pre-attach PLC/Other charges, Address Owner master, Customer-wise timely discount, Transfer authentication switch, Editing Status (approval of booking edits), Increase Area report, Broker Hierarchy report, Customer Alteration report, GST opening balance, Invoice prefix, Employee tree / Team master.

Receipt form: we already have receipts with modes and TDS; to verify against their 8 modes (especially **Dealer Adjustment**, **TDS Challan**, **Adjust**, **Card**) and **Received For (entity)**, **Invoice date by**, **Interest/Extra add-on inclusive vs exclusive**.

Update (later pass): `GAP-LIST.md` (screen by screen), `DATA-FLOW.md` (how data moves), `PROJECT-IMPORT-RESULT.md` (their project entered into ours, field by field), `captured/` parts 1 to 10 (raw captures), `import-galleria78.mjs`, `check-interest-parity.mts`.

Update: all 207 screens were then read and compared one by one, see `GAP-LIST.md` (it replaces the rough lists above). New finding there: the Booking Form also has a **Rate List** pick-list that is not in our booking.

## How we make it easier (proposal, not built yet)
1. **One search box for everything** (name, mobile, registration no, unit) instead of 4-field filters and a FETCH button. Lists show data at once, filters narrow it.
2. **Booking as a 4-step flow** (Unit -> Applicants -> Money -> Review) with a price card that updates as they type, copy-address toggle, state and city picked from the pin code, duplicates (same PAN/mobile) caught at once, and a draft that is saved automatically.
3. **Receipt in one panel**: customer card on top (cost, paid, balance, interest, TDS yes/no), amount first, mode as one choice, and only the fields that mode needs; interest, GST and TDS calculated and shown before saving; save and print together.
4. **Project wizard** that replaces the 15 setup menus (towers, floors, unit types, units, charges, plan, installments), with a preview of the generated units.
5. **Clean masters**: banks, states, cities, titles are fixed lists with no duplicates; employee test accounts are not shown.
6. **Role home**: a sales person sees leads and bookings, accounts sees cheques to deposit and demands to raise, the owner sees collection and dues.

## Next
Needs owner confirmation of order. Suggested: (1) open and verify each "to verify" row in our app, (2) close the 3 real booking gaps, (3) receipt modes, (4) then the easier-flow work above, one module at a time with tests, as before.
