# Data operations D1, D2, D11 (Users & Roles, plan v7 section 6A.2)

These three operations clean data that would make a pending migration fail. They are **never part of a migration**, they run only when a named
person points `psql` at a named environment, and they never run on production or Neon without the owner's written approval.

| Operation | Fixes | Blocks migration | Report (read only) | Dry run / apply |
|---|---|---|---|---|
| D1 duplicate usernames | two logins with the same username ignoring case and spaces | M1 `users_username_lower_btrim_key` | `d1-usernames-report.sql` | `d1-usernames-dryrun.sql` |
| D2 ghost roles | a login whose role has no exact `roles` row, or differs in case | M3 `users_role_fkey` | `d2-ghost-roles-report.sql` | `d2-ghost-roles-dryrun.sql` |
| D11 super_admin base | a role whose `base_role` is `super_admin` or not a system role | M2 `roles_base_role_not_super_admin` | `d11-super-admin-base-report.sql` | `d11-super-admin-base-dryrun.sql` |

| D7 capability grants | print, download and unit status per login; NULL or unknown becomes "no" / "none" at release | M9 defaults (`M9_users_capability_defaults.sql`), M11 later | `d7-capability-report.sql` | owner decides each login (no mass grant; no script) |
| D4 to D6 NULL-scope rows | rows with no project, consumer or unit (they stay super-admin-only under the strict policy until mapped, or the table goes on the owner's allow-list) | M10a `M10a_strict_null_scope.sql` | `d6-null-scope-report.sql` | owner decisions per table (no script yet: mapping rows needs the business answer) |

## How to use them
1. Restore a **scrubbed copy** of the data (never run the first time on the live database). Run the three reports: `psql -X -f d1-usernames-report.sql` and so on.
2. The owner fills one **decisions CSV** per operation (the header is in the dry-run file). A login or role that is not in the file is never touched. There is no automatic mapping.
3. Dry run: `psql -X -v decisions=/path/d1.csv -f d1-usernames-dryrun.sql`. It prints the checks (every count must be 0), the result, what would still block the migration, and then **rolls back**.
4. Apply (only on an approved environment): the same command with `-v apply=1`. Every change writes an `audit_logs` row with the old and new value and `dataOperation`.
5. Re-run the report: it must be empty. Only then may the matching file of `../pending-migrations/` move into the release batch.

## What needs the owner's business decision (nothing is guessed)
- **D1:** for each group of colliding usernames, which login keeps the name and what the others are renamed to. The report lists email, role, activity and last sign-in with a *suggested rank* (active first, most recent sign-in first); the rank is a suggestion only.
- **D2:** for each ghost role, which existing role the logins move to. A case-only mismatch (`Sales_Executive` against `sales_executive`) is still an explicit decision row.
- **D11:** for each role with a super_admin or unknown base, a valid base role (`set_base`) or `deactivate` (the role is switched off and its blocking base role is cleared, because the M2 CHECK covers inactive roles too; the audit row keeps the old base). A role with active holders cannot be deactivated first; deciding the holders (a D2-style move) comes first.

## NULL-scope rows (decision 2) in one paragraph
The report `d6-null-scope-report.sql` lists every table that can hold a row with no project, consumer or unit, with the NULL row count. The draft
`M10a_strict_null_scope.sql` makes those rows super-admin-only for a project-limited login (reads and writes) when `app.scope_strict` is on, which the
application sets whenever `SCOPE_MODE` is strict; a table on the empty allow-list `rof_scope_global_tables` keeps its NULL rows readable.
`test-null-scope.sh` proves the behaviour on a scratch database (11 checks). The allow-list and the mapping of the rows are the owner's decisions:
on the local test data alone, `consumers` (enquiries) has 251 NULL-project rows of 3,509, `reminder_master`, `document_types` and `document_dispatch_master` are
entirely NULL-project (global catalogues in all likelihood), and `booking_records.unit_id` has 20. Turning this on without that sign-off would hide enquiries and catalogues from limited logins.

## Status of the evidence
These scripts were written against the schema of the local test database and run end to end on a scratch database
(`test-data-operations.sh`: seeds duplicates, a ghost role, a role with a super_admin base, runs reports, dry runs, apply, then applies the
migration drafts M1 to M3, which must fail before the clean-up and succeed after it). **No production or Neon data was read**, so the real counts,
duplicates and mappings are not known yet: the reports have to be run on the scrubbed copy, and the CSVs filled by the owner.
