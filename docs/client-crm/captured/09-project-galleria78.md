# One whole project from the client CRM: ROF GALLERIA@78 (structure and setup only, no customer data)
Read on 2026-10-29 from the live screens. This is the sample used to check that our CRM can hold every field.

## Project card (Project Details report + Project Configuration Detail)
- Company: **Pegasus Land and Housing Private Limited** (the receipt screen offers 5 companies; the customer sample shows this one as "Received For").
- Name ROF GALLERIA@78, type **Commercial**, location "SECTOR - 78", land area 2.45 Acres, total towers 1, total units 32, sold 30, unsold 2.
- Tower: one tower named "Ground"; "Total Floor" 1; the screen also has New Name of Tower, Prefix Name of Unit Address, Sort Order (all blank). Floor: one floor named "Ground Floor". Completion Certificate Master: tower Ground, completion date blank.
- Project interest master: **15.00 %, Simple, effective 01 Jan 2022, compound frequency blank, calculated on "Receipt Date Wise"**.
- Receipt numbering: Normal Receipt, Automatic, prefix `ROF-GALLER` (numbers like ROF-GALLER0001); registration no: Manual, size 6; booking authentication: all Automatic; transfer authentication: Automatic.
- Broker mapped to the project: only "Direct" (broker code ROF1) for this user.
- GST: financial year 01 Apr 2019 to 31 Mar 2024 exists; slabs, GST tax setup and charge mapping empty for this project; Tax Master has one old row "0%_OLD", effective 24/12/2000, demand basis, service tax 0, surcharge 2.000, education cess 1.000, total tax 0, active, Manage Advanced = Yes, Freezing = No.
- Empty for this project: booking amount master, PLC master, other charge master, IFMS master, extra add-on charge master, document dispatch master, unit location master, customer classification, parking types, pre-attached PLC/other charges, invoice prefix, GST number.

## Unit type master (3 rows, group "Shop")
| Unit type | Super | Carpet | Built-up / UDSL / Plot / Balcony | Rate | Effective rate on | Type | Area type | Date | Show on payment file |
|---|---|---|---|---|---|---|---|---|---|
| 510 Sq. Ft. | 510.0000 | 255.000 | 0 | 5000.000 per Sq. Ft. | Super Area | Per Area | Salable | 24/12/2022 | Super Area, Carpet Area |
| 550 Sq. Ft. | 550.0000 | 296.000 | 0 | 5000.000 | Super Area | Per Area | Salable | 24/12/2022 | Super Area, Carpet Area |
| 950 Sq. Ft. | 950.0000 | 475.735 | 0 | 5000.000 | Super Area | Per Area | Salable | 24/12/2022 | Super Area, Carpet Area |
Unit of measurement Sq. Ft.; construction cost 0; UDSL cost 0; Plot area measurement "Sq. Ft." (N/A on the first); Edit / Delete / View-Download (unit map). Rate report shows the same three rates and date.

## Units (32, all on Ground Floor of tower Ground)
G-01 (950 Sq. Ft., Available), G-02 to G-30 (510 Sq. Ft.: 27 Alloted, 2 Booked), G-31 (950 Sq. Ft., Alloted), G-32 (550 Sq. Ft., Available). Unit address list columns: Unit Type, Tower, Floor, Area, Old Address, **New Address**, Location (pick list), Upload Image, Download Image, **Configuration Info (New)**. Unit status text for an allotted unit carries the allotment date, e.g. "Alloted (14/02/2024)".

## Payment plans (10, all Construction Plan, % type, discount 0, "100 %" calculation, timely discount No, Active)
| # | Plan | Installments |
|---|---|---|
| 1 | PLP@78 | 4 |
| 2 | CLP@78 | 5 (10 / 30 / 20 / 30 / 10 % of BSP: booking, within 30 days of booking, start of excavation, casting of ground floor slab, offer of possession) |
| 3 | PLP@78 40:60 | 3 |
| 4 | PLP@78 30:70 | 3 |
| 5 | Payment Plan 9:10:81 | 3 (9 / 10 / 81) |
| 6 | Possession link plan 15:25:30:30 | 4 |
| 7 | Payment plan CLP 5:5:30:30:30 | 5 |
| 8 | Payment Plan 5:95 | 2 |
| 9 | Payment Plan 10:90 | 2 |
| 10 | Payment Plan 10:40:50 | 3 |
(Installment names and percentages of each plan: see the block at the end of this file.)
Stages raised so far (Raised Demand Stage): On the Start of Excavation, On Casting of Ground Floor Slab, On Completion of Super Structure, On Intimation for Offer of Possession. Stage Master: Stage Name, Type (Time Link / Construction Link), Rank, Action.

## Reminders, letters, documents
- Reminder 1 = 10 days (prefix R1, rank 1); Reminder 2 = 20 days (prefix R2, rank 2).
- Letters saved (8 parts): Demand top + bottom, Receipt top + bottom, Reminder1 top + bottom, Reminder2 top + bottom (titles: "Reminder on the outstanding amount due against ...", "Final Reminder for Outstanding Amount"). Receipt top text uses @CustomerWithCoApp@.
- Document master (7 rows, all "On Booking"): Physical Application Form (Individual, mandatory Yes), Document 2, 3, 4, 5 (Individual, No), Physical Application Form (Company, mandatory Yes), Document 1 (Individual, No).

## Booking form facts for this project
Unit types offered 510 / 550 / 950; Tower Ground; Floor Ground Floor; plans as above; Broker list "Direct"; sales employee list is filtered; Other Costs shows no PLC/other charge here; documents list as above; finance banks list (22).

## Installments of every plan (name, % of BSP)
- **CLP@78**: At the time of booking 10; Within 30 Days of Booking 30; On the Start of Excavation 20; On Casting of Ground Floor Slab 30; On Intimation for Offer of Possession 10.
- **PLP@78**: At the time of booking 10; Within 30 Days of Booking 30; On Completion of Super Structure 30; On Intimation for Offer of Possession 30.
- **PLP@78 40:60**: booking 10; Within 30 Days 30; Offer of Possession 60. (The name says 40:60; the percentages are 10 + 30 + 60.)
- **PLP@78 30:70**: booking 10; Within 30 Days 20; Offer of Possession 70. (Name says 30:70; real 10 + 20 + 70.)
- **Payment Plan 9:10:81**: booking 9; Within 30 Days 10; Offer of Possession 81.
- **Possession link plan 15:25:30:30**: booking 15; Within 30 Days 25; On Super-Structure or 12 Months whichever is earlier 30; Offer of Possession 30.
- **Payment plan CLP 5:5:30:30:30**: At the time of submission of application 5; On Allotment 5; with in 30 Days 30; On Completion of Super Structure 30; Offer of Possession 30.
- **Payment Plan 5:95**: booking 5; Offer of Possession 95.
- **Payment Plan 10:90**: booking 10; Offer of Possession 90.
- **Payment Plan 10:40:50**: booking 10; Within 30 Days 40; Offer of Possession 50.
All ten add up to 100. Installment names are free text and are repeated across plans ("At the time of booking", "On Intimation for Offer of Possession"). Two plan names do not match their own percentages (data quality).
