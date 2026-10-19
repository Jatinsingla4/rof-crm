# ROF CRM: Deferred Tasks (parallel backlog)

Everything found but not done in the moment goes here, so it can be worked on in parallel without blocking the module by module verification (`MODULE_VERIFICATION_PLAN.md`).

Rules:
- Every item has an ID (`DT-nnn`), a source, and a reason it was deferred.
- Nothing is fixed silently. Items are moved to Done only with a commit reference.
- Items that touch live data or production need an explicit approval before starting.
- Module breakages that are deferred are added here with a link to the module document (`Mnn-Bnnn`).

Last updated: 2026-10-16. Completed work is in `COMPLETED_TASKS.md`.

---

## 1. How to read an item

| Field | Meaning |
|---|---|
| Blocks | Whether it stops the module by module work (Yes or No) |
| Parallel | Whether someone can work on it now without touching the module being verified |
| Needs | A decision, access, or approval required before work can start |
| Risk | What can go wrong if it is done badly |

---

## 2. Open items

### 2.1 Blockers for the verification work

| ID | Title | Blocks | Parallel | Needs | Source |
|---|---|---|---|---|---|
| DT-001 | Database that matches the code (local or Neon branch) | Yes, all modules | Yes | Decision between the options in the plan, section 2, and Neon access for option A or B | Login audit, `LOGIN_SYSTEM.md` section 6 |

**DT-001 status (2026-10-15): partly resolved.** The original database was not available, so a baseline was reconstructed in `packages/api/src/db/baseline/` (see its README). It restores into an empty database (123 tables) and 176 of 178 parameterless GET endpoints return no 5xx against it. It is not proven equal to production: see DT-029 and DT-030.

**DT-001 original detail.** The migration files cannot rebuild the database. Tables `companies`, `company_bank_accounts`, `document_field_overrides`, `nav_pages` and the column `consumers.main_broker_id` are used by the code but created by no migration in the repository. Migrations 052, 061 to 065, 078, 091, 093 and 094 fail on a clean database. `CLAUDE.md` records the same family of problems for `units` area columns, `booking_records.registration_no`, `booking_records.form_no` and `booking_counters`.
Risk: building the schema from guesses gives results that do not match production.

### 2.2 Security and session

| ID | Title | Blocks | Parallel | Needs | Risk |
|---|---|---|---|---|---|
| DT-002 | Move the session token from `localStorage` to an httpOnly cookie (finding F6) | No | Yes, but only after phase 0 of its plan | Approval of the cookie design, a person to test each phase | Touches 46 frontend files; a missed site silently breaks a page. Plan: `PLAN_F6_COOKIE_SESSION.md` |
| DT-003 | Confirm `JWT_SECRET` is set on Render before the next deploy | No | Yes | Render dashboard access | The service no longer starts without it |
| DT-004 | Confirm the proxy hop count (`trust proxy` is set to 1) and the rate limit behaviour on Render | No | Yes | Render logs | Wrong hop count means all users share one limit, or the limit is bypassed |
| DT-005 | Share login lockout and the auth cache across API instances | No | Yes | Only needed if more than one instance runs | State is in memory today and resets on restart |
| DT-006 | Remove fallback keys `ENCRYPTION_KEY` (`routes/documents.ts`) and `SMTP_SECRET` (`routes/smtp_config.ts`) | No | Yes | Confirm the real values exist on Render. Changing a key makes existing encrypted rows unreadable | Data loss for `document_vault.file_url` and `project_smtp_configs.password_encrypted` |
| DT-007 | Protect `/uploads/*` (served with no login) | No | Yes | Decide how print and image links authenticate (depends on DT-002) | Booking documents and photos are readable by anyone with the URL |
| DT-008 | Restrict `/api/health/debug` and `/api/health/templates` (public, `templates` returns template HTML and raw errors) | No | Yes | Confirm no monitor depends on them | Information exposure |
| DT-009 | Rotate the live super_admin password | No | No | First remove the migrate-time re-seed (DT-010). Needs the owner | The password is overwritten at every deploy until DT-010 is done |
| DT-010 | Migration `059_seed_testuser` re-seeds the super_admin on every `db:migrate` with no environment guard | No | Yes | Decision on the production behaviour | Blocks DT-009 |
| DT-011 | Add a Content Security Policy (currently disabled in helmet) | No | Yes | Review of inline scripts; do after DT-002 | Breaking inline scripts |

### 2.3 Platform and delivery

| ID | Title | Blocks | Parallel | Needs | Risk |
|---|---|---|---|---|---|
| DT-012 | Migration tracking table (all migrations replay on every deploy and rely on idempotency; "already exists" errors are swallowed) | No | Yes | Design review | Hidden failures; changing the runner affects deploys |
| DT-013 | Reconcile the stray folder `packages/api/migrations/` (files 043 and 045) with `src/db/migrations` | No | Yes | Decision on where they belong | A new database lacks those changes |
| DT-014 | `docker-compose.yml` builds the API from `packages/api/Dockerfile`, which does not exist | No | Yes | Decide whether Docker is a supported path | The compose api service cannot build |
| DT-015 | `.env.example` is out of step with the code (lists variables never read, omits `DATABASE_URL`, `ENCRYPTION_KEY`, `SMTP_SECRET`) | No | Yes | None | Misconfigured environments |
| DT-016 | Dead code: `src/queues/*` (Bull queue, scheduler, workers) is not imported anywhere | No | Yes | Confirm nobody plans to use it | None if removed carefully |
| DT-017 | Render build resolves `tsc` with `NODE_ENV=production` while `typescript` is a devDependency | No | Yes | A Render build log | Failed deploys |
| DT-018 | Uploads may not survive a deploy (no persistent disk in `render.yaml`) | No | Yes | Check the Render dashboard | Lost documents and photos |
| DT-019 | Dependencies are unpinned; `pnpm-lock.yaml` and `packages/api/package-lock.json` are gitignored and invalid | No | Yes | Decision on the package manager | Installs are not reproducible |
| DT-020 | `README.md` is partly stale (port, page count, "Default Login" describes mock auth) | No | Yes | None | Wrong onboarding |
| DT-021 | `npm` is broken under Node 20.13.1 and Node 22.22.3 (empty `lib/cli.js`; fixed only for 20.20.2) | No | Yes | None | Developer machines only |

### 2.4 Data and business decisions (from `CLAUDE.md`, "deliberate gaps")

| ID | Title | Blocks | Parallel | Needs |
|---|---|---|---|---|
| DT-022 | `company_bank_accounts` holds only a placeholder account | Maybe (receipts, demand letters) | Yes | Real bank account data from the client |
| DT-023 | `units.base_price_inr` and `total_price_inr` are NULL everywhere; Unsold Stock Value unavailable | Maybe (reports) | Yes | Client decision on pricing source |
| DT-024 | Current O/S is deliberately identical to Balance Recoverable | No | Yes | Client confirmation |
| DT-025 | Transfer module items waiting on the client: Setup Tax Master, Transfer After Registry, Transfer After Registry Payment | No | Yes | Client clarification |
| DT-026 | `receipts.status` has no CHECK or enum (values in use: pending, authorized, deposited, cleared, on_hold, bounced, cancelled) | No | Yes | Decide on a constraint; verify every writer first |

### 2.4b From building the baseline schema

| ID | Title | Blocks | Parallel | Needs |
|---|---|---|---|---|
| DT-029 | Compare `baseline/001_reconstructed_missing_columns.sql` with the real production schema. Its 167 column types are guesses from column names, and constraints, indexes and triggers that exist only in production are unknown | No | Yes | Access to a schema dump of the original database |
| DT-030 | `GET /api/reports/inventory-details` without parameters returns 500 (`bind message supplies 2 parameters, but prepared statement requires 1`). Looks like a code bug | No | Yes | Reports module (16) |
| DT-031 | No seed data for `nav_pages`, so the role page access screens are empty (super_admin is not affected) | No | Yes | List of pages, taken from the navigation menu |
| DT-032 | Write paths (POST, PUT, PATCH, DELETE) and GET endpoints that need parameters were not exercised against the baseline. Missing columns may remain | Yes, per module | No | Found during each module verification |
| DT-033 | Uploads (`/uploads/*`) do not persist on Vercel (no writable disk). Needs object storage for booking documents, consumer photos and company logos | Yes, for any upload feature on Vercel | Yes | Choice of storage (Vercel Blob, S3, Neon object storage) |
| DT-034 | Vercel is the new host. `render.yaml` was deleted from the repository on 2026-10-19; still to do: delete the Render service in the Render dashboard | No | Yes | Render dashboard access |

### 2.5 Local environment only

| ID | Title | Blocks | Parallel | Needs |
|---|---|---|---|---|
| DT-027 | Local database has partial schema from the manual migration run (migrations 053 to 094 applied file by file; some failed). Replace it with the result of DT-001 | Yes, until DT-001 | No | DT-001 |
| DT-028 | The local database has 46 consumers of unknown origin. Confirm they are demo data before any module test changes them | Yes, before Module 6 | No | Owner confirmation |

---

### 2.6 Closing the login and hosting work (added 2026-10-16)

| ID | Title | Blocks | Parallel | Needs |
|---|---|---|---|---|
| DT-035 | ~~Commit the local changes and redeploy to Vercel~~ **Done 2026-10-16**: commit `8a71cdc` pushed, Vercel redeployed and checked (see `COMPLETED_TASKS.md`) | No | No | none |
| DT-036 | Log in on the live site with the real admin password, open the dashboard, log out | No | Yes | The owner (the password is not known here) |
| DT-037 | Browser pass on the redesigned login page: phone width, dark mode, keyboard (Enter submits), password manager autofill, Show and Hide | No | Yes | A person with a browser and a phone |
| DT-038 | Test login and permissions for the 4 roles not yet exercised: `accounts_finance`, `project_manager`, `support_agent`, `read_only_viewer` (only `super_admin` and `sales_executive` were) | No | Yes | None |
| DT-039 | Decide on a forgot password flow. None exists; passwords are reset in the database | No | Yes | Product decision |
| DT-040 | Rotate every credential that appeared in chat: both Neon passwords (`neondb_owner` on the old and the new project) and the Vercel secrets set from them | No | Yes | Neon and Vercel dashboards |
| DT-041 | Return to a pooled Neon connection before real traffic (serverless opens many connections) and make the app independent of a polluted `search_path` | No | Yes | Decision on pool settings |
| DT-042 | There is no automated test suite. Add the login and password checks that were run by hand (`/tmp/e2e.py` style) as a repeatable script in the repository | No | Yes | None |
| DT-043 | Delete the old Neon project and the Render service after the new setup is confirmed. The old project holds the schema nobody can read now, so keep it until DT-029 is done | No | Yes | Neon and Render dashboards |
| DT-044 | `copy-files.js` copies `src/db/baseline/*.sql` (7000 lines) into `dist/`. Decide whether to exclude it | No | Yes | None |
| DT-045 | Find how the malicious code reached `1db61f2` (author `avig14`): audit that GitHub account, its machine, and the GitHub audit log. Check whether the Render service deployed the infected commit before it moved to Vercel | No | Yes | The owner and the collaborator |
| DT-046 | Confirm the Vercel team (`threezinc`) is the intended owner of the project | No | Yes | The owner |
| DT-047 | Load testing or a limit review for serverless: login lockout and the auth cache are per instance on Vercel (see DT-005, now more relevant) | No | Yes | None |
| DT-048 | `POST /api/users` with a password under 8 characters creates a user without a password. Reject it instead | No | Yes | Confirmation that no screen relies on it |
| DT-049 | Set Master (M01): `document_types.name` is unique across all projects, so the same document (for example Aadhaar) cannot be defined for two projects. Decide if it should be unique per project, then change the constraint | No | Yes | Business decision |
| DT-050 | Set Master (M01): write access to the master lists is new (`master_data`: super_admin full, project_manager create and edit, others read only). Confirm the matrix, for example whether accounts_finance may add banks | No | Yes | The owner |
| DT-051 | ~~Set Master (M01): run migration `096_document_types_required_at_text.sql` on the new Neon database~~ **Done 2026-10-16**, the owner ran it (output `DO`). The column type was not re-read afterwards | No | No | Closed |
| DT-052 | ~~Set Master (M01): company logo upload~~ **Done 2026-10-16** (local, not committed): role and id checked before upload, extension from mime type. Still open: logos do not persist on Vercel (see DT-033) | No | No | Closed except DT-033 |
| DT-053 | Set Master (M01): company bank account `PATCH` cannot clear a field (blank keeps the old value), `accountType` is not validated, and company `code` is not unique. (Atomic primary handling and the primary account rules are done) | No | No | Small fix |
| DT-054 | Set Master (M01) found in shared code: reminder master, unit types, floors and tax slabs sit in the same router and have no role check on writes. Handle them in Module 3 (Set Projects) | No | Yes | Module 3 |
| DT-055 | Set Master (M01) UI still open: inline styles in Document Type, Dispatch and Company Master (SM-U1), company form grouping (SM-U10), accessibility (SM-U9), shared confirm dialog (SM-U4), row counts on Document Type and Dispatch. Done: edit on all simple lists, labelled Delete, no emoji, no em dash, masked account numbers | No | No | UI pass |
| DT-056 | Set Master (M01): delete is now blocked while a salutation, profession, nationality or source is in use, and a source cannot be renamed while in use. Open: a rename that updates the text on consumers, or a deactivate option (SM-F3, SM-F4), needs a decision because it touches Booking and Consumers | No | Yes | Business decision |
| DT-057 | Set Master (M01): duplicate name check uses SQL `lower()`, so accents (Éa and éa) and zero width spaces pass. Normalise names (trim inner spaces, `unaccent`) if it matters for the lists | No | No | Low |
| DT-058 | Set Master (M01): after migration 096 older `document_types.required_at` values may not be one of the six stage names, so the edit screen shows a blank stage until it is picked again. Check the real values once production data is readable | No | Yes | After DT-029 |
| DT-059 | Set Master (M01) flow review: the booking screen uses a fixed list of document codes and never reads `document_types`, so `required_at`, mandatory and project scope are not enforced anywhere. Decide in Module 6 whether booking reads the master. Until then do not rely on Document Type for compliance | No | Yes | Module 6 |
| DT-060 | Set Master (M01) flow review, HIGH: nationality text drives GST (receipts, demands and letters zero CGST and SGST for `nri`, `oci`, `pio`; `payments.ts` 487, 2134, 2593, 3323, `booking.ts` 338, 820, 989). Renaming or deleting that item changes tax. Set Master now blocks it while in use, but the real fix is a GST-exempt flag on the nationality row. Also the booking form has a fixed `resident/pio/nri/oci` toggle next to the list | Yes | Yes | Accounts and the owner |
| DT-061 | Set Master (M01) flow review, HIGH: receipts read one global copy of the company (`global_settings`), not the project's company (`payments.ts` 2107, `booking.ts` 3162). With two companies a receipt prints whichever was set active last, or a stale copy if the company was only edited. Resolve through `projects.company_id` | Yes | Yes | Module 8 (Receipts) |
| DT-062 | Set Master (M01) flow review: demand and allotment letters can pick the wrong company (`documents.ts` 747 to 761, 1469 to 1481, join on consumer only, `LIMIT 1` without `ORDER BY`), and a company field cleared in Set Master falls back to the old global value on letters (`documents.ts` 1438 to 1453, 1957 to 1966). Also letters print `companies.bank_*` while the bank accounts screen edits another table, so changing the primary account changes nothing printed. Pick one source | No | Yes | Module 9 (Demand and documents) |
| DT-063 | Set Master (M01) flow review: Booking, Brokers and Edit Booking put bank, salutation, profession, nationality and source names into `<option>` HTML without escaping (`booking.js` 23, 1465, 1471, `brokers.js` 236, `edit-booking.js` 237). Set Master now rejects `<` and `>`, but old rows may contain them. Escape with `Utils.esc` in those pages | No | No | Modules 4 and 6 |
| DT-064 | Set Master (M01) flow review: companies cannot be deleted or deactivated by the API (`is_active` is never set false). A manual SQL delete would null `projects.company_id`, cascade the bank accounts and null `receipts.company_bank_account_id`. Add a deactivate action with a usage check | No | No | Small |
| DT-065 | Set Master (M01) verifier: uploading a logo for any company overwrites `global_settings.company_logo_url`, so a logo for a non active company changes every document. Update it only when that company is the active one. Also old logo files are never deleted, and a missing file under `/uploads/` answers 200 (page fallback) | No | Yes | Product decision |
| DT-066 | Set Master (M01) verifier: duplicate names are checked then inserted, so 20 simultaneous inserts with different letter case can create 2 rows; `lower()` is ASCII only on a `C` collation database. Add unique indexes on `lower(name)` (per parent for states and cities) in a migration that first checks for existing duplicates | No | Yes | Small, needs a data check |
| DT-067 | Set Master (M01) verifier: phone allows one number only (digits and `+ ( ) - space`, 20 characters); users with two numbers are blocked when they edit that field. PIN must be 6 digits even for a foreign country. GSTIN has no checksum and accepts state code `00`. Decide the rules | No | Yes | The owner |
| DT-068 | Set Master (M01) verifier: dispatch accepts any date up to year 99998 and a free text document name; delete guards are check then delete (no transaction); `accountType` is free text; duplicate account numbers allowed; `created_by` never set on bank accounts | No | No | Small |
| DT-069 | Set Master (M01): `GET /master/usage` scans consumers, co applicants and applicant details on every Set Master page load (cached 30 seconds in the browser). Add indexes or a cache when those tables reach tens of thousands of rows. The browser also copies the role rule (`SM.can`), so a change to the role matrix needs two edits | No | No | Later |
| DT-070 | Release step for Set Master: committed `packages/api/dist` is stale. Run `npx tsc` (CLAUDE.md rule) before the commit and commit the dist changes. Decide on `dist/db/baseline` (DT-044) | Yes, before commit | No | At commit time |

---

## 3. From the module work

Added here as modules are verified. Format:

| ID | Module breakage | Severity | Why deferred | Blocks | Needs |
|---|---|---|---|---|---|
| (empty) | | | | | |

---

## 4. Done

Moved to `COMPLETED_TASKS.md`.

Notes on items that changed after they were written:
- DT-003 (`JWT_SECRET` on Render), DT-004 (proxy hop count on Render), DT-017 (Render build) and DT-018 (Render uploads) were written for Render. Hosting is now Vercel, so each needs the same check on Vercel (the `JWT_SECRET` is set there; uploads are DT-033).
- DT-001 is partly resolved (see its status line).
