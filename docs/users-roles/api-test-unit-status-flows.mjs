// Users & Roles, UR-007 (plan 8.2): the unit-status grant on the WRITE flows, over real HTTP, with the database checked after every request.
//   booking create, unit shift, hold create, new allotment: a refused request changes nothing (no row, status untouched); an allowed one writes exactly what it should.
// Section 2 pins CURRENT behaviour of three surfaces whose policy is an open owner decision (/units/lookup, /plc-charges/units, project/tower/floor counts).
//   Those checks are regression records, not approval: when the owner decides, the expectation changes with the code.
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-unit-status-flows.mjs   (needs psql env and the second-admin helper)
import { execFileSync } from 'node:child_process';
import { bizToday } from '../_shared/business-date.mjs';
import { secondAdminToken } from '../_shared/second-admin.mjs';

const B = process.env.BASE || 'http://localhost:3010/api';
const PSQL = process.env.PSQL || 'psql';
const sql = (q) => execFileSync(PSQL, ['-X', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8' }).trim().split('\n')[0];
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };
const raw = async (tok, m, p, b) => {
  const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: b === undefined ? undefined : JSON.stringify(b) });
  let j = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
};
const login = async (email, password) => (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()).token;
const SA = await login('super_admin@test.local', 'Test#Pass1234');
const A = (m, p, b) => raw(SA, m, p, b);
const A2tok = await secondAdminToken(B, A);
const U = Date.now().toString(36).slice(-6), PW = 'Fl#Pass' + U.replace(/\D/g, '') + '1x', today = bizToday();
const must = (r, what) => { if (r.s >= 300) throw new Error(what + ' ' + JSON.stringify(r)); return r.j.data; };
let seq = 0; const mob = () => '9' + String((Date.now() % 1e7) * 100 + ++seq + 100000000).slice(-9).padStart(9, '0');

// ---------- fixture: one project, plan, GST mapping, an active broker ----------
const co = must(await A('POST', '/companies', { name: 'FL Co ' + U }), 'company');
const P1 = must(await A('POST', '/projects', { companyId: co.id, name: `FL-1-${U}`, reraNumber: `FL1-${U}`, tcpLicence: 'x' }), 'project');
const T1 = must(await A('POST', `/projects/${P1.id}/towers`, { towerName: 'T' + U }), 'tower');
const PLAN = 'FL Plan ' + U; let pi = 0;
for (const pc of [20, 30, 50]) must(await A('POST', `/projects/${P1.id}/plan-templates`, { plan_name: PLAN, installment_name: `Row ${++pi}`, installment_type: pi === 1 ? 'booking' : 'installment', percentage: pc, due_date_offset_days: pi * 30, installment_index: pi }), 'plan');
let slab = (await A('GET', '/gst-configuration/gst-slabs')).j.data.find((s) => s.from_date <= today && s.to_date >= today)?.id;
if (!slab) slab = must(await A('POST', '/gst-configuration/gst-slabs', { fromDate: new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10), toDate: new Date(Date.now() + 40 * 864e5).toISOString().slice(0, 10) }), 'slab').id;
const taxId = must(await A('POST', '/gst-configuration/gst-tax-setup', { slabId: slab, gstCode: `FL ${U}`, type: 'INTRA', cgstPct: 2.5, sgstPct: 2.5 }), 'tax').id;
for (const ct of ['BASIC', 'PLC', 'OTHER CHARGE']) await A('POST', '/gst-configuration/gst-charge-mapping', { projectId: P1.id, slabId: slab, gstTaxId: taxId, chargeType: ct });
const br = must(await A('POST', '/brokers', { firmName: 'FL Firm ' + U, mobile: mob(), commissionPct: 2, pan: 'ABCDE' + String(1000 + (Date.now() % 9000)) + 'F' }), 'broker');
must(await raw(A2tok, 'PATCH', `/brokers/${br.id}/approve`, {}), 'broker approve');

let un = 0;
const unit = async (st = 'available') => { const x = must(await A('POST', '/units', { projectId: P1.id, towerId: T1.id, floor: 1, unitNumber: `FL${++un}-${U}`, bhkType: '2BHK', carpetAreaSqft: 1000, superAreaSqft: 1200, basePriceInr: 9000000, totalPriceInr: 9500000 }), 'unit'); if (st !== 'available') sql(`UPDATE units SET status = '${st}' WHERE id = '${x.id}'`); return x.id; };
const person = async () => must(await A('POST', '/consumers', { name: `FL Buyer ${++seq} ${U}`, mobile: mob(), project_id: P1.id }), 'consumer').id;
const mk = async (name, access, procs = true) => {
  const email = `fl.${name}.${U}@test.local`;
  const r = await A('POST', '/users/employee-login', { username: `fl${name}${U}`, email, password: PW, confirmPassword: PW, role: 'project_manager', companyIds: [co.id], assignedProjectIds: [P1.id],
    ...(access ? { unitStatusAccess: access } : {}), ...(procs ? { processPermissions: [{ processName: 'unit_shifting', isMaker: true, isChecker: false }] } : {}) });
  if (r.s !== 201) throw new Error(name + ' ' + JSON.stringify(r));
  return { name, id: r.j.data.userId, tok: await login(email, PW) };
};
const none = await mk('none', 'none'), avail = await mk('avail', 'available'), ah = await mk('ah', 'available_hold'), uh = await mk('uh', 'unit_hold'), all = await mk('all', 'all');
const nul = await mk('null', 'none'); sql(`UPDATE users SET unit_status_access = NULL WHERE id = '${nul.id}'`);
const weird = await mk('weird', 'none'); sql(`UPDATE users SET unit_status_access = 'gibberish' WHERE id = '${weird.id}'`);
const empty = await mk('empty', 'none'); sql(`UPDATE users SET unit_status_access = '' WHERE id = '${empty.id}'`);
const SAu = { name: 'super_admin', tok: SA };
// what each grant covers (plan 8.2): an exact set of statuses; none, NULL, unknown and empty cover nothing
const COVERS = { none: [], null: [], weird: [], empty: [], avail: ['available'], ah: ['available', 'held', 'locked'], uh: ['held', 'locked'], all: null, super_admin: null };
const covers = (u, st) => COVERS[u.name] === null || COVERS[u.name].includes(st);
const USERS = [none, nul, weird, empty, avail, ah, uh, all, SAu];

// ---------- 1a. booking create ----------
// A grant is checked against the unit's CURRENT status, before availability: a covered status passes the grant (and may still be refused as unavailable), an uncovered one is 403.
// Database after each request: 403 -> no booking row, unit status untouched, applicant untouched. 201 -> one booking row for that unit and applicant.
const bookingRows = (u) => Number(sql(`SELECT count(*) FROM booking_records WHERE unit_id = '${u}'`));
const bad = { b403: [], bokDb: [], bState: [], bOther: [] };
for (const u of USERS) {
  for (const st of ['available', 'booked', 'locked', 'temp_surrender', 'allotted']) {
    const unitId = await unit(st), c = await person();
    const r = await raw(u.tok, 'POST', '/booking', { consumer_id: c, project_id: P1.id, unit_id: unitId, selected_plan_name: PLAN, booking_date: today });
    const covered = covers(u, st), tag = `${u.name}/${st}`;
    if (!covered) {
      if (!(r.s === 403 && /inventory access/.test(r.j?.error || ''))) bad.b403.push(`${tag}: ${r.s} ${JSON.stringify(r.j)?.slice(0, 80)}`);
      if (!(bookingRows(unitId) === 0 && sql(`SELECT status FROM units WHERE id = '${unitId}'`) === st && sql(`SELECT COALESCE(allocated_unit_id::text, '-') FROM consumers WHERE id = '${c}'`) === '-')) bad.bokDb.push(`${tag}: a refused booking left a trace`);
    } else if (st === 'available') {
      if (!(r.s === 201)) bad.bOther.push(`${tag}: ${r.s} ${JSON.stringify(r.j)?.slice(0, 120)}`);
      else if (!(bookingRows(unitId) === 1 && sql(`SELECT count(*) FROM booking_records WHERE unit_id = '${unitId}' AND consumer_id = '${c}'`) === '1')) bad.bokDb.push(`${tag}: 201 but no booking row for this applicant and unit`);
    } else {
      // covered by the grant, but the unit is not bookable: refused as unavailable (409), NOT as an inventory-access 403, and nothing is written
      if (!(r.s === 409 && !/inventory access/.test(r.j?.error || ''))) bad.bState.push(`${tag}: ${r.s} ${JSON.stringify(r.j)?.slice(0, 80)}`);
      if (!(bookingRows(unitId) === 0 && sql(`SELECT status FROM units WHERE id = '${unitId}'`) === st)) bad.bokDb.push(`${tag}: a refused booking left a trace`);
    }
  }
}
t('booking create: every uncovered (grant, unit status) pair is 403 "inventory access" (none, NULL, unknown, empty, available, available_hold, unit_hold on available/booked/locked/temp_surrender/allotted)', bad.b403.length === 0, bad.b403.slice(0, 3).join(' | '));
t('booking create: a covered AVAILABLE unit is booked (201) for available, available_hold, all and super_admin', bad.bOther.length === 0, bad.bOther.slice(0, 3).join(' | '));
t('booking create: a covered but unbookable status (booked, locked, temp_surrender, allotted) is refused as unavailable (409), not as an access error', bad.bState.length === 0, bad.bState.slice(0, 3).join(' | '));
t('booking create, database: refused -> no booking row, unit status and applicant untouched; allowed -> exactly one booking row for that unit and applicant', bad.bokDb.length === 0, bad.bokDb.slice(0, 3).join(' | '));
// a HELD unit: the grant is checked first (uncovered -> 403, nothing changes); a covered grant reaches the hold rules (the hold stays untouched when they refuse)
{
  const probs = [];
  for (const u of [none, avail, ah, uh]) {
    const unitId = await unit(), c = await person();
    const h = must(await A('POST', '/inventory-hold', { unitId, brokerId: br.id, clientName: 'FL hold', clientMobile: mob(), holdHours: 2 }), 'hold');
    const r = await raw(u.tok, 'POST', '/booking', { consumer_id: c, project_id: P1.id, unit_id: unitId, selected_plan_name: PLAN, booking_date: today });
    const holdStill = sql(`SELECT status FROM unit_holds WHERE id = '${h.id}'`) === 'active' && sql(`SELECT status FROM units WHERE id = '${unitId}'`) === 'held';
    if (!covers(u, 'held')) { if (!(r.s === 403 && bookingRows(unitId) === 0 && holdStill)) probs.push(`${u.name}: ${r.s} holdStill=${holdStill}`); }
    else if (!(r.s !== 403 && bookingRows(unitId) === 0 && holdStill)) probs.push(`${u.name}: ${r.s} ${JSON.stringify(r.j)?.slice(0, 80)} (a direct booking on a broker's hold must be refused and leave the hold)`);
  }
  t(`booking create on a HELD unit: none and available are 403; available_hold, unit_hold pass the grant and are stopped by the hold rules; the hold stays active, no booking row`, probs.length === 0, probs.join(' | '));
}

// ---------- 1b. unit shift ----------
// The new unit must be 'available' (checked first, 400), then the grant on that status. Database after: refused -> applicant, both units and shift log untouched; allowed -> moved, both statuses swapped, one shift row.
const allot = async () => { const old = await unit(), c = await person(); must(await A('POST', '/allocations', { consumerId: c, unitId: old, projectId: P1.id }), 'allot'); return { c, old }; };
const shiftState = (c, oldU, newU) => `${sql(`SELECT allocated_unit_id FROM consumers WHERE id = '${c}'`)}|${sql(`SELECT status FROM units WHERE id = '${oldU}'`)}|${sql(`SELECT status FROM units WHERE id = '${newU}'`)}|${sql(`SELECT count(*) FROM unit_shifts WHERE consumer_id = '${c}'`)}`;
const sp = { d403: [], dState: [], ok: [], okDb: [], b400: [] };
for (const u of USERS) {
  const { c, old } = await allot(), nu = await unit();
  const before = shiftState(c, old, nu), covered = covers(u, 'available');
  const r = await raw(u.tok, 'POST', '/allocations/shift', { consumerId: c, newUnitId: nu, reason: 'FL shift ' + u.name });
  if (!covered) {
    if (!(r.s === 403 && /inventory access/.test(r.j?.error || ''))) sp.d403.push(`${u.name}: ${r.s} ${JSON.stringify(r.j)?.slice(0, 80)}`);
    if (shiftState(c, old, nu) !== before) sp.dState.push(`${u.name}: a refused shift changed ${before} -> ${shiftState(c, old, nu)}`);
  } else {
    if (!(r.s === 200 && r.j?.data?.new_unit_id === nu)) sp.ok.push(`${u.name}: ${r.s} ${JSON.stringify(r.j)?.slice(0, 100)}`);
    if (shiftState(c, old, nu) !== `${nu}|available|allotted|1`) sp.okDb.push(`${u.name}: ${shiftState(c, old, nu)} want ${nu}|available|allotted|1`);
    else if (sql(`SELECT count(*) FROM allocations WHERE consumer_id = '${c}' AND unit_id = '${nu}' AND status NOT IN ('cancelled','transferred')`) !== '1') sp.okDb.push(`${u.name}: the allocation did not follow the applicant`);
  }
  // a new unit that is not available is refused as "not available" (400) for every login, before the grant is looked at: nothing changes
  const { c: c2, old: old2 } = await allot(), booked = await unit('booked'), b2 = shiftState(c2, old2, booked);
  const r2 = await raw(u.tok, 'POST', '/allocations/shift', { consumerId: c2, newUnitId: booked });
  if (!(r2.s === 400 && /not available/.test(r2.j?.error || '') && shiftState(c2, old2, booked) === b2)) sp.b400.push(`${u.name}: ${r2.s} ${JSON.stringify(r2.j)?.slice(0, 80)}`);
}
t('unit shift: a login whose grant does not cover AVAILABLE (none, NULL, unknown, empty, unit_hold) is 403 "inventory access"', sp.d403.length === 0, sp.d403.slice(0, 3).join(' | '));
t('unit shift, database: a refused shift leaves applicant, both unit statuses and the shift log untouched', sp.dState.length === 0, sp.dState.slice(0, 3).join(' | '));
t('unit shift: available, available_hold, all and super_admin move the applicant (200)', sp.ok.length === 0, sp.ok.slice(0, 3).join(' | '));
t('unit shift, database: allowed -> applicant on the new unit (allotted), old unit available, allocation moved, one shift row', sp.okDb.length === 0, sp.okDb.slice(0, 3).join(' | '));
t('unit shift to a BOOKED unit: 400 "not available" for every login (the status rule runs before the grant), nothing changes', sp.b400.length === 0, sp.b400.slice(0, 3).join(' | '));
{ // without the unit_shifting process right the shift is refused before the grant is looked at
  const np = await mk('noproc', 'all', false), { c, old } = await allot(), nu = await unit(), before = shiftState(c, old, nu);
  const r = await raw(np.tok, 'POST', '/allocations/shift', { consumerId: c, newUnitId: nu });
  t('unit shift: a login with grant all but no unit_shifting maker right is 403 and nothing changes', r.s === 403 && shiftState(c, old, nu) === before, r.s + ' ' + JSON.stringify(r.j)?.slice(0, 80));
}

// ---------- 1c. hold create and new allotment (typed unit id): refused -> no hold / no allocation, status untouched ----------
{
  const probs = [];
  for (const u of USERS) for (const st of ['available', 'booked', 'locked']) {
    const unitId = await unit(st), c = await person();
    const r = await raw(u.tok, 'POST', '/inventory-hold', { unitId, brokerId: br.id, clientName: 'FL', clientMobile: mob(), holdHours: 1 });
    const holds = Number(sql(`SELECT count(*) FROM unit_holds WHERE unit_id = '${unitId}'`)), now = sql(`SELECT status FROM units WHERE id = '${unitId}'`);
    if (!covers(u, st)) { if (!(r.s === 403 && holds === 0 && now === st)) probs.push(`hold ${u.name}/${st}: ${r.s} holds=${holds} status=${now}`); }
    else if (st === 'available') { if (!(r.s === 201 && holds === 1 && now === 'held')) probs.push(`hold ${u.name}/${st}: ${r.s} holds=${holds} status=${now}`); }
    else if (!(r.s === 409 && holds === 0 && now === st)) probs.push(`hold ${u.name}/${st}: ${r.s} holds=${holds} status=${now}`);   // covered but not holdable: refused by the status rule
    if (st === 'available') {
      const u2 = await unit(), r3 = await raw(u.tok, 'POST', '/allocations', { consumerId: c, unitId: u2, projectId: P1.id });
      const al = Number(sql(`SELECT count(*) FROM allocations WHERE unit_id = '${u2}'`)), s2 = sql(`SELECT status FROM units WHERE id = '${u2}'`);
      if (!covers(u, 'available')) { if (!(r3.s === 403 && al === 0 && s2 === 'available')) probs.push(`allot ${u.name}: ${r3.s} rows=${al} status=${s2}`); }
      else if (!(r3.s === 201 && al === 1 && s2 === 'allotted')) probs.push(`allot ${u.name}: ${r3.s} rows=${al} status=${s2}`);
    }
  }
  t('hold create and new allotment by typed unit id: uncovered -> 403 with no hold/allocation row and the status untouched; covered available -> 201 with the row and the new status; covered but unusable status -> 409 untouched', probs.length === 0, probs.slice(0, 4).join(' | '));
}

// ---------- 2. CURRENT behaviour of the open-decision surfaces (regression record; the policy is the owner's) ----------
// A project with a known mix of statuses, read by a login with grant none.
const P2 = must(await A('POST', '/projects', { companyId: co.id, name: `FL-2-${U}`, reraNumber: `FL2-${U}`, tcpLicence: 'x' }), 'project2');
const T2 = must(await A('POST', `/projects/${P2.id}/towers`, { towerName: 'TQ' + U }), 'tower2');
sql(`INSERT INTO user_company_access (user_id, company_id) SELECT '${none.id}', '${co.id}' WHERE NOT EXISTS (SELECT 1 FROM user_company_access WHERE user_id = '${none.id}' AND company_id = '${co.id}')`);
sql(`UPDATE users SET assigned_project_ids = assigned_project_ids || to_jsonb('${P2.id}'::text) WHERE id IN ('${none.id}', '${all.id}')`);
const mk2 = async (st) => { const x = must(await A('POST', '/units', { projectId: P2.id, towerId: T2.id, floor: 3, unitNumber: `Q${++un}-${U}`, bhkType: '3BHK', carpetAreaSqft: 900 }), 'unit'); if (st !== 'available') sql(`UPDATE units SET status = '${st}' WHERE id = '${x.id}'`); return x.id; };
for (const st of ['available', 'available', 'booked', 'allotted', 'held']) await mk2(st);
const status = (id) => sql(`SELECT status FROM units WHERE id = '${id}'`);
let r = await raw(none.tok, 'GET', `/units/lookup?projectId=${P2.id}&pageSize=50`);
const lk = r.j?.data || [];
t('CURRENT /units/lookup (grant none): 200 and returns every unit of the project with its status, prices and holder columns (policy open: owner decision U-L)',
  r.s === 200 && lk.length === 5 && new Set(lk.map((x) => x.status)).size === 4 && ['base_price_inr', 'hold_client', 'consumer_name', 'registration_no', 'broker_name'].every((k) => k in (lk[0] || {})), `${r.s} rows=${lk.length} keys=${Object.keys(lk[0] || {}).join(',')}`);
r = await raw(none.tok, 'GET', `/plc-charges/units?projectId=${P2.id}`);
const pl = r.j?.data || [];
t('CURRENT /plc-charges/units (grant none): 200 and lists every unit of the project with its status (policy open: owner decision U-P)', r.s === 200 && pl.length === 5 && new Set(pl.map((x) => x.status)).size === 4, `${r.s} rows=${pl.length} ${JSON.stringify(r.j)?.slice(0, 120)}`);
const inv = await raw(none.tok, 'GET', `/units?projectId=${P2.id}&pageSize=50`);
t('CURRENT contrast: the same login sees zero rows on /units (the covered list view)', inv.s === 200 && (inv.j?.data || []).length === 0);
r = await raw(none.tok, 'GET', '/projects');
const pj = (r.j?.data || []).find((x) => x.id === P2.id);
t('CURRENT /projects (grant none): the project row carries real unit counts (policy open: owner decision U-C)', r.s === 200 && !!pj && Number(pj.unit_count) === 5 && Number(pj.available_units) === 2 && Number(pj.allotted_units) === 1, `${r.s} ${JSON.stringify(pj)?.slice(0, 200)}`);
r = await raw(none.tok, 'GET', `/projects/${P2.id}`);
const twD = JSON.stringify(r.j?.data?.towers ?? r.j?.data ?? '');
t('CURRENT /projects/:id (grant none): tower rows carry the unit count', r.s === 200 && /"unit_count":\s*"?5"?/.test(twD), `${r.s} ${twD.slice(0, 200)}`);
r = await raw(none.tok, 'GET', `/projects/${P2.id}/floors`);
t('CURRENT /projects/:id/floors (grant none): 200 and the floor numbers that hold units (floor 3), no counts', r.s === 200 && JSON.stringify(r.j?.data) === '[3]', `${r.s} ${JSON.stringify(r.j)?.slice(0, 200)}`);
r = await raw(none.tok, 'GET', `/projects/${P2.id}/towers/${T2.id}`);
t('CURRENT /projects/:id/towers/:towerId (grant none): 200 and the tower carries its unit count', r.s === 200 && /"unit_count":\s*"?5"?/.test(JSON.stringify(r.j)), `${r.s} ${JSON.stringify(r.j)?.slice(0, 200)}`);
// historic data stays visible to a login with none (plan 8.2): an applicant and a booking made earlier are not hidden by the grant
const hist = await unit(), hc = await person();
must(await A('POST', '/booking', { consumer_id: hc, project_id: P1.id, unit_id: hist, selected_plan_name: PLAN, booking_date: today }), 'historic booking');
r = await raw(none.tok, 'GET', `/consumers/${hc}`);
t('historic data: the applicant of an earlier booking is still readable by a login with none', r.s === 200 && r.j?.data?.id === hc, r.s + ' ' + JSON.stringify(r.j)?.slice(0, 100));
const bid = sql(`SELECT id FROM booking_records WHERE unit_id = '${hist}'`);
r = await raw(none.tok, 'GET', `/booking/${bid}`);
t('historic data: the earlier booking is still readable by a login with none (plan 8.2; Q-A1 on booking reads is a separate owner decision)', r.s === 200, r.s + ' ' + JSON.stringify(r.j)?.slice(0, 100));

console.log(`\n${pass} passed, ${fail} failed`);
console.log(`RESULT ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
