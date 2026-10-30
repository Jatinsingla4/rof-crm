# Data flow of the client CRM (and where ours matches)

Read from the client's screens, buttons and report columns (see `captured/`). The client's database was **not** seen, so tables and rules are inferred from the screens; items marked (inferred) must be confirmed with the owner. "Ours" = our table or screen that holds the same data (from `packages/api/src/db`).

## 1. One-line chain
Company -> Project -> Tower -> Floor -> Unit Type (group) -> Unit -> Pricing (rate, PLC, other, IFMS, alteration, add-on, tax) -> Payment Plan (stages, installments) -> Broker -> **Booking** (applicants, addresses, discounts, documents, finance) -> Approval -> **Allotment** -> Agreement / RERA -> **Receipt** (8 modes) -> clearing -> **Demand** (D, R1, R2, Termination) -> Interest -> **Invoice / credit-debit notes** (GST) -> Dues and Collection reports -> Surrender / Transfer / Registry / Possession.

## 2. Stage by stage

### A. Masters (set once)
- Company (5 legal entities; each has bank accounts) -> Project (type Commercial / Residential / Plotting / Group Housing / SCO; land area + unit; location; RERA no per project and tower; GSTIN per project). Ours: `companies`, `company_bank_accounts`, `projects`, `project_rera_numbers`, `project_gstin`.
- Lists: salutation, profession, nationality (Resident / PIO / NRI / OCI), country-state-city, source of enquiry, banks, loan banks (approved per project), departments, teams, team head, manager, employee tree, document types (per project, individual or company, mandatory, stage: On Booking / Allotment / Possession / Transfer), dispatch types. Ours: same names in `master`, plus `teams`, `departments`, `document_types`.
- Not in ours: area unit master (Acres / Sq Ft / Sq Mt / Sq Yrd), project-wise approved loan banks.

### B. Project structure (per project)
1. Number of towers -> 2. Floors by naming pattern (1,2,3 / 1st,2nd / First,Second, prefix or suffix) -> 3. copy floors to other towers -> 4. Unit Types (+ group): per area or fixed, salable / non-salable, super / built-up / carpet / UDSL / plot / balcony areas, rate, **effective rate on** super / carpet / built-up / plot, areas shown on the payment file, construction cost, UDSL cost -> 5. Units per floor with address order and location -> 6. attach PLC / other charges to units.
Ours: `towers`, `floors`, `unit_types` (area + base rate only), `units`, `unit_locations`. Missing: UDSL, effective-rate basis, group, construction cost, copy floor, pre-attach charges, address owner, unit area with 3 balconies + basement + stilt + common area (their Unit Wise Area has 12 area columns).

### C. Pricing and payment plan
- Booking price = **Area x Rate** (the "Basic Price" box on the booking form holds the rate per unit of area; area is shown beside it).
- Heads: Basic, PLC (by location), Other charges (% / per area / fixed; calculated on Basic, after inaugural discount, or after all discount; flags: mandatory, parking, inventory based, multiple booking, alteration, agreement), IFMS (fixed or per area), Alteration / Scheme, Extra add-on (bounce, parking, holding, penalty, ...; set per customer, in bulk, cancel, waive off).
- Discounts: Company (inaugural per area, rebate Rs, per area Rs, %) and Broker (rebate, per area, %), kept separate.
- Payment plan (types Construction-linked, Down payment, Flexi, Time; % or fixed; timely discount; "100%" or "100 - discount" calculation) -> installments each = **% of BSP** (example plan: 10 + 30 + 20 + 30 + 10 = 100). PLC and other charges have their own installments. A customer can get a personal installment set and a timely discount.
- Tax: GST slabs, HSN/SAC codes assigned to each charge head, GST type INTER / INTRA / UT with IGST / CGST / SGST / UTGST, mapping of each charge to a GST code (with exempted %), ITC per project / charge / customer, invoice prefixes per financial year.
Ours: `payment_plans`, `plan_schedule_templates`, `charge_master_config`, `plc_charges`, `addon_charge_master`, `consumer_addon_charges`, `gst_slabs`, `gst_tax_setup`, `gst_tax_charge_mapping`, `hsn_sac_codes`, `hsn_sac_code_assign`, `financial_years`. Missing: timely discount, rate list, customer GST discount.

### D. Broker
Broker application (company, code, contact, bank, GST registered or not with GSTIN / state / effective date, PAN, TAN, RERA, licence, POA date, sales force, manager, officer) -> project mapping -> sub-broker (broker manager) -> used on booking as Broker (or "Direct") and Main Broker -> broker discount on the booking -> broker reports. Ours: `brokers`, `broker_applications`, `broker_project_mapping`, `broker_tax_config`, `broker_commissions`.

### E. Booking (the main write)
Booking form sections and what they create:
1. Unit information: applicant kind (Individual / Multiple / Company), upload-application flag, project, unit type, classification, Broker or Direct, main broker, **Normal booking or Hold unit**, tower -> floor -> unit (cascading; only **available** units are offered; "No unit is available" otherwise), payment plan, application date, rate, form no, registration no (manual in the client's setup; size 6 on most projects), GSTIN.
2. Company and broker discounts.
3. Applicant 1 (title, name, S/o W/o D/o C/o A/s, DOB, anniversary, nationality, marital status, gender, children, passport, PAN, 2 e-mails, profession, designation, company, Aadhaar, photo, POA tick) and further applicants (Multiple / Company).
4. Three addresses (present, office, permanent) with copy buttons, mailing choice, preferred contact mode.
5. Sales employee, remarks.
6. Other costs: tick the PLC and other charges that apply to this unit.
7. **Document checklist** (from the project's document master, type "On Booking"): per row check, bar code no, physical storage no, scan reference no, attachment.
8. **Finance** (tick to open): bank, branch, contact person and number, file no, file date, employee, sanctioned amount, remarks.
9. Nominee (tick to open).
10. Buttons: **Preview**, **Save and Proceed**.
Approval after save: Entered -> (Unapproved / Correction) -> Checked -> Approved; each step stores who and when (Booking Status report). Later edits of an applicant go through their own approval (Editing Status: pending / unapproved / approved / rejected). Per-project switch decides whether these steps are automatic.
Ours: `booking_forms`, `booking_records`, `consumers`, `applicant_details`, `co_applicants`, `applicant_addresses`, `loan_details`, `head_wise_costs`, `booking_documents` (has barcode, physical storage and scan reference columns), `unit_holds`, `waitlists`. Gaps: rate list, alteration / IFMS lines, physical-application flag, edit-approval chain.

### F. Allotment and agreement
Allotment form (list of approved bookings with photo) -> allot -> Allotment Information per customer (address to use for the letter for applicant and co-applicant, e-stamp no, administrative charge, escalation, penalty Rs, possession by period or by date, calculated from booking or allotment date, possession months, grace days, letter type, escalation / consent / clause / addendum display) -> Allotment letter print (status Issued / Unissued, site map) -> Agreement date (ATS) -> RERA agreement (RERA no, date, amount, "is RERA customer") -> Conveyance deed date -> Tripartite agreement (TPA / PTM) for loans. Ours: `allocations` (allotment, agreement, conveyance dates), `allotment_letters`, `conveyance_deeds`, `registry_details`.

### G. Money in (receipt)
Customer card (unit cost, tax, total, paid, balance, interest, TDS applicable) -> Self or Bank Loan -> receipt date, **Received For (which of the 5 companies)**, account holder, remark, invoice date by receipt or posting date, on account of, interest inclusive or exclusive, extra add-on inclusive or exclusive, TDS calculate or not -> one of 8 modes (Cheque, Draft, Online, Cash, Adjust, Dealer Adjustment, TDS Challan, Card) with its own fields; shows interest, GST on interest, paid, S.Tax, CGST, SGST, TDS.
Receipt life: generated (by, date) -> **approval** pending / approved -> printed (issued / unissued, duplicate print) -> cheque **pending (under clearing)** -> deposited -> **clear** or **bounce** (dates and banks stored) -> or **cancelled** (remark). Receipt number comes from a per-project, per-type prefix and counter (types: Normal Receipt, Cr Note, Dr Note, Payment Refund, Journal Voucher). TDS: challan assigned to receipts later, certificate and challan documents uploaded. Journal entry, debit / credit / refund notes and their reversal move money between customers or projects.
Ours: `receipts` (status, approval, print, deposit, clearing, adjustment, advance), `tds_challans`, `tds_assignments`, `journal_entries`, `credit_debit_notes`, `payment_refunds`, `cheque_bounce_logs`, `booking_counters`.

### H. Demand and dues
Demand raise by stage, tower, customer, installment, or unit + stage, with installment date or forecasting date; **unraise** needs a remark. Raised demand = installment amount + CGST / SGST (+ add-on). Letters in a ladder: **Demand, Reminder 1, Reminder 2, Termination**, each Sent or Unsent, printed or emailed or SMS; reminder days are configured per project (name, prefix, rank, days). Demand screen shows **delay days**, due, paid, O/S, **interest**, O/S with interest, pending cheque.
Money rules seen in the report columns: Total Unit Cost = Net Basic + PLC + Other charge + IFMS + Alteration; Total Consideration = Unit Cost + Add-on; Outstanding = Due - Received (cleared) - Credit; Pending (under clearing) cheques are shown apart from Clear; Received % = Received / Total Cost; Outstanding % = Outstanding / Due. Interest runs on delay days per project interest rate, with waiver and grace period.
Ours: `demands`, `project_interest_rates`, `penal_interests`, `interest_waivers`, reports-dues / reports-ageing.

### I. Invoice (GST)
Invoice generation (by tower or customer) after demand -> manual invoice (add-on only, increase area only) -> invoice against advance (receipt voucher knock-off) -> credit / debit note against invoice -> reversal (remark) -> cancellation -> pending invoice list; reports by invoice, receipts, month (with GSTIN, place of supply, reverse charge, ITC), HSN and charge wise. Customer opening balances for GST. Ours: `gst_invoices`, `credit_debit_notes`, `gst_process_rights`.

### J. Exit and change
Unit shifting (request -> pending / approved / rejected), applicant addition / deletion, name / address change, area increase / decrease (with or without tax), transfer, surrender or cancellation (application with reason, date -> temporary -> **final surrender** with paid amount, interest, premium, penalty, payable by company, GST inclusive / exclusive -> **unit release**; **restore** is possible; NOC Bank / Broker), registry (with / without), possession. Ours: `unit_shifts`, `ownership_transfers`, `transfer_fee_master`, `surrender_applications`, `cancellations`, `registry_details`.

## 3. Status lists that must stay identical in ours
- Unit: Available, Mortgage, Hold, Unapproved, Booked, Alloted, RERA Registered, Registry, Temp. Surrender.
- Customer: Active, Temp Deactive, Final Deactive.
- Receipt payment: Cash, Cheque, Draft, Online, TDS Challan, Adjust, Dealer Adjustment, Card; receipt type Loan / Personal.
- Surrender: Temp / Final Surrender or Cancellation; Due status All / Clear / Due.
- Letters: Welcome, Receipt, Demand, Allotment, Name Address Changes, Interest, Area Increase, Offer of Possession, No Dues, Possession, Handover.

## 4. Data-quality rules for our version
1. Masters are pick lists without duplicates (their lists have "Madhyapradesh / Madhya Pradesh", "Maharastra", duplicate banks).
2. Registration no and receipt no are unique per project and follow the project prefix and size.
3. A unit can be offered on a booking only while Available; a hold has an expiry.
4. Every money row keeps who, when and which company received it.
5. A booking cannot be saved without project, unit type, broker (or Direct), unit, plan, application date, rate, registration no, applicant name and gender, present address.
6. All amounts are stored once and the screens read them (no per-screen totals); dates use India time.

## 5. Questions for the owner
Is Rate List used? Is the 3-step booking approval needed on every project? Which of the 5 companies receives which receipt (rule or free choice)? Are Alteration and Scheme still charged?
