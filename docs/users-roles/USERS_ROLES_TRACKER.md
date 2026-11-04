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
| UR-007 | Print/download gates, `/me` flags, NULL treated as none, allocation grant checks | TODO (needs D7 before NULL flips, Q-U1 to Q-U3 answered) | | |
| UR-005 | Username unique index (M1) | PARTIAL: app handles the race (409), index is a pending draft | `routes/users.ts`, `pending-migrations/M1_*.sql` | `api-test-ur005-008.mjs` (18, applies the drafts to the disposable DB) |
| UR-008 | `roles.name` unique and no super_admin base (M2), `users.role` FK (M3); role delete vs assign race | PARTIAL: lock-based race fix is live; M2 and M3 are pending drafts | `routes/roles.ts`, `routes/users.ts`, `pending-migrations/M2_*`, `M3_*` | `api-test-ur005-008.mjs` |
| UR-004 | Receipt state machine, strict `notCreator` wiring, return/bounce, financial approvals | BLOCKED: Finance sign-off (G5, G6, F1 to F17) and owner answers; helper `notCreator` exists since phase 1 | | |
| UR-002 / 014 | Strict company and project scope, NULL-project triage, allow-lists | BLOCKED: needs staging, approved per-user mappings (D5, D6), Batch 5 | | |

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

## Timezone (finding, not changed)
The application deliberately runs on UTC (`packages/api/src/db/pool.ts`: `process.env.TZ = 'UTC'`; its comment says production and CI run on UTC;
CI uses `postgres:18`, default UTC). A local database on `Asia/Kolkata` made 6 API checks and 3 browser tests fail between 00:00 and 05:30 IST (the tests
use the UTC date, the database `current_date` was the IST date). With the local database on UTC they all pass. UTC is therefore the intended
standard, and the local database was the odd one; it has been put back to its default. Open product question for the owner: `dashboard.ts` and
`milestones.ts` use an explicit `Asia/Kolkata` "today" while every other module uses UTC, so for users in India most screens show yesterday's date
between 00:00 and 05:30 IST. Choosing one business-date standard for the whole application is a cross-module decision and was not changed here.
Production database timezone was not queried (no production access); it is assumed UTC only from the application comment.

## Not done in this validation (still open)
- Menu entries for Employees/Security are still listed for project_manager (the screen answers "No access"); removing them is menu data (plan 2.3, convenience only).
- Staging, release gates G1, G2, G9, G10, G13, G14, the pending migrations and every BLOCKED row above.
