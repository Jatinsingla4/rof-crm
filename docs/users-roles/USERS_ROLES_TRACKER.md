# Users & Roles: module tracker

Source of truth: `USERS_ROLES_OWNER_POLICY_FINAL_PLAN(7).md` (owner policy, plan v7). Branch `integration/rof-crm-stabilization`.
Status words: **DONE** = implemented and tested locally on a disposable database; **PARTIAL** = part done, the rest named;
**BLOCKED** = needs an owner or external input that is not code; **TODO** = not started.
Nothing here has run against production or Neon. "DONE" is not "released": the release gates G1, G2, G9, G10, G13, G14 of the plan
(staging, migration batching, protected production approval, written owner approval, no production `SCOPE_MODE=log`, rollback rehearsal)
are all still **NO-GO** and are outside the code.

| ID | Requirement | Status | Where | Test |
|---|---|---|---|---|
| UR-003 | Role Menu Access is menu only (text) | DONE (phase 1) | `routes/roles.ts`, `web/.../users.js` | `api-test-phase1.mjs` |
| UR-009 | Audit rows keep old and new values, never secrets | DONE (phase 1) | `routes/users.ts`, `routes/roles.ts`, `utils/audit-values.ts` | `api-test-phase1.mjs` |
| UR-010 | Two admins cannot remove each other (advisory lock) | DONE (phase 1) | `routes/users.ts` | `api-test-phase1.mjs` |
| UR-013 | `APP_ENV` / `SCOPE_MODE` startup reader | DONE (phase 1) | `utils/app-config.ts` | `api-test-phase1.mjs` |
| UR-015 | Approver stays unsupported | DONE (phase 1) | `routes/users.ts` | `api-test-phase1.mjs` |
| UR-001 | Backend super_admin-only routes, id+name directories, own-role pages, custom role never inherits super_admin | **DONE** (code, API and UI "No access") | `index.ts` (`loadAuthUser`), `routes/users.ts`, `employees.ts`, `roles.ts`, `middleware/rbac.ts`, `web/.../users.js`, `employees.js` | `api-test-ur001.mjs` (40), `e2e/flows.spec.ts` (PM employees) |
| UR-001 | `tasks.project_id` and the task assignee/employee candidate rules (2.7) | TODO | needs M4 and D4 | |
| UR-001 | `CHECK (base_role <> 'super_admin')` on `roles` (M2) | BLOCKED: draft only, needs D11 (owner reviews roles) | | |
| UR-006 / 016 | Exact-address IP helper, canonical storage and comparison, generic 401, audit reason, current-address protection | **DONE** (code) | `utils/security.ts`, `index.ts`, `routes/users.ts` | `api-test-ur006.mjs` (24), `api-test-security.mjs` |
| UR-006 | Re-normalise stored rows (D3), proxy verification (X-Forwarded-For) | BLOCKED: data operation and a read-only look at the real host. Until then IP security is called advisory | | |
| UR-011 | Two lifecycle actions: Disable (keeps settings) and Revoke all; enabling needs `reviewedGrants` (also through `/employees/:id`) | **DONE** (API and Logins screen) | `routes/users.ts`, `employees.ts`, `web/.../users.js` | `api-test-ur011.mjs` (26), `e2e/flows.spec.ts` (Enable dialog, Revoke all) |
| UR-007 | `unit_status_access = 'none'` is now a real value (empty list, no unit shown) | PARTIAL | `middleware/unitStatusAccess.ts`, `routes/units.ts` | `api-test-ur011.mjs` |
| UR-007 | Print/download gates, `/me` flags, NULL treated as none, typed-unit grant checks | **DONE** in code (see the security table); partial-grant filtering of every view, Q-U1 to Q-U3 and the D7 grants before release: open | | |
| UR-005 | Username unique index (M1) | PARTIAL: app handles the race (409), index is a pending draft | `routes/users.ts`, `pending-migrations/M1_*.sql` | `api-test-ur005-008.mjs` (18, applies the drafts to the disposable DB) |
| UR-008 | `roles.name` unique and no super_admin base (M2), `users.role` FK (M3); role delete vs assign race | PARTIAL: lock-based race fix is live; M2 and M3 are pending drafts | `routes/roles.ts`, `routes/users.ts`, `pending-migrations/M2_*`, `M3_*` | `api-test-ur005-008.mjs` |
| UR-004 | Strict maker-checker on the approved route list (part A) | **DONE** (see the security table); part B, receipt state machine, returns and bounce: BLOCKED on Finance sign-off (G5, G6, F1 to F17) | `routes/financial-ops.ts` | see table |
| UR-002 / 014 | Company access enforced for logins with grants (DONE); strict "no grant = no access", NULL-project triage and allow-lists | PARTIAL / BLOCKED: staging, approved per-user mappings (D5, D6), Batch 5 | see the security table | |

## Pending migrations (not on this branch's migration folder on purpose)
The plan forbids a migration file on `main` until its data operation is approved (6A.3): the runner applies every pending file in one run.
Drafts live in `docs/users-roles/pending-migrations/`, are tested on the local disposable database, and move to
`packages/api/src/db/migrations/` only in the release batch the owner approves.

## Owner and external inputs still needed
Q-D1 written confirmation of `APP_ENV` option A; staging environment and its owner (Q-D5); the protected production approval and serialized
release workflow (12.2); Finance answers F1 to F17 and the architecture choice 5.9; per-user project/company/print/download/unit-status
decisions (D5 to D7); review of roles with a super_admin base (D11) and duplicate usernames (D1); ghost roles (D2).

## Test results (last full run, local disposable database, `TZ=UTC`, database timezone UTC for the run)
| Check | Command | Result |
|---|---|---|
| TypeScript | `cd packages/api && npx tsc --noEmit -p .` | no errors |
| Production build | `cd packages/api && npm run build` | exit 0; `dist` regenerated and committed |
| Complete API suite | `.github/scripts/run-api-tests.sh $(ls docs/*/api-test-*.mjs | sort)` | 51 scripts, 0 failed; 8,557 checks in the 47 scripts that print a total, plus ur001 40, ur005-008 18, ur006 24, ur011 26 |
| Complete Playwright suite | `cd e2e && BASE_URL=http://localhost:3010 npx playwright test` | 245 of 245 passed, 0 failed, 0 skipped, `retries: 0`, 1 worker |
| Users & Roles targeted | `api-test-phase1.mjs` 50, `api-test-ur001.mjs` 40, `api-test-ur006.mjs` 24, `api-test-ur011.mjs` 26, `api-test-ur005-008.mjs` 18 | all pass |

Assertions that encoded the old policy were changed to the approved policy, not relaxed: project_manager now gets 403 on `/roles`, `/users/audit-logs`
and every `/employees` route except `/directory`; reactivating a login needs `reviewedGrants`; a blocked address gets the generic 401. A vacuous
Playwright test ("project_manager can look but not change", which passed because an error page has no buttons) was replaced by one that requires the
"No access" text and no data rows; it found a real UI gap, now fixed (`employees.js`/`users.js` did not recognise the new refusal text).

## Timezone: business calendar policy (owner decision, implemented)
Policy: timestamps are UTC instants; user-facing calendar dates and business-day maths use **Asia/Kolkata**; neither the machine timezone nor the
PostgreSQL session timezone decides a business date; DATE columns stay calendar days.
- Shared helper `packages/api/src/utils/business-date.ts` (`businessToday`, `businessTomorrow`, `businessYear`, `businessDayStart`, `addDays`, `addYears`, `SQL_TODAY`, `sqlDay`, `sqlDayStart`, `sqlDayEnd`); web: `Utils.isoDate/today/monthStart/displayDate/date/dateTime` in `packages/web/public/js/utils.js`; tests: `docs/_shared/business-date.mjs`.
- Replaced everywhere: 27 SQL `CURRENT_DATE`/`NOW()::date` uses, `created_at::date` style casts, timestamp-versus-date range filters (now exact IST day boundaries), JS "today"/"tomorrow grace" (`toISOString().slice`), calendar year in receipt/journal numbers, as-of dates of interest and letters, the scheduler day counts, printed letter dates, the min-age check; dashboard and milestones now share `SQL_TODAY`.
- Pending migration `docs/users-roles/pending-migrations/T1_business_date_defaults.sql`: the 14 `DATE DEFAULT CURRENT_DATE` columns follow the session timezone until it is applied (schema change, release batch; idempotent, defaults only).
- Not changed on purpose: `responseFormatter.ts` compares an instant with a due date (rule-sensitive, left as it was); DATE-to-text conversions that rely on the process running on UTC (`db/pool.ts` forces `TZ=UTC`); browser-side display of other pages uses the browser timezone (users are in India); demo seed scripts (not tests).
- Regression test `docs/timezone/api-test-business-date.mjs` (49 checks): fixed instants around 18:30 UTC (midnight IST) and the whole 00:00 to 05:30 IST window, year, month and leap-day boundaries, process `TZ` of four zones, database session timezone of four zones for `SQL_TODAY`, `sqlDay`, `sqlDayStart/End` and a range filter, a DATE value, and a source scan that fails on the old patterns (proved to catch a planted violation).
- Evidence: run at 01:19 to 03:10 IST (the window where UTC and India dates differ) with the application on UTC and the local database on `Asia/Kolkata`: the 6 API checks and 3 browser tests that used to fail now pass; complete API suite 52 scripts, 0 failed (47 scripts with totals: 8,553 checks).
- **Browser verification is incomplete.** The first full Playwright run at 205 of 210 found one real regression of mine (`pending-cheques.html` does not load `utils.js`; fixed). The remaining failures were 90-second timeouts of different tests on every rerun while the machine was swapping (about 5.7 GB of swap used, load average 16 to 20, 4 to 17 minutes for a spec that took under 2); an API call to the same screens answers in 0.1 s. A clean full Playwright run on a quiet machine is still owed.

## Timezone before the decision (history)
(superseded by the policy above) The application deliberately runs on UTC (`packages/api/src/db/pool.ts`: `process.env.TZ = 'UTC'`; its comment says production and CI run on UTC;
CI uses `postgres:18`, default UTC). A local database on `Asia/Kolkata` made 6 API checks and 3 browser tests fail between 00:00 and 05:30 IST (the tests
use the UTC date, the database `current_date` was the IST date). With the local database on UTC they all pass. UTC is therefore the intended
standard, and the local database was the odd one; it has been put back to its default. Open product question for the owner: `dashboard.ts` and
`milestones.ts` use an explicit `Asia/Kolkata` "today" while every other module uses UTC, so for users in India most screens show yesterday's date
between 00:00 and 05:30 IST. Choosing one business-date standard for the whole application is a cross-module decision and was not changed here.
Production database timezone was not queried (no production access); it is assumed UTC only from the application comment.

## Security remediation of the independent review (Codex): one line per finding
Status words as above. Every row names its commit and test; nothing ran against production or Neon.
| Finding | Status | Evidence | Test (local disposable database) | Commit |
|---|---|---|---|---|
| A. Company access (`user_company_access` never enforced) | **FIXED** for logins that have grants; **BLOCKED** for the strict rule "no grant = no access" (needs the owner's per-user mapping, D5); legacy `bank_accounts` with no company are not filtered | `index.ts` `loadAuthUser` (grants narrow the project scope the database policies apply to every project-bound table), `routes/companies.ts` (`router.param`, list), bank-account checks in `receipts.ts`, `allocations.ts`, `outgoing-payments.ts`, `reports.ts` | `api-test-company-access.mjs` 25 | `f04f3d3` |
| B. NULL-project rows open to limited logins | **PARTIAL / BLOCKED**: mechanism, draft policy `M10a`, inventory report and a scratch test exist and the app already sets `app.scope_strict`; NOT applied: it hides enquiries and catalogues from limited logins until the owner signs the allow-list and maps the rows (G4, D4 to D6) | `db/pool.ts`, `pending-migrations/M10a_strict_null_scope.sql`, `data-operations/d6-null-scope-report.sql` | `data-operations/test-null-scope.sh` 11 | `035e43d` |
| C. Financial self-approval (super_admin exempt) | **FIXED** for every route of plan 5.4 part A (receipt, journal approve and reject, waiver, refund approve/process/reject, cancellation refund, credit/debit note approve/cancel, broker approve/reject/status, draw refund, GST invoice cancel/reverse); NULL creator = 409. **BLOCKED** part B (single-step handlers without a request stage): needs the Finance design decision (Q-F4, G5/G6) | `routes/financial-ops.ts` `notOwn`, `receipts.ts`, `receipt-process.ts`, `brokers.ts`, `payments.ts` | `api-test-receipts` 283, `api-test-tds` 246, `api-test-broker-hold` 569, `api-test-payments-rest` 1006 (second super_admin as checker via `docs/_shared/second-admin.mjs`) | `5bbcab9` |
| D. Print / download only in the UI | **FIXED** on the server for 17 endpoints (printable pages, generated documents, mark-printed, exports, vault, booking and challan files, PDF needs both; link-token routes too); the UI hides buttons from `/users/me` and hooks `window.print`. **PARTIAL**: browser-generated CSV/Blob downloads of data the login may read are not controllable server-side | `middleware/printDownload.ts` and the route files | `api-test-print-download.mjs` 12 | `2ded4de` |
| Unit status fail closed | **FIXED** for NULL/unknown/none on the list, the other inventory views and the typed-unit checks (booking, allocation, shift, hold; `/units/lookup` for pickers). **PARTIAL**: a partial grant (available, hold) is applied to the list and the typed-unit check only; the other views refuse `none` but do not yet filter by status; Q-U1 (`/units/:id/charges`) and Q-U2 (transfers, promoting a booked allocation) are open. **RELEASE RISK**: existing logins with NULL or unknown values become `none` and every login without an explicit print/download grant loses printing and exports at release, so D7 (below) must come first | `utils/unit-grant.ts`, `middleware/unitStatusAccess.ts`, `units.ts`, `booking.ts`, `allocations.ts`, `inventory_hold.ts`; draft `M9` | `api-test-unit-status.mjs` 34; `data-operations/d7-capability-report.sql` lists the impact | `2ded4de` |
| Throttling is process-local | **PARTIAL / BLOCKED**: the shared atomic store is implemented (`auth_throttle`, draft T2, picked up by itself) and tested; until T2 is applied in production the counts are per process and the app logs a SECURITY warning at startup (error when `APP_ENV=production`) and says so in the admin diagnostics. No Redis is configured where the app deploys, so the table is the shared store; **production blocker until T2 is applied** | `utils/throttle.ts`, `index.ts`, `routes/users.ts`, `pending-migrations/T2_auth_throttle.sql` | `api-test-throttle.mjs` 12 | `0ca1397` |
| Employees / Security navigation | **FIXED** (usability): entries hidden for everyone but super_admin; the server guards stay | `web/public/js/permissions.js` | Playwright `flows.spec.ts` (PM no access) | `2ded4de` |
| Database integrity (M1 to M3, D1, D2, D11) | **PARTIAL**: reports, dry-run scripts and drafts exist and pass a 30-check scratch-database test; the constraints are NOT applied (they wait for the data operations and the release gates); no real data was read | `data-operations/*`, `pending-migrations/M1..M3` | `data-operations/test-data-operations.sh` 30; `api-test-ur005-008.mjs` 18 | `0e7d098` (and earlier) |
| Timezone | **FIXED** in code; kept in its own commits; browser verification incomplete (machine swapping) | see "Timezone: business calendar policy" above | `api-test-business-date.mjs` 49 | `2136e4f`, `a5658c7` |

### New data-operation reports in this round
`d6-null-scope-report.sql` (NULL project, consumer, unit rows per table) and `d7-capability-report.sql` (per-login print, download, unit status and what they become at
release). On the local test data alone, 403 of 472 active non-super-admin logins would lose printing and 427 downloading at release, and 9 hold a NULL or unknown unit status; the real numbers come only from a
restored copy of the real data.

### Last full runs for this round (local disposable database)
- Complete API suite: 56 scripts, 54 passed cleanly and 45 of them print totals (8,183 checks, 0 failed). Two scripts, `api-test-dashboard-recon` and `api-test-surrender`, crashed with `ECONNRESET` inside the full run (the machine was swapping, as in the timezone round, and a keep-alive socket was reset); each was rerun alone straight after: 197 passed, 0 failed and 183 passed, 0 failed. This is a recorded transient, not a clean full-suite pass.
- `tsc --noEmit` and `npm run build`: clean. Playwright was not rerun in this round: the browser tests were unreliable on the swapping machine (see the timezone section), and `e2e/broker-hold.spec.ts` and `e2e/dashboard.spec.ts` were changed to record a different maker than the approving admin without being run. A clean full Playwright run on a quiet machine is still owed.

## Final regression validation round (2026-11-05, HEAD `5daa744` at the start)
**Result: the two full suites were NOT run. The machine was too loaded to give a valid result, so the validation is open.**
- Preflight (read only): working tree clean; no Playwright or API test process running; nothing listening on port 3010; the API script and every test point at `localhost:5433`, database `rof_p1` (the disposable local database; no `DATABASE_URL`, no Neon).
- Load at the check: load average 22.5 / 15.7 / 11.1 (rising), swap 8.7 GB of 10 GB used, about 134 MB of memory unused with 3 GB in the compressor, `kernel_task` at 90 % CPU, 22 % user + 25 % system. The heavy processes were not ours (Chrome helpers, the Claude renderer, WindowServer). In the earlier rounds the same condition made unrelated browser tests time out and two API scripts reset a keep-alive socket, so starting the suites would have produced noise, not evidence. Nothing was killed.
- Two idle shells (`zsh -c ... until ! pgrep -f run-api-tests ...`, 0 % CPU) are old wait loops of the assistant that can never end, because their own command line matches the pattern; they are harmless, were not killed on purpose, and any later wait must use a PID, not `pgrep -f`.
- Done anyway (light, no server): `tsc --noEmit` clean; `npm run build` exit 0 and the CI dist check is empty; the midnight-IST regression `docs/timezone/api-test-business-date.mjs` 49 passed, 0 failed (fixed instants around 18:30 UTC, process timezone and database session timezone variants, source scan); the local database timezone is `Asia/Kolkata` with no database-level override (restored after the earlier UTC experiment).
- **Still owed, in this order, on a quiet machine:** (1) `cd e2e && BASE_URL=http://localhost:3010 npx playwright test` (all 245 tests; `broker-hold.spec.ts` and `dashboard.spec.ts` were edited without a run); (2) the 56 API scripts with `.github/scripts/run-api-tests.sh $(ls docs/*/api-test-*.mjs | sort)`, recording the wrapper exit code apart from each script's result, and a look at why `dashboard-recon` and `surrender` reset a socket inside the full run (both pass alone: 197 and 183). Start only when the load average is below the core count and swap is not growing.

**Second attempt (resume request, HEAD `b6cff4b`): not started either.** Load average 19.9 / 14.0 / 11.6 on 8 cores (4 performance), swap 8.4 GB of 9.2 GB used and growing during the check (8.39 GB to 8.53 GB in about 15 seconds; 54,528 pages swapped out in that window, about 850 MB), about 98 MB of memory unused, 3.2 GB in the compressor. Postgres at `localhost:5433` was accepting connections, port 3010 was free, no test process was running, the tree was clean. The stability condition (swap no longer increasing, load below the core count) was not met, so neither Playwright nor the API suite was run. **Validation remains incomplete: 0 of 245 Playwright tests and 0 of 56 API scripts executed in this round.** TypeScript and the build were not rerun in this attempt; their results above (clean, exit 0) are from the earlier completed checks.

### Third attempt: the suites were run (2026-11-05, HEAD `b6cff4b`, started on the owner's instruction after the load fell)
Targets: PostgreSQL `localhost:5433`, database `rof_p1` (timezone `Asia/Kolkata`, no override), API `localhost:3010` started from the working tree; no Neon, no production. Load at the start 11.9 falling to 3.5, swap still high (about 8.5 to 9 GB used). Suites ran one after the other, never in parallel, and no wait loop was used. **Validation is INCOMPLETE: Playwright failed.**

**Playwright**: command `cd e2e && BASE_URL=http://localhost:3010 rtk proxy npx playwright test` (`rtk proxy` only switches off the output summariser), 11:10:56 to about 11:26:26, 15.4 minutes, **exit code 1**. 245 tests listed: **236 passed, 2 failed, 7 did not run, 0 skipped, 0 retried** (`retries: 0` in the config; no flaky line). The 7 are the tests behind the two failures in the same serial files. First-failure evidence (log kept in the scratchpad `final-pw.log`; screenshots, traces and error contexts in `e2e/test-results/`):
1. `flows.spec.ts:818` "Employees: only super_admin can open it (UR-001); project_manager sees 'No access' and no data": the screen showed "Access Denied / You don't have permission to view this page" instead of "No access". Consistent with the route-level menu guard added in `2ded4de` (`SUPER_ADMIN_ONLY_ROUTES` in `permissions.js`): the project manager is stopped before the Employees screen loads, so no data is shown (the policy holds) but the test still expects the older text. **Stale test expectation after my own change**, not yet corrected.
2. `payments-rest.spec.ts:332` "GST Invoicing: reversal, cancellation, credit and debit note": `#rev-result` showed "Error: You created this yourself, someone else has to act on it". The spec creates the invoice and reverses it as the same super_admin, which strict maker-checker (`5bbcab9`) now refuses. **The e2e fixture still has one actor**; it needs the same "recorded by another user" fixture as `broker-hold.spec.ts` and `dashboard.spec.ts`. Not yet corrected.
Neither is shown to be a product defect, but neither was changed in this execution-only round, so the browser suite is red and stays so until the two specs are updated and the suite is rerun clean.

**API**: `.github/scripts/run-api-tests.sh $(ls docs/*/api-test-*.mjs | sort)` over all **56** scripts, 11:26:47 to 11:39:40, 13 minutes. **Wrapper exit code 0**; per script: **56 OK, 0 FAILED**. 47 scripts print a total: **8,567 checks passed, 0 failed**. Nine scripts do not print a total through the wrapper and passed by exit code: `api-test-business-date`, `api-test-company-access`, `api-test-print-download`, `api-test-throttle`, `api-test-unit-status`, `api-test-ur001`, `api-test-ur005-008`, `api-test-ur006`, `api-test-ur011`. The two scripts that reset a socket in an earlier full run passed this time on their first execution: `api-test-dashboard-recon` 197 passed, 0 failed; `api-test-surrender` 183 passed, 0 failed. The earlier resets happened while the machine was swapping and did not reproduce here; the cause is still not proven, only associated with the load.

**TypeScript and build**: clean and exit 0, from the earlier completed checks (not rerun in this round).

### State of the local disposable database (so a result is not misread)
It is not a pristine CI database. These objects exist only because tests or checks applied the pending drafts to it, and they must never be applied anywhere else without their release batch:
| Object | Present locally | Why |
|---|---|---|
| `users_username_lower_btrim_key` (M1), `roles_name_key` and `roles_base_role_not_super_admin` (M2), `users_role_fkey` (M3) | yes | `api-test-ur005-008.mjs` applies the drafts (idempotent); `api-test-ur001.mjs` lifts the CHECK for one block and restores it |
| `auth_throttle` (T2) | yes | `api-test-throttle.mjs` applies the draft; the API then counts failures in it |
| `rof_scope_global_tables` and the M10a policies | no (scratch database only) | `test-null-scope.sh` works on a scratch copy |
| T1 (14 `DATE DEFAULT CURRENT_DATE` columns), M9 column defaults | not applied (14 columns still `CURRENT_DATE`) | schema changes for a release batch |
| Seeded role logins with explicit grants (`authorized_print`, `authorized_download` true, `unit_status_access` all) | 6 of 6 | `packages/api/scripts/make-test-db.sh` seeds them; the local rows were updated by hand to match. The owner's D7 does the same for real logins. Denial tests create their own logins, which start with none |
| Test logins | 466 | accumulated by the test scripts |
Because the tests apply the drafts themselves, a fresh CI database ends the API suite in the same state; the suite does not depend on the order except that `api-test-throttle.mjs` needs up to 70 seconds for the API to notice the new table.

## Not done in this validation (still open)
- Menu entries for Employees/Security are still listed for project_manager (the screen answers "No access"); removing them is menu data (plan 2.3, convenience only).
- Staging, release gates G1, G2, G9, G10, G13, G14, the pending migrations and every BLOCKED row above.
