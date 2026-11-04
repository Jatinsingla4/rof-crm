// Users & Roles, Phase 1 (code only, no schema): audit old/new values, one-at-a-time super_admin changes, username audit,
// approver stays unsupported, menu-visibility-only roles, and the shared helpers (notCreator, super-admin check,
// APP_ENV / SCOPE_MODE reader, startup refusal).
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-phase1.mjs
// Needs psql (PSQL, PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE) to read audit rows and to set up the super_admin race.
// The helper checks import the compiled files; P1_DIST points at a build (default: packages/api/dist, which CI builds first).
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const B = process.env.BASE || 'http://localhost:3010/api';
const PSQL = process.env.PSQL || 'psql';
const sql = (q) => execFileSync(PSQL, ['-X', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8' }).trim();
const DIST = process.env.P1_DIST || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../packages/api/dist');
let pass = 0, fail = 0; const fails = [];
const t = (n, ok, x = '') => { ok ? pass++ : (fail++, fails.push(n + ' -> ' + x)); console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };
const call = (tok) => async (m, p, b) => {
  const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
  let j = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
};
const login = async (email, password = 'Test#Pass1234') => (await call()('POST', '/auth/login', { email, password })).j?.token;
const A = call(await login('super_admin@test.local'));
const PM = call(await login('project_manager@test.local'));
const U = Date.now().toString(36).slice(-6);
const PW = 'Phase#Pass' + U.replace(/\D/g, '') + '1';
// The latest audit row of a resource: { p: previous_values, n: new_values }
const audit = (type, id, action) => JSON.parse(sql(`SELECT json_build_object('p', previous_values, 'n', new_values) FROM audit_logs WHERE resource_type='${type}' AND resource_id='${id}' AND action='${action}' ORDER BY timestamp DESC LIMIT 1`) || 'null');
const keysDeep = (o) => (o && typeof o === 'object' ? Object.entries(o).flatMap(([k, v]) => [k, ...keysDeep(v)]) : []);
const secretKeys = (o) => keysDeep(o).filter((k) => /password$|^password|hash|token|secret/i.test(k) && k !== 'passwordChanged');
let r;

const form = (await A('GET', '/users/employee-login/form-data')).j.data;
const companyIds = form.companies.slice(0, 2).map((c) => c.id);
const nav = (await A('GET', '/roles/nav-pages')).j.data; const pages = Object.values(nav).flat();

// ---------- UR-009: audit rows keep old and new values, never secrets ----------
const rn = 'p1_role_' + U;
r = await A('POST', '/roles', { name: rn, label: 'Phase One', description: 'first', baseRole: 'read_only_viewer', pageIds: [pages[0].id, pages[1].id] });
t('role create: 201', r.s === 201, r.s);
const roleId = r.j?.data?.id;
r = await A('PATCH', '/roles/' + rn, { label: 'Phase One B', baseRole: 'sales_executive' });
t('role edit: 200', r.s === 200, r.s);
let a = audit('role', roleId, 'update');
t('role edit audit: previous holds the old label, description and base role', a?.p?.label === 'Phase One' && a?.p?.description === 'first' && a?.p?.base_role === 'read_only_viewer', JSON.stringify(a?.p));
t('role edit audit: new holds the new label and base role', a?.n?.label === 'Phase One B' && a?.n?.base_role === 'sales_executive', JSON.stringify(a?.n));

r = await A('PUT', '/roles/' + rn + '/pages', { pageIds: [pages[1].id, pages[2].id] });
t('role pages: 200', r.s === 200 && r.j?.data?.pages === 2, JSON.stringify(r.j));
a = audit('role', roleId, 'update');
t('role pages audit: previous count is the old count', a?.p?.pages === 2 && a?.p?.role === rn, JSON.stringify(a?.p));
t('role pages audit: new lists the page added and the page removed', a?.n?.pages === 2 && JSON.stringify(a?.n?.added) === JSON.stringify([pages[2].id]) && JSON.stringify(a?.n?.removed) === JSON.stringify([pages[0].id]), JSON.stringify(a?.n));
// Role Menu Access is menu visibility only: a role with no pages still gets what its base role allows from the API
r = await A('PUT', '/roles/' + rn + '/pages', { pageIds: [] });
t('role pages: empty list accepted', r.s === 200 && r.j?.data?.pages === 0, JSON.stringify(r.j));
a = audit('role', roleId, 'update');
t('role pages audit: emptying records both removed pages', a?.n?.removed?.length === 2 && a?.p?.pages === 2, JSON.stringify(a));

const email1 = `p1.${U}@test.local`, uname1 = 'p1user' + U;
r = await A('POST', '/users/employee-login', {
  username: uname1, email: email1, password: PW, confirmPassword: PW, role: 'sales_executive',
  processPermissions: [{ processName: 'receipt', isMaker: true, isChecker: false }], companyIds: companyIds.slice(0, 1),
});
t('login create: 201', r.s === 201, JSON.stringify(r.j));
const uid1 = r.j?.data?.userId;
a = audit('user', uid1, 'create');
t('login create audit: role, process rights and company ids are recorded', a?.n?.role === 'sales_executive' && JSON.stringify(a?.n?.processes) === JSON.stringify(['receipt:maker']) && JSON.stringify(a?.n?.companyIds) === JSON.stringify(companyIds.slice(0, 1)), JSON.stringify(a?.n));
t('login create audit: no secret keys and no password value anywhere', secretKeys(a).length === 0 && !JSON.stringify(a).includes(PW), JSON.stringify(secretKeys(a)));

const PW2 = PW + 'x';
r = await A('PATCH', '/users/employee-login/' + uid1, {
  role: 'accounts_finance', authorizedPrint: true, unitStatusAccess: 'available', password: PW2,
  processPermissions: [{ processName: 'receipt', isMaker: true, isChecker: true }, { processName: 'jv_refund_drcr', isMaker: false, isChecker: true }],
  companyIds, assignedProjectIds: [],
});
t('login edit: 200', r.s === 200, JSON.stringify(r.j));
a = audit('user', uid1, 'update');
t('login edit audit: previous role, print flag and unit status', a?.p?.role === 'sales_executive' && a?.p?.authorized_print === false && a?.p?.unit_status_access === 'all', JSON.stringify(a?.p));
t('login edit audit: new role, print flag and unit status', a?.n?.role === 'accounts_finance' && a?.n?.authorized_print === true && a?.n?.unit_status_access === 'available', JSON.stringify(a?.n));
t('login edit audit: process rights before and after as lists', JSON.stringify(a?.p?.processes) === JSON.stringify(['receipt:maker']) && JSON.stringify(a?.n?.processes) === JSON.stringify(['jv_refund_drcr:checker', 'receipt:maker,checker']), JSON.stringify([a?.p?.processes, a?.n?.processes]));
t('login edit audit: company ids before and after', JSON.stringify(a?.p?.companyIds) === JSON.stringify(companyIds.slice(0, 1)) && JSON.stringify([...a?.n?.companyIds].sort()) === JSON.stringify([...companyIds].sort()), JSON.stringify([a?.p?.companyIds, a?.n?.companyIds]));
t('login edit audit: project ids before and after (assigned_project_ids)', Array.isArray(a?.p?.assigned_project_ids) && Array.isArray(a?.n?.assigned_project_ids), JSON.stringify([a?.p?.assigned_project_ids, a?.n?.assigned_project_ids]));
t('login edit audit: the password change is noted, the password and hash never are', a?.n?.passwordChanged === true && secretKeys(a).length === 0 && !JSON.stringify(a).includes(PW2), JSON.stringify(secretKeys(a)));

// ---------- UR-013: username change keeps old and new in the audit ----------
const uname2 = 'p1renamed' + U;
r = await A('PATCH', '/users/' + uid1, { username: uname2 });
t('username: super_admin changes it -> 200', r.s === 200, JSON.stringify(r.j));
a = audit('user', uid1, 'update');
t('username audit: previous is the old username and new is the new one', a?.p?.username === uname1 && a?.n?.username === uname2, JSON.stringify(a));
const taken = (await A('GET', '/users/employee-login')).j.data.find((u) => u.username && u.id !== uid1)?.username;
if (taken) { r = await A('PATCH', '/users/' + uid1, { username: taken.toUpperCase() }); t('username: duplicate in another letter case -> 409', r.s === 409, r.s); }
r = await PM('PATCH', '/users/' + uid1, { username: 'x' + U + 'pm' });
t('username: project_manager cannot change one -> 403', r.s === 403, r.s);

// ---------- UR-015: approver stays unsupported ----------
r = await A('PATCH', '/users/' + uid1, { processPermissions: [{ processName: 'receipt', isMaker: true, isApprover: true }] });
t('approver: granting it -> 400', r.s === 400 && /Approver/.test(r.j?.error || ''), JSON.stringify(r.j));
r = await A('POST', '/users/employee-login', { username: 'p1ap' + U, email: `p1ap.${U}@test.local`, password: PW, confirmPassword: PW, role: 'sales_executive', processPermissions: [{ processName: 'receipt', isChecker: true, isApprover: true }] });
t('approver: also refused on create -> 400', r.s === 400, r.s);
const tokU1 = await login(email1, PW2);
r = await call(tokU1)('GET', '/users/me');
t('approver: /me still returns the process rights map and never lists approver', r.s === 200 && Array.isArray(r.j?.data?.processPermissions?.receipt) && !JSON.stringify(r.j.data.processPermissions).includes('approver'), JSON.stringify(r.j?.data?.processPermissions));

// ---------- UR-010: two super admins cannot remove each other ----------
const sa = async (n) => { const e = `p1sa${n}.${U}@test.local`; const x = await A('POST', '/users/employee-login', { username: `p1sa${n}${U}`, email: e, password: PW, confirmPassword: PW, role: 'super_admin' }); return { email: e, id: x.j?.data?.userId, s: x.s }; };
const X = await sa(1), Y = await sa(2);
t('race setup: two extra super_admins created', X.s === 201 && Y.s === 201, `${X.s} ${Y.s}`);
const others = sql(`SELECT id FROM users WHERE role='super_admin' AND is_active AND id NOT IN ('${X.id}','${Y.id}')`).split('\n').filter(Boolean);
let bothWon = 0, worstActive = 99, rounds = 12;
try {
  if (others.length) sql(`UPDATE users SET is_active=false WHERE id IN (${others.map((i) => `'${i}'`).join(',')})`);
  for (let i = 0; i < rounds; i++) {
    sql(`UPDATE users SET is_active=true WHERE id IN ('${X.id}','${Y.id}')`);
    const [tx, ty] = await Promise.all([login(X.email, PW), login(Y.email, PW)]);
    const [rx, ry] = await Promise.all([call(tx)('PATCH', '/users/' + Y.id, { isActive: false }), call(ty)('PATCH', '/users/' + X.id, { isActive: false })]);
    if (rx.s === 200 && ry.s === 200) bothWon++;
    worstActive = Math.min(worstActive, Number(sql(`SELECT count(*) FROM users WHERE role='super_admin' AND is_active`)));
  }
} finally {
  if (others.length) sql(`UPDATE users SET is_active=true WHERE id IN (${others.map((i) => `'${i}'`).join(',')})`);
  sql(`UPDATE users SET is_active=false WHERE id IN ('${X.id}','${Y.id}')`);
}
t(`super_admin race: ${rounds} rounds of two admins deactivating each other never end with both succeeding`, bothWon === 0, `${bothWon} rounds where both returned 200`);
t('super_admin race: at least one active super_admin remained in every round', worstActive >= 1, `lowest count ${worstActive}`);

// ---------- Helpers ----------
const mod = async (f) => { const m = await import(path.join(DIST, f)); return m.default ?? m; };
const { notCreator } = await mod('utils/not-creator.js');
const code = (fn) => { try { fn(); return 0; } catch (e) { return e.http || -1; } };
t('notCreator: a different creator passes', code(() => notCreator({ userId: 'a' }, 'b')) === 0);
t('notCreator: the creator is refused (403)', code(() => notCreator({ userId: 'a' }, 'a')) === 403);
t('notCreator: super_admin is not exempt (no role is looked at)', code(() => notCreator({ userId: 'a', userRole: 'super_admin' }, 'a')) === 403);
t('notCreator: an unknown (NULL) creator blocks (409)', code(() => notCreator({ userId: 'a' }, null)) === 409 && code(() => notCreator({ userId: 'a' }, undefined)) === 409);
t('notCreator: no signed-in user is refused', code(() => notCreator({}, 'b')) === 403);

const { isSuperAdmin, requireSuperAdmin } = await mod('middleware/superAdmin.js');
t('super admin check: the system super_admin is one', isSuperAdmin({ userRole: 'super_admin', roleName: 'super_admin' }) === true);
t('super admin check: a custom role that resolves to super_admin is not', isSuperAdmin({ userRole: 'super_admin', roleName: 'custom_x' }) === false);
t('super admin check: other roles are not', isSuperAdmin({ userRole: 'project_manager', roleName: 'project_manager' }) === false && isSuperAdmin({}) === false);
let sent = null; requireSuperAdmin({ userRole: 'sales_executive', roleName: 'sales_executive' }, { status: (n) => ({ json: (b) => { sent = [n, b]; } }) }, () => { sent = 'next'; });
t('super admin guard: others get 403', sent?.[0] === 403, JSON.stringify(sent));

const { withoutSecrets } = await mod('utils/audit-values.js');
const cleaned = withoutSecrets({ role: 'x', password: 'p', password_hash: 'h', currentPassword: 'c', token_version: 3, api_token: 't', nested: { secret_key: 's', ok: 1 }, passwordChanged: true });
t('audit values: secret keys are dropped, others kept', JSON.stringify(cleaned) === JSON.stringify({ role: 'x', nested: { ok: 1 }, passwordChanged: true }), JSON.stringify(cleaned));

const { loadAppConfig } = await mod('utils/app-config.js');
const cfg = (env) => { try { return loadAppConfig(env); } catch (e) { return { error: e.message }; } };
const P = { NODE_ENV: 'production' };
t('app config: production without APP_ENV refuses to start', /APP_ENV must be/.test(cfg(P).error || ''));
t('app config: production with an invalid APP_ENV refuses to start', /APP_ENV must be/.test(cfg({ ...P, APP_ENV: 'prod' }).error || '') && /APP_ENV must be/.test(cfg({ ...P, APP_ENV: 'Production' }).error || ''));
t('app config: production + APP_ENV=production, SCOPE_MODE unset -> strict', JSON.stringify(cfg({ ...P, APP_ENV: 'production' })) === JSON.stringify({ appEnv: 'production', scopeMode: 'strict' }));
t('app config: production refuses SCOPE_MODE=log', /only allowed with APP_ENV=staging/.test(cfg({ ...P, APP_ENV: 'production', SCOPE_MODE: 'log' }).error || ''));
t('app config: staging may use SCOPE_MODE=log', JSON.stringify(cfg({ ...P, APP_ENV: 'staging', SCOPE_MODE: 'log' })) === JSON.stringify({ appEnv: 'staging', scopeMode: 'log' }));
t('app config: an unknown SCOPE_MODE means strict', cfg({ ...P, APP_ENV: 'staging', SCOPE_MODE: 'loose' }).scopeMode === 'strict' && cfg({ ...P, APP_ENV: 'production', SCOPE_MODE: 'enforce' }).scopeMode === 'strict');
t('app config: development needs no APP_ENV and is strict', JSON.stringify(cfg({ NODE_ENV: 'development' })) === JSON.stringify({ appEnv: null, scopeMode: 'strict' }) && JSON.stringify(cfg({})) === JSON.stringify({ appEnv: null, scopeMode: 'strict' }));
t('app config: development cannot use SCOPE_MODE=log either', /only allowed with APP_ENV=staging/.test(cfg({ NODE_ENV: 'development', SCOPE_MODE: 'log' }).error || ''));
t('app config: development with APP_ENV=staging may use log', cfg({ NODE_ENV: 'development', APP_ENV: 'staging', SCOPE_MODE: 'log' }).scopeMode === 'log');

// The real process stops at start: nothing listens, exit code is not 0
const clean = mkdtempSync(path.join(tmpdir(), 'p1-start-'));
const start = (env) => spawnSync(process.execPath, [path.join(DIST, 'index.js')], { cwd: clean, env: { PATH: process.env.PATH, JWT_SECRET: 'x', PORT: '0', ...env }, encoding: 'utf8', timeout: 30000 });
let s = start({ NODE_ENV: 'production' });
t('startup: NODE_ENV=production without APP_ENV exits with a clear message', s.status !== 0 && /APP_ENV must be/.test(s.stderr), `${s.status} ${(s.stderr || '').slice(0, 160)}`);
s = start({ NODE_ENV: 'production', APP_ENV: 'production', SCOPE_MODE: 'log' });
t('startup: production with SCOPE_MODE=log exits with a clear message', s.status !== 0 && /SCOPE_MODE=log/.test(s.stderr), `${s.status} ${(s.stderr || '').slice(0, 160)}`);

console.log(`RESULT: ${pass} passed, ${fail} failed`);
if (fail) { console.log('FAILED:\n' + fails.join('\n')); process.exit(1); }
