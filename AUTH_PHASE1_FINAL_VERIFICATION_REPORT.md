# Authentication Phase 1 final verification report

Date: 2026-11-04. Verification only: **no application code was changed**, nothing was committed, pushed, merged or deployed, and no existing database or test data was touched (the ZZ data and its units, `rof_crm`, production, Neon and Vercel were never connected to). Files added by this task: this report, plus the status table edit in `docs/architecture/ROF_CRM_MASTER_FLOW.md`.

## 1. Result in one table

| Area | Result |
|---|---|
| Phase 1 regression script `docs/auth-fixes/api-test-auth-phase1.mjs` | 68 passed, 0 failed, exit 0 |
| Security script `docs/security-setup/api-test-security.mjs` | 156 passed, 0 failed, exit 0 |
| Independent probe of the three requested behaviours (separate from the repo test) | all checks PASS |
| All repository API scripts (discovered count: **46**, same as before) | 46 OK, 8505 checks, 0 failed, runner exit 0 |
| Playwright, all 15 spec files | **245 tests: 244 passed, 1 failed** (`crm.spec.ts:300`, classified below as test-data contamination, not an application defect) |
| `tsc --noEmit` (API) | no errors, exit 0 |
| `git diff --check HEAD` | clean, exit 0 |
| JavaScript syntax, changed frontend files and test scripts | all OK |
| Secret scan of every captured output | no token, signing secret, connection string, key or test password in any output |
| Git status before and after | identical (23 entries) |

Overall: the Phase 1 fixes (AUTH-001, AUTH-002, AUTH-008) are verified. One non-authentication browser test fails in the full-suite order because of contaminated test data; I did not alter it.

## 2. Isolation and database

- Checks before creating anything: the server was local PostgreSQL 18.3 on `::1:5432`; the existing databases were `postgres`, `sow_db`, `real_estate_crm`, `rof_crm`, `rof_sm_test`, `rof_sm_ui`, `rof_m1_verify`; the name `rof_auth_final_verify` did not exist (count 0, and no name containing "final_verify").
- Created `rof_auth_final_verify` with `packages/api/scripts/make-test-db.sh` (baseline schema, 6 role users, small synthetic sample data), then applied migrations 096 to 145 (**50 files, none failed**; last file `145_tax_slabs_name_unique_ci.sql`). Migrations were applied nowhere else.
- One API server was started from the working tree against that database only, on port 3041 (ports 3000, 3010 and 3011 belonged to other processes and were not used). The server runs in development mode with the repository's `API_RATE_MAX` setting raised, as the repository's own pipeline does, because the browser and API suites exceed the default per-minute limit.
- Cleanup: before dropping I confirmed the exact name matched one database, that it held the synthetic `@test.local` users and the migration 145 index (so it was the one I built), and that no connection was open. I dropped only that database. Afterwards the database list was identical to the list before.
- Uploads: no file was created in `packages/api/uploads` (the server ran with a scratch working directory).

## 3. API verification, in order

| Order | Script | Exit | Result |
|---|---|---|---|
| 1 | `docs/auth-fixes/api-test-auth-phase1.mjs` | 0 | 68 passed, 0 failed |
| 2 | `docs/security-setup/api-test-security.mjs` | 0 | 156 passed, 0 failed |
| 3 | independent probe (section 4) | 0 | all PASS |
| 4 | all 46 scripts through `.github/scripts/run-api-tests.sh` in sorted order | 0 | 46 OK, 8505 passed, 0 failed |

A first attempt at step 4 failed for all 46 scripts because of a mistake in my own harness: the shell hook rewrote `ls` so the script list contained file sizes instead of paths, and every script crashed immediately at start. That output is kept as `all_scripts_ATTEMPT1_harness_error.txt` in the scratch folder, was not counted, and the run was repeated with a list built by `find` (the second run is the one reported). It was not an application problem.

Results per script (passed checks, all 0 failed): addon-charges 152, allocations 201, applicants 348, auth-phase1 68, booking 276, broker-hold 565, charge-master 63, email-templates 87, crm 285, dashboard-recon 197, demands 189, documents-core 153, documents 132, employees 115, end-to-end 68, gst-configuration 271, operations 8, outgoing 39, parking-import 194, plans 180, payments-rest 1000, receipts 281, reports-lifecycle 24, reports 956, scope 34, security 156, set-master-final-review 77, set-master-fixes 171, set-master-parity 92, set-master-deep 19, set-master-setup 138, numbering 25, set-projects-parity 267, timely-discount 42, unit-charges 62, fixes 49, plc 92, project-setup 81, units-rates 247, small-routers 296, smtp 82, surrender 183, tds 244, transfers 286, web-guards 8, whole-flow 2. The date-boundary failures seen in earlier rounds did not recur (this run was well after midnight UTC).

## 4. The specifically requested behaviours (independent probe)

A separate script created new synthetic logins (copy of the test hash, deactivated afterwards) and checked each item directly; output was captured without printing any credential.

| Requested check | Result |
|---|---|
| `PATCH /api/users/:id` with a wrong current password (own login, super_admin) | 403 "Current password is incorrect" |
| `PATCH /api/users/employee-login/:id` with a wrong current password | 403 "Current password is incorrect" |
| The previous password is unchanged after those refusals | the old password still signs in, the attempted new one does not |
| The correct current password works | 200 on `PATCH /users/:id`; the new password signs in and the old one stops working |
| Super_admin reset of another login | 200 on `PATCH /users/:id` and on `POST /users/:id/change-password`, no current password needed; the other login signs in with the new password |
| Throttle shared between both routes | three wrong guesses on `PATCH /users/:id` plus two on `change-password` returned 403, 403, 403, 401, 401; then `change-password` with the right password returned 429 with `Retry-After`, and `PATCH /users/employee-login/:id` with the right password returned 429 (the same count). The password stayed unchanged and sign-in still worked |
| Admin diagnostics protected | `/api/health/templates` and `/api/health/debug`: anonymous 401, sales executive 403, super_admin 200 |
| No template body exposed | a marker string stored in a synthetic template row appeared in no anonymous response and not in the super_admin diagnostic (no `body_html` key) |
| `/api/health` still public | 200 with only `status`, `timestamp`, `commit` |

The repo regression script covers the same ground with 68 checks (own-password rules for super_admin and sales executive, both PATCH routes, administrator reset, unauthorized users, throttle behaviour including independence of other accounts and of sign-in, and the diagnostics).

## 5. Playwright (full suite, all 15 spec files, run after the API scripts on the same database, as the repository's pipeline does)

Command: all specs in `e2e/`, one worker, against the server on port 3041. Result: **245 tests, 244 passed, 1 failed, 11.0 minutes.**

| Spec file | Passed | Failed |
|---|---|---|
| auth-phase1.spec.ts | 3 | 0 |
| broker-hold.spec.ts | 12 | 0 |
| crm-leftovers.spec.ts | 10 | 0 |
| crm.spec.ts | 17 | **1** |
| dashboard.spec.ts | 4 | 0 |
| documents-core.spec.ts | 5 | 0 |
| edit-booking.spec.ts | 5 | 0 |
| flows.spec.ts (includes the Set Master and Security flows) | 25 | 0 |
| lifecycle.spec.ts | 53 | 0 |
| parking-import.spec.ts | 14 | 0 |
| payments-rest.spec.ts | 12 | 0 |
| reports.spec.ts | 69 | 0 |
| set-master-fixes.spec.ts | 4 | 0 |
| small-routers.spec.ts | 6 | 0 |
| smtp.spec.ts | 5 | 0 |

The only failure is `crm.spec.ts:300` "Leads: every filter option, Kanban and Table, stage tiles and the search give a screen without errors".

### Investigation of crm.spec.ts:300 (Leads screen showing NaN)

What fails: the test's `clean()` rejects any screen text matching `undefined`, `NaN` or `[object Object]`. The saved page text from the failing full run contains the line `NaN Rnd 905243` in the Leads list.

Reproduction and classification:
1. The same test alone on the same (already used) database: passes. The whole `crm.spec.ts` alone: 18 of 18 pass. The three files that precede it in order (auth-phase1, broker-hold, crm): all pass.
2. Source of the text: `docs/applicants/api-test-applicants.mjs` lines 300 to 312 create 80 random applicants named `Rnd <number>` and set 1 to 4 random fields from a list of junk values that includes the string `'NaN'`. When `first_name` receives that value, the Leads card (`packages/web/public/js/pages/leads.js` line 205 prints first name, last name and name) shows `NaN Rnd 905243`. The stored row now has an empty first name because a later browser step edited it (its `updated_at` is later than its creation), which is why the data looked clean afterwards.
3. Deliberate reproduction (disposable database only): I set `first_name = 'NaN'` on that one row and ran the Leads test alone: it **failed**; I restored the value and ran it again: it **passed**.

Verdict: **test-data contamination with a test-order dependency and randomness.** The API fuzz script (which runs before the browser specs on the same database in the pipeline) sometimes stores the literal text `NaN` in a visible name field, and the browser test treats any such text on the Leads screen as a rendering error. It is not an application defect (the page prints the stored text exactly as saved), not authentication related, and not environment related. It is intermittent: it depends on the random values the fuzz picks in that run, which is also why it appeared in some earlier full runs and not in others. I did not edit the test, the data scripts or the page. Recommendation for a separate fix round: make the fuzz avoid values the browser checks reject in visible fields, or have the Leads test ignore data it did not create.

## 6. Static checks
- `tsc --noEmit` in `packages/api`: "No errors found", exit 0.
- `git diff --check HEAD`: no output, exit 0.
- `node --check`: `set-master-docs.js`, `set-master.js`, `users.js` (changed frontend files) and the three new test scripts under `docs/auth-fixes` and `docs/set-master-fixes`: OK.
- Compiling the two new e2e spec files with a stand-alone `tsc` call reported only missing Node type declarations (not part of the repository's configuration; Playwright runs them without type checking and all their tests passed). Not counted as a failure; no lint configuration exists in the repository.
- Secret scan of all captured outputs: searched for JWT prefixes, the test server's signing secret, bearer values, connection strings, key prefixes, password hashes and the shared synthetic test password: **no match in any output file**, and none appears in this report.

## 7. Git status before and after
`git status --short` was recorded before the first command and after the last; the two files are identical (23 entries: 12 modified tracked files, 11 new paths, all Set Master and Authentication work). The only change made by this task is this report (untracked, added after the second snapshot) and the edit of the finding status table in `docs/architecture/ROF_CRM_MASTER_FLOW.md`, which was already an untracked file. No existing working-tree change was altered.

## 8. Remaining unverified behaviour
- The 15 minute expiry of the current-password lock (it would need a 15 minute wait); the counters live in server memory, so behaviour across restarts and several instances is unverified and is part of AUTH-004.
- Behaviour on the real host (Vercel): proxy headers and several instances.
- The first-attempt harness failure above was explained and repeated; nothing else was skipped.
- Lint: not available.

## 9. Open items for a separate round
- Fix the contamination between the API fuzz data and the Leads browser test (section 5). No application change is needed for it.
- All other authentication findings (AUTH-003 to 007 and 009 to 017) remain open; the Authentication module is not complete. Phase 2 and Users & Roles were not started.
