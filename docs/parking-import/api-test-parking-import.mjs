// Parking (slots, price list, allot, release, bulk) and Import (units from a CSV, preview, history), plus the leftover /test-data route.
// Roles, hostile input, project scope, races, the parking that goes back when a unit is cancelled, one bad CSV row stops the file, a random run.
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-parking-import.mjs   (psql must reach the same database; SEED=n repeats the random run)
import { execFileSync } from 'node:child_process';
const B = process.env.BASE || 'http://localhost:3010/api';
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300))); };
const post = async (p, b) => { const r = await fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => null) }; };
const login = async (email, password = 'Test#Pass1234') => (await post('/auth/login', { email, password })).j?.token;
const call = (tok) => async (m, p, b, raw) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: raw ?? (b === undefined ? undefined : JSON.stringify(b)) }); return { s: r.status, j: await r.json().catch(() => null) }; };
const A = call(await login('super_admin@test.local')), PM = call(await login('project_manager@test.local')), SE = call(await login('sales_executive@test.local'));
const AF = call(await login('accounts_finance@test.local')), RO = call(await login('read_only_viewer@test.local')), NO = call(null);
const psql = (sql) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim().split('\n')[0];
const SEED = Number(process.env.SEED || Date.now() % 1e9); let rs = SEED;
const rnd = () => (rs = (rs * 1664525 + 1013904223) % 4294967296) / 4294967296, ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)), pick = (a) => a[ri(0, a.length - 1)];
console.log('SEED=' + SEED);
const U = Date.now().toString(36).slice(-5), NIL = '00000000-0000-0000-0000-000000000000';
const par = (n, f) => Promise.all(Array.from({ length: n }, (_, i) => f(i)));
const no5 = (xs) => xs.every((x) => x.s < 500);
let seq = 0; const mob = () => '9' + String((Date.now() % 1e7) * 100 + ++seq + 100000000).slice(-9).padStart(9, '0');
let r;

// ---------- set-up: two projects with a tower each, customers who hold a unit and customers who do not, project-scoped logins ----------
const co = (await A('POST', '/companies', { name: 'PkImp Co ' + U })).j.data.id;
const mkProj = async (tag) => (await A('POST', '/projects', { companyId: co, name: `PkImp ${tag} ${U}`, reraNumber: `PI${tag}-${U}`, tcpLicence: 'x' })).j.data.id;
const P1 = await mkProj('A'), P2 = await mkProj('B');
const tower = async (P, name = 'T' + U) => (await A('POST', `/projects/${P}/towers`, { towerName: name })).j.data.id;
const T1 = await tower(P1), T2 = await tower(P2);
let un = 0; const unit = async (P, T) => (await A('POST', '/units', { projectId: P, towerId: T, unitNumber: `K${++un}-${U}`, floor: 1, bhkType: '2BHK', carpetAreaSqft: 900, superAreaSqft: 1100, basePriceInr: 3000000, totalPriceInr: 3300000 })).j.data.id;
const person = async (P, stage = 'enquiry') => psql(`INSERT INTO consumers (name, mobile, project_id, lead_stage) VALUES ('PkImp Person ${++seq} ${U}', '${mob()}', '${P}', '${stage}') RETURNING id`);
const holder = async (P = P1, T = T1) => { const c = await person(P), u = await unit(P, T); const x = await A('POST', '/allocations', { consumerId: c, unitId: u, projectId: P }); if (x.s !== 201) throw new Error('allot ' + JSON.stringify(x)); return { c, u, alloc: x.j.data.id }; };
const H1 = await holder(), H2 = await holder(), HP2 = await holder(P2, T2);
const NOHOLD = await person(P1);   // an enquiry: holds no unit
const PW = 'PkImp#Pass' + U.replace(/\D/g, '') + '1';
const newUser = async (tag, role, projectIds) => { const email = `pkimp.${tag}.${U}@example.com`; const x = await A('POST', '/users/employee-login', { username: `pkimp_${tag}_${U}`, email, password: PW, confirmPassword: PW, role, assignedProjectIds: projectIds }); return { id: x.j?.data?.userId, call: call(await login(email, PW)) }; };
const only1 = await newUser('p1', 'project_manager', [P1]), only2 = await newUser('p2', 'project_manager', [P2]);
t('setup: projects, holders, a non-holder and scoped logins', !!(P1 && P2 && H1.c && HP2.c && NOHOLD && only1.id && only2.id), [H1, only1.id]);
let sn = 0; const slot = (o = {}, who = PM) => who('POST', '/parking', { projectId: P1, slotNumber: `S${++sn}-${U}`, parkingType: 'covered', floor: 0, amount: 100000, ...o });
const stOf = (id) => psql(`select status||'|'||coalesce(allotted_to_consumer_id::text,'')||'|'||coalesce(allotted_unit_id::text,'') from parking_slots where id='${id}'`);
const slotIds = [];

// ================= PARKING: roles =================
r = await slot(); const S1 = r.j?.data?.id; slotIds.push(S1);
t('slot: project manager creates one', r.s === 201 && r.j.data.status === 'available', r);
t('slot: sales, accounts_finance, viewer cannot create (403), no login 401', (await slot({}, SE)).s === 403 && (await slot({}, AF)).s === 403 && (await slot({}, RO)).s === 403 && (await slot({}, NO)).s === 401);
t('slot: admin creates one', (r = await slot({}, A)).s === 201, r); slotIds.push(r.j?.data?.id);
for (const [n, f] of [['viewer', RO], ['sales', SE], ['pm', PM], ['accounts', AF], ['admin', A]]) t(`slot list: ${n} can read`, (await f('GET', `/parking?projectId=${P1}`)).s === 200);
t('slot list: no login 401', (await NO('GET', '/parking')).s === 401);
t('slot patch/release: sales and viewer 403; delete: pm 403, admin allowed', (await SE('PATCH', `/parking/${S1}`, { amount: 1 })).s === 403 && (await RO('PATCH', `/parking/${S1}/release`)).s === 403 && (await PM('DELETE', `/parking/${S1}`)).s === 403);

// ================= PARKING: create, hostile input =================
for (const [n, b] of [['no project', { projectId: undefined }], ['bad project', { projectId: 'x' }], ['unknown project', { projectId: NIL }], ['no slot number', { slotNumber: undefined }], ['blank slot number', { slotNumber: '   ' }], ['slot number 51', { slotNumber: 's'.repeat(51) }],
  ['slot number script', { slotNumber: '<b>x</b>' }], ['slot number list', { slotNumber: ['a'] }], ['slot number zero width only', { slotNumber: '​' }], ['bad type', { parkingType: 'rooftop' }], ['type list', { parkingType: ['open'] }],
  ['floor 201', { floor: 201 }], ['floor -11', { floor: -11 }], ['floor 1.5', { floor: 1.5 }], ['floor 1e1', { floor: '1e1' }], ['floor text', { floor: 'G' }], ['amount negative', { amount: -5 }], ['amount 1e3', { amount: '1e3' }], ['amount 3 decimals', { amount: 10.123 }],
  ['amount huge', { amount: 1e10 }], ['amount list', { amount: [1] }], ['unit without customer', { unitId: H1.u }], ['unit bad id', { consumerId: H1.c, unitId: 'x' }], ['customer bad id', { consumerId: 'x' }]]) {
  r = await slot(b); t(`slot create refused: ${n}`, r.s >= 400 && r.s < 500 && !!r.j?.error, r);
}
t('slot create: broken JSON and a list body are 4xx, not 500', (await PM('POST', '/parking', undefined, '{"a":')).s < 500 && (await PM('POST', '/parking', undefined, '[1]')).s === 400);
r = await slot({ slotNumber: `S1-${U}` }); t('slot create: the same number again is 409, nothing changes', r.s === 409 && psql(`select count(*) from parking_slots where project_id='${P1}' and slot_number='S1-${U}'`) === '1', r);
r = await slot({ projectId: P2, slotNumber: `S1-${U}` }); t('slot create: the same number in another project is fine', r.s === 201, r); slotIds.push(r.j?.data?.id);
r = await slot({ amount: undefined, floor: undefined, parkingType: undefined }); slotIds.push(r.j?.data?.id); t('slot create: only project and number: covered, floor 0, price 0', r.s === 201 && psql(`select parking_type||'|'||floor||'|'||amount_inr from parking_slots where id='${r.j.data.id}'`) === 'covered|0|0.00', r);
r = await slot({ parkingType: 'ev', floor: -2, amount: '12500.50' }); slotIds.push(r.j?.data?.id); t('slot create: basement floor, EV, a text amount with paise', r.s === 201 && psql(`select floor||'|'||amount_inr from parking_slots where id='${r.j.data.id}'`) === '-2|12500.50', r);
const dup = await par(6, () => slot({ slotNumber: `RACE-${U}` })); t('slot create: six parallel creates of one number, exactly one wins', dup.filter((x) => x.s === 201).length === 1 && no5(dup), dup.map((x) => x.s)); slotIds.push(dup.find((x) => x.s === 201)?.j?.data?.id);
t('slot create: a scoped login cannot create in another project (404)', (await only1.call('POST', '/parking', { projectId: P2, slotNumber: 'X' + U })).s === 404);

// ================= PARKING: price list =================
t('price: pm sets the price of covered in project 1', (r = await PM('PUT', '/parking/types', { projectId: P1, parkingType: 'stilt', priceInr: 75000, description: 'stilt floor' })).s === 200 && r.j.data.parking_type === 'stilt', r);
const PRICE = r.j?.data?.id;
t('price: saved again is a change, not a second row', (await PM('PUT', '/parking/types', { projectId: P1, parkingType: 'stilt', priceInr: '80000.50' })).s === 200 && psql(`select count(*)||'|'||max(price_inr) from parking_prices where project_id='${P1}' and parking_type='stilt'`) === '1|80000.50');
for (const [n, b] of [['no project', { parkingType: 'open', priceInr: 5 }], ['no type', { projectId: P1, priceInr: 5 }], ['bad type', { projectId: P1, parkingType: 'x', priceInr: 5 }], ['no price', { projectId: P1, parkingType: 'open' }], ['negative price', { projectId: P1, parkingType: 'open', priceInr: -1 }],
  ['price 1e3', { projectId: P1, parkingType: 'open', priceInr: '1e3' }], ['price huge', { projectId: P1, parkingType: 'open', priceInr: 1e10 }], ['description 256', { projectId: P1, parkingType: 'open', priceInr: 1, description: 'd'.repeat(256) }], ['description script', { projectId: P1, parkingType: 'open', priceInr: 1, description: '<img src=x>' }], ['unknown project', { projectId: NIL, parkingType: 'open', priceInr: 1 }]]) {
  r = await PM('PUT', '/parking/types', b); t(`price refused: ${n}`, r.s >= 400 && r.s < 500, r);
}
t('price: sales, accounts, viewer cannot set (403)', (await SE('PUT', '/parking/types', { projectId: P1, parkingType: 'open', priceInr: 1 })).s === 403 && (await RO('PUT', '/parking/types', { projectId: P1, parkingType: 'open', priceInr: 1 })).s === 403 && (await AF('PUT', '/parking/types', { projectId: P1, parkingType: 'open', priceInr: 1 })).s === 403);
t('price: a scoped login cannot set one for another project', (await only1.call('PUT', '/parking/types', { projectId: P2, parkingType: 'open', priceInr: 1 })).s === 404);
r = await RO('GET', `/parking/types?projectId=${P1}`); t('price list: everyone reads, filtered by project, with the project name', r.s === 200 && r.j.data.length === 1 && r.j.data[0].project_name === `PkImp A ${U}`, r);
t('price list: bad project id refused, another project is hidden from a scoped login', (await A('GET', '/parking/types?projectId=x')).s === 400 && (await only2.call('GET', `/parking/types?projectId=${P1}`)).j?.data?.length === 0);
r = await slot({ parkingType: 'stilt', amount: undefined }); slotIds.push(r.j?.data?.id); t('slot: no amount takes the price of the type from the list', r.s === 201 && psql(`select amount_inr from parking_slots where id='${r.j.data.id}'`) === '80000.50', r);
t('price: delete: viewer 403, pm 403 (delete is admin only), bad id 400, unknown 404, admin deletes, again 404', (await RO('DELETE', `/parking/types/${PRICE}`)).s === 403 && (await A('DELETE', '/parking/types/x')).s === 400 && (await A('DELETE', `/parking/types/${NIL}`)).s === 404 && (await PM('DELETE', `/parking/types/${PRICE}`)).s === 403 && (await A('DELETE', `/parking/types/${PRICE}`)).s === 200 && (await A('DELETE', `/parking/types/${PRICE}`)).s === 404);

// ================= PARKING: allot =================
r = await slot({ consumerId: H1.c, unitId: H1.u, slotNumber: `A1-${U}` }); const A1 = r.j?.data?.id; slotIds.push(A1);
t('allot: create + allot in one call to a customer who holds a unit', r.s === 201 && r.j.data.status === 'allotted' && stOf(A1) === `allotted|${H1.c}|${H1.u}`, r);
r = await slot(); const A2 = r.j?.data?.id; slotIds.push(A2);
r = await PM('POST', '/parking', { projectId: P1, slotNumber: (psql(`select slot_number from parking_slots where id='${A2}'`)), consumerId: H2.c, unitId: H2.u }); t('allot: an existing available slot is allotted by posting its number', r.s === 201 && stOf(A2) === `allotted|${H2.c}|${H2.u}`, r);
r = await PM('POST', '/parking', { projectId: P1, slotNumber: psql(`select slot_number from parking_slots where id='${A2}'`), consumerId: H1.c }); t('allot: an allotted slot is NOT taken over by another customer (409), the holder stays', r.s === 409 && stOf(A2) === `allotted|${H2.c}|${H2.u}`, r);
t('allot refused: a customer of another project (404)', (r = await slot({ consumerId: HP2.c })).s === 404, r);
t('allot refused: a customer who holds no unit (409)', (r = await slot({ consumerId: NOHOLD })).s === 409, r);
t('allot refused: a unit that is not the unit of the customer (409)', (r = await slot({ consumerId: H1.c, unitId: H2.u })).s === 409, r);
t('allot refused: a unit of another project (404 or 409)', [404, 409].includes((r = await slot({ consumerId: H1.c, unitId: HP2.u })).s), r);
t('allot refused: unknown customer (404)', (await slot({ consumerId: NIL })).s === 404);
t('allot: a refused allot left no slot behind', Number(psql(`select count(*) from parking_slots where project_id='${P1}' and allotted_to_consumer_id='${NOHOLD}'`)) === 0);
r = await slot({ slotNumber: `RACE2-${U}` }); const RC = r.j?.data?.id; slotIds.push(RC);
const racers = await par(6, (i) => PM('POST', '/parking', { projectId: P1, slotNumber: `RACE2-${U}`, consumerId: i % 2 ? H1.c : H2.c, unitId: i % 2 ? H1.u : H2.u }));
t('allot: six parallel allots of one slot, exactly one wins, the others 409', racers.filter((x) => x.s === 201).length === 1 && racers.filter((x) => x.s === 409).length === 5, racers.map((x) => x.s));
t('allot: after the race the slot holds exactly the winner (customer and unit agree)', [`allotted|${H1.c}|${H1.u}`, `allotted|${H2.c}|${H2.u}`].includes(stOf(RC)), stOf(RC));
await slot({ consumerId: H1.c, slotNumber: `A3-${U}` }); r = await slot({ consumerId: H1.c, slotNumber: `A4-${U}` }); slotIds.push(r.j?.data?.id); t('allot: one customer may hold more than one slot', r.s === 201 && Number(psql(`select count(*) from parking_slots where allotted_to_consumer_id='${H1.c}'`)) >= 2, r);

// ================= PARKING: edit, release, delete =================
t('edit: an allotted slot cannot be changed (409)', (await PM('PATCH', `/parking/${A1}`, { amount: 1 })).s === 409);
r = await PM('PATCH', `/parking/${S1}`, { parkingType: 'open', floor: 3, amount: '9999.99' }); t('edit: an available slot changes type, floor, amount', r.s === 200 && r.j.data.parking_type === 'open' && r.j.data.floor === 3, r);
for (const [n, b] of [['nothing', {}], ['bad type', { parkingType: 'x' }], ['floor 300', { floor: 300 }], ['negative amount', { amount: -1 }], ['amount 1e3', { amount: '1e3' }]]) t(`edit refused: ${n}`, (await PM('PATCH', `/parking/${S1}`, b)).s === 400);
t('edit: bad id 400, unknown 404', (await PM('PATCH', '/parking/x', { floor: 1 })).s === 400 && (await PM('PATCH', `/parking/${NIL}`, { floor: 1 })).s === 404);
r = await PM('PATCH', `/parking/${A1}/release`); t('release: an allotted slot goes back to available, customer and unit cleared', r.s === 200 && stOf(A1) === 'available||', r);
t('release: again is 409, an available slot cannot be released', (await PM('PATCH', `/parking/${A1}/release`)).s === 409 && (await PM('PATCH', `/parking/${S1}/release`)).s === 409);
t('release: bad id 400, unknown 404', (await PM('PATCH', '/parking/x/release')).s === 400 && (await PM('PATCH', `/parking/${NIL}/release`)).s === 404);
r = await PM('POST', '/parking', { projectId: P1, slotNumber: psql(`select slot_number from parking_slots where id='${A1}'`), consumerId: H2.c, unitId: H2.u }); t('release then allot: the freed slot can go to someone else', r.s === 201 && stOf(A1) === `allotted|${H2.c}|${H2.u}`, r);
t('delete: an allotted slot cannot be deleted (409), an available one can (admin), again 404, bad id 400', (await A('DELETE', `/parking/${A1}`)).s === 409 && (await A('DELETE', `/parking/${S1}`)).s === 200 && (await A('DELETE', `/parking/${S1}`)).s === 404 && (await A('DELETE', '/parking/x')).s === 400);
t('scope: a login of project 2 cannot release or change the slot of project 1 (404)', (await only2.call('PATCH', `/parking/${A2}/release`)).s === 404 && (await only2.call('PATCH', `/parking/${A2}`, { floor: 1 })).s === 404);

// ================= PARKING: bulk =================
r = await PM('POST', '/parking/bulk', { projectId: P1, count: 5, prefix: 'B' + U.slice(0, 3).toUpperCase(), parkingType: 'open', floor: -1, amount: 40000 }); const pre = 'B' + U.slice(0, 3).toUpperCase();
t('bulk: five slots in one call', r.s === 201 && r.j.data.created === 5 && r.j.data.skipped === 0 && r.j.data.first === pre + '001' && r.j.data.last === pre + '005', r);
r = await PM('POST', '/parking/bulk', { projectId: P1, count: 7, prefix: pre }); t('bulk: numbers that exist are skipped, the rest are made', r.s === 201 && r.j.data.created === 2 && r.j.data.skipped === 5, r);
t('bulk: the slots have the type, floor and price that were asked', psql(`select parking_type||'|'||floor||'|'||amount_inr from parking_slots where project_id='${P1}' and slot_number='${pre}003'`) === 'open|-1|40000.00');
for (const [n, b] of [['no count', {}], ['count 0', { count: 0 }], ['count 501', { count: 501 }], ['count text', { count: 'abc' }], ['count 1e3', { count: '1e3' }], ['count 2.5', { count: 2.5 }], ['count negative', { count: -3 }], ['prefix too long', { count: 3, prefix: 'p'.repeat(60) }], ['prefix script', { count: 3, prefix: '<i>' }],
  ['bad type', { count: 3, parkingType: 'x' }], ['bad floor', { count: 3, floor: 999 }], ['bad amount', { count: 3, amount: -1 }], ['from huge', { count: 3, from: 1e9 }], ['no project', { projectId: undefined, count: 3 }], ['unknown project', { projectId: NIL, count: 3 }]]) {
  r = await PM('POST', '/parking/bulk', { projectId: P1, ...b }); t(`bulk refused: ${n}`, r.s >= 400 && r.s < 500, r);
}
t('bulk: sales and viewer 403, a scoped login cannot use another project (404)', (await SE('POST', '/parking/bulk', { projectId: P1, count: 1 })).s === 403 && (await RO('POST', '/parking/bulk', { projectId: P1, count: 1 })).s === 403 && (await only1.call('POST', '/parking/bulk', { projectId: P2, count: 1 })).s === 404);
const pre2 = 'C' + U.slice(0, 3).toUpperCase();
const bp = await par(5, () => PM('POST', '/parking/bulk', { projectId: P1, count: 10, prefix: pre2 })); t('bulk: five parallel bulks of the same range make exactly ten slots in total, no 5xx', no5(bp) && bp.reduce((s, x) => s + (x.j?.data?.created || 0), 0) === 10 && psql(`select count(*) from parking_slots where project_id='${P1}' and slot_number like '${pre2}%'`) === '10', bp.map((x) => x.s + ':' + x.j?.data?.created));

// ================= PARKING: list and scope =================
r = await A('GET', `/parking?projectId=${P1}&status=allotted`); t('list: status filter', r.s === 200 && r.j.data.length >= 3 && r.j.data.every((x) => x.status === 'allotted' && x.consumer_name), r);
r = await A('GET', `/parking?projectId=${P1}&parkingType=ev`); t('list: type filter', r.s === 200 && r.j.data.length >= 1 && r.j.data.every((x) => x.parking_type === 'ev'), r);
r = await A('GET', `/parking?projectId=${P1}&pageSize=3&page=2`); t('list: paging', r.s === 200 && r.j.data.length === 3, r);
for (const q of ['status=lost', 'parkingType=x', 'projectId=x', 'pageSize=0', 'pageSize=1001', 'page=0', 'pageSize=1;drop table parking_slots', 'status[]=allotted', 'page=1e3']) t(`list refused: ${q}`, (await A('GET', '/parking?' + q)).s === 400);
t('list: the table is still there after the injection tries', Number(psql(`select count(*) from parking_slots`)) > 0);
r = await only1.call('GET', '/parking?pageSize=1000'); t('scope: a login of project 1 sees only project 1 slots', r.s === 200 && r.j.data.length > 0 && r.j.data.every((x) => x.project_id === P1), r);
r = await only2.call('GET', `/parking?projectId=${P1}`); t('scope: asking for the other project gives nothing', r.s === 200 && r.j.data.length === 0, r);

// ================= PARKING: the unit leaves, the parking goes back =================
const G = await holder(); r = await slot({ consumerId: G.c, unitId: G.u, slotNumber: `G1-${U}` }); const GS = r.j?.data?.id; slotIds.push(GS);
r = await slot({ consumerId: G.c, slotNumber: `G2-${U}` }); const GS2 = r.j?.data?.id; slotIds.push(GS2);
t('cancel: set-up, the customer holds two slots', stOf(GS) === `allotted|${G.c}|${G.u}` && stOf(GS2) === `allotted|${G.c}|`);
r = await A('POST', `/allocations/${G.alloc}/cancel`, { reason: 'parking test' }); t('cancel: the allocation is cancelled', r.s === 200, r);
t('cancel: both slots (the one with the unit and the one without) are available again', stOf(GS) === 'available||' && stOf(GS2) === 'available||', [stOf(GS), stOf(GS2)]);
t('cancel: the slot of another customer is untouched', stOf(A2) === `allotted|${H2.c}|${H2.u}`);

// ================= IMPORT =================
const hdr = 'unitNumber,tower,floor,bhkType,totalPriceInr,carpetAreaSqft,superAreaSqft,basePriceInr,facing';
const csvOf = (rows) => [hdr, ...rows].join('\n');
const good = (n, tw = 'IT' + U) => `IM${n}-${U},${tw},${n % 5 + 1},2BHK,${3000000 + n},650,900,2800000,East`;
const prev = (csv, o = {}, who = PM) => who('POST', '/import/preview', { importType: 'units', csvText: csv, ...o });
const imp = (csv, o = {}, who = PM) => who('POST', '/import', { importType: 'units', projectId: P1, fileName: `units-${U}.csv`, csvText: csv, ...o });
const unitCount = (P) => Number(psql(`select count(*) from units where project_id='${P}'`));
const histCount = () => Number(psql(`select count(*) from import_history where file_name like '%${U}%'`));

r = await prev(csvOf([good(1), good(2), good(3)]), { projectId: P1 }); t('import preview: a good file is read and counted, nothing is saved', r.s === 200 && r.j.data.totalRows === 3 && r.j.data.validRows === 3 && r.j.data.errorRows === 0 && r.j.data.alreadyInProject === 0 && r.j.data.preview.length === 3, r);
t('import preview: nothing was written (no tower, no unit)', psql(`select count(*) from towers where project_id='${P1}' and tower_name='IT${U}'`) === '0');
r = await prev(csvOf([good(1), `IM2-${U},IT${U},x,2BHK,3000000,650,900,,`, `IM3-${U},IT${U},1,2BHK,-5,650,900,,`, `IM1-${U},IT${U},2,3BHK,4000000,,,,`]));
t('import preview: every bad row is named with its line (floor, price, a unit twice in the file)', r.s === 200 && r.j.data.errorRows === 3 && r.j.data.validRows === 1 && r.j.data.errors.map((e) => e.row).join() === '3,4,5', r);
for (const [n, body] of [['no csv', { importType: 'units' }], ['csv number', { importType: 'units', csvText: 5 }], ['csv list', { importType: 'units', csvText: ['a'] }], ['empty csv', { importType: 'units', csvText: '   ' }], ['header only', { importType: 'units', csvText: hdr }],
  ['missing column', { importType: 'units', csvText: 'unitNumber,tower\nA,B' }], ['not a csv (unclosed quote)', { importType: 'units', csvText: hdr + '\n"A,T,1,2BHK,5' }], ['other type consumers', { importType: 'consumers', csvText: csvOf([good(1)]) }], ['other type edraw', { importType: 'edraw', csvText: csvOf([good(1)]) }],
  ['type list', { importType: ['units'], csvText: csvOf([good(1)]) }], ['bad project id', { importType: 'units', csvText: csvOf([good(1)]), projectId: 'x' }], ['unknown project', { importType: 'units', csvText: csvOf([good(1)]), projectId: NIL }],
  ['too many rows', { importType: 'units', csvText: csvOf(Array.from({ length: 5001 }, (_, i) => good(i))) }], ['file over 2 MB', { importType: 'units', csvText: hdr + '\n' + 'x'.repeat(2_100_000) }]]) {
  r = await PM('POST', '/import/preview', body); t(`import preview refused: ${n}`, r.s >= 400 && r.s < 500 && !!r.j?.error, r);
}
t('import preview: a body that is a list is 400', (await PM('POST', '/import/preview', undefined, '[1]')).s === 400);

const before = unitCount(P1), h0 = histCount();
r = await imp(csvOf([good(11), good(12, 'it' + U), good(13, 'IT2' + U)]));
t('import: a good file makes the units, one tower per name (the same name in another case is one tower)', r.s === 200 && r.j.data.created === 3 && r.j.data.skipped === 0 && unitCount(P1) === before + 3 && psql(`select count(*) from towers where project_id='${P1}' and lower(tower_name) in ('it${U}','it2${U}')`) === '2', r);
t('import: the units have the right values and are available', psql(`select status||'|'||floor||'|'||total_price_inr::bigint||'|'||carpet_area_sqft::int||'|'||facing from units where project_id='${P1}' and unit_number='IM11-${U}'`) === 'available|2|3000011|650|East');
t('import: the history has one completed row for it', histCount() === h0 + 1 && psql(`select status||'|'||created_rows||'|'||skipped_rows from import_history where file_name='units-${U}.csv' order by created_at desc limit 1`) === 'completed|3|0');
r = await imp(csvOf([good(11), good(14)])); t('import: a unit that is already there is skipped, a new one is made, the file is not refused', r.s === 200 && r.j.data.created === 1 && r.j.data.skipped === 1 && r.j.data.skippedRows[0].unit === `IM11-${U}`, r);
r = await imp(csvOf([`IM11-${U.toUpperCase()},IT${U},1,2BHK,3000000,,,,`])); t('import: a unit that differs only in letter case is also a duplicate', r.s === 200 && r.j.data.created === 0 && r.j.data.skipped === 1, r);
const n1 = unitCount(P1), towersBefore = Number(psql(`select count(*) from towers where project_id='${P1}'`)), h1 = histCount();
r = await imp(csvOf([good(21, 'NewT' + U), `IM22-${U},NewT${U},abc,2BHK,3000000,,,,`]));
t('import: one bad row stops the whole file (422), the good row and its new tower are NOT saved', r.s === 422 && /nothing was imported/i.test(r.j?.error || '') && /Row 3/.test(r.j.error) && unitCount(P1) === n1 && Number(psql(`select count(*) from towers where project_id='${P1}'`)) === towersBefore, r);
t('import: the refused file is in the history as failed, with the reason', histCount() === h1 + 1 && psql(`select status||'|'||error_rows from import_history where file_name='units-${U}.csv' order by created_at desc limit 1`) === 'failed|1');
for (const [n, row] of [['no unit number', `,IT${U},1,2BHK,3000000,,,,`], ['unit number 51', `${'u'.repeat(51)},IT${U},1,2BHK,3000000,,,,`], ['unit number script', `<b>x</b>,IT${U},1,2BHK,3000000,,,,`], ['no tower', `Z1-${U},,1,2BHK,3000000,,,,`], ['tower 101', `Z1-${U},${'t'.repeat(101)},1,2BHK,3000000,,,,`], ['no floor', `Z1-${U},IT${U},,2BHK,3000000,,,,`],
  ['floor 301', `Z1-${U},IT${U},301,2BHK,3000000,,,,`], ['floor 1.5', `Z1-${U},IT${U},1.5,2BHK,3000000,,,,`], ['floor 1e1', `Z1-${U},IT${U},1e1,2BHK,3000000,,,,`], ['no bhk', `Z1-${U},IT${U},1,,3000000,,,,`], ['no price', `Z1-${U},IT${U},1,2BHK,,,,,`], ['price 0', `Z1-${U},IT${U},1,2BHK,0,,,,`], ['price negative', `Z1-${U},IT${U},1,2BHK,-1,,,,`],
  ['price text', `Z1-${U},IT${U},1,2BHK,lots,,,,`], ['price 1e6', `Z1-${U},IT${U},1,2BHK,1e6,,,,`], ['price huge', `Z1-${U},IT${U},1,2BHK,99999999999999,,,,`], ['super less than carpet', `Z1-${U},IT${U},1,2BHK,3000000,900,600,,`], ['total below base', `Z1-${U},IT${U},1,2BHK,100,,,500,`], ['facing 31', `Z1-${U},IT${U},1,2BHK,3000000,,,,${'f'.repeat(31)}`], ['carpet negative', `Z1-${U},IT${U},1,2BHK,3000000,-5,,,`]]) {
  r = await imp(csvOf([row])); t(`import refused: ${n}`, r.s === 422 && unitCount(P1) === n1, r);
}
t('import: nothing was saved by any refused file', unitCount(P1) === n1);
t('import: other types are refused (consumers, edraw, payments)', (await imp(csvOf([good(1)]), { importType: 'consumers' })).s === 400 && (await imp(csvOf([good(1)]), { importType: 'edraw' })).s === 400 && (await imp(csvOf([good(1)]), { importType: 'payments' })).s === 400);
t('import: no project 400, bad project 400, unknown project 404', (await imp(csvOf([good(1)]), { projectId: undefined })).s === 400 && (await imp(csvOf([good(1)]), { projectId: 'x' })).s === 400 && (await imp(csvOf([good(1)]), { projectId: NIL })).s === 404);
t('import: sales, accounts, viewer cannot import (403), no login 401', (await imp(csvOf([good(1)]), {}, SE)).s === 403 && (await imp(csvOf([good(1)]), {}, AF)).s === 403 && (await imp(csvOf([good(1)]), {}, RO)).s === 403 && (await imp(csvOf([good(1)]), {}, NO)).s === 401);
t('import: a scoped login cannot import into another project (404)', (await imp(csvOf([good(1)]), { projectId: P2 }, only1.call)).s === 404);
t('import: file name 256 refused, a name with script refused', (await imp(csvOf([good(1)]), { fileName: 'f'.repeat(256) })).s === 400 && (await imp(csvOf([good(1)]), { fileName: '<b>.csv' })).s === 400);
r = await imp('﻿' + csvOf([good(31)]).replace(/\n/g, '\r\n')); t('import: a file with a byte order mark and Windows line ends reads fine', r.s === 200 && r.j.data.created === 1, r);
r = await imp(csvOf([`"IM32-${U}","Tower, with comma ${U}",2,"2 BHK, corner",3500000,650,900,3000000,North`])); t('import: quoted values with commas are read as one value', r.s === 200 && r.j.data.created === 1 && psql(`select count(*) from towers where project_id='${P1}' and tower_name='Tower, with comma ${U}'`) === '1', r);
const n2 = unitCount(P1);
const same = csvOf([good(41, 'RT' + U), good(42, 'RT' + U), good(43, 'RT2' + U)]);
const ip = await par(5, () => imp(same)); t('import: five parallel imports of the same file make each unit once, no 5xx', no5(ip) && ip.every((x) => x.s === 200) && unitCount(P1) === n2 + 3 && ip.reduce((s, x) => s + x.j.data.created, 0) === 3, ip.map((x) => x.s + ':' + x.j?.data?.created));
t('import: and one tower per name even then', psql(`select count(*) from towers where project_id='${P1}' and tower_name in ('RT${U}','RT2${U}')`) === '2');
r = await A('GET', '/import/history?pageSize=5'); t('import history: lists the newest first, with who imported', r.s === 200 && r.j.data.length === 5 && r.j.data[0].imported_by_name && r.j.data[0].created_rows !== undefined, r);
for (const q of ['importType=consumers', 'pageSize=0', 'pageSize=201', 'page=0', 'pageSize=1;x', 'importType[]=units']) t(`import history refused: ${q}`, (await A('GET', '/import/history?' + q)).s === 400);
t('import history: viewer can read, no login 401', (await RO('GET', '/import/history')).s === 200 && (await NO('GET', '/import/history')).s === 401);
{ const tr = await fetch(B + '/import/template/units'); const head = (await tr.text()).split('\n')[0].split(',');
  t('import: the template file (one source, the server) has every column the import needs, and its sample row imports', tr.status === 200 && ['unitNumber', 'tower', 'floor', 'bhkType', 'totalPriceInr'].every((c) => head.includes(c)), head); }

// ================= /test-data leftover =================
t('test-data: only super_admin reads it (viewer, sales, pm, accounts get 403)', (await RO('GET', '/test-data/summary')).s === 403 && (await SE('GET', '/test-data/consumers')).s === 403 && (await PM('GET', '/test-data/verify')).s === 403 && (await AF('GET', '/test-data/projects')).s === 403 && (await NO('GET', '/test-data/summary')).s === 401);
t('test-data: super_admin still can (no 5xx)', (await A('GET', '/test-data/verify')).s < 500);

// ================= RANDOM RUN =================
const junk = () => pick([undefined, null, '', ' ', 'x', 'a'.repeat(300), 0, -1, 1.5, 1e21, true, [], {}, ['a'], { a: 1 }, '<script>1</script>', "' OR 1=1 --", NIL, 'abc', '2026-02-30', '​', '%', '\u0000']);
const ids = [H1.c, H2.c, HP2.c, NOHOLD, NIL, 'abc'], units = [H1.u, H2.u, HP2.u, NIL, 'abc'];
const rr = [];
for (let i = 0; i < 120; i++) {
  const who = pick([A, PM, only1.call, SE]);
  const j = () => (rnd() < 0.4 ? junk() : undefined);
  const cases = [
    () => who('POST', '/parking', { projectId: pick([P1, P2, junk()]), slotNumber: pick([`Z${i}-${U}`, junk()]), parkingType: pick(['open', junk()]), floor: j(), amount: j(), consumerId: pick([...ids, j()]), unitId: pick([...units, j()]) }),
    () => who('POST', '/parking/bulk', { projectId: pick([P1, junk()]), count: pick([ri(1, 4), junk()]), prefix: pick(['R' + U.slice(0, 2), junk()]), from: j(), parkingType: j(), floor: j(), amount: j() }),
    () => who('PUT', '/parking/types', { projectId: pick([P1, P2, junk()]), parkingType: pick(['open', 'ev', junk()]), priceInr: pick([ri(0, 9999), junk()]), description: j() }),
    () => who('PATCH', `/parking/${pick([A2, NIL, 'abc'])}${pick(['', '/release'])}`, { parkingType: j(), floor: j(), amount: j() }),
    () => who('GET', `/parking?projectId=${encodeURIComponent(String(junk()))}&status=${encodeURIComponent(String(junk()))}&pageSize=${encodeURIComponent(String(junk()))}`),
    () => who('POST', '/import/preview', { importType: j(), csvText: pick([csvOf([good(ri(1, 9))]), junk(), hdr + '\n' + String(junk())]), projectId: j() }),
    () => who('POST', '/import', { importType: pick(['units', junk()]), projectId: pick([P1, junk()]), fileName: j(), csvText: pick([csvOf([good(ri(100, 140))]), junk(), hdr + '\n' + [junk(), junk(), junk(), junk(), junk()].join(',')]) }),
    () => who('GET', `/import/history?importType=${encodeURIComponent(String(junk()))}&page=${encodeURIComponent(String(junk()))}`),
  ];
  rr.push(...(await Promise.all(Array.from({ length: ri(1, 4) }, () => pick(cases)()))));
}
t(`random run: ${rr.length} requests with junk in every field, none is a 5xx (SEED=${SEED})`, no5(rr), rr.filter((x) => x.s >= 500).slice(0, 3));
t('random run: every slot is in a consistent state (available without a holder, allotted with one)', psql(`select count(*) from parking_slots where project_id in ('${P1}','${P2}') and not ((status='available' and allotted_to_consumer_id is null) or (status='allotted' and allotted_to_consumer_id is not null))`) === '0');
t('random run: no unit was made with a price of 0 or less', psql(`select count(*) from units where project_id in ('${P1}','${P2}') and coalesce(total_price_inr,0) <= 0`) === '0');

// ---------- clean up ----------
{
  const ps = `'${P1}','${P2}'`;
  for (const sql of [`delete from parking_slots where project_id in (${ps})`, `delete from parking_prices where project_id in (${ps})`, `delete from import_history where file_name like '%${U}%'`,
    `delete from allocations where project_id in (${ps})`, `delete from consumers where project_id in (${ps})`, `delete from units where project_id in (${ps})`, `delete from towers where project_id in (${ps})`]) { try { psql(sql); } catch { /* leftovers are harmless, names carry the run id */ } }
}
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
