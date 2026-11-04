# Login & Authentication fix, phase 1 report

Date: 2026-11-04. Scope: AUTH-001, AUTH-002, AUTH-008 only. No other authentication finding was touched. Nothing was committed, pushed, merged or deployed. All Set Master changes in the working tree are preserved (the `git status` list was compared before and after: only the phase 1 files below were added or changed).
Labels: **RUNTIME** = run against a live server and a disposable database or a browser; **SOURCE** = read in code.
Test environment: disposable local databases created with `packages/api/scripts/make-test-db.sh` (migrations 96 to 145), synthetic users, one synthetic template row; servers on local ports only. No existing database, production, Neon or Vercel system was touched. The databases were dropped afterwards.

## 1. Summary

| Finding | Result |
|---|---|
| AUTH-001 public diagnostics and template text | Fixed. Both diagnostics now need a super_admin login and are rate limited; no template text is returned; only `/api/health` is public. |
| AUTH-002 own password without the current one | Fixed. Every role must give the current password on both routes that set your own password. The super_admin reset of another login is unchanged. |
| AUTH-008 no throttle on the current-password check | Fixed. 5 wrong answers in 15 minutes block that check for that account for 15 minutes; nothing else is blocked. |

Evidence: the new script `docs/auth-fixes/api-test-auth-phase1.mjs` (68 checks) passes 68 of 68 on the fixed code and fails 35 of 68 on a snapshot of the code taken just before the changes. The new browser spec `e2e/auth-phase1.spec.ts` (3 tests) passes. All 46 repo API scripts pass. Playwright: 242 tests in the full run, 241 passed and one failed on a timing race that did not repeat; the final reruns of the Set Master, flow and new specs passed 32 of 32 twice. `tsc --noEmit` is clean and `git diff --check` is clean. Lint cannot run (the repo has no ESLint configuration; unchanged condition).

## 2. AUTH-001 Public diagnostics and template text

- Original: `GET /api/health/debug` and `GET /api/health/templates` (`packages/api/src/index.ts`, registered before authentication) answered anyone. The second returned the full `body_html` of the buyer agreement and conveyance deed templates, `nodeEnv`, and the raw error message on failure. Not rate limited.
- Reproduced before the fix (RUNTIME, on the snapshot): without a token both returned 200 and a marker string stored in a synthetic template appeared in the response; sales executive, accounts finance and read-only viewer logins also got 200.
- Root cause: both routes were registered ahead of `authenticateToken` as "public health" routes and the template query selected `body_html`.
- Change (`index.ts`): new `adminDiagnostics` chain (`apiLimiter`, `authenticateToken`, super_admin check) on both routes. The templates diagnostic now selects only type, project, name and count (never `body_html`); its failure answer is a generic `Diagnostic failed`. `/api/health` is unchanged (status, timestamp, 7 character commit) and stays public for deployment checks. Nothing in the repo's workflows or scripts calls the two diagnostics (searched; only `docs/DEFERRED_TASKS.md` DT-008 mentions them).
- Tests: no token is 401 for both and shows no template text; sales executive, accounts finance and read-only viewer are 403; super admin gets 200, sees the template listed by name but not its text; `/api/health` returns 200 with exactly status, timestamp and commit; no environment or database detail reaches an unauthenticated caller.
- Remaining risk: the diagnostics still exist for super_admin. Removing them entirely is possible if nobody uses them (a decision for the owner).

## 3. AUTH-002 Current password for your own password change

- Original: `POST /api/users/:id/change-password` demanded the current password only when `req.userRole !== 'super_admin'` (`routes/users.ts`). A second path was also open: `PATCH /api/users/:id` and `/api/users/employee-login/:id` accepted a `password` for your own login from a super_admin with no current password (found while tracing the callers; not in the audit list).
- Reproduced before the fix (RUNTIME, snapshot): a super_admin token alone changed that login's own password through change-password; the same through both PATCH routes; the old password stopped working.
- Change (`routes/users.ts`): one helper `verifyOwnPassword` used by change-password (always, for every role when `:id` is the caller) and by `updateUser` when the caller sets their own `password` through the edit routes. Missing or non-text current password is 400. Wrong is 401 on change-password (its existing answer) and 403 on the edit routes, because the screens sign the user out on any 401 (`js/api-client.js`), which a typing mistake must not cause (found when the browser test signed the admin out). The admin reset of another login is unchanged: super_admin only, no current password, other roles get 403.
- UI (`packages/web/public/js/pages/users.js`, 3 lines): when you edit your own login the form shows a "Current password" box and sends it only when a new password is typed. Without it a super admin would have lost the only screen path to change their own password (there is no separate change-password screen in the app). Changing your own password still ends your sessions, as the form already says.
- Tests: for super admin and sales executive: no current, empty current and non-text current are 400 and the password is unchanged; wrong current is 401; right current changes it, ends the earlier tokens and the old password stops working. Both PATCH routes: no current is 400, wrong is 403, right is 200, other fields still need no password. Admin reset of another login (change-password and PATCH) still works without the current password and ends that person's sessions; a super admin may reset another super admin. Unauthorized: a sales executive cannot change another login (403 for a sales executive and for a super admin target), cannot reset through PATCH (403), no login is 401, and nobody's password changed in those attempts. Browser: the current-password box shows on your own row and not on another's; a missing or wrong current password shows an error in the drawer; the right one saves and signs you out; setting another person's password needs none.
- Remaining risk: AUTH-007 (token in localStorage) is untouched, so a stolen token still lets an attacker try the current password, now limited by AUTH-008. A forgot-password flow does not exist (AUTH-009, open).

## 4. AUTH-008 Throttle on current-password checks

- Original: wrong current passwords answered 401 without limit (20 tries in a row, RUNTIME in the audit).
- Design: counted per account (not per address, so a changed address does not help, and two tokens of one account share the count). 5 wrong answers within 15 minutes block further current-password checks for that account for 15 minutes with `429` and a `Retry-After` header; a correct answer is also refused during the block (standard lockout). A correct answer before the limit clears the count, and so does a new password (own change or an administrator's reset). The count is shared by change-password and the edit form route.
- Why this does not lock out honest users: only the current-password check is blocked; signing in, every other action and the administrator reset keep working (tested), three typos then the right password works, and the count starts again after a success. An attacker holding a stolen token can block the owner's own password change for 15 minutes but nothing else, and the administrator can still reset it.
- Reproduced before the fix (RUNTIME, snapshot): after 5 wrong guesses the right password was still accepted and no 429 existed.
- Tests: 4 wrong guesses with two different tokens are 401; the fifth is 401; then the right password is 429 with `Retry-After` between 1 and 900 seconds; the password is unchanged; the edit-form route is blocked by the same count; the blocked person can still use the system, sign in, sign out and edit other details; another account is unaffected; an administrator can reset the blocked person and afterwards the person can change their password again; repeated administrator resets are never throttled; five wrong guesses split between both routes block both.
- Limits and open points: the counters live in this server process (a restart or another server instance starts a fresh count). This matches the existing login lockout and is the part moved to a shared store in AUTH-004 (phase 2). The 15 minute expiry itself is not covered by a test (it would need a 15 minute wait or a changeable setting; the logic is in `currentPwBlockedFor`) and is UNVERIFIED at runtime.

## 5. Database changes
None. No migration was added.

## 6. Test results

| Check | Result |
|---|---|
| `docs/auth-fixes/api-test-auth-phase1.mjs` on the fixed code | 68 passed, 0 failed |
| The same script on the pre-fix snapshot | 33 passed, 35 failed (diagnostics open, template text returned, own-password change without current, no 429) |
| All repo API scripts (46) | all pass. The first full run had failures caused by the test server's own request limiter (the repo's CI raises it with `API_RATE_MAX`; I restarted the server with that setting) and one leftover project name from an aborted run in the disposable database; after those two test-environment fixes all 46 scripts passed, including `api-test-security.mjs` 156 and the Set Master scripts |
| Playwright full run (all specs) | 241 passed, 1 failed (`crm.spec.ts` Leads filter screen showed an undefined/NaN text); that spec passed 18 of 18 when run alone, so it is order or data dependent and not related to these changes |
| Playwright `flows.spec.ts` + `set-master-fixes.spec.ts` + `auth-phase1.spec.ts` | 32 passed, run twice after the last code change. One earlier run failed once on the already known timing race in the Set Master "applicant list" step (the duplicate toast); it did not repeat |
| `tsc --noEmit` | no errors |
| `git diff --check HEAD` | clean |
| Lint | UNVERIFIED: no ESLint configuration in the repo |
| Full Git diff inspected | yes; the users route and form diff was read line by line, the diagnostics change in `index.ts` was checked in place |

## 7. Files changed in this phase
- `packages/api/src/index.ts`: diagnostics behind rate limit, login and super_admin; no template text; generic error.
- `packages/api/src/routes/users.ts`: `verifyOwnPassword`, throttle, change-password and edit-route use, counter cleared on a new password.
- `packages/web/public/js/pages/users.js`: current password box on your own login and sending it.
- New `docs/auth-fixes/api-test-auth-phase1.mjs` (68 checks, picked up by CI by its name).
- New `e2e/auth-phase1.spec.ts` (3 browser tests).
- `docs/architecture/ROF_CRM_MASTER_FLOW.md`: corrected security flow (sections 1.3, 1.4, 1.5) and a finding status table (1.9).
- New `AUTH_FIX_PHASE_1_REPORT.md`.
`docs/DEFERRED_TASKS.md` DT-008 still lists the diagnostics as a to-do; it was not edited (it is now done and the owner may close it).

## 8. Remaining issues and decisions
- Phase 2 and later, not started: AUTH-003 to AUTH-007 and AUTH-009 to AUTH-017.
- Decision: keep the two admin diagnostics or delete them; whether the edit-form wrong-current status (403) should also become the status for change-password (it stays 401 for compatibility).
- The current-password counters are per server process until AUTH-004.

## 9. Safety confirmation
- Existing user data preserved; no existing database used, reset or overwritten; disposable databases dropped.
- Production, Neon and Vercel untouched; no deployment; no commit, push or merge.
- Existing uncommitted changes (Set Master fixes and reports) preserved; the repo upload folder has no new files from these tests.
- Stopped after phase 1; waiting for independent review.
