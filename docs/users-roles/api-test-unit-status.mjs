// Users & Roles, UR-007 (plan 8.2): unit status access fails closed. NULL, unknown or 'none' mean no inventory access; 'all' is an explicit grant;
// each explicit value shows exactly its statuses; the other inventory views refuse a login without access; a typed unit id is refused too;
// the lookup for non-inventory screens still works; new logins start with 'none'; super_admin is unchanged.
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-unit-status.mjs   (needs psql env; the compiled helper for the unit check)
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const B = process.env.BASE || 'http://localhost:3010/api';
const PSQL = process.env.PSQL || 'psql';
const sql = (q) => execFileSync(PSQL, ['-X', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8' }).trim();
const DIST = process.env.P1_DIST || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../packages/api/dist');
const H = await import(pathToFileURL(path.join(DIST, 'utils/unit-grant.js')).href);
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : (fail++), console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };
const raw = async (tok, m, p, b) => {
  const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: b === undefined ? undefined : JSON.stringify(b) });
  let j = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
};
const login = async (email, password) => (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()).token;
const SA = await login('super_admin@test.local', 'Test#Pass1234');
const U = Date.now().toString(36).slice(-6), PW = 'Us#Pass' + U.replace(/\D/g, '') + '1x';
const mk = async (name, access) => {
  const email = `us.${name}.${U}@test.local`;
  const r = await raw(SA, 'POST', '/users/employee-login', { username: `us${name}${U}`, email, password: PW, confirmPassword: PW, role: 'project_manager', ...(access ? { unitStatusAccess: access } : {}) });
  if (r.s !== 201) throw new Error(name + ' ' + JSON.stringify(r));
  return { name, id: r.j.data.userId, tok: await login(email, PW) };
};
const none = await mk('none', 'none'), avail = await mk('avail', 'available'), ah = await mk('ah', 'available_hold'), all = await mk('all', 'all'), dflt = await mk('default');
const nul = await mk('null', 'none'); sql(`UPDATE users SET unit_status_access = NULL WHERE id = '${nul.id}'`);
const weird = await mk('weird', 'none'); sql(`UPDATE users SET unit_status_access = 'gibberish' WHERE id = '${weird.id}'`);
const empty = await mk('empty', 'none'); sql(`UPDATE users SET unit_status_access = '' WHERE id = '${empty.id}'`);
const rows = async (u, p = '/units?pageSize=50') => (await raw(u.tok, 'GET', p)).j?.data || [];

t('a new login created without a unit status gets none', sql(`SELECT unit_status_access FROM users WHERE id = '${dflt.id}'`) === 'none');
// ---------- the list ----------
for (const u of [none, nul, weird, empty, dflt]) { const r = await raw(u.tok, 'GET', '/units?pageSize=50'); t(`list: ${u.name} (none, NULL, unknown, empty, default) sees no unit`, r.s === 200 && (r.j?.data || []).length === 0, r.s + ' ' + (r.j?.data || []).length); }
const sa = await rows({ tok: SA }), al = await rows(all);
t('list: super_admin and an explicit all see units', sa.length > 0 && al.length > 0, `${sa.length} ${al.length}`);
const av = await rows(avail); t('list: available shows only available units', av.length > 0 && av.every((x) => x.status === 'available'), JSON.stringify([...new Set(av.map((x) => x.status))]));
const hh = await rows(ah); t('list: available_hold shows available, held and locked only', hh.length > 0 && hh.every((x) => ['available', 'held', 'locked'].includes(x.status)), JSON.stringify([...new Set(hh.map((x) => x.status))]));
// ---------- the other inventory views ----------
const pid = sql(`SELECT id FROM projects ORDER BY created_at LIMIT 1`), uid = sql(`SELECT id FROM units ORDER BY created_at LIMIT 1`);
const VIEWS = [`/units/${uid}`, '/units/status-counts', '/units/projects', '/units/towers', `/units/tower/${pid}`, `/units/inventory-summary/${pid}`, `/units/tower-detail?projectId=${pid}`, '/units/status', '/units/areas/report', `/units/${uid}/areas`, `/units/${uid}/areas/history`];
let bad = [];
for (const p of VIEWS) {
  for (const u of [none, nul, weird, empty]) { const r = await raw(u.tok, 'GET', p); if (!(r.s === 403 && /Inventory access is not enabled/.test(r.j?.error || ''))) bad.push(`${u.name} ${p} -> ${r.s}`); }
  const ok = await raw(all.tok, 'GET', p); if (ok.s === 403) bad.push(`all ${p} -> 403`);
  const s = await raw(SA, 'GET', p); if (s.s === 403) bad.push(`super_admin ${p} -> 403`);
}
t(`${VIEWS.length} inventory views: refused to none, NULL, unknown and empty; open to all and super_admin`, bad.length === 0, bad.slice(0, 5).join(' | '));
// ---------- the lookup for screens that are not inventory screens ----------
const lk = await raw(none.tok, 'GET', '/units/lookup?pageSize=20'); t('lookup: a login with none still finds units for paperwork', lk.s === 200 && (lk.j?.data || []).length > 0, lk.s + JSON.stringify(lk.j).slice(0, 80));
const lkAvail = await raw(avail.tok, 'GET', '/units/lookup?pageSize=200'); t('lookup ignores the status grant (a sold unit is listed for available)', lkAvail.s === 200 && (lkAvail.j?.data || []).some((x) => x.status !== 'available'), lkAvail.s);
// ---------- typed unit id ----------
const availUnit = sql(`SELECT id FROM units WHERE status = 'available' LIMIT 1`), bookedUnit = sql(`SELECT id FROM units WHERE status = 'booked' LIMIT 1`);
const NILC = '00000000-0000-0000-0000-0000000000c1', NILB = '00000000-0000-0000-0000-0000000000b1';
const holdBody = (unitId) => ({ unitId, brokerId: NILB, clientName: 'x', clientMobile: '9000000000', durationHours: 1 });
const denied = (r) => r.s === 403 && /inventory access/.test(r.j?.error || '');
if (availUnit) {
  for (const u of [none, nul, weird]) { let r = await raw(u.tok, 'POST', '/inventory-hold', holdBody(availUnit)); t(`typed id: ${u.name} cannot hold an available unit by its id`, denied(r), r.s + JSON.stringify(r.j)); }
  for (const u of [none, nul, weird]) { const r = await raw(u.tok, 'POST', '/allocations', { consumerId: NILC, unitId: availUnit, projectId: pid }); t(`typed id: ${u.name} cannot allot an available unit by its id`, denied(r), r.s + JSON.stringify(r.j)); }
  let r = await raw(avail.tok, 'POST', '/inventory-hold', holdBody(availUnit)); t('typed id: available passes the unit check on an available unit (stops later, broker unknown)', !denied(r) && r.s !== 500, r.s + JSON.stringify(r.j));
  r = await raw(all.tok, 'POST', '/inventory-hold', holdBody(availUnit)); t('typed id: all passes the unit check', !denied(r), r.s);
  r = await raw(SA, 'POST', '/inventory-hold', holdBody(availUnit)); t('typed id: super_admin passes the unit check', !denied(r), r.s);
}
if (bookedUnit) { const r = await raw(avail.tok, 'POST', '/inventory-hold', holdBody(bookedUnit)); t('typed id: available is refused on a booked unit (the grant covers its status, not the id)', denied(r), r.s + JSON.stringify(r.j)); }
// the helper itself, for the routes that need a full booking body (booking, shift)
const thrown = (f, st) => { try { H.assertUnitGrantFilter(f, st); return null; } catch (e) { return e.http; } };
t('assertUnitGrantFilter: null filter (all, super_admin) passes any status', thrown(null, 'booked') === null);
t('assertUnitGrantFilter: empty filter (none) refuses even an available unit with 403', thrown([], 'available') === 403);
t('assertUnitGrantFilter: available refuses held and booked, allows available', thrown(['available'], 'held') === 403 && thrown(['available'], 'booked') === 403 && thrown(['available'], 'available') === null);
t('assertUnitGrantFilter: available_hold allows held, refuses booked', thrown(['available', 'held', 'locked'], 'held') === null && thrown(['available', 'held', 'locked'], 'booked') === 403);
t('assertUnitGrantFilter: a missing status is refused', thrown(['available'], undefined) === 403);
t('unitStatusFilterFor: NULL, undefined, empty and unknown text all mean none; known values map; all means no filter', JSON.stringify([H.unitStatusFilterFor(null), H.unitStatusFilterFor(undefined), H.unitStatusFilterFor(''), H.unitStatusFilterFor('gibberish'), H.unitStatusFilterFor('constructor')]) === '[[],[],[],[],[]]' && H.unitStatusFilterFor('all') === null && JSON.stringify(H.unitStatusFilterFor('available')) === '["available"]');
// ---------- /users/me ----------
for (const [u, want] of [[none, 'none'], [nul, 'none'], [weird, 'none'], [avail, 'available'], [all, 'all']]) { const me = (await raw(u.tok, 'GET', '/users/me')).j?.data; t(`/users/me for ${u.name}: unitStatusAccess=${want}`, me?.unitStatusAccess === want, me?.unitStatusAccess); }
t('/users/me for super_admin: all', (await raw(SA, 'GET', '/users/me')).j?.data?.unitStatusAccess === 'all');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
