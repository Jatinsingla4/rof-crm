# CI / CD pipeline

Hosting is Vercel (project `rof-crm`, `https://rof-crm-ten.vercel.app`) with a Neon database. Render is no longer used.

Files: `.github/workflows/ci.yml` (runs on every push to `main` and every pull request) and `.github/workflows/migrate.yml` (run by hand).

## `verify` job (every push and pull request)

Every step stops the pipeline when it fails and says what is wrong. Failures appear as red error lines on the run page (Annotations) and in the job summary.

| Step | Fails when | What you see |
|---|---|---|
| No database URLs or keys in the repository | a Neon connection string or `npg_…` password is committed | error naming the problem; also rotate the password |
| Install | `npm install` fails | npm log |
| Build | `tsc` finds a type error | file, line and message from `tsc` |
| Committed `dist` matches the source | `packages/api/dist` differs from a fresh build | the files that differ and the fix: run `npm run build` in `packages/api` and commit `dist` |
| Frontend files have valid syntax | any `packages/web/public/**/*.js` has a syntax error | one error per file with the file name and message |
| Fresh test database from the baseline | the baseline schema or seed cannot be loaded | the psql error |
| Migrations after the baseline (096 onward), twice | a new migration fails, or is not safe to run a second time | the migration file name and the psql message |
| Start the API | the built server does not answer `/api/health` within 60 s | the server log |
| API flow tests | any check fails | one error per failed check, by name. All scripts always run, so one run shows every failure. A script that crashes is reported with its last lines |
| Browser flow tests (Playwright, real Chromium) | a flow breaks in the browser: a button, message or screen is missing or wrong, a JavaScript error appears, or the server answers 5xx | the failed test name, the line and the expected/received text as an annotation; screenshots and a trace are uploaded as the `browser-test-failures` artifact |
| Dependency audit | never blocks; lists known high-severity packages | npm audit output |

### Flow coverage

Only modules that have been checked one by one are covered. When a module is checked, add its flow script to the list in `ci.yml`.

| Module | Script | Checks |
|---|---|---|
| Menu, Set Up, Project Set Up, roles, Security (in the browser) | `e2e/flows.spec.ts` | 14 flows: the 4-group Set Master menu and its 22 entries, applicant lists, banks, locations, company with bank account and logo, project to unit and CSV upload, read-only and project-manager screens, and Security (new login, sign in, edit and disable, custom role, role menu access grid, audit log) |
| Set Master: Set Up (lists, locations, banks, companies, bank accounts, logo) | `docs/set-master-setup/api-test-setup.mjs`, `api-test-deep.mjs` | 134 + 19 |
| Set Projects: Project Set Up (project, towers, units, unit types, locations, reminders) and the fixes made on 2026-10-19 | `docs/set-projects-setup/api-test-project-setup.mjs`, `api-test-fixes.mjs` | 81 + 47 |
| Security: roles, role menu access, logins, process rights, IP allow list, sessions, audit log | `docs/security-setup/api-test-security.mjs`, `api-test-scope.mjs` (project scope) | 155 + 34 |

## `live` job (after a push to `main`, once `verify` has passed)

1. Warns when the push adds database migrations (Vercel does not run them; see below).
2. If the secret `VERCEL_DEPLOY_HOOK` exists, calls it to request a deploy. Without it, Vercel's own Git deploy is expected.
3. Waits up to 15 minutes until `<site>/api/health` reports this commit (`commit` is the first 7 characters of `VERCEL_GIT_COMMIT_SHA`).
4. Read-only checks on the real site: health, app page, login page, a script file, a request without login is refused (401), a wrong password is refused (401).

The site address comes from the repository variable `APP_URL` and defaults to `https://rof-crm-ten.vercel.app`.

## Migrations on Vercel

Vercel only builds the code (`vercel.json`), so a new file in `packages/api/src/db/migrations` does not reach the live database by itself. Apply it with the **Run migrations** workflow (Actions tab, Run workflow, type `yes`). It runs every migration from the given number upward (default 96) against the secret `DATABASE_URL`; those files are safe to run again. Migration 098 repairs the live `booking_records.invoice_date_by` column (see below).

## One-time setup

1. GitHub, Settings, Secrets and variables, Actions: add the secret `DATABASE_URL` (the direct Neon connection string of the live database) for the migration workflow. The workflow uses the `production` environment, so you can also require an approval there.
2. Optional, to make CI a real gate: in Vercel, Settings, Git, turn off automatic deploys for `main`, create a Deploy Hook, and store its URL as the secret `VERCEL_DEPLOY_HOOK`. Then Vercel deploys only after `verify` has passed.
3. GitHub, Settings, Branches: add a rule for `main` that requires the `verify` check.
4. Delete the old Render service in the Render dashboard (the repository no longer has `render.yaml`).

## Running the browser flow tests on your machine

With the app running (see below) and its test database:

```bash
cd e2e && npm install && npx playwright install chromium
BASE_URL=http://localhost:3002 npx playwright test                 # headless
BASE_URL=http://localhost:3002 SLOWMO=400 npx playwright test --headed   # watch it run
```

## Running the same checks on your machine

Start a Postgres, then from the repository root:

```bash
export PGHOST=localhost PGPORT=5432 PGUSER=postgres PGPASSWORD=postgres PGDATABASE=rof_ci PSQL=psql
export DB_HOST=localhost DB_PORT=5432 DB_NAME=rof_ci DB_USER=postgres DB_PASSWORD=postgres JWT_SECRET=local NODE_ENV=development PORT=3002
(cd packages/api && npm run build && scripts/make-test-db.sh rof_ci && node dist/index.js &)
.github/scripts/run-api-tests.sh docs/set-master-setup/api-test-setup.mjs docs/set-master-setup/api-test-deep.mjs docs/set-projects-setup/api-test-project-setup.mjs docs/set-projects-setup/api-test-fixes.mjs docs/security-setup/api-test-security.mjs docs/security-setup/api-test-scope.mjs
```

## Known limits

- The full `npm run db:migrate` cannot rebuild a database from the baseline: migration 040 needs the `seed_flags` table, which the migrations never create (the live database already has it). So the pipeline runs only the migrations after the baseline (096 onward).
- `typescript` and the other dependencies are not pinned and there is no valid lock file, so a new TypeScript release could change the built `dist` and make the dist check fail. The fix is the build command above.
- The browser tests cover the verified modules only; the live site is checked with plain HTTP requests, not in a browser.
- Vercel publishes a commit from Git on its own, usually before `verify` has finished, so CI is a check, not a gate, until automatic deploys are turned off and the deploy hook is used (see One-time setup).
- Found while building the flow tests: the reconstructed baseline made `booking_records.invoice_date_by` a `uuid`, but the code saves a word there, so saving any booking failed with "invalid input syntax for type uuid". The baseline is fixed and migration 098 repairs a database that was built from the old baseline. Run it on the live database.
