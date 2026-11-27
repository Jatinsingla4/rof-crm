#!/usr/bin/env bash
# Runs the whole remediation regression suite against a THROWAWAY local database. Never point it at a shared or production database.
# Usage (from the repo root):  bash docs/remediation/run-regression.sh      Needs local Postgres (psql at $PSQL, user postgres, password $PGPASSWORD).
set -uo pipefail
cd "$(dirname "$0")/../../packages/api"
export PGPASSWORD="${PGPASSWORD:-postgres}"
PSQL="${PSQL:-/Library/PostgreSQL/18/bin/psql}"
DB="${DB_NAME:-rof_remed_regress}"
PORT="${PORT:-3098}"
case "$DB" in rof_remed_*) ;; *) echo "refusing: database name must start with rof_remed_"; exit 2;; esac
fail=0
step() { echo; echo "=== $1"; }

step "build a fresh throwaway database $DB (baseline, migrations 096+, fixture)"
bash scripts/make-test-db.sh "$DB" >/dev/null 2>&1 || { echo "make-test-db failed"; exit 2; }
for f in $(ls src/db/migrations/*.sql | sort -V | awk -F/ '{n=$NF; split(n,a,"_"); if (a[1]+0>=96) print $0}'); do
  "$PSQL" -h localhost -U postgres -d "$DB" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>&1 || { echo "migration failed: $f"; exit 2; }
done
"$PSQL" -h localhost -U postgres -d "$DB" -q -v ON_ERROR_STOP=1 -f test/fixtures/cancelled-booking-fixture.sql >/dev/null 2>&1 || { echo "fixture failed"; exit 2; }

step "type check"
npx tsc --noEmit || fail=1

step "unit tests (no database)"
npx tsx --test test/agreement-reconcile.test.mjs test/money-rules.test.mjs test/quote-schedule.test.mjs test/a101-simulation.test.mjs test/allocation-position.test.mjs test/interest-intervals.test.mjs test/statutory-readiness.test.mjs test/wave4.test.mjs 2>&1 | grep -E "^# (tests|pass|fail)" || fail=1

step "API on port $PORT"
DB_NAME="$DB" DB_PASSWORD="$PGPASSWORD" PORT="$PORT" JWT_SECRET=local-test-secret-not-real-0123456789abcdef NODE_ENV=development npx tsx src/index.ts >/tmp/rof_remed_regress_server.log 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
for i in $(seq 1 40); do curl -s -m 2 "localhost:$PORT/api/health" >/dev/null 2>&1 && break; sleep 1; done

for t in db-cancelled-booking http-cancelled-booking http-gst-invoices http-booked-pricing http-booked-price-readers http-rebate-reprice http-overdue-interest http-receipt-approval http-reports-batch5 http-security; do
  step "$t"
  BASE="http://localhost:$PORT/api" DB_NAME="$DB" JWT_SECRET=x npx tsx "test/$t.check.mjs" 2>&1 | grep -E "^(PASS|FAIL)|all passed|FAILED|Error" || fail=1
done

echo; [ "$fail" = 0 ] && echo "REGRESSION SUITE: ALL PASSED" || echo "REGRESSION SUITE: FAILURES (see above)"
exit $fail
