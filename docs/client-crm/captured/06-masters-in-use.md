# Captured from the client CRM, part 6: how the masters are actually filled (examples, structure only)
Read on 2026-10-29 from the live screens (View buttons). Amounts are masters (prices), not customer data.

## Demand ladder (Reminder Master, project ROF GALLERIA@78)
| Reminder Name | Days | Prefix | Rank |
|---|---|---|---|
| Reminder 1 | 10 | R1 | 1 |
| Reminder 2 | 20 | R2 | 2 |
Meaning (inferred from the Print Demand screen): a raised demand is white = **Demand** (due date passed or near); it turns yellow = **Reminder 1** when the demand is 10 days old without payment, green = **Reminder 2** at 20 days, grey = already **Sent**. The row's button is the next letter to send (D, R1, R2) and the top toggle (Automatic / Demand / Reminder 1 / Reminder 2) switches between "let the system pick" and a fixed letter type. Each project has its own days. "Termination" exists as a letter type but no day rule was set for this project.

## Print Demand screen behaviour (DemandStatus.aspx)
Filter panel (see part 2), colour legend (Sent / Demand / Reminder 1 / Reminder 2), icons for print, download, send to phone (SMS); grid with a tick box per row and a master tick; row buttons D / R1 / R2; below the grid the buttons Print Demand, Print Reminder 1, Print Reminder 2 for the ticked rows.

## Other Charge master (project ROF AMBLISS), grid columns and four examples
Columns: Charge, Type (Fix / Per Area / %), Amount, Quantity, Terrace/Garden/Extra Area, Description, Mandatory, Parking, Parking Area, Inventory Base, Multiple Booking, Alteration, Calculation Area Type, Effective Date, Agreement, Edit, Delete.
- Balcony Charge: Fix 1,00,000, not mandatory, in agreement.
- **Scooter Parking**: quantity 798 (one per flat), mandatory, Parking = Yes (parking area 1,000), Inventory Base = Yes, Multiple Booking = Yes: a stock of parking slots sold with each unit.
- Restoration Charge: Fix 50,000. Ad Charge: Fix 30,000 (both from Dec 2023).
So one project can add its own named charges; "Inventory Base" ties a charge to a counted stock (parking), "Agreement = Yes" means the charge is part of the agreement value.

## Unit Type master (project ROF AMBLISS), grid columns and an example
Columns: Group Name, Unit Type (name built as "Group-(carpet area Sq. Ft.)"), Super / Build up / Carpet / UDSL / Plot / Balcony Area, Unit, Rate, Construction Cost, UDSL Cost, Type (Per Area), Area Type (Salable), Date, **Effective Rate (the area the rate is charged on)**, Unit of Measurement, Plot Area Measurement, **Show on Payment File** (which areas to print), Description, Edit, Delete, View/Download (unit map / floor plan).
Example: group "Type 4 (2BHK)", carpet 493.206, balcony 125.078 (other variants 4G and 4P differ only in balcony area, 308.066 on 4P), rate 4,200 per Sq. Ft. charged on **Carpet Area**, payment file shows Carpet Area and Balcony Area. A different project (ROF GALLERIA@78) charges the rate on Super Area. So the **pricing basis is a project setting**, and balcony area can carry its own rate/charge.

## Allotment Information list columns
Registration No, Name, Tower, Address, Booking Date, Allotment Date, E-stamp No, Penalty, First Applicant Address, Co-Applicant Address, Possession Month, Possession Date, Grace Days, Administrative Charge, Action = Edit (opens the form in part 1). Allotment date is normally a few days to weeks after the booking date.

## Customer Register top strip
TOTAL FILE, LOCKED FILE, UNLOCK FILE counts; print and download icons; a customer name opens the Applicant Payment File (part 5). "Lock" freezes a file so its data cannot be edited.

## Data oddities seen (do not copy)
A test customer record ("Test-1", registration date 2022) sits in the live Customer Register; the project list holds 14 projects, a user is given 2 or 3; a project has Land Area "5.38 Sq. Ft." and another "201 Acres" (wrong units); one residential project lists 204 towers; plan names like "Payment Plan 9:10:81" carry the percentages in the name.
