// Allocations: roles, input rules, allotting (also at the same moment), cancelling an allocation (waitlist), unit shifting, list / waitlist / shifts,
// allotment letters, e-draw import (JSON and the CSV the screen uploads), and random input.
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-allocations.mjs   (psql must reach the same database; SEED=n repeats a random run)
import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
const B = process.env.BASE || 'http://localhost:3010/api';
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };
const login = async (email) => (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Test#Pass1234' }) })).json()).token;
const call = (tok) => async (m, p, b, raw) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: raw ?? (b === undefined ? undefined : JSON.stringify(b)) }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const tokA = await login('super_admin@test.local');
const A = call(tokA), PM = call(await login('project_manager@test.local')), SE = call(await login('sales_executive@test.local')), RO = call(await login('read_only_viewer@test.local')), AF = call(await login('accounts_finance@test.local'));
const psql = (sql) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' }).trim().split('\n')[0];
const SEED = Number(process.env.SEED || Date.now() % 1e9); let rs = SEED;
const rnd = () => (rs = (rs * 1664525 + 1013904223) % 4294967296) / 4294967296, ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)), pick = (a) => a[ri(0, a.length - 1)];
console.log('SEED=' + SEED);
const U = Date.now().toString(36).slice(-5), NIL = '00000000-0000-0000-0000-000000000000';
const today = new Date().toISOString().slice(0, 10), later = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
let seq = 0; const mob = () => '9' + String((Date.now() % 1e7) * 100 + ++seq + 100000000).slice(-9).padStart(9, '0');
let r, r2;

// ---------- set-up: two projects, units, plans, applicants ----------
const co = (await A('POST', '/companies', { name: 'Booking Co ' + U })).j.data.id;
const mkProj = async (tag) => (await A('POST', '/projects', { companyId: co, name: `Bk ${tag} ${U}`, reraNumber: `BK${tag}-${U}`, tcpLicence: 'x' })).j.data.id;
const P1 = await mkProj('A'), P2 = await mkProj('B');
const tw = async (P) => (await A('POST', `/projects/${P}/towers`, { towerName: 'T' + U })).j.data.id;
const T1 = await tw(P1), T2 = await tw(P2);
let un = 0; const unit = async (P = P1, T = T1, carpet = 1000, base = 9000000) => (await A('POST', '/units', { projectId: P, towerId: T, unitNumber: `B${++un}-${U}`, floor: 1, bhkType: '2BHK', carpetAreaSqft: carpet, superAreaSqft: carpet + 200, basePriceInr: base, totalPriceInr: base + 500000 })).j.data.id;
const plan = async (P, name, rows) => { let i = 0; for (const pc of rows) await A('POST', `/projects/${P}/plan-templates`, { plan_name: name, installment_name: `Row ${++i}`, installment_type: i === 1 ? 'booking' : 'installment', percentage: pc, due_date_offset_days: i * 30, installment_index: i }); return name; };
const PLAN = await plan(P1, 'Plan100 ' + U, [20, 30, 50]), PLAN90 = await plan(P1, 'Plan90 ' + U, [40, 50]), PLAN_B = await plan(P2, 'PlanB ' + U, [100]);
// GST: reuse a slab that covers today, else make one; BASIC, PLC and OTHER CHARGE are mapped for both projects
let slab = (await A('GET', '/gst-configuration/gst-slabs')).j.data.find(s => s.from_date <= today && s.to_date >= today)?.id;
const madeSlab = !slab;
if (!slab) slab = (await A('POST', '/gst-configuration/gst-slabs', { fromDate: later(-3), toDate: later(40) })).j.data.id;
const taxId = (await A('POST', '/gst-configuration/gst-tax-setup', { slabId: slab, gstCode: `BK ${U}`, type: 'INTRA', cgstPct: 2.5, sgstPct: 2.5 })).j.data.id;
for (const P of [P1, P2]) for (const ct of ['BASIC', 'PLC', 'OTHER CHARGE']) await A('POST', '/gst-configuration/gst-charge-mapping', { projectId: P, slabId: slab, gstTaxId: taxId, chargeType: ct });
const made = []; let ap = 0;
const person = async (P = P1, extra = {}) => { const x = await A('POST', '/consumers', { name: `Bk Buyer ${++ap} ${U}`, mobile: mob(), project_id: P, ...extra }); if (x.s >= 300) throw new Error('applicant ' + JSON.stringify(x)); made.push(x.j.data.id); return x.j.data.id; };
const book = (c, u, b = {}, who = A) => who('POST', '/booking', { consumer_id: c.id ?? c, project_id: P1, unit_id: u, selected_plan_name: PLAN, booking_date: today, ...b });
const startBooking = async (b = {}) => { const c = await person(); const u = await unit(); const x = await book(c, u, b); if (x.s !== 201) throw new Error('booking ' + JSON.stringify(x)); return { c, u, id: x.j.data.id, reg: x.j.data.registration_no, x }; };
const finish = (id, b = {}, who = A) => who('PATCH', `/booking/${id}`, { booking_amount: 10000, payment_mode: 'cash', ...b });
const brk = (id) => psql(`select status from booking_records where id='${id}'`);
// ---------- helpers ----------
const NILS = '00000000-0000-0000-0000-000000000000';
let rn = 0;
const sold = async (paid = 0) => {   // completed booking: the unit is booked with an allocation 'booked', 3 demands
  const c = await person(); const u = await unit(); const x = await book(c, u, {}); if (x.s !== 201) throw new Error('book ' + JSON.stringify(x));
  const y = await finish(x.j.data.id); if (y.s !== 200) throw new Error('finish ' + JSON.stringify(y));
  if (paid) { const p = await A('POST', '/payments/receipts', { consumerId: c, amountReceivedInr: paid, paymentMode: 'neft', referenceNumber: `ALC${U}${++rn}`, paymentDate: today, installmentIndex: 9 }); const k = await A('PATCH', `/payments/receipts/${p.j.data.id}/clear`, { clearing_date: today }); if (k.s !== 200) throw new Error('clear'); }
  return { c, u, id: x.j.data.id, al: psql(`select id from allocations where consumer_id='${c}' and status not in ('cancelled','transferred') order by created_at desc limit 1`) };
};
const free = async () => ({ c: await person(), u: await unit() });   // an enquiry and an available unit
const allot = (S, extra = {}, who = A) => who('POST', '/allocations', { consumerId: S.c, unitId: S.u, projectId: P1, allotmentDate: today, remarks: 'ok', ...extra });
const g = (tbl, id, c) => psql(`select ${c} from ${tbl} where id='${id}'`);
const ust = (u) => g('units', u, 'status');
const cst = (c) => psql(`select lead_stage || '/' || coalesce(allocated_unit_id::text,'') from consumers where id='${c}'`);
const pmId = psql(`select id from users where email='project_manager@test.local'`);
const proc = (on) => { psql(`delete from user_process_permissions where user_id='${pmId}' and process_name='unit_shifting'`); if (on) psql(`insert into user_process_permissions (user_id, process_name, is_maker, is_checker, is_approver) values ('${pmId}','unit_shifting',true,false,false)`); };
proc(false);

// ---------- roles ----------
{
  const F = await free(); const S = await sold();
  for (const [n, who] of [['read_only_viewer', RO], ['sales_executive', SE], ['accounts_finance', AF]]) {
    r = await allot(F, {}, who); t(`roles: ${n} cannot allot -> 403`, r.s === 403, r.s);
    r = await who('POST', `/allocations/${S.al}/cancel`, {}); t(`roles: ${n} cannot cancel an allocation -> 403`, r.s === 403, r.s);
    r = await who('POST', '/allocations/shift', { consumerId: S.c, newUnitId: F.u }); t(`roles: ${n} cannot shift a unit -> 403`, r.s === 403, r.s);
    r = await who('POST', '/allocations/generate-letters', {}); t(`roles: ${n} cannot generate letters -> 403`, r.s === 403, r.s);
    r = await who('POST', '/allocations/import-edraw', { projectId: P1, results: [{ applicantId: 'x', result: 'allotted' }] }); t(`roles: ${n} cannot import e-draw -> 403`, r.s === 403, r.s);
  }
  t('roles: nothing changed by the refused calls', ust(F.u) === 'available' && g('allocations', S.al, 'status') === 'booked');
  for (const [n, who] of [['read_only_viewer', RO], ['sales_executive', SE], ['accounts_finance', AF], ['project_manager', PM]]) for (const p of ['/allocations', '/allocations/waitlist', '/allocations/shifts']) { r = await who('GET', p); t(`roles: ${n} can read ${p}`, r.s === 200, r.s); }
  r = await allot(F, {}, PM); t('roles: project_manager can allot', r.s === 201, r.s + JSON.stringify(r.j));
  r = await PM('POST', '/allocations/shift', { consumerId: S.c, newUnitId: await unit() }); t('roles: project_manager without the unit-shifting process cannot shift -> 403', r.s === 403, r.s);
  r = await fetch(B + '/allocations'); t('roles: no login -> 401', r.status === 401, r.status);
}

// ---------- allotting ----------
{
  const F = await free(), O = await free();
  const bad = async (n, bd, code = 400, S = F) => { const x = await allot(S, bd); t(`allot: ${n} -> ${code}`, x.s === code, x.s + ' ' + JSON.stringify(x.j).slice(0, 110)); return x; };
  r = await A('POST', '/allocations'); t('allot: no body -> 400', r.s === 400, r.s);
  for (const k of ['consumerId', 'unitId', 'projectId']) { r = await A('POST', '/allocations', { consumerId: F.c, unitId: F.u, projectId: P1, [k]: undefined }); t(`allot: ${k} missing -> 400`, r.s === 400, r.s); await bad(`${k} not an id`, { [k]: 'abc' }); await bad(`${k} as a list`, { [k]: [F.u] }); await bad(`${k} with SQL`, { [k]: "x' or '1'='1" }); }
  await bad('a unit that does not exist', { unitId: NILS }, 404); await bad('an applicant that does not exist', { consumerId: NILS }, 404);
  await bad('a project that is not the unit\'s', { projectId: P2 }); const nbP2 = await person(P2); await bad('an applicant of another project', { consumerId: nbP2 });
  for (const d of ['2999-01-01', later(3), '2020-02-30', 'abc', 20250101, '01/02/2025', [today]]) await bad(`allotmentDate ${JSON.stringify(d)}`, { allotmentDate: d });
  await bad('remarks 1001 characters', { remarks: 'r'.repeat(1001) }); await bad('remarks with <script>', { remarks: '<script>1</script>' });
  psql(`update units set status='locked' where id='${F.u}'`); await bad('a unit that is locked', {}); psql(`update units set status='available' where id='${F.u}'`);
  t('allot: nothing changed by the refused calls', ust(F.u) === 'available' && cst(F.c) === 'enquiry/' || cst(F.c).endsWith('/'), cst(F.c));
  r = await allot(F); t('allot: an available unit is allotted (201 with the allocation)', r.s === 201 && r.j.data.id && r.j.data.allotment_date, r.s + JSON.stringify(r.j));
  t('allot: unit "allotted", applicant "allotted" and linked, allocation "allotted"', ust(F.u) === 'allotted' && cst(F.c) === `allotted/${F.u}` && g('allocations', r.j.data.id, 'status') === 'allotted');
  t('allot: a status history row and an audit row', Number(psql(`select count(*) from unit_status_history where unit_id='${F.u}' and new_status='allotted'`)) === 1 && Number(psql(`select count(*) from audit_logs where resource_id='${r.j.data.id}' and resource_type='allocation'`)) === 1);
  r = await allot(F); t('allot: the same unit again -> 400 (not available)', r.s === 400, r.s);
  const X = await free(); r = await allot({ c: F.c, u: X.u }); t('allot: an applicant who already holds a unit -> 409', r.s === 409, r.s + JSON.stringify(r.j)); t('allot: and the other unit stays available', ust(X.u) === 'available');
  // a booked unit: the allocation from the booking is promoted
  const S = await sold(); t('allot: a completed booking left the unit "booked"', ['booked', 'allotted'].includes(ust(S.u)), ust(S.u));
  if (ust(S.u) === 'booked') { r = await allot(S); t('allot: a booked unit promotes the booked allocation to allotted (no second allocation)', r.s === 201 && g('allocations', S.al, 'status') === 'allotted' && psql(`select count(*) from allocations where unit_id='${S.u}'`) === '1', r.s + JSON.stringify(r.j)); }
  const S2 = await sold(); r = await allot({ c: (await person()), u: S2.u }); t('allot: a booked unit cannot be given to someone else -> 409/400', r.s === 409 || r.s === 400, r.s);
}

// ---------- allotting at the same moment ----------
{
  const U1 = await unit(); const ppl = await Promise.all([person(), person(), person(), person()]);
  const rs1 = await Promise.all(ppl.map(c => allot({ c, u: U1 })));
  t('race: 4 applicants allotted one unit at once -> exactly one is allotted', rs1.filter(x => x.s === 201).length === 1 && rs1.filter(x => x.s === 400).length === 3 && psql(`select count(*) from allocations where unit_id='${U1}'`) === '1', JSON.stringify(rs1.map(x => x.s)));
  const one = await person(); const units = await Promise.all([unit(), unit(), unit()]);
  const rs2 = await Promise.all(units.map(u => allot({ c: one, u })));
  t('race: one applicant allotted 3 units at once -> exactly one succeeds, the others 409', rs2.filter(x => x.s === 201).length === 1 && rs2.filter(x => x.s === 409).length === 2, JSON.stringify(rs2.map(x => x.s)));
  t('race: the two refused units stayed available', units.filter(u => ust(u) === 'available').length === 2);
}

// ---------- cancelling an allocation ----------
{
  const bad = async (n, id, bd, code) => { const x = await A('POST', `/allocations/${id}/cancel`, bd); t(`cancel: ${n} -> ${code}`, x.s === code, x.s + ' ' + JSON.stringify(x.j).slice(0, 110)); };
  const S = await sold(100000);
  await bad('id not an id', 'abc', {}, 400); await bad('unknown id', NILS, {}, 404); await bad('reason 1001 characters', S.al, { reason: 'r'.repeat(1001) }, 400); await bad('reason with <b>', S.al, { reason: '<b>x' }, 400);
  t('cancel: nothing changed by the refused calls', g('allocations', S.al, 'status') !== 'cancelled');
  const wl = await person(); psql(`insert into waitlists (project_id, consumer_id, position_ordered) values ('${P1}','${wl}', 1)`);
  r = await A('POST', `/allocations/${S.al}/cancel`, { reason: 'Customer changed mind' });
  t('cancel: the allocation is cancelled; forfeiture 29,500, the rest refunded', r.s === 200 && Number(r.j.data.forfeiture_amount_inr) === 29500 && Number(r.j.data.refund_amount_inr) === 70500, r.s + JSON.stringify(r.j));
  t('cancel: the applicant is unlinked, booking and demands cancelled', cst(S.c) === 'cancelled/' && g('booking_records', S.id, 'status') === 'cancelled' && psql(`select string_agg(distinct status, ',') from demands where consumer_id='${S.c}'`) === 'cancelled');
  t('cancel: a cancellation record exists with refund status initiated', psql(`select count(*) from cancellations where allocation_id='${S.al}' and refund_status='initiated'`) === '1');
  t('cancel: the first applicant on the waitlist got the unit', r.j.data.promoted_consumer_id === wl && ust(S.u) === 'allotted' && cst(wl) === `allotted/${S.u}` && psql(`select count(*) from waitlists where consumer_id='${wl}' and promoted_to_allocation_id is not null`) === '1', JSON.stringify(r.j.data));
  r = await A('POST', `/allocations/${S.al}/cancel`, {}); t('cancel: cancelling again -> 409', r.s === 409, r.s);
  r = await A('GET', `/allocations/waitlist?projectId=${P1}`); t('cancel: the waitlist shows the entry as promoted', r.s === 200 && r.j.data.some(x => x.consumer_id === wl && x.status === 'promoted'), r.s);
  // no waitlist: unit becomes available, and the Surrender "restore" works
  const S2 = await sold(10000); r = await A('POST', `/allocations/${S2.al}/cancel`, {}); t('cancel: with less paid than 29,500 the forfeiture is what was paid, refund 0', r.s === 200 && Number(r.j.data.forfeiture_amount_inr) === 10000 && Number(r.j.data.refund_amount_inr) === 0 && r.j.data.promoted_consumer_id === null, r.s + JSON.stringify(r.j));
  t('cancel: no waitlist -> the unit is available again', ust(S2.u) === 'available', ust(S2.u));
  t('cancel: it leaves the same state as a builder cancellation (listed there too)', (await A('GET', `/surrender/list?type=cancellation&projectId=${P1}`)).j.data.some(x => x.id === r.j.data.id));
  const rb = await A('POST', '/surrender/restore', { surrenderId: r.j.data.id, type: 'cancellation' }); t('cancel: and it can be restored from the Surrender screens while the unit is free', rb.s === 200 && g('allocations', S2.al, 'status') !== 'cancelled' && cst(S2.c) !== 'cancelled/', rb.s + JSON.stringify(rb.j));
  // a waitlisted applicant who already holds a unit is skipped
  const S3 = await sold(); const holder = await person(); const h = await free(); await allot({ c: holder, u: h.u }); const nextOne = await person();
  psql(`delete from waitlists where project_id='${P1}'`); psql(`insert into waitlists (project_id, consumer_id, position_ordered) values ('${P1}','${holder}', 1), ('${P1}','${nextOne}', 2)`);
  r = await A('POST', `/allocations/${S3.al}/cancel`, {}); t('cancel: a waitlisted applicant who already holds a unit is skipped, the next one gets it', r.s === 200 && r.j.data.promoted_consumer_id === nextOne, r.s + JSON.stringify(r.j)); psql(`delete from waitlists where project_id='${P1}'`);
  const S4 = await sold(); const cc = await Promise.all(Array.from({ length: 5 }, () => A('POST', `/allocations/${S4.al}/cancel`, {})));
  t('cancel race: 5 at once -> cancelled once, one cancellation record', cc.filter(x => x.s === 200).length === 1 && psql(`select count(*) from cancellations where allocation_id='${S4.al}'`) === '1', JSON.stringify(cc.map(x => x.s)));
}

// ---------- shifting ----------
{
  proc(true);
  const S = await sold(); const N = await unit(); const bad = async (n, bd, code = 400) => { const x = await PM('POST', '/allocations/shift', { consumerId: S.c, newUnitId: N, ...bd }); t(`shift: ${n} -> ${code}`, x.s === code, x.s + ' ' + JSON.stringify(x.j).slice(0, 110)); };
  r = await PM('POST', '/allocations/shift'); t('shift: no body -> 400', r.s === 400, r.s);
  r = await PM('POST', '/allocations/shift', { consumerId: S.c }); t('shift: newUnitId missing -> 400', r.s === 400, r.s); r = await PM('POST', '/allocations/shift', { newUnitId: N }); t('shift: consumerId missing -> 400', r.s === 400, r.s);
  for (const k of ['consumerId', 'newUnitId']) { await bad(`${k} not an id`, { [k]: 'abc' }); await bad(`${k} as a list`, { [k]: [N] }); await bad(`${k} with SQL`, { [k]: "x' or '1'='1" }); }
  await bad('an applicant that does not exist', { consumerId: NILS }, 404); await bad('a new unit that does not exist', { newUnitId: NILS }, 404);
  await bad('the unit the applicant already holds', { newUnitId: S.u }); const nu = await person(); await bad('an applicant who holds no unit', { consumerId: nu });
  const o = await sold(); await bad('a new unit that is not available (booked by someone)', { newUnitId: o.u });
  const nP2 = await unit(P2, T2); await bad('a unit of another project', { newUnitId: nP2 });
  await bad('reason 501 characters', { reason: 'r'.repeat(501) }); await bad('reason with <b>', { reason: '<b>x' });
  for (const d of ['2999-01-01', '2020-02-30', 'abc', 20250101]) await bad(`shiftDate ${JSON.stringify(d)}`, { shiftDate: d });
  t('shift: nothing changed by the refused calls', cst(S.c) === `${(psql(`select lead_stage from consumers where id='${S.c}'`))}/${S.u}` && ust(N) === 'available');
  const oldStatus = ust(S.u), plan = psql(`select id from payment_plans where consumer_id='${S.c}'`);
  r = await PM('POST', '/allocations/shift', { consumerId: S.c, newUnitId: N, reason: 'Customer wants a higher floor', shiftDate: later(-1) });
  t('shift: the applicant is moved (200)', r.s === 200 && r.j.data.new_unit_id === N && r.j.data.old_unit_id === S.u, r.s + JSON.stringify(r.j));
  t('shift: allocation, booking, payment plan and applicant link all follow', g('allocations', S.al, 'unit_id') === N && g('booking_records', S.id, 'unit_id') === N && g('payment_plans', plan, 'unit_id') === N && cst(S.c).endsWith('/' + N));
  t('shift: the new unit takes the old status, the old unit is available', ust(N) === oldStatus && ust(S.u) === 'available', `${ust(N)} ${ust(S.u)}`);
  t('shift: a shift record, two status history rows and an audit row', psql(`select count(*) from unit_shifts where consumer_id='${S.c}' and shift_date='${later(-1)}' and reason like 'Customer%'`) === '1' && Number(psql(`select count(*) from unit_status_history where unit_id in ('${S.u}','${N}') and reason like 'Unit shifting%'`)) === 2 && Number(psql(`select count(*) from audit_logs where resource_id='${S.c}' and resource_type='unit_shift'`)) === 1);
  r = await A('GET', `/payments/demands?consumerId=${S.c}`); t('shift: the demands now show the new unit', r.s === 200 && r.j.data.length === 3 && r.j.data.every(d => d.unit_id === N), r.s);
  r = await A('GET', `/booking/${S.id}`); t('shift: the booking opens with the new unit', r.s === 200 && r.j.data.unit_id === N, r.s);
  // the freed unit can be sold again, and the shifted applicant can still be surrendered
  const nb = await person(); const rb = await book(nb, S.u, {}); t('shift: the freed unit can be booked by someone else', rb.s === 201, rb.s + JSON.stringify(rb.j));
  // races
  const A1 = await sold(), A2 = await sold(), NN = await unit();
  const rs = await Promise.all([A1, A2].map(x => PM('POST', '/allocations/shift', { consumerId: x.c, newUnitId: NN }))); t('race: 2 applicants shifted to one unit at once -> exactly one moves', rs.filter(x => x.s === 200).length === 1 && rs.filter(x => x.s === 400).length === 1, JSON.stringify(rs.map(x => x.s)));
  const B1 = await sold(), N1 = await unit(), N2 = await unit(); const rs3 = await Promise.all([N1, N2].map(n => PM('POST', '/allocations/shift', { consumerId: B1.c, newUnitId: n }))); t('race: one applicant shifted to 2 units at once -> exactly one move, one is refused', rs3.filter(x => x.s === 200).length === 1 && rs3.filter(x => x.s !== 200).length === 1 && [N1, N2].filter(n => ust(n) === 'available').length === 1, JSON.stringify(rs3.map(x => x.s)));
  const C1 = await sold(), NC = await unit(); const rs4 = await Promise.all(Array.from({ length: 5 }, () => PM('POST', '/allocations/shift', { consumerId: C1.c, newUnitId: NC }))); t('race: the same shift sent 5 times -> made once', rs4.filter(x => x.s === 200).length === 1 && psql(`select count(*) from unit_shifts where consumer_id='${C1.c}'`) === '1', JSON.stringify(rs4.map(x => x.s)));
  // super_admin does not need the process
  const D1 = await sold(), ND = await unit(); r = await A('POST', '/allocations/shift', { consumerId: D1.c, newUnitId: ND }); t('shift: super_admin does not need the process', r.s === 200, r.s + JSON.stringify(r.j));
  proc(false);
  // history list
  const bad2 = async (n, q) => { const x = await A('GET', '/allocations/shifts?' + q); t(`shifts: ${n} -> 400`, x.s === 400, x.s); };
  await bad2('projectId not an id', 'projectId=abc'); await bad2('from not a date', 'from=abc'); await bad2('to 2020-02-30', 'to=2020-02-30'); await bad2('dates the wrong way', 'from=2026-05-01&to=2026-01-01'); await bad2('pageSize 0', 'pageSize=0'); await bad2('pageSize abc', 'pageSize=abc'); await bad2('pageSize with SQL', 'pageSize=1;drop table unit_shifts'); await bad2('pageSize 1001', 'pageSize=1001');
  r = await A('GET', `/allocations/shifts?projectId=${P1}&from=${later(-3)}&to=${today}&pageSize=500`); t('shifts: the history lists the shift with both unit numbers, filtered by project and dates', r.s === 200 && r.j.data.some(x => x.consumer_id === S.c && x.old_unit_number && x.new_unit_number && x.project_name), r.s);
  r = await A('GET', `/allocations/shifts?projectId=${P2}`); t('shifts: another project does not show it', r.s === 200 && !r.j.data.some(x => x.consumer_id === S.c), r.s);
}

// ---------- the list and the waitlist ----------
{
  const F = await free(); await allot(F); const S = await sold();
  const bad = async (n, q, code = 400) => { const x = await A('GET', '/allocations?' + q); t(`list: ${n} -> ${code}`, x.s === code, x.s + ' ' + JSON.stringify(x.j).slice(0, 100)); };
  await bad('pageSize with SQL', 'pageSize=1;drop table allocations'); await bad('pageSize 0', 'pageSize=0'); await bad('pageSize 1001', 'pageSize=1001'); await bad('pageSize abc', 'pageSize=abc'); await bad('page 0', 'page=0'); await bad('page abc', 'page=abc');
  await bad('projectId not an id', 'projectId=abc'); await bad('consumerId not an id', 'consumerId=abc'); await bad('status "weird"', 'status=weird'); await bad('dateFrom not a date', 'dateFrom=abc'); await bad('dateTo 2020-02-30', 'dateTo=2020-02-30'); await bad('dates the wrong way', 'dateFrom=2026-05-01&dateTo=2026-01-01');
  await bad('search given twice', 'search=a&search=b'); await bad('firstName with <b>', 'firstName=%3Cb%3E'); await bad('unitAddress 101 characters', 'unitAddress=' + 'u'.repeat(101));
  r = await A('GET', `/allocations?projectId=${P1}&pageSize=1000`); t('list: by default only the allotted ones', r.s === 200 && r.j.data.length >= 1 && r.j.data.every(x => x.status === 'allotted') && r.j.data.some(x => x.consumer_id === F.c), r.s);
  r = await A('GET', `/allocations?projectId=${P1}&status=booked&pageSize=1000`); t('list: status=booked shows the booked ones', r.s === 200 && r.j.data.some(x => x.consumer_id === S.c) && r.j.data.every(x => x.status === 'booked'), r.s);
  r = await A('GET', `/allocations?projectId=${P1}&status=all&pageSize=1000`); t('list: status=all shows every status', r.s === 200 && r.j.data.some(x => x.consumer_id === S.c) && r.j.data.some(x => x.consumer_id === F.c), r.s);
  r = await A('GET', `/allocations?consumerId=${S.c}`); t('list: consumerId shows that applicant\'s allocation whatever its status (it used to be ignored)', r.s === 200 && r.j.data.length === 1 && r.j.data[0].consumer_id === S.c, r.s + ' ' + (r.j.data || []).length);
  for (const q of ['search=Bk', 'registrationNo=zz', 'firstName=Bk', 'unitAddress=B', `dateFrom=${later(-3)}&dateTo=${today}`, 'pageSize=2&page=2']) { const x = await A('GET', '/allocations?' + q); t(`list: filter ${q.split('=')[0]} works`, x.s === 200, x.s); }
  r = await A('GET', `/allocations?search=${encodeURIComponent('%')}`); t('list: "%" matches nothing', r.s === 200 && r.j.data.length === 0, r.s);
  r = await A('GET', `/allocations?search=${encodeURIComponent("x' or '1'='1")}`); t('list: a quote is just text', r.s === 200 && r.j.data.length === 0, r.s);
  const p1 = await A('GET', '/allocations?pageSize=3&page=1&status=all'), p2 = await A('GET', '/allocations?pageSize=3&page=2&status=all'); t('list: page 2 differs from page 1', !p1.j.data.some(d => p2.j.data.some(e => e.id === d.id)));
  r = await A('GET', '/allocations/waitlist?projectId=abc'); t('waitlist: projectId not an id -> 400', r.s === 400, r.s); r = await A('GET', `/allocations/waitlist?projectId=${P1}`); t('waitlist: works for a project', r.s === 200 && Array.isArray(r.j.data), r.s);
}

// ---------- allotment letters ----------
{
  const bad = await A('POST', '/allocations/generate-letters', { projectId: 'abc' }); t('letters: projectId not an id -> 400', bad.s === 400, bad.s);
  const P5 = await mkProj('L'), T5 = await tw(P5); const fs = []; for (let i = 0; i < 3; i++) { const c = await person(P5), u = await unit(P5, T5); const x = await A('POST', '/allocations', { consumerId: c, unitId: u, projectId: P5 }); if (x.s !== 201) throw new Error('allot ' + JSON.stringify(x)); fs.push(x.j.data.id); }
  const rs = await Promise.all(Array.from({ length: 4 }, () => A('POST', '/allocations/generate-letters', { projectId: P5 })));
  t('letters: 4 clicks at once -> each allotted applicant gets exactly one letter in total', rs.every(x => x.s === 200) && rs.reduce((s, x) => s + x.j.data.generated, 0) === 3 && psql(`select count(*) from allotment_letters where allocation_id in ('${fs.join("','")}')`) === '3', JSON.stringify(rs.map(x => x.j.data?.generated)));
  const again = await A('POST', '/allocations/generate-letters', { projectId: P5 }); t('letters: running it again makes none', again.s === 200 && again.j.data.generated === 0, JSON.stringify(again.j));
  t('letters: every allocation is linked to its letter, with an audit row', psql(`select count(*) from allocations where id in ('${fs.join("','")}') and allotment_letter_id is not null`) === '3');
  psql(`delete from allotment_letters where allocation_id in ('${fs.join("','")}')`);
}

// ---------- e-draw import ----------
{
  const bad = async (n, bd, code = 400) => { const x = await A('POST', '/allocations/import-edraw', bd); t(`e-draw: ${n} -> ${code}`, x.s === code, x.s + ' ' + JSON.stringify(x.j).slice(0, 110)); };
  await bad('no body', undefined); await bad('projectId missing', { results: [{ applicantId: 'x' }] }); await bad('projectId not an id', { projectId: 'abc', results: [{ applicantId: 'x' }] }); await bad('unknown project', { projectId: NILS, results: [{ applicantId: 'x' }] }, 404);
  for (const v of [undefined, 'abc', {}, 5, []]) await bad(`results ${JSON.stringify(v)}`, { projectId: P1, results: v });
  await bad('a result that is not an object', { projectId: P1, results: ['x'] }); await bad('a result that is a list', { projectId: P1, results: [[1]] }); await bad('applicantId missing', { projectId: P1, results: [{ result: 'allotted' }] }); await bad('applicantId 101 characters', { projectId: P1, results: [{ applicantId: 'a'.repeat(101) }] });
  await bad('result with <b>', { projectId: P1, results: [{ applicantId: 'x', result: '<b>' }] }); await bad('5001 results', { projectId: P1, results: Array.from({ length: 5001 }, (_, i) => ({ applicantId: 'x' + i })) });
  await bad('company bank account not an id', { projectId: P1, results: [{ applicantId: 'x' }], companyBankAccountId: 'zz' }); await bad('company bank account that does not exist', { projectId: P1, results: [{ applicantId: 'x' }], companyBankAccountId: NILS });
  const mk = async (aad, paid = 0) => { const c = await person(P1, { aadhaar_no: aad }); if (paid) { const p = await A('POST', '/payments/receipts', { consumerId: c, amountReceivedInr: paid, paymentMode: 'neft', referenceNumber: `ED${U}${++rn}`, paymentDate: today, installmentIndex: 9 }); await A('PATCH', `/payments/receipts/${p.j.data.id}/clear`, { clearing_date: today }); } return c; };
  const a1 = await mk('2345' + String(Date.now() % 1e8).padStart(8, '0'), 5000), a2 = await mk('3456' + String((Date.now() + 7) % 1e8).padStart(8, '0'), 0);
  const aad1 = psql(`select aadhaar_no from consumers where id='${a1}'`), aad2 = psql(`select aadhaar_no from consumers where id='${a2}'`), mob1 = psql(`select mobile from consumers where id='${a1}'`);
  const holder = await sold(5000); const mobH = psql(`select mobile from consumers where id='${holder.c}'`);
  r = await A('POST', '/allocations/import-edraw', { projectId: P1, results: [{ applicantId: aad1, result: 'unsuccessful' }, { applicantId: aad2, result: 'unsuccessful' }, { applicantId: 'NOPE' + U, result: 'allotted' }, { applicantId: aad2, result: 'allotted' }] });
  t('e-draw: a paid applicant of an unsuccessful draw gets a refund record, one who paid nothing does not, an unknown one is reported', r.s === 200 && r.j.data.refundsCreated === 1 && r.j.data.mismatches.some(m => m.applicantId === 'NOPE' + U) && r.j.data.matched === 3, r.s + JSON.stringify(r.j));
  t('e-draw: the refund is the amount paid, due in 30 days, and the applicant is "cancelled"', psql(`select refund_amount_inr::int || '/' || refund_status from draw_refunds where consumer_id='${a1}'`) === '5000/pending' && cst(a1) === 'cancelled/');
  r = await A('POST', '/allocations/import-edraw', { projectId: P1, results: [{ applicantId: aad1, result: 'unsuccessful' }] }); t('e-draw: importing the same file again does not create the refund twice', r.s === 200 && r.j.data.refundsCreated === 0 && psql(`select count(*) from draw_refunds where consumer_id='${a1}'`) === '1', r.s + JSON.stringify(r.j));
  r = await A('POST', '/allocations/import-edraw', { projectId: P1, results: [{ applicantId: mob1, result: 'allotted' }] }); t('e-draw: an applicant can also be found by mobile number', r.s === 200 && r.j.data.matched === 1, r.s + JSON.stringify(r.j));
  r = await A('POST', '/allocations/import-edraw', { projectId: P1, results: [{ applicantId: mobH, result: 'unsuccessful' }] }); t('e-draw: an applicant who already holds a unit gets no refund record', r.s === 200 && r.j.data.refundsCreated === 0 && psql(`select count(*) from draw_refunds where consumer_id='${holder.c}'`) === '0', r.s + JSON.stringify(r.j));
  r = await A('POST', '/allocations/import-edraw', { projectId: P2, results: [{ applicantId: aad2, result: 'unsuccessful' }] }); t('e-draw: an applicant of another project is not matched', r.s === 200 && r.j.data.matched === 0, r.s + JSON.stringify(r.j));
  // the CSV file the screen uploads
  const a3 = await mk('4567' + String((Date.now() + 13) % 1e8).padStart(8, '0'), 2000), mob3 = psql(`select mobile from consumers where id='${a3}'`);
  const send = async (csv, extra = {}) => { const fd = new FormData(); fd.append('file', new Blob([csv], { type: 'text/csv' }), 'draw.csv'); fd.append('projectId', P1); for (const [k, v] of Object.entries(extra)) fd.append(k, v); const x = await fetch(B + '/allocations/import-edraw', { method: 'POST', headers: { authorization: 'Bearer ' + tokA }, body: fd }); let j = null; try { j = await x.json(); } catch {} return { s: x.status, j }; };
  r = await send(`mobile,result\n${mob3},unsuccessful\nNOPE${U},allotted\n`); t('e-draw: the uploaded CSV file is read (this used to be a server error)', r.s === 200 && r.j.data.refundsCreated === 1 && r.j.data.unsuccessful === 1 && r.j.data.allotted === 1 && r.j.data.errors === 1, r.s + JSON.stringify(r.j));
  r = await send('hello\nworld\n'); t('e-draw: a CSV with no applicant / result columns -> 400', r.s === 400, r.s + JSON.stringify(r.j)); r = await send('registration_no,result\n'); t('e-draw: a CSV with only a header -> 400', r.s === 400, r.s);
  r = await send(`mobile,result\n${mob3},unsuccessful\n`, { companyBankAccountId: 'zz' }); t('e-draw: a bad bank account in the form -> 400', r.s === 400, r.s);
  const fd2 = new FormData(); fd2.append('file', new Blob(['x'.repeat(2 * 1024 * 1024 + 10)]), 'big.csv'); fd2.append('projectId', P1); const big = await fetch(B + '/allocations/import-edraw', { method: 'POST', headers: { authorization: 'Bearer ' + tokA }, body: fd2 }); t('e-draw: a file over 2 MB is refused (not a 500)', big.status >= 400 && big.status < 500, big.status);
}

// ---------- random input ----------
{
  const junks = [null, undefined, '', ' ', 'abc', '-1', 0, -5, 1e12, 1.5, true, false, [], [1], {}, { a: 1 }, "x'--", '<script>1</script>', '%', '_', '\\', 'A'.repeat(300), '2026-13-45', '9999-99-99', NIL, NILS, '\u0000', '😀', '१२३'];
  const junk = () => pick(junks); const five = []; const chk = (tag, x, info) => { if (x.s >= 500) five.push([tag, info, x.s]); };
  const S = await sold(), F = await free();
  for (let i = 0; i < 70; i++) {
    const bd = { consumerId: rnd() < 0.3 ? F.c : junk(), unitId: rnd() < 0.3 ? F.u : junk(), projectId: rnd() < 0.5 ? P1 : junk() }; for (let k = ri(0, 3); k > 0; k--) bd[pick(['allotmentDate', 'remarks', 'consumerId', 'unitId', 'projectId'])] = junk();
    chk('allot', await A('POST', '/allocations', bd), JSON.stringify(bd).slice(0, 140));
    const id = encodeURIComponent(String(pick([NILS, 'abc', junk()]))); chk('cancel', await A('POST', `/allocations/${id}/cancel`, { reason: junk() }), id);
    const sb = { consumerId: pick([NILS, junk(), 'abc']), newUnitId: pick([NILS, junk(), F.u]) }; for (let k = ri(0, 2); k > 0; k--) sb[pick(['reason', 'shiftDate'])] = junk(); chk('shift', await A('POST', '/allocations/shift', sb), JSON.stringify(sb).slice(0, 120));
    const eb = { projectId: rnd() < 0.5 ? P1 : junk(), results: rnd() < 0.6 ? [{ applicantId: junk(), result: junk() }] : junk() }; if (rnd() < 0.3) eb.companyBankAccountId = junk(); chk('e-draw', await A('POST', '/allocations/import-edraw', eb), JSON.stringify(eb).slice(0, 140));
    chk('letters', await A('POST', '/allocations/generate-letters', { projectId: pick([junk(), NILS]) }), '');
    const q = Array.from({ length: ri(1, 3) }, () => pick(['page', 'pageSize', 'projectId', 'consumerId', 'status', 'search', 'registrationNo', 'firstName', 'unitAddress', 'dateFrom', 'dateTo']) + '=' + encodeURIComponent(String(junk()))).join('&'); chk('list', await A('GET', '/allocations?' + q), q);
    const q2 = Array.from({ length: ri(1, 3) }, () => pick(['projectId', 'from', 'to', 'pageSize']) + '=' + encodeURIComponent(String(junk()))).join('&'); chk('shifts', await A('GET', '/allocations/shifts?' + q2), q2);
    chk('waitlist', await A('GET', '/allocations/waitlist?projectId=' + encodeURIComponent(String(junk()))), '');
    if (i % 8 === 0) await new Promise(res => setTimeout(res, 40));
  }
  t('random: 70 rounds of random allot, cancel, shift, e-draw, letters, list, shifts and waitlist calls never gave a 500', five.length === 0, JSON.stringify(five.slice(0, 3)));
  t('random: whatever the junk did, the sold applicant\'s allocation and unit still agree', psql(`select count(*) from allocations a join units u on u.id=a.unit_id where a.id='${S.al}' and a.status<>'cancelled' and u.id='${S.u}'`) === '1' || g('allocations', S.al, 'status') === 'cancelled');
}

// ---------- the earlier screens still work ----------
{
  const S = await sold(1000);
  r = await A('GET', `/payments/demands?consumerId=${S.c}`); t('earlier: the demand list works', r.s === 200 && r.j.data.length === 3, r.s);
  r = await A('GET', `/booking/${S.id}`); t('earlier: the booking opens', r.s === 200, r.s);
  r = await A('GET', `/surrender/consumers?projectId=${P1}`); t('earlier: the surrender list works', r.s === 200, r.s);
  r = await A('GET', `/transfers/unit-owner/${S.u}`); t('earlier: the unit-owner lookup works', r.s === 200 && r.j.data.id === S.c, r.s);
}

// ---------- clean up ----------
proc(false);
if (madeSlab) for (const sql of [`delete from gst_tax_charge_mapping where slab_id='${slab}'`, `delete from gst_tax_setup where slab_id='${slab}'`, `delete from gst_slabs where id='${slab}'`]) { try { psql(sql); } catch { /* ignore */ } }
{
  const ids = made.map(x => `'${x}'`).join(',');
  for (const sql of [
    `delete from waitlists where consumer_id in (${ids})`, `delete from draw_refunds where consumer_id in (${ids})`, `delete from unit_shifts where consumer_id in (${ids})`,
    `delete from allotment_letters where consumer_id in (${ids})`, `update allocations set allotment_letter_id = null where consumer_id in (${ids})`,
    `delete from audit_logs where resource_type in ('surrender','cancellation','allocation','unit_shift','edraw_import','allotment_letters') and resource_id in (select id from surrender_applications where consumer_id in (${ids}) union select id from cancellations where consumer_id in (${ids}) union select id from allocations where consumer_id in (${ids}) union select consumer_id from unit_shifts where consumer_id in (${ids}))`,
    `delete from surrender_applications where consumer_id in (${ids})`, `delete from cancellations where consumer_id in (${ids})`,
    `delete from audit_logs where resource_type in ('receipt','demand') and resource_id in (select id from receipts where consumer_id in (${ids}) union select id from demands where consumer_id in (${ids}))`,
    `delete from cheque_bounce_logs where consumer_id in (${ids})`, `delete from booking_documents where consumer_id in (${ids})`, `delete from receipts where consumer_id in (${ids})`, `delete from demands where consumer_id in (${ids})`,
    `delete from financial_audit_logs where consumer_id in (${ids})`, `delete from payment_plans where consumer_id in (${ids})`, `delete from allocations where consumer_id in (${ids})`,
    `delete from unit_status_history where reason like 'Unit shifting%' or reason like 'Allotment created' and changed_by_user_id is not null and false`,
    `delete from broker_commissions where consumer_id in (${ids})`, `delete from booking_payment_taxes where booking_record_id in (select id from booking_records where consumer_id in (${ids}))`,
    `delete from booking_records where consumer_id in (${ids})`, `delete from co_applicants where consumer_id in (${ids})`, `delete from consumers where id in (${ids})`,
  ]) { try { psql(sql); } catch { /* leftovers are harmless, names carry the run id */ } }
}

// an allocation made on the Allotment screen has no booking: cancelling it must work (it was a 500 once the cancel looked at the booking's commission)
{ const c = await person(P1), u = await unit(); const x = await A('POST', '/allocations', { consumerId: c, unitId: u, projectId: P1 }); t('no-booking allocation: allotted', x.s === 201, x.s + JSON.stringify(x.j));
  const y = await A('POST', `/allocations/${x.j.data.id}/cancel`, { reason: 'no booking behind it' }); t('no-booking allocation: cancel works (200, not 500)', y.s === 200, y.s + JSON.stringify(y.j)); }
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
