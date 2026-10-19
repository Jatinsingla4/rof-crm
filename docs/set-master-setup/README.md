# Set Master → Set Up: our own verification

Written 2026-10-19 from the code and from tests run by us. Nothing here is copied from the older module docs (`docs/modules/01-set-master*.md`). Where those docs and this one differ, this one is what we actually saw.

Scope: only the **Set Up** group of the Set Master menu. Not covered: Employee, Documents (checklist, dispatch), Customized Letters, Security, Roles, Role Menu.

## 1. What Set Up contains (from `packages/web/public/index.html`)

| Menu entry | Screen (`#/set-master?screen=`) | API |
|---|---|---|
| Locations (country, state, city) | `locations` | `/api/master/countries`, `states`, `cities` |
| Salutation | `lists&list=salutations` | `/api/master/salutations` |
| Profession | `lists&list=professions` | `/api/master/professions` |
| Nationality | `lists&list=nationalities` | `/api/master/nationalities` |
| Source of Enquiry | `lists&list=sources` | `/api/master/sources-of-enquiry` |
| Banks | `banks` | `/api/master/banks` |
| Companies | `companies` | `/api/companies` (+ `/bank-accounts`, `/logo`) |

Each list has GET, POST, PUT and DELETE in `packages/api/src/routes/master.ts`; companies are in `routes/companies.ts`. Frontend: `js/pages/set-master.js` (locations, lists, banks), `set-master-company.js` (companies), `css/set-master.css`.

## 2. Rules the code enforces (read from the code)

- Only people with `master_data` permission can change lists: super_admin all, project_manager create and edit (no delete). Reading is open to every signed-in user. The role check is case-insensitive on the URL.
- Names are trimmed, blank is rejected, `<` and `>` are rejected, names are unique ignoring case (state unique inside country, city inside state).
- State needs a country, city needs a state.
- Delete blocked: country that has states, state that has cities, bank used as clearing bank on a receipt, and a salutation/profession/nationality/source that a consumer, co-applicant or applicant detail still holds as text. Rename is also blocked for those four while in use.
- Companies: only super_admin can create, edit, upload a logo or touch bank accounts. GSTIN, PAN, CIN, IFSC, PIN, phone and email are format-checked (GSTIN, PAN, CIN and IFSC are saved in capitals). A company's first bank account is primary; the primary cannot be deleted while others exist.
- Every create, update and delete writes one row to `audit_logs`.

## 3. How we tested

Environment: a throwaway local Postgres (port 5433) built by `packages/api/scripts/make-test-db.sh`, the API on port 3002, six test users (`<role>@test.local`). Not the Neon database.

- `api-test-setup.mjs`: 134 checks across all seven Set Up areas and four roles (super_admin, project_manager, sales_executive, read_only_viewer).
- `api-test-deep.mjs`: 19 checks for the in-use guards (against real consumer rows), audit rows, parallel duplicate creates, quote/SQL text in names, no token, logo guard.
- Browser (real clicks and page reads): login, all rail screens, add a profession, duplicate message, Companies screen, phone width.

Run again: start the test DB and API, then `BASE=http://localhost:3002/api node docs/set-master-setup/api-test-setup.mjs`. The deep script needs `psql` at `/Library/PostgreSQL/18/bin` and the port and database names inside it.

## 4. Results

| Area | Result |
|---|---|
| Lists: add, trim, duplicate by case, blank, markup, 300-char, rename, empty update, unknown id, bad uuid, delete, delete twice | Pass (5 lists) |
| Roles on lists: project_manager add ok / delete blocked, sales_executive and read_only blocked, read_only can read, upper-case URL not a bypass | Pass |
| Locations: parent required, same state name in another country, filters, delete blocked with children, delete when empty | Pass |
| In-use guards for salutation, profession, nationality, source (delete and rename blocked, delete works once released) | Pass |
| Audit rows: create, update, delete once each | Pass |
| 10 parallel identical creates | Pass (1 row, 9 got 409) |
| Names with a quote or SQL text, filter with a quote | Pass (stored as text, no 500, table intact) |
| Company create, duplicate name, role block, six bad formats, capitals, markup, clearing a field, blank name, bad id | Pass |
| Company bank accounts: add, bad IFSC, required fields, role block, one primary, switch primary, primary delete blocked, text "false" rejected, non-primary delete | Pass |
| UI: login, all seven screens render without console errors, add shows "Profession added", duplicate shows "A record with this name already exists", "Used on" counts, setup-gap chips on companies | Pass |
| Phone width (375px) on Locations | Body is fine (tabs scroll, cards stack). The top header is cramped |

Total: 134 + 19 checks, 0 failures after we fixed one mistake in our own script (bank account fields are camelCase: `bankName`, `accountNumber`, `ifscCode`, `isPrimary`).

## 5. Problems found

| ID | Severity | What | Evidence |
|---|---|---|---|
| S1 | Medium | A salutation of 21 to 50 characters is accepted by Set Master (`salutations.name` is 50) but `consumers.salutation` is `varchar(20)`. Using that salutation on a consumer would fail in the database. | A 30-character salutation was saved with 201. Writing it to `consumers.salutation` in psql gave "value too long for type character varying(20)". The consumer screen itself was not driven, so we have not seen what the user sees. |
| S2 | Low | Duplicate checks ignore case in the API but the database unique keys are case-sensitive. `companies` has no unique key on name at all. Parallel requests could in theory create two rows. | Index list from `pg_indexes`. Six parallel mixed-case creates made one row, so it is not reproduced, only possible. Companies were not tested in parallel. |
| S3 | Low | Bank delete is blocked only when the bank is a receipt's clearing bank. We did not check whether other tables hold bank names (loans, company bank accounts). | Only `receipts.clearing_bank_id` is checked in `master.ts`. Not searched further. |
| S4 | Low | Phone width: the top bar wraps "Internal Use Only" over several lines. | Screenshot at 375px. |

Not a bug, but worth knowing: with the browser tool, a hash-only navigate sometimes left the old screen showing while the address bar had the new one. Changing the hash from script, clicking the rail and Back all worked, so we do not count it against the app.

## 6. Not tested yet

- Logo upload with a real file (only the bad-id guard was called).
- "Set as active company" and what it changes.
- Hiding of write buttons for project_manager and read_only_viewer in the UI (only the API side was tested for roles).
- Editing and deleting through the drawers and the delete confirmation.
- Banks screen add/edit/delete in the UI, and the Locations drawers.
- The consumer screen with a long salutation (S1).
- Neon: whether migration `096_document_types_required_at_text.sql` is applied there. We could not connect from this session.
- Production-sized data (thousands of cities) and accessibility.

## 7. Next

1. Decide S1 (cap salutation at 20 in the API, or widen `consumers.salutation`).
2. Drive the screens one by one in the browser (Locations, Applicant lists, Banks, Companies), using section 6 as the checklist.
3. Add a unique index on `lower(name)` for the lists and companies if S2 should be closed in the database.

## 8. Items from section 6 now tested (2026-10-19, local test database)

Done in the browser against the local API (port 3002). Real mouse clicks were used for: add bank, edit-drawer save, delete dialog (Cancel and confirm), page loads and screenshots. The other steps pressed the same buttons through the page (`button.click()`) and read the toasts and the database afterwards.

| Item | Result |
|---|---|
| Banks screen: add, edit in the drawer, Cancel keeps the row, Delete confirm removes it, audit rows | Pass. Dialog text: "Delete UI Test Bank? This cannot be undone. The change is recorded in the audit log." |
| Locations drawers: add country, state (parent preselected), city; edit city; delete country that has a state; delete in order | Pass. Blocked delete shows "This country has 1 state(s). Delete them first." |
| Applicant lists: add, rename, delete; item in use | Pass. In-use Delete is disabled with "In use on 1 record(s)"; renaming an in-use item gives `"Salaried" is used on 1 record(s)…` |
| Companies: logo upload with a real PNG | Pass: saved, shown, served as `image/png`. A 3 MB file gives "File is too large. Maximum is 2 MB" |
| Companies: Set as active company | Pass: confirm text "Demand letters, receipts and allotment letters will print this company", then `global_settings` company keys updated and an audit row written |
| Company bank accounts in the UI | Pass: bad IFSC gives the format message, first account is Primary, numbers shown masked (XXXX6789) |
| Roles in the UI | read_only_viewer: no write control on any of the four screens. project_manager: Add and Edit, no Delete, no write control on Companies. Both match the API matrix. (project_manager only worked after we seeded `nav_pages`, see S6.) |

New problems found while doing this:

| ID | Severity | What | Evidence |
|---|---|---|---|
| S5 | Low | Logo is checked only by the type the browser declares, not by the file's bytes. | An HTML file sent as `image/png` was saved as `<companyId>.png` and replaced the real logo (the logo shows broken). It is served as `image/png` with `X-Content-Type-Options: nosniff`, so it does not run as a page. |
| S6 | Medium (new databases) | When `nav_pages` has no rows, every role except super_admin is denied every page. | `/roles/<role>/pages` returns an empty list, the browser treats the empty list as "loaded" and `canAccessPage` returns false for all routes (`permissions.js`). The test database has 0 rows in `nav_pages`; project_manager got "Access Denied" on Set Master until two pages were added. Whether Neon has these rows was not checked. |
| S7 | Low | Login form has no `method="post"`. If it is submitted before the page script is ready, the browser sends the email and password in the URL. | `login.html` line 198 attaches the handler by script. We hit this once: the address became `login.html?email=…&password=…`. |
| S8 | Medium (flow) | Booking never uses the Nationality master. | `booking.js` loads `/master/nationalities` into `natOpts` (line 26) but never uses it; the form has a fixed Resident / PIO / NRI / OCI toggle and the extra applicant field is free text with "Indian". Salutation, profession, source and bank do use their masters. |
| S9 | Medium (flow) | Outputs do not all print the same company. | `documents.ts` (project join at lines 753, 1472, 1949, 2024, 2198), `custom-letters.ts:137`, `transfers.ts:571` use the project's company; `payments.ts:3245` and `reports.ts:1596` read the global active company name. Read from code, not run. |
| X1 | High (outside Set Up) | `PATCH /api/consumers/:id` always returns 500. | `consumers.ts:663-` passes the name as `$1` but the SQL never uses `$1`; Postgres answers "could not determine data type of parameter $1" (42P18). Tested with partial bodies, with name, and with a normal salutation: all 500. Called by `leads.js:214` (move lead stage) and `allotment.js:756`. File not touched by us. |

S1 (salutation longer than 20 characters): the master accepts 30 characters. What the user sees on the consumer screen could not be observed, because X1 makes the consumer save fail for every input. The database column limit itself was shown earlier.

Still not tested: Neon (data, schema, `nav_pages`, migration 096).

## 9. Fixes (2026-10-19, not committed)

S1, S5, S6, S7 and X1 are fixed; S3 needed no change; S2, S8 and S9 are left for an owner decision. Details and test results are in `docs/set-projects-setup/README.md`, section 9. The Set Master scripts in this folder still pass after the changes (134 and 19); `api-test-setup.mjs` now uses short salutation names because of the 20-character limit.

## 10. Set Master menu merged from 6 groups to 4 (2026-10-19, not committed)

Only the menu in `packages/web/public/index.html` changed; no route, page or permission changed.

| Before | After |
|---|---|
| Set Up | Set Up (unchanged) |
| Employee Login Creation (with a nested Employee group) | **Employees**: Create Login, View Logins, Department, Employee Information, Report, Set Manager, Team Master, Set Team Head, Team Head Detail, Employee Tree (one flat list, no third-level flyout) |
| Documents and Customized Letters | **Documents**: Document Checklist, Document Dispatch Log, Customized Letters |
| Security and Role and Menu | **Security**: User Permissions, Roles, Role Menu Access |

The Employees breadcrumb in `employees.js` now reads "Set Master / Employees". Checked in the browser as super_admin: all 23 entries open (Router pages render, the two stand-alone pages answer 200), no console errors, none shows "Access Denied".

Not yet checked in depth: the Employees, Documents (checklist, dispatch, customized letters), Security and Role Menu screens themselves. Known from the code audit and still open there: Customized Letters create, edit and delete have no role check, and generated letters insert merge fields without escaping (`routes/custom-letters.ts`).
