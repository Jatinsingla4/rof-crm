// Preferred Location Charges (PLC): roles, rates, quote for Booking, assigning units to locations, location delete guard, booking guard.
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-plc.mjs   (psql must reach the same database)
import { execFileSync } from 'node:child_process';
const B = process.env.BASE || 'http://localhost:3010/api';
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };
const login = async (email) => (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Test#Pass1234' }) })).json()).token;
const call = (tok) => async (m, p, b, raw) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: raw ?? (b === undefined ? undefined : JSON.stringify(b)) }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const A = call(await login('super_admin@test.local')), PM = call(await login('project_manager@test.local')), SE = call(await login('sales_executive@test.local')), RO = call(await login('read_only_viewer@test.local'));
const psql = (sql) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' }).trim().split('\n')[0];
const U = Date.now().toString(36).slice(-5), NIL = '00000000-0000-0000-0000-000000000000';
let r;
const co = (await A('POST', '/companies', { name: 'PLC Co ' + U })).j.data.id;
const mkProj = async (tag) => (await A('POST', '/projects', { companyId: co, name: `PLC ${tag} ${U}`, reraNumber: `PL${tag}-${U}`, tcpLicence: 'x' })).j.data.id;
const P1 = await mkProj('A'), P2 = await mkProj('B');
const tw = async (P) => (await A('POST', `/projects/${P}/towers`, { towerName: 'T' + U })).j.data.id;
const T1 = await tw(P1), T2 = await tw(P2);
const loc = async (P, n) => (await A('POST', `/projects/${P}/unit-locations`, { name: n + U })).j.data.id;
const L1 = await loc(P1, 'Park facing '), L2 = await loc(P1, 'Corner '), L3 = await loc(P1, 'Main road '), LB = await loc(P2, 'Other project ');
const unit = async (P, T, n, carpet = 1000) => (await A('POST', '/units', { projectId: P, towerId: T, unitNumber: n, floor: 1, bhkType: '2BHK', carpetAreaSqft: carpet, superAreaSqft: carpet ? carpet + 200 : undefined, basePriceInr: 9000000, totalPriceInr: 9500000 })).j.data.id;
const u1 = await unit(P1, T1, 'U1', 1000), u2 = await unit(P1, T1, 'U2', 833.33), u3 = await unit(P1, T1, 'U3', null), uB = await unit(P2, T2, 'UB');
const add = (b) => A('POST', '/plc-charges', { projectId: P1, unitLocationId: L1, rateType: 'per_sqft', rateValue: 150, ...b });

// ---------- roles ----------
for (const [n, c] of [['sales_executive', SE], ['read_only_viewer', RO]]) {
  r = await c('POST', '/plc-charges', { projectId: P1, unitLocationId: L1, rateValue: 1 }); t(`roles: ${n} cannot add a rate -> 403`, r.s === 403, r.s);
  r = await c('POST', '/plc-charges/assign', { projectId: P1, unitLocationId: L1, unitIds: [u1] }); t(`roles: ${n} cannot assign units -> 403`, r.s === 403, r.s);
  r = await c('GET', `/plc-charges?projectId=${P1}`); t(`roles: ${n} can read the rates`, r.s === 200, r.s);
  r = await c('GET', `/plc-charges/quote?unitId=${u1}`); t(`roles: ${n} can ask for a quote`, r.s === 200, r.s);
}
r = await PM('POST', '/plc-charges', { projectId: P1, unitLocationId: L3, rateValue: 100 }); t('roles: project_manager can add a rate', r.s === 201, JSON.stringify(r.j)); const pmRate = r.j?.data?.id;
r = await PM('DELETE', `/plc-charges/${pmRate}`); t('roles: project_manager cannot remove (matrix) -> 403', r.s === 403, r.s);
r = await A('DELETE', `/plc-charges/${pmRate}`); t('roles: super admin removes it', r.s === 200, r.s);

// ---------- adding a rate ----------
for (const [n, o, re] of [['project not an id', { projectId: 'x' }, /projectId/], ['location not an id', { unitLocationId: 'x' }, /unitLocationId/], ['no location', { unitLocationId: undefined }, /unitLocationId/], ['unknown rate type', { rateType: 'percent' }, /flat or per_sqft/], ['no rate', { rateValue: undefined }, /Rate/],
  ['rate zero', { rateValue: 0 }, /more than 0/], ['rate negative', { rateValue: -5 }, /Rate/], ['rate text', { rateValue: 'abc' }, /Rate/], ['rate exponent', { rateValue: '1e2' }, /Rate/], ['rate 3 decimals', { rateValue: '1.005' }, /Rate/], ['rate huge', { rateValue: 1e12 }, /Rate/], ['rate array', { rateValue: [5] }, /Rate/], ['rate boolean', { rateValue: true }, /Rate/],
  ['location of another project', { unitLocationId: LB }, /does not belong/], ['unknown location', { unitLocationId: NIL }, /does not belong/]]) { r = await add(o); t(`rate: ${n} -> 400`, r.s === 400 && re.test(r.j?.error || ''), r.s + ' ' + JSON.stringify(r.j)); }
r = await A('POST', '/plc-charges', undefined, '[1]'); t('rate: array body -> 400', r.s === 400, r.s); r = await A('POST', '/plc-charges', undefined, '{oops'); t('rate: broken JSON -> 4xx', r.s >= 400 && r.s < 500, r.s);
r = await add({ rateValue: '150.55' }); t('rate: add per sq ft', r.s === 201 && Number(r.j.data.rate_value) === 150.55 && r.j.data.rate_type === 'per_sqft', JSON.stringify(r.j)); const R1 = r.j.data.id;
r = await add({}); t('rate: the same location twice -> 400', r.s === 400 && /already has/.test(r.j.error), JSON.stringify(r.j));
const rr = await Promise.all(Array.from({ length: 6 }, () => add({ unitLocationId: L2, rateType: 'flat', rateValue: 50000 }))); t('rate: 6 parallel adds for one location -> exactly 1', rr.filter(x => x.s === 201).length === 1 && rr.every(x => x.s === 201 || x.s === 400), rr.map(x => x.s).join());
const R2 = rr.find(x => x.s === 201).j.data.id;
r = await A('GET', `/plc-charges?projectId=${P1}`); t('rate: list with location names', r.s === 200 && r.j.data.length === 2 && r.j.data.some(x => x.location_name === 'Corner ' + U && x.rate_type === 'flat'), JSON.stringify(r.j));
for (const q of ['', 'projectId=x', `projectId=${P1}&projectId=${P2}`]) { r = await A('GET', '/plc-charges?' + q); t(`rate list: bad project (${q || 'none'}) -> 400`, r.s === 400, r.s); }

// ---------- editing ----------
const pr = (id, b, raw) => A('PATCH', `/plc-charges/${id}`, b, raw);
r = await pr('x', { rateValue: 1 }); t('edit: bad id -> 400', r.s === 400, r.s); r = await pr(NIL, { rateValue: 1 }); t('edit: unknown -> 404', r.s === 404, r.s);
for (const [n, b] of [['rate zero', { rateValue: 0 }], ['rate text', { rateValue: 'x' }], ['rate negative', { rateValue: -1 }], ['type unknown', { rateType: 'x' }], ['isActive text', { isActive: 'yes' }], ['isActive number', { isActive: 1 }]]) { r = await pr(R1, b); t(`edit: ${n} -> 400`, r.s === 400, r.s + ' ' + JSON.stringify(r.j)); }
r = await pr(R1, {}); t('edit: nothing sent keeps the rate', r.s === 200 && Number(r.j.data.rate_value) === 150.55, JSON.stringify(r.j)); r = await pr(R1, undefined, '[1]'); t('edit: array body is harmless', r.s === 200, r.s);
r = await pr(R1, { rateValue: 200 }); t('edit: only the value changes', r.s === 200 && Number(r.j.data.rate_value) === 200 && r.j.data.rate_type === 'per_sqft' && r.j.data.is_active === true, JSON.stringify(r.j));
r = await SE('PATCH', `/plc-charges/${R1}`, { rateValue: 5 }); t('edit: sales_executive -> 403', r.s === 403, r.s);

// ---------- assign units ----------
const as = (b, raw) => A('POST', '/plc-charges/assign', { projectId: P1, unitLocationId: L1, unitIds: [u1], ...b }, raw);
for (const [n, b, re] of [['project not an id', { projectId: 'x' }, /projectId/], ['location not an id', { unitLocationId: 'x' }, /unitLocationId/], ['no units', { unitIds: [] }, /at least one/], ['units not a list', { unitIds: 'a' }, /at least one/], ['a unit id that is not an id', { unitIds: [u1, 'x'] }, /unit id/],
  ['2001 units', { unitIds: Array.from({ length: 2001 }, () => u1) }, /2000/], ['a unit of another project', { unitIds: [u1, uB] }, /not in this project/], ['an unknown unit', { unitIds: [u1, NIL] }, /not in this project/], ['location of another project', { unitLocationId: LB }, /does not belong/]]) {
  r = await as(b); t(`assign: ${n} -> 400`, r.s === 400 && re.test(r.j?.error || ''), r.s + ' ' + JSON.stringify(r.j)); }
t('assign: nothing changed after the refused calls', psql(`select count(*) from units where unit_location_id is not null and project_id='${P1}'`) === '0');
r = await as(undefined, '[1]'); t('assign: array body -> 400', r.s === 400, r.s);
r = await as({ unitIds: [u1, u1, u2] }); t('assign: repeated ids are counted once', r.s === 200 && r.j.data.updated === 2, JSON.stringify(r.j));
t('assign: both units are at the location', psql(`select count(*) from units where unit_location_id='${L1}'`) === '2');
r = await as({ unitLocationId: L2, unitIds: [u3] }); t('assign: another location for another unit', r.s === 200, r.s);
psql(`UPDATE units SET status='booked' WHERE id='${u1}'`); r = await as({ unitLocationId: L2, unitIds: [u1] }); t('assign: a booked unit can still be given a location (its booking keeps its own amount)', r.s === 200, r.s);
r = await as({ unitLocationId: L1, unitIds: [u1] });
r = await A('GET', `/plc-charges/units?projectId=${P1}`); t('units list: the project\'s units with their location, no other project', r.s === 200 && r.j.data.length === 3 && r.j.data.find(x => x.id === u1).location_name === 'Park facing ' + U && !r.j.data.some(x => x.id === uB), JSON.stringify(r.j.data?.length));
r = await A('GET', '/plc-charges/units?projectId=x'); t('units list: bad project -> 400', r.s === 400, r.s);
r = await A('GET', `/plc-charges?projectId=${P1}`); t('rate list: unit counts per location', r.j.data.find(x => x.location_name === 'Park facing ' + U).unit_count === 2 && r.j.data.find(x => x.location_name === 'Corner ' + U).unit_count === 1, JSON.stringify(r.j.data.map(x => x.unit_count)));
const par = await Promise.all([as({ unitLocationId: L1, unitIds: [u2] }), as({ unitLocationId: L2, unitIds: [u2] }), as({ unitLocationId: null, unitIds: [u2] })]); t('assign: parallel changes to one unit all succeed and leave one valid value', par.every(x => x.s === 200) && ['', L1, L2].includes(psql(`select coalesce(unit_location_id::text,'') from units where id='${u2}'`)), par.map(x => x.s).join());
await as({ unitLocationId: L1, unitIds: [u2] });

// ---------- the quote Booking asks for ----------
const Q = (id) => A('GET', `/plc-charges/quote?unitId=${id}`);
r = await Q(u1); t('quote: per sq ft = rate x carpet area (200 x 1000)', r.s === 200 && r.j.data.amount === 200000 && r.j.data.location === 'Park facing ' + U && /per sq ft/.test(r.j.data.basis), JSON.stringify(r.j));
r = await Q(u2); t('quote: amount is rounded to paise (200 x 833.33)', r.j.data.amount === 166666, JSON.stringify(r.j));
r = await Q(u3); t('quote: flat amount ignores the area', r.j.data.amount === 50000 && r.j.data.basis === 'flat', JSON.stringify(r.j));
r = await pr(R1, { rateValue: 150.55 }); r = await Q(u1); t('quote: follows a rate edit (150.55 x 1000)', r.j.data.amount === 150550, JSON.stringify(r.j));
const u4 = await unit(P1, T1, 'U4', null); await as({ unitIds: [u4] }); r = await Q(u4); t('quote: a per sq ft rate on a unit with no carpet area is 0, not NaN', r.j.data.amount === 0, JSON.stringify(r.j));
const u5 = await unit(P1, T1, 'U5'); r = await Q(u5); t('quote: a unit with no location -> 0 and no location', r.j.data.amount === 0 && r.j.data.location === null, JSON.stringify(r.j));
await as({ unitLocationId: L3, unitIds: [u5] }); r = await Q(u5); t('quote: a location with no rate -> 0 with its name', r.j.data.amount === 0 && r.j.data.location === 'Main road ' + U, JSON.stringify(r.j));
r = await pr(R1, { isActive: false }); r = await Q(u1); t('quote: a rate that is turned off -> 0', r.j.data.amount === 0, JSON.stringify(r.j)); await pr(R1, { isActive: true });
r = await Q('x'); t('quote: bad unit id -> 400', r.s === 400, r.s); r = await Q(NIL); t('quote: unknown unit -> 404', r.s === 404, r.s); r = await A('GET', '/plc-charges/quote'); t('quote: no unit -> 400', r.s === 400, r.s);
r = await A('GET', `/plc-charges/quote?unitId=${u1}&unitId=${u2}`); t('quote: repeated unit -> 400', r.s === 400, r.s);

// ---------- a location that is in use cannot be deleted ----------
r = await A('DELETE', `/projects/${P1}/unit-locations/${L1}`); t('location delete: used by units and a rate -> 409', r.s === 409 && /used/.test(r.j.error), JSON.stringify(r.j));
await as({ unitLocationId: null, unitIds: [u1, u2, u4] }); r = await A('DELETE', `/projects/${P1}/unit-locations/${L1}`); t('location delete: no units but still a rate -> 409', r.s === 409, JSON.stringify(r.j));
r = await A('DELETE', `/plc-charges/${R1}`); t('rate: remove', r.s === 200, r.s); r = await A('DELETE', `/plc-charges/${R1}`); t('rate: remove twice -> 404', r.s === 404, r.s); r = await A('DELETE', '/plc-charges/x'); t('rate: remove bad id -> 400', r.s === 400, r.s);
r = await A('DELETE', `/projects/${P1}/unit-locations/${L1}`); t('location delete: free location', r.s === 200, JSON.stringify(r.j));

// ---------- booking: PLC and other charge amounts ----------
for (const [n, b] of [['PLC negative', { plc_amount: -1 }], ['PLC text', { plc_amount: 'abc' }], ['PLC boolean', { plc_amount: true }], ['PLC array', { plc_amount: [5] }], ['PLC 1e12', { plc_amount: 1e12 }], ['other charge negative', { other_charge_amount: -5 }], ['other charge text', { other_charge_amount: 'x' }]]) {
  r = await A('POST', '/booking', { consumer_id: NIL, project_id: P1, unit_id: u3, selected_plan_name: 'x', ...b }); t(`booking: ${n} -> 400`, r.s === 400 && /amount/.test(r.j?.error || ''), r.s + ' ' + JSON.stringify(r.j)); }

// ---------- audit ----------
t('audit: rates and assignments are logged', Number(psql(`select count(*) from audit_logs where resource_type in ('plc_charge','plc_assignment')`)) >= 10);
console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
