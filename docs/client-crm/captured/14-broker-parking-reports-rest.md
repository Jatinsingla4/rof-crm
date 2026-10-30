# Captured from the client CRM, part 14: the rest of Broker, Parking and the reports that were empty before (project ROF AMBLISS, headers only)

## Broker menu
- **Broker Project Mapping / Sub Broker Mapping**: per project a list S.No, Broker Company Name, Broker Code, Broker Name (Sub Broker Mapping adds a Delete). This login sees one broker, "Direct" (ROF1).
- **Address Label**: Broker Company Name, Broker Name, Address, Phone No, Mobile No, Print Address.
- **Broker Summary**: Broker Code, Broker Company Name, **Unit Type, Sold Unit** (units sold per broker per unit type). **Summary Sold-Unit**: Broker Code, Broker Name, Company, Sold Unit, Detail. **Broker Wise Booking**: Broker, Project, No. Of Booking.
- **Broker (Brokerdues_BSP)** per broker customer list: Registration No, Booking Date, Name, Unit Type, **Booking Type**, Unit Address, Payment Plan, BSP, Rate, **Discount Per SqFeet**, Unit Area, Basic Price, Total Unit Cost, Paid Amount, Balance Amount, PLC, Other Charges, **Paid BSP (%), Paid Unit Cost (%)**.
- Broker Hierarchy: empty for this login (a tree by team).

## Parking menu
- **Parking Type Master**: project + Type of Parking; list S.No, Parking Type, Action (here one type, "Scooter Parking"). Types are **per project**.
- **Inventory Master** (Car Parking Inventory Master): list Name of Parking, Total No. of Parking, Alloted Parking, **Add New Parking** (a count box), Parking Type, Delete. So the stock is a **count per parking type per project** (e.g. 798 scooter parking), not one row per slot.
- **Assign Car Parking / Inventory Report**: see part 10.

## Reports that were empty before, now with a larger project
- **Installment Wise Demand Status**: Registration Date, Registration No, Name, Unit Type, Unit Address, Installment Date, Installment Amount, **Demand Status**, Demand (752 rows for 798 units).
- **Inventory Summary Report**: choose Project / Tower / Unit Type / Tower vs Unit Type; columns Total, **Non Salable, Salable, Sold, Unsold**.
- **Search Customer** with no key returns every customer of every project (3,170 rows): Project Name, Registration Date, Registration No, First Applicant, Second Applicant, Unit Type, Unit Area, Tower, Unit Address, Broker Company, DOB, Address, City, State, Email, Mobile, PAN of first and second applicant.
- **Allotment Cancel Report**: 70 rows (Project, Reg No, Name, Booking Date, Tower, Floor, Unit No, Unit Type, Allotment Date, Cancel).
- **Other Charge report**: 901 rows (Registration No, Booking Date, Name, Tower, Floor, Unit Address, Other Charge, Paid / Free / Total Quantity, Amount): one row per customer per charge.
- Still empty or with no data for this login: Pending Allotment Ageing, Tower Wise / Unit Type Wise unit status, Availability Sheet (tiles only), Master Report (needs a saved template), Applicant Birthday, Increase Area, Customer Wise Collection, Collection Against Dues, Customer Dues (%), Installment Wise Dues, Month Wise Dues, Customer Forecasting, IFMS, PLC, Extra Charge, Extra Addon, Pending Invoice, HSN and Charge Wise.

## Our side for Broker and Parking (database)
- Broker application (`broker_applications`) has company, estd year, code, 3 name parts, designation, DOB, anniversary, deposit money, GST status, RERA, TAN, PAN, service tax, references, POA date, sales force, manager, officer, remark, address, phone, city, mobile, state, email. **Missing against theirs**: GSTIN, GST state, GST effective date, service tax number, deposit amount, pin code, licence no, bank name / branch / account no / IFSC (bank details live in `brokers.bank_account_details`, not on the application). `brokers` has `parent_broker_id` (their Parent Broker) and a status. A "Dis-Continue / Continue" action and a broker details report are to be checked in the screens.
- Parking: `parking_types` is **global** (no project), `parking_slots` is one row per slot, prices per project and type. Theirs: types per project and stock as a count; slot numbers like `P-<tower>-<unit>`; "Possession > Assign" step; printable Parking Allotment Letter.
