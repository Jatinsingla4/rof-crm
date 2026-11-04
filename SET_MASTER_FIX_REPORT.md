# Set Master fix report

Date: 2026-11-04. Branch `main`, working tree was clean before this work (checked with `git status`). Nothing was committed, pushed, merged or deployed.
Labels: **RUNTIME-VERIFIED** (run against a live API and a disposable database, or in a browser), **SOURCE-VERIFIED** (read in code only), **UNVERIFIED** (not tested).
Every path in the audit report was re-checked against the current code before changing anything.

## A. Summary

| | Count |
|---|---|
| Issues investigated | 15 (SM-001 to SM-015) |
| Confirmed as real | 14 (SM-007 is a design question, not a defect; its sub-items were confirmed as "stored but unused") |
| Fixed | 12 (SM-001, 002, 003, 004, 005, 006, 008, 009, 010, 012, 013, 014) |
| Partially fixed | 2 (SM-011, SM-015: the safe parts are done, a business decision is left open) |
| Needing a business decision | 1 (SM-007), plus open parts of SM-003, SM-011, SM-015 |
| Still open | SM-007 (left unchanged on purpose) and the decision items in section F |

Test evidence in short: a new regression script (171 checks) fails 90 checks on the original code and passes all 171 on the fixed code. The 3 existing Set Master API scripts (249 checks) still pass. Playwright: 29 of 29 pass (25 existing browser flows plus 4 new). `tsc --noEmit` is clean. Lint could not be run (no ESLint config exists in the repo).

## B. Issue by issue

### SM-001 Area types and currencies usage protection. FIXED, RUNTIME-VERIFIED
- Finding confirmed on the original code (audit run): rename and delete of an in-use area type returned 200, then the unit type could no longer be edited. Root cause: `/area-types` and `/currencies` routes had no in-use check and `/usage` had no keys for them, so the screen showed "-" and an enabled Delete.
- Real consumers found by checking the schema and code: `projects.land_area_unit`, `unit_areas.area_measurement`, `unit_types.unit_of_measurement`, `unit_types.plot_area_unit` (matched without regard to letter case, as the other routes do). No table holds a currency name, so a currency is never "in use".
- Changed `packages/api/src/routes/master.ts`: `areaTypeUse` and `areaTypeInUse`; PUT (when the name changes) and DELETE of area types return 409 `"X" is used on N record(s) (projects, unit types or unit areas)...`; `/usage` now returns `areaTypes` (one query) and `currencies: {}`. The screen needed no change: it already reads `usage.areaTypes`, shows "Used on", and disables Delete (RUNTIME-VERIFIED in the browser).
- Tests: `docs/set-master-fixes/api-test-set-master-fixes.mjs` (usage count, rename 409, delete 409, unchanged data, unused rename and delete OK, project land unit counted, currency delete OK); `e2e/set-master-fixes.spec.ts` (count shown, Delete disabled, rename error, enabled again once unused).
- Remaining risk: a future table that stores an area type name must be added to `AREA_USERS`.

### SM-002 Reminder uniqueness per project. FIXED, RUNTIME-VERIFIED
- Confirmed: the same name and days in a second project gave a generic 409. Root cause: migration `107_reminder_unique.sql` created `uq_reminder_name_days` on `(lower(name), days)` without the project, while the route checks per project. The live index was read from the test database.
- New migration `144_reminder_unique_per_project.sql`: drops the old index and creates `uq_reminder_name_days_project` on `(lower(reminder_name), days, COALESCE(project_id, zero-uuid))`. The new key is looser than the old one, so no existing row can violate it and no existing data is touched or deleted. Run twice without error (CI runs every migration twice).
- Tests: two projects with the same name and days (also another letter case), duplicate inside one project 409, global reminder allowed once and a second global 409, the index definition, and a direct SQL insert proving the database refuses an in-project duplicate. Route code needed no change (its pre-check was already per project).
- Remaining risk: the migration must be applied to the real database by the normal pipeline (`.github/scripts/apply-migrations.sh`); until then SM-002 persists there.

### SM-003 Project-limited manager changing global records. FIXED for project-bearing tables, RUNTIME-VERIFIED; wider part is a decision
- Confirmed: row level security treats a row with no project as writable by everyone (`100_project_scope.sql`), so a manager limited to project A edited global document types and reminders.
- Added `globalGuard(table)` in `master.ts` (uses `isScoped()` from `db/pool`) on document types, reminders and dispatch master: a limited login gets 403 when creating without a project, changing or deleting a row with no project, or moving a row to "no project". Rows of its own project work; rows of another project stay hidden (404). Super admin and an unlimited manager are unchanged (RUNTIME-VERIFIED).
- Unit types and customer classifications always carry a project, so row level security already covers them (checked).
- Open (decision): tables with no project column (countries, states, cities, salutations, professions, nationalities, sources, area types, currencies, banks) are still editable by a limited manager because the `master_data` role permission allows it and these are not per-project data. Restricting them would stop limited managers from using Set Master at all.
- Direct API calls with POST, PUT, PATCH, DELETE were tested, not only the screen.

### SM-004 Company bank account exposure. FIXED, RUNTIME-VERIFIED
- Confirmed: `GET /companies`, `GET /companies/:id` (legacy `bank_account_no`) and `GET /companies/:id/bank-accounts` (`account_number`) returned full numbers to every role.
- `routes/companies.ts`: `forRole()` masks to `XXXX` plus the last 4 digits (same format as the audit log) for every role except `super_admin` and `accounts_finance`, at the API layer, on all three GET endpoints. Write endpoints are super admin only and unchanged.
- Tests: sales executive, read only viewer, support agent and project manager get masked values in list, detail and bank-account list and the full numbers appear nowhere in the responses; super admin and accounts finance still get full numbers; unknown company still 404.
- Remaining risk: other modules also return company account numbers and were not part of this task: `routes/payments.ts` lines near 2292 and 2308 (company bank accounts for receipt, booking payment and allotment dropdowns, any role with payments access) and custom letters. Recommend masking there too, with the choice of who may see the full number made by the business.

### SM-005 "On Transfer" stage. FIXED, RUNTIME-VERIFIED
- Confirmed: the server lists 7 stages, `set-master-docs.js` offered 6, so an "On Transfer" document opened with a blank stage and could not be saved.
- `set-master-docs.js`: `STAGES` now has all 7 (same order as `REQUIRED_AT`).
- Tests: API creates, edits and lists every one of the 7 stages and checks the screen source offers each; Playwright creates, shows, opens and saves an On Transfer document and checks the stage is kept.

### SM-006 Bank flags and loan approvals. FIXED, RUNTIME-VERIFIED
- Confirmed: the "customer, loan or both" rule ran only on POST and approvals were left behind.
- `master.ts`: `PUT /banks/:id` is a dedicated transaction handler: locks the bank row (`FOR UPDATE`), judges the flags on the final merged state, refuses "neither", and deletes the bank's approvals in the same transaction when `is_loan_bank` changes (so a bank made a loan bank again starts clean, with no stale approvals from the old behaviour). The change and the removed approvals are both written to the audit log. `PUT /banks/:id/projects` now locks the bank row and revalidates inside the transaction.
- Tests: all flag combinations including one-flag edits, approvals removed and audited, stale approval row cleaned, non-boolean flag 400, POST rule, customer-only bank cannot take approvals.

### SM-007 Unused Set Master functionality. INVESTIGATED, left unchanged (business decision)
Findings (source and runtime): 
| Item | UI | Backend consumer | Verdict |
|---|---|---|---|
| Loan bank project approvals | none (screen shows a count only) | none | API only; needs a UI and a consumer |
| Customer vs loan bank filter | the type is shown in the bank list | none: `booking.js`, `booking-payment.js`, `brokers.js`, `pending-cheques.js` call `/master/banks` without `type` | stored, unused |
| Country ISD and mobile digits | edited in Locations | none (no reader of `isd_code` or `mobile_digits`) | stored, unused |
| Document dispatch master | none | none | API only |
| Tax slabs | none | none | API only |
| Floors (`/master/floors`) | none | Set Projects uses its own tower floor routes | API only |
| Document checklist | yes (screen says it is a reference list) | booking does not read `document_types` | not enforced |
No existing business rule says how these should be wired (for example which bank types booking should show). Recommendation: decide per item to wire it or hide it; nothing was invented.

### SM-008 Logo upload changing the global logo. FIXED, RUNTIME-VERIFIED
- Confirmed (source): `POST /companies/:id/logo` wrote `global_settings.company_logo_url` for any company. The active company is the one last written by "Set as active company" (`write_to_global_settings`, which sets `global_settings.company_name`).
- Fix in `companies.ts`: the global logo is written only when the company's name matches `global_settings.company_name`; the response includes `active_logo_updated`. Making a company active still copies its own logo (unchanged).
- Tests (own companies, real PNG upload): logo for an inactive company leaves the printed logo alone; logo for the active company updates it; switching the active company copies its logo; a logo for a now inactive company leaves the active one alone. Global settings were restored and the test logo files removed (the test server ran with a scratch working directory, so nothing was written to `packages/api/uploads`).
- Behaviour note: when no company has ever been made active, a logo upload no longer sets the global logo.

### SM-009 Tax slabs and floors validation. FIXED, RUNTIME-VERIFIED
- Confirmed: generic helper stored a negative percentage and a name differing only by case, with generic errors.
- Tax slab limits derived from the schema: name up to 100 and unique ignoring case; CGST, SGST, IGST as `numeric(5,2)` read as 0 to 100 with up to 2 decimals (no business limit invented beyond a percentage); `effective_from` a real date; `is_active` boolean; field-specific messages; bad id 400; audit on create, update, delete.
- Floor limits taken from the existing tower floor route: tower must exist, whole floor number -5 to 300, name up to 50, one row per tower and number (409), audit.
- Nothing calls these routes today, so the risk of the change is low.

### SM-010 Bidirectional control characters. FIXED, RUNTIME-VERIFIED
- Confirmed in `master.ts` `cleanBody` (it stripped only zero-width characters). `utils/input.ts` already rejected them in the shared `text()` helper (checked: reminders, unit types, classifications).
- Added `BIDI` (U+202A to U+202E and U+2066 to U+2069) to `input.ts`, used by `cleanBody` and by `companies.ts` (create and update). Unchanged stored values can still be re-saved. Arabic, Hebrew, Hindi, punctuation and the left-to-right and right-to-left marks are accepted.
- Tests: four control characters rejected in a list name, document type, reminder and company; Arabic, Hebrew, Hindi, apostrophes, ampersand, brackets and the right-to-left mark accepted.
- Remaining risk: other modules with their own text handling (users, employees, brokers) were not checked.

### SM-011 Document type rename and history. PARTIALLY FIXED, RUNTIME-VERIFIED
- Confirmed: renaming rewrote `document_dispatch.document_type` and `booking_documents.document_type` with no per-row audit. Both columns are free text snapshots of the name when the record was saved; a dispatch entry is proof of what was sent.
- Safe change without a data model change: the rewrite is removed. Renaming (other than a letter case change) is refused with 409 while history still uses the name and no other document type keeps it; the message says to add a new document. Delete protection is now correct across projects: it blocks only when the name is still used by history and this is the last document type carrying it (before, deleting one of two same-name types was blocked although the other remained). Verified on dispatch rows (name kept, no new audit rows). The booking documents path is SOURCE-VERIFIED only (it shares the same function).
- Still needs a decision: to allow renames with history, add a stable `document_type_id` plus a name snapshot column to `booking_documents` and `document_dispatch`, backfill by name, and show the live name beside the snapshot. This needs a migration and a rule for old rows, so it was not done.
- The old test `docs/documents-setup/api-test-documents.mjs` asserted the cascade; it was changed to assert the new rule (flagged here on purpose).

### SM-012 Loan bank approvals and limited logins. FIXED, RUNTIME-VERIFIED
- Confirmed: the delete ran under row level security and left other projects' approvals.
- A limited login can no longer replace the approval list (403, a global setting) and cannot switch a bank off as a loan bank (403); other bank details remain editable. Super admin replaces the list in one locked transaction (tested with 4 concurrent replacements, one consistent result). Tested with two projects and one limited user.

### SM-013 Input validation gaps. FIXED, RUNTIME-VERIFIED
- IFSC prefix: letters and digits, 4 to 10 characters, stored in capitals. The strict 4-letter rule was not applied because the existing browser test and data use values such as `E2EB`; symbols and spaces are rejected. Business decision left open: exact 4 letters.
- Field-specific length messages from the real column sizes: country name 150, code 10, abbreviation 10, ISO 3, ISD 6, state name 150, city name 150, bank name 200, branch 200, profession 100, nationality 100, source name 100 (salutation stays 20, area type and currency 50). Source description limited to 1000 (the column is unbounded text; 1000 matches the unit type description, no other evidence existed).
- ISD code: not a defect. The server accepts 1 to 4 digits and removes a leading plus; the screen's 5 character limit allows the plus. Unchanged.

### SM-014 Cache and error banner. FIXED, RUNTIME-VERIFIED
- `set-master.js`: reuse time reduced from 30 to 10 seconds (`SM.CACHE_MS`); a path leaves `SM.failed` as soon as it loads (single reloads included) so the banner clears; mutations still reload only the lists they touched.
- Tests (Playwright): data added behind the screen shows after the cache time; a failed request shows the banner; the next load removes it; a single `SM.reload` clears its own failure.
- Remaining risk: changes by another user appear only after the cache time or a reload (no push updates).

### SM-015 Dispatch log. PARTIALLY FIXED, RUNTIME-VERIFIED
- Free text document name left as is: the dispatch master has no UI and no consumer, so forcing a dropdown would invent a rule (decision needed).
- The edit drawer now has a date input (the server rule for a future date was kept; both checked).
- `index.ts`: an unknown `/api/*` path now returns JSON `{"error":"Not found"}` instead of an HTML page. Malformed JSON already returned a JSON 400 (verified).

## C. Database changes
- New migration `packages/api/src/db/migrations/144_reminder_unique_per_project.sql` (described under SM-002). No other schema change, no data change, no existing row deleted by a migration.
- Test databases: disposable local PostgreSQL databases created only for this task with `packages/api/scripts/make-test-db.sh` (names `rof_audit_sm`, `rof_fix_sm`, `rof_head_sm`, synthetic data, migrations 096 to 144 applied). They are dropped now. `rof_crm`, `rof_sm_test`, `rof_sm_ui`, `rof_m1_verify`, `sow_db`, `real_estate_crm` were never connected to by the tests. Neon, Vercel and production were not touched.
- No existing database was reset, truncated or reseeded.

## D. Test results
| Check | Result |
|---|---|
| New regression script `docs/set-master-fixes/api-test-set-master-fixes.mjs` | fixed code 171 passed, 0 failed; original code 80 passed, 90 failed (SM-001, 002, 003, 004, 006, 008, 009, 010, 011, 012, 013, 015; SM-005 is covered by the browser test and a source check, since the API accepted the stage before too) |
| `api-test-set-master-parity.mjs`, `api-test-setup.mjs`, `api-test-deep.mjs` | 92, 138, 19 passed, 0 failed (rerun after the last change) |
| `api-test-documents.mjs` | 132 passed (after updating the one rename assertion) |
| All 44 repo API scripts, run once before the last small edits | 37 OK. Failures: broker-hold 2, demands 2, reports 2, security 1 (all date boundary checks: this machine and database are on Indian time just after midnight). The same scripts fail the same way on the original code (checked on `rof_head_sm`), so they are not caused by these changes. `api-test-receipts.mjs` crashed once with a connection reset and passes (281) when run alone. `api-test-documents.mjs` was the 1 failure caused by the intended SM-011 change and is fixed. The security script was rerun after the last edits (same single date failure). |
| Playwright `flows.spec.ts` + `set-master-fixes.spec.ts` | 29 passed, 0 failed |
| `tsc --noEmit` (API) | no errors |
| Lint | UNVERIFIED: `packages/api` has an `eslint` script but no ESLint configuration file, so ESLint stops with "couldn't find a configuration file" (existing condition) |
| JavaScript syntax of the two changed screen files | `node --check` OK |
| Browser walk-through (built-in browser, local test server) | locations, lists, banks, checklist, dispatch, companies, role views: as expected |
Not re-run after the final small edits: the other 38 modules' scripts (they do not touch the changed code paths except `companies` and `master`).

Journeys required in the brief: country, state, city create and edit (parity script); applicant records in-use protection (existing scripts and browser); area types and currencies (new tests); reminders in two projects (new); limited manager (new); banks and type changes (new); every document stage (new); dispatch create and edit (existing and new); company create and update (existing); masking (new); logo upload and active company (new); history preserved (new). All RUNTIME-VERIFIED on the disposable database.

## E. Files changed
- `packages/api/src/routes/master.ts`: scope guard, area type and currency usage, bank edit transaction and flag rules, approvals locking, document type history rule, IFSC and length checks, bidi check, floors and tax slab validation, `/usage` additions.
- `packages/api/src/routes/companies.ts`: account number masking by role, logo only for the active company, bidi check.
- `packages/api/src/utils/input.ts`: shared `BIDI` pattern.
- `packages/api/src/index.ts`: JSON 404 for unknown `/api` paths.
- `packages/api/src/db/migrations/144_reminder_unique_per_project.sql`: new (SM-002).
- `packages/web/public/js/pages/set-master-docs.js`: stage list, dispatch date input, delete message.
- `packages/web/public/js/pages/set-master.js`: cache time, banner recovery.
- `docs/set-master-fixes/api-test-set-master-fixes.mjs`: new regression script (picked up by CI by its name).
- `e2e/set-master-fixes.spec.ts`: new browser tests.
- `docs/documents-setup/api-test-documents.mjs`: one assertion updated for SM-011.
- `SET_MASTER_FIX_REPORT.md`: this report.

## F. Remaining issues and decisions
1. SM-007 items (wire or hide): loan bank approvals UI, bank type filters in booking and brokers, country mobile digits, dispatch master, tax slabs, floors, checklist enforcement.
2. SM-011: snapshot design for renames (needs migration and business rule).
3. SM-003: whether a limited manager may edit global lists with no project column.
4. SM-004: masking in the payments endpoints (`routes/payments.ts`) and who may see full numbers.
5. SM-013: exact 4-letter IFSC prefix; SM-015: dispatch document dropdown tied to a dispatch master.
6. The old audit item "pagination and sorting of lists" was not part of this task and is unchanged.
7. Lint cannot run until an ESLint config is added.
8. Migration 144 must be applied to the real database through the normal pipeline.

## G. Final safety confirmation
- Existing user data: preserved. No existing database was written to by tests; the only data changes were in disposable databases, now dropped. Migration 144 changes an index only.
- Production, Neon and Vercel: untouched.
- Nothing was deployed, committed, pushed or merged. The working tree holds the changes listed in section E (7 modified files, 4 new paths). No uncommitted change existed beforehand (the tree was clean), so none was overwritten.
- The only existing file edited for tests is `docs/documents-setup/api-test-documents.mjs` (one assertion, see SM-011).
