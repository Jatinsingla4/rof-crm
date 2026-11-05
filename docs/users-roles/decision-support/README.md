# Decision-support material for the Users & Roles closure (index and how to review each artifact)

Purpose: let the owner see the **consequences** of each open decision before being asked to make it. Everything here is a document, a read-only SQL report or a generator of a review sheet.
No application code, no migration file, no database write, no production or Neon access was used; the reports were run only on the disposable local test database (synthetic data) in a read-only session.
Start with `00-plan-integrity.md` (the plan file v7 is missing; only the v6 copy exists), then read the artifacts in the order below.

| # | Artifact (exact path) | What it is | How to review it |
|---|---|---|---|
| 0 | `docs/users-roles/decision-support/00-plan-integrity.md` | which plan file exists, its hash, and what that limits | compare the file facts with what you have |
| 1 | `docs/users-roles/data-operations/d5-company-access-report.sql` and the blank `docs/users-roles/data-operations/d5-owner-mapping-template.csv` | **D5**: a read-only report of who can see which projects and companies today, with the missing, NULL and ambiguous cases, and a blank CSV for your mapping | see "D5" below |
| 2 | `docs/users-roles/data-operations/d7-grant-review-sheet.sql` and `.../d7-grant-review-sheet.sh` (plus the earlier `d7-capability-report.sql`) | **D7**: generates one CSV, one row per login, with what each login holds for print, download and unit status, what it becomes at release, activity signals, and four blank columns for your decision | see "D7" below |
| 3 | `docs/users-roles/decision-support/02-finance-part-b-route-table.md` | every pending financial handler, today's protection, a proposal and the exact Finance question | write A (second person), E (audited edit) or R (retire) next to each row |
| 4 | `docs/users-roles/decision-support/03-unit-status-questions.md` | the exact wording of Q-U1, Q-U2, Q-U3 and Q-A1 and what YES and NO each change | answer YES or NO per question once you accept its effects |
| 5 | `docs/users-roles/decision-support/04-staging-architecture-and-release-checklist.md` | staging design, environment matrix, hosting options, the gate checklist and what an administrator must inspect | accept or change the picture; then name an owner and an administrator |

## D5: how to run and read it
Run (on a scrubbed or synthetic copy only; the first line makes the session read-only, so a mistake cannot write):
`PGOPTIONS='-c default_transaction_read_only=on' psql -X -f docs/users-roles/data-operations/d5-company-access-report.sql`
The report prints ten numbered sections. Read them in this order:
- **1 Summary**: how many active logins are unrestricted, limited by project only, by company only, or by both (the two limits intersect; a company grant never widens a project assignment).
- **3 MISSING**: active logins that are **unrestricted today**: they see every project of every company. Each row needs your decision.
- **4 NULL**: projects that belong to no company. They are invisible to every company-limited login and visible to unrestricted ones.
- **5 AMBIGUOUS**: a login whose assigned project is outside its own company grants (the company limit cancels the assignment), with the reason.
- **6, 7, 8 AMBIGUOUS**: assigned project ids that no longer exist, grants to an inactive company, and a second legacy project list (`users.project_ids`) that the code does not read.
- **9** companies with how many projects and limited logins; **10** legacy bank accounts that belong to no company (company grants do not cover them).
- **2** is the per-login sheet (what each login can really reach today) from which you fill the template.
The blank template `d5-owner-mapping-template.csv` has these columns: `user_id,email,role,current_assigned_projects,current_company_grants,owner_decision,project_ids,company_ids,owner_note`.
Fill `owner_decision` with one of **KEEP_UNRESTRICTED**, **ASSIGN** or **NO_ACCESS** (a vocabulary proposed here, not yet implemented), put the project and company ids (semicolon separated) for ASSIGN, and add a note. Nothing reads the CSV yet; a dry-run loader will be written only after you accept this form.
On the synthetic test database the report shows every category (43 unrestricted logins, 3 projects with no company, one ambiguous assignment, one missing project id), which proves the report finds them; the real numbers can only come from a scrubbed copy of the real data.

## D7: how to run and read it
`CONFIRM_SCRUBBED_COPY=yes PGHOST=... PGPORT=... PGDATABASE=... PGUSER=... bash docs/users-roles/data-operations/d7-grant-review-sheet.sh my-sheet.csv`
The script refuses to run without `CONFIRM_SCRUBBED_COPY=yes` and refuses a host that looks hosted (neon, amazonaws, vercel); it forces a read-only session and prints its target first. It writes one CSV and changes nothing.
Columns to read: `print_today`, `download_today`, `unit_status_today` (what the login holds), then `*_at_release` (what the fail-closed code turns it into: **LOSES** means the login stops printing or downloading, and a NULL or unknown unit status **becomes none**),
the activity signals (`last_login_ist`, `receipts_recorded`, `documents_generated`, `bookings_made`, `audit_events_last_90_days`, `process_rights`: facts to judge need, **not recommendations**), and four blank columns for you:
`owner_print_yes_no`, `owner_download_yes_no`, `owner_unit_status_...` (one of none, available, available_hold, unit_hold, all) and `owner_note`. Rows with many activity signals and "LOSES" are the ones that would notice the release first.
On the synthetic database it produced 63 rows with the four owner columns empty.

## Reading order for the decision brief
The short plain-language brief with the decisions is in the reply that accompanied these files; the tracker (`docs/users-roles/USERS_ROLES_TRACKER.md`) keeps the Closure Blocker Register and a pointer here.
