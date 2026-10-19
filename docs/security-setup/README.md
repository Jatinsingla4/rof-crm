# Security: logins, roles, role menu access, audit log

Our own check of the Security group (Set Master menu). Written from the code and from running it, not from older documents.
Checked on 2026-10-19 with `api-test-security.mjs` (155 API checks) and 6 browser flows in `e2e/flows.spec.ts`.

## 1. What the module is

| Screen (Set Master > Security) | Opens | Who can change things |
|---|---|---|
| Logins and Permissions | `#/users?tab=permissions` | super_admin. Others with the `users` view right (project_manager) can look. |
| Roles | `#/users?tab=roles` | super_admin |
| Role Menu Access | `#/users?tab=role-menu` | super_admin |
| Audit Log | `#/users?tab=audit` | read: anyone with the `users` view right |

Create Login and View Logins used to be in the Employees menu and opened a separate page (`pages/employee-login.html`). They are now one screen here, inside the app, with the same checks for everybody. The old page is removed.

## 2. How access works (three separate layers)

| Layer | Set where | Decides | Enforced by |
|---|---|---|---|
| Role (system or custom) | Roles | What the person may do on the API: view, create, edit, delete per area | Server, on every request (`middleware/rbac.ts`) |
| Process rights (maker, checker) | Logins and Permissions | Who may enter and who may approve receipts, waivers, refunds, broker entries, applicants, transfers | Server (`requireProcess` on the routes) |
| Role Menu Access | Role Menu Access | Which screens the role can open and see in the menu | The app (menu hidden, screen shows Access Denied). The server does not look at it. |

A custom role has a **base role**. It gets exactly the API rights of that system role. The base role cannot be `super_admin`.
The person's role is read from the database on every request (cached for 15 seconds, cleared when it is edited), so a changed or disabled login takes effect at once.

## 3. Rules

**Logins**
- Email is stored in lowercase and is unique ignoring letter case. Sign in also ignores letter case. Username is unique ignoring letter case, 3 to 50 characters.
- Password: 8 to 72 bytes with at least one letter and one number. Setting or resetting a password, changing a role, disabling a login and "Sign out of every device" all end the person's sessions.
- Role must exist. Projects and companies must exist. Process rights are limited to the real steps: see section 4.
- One employee can have one login.
- You cannot change your own role or disable yourself. The last active super_admin cannot be demoted or disabled.
- Every create and change is written to the audit log (never the password or its hash).

**IP allow list**
- Valid IPv4 or IPv6 only. When it is switched on the person can only use the system from those addresses (checked on every request and at sign in).
- It cannot be switched on with an empty list, an admin cannot switch it on for themselves unless their current address is on the list, and the last address cannot be removed while it is on.

**Roles**
- Name: 3 to 50 characters, lowercase letters, digits and underscores, starting with a letter; unique ignoring case; the six system names are reserved.
- System roles cannot be edited or deleted. A custom role cannot be deleted while any user holds it. Deleting a role removes its menu access, so a role created later with the same name starts empty.
- super_admin always sees every page.

**Role Menu Access**
- The page list (`nav_pages`) now exists in a new database: migration 099 adds one row per screen and gives each system role a starting set of pages (only for a role that has none yet). A screen that is not on the list is not controlled here.
- Starting access: project_manager everything except Security; sales_executive CRM, booking, parking, investor hold; accounts_finance receipts, demands, interest, reports, brokers; support_agent CRM inbox and tasks; read_only_viewer applicants, units, documents, reports.

## 4. Process rights offered in the screen

Only steps the server really checks are offered. Before this check the screen offered steps nobody enforced and no way to give a receipt maker right, so only a super admin could enter a receipt.

| Process | Maker | Checker |
|---|---|---|
| New Applicant, Edit Applicant, Unit Shifting, Applicant Transfer, Broker Payment Entry | yes | no |
| Receipt, Interest Waiver, JV/Refund/DrCr, Broker Range Entry | yes | yes |

The older "approver" right is not used by any route and is no longer offered.

## 5. Problems found and fixed

| # | Found | Fix |
|---|---|---|
| 1 | A custom role could be created but the API answered "Unknown role" (403) to every request from it | Custom roles carry a base role (migration 099); the server resolves it |
| 2 | IP restrictions were saved but never checked | Enforced on every request and at sign in, with lock-out guards |
| 3 | Emails kept their letter case but sign in looked up the lowercase email, so such users could never sign in | Stored lowercase, looked up ignoring case, unique index (099) |
| 4 | `pageSize`, `page`, `period` went straight into SQL text (injection) | Whole numbers only, bound parameters |
| 5 | Menu opened tabs (`permissions`, `role-menu`) that did not exist | One Security screen with four sections |
| 6 | Role Menu Access had no page list on a new database | Migration 099 seeds pages and starting access |
| 7 | `GET /roles`, `/roles/:name/pages` open to any signed-in user | Only the role's own page list, or the `users` view right |
| 8 | Role edit used `prompt()`; the old login page built HTML from data without escaping | New screen, everything escaped |
| 9 | Changing a role or disabling a user did not take effect until the cache expired | Cache cleared at once; sessions ended |
| 10 | Audit filters did nothing (case of the action, date fields ignored), user shown as an id | Filters fixed, user name joined, sign ins logged |
| 11 | `last_login_at` never set | Set at sign in |
| 12 | No checks on email, mobile, role, project, company, widget and process values; 500 on a duplicate | Every value checked, 400 or 409 with a plain message |
| 13 | Roles: duplicate name gave 500; deleting an unknown role "succeeded"; role page rows were left behind | 409, 404, rows removed |
| 14 | A menu link was shown for screens the role cannot open | Menu hides them, and empty groups |
| 15 | Booking and Tasks listed users with `/users`, which sales and support roles may not call, so their pick lists were empty | New `/users/directory` (names only) |
| 16 | Any logged-in route unknown to the page list returned Access Denied when page access was configured | A screen not on the list is allowed |
| 17 | Audit log could be written by hand through an endpoint nobody used; a made-up permission checker and a static role list that disagreed with the code | Removed |

## 6. Project scope (who sees which project)

Decision: a login assigned to one or more projects sees and changes **only those projects**. A login with **no project assigned sees every project** (this keeps every existing login working). Super admin is never limited, whatever is ticked.

How it works: the API runs a limited login's requests as the database role `rof_app` with the allowed project ids set for that request. Row level security (migration 100) filters every table that has `project_id`, `consumer_id` or `unit_id`: projects, towers, units, unit types, applicants and everything of an applicant (receipts, demands, documents, calls, tasks, remarks ...), bookings, allocations, payment plans, GST, brokers' commissions. Because the database does it, lists, details, reports, dashboard and writes all obey it, including queries nobody remembered to filter. Assigned to a project that no longer exists means seeing nothing, never everything. A change in the login's projects applies on the next request.

Checks that keep it true: the API test fails if a table with `project_id`, `consumer_id` or `unit_id` has no scope policy (add `SELECT rof_apply_project_scope();` to the migration that creates the table), or if a view exists (a view would run as its owner and skip the scope). All 180 list endpoints were called as a limited login: none failed where the admin's call worked.

Live database: run migration 100 as the database owner (it creates the `rof_app` role). If the role is missing, a limited login gets an error, never other projects' data.

## 7. Known gaps (not fixed, by design or for later)

| Gap | Why it matters |
|---|---|
| Companies assigned to a login are saved but not used to limit data. | Companies are not a data boundary today (a project belongs to one company). Revisit if a client runs separate companies in one CRM. |
| "May print", "May download" and Home page widgets are saved but no screen reads them yet. | Stored, not enforced. |
| Applicants with no project yet (new leads) are visible to everyone. | A lead has no project until it is booked. Once it has one, only that project's logins see it. |
| A limited login cannot create a project (it could not see it). | An admin creates projects. |
| A custom role cannot be given its own API rights; it borrows a base role. | Enough for most offices. A rights grid per role would be a larger change. |
| Role Menu Access is a screen-level control only. | The API rights come from the base role. |
| Sessions: a JWT lasts 8 hours, but it is checked against the database on every request, so disabling works at once. | No gap, listed so it is not rechecked. |

## 8. Tests

- `api-test-security.mjs`: 155 checks. Roles (create, validate, edit, delete, matrix), page access (own role, other role, save, defaults), logins (every validation, duplicates in other letter case), edits and the effect at once (role, password, sign out, disable), custom role working through its base role, IP allow list including lock-out guards, injection attempts, audit log filters, password change.
- `e2e/flows.spec.ts`, section 8: new login with a weak then a matching password, sign in with the email in capitals, edit and disable and refused sign in, bad IP in the list, custom role created, grid ticked and saved, role deleted, a role given a screen and losing it again, audit log.
- `api-test-scope.mjs`: 34 checks. Two projects with a unit, applicant and receipt each; a login limited to one project, one with two, one with none, a limited project manager: lists, details, edits, adds, receipts, dashboard, routes that hold their own database connection, connections going back to the pool clean, changes applying at once, super admin unaffected, a deleted project, and the policy coverage guard.
- Run locally: see `docs/PIPELINE.md`.
