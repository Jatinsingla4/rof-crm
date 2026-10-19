# CI / CD pipeline

File: `.github/workflows/ci.yml`. Runs on every push to `main` and on every pull request. The `deploy` job runs only on `main`, only after `verify` has passed.

## What `verify` checks, in order

Every step stops the pipeline when it fails and says what is wrong. Failures show up as red error lines on the run page (Annotations) and in the job summary.

| Step | Fails when | What you see |
|---|---|---|
| No database URLs or keys in the repository | a Neon connection string or `npg_…` password is committed | error naming the problem; also rotate the password |
| Install | `npm install` fails | npm log |
| Build | `tsc` finds a type error | file, line and message from `tsc` |
| Committed `dist` matches the source | `packages/api/dist` differs from a fresh build | error with the files that differ and the fix: run `npm run build` in `packages/api` and commit `dist` |
| Frontend files have valid syntax | any `packages/web/public/**/*.js` has a syntax error | one error per file with the file name and message |
| Fresh test database from the baseline | the baseline schema or seed cannot be loaded | the psql error |
| Migrations after the baseline (096 onward), twice | a new migration fails, or is not safe to run a second time | error with the migration file name and the psql message |
| Start the API | the built server does not answer `/api/health` in 60 s | the server log |
| API tests | any check fails | one error per failed check, named (for example `api-test-fixes.mjs: project: same name other case -> 409`). All four scripts always run, so one run shows every failure. A script that crashes is reported with its last lines |
| Dependency audit | never blocks; lists known high-severity packages for information | npm audit output |

The API tests are the four scripts in `docs/set-master-setup` and `docs/set-projects-setup`: 134 + 19 + 81 + 47 checks on a database built from the baseline with six role users (see `packages/api/scripts/make-test-db.sh`).

## What `deploy` does

1. Calls the Render deploy hook (repository secret `RENDER_DEPLOY_HOOK`).
2. Waits up to about 12 minutes for `<APP_URL>/api/health` to answer `ok` (repository variable `APP_URL`).

Without the secret the job only prints a notice and does nothing.

## One-time setup in the GitHub and Render dashboards

1. Render: Settings, Deploy hook. Copy the URL.
2. GitHub: Settings, Secrets and variables, Actions. Add the secret `RENDER_DEPLOY_HOOK` with that URL, and the variable `APP_URL` with the site address (for example `https://rof-crm.onrender.com`).
3. Render: turn Auto-Deploy off (or set it to "After CI checks pass"). Otherwise Render deploys on every push before the checks have finished.
4. GitHub: Settings, Branches, add a rule for `main` that requires the `verify` check, so a red run cannot be merged.

## Running the same checks on your machine

Start a Postgres, then (from the repository root):

```bash
export PGHOST=localhost PGPORT=5432 PGUSER=postgres PGPASSWORD=postgres PGDATABASE=rof_ci PSQL=psql
export DB_HOST=localhost DB_PORT=5432 DB_NAME=rof_ci DB_USER=postgres DB_PASSWORD=postgres JWT_SECRET=local NODE_ENV=development PORT=3002
(cd packages/api && npm run build && scripts/make-test-db.sh rof_ci && node dist/index.js &)
.github/scripts/run-api-tests.sh docs/set-master-setup/api-test-setup.mjs docs/set-master-setup/api-test-deep.mjs docs/set-projects-setup/api-test-project-setup.mjs docs/set-projects-setup/api-test-fixes.mjs
```

## Known limits

- The full `npm run db:migrate` cannot rebuild a database from the baseline: migration 040 needs the `seed_flags` table, which the migrations never create (production already has it). So the pipeline runs only the migrations after the baseline (096 onward). New migrations are picked up automatically by their number.
- `typescript` and the other dependencies are not pinned and there is no valid lock file, so a new TypeScript release could change the built `dist` and make the dist check fail. The fix is the build command above.
- The pipeline tests the API and syntax; it does not open the web pages in a browser.
