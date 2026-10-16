# Database baseline (reconstructed)

Why this exists: the migration files in `../migrations` cannot build a database from scratch. Several tables and columns the code uses were created by hand on the original database and are in no migration (docs/DEFERRED_TASKS.md, DT-001). The original database was not available, so this baseline was reconstructed.

## Files

| File | What it is |
|---|---|
| `schema_baseline.sql` | Schema only (no data): 123 tables, 1693 columns. Restores into an empty PostgreSQL database without errors. |
| `seed_minimal.sql` | The 6 system roles. No users, no consumers. |
| `000_reconstructed_missing_objects.sql` | Tables no migration creates (`companies`, `nav_pages`, `role_page_access`, `user_ip_restrictions`, `payment_refunds`, `document_field_overrides`). Already included in `schema_baseline.sql`. |
| `001_reconstructed_missing_columns.sql` | Columns the code writes but no migration adds. Already included in `schema_baseline.sql`. |

## How it was built

1. Schema of the 3 May 2026 `pg_dump` (`backup_before_client_demo_20260503.sql`, from git history, data discarded).
2. Every migration in `../migrations`, the `apply_040` and `apply_042` scripts, and the stray `packages/api/migrations/043` and `045`.
3. Files 000 and 001 above, derived from the code (INSERT column lists, UPDATE targets, ALTER migrations).
4. Fixes found by calling every GET endpoint without parameters against that database: `unit_status` value `booked`, `roles.name` as VARCHAR, one NUMERIC column.

## Limits (read before relying on it)

- **Column types in `001` are guesses from the column name** (for example amounts as `NUMERIC(14,2)`, dates as `DATE`). Compare with the real production schema when it is available.
- Only columns the code **writes** were added from analysis. Columns that are only **read** were found by the crawl: 176 of 178 parameterless GET endpoints return no 5xx. Endpoints that need parameters, and every POST, PUT, PATCH and DELETE, have not been exercised.
- `GET /api/reports/inventory-details` without parameters returns 500 (`bind message supplies 2 parameters, but prepared statement requires 1`). That looks like a code bug, not a schema gap.
- No seed data for `nav_pages`, so role page access screens are empty (super_admin is not affected).
- Constraints, indexes and triggers that exist only in production are not known.

## Use on a new database

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f schema_baseline.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f seed_minimal.sql
```
Then create the first super_admin user with your own password (never commit it).
