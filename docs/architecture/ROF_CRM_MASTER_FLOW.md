# ROF CRM master flow

Written from the source code and runtime tests, not from older documents. This file did not exist before the Login & Authentication audit (2026-11-04); it starts with that module and is meant to grow one module at a time. Findings are in `LOGIN_AUTH_AUDIT_REPORT.md` (IDs AUTH-001 and up); fix status is in section 1.9 and in `AUTH_FIX_PHASE_1_REPORT.md`.

## 1. Login and authentication

### 1.1 Request path
```
login.html (pages/login.html)           POST /api/auth/login            { email, password }
  form: type=email, required            authLimiter (10 / 15 min per IP, 1000 outside production)
  JWT saved in localStorage "rof-jwt"   body checks > per ip|email lockout (in memory) > users lookup
  redirect to /                         bcrypt compare (dummy hash when no such active user) > JWT HS256, 8 h
                                        audit_logs row (action login) and users.last_login_at

every later call: js/api-client.js adds  Authorization: Bearer <jwt>
  index.ts authenticateToken
    1 token from the header (any scheme word is accepted) or, for GET only, ?token=
    2 jwt.verify with JWT_SECRET, algorithms ['HS256'] only
    3 a ?token= must be a "link" token made for exactly that path; a link token in the header is refused
    4 loadAuthUser(userId): one SELECT on users (+ roles, user_ip_restrictions, projects), cached 15 s per process
    5 refuse when user missing, is_active = false, or token_version differs from the token's tv claim (401)
    6 refuse when the user has IP security on and the request IP is not on the list (403)
    7 req.userRole = effective role (a custom role maps to its roles.base_role), req.roleName = users.role
    8 a non super_admin with assigned projects: AsyncLocalStorage scope {projectIds}; db.query then runs as the
      limited database role rof_app under row level security (db/pool.ts, migration 100)
  rbac(resource)  maps the HTTP method to view / create / edit / delete and checks middleware/rbac.ts (unknown role = 403)
```
The token carries userId, email, name, role, tv, iat, exp. The server never trusts the role claim: role, active flag, project scope and IP rules come from the database on each request (15 s cache).

### 1.2 Sessions, logout and revocation
- No refresh token, no sliding expiry: one 8 hour JWT. Client side `Auth.isAuthenticated()` only reads `exp`.
- `users.token_version` (migration 095) is the revocation switch. It is increased by: logout (`POST /api/auth/logout`), own or admin password change, admin sign-out (`POST /api/users/employee-login/:id/sign-out`), a role change and a deactivation (`users.ts updateUser`). Every older token then fails step 5. Logout on one device therefore signs out every device of that user.
- Changing assigned projects, IP rules or a role definition does not raise the version; the next request (after the 15 s cache, or at once when the change went through the API of the same server process) sees the new values.
- `invalidateAuthUser(id)` / `clearAuthUserCache()` empty the per-process cache; other server instances learn within 15 s.
- Link tokens: `POST /api/auth/link-token {path}` returns a 2 minute JWT with `purpose: link` and `p: <path>` so letters, receipts and files can open in a new tab through `?token=`. `js/links.js` swaps any `?token=` address for a link token before it is used.

### 1.3 Passwords
- bcryptjs, cost 12 for new hashes (`users.ts`, login migration). Policy (`utils/security.ts passwordProblem`): 8 or more characters, at most 72 bytes, at least one letter and one digit.
- Legacy hashes that do not start with `$2` (plain text or base64) are still accepted at login and rewritten as bcrypt on success. A NULL hash can never log in (only with the dev opt-in).
- Change own password (phase 1 fix): `POST /api/users/:id/change-password` (exempted from rbac when `:id` is the caller) **always** needs `currentPassword`, for every role including super_admin. Setting your own password through `PATCH /api/users/:id` or `/employee-login/:id` needs `currentPassword` too (`verifyOwnPassword` in `routes/users.ts`, shared by both routes). The change raises `token_version` and clears the current-password failure count.
- Admin reset of someone else's password: `POST /api/users/:id/change-password` or `PATCH` with `password`, super_admin only (rbac), no current password; raises `token_version` of that user and clears their failure count. Everyone else gets 403 for another login.
- There is no forgot-password, reset-by-email, OTP, TOTP or other MFA anywhere in the code (AUTH-009, open).

### 1.4 Brute force and rate limits
- `authLimiter` on `/api/auth/login` only: counts every request, successful or not (production: 10 per 15 minutes per IP).
- `loginFailures` (index.ts): per `ip|email`, 5 failures lock that pair for 15 minutes, kept in process memory, only for existing active accounts.
- Current-password check (phase 1 fix, `routes/users.ts currentPwFails`): per account, 5 wrong current passwords inside 15 minutes block further current-password checks for that account for 15 minutes (429 with `Retry-After`, a correct answer is refused too). Counted per account (not per address) across both routes that verify it; a success or any new password clears it. Only this check is blocked: sign-in, other actions and an administrator's reset of the account keep working. The counter is in process memory (same limit as the login lockout; a shared store belongs to AUTH-004).
- `apiLimiter` (300 per minute per IP in production) covers routes registered after `app.use('/api', apiLimiter)`; `/api/auth/*`, `/api/health/*` and `/api/photos` are registered before it.
- `trust proxy` is set to 1 only when NODE_ENV is `production`.

### 1.5 Unauthenticated surface (registered before authentication)
`GET /api/health` (status, time, short commit; the deployment check), `GET /api/import/template/units`, `GET /api/photos/:kind/:id` (applicant photos by id, AUTH-006 open), static `/uploads` and the web files, `POST /api/auth/login`.
Diagnostics (phase 1 fix): `GET /api/health/debug` (startup migration note, whether DATABASE_URL is set) and `GET /api/health/templates` (which legal templates exist: type, project, name, count) now run `apiLimiter`, `authenticateToken` and a `super_admin` check (`adminDiagnostics` in `index.ts`). Neither returns template text; the templates diagnostic returns a generic message on failure instead of the internal error.

### 1.6 Database
| Table | Role in authentication |
|---|---|
| `users` | id, email (unique, plus unique lower(email)), password_hash, role (text name), is_active, **status (not read by auth)**, token_version, assigned_project_ids (jsonb), ip_security_enabled, last_login_at, username (no unique index), authorized_print / download, unit_status_access, home_page_widgets. Legacy unused: role_id, project_ids, employee_id |
| `roles` | name, base_role, is_active; a custom role resolves to base_role for permission checks (`loadAuthUser`) |
| `user_ip_restrictions` | allowed IPs per user (unique user_id, ip_address) |
| `user_process_permissions`, `user_company_access` | maker/checker process rights and company access, loaded by other modules, not by authentication |
| `audit_logs` | append-only policy; login success rows (resource_type auth, new_values holds the IP); user changes from users.ts; failed logins and logouts are not written |
| `projects` | read by `loadAuthUser` to turn assigned_project_ids into the row level security scope |
There is no sessions, refresh token, password reset or login attempt table.

### 1.7 Security boundaries
1. Browser to API: bearer header, no cookie, so no CSRF; the token sits in `localStorage` (readable by any script on the page).
2. Token to identity: signature and HS256 only; identity facts are re-read from the database (15 s cache).
3. Role to resource: `rbac.ts` role table; exceptions in `index.ts rbac()` for `/users/directory`, `/users/me` and own `change-password`.
4. User to project: row level security through `scopeStore` for non super_admin users with assigned projects; null-project rows are visible and writable to everyone.
5. IP boundary: optional per user allow list using `req.ip`.

### 1.8 Dependencies on other modules
- **Users & Roles** (`routes/users.ts`, `routes/roles.ts`, `middleware/rbac.ts`): create, edit, deactivate, role and project assignment all act on the tables above and must call `invalidateAuthUser` / bump `token_version`.
- **Every other module**: depends on `authenticateToken`, `req.userRole`, `req.userId` and the project scope; audit rows use `req.userId`.
- **Set Master / Companies**: company routes use `req.userRole` for super_admin and finance checks.
- **Frontend**: `js/auth.js`, `js/api-client.js` (401 handling), `js/links.js`, `js/permissions.js`.
- **Deployment**: `JWT_SECRET` (required, no minimum strength enforced), `NODE_ENV`, `ALLOWED_ORIGINS`, `ALLOW_DEV_AUTH`; Vercel or the proxy in front decides what `req.ip` is.

### 1.9 Finding status (Login & Authentication)
Verified on 2026-11-04 on a fresh disposable database (migrations 96 to 145) with the working-tree code: `docs/auth-fixes/api-test-auth-phase1.mjs` 68 of 68, all 46 repository API scripts 8505 checks with no failure, and Playwright 244 of 245 (the one failure is test-data contamination unrelated to authentication, see `AUTH_PHASE1_FINAL_VERIFICATION_REPORT.md`).
| ID | Status | Note |
|---|---|---|
| AUTH-001 | Fixed and verified | `/api/health/debug` and `/api/health/templates` need a super_admin login and are rate limited (anonymous 401, other roles 403); no template text is returned; `/api/health` stays public with status, timestamp and commit only |
| AUTH-002 | Fixed and verified | own password change needs the current password for every role on change-password (wrong = 401) and on `PATCH /users/:id` and `/employee-login/:id` (wrong = 403); a super_admin can still reset another login without it |
| AUTH-008 | Fixed and verified, with a known limit | 5 wrong current passwords in 15 minutes block the check for that account (429 + Retry-After), counted once across all three routes; the counter is in process memory, so a restart or another instance starts fresh (shared store belongs to AUTH-004). The 15 minute expiry itself was not tested at runtime |
| AUTH-003, 004, 005, 006, 007, 009 to 017 | Open | not touched; the Authentication module is NOT complete |

## Users & Roles: who can reach what (after plan v7 phase 2, UR-001, UR-006, UR-011)
- Only a login whose own role is `super_admin` is a super admin. A custom role never inherits it: `loadAuthUser` (`index.ts`) turns a super_admin base role into "no usable role" and the request is refused (403).
- `/api/users`, `/api/employees`, `/api/roles` are super_admin only (router guards). Open to every signed-in user: `GET /users/me`, own password change, `GET /users/directory`, `GET /employees/directory` (id and name of active non-super-admin logins only), and `GET /roles/<own role>/pages`.
- IP security: one canonical address spelling on storage, comparison and the request address. A blocked address gets the same 401 as a failed sign-in; the reason (`auth_blocked`) goes to the audit log. The address you work from cannot be removed while IP security is on.
- Login lifecycle: Disable keeps every setting; Revoke all disables and removes projects, companies, process rights, IP rows and print/download/unit status in one transaction; enabling either needs `reviewedGrants: true`.
- Role assignment and role deletion are serialized with a row lock, so a login can never end on a role that is being deleted.
