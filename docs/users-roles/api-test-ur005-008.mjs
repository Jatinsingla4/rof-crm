// Users & Roles, UR-005 / UR-008: database integrity for usernames and roles.
// The three constraints are drafts in docs/users-roles/pending-migrations/ (they join `main` only after their data operations are
// approved). This test applies them to the DISPOSABLE test database (idempotent, no data change), proves they fail closed on bad
// data, and proves the application behaves under races. Never run it against production or Neon.
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-ur005-008.mjs   (needs psql env)
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const B = process.env.BASE || 'http://localhost:3010/api';
const PSQL = process.env.PSQL || 'psql';
const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'pending-migrations');
const sql = (q) => execFileSync(PSQL, ['-X', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8' }).trim();
const trySql = (q) => { const r = spawnSync(PSQL, ['-X', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8' }); return { ok: r.status === 0, err: r.stderr }; };
const file = (f) => { const r = spawnSync(PSQL, ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', path.join(DIR, f)], { encoding: 'utf8' }); return { ok: r.status === 0, err: r.stderr }; };
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : (fail++), console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };
const call = (tok) => async (m, p, b) => {
  const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
  let j = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
};
const A = call((await call()('POST', '/auth/login', { email: 'super_admin@test.local', password: 'Test#Pass1234' })).j.token);
const U = Date.now().toString(36).slice(-6);
const PW = 'Ur58#Pass' + U.replace(/\D/g, '') + '1';

// ---------- fail closed on bad data, change nothing ----------
sql(`DROP INDEX IF EXISTS users_username_lower_btrim_key`);
const dupA = `ur58dupA${U}@test.local`, dupB = `ur58dupB${U}@test.local`;
sql(`INSERT INTO users (email, name, username, role, password_hash, is_active) SELECT '${dupA}', 'dup A', 'Ur58Dup${U}', 'sales_executive', password_hash, false FROM users WHERE email='sales_executive@test.local'`);
sql(`INSERT INTO users (email, name, username, role, password_hash, is_active) SELECT '${dupB}', 'dup B', ' ur58dup${U} ', 'sales_executive', password_hash, false FROM users WHERE email='sales_executive@test.local'`);
let r = file('M1_users_username_unique.sql');
t('M1 on data with two usernames that differ only in case/spaces: fails with a readable message', !r.ok && /duplicate usernames/.test(r.err), r.err);
t('M1 failure changed nothing (no index created)', sql(`SELECT count(*) FROM pg_indexes WHERE indexname='users_username_lower_btrim_key'`) === '0');
sql(`DELETE FROM users WHERE email IN ('${dupA}','${dupB}')`);

// ---------- apply the drafts (twice: idempotent) ----------
for (const f of ['M1_users_username_unique.sql', 'M2_roles_name_unique_base_role_check.sql', 'M3_users_role_fkey.sql']) {
  const a = file(f), b = file(f);
  t(`${f}: applies, and applies again`, a.ok && b.ok, (a.err || b.err).slice(0, 300));
}

// ---------- UR-005: ten parallel creates / renames with one username ----------
const mk = (n, username) => A('POST', '/users/employee-login', { username, email: `ur58.${U}.${n}@test.local`, password: PW, confirmPassword: PW, role: 'sales_executive' });
const un = 'ur58u' + U;
const variants = [un, un.toUpperCase(), un, un.toUpperCase(), un, un, un.toUpperCase(), un, un, un.toUpperCase()];
let res = await Promise.all(variants.map((v, i) => mk(i, v)));
const created = res.filter((x) => x.s === 201), refused = res.filter((x) => x.s === 409);
t('10 parallel creates with one username (any case): exactly one 201 and nine 409', created.length === 1 && refused.length === 9, res.map((x) => x.s).join());
t('the 409 says "Username already exists" (also when the index decided the race)', refused.every((x) => /Username/i.test(x.j?.error || '')), JSON.stringify(refused.map((x) => x.j?.error)));
const ids = [];
for (let i = 0; i < 10; i++) { const x = await mk('r' + i, `ur58r${i}${U}`); ids.push(x.j?.data?.userId); }
const target = 'ur58ren' + U;
res = await Promise.all(ids.map((id, i) => A('PATCH', `/users/employee-login/${id}`, { username: i % 2 ? target : target.toUpperCase() })));
t('10 parallel renames to one username: exactly one 200 and nine 409', res.filter((x) => x.s === 200).length === 1 && res.filter((x) => x.s === 409).length === 9, res.map((x) => x.s).join());
sql(`INSERT INTO users (email, name, username, role, password_hash, is_active) SELECT 'ur58b1.${U}@test.local','b1',NULL,'sales_executive',password_hash,false FROM users WHERE email='sales_executive@test.local'`);
const blank = trySql(`INSERT INTO users (email, name, username, role, password_hash, is_active) SELECT 'ur58b2.${U}@test.local','b2','  ','sales_executive',password_hash,false FROM users WHERE email='sales_executive@test.local'`);
const blank2 = trySql(`INSERT INTO users (email, name, username, role, password_hash, is_active) SELECT 'ur58b3.${U}@test.local','b3','','sales_executive',password_hash,false FROM users WHERE email='sales_executive@test.local'`);
t('NULL and blank usernames can coexist', blank.ok && blank2.ok, blank.err + blank2.err);

// ---------- UR-008: roles ----------
t('roles.name cannot be duplicated (same spelling)', !trySql(`INSERT INTO roles (name, label, is_system, is_active) VALUES ('sales_executive','dup',false,true)`).ok);
t('roles.name cannot be duplicated (other case)', !trySql(`INSERT INTO roles (name, label, is_system, is_active) VALUES ('Sales_Executive','dup',false,true)`).ok);
t('a role with base_role super_admin cannot be stored', !trySql(`INSERT INTO roles (name, label, base_role, is_system, is_active) VALUES ('ur58x${U}','x','super_admin',false,true)`).ok);
t('users.role cannot reference a missing role (23503)', /23503|violates foreign key/.test(trySql(`INSERT INTO users (email, name, role, password_hash, is_active) VALUES ('ur58g.${U}@test.local','ghost','no_such_role_${U}','x',false)`).err));
const rn = 'ur58role' + U;
let rr = await A('POST', '/roles', { name: rn, label: 'UR58', baseRole: 'read_only_viewer', pageIds: [] });
t('custom role created', rr.s === 201, JSON.stringify(rr.j));
const holder = await A('POST', '/users/employee-login', { username: 'ur58h' + U, email: `ur58h.${U}@test.local`, password: PW, confirmPassword: PW, role: rn });
rr = await A('DELETE', '/roles/' + rn);
t('deleting a role that a login holds: 409', rr.s === 409, JSON.stringify(rr.j));
await A('PATCH', `/users/employee-login/${holder.j.data.userId}`, { role: 'sales_executive' });
rr = await A('DELETE', '/roles/' + rn);
t('deleting an unheld custom role works', rr.s === 200, JSON.stringify(rr.j));

// assign while deleting: never a ghost role (both orders happen)
let ghosts = 0, assigned = 0, deleted = 0; const codes = [];
const rounds = 12;
for (let i = 0; i < rounds; i++) {
  const name = `ur58race${i}${U}`;
  await A('POST', '/roles', { name, label: 'race', baseRole: 'read_only_viewer', pageIds: [] });
  const [d, p] = await Promise.all([A('DELETE', '/roles/' + name), A('PATCH', `/users/employee-login/${holder.j.data.userId}`, { role: name })]);
  codes.push(d.s, p.s); if (d.s === 200) deleted++; if (p.s === 200) assigned++;
  ghosts += Number(sql(`SELECT count(*) FROM users u WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.name = u.role)`));
  await A('PATCH', `/users/employee-login/${holder.j.data.userId}`, { role: 'sales_executive' });
  await A('DELETE', '/roles/' + name);
}
t(`assign-while-delete, ${rounds} rounds: no login ever ends on a missing role`, ghosts === 0, `ghosts=${ghosts} (deleted ${deleted}, assigned ${assigned})`);
t('no server error in the race (every outcome is 200, 400, 404 or 409)', codes.every((c) => [200, 400, 404, 409].includes(c)), [...new Set(codes)].join());

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
