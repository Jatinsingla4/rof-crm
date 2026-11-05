#!/usr/bin/env bash
# D7 review sheet generator: writes ONE CSV the owner reviews. It only READS (the session is forced read-only) and never assigns or changes a grant.
# Use it on a scrubbed or synthetic copy only:
#   CONFIRM_SCRUBBED_COPY=yes PGHOST=... PGPORT=... PGDATABASE=... PGUSER=... bash d7-grant-review-sheet.sh [output.csv]
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"; OUT="${1:-d7-grant-review-sheet.csv}"
if [ "${CONFIRM_SCRUBBED_COPY:-}" != "yes" ]; then echo "Refusing: set CONFIRM_SCRUBBED_COPY=yes to say this database is a scrubbed or synthetic copy."; exit 2; fi
case "${PGHOST:-localhost}" in *neon*|*amazonaws*|*vercel*) echo "Refusing: the host '$PGHOST' looks like a hosted production database."; exit 2;; esac
export PGOPTIONS='-c default_transaction_read_only=on'
echo "Target: host=${PGHOST:-localhost} port=${PGPORT:-5432} db=${PGDATABASE:?set PGDATABASE}  (read-only session)"
PSQL="${PSQL:-psql}"
# \copy needs the whole command on one line: drop the comment lines of the query file and join the rest
QUERY="$(grep -v '^--' "$HERE/d7-grant-review-sheet.sql" | tr '\n' ' ')"
"$PSQL" -X -q -v ON_ERROR_STOP=1 -c "\\copy ($QUERY) TO '$OUT' CSV HEADER"
echo "Wrote $OUT ($(($(wc -l < "$OUT") - 1)) logins). Fill the four owner_* columns and keep the file; nothing was changed in the database."
