#!/usr/bin/env bash
# Applies the database migrations that have not been applied yet to the database in DATABASE_URL, in number order,
# and records each one in public.applied_migrations. Stops at the first failure and names the file.
# Only migrations from 096 upward are handled here; older ones belong to the baseline.
# FORCE_FROM=<number> applies everything from that number again (they are written to be safe to run twice).
# The first time it runs on a database, 096 up to BOOTSTRAP_UP_TO are recorded as already applied (they were applied by hand).
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL is not set}"
dir="${MIGRATIONS_DIR:-packages/api/src/db/migrations}"
BOOTSTRAP_UP_TO=101
q() { psql "$DATABASE_URL" -X -At -q -v ON_ERROR_STOP=1 "$@"; }

q -c "CREATE TABLE IF NOT EXISTS public.applied_migrations (file text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"
files=$(ls "$dir" | awk -F_ '$1+0>=96' | sort)

if [ "$(q -c 'SELECT count(*) FROM public.applied_migrations')" = "0" ]; then
  for f in $files; do
    n=$((10#${f%%_*}))
    if [ "$n" -le "$BOOTSTRAP_UP_TO" ]; then q -c "INSERT INTO public.applied_migrations (file) VALUES ('$f') ON CONFLICT DO NOTHING"; fi
  done
  echo "First run on this database: migrations up to $BOOTSTRAP_UP_TO recorded as applied."
fi

applied=0
for f in $files; do
  n=$((10#${f%%_*}))
  if [ -n "${FORCE_FROM:-}" ] && [ "$n" -ge "$((10#$FORCE_FROM))" ]; then :; 
  elif [ -n "$(q -c "SELECT 1 FROM public.applied_migrations WHERE file = '$f'")" ]; then continue; fi
  echo "Applying $f"
  if ! err=$(psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 -f "$dir/$f" 2>&1 >/dev/null); then
    echo "::error file=$dir/$f,title=Migration $f failed::$(echo "$err" | head -4 | tr '\n' ' ')"
    exit 1
  fi
  q -c "INSERT INTO public.applied_migrations (file) VALUES ('$f') ON CONFLICT (file) DO UPDATE SET applied_at = now()"
  applied=$((applied+1))
done
echo "Migrations done ($applied applied)."
