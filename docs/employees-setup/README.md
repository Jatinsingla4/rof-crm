# Employees: departments, employees, teams, org chart

Our own check of the Employees group (Set Master menu). Written from the code and from running it.
Checked on 2026-10-19 with `api-test-employees.mjs` (115 API checks) and 4 browser flows in `e2e/flows.spec.ts` (section 10).

## 1. The screens

The group had 8 tabs that overlapped (Set Manager and Set Team Head were only edit fields of Employee and Team). It is now 5 screens, opened from the menu:

| Screen | Menu entry | What it is for |
|---|---|---|
| Departments | Department | Departments, their head, how many people and teams use each |
| Employees | Employee Information | The HR profile of a login: code, designation, department, **manager (reports to)**, mobile, joining date, address, status |
| Teams | Team Master | Teams, their head and members. Set Team Head and Team Head Detail are inside it (Members) |
| Org Chart | Employee Tree | Who reports to whom |
| Report | Report | People in each department |

Old bookmarks (`tab=info`, `set-manager`, `team-master`, `set-team-head`, `team-head-detail`) still open the right screen.

## 2. Who may do what

| | super_admin | project_manager | others |
|---|---|---|---|
| Look at departments, employees, teams, chart, report | yes | yes | no (the page is closed and the API answers 403) |
| Add, change, delete | yes | no | no |
| See salary grade, personal mobile, emergency contact, address | yes | no (left out of every answer) | no |
| Names for pick lists (`/employees/directory`) | yes | yes | yes (names, designation, department only) |

Before this check every signed-in user, including a viewer, could read salary grades and private contacts and add, change or delete employees, departments and teams.

## 3. Rules

- **A profile belongs to a login.** One profile per login. Create the login first (Security, Logins and Permissions), then add the employee here.
- Employee code: letters, digits and `. _ / -`, 50 characters, unique ignoring case. Designation 150. Mobile numbers 6 to 20 digits (with `+ - ( )` and spaces). Joining date a real date. No `<` or `>` in any text.
- **Manager:** an active person, not the person themselves, and not anyone who reports to them (directly or through others), so a loop cannot be made. The org chart also copes with a loop left in old data: nobody disappears.
- **Leaving:** switching an employee to Inactive also switches the login off and signs the person out at once. Switching back on enables the login again. You cannot switch yourself off, and the last super admin cannot be switched off (same rule as Security).
- **Department:** name unique ignoring case. A department with employees or teams cannot be deleted (mark it inactive instead). The head must be an active login.
- **Team:** name unique inside a department. The head is always a member: choosing a head adds the person, and the old head stays as a member. Removing the head from the team clears the head. "Head" is set with Make head, not typed as a role.
- Editing sends only what changed. Before, saving a department, a team or an employee with one field changed cleared its head or manager.
- Every add, change and delete is in the audit log. Pay and private contacts are never written to it.

## 4. Problems found and fixed

| # | Found | Fix |
|---|---|---|
| 1 | No access check at all on the employee API | Mounted with the `users` rights |
| 2 | Pay (salary grade), personal mobile, emergency contact and address visible to everybody | Only super_admin sees them |
| 3 | Saving with one field changed cleared the manager (employee), the head (department, team) and any field not sent | Only sent fields change; null clears on purpose |
| 4 | An employee who left kept a working login | The login follows the employee status |
| 5 | A manager could be set to the person themselves or to a reportee (loop); a loop hid people from the org chart (or crashed it) | Refused; chart copes with old loops |
| 6 | Database errors shown to the user as the message (500 with text) | Plain messages, 400/404/409 |
| 7 | No checks on any value; delete of a used department silently emptied the department of every employee | Every value checked; delete refused with the count |
| 8 | Two departments or teams or codes that differ only in letter case | Refused; unique indexes in migration 102 |
| 9 | The team head was not necessarily a member | Head is always a member |
| 10 | The report left out people with no department | "No department" row |
| 11 | Booking payment and Calling listed `/employees`: roles without the right got nothing; Booking saved the profile id where the database wants the login id | `/employees/directory` returns the login id |
| 12 | 8 tabs, modals built with HTML strings | 5 screens in the Set Master style, all text escaped |

## 5. Known gaps

| Gap | Note |
|---|---|
| An employee profile needs a login. Staff who never log in cannot be recorded. | Matches how the CRM uses people today. Change only if HR records for non-users are needed. |
| Deactivating a manager leaves their reportees pointing at an inactive manager (shown at the top of the chart). | Reassign them from Employees. |
| Departments and teams are not used elsewhere yet (reports, assignment of applicants). | Booking uses the directory only. |

## 6. Tests

- `api-test-employees.mjs`: 115 checks. Roles, directory, departments (validation, duplicates, partial edit keeps the head, delete in use), profiles (every validation, duplicates, partial edit, who sees pay), managers (loops of one, two and three, set and clear), org chart (tree, old loop), report, an employee who leaves (login stops, comes back, cannot switch yourself off), teams (head is a member, change head, members, remove the head), deleting, audit.
- `e2e/flows.spec.ts` section 10: department add, duplicate, edit keeps head; employee add with a bad mobile then a good one, loop refused, org chart, switching off shows in Security; team with head and members, make head, delete; project_manager read only; sales_executive denied.
