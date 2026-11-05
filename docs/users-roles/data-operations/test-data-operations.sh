#!/usr/bin/env bash
# End-to-end check of D1, D2, D11 and the migration drafts M1 to M3 on a SCRATCH database made from the schema of the local test database.
# It never touches the source database's data. Needs the psql environment of the local test database (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE).
#   bash test-data-operations.sh
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; PEND="$HERE/../pending-migrations"
SRC="${PGDATABASE:?set PGDATABASE to the local test database}"; SCR="rof_dataops_$$"
pass=0; fail=0
ok() { if [ "$2" = "1" ]; then pass=$((pass+1)); echo "PASS $1"; else fail=$((fail+1)); echo "FAIL $1 -> $3"; fi; }
q()  { psql -X -A -t -q -v ON_ERROR_STOP=1 -d "$SCR" -c "$1" 2>&1; }
run(){ psql -X -A -t -q -d "$SCR" "$@" 2>&1; }
tmp="$(mktemp -d)"; trap 'psql -X -q -d postgres -c "DROP DATABASE IF EXISTS \"$SCR\"" >/dev/null 2>&1; rm -rf "$tmp"' EXIT

psql -X -q -d postgres -c "CREATE DATABASE \"$SCR\"" || exit 2
pg_dump -s -d "$SRC" | psql -X -q -d "$SCR" >/dev/null 2>&1
# the scratch database starts without the guards the drafts add, like the production data they have to clean
q "DROP INDEX IF EXISTS users_username_lower_btrim_key; ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_fkey; ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_name_key; ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_base_role_not_super_admin" >/dev/null
psql -X -q -d "$SRC" -c "\copy (SELECT * FROM roles WHERE is_system) TO '$tmp/roles.csv' CSV HEADER" >/dev/null
q "\copy roles FROM '$tmp/roles.csv' CSV HEADER" >/dev/null 2>&1 || psql -X -q -d "$SCR" -c "\copy roles FROM '$tmp/roles.csv' CSV HEADER" >/dev/null
q "SELECT count(*) FROM roles WHERE is_system" | grep -qE '^[1-9]' && ok "scratch database has the system roles" 1 || ok "scratch database has the system roles" 0 "none copied"

mkuser() { q "INSERT INTO users (id, email, name, username, role, password_hash, is_active) VALUES ('$1','$2','$2',$3,'$4','x',$5)" >/dev/null; }
mkuser 00000000-0000-0000-0000-0000000000a1 a1@x.test "'Raj'"       sales_executive true
mkuser 00000000-0000-0000-0000-0000000000a2 a2@x.test "' raj '"     sales_executive true
mkuser 00000000-0000-0000-0000-0000000000a3 a3@x.test "'RAJ'"       support_agent  false
mkuser 00000000-0000-0000-0000-0000000000b1 b1@x.test "'solo'"      sales_executive true
mkuser 00000000-0000-0000-0000-0000000000c1 c1@x.test "NULL"        Ghost_Role     true
mkuser 00000000-0000-0000-0000-0000000000c2 c2@x.test "''"          Sales_Executive true
mkuser 00000000-0000-0000-0000-0000000000d1 d1@x.test "'dh1'"       power_custom   true
q "INSERT INTO roles (name, label, is_custom, is_system, is_active, base_role) VALUES ('power_custom','Power',true,false,true,'super_admin'), ('weird_custom','Weird',true,false,true,'no_such_base'), ('retired_custom','Retired',true,false,true,'super_admin')" >/dev/null

# --- the drafts fail closed on the bad data and change nothing ---
for m in M1_users_username_unique M2_roles_name_unique_base_role_check M3_users_role_fkey; do
  out="$(run -v ON_ERROR_STOP=1 -f "$PEND/$m.sql")"; echo "$out" | grep -q "ERROR" && ok "$m fails closed on the bad data" 1 || ok "$m fails closed on the bad data" 0 "$out"
done
[ "$(q "SELECT count(*) FROM pg_indexes WHERE indexname='users_username_lower_btrim_key'")" = "0" ] && ok "M1 left no index behind" 1 || ok "M1 left no index behind" 0 ""

# --- reports see the problems ---
r1="$(run -f "$HERE/d1-usernames-report.sql")"; echo "$r1" | grep -q "raj" && ok "D1 report lists the colliding username" 1 || ok "D1 report lists the colliding username" 0 "$r1"
echo "$r1" | grep -q "solo" && ok "D1 report does not list a unique username" 0 "solo listed" || ok "D1 report does not list a unique username" 1
r2="$(run -f "$HERE/d2-ghost-roles-report.sql")"; echo "$r2" | grep -q "Ghost_Role" && echo "$r2" | grep -q "Sales_Executive" && ok "D2 report lists the ghost role and the case mismatch" 1 || ok "D2 report lists the ghost role and the case mismatch" 0 "$r2"
r3="$(run -f "$HERE/d11-super-admin-base-report.sql")"; echo "$r3" | grep -q "power_custom" && echo "$r3" | grep -q "weird_custom" && echo "$r3" | grep -q "d1@x.test" && ok "D11 report lists both roles and the holder" 1 || ok "D11 report lists both roles and the holder" 0 "$r3"

snap() { q "SELECT md5(string_agg(u.id||coalesce(u.username,'~')||u.role, ',' ORDER BY u.id)) || md5((SELECT string_agg(name||coalesce(base_role,'~')||is_active, ',' ORDER BY name) FROM roles)) || (SELECT count(*) FROM audit_logs) FROM users u"; }
before="$(snap)"

# --- decisions (the owner's part; here fixed by the test) ---
cat > "$tmp/d1.csv" <<CSV
user_id,new_username
00000000-0000-0000-0000-0000000000a2,raj.two
00000000-0000-0000-0000-0000000000a3,raj.three
CSV
cat > "$tmp/d2.csv" <<CSV
user_id,target_role
00000000-0000-0000-0000-0000000000c1,support_agent
00000000-0000-0000-0000-0000000000c2,sales_executive
CSV
cat > "$tmp/d11.csv" <<CSV
role_name,action,base_role
power_custom,set_base,read_only_viewer
weird_custom,set_base,sales_executive
retired_custom,deactivate,
CSV

# --- dry runs change nothing ---
for op in "d1-usernames:d1" "d2-ghost-roles:d2" "d11-super-admin-base:d11"; do
  f="${op%%:*}"; c="${op##*:}"; out="$(run -v decisions="$tmp/$c.csv" -f "$HERE/$f-dryrun.sql")"
  echo "$out" | grep -q "DRY RUN: rolled back" && [ "$(snap)" = "$before" ] && ok "$f dry run rolls back and changes nothing" 1 || ok "$f dry run rolls back and changes nothing" 0 "$out"
done

# --- guards inside the scripts ---
printf 'user_id,new_username\n00000000-0000-0000-0000-0000000000a2,SOLO\n' > "$tmp/bad1.csv"
run -v decisions="$tmp/bad1.csv" -f "$HERE/d1-usernames-dryrun.sql" | grep -E "already taken" | grep -qE "\|\s*1" && ok "D1 check flags a new username that is already taken" 1 || ok "D1 check flags a new username that is already taken" 0 "$(run -v decisions="$tmp/bad1.csv" -f "$HERE/d1-usernames-dryrun.sql" | grep -i taken)"
printf 'user_id,target_role\n00000000-0000-0000-0000-0000000000c1,power_custom\n' > "$tmp/bad2.csv"
run -v decisions="$tmp/bad2.csv" -f "$HERE/d2-ghost-roles-dryrun.sql" | grep -E "super_admin base" | grep -qE "\|\s*1" && ok "D2 check refuses a target role with a super_admin base" 1 || ok "D2 check refuses a target role with a super_admin base" 0 ""
printf 'role_name,action,base_role\npower_custom,set_base,super_admin\nsales_executive,set_base,read_only_viewer\n' > "$tmp/bad3.csv"
out="$(run -v decisions="$tmp/bad3.csv" -f "$HERE/d11-super-admin-base-dryrun.sql")"; echo "$out" | grep -E "not a system role other than super_admin" | grep -qE "\|\s*1" && echo "$out" | grep -E "system role \(never changed" | grep -qE "\|\s*1" && ok "D11 checks refuse a super_admin base and a system role" 1 || ok "D11 checks refuse a super_admin base and a system role" 0 "$out"
printf 'role_name,action,base_role\npower_custom,deactivate,\n' > "$tmp/bad4.csv"
run -v decisions="$tmp/bad4.csv" -f "$HERE/d11-super-admin-base-dryrun.sql" | grep -E "still has active holders" | grep -qE "\|\s*1" && ok "D11 check refuses to deactivate a role with active holders" 1 || ok "D11 check refuses to deactivate a role with active holders" 0 ""
[ "$(snap)" = "$before" ] && ok "the refused runs changed nothing" 1 || ok "the refused runs changed nothing" 0 ""

# --- apply: D11 first (the holder of power_custom keeps the role, now with a valid base), then D1, D2 ---
run -v apply=1 -v decisions="$tmp/d11.csv" -f "$HERE/d11-super-admin-base-dryrun.sql" | grep -q "APPLY=1: committing" && ok "D11 applied" 1 || ok "D11 applied" 0 ""
run -v apply=1 -v decisions="$tmp/d1.csv"  -f "$HERE/d1-usernames-dryrun.sql"          | grep -q "APPLY=1: committing" && ok "D1 applied" 1 || ok "D1 applied" 0 ""
run -v apply=1 -v decisions="$tmp/d2.csv"  -f "$HERE/d2-ghost-roles-dryrun.sql"        | grep -q "APPLY=1: committing" && ok "D2 applied" 1 || ok "D2 applied" 0 ""
[ "$(q "SELECT count(*) FROM audit_logs WHERE new_values->>'dataOperation' IN ('D1','D2','D11')")" = "7" ] && ok "7 audit rows (2 + 2 + 3) with old and new values" 1 || ok "7 audit rows (2 + 2 + 3) with old and new values" 0 "$(q "SELECT count(*) FROM audit_logs WHERE new_values->>'dataOperation' IS NOT NULL")"
[ "$(q "SELECT username FROM users WHERE id='00000000-0000-0000-0000-0000000000a1'")" = "Raj" ] && ok "the login that was not listed kept its username" 1 || ok "the login that was not listed kept its username" 0 ""
[ "$(q "SELECT (previous_values->>'username') || '>' || (new_values->>'username') FROM audit_logs WHERE resource_id='00000000-0000-0000-0000-0000000000a2' AND new_values->>'dataOperation'='D1'")" = " raj >raj.two" ] && ok "D1 audit row keeps the old and the new username" 1 || ok "D1 audit row keeps the old and the new username" 0 "$(q "SELECT previous_values, new_values FROM audit_logs WHERE resource_id='00000000-0000-0000-0000-0000000000a2'")"

# --- the reports are empty, the migration drafts now apply (twice) ---
[ -z "$(run -f "$HERE/d1-usernames-report.sql" | grep -A3 'U1: usernames' | grep -E 'raj')" ] && ok "D1 report is clean after the apply" 1 || ok "D1 report is clean after the apply" 0 ""
for m in M1_users_username_unique M2_roles_name_unique_base_role_check M3_users_role_fkey; do
  a="$(run -v ON_ERROR_STOP=1 -f "$PEND/$m.sql")"; b="$(run -v ON_ERROR_STOP=1 -f "$PEND/$m.sql")"
  echo "$a$b" | grep -q "ERROR" && ok "$m applies twice after the clean-up" 0 "$a $b" || ok "$m applies twice after the clean-up" 1
done
q "INSERT INTO users (email,name,username,role,password_hash) VALUES ('dup@x.test','d','RAJ.TWO','sales_executive','x')" | grep -q "ERROR" && ok "the username index now refuses a duplicate" 1 || ok "the username index now refuses a duplicate" 0 ""
q "INSERT INTO users (email,name,role,password_hash) VALUES ('g@x.test','g','ghost_again','x')" | grep -q "violates foreign key" && ok "the foreign key now refuses a ghost role" 1 || ok "the foreign key now refuses a ghost role" 0 ""
q "INSERT INTO roles (name,label,base_role) VALUES ('another','a','super_admin')" | grep -q "ERROR" && ok "the CHECK now refuses a super_admin base" 1 || ok "the CHECK now refuses a super_admin base" 0 ""

echo; echo "$pass passed, $fail failed"; [ "$fail" = "0" ]
