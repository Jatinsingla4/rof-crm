# Module 01 Set Master: flow review, round 2

Reviewer: Chat 1 (Flow), read only, 2026-10-16. Read against the uncommitted code in the main folder. Nothing was run against a database; every CONFIRMED item was traced in code (file and line), every SUSPECTED item needs real data or a run to prove.
Paths are under `packages/` unless stated. Items already logged as DT-049 to DT-070 are skipped, except where this round found new evidence (marked "extends DT-nnn").
Next free DT number: DT-071.

## 1. How the data really flows today (re-checked against current code)

| Set Master data | Who reads it (verified) | Stored elsewhere as |
|---|---|---|
| Salutations, professions | `web/public/js/pages/booking.js:10-11, 24-25` (Booking only). Edit Booking has its own fixed list (`edit-booking.js:236`) | text on `consumers`, `co_applicants`, `applicant_details` |
| Nationalities | Fetched at `booking.js:12` and turned into `natOpts` at `booking.js:26`, but `natOpts` is never used. Booking uses a fixed toggle (`booking.js:314-322`) | text on `consumers.nationality`, values `resident`, `pio`, `nri`, `oci` from Booking; `Indian`, `NRI`, `OCI` from Edit Booking (`edit-booking.js:469-474`); `Indian`, `NRI`, `Foreign` from Transfers (`transfers.js:548-550`) |
| Sources of enquiry | `booking.js:1463` | text on `consumers.source_of_enquiry` |
| Banks | `booking.js:1469`, `brokers.js:234`, `booking-payment.js:29`, `pending-cheques.js:72`, receipt entry form `payments.ts:3282` | text on `receipts.bank_name`, `booking_records.bank_name`, `consumers.finance_bank`; only `receipts.clearing_bank_id` is an id |
| Countries, states, cities | nobody (Booking uses a fixed state list, `booking.js:30`) | free text on consumers and companies |
| Document types | nobody (Booking uses fixed slugs, `booking.js:1819-1839`) | nothing |
| Document dispatch | `consumers.ts:1283`, `surrender.ts:165` | `document_type` is free text |
| Companies | `projects.ts:18`, `documents.ts` (demand, cover, allotment, ATS, conveyance), `custom-letters.ts:126`, `reports.ts:4959, 5057`, `transfers.ts:571`, `set-projects.js:573`, `reports.js:84`, `users.ts:304` | `projects.company_id` (SET NULL), `user_company_access` (no FK, never enforced) |
| `global_settings` company copy | receipts (`booking.ts:3162-3175`, `payments.ts:2107-2120`), demand, cover and allotment letters (fallback), report header (`reports.ts:1596`), consumer file (`consumers.ts:1126`) | written only by "Set as active company" (`companies.ts:194`) and logo upload (`companies.ts:382`) |
| Company bank accounts | clearing-bank dropdown (`payments.ts:3701`), bank ledger and cash-bank summary (`reports.ts:4664, 4893, 4910`) | ids on `receipts`, `outgoing_payments`, `draw_refunds` |

Status of the older report (`01-set-master-flow.md`): R2, R3, R4, R5 (partly), R6, R7, R8, R9 still true in current code and are in DT-059 to DT-064. R1 is wrong in its premise, see F2-004. R10 is not in any DT, see F2-013. R11 is restated in F2-019.

## 2. Findings, most severe first

### F2-001 HIGH, CONFIRMED. Demand generation charges GST to OCI and PIO buyers; every other money path exempts them
- Where: `api/src/routes/payments.ts:487` (`plan.nationality === 'nri' || plan.nationality === 'NRI'`). Compare `booking.ts:339, 821, 990`, `payment-waterfall.ts:434`, `payments.ts:2134, 2593, 3323`, `documents.ts:869, 1542`, `consumers.ts:1354` (all exempt nri, oci and pio).
- What breaks: for a consumer whose nationality is OCI or PIO, `POST /payments/demands/generate` stores `cgst_amount` and `sgst_amount` on the demand (`payments.ts:497-517`), while the booking, the receipt and the printed demand letter show no GST. Stored demand and printed letter disagree, and the buyer is asked for tax the rest of the system treats as exempt. `COALESCE(c.nationality, 'indian')` (`payments.ts:414`) is also a different default from the other sites.
- Root cause: the exemption test is copied into at least 11 places with 4 different spellings (exact case list of six, lower-case list of three, two-value test, SQL `LOWER(...) IN`). There is no shared helper.
- Fix: one helper `isGstExemptNationality(n)` (trim, lower case, set of nri, oci, pio) in `utils/`, used at all sites. Then the real fix of DT-060 (flag on the nationality row) can change one place.
- Module: Payments (other module). Trigger data is Set Master nationality text. Extends DT-060 (the DT says all sites exempt oci and pio; this one does not).

### F2-002 HIGH, CONFIRMED. A bank name with a double quote runs script in the receipt entry form, which holds the session token
- Where: `api/src/routes/payments.ts:2796-2798` (`<option value="${b.name}">${b.name}</option>`), token at `payments.ts:2998` (`const TOKEN = '${token}'`). Input rule at `api/src/routes/master.ts:43` blocks only `<` and `>`.
- What breaks: a project_manager (allowed to create banks) adds a bank named `X" autofocus onfocus="fetch(...)"`. When a finance user opens the receipt entry form (`GET /payments/receipt-form/:consumerId`, `payments.ts:3190`), the attribute breaks out and the script runs in a page that contains the user's JWT. Privilege escalation from project_manager to super_admin or accounts_finance.
- Root cause: server-rendered HTML puts a master name into an attribute with no escaping; the Set Master markup rule assumes `<` and `>` are the only danger. `pmtEsc` exists in the same file (`payments.ts:2038`) but is not used here. `x.installment_name` and `u.name` on neighbouring lines are also raw (not Set Master data).
- Fix: use `pmtEsc` for every interpolated value in `buildReceiptFormHtml` (at least `payments.ts:2796-2802`). In `master.ts` also reject `"` and backtick, or accept that output escaping is the only defence and say so in the module doc.
- Module: Payments (other module). Data source is Set Master. DT-063 covers the JS pages only, not this server-rendered page; extend it.

### F2-003 HIGH, CONFIRMED. Letters print the legacy company bank columns, and the Company screen no longer lets anyone edit them
- Where: legacy columns are in `companies.ts:29-30` (`bank_company_name`, `bank_account_no`, `bank_ifsc`, `bank_name`, `bank_branch`) and copied at `companies.ts:205-209`. Letters read them at `documents.ts:1410, 1449-1453, 1885, 1962`. The Company form (`web/public/js/pages/set-master-company.js:60-79`) has no input for any of them.
- What breaks: the demand letter tells the buyer which account to pay into. That account is whatever sits in `companies.bank_*` or `global_settings.bank_*` (or the placeholder dash `'dash'` at `documents.ts:1410`). The owner edits "Bank accounts" in Set Master, sees a primary account, and the letter still prints the old one. A wrong or placeholder pay-in account on a demand letter is a money risk.
- Root cause: two sources for bank details. The new screen edits `company_bank_accounts`; letters were never moved over. The screen text makes it worse: `set-master-company.js:179` says "Receipts and letters use it", line 150 says "Receipts and demand letters need a primary account". Both statements are false today (receipts print no bank at all).
- Fix: at letter time read the primary active row of `company_bank_accounts` for the project's company and fall back to the legacy columns only if there is none; use the same query when "Set as active" copies to `global_settings`. Until then change the two screen texts.
- Module: Documents (other module) plus Set Master screen text. Extends DT-062.

### F2-004 HIGH, CONFIRMED (code) / SUSPECTED (production data). The nationality list feeds nothing, and its in-use guard compares the wrong spelling
- Where: `booking.js:26` (`natOpts` unused), `booking.js:314-322, 322` (hidden input default `resident`), `edit-booking.js:469-474`, `transfers.js:548-550`; guard at `master.ts:144-155, 239-240, 485`.
- What breaks: (a) Booking writes `nri`, `oci`, `pio`, `resident` in lower case; Set Master holds `NRI`, `OCI`, `PIO`, `Indian`. `textUsage` uses `WHERE col = name` (`master.ts:148`, `usageByName` at `master.ts:474-478`), which is case sensitive, so "Used on" shows 0 for NRI and the delete and rename guard does not fire for buyers stored as `nri`. The note on the screen (`set-master.js:29`) and DT-060 ("Set Master now blocks it while in use") describe a protection that does not hold for Booking data. (b) Deleting or renaming "NRI" in Set Master does not change tax either, because nothing reads the list; so the screen offers a control that does nothing and a warning about an effect that cannot happen. (c) The real GST driver is a hard coded toggle and three screens with three different value sets.
- Root cause: three separate sources for one field, matched by exact text.
- Fix: decide the single source (list with a flag, DT-060). Short term make the guard case insensitive (`lower(col) = lower($1)`) in `master.ts:148` and `:476`, and change the screen note to say what is true. Production check: `SELECT nationality, count(*) FROM consumers GROUP BY 1`.
- Module: Set Master plus Booking, Edit Booking, Transfers. Corrects the premise of DT-060 and R1.

### F2-005 MEDIUM, CONFIRMED. "Set as active company" is a one time copy, the screen does not say which company is active, and its dialog text is wrong
- Where: `companies.ts:194` (copy only when `write_to_global_settings === true`), `set-master-company.js:113-116` (dialog), `documents.ts:1438-1453` (project company wins over the global copy).
- What breaks: after "Make active", a later edit of the same company (new GSTIN, new phone) is saved to `companies` but receipts and report headers keep the old values until someone presses the button again. Nothing on screen marks the active company or shows that the copy is stale. The dialog promises that demand letters and allotment letters will print this company; for any project that has a company they print the project's company instead.
- Root cause: global copy has no link to a company id and no refresh on save.
- Fix: store `active_company_id` in `global_settings`; on every company save, if it is the active one, refresh the copy in the same transaction; show an "Active" tag in the list; correct the dialog to "Receipts and report headers".
- Module: Set Master. Extends DT-061.

### F2-006 MEDIUM, CONFIRMED. Company address is split in the form but only line 1 is printed
- Where: form fields `set-master-company.js:65-69` (address1, address2, address3, city, state, country, pin_code); copy `companies.ts:199` (`address1` only); letters `documents.ts:1442, 1731, 2017` use `address1` only; receipts `booking.ts:3164`, `payments.ts:2109`.
- What breaks: city, state, PIN and lines 2 and 3 never reach a receipt or letter. If the owner follows the form and puts the street in line 1 and the city in the city field, the printed address has no city. Also a cleared `place_of_supply` (the form sends `''` for blank fields, `companies.ts:166`) prints blank on a tax receipt (`booking.ts:3170`) and a blank `reg_address` prints a bare "Regd. Office:" label (`booking.ts:3223`, `payments.ts:2427`).
- Root cause: print code predates the split address; no rule says which fields a printable company must have.
- Fix: build one display address (lines 1 to 3, city, state, PIN) in a helper used by the copy and by letters. Require name, address line 1 and place of supply on the company save, or show them as setup gaps (`set-master-company.js:13-18`).
- Module: Set Master plus Receipts and Documents.

### F2-007 MEDIUM, CONFIRMED. A project with no company disappears from Stock and Summary reports
- Where: `reports.ts:4959` (`stock-report`) and `reports.ts:5057` (`summary-report`) use `JOIN companies`; `reports.ts:4683` (`cash-bank-summary`) filters `cba.company_id = (SELECT company_id FROM projects ...)`, which is NULL for such a project.
- What breaks: `POST /projects` accepts no company (`projects.ts:36-52`, `companyId || null`), and a company removed in SQL sets `projects.company_id` to NULL (baseline FK `projects_company_id_fkey ON DELETE SET NULL`). Those projects drop out of both reports with no warning, so totals are low. ATS and conveyance deed also print the promoter as a dash (F2-012).
- Root cause: inner join on an optional link; Set Master does not show projects without a company.
- Fix: `LEFT JOIN` with a "No company" group in both reports; add "projects without a company" to the setup gaps of the Companies screen and make company required when a project is created.
- Module: Reports (other module) and Projects. Not in any DT.

### F2-008 MEDIUM, CONFIRMED. A deleted company bank account can still hold receipts, and it drops out of the Cash Bank Summary
- Where: soft delete `companies.ts:347-351` (no usage check); `reports.ts:4681` (`WHERE cba.is_active = true`) versus the ledger `reports.ts:4893` (`LEFT JOIN`, includes it). FKs: `receipts.company_bank_account_id`, `draw_refunds`, `outgoing_payments` point at the account.
- What breaks: delete an account that received money and its credits and debits vanish from Cash Bank Summary while the Bank Ledger still shows them; the two reports disagree and the cash position is understated. The clearing-bank dropdown (`payments.ts:3701`) also stops offering it, so an old cheque cannot be cleared into it.
- Root cause: delete guard looks only at primary status, not at use.
- Fix: block the delete (or offer "inactive") when any of the three tables reference the account; report queries include inactive accounts that have rows.
- Module: Set Master (guard) plus Reports.

### F2-009 MEDIUM, CONFIRMED. Every signed-in role can read full company bank account numbers
- Where: `index.ts:534` (`/api/companies` has `authenticateToken` only, no `rbac`); `companies.ts:81-95` (`SELECT c.*`, includes legacy `bank_account_no`), `companies.ts:98-112`, `companies.ts:236-248` (full `account_number`).
- What breaks: read_only_viewer and support_agent can fetch `/api/companies/:id/bank-accounts` and see complete account numbers. The screen masks them (`set-master-company.js:15`), the API does not. Other pages only need id and name (`set-projects.js:573`, `reports.js:84`, `users.ts:304`).
- Root cause: masking was done in the browser; GET has no role rule.
- Fix: return `account_number` masked unless the role is super_admin or accounts_finance, and drop `bank_*` from the list query. A `master_data` or `payments` view check on the bank-accounts GET is the alternative.
- Module: Set Master.

### F2-010 MEDIUM, CONFIRMED (baseline) / SUSPECTED (Neon). List name length is wider than the column that stores it
- Where: baseline `salutations.name` varchar(50) but `consumers.salutation`, `co_applicants.salutation`, `applicant_details.salutation` varchar(20); `nationalities.name` varchar(100) but `applicant_details.nationality` varchar(50). UI allows 150 (`set-master.js:334`); `cleanBody` has no length rule (`master.ts:34-47`).
- What breaks: a 21 to 50 character salutation or a 51 to 100 character nationality saves in Set Master without error, then booking save fails with `22001` when a buyer picks it. A 101 to 150 character name gets the generic "A value is too long" with no field name.
- Root cause: no per-list maximum tied to the consuming columns. Baseline types are reconstructed (DT-029), so check Neon with `information_schema.columns` first.
- Fix: per-list max (salutation 20, profession 100, nationality 50, source 100) in `addRoute` and `updateRoute` and in the form `maxlength`.
- Module: Set Master.

### F2-011 MEDIUM, CONFIRMED. Custom Letters merge breaks on `$` in data and can pick the wrong company
- Where: `custom-letters.ts:212` (`html.replace(regex, value)`, string replacement); company lookup `custom-letters.ts:126-140` (`LEFT JOIN booking_records br ON br.consumer_id = c.id`, `LEFT JOIN payment_plans`, `LIMIT 1`, no `ORDER BY`). Contrast `documents.ts:2355, 2361`, which use a function replacer.
- What breaks: a company name or address containing `$&`, `$1` or `$$` is rewritten in the letter. For a consumer with units in two projects owned by two companies, the letter takes the company of an arbitrary row, and the extra join on `payment_plans` multiplies rows. Values are also inserted without HTML escaping (`documents.ts:2355-2361` as well).
- Root cause: string replacement and an unordered `LIMIT 1` over joins that fan out.
- Fix: `() => value` in the replacer; pick the booking by an explicit `booking_id` or latest `created_at`; escape merged values.
- Module: Module 2 (Customized Letters), reader of Set Master data. Same class as DT-062.

### F2-012 MEDIUM, CONFIRMED. Legal documents and letters print a placeholder when the company is missing
- Where: ATS `documents.ts:2098, 2101`, conveyance deed `documents.ts:2253, 2255` (`'dash'` for promoter name and address); hard coded fallback `'ROF INFRATECH & HOUSING PVT. LTD.'` at `documents.ts:1390, 1722, 1879`.
- What breaks: an Agreement for Sale or Conveyance Deed can be generated for a project with no company and prints a dash as the promoter, with no warning. Demand, cover and allotment letters print a fixed company name if `global_settings` is empty, even if the real company differs.
- Root cause: no rule that a project used for documents must have a complete company.
- Fix: refuse to generate (400 with a clear message) when `company_id` is NULL or name, CIN or address is blank; remove the hard coded name.
- Module: Documents (other module).

### F2-013 LOW, CONFIRMED. Bank "Receipts" count and delete guard see only `clearing_bank_id`
- Where: `master.ts:219, 487`; screen column `set-master.js:383`.
- What breaks: a bank used by name on receipts, bookings and loans (`receipts.bank_name`, `booking_records.bank_name`, `consumers.finance_bank`) shows 0 and can be renamed or deleted; reports grouping by bank text then show a name that is no longer in the list. No data is lost.
- Fix: also count text usage (case insensitive) or label the column "Clearing receipts" so it is not read as total use. Same as R10 of the old report; it was never put in a DT.
- Module: Set Master.

### F2-014 LOW, CONFIRMED. The company form overwrites with stale values
- Where: `set-master-company.js:97-101` (every field is sent, including untouched ones); `companies.ts:145-185` (no version check).
- What breaks: two super_admins open the same company; the second save puts back the first person's old phone or GSTIN.
- Fix: send only changed fields, or compare `updated_at` and return 409.
- Module: Set Master.

### F2-015 LOW, CONFIRMED. Edit Booking and Transfers ignore the Set Master lists
- Where: `edit-booking.js:236` (salutation fixed to Mr., Mrs., Ms., Dr., M/s), `edit-booking.js:469-474` (nationality), `transfers.js:548-550`.
- What breaks: a salutation added in Set Master cannot be chosen in Edit Booking; a buyer saved as `resident` or `pio` opens with a blank nationality, so a user picking "Indian" to fill the blank silently changes the GST treatment of a PIO buyer (F2-001, F2-004).
- Fix: load `/master/salutations` and nationalities once and select by case insensitive match.
- Module: Edit Booking, Transfers.

### F2-016 LOW, CONFIRMED. More unescaped company and bank names (extends DT-063)
- Where: `set-projects.js:581`, `reports.js:103, 5041, 5130` (`<option ...>${c.name}</option>`), `receipts.js:837` (`a.bank_name`, `a.account_name`), `pending-cheques.js:155-157`.
- What breaks: only old rows that contain markup are at risk now, because new input rejects `<` and `>`. Names with `&` render differently from the stored value.
- Fix: `Utils.esc` in these five places.
- Module: Projects, Reports, Receipts, Pending Cheques.

### F2-017 LOW, SUSPECTED. Company access per user is stored but never used
- Where: `users.ts:380-382, 514-517` write `user_company_access`; no other file reads it; no FK on `company_id`.
- What breaks: if the owner expects a user limited to one company, every user still sees every company, project and receipt. Needs the owner's answer on intent.
- Fix: either enforce in project and report queries, or remove the field from the employee login form.
- Module: Module 2 (Employee Login) and every reader.

### F2-018 LOW, CONFIRMED. Clearing a receipt with a bad bank id returns 500
- Where: `payments.ts:3774-3803`; the router does not use `pgErrorHandler`, so `22P02` and `23503` reach the generic 500 handler (`index.ts:548-560`).
- What breaks: a stale browser tab sending the id of a deleted bank gets "Internal server error" instead of a message. Set Master blocks deleting a bank used on a receipt, but not a bank id deleted before the cheque was cleared.
- Fix: validate the bank exists, or mount `pgErrorHandler` on the payments router.
- Module: Payments.

### F2-019 INFO, CONFIRMED. Two Set Master screens have no reader
- Locations (`countries`, `states`, `cities`): no API or page reads them (Booking uses a fixed 14 state list, `booking.js:30`). Document checklist: only the dispatch datalist reads the names. Both are labels today (DT-059 covers the checklist). The module doc should say so, so nobody relies on them for validation.
- Module: Set Master.

## 3. Checked and found sound (do not re-test)

- Role guard on `/api/master` writes (`master.ts:23-27`), case insensitive, uses the role read from the database (`index.ts:228-236`), not the token.
- Receipt HTML escapes all company fields (`booking.ts:3220, 3304`, `payments.ts:2424-2427` via `esc` and `pmtEsc`).
- Audit rows are written on the same connection while a transaction is open (`master.ts:348`, `companies.ts:224, 281, 327`); `audit_logs.resource_type` is varchar(100) and `resource_id` uuid, so all resource types fit.
- Company PUT and bank account routes are transactional and lock the company row (`companies.ts:267, 304`).
- Document type rename updates `booking_documents` and `document_dispatch` in one transaction (`master.ts:329-346`).

## 4. Not determined from code

- Real values in `consumers.nationality`, `global_settings`, `companies` and `company_bank_accounts` on Neon (needed for F2-001, F2-003, F2-004, F2-010).
- Whether any live consumer is OCI or PIO and already has demands generated (F2-001).
- Whether the Neon column widths match the baseline (F2-010).
- Whether `document_templates` rows use other company merge keys than the ones traced.

## 5. Proposed DT items (not added to the sheet)

DT-071 F2-001 shared GST exemption helper (High, Payments). DT-072 F2-002 escape receipt entry form (High, Payments). DT-073 F2-003 letters read primary bank account (High, Documents). DT-074 F2-004 and F2-015 nationality single source and case insensitive guard (High, Booking and Set Master). DT-075 F2-005 and F2-006 active company link and printable address (Medium, Set Master). DT-076 F2-007 and F2-008 reports and bank account usage (Medium, Reports). DT-077 F2-009 mask bank numbers in the API (Medium, Set Master). DT-078 F2-010 list length rules (Medium, Set Master). DT-079 F2-011 and F2-012 letters (Medium, Documents).
