// Users & Roles, UR-007 (plan 8.2): the unit-status grant on the WRITE flows, over real HTTP, with the database checked after every request.
//   booking create, unit shift, hold create, new allotment: a refused request changes nothing (no row, status untouched); an allowed one writes exactly what it should.
// Section 2: the owner-approved rules for /units/lookup (U-L), /plc-charges/units (U-P), project / tower / floor figures (U-C) and GET /units/:id/charges (Q-U1),
//   for none, NULL, unknown, empty, unit_hold, available, available_hold, all and super_admin.
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
const P2 = must(await A('POST', '/projects', { companyId: co.id, name: `FL-2-${U}`, reraNumber: `FL2-${U}`, tcpLicence: 'x' }), 'project2');   // read-only views of section 2
const T2 = must(await A('POST', `/projects/${P2.id}/towers`, { towerName: 'TQ' + U }), 'tower2');
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
  const r = await A('POST', '/users/employee-login', { username: `fl${name}${U}`, email, password: PW, confirmPassword: PW, role: 'project_manager', companyIds: [co.id], assignedProjectIds: [P1.id, P2.id],
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

// ---------- 2. owner-approved U-L, U-P, U-C, Q-U1: lookup, PLC units, project / tower / floor figures, unit charges ----------
// One project with a known mix of statuses (7 units on floor 3 of one tower), read by every kind of login.
const P2_STATUSES = ['available', 'available', 'booked', 'allotted', 'held', 'locked', 'temp_surrender'];
const p2 = []; for (const st of P2_STATUSES) { const x = must(await A('POST', '/units', { projectId: P2.id, towerId: T2.id, floor: 3, unitNumber: `Q${++un}-${U}`, bhkType: '3BHK', carpetAreaSqft: 900 }), 'unit'); if (st !== 'available') sql(`UPDATE units SET status = '${st}' WHERE id = '${x.id}'`); p2.push({ id: x.id, status: st }); }
const PLCLOC = must(await A('POST', `/projects/${P2.id}/unit-locations`, { name: 'FL loc ' + U }), 'loc').id;
must(await A('POST', '/plc-charges', { projectId: P2.id, unitLocationId: PLCLOC, rateType: 'flat', rateValue: 1000 }), 'plc rate');
sql(`UPDATE units SET unit_location_id = '${PLCLOC}' WHERE project_id = '${P2.id}'`);   // every unit of P2 sits at this location
const IDKEYS = 'id,project_id,project_name,tower,tower_id,tower_name,unit_number';
const IDONLY = [none, nul, weird, empty];
const n2 = (u) => p2.filter((x) => covers(u, x.status)).length, c2 = (u, st) => p2.filter((x) => x.status === st && covers(u, x.status)).length;
const P = { lookup: [], lookupFilter: [], plc: [], inv: [], proj: [], projId: [], towers: [], tower: [], floors: [], tfloors: [], charges: [], chargesBad: [] };
for (const u of USERS) {
  const n = n2(u), idOnly = IDONLY.includes(u);
  // U-L: none (and NULL, unknown, empty) -> every unit of the project by identifier only; a partial grant -> only the covered units, in full; all and super_admin -> everything, in full
  let r = await raw(u.tok, 'GET', `/units/lookup?projectId=${P2.id}&pageSize=50`); let rows = r.j?.data || [];
  const keysOk = (row) => idOnly ? Object.keys(row).sort().join() === IDKEYS.split(',').sort().join() : ['status', 'base_price_inr', 'hold_client', 'consumer_name', 'registration_no', 'broker_name'].every((k) => k in row);
  const statusOk = idOnly || rows.every((x) => covers(u, x.status));
  if (!(r.s === 200 && rows.length === (idOnly ? 7 : n) && rows.every(keysOk) && statusOk)) P.lookup.push(`${u.name}: ${r.s} rows=${rows.length} want ${idOnly ? 7 : n} keys=${Object.keys(rows[0] || {}).join(',').slice(0, 60)}`);
  if (idOnly) { // the hidden fields cannot be probed through the filters: status, bhk type, name and registration filters are ignored
    for (const q of ['status=booked', 'status=available', 'bhkType=3BHK', 'consumerName=zzz', 'registrationNo=zzz']) { const f = await raw(u.tok, 'GET', `/units/lookup?projectId=${P2.id}&pageSize=50&${q}`); if (!(f.s === 200 && (f.j?.data || []).length === 7)) P.lookupFilter.push(`${u.name} ?${q}: ${f.s} rows=${(f.j?.data || []).length}`); }
  }
  // U-P: the PLC unit list follows the grant (none: no unit)
  r = await raw(u.tok, 'GET', `/plc-charges?projectId=${P2.id}`);   // the rate list: its unit_count follows the grant too
  if (!(r.s === 200 && Number(r.j?.data?.find((x) => x.unit_location_id === PLCLOC)?.unit_count) === n)) P.plc.push(`${u.name}: rate unit_count ${r.s} ${r.j?.data?.[0]?.unit_count} want ${n}`);
  r = await raw(u.tok, 'GET', `/plc-charges/units?projectId=${P2.id}`); rows = r.j?.data || [];
  if (!(r.s === 200 && rows.length === n && rows.every((x) => covers(u, x.status)))) P.plc.push(`${u.name}: ${r.s} rows=${rows.length} want ${n}`);
  // U-C: project list row, project detail towers, tower list, one tower, floors, per-floor counts: counted over the covered units only (zero for none)
  r = await raw(u.tok, 'GET', '/projects'); const pj = (r.j?.data || []).find((x) => x.id === P2.id);
  if (!(r.s === 200 && pj && Number(pj.unit_count) === n && Number(pj.available_units) === c2(u, 'available') && Number(pj.allotted_units) === c2(u, 'allotted'))) P.proj.push(`${u.name}: ${r.s} unit=${pj?.unit_count} avail=${pj?.available_units} allotted=${pj?.allotted_units} want ${n}/${c2(u, 'available')}/${c2(u, 'allotted')}`);
  r = await raw(u.tok, 'GET', `/projects/${P2.id}`); const tw = (r.j?.data?.towers || []).find((x) => x.id === T2.id);
  if (!(r.s === 200 && tw && Number(tw.unit_count) === n)) P.projId.push(`${u.name}: ${r.s} unit_count=${tw?.unit_count} want ${n}`);
  r = await raw(u.tok, 'GET', `/projects/${P2.id}/towers`); const tl = (r.j?.data || []).find((x) => x.id === T2.id);
  if (!(r.s === 200 && tl && Number(tl.unit_count) === n)) P.towers.push(`${u.name}: ${r.s} unit_count=${tl?.unit_count} want ${n}`);
  r = await raw(u.tok, 'GET', `/projects/${P2.id}/towers/${T2.id}`);
  if (!(r.s === 200 && Number(r.j?.data?.unit_count) === n)) P.tower.push(`${u.name}: ${r.s} unit_count=${r.j?.data?.unit_count} want ${n}`);
  r = await raw(u.tok, 'GET', `/projects/${P2.id}/floors`);
  if (!(r.s === 200 && JSON.stringify(r.j?.data) === (n > 0 ? '[3]' : '[]'))) P.floors.push(`${u.name}: ${r.s} ${JSON.stringify(r.j?.data)} want ${n > 0 ? '[3]' : '[]'}`);
  r = await raw(u.tok, 'GET', `/projects/${P2.id}/towers/${T2.id}/floors`); const f3 = (r.j?.data || []).find((x) => Number(x.floor_number) === 3);
  if (!(r.s === 200 && f3 && Number(f3.units) === n)) P.tfloors.push(`${u.name}: ${r.s} floor3 units=${f3?.units} want ${n} (the floor itself stays listed)`);
  // Q-U1: unit charges GET follows the grant: 200 for a covered status, 404 for any other (none: always 404)
  for (const x of p2) { const c = await raw(u.tok, 'GET', `/units/${x.id}/charges`); const want = covers(u, x.status) ? 200 : 404; if (c.s !== want) P.charges.push(`${u.name} ${x.status}: ${c.s} want ${want}`); }
  const nf = await raw(u.tok, 'GET', '/units/00000000-0000-0000-0000-0000000000f1/charges'); if (nf.s !== 404) P.chargesBad.push(`${u.name}: unknown unit -> ${nf.s}`);
}
t('U-L /units/lookup: none, NULL, unknown, empty -> every unit of the project, identifiers only (id, project, tower, unit number); partial grants -> only covered units, full fields; all and super_admin -> everything, full fields', P.lookup.length === 0, P.lookup.slice(0, 3).join(' | '));
t('U-L /units/lookup: for an identifiers-only login the status, bhk type, name and registration filters are ignored (they cannot be used to probe hidden data)', P.lookupFilter.length === 0, P.lookupFilter.slice(0, 3).join(' | '));
t('U-P /plc-charges/units: only the units the grant covers (none, NULL, unknown, empty: none; unit_hold: held and locked; available_hold; all and super_admin: everything)', P.plc.length === 0, P.plc.slice(0, 3).join(' | '));
t('U-C /projects: unit_count, available_units and allotted_units count only covered units (zero for none)', P.proj.length === 0, P.proj.slice(0, 3).join(' | '));
t('U-C /projects/:id: tower unit_count over covered units', P.projId.length === 0, P.projId.slice(0, 3).join(' | '));
t('U-C /projects/:id/towers: tower unit_count over covered units (the tower stays listed)', P.towers.length === 0, P.towers.slice(0, 3).join(' | '));
t('U-C /projects/:id/towers/:towerId: unit_count over covered units', P.tower.length === 0, P.tower.slice(0, 3).join(' | '));
t('U-C /projects/:id/floors: only floors that hold a covered unit (none: no floor)', P.floors.length === 0, P.floors.slice(0, 3).join(' | '));
t('U-C /projects/:id/towers/:towerId/floors: the floor stays listed, its unit count covers covered units only', P.tfloors.length === 0, P.tfloors.slice(0, 3).join(' | '));
t('Q-U1 GET /units/:id/charges: 200 for a covered status, 404 for any other (none: always 404); an unknown unit is 404', P.charges.length === 0 && P.chargesBad.length === 0, [...P.charges, ...P.chargesBad].slice(0, 4).join(' | '));
{ // the same logins still reach the unit-charges PUT and the inventory list exactly as before the change (PUT is unchanged policy; the list is the covered view)
  const inv = await raw(none.tok, 'GET', `/units?projectId=${P2.id}&pageSize=50`);
  t('contrast: the covered list /units still shows a none login zero rows', inv.s === 200 && (inv.j?.data || []).length === 0);
}
let r;
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
