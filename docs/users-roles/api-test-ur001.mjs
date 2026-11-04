// Users & Roles, UR-001: super_admin-only routes, id+name-only directories, own-role pages, no super_admin bypass for a custom role.
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-ur001.mjs
// Needs psql (PSQL, PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE) to force a custom role's base role to super_admin (disposable DB only).
import { execFileSync } from 'node:child_process';

const B = process.env.BASE || 'http://localhost:3010/api';
const PSQL = process.env.PSQL || 'psql';
const sql = (q) => execFileSync(PSQL, ['-X', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8' }).trim();
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : (fail++), console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };
const call = (tok) => async (m, p, b) => {
  const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
  let j = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
};
const login = async (email, password = 'Test#Pass1234') => (await call()('POST', '/auth/login', { email, password })).j?.token;
const ROLES = ['super_admin', 'project_manager', 'sales_executive', 'accounts_finance', 'support_agent', 'read_only_viewer'];
const C = {}; for (const r of ROLES) C[r] = call(await login(`${r}@test.local`));
const A = C.super_admin;
const U = Date.now().toString(36).slice(-6);
const PW = 'Ur001#Pass' + U.replace(/\D/g, '') + '1';
const UUID = '00000000-0000-0000-0000-000000000001';

// ---------- every SA-only route: SA is let through (never 403), every other role gets 403 ----------
const SA_ONLY = [
  ['GET', '/users'], ['GET', '/users/' + UUID], ['GET', '/users/audit-logs'], ['GET', '/users/activity'],
  ['GET', '/users/employee-login/form-data'], ['GET', '/users/employee-login'], ['GET', `/users/employee-login/${UUID}/ips`],
  ['POST', '/users/employee-login', {}], ['PATCH', `/users/employee-login/${UUID}`, {}], ['POST', `/users/employee-login/${UUID}/sign-out`, {}],
  ['POST', `/users/employee-login/${UUID}/ips`, {}], ['DELETE', `/users/employee-login/${UUID}/ips/${UUID}`], ['PATCH', '/users/' + UUID, {}],
  ['GET', '/employees'], ['GET', '/employees/' + UUID], ['GET', '/employees/teams'], ['GET', '/employees/departments'], ['GET', '/employees/report'], ['GET', '/employees/tree'],
  ['POST', '/employees', {}], ['PATCH', '/employees/' + UUID, {}], ['PATCH', `/employees/${UUID}/set-manager`, {}],
  ['POST', '/employees/departments', {}], ['PATCH', '/employees/departments/' + UUID, {}], ['DELETE', '/employees/departments/' + UUID],
  ['POST', '/employees/teams', {}], ['PATCH', '/employees/teams/' + UUID, {}], ['DELETE', '/employees/teams/' + UUID],
  ['GET', `/employees/teams/${UUID}/members`], ['POST', `/employees/teams/${UUID}/members`, {}], ['DELETE', `/employees/teams/${UUID}/members/${UUID}`], ['PATCH', `/employees/teams/${UUID}/set-head`, {}],
  ['GET', '/roles'], ['GET', '/roles/matrix'], ['GET', '/roles/nav-pages'], ['POST', '/roles', {}], ['PATCH', '/roles/nope', {}], ['PUT', '/roles/nope/pages', {}], ['DELETE', '/roles/nope'],
];
let bad = [];
for (const [m, p, b] of SA_ONLY) {
  for (const role of ROLES.slice(1)) { const r = await C[role](m, p, b); if (r.s !== 403) bad.push(`${role} ${m} ${p} -> ${r.s}`); }
  const s = await A(m, p, b); if (s.s === 403 || s.s === 401) bad.push(`super_admin ${m} ${p} -> ${s.s}`);
}
t(`${SA_ONLY.length} super_admin-only routes: 403 for the other five roles, SA never refused`, bad.length === 0, bad.slice(0, 6).join(' | '));

// ---------- open to every signed-in user: directories (id+name only), own profile, own role pages ----------
for (const role of ROLES) {
  for (const p of ['/users/directory', '/employees/directory']) {
    const r = await C[role]('GET', p);
    const rows = r.j?.data || [];
    t(`${role} GET ${p}: 200, keys exactly id+name`, r.s === 200 && rows.every((x) => Object.keys(x).sort().join() === 'id,name'), `${r.s} ${JSON.stringify(rows[0])}`);
  }
  t(`${role} GET /users/me: 200`, (await C[role]('GET', '/users/me')).s === 200);
  const own = await C[role]('GET', `/roles/${role}/pages`);
  t(`${role} own role pages: 200`, own.s === 200, own.s);
  if (role !== 'super_admin') t(`${role} another role's pages: 403`, (await C[role]('GET', '/roles/super_admin/pages')).s === 403);
}
const sAid = sql(`SELECT id FROM users WHERE email='super_admin@test.local'`);
for (const p of ['/users/directory', '/employees/directory']) {
  const ids = ((await C.project_manager('GET', p)).j?.data || []).map((x) => x.id);
  const bad = ids.length ? sql(`SELECT count(*) FROM users WHERE id IN (${ids.map((x) => `'${x}'`).join(',')}) AND (NOT is_active OR role = 'super_admin')`) : '0'; // one query: a psql per row blocks long enough for idle sockets to be closed
  t(`${p}: no super_admin and no inactive user listed`, !ids.includes(sAid) && bad === '0', bad);
}

// ---------- a custom role whose base role is forced to super_admin gets nothing special ----------
const rn = 'ur1_role_' + U;
let r = await A('POST', '/roles', { name: rn, label: 'UR001 custom', baseRole: 'read_only_viewer', pageIds: [] });
t('custom role created', r.s === 201, r.s);
const email = `ur1.${U}@test.local`;
r = await A('POST', '/users/employee-login', { username: 'ur1u' + U, email, password: PW, confirmPassword: PW, role: rn });
t('login with the custom role created', r.s === 201, JSON.stringify(r.j));
const uid = r.j?.data?.userId;
// What manual SQL or old data could do; the API refuses it, and once the roles CHECK (draft M2) is applied the database refuses it too.
// To prove the code does not trust the data, the CHECK is lifted for this block only (disposable DB) and put back afterwards.
const hadCheck = sql(`SELECT count(*) FROM pg_constraint WHERE conname='roles_base_role_not_super_admin'`) === '1';
if (hadCheck) {
  t('with the roles CHECK in place the database refuses a super_admin base role', !(() => { try { sql(`UPDATE roles SET base_role='super_admin' WHERE name='${rn}'`); return true; } catch { return false; } })());
  sql(`ALTER TABLE roles DROP CONSTRAINT roles_base_role_not_super_admin`);
}
sql(`UPDATE roles SET base_role='super_admin' WHERE name='${rn}'`);
const F = call(await login(email, PW));
bad = [];
for (const [m, p, b] of SA_ONLY.slice(0, 12)) { const x = await F(m, p, b); if (x.s !== 403) bad.push(`${m} ${p} -> ${x.s}`); }
t('forced super_admin base: 403 on SA-only routes', bad.length === 0, bad.join(' | '));
t('forced super_admin base: still refused on a super_admin-bypass route (/test-data)', (await F('GET', '/test-data/status')).s === 403);
for (const p of ['/users/directory', '/employees/directory']) {
  const ids = ((await A('GET', p)).j?.data || []).map((x) => x.id);
  t(`${p}: the forced custom role is not listed`, !ids.includes(uid));
}
sql(`UPDATE roles SET base_role='read_only_viewer' WHERE name='${rn}'`);
if (hadCheck) sql(`ALTER TABLE roles ADD CONSTRAINT roles_base_role_not_super_admin CHECK (base_role IS NULL OR base_role <> 'super_admin')`);

// ---------- menu visibility never changes an API status ----------
r = await A('PUT', `/roles/${rn}/pages`, { pageIds: [] });
t('role with zero menu pages: still gets directory 200', r.s === 200 && (await call(await login(email, PW))('GET', '/users/directory')).s === 200);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
