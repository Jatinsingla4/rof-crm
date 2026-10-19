# ROF CRM: Feature and UI Proposals

Status: proposal only. No code was changed for this document. Nothing here is approved or scheduled. Items that the owner accepts should be added to `DEFERRED_TASKS.md` with the next free ID (DT-049 onwards) at that time; none were added now.

Written from the point of view of a product owner for an Indian affordable housing developer (HRERA, booking to possession lifecycle). Facts about the current system come from the code and the baseline schema (`packages/api/src/db/baseline/schema_baseline.sql`), read on 2026-10-16. Where something was not checked, it is marked "to verify".

Scope note: the Set Master module (`master.ts`, `companies.ts`, `set-master.js`, middleware, baseline files) is being edited in another session. Nothing below touches those files. Proposals that need a change there are marked "needs Set Master session".

Effort: S is under 2 days, M is 3 to 8 days, L is more than 8 days. Risk is the chance of breaking existing behaviour or money figures.

---

## Module 01 Set Master (owner's current module; every item checked in code, 2026-10-16)

Scope: country, state, city, salutation, profession, nationality, bank, source of enquiry, document type, document dispatch, company master (and company bank accounts), plus what directly reads from them. Proposal only. `master.ts`, `companies.ts`, `set-master.js`, middleware and baseline were read, not changed. Any change below must be done by the session that owns Set Master. The rest of this file (sections 1 to 6) covers all modules and stays as a later reference; the next module is reviewed only after the owner closes this one.

Evidence is `file:line` as read on this date. Line numbers move when the other session edits.

### SM-UI: screen problems

| ID | Problem | Evidence | Fix | Effort |
|---|---|---|---|---|
| SM-U1 | 207 inline `style=` in one file; company form fields use fixed colours (`border:1px solid #999`) and fixed blue buttons (`background:#1976D2`) | `set-master.js` 861, 868, 1226, 1087 | Classes and tokens in `rof.css`; also fixes dark mode contrast on this page | M |
| SM-U2 | Emoji in empty states | `set-master.js` 408 (clipboard), 428, 455, 480 (map, city, mail icons). 12 emoji lines in the file | Text only empty state with an "Add" hint | S |
| SM-U3 | Delete button is a bare cross character with a red inline style | `set-master.js` 415 | Labelled "Delete" button, class based | S |
| SM-U4 | Native `confirm()` for delete, used in 5 places, and no reason or usage count shown | `set-master.js` 746, 783, 1178, 1266 | Shared confirm dialog that shows "used by N records" (see SM-F2) | S |
| SM-U5 | Simple lists (country, state, city, bank, source) have no Edit button, but the API already supports PUT. Only document type, company bank account and company have Edit | `set-master.js` 408-416 (no edit column) vs `master.ts` 128, 152, 178, 184, 210 | Inline Edit on those lists; a typo today needs delete and re-add, which the delete guards can block | S |
| SM-U6 | Salutation, profession and nationality cannot be renamed at all: no PUT route | `master.ts` 193-205 (GET, POST, DELETE only) | Add PUT (needs Set Master session). Renaming must also update consumers, see SM-F3 | S |
| SM-U7 | Search filters rows only in the browser; it is per list and has no sort, no count, no paging | `set-master.js` 145, 171, 205, 235, 801 | Row count, sort, and server side paging if lists grow (cities will) | S |
| SM-U8 | Dash used as the empty value in cells | `set-master.js` 413 (the fallback value for empty cells) | Plain hyphen or blank, per the no em dash rule | S |
| SM-U9 | Accessibility: no `aria-` and no labels tied to inputs in this page; "Edit" is a `<span onclick>` | 0 `aria-` matches; `set-master.js` 716 | Real `<button>`, `for` and `id` on labels | S |
| SM-U10 | Company form is a long single page with required fields not marked and no format hints | `set-master.js` 861-874 | Group (Identity, Registered address, Tax, Bank), mark required fields | M |
| SM-U11 | Bank account number shown in full in the table and passed through `onclick` arguments in HTML | `set-master.js` 1082, 1087 | Mask to last 4 in the table, load the full value only when Edit is opened | S |

### SM-F: feature proposals (each has a code reason)

| ID | Feature | What it does | Why it matters | Evidence in code | Touches | Effort | Risk | Pri |
|---|---|---|---|---|---|---|---|---|
| SM-F1 | Change log for master data | Write who changed what, before and after, for every add, edit, delete and for the "active company" switch | Wrong bank or company detail changes every receipt and letter; nobody can tell who did it | No audit call in `master.ts` or `companies.ts` (0 matches). Active company switch writes `global_settings` at `companies.ts` 143 and is triggered from `set-master.js` 1266 | `audit_logs`, `master.ts`, `companies.ts` | S | Low | P1 |
| SM-F2 | "Used by" count before delete or rename | Show how many consumers, receipts or projects use an item; refuse delete when used | Today only country, state and bank have guards | Guards exist for country, state, bank (`master.ts` 129, 153, 185). Salutation, profession, nationality, source, city, document type and dispatch use plain `deleteRoute` with no guard (`master.ts` 179, 195, 200, 205, 211, 324, 358) | `master.ts` | S | Low | P1 |
| SM-F3 | Text fields vs master lists: keep them consistent | Consumers store salutation, profession, nationality and source as plain text, so a master rename or delete leaves old text behind and reports split | Report totals by source or profession drift | `consumers.ts` 96 and 164 store `source_of_enquiry` as a column of the consumer; `booking.ts` 517-524 saves `salutation`, `nationality`, `profession` as values. No foreign key | `consumers`, `booking_records` text columns, `master.ts` | M | Medium | P1 |
| SM-F4 | Deactivate instead of delete | `is_active` on list tables; inactive items hide from new dropdowns but stay on old records | Hard delete is the only option today, so history is lost or delete is blocked | `master.ts` delete routes issue deletes (lines 129-211); `companies` and `company_bank_accounts` already have `is_active` (baseline) but the simple lists do not (`banks` has name, ifsc_prefix, branch only) | list tables (new column), `master.ts`, dropdown readers | M | Medium | P2 |
| SM-F5 | Format checks for company and bank fields | PAN (10 chars pattern), GSTIN (15 chars, state code matches company state), CIN, IFSC (4 letters, 0, 6 characters), PIN (6 digits), phone | Wrong GSTIN on an invoice is a GST problem; typo in IFSC makes refunds fail | `companies.ts` 65-100 and 104-180 only trim and save `gstin`, `pan_no`, `bank_ifsc`; no pattern test found | `companies.ts`, `set-master.js` form | S | Low | P1 |
| SM-F6 | One primary bank account per company, enforced | Exactly one `is_primary` per company; warn when none | Receipts and demand letters print the primary account | `company_bank_accounts.is_primary` exists (baseline). Route `companies.ts` 199-264 should be checked that it clears the old primary in one transaction (to verify) | `companies.ts`, `company_bank_accounts` | S | Medium | P1 |
| SM-F7 | Placeholder bank data warning | Banner on Company Master and on receipt entry while only the placeholder account exists | Known gap (DT-022) is silent today | `CLAUDE.md` "Known data gaps"; `payments.ts` 2114 reads `company_gstin` from `global_settings` | `companies.ts`, `global_settings` | S | Low | P1 |
| SM-F8 | Document type: validity and mandatory by stage in one rule table | Add validity in months and file type rules; link the checklist to the booking flow so a missing mandatory paper blocks the next stage | Feeds KYC and expiry features later | `document_types` has name, category, document_from, is_mandatory, project_id, required_at, no validity column (baseline 1403-1414); `kyc_documents.expiry_date` exists separately | `document_types` (new column), `master.ts` 214-324 | S | Low | P1 |
| SM-F9 | Copy document types from one project to another | One action instead of re-entering 15 papers per project | Each new project repeats the same list | Types are per `project_id` (`master.ts` 253); UI is one at a time (`set-master.js` 300-340) | `document_types`, `master.ts`, `set-master.js` | S | Low | P2 |
| SM-F10 | Document dispatch: structured type and proof | Pick a document type from the master instead of free text, add courier name, date, delivered status and file proof | Dispatch is the proof for notices and letters | `document_dispatch.document_type` is a text column and `dispatched_at` is optional (baseline 1342-1351; `master.ts` 341-345); rename of a type has to rewrite this text (rule 4 in the module doc) | `document_dispatch`, `master.ts` | M | Medium | P1 |
| SM-F11 | Company: GSTIN per project and state | Support more than one GSTIN and place of supply per company | A developer with projects in more than one state needs the right GSTIN on each invoice | `companies` has one `gstin` and one `place_of_supply` (baseline 947-980); a separate `project_gstin` table exists in the baseline | `companies`, `project_gstin` (Set Projects reads it) | M | Medium | P2 |
| SM-F12 | Bulk import and export of lists | CSV upload for cities, banks and professions; export every list | Cities and banks are hundreds of rows | `master.ts` has single row POST only (127-211); no export in `set-master.js` (no csv match) | `master.ts`, `set-master.js` | M | Low | P3 |
| SM-F13 | Master data completeness check | One page that lists blanks that other modules need: no primary bank, no GSTIN, no logo, project without document types, state without cities | Catches setup gaps before booking starts | Data is spread across `companies`, `company_bank_accounts`, `document_types`, `states`, `cities` | read only queries | S | Low | P2 |
| SM-F14 | Logo size and type check on server | Today only a 500KB check in the browser | Client check can be bypassed; logos print on every letter | Check at `set-master.js` 1285; server upload at `companies.ts` 280 (multer `uploadLogo`), limits to verify | `companies.ts` | S | Low | P2 |

### SM-ORDER: suggested order inside this module

1. SM-F1 and SM-F2 (safety, small): audit rows and used-by guards.
2. SM-F5, SM-F6, SM-F7 (money and tax correctness on company data).
3. SM-U5, SM-U6, SM-U3, SM-U4 (edit buttons and dialog), then SM-U1, SM-U2, SM-U8, SM-U9 (styling and accessibility).
4. SM-F3 and SM-F4 only after a decision on text vs foreign key, because they touch Booking and Consumers.
5. SM-F8 to SM-F10 with the Booking module, since they change what bookings require.

### SM-OPEN: things I could not confirm from code alone

- Whether `companies.ts` 199-229 clears the previous primary account in a transaction (SM-F6).
- Server side limits on logo upload (SM-F14).
- Whether any reader depends on the exact text of a salutation, profession, nationality or source (SM-F3); needs a grep across all routes before any rename feature.

---

## 1. The 10 best ideas (in order)

| # | Idea | Why first | Effort | Risk |
|---|---|---|---|---|
| 1 | One audit trail for every money and status change (extend `audit_logs`, write from one helper) | Today `surrender.ts`, `allocations.ts`, `transfers.ts` write no audit row at all, and receipt edit, cancel and bounce only partly. Nobody can answer "who changed this and when". | M | Low |
| 2 | Maker-checker on cancellation (surrender), receipt edit and receipt cancel, direct interest waiver, allotment cancel | `surrender.ts`, `allocations.ts`, `transfers.ts` have no `requireProcess`. `POST /interest-waivers/direct` skips the checker by design. `PATCH /receipts/:id` and `POST /receipts/:id/cancel` have no process gate. The pattern already exists (`requireProcess(..., 'maker'/'checker')`), so reuse it. | M | Medium |
| 3 | Overdue and ageing dashboard with one click to action (call, WhatsApp, demand letter, notice) | Collection is the cash engine. Data already exists in `demands`, `penal_interests`, `receipts`. | M | Low |
| 4 | RERA quarterly report exports (QPR style): bookings, cancellations, collections, construction stage per project and tower | HRERA compliance. `project_rera_numbers`, `construction_milestones`, `booking_records`, `cancellations` already exist. | M | Low (read only) |
| 5 | Document expiry and KYC verification queue | `kyc_documents.expiry_date` and `verified` exist but nothing alerts. Missing or expired KYC blocks registry and loan disbursal. | S | Low |
| 6 | Message templates and send log (WhatsApp, SMS, email) with merge fields | `communications.ts` has send routes and `email_templates` page, but no shared template library or approval status for WhatsApp templates. | M | Medium (provider rules) |
| 7 | Follow-up reminders and a "my day" task list tied to leads, dues and cheques | `tasks`, `call_logs`, `reminder_master` exist but are not joined into one worklist. | M | Low |
| 8 | Cheque lifecycle board (received, deposited, cleared, bounced, re-presented) with bounce charge and alert | `receipts.status` already has these values (see DT-026). The pending cheques page is a standalone HTML file with its own styles. | M | Medium (money) |
| 9 | Broker portal (read only first): own leads, bookings, commission statement, TDS certificate download | `brokers`, `broker_commissions`, `broker_applications`, `broker_tax_config` exist. Reduces calls to the accounts team. | L | Medium (new login type) |
| 10 | UI foundation: one component set (modal, table, empty state, toast, form field), keyboard friendly forms, mobile nav, no inline styles | 5,000+ inline `style=` attributes and 96 `alert/confirm/prompt` calls. Every new feature costs more until this is fixed. | L (phased) | Medium (touches every page) |

---

## 2. UI and UX review

Numbers come from a count over `packages/web/public/index.html`, `css/rof.css` and `js/pages/*.js` (41,000 lines of page code, 70 files).

### 2.1 Problems found

| # | Problem | Evidence | Impact | Suggested fix |
|---|---|---|---|---|
| U1 | Inline styles everywhere | About 3,500 `style="` in page JS (`reports.js` 1,103; `booking.js` 305; `receipts.js` 254; `set-master.js` 207; `documents.js` 176; `interest-waiver.js` 149) and 35 in `index.html` | Same element looks different per page; theme and dark mode break; a visual change means editing hundreds of strings | Move to classes in `rof.css`. Do it page by page when a page is already being touched. |
| U2 | Emoji used as icons | 169 emoji hits in 30 page files plus `index.html` (theme toggle icon and every empty state in `allotment.js`, `brokers.js`, `demands.js`, `dashboard.js`) | Looks unprofessional and renders differently per device; against the owner's rule | One small inline SVG sprite (line icons, `currentColor`). Empty state becomes icon-free text plus an action link. |
| U3 | Empty states are decoration, not help | `empty-state` with `empty-icon` and a bare title | User does not know the next step | Text only: what is empty, why, and one action ("Add broker", "Clear filters"). |
| U4 | `alert()`, `confirm()`, `prompt()` used 96 times | grep over `js/pages` | Blocks the page, cannot be styled, no reason capture for sensitive actions (cancel, waive) | One `confirmDialog({title, message, requireReason})` helper over the existing modal in `utils.js`. Needed anyway for maker-checker reasons. |
| U5 | Accessibility is close to absent | 0 `aria-` in `index.html`, 4 in all page JS, 0 `role=`; navigation opens on `:hover` only (`.has-sub:hover`); 181 + 857 inline `onclick` on non-button elements | Keyboard and screen reader users cannot reach menus or modals; fails basic audits | Menu opens on focus and Enter; real `<button>` elements; `role="dialog"`, `aria-modal`, focus trap and focus return in the modal helper; labels tied to inputs (`for`/`id`); visible focus ring. |
| U6 | No mobile layout | Only 3 `@media` rules (grid columns); no menu toggle; nav is a hover mega menu; 15 sticky or wide table rules but tables are not made responsive | Site visit and sales staff cannot use it on a phone | Collapsible nav drawer under 900px, tables in a scroll wrapper with a sticky first column, forms to one column. Start with Dashboard, Leads, Collection, Receipt entry. |
| U7 | Tiny type | 10px (11 rules), 9px, 9.5px, 8px, 10.5px, 11px in `rof.css` | Hard to read in dense tables, fails contrast and zoom comfort | Set a floor of 12px for body and table text; use a type scale (12, 13, 14, 16, 20). |
| U8 | Dark mode is the default and a toggle, but pages hard code colours | `data-theme="dark"` default; many inline colours (for example Logout button `color:#f87171`); two print or HTML bodies in `payments.ts` use fixed light colours | Contrast problems in one theme; printed letters inherit wrong colours | Tokens only (`var(--...)`); default to the OS setting (`prefers-color-scheme`), remember the choice. Keep documents and receipts light always. |
| U9 | Two styling systems | `pending-cheques.html` and `pages/custom-letters.html`, `employee-login.html` carry their own `<style>` with Arial and fixed greys | Looks like a different product | Load `rof.css` and use the shared components. |
| U10 | Dense tables with no help | `reports.js` is 5,970 lines; only 4 pages have pagination (`demand-status`, `documents`, `reports`, `transfers`); no sticky header on most; no column chooser; no saved filters | Large projects will load thousands of rows into the DOM and slow the browser | One table helper: sticky header, server side paging, sort, column show or hide, row count, saved filter. |
| U11 | Search and filter are inconsistent | No debounce anywhere in `js/`; many pages filter only after clicking a button, some on every keystroke | Slow or surprising | Shared `debounce` in `utils.js`; one filter bar pattern (search, project, date range, status, clear). |
| U12 | Export is page specific | 16 pages mention csv or export, each in its own way; no common format, no GST or amount formatting rules | Accounts team re-formats in Excel; numbers may show in different formats | One `exportTable(rows, columns, filename)` helper (CSV with raw numbers, plus formatted XLSX later). Every list gets an Export button. |
| U13 | Slow data entry on the biggest forms | `booking.js` 3,533 lines and `receipts.js` 2,077 lines; no keyboard shortcuts beyond Escape and Alt+C; no draft save; no field level validation messages visible | Booking and receipt entry are the most repeated tasks | Tab order, Enter to move or submit, inline validation (PAN, Aadhaar last 4, mobile, IFSC), draft autosave, "save and add next", remembered last project. |
| U14 | Indian formats | `utils.js` has formatters; unclear if lakh and crore grouping and `DD-MM-YYYY` are used everywhere | Mistakes reading amounts | One `inr()` (en-IN grouping, 2 decimals), amount in words on receipts and letters, one date format. To verify in `utils.js` and the report pages. |
| U15 | Loading and error states | `setLoading` exists in `utils.js` but not used by every page; errors are mostly `alert` | Blank screens while Neon wakes up (serverless cold start) | Skeleton rows, retry button on failure, request timeout message. |
| U16 | Printing | No `@media print` rule at all | Receipts, demand letters and reports print the whole app chrome unless a separate HTML is used | Print stylesheet hiding nav, header and filters. |
| U17 | Page title and branding | Title uses an em dash ("ROF Group - Real Estate Manager"); text uses `&mdash;` | Against the owner's copy rule | Replace with a hyphen or a pipe. |
| U18 | Session and navigation feedback | Logout is a plain link with an inline red; no unsaved changes warning on forms; no breadcrumbs | Data loss on accidental navigation | `beforeunload` guard on dirty forms; breadcrumb under the nav. |

### 2.2 Suggested order for the UI work

1. Foundation (no visible change for users): shared helpers (`confirmDialog`, `exportTable`, `debounce`, `inr`, table helper) and tokens in `rof.css`. S to M.
2. Replace emoji and empty states, remove em dashes. S.
3. Accessibility pass on the menu and the modal helper. M.
4. Mobile pass on 4 pages. M.
5. Page by page inline style removal, only when that page is open for a module fix (module plan, section 1, rule "changes stay inside the module"). L, spread out.

Each step is a UI change only and fits the "surgical changes" rule if done per page.

---

## 3. Feature proposals by module

Module numbers follow `MODULE_VERIFICATION_PLAN.md`, section 3. "Touches" lists tables and route files, taken from the baseline schema and `packages/api/src/routes`.

Priority tags: P1 compliance and money safety, P2 productivity, P3 later.

### Cross cutting (all modules)

| ID | Feature | What it does | Why a real estate team needs it | Touches | Effort | Risk | Pri |
|---|---|---|---|---|---|---|---|
| X1 | Unified audit trail | One `writeAudit(client, {user, action, resource, before, after, reason})` helper used by every state changing route. Reuse `audit_logs` (has `previous_values`, `new_values`, `immutable`) and keep `financial_audit_logs` for consumer scoped history. A read only "Audit" tab on consumer detail and a global Audit search page (user, date, resource, action). | Disputes with buyers, internal fraud checks, HRERA or court questions. Currently surrender, allocation, transfer and receipt edit routes write nothing or only some rows, and several audit writes are marked non fatal and swallowed (`payments.ts` around lines 884 and 1915). | `audit_logs`, `financial_audit_logs`; `payments.ts`, `surrender.ts`, `allocations.ts`, `transfers.ts`, `consumers.ts`, `brokers.ts`, `financial-ops.ts` | M | Low. Money paths must not fail because the audit insert failed: write the audit inside the same transaction so both commit or both roll back. | P1 |
| X2 | Generic approval requests | One `approval_requests` table (type, resource id, payload, maker, checker, status, reason, decided at). Used by waiver, cancellation, receipt edit, refund, broker payout, transfer. The existing `requireProcess(process, 'maker'/'checker')` stays as the permission check. | Owners want to see "everything waiting for me" in one inbox, not 6 pages. | New table (new migration; does not touch baseline); `user_process_permissions`; all money routes | M | Medium | P1 |
| X3 | Role and permission review screen | Show for each user: role, process permissions (maker or checker), project access (`user_company_access`), IP restrictions (`user_ip_restrictions`). Flag users who are both maker and checker on the same process. | Segregation of duties is an audit point. | `users.ts`, `roles.ts`, `user_process_permissions` | S | Low | P1 |
| X4 | Maker cannot approve own item | Server rule in every checker route: `maker_id != req.user.id`. To verify whether it exists today in `financial-ops.ts` approve routes. | Basic control. | `financial-ops.ts`, `receipt-process.ts`, `brokers.ts`, `payments.ts` | S | Low | P1 |
| X5 | Global search bar | One box in the top bar: consumer name, mobile, unit number, receipt number, cheque number, application number. Opens the consumer detail. (`search-customer.js` exists with Alt+C; make it reachable everywhere and fuzzy.) | Counter staff answer calls in seconds. | `consumers`, `receipts`, `units`, `booking_records` | S | Low | P2 |
| X6 | Saved views and Export on every list | Per user saved filters; CSV or XLSX export with the same filters. | Weekly MIS without developer help. | all list pages | M | Low | P2 |
| X7 | Print and PDF header and footer from company master | Company name, CIN, GSTIN, RERA number, bank details on every letter. | Compliance on documents. | `companies`, `project_rera_numbers`, `project_gstin`. Reads Set Master data only; needs Set Master session if fields are missing. | S | Low | P1 |
| X8 | Soft delete and restore | No hard `DELETE` on money or customer data (note `DELETE /interest-scheduler` and `DELETE /consumer-interest/:consumerId` at `payments.ts` 4030 and 4269 delete all penal interest rows for a consumer). Use `is_deleted`, `deleted_by`, `deleted_at`, and log it. | Wrongly deleted interest cannot be recovered today. | `penal_interests` and others (new columns) | M | Medium | P1 |
| X9 | Financial year lock | Close a month or FY so receipts, demands and waivers cannot be dated or edited back into it without a checker override. `financial_years` table already exists. | Accounts and GST filing integrity. | `financial_years`; `payments.ts`, `financial-ops.ts` | M | Medium | P1 |

### Module 1 and 2: Set Master, Employees, Security, Roles

Set Master files are off limits right now. Proposals here are for later or for the other session.

| ID | Feature | What it does | Why | Touches | Effort | Risk | Pri |
|---|---|---|---|---|---|---|---|
| M1-1 | Master data change log | Every edit to bank, company, document type, source, etc. goes to the audit trail with before and after. | A wrong bank account on a master silently changes every receipt printout. | `master.ts`, `companies.ts` (needs Set Master session) | S | Low | P1 |
| M1-2 | Document type rules | Per document type: mandatory at stage, validity (months), allowed file types. (`document_types.required_at` text column exists, migration 096.) | Drives the expiry and checklist features below. | `document_types`, `document_checklists` (needs Set Master session) | S | Low | P1 |
| M2-1 | Forgot password and password rules | Self service reset by email OTP or link; minimum length, 90 day expiry optional. (Already DT-039.) | Fewer admin resets. | `users`, `employee-login` page | M | Medium (auth) | P2 |
| M2-2 | Login history and active sessions | Show last logins, IP, device; revoke a session (`users.token_version` exists). | Security review, leaver handling. | `users` | S | Low | P1 |
| M2-3 | Leaver checklist | Deactivate a user, transfer open leads, tasks and approvals to the manager. | Orphaned work when staff leave. | `users`, `tasks`, leads in `consumers` | S | Low | P2 |

### Module 3: Set Projects

| ID | Feature | What it does | Why | Touches | Effort | Risk | Pri |
|---|---|---|---|---|---|---|---|
| M3-1 | RERA registration and validity tracker | Per project and tower: RERA number, registration date, validity end, extension orders, escrow (70 percent account) details. Alert 90, 30, 7 days before expiry. | Selling after expiry is a violation. Table `project_rera_numbers` exists but has only number and tower. | `project_rera_numbers` (add date columns), `projects.ts` | S | Low | P1 |
| M3-2 | Payment plan versioning | A plan used by a booking is frozen; edits create a new version. Show which consumers use which version. | Changing a plan today can silently change old dues. To verify how `payment_plans` edits behave. | `payment_plans`, `plan_schedule_templates`, `projects.ts` | M | Medium | P1 |
| M3-3 | Construction stage linked billing | When a milestone is marked complete (`construction_milestones`, `PATCH /milestones/:id/complete`), propose demands for the linked plan stage, to be approved before sending. | Construction linked plans are standard; manual demand raising is error prone. | `construction_milestones`, `demands`, `milestones.ts`, `payments.ts /demands/generate` | M | Medium | P2 |
| M3-4 | Rate card and price change history | Who changed base rate or charges and when, with effect date. | `units.base_price_inr` is NULL (DT-023); price source is undecided, but history is needed once it is. | `charge_master_config`, `units`, audit | S | Low | P2 |
| M3-5 | Ownership of RERA project data in one page | One screen per project: RERA, GSTIN, interest rate, grace period, bank (escrow, collection, retention), towers, units sold or unsold. | Single source for audits. | `projects`, `project_gstin`, `project_interest_rates`, `company_bank_accounts` | M | Low | P2 |

### Module 4: Broker

| ID | Feature | What it does | Why | Touches | Effort | Risk | Pri |
|---|---|---|---|---|---|---|---|
| M4-1 | Commission rules and slabs per project | Rate by project, by time, by number of sales; auto calculate on booking, accrue on collection milestones (for example 50 percent on 10 percent collected). | Commission disputes are frequent. Currently `broker_commissions` has one amount and a status. | `broker_commissions`, `broker_project_mapping`, `brokers.ts` | M | Medium | P1 |
| M4-2 | Commission statement and TDS | Per broker statement, TDS (section 194H) deduction, Form 16A tracking, GST on commission when the broker is registered. `broker_tax_config` exists. | Compliance and fewer calls. | `broker_tax_config`, `tds_challans`, `outgoing-payments.ts` | M | Medium | P1 |
| M4-3 | Commission clawback on cancellation | If a booking is cancelled, show commission already paid and recover or adjust against the next payout. | Direct money loss otherwise. | `broker_commissions`, `cancellations`, `surrender.ts` | M | Medium | P1 |
| M4-4 | Broker empanelment documents | PAN, RERA agent registration number, agreement, bank proof with expiry and verification. Block payout if missing. | Haryana requires registered agents. | `broker_applications`, documents | S | Low | P1 |
| M4-5 | Broker portal, read only | Separate login (new role, own table of credentials or `users` with a `broker` role): lead registration with duplicate and ownership lock, booking status, commission statement. | Lead ownership fights and status calls. | `brokers`, `consumers`, `broker_commissions`, new role in `roles` | L | Medium | P2 |
| M4-6 | Lead ownership lock | A lead registered by broker A for N days cannot be taken by broker B (match on mobile). | Common source of disputes. | `consumers`, `brokers` | S | Low | P2 |

### Module 5: Inventory

| ID | Feature | What it does | Why | Touches | Effort | Risk | Pri |
|---|---|---|---|---|---|---|---|
| M5-1 | Hold with expiry and auto release | Hold has a validity (for example 48 hours); a daily job releases it and notifies the owner. `unit_holds` and `inventory_hold.ts` exist. | Stale holds block sales. | `unit_holds`, `units` | S | Low | P2 |
| M5-2 | Unit status history view | Visual timeline per unit using `unit_status_history`. | Answers "why is this unit blocked". | `unit_status_history` | S | Low | P2 |
| M5-3 | Inventory board | Tower by floor grid with colour by status, filter by type and price band. | Fast sales conversations, also on a phone. | `units`, `floors`, `towers` | M | Low | P2 |
| M5-4 | Parking allotment rules | One parking slot per unit rule, charge, link to demand. | Disputes at possession. | `parking_slots`, `parking_types`, `parking.ts` | S | Low | P3 |

### Module 6: Booking

| ID | Feature | What it does | Why | Touches | Effort | Risk | Pri |
|---|---|---|---|---|---|---|---|
| M6-1 | KYC completeness gate | A booking cannot move to allotment until mandatory documents are present and verified (PAN, Aadhaar, photo, income proof for PMAY or affordable category). | Compliance and fewer rework calls. | `kyc_documents`, `document_checklists`, `booking_documents`, `booking.ts` | M | Medium | P1 |
| M6-2 | Category eligibility check | For affordable housing: income ceiling, category (general, SC, ex-serviceman, etc.), one allotment per family, with a declaration stored. Rules per project, to be confirmed with the client. | Scheme compliance. | `consumers`, `co_applicants`, `applicant_details`, project settings | M | Medium (rules vary) | P1 |
| M6-3 | Duplicate detection | On PAN, Aadhaar last four, mobile and name plus date of birth, show matches before saving. | Duplicate customers corrupt dues and reports. | `consumers`, `booking.ts` | S | Low | P1 |
| M6-4 | Booking form draft and resume | Save partial entry, resume later. | `booking.js` is the largest form. | `booking_forms` | S | Low | P2 |
| M6-5 | Booking amount and receipt in one step | Capture token or booking amount and issue the receipt in the same flow with one print. | Counter speed. | `booking.ts`, `payments.ts` | M | Medium (money) | P2 |
| M6-6 | Co-applicant and nominee proofs | Capture nominee and relation, required by many banks. | Loan and transfer later. | `co_applicants` | S | Low | P3 |

### Module 7: Allotment and e-draw

| ID | Feature | What it does | Why | Touches | Effort | Risk | Pri |
|---|---|---|---|---|---|---|---|
| M7-1 | E-draw import audit | Keep the imported file, who imported it, row counts, rejected rows with reason. (`POST /allocations/import-edraw` exists, `import_history` table exists.) | A draw is a public record; the developer must prove what was loaded. | `allocations.ts`, `import_history`, `waitlists` | S | Low | P1 |
| M7-2 | Waitlist promotion | When an allotment lapses or cancels, offer the unit to the next waitlisted applicant with a deadline and a message template. | Unit goes back to stock fast and fairly. | `waitlists`, `allocations`, `communications` | M | Medium | P2 |
| M7-3 | Allotment lapse rule | If first instalment is not paid by the date in the allotment letter, mark as "at risk", then cancel through approval (see X2). | Affordable schemes have fixed payment deadlines. | `allotment_letters`, `allocations`, `demands` | M | Medium | P1 |
| M7-4 | Allotment letter template with merge fields and versions | Version the letter, keep the PDF that was sent and the dispatch proof. | Proof of dispatch in disputes. | `allotment_letters`, `document_dispatch`, `custom-letters` | M | Low | P1 |
| M7-5 | Maker-checker for allotment cancel and shifting | `POST /allocations/:id/cancel` and `/shift` have no `requireProcess`. | Unit swaps are a classic fraud point. | `allocations.ts`, `unit_shifts` | S | Medium | P1 |

### Module 8: Transactions and Receipts

| ID | Feature | What it does | Why | Touches | Effort | Risk | Pri |
|---|---|---|---|---|---|---|---|
| M8-1 | Receipt edit and cancel through approval | `PATCH /receipts/:id` and `POST /receipts/:id/cancel` should create an approval request with a mandatory reason, keep the old values, and block edits to amount and date after bank clearing. Cancelled receipt numbers are never reused. | The most sensitive change in the system. Today only approve is a checker action (`receipt` process). | `receipts`, `payments.ts`, X1, X2 | M | Medium | P1 |
| M8-2 | Cheque lifecycle board | Kanban or list by status (received, deposited, cleared, bounced, on hold), with age and bank. Bulk deposit slip print. | Daily work of the accounts team. | `receipts`, `bank_transactions`, `pending-cheques.html` (fold into the main app) | M | Medium | P1 |
| M8-3 | Cheque bounce handling | Bounce charge by bank or project, penal interest restart, notice template (Section 138 NI Act notice within 30 days of return memo, legal review needed), auto task for the collection team. `cheque_bounce_logs` exists and `PATCH /receipts/:id/bounce` exists. | Legal time limits are strict. | `cheque_bounce_logs`, `receipts`, `penal_interests`, `tasks` | M | Medium | P1 |
| M8-4 | Post dated cheque register | Store a set of PDCs per consumer with dates; reminder before each deposit date; mark missing ones. | Common payment style for instalments. | `receipts` (status, cheque_date), new view | M | Low | P2 |
| M8-5 | Bank statement reconciliation | Upload statement (`bank_statement_imports`, `bank_transactions`, `reconciliation.ts` exist), auto match by reference and amount, list unmatched on both sides. | Daily cash proof and fewer disputes on "I paid". | `reconciliation.ts`, `bank_transactions` | M | Medium | P1 |
| M8-6 | Unidentified deposits | Park money received without a clear customer, assign later with approval. | Online transfers often arrive with no reference. | `bank_transactions`, `receipts` | M | Medium | P2 |
| M8-7 | TDS 194-IA tracking | Buyer TDS (1 percent on property value above the limit): challan, Form 16B status per consumer, reminders. (`tds_challans`, `tds_assignments` exist.) | Registry is often blocked by missing 16B. | `tds_challans`, `tds_assignments`, `receipt-process.ts` | M | Medium | P1 |
| M8-8 | Receipt print log | Count prints and reprints with user and time ("duplicate copy"). `print_status` and `mark-printed` exist. | Control over duplicate receipts. | `receipts` | S | Low | P2 |
| M8-9 | Payment link and UPI QR | Show a dynamic QR or payment link on the demand letter and in the WhatsApp reminder with the consumer reference; auto capture via gateway webhook. | Faster collection. Needs a payment gateway choice. | new integration, `receipts` | L | High (external) | P3 |

### Module 9: Demand

| ID | Feature | What it does | Why | Touches | Effort | Risk | Pri |
|---|---|---|---|---|---|---|---|
| M9-1 | Demand approval before bulk send | `POST /demands/bulk` and `/demands/generate` produce a draft batch; checker reviews the count and total, then sends. | A wrong stage amount on 200 customers is expensive to recall. | `demands`, `payments.ts` | M | Medium | P1 |
| M9-2 | Demand batch history | Each run is a batch with who, when, filters, counts, total, and a way to cancel the whole batch. | Traceability. | `demands`, new `demand_batches` | M | Medium | P1 |
| M9-3 | Demand letter delivery tracking | Dispatch mode, tracking number, delivery proof, WhatsApp or email delivered status. `document_dispatch` exists. | Proof for interest and cancellation notices. | `document_dispatch`, `communications` | M | Low | P1 |
| M9-4 | Reminder ladder | Use `reminder_master` (name, days, rank): friendly reminder, first, second, final notice, auto create task and send message on schedule. | Consistent follow up. | `reminder_master`, `tasks`, `communications` | M | Medium | P2 |
| M9-5 | GST on demand shown clearly | CGST and SGST split per demand line, and for affordable housing the 1 percent rate, shown on the letter and in the export. (Columns exist from migration 028 and 081.) | Customers question GST. | `demands`, `gst_*` | S | Low | P1 |

### Module 10: Interest

| ID | Feature | What it does | Why | Touches | Effort | Risk | Pri |
|---|---|---|---|---|---|---|---|
| M10-1 | Direct waiver through approval | Route `POST /interest-waivers/direct` ("No separate checker approval step needed") should require a checker above a limit set per role (for example more than 5,000 INR). Reason mandatory, authorised by name and document kept. | Largest leak risk in the module. | `financial-ops.ts`, `interest_waivers` | S | Medium | P1 |
| M10-2 | Waiver limits and monthly report | Per user and per project cap, monthly waiver total report. | Management control. | `interest_waivers` | S | Low | P1 |
| M10-3 | Interest calculation explainer | For a consumer, show line by line: instalment, due date, grace days, rate, days late, interest, waiver. Same figure on screen, letter and report (matches the cross module check in the plan). | Customers dispute interest; staff need to explain it fast. | `penal_interests`, `project_interest_rates`, `payments.ts /calculate-interest` | M | Low | P1 |
| M10-4 | Recalculation preview | Before changing rate, grace or date (`PATCH /consumer-interest-date`, `/consumer-grace-period`), show the before and after total and require a reason. | Prevents silent changes. | `payments.ts`, audit | S | Low | P1 |
| M10-5 | Interest scheduler run log | Every scheduled run keeps rows changed and totals; a dry run option. | The scheduler is destructive on delete (see X8). | `penal_interests`, `interest_scheduler` | S | Low | P1 |

### Module 11: Collection

| ID | Feature | What it does | Why | Touches | Effort | Risk | Pri |
|---|---|---|---|---|---|---|---|
| M11-1 | Overdue dashboard | Buckets (0 to 30, 31 to 60, 61 to 90, 90 plus), by project, tower, collector, with total and count, drill into the list. Promise to pay date and amount. | The key collection view. | `demands`, `penal_interests`, `receipts`, `dashboard.ts`, `payments.ts /overdue` | M | Low | P1 |
| M11-2 | Promise to pay and follow up | Each call logs outcome, next date, promised amount; broken promises flag red. (`call_logs`, `remarks`, `calling.js` exist.) | Measures collector effectiveness. | `call_logs`, `tasks`, `remarks` | M | Low | P2 |
| M11-3 | Auto assignment | Allocate overdue accounts to collectors by project or ageing; reassign on leave. | Nobody owns an overdue account today (to verify). | `tasks`, `users` | S | Low | P2 |
| M11-4 | Collection target vs actual | Monthly target per project and per collector. | Management. | new `collection_targets` | S | Low | P3 |
| M11-5 | Legal notice pipeline | Stages: reminder, notice, final notice, cancellation proposal; each with a template and a dispatch proof. | Needed before cancelling for default. | `document_dispatch`, `custom-letters` | M | Medium | P1 |

### Module 12: Transfer

| ID | Feature | What it does | Why | Touches | Effort | Risk | Pri |
|---|---|---|---|---|---|---|---|
| M12-1 | Transfer approval workflow | Application, document check (NOC, transferor and transferee KYC, stamp or affidavit), fee (`transfer_fee_master`), checker approval, then ownership change. `transfers.ts` has no `requireProcess`. | Ownership change is high value. | `ownership_transfers`, `transfer_fee_master`, `transfers.ts` | M | Medium | P1 |
| M12-2 | Transfer fee and dues clearance check | Block transfer unless dues, interest and fee are cleared or a checker overrides with a reason. | Avoids losing dues when the owner changes. | `ownership_transfers`, `demands`, `penal_interests` | S | Low | P1 |
| M12-3 | Ownership history | Show a chain of owners per unit with dates and the money each paid. | Registry and disputes. | `ownership_transfers`, `receipts` | S | Low | P2 |
| M12-4 | Transfer date edit approval | `transfer-date-edit` changes dates that drive interest; require a reason and a checker. | A date change shifts interest. | `ownership_transfers`, audit | S | Medium | P1 |

### Module 13: GST Invoicing

| ID | Feature | What it does | Why | Touches | Effort | Risk | Pri |
|---|---|---|---|---|---|---|---|
| M13-1 | Invoice numbering control | Series per GSTIN and FY, no gaps, no edits after issue, cancel through credit note only. `POST /gst-invoices/cancel` exists. | GST rule. | `gst_invoices`, `credit_debit_notes`, `payments.ts` | M | Medium | P1 |
| M13-2 | GSTR-1 and GSTR-3B working sheets | Export invoices, credit notes and rate wise totals in the format accounts uploads. Do not file from the CRM. | Month end work. | `gst_invoices`, `gst_slabs`, `hsn_sac_codes`, `reports.ts` | M | Low | P1 |
| M13-3 | E-invoice (IRN) readiness check | Flag customers and invoices that would need IRN as turnover crosses the limit; later integrate with the portal. | Future compliance. | `gst_invoices`, `project_gstin` | L | High (external) | P3 |
| M13-4 | Advance receipt vs invoice reconciliation | For under construction units, GST is on receipt of advance; show receipts without a matching invoice. | Common GST gap. | `receipts`, `gst_invoices` | M | Medium | P1 |

### Module 14: Surrender, Cancellation, Refund

| ID | Feature | What it does | Why | Touches | Effort | Risk | Pri |
|---|---|---|---|---|---|---|---|
| M14-1 | Cancellation through approval | `POST /surrender` has no process gate and no audit row. Make it a request with reason, forfeiture and refund calculation, then checker approval, then execution. Keep the `*_snapshot` columns (migrations 085 to 087) for restore. | A cancellation returns a unit to stock and moves money. | `surrender_applications`, `cancellations`, `surrender.ts`, X1, X2 | M | Medium | P1 |
| M14-2 | Forfeiture policy per project | Forfeiture default is hard coded 29,500 in the schema defaults of `cancellations` and `surrender_applications`; move it to a per project rule (percent or fixed, with a cap as per project terms and RERA model agreement). To verify actual rules with the client. | Wrong forfeiture is a legal risk. | `cancellations`, `surrender_applications`, project settings | M | Medium | P1 |
| M14-3 | Refund tracker | Status steps (approved, cheque or NEFT prepared, paid, UTR captured), ageing of pending refunds, alert after N days. `draw_refunds`, `payment_refunds`, `outgoing_payments` exist. | RERA expects timely refund; delays attract interest. | `draw_refunds`, `payment_refunds`, `outgoing_payments`, `financial-ops.ts` | M | Medium | P1 |
| M14-4 | Cancellation reasons report | Counts by reason, project, ageing at cancellation. | Management insight and RERA data. | `cancellations`, `reports.ts` | S | Low | P2 |
| M14-5 | Restore with approval | `POST /surrender/restore` must also be maker and checker. | Reversal is as sensitive as the cancellation. | `surrender.ts` | S | Medium | P1 |

### Module 15: CRM (leads, tasks, campaigns, communications)

| ID | Feature | What it does | Why | Touches | Effort | Risk | Pri |
|---|---|---|---|---|---|---|---|
| M15-1 | Lead pipeline board | Stages (new, contacted, site visit, negotiation, booked, lost) as a drag and drop board, with lost reason, source (`sources_of_enquiry`) and owner. The `lead_stage` enum exists. | Sales team's daily view. | `consumers` (leads), `leads.js`, `tasks` | M | Low | P2 |
| M15-2 | Message templates (WhatsApp, SMS, email) | One library with merge fields (name, unit, amount due, due date, project), approval status for WhatsApp templates, language (English, Hindi), and DLT template id for SMS (required in India). | Consistent, compliant messaging. | `communications.ts`, `email_templates`, `whatsapps`, `communication_status_codes` | M | Medium (provider rules) | P2 |
| M15-3 | Message send log and opt out | Who sent what to whom, status (sent, delivered, failed), opt out flag honoured by bulk sends. `broadcast_campaigns` and `campaign_metrics` exist. | Spam rules (TRAI), proof of notice. | `communications`, `emails`, `whatsapps`, `broadcast_campaigns` | M | Medium | P1 |
| M15-4 | Follow up reminders | Task with date and time, snooze, "due today" count in the top bar, daily digest message to the owner. | Leads lost to forgetting. | `tasks`, `reminder_master` | S | Low | P2 |
| M15-5 | Site visit and walk in register | Capture visit date, interested unit, test drive of sample flat, source, with QR for walk in. | Marketing ROI. | `consumers`, `sources_of_enquiry` | M | Low | P3 |
| M15-6 | Bulk actions on leads | Select rows to assign, change stage, send a template, export. | Productivity. | `leads.js`, `consumers.ts` | S | Low | P2 |
| M15-7 | Birthday, anniversary, possession greetings | Scheduled messages using templates. | Customer relationship, referrals. | `automation_rules`, `communications` | S | Low | P3 |
| M15-8 | Grievance and ticket SLA | Ticket category, due time, escalation, closing remark. `support_tickets` exists. | RERA complaints start as unanswered tickets. | `support_tickets`, `communications.ts` | M | Low | P2 |

### Module 16: Reports

| ID | Feature | What it does | Why | Touches | Effort | Risk | Pri |
|---|---|---|---|---|---|---|---|
| M16-1 | RERA quarterly progress export | Per project and tower: units total, booked, sold, cancelled, amount collected, amount demanded, construction stage percentage, in a layout that matches what HRERA asks. Layout to be confirmed from the current portal format. | Quarterly compliance. | `projects`, `units`, `allocations`, `cancellations`, `receipts`, `construction_milestones`, `project_rera_numbers`, `reports.ts` | M | Low | P1 |
| M16-2 | Escrow (70 percent) account view | Collections deposited to the project account vs withdrawals, so management can see the 70 percent rule status. Needs the bank account kinds in `company_bank_accounts` (DT-022 holds placeholder data). | RERA Section 4(2)(l)(D). | `company_bank_accounts`, `receipts`, `outgoing_payments` | M | Medium (data quality) | P1 |
| M16-3 | Reconciliation report | Receipts vs bank vs demands vs GST per period (plan journey J9). | Month end close. | `reports.ts` | M | Low | P1 |
| M16-4 | Report catalogue | The 35 reports in `reports.js` (5,970 lines) need search, favourites, and a common filter bar. | Finding the right report. | `reports.js` | M | Low | P2 |
| M16-5 | Scheduled email of key reports | Daily collection and overdue to management at a set time. | No login needed to read. | `automation_rules`, `emails` | M | Medium | P2 |
| M16-6 | Fix known report bug first | `GET /api/reports/inventory-details` without parameters returns 500 (DT-030). | Prerequisite. | `reports.ts` | S | Low | P1 |

### Module 17: Dashboard, Folders, Unit Documents, Help

| ID | Feature | What it does | Why | Touches | Effort | Risk | Pri |
|---|---|---|---|---|---|---|---|
| M17-1 | Document expiry and KYC queue | List of documents expiring in 30, 60, 90 days or missing, per consumer and per project (RERA certificate, insurance, NOC, KYC). Daily alert to the owner. `kyc_documents.expiry_date`, `verified` and `document_vault` exist. | Expired or missing papers block registry and loans. | `kyc_documents`, `document_vault`, `document_checklists`, `documents.ts` | S | Low | P1 |
| M17-2 | Role based dashboard | Sales sees leads and visits; accounts sees cheques, approvals, overdue; management sees collection vs target and cancellations. | The current dashboard is the same for all. To verify per role widgets in `dashboard.js`. | `dashboard.ts` | M | Low | P2 |
| M17-3 | Approvals inbox | One tile and one page for everything waiting on me (X2). | Speeds up checkers. | X2 | S after X2 | Low | P1 |
| M17-4 | Document vault hygiene | Virus scan, size and type limits, file hash, versioning (`document_versions` exists); protect `/uploads` (DT-007) and persist uploads (DT-033). | Security and not losing documents. | `documents.ts`, `booking_documents.ts` | M | Medium | P1 |
| M17-5 | Possession and handover tracker | Stages after registry: dues cleared, NOC, possession letter, key handover, snag list, conveyance deed (`conveyance_deeds`, `registry_details` exist). | The end of the booking to possession lifecycle is not visible in the menu. | `registry_details`, `conveyance_deeds`, `units` | L | Medium | P2 |

---

## 4. Suggested phasing

| Phase | Content | Why this order |
|---|---|---|
| 1. Safety base | X1 audit helper, X4, X8 soft delete, X9 FY lock (design), U4 confirm dialog with reason | Every later control needs these. |
| 2. Approvals | X2 approval requests, then M14-1 cancellation, M8-1 receipt edit and cancel, M10-1 direct waiver, M7-5, M12-1, M14-5 | Closes the largest gaps. Uses the existing `requireProcess` pattern. |
| 3. Compliance reporting | M16-1 RERA export, M3-1 RERA validity, M17-1 document expiry, M13-2 GST sheets, M8-7 TDS tracking | Mostly read only, low risk. |
| 4. Collection engine | M11-1 overdue dashboard, M9-1 and M9-2 demand batches, M8-2 and M8-3 cheque board and bounce, M10-3 interest explainer, M15-3 send log | Cash flow. |
| 5. Productivity | M15-1 pipeline, M15-2 templates, M15-4 reminders, X5 global search, X6 export, U6 mobile | Needs templates and tasks from phase 4. |
| 6. Partners | M4-5 broker portal, M4-1 to M4-3 commission rules, M17-5 possession tracker | Largest, needs design with the client. |

The UI foundation (section 2.2, step 1) can run in parallel with phase 1 because it does not change any behaviour.

---

## 5. Risks and dependencies

- The baseline schema is a reconstruction (DT-029). Any proposal that adds a table or column needs a real migration and a check against production before it ships.
- Write paths are not verified yet (DT-032). Money features should wait for the Booking and Receipts module checks (plan modules 6 and 8) so new controls are not built on unverified flows.
- Serverless hosting (DT-041, DT-047): scheduled jobs (hold release, reminder ladder, report emails) need a scheduler. Vercel Cron or an external cron is needed; `src/queues/*` is dead code (DT-016) and should not be revived without a decision.
- Uploads do not persist on Vercel (DT-033), so any document feature depends on that being solved.
- WhatsApp, SMS (DLT) and payment gateway features depend on provider accounts that the client must supply.
- Legal and rule inputs (forfeiture, Section 138 notice timing, escrow rules, affordable housing eligibility, HRERA report format) must be confirmed by the client and counsel. Items marked "to verify" were not checked against code or rule books.

## 6. Open questions for the owner

1. Should every cancellation, receipt edit and direct waiver always need a second person, or only above a threshold? If a threshold, per role or per project?
2. Which HRERA report formats are used today (Excel from the portal, or manual)? A sample file would remove guessing.
3. Is the broker portal wanted soon, or is a monthly commission statement enough for now?
4. Which messaging providers are available (WhatsApp Business API, SMS gateway with DLT, email)?
5. Is a payment gateway or UPI collection wanted, or only cheque and bank transfer?
6. Mobile use: which roles need the phone (sales, site, collection)? This decides the order of the mobile pass.
