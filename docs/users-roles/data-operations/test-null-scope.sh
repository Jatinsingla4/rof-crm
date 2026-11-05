#!/usr/bin/env bash
# Checks migration draft M10a on a SCRATCH database made from the schema of the local test database: without app.scope_strict nothing changes,
# with it a project-limited role no longer sees or writes rows that have no project (unless the table is on the owner's allow-list), super_admin
# (which does not use the limited role) still sees everything, and the file applies twice.   bash test-null-scope.sh   (psql env of the test database)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; M="$HERE/../pending-migrations/M10a_strict_null_scope.sql"
SRC="${PGDATABASE:?set PGDATABASE}"; SCR="rof_nullscope_$$"; pass=0; fail=0
ok() { if [ "$2" = "1" ]; then pass=$((pass+1)); echo "PASS $1"; else fail=$((fail+1)); echo "FAIL $1 -> $3"; fi; }
q() { psql -X -A -t -q -v ON_ERROR_STOP=1 -d "$SCR" -c "$1" 2>&1; }
trap 'psql -X -q -d postgres -c "DROP DATABASE IF EXISTS \"$SCR\"" >/dev/null 2>&1' EXIT
psql -X -q -d postgres -c "CREATE DATABASE \"$SCR\"" || exit 2
pg_dump -s -d "$SRC" | psql -X -q -d "$SCR" >/dev/null 2>&1
PX=00000000-0000-0000-0000-0000000000a1; PY=00000000-0000-0000-0000-0000000000a2
q "INSERT INTO projects (id,name,rera_number,tcp_licence) VALUES ('$PX','PX','RX','x'),('$PY','PY','RY','y')" >/dev/null
q "INSERT INTO campaigns (name, project_id) VALUES ('c_null', NULL), ('c_x', '$PX'), ('c_y', '$PY')" >/dev/null
# as the limited role, project X only; $1 = strict setting ('' for not set), $2 = SQL
as_limited() { psql -X -A -t -q -d "$SCR" -c "BEGIN; SET LOCAL ROLE rof_app; SELECT set_config('app.project_scope', '$PX', true)${1:+, set_config('app.scope_strict', '$1', true)}; $2; ROLLBACK" 2>&1 | tail -n +2; }
names() { as_limited "$1" "SELECT string_agg(name, ',' ORDER BY name) FROM campaigns" | tail -1; }

[ "$(names '')" = "c_null,c_x" ] && ok "before the draft: a limited login sees its project and the row with no project" 1 || ok "before the draft" 0 "$(names '')"
out1="$(psql -X -q -v ON_ERROR_STOP=1 -d "$SCR" -f "$M" 2>&1)"; out2="$(psql -X -q -v ON_ERROR_STOP=1 -d "$SCR" -f "$M" 2>&1)"
echo "$out1$out2" | grep -q ERROR && ok "M10a applies twice" 0 "$out1 $out2" || ok "M10a applies twice" 1
[ "$(names '')" = "c_null,c_x" ] && ok "applied, setting not on: nothing changes (old code compatible)" 1 || ok "applied, setting not on" 0 "$(names '')"
[ "$(names 'off')" = "c_null,c_x" ] && ok "setting 'off': nothing changes" 1 || ok "setting off" 0 "$(names off)"
[ "$(names 'on')" = "c_x" ] && ok "strict: the limited login sees only its own project (the row with no project and the other project are hidden)" 1 || ok "strict list" 0 "$(names on)"
r="$(as_limited on "INSERT INTO campaigns (name, project_id) VALUES ('sneak', NULL)")"; echo "$r" | grep -qi "row-level security" && ok "strict: the limited login cannot write a row with no project" 1 || ok "strict write of NULL project" 0 "$r"
r="$(as_limited on "INSERT INTO campaigns (name, project_id) VALUES ('other', '$PY')")"; echo "$r" | grep -qi "row-level security" && ok "strict: nor a row of another project" 1 || ok "strict write other project" 0 "$r"
r="$(as_limited on "UPDATE campaigns SET name = 'hacked' WHERE name = 'c_null'; SELECT count(*) FROM campaigns WHERE name = 'hacked'" | tail -1)"; [ "$r" = "0" ] && ok "strict: the limited login cannot change a row with no project" 1 || ok "strict update" 0 "$r"
q "INSERT INTO rof_scope_global_tables (table_name, note, approved_by, approved_at) VALUES ('campaigns', 'test allow-list', 'owner', now())" >/dev/null
[ "$(names 'on')" = "c_null,c_x" ] && ok "strict + allow-list: the table on the owner's list keeps its global rows readable" 1 || ok "allow-list" 0 "$(names on)"
q "DELETE FROM rof_scope_global_tables" >/dev/null
[ "$(q "SELECT string_agg(name, ',' ORDER BY name) FROM campaigns WHERE name LIKE 'c\\_%'")" = "c_null,c_x,c_y" ] && ok "super_admin (not the limited role) still sees every row" 1 || ok "super_admin sees all" 0 ""
[ "$(q "SELECT count(*) FROM pg_proc WHERE proname = 'rof_in_scope'")" -ge 1 ] && ok "the old rof_in_scope(uuid) is still there" 1 || ok "old function" 0 ""
echo; echo "$pass passed, $fail failed"; [ "$fail" = "0" ]
