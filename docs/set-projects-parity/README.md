# Set Projects: the client's tabs against ours (read first, built second)

Date 2026-10-29. Source of the client side: the Set Projects menu of the client CRM, every screen's fields and the data in its View (projects ROF GALLERIA@78 and ROF AMBLISS), saved in `docs/client-crm/captured/` parts 1, 6, 9 and 13. Our side: `set-projects.js`, `payment-plans.js`, `charge-master.js`, `plc-charges.js`, the add-on screens, `gst-configuration.js` and their routes, read in the code and tried against a local copy (never live).

## 1. Tab by tab
Status words: **BUILT** (coded and tested), **CODED** (written, compiles, migration run twice, **not tested yet**), **OPEN** (nothing built).

### Create Project
| Client tab | What the client has | Ours | Status |
|---|---|---|---|
| Add Tower/Plot | project + number of towers | Add Tower / Plot | had |
| Add Base Floor | floor naming pattern 1,2,3 / 1st,2nd / First,Second, prefix or suffix, number of floors, generate | floors exist; no pattern generator | OPEN |
| Floor Creation | copy base floor to floor names, units per floor, **copy a floor to other towers** | Add Unit | OPEN |
| Unit Type Creation | Group, Type Per Area / In Fix, Salable, name, Super / Built-up / Carpet / UDSL / Plot (+unit) / Balcony areas, Rate, **Effective rate on**, areas shown on payment file, construction and UDSL cost, date, unit of measurement, unit map, Add Group | name, description, carpet, balcony, rate (2 decimals of area, whole-rupee rate) | **BUILT**: migration 127, `master.ts`, 47-check test |
| Floor Wise Unit Allocation | choose project, tower, floor; address order preview; copy address from another floor | Add Unit | OPEN (client screen not readable with this login) |
| Pre-Attach PLC / Other Charges | attach a PLC or other charge to many units of a tower | none | OPEN |
| Address Owner Master | (empty here) | none | OPEN |
| Unit Location Creation | location name + description per project | Unit Location Master | had |

### Edit Project
| Client tab | What the client has | Ours | Status |
|---|---|---|---|
| Edit Tower | Total Floor, New Name of Tower, **Prefix for unit address, Sort Order** | rename only | **BUILT**: `PATCH /projects/:id/towers/:towerId` (name, address prefix, sort order, completion date), migration 128 |
| Edit Floor | floor name, unit count per floor, new floor name | floors | OPEN (check) |
| Change No. of Plot/Villa | plot projects: unit types with a count and "Add On Unit" | none | OPEN |
| Edit Unit Address and Location | per unit: old address, new address, location, image upload / download, configuration info | Unit Address tab | OPEN (verify image and config) |
| Change Unit Area (one unit, effective date), Unit Wise Area, Unit Wise Area Report | 12 area fields per unit (super, built-up, carpet, UDSL, plot, 3 balconies, basement, stilt, common) | super, carpet, balcony | OPEN |

### Payment plan
| Client tab | What the client has | Ours | Status |
|---|---|---|---|
| Payment Plan Creation | plan name, **plan type** (Construction / Down Payment / Flexi / Time), % or fixed, **timely discount**, discount per area / %, **"100%" or "100 - discount"**, description, then "create installments?" | plan = rows in `plan_schedule_templates`, no plan header | OPEN (needs a plan header table) |
| Stage Master | stages with type (Time link / Construction link) and rank | stages inside plans | OPEN (verify) |
| Set Booking Amount | amount per unit type group x unit type x plan, with Copy | booking amount in booking | OPEN (empty for both projects) |
| Create Installment / Edit / PLC and Other Charge installments | installment name, BSP %, **and one % column per other charge** (Ad, Balcony, Restoration, Parking) | plan rows with types installment, booking, possession, plc, other_charge | partly had (verify per-charge % columns) |
| Customer Wise Timely Discount | per customer discount, only when a plan has it on | none | OPEN (unused here) |
| Edit Personal / Personalise Installment | move a customer to another plan or edit own installments | plan-personalise tab | had (verify) |
| Raised Demand Stage / View Payment Plan | per stage the towers raised with installment and forecasting dates | Demand Raise | OPEN |
| Reminder Days Configuration | Reminder Name, Days, Prefix, Rank per project: AMBLISS **Reminder 10 days R1 rank 1; Cancellation Letter 20 days R2 rank 3; Final Opportunity Letter 45 days T rank 2**; GALLERIA Reminder 1 = 10, Reminder 2 = 20 | one global list (name, days, channel) | **BUILT**: route stores project, rank and prefix; list by project; no repeat of a rank in a project |
| Demand Format Customization | letter parts Top / Bottom per type and project | Customized Letters | had |

### Charges
| Client tab | What the client has | Ours | Status |
|---|---|---|---|
| Other Charge master | per project: name, % / per area / fixed, calculate on basic or after discount, Mandatory, Is Parking, Inventory Base, Multiple Booking, Alteration, Is Agreement, Amount, **Quantity**, Effective Date, description | add-on master is already per project with a per-plan % table (`plan_addon_charge_pct`) | **BUILT (API)**: flags, quantity, effective date, description (migration 129, 95-check test). OPEN: the screen, "% of basic" type, parking stock from quantity, flags not yet used by booking |
| PLC master | name, type, calculate on, amount, effective date | PLC charges by location | had (verify fields) |
| IFMS master | name, amount, effective date, Fix / Per Area | in reports and GST only | OPEN |
| Extra Add On Charge Master | Charge, **Charge Type, Amount Type, Apply Date Type (Possession / Customer Wise Date), Calculate Rate Type (Old Area), Is Include In Dues** | name, amount, GST %, flat or per sq ft | **BUILT**: charge type, apply date type, calculate rate type, include in dues on create and edit, migration 128 |
| Set / Bulk / Cancel / Waive off add-on | per customer, 5 screens | all 5 | had |

### Tax, GST, switches, rates
| Client tab | Ours | Status |
|---|---|---|
| Tax Master / Tax Information / Tax Report / Completion Certificate (legacy service tax, per-tower completion date) | none | OPEN (owner decision; completion date is stored on the tower by migration 128) |
| GST: user rights, configuration (8 tabs), ITC (3 tabs), invoice prefix, customer wise GST discount, GST number | GST Configuration, GST Invoicing | had except customer wise discount; invoice prefix partial |
| Automated / Manual: booking authentication, receipt number (prefix + mode per receipt type), registration number (mode + size), broker, transfer | none | OPEN |
| Project Set Up: Customer Classification master, Project Configuration Detail (one-page summary) | classification fixed list | OPEN |
| Set Rate: Change Rate (per unit type, rate + date, history), Change Charges Rate (PLC / Other / IFMS), Rate Report | Rate Report only | OPEN (unit type now keeps a rate date; no history) |
| Interest master (inside Project Configuration Detail): 15.00 %, Simple, effective 01 Jan 2022, compound frequency, calculated on "Receipt Date Wise" | rate and date only | **BUILT**: interest type, compound frequency, calculated on, `payments.ts`, migration 128 |
| Project card | project type (Commercial / Residential / Plotting / Group Housing / SCO), land area with unit | name, location, land area (sq ft only), RERA and TCP required | **BUILT**: `PATCH /projects/:id/card` (project type, land area unit); RERA / TCP are still required |

## 2. What changed in our code (all uncommitted)
- Migrations: `127_unit_type_parity.sql` (tested), `128_set_projects_parity2.sql` (run twice, not yet tested). Both idempotent.
- `master.ts`: unit type (all fields, 4 decimals, validation) and reminder master per project.
- `addon-charges.ts`, `payments.ts` (interest master), `projects.ts` (card, tower): the CODED rows above.
- Test: `docs/set-projects-parity/api-test-set-projects-parity.mjs`: 47 checks (unit type and reminders; own data, roles, hostile input, random run), passes with two seeds. **Batch 2 (add-on options, interest type, card, tower) is tested too: 95 checks in all (with the Other Charge flags).**
- Screens (2026-10-30, tried in the browser on the local demo): Unit Address tab = full unit type form (essentials first, "More options" folded; rate basis and payment-file areas fill themselves from the areas typed; edit in place; list shows group, super, rate and basis); Reminder Master = project, prefix, rank (old Channel box removed: it was stored in the prefix column); Add Tower = prefix, sort order, completion date, Edit; Edit Project = project type and land area unit; Add-on Charge Master = charge type, apply date, quantity, effective date, description and the flags; Interest Master = Simple / Compound, frequency, calculated on.
- Found and fixed while trying the screens: a unit type rate date came back one day early (a DATE read as a JS Date), so an edit would have moved it again; the unit type routes now send the plain day (test added, 98 checks).
- Decision (owner style): IFMS is not a separate master; it is an add-on charge with charge type IFMS. A setting that nothing reads is not shipped.

## 2b. Added after the first screens (2026-10-30, all with tests and checked in the browser)
- **Plan header**: plan type (Time Linked, Construction Linked, Down Payment, Flexi) and a note per plan; migration 130; list shows them, copy keeps them, delete removes them.
- **Customer Classification per project**: own list per project (a project with none keeps EWS, LIG, MIG); the booking form, applicants and booking edit accept only that list; rename follows the customers; a name in use cannot be deleted; migrations 131 and 132 (the column was a fixed enum, now text).
- **Numbering per project**: receipt prefix and Automatic / Manual, registration prefix, digits and Automatic / Manual; wired into real receipt and booking numbers (migration 133, `api-test-numbering.mjs`, 25 checks); the receipt form shows a Receipt No. box and the booking form an editable Registration No. only for a Manual project.
- **Create floors and units**: pick tower, unit type, floor range and units per floor; price comes from the unit type rate on its rate basis; uses the same checked import as the CSV (so numbers already there are skipped); running it for another tower is the "copy floor to other towers".
- **Rate history** of a unit type (migration 134): a line for every new rate, rate basis or rate date.
- Decisions: the booking, journal, unit shift and transfer authentications are not shipped (no approval flow reads them here); timely discount is not shipped (the client has it off in both of their projects); Set Booking Amount and Address Owner are empty in the client; 12-field unit area, plot / villa count and Edit Floor stay out until the owner asks (no client project uses them).

## 2b2. User flow (2026-10-30)
Found by walking the screens as a user, not by comparing fields: New Project had 9 fields while Edit Project had about 30 (legal details, project type, land unit), so half the project was filled in Edit; Add Unit needed the type typed by hand, computed the super area as carpet + balcony (wrong: it is its own number), had no Location and could not be corrected later; project dates in Edit Project showed one day early and moved again on every save.
Fixed: New Project and Edit Project use one shared Legal and Registration block and a new project is saved complete in one click; Add Unit is Project, Tower, Unit Type first (areas and price fill from the type, rate on its rate basis), then number and floor, then optional facing and location; after Add Unit the place and type stay and the next number is suggested; new Edit Unit tab (number, floor, facing, location, type, areas, price; a booked unit keeps number, type, areas and price); the API takes unitLocationId and unitTypeId on create and edit; a Setup guide on top of Set Projects shows towers, unit types, units, complete plans and interest rate for the chosen project and points to the next step.

## 2b3. Charges on a unit (2026-10-30)
Add Unit and Edit Unit have a "Charges on this unit" section: the project's other charges (Add-on Charge Master) as rows; tick to attach, quantity where the charge is set for Multiple Booking (otherwise 1), a Mandatory charge is shown ticked and fixed, and a charge that no plan bills yet shows "not in any plan yet". Saved with the unit (`charges` on create, `PUT /units/:id/charges`, `GET /units/:id/charges`); locked once the unit has a booking (migration 135, `api-test-unit-charges.mjs`, 17 checks).
The booking now reads the add-on flags: when a booking is completed, the customer gets the charges that are Mandatory or attached to the unit (amount x quantity), and the plan percentages bill them. **Behaviour change:** a charge with a % in a plan used to go on every booking of that plan; it now goes on only when Mandatory or attached. Migration 136 marks the charges that already had a plan % as Mandatory so existing projects behave as before; `api-test-end-to-end.mjs` creates its charge as Mandatory.
Not done: the PLC of a unit location is not shown in this section (PLC is still priced by location in its own screen); parking stock from quantity and Inventory Base are stored but nothing counts them yet.

## 2b4. Last round (2026-10-30)
Removed the dead inline plan screen; CSV unit import names unit type and location; template built in the browser; price of many unbooked units by % or amount (`POST /units/bulk-price`); unit type changes can be carried to unbooked units (`POST /master/unit-types/:id/apply-to-units`). See REVIEW.md for the section-by-section review and the Playwright run.

## 2c. Still open
Parking stock and Inventory Base (flags are stored, nothing counts them); the three authentications; Customer Wise Timely Discount; 12-field Unit Wise Area; Plot / Villa count; Edit Floor; the "% of basic" type on an add-on charge.

## 3. Next, in order
1. (done) CODED rows tested: 81 checks, suite green.
2. Other Charge master per project with its flags and quantity, and the per-installment % for each charge (the central missing master).
3. Plan header (type, % or fixed, timely discount, discount calculate, description).
4. Per-project switches (receipt prefix and mode per type, registration mode and size, authentications).
5. Edit Floor / pattern generator / copy floor, plots and villas, 12-field Unit Wise Area, Change Rate history, Customer Classification master, IFMS master.
6. The screens for everything above.

## 4. What was not readable on the client side
Floor Wise Unit Allocation (empty project list for this login), Unit Wise Area results, GST Configuration contents for these projects, anything that needs a save to show. Those rows say OPEN or "verify" for that reason.
