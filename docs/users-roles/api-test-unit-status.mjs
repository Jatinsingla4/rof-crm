// Users & Roles, UR-007 (plan 8.2): unit status access fails closed. NULL, unknown or 'none' mean no inventory access; 'all' is an explicit grant;
// each explicit value shows exactly its statuses on every inventory view (list, counts, summaries, selectors, drill-downs, details, area reports, hold list; zero or empty for none); a typed unit id is refused too;
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
// ---------- the other inventory views: a fixture of our own with known statuses, so the expected numbers are exact ----------
const must = (r, what) => { if (r.s >= 300) throw new Error(what + ' ' + JSON.stringify(r)); return r.j.data; };
const co = must(await raw(SA, 'POST', '/companies', { name: 'US Co ' + U }), 'company');
const mkProj = async (n) => must(await raw(SA, 'POST', '/projects', { companyId: co.id, name: `US-${n}-${U}`, reraNumber: `US${n}-${U}`, tcpLicence: 'x' }), 'project');
const P1 = await mkProj('1'), P2 = await mkProj('2');
const tower = async (P, n) => must(await raw(SA, 'POST', `/projects/${P.id}/towers`, { towerName: n + U }), 'tower');
const T1 = await tower(P1, 'TA'), T2 = await tower(P2, 'TB');
let un = 0;
const unit = async (P, T, st) => { const x = must(await raw(SA, 'POST', '/units', { projectId: P.id, towerId: T.id, floor: 1, unitNumber: `US${++un}-${U}`, bhkType: '2BHK', carpetAreaSqft: 500 }), 'unit'); if (st !== 'available') sql(`UPDATE units SET status = '${st}' WHERE id = '${x.id}'`); return { id: x.id, status: st }; };
const f1 = [await unit(P1, T1, 'available'), await unit(P1, T1, 'available'), await unit(P1, T1, 'booked'), await unit(P1, T1, 'booked'), await unit(P1, T1, 'held'), await unit(P1, T1, 'allotted')];
const f2 = [await unit(P2, T2, 'booked'), await unit(P2, T2, 'booked')];
const pid = P1.id, uid = f1[0].id;
const ALLOWED = [[none, []], [nul, []], [weird, []], [empty, []], [avail, ['available']], [ah, ['available', 'held', 'locked']], [all, null], [{ name: 'super_admin', tok: SA }, null]];
const cnt = (fx, allowed) => fx.filter((x) => allowed === null || allowed.includes(x.status)).length;
const g = async (u, p) => { const r = await raw(u.tok, 'GET', p); return r; };
const probs = { counts: [], status: [], summary: [], tower: [], towers: [], projects: [], detail: [], details: [], areas: [], areaReport: [] };
for (const [u, allowed] of ALLOWED) {
  const n1 = cnt(f1, allowed), n2 = cnt(f2, allowed);
  const sc = await g(u, `/units/status-counts?projectId=${pid}`); const st = await g(u, `/units/status?projectId=${pid}`);
  for (const [k, r] of [['counts', sc], ['status', st]]) { const d = r.j?.data; if (!(r.s === 200 && d?.total_units === n1 && d.byStatus.every((x) => allowed === null || allowed.includes(x.status)))) probs[k].push(`${u.name}: ${r.s} total=${d?.total_units} want ${n1}`); }
  const sm = await g(u, `/units/inventory-summary/${pid}`); if (!(sm.s === 200 && Number(sm.j?.data?.total_units) === n1)) probs.summary.push(`${u.name}: ${sm.s} total=${sm.j?.data?.total_units} want ${n1}`);
  const tw = await g(u, `/units/tower/${pid}`); if (!(tw.s === 200 && Number(tw.j?.totals?.total_units) === n1)) probs.tower.push(`${u.name}: ${tw.s} total=${tw.j?.totals?.total_units} want ${n1}`);
  const tl = await g(u, `/units/towers?projectId=${pid}`); if (!(tl.s === 200 && tl.j.data.length === (n1 > 0 ? 1 : 0))) probs.towers.push(`${u.name}: ${tl.s} towers=${tl.j?.data?.length} want ${n1 > 0 ? 1 : 0}`);
  // unrestricted logins (all, super_admin) keep the stored project figure, which is unchanged
  const pl = await g(u, '/units/projects'); const listed = (pl.j?.data || []); const l1 = listed.find((x) => x.id === pid), l2 = listed.find((x) => x.id === P2.id);
  if (!(pl.s === 200 && !!l1 === (n1 > 0) && !!l2 === (n2 > 0) && (!l1 || allowed === null || l1.total_units === n1) && (!l2 || allowed === null || l2.total_units === n2))) probs.projects.push(`${u.name}: ${pl.s} P1=${l1?.total_units} want ${n1 > 0 ? n1 : 'absent'}, P2=${l2?.total_units} want ${n2 > 0 ? n2 : 'absent'}`);
  const td = await g(u, `/units/tower-detail?projectId=${pid}&towerId=${T1.id}&statusGroup=all`); if (!(td.s === 200 && td.j.units.length === n1 && td.j.units.every((x) => allowed === null || allowed.includes(x.status)))) probs.detail.push(`${u.name}: ${td.s} units=${td.j?.units?.length} want ${n1}`);
  const ar = await g(u, `/units/areas/report?projectId=${pid}`); if (!(ar.s === 200 && ar.j.data.length === n1 && ar.j.data.every((x) => allowed === null || allowed.includes(x.status)))) probs.areaReport.push(`${u.name}: ${ar.s} rows=${ar.j?.data?.length} want ${n1}`);
  for (const x of f1.filter((y, i) => [0, 2, 4, 5].includes(i))) {
    const want = allowed === null || allowed.includes(x.status) ? 200 : 404;
    for (const path of [`/units/${x.id}`, `/units/${x.id}/areas`, `/units/${x.id}/areas/history`]) { const r = await g(u, path); if (r.s !== want) probs.details.push(`${u.name} ${x.status} ${path.replace(x.id, ':id')} -> ${r.s} want ${want}`); }
  }
}
t('status-counts: exactly the covered statuses, zero for none, NULL, unknown and empty', probs.counts.length === 0, probs.counts.slice(0, 3).join(' | '));
t('status (alias): the same', probs.status.length === 0, probs.status.slice(0, 3).join(' | '));
t('inventory-summary: counts only the covered units (zeros for none)', probs.summary.length === 0, probs.summary.slice(0, 3).join(' | '));
t('tower breakdown: totals count only the covered units (zeros for none)', probs.tower.length === 0, probs.tower.slice(0, 3).join(' | '));
t('tower selector: a tower is listed only when it holds a covered unit (empty for none)', probs.towers.length === 0, probs.towers.slice(0, 3).join(' | '));
t('project selector: a project is listed only when it holds a covered unit, with the covered unit count (empty for none)', probs.projects.length === 0, probs.projects.slice(0, 3).join(' | '));
t('tower drill-down: only covered units (none for none)', probs.detail.length === 0, probs.detail.slice(0, 3).join(' | '));
t('area report: only covered units (none for none)', probs.areaReport.length === 0, probs.areaReport.slice(0, 3).join(' | '));
t('unit detail, areas and area history: 200 for a covered status, 404 for any other (none: always 404)', probs.details.length === 0, probs.details.slice(0, 4).join(' | '));
// the hold list is an inventory view too: holds on units whose CURRENT status the grant covers
const broker = sql(`SELECT id FROM brokers ORDER BY created_at LIMIT 1`);
if (broker) {
  const mkHold = (unitId, status) => sql(`INSERT INTO unit_holds (unit_id, broker_id, client_name, client_mobile, expires_at, status, notes) VALUES ('${unitId}', '${broker}', 'US test', '9000000000', now() + interval '2 hours', '${status}', 'unit-status test') RETURNING id`);
  const hExpired = mkHold(f1[1].id, 'expired'), hActive = mkHold(f1[4].id, 'active');
  const mine = (r) => (r.j?.data || []).map((x) => x.id).filter((id) => [hExpired, hActive].includes(id)).sort().join();
  const bad = [];
  for (const [u, allowed] of ALLOWED) {
    const want = [[hExpired, f1[1].status], [hActive, f1[4].status]].filter(([, st]) => allowed === null || allowed.includes(st)).map(([id]) => id).sort().join();
    const r = await g(u, '/inventory-hold?status=all'); if (r.s !== 200 || mine(r) !== want) bad.push(`${u.name}: ${r.s} got [${mine(r)}] want [${want}]`);
  }
  t('hold list: only holds on units the grant covers (none: none; available: the expired one on an available unit; available_hold and all: both)', bad.length === 0, bad.slice(0, 3).join(' | '));
  sql(`DELETE FROM unit_holds WHERE id IN ('${hExpired}', '${hActive}')`);
} else console.log('SKIP hold list: no broker exists in this database (not counted as a pass)');
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
// ---------- parking (plan 8.2: parking slots are not unit-status inventory; the control is units:create plus project scope) ----------
const SE = await login('sales_executive@test.local', 'Test#Pass1234');   // units: view only
const slots = (prefix) => Number(sql(`SELECT count(*) FROM parking_slots WHERE project_id = '${P1.id}' AND slot_number LIKE '${prefix}%'`));
let r1 = await raw(SE, 'POST', '/parking', { projectId: P1.id, slotNumber: `PKS${U}1` }), r2 = await raw(SE, 'POST', '/parking/bulk', { projectId: P1.id, count: 2, prefix: `PKB${U}` });
t('parking: a login without units:create is refused on create and on bulk (403) and no slot is written', r1.s === 403 && r2.s === 403 && slots(`PKS${U}`) === 0 && slots(`PKB${U}`) === 0, `${r1.s} ${r2.s}`);
r1 = await raw(none.tok, 'POST', '/parking', { projectId: P1.id, slotNumber: `PKN${U}1` }); r2 = await raw(none.tok, 'POST', '/parking/bulk', { projectId: P1.id, count: 2, prefix: `PKM${U}` });
t('parking: a login with units:create and the grant none can still create slots (201, rows exist): parking is not unit-status inventory', r1.s === 201 && r2.s === 201 && slots(`PKN${U}`) === 1 && slots(`PKM${U}`) === 2, `${r1.s} ${r2.s} ${JSON.stringify(r1.j)?.slice(0, 80)}`);
// booking with a typed unit id: a login without consumers:create is refused by the router guard (403), nothing is written, the unit is untouched
const rb = await raw(await login('read_only_viewer@test.local', 'Test#Pass1234'), 'POST', '/booking', { unit_id: f1[0].id, consumer_id: '00000000-0000-0000-0000-0000000000c1', project_id: P1.id });
t('booking: a login without consumers:create posting a valid unit id is refused (403 "Your role cannot change bookings") and the unit is untouched', rb.s === 403 && /cannot change bookings/.test(rb.j?.error || '') && sql(`SELECT status FROM units WHERE id = '${f1[0].id}'`) === 'available', `${rb.s} ${JSON.stringify(rb.j)?.slice(0, 100)}`);

// ---------- /users/me ----------
for (const [u, want] of [[none, 'none'], [nul, 'none'], [weird, 'none'], [avail, 'available'], [all, 'all']]) { const me = (await raw(u.tok, 'GET', '/users/me')).j?.data; t(`/users/me for ${u.name}: unitStatusAccess=${want}`, me?.unitStatusAccess === want, me?.unitStatusAccess); }
t('/users/me for super_admin: all', (await raw(SA, 'GET', '/users/me')).j?.data?.unitStatusAccess === 'all');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
