# Captured from the client CRM (read-only), part 1: setup forms
Notation: `*` required, `(r)` one-of choice, `(c)` tick box, `[n]` list of n values, `<X>` button. Captured 2026-10-29 (client access ends 16:00 IST).

## Unit Type Master (ProjectUnittypeMaster.aspx)
Project*, <Add Group> (group name per project). Type* (r) Per Area / In Fix. Area Type* (r) Salable / Non Salable. Project Unit Type Name*. Super Area*, Built up Area, Carpet Area, UDSL Area, Plot Area (+ unit: Acres / Sq. Ft. / Sq. Mt. / Sq. Yrd.), Balcony Area. Rate*. Effective Rate on (r) Super / Carpet / Built Up / Plot. "Area shown on payment file" (c) Super, Carpet, Built Up, UDSL, Plot, Balcony. Construction Cost, UDSL Cost. Date*, Unit Of Measurement* (5 values), Unit Map, Unit Description (50). <Save> <View>.

## Letter Setup Master / Demand Format Customization (LetterSetupMaster.aspx)
Project*, Letter detail* (text), Active/Deactive, Letter Type (r): Welcome, Receipt, Demand, Allotment, Name Address Changes, Interest, Area Increase, Offer Of Possession, No Dues, Possession, Handover. Content position (r) Top / Bottom.
Variables: @Company@ @Project@ @ProjAddress@ @Tower@ @Floor@ @UnitType@ @UnitAddress@ @Location@ @RefDate@ @RefNo@ @R1RefDate@ @R1RefNo@ @R2RefDate@ @R2RefNo@ @LBr@(line break) @RS@(rupee) @SB@ @EB@(bold) @SU@ @EU@(underline) @Space@ @RegDate@ @dueamount@ @dueamountinWord@ @balancedueamount@ @balancedueamountinWord@ @dueamountinterest@ @dueamountinterestinword@ @dueamountservicetax@ @dueamountServicetaxinword@ @PaymentPlan@ @PaidAmount@ @PaidAmountInWord@ @CurrentInstallmentName@ @DueDate@ @Corporate@ @Area@ @AreaMeasurement@ @Rate@ @OtherChargeAndPlc@ @PayableAt@ @CustomerName@ @PendingAmount@ @PendingAmountText@ @Registration_No@ @SecondArea@ @SecondUnitType_Areameasurement@.

## Other Charge Master (OtherChargeMaster.aspx)
Project*; kind (r) Other Charge / (Terrace/Garden/Extra) Area Charge. Name of Charge*. (r) In % / Per Area / In Fix. Amount calculate on (r) Basic Price / After Inaugural Discount Basic / After All Discount. Mandatory Y/N, Is Parking Y/N, Inventory Base Y/N, Multiple Booking Y/N, Alteration Y/N, Is Agreement Y/N. Amount*, Effective Date*, Description (500).
PLC Master: Project*, Name*, Type (r) % / Per Area / Fixed, calculate on (same 3), Amount*, Effective Date*, Description (100). IFMS master: Project*, Name*, Amount*, Effective Date*, Fix / Per Area, Description (50).
Extra Add On Charge Master: Project*, Company*, Charge Name* [Bounce, Parking, Holding Charges, Penalty Charges, ... 8], basis [Fix / Per Area / %], Amount*.
Set Extra Add On Charge (per customer): filters Project, Tower, Unit Type, Plan, Reg No, Name, Unit No; then Addon Extra Charge Type*, Area Measurement and Rate*, Effected Date*, Parking Rate and Quantity*, Amount*, Remark.

## GST Configuration (taxslabmaster.aspx), 8 tabs
FINANCIAL YEAR (name, from, to, active). HSN/SAC CODE (code, type Goods/Service, item name, description). HSN/SAC CODE ASSIGN (code, project, charge type BASIC/PLC/OTHER CHARGE/IFMS/EXTRA ADD ON/OTHERS, charge name). GST SLAB (from, to). GST TAX SETUP (slab, GST code, type INTER/INTRA/UT, IGST, CGST, SGST, UTGST %). GST TAX CHARGE MAPPING (project, slab -> charge, GST code, exempted %; status: yellow = pending; Print, Download; "GST Addon Configuration": GST code, area, AND/OR, amount, CGST, SGST). PROJECT WISE GSTIN (project, GSTIN). PROJECT WISE RERA NO. (project, tower, RERA no). Every tab has <Save> <Update> <Cancel> <View> <Track> (track = change history).
ITC Configuration, 3 tabs: Project Wise ITC (project, slab, effective date). Project Charge Wise (project, slab, charge type, charge name, CGST %, SGST %). Customer Wise ITC (filters project/slab/tower/unit type/plan/name/reg no, then <Set> and edit per customer).
Invoice Prefix: Project, Financial Year, Invoice, Receipt Voucher, Cr. Note, Dr. Note, Refund voucher. Customer Wise GST Discount: project/tower/plan/reg/slab/GST code/charge type/charge name. GST Number Configuration: Project, Company, GSTIN, Effective Date.

## Automated / Manual switches (4 screens, one row per project, 14 projects)
- Booking Authentication: columns Mode, Applicant Addition/Deletion Mode, Journal/Debit/Credit Mode, Unit Shifting Mode, Receipt Type, Action. All "Automatic" (automatic = no approval step).
- Receipt No: per project and receipt type (Normal Receipt / Cr Note / Dr Note / Payment Refund / Journal Voucher): Mode Automatic or Manual, Receipt No., Prefix (e.g. `ROF AMBLISS/REC/`). Many projects have no prefix.
- Registration No: Registration Type (all Manual) and "Size of Registration No." (0 or 6). A second tab: Broker Authentication.
- Transfer Authentication: Mode per project (all Automatic), <Edit>.

## Broker Application Form (Brokerdetails.aspx)
Broker Information: Company Name*, Estd Year, Broker Code*, Name* (first, middle, last), Designation, DOB, Anniversary, Deposit Money Y/N (+ amount). Government Tax: GST (r) Unregistered / Registered; if registered: GSTIN*, GST State* (62 values), Effective Date; Rera Reg. No, TAN, PAN, Service Tax Y/N + S.Tax No. Other: References, POA Date, Strength of Sale Force, Manager, Officer, Remark. Contact: Address*, Phone (code + number), City, Mobile, State, E-Mail, Pincode, Licence No. Bank: Bank Name, Branch, A/C No., IFSC. <Save> <Back> <Close>.

## Allotment Information (allotmentinformation.aspx), after Fetch
Filters: Project*, Tower, Reg No, Name, Unit Address, Allotment/Addendum E-stamp No. Form: Allotment Address (r) Present / Office / Permanent, and the same for Co-Applicant; E-stamp No.; Administrative Charge; Escalation Charges Required; Penalty @ Rs.; Possession Type (r) Period / Date; Calculated From (r) Booking Date / Allotment Date; Possession Month; Possession Date; Grace Days; Letter Type; Escalation Display Y/N, Consent Display Y/N, Clause Display Y/N. Second box "Enter new e-stamp information": E-stamp No., Addendum Display Y/N.

## Customer Register / Applicant Payment File (PaymentPlanReport_All.aspx)
Filters: Project*, Unit Type, Plan, Broker, Status (Active / Temp Deactive / Final Deactive), Tower, Customer Classification, Employee, Type (Loan / Self), Location, Registry (Registry / Without Registry), Reg No, Name, Unit Address, Form No, Booking Date range.

## Employee Tree
Team-wise hierarchy, each node "NAME ( LOGIN, count )"; 41 employees, all level 0 (no real hierarchy is filled in).
