# Module 01 Set Master: independent verification

Verifier run: 2026-10-16, test server `localhost:3002`, DB `rof_sm_test` only. Nothing committed, no repo file edited except this report.
Method: read diff and code, re-ran `/tmp/sm/t2.py` and `t3.py` (89/90 and 31/31, same as the doc), then about 250 extra black-box requests (scripts kept in the session scratchpad), SQL checks on constraints, migration 096 dry-run inside a rolled-back transaction, and a real browser pass (all 11 tabs, desktop width 1366).
Test data I added to the test DB: 1 project, 1 consumer, 1 booking record, 1 receipt, nasty-named rows (quotes, `<img onerror>`, backslash, newline). Logo files I created were deleted from `packages/api/uploads/company-logos`.

Line numbers for `companies.ts` are approximate: that file was changing on disk while I worked (another session is editing the tree).

## Verdict
No High finding. The role guard, delete guards, validation, rename transaction, XSS escaping and migration all work as the doc says. Found 5 Medium and several Low issues, plus doc claims that are incomplete or unproven. Biggest practical ones: bank account `isPrimary` can leave a company with no primary account, NUL byte gives 500, logo upload errors give 500, and committed `dist/` is stale.

## Findings (ranked)

### M1 Medium: `isPrimary` not type checked, a string `"false"` wipes the primary bank account
- File: `routes/companies.ts` ~248 (POST bank-accounts), ~317 (PATCH). `if (isPrimary)` is JS truthiness.
- Request: `POST /api/companies/:id/bank-accounts {"bankName":"X","accountNumber":"2","isPrimary":"false"}`.
- Observed: 200, all other accounts set `is_primary=false`, new account saved with `is_primary=false`. Primary count went 1 to 0. `isPrimary:"yes"` and `1` are also accepted (Postgres casts them).
- Root cause: truthy check before the insert, and the value is never required to be boolean. This is the same class as M01-B014, just via a wrong type.
- Smallest fix: in POST and PATCH add `if (isPrimary !== undefined && typeof isPrimary !== 'boolean') return 400`.

### M2 Medium: bank account strings are not trimmed, blank bank name accepted, PATCH cannot clear a field
- File: `companies.ts` ~251 (`!bankName`), ~322 (`COALESCE($3, ...)`).
- Requests: POST `{"bankName":"   ","accountNumber":"1"}` gives 200. POST `{"bankName":" HDFC ","accountNumber":"  12  "}` stores the spaces. PATCH `{"branch":""}` returns 200 and keeps the old branch.
- Root cause: `!bankName` passes for `"   "`; no trim; PATCH uses `COALESCE(newvalue, old)` and turns `''` into null first. In the UI, clearing a branch or payable-at and saving silently does nothing.
- Fix: trim the strings and require non blank bankName and accountNumber. For PATCH apply only keys present in the body (same pattern already used in `PUT /companies/:id`).

### M3 Medium: NUL byte gives 500 instead of 400
- File: `middleware/pg-errors.ts` (no case for `22021`), `master.ts` `cleanBody`, `companies.ts`.
- Requests: `POST /master/countries {"name":"a\u0000b"}`, `PUT /master/banks/:id {"name":"a\u0000b"}`, `PUT /companies/:id {"fax":"a\u0000"}`, `POST /companies/:id/bank-accounts {"bankName":"X\u0000"}`, also `GET /master/states?country_id=%00` and `GET /companies/%00`.
- Observed: 500 `{"error":"Internal server error","message":"invalid byte sequence for encoding \"UTF8\": 0x00"}` (the internal message is also sent to the client).
- Root cause: pg error 22021 is not mapped. The doc says database errors become 400 or 409 (section 3), so this is a gap in that claim.
- Fix: add `case '22021': return 400 'Invalid characters'` in pg-errors.ts (covers every route using it, including query params). Optionally strip or reject `\u0000` in `cleanBody`.

### M4 Medium: logo upload edge cases
File: `companies.ts` 40-50 (storage and filter), 378-390 (route).
- Multer errors surface as 500 with raw text: file over 2 MB gives `500 "File too large"` (should be 413 or 400); wrong field name gives `500 "Unexpected file field"`; malformed multipart header gives `500 "Malformed part header"`. Root cause: `uploadLogo.single()` is used as plain middleware, so `MulterError` goes to the generic handler (pg-errors passes it on). Fix: wrap in a callback that maps `MulterError` to 400 or 413.
- Only the client sent mime type is checked. A file with HTML content and `image/png` is stored as `<id>.png`, and an empty (0 byte) file is accepted. Not exploitable here (served as `image/png` with `nosniff`, SVG and webp refused), but a broken logo can be saved. Fix: reject `size === 0` and optionally check magic bytes.
- Uppercase UUID in the URL passes `UUID_RE` and `WHERE id = $2`, so the file and `logo_url` are saved with uppercase letters (`C2C8...png`). On a case sensitive disk (Linux, Render) this makes a second file for the same company. Fix: `req.params.id = req.params.id.toLowerCase()` in `logoGuard`.
- Uploading png then jpg then gif for one company leaves all three files; old ones are never deleted. Low impact (disk only).
- Pre-existing, not from this diff: any company's logo upload overwrites `global_settings.company_logo_url` (line ~385), so uploading a logo for a non active company changes the logo used on every document. Needs a product decision (update only when that company is the active one).
- A request for a missing upload (for example `/uploads/company-logos/x.svg`) returns 200 (SPA fallback HTML), not 404. Pre-existing.

### M5 Medium (release hygiene): committed `dist/` is stale
- `.gitignore` says `packages/api/dist` is committed and must be kept in sync before commits. `dist/routes/master.js` has no `SET_MASTER_PATH` or guard (0 hits), `dist/middleware/rbac.js` has no `master_data`, there is no `dist/middleware/pg-errors.js` and no `dist/db/migrations/096_...`. `?? packages/api/dist/db/baseline/` is an untracked new directory.
- Effect: anyone running `npm start` (`node dist/index.js`) locally gets the old, unguarded code. Render rebuilds on deploy, so production is fine only if the build runs. The doc does not mention this.
- Fix: run `npm run build` before the commit and commit the dist changes, or decide that dist/baseline should not be added.

### L1 Low: `POST /companies` has none of the type checks that `PUT` has
- `companies.ts` ~89-135. `{"code":{"a":1}}` stores the string `{"a":1}`; `{"phone":["1","2"]}` stores `{"1","2"}`; `{"country":123}` stores `"123"`; `email:"  a@b.c  "` is stored untrimmed; `email:"notanemail"` accepted; duplicate company names accepted (201). Doc section 8 and rule 6 describe type checks, but only for PUT. Fix: reuse the PUT loop (trim, string only) in POST.
- `write_to_global_settings:"false"` (a string) is truthy and overwrites 15 global settings. Super admin only. Fix: `=== true`.

### L2 Low: document type description limit not enforced, long text breaks the View table
- UI textarea has `maxlength="150"`, API and DB (`TEXT`) accept 100,000 characters (`PUT` with 100k returned 200). In the browser "View" tab an unbroken 100k string makes the Description column run off the right edge and pushes Edit and Delete out of view (screenshot checked). Fix: check `description.length <= 150` in `documentTypeError`, or add `word-break:break-word` to the cell.
- `PUT {"is_mandatory":null}` and `{"document_from":null}` (or `''`, which becomes null) write NULL, while create defaults to false and `Individual`. Fix: ignore null or reject it.

### L3 Low: `HEAD` on master lists is blocked for roles that can GET
- `master.ts:24` only skips the guard for `GET`. Express serves `HEAD` through the GET handler, so `HEAD /master/countries` gives 403 for sales, accounts, support and viewer (200 for admin). No client uses HEAD today. Fix: `['GET','HEAD'].includes(req.method)`.

### L4 Low: duplicate protection is check then insert
- 20 parallel inserts of the same name with mixed case: 18 got 409, 2 got 201, two rows exist (`lower(name)` check plus a case sensitive unique key only). Same name with the same case is safe (1 of 20 created, rest 409).
- `lower()` is ASCII only on this DB (collation `C`), so `Ünï...` and `ÜNÏ...` both saved. Production collation unknown.
- Zero width characters (`​`) are not trimmed, so a name made only of them is accepted and shows as a blank row (3 such rows already exist in the test DB, one list row shows "—").
- Fix: unique index on `lower(name)` per table (and per parent) in a migration; strip `​-‍﻿` in `cleanBody`.

### L5 Low: smaller items
- Dispatch accepts year 99998 (`dispatched_at:"99999-01-01"` gives 201). `document_type` in dispatch is free text, not checked against the master. The UI sends `datetime-local` text without time zone.
- Delete guards are check then delete, not one transaction or `FOR UPDATE`. A state added between the count and the delete would still be removed by the DB cascade. I could not reproduce it in a short race (5 adds vs 1 delete: all adds got 400 FK, no orphan), so this is theoretical.
- Company bank account: PATCH on a soft deleted account returns 200; deleting the only primary leaves no primary; `accountType` is free text (`"zzz"` saved); `created_by` is never set; duplicate account numbers allowed.
- `GET /companies/:id/bank-accounts` for an unknown company returns 200 `[]` (fine, noted).
- Module 3 routes (reminder-master, unit-types, floors, tax-slabs) still have no write guard: a read only viewer gets the same status as admin on POST and DELETE. This is "as before" as required, but worth knowing.

## Checked and fine
- Role matrix (6 roles x 10 paths x GET/POST/PUT/DELETE/PATCH): admin all; project_manager create and edit, delete 403, PATCH allowed; the other four read only. 403 text matches the doc.
- Guard bypass attempts all fail or 404: URL case (`/Countries`, `/COUNTRIES/`), trailing slash, `//countries`, query string, `X-HTTP-Method-Override`, `%63ountries` (404 for everyone), `.json`, `foo/../countries`, `..%2f`. OPTIONS gives 200 without auth (normal CORS).
- Bodies: array, `null`, string, bad JSON, no content type, text/plain give 400 (or "Name is required"); 20 MB gives 413; `__proto__` ignored; unknown fields ignored (`id`, `created_at` cannot be set); urlencoded body works (bearer token only, so no CSRF issue). Number, boolean, object, array in text fields give 400. Lone surrogate is stored as U+FFFD.
- Length limits give 400 (name 201+, 1 MB, code 11+, ifsc 11+, category 101, dispatch mode 101).
- Update: partial PUT keeps other fields; blank, null or unknown id, bad uuid, unknown parent, rename to duplicate (also moving a state into a country that already has that name) all give correct 400, 404 or 409. PUT on salutations, professions, nationalities has no route (404, as before).
- Deletes: country with states, state with cities, bank on a receipt (I seeded a real receipt: 409 and the receipt kept its bank), document type in a booking document (409): all blocked. Unknown id 404, bad uuid 400.
- Rename cascade: renames booking_documents and document_dispatch rows in one transaction; 10 concurrent renames of one type all returned 200 with no error (row lock works); case only rename works.
- Document type checks: stage list, Document From, `is_mandatory` must be boolean (`"true"` and `1` give 400), unknown project 400, project_id 0 or true 400.
- Dispatch: required fields, unknown consumer 400, bad dates 400 (`0000-00-00`, number).
- Migration 096: on a column set back to TIMESTAMPTZ it converts to VARCHAR(100), second run does nothing (rolled back, DB unchanged). Baseline files and `schema_baseline.sql` agree.
- Frontend: all 11 tabs render, no console error on a fresh load, no horizontal page scroll at 1366 px, stored `<img onerror>`, quotes, backslash and newline names show as text, `window.__xss` never set. Edit and Delete handlers for document type, bank account edit button (newline, quote, backslash), company Set Active: correct arguments, confirm text correct. Blank add shows "Name is required", duplicate shows "A record with this name already exists". Viewer sees "Access Denied" for the page (test DB has empty `role_page_access`).
- Other modules: booking, booking-payment, brokers and pending-cheques only GET these lists, so the new guard does not affect them. No other API code inserts into these tables.
- Company writes: all super_admin only (POST, PUT, bank account POST, PATCH, DELETE, logo, also before multer writes a file). PUT clears fields with blank, name null 400, array or number values 400.

## Doc claims: wrong or unproven
1. Section 3 "Database errors are turned into 400 or 409 by pg-errors": not true for NUL bytes (500) and multer upload errors (500). See M3 and M4.
2. Section 5 rule 1 "unique ignoring case": true for normal cases, but not under concurrency (2 rows created) and not for non ASCII case on a C collation database. Blank check misses zero width characters.
3. Section 5 rule 6 "a blank value clears the field": true for company fields only. Bank account PATCH cannot clear anything (M2). POST company has no type checks (L1). The wording of M01-B015 "no type check" is fixed for lists and PUT only.
4. Section 5 rule 4 "Renaming also renames it in booking documents and dispatch records": proven for those two tables. Other tables also hold a `document_type` text (`document_checklists`, `documents`, `kyc_documents`, `document_templates`); I could not prove whether they hold master names, so the claim "no orphan names" is unproven for them. The same applies to banks (`bank_name` text in receipts, booking_records, loan_details, tds_challans, bank_accounts; only `receipts.clearing_bank_id` is guarded) and to salutation, profession, nationality, source text in consumers and applicant tables.
5. Section 7 "Not tested: company logo upload": I tested it. The doc claims "logo upload guards (role, id, extension)" pass: true, but content, size error status, empty file and uppercase id are not covered (M4).
6. Section 7 "120 checks": confirmed by re-run (89 plus 31). The one failure in `t2.py` is the XSS name creating a duplicate on re-run (409), as the doc says. Note both scripts live in `/tmp/sm`, outside the repo (DT-042), so the result cannot be reproduced from the repo.
7. Section 8 M01-B011 "path traversal fixed": confirmed for the file name and id. The "fixed" status holds, but the upload feature still has M4 items.
8. Section 8 M01-B002 and B003 "fixed": true for normal use; guard is not atomic (L5), theoretical only.
9. Section 11 "Files changed" list is incomplete: committed `dist/` is not rebuilt (M5), untracked `packages/api/dist/db/baseline/`, and `docs/modules/01-set-master-flow.md` plus changes in `index.ts` and `auditLogger.ts` appeared in the tree while I worked (not part of this module as I understand it).
10. Section 3 role table says only `master_data` decides write access. Page visibility is a separate system (`role_page_access`, configurable per role). If production gives Set Master page access to a role without `master_data` (for example accounts_finance for banks), that role now sees the page but every save returns 403. Not verifiable on the test DB (empty page access table); check production `role_page_access` before release.

## Environment note
The test server was restarted by someone else twice during my session (pid changed 19333 to 19743; tsx watch processes from other sessions are running, and `index.ts` and `auditLogger.ts` were modified on disk). I confirmed my hostile inputs (NUL, 20 MB, lone surrogate, 50,000 nested arrays, 100 KB URL) do not crash the process. This caused two short windows of `ERR_CONNECTION_REFUSED` and one "Unexpected token" console error in the browser; a fresh reload was clean.

---

# Round 2: re-verification after the fixing session's changes (audit log, usage guards, formats, primary accounts, UI)

Re-read at 11:48 IST. Tests: `/tmp/sm/t4.py` 37/37, `t2.py` 91/91, `t3.py` 31/31 and `t5`-style checks all pass on a clean run. About 120 more probes of the new code (scripts in the session scratchpad). **The test server on 3002 hung during my run and I restarted it** (see N1). It is now running the current code from the main tree.

## New findings

### N1 HIGH (severity depends on load): audit write inside a held connection deadlocks the DB pool
- Files: `routes/master.ts` ~343 (`PUT /document-types/:id`), `routes/companies.ts` ~218 (PUT company), ~284 (POST bank account), ~344 (PATCH bank account).
- Root cause: these handlers take a client with `db.connect()`, commit, then `await auditChange(db, ...)` (which asks the same pool for a second connection) and only release the client later in `finally`. When 10 requests (pool `max` 10, `db/pool.ts`) are inside that window at the same time, every one holds a client and waits for another one. Nobody can proceed.
- Reproduced twice: 12 parallel `PUT /master/document-types/:id` and 10 parallel `POST /companies/:id/bank-accounts` both ended with all requests timing out. Afterwards even `POST /api/auth/login` hung (pool permanently empty) until I killed and restarted the process.
- On Render the pool has `connectionTimeoutMillis: 5000`, so there it would be a 5 second stall, a swallowed "Audit log failed" error (audit row lost) and 500s instead of a permanent hang; it still needs 10 simultaneous requests, which a normal 5 to 10 user team will rarely produce, but one bad burst (a script, a double click on Save, an import) is enough, and the local pool has no timeout at all.
- Smallest fix: call `auditChange(client, ...)` before `client.release()` (a `PoolClient` works as the first argument, widen the type to `Pick<Pool,'query'>`), or move the audit call after `client.release()` (restructure: do the release in the success path before auditing). Simple routes that use `db.query` only (countries, banks, etc.) are not affected.
- Add one check to the test plan: 12 parallel PUTs must all return 200.

### N2 Medium: primary account rule can still be broken (PATCH)
- `companies.ts` ~314 to 324. The guard only rejects `isPrimary === false`; the clearing step runs on any truthy value and the value is then written through `COALESCE`.
- `PATCH {"isPrimary":0}` on the only primary: 200, company has 0 primary accounts. `{"isPrimary":"false"}`: 200, 0 primaries (the string is truthy, so the others are cleared, then `'false'` is written). Same root cause as M1 (no boolean check), and the new rule "cannot unmark the only primary" is bypassed.
- `PATCH {"isPrimary":true}` on a soft deleted account: 200, clears the real primary and makes the deleted (inactive) account primary, leaving 0 active primaries. The UPDATE does not filter `is_active = true`.
- `POST` first account race: 6 parallel POSTs to a new company all returned 200 and 2 became primary (no lock or unique index on one primary per company). `GET /companies` then shows `primary_accounts: 2`.
- Fix: `if (isPrimary !== undefined && typeof isPrimary !== 'boolean') 400`; add `AND is_active = true` to the PATCH `WHERE` and to the `before` select; `SELECT ... FOR UPDATE` on the company row (or a partial unique index `ON company_bank_accounts(company_id) WHERE is_primary AND is_active`) for the race.

### N3 Medium: the `<` `>` rule on `POST /companies` is bypassed with an array or object
- `companies.ts` ~102 only checks top level strings, and `POST` has no type check for plain text fields. `POST /companies {"name":"x","address1":["<script>alert(1)</script>"]}` returns 201 and stores `{"<script>alert(1)</script>"}` (the pg array text). `{"extra":{"a":"<"}}` is ignored. The doc of the fixing session says the rule protects letters printed as HTML; this path still lets markup in. PUT is safe (rejects non strings).
- Fix: reuse the PUT loop (string or null only, then `hasMarkup`) in POST.

### N4 Low: audit log stores full bank account numbers
- `audit_logs.new_values` keeps the whole row: `company_bank_accounts.account_number` in clear (checked: `123456789012`), and `companies.bank_account_no`, while the new UI masks the number (`XXXX9012`). Anyone who can read `GET /api/users/audit-logs` sees full numbers. Fix: mask these keys in `auditChange` for resource types `company` and `company_bank_account`.
- Audit rows are written once per change: no duplicates for create, update, delete on countries, document types, companies and bank accounts (checked ids); failed or forbidden requests write nothing; log is skipped for a request already logged (`autoAudit` skip works). Rows are only written after COMMIT. `resource_type` values are `master.<table>`, `company`, `company_bank_account` (column is VARCHAR(100), fine). The audit write itself swallows its own errors (existing behaviour), so a failed audit never blocks a change.

### N5 Low: format checks
- Work as written for POST (valid values accepted and upper cased, wrong ones 400) and PUT (only changed values are checked; a legacy bad value can be re-saved, can be cleared, a change to another bad value gives 400; whitespace padded copy of the legacy value passes).
- Gaps (all design level, none bypass): GSTIN state code `00` accepted and no checksum; PIN code must be 6 digits even when `country` is not India; phone accepts only `0-9 + ( ) - space` so `0124-4567890, 9876543210` (two numbers) and `ext 12` are refused (users with two numbers will be blocked on edit); email accepts one address only; IFSC and PAN fine.

### N6 Low: usage guards (`textUsage`, `inUseByText`, `GET /master/usage`)
- SQL is parameterised (`WHERE col = $1`); table and column names are fixed. Names with an apostrophe work (create then delete 200).
- Delete and rename of a salutation or source used on a consumer give 409 with a clear message; a case only rename while in use is also blocked; a description only edit is allowed; unknown id 404; bad uuid 400. Legacy rows containing `<` or `>` can still be renamed and deleted.
- Match is exact text. A consumer that stores `mr.` (other case) is not counted for `Mr.`, so the item can be deleted while a differently cased copy exists (observed: delete 200). Low, because the dropdown writes exact names.
- `GET /master/usage` (new): 200 in 30 ms on the test DB, open to every signed in role (read only data, counts), 401 without token, POST gives 404. It scans `consumers`, `co_applicants` and `applicant_details` on every page load; fine now, add an index or cache when those tables reach tens of thousands of rows.
- Old Medium and Low findings still open after the new code (verified again at the end): M2 (bank account trim, blank bank name, PATCH cannot clear), M3 (NUL byte gives 500), M4 (multer errors 500, uppercase id, empty file), M5 (`dist/` not rebuilt), L1 (POST company no type checks, `write_to_global_settings:"false"`), L2 (description length), L3 (HEAD gives 403).

### N7 Frontend: in flux, cannot be signed off
- Between the peer message and my re-read the page was rewritten again: `set-master.js` is now 414 lines with a new rail layout (`SM.screens.*`), `set-master-docs.js` (164 lines) and `set-master.css` are new, `index.html` was modified. The first version I tested (11 tabs, `SMPage.edit`) no longer exists, so my round 1 browser results and the peer's description of `SMPage.edit`, `_save`, `_endEdit`, `_rowActions` and masked bank numbers refer to code that is gone.
- Current state (11:48): `index.html` loads only `set-master.js`. `set-master-docs.js` and the referenced `set-master-company.js` (not on disk) are not loaded, so `SM.screens.checklist`, `.dispatch` and `.companies` are `undefined`. The page falls back to the Locations screen for Companies, Document checklist and Dispatch log: those three screens, and therefore the company, bank account, logo, document type and dispatch UI, are currently unreachable. Locations, Applicant lists and Banks render with no console error.
- The old top menu links (`Router.navigate('/set-master',{tab:'company'})` etc.) are mapped by `SM.OLD_TABS`; `company`, `doctype` and `dispatch` map to the missing screens.
- Things in the new code to check once it is finished: `SM.can()` copies the role rule into the browser (super_admin all, project_manager no delete), so a role rule change on the server needs a second edit here; the drawer form sends `''` for blank optional fields, which the API turns into null (this clears values, which is intended); the Locations delete clears the selection before the delete succeeds, so a 409 (country has states) leaves the selection on the next country; "Delete" is disabled only from the usage counts that were loaded up to 30 seconds earlier (`loadedAt`), the server remains the real guard.
- Bug that exists in both versions (from the old file, line `window._cmBankCompanyId = json.data.id` in `saveCompanyInline`, unchanged versus HEAD): after saving a new company the id of that company stays in `window._cmBankCompanyId`, so the next bank account added while creating a different company is posted to the previous company instead of being queued. Check that the new company screen does not copy this.

## What the peer's list asked for: answers
- Audit duplicates: none (see N4).
- `textUsage` SQL: safe and correct for exact match (N6).
- Format check bypasses: none on PUT for strings; POST bypass by array (N3); unchanged legacy values are intentionally skipped.
- Edit mode form state bugs: not testable, the code was replaced (N7).
- Breaks other modules: no. Booking, brokers, payments still only GET the lists. The `autoAudit` skip is only active when `auditChange` ran. New pool deadlock (N1) can affect the whole API (login hung), not only Set Master.

## Doc claims to add to the earlier list
- The module doc and `COMPLETED_TASKS` should not say Set Master is verified until N1, N2, N3 are fixed and the new UI is finished and loaded.
- Any claim "audit log records every add, edit, delete" holds for the Set Master routes and companies; it records full account numbers (N4) and can lose a row when the pool is busy (N1).
