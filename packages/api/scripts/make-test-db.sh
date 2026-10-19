#!/usr/bin/env bash
# Builds a throwaway local database for testing: baseline schema, 6 role users, small sample data.
# Usage: scripts/make-test-db.sh <dbname>      (run from packages/api)
# Then run the API on its own port:  DB_NAME=<dbname> PORT=<port> JWT_SECRET=<any> NODE_ENV=development npx tsx src/index.ts
# Users: <role>@test.local for super_admin, project_manager, sales_executive, accounts_finance, support_agent, read_only_viewer
# Password for all of them: Test#Pass1234 (local test databases only)
set -euo pipefail
DB="${1:?usage: scripts/make-test-db.sh <dbname>}"
case "$DB" in *[!a-z0-9_]*) echo "dbname may only contain a-z, 0-9 and _"; exit 1;; esac
PSQL="${PSQL:-/Library/PostgreSQL/18/bin/psql}"
export PGPASSWORD="${PGPASSWORD:-postgres}"
run() { "$PSQL" -h localhost -U postgres "$@"; }
run -d postgres -qc "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB"
run -d "$DB" -q -f src/db/baseline/schema_baseline.sql >/dev/null 2>&1 || true
run -d "$DB" -q -f src/db/baseline/seed_minimal.sql >/dev/null
HASH="$(node -e "console.log(require('bcryptjs').hashSync('Test#Pass1234',10))")"
for r in super_admin project_manager sales_executive accounts_finance support_agent read_only_viewer; do
  run -d "$DB" -qc "INSERT INTO users (email,name,role,password_hash,is_active) VALUES ('$r@test.local','$r','$r','$HASH',true)"
done
run -d "$DB" -q -v ON_ERROR_STOP=1 -f src/db/baseline/seed_test_data.sql
echo "ready: database $DB"
