# ROF CRM: Completed Tasks

What has been done, in the order it happened. Pending work is in `DEFERRED_TASKS.md`. The module plan is in `MODULE_VERIFICATION_PLAN.md`.

Status words: **Pushed** (on GitHub `main`, commit `1e08e7c` or earlier), **Local only** (in the working tree, not committed), **Live** (deployed on Vercel), **Not deployed** (code exists, the Vercel site does not have it yet).

Last updated: 2026-10-16. Commit `8a71cdc` pushed and deployed to Vercel.

---

## 1. Environment and local run

| # | Task | Result | Status |
|---|---|---|---|
| 1 | Run the CRM locally | Local PostgreSQL 18 `rof_crm`, `.env` created, API and frontend on `http://localhost:3001`. Start with `pnpm dev` in `packages/api`. | Done (local setup, not in git) |
| 2 | Fix `npm` under Node 20.20.2 | `lib/cli.js` was a 0 byte file; restored twice (it was emptied again during the malware cleanup). | Done on this machine |
| 3 | Create a local super_admin for testing | `jatin.singla@grapesworldwide.com`, local database only. | Done (local data) |

## 2. Login and session

| # | Task | Result | Status |
|---|---|---|---|
| 4 | Redesign the login page | Split layout, no emojis, no em dashes, plain copy, token validated before redirect. `packages/web/public/pages/login.html`. | Pushed |
| 5 | Full login audit | Flow documented end to end, 18 case API test plus browser test. `docs/LOGIN_SYSTEM.md`. | Pushed (updated since, see 12) |
| 6 | Fix F1, F7: deactivated users and stale roles | Auth check reads `is_active`, role and `token_version` from the database (15 second cache). | Pushed |
| 7 | Fix F2: fallback secret | Server refuses to start without `JWT_SECRET`; HS256 only. | Pushed |
| 8 | Fix F3: non-admin roles could not load their profile | `GET /api/users/me` allowed for every signed-in role. | Pushed |
| 9 | Fix F4: expired or revoked token left the user on a broken page | Bad tokens return 401, the app returns to the login page, the login page clears a rejected token. | Pushed |
| 10 | Fix F5: dev shortcuts | Mock token and passwordless login need `ALLOW_DEV_AUTH=true`. | Pushed |
| 11 | Fix F6 partly: `?token=` in URLs | Accepted for GET only. (The cookie move is pending, DT-002.) | Pushed |
| 12 | Fix F8, F9: lockout and logout | `trust proxy`, 5 failures per IP and email lock for 15 minutes, `POST /api/auth/logout` revokes tokens (`users.token_version`, migration 095). Password change through the user update route also revokes. | Pushed |
| 13 | Edge case round | Timing difference between known and unknown emails removed, NUL byte and bad JSON no longer return 500, `Cache-Control: no-store` on auth routes, passwords over 72 bytes refused when set. | Pushed, Live |
| 14 | End to end password test | 33 of 33 checks pass across create user, employee login, employee login update, change password and regression. | Pushed, Live |
| 15 | Fix: non-admin could not change their own password | `POST /api/users/:id/change-password` allowed for the user's own id. | Pushed, Live |
| 16 | Fix: sessions survived a `change-password` call | `token_version` increased and cache cleared. | Pushed, Live |

## 3. Security incident (malware in the repository)

| # | Task | Result | Status |
|---|---|---|---|
| 17 | Found injected `eval(atob(...))` code | Present on `origin/main` in `src/index.ts`, `src/scripts/seed-demo-data.ts`, `dist/index.js`, `dist/db/migrations.js` (commit `1db61f2`), and in two config files cleaned by `7ed7536`. | Found |
| 18 | Stopped the dev server and rolled back a local merge that had pulled the code in | Local tree verified clean (no `atob(`, no line over 1500 characters). | Done |
| 19 | Merged `origin/main` keeping the clean versions and pushed | `main` is at `1e08e7c`; sweep of the merged tree is clean. | Pushed |
| 20 | Host check | No suspicious process, LaunchAgent, cron entry or shell profile change was found. This does not prove the code did not run. | Done |

Done by the owner (reported in chat, not verified from here): secret rotation, malware scan, cleanup commits `34d5c03` and `b3e1c22`.

## 4. Hosting move: Render to Vercel

| # | Task | Result | Status |
|---|---|---|---|
| 21 | Vercel project | `threezinc/rof-crm`, alias `https://rof-crm-ten.vercel.app`. | Live |
| 22 | Vercel entry and config | `api/index.js` (Express app as handler), `vercel.json` (install with dev dependencies, build with `tsc`, 60 second limit), `app.listen` skipped on Vercel. | Pushed, Live |
| 23 | Environment variables | `NODE_ENV`, `JWT_SECRET` (new random value), `DATABASE_URL` (direct URL of the new Neon project), all as secrets. | Live |
| 24 | Live checks | Health 200, login page 200, unknown user and wrong password return 401, no token returns 401. | Live (re-checked after the 2026-10-16 deploy: NUL byte 401, bad JSON 400, `no-store`, equal timing) |

## 5. Database

| # | Task | Result | Status |
|---|---|---|---|
| 25 | New Neon project `ROF` (Singapore, free plan) | Created by the owner. | Done |
| 26 | Reconstructed baseline schema | 123 tables, 1693 columns, restores into an empty database with no errors. Built from the 3 May 2026 `pg_dump` in git history (data discarded), the migrations, and columns and tables derived from the code. `packages/api/src/db/baseline/` with a README. | Pushed |
| 27 | Baseline checked against the code | 176 of 178 parameterless GET endpoints return no 5xx. | Done |
| 28 | Baseline restored into the new Neon database | 123 tables, 6 system roles, one super_admin. | Done (live database) |
| 29 | Found two pooler problems | A pooled connection kept an empty `search_path` after a dump restore, so the app got `relation "users" does not exist`. Switched Vercel to the direct URL. | Done |

## 6. Documentation

| # | File | Content | Status |
|---|---|---|---|
| 30 | `docs/LOGIN_SYSTEM.md` | Login flow, tests, findings, fixes, edge cases, password test (sections 1 to 12). | Pushed |
| 31 | `docs/PLAN_F6_COOKIE_SESSION.md` | Plan to move the token to an httpOnly cookie. | Pushed |
| 32 | `docs/MODULE_VERIFICATION_PLAN.md` | Module by module method, 18 modules, 10 integration journeys. | Pushed |
| 33 | `docs/modules/TEMPLATE.md` | Template for each module document. | Pushed |
| 34 | `docs/DEFERRED_TASKS.md` | Parallel backlog. | Pushed |
| 35 | `docs/COMPLETED_TASKS.md` | This file. | Pushed |

---

## 7. Where things stand

- **GitHub `main`:** `8a71cdc`. Everything in this file is pushed, except the Vercel deployment itself and the local database setup (item 1 to 3).
- **Live on Vercel:** the build of `8a71cdc` (`https://rof-crm-ten.vercel.app`). Live checks passed: health 200, login page 200, unknown user and wrong password 401, no token 401, NUL byte email 401, malformed JSON 400, `Cache-Control: no-store`, same response time for known and unknown emails.
- **Not done on the live site:** a login with the real admin password (DT-036), browser pass on the login page (DT-037), and the 4 untested roles (DT-038).
- **Not committed:** `packages/api/dist/db/baseline/` (DT-044).
