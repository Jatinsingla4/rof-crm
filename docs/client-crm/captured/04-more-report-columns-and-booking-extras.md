# Captured from the client CRM, part 4 (project ROF AMBLISS, headers only) and booking extras

## Booking Form: parts that only appear after choosing a unit (not saved, nothing was entered)
- Choosing project -> Unit Type list (e.g. 510 / 550 / 950 Sq. Ft.) -> if no unit is available the page shows red text "No unit is available." and Tower / Floor stay empty. Otherwise Tower -> Floor -> Unit No. (only available units) -> Payment Plan (10 plans seen, e.g. construction-linked and possession-linked ones) -> the form shows **Area** (e.g. 950.000 Sq. Ft.) and fills **Basic Price** with the rate per area (5000.000), so Basic = Area x Rate.
- Broker list for the project holds only "Direct" until brokers are mapped to the project; Main Broker list is empty until a broker is chosen; Sales Employee list shows only a few users (BBA, crm123, Dhiraj, Mukesh): it is a filtered list, not all employees.
- OTHER COSTS shows only the charges defined for that project as tick boxes (here PLC and Other Charge); the other four (Alteration/Scheme, IFMS/Fire fighting, Additional, Extra) show when the project has them.
- DOCUMENT table (from the project's document master, type "On Booking"): S.No, Check, Document Type, Document Name (Physical Application Form, Document 1 to 5), Bar Code No, Physical Storage No, Scan Reference No, Attach Document (file; marked required).
- FINANCE (a toggle): Bank Name* (22 banks and finance companies, e.g. HDFC, PNBHFL, Canara, ICICI, IIFL, Bank of Baroda, Axis, SBI, Muthoot Homefin, Piramal Finance, Bajaj Finance), Branch, Contact Person, Contact No, File No, File Date*, Employee Name*, Sanctioned Amount, Remarks.
- "Would you like to add nominee details?" tick. Buttons: PREVIEW, SAVE AND PROCEED, CLOSE.
- Payment Plan "View" opens a print page: Project, Plan, Date, table Installment Name and BSP (%), e.g. At the time of booking 10, Within 30 Days of Booking 30, On the Start of Excavation 20, On Casting of Ground Floor Slab 30, On Intimation for Offer of Possession 10; buttons Print, Close.

## Report columns (header rows)
- **Journal Report**: Date, Voucher No, From Reg No / Name / Unit, Dr No, To Reg No / Name / Unit, Cr No, Amount, Created By/Date, Remarks, Status, Approved By/Date, Approver Remarks, Action. (A journal moves money from one customer's unit to another's and needs approval.)
- **Unit Cost** (all units, one row each): Tower, Floor, Address, Customer Name, Unit Type, Unit Area, BSP, Amount BSP, Ad Charge, Balcony Charge, Restoration Charge, Scooter Parking, Total Cost. (A project can have its own extra charge names, here Scooter Parking and Restoration.)
- **Applicant Birthday**: Reg No, Applicant, Name, Unit No, Birthday, Marriage Ceremony, Address, Email, Mobile.
- **Date Wise Dues**: Reg No, Name, Unit No, Area, Rate, Discount, Net Basic Price, Avg Rate, Total Cost, Previous Due (A), Current Due (B), Due (C = A + B), Previous Paid (D), Current Paid (E), Total Paid (F = D + E), Credit (H = F - C), Outstanding (G = C - F).
- **Other Charge report**: Reg No, Booking Date, Name, Tower, Floor, Unit Address, Other Charge, Paid Quantity, Free Quantity, Total Quantity, Amount.
- **Car Parking Inventory report**: Reg No, Name, Tower, Parking Address, Name of Charge, Status; buttons Assign.
- **Raised Demand Stage**: two tables: Tower Name, Installment Date, Forecasting Date; and Stage Name.
- **RERA Agreement list**: Reg No, Name, Booking Date, Unit Type, Tower, Unit No, Is Rera, Rera No, Rera Agreement Date, Rera Amount, Action.
- **Allotment Cancel Report**: Project, Reg No, Name, Booking Date, Tower, Floor, Unit No, Unit Type, Allotment Date, Cancel.
- **Assign Receipt Challan**: Reg No, Name, Unit Address, Unit Type, Amount, TDS, Clear TDS, Balance TDS, Assign. **Demand Unraise**: Reg No, Name, Unit Type, Unit Address, Plan Name, Unraise (button; remark needed).

## Screens that still gave no columns (empty for both projects tried)
Master Report, Installment Wise Demand Status, Editing Status, Tower Wise / Unit Type Wise unit status, Availability Sheet, Increase Area, Customer Wise Collection, Collection Against Dues, Customer Dues (%), Installment Wise Dues, Month Wise Dues, Forecasting, IFMS / PLC / Extra Charge / Extra Addon reports, Broker Summary / Broker (dues-BSP) / Broker Hierarchy, Invoice Details / Receipts / HSN-and-Charge-wise, Pending Allotment Ageing, Upload TDS Challan, Unit / Stage Wise demand. These need rows that are not present (they stay unverified).
