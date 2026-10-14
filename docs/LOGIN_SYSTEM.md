# ROF CRM: Login and Authentication System

Verified end to end on a local run (2026-10-14). This document describes how sign-in works from the browser to the database and back, what was tested, what was found, and what to do about it.

Scope: login page, login API, JWT handling, session guard, logout, role checks, and the permission bootstrap that runs right after login.

---

## 1. Summary

The first audit (2026-10-14) found 9 issues. All 9 were then addressed in code and re-tested on a local run. Two items are only partly removable by design and are listed as residual risks in section 8.

| Area | Result |
|---|---|
| Sign in with valid credentials | Works. Redirects to the dashboard, shows the user name, role resolves to `super_admin`. |
| Wrong password, unknown user | Works. Same message for both, so emails cannot be enumerated. |
| Input validation, SQL injection | Works. 400 for bad input, queries are parameterised. |
| Expired, tampered, `alg:none`, wrong-secret tokens | Rejected with 401. |
| Deactivated user with an old token | Rejected (was a gap, fixed, F1). |
| Logout | Works, and now also invalidates the token on the server (F9). |
| Non-admin roles after login | Permission bootstrap works (was 403, fixed, F3). |
| Mid-session token expiry or revocation | App returns to the login page (fixed, F4). |

---

## 2. Components

| Layer | File | Responsibility |
|---|---|---|
| Login page | `packages/web/public/pages/login.html` | Form, error display, calls the API, stores the token, redirects. |
| Shared constants | `packages/web/public/js/constants.js` | `ROF.API_BASE = '/api'`, `ROF.TOKEN_KEY = 'rof-jwt'`, `ROF.THEME_KEY = 'rof-theme'`. |
| Session helper | `packages/web/public/js/auth.js` | `getToken`, `isAuthenticated` (checks `exp` only), `getUser` (decodes payload), `logout`, `requireAuth`. |
| API client | `packages/web/public/js/api-client.js` | Adds `Authorization: Bearer <token>` to every call. On HTTP 401 it logs out. |
| Permission bootstrap | `packages/web/public/js/permissions.js` | After login, calls `GET /api/users/me` and `GET /api/roles/:role/pages`. |
| App shell and guard | `packages/web/public/js/app.js` | On every page load: redirects to login if there is no valid token, then loads permissions. |
| Login endpoint | `packages/api/src/index.ts` (`POST /api/auth/login`, about line 282) | Looks up the user, verifies the password, signs the JWT. |
| Token check | `packages/api/src/index.ts` (`authenticateToken`, about line 173) | Verifies the JWT on every protected route. |
| Role check | `packages/api/src/index.ts` (`rbac`) and `packages/api/src/middleware/rbac.ts` | Maps HTTP method to action and checks the role table. |
| Current user | `packages/api/src/routes/users.ts` (`GET /me`, about line 570) | Returns user plus maker/checker process permissions. |
| Rate limit | `packages/api/src/index.ts` (`authLimiter`, line 83) | Limits login attempts. |

Database tables used: `users` (credentials and role), `user_process_permissions` and `user_company_access` (read by `/users/me`), `nav_pages` and related role-page tables (read by `/roles/:role/pages`).

`users` columns relevant to login: `id`, `email` (unique), `name`, `role`, `password_hash`, `is_active`, `status`, `last_login_at`.

---

## 3. End-to-end flow

### 3.1 Sign in

```
Browser                         API (Express)                    PostgreSQL
  |                                  |                                |
  | GET /pages/login.html            |                                |
  |--------------------------------->| static file                    |
  | (script: if rof-jwt exists and   |                                |
  |  exp is in the future -> '/')    |                                |
  |                                  |                                |
  | POST /api/auth/login             |                                |
  | {email, password}                |                                |
  |--------------------------------->| authLimiter (rate limit)       |
  |                                  | validate: both present, strings|
  |                                  | SELECT ... FROM users          |
  |                                  |  WHERE email = lower(trim(e))->|
  |                                  |<-------------------------------|
  |                                  | no row or is_active=false      |
  |                                  |   -> 401 (generic message)     |
  |                                  | password_hash starts with $2?  |
  |                                  |   yes: bcrypt.compare          |
  |                                  |   no : legacy compare, then    |
  |                                  |        re-hash with bcrypt (12)|
  |                                  | no hash at all: allowed only   |
  |                                  |   when NODE_ENV != production  |
  |                                  | jwt.sign({userId,email,name,   |
  |                                  |   role}, JWT_SECRET, 8h)       |
  |<---------------------------------| 200 {success, token, data}     |
  | localStorage['rof-jwt'] = token  |                                |
  | location = '/'                   |                                |
```

Response on success:

```json
{ "success": true,
  "token": "<jwt>",
  "data": { "id": "...", "name": "...", "email": "...", "role": "super_admin" } }
```

Error responses: `400` (missing or non-string input), `401` (`Invalid email or password`), `429` (rate limit), `500` (`Internal server error`).

### 3.2 First page load after sign in

```
index.html loads scripts -> app.js DOMContentLoaded:
  1. apply saved theme
  2. guard: no token, or exp passed, or token not parseable -> /pages/login.html
  3. Permissions.load()        -> GET /api/users/me
  4. Permissions.loadPageAccess() -> GET /api/roles/<role>/pages   (skipped for super_admin)
  5. topbar: "Welcome, <name>" from the decoded JWT
  6. register routes, render #/dashboard
```

### 3.3 Every later API call

```
api-client.js adds:  Authorization: Bearer <jwt>
API: authenticateToken
       no token                      -> 401
       jwt.verify fails (any reason) -> 401
       user missing, inactive, or token_version differs -> 401
       database lookup error -> 503
       ok -> sets req.userId, userName, userRole (role taken from the database)
     rbac(resource): method -> action (GET view, POST create, PATCH/PUT edit, DELETE delete)
       role not in table             -> 403
       action not allowed for role   -> 403
     route handler
```

The token is also accepted as `?token=` in the URL, for GET requests only. This exists for print and letter pages opened with `window.open`.

### 3.4 Logout

`Auth.logout()` clears `Permissions`, calls `POST /api/auth/logout` (which increases `users.token_version`, so every token issued so far stops working), removes `rof-jwt` from `localStorage`, and navigates to `/pages/login.html`.

### 3.5 Token contents

Header `HS256`. Payload: `userId`, `email`, `name`, `role`, `tv` (token version), `iat`, `exp` (8 hours after issue). On each request the server checks `tv` against `users.token_version` and uses the role from the database, not the one in the token.

---

## 4. Roles and access

Defined in `packages/api/src/middleware/rbac.ts`: `super_admin`, `project_manager`, `sales_executive`, `accounts_finance`, `support_agent`, `read_only_viewer`. Each maps resources (`consumers`, `units`, `allocations`, `payments`, `documents`, `communications`, `reports`, `users`, ...) to the allowed actions.

Two further layers exist on top of the role table: maker/checker/approver process permissions (`user_process_permissions`) and per-role page access (role-page tables). Both are loaded by the browser after login.

---

## 5. What was tested

Environment: local API on `localhost:3001`, local PostgreSQL 18, database `rof_crm`. All data changes were on the local database only, and temporary test users were deleted afterwards.

### 5.1 Browser (real UI)

| # | Step | Expected | Result |
|---|---|---|---|
| 1 | Open login page with no token | Form shown | Pass |
| 2 | Submit wrong password | Inline error, button re-enabled, stays on page | Pass |
| 3 | Submit correct credentials | Redirect to `/#/dashboard`, `Welcome, Jatin Singla`, role `super_admin` | Pass |
| 4 | After login, check `/api/users/me` and dashboard calls | All 200 | Pass |
| 5 | Logout | Token removed, lands on login page | Pass |
| 6 | Open `/` with a garbage token in storage | Redirected to login | Pass |

### 5.2 API, first audit (before the fixes)

Results in this table are from the original code. The rows marked Fail were fixed; see 5.3 for the re-test.

| # | Case | Expected | Result |
|---|---|---|---|
| 1 | Valid credentials | 200 plus token | Pass |
| 2 | Email in upper case with trailing space | 200 | Pass |
| 3 | Wrong password | 401 | Pass |
| 4 | Unknown email | 401, identical body to case 3 | Pass |
| 5 | Empty body | 400 | Pass |
| 6 | Array and object instead of strings | 400 | Pass |
| 7 | `' OR 1=1 --` as email | 401 | Pass |
| 8 | Protected route, no token | 401 | Pass |
| 9 | Valid token in header, and in `?token=` | 200 | Pass |
| 10 | Expired token | 403 | Pass |
| 11 | `alg:none` forged token | 403 | Pass |
| 12 | Token signed with the literal `secret` | 403 (the local `.env` has a real secret) | Pass |
| 13 | User with `is_active=false` tries to log in | 401 | Pass |
| 14 | Same user, token issued before deactivation | Expected 401/403, **got 200** | **Fail (F1)** |
| 15 | Legacy base64 hash user logs in | 200, hash becomes `$2a$...` | Pass |
| 16 | User with no `password_hash`, any password, non-production | Rejected | **Fail, accepted (F5)** |
| 17 | `mock-jwt-token`, non-production | Rejected | **Fail, accepted (F5)** |
| 18 | `sales_executive` calls `GET /api/users/me` | 200 | **Fail, 403 (F3)** |

---

### 5.3 Re-test after the fixes

Same environment. Every row below was run after the changes in section 9.

| # | Case | Expected | Result |
|---|---|---|---|
| 1 | Valid login, then `/api/users/me` | 200 | Pass |
| 2 | No token, expired token, `alg:none` token | 401 each | Pass |
| 3 | `mock-jwt-token` without `ALLOW_DEV_AUTH` | 401 | Pass |
| 4 | `?token=` on a GET, and on a POST | 200 for GET, 401 for POST | Pass |
| 5 | User set to `is_active=false`, old token used after the 15 second cache window | 401 | Pass |
| 6 | `sales_executive` calls `/api/users/me` | 200 | Pass |
| 7 | `sales_executive` calls `/api/users` | 403 (still blocked) | Pass |
| 8 | Role changed in the database, same token used after the cache window | New role applies | Pass |
| 9 | `POST /api/auth/logout`, then the same token | 401 | Pass |
| 10 | Fresh login after logout | 200 | Pass |
| 11 | User with no password hash, any password | 401 | Pass |
| 12 | 5 wrong passwords, then the correct one | 429 for the locked IP and email pair | Pass |
| 13 | A different email from the same IP | Not locked (401 for a wrong password) | Pass |
| 14 | Server started with an empty `JWT_SECRET` | Process exits with an error | Pass |
| 15 | Browser: stale token in storage, open login page | Token cleared, form shown, no redirect loop | Pass |
| 16 | Browser: login, dashboard loads, name and role correct | Works | Pass |
| 17 | Browser: token revoked elsewhere, then any API call | Redirected to the login page, token removed | Pass |
| 18 | `tsc --noEmit` on the API | No errors | Pass |

---

## 6. Local environment notes

These are specific to running the project on a developer machine.

1. `packages/api/.env` was created from `.env.example`. It points to local PostgreSQL (`rof_crm`), with `JWT_SECRET` and `HASH_SECRET` set to random values. `DATABASE_URL` is not set, so nothing connects to Neon.
2. `npm` under Node 20.20.2 was broken because `npm/lib/cli.js` was a 0 byte file. It was restored. Use `pnpm dev` in `packages/api` to start the server.
3. The local database had no tables created by migrations 058 onward, so `/api/users/me` returned 500 after login and the UI had no role. Migrations 053 to 094 were then applied file by file (a backup of the earlier state is in the session scratchpad). Login related tables now exist.
4. The migration chain cannot rebuild a database from scratch. Tables `companies`, `company_bank_accounts`, `document_field_overrides`, `nav_pages` and the column `consumers.main_broker_id` are used by the code but no migration in the repository creates them (they were created outside the migration files, as `CLAUDE.md` already warns). Migrations 052, 061 to 065, 078, 091, 093 and 094 fail locally because of that. This does not affect sign in, but pages that use those tables return 500 locally (for example `GET /api/consumers` and `GET /api/roles/:role/pages` for non-admin roles).
5. A local super_admin was added for testing: `jatin.singla@grapesworldwide.com`. The password was shared in chat only. It exists only in the local database.

---

## 7. Design strengths

- Passwords are hashed with bcrypt (12 rounds). Legacy hashes upgrade silently at next login.
- Generic failure message, so account existence is not leaked.
- Parameterised SQL. Email is normalised (trim, lower case).
- JWT verification rejects expired, tampered and `alg:none` tokens.
- Deactivated users cannot start a new session, and (after the fixes) existing sessions end within seconds.
- 8 hour token lifetime and bcrypt cost are reasonable defaults.
- Security headers via `helmet`.

---

## 8. Findings and status

| ID | Severity | Issue | Status |
|---|---|---|---|
| F1 | High | Deactivated users kept access until the token expired | Fixed |
| F2 | High | Fallback signing secret `'secret'` in code | Fixed |
| F3 | High | Non-admin roles got 403 on `/api/users/me` | Fixed |
| F4 | Medium | Expired or invalid token did not return the user to login | Fixed |
| F5 | Medium | Mock token and passwordless login open whenever `NODE_ENV` is not production | Fixed |
| F6 | Medium | Token in `localStorage` and in the URL | Partly fixed, residual risk |
| F7 | Low | Role frozen inside the token | Fixed |
| F8 | Low | Rate limit behind a proxy, no per account lockout | Fixed in code, needs a check on Render |
| F9 | Low | No server side logout or revocation | Fixed, with one side effect |

### What changed, per finding

**F1 and F7.** `authenticateToken` now reads `is_active`, `role` and `token_version` from `users` for each request (cached for 15 seconds per user). An inactive or deleted user gets 401. The role used for permission checks is the current database role, not the one in the token. A token whose `tv` claim differs from `users.token_version` is rejected.

**F2.** `index.ts` stops at startup with `JWT_SECRET is not set. Refusing to start.` if the variable is empty. Tokens are signed and verified with HS256 only.

**F3.** `rbac()` lets `GET /api/users/me` through for any signed-in user. All other `/api/users` routes keep their role checks (tested: `sales_executive` still gets 403 on `/api/users`).

**F4.** An invalid or expired token now returns 401 instead of 403, so the existing client rule (401 means sign out) applies. `api-client.js` also handles 401 on file uploads, `permissions.js` signs out on 401, and the login page only skips the form when `/api/users/me` accepts the stored token (a rejected token is removed).

**F5.** The mock token and passwordless login need `NODE_ENV` other than production and `ALLOW_DEV_AUTH=true`. The variable is documented in `.env.example` and is not set anywhere by default.

**F6.** The `?token=` URL form is now accepted for GET requests only (the letter and receipt pages use GET). The token is still stored in `localStorage`, and the URL form still exists. Removing both needs a cookie based session and short lived print links, which is a larger change across about 20 page scripts and was not done.

**F8.** `trust proxy` is set to 1 outside development, so rate limits see the client address. A lockout of 5 failed attempts for 15 minutes was added per IP and email pair (in memory). The hop count of 1 is an assumption about Render and must be confirmed in a Render log or with a test, because it cannot be tested locally.

**F9.** `POST /api/auth/logout` increases `users.token_version` (new column, migration `095_add_users_token_version.sql`). Changing a password through the user update route also increases it. The client calls the endpoint on logout.

### Residual risks and side effects

1. **Deploy risk (F2).** If `JWT_SECRET` is not set in the Render dashboard, the service will no longer start. `render.yaml` marks it `sync:false`, so confirm it exists before deploying.
2. **Migration order (F1, F9).** The auth check reads `users.token_version`. Migration 095 must run before the new code serves traffic. Render runs `db:migrate` in the build step, so the order is right, but a failed migration would make every request return 503.
3. **One logout signs out every device (F9).** The version counter is per user, not per device.
4. **Up to 15 seconds of delay.** Deactivation and role changes apply after the cache expires. Logout and password change clear the cache on the instance that handled the request only. With more than one API instance, the others take up to 15 seconds too.
5. **Lockout state is in memory.** It resets on restart and is not shared between instances.
6. **F6 residual.** An XSS bug anywhere in the app could still read the token.
7. **Page access fallback.** `canAccessPage` still allows a page when the page access list fails to load. Locally that list fails for non-admin roles because the `nav_pages` table is missing (see section 6), so local tests of non-admin menus are not representative.
8. **Compiled output.** `packages/api/dist/` was rebuilt with `npx tsc` and `node copy-files.js` (no errors). Only `dist/index.js`, `dist/routes/users.js`, their source maps and the new `dist/db/migrations/095_add_users_token_version.sql` changed. Nothing is committed yet.

---

## 9. Files changed

| File | Change |
|---|---|
| `packages/api/src/index.ts` | Secret guard, dev opt-in, trust proxy, async token check with database lookup, 401 for bad tokens, GET only query token, `/users/me` exemption, lockout, logout endpoint |
| `packages/api/src/routes/users.ts` | One line: password change bumps `token_version` |
| `packages/api/src/db/migrations/095_add_users_token_version.sql` | New column `users.token_version` |
| `packages/api/.env.example` | Documents `ALLOW_DEV_AUTH` |
| `packages/api/dist/` | Rebuilt output of the two changed source files, plus migration 095 |
| `packages/web/public/js/auth.js` | Logout calls the server endpoint |
| `packages/web/public/js/api-client.js` | 401 handling on uploads |
| `packages/web/public/js/permissions.js` | Sign out on 401 |
| `packages/web/public/pages/login.html` | Redesigned page, token validated before redirect |

---

## 10. How to re-verify locally

```bash
cd packages/api
pnpm dev                      # serves API and frontend on http://localhost:3001
curl -s localhost:3001/api/health
curl -s -X POST localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"<user>","password":"<password>"}'
```

Then open `http://localhost:3001`, sign in, confirm the dashboard loads, and sign out. The test matrix in section 5 can be repeated with `curl` using the cases listed.

---

*Prepared for ROF Group by Grapes Worldwide. Based on code at the working tree of 2026-10-14 and a local run. Production (Render and Neon) was not touched or tested.*
