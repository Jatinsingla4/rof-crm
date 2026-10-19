# Module 01: Set Master

Status: Revamped and fixed locally, not committed. Round 3 verification of the new screens is still to be done in a separate session
Owner: Jatin Singla   Opened: 2026-10-16   Closed: not yet
Depends on: 0 (Login and session)   Used by: all modules (dropdown lists), 3 (Set Projects), 6 (Booking), 8 (Receipts)

## 1. Purpose
Reference lists used across the CRM: country, state, city, salutation, profession, nationality, bank, source of enquiry, document type (checklist of papers a buyer must give), document dispatch log, and the company master (legal entity, GSTIN, bank accounts printed on receipts and letters).

## 2. Screens
The old eleven tabs were merged into six screens with a left navigation rail (`#/set-master?screen=...`). Old links with `?tab=` still work.
| Screen (rail) | Replaces | Frontend file | What the user does |
|---|---|---|---|
| Locations | Country, State, City | `js/pages/set-master.js` | Three linked columns: pick a country, see its states, pick a state, see its cities. Add, edit, delete in a side drawer |
| Applicant lists | Salutation, Profession, Nationality, Source of Enquiry | `js/pages/set-master.js` | One screen with a list switcher. Type a name in the top row and press Enter to add. Shows how many records use each item |
| Banks | Bank Master | `js/pages/set-master.js` | Inline add row, edit in the drawer, shows receipts that use the bank |
| Companies | Company Master and its bank accounts | `js/pages/set-master-company.js` | Company list with setup gaps, a sectioned editor (identity, address, contact, tax), bank accounts, logo, "set as active company" |
| Document checklist | Document Type | `js/pages/set-master-docs.js` | Documents grouped by project, filter by project, add and edit in the drawer |
| Dispatch log | Doc Dispatch | `js/pages/set-master-docs.js` | Log form with consumer search at the top, latest 100 entries below |
Styles are in `css/set-master.css` (uses the theme tokens, so light and dark both work). Write controls are hidden for roles that cannot use them (same rule as the server: super_admin all, project_manager create and edit, companies super_admin only).

## 3. API
| Method and path | Route file | Role check | Reads | Writes |
|---|---|---|---|---|
| GET `/api/master/{countries,states,cities,banks,salutations,professions,nationalities,sources-of-enquiry,document-types,document-dispatch}` | `routes/master.ts` | any signed-in user (lists feed dropdowns in booking, brokers, payments) | the list tables | none |
| POST, PUT, DELETE on the same paths | `routes/master.ts` | `master_data` create, edit, delete (super_admin all, project_manager create and edit) | | the list tables, `document_types` rename also updates `booking_documents` and `document_dispatch` |
| `/api/companies` GET | `routes/companies.ts` | any signed-in user | `companies`, `projects` | none |
| `/api/companies` POST, PUT, logo, bank-accounts POST, PATCH, DELETE | `routes/companies.ts` | super_admin only | | `companies`, `company_bank_accounts`, `global_settings` |

Database errors are turned into 400 or 409 by `middleware/pg-errors.ts`. Every add, edit and delete is written to `audit_logs` with the values before and after (`resource_type` like `master.banks`, `company`, `company_bank_account`); the company "set as active company" switch is recorded with `write_to_global_settings: true`.
PUT routes now exist for salutations, professions and nationalities as well.

## 4. Data
| Table | Key columns | Notes |
|---|---|---|
| countries, states, cities | name, code, parent id | `states.country_id` and `cities.state_id` are `ON DELETE CASCADE`, so the API now blocks deleting a parent that has children |
| banks | name, ifsc_prefix, branch | `receipts.clearing_bank_id` is `ON DELETE SET NULL`, so the API blocks deleting a bank used on a receipt |
| salutations, professions, nationalities, sources_of_enquiry | name | consumers store these as text |
| document_types | name (unique), required_at, document_from, is_mandatory, project_id | `required_at` holds a stage name, it was wrongly a timestamp in the reconstructed baseline (migration 096) |
| document_dispatch | document_type (text), dispatch_mode, tracking_no, consumer_id | |
| companies, company_bank_accounts | see baseline | |

## 5. Business rules
1. Names are trimmed, cannot be blank, and are unique ignoring case (inside the parent for states and cities). Enforced in the API; the database also has a case sensitive unique key.
2. A state needs a country and a city needs a state (list screens join on them, a row without a parent would disappear).
3. A country with states, a state with cities, and a bank used on receipts cannot be deleted.
4. Document type: Document From is Individual or Firm or Company; Document Type is one of On Booking, On Allotment, On Agreement, On Possession, On Demand, Other; the project must exist. Renaming also renames matching text in `booking_documents` and `document_dispatch`, in one transaction. Important: the booking screen does not read this list. It uses its own fixed list of document codes (`booking.js:1818-1839`), so the rename and the delete guard protect only dispatch records typed with the same name, and `required_at`, mandatory and project scope are labels today, not rules (see `01-set-master-flow.md` section 3, DT-059).
5. Dispatch needs a document type and a mode; the consumer, if given, must exist.
6. Only super_admin may change companies and their bank accounts. Company fields change only when sent; a blank value clears the field.
7. Salutation, profession, nationality and source of enquiry are stored as text on consumers (salutation, profession, nationality also on co-applicants and applicant details). An item that is in use cannot be deleted, and a source in use cannot be renamed.
8. Company formats are checked when a value is added or changed: GSTIN (15), PAN (10), CIN (21), IFSC (11), PIN (6 digits), phone, email. Tax and bank identifiers are saved in capitals. An unchanged old value is not re-checked, so an old record can still be saved.
9. A company always has one primary bank account: the first account is primary, the primary account cannot be unmarked or deleted while others exist.
10. The company list shows setup gaps (no primary bank account, GSTIN, PAN or logo).

## 6. Flow
Menu opens `/set-master?tab=x`; the page loads the list with GET; add form posts JSON; the list reloads; delete asks to confirm and removes the row. Document type: pick project, fill the form, save, "View" lists grouped by project.

## 7. Test cases
Automated run on a database restored from `schema_baseline.sql` (script kept outside the repo for now, see DT-042). Result: all checks in three scripts pass (t2 91, t3 34, t4 37 in the last run) (round 1: 89 of 90, the one failing check was a re-run artefact; round 2 after the independent review: 31 of 31).
| Area | Cases covered | Result |
|---|---|---|
| Roles | all 6 roles x (list, add), project_manager delete blocked, viewer cannot log dispatch, unit-types write path unchanged | Pass |
| Validation | missing, blank, spaces, object, too long, code too long, duplicate exact and different case, same state name in another country | Pass |
| References | state without country, bad uuid, unknown country, city without state | Pass |
| Delete | country with states, state with cities blocked; unknown id 404; bad uuid 400; empty parent deletes | Pass |
| Update | partial PUT keeps other fields, empty body 400, rename to duplicate 409, unknown id 404 | Pass |
| Document types | create, stored stage text, duplicate, missing or invalid stage, invalid From, unknown project, rename cascade to dispatch, delete | Pass |
| Dispatch | create, empty, no mode, unknown consumer, bad date | Pass |
| Companies | non super_admin blocked on company and bank account writes, field clearing, blank name, unknown id, bad uuid | Pass |
| Round 2 | URL case bypass of the role guard, blank parent on update, document type partial update keeps category, wrong value types, delete of a document type in use, logo upload guards (role, id, extension), atomic primary bank account | Pass |
| Round 3b | markup in names, descriptions, company fields and bank account fields rejected | Pass |
| Round 3 (features) | audit rows for create, update, delete with before and after and no duplicate rows; in-use delete and rename blocks; format checks incl. legacy value not re-checked; primary account rules; PUT for the three simple lists | Pass (37 of 37) |
| Browser (real UI, test server) | all 11 tabs: add, edit (form fills, Update button, Cancel), delete with the new messages for the 6 simple lists, state and city (parents), document type (add, view, edit, delete), dispatch, company (bad GSTIN message, save, list with gaps, bank account add with masked number, bad IFSC, delete primary). No console errors | Pass |

Round 4 (after the revamp and the verifier's second report): the six new screens were driven in a browser on a clean database: company create with format errors, bank accounts (add, edit, clear a field, primary rules), checklist (required fields, duplicate, edit, partial update), dispatch (log, required fields), lists (add, duplicate, disabled delete for used items, edit, delete), banks, locations (add state and city, delete blocked), and the controls shown for super_admin, project_manager and read_only_viewer. API checks in `t5` cover every finding of the verifier's two reports, including 14 parallel document type updates and 12 parallel bank account creations (no pool deadlock, exactly one primary). Result: t2 91, t3 34, t4 37, t5 34, all pass.
Not tested: real mouse clicks (the script clicks and submits through the DOM), logo upload from a real browser file picker, phone width layout, production data, loading speed with thousands of cities.

## 8. Breakages
| ID | Severity | What happens | Root cause | Status |
|---|---|---|---|---|
| M01-B001 | High | Any signed-in role, including read only, could add or delete every master list and change company bank accounts | no role check on `/api/master` writes or on company bank account routes | Fixed (local) |
| M01-B002 | High | Deleting a country silently deleted its states and cities | `ON DELETE CASCADE`, no guard | Fixed (local) |
| M01-B003 | High | Deleting a bank cleared the clearing bank on its receipts | `ON DELETE SET NULL`, no guard | Fixed (local) |
| M01-B004 | High | Saving a document type failed on the new database | `required_at` created as a timestamp in the reconstructed baseline | Fixed in baseline and migration 096; live database still needs it (DT-051) |
| M01-B005 | High | Stored script injection: names were put into the page without escaping | `set-master.js` | Fixed (local) |
| M01-B006 | Medium | Blank, duplicate-by-case, oversize and wrong-type input saved or returned 500 | no validation | Fixed (local) |
| M01-B007 | Medium | Company fields could not be cleared; blank kept the old value | `COALESCE` update | Fixed (local) |
| M01-B008 | Low | Delete of an unknown id answered success; bad uuid answered 500 | | Fixed (local) |
| M01-B009 | Medium | Renaming a document type updated three tables without a transaction | | Fixed (local) |
| M01-B010 | High | Role guard skipped when the URL used other letter case (`/master/Countries`) | case sensitive regex, case insensitive routing (found by the independent review) | Fixed (local) |
| M01-B011 | High | Logo upload wrote the file before the role check; the name came from the uploaded file name (path traversal, `.html` served from uploads) | multer ran first, extension from file name | Fixed (local) |
| M01-B012 | Medium | Editing a document type wiped category, description and stage when fields were missing | update wrote every column | Fixed (local) |
| M01-B013 | Medium | A state or city could be saved without a parent by update, and then vanished from lists | update did not check required parents | Fixed (local) |
| M01-B014 | Medium | A failed bank account save could leave the company with no primary account | two statements without a transaction | Fixed (local) |
| M01-B015 | Low | Numbers, booleans stored as names; company bank account save errors were silent in the UI; bank Edit button broke on a newline | no type check, no `res.ok` check, incomplete escaping | Fixed (local) |
| M01-B016 | Low | A document type used in dispatch records could be deleted, leaving orphan names | no guard | Fixed (local) for dispatch. Booking documents use fixed codes, not these names, so nothing to guard there (DT-059) |
| M01-B018 | High | An audit write while a database connection was held could lock the whole connection pool when 10 requests overlapped (login also hung) | audit wrote through the pool, not the held connection | Fixed (local): audit now uses the same connection |
| M01-B019 | Medium | Bank account: `isPrimary` accepted as text or number and could wipe the only primary; a deleted account could be made primary; two requests at once could create two primaries; blank bank name accepted; fields could not be cleared | no type check, no row lock, `COALESCE` update | Fixed (local) |
| M01-B020 | Medium | NUL byte gave 500; logo upload errors (too large, wrong field, empty file, uppercase id) gave 500 or odd results; creating a company skipped the type and markup checks and accepted duplicate names; the text "false" for `write_to_global_settings` overwrote global settings | gaps in the first fixes | Fixed (local) |
| M01-B021 | Low | Audit log kept full bank account numbers; HEAD requests blocked; zero width characters accepted as a name; description length unlimited; null on update reset mandatory or source | | Fixed (local) |
| M01-B017 | Medium | Names with `<` or `>` were accepted and then rendered raw by Booking, Brokers and Edit Booking dropdowns (found by the flow review) | no input rule, other pages do not escape | Fixed at the source: `master.ts` and `companies.ts` reject `<` and `>`. The other pages still need escaping (DT-063) |

## 9. Deferred items
DT-049 to DT-070 (see the sheet). The old UI items SM-U1, U2, U3, U4, U5, U6, U7, U8, U10, U11 are done by the revamp; SM-U9 (full accessibility pass) is partly done (labels, focus, Esc, dialogs). Not started: SM-F3, SM-F4 and SM-F8 to SM-F14 (need decisions or touch Booking).

## 10. Regression list
Login as admin, open every Set Master tab, add and delete one item each, create a document type, open booking (dropdowns for salutation, profession, nationality, source, bank still fill), open Set Projects (unit types, reminders still save).

## 11. Sign off
Not signed off. Files changed: `web/public/index.html` (menu and two script tags, one stylesheet), `web/public/css/set-master.css` (new), `web/public/js/pages/set-master.js` (rewritten), `set-master-docs.js` and `set-master-company.js` (new), `routes/master.ts` (also `GET /api/master/usage`), `routes/companies.ts`, `middleware/pg-errors.ts` (new), `middleware/rbac.ts`, `middleware/auditLogger.ts`, `index.ts` (one line in autoAudit to skip requests already logged), `db/migrations/096_document_types_required_at_text.sql` (new), `db/baseline/001_reconstructed_missing_columns.sql`, `db/baseline/schema_baseline.sql`, `web/public/js/pages/set-master.js`. No commit yet.
