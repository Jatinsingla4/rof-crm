# Set Projects → Project Set Up: our own verification

Written 2026-10-19 from the code and from tests run by us on a throwaway local database (not Neon). Scope: Create/Edit Project, Add Tower/Plot, Add Unit, Unit Address (unit types), Unit Location Master, Reminder Master. Not covered yet: Payment Plan Setup (11 entries), Charge Master, Add-on Charges, GST Configuration, Rate Report.

## 1. What exists

All six screens are tabs of one page, `packages/web/public/js/pages/set-projects.js` (1657 lines), opened as `#/set-projects?tab=<name>`.

| Menu entry | Tab | API it calls | Backend file |
|---|---|---|---|
| New Project / Edit Project | `new-project`, `edit-project` | `POST /projects`, `GET/PATCH /projects/:id` | `routes/projects.ts` |
| Add Tower / Plot | `add-tower` | `GET/POST /projects/:id/towers`, `DELETE .../towers/:towerId` | `routes/projects.ts` |
| Add Unit | `add-unit` | `POST /units`, `POST /import` | `routes/units.ts`, `routes/import.ts` |
| Unit Address | `unit-address` | `GET/POST/DELETE /master/unit-types` | `routes/master.ts` |
| Unit Location Master | `unit-location` | `GET/POST/DELETE /projects/:id/unit-locations` | `routes/projects.ts` |
| Reminder Master | `reminder-master` | `GET/POST/DELETE /master/reminder-master` | `routes/master.ts` |

How access is decided: `/api/projects`, `/api/units` and `/api/import` are mounted in `index.ts` with `rbac('units')` (super_admin all; project_manager view/create/edit; every other role view only). `/api/master` is mounted with login only. In `master.ts` the Set Master lists have a role check but unit-types, floors, tax-slabs and reminder-master are deliberately left without one (comment at the top of the file).

There is no edit for towers, unit locations or reminders (only add and delete), and no delete for projects or units.

## 2. How we tested

`api-test-project-setup.mjs` in this folder: 81 checks with four roles (super_admin, project_manager, sales_executive, read_only_viewer) against the local test API (port 3002). Plus a browser pass over all seven tabs. Setup of the test database is the same as in `docs/set-master-setup/README.md`.

Result: 37 pass, 44 fail. Some failures follow from one root problem, so section 3 groups them; none were counted twice below.

## 3. Problems found

| ID | Severity | What | Evidence |
|---|---|---|---|
| P1 | **High** | Any signed-in user, including read_only_viewer, can add and delete unit types, reminders and **tax slabs**. | Tested: read_only_viewer created a tax slab with 99% CGST/SGST/IGST (201) and deleted it (200); deleted a unit type (200) and a reminder (200); sales_executive added a unit type and a reminder (201). Cause: `/api/master` has no role check for these paths. Floors share the same router (same code path, not tested separately). Tax slabs feed GST, so this is not cosmetic. |
| P2 | Medium | Wrong input gives HTTP 500 with the raw database error in the response (constraint names, "invalid input syntax"). | Duplicate RERA number; project `totalUnits` = "abc" (create and edit); unknown `companyId`; bad project id in the URL; unknown project when adding a tower, unit or location; tower name of 300 characters; unit floor "abc"; unit carpet area "abc"; `POST /units/bulk-import` with an empty body ("rows is not iterable"). |
| P3 | Medium | No text checks on names: blank (spaces only) and `<`/`>` are saved. | Accepted with 201: project name "  " and `<b>x</b>`, tower "   " and `<i>x</i>`, unit number "  " and `<b>`, unit location blank and `<b>x`, reminder name `<b>`. Set Master blocks `<` and `>` because other pages print names as HTML; these screens do not, so the same risk applies here. |
| P4 | Medium | Duplicate tower silently "succeeds". | `POST .../towers` uses `ON CONFLICT DO UPDATE`, so the same name returns 201 and the screen cannot say "already exists". The same name in another case ("t1" after "T1") creates a second tower. |
| P5 | Medium | A unit can be saved with a tower that belongs to a different project. | Unit created with project B and a tower of project A: 201. The route never checks `tower.project_id`. |
| P6 | Low | Negative values accepted: unit area, unit price, unit-type rate, reminder days. | All returned 201. |
| P7 | Low | Duplicates accepted for unit locations (same name twice) and reminders (same name and days twice). | 201 each time. |
| P8 | Low | Deleting something that does not exist reports success. | Deleting a unit location twice: second call 200. A bad id in the delete URL gives 500. |
| P9 | Low | Reminder with 0 days is rejected ("name and days_before are required") because the check is `!days_before`. Whether a same-day reminder is wanted is a business question. | 400 on days_before = 0. |
| P10 | Low | Project name is not unique (only the RERA number is). May be intended. | Two projects with the same name saved. |

## 4. What worked

- Roles on projects, towers, units and unit locations behave as the matrix says: project_manager can add and edit, cannot delete; sales_executive and read_only_viewer cannot add or edit; everyone can read.
- Unit: required fields, floor required, duplicate number in the same tower gives a clear 409, same number in another tower is allowed.
- Tower delete is blocked while it has units.
- Project create and edit saved the right fields and kept the others.
- UI: all seven tabs open with no console errors.

## 5. Not tested yet

- Real clicking in the forms (add, edit project, delete tower, delete location) and the messages the user sees. Only page load was checked in the browser.
- Add Unit with a unit type attached (the route does not take `unit_type_id`, so the delete-when-in-use guard for unit types could not be exercised).
- Bulk import with a real file.
- Where these values are used later (booking, demands, letters, reports).
- Payment Plan Setup, Charge Master, Add-on Charges, GST Configuration, Rate Report.
- Neon: whether its data and schema match the test database.

## 6. Suggested order for fixes

1. P1 (role check on the master paths that are open).
2. P2, P3, P4, P5 in the project, tower, unit and location routes (one small helper for trimming, markup and ids would cover most of them).
3. P6 to P10 after a decision from the owner on each.

## 7. Fixes done for P1 to P5 (2026-10-19, not committed yet)

Changed files: `packages/api/src/routes/master.ts`, `routes/projects.ts`, `routes/units.ts`, and the rebuilt `packages/api/dist/` for those three. Nothing else.

| ID | Fix |
|---|---|
| P1 | `master.ts`: unit-types, floors, tax-slabs and reminder-master now need the `master_data` permission to change (super_admin all, project_manager add and edit, nobody else). Reading stays open. Side effect to know: project_manager can no longer delete a unit type or reminder (only super_admin), the same rule as towers and unit locations. |
| P2 | `projects.ts` and `units.ts` now end with `pgErrorHandler` (already used by Set Master), so duplicate, unknown id, bad id, bad number and too-long values give 400 or 409 with a plain message, not 500 with the database text. `POST /units/bulk-import` with no `rows` list now gives 400. |
| P3 | Project create and edit (`name`, `location`, `reraNumber`, `tcpLicence`), tower name, unit number, unit location name and description, and reminder name are trimmed; blank and `<` or `>` are refused. This reuses `cleanBody` from `master.ts` (now exported). |
| P4 | `POST /projects/:id/towers` no longer upserts. A tower name that already exists in the project, in any letter case, returns 409. `bulk-import` still creates towers by name on purpose and was not changed. |
| P5 | `POST /units` checks that the tower belongs to the project and returns 400 if not. `bulk-import` was not changed. |

Retest on the local database: the project set-up script went from 37 to 72 passing. The 9 still failing are exactly P6 to P10 (negative values, duplicate locations and reminders, delete of a missing id, 0-day reminder, duplicate project name), which were not part of this round. The Set Master scripts still pass (135 and 19). Direct checks: project_manager can add a unit type, reminder and tax slab and cannot delete; sales_executive and read_only_viewer get 403 on tax slab and floor writes; reading stays 200 for read_only_viewer. Through the page's own `Api` helper the messages come back as "A tower with this name already exists in this project", "towerName cannot contain < or >" and "Invalid value or id". Real clicking in the forms is still not tested.

## 8. Remaining items tested (2026-10-19, local test database)

Browser, against the local API (port 3002). Real clicks: new project form (typed and saved), Add Unit button, Upload for the CSV, delete cross on a tower. The other steps pressed the same buttons through the page and read toasts and the database.

| Item | Result |
|---|---|
| New Project (UI) | Pass, but a company is required in the form (see F7). Saved row had the right company. |
| Edit Project (UI) | Pass: location and total units changed and saved. The long form opens below the project list. |
| Add Tower (UI): add, same name in lower case, `<b>x`, delete cross | Pass. Messages: "A tower with this name already exists in this project", "towerName cannot contain < or >". Delete removed the tower. |
| Add Unit (UI) | Saved. Super area filled itself (500 carpet + 50 balcony = 550). |
| Bulk CSV with a real `File` (5 rows: 2 valid, 1 new tower, 1 blank floor, 1 duplicate) | Rows saved correctly, "Tower New" created. See F3 for the wrong count. |
| Unit Address (unit type) add and delete, Unit Location add and delete, Reminder add and delete | Pass |
| Downstream: project list counts, towers with unit counts, units list, inventory summary, status counts, rate report, floors | Pass: the data entered here shows up correctly |
| Booking form | Pass: project, towers ("Any", Tower A, Tower New) and available units (A-101, B-101, B-102 with area) appear. Payment plan list says "No plans configured" until Payment Plan Setup is done |
| project_manager and read_only_viewer | read_only_viewer gets "Access Denied" on the whole Set Projects page. project_manager can open it and add; delete cross still shown (F9) |

New problems found:

| ID | Severity | What | Evidence |
|---|---|---|---|
| F1 | Low | "No. of Floors" on Add Tower does nothing. | `addTower` sends only `towerName` (`set-projects.js:852`); the route takes only `towerName`. |
| F2 | Medium | Add Unit "Status" (Available / Hold / Booked) is ignored; every unit is saved as available. | Chose Hold, row saved with `status = available`. `POST /units` hard-codes it. |
| F3 | Medium | Bulk import counts a duplicate as added, and makes the tower before checking the floor. | Message said "4 units added · 1 skipped · 1 errors" but 3 units were new (A-101 already existed). `import.ts` does `ON CONFLICT DO NOTHING` then `created++`. A row with a blank floor still creates its tower first. |
| F4 | Low | Unit type names that differ only in case are both accepted in one project. | "2BHK Type-A" and "2bhk type-a" both saved. The unit-types route has no case-insensitive check (Set Master lists do). |
| F5 | Medium | Add Unit form has no price fields, so units made here have no price. | The form has no price input; `POST /units` accepts prices but the page never sends them. Only the CSV carries `basePriceInr` and `totalPriceInr`. This is the known "prices are NULL" gap in CLAUDE.md. Rate report and inventory value use these prices. |
| F6 | Medium (flow) | Unit types made in Unit Address are never linked to units. | No route writes `units.unit_type_id` (it is only read, `units.ts:137`). The Add Unit form picks a BHK list instead. |
| F7 | Medium (flow) | New Project needs a company in the form, but the API treats it as optional. With no company in Set Master, no project can be created from the screen. | Form refused to submit ("Please select an item in the list"). |
| F8 | Low | Messages show field names, and the form clears the Project dropdown after each tower. | "towerName cannot contain < or >"; project must be picked again for every tower. |
| F9 | Low | Delete crosses are shown to roles that cannot delete. | project_manager clicked the tower cross and got "Forbidden". |

Not tested yet: Payment Plan Setup (11 entries), Charge Master, Add-on Charges, GST Configuration, Rate Report screen itself (only its API), Neon.

## 9. Fixes done for the findings in sections 3, 7 and 8 (2026-10-19, not committed)

Changed files: `routes/consumers.ts`, `master.ts`, `projects.ts`, `units.ts`, `import.ts`, `companies.ts`; `web/public/js/pages/set-projects.js`, `js/permissions.js`, `pages/login.html`; rebuilt `packages/api/dist/`. The repo `CLAUDE.md` was deleted at the owner's request.

| ID | Fix |
|---|---|
| P6 | Unit area and price, unit-type numbers and reminder days must be numbers of zero or more (create and edit). |
| P7 | A unit location name, a reminder (name and days) and a unit-type name (case-insensitive, inside the project) can no longer be saved twice. |
| P8 | Deleting a tower or unit location that does not exist returns 404. |
| P9 | A reminder with 0 days is allowed (the old check treated 0 as empty). Days must be a whole number. |
| F1 | "No. of Floors" removed from Add Tower (it was never saved). |
| F2 | "Status" removed from Add Unit (new units are always available; the route never used it). |
| F3 | Both bulk imports count only rows really inserted; a duplicate is reported as skipped with a reason. `/import` checks the floor before creating the tower, so no empty tower is left behind. |
| F4 | Unit-type names are unique ignoring case inside a project. |
| F5 | Add Unit has Base Price and Total Price fields and sends them. |
| F6 | Add Unit has an optional Unit Type list (loaded for the chosen project). `POST /units` accepts `unitTypeId` and refuses one from another project. The unit list shows it as `unit_group`. |
| F8 | Messages use plain labels ("Tower name cannot contain < or >"); the Project list stays selected after a tower is added. |
| F9 | Delete buttons on towers, locations, unit types and reminders are shown only to super_admin. Names on these lists are now escaped when shown. |
| S1 | Salutation names are limited to 20 characters (the consumer column size), on add and rename. |
| S5 | A logo is first saved under a temporary name; the file's first bytes must be PNG, JPEG or GIF; only then it gets its real name (by its real type) and an older logo with another extension is removed. A bad upload never replaces the current logo. |
| S6 | When no page access is configured (empty `nav_pages`), pages are allowed instead of denied for everyone except super_admin. The server still enforces each role. |
| S7 | Login form has `method="post"`, so a submit before the script is ready no longer puts the password in the URL. |
| X1 | `PATCH /consumers/:id` works. The name column now uses the name sent, else first and last name, else the old name; the unused `$1` that made Postgres fail is now used. |
| S3 | No change needed: the only foreign key to `banks` is `receipts.clearing_bank_id`, which the delete guard already covers. |

Tests after the fixes (local database): `api-test-fixes.mjs` 41 of 41; `api-test-project-setup.mjs` 80 of 81 (the one failing check is P10, left as is); Set Master scripts 134 and 19 pass. Browser: Add Tower (no floors field, project stays selected), Add Unit (price and unit type fields, saved with price 4,500,000 and unit type), project_manager opens Set Master and Set Projects without any `nav_pages` rows and sees no delete buttons.

## 10. Decisions and the remaining fixes (2026-10-19, not committed)

The owner decided P10 (project names must be unique). The other open items were decided on real-estate CRM practice and fixed.

| ID | Decision and fix |
|---|---|
| P10 | Project names are unique ignoring case (`POST /projects`, and rename in `PATCH /projects/:id`; saving the same name again is fine). |
| F7 | A project must have a company: `POST /projects` returns 400 without a valid `companyId`. Reason: receipts, demand letters and allotment letters print the project's legal entity. Editing cannot clear it. |
| S2 | Migration `097_unique_names_case_insensitive.sql` adds case-insensitive unique indexes (countries, banks, salutations, professions, nationalities, sources of enquiry, companies, projects, states, cities, towers, unit types, unit locations). An index is created only when that table has no duplicates yet, otherwise it logs a notice and skips, so the deploy can never fail on old data. Safe to run again. Two requests at once now end in 409 (tested: 8 parallel project creates give one row). Before relying on it in Neon, run the migration there and check the logs for "Skipped". |
| S8 | The main applicant's Resident / PIO / NRI / OCI choice stays fixed because the NRI GST rules depend on it. The additional applicant's Nationality box now suggests the names from the Nationality master (`booking.js`, one input and a datalist). |
| S9 | The project's company is now the source in the two places that used the global one: the applicant ledger query in `payments.ts` (company name) and the `project-collection` report header in `reports.ts` (the company when all projects in the report share one, otherwise the global company). `documents.ts` already preferred the project's company. Tested with two companies. |

Also: `dist/db/migrations` now holds migrations 096 and 097 (096 was missing there before).

Tests after these changes (local database): `api-test-fixes.mjs` 47 of 47, `api-test-project-setup.mjs` 81 of 81, Set Master scripts 134 and 19, all passing.

Still open: Neon has not been checked (data, `nav_pages`, running migrations 096 and 097), and Payment Plan Setup, Charge Master, Add-on Charges, GST Configuration and the Rate Report screen are untested. Not changed: the receipt print path outside the applicant ledger, which should be read once when Receipts are tested.
