# Captured from the client CRM, part 2: sale flow screens and report filters (no customer data kept)

## Filters that recur on almost every list/report
Project*, Unit Type, (Unit Type Group), Payment Plan, Broker (incl. "Direct"), Tower, Floor, Customer Classification, Employee, Type (Loan / Self), Location, Registry (Registry / Without Registry), Status (Active / Temp Deactive / Final Deactive), Registration No., First Name, Unit Address, Form No., Booking Date range, "Without tax / With tax" switch, Due criteria with operator (< <= = > >=) on a percentage.

## Print Welcome (WelcomeCall.aspx)
Filters as above + Date range, Print Date, Call Type (Pending / All). Row action "Add Remark": customer, reg no, address, mobile, plan, call type, remark (200).

## Print Demand / Demand Status (DemandStatus.aspx)
(r) All / Alloted; Project*, Stage, Plan, Tower, Floor, Broker, Classification, Location, Communication (with / without), Loan type, **Physical application form** Y/N, Due Amount operator + value, Send/Unsend status for Demand / Reminder1 / Reminder2 / Termination x Sent / Unsent, Reg No, Name, Unit Address, City, Due Date, Print Date, (r) GST / Before GST. Dashboard counts per project: Demand, Reminder1, Reminder2, Termination each Unsent / Sent, Total, Outstanding.

## GST invoicing screens (all filter by Project, Stage, Tower, Plan, Installment, Reg No, Name, Unit No)
Invoice Generation: (r) Tower wise / Customer wise, installment date range, <Generate Invoice>, invoice date. Manual Invoice: type [Invoice, Advance, Dr. Note, Cr. Note], installment, invoice date, (c) Only AddOn (c) Only Increase Area, total. Invoice Reversal: remark*. Invoice Against Advance: document type [Invoice, Advance, Dr. Note, Cr. Note, Refund, Interest, Cancelled], <Generate Invoice> <Print Invoice>. Credit/Debit against invoice: (r) Credit / Debit, date, same two ticks. Invoice Details: document no/date/type incl. "All Receipt Voucher". Invoice Receipts: summary/details, types incl. "Receipt Voucher Adjusted / Not Adjusted". Month Wise: month + year; columns GSTIN, Place of Supply, Reverse Charge, Invoice Date/No, Reversal Invoice No, Type, Amount, Rebate, Taxable Value, CGST, SGST, ITC, Total (for Invoice, Advance Adjustment, Payable), Name, Reg No, Tower, Unit No, Installment, Installment Date.

## Surrender / Cancellation
Application: fetch by project/reg/name/unit; shows name, tower, unit, area, rate, basic price; Reason for Cancellation, Date, Remark; <Save>. Report: (r) All / Surrender / Cancellation; Group, Unit Type, Tower, **NOC (Bank NOC / Broker NOC)**, Classification, from date, Status (Temp / Final Surrender / Cancellation), Due Status (All / Clear / Due). Restore: shows paid receipt amount, paid S.Tax, CGST, SGST, ITC, interest amount / waive off / paid interest, surrender premium, penalty (edit, GST inclusive / exclusive), payable by company, paid by company, balance payable, remark (100), <Final Surrender>, then <Unit Release>.

## Project Details report columns (ProjectReport.aspx)
Company, Project, Type (Commercial / Residential / Plotting-Acre scheme / Group Housing / SCO), Location, Land Area (+unit), Total Tower, Total Unit, Sold, Unsold, Salable Area, Sold Area, Balance Area, Balance %, Average BSP, Average Cost, <Detail>. 14 projects, 13 are visible to full admin.

## Unit Status (PrintTotalAddress.aspx)
Status ticks: All, Available, Mortgage, Hold, Unapproved, Booked, Alloted, RERA Registered, Registry, Temp. Surrender. Filters: project, unit type, tower, floor, name, unit no, location. Row action **Hold Unit**: broker*, hold hours*, remark* (500).

## Applicant reports
- Applicant Payment File: filters above + "Filter Type: Total Sale Value / Total Sale Value With Addon Charges", "Due As On Date".
- Master Report (CustomerWiseCommonReports): same filters + **Template** (saved column set; <Add/Edit Template>) + As On Date.
- Search Customer: choose one search key (Reg No, Unit No, First/Middle/Last Name, DOB, First Applicant PAN, Address, City, State, Email, Mobile, Second Applicant, Second Applicant PAN), then **Print By Choice** columns: Registration No, First/Second Applicant, Unit Type, Unit Area, Unit Address, Registration Date, DOB, Address, City, State, Email, Mobile, PANs, Tower, Project.
- Customer Detail: **Print By Choice** for First Applicant (Reg No, Name, C/o, DOB, Residence / Correspondence / Permanent address, PAN, Phone, Mobile, Email, Passport, Profession, Company, Designation, Anniversary, Classification, Employee, Remark, Aadhaar, GST No, Form No), Second Applicant (same set), and unit/cost columns (Date of Booking, Unit Type, Tower, Unit Address, Plan, Broker, Finance Employee, Cost, Area, Rate, Basic Price, Discount by Company %, Discount by Broker Rs, Other Discount, Net Basic Price, Other Charge, PLC, Alteration, IFMS, Total Unit Cost, Dr/Cr, Paid, Balance).

## Collection reports
- Collection Report (Combine_Collection_Report): (r) Project / Tower / Unit Type / Broker / Customer / Employee wise; period (r) All / Yearly / Monthly / Date wise (year 2019-2028, month, dates); (r) Without / With Tax. Output: Amount received as on date: Pending, Clear, Total.
- Charges Wise Horizontal (CustomerHeadWiseReceipt): filters + Receipt Date, Cheque Clear Date, Instrument Date ranges, (r) Customer / Receipt wise, Receipt No, Instrument No. Vertical: head wise collection with / without interest.
- Receipt Wise Collection: (r) Receipt Date / Clear-Bounce Date; Type (All / Loan / Personal); User; Payment Mode [All, Cash, Cheque, Draft, Online, TDS Challan, Adjust, Dealer Adjustment, Card]; receipt no, cheque no, registration date range.

## Dues reports
- Customer Wise Dues: Without/With Tax; Dues Criteria (operator + %), Due Date, Classification.
- Customer Dues Report (%): basis (r) Net Basic Price / Basic With PLC / Total Unit Cost / Due Amount / Due Amount With Tax; "Paid Clear Amount" criteria operator + %.
- Customer Forecasting: month, year, stage, booking date, with/without tax.
- Customer Dues Details: (r) Summary / Installment wise / Details / Head wise; Due Date range, Receipt Date, Stage, Filter Type (sale value with or without add-on).
- Ageing: 4 views (Project / Tower / Plan / Customer wise dues), with/without tax, <Run Job> that fills a table `customer_ageing_details` (their page crashes: that table does not exist on their database).
