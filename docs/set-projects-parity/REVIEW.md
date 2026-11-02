# Set Projects: review, order of work and UX decisions (2026-10-30)

## 1. The order a user should work in (and now sees)
The screen is a checklist of five steps, in the order the data depends on itself. Each tab is named in plain words.

| Step | Tab | Why here | Needs first |
|---|---|---|---|
| 1 Project | New Project, Project Details | everything hangs on the project; New Project now takes all details in one click | nothing |
| 2 Structure | Towers | units live in a tower (a plot project uses one "tower" per block) | project |
| 2 | Unit Types | a unit takes its areas, rate and type from here, so it comes before units | project |
| 2 | Locations | optional label for a unit (corner, park facing) | project |
| 3 Units | Add Units (one / many by floors / CSV), Edit Unit | the bulk of the typing; the many-at-once way is the default while a project has no units | tower, unit type |
| 4 Money | Payment Plans, Other Charges, Interest (own pages, opened from here) | plan rows reference charges; interest needs a start date | units |
| 5 Rules | Numbering, Classification, Reminders | defaults work without them; change only when the client's rules differ | project |
| Reports | Rate Report | read only | units |

The "Setting up" guide on top shows, for the chosen project, which of towers, unit types, units, complete plans and interest rate exist, and highlights the next one. It is a checklist, not a blocking wizard: every tab stays open at any time.

## 2. What research said, and what we took from it
- Sell.Do and DomusHub both model project, tower, floor, unit, and keep reusable unit layouts so one change reaches all units of that layout. Taken: a unit type change can be carried to its unbooked units ("Update units", asked after an edit); units take areas and price from their type.
- Onboarding guidance (checklist of 5 to 7 items, wizard only for blocking steps, progressive disclosure, designed empty states): Taken: the checklist, "More options" folded in Unit Type, empty states that say what the thing is and what to do, one-click next step in the guide.
- Bulk work: the many-at-once tool (floors x units per floor) and the CSV are one row of choices in Add Units instead of three stacked blocks.
- Not found in public sources: how to validate a bulk upload. We keep our own rule: every row passes the same checks as one unit, and the result lists what was skipped and why.

Sources: [Sell.Do projects, towers, units](https://www.sell.do/real-estate-crm/inventory-and-negotiations/projects-towers-units), [Sell.Do inventory software](https://sell.do/real-estate-crm/inventory-software), [DomusHub on TrustRadius](https://www.trustradius.com/products/domushub-io), [onboarding wizard guide](https://kompassify.com/blog/onboarding-wizard-guide), [progressive disclosure](https://userpilot.com/blog/progressive-disclosure/). These are mostly vendor pages, so they are used as ideas, not as proof.

## 3. Section by section
| Section | Verdict | Done | Still to do |
|---|---|---|---|
| New Project / Project Details | was split (9 fields vs 30) | one shared form, legal block shared, saved complete in one click, project type and land unit, dates no longer shift | RERA and TCP are still compulsory (the client has neither on the card) |
| Towers | fine | prefix, sort order, completion date, edit in place, clearer empty state | floor naming pattern (1,2,3 / 1st,2nd) |
| Unit Types | most important master, was thin | all client fields, essentials first and rest folded, rate basis and payment-file areas fill themselves, edit in place, rate history, "Update units", empty state | none known |
| Locations | fine | used by Add Unit and Edit Unit | PLC by location shown next to the unit charges |
| Add Units | was the weakest | unit type first, areas and price filled, next number suggested, location, charges on the unit, one row of three ways (one, floors, CSV); the CSV takes unitType and location by name (unitNumber, tower, floor, unitType are enough) and the template is made in the browser (the old button opened an address that did not exist) | none known |
| Edit Unit | was missing | number, floor, facing, location, type, areas, price, charges; a booked unit keeps number, type, areas, price; below it, change the price of many unbooked units by % or by amount (look first, then apply) | none known |
| Money (plans, charges, interest) | own pages | plan type and note; other-charge flags; interest type and basis; booking reads the flags | % of basic type; parking stock |
| Numbering | new | receipt and registration prefix, digits, Automatic / Manual, wired into real numbers | none known |
| Classification | new | list per project used by booking, applicants and booking edit | none known |
| Reminders | fixed | project, prefix, rank (old Channel box removed) | nothing reads this master yet (as before) |
| Rate Report | unchanged | | add rate history |

## 4. Honest list of what is not good yet
- Removed: the old inline payment-plan screen and its methods in `set-projects.js` (about 700 lines with the add-on percentage modal); the router forwards those tabs to Payment Plans.
- Dates: the database returns DATE columns as JS dates, which shifted a day in two places (fixed there). Other screens may have the same fault; a global fix needs the whole suite re-run.
- Playwright was run on the whole suite against the local test database: it found one real fault (a stray closing tag put the CSV and many-units blocks outside the Add Units panel), two specs that still expected the old country form and the old template download (updated), and some slow-run timeouts that pass on a rerun (dashboard buttons, allotment future date, roles grid). All 25 tests of `flows.spec.ts` and all of `parking-import.spec.ts` pass.
- Authentications, customer-wise timely discount, plot / villa count and the 12-field unit area are not built (nothing here reads them).

## 5. How to check it yourself (ten minutes)
1. Open Set Projects: the guide on top lists the steps; click Unit Types.
2. Add a unit type with only a super area and a rate; see the rate basis and payment-file area fill themselves.
3. Add Units: with a project that has no units it opens on "Many"; make 3 floors x 4 units; the price comes from the type.
4. Change the type's rate, save; answer yes to "Update units"; open Unit Status and see the new price.
5. Add Units, One unit: pick the type, note the areas fill, attach a charge with quantity 2, save, see the next number suggested.
6. Numbering: set Manual for receipts; open Receipts and see the Receipt No. box for that project only.

## 6. Later changes (2026-11-02), found by filling every tab and every dropdown by hand
- Project: Edit Project saves RERA, TCP, land area (4 decimals), possession date, income category; duplicate RERA is 409 on create and edit; a blank name is 400. Per-project balcony limits (largest area, largest amount) in the Balcony charge tab.
- Units: Delete unit (only an available unit nothing uses); CSV and the many-at-once tool carry unit type and balcony area; facing is one of the eight directions (short codes such as SE are stored in full); the next unit number is suggested when a tower is picked; Total price follows Base price unless typed on purpose; bulk price skips units with no price and names the unit that would go to zero.
- Unit types: unit type rename reaches its units; a plot type picks "Plot Area" as the rate basis by itself.
- Locations and Reminders can now be edited (PATCH routes); the project stays chosen after adding a reminder.
- Charges: any named charge can be made from the unit screen (fixed or per sqft on carpet, super, balcony or plot area); a "when is it billed" choice (booking, possession, equal, or custom split) writes the plan shares for every plan nobody has booked; a flat charge of 0 is refused on the Other Charges screen.
- Payment plans: an empty plan keeps its type and note until its first row is added (was "Plan not found").
- Interest: Print and Download work (they were pictures); messages no longer vanish early, native alert boxes replaced; error text names "Interest rate" and "Effective date".
- Tests: set-projects-parity 211, unit-charges 28, plus the earlier suites; flows and parking-import specs 39/39.

## 7. What is still not built
Floor naming pattern and Edit Floor, plot / villa count, the 12-field unit area, authentications, customer-wise timely discount, "% of basic" charge type, parking stock, the Unit Status "Group" column (shows the unit type name, not the type's group), and a global fix for DATE columns that shift a day. Client answers still needed: which documents print UDSL and areas, whether the client's super area includes the balcony, and the default "when billed" for new charges.
