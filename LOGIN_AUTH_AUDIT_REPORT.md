# Login & Authentication audit report

Date: 2026-11-04. Scope: the 16 areas in the brief. **No application code was changed.** The only files added are this report and `docs/architecture/ROF_CRM_MASTER_FLOW.md`. The Set Master changes and every other working-tree change are untouched (the `git status` list was compared before and after).
Method: source reading of `packages/api/src/index.ts`, `routes/users.ts`, `routes/roles.ts`, `routes/photos.ts`, `middleware/rbac.ts`, `utils/security.ts`, migrations, `pages/login.html`, `js/auth.js`, `js/links.js`, `js/api-client.js`; then runtime tests against a disposable local database `rof_auth_sm` (fresh baseline, migrations 96 to 145, synthetic users) with two API instances built from the working tree: development mode (port 3017) and production mode (`NODE_ENV=production`, port 3019). No production, Neon or Vercel system was touched. No secret, password or token value appears in this report (a throwaway local signing key was used for forgery tests; test passwords are not reproduced).
Labels: **RUNTIME** = reproduced, **SOURCE** = code read only, **UNVERIFIED** = could not be tested safely.

## 1. Result in one table

| ID | Severity | Title |
|---|---|---|
| AUTH-001 | High | Template bodies and diagnostics readable without logging in |
| AUTH-002 | High | A super_admin can set their own new password without the current one |
| AUTH-003 | Medium | Lockout reply reveals which email addresses are real active accounts |
| AUTH-004 | Medium | Brute force protection is in process memory and per IP; it can be bypassed behind a spoofable proxy header |
| AUTH-005 | Medium | The per-IP login limiter counts successful logins, so a shared office address can lock everyone out |
| AUTH-006 | Medium | Applicant photos are served without login |
| AUTH-007 | Medium | The login token lives in localStorage (and in page links before they are swapped) |
| AUTH-008 | Medium | The current password check on change-password has no throttle |
| AUTH-009 | Medium | No forgot-password, MFA or OTP, no failed-login or logout audit trail |
| AUTH-010 | Low | Legacy plain text and base64 password hashes are still accepted |
| AUTH-011 | Low | Response time depends on the stored hash cost |
| AUTH-012 | Low | Token checks are lenient (no `exp` required, any header scheme, bad userId gives 503) |
| AUTH-013 | Low | Deactivation, role and project changes can take up to 15 seconds on another server instance |
| AUTH-014 | Low | `users.status`, nullable `is_active`, no unique username |
| AUTH-015 | Low | Development behaviours depend on NODE_ENV being exactly `production` |
| AUTH-016 | Low | JWT secret strength and rotation are not enforced |
| AUTH-017 | Info | Logout (and a password change) signs out every device |

Everything else in the brief behaved correctly; see section 3.

## 2. Findings

### AUTH-001 High. Template bodies and diagnostics readable without logging in
- Files: `packages/api/src/index.ts` line 473 (`GET /api/health/debug`), line 482 (`GET /api/health/templates`), both registered before `authenticateToken` and before `apiLimiter` (line 539).
- Evidence (RUNTIME): with no token, `/api/health/templates` returned 200 and the JSON contained the `body_html` of the stored buyer agreement and conveyance deed templates (a marker string I inserted into a synthetic template row appeared in the response); it also returns `nodeEnv`. `/api/health/debug` returns the migration log text and whether `DATABASE_URL` is set. 40 rapid calls were all 200 (no rate limit). On an error the first endpoint returns `error.message` to the caller (source, line near 523).
- Expected: diagnostics need login (or an admin role) and never return document bodies. Actual: open to the internet.
- Cross-module: Documents module templates (`document_templates`); legal text of the company's agreements is disclosed.
- Fix: remove these routes or put them behind `authenticateToken` and `super_admin`; never return `body_html` or error messages; keep only `/api/health`.

### AUTH-002 High. super_admin can change their own password without the current password
- File: `packages/api/src/routes/users.ts` lines 490 to 495: the current password is demanded only when `req.userId === id && req.userRole !== 'super_admin'`.
- Evidence (RUNTIME): with only a valid super_admin token, `POST /api/users/<own id>/change-password` with a new password returned 200; the new password then logged in and the old one stopped working. A stolen or leaked token (see AUTH-007) therefore becomes a permanent takeover, and the owner is locked out.
- Expected: changing your own password always proves the current one (an admin resetting another user's password is a different, intended path). Actual: skipped for the most powerful role.
- Fix: require `currentPassword` whenever `req.userId === id`, for every role; keep the admin reset for other users, and write it to the audit log (it is already audited).

### AUTH-003 Medium. Lockout reply reveals real accounts
- File: `index.ts` lines 380 to 387 (lockout lookup) and 398 to 427 (failures are counted only when the account exists and is active).
- Evidence (RUNTIME): after 7 wrong passwords the real active account answered 429 "Too many failed attempts"; an unknown email and a deactivated account stayed on 401 "Invalid email or password" for the same 7 attempts. The 429 also blocks the correct password.
- Expected: identical behaviour for every email. Actual: an attacker can list valid active emails.
- Fix: count failures for any submitted email (and keep a global per-IP counter), or return the same lockout reply for unknown emails.

### AUTH-004 Medium. In-memory, per-IP brute force protection
- Files: `index.ts` lines 352 to 354 (`loginFailures` Map), 380 to 387, 95 to 101.
- Evidence: the lockout key is `ip|email` and lives in one process (SOURCE): on serverless hosting each instance has its own map and it is emptied on restart; many source IPs can guess one account without any account level lock. RUNTIME (production-mode server): after the 10 request limit, 15 further bad logins each carrying a different `X-Forwarded-For` value were all answered 401 (no 429), and 8 wrong passwords for a real account with rotating values never locked it. With `trust proxy` set to 1 and the app reachable directly, the client can choose its own `req.ip`.
- UNVERIFIED: on Vercel the platform adds the real client address as the last forwarded entry, so rotation would probably not work there; this could not be tested without the hosting environment.
- Fix: keep lockout counters in the database (or Redis) per account and per IP; keep both limits; confirm the real proxy chain before trusting the header.

### AUTH-005 Medium. Successful logins consume the login limit
- File: `index.ts` lines 95 to 101 (`authLimiter`, no `skipSuccessfulRequests`).
- Evidence (RUNTIME, production mode): after 13 failed attempts from one address the same address got 429 on a correct login. At 10 per 15 minutes per IP, an office behind one public address can lock all staff out with ten logins, and one person can lock the rest.
- Fix: skip successful requests in the limiter, or key it by IP plus email.

### AUTH-006 Medium. Applicant photos by id without login
- Files: `routes/photos.ts` lines 6 to 12, mounted at `index.ts` line 323 without `authenticateToken`.
- Evidence (RUNTIME): a synthetic photo row was returned by `GET /api/photos/consumer/<consumer id>` with no token (200 image/png). The only protection is that the id is a random UUID, but consumer ids are shown in many API responses to every signed-in role and can appear in logs and referrers.
- Cross-module: Consumers, booking, KYC. Decision needed: the comment says this is intentional so `<img>` tags work.
- Fix: serve photos through an authenticated route or short-lived signed addresses (the existing link token mechanism).

### AUTH-007 Medium. Token in localStorage and in page links
- Files: `pages/login.html` line 224, `js/auth.js` lines 4 to 14; about 50 page scripts build `…?token=${Auth.getToken()}` links (for example `pages/allotment.js`, `pages/receipts.js`, `pages/reports.js`); `js/links.js` swaps them for 2 minute link tokens only when opened.
- Evidence: SOURCE for the storage and the links; RUNTIME that the server rejects a login token in a URL (401) and accepts a link token only on its own path, for GET, and not in the header. The 8 hour token is readable by any script that runs on the page, and combined with AUTH-002 gives full takeover. There is no idle timeout and no refresh.
- Fix: move to an HttpOnly, SameSite cookie session (the repo already has a plan document for this), or shorten the lifetime with refresh; stop writing the login token into hrefs.

### AUTH-008 Medium. Current password check on change-password is not throttled
- File: `users.ts` lines 491 to 495.
- Evidence (RUNTIME): 20 consecutive wrong current passwords with a valid token all returned 401, no 429, no lockout. A stolen token can be used to guess the owner's password offline from the network's view.
- Fix: apply the same per-account lockout as login.

### AUTH-009 Medium. No password recovery, no MFA, thin audit trail
- Evidence: no route or table for forgot-password, reset token, OTP, TOTP or any second factor (source search, plus 404 on `/auth/refresh`, `/forgot-password`, `/reset-password`, `/verify-otp`, `/register`; RUNTIME). Recovery is an administrator editing the user. `audit_logs` holds 40 successful login rows (action `login`, with the IP) but nothing for failed logins, lockouts or logouts (RUNTIME: 0 rows for `login_failed` or `logout`); password changes are audited as user updates with `passwordChanged: true` (RUNTIME).
- Business decision: whether MFA is required for super_admin and finance roles; add failed-login and logout audit events either way.

### AUTH-010 Low. Legacy password formats still work
- Files: `index.ts` lines 407 to 421, `users.ts` line 494.
- Evidence (RUNTIME): a user whose stored password was the plain text itself, and another whose stored value was the base64 of the password, could both log in and were then rewritten as bcrypt; a NULL hash could not log in. The comparison is `===` (not constant time) and `change-password` still accepts the base64 form.
- Impact: any database row still holding plain text or base64 is readable by whoever sees the table. Whether such rows exist in the real database is UNVERIFIED.
- Fix: count and force a reset of such rows, then remove the legacy branch.

### AUTH-011 Low. Timing depends on hash cost
- File: `index.ts` lines 351 and 398 to 401 (`DUMMY_HASH` is cost 12).
- Evidence (RUNTIME): with the test accounts' cost 10 hashes a wrong password for a real account took about 118 ms and for an unknown email about 458 ms. New hashes are cost 12 (`users.ts`), so the gap closes only when every stored hash is cost 12; the real database was not inspected (UNVERIFIED).
- Fix: compute the dummy hash at the same cost as the common stored cost, or always run a fixed amount of work.

### AUTH-012 Low. Lenient token checks (need the signing key to exploit)
- File: `index.ts` lines 225, 243 to 256.
- Evidence (RUNTIME, tokens signed with the local test key): a token with no `exp` was accepted; `Basic <jwt>` and `Token <jwt>` headers were accepted (the scheme word is ignored); a validly signed token whose `userId` was not a UUID produced 503 "Authentication service unavailable" and a database error line in the log instead of 401. `iss`, `aud` and `jti` are not used.
- Not vulnerable (RUNTIME): `alg: none`, wrong secret, HS512, tampered signature or payload, expired token, future `nbf`, unknown user, too high `tv`, role claim set to super_admin (ignored; the database role is used).
- Fix: require `exp` (`maxAge`), require `Bearer`, validate the UUID before querying.

### AUTH-013 Low. Cache window of 15 seconds
- File: `index.ts` lines 188 to 215.
- Evidence (RUNTIME): after deactivating a user directly in the database the old token kept working for 15 seconds, then returned 401. Through the Users API on the same instance the effect is immediate (RUNTIME). On several serverless instances the other instances keep the old answer for up to 15 s (SOURCE; UNVERIFIED on the real host).
- Fix: shorten the window for deactivation, or read `token_version` and `is_active` on every request.

### AUTH-014 Low. Schema gaps
- Evidence (RUNTIME and schema): `users.status` (default 'active') is not read by authentication: a user with `status = 'suspended'` and `is_active = true` logged in. `is_active` is nullable and NULL counts as active (`index.ts` line 398, 255). `username` has no unique index (duplicates are only checked in code, `users.ts` lines 311 and 168 to 171, so two simultaneous requests can both pass). Unused legacy columns `role_id`, `project_ids`, `employee_id`. There are unique indexes on `email` and `lower(email)`.
- Fix: one source of truth for account status, NOT NULL on `is_active`, unique index on `lower(username)`.

### AUTH-015 Low. Behaviour depends on NODE_ENV
- File: `index.ts` lines 66 to 76, 97, 125 to 131.
- Evidence (RUNTIME): in development mode any origin is reflected in `Access-Control-Allow-Origin` with `Allow-Credentials: true` (production mode only allowed origins), the login limit is 1000 and `trust proxy` is off (behind a proxy all users would share one rate-limit bucket). If a host forgets `NODE_ENV=production` these dev settings apply. The mock token shortcut stays off without `ALLOW_DEV_AUTH=true` (RUNTIME: `mock-jwt-token` gave 401).
- Fix: treat anything except an explicit `development` as production; log the mode at start.

### AUTH-016 Low. Secret handling
- File: `index.ts` lines 70 to 72: the server refuses to start without `JWT_SECRET` (good) but accepts any value, with no minimum length and no way to rotate (single secret, no `kid`).
- Fix: enforce 32+ random bytes and document rotation; rotating invalidates every session, which is acceptable.

### AUTH-017 Info. Logout is global
- Evidence (RUNTIME): logging out on device A made device B's token return 401, and a replayed logout returned 401; a password change or role change also ends every session (intended, and the user must sign in again). Document it for users; no fix needed.

## 3. Checks that passed (RUNTIME unless noted)

- Invalid credentials: wrong password, unknown user and deactivated user all return the same 401 body; missing fields 400; object and array inputs 400; NUL byte, 400 character email and SQL-style text 401 with no error; malformed JSON 400; GET on login 404 JSON; email is case and space insensitive.
- Response has no password hash; `Cache-Control: no-store` on auth routes; no `X-Powered-By`; HSTS, nosniff and frame options present.
- Token: 8 hour lifetime; payload holds userId, email, name, role, tv only; HS256 pinned; forgery attempts listed in AUTH-012 all rejected.
- Logout and revocation: old token dead after logout (also the second device); new login works after logout; no refresh endpoint exists.
- Password change: wrong current password 401; missing 400; too short, no digit, no letter, over 72 bytes all 400; success ends all old tokens and the old password; another user's password cannot be changed by a normal role (403); an admin reset ends the target's sessions.
- Deactivation through the API: old token dead at once, login refused, reactivation does not revive the old token.
- Role change: old token dead at once; a new login shows the new role; the server uses the database role, not the token claim.
- Self protection: an admin cannot deactivate or demote themselves; the last active super_admin is protected (SOURCE).
- Link tokens: 2 minutes; valid only on its own path and only for GET; refused in the header; bad paths (`..`, relative, query, spaces) 400; no token 401.
- Project scope: assigned projects are read from the database each request (SOURCE; row level security proved at runtime in the Set Master work).
- Logs: 358 lines of the development server log and the production log contained no password, no token and no Authorization header.
- Unknown role: 403 (SOURCE, `rbac.ts`).
- Not applicable: CSRF (bearer header, no cookie).

## 4. Cross-module notes
- Users & Roles: AUTH-002, 008, 014 and the password and role flows live in `routes/users.ts`; they depend on `token_version` and `invalidateAuthUser`. Not audited further here.
- Documents: AUTH-001. Consumers and booking: AUTH-006 and the ~50 link sites of AUTH-007. Set Master: company routes rely on `req.userRole`.
- The frontend `js/permissions.js` and `js/api-client.js` sign the user out on 401, so the 15 second and 8 hour behaviours reach the user as a sudden sign-out.

## 5. Not tested (UNVERIFIED)
- Behaviour on Vercel (real client IP and proxy chain, instance count, `NODE_ENV`).
- The real database: hash formats and costs, rows with plain text passwords, duplicate usernames.
- Rate limit counters across restarts; token behaviour near the 8 hour expiry on a real clock; browser-side XSS exposure of localStorage (no XSS was searched for here).
- Load testing and email delivery (none exists).

## 6. Test environment and safety
- Disposable database `rof_auth_sm` and two local servers, all stopped and the database dropped at the end. Synthetic users and one synthetic template and photo row, removed again. No existing database, production, Neon or Vercel system was used.
- Working tree: the 16 pre-existing entries (all Set Master and review work) are unchanged; two new files were added (this report, `docs/architecture/ROF_CRM_MASTER_FLOW.md`, which did not exist before). Nothing committed, pushed or deployed.

## 7. Recommended order for the fix round (not started)
1. AUTH-001 (remove open diagnostics), AUTH-002 (current password for super_admin), AUTH-008.
2. AUTH-003, 004, 005 together as a new login protection (database-backed counters, same reply for unknown emails, limiter that ignores successes).
3. AUTH-006 and AUTH-007 (photo access and token storage) after a decision on cookie sessions.
4. AUTH-009 decision on MFA; add failed-login and logout audit events.
5. AUTH-010 to 016 hardening and schema clean-up.
Per the instruction, Users & Roles is not started and no fix is implemented until this report has been reviewed independently.
