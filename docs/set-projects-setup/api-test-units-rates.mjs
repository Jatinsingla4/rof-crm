// Project Set Up, second pass, and Rate Report: unit rules, locks on a sold unit, paging that cannot be injected, bulk import,
// owner/receipt figures per unit, project fields, rate report figures.
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-units-rates.mjs   (psql must reach the same database)
import { execFileSync } from 'node:child_process';
const B = process.env.BASE || 'http://localhost:3010/api';
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };
const login = async (email) => (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Test#Pass1234' }) })).json()).token;
const call = (tok) => async (m, p, b, raw) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: raw ?? (b === undefined ? undefined : JSON.stringify(b)) }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const A = call(await login('super_admin@test.local')), PM = call(await login('project_manager@test.local')), SE = call(await login('sales_executive@test.local'));
const RO = call(await login('read_only_viewer@test.local'));
const psql = (sql) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' }).trim().split('\n')[0];
const U = Date.now().toString(36).slice(-5), NIL = '00000000-0000-0000-0000-000000000000';
let r;
const co = (await A('POST', '/companies', { name: 'Unit Co ' + U })).j.data.id;
const mkProj = async (tag, o = {}) => (await A('POST', '/projects', { companyId: co, name: `Unit ${tag} ${U}`, reraNumber: `UN${tag}-${U}`, tcpLicence: 'x', ...o })).j.data.id;
const P1 = await mkProj('A'), P2 = await mkProj('B');
const tw = async (P, n) => (await A('POST', `/projects/${P}/towers`, { towerName: n + U })).j.data.id;
const T1 = await tw(P1, 'T1'), T2 = await tw(P1, 'T2'), TB = await tw(P2, 'TB');
const UT2 = (await A('POST', '/master/unit-types', { project_id: P2, name: 'Other type ' + U })).j.data?.id;
const base = (o = {}) => ({ projectId: P1, towerId: T1, unitNumber: 'A-101', floor: 1, bhkType: '2BHK', carpetAreaSqft: 800, superAreaSqft: 1000, basePriceInr: 9000000, totalPriceInr: 9500000, facing: 'East', ...o });
const add = (o) => A('POST', '/units', base(o));

// ---------- add a unit: bad input ----------
const bu = async (n, o, re) => { r = await add({ unitNumber: 'X-' + Math.random().toString(36).slice(2, 7), ...o }); t(`unit: ${n} -> 400`, r.s === 400 && (!re || re.test(r.j?.error || '')), r.s + ' ' + JSON.stringify(r.j)); };
await bu('project id not valid', { projectId: 'x' }, /projectId/); await bu('tower id not valid', { towerId: 'x' }, /towerId/); await bu('no BHK', { bhkType: '' }, /BHK/); await bu('BHK markup', { bhkType: '<b>2' }, /character/); await bu('BHK over 50', { bhkType: 'x'.repeat(51) }, /50/); await bu('BHK array', { bhkType: ['2'] }, /text/);
await bu('unit number over 50', { unitNumber: 'U'.repeat(51) }, /50/); await bu('unit number a number', { unitNumber: 101 }, /text/); await bu('unit number markup', { unitNumber: '<i>' }, /character/);
for (const [n, v] of [['text', 'abc'], ['too high', 301], ['too low', -6], ['decimal', 1.5], ['exponent', '1e1'], ['array', [1]], ['boolean', true]]) await bu('floor ' + n, { floor: v }, /Floor/);
await bu('no floor', { floor: undefined }, /Floor/); await bu('facing over 30', { facing: 'x'.repeat(31) }, /30/); await bu('facing markup', { facing: '<x>' }, /character/);
for (const [n, v] of [['javascript:', 'javascript:alert(1)'], ['ftp:', 'ftp://x/y.pdf'], ['with a space', 'https://x/a b.pdf'], ['over 500', 'https://x/' + 'a'.repeat(500)], ['data:', 'data:text/html,hi']]) await bu('floor plan link ' + n, { floorPlanUrl: v }, /link|500/);
for (const [n, o] of [['carpet negative', { carpetAreaSqft: -1 }], ['carpet text', { carpetAreaSqft: 'abc' }], ['carpet 5 decimals', { carpetAreaSqft: '1.00001' }], ['carpet huge', { carpetAreaSqft: 1e9 }], ['carpet exponent', { carpetAreaSqft: '1e3' }],
  ['super below carpet', { carpetAreaSqft: 900, superAreaSqft: 800 }], ['balcony negative', { balconyAreaSqft: -3 }], ['price decimal', { basePriceInr: 100.5 }], ['price negative', { basePriceInr: -1 }], ['price 1e12', { basePriceInr: 1e12, totalPriceInr: 1e12 }],
  ['price text', { basePriceInr: 'lots' }], ['total below base', { basePriceInr: 9000000, totalPriceInr: 8000000 }], ['price array', { totalPriceInr: [5] }]]) await bu(n, o, /Carpet|Super|Balcony|price|Price|Total/);
r = await add({ unitNumber: 'Z1', unitTypeId: UT2 }); t('unit: unit type of another project -> 400', r.s === 400 && /unit type/.test(r.j.error), JSON.stringify(r.j));
r = await add({ unitNumber: 'Z2', towerId: TB }); t('unit: tower of another project -> 400', r.s === 400 && /tower/.test(r.j.error), JSON.stringify(r.j));
r = await A('POST', '/units', undefined, '[1]'); t('unit: array body -> 400', r.s === 400, r.s); r = await A('POST', '/units', undefined, '{oops'); t('unit: broken JSON -> 4xx', r.s >= 400 && r.s < 500, r.s);
// roles
r = await SE('POST', '/units', base({ unitNumber: 'S1' })); t('roles: sales_executive cannot add a unit -> 403', r.s === 403, r.s); r = await RO('POST', '/units', base({ unitNumber: 'S2' })); t('roles: read_only_viewer cannot -> 403', r.s === 403, r.s);
r = await PM('POST', '/units', base({ unitNumber: 'PM1' })); t('roles: project_manager can add', r.s === 201, JSON.stringify(r.j));
// good
r = await add({ unitNumber: ' A-101 ' }); t('unit: add (number trimmed, price stored)', r.s === 201 && r.j.data.unit_number === 'A-101' && Number(r.j.data.total_price_inr) === 9500000, JSON.stringify(r.j)); const u1 = r.j.data.id;
r = await add({ unitNumber: 'a-101' }); t('unit: same number in another letter case -> 409', r.s === 409, JSON.stringify(r.j));
r = await add({ unitNumber: 'A-101', towerId: T2 }); t('unit: same number in another tower is fine', r.s === 201, JSON.stringify(r.j));
const ru = await Promise.all(Array.from({ length: 8 }, () => add({ unitNumber: 'RACE-1' }))); t('unit: 8 parallel adds of one number -> exactly 1', ru.filter(x => x.s === 201).length === 1 && ru.every(x => x.s === 201 || x.s === 409), ru.map(x => x.s).join());
r = await add({ unitNumber: 'MIN', floor: 0, basePriceInr: undefined, totalPriceInr: undefined, carpetAreaSqft: undefined, superAreaSqft: undefined, facing: undefined }); t('unit: ground floor, price and areas left blank is allowed', r.s === 201, JSON.stringify(r.j));
r = await add({ unitNumber: 'EDGE', floor: -2, carpetAreaSqft: '800.5', superAreaSqft: 800.5 }); t('unit: basement floor, equal carpet and super area', r.s === 201, JSON.stringify(r.j));

// ---------- edit a unit ----------
const pu = (id, b, raw) => A('PATCH', `/units/${id}`, b, raw);
r = await pu('x', { facing: 'N' }); t('edit: bad id -> 400', r.s === 400, r.s); r = await pu(NIL, { facing: 'N' }); t('edit: unknown -> 404', r.s === 404, r.s);
r = await pu(u1, {}); t('edit: empty body changes nothing', r.s === 200 && Number(r.j.data.total_price_inr) === 9500000, JSON.stringify(r.j));
r = await pu(u1, undefined, '[1]'); t('edit: array body changes nothing', r.s === 200, r.s);
for (const [n, b] of [['floor text', { floor: 'x' }], ['floor 400', { floor: 400 }], ['facing markup', { facing: '<b>' }], ['facing long', { facing: 'f'.repeat(31) }], ['link javascript:', { floorPlanUrl: 'javascript:1' }], ['price negative', { basePriceInr: -1 }], ['price decimal', { basePriceInr: 1.5 }], ['balcony text', { balconyAreaSqft: 'x' }],
  ['total below the stored base', { totalPriceInr: 100 }], ['base above the stored total', { basePriceInr: 99999999 }]]) { r = await pu(u1, b); t(`edit: ${n} -> 400`, r.s === 400, r.s + ' ' + JSON.stringify(r.j)); }
r = await pu(u1, { facing: 'North', floor: 2, floorPlanUrl: 'https://example.com/plan.pdf', basePriceInr: 9100000, totalPriceInr: 9600000, balconyAreaSqft: 40 }); t('edit: all editable fields', r.s === 200 && Number(r.j.data.total_price_inr) === 9600000, JSON.stringify(r.j));
t('edit: refused edits left the unit as it was', psql(`select facing||floor||base_price_inr||total_price_inr from units where id='${u1}'`) === 'North29100000' + '9600000');
// a booking locks price and balcony
const cons = psql(`INSERT INTO consumers (name, mobile) VALUES ('Unit Buyer ${U}', '9${String(Date.now()).slice(-9)}') RETURNING id`);
const bk = psql(`INSERT INTO booking_records (consumer_id, unit_id, project_id, selected_plan_name, status) VALUES ('${cons}','${u1}','${P1}','x','draft') RETURNING id`);
r = await pu(u1, { basePriceInr: 9200000 }); t('lock: a booked unit\'s price cannot change -> 409', r.s === 409 && /booking/.test(r.j.error), JSON.stringify(r.j));
r = await pu(u1, { balconyAreaSqft: 99 }); t('lock: nor its balcony area -> 409', r.s === 409, r.s);
r = await pu(u1, { basePriceInr: 9100000, totalPriceInr: 9600000, balconyAreaSqft: 40, facing: 'West' }); t('lock: saving the same price with another facing is fine', r.s === 200, JSON.stringify(r.j));
psql(`UPDATE booking_records SET status='cancelled' WHERE id='${bk}'`);
r = await pu(u1, { basePriceInr: 9200000 }); t('lock: a cancelled booking frees the price', r.s === 200, JSON.stringify(r.j));
psql(`UPDATE units SET status='allotted' WHERE id='${u1}'`); r = await pu(u1, { basePriceInr: 9300000 }); t('lock: an allotted unit is locked even with no booking row', r.s === 409, r.s);
psql(`UPDATE units SET status='held' WHERE id='${u1}'`); r = await pu(u1, { basePriceInr: 9300000 }); t('lock: a held unit can still be re-priced', r.s === 200, r.s);
r = await SE('PATCH', `/units/${u1}`, { facing: 'S' }); t('roles: sales_executive cannot edit -> 403', r.s === 403, r.s);

// ---------- the unit list: paging cannot be injected, owner only from a live allocation ----------
const L = (q) => A('GET', '/units?' + q);
for (const [n, q] of [['page size as SQL', 'pageSize=1;select%201'], ['page size sub-query', 'pageSize=(select%20count(*)%20from%20users)'], ['page size with OFFSET', 'pageSize=1%20offset%205'], ['page size negative', 'pageSize=-1'], ['page size zero', 'pageSize=0'], ['page size 1001', 'pageSize=1001'],
  ['page size text', 'pageSize=abc'], ['page size repeated', 'pageSize=1&pageSize=2'], ['page 0', 'page=0'], ['page text', 'page=x'], ['page as SQL', 'page=1)%20or%20(1=1'], ['project repeated', `projectId=${P1}&projectId=${P2}`], ['project not an id', 'projectId=x'], ['tower not an id', 'towerId=x']]) {
  r = await L(q); t(`list: ${n} -> 400`, r.s === 400, r.s + ' ' + JSON.stringify(r.j)); }
r = await L(`projectId=${P1}&pageSize=2&page=1`); const first = r.j?.data?.map(x => x.id) || []; r = await L(`projectId=${P1}&pageSize=2&page=2`); const second = r.j?.data?.map(x => x.id) || [];
t('list: paging gives different rows on page 2', first.length === 2 && second.length >= 1 && !second.some(i => first.includes(i)), JSON.stringify([first.length, second.length]));
r = await L(`projectId=${P1}&status=held`); t('list: status filter', r.s === 200 && r.j.data.length === 1 && r.j.data[0].id === u1, r.s + ' ' + r.j?.data?.length);
r = await L(`projectId=${P1}&consumerName=${encodeURIComponent("' or 1=1 --")}`); t('list: SQL text in a search is only text', r.s === 200 && r.j.data.length === 0, r.s);
r = await RO('GET', `/units?projectId=${P1}`); t('list: read_only_viewer can read', r.s === 200, r.s);
const mkAlloc = (unit, tag, status, P = P1) => { const c = psql(`INSERT INTO consumers (name, first_name, last_name, mobile) VALUES ('Owner ${tag} ${U}', 'Owner', '${tag} ${U}', '9${String(Date.now() + Math.floor(Math.random() * 1e6)).slice(-9)}') RETURNING id`); psql(`INSERT INTO allocations (consumer_id, unit_id, project_id, status) VALUES ('${c}','${unit}','${P}','${status}') RETURNING id`); return c; };
const ua = (await add({ unitNumber: 'OWN-1' })).j.data.id;
mkAlloc(ua, 'old', 'cancelled'); mkAlloc(ua, 'tr', 'transferred');
r = await L(`projectId=${P1}&towerId=${T1}&pageSize=1000`); let row = r.j.data.find(x => x.id === ua);
t('owner: a cancelled and a transferred allocation show no owner', row && row.consumer_name === null, JSON.stringify(row?.consumer_name));
mkAlloc(ua, 'live', 'allotted'); r = await L(`projectId=${P1}&towerId=${T1}&pageSize=1000`);
t('owner: the live allocation shows, the unit appears once', r.j.data.filter(x => x.id === ua).length === 1 && r.j.data.find(x => x.id === ua).consumer_name === 'Owner live ' + U, JSON.stringify(r.j.data.filter(x => x.id === ua).map(x => x.consumer_name)));
psql(`UPDATE units SET status='allotted' WHERE id='${ua}'`);
r = await A('GET', `/units/tower-detail?projectId=${P1}&towerId=${T1}&statusGroup=allotted`); t('tower detail: the unit is listed once, with the live owner', r.s === 200 && r.j.units.filter(x => x.unit_number === 'OWN-1').length === 1 && /Owner live/.test(r.j.units.find(x => x.unit_number === 'OWN-1').consumer_name), JSON.stringify(r.j.units?.filter(x => x.unit_number === 'OWN-1')));
r = await A('GET', `/units/tower-detail?projectId=${P1}&towerId=x&statusGroup=all`); t('tower detail: bad tower id -> 400', r.s === 400, r.s); r = await A('GET', `/units/tower-detail?projectId=${P1}`); t('tower detail: missing params -> 400', r.s === 400, r.s);
for (const p of ['/units/inventory-summary/x', '/units/tower/x', '/units/x']) { r = await A('GET', p); t(`bad id on ${p} -> 400`, r.s === 400, r.s); }

// ---------- money per unit in the tower summary ----------
const PA = await mkProj('M'); const TM = await tw(PA, 'TM');
const mk2 = async (n) => (await A('POST', '/units', { projectId: PA, towerId: TM, unitNumber: n, floor: 1, bhkType: '2BHK', carpetAreaSqft: 500, superAreaSqft: 600, basePriceInr: 5000000, totalPriceInr: 5200000 })).j.data.id;
const m1 = await mk2('M-1'), m2 = await mk2('M-2');
const buyer = psql(`INSERT INTO consumers (name, mobile) VALUES ('Two Units ${U}', '9${String(Date.now() + 77).slice(-9)}') RETURNING id`);
const plan = (unit) => { const al = psql(`INSERT INTO allocations (consumer_id, unit_id, project_id, status) VALUES ('${buyer}','${unit}','${PA}','allotted') RETURNING id`); return psql(`INSERT INTO payment_plans (allocation_id, consumer_id, unit_id, project_id, total_amount_inr) VALUES ('${al}','${buyer}','${unit}','${PA}',5200000) RETURNING id`); };
const pp1 = plan(m1), pp2 = plan(m2);
const rcp = (pp, amt, st = 'cleared') => psql(`INSERT INTO receipts (consumer_id, payment_plan_id, installment_index, amount_received_inr, payment_method, status, received_date) VALUES ('${buyer}',${pp ? `'${pp}'` : 'NULL'},${pp ? 1 : 'NULL'},${amt},'cash','${st}', CURRENT_DATE) RETURNING id`);
rcp(pp1, 1000); rcp(pp2, 200); rcp(pp1, 50000, 'bounced'); rcp(pp1, 70000, 'cancelled');
const recv = async () => Number((await A('GET', `/units/tower/${PA}`)).j.towers[0].received_amount);
t('tower summary: a customer with two units - receipts are counted per unit, bounced and cancelled are left out (1000 + 200)', await recv() === 1200, await recv());
rcp(null, 5000); t('tower summary: a receipt with no plan is NOT counted when the customer holds two units', await recv() === 1200, await recv());
r = await A('GET', `/units/tower/${PA}`); t('tower summary: both units are counted once', Number(r.j.towers[0].total_units) === 2 && r.j.totals.total_units === 2, JSON.stringify(r.j.totals));
const solo = psql(`INSERT INTO consumers (name, mobile) VALUES ('One Unit ${U}', '9${String(Date.now() + 99).slice(-9)}') RETURNING id`);
const m3 = await mk2('M-3'); const al3 = psql(`INSERT INTO allocations (consumer_id, unit_id, project_id, status) VALUES ('${solo}','${m3}','${PA}','allotted') RETURNING id`);
psql(`INSERT INTO receipts (consumer_id, amount_received_inr, payment_method, status, received_date) VALUES ('${solo}',7000,'cash','cleared', CURRENT_DATE) RETURNING id`);
t('tower summary: a plan-less receipt of a one-unit customer is counted', await recv() === 8200, await recv());

// ---------- bulk import ----------
const BI = (b, raw) => A('POST', '/units/bulk-import', b, raw);
const PB = await mkProj('I');
const irow = (o = {}) => ({ tower: 'Imp Tower', unitNumber: 'I-1', floor: 1, bhkType: '2BHK', carpetAreaSqft: 500, superAreaSqft: 600, basePriceInr: 5000000, totalPriceInr: 5200000, ...o });
r = await SE('POST', '/units/bulk-import', { projectId: PB, rows: [irow()] }); t('import: sales_executive -> 403', r.s === 403, r.s);
for (const [n, b, re] of [['no project', { rows: [irow()] }, /projectId/], ['bad project id', { projectId: 'x', rows: [irow()] }, /projectId/], ['rows not a list', { projectId: PB, rows: 'x' }, /list/], ['rows missing', { projectId: PB }, /list/], ['no rows', { projectId: PB, rows: [] }, /no rows/], ['2001 rows', { projectId: PB, rows: Array.from({ length: 2001 }, (_, i) => irow({ unitNumber: 'N' + i })) }, /2000/]]) {
  r = await BI(b); t(`import: ${n} -> 400`, r.s === 400 && re.test(r.j?.error || ''), r.s + ' ' + JSON.stringify(r.j)); }
r = await BI({ projectId: NIL, rows: [irow()] }); t('import: unknown project -> 404', r.s === 404, r.s);
r = await BI(undefined, '[1]'); t('import: array body -> 400', r.s === 400, r.s);
r = await BI({ projectId: PB, rows: [irow(), irow({ unitNumber: 'i-1' }), irow({ unitNumber: 'I-2', tower: 'IMP TOWER' }), irow({ unitNumber: 'I-3', floor: 'x' }), irow({ unitNumber: 'I-4', basePriceInr: 1e13, totalPriceInr: 1e13 }), irow({ unitNumber: '<b>' }), irow({ unitNumber: 'I-5', carpetAreaSqft: 900, superAreaSqft: 800 }),
  irow({ unitNumber: 'I-6', towerId: TB }), irow({ unitNumber: 'I-7', tower: '' }), irow({ unitNumber: 'I-8', bhkType: '' }), 'text', null, [1], irow({ unitNumber: 'I-9', facing: 'x'.repeat(40) }), irow({ unitNumber: 'I-10', towerId: 'zz' })] });
t('import: good rows are saved, bad rows are told apart (2 of 15)', r.s === 200 && r.j.data.created === 2 && r.j.data.skipped === 13 && r.j.data.totalRows === 15, JSON.stringify(r.j?.data?.errors?.length) + JSON.stringify(r.j?.data));
t('import: the tower name in another letter case reuses the tower (one tower)', psql(`select count(*) from towers where project_id='${PB}'`) === '1');
t('import: a duplicate number in another letter case is refused with a reason', r.j.data.errors.some(e => /already exists/.test(e.reason)));
t('import: no database message reaches the user', r.j.data.errors.every(e => !/violates|syntax|invalid input|column|relation/i.test(e.reason)), JSON.stringify(r.j.data.errors));
r = await BI({ projectId: PB, rows: [irow({ unitNumber: 'I-1' })] }); t('import: running the same file again creates nothing and says why', r.j.data.created === 0 && r.j.data.skipped === 1 && /already exists/.test(r.j.data.errors[0].reason), JSON.stringify(r.j));
const ri = await Promise.all(Array.from({ length: 5 }, () => BI({ projectId: PB, rows: [irow({ unitNumber: 'RACE-I', tower: 'Race Tower' })] }))); t('import: 5 parallel imports of the same unit -> one unit, one tower', ri.every(x => x.s === 200) && psql(`select count(*) from units u join towers t on t.id=u.tower_id where t.project_id='${PB}' and u.unit_number='RACE-I'`) === '1' && psql(`select count(*) from towers where project_id='${PB}' and lower(tower_name)='race tower'`) === '1', ri.map(x => x.s).join());

// ---------- projects: fields and totals ----------
const pj = (b) => A('POST', '/projects', { companyId: co, name: 'PJ ' + Math.random().toString(36).slice(2, 7) + U, reraNumber: 'R' + Math.random().toString(36).slice(2, 9) + U, tcpLicence: 'x', ...b });
for (const [n, b] of [['land area negative', { landAreaSqft: -5 }], ['land area text', { landAreaSqft: 'big' }], ['land area 1e15', { landAreaSqft: 1e15 }], ['total units negative', { totalUnits: -1 }], ['total units 1e6', { totalUnits: 1e6 }], ['total units decimal', { totalUnits: 2.5 }],
  ['possession date impossible', { possessionDate: '2028-02-30' }], ['possession date text', { possessionDate: 'soon' }], ['category markup', { incomeCategory: '<b>' }], ['category long', { incomeCategory: 'x'.repeat(101) }]]) { r = await pj(b); t(`project: ${n} -> 400`, r.s === 400, r.s + ' ' + JSON.stringify(r.j)); }
r = await pj({ landAreaSqft: '43560', totalUnits: '120', possessionDate: '2029-06-30', incomeCategory: 'Affordable' }); t('project: create with area, units, date', r.s === 201, JSON.stringify(r.j)); const pj1 = r.j.data.id;
const pp = (id, b) => A('PATCH', `/projects/${id}`, b);
for (const [n, b] of [['units text', { totalUnits: 'x' }], ['units "12abc"', { totalUnits: '12abc' }], ['units negative', { totalUnits: -3 }], ['units 1e6', { totalUnits: 1e6 }], ['units less than the units already added', { totalUnits: 1 }], ['licence date impossible', { licenseDate: '2026-02-30' }], ['sale deed date text', { saleDeedDate: 'x' }],
  ['PAN wrong', { landOwnerPan: '12345ABCDE' }], ['Aadhaar short', { authorisedSignatoryAadhaar: '1234' }], ['Aadhaar letters', { authorisedSignatoryAadhaar: '12345678901A' }], ['markup in owner name', { landOwnerName: '<b>x' }], ['village over 200', { villageName: 'v'.repeat(201) }],
  ['company not an id', { companyId: 'x' }], ['company unknown', { companyId: NIL }], ['text field as array', { khasraDetails: ['a'] }]]) { r = await pp(P1, b); t(`project edit: ${n} -> 400`, r.s === 400, r.s + ' ' + JSON.stringify(r.j)); }
r = await pp(P1, { totalUnits: 500, landOwnerPan: 'abcde1234f', authorisedSignatoryAadhaar: '1234 5678 9012', villageName: ' Sohna ', saleDeedDate: '2024-01-15' }); t('project edit: good values (PAN upper-cased, text trimmed)', r.s === 200 && r.j.data.land_owner_pan === 'ABCDE1234F' && r.j.data.village_name === 'Sohna' && r.j.data.total_units === 500, JSON.stringify(r.j));
r = await pp(P1, {}); t('project edit: empty body keeps everything', r.s === 200 && r.j.data.total_units === 500, JSON.stringify(r.j)); r = await A('PATCH', `/projects/${P1}`, undefined, '[1]'); t('project edit: array body is harmless', r.s === 200, r.s);
t('project edit: refused edits changed nothing', psql(`select total_units from projects where id='${P1}'`) === '500');

// ---------- the rate report ----------
const PR = await mkProj('R'); const TR = await tw(PR, 'TR'), TR2 = await tw(PR, 'TS');
const un = async (n, o) => (await A('POST', '/units', { projectId: PR, towerId: TR, unitNumber: n, floor: 1, bhkType: '3BHK', carpetAreaSqft: 1000, superAreaSqft: 1200, basePriceInr: 10000000, totalPriceInr: 10500000, ...o })).j.data.id;
await un('R-1'); const r2 = await un('R-2', { basePriceInr: 12000000, totalPriceInr: 12500000, carpetAreaSqft: 1200, superAreaSqft: 1400 }); await un('R-3', { basePriceInr: undefined, totalPriceInr: undefined }); await un('R-4', { towerId: TR2, bhkType: '2BHK', carpetAreaSqft: undefined, superAreaSqft: undefined, basePriceInr: undefined, totalPriceInr: undefined });
psql(`UPDATE units SET status='booked' WHERE id='${r2}'`);
const RR = (q = '') => A('GET', '/projects/reports/rates' + q);
r = await RR(`?projectId=${PR}`); const rows3 = r.j?.data || []; const g = rows3.find(x => x.bhk_type === '3BHK' && x.tower === 'TR' + U);
t('rate report: one row per BHK type and tower', r.s === 200 && rows3.length === 2, JSON.stringify(rows3.length));
t('rate report: counts - 3 units, 2 priced, 1 without price, 2 available, 1 sold', g && g.unit_count === 3 && g.priced_count === 2 && g.no_price_count === 1 && g.available_count === 2 && g.sold_count === 1, JSON.stringify(g));
t('rate report: min, max and average use only priced units', g && Number(g.min_price) === 10000000 && Number(g.max_price) === 12000000 && Number(g.avg_price) === 11000000, JSON.stringify(g));
t('rate report: average rate per sq ft = average of price / carpet (10000 and 10000)', g && Number(g.avg_rate_per_sqft) === 10000, JSON.stringify(g));
const g2 = rows3.find(x => x.bhk_type === '2BHK'); t('rate report: a tower of unpriced units still shows, with no prices and no divide-by-zero', g2 && g2.unit_count === 1 && g2.no_price_count === 1 && g2.min_price === null && g2.avg_rate_per_sqft === null, JSON.stringify(g2));
r = await RR(); t('rate report: all projects', r.s === 200 && r.j.data.some(x => x.project_id === PR) && r.j.data.some(x => x.project_id === PA), r.s);
r = await RR('?projectId=x'); t('rate report: bad project id -> 400', r.s === 400, r.s); r = await RR(`?projectId=${PR}&projectId=${PA}`); t('rate report: repeated project -> 400', r.s === 400, r.s);
r = await RR(`?projectId=${NIL}`); t('rate report: unknown project -> empty list', r.s === 200 && r.j.data.length === 0, r.s); r = await RO('GET', `/projects/reports/rates?projectId=${PR}`); t('rate report: read_only_viewer can read', r.s === 200, r.s);
r = await RR("?projectId=' or 1=1 --"); t('rate report: SQL text in the filter -> 400', r.s === 400, r.s);

// ---------- unit area can be edited (and is locked once sold) ----------
const ar = (await add({ unitNumber: 'AREA-1', carpetAreaSqft: 800, superAreaSqft: 1000 })).j.data.id;
r = await pu(ar, { carpetAreaSqft: 850 }); t('area edit: carpet area', r.s === 200 && Number(psql(`select carpet_area_sqft from units where id='${ar}'`)) === 850, r.s);
r = await pu(ar, { carpetAreaSqft: 1100 }); t('area edit: carpet above the stored super area -> 400', r.s === 400 && /Super area/.test(r.j.error), JSON.stringify(r.j));
r = await pu(ar, { superAreaSqft: 800 }); t('area edit: super below the stored carpet -> 400', r.s === 400, JSON.stringify(r.j));
for (const [n, v] of [['negative', -1], ['text', 'x'], ['5 decimals', '1.00001'], ['huge', 1e9]]) { r = await pu(ar, { carpetAreaSqft: v }); t(`area edit: ${n} -> 400`, r.s === 400, r.s); }
r = await pu(ar, { carpetAreaSqft: 900, superAreaSqft: 1200 }); t('area edit: both together', r.s === 200, JSON.stringify(r.j));
psql(`INSERT INTO booking_records (consumer_id, unit_id, project_id, selected_plan_name, status) VALUES ('${cons}','${ar}','${P1}','x','draft') RETURNING id`);
r = await pu(ar, { carpetAreaSqft: 910 }); t('area edit: a booked unit\'s area is locked -> 409', r.s === 409, JSON.stringify(r.j));
r = await pu(ar, { carpetAreaSqft: 900 }); t('area edit: saving the same area is fine', r.s === 200, JSON.stringify(r.j));

// ---------- unit types (Unit Address screen) ----------
const UT = (b, raw) => A('POST', '/master/unit-types', b, raw);
const utb = { project_id: P1, name: 'Type A ' + U, carpet_area_sqft: 800, balcony_area_sqft: 50, base_rate_sqft: 6000, description: 'two bed' };
r = await SE('POST', '/master/unit-types', utb); t('unit type: sales_executive -> 403', r.s === 403, r.s); r = await RO('GET', `/master/unit-types?project_id=${P1}`); t('unit type: read_only_viewer can read', r.s === 200, r.s);
for (const [n, o, re] of [['no project', { project_id: undefined }, /Project/], ['project not an id', { project_id: 'x' }, /Project/], ['no name', { name: '' }, /Name/], ['name spaces', { name: '  ' }, /Name/], ['name over 100', { name: 'n'.repeat(101) }, /100/], ['name markup', { name: '<b>' }, /character/], ['name a number', { name: 5 }, /text/],
  ['description markup', { description: '<x>' }, /character/], ['description over 1000', { description: 'd'.repeat(1001) }, /1000/], ['carpet negative', { carpet_area_sqft: -1 }, /Carpet/], ['carpet 3 decimals', { carpet_area_sqft: '1.234' }, /Carpet/], ['carpet exponent', { carpet_area_sqft: '1e3' }, /Carpet/],
  ['carpet huge', { carpet_area_sqft: 1e8 }, /Carpet/], ['balcony text', { balcony_area_sqft: 'x' }, /Balcony/], ['rate decimal', { base_rate_sqft: 6000.5 }, /Base rate/], ['rate negative', { base_rate_sqft: -1 }, /Base rate/], ['rate huge', { base_rate_sqft: 1e12 }, /Base rate/], ['rate array', { base_rate_sqft: [1] }, /Base rate/], ['rate boolean', { base_rate_sqft: true }, /Base rate/]]) {
  r = await UT({ ...utb, name: 'Bad ' + Math.random().toString(36).slice(2, 6) + U, ...o }); t(`unit type: ${n} -> 400`, r.s === 400 && re.test(r.j?.error || ''), r.s + ' ' + JSON.stringify(r.j)); }
r = await UT({ ...utb, project_id: NIL }); t('unit type: unknown project -> 404', r.s === 404, r.s); r = await UT(undefined, '[1]'); t('unit type: array body -> 400', r.s === 400, r.s); r = await UT(undefined, '{oops'); t('unit type: broken JSON -> 4xx', r.s >= 400 && r.s < 500, r.s);
r = await UT({ ...utb, name: ' Type A ' + U + ' ' }); t('unit type: create (name trimmed)', r.s === 201 && r.j.data.name === 'Type A ' + U && Number(r.j.data.base_rate_sqft) === 6000, JSON.stringify(r.j)); const ut1 = r.j.data.id;
r = await UT({ ...utb, name: 'type a ' + U }); t('unit type: same name in another letter case -> 409', r.s === 409, JSON.stringify(r.j));
r = await UT({ ...utb, project_id: P2 }); t('unit type: the same name in another project is fine', r.s === 201, JSON.stringify(r.j));
const rut = await Promise.all(Array.from({ length: 6 }, () => UT({ ...utb, name: 'Race type ' + U }))); t('unit type: 6 parallel creates -> exactly 1', rut.filter(x => x.s === 201).length === 1 && rut.every(x => x.s === 201 || x.s === 409), rut.map(x => x.s).join());
r = await UT({ project_id: P1, name: 'Bare ' + U }); t('unit type: only a name is enough', r.s === 201 && r.j.data.carpet_area_sqft === null, JSON.stringify(r.j));
const put = (id, b) => A('PUT', `/master/unit-types/${id}`, b);
r = await put('x', { name: 'q' }); t('unit type edit: bad id -> 400', r.s === 400, r.s); r = await put(NIL, { name: 'q' }); t('unit type edit: unknown -> 404', r.s === 404, r.s); r = await put(ut1, {}); t('unit type edit: nothing to change -> 400', r.s === 400, r.s);
r = await put(ut1, { name: '' }); t('unit type edit: blank name -> 400', r.s === 400, r.s); r = await put(ut1, { base_rate_sqft: -5 }); t('unit type edit: negative rate -> 400', r.s === 400, r.s);
r = await put(ut1, { name: 'Bare ' + U }); t('unit type edit: a name that exists -> 409', r.s === 409, r.s);
r = await put(ut1, { base_rate_sqft: 6500 }); t('unit type edit: only the rate changes, the rest stays', r.s === 200 && Number(r.j.data.base_rate_sqft) === 6500 && Number(r.j.data.carpet_area_sqft) === 800 && r.j.data.name === 'Type A ' + U, JSON.stringify(r.j));
r = await put(ut1, { description: null }); t('unit type edit: a value can be cleared with null', r.s === 200 && r.j.data.description === null, JSON.stringify(r.j));
r = await put(ut1, { name: 'TYPE A ' + U }); t('unit type edit: own name in other case is fine', r.s === 200, r.s);
r = await SE('PUT', `/master/unit-types/${ut1}`, { name: 'x' }); t('unit type edit: sales_executive -> 403', r.s === 403, r.s);
const uu = (await add({ unitNumber: 'UT-1', unitTypeId: ut1 })).j.data.id;
r = await put(ut1, { project_id: P2 }); t('unit type edit: a type that units use cannot move to another project -> 409', r.s === 409 && /1 unit/.test(r.j.error), JSON.stringify(r.j));
r = await A('DELETE', `/master/unit-types/${ut1}`); t('unit type delete: in use -> 409 with the count', r.s === 409 && /1 unit/.test(r.j.error), JSON.stringify(r.j));
r = await PM('DELETE', `/master/unit-types/${ut1}`); t('unit type delete: project_manager -> 403 or in-use 409, never a server error', r.s === 403 || r.s === 409, r.s);
const free = (await UT({ project_id: P1, name: 'Free ' + U })).j.data.id; r = await A('DELETE', `/master/unit-types/${free}`); t('unit type delete: free type', r.s === 200, r.s); r = await A('DELETE', `/master/unit-types/${free}`); t('unit type delete: twice -> 404', r.s === 404, r.s); r = await A('DELETE', '/master/unit-types/x'); t('unit type delete: bad id -> 400', r.s === 400, r.s);
r = await A('GET', '/master/unit-types?project_id=x'); t('unit type list: bad project id -> 400', r.s === 400, r.s); r = await A('GET', `/master/unit-types?project_id=${P1}&project_id=${P2}`); t('unit type list: repeated project -> 400', r.s === 400, r.s);

// ---------- reminder master ----------
const RM = (b, raw) => A('POST', '/master/reminder-master', b, raw);
const rmb = { name: 'Pay reminder ' + U, days_before: 5, channel: 'sms' };
r = await SE('POST', '/master/reminder-master', rmb); t('reminder: sales_executive -> 403', r.s === 403, r.s);
for (const [n, o, re] of [['no name', { name: '' }, /Name|name/], ['name markup', { name: '<b>' }, /character/], ['name over 200', { name: 'n'.repeat(201) }, /200/], ['no days', { days_before: undefined }, /required/], ['days text', { days_before: 'abc' }, /Days/], ['days negative', { days_before: -1 }, /Days/],
  ['days decimal', { days_before: 2.5 }, /Days/], ['days exponent', { days_before: '1e1' }, /Days/], ['days boolean', { days_before: true }, /Days/], ['days array', { days_before: [3] }, /Days/], ['days 4000', { days_before: 4000 }, /Days/], ['channel markup', { channel: '<i>' }, /character/], ['channel over 100', { channel: 'c'.repeat(101) }, /100/], ['channel array', { channel: ['a'] }, /text/]]) {
  r = await RM({ ...rmb, name: 'Bad ' + Math.random().toString(36).slice(2, 6) + U, ...o }); t(`reminder: ${n} -> 400`, r.s === 400 && re.test(r.j?.error || ''), r.s + ' ' + JSON.stringify(r.j)); }
r = await RM(undefined, '[1]'); t('reminder: array body -> 400', r.s === 400, r.s);
r = await RM(rmb); t('reminder: create', r.s === 201 && r.j.data.days_before === 5 && r.j.data.channel === 'sms', JSON.stringify(r.j)); const rm1 = r.j.data.id;
r = await RM({ ...rmb, name: 'PAY REMINDER ' + U }); t('reminder: same name and days in another letter case -> 409', r.s === 409, JSON.stringify(r.j));
r = await RM({ ...rmb, days_before: 6 }); t('reminder: same name with other days is fine', r.s === 201, JSON.stringify(r.j));
r = await RM({ name: 'Same day ' + U, days_before: '0' }); t('reminder: 0 days as text is fine', r.s === 201, JSON.stringify(r.j));
r = await RM({ name: 'No channel ' + U, days_before: 3 }); t('reminder: no channel shows as all', r.s === 201 && r.j.data.channel === 'all', JSON.stringify(r.j));
const rrm = await Promise.all(Array.from({ length: 6 }, () => RM({ name: 'Race rem ' + U, days_before: 9 }))); t('reminder: 6 parallel creates -> exactly 1', rrm.filter(x => x.s === 201).length === 1 && rrm.every(x => x.s === 201 || x.s === 409), rrm.map(x => x.s).join());
r = await RO('GET', '/master/reminder-master'); t('reminder: read_only_viewer can read', r.s === 200 && r.j.data.some(x => x.id === rm1), r.s);
r = await A('DELETE', `/master/reminder-master/${rm1}`); t('reminder: delete', r.s === 200, r.s); r = await A('DELETE', `/master/reminder-master/${rm1}`); t('reminder: delete twice -> 404', r.s === 404, r.s); r = await A('DELETE', '/master/reminder-master/x'); t('reminder: delete bad id -> 400', r.s === 400, r.s);
t('audit: unit types and reminders are logged', Number(psql(`select count(*) from audit_logs where resource_type in ('master.unit_types','master.reminder_master')`)) >= 8);

// ---------- audit ----------
const au = (ty) => Number(psql(`select count(*) from audit_logs where resource_type='${ty}'`));
for (const ty of ['unit', 'unit_bulk_import', 'project', 'tower']) t(`audit: ${ty} changes are logged`, au(ty) >= 2, au(ty));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
