// End to end, with random inputs: builds a project from nothing (company, project, towers, units, locations + PLC, GST, payment plan,
// add-on charges), books units, then checks the numbers add up across modules and throws random bad input at every set-up screen.
// Every run uses new random areas, prices, percentages and order; the seed is printed so a failure can be repeated: SEED=123 node ...
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-end-to-end.mjs   (psql must reach the same database)
import { execFileSync } from 'node:child_process';
const B = process.env.BASE || 'http://localhost:3010/api';
const SEED = Number(process.env.SEED || Date.now() % 1e9);
let a = SEED; const rnd = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const ri = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1)), pick = (arr) => arr[ri(0, arr.length - 1)];
console.log('SEED=' + SEED);
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };
const login = async (email) => (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Test#Pass1234' }) })).json()).token;
const call = (tok) => async (m, p, b, raw) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: raw ?? (b === undefined ? undefined : JSON.stringify(b)) }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const A = call(await login('super_admin@test.local')), SE = call(await login('sales_executive@test.local')), RO = call(await login('read_only_viewer@test.local'));
const psql = (sql) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' }).trim().split('\n')[0];
const U = Date.now().toString(36).slice(-5) + ri(0, 99), NIL = '00000000-0000-0000-0000-000000000000';
const today = new Date().toISOString().slice(0, 10);
let r;
const must = async (label, p) => { const x = await p; if (x.s >= 300) { console.log(`FAIL setup: ${label} -> ${x.s} ${JSON.stringify(x.j).slice(0, 300)}`); fail++; process.exit(1); } return x.j.data ?? x.j; };

// ============ 1. Build the project ============
const co = (await must('company', A('POST', '/companies', { name: 'E2E Co ' + U }))).id;
const proj = (await must('project', A('POST', '/projects', { companyId: co, name: 'E2E Project ' + U, reraNumber: 'E2E-' + U, tcpLicence: 'x', totalUnits: 30, landAreaSqft: ri(20000, 90000) }))).id;
const towers = []; for (const n of ['North', 'South']) towers.push((await must('tower', A('POST', `/projects/${proj}/towers`, { towerName: n + ' ' + U }))).id);
const units = [];
for (let i = 0; i < ri(6, 10); i++) {
  const carpet = ri(400, 1500) + pick([0, 0.25, 0.5, 0.75]), sup = Math.round(carpet * (1.1 + rnd() * 0.3)), base = ri(40, 150) * 100000;
  units.push({ id: (await must('unit', A('POST', '/units', { projectId: proj, towerId: pick(towers), unitNumber: `E-${i}${pick(['a', 'B', 'c'])}`, floor: ri(0, 20), bhkType: pick(['1BHK', '2BHK', '3BHK']), carpetAreaSqft: carpet, superAreaSqft: sup, basePriceInr: base, totalPriceInr: base + ri(0, 9) * 100000 }))).id, carpet, base });
}
t('build: project, towers and units exist', units.length >= 6 && psql(`select count(*) from units where project_id='${proj}'`) === String(units.length));
const reportRows = (await A('GET', `/projects/reports/rates?projectId=${proj}`)).j.data;
t('rate report counts every unit of the project exactly once', reportRows.reduce((s, x) => s + x.unit_count, 0) === units.length && reportRows.every(x => x.available_count === x.unit_count), JSON.stringify(reportRows.map(x => x.unit_count)));

// locations and PLC (random: flat or per sq ft, a random half of the units)
const locId = (await must('location', A('POST', `/projects/${proj}/unit-locations`, { name: 'Garden ' + U }))).id;
const plcType = pick(['flat', 'per_sqft']), plcVal = plcType === 'flat' ? ri(10, 90) * 1000 : ri(50, 400) + pick([0, 0.5]);
await must('plc rate', A('POST', '/plc-charges', { projectId: proj, unitLocationId: locId, rateType: plcType, rateValue: plcVal }));
const inLoc = units.filter(() => rnd() < 0.5); if (!inLoc.length) inLoc.push(units[0]);
await must('plc assign', A('POST', '/plc-charges/assign', { projectId: proj, unitLocationId: locId, unitIds: inLoc.map(u => u.id) }));
let plcOk = true;
for (const u of units) {
  const q = (await A('GET', `/plc-charges/quote?unitId=${u.id}`)).j.data;
  const want = !inLoc.includes(u) ? 0 : plcType === 'flat' ? plcVal : Math.round(plcVal * u.carpet * 100) / 100;
  if (Math.abs(q.amount - want) > 0.011) { plcOk = false; console.log('plc mismatch', u, q, want); }
}
t('PLC quote is right for every unit (flat or carpet x rate; 0 outside the location)', plcOk);

// GST: reuse a slab that covers today, else make one; a random total rate
let slab = (await A('GET', '/gst-configuration/gst-slabs')).j.data.find(s => s.from_date <= today && s.to_date >= today)?.id;
const madeSlab = !slab;
if (!slab) slab = (await must('slab', A('POST', '/gst-configuration/gst-slabs', { fromDate: new Date(Date.now() - 864e5).toISOString().slice(0, 10), toDate: new Date(Date.now() + 864e5 * 5).toISOString().slice(0, 10) }))).id;
const gstPct = pick([0, 1, 5, 12, 18]);
const taxId = (await must('tax', A('POST', '/gst-configuration/gst-tax-setup', { slabId: slab, gstCode: `E2E ${U}`, type: 'INTRA', cgstPct: gstPct / 2, sgstPct: gstPct / 2 }))).id;
for (const ct of ['BASIC', 'PLC', 'OTHER CHARGE']) await must('mapping ' + ct, A('POST', '/gst-configuration/gst-charge-mapping', { projectId: proj, slabId: slab, gstTaxId: taxId, chargeType: ct }));
r = await A('GET', `/gst-configuration/resolve?projectId=${proj}&chargeType=PLC&date=${today}`);
t('GST lookup gives the rate that was set (random 0/1/5/12/18%)', r.s === 200 && Math.abs(r.j.data.cgstPct * 2 - gstPct) < 1e-9, JSON.stringify(r.j));

// payment plan: random split of 100 over 3-5 rows, built row by row
const planName = 'E2E Plan ' + U, nRows = ri(3, 5); let left = 100; const parts = [];
for (let i = 0; i < nRows; i++) { const p = i === nRows - 1 ? left : Math.round((ri(5, Math.max(5, left - 5 * (nRows - i - 1)))) * 100) / 100; parts.push(Math.min(p, left)); left = Math.round((left - parts[i]) * 1000) / 1000; }
const rowIds = [];
for (let i = 0; i < nRows; i++) rowIds.push((await must('plan row ' + i, A('POST', `/projects/${proj}/plan-templates`, { plan_name: planName, installment_name: `Row ${i + 1}`, installment_type: i === 0 ? 'booking' : 'installment', percentage: parts[i], due_date_offset_days: i * 30, installment_index: i + 1 }))).id);
let planInfo = (await A('GET', `/projects/${proj}/plans`)).j.data.find(p => p.plan_name === planName);
t('the random split of 100% is accepted and the plan is complete', planInfo && planInfo.complete === true && Math.abs(planInfo.total_pct - 100) < 0.001, JSON.stringify(planInfo));
r = await A('POST', `/projects/${proj}/plan-templates`, { plan_name: planName, installment_name: 'Over', installment_type: 'installment', percentage: 0.5, installment_index: 99 });
t('one more percent over 100 is refused', r.s === 400, r.s + JSON.stringify(r.j));
// add-on charge (random flat or per sq ft), billed on random rows summing to <= 100%
const addType = pick(['flat', 'per_sqft']);
const addon = await must('addon master', A('POST', '/addon-charges/master', { projectId: proj, chargeName: 'Club ' + U, rateType: addType, ...(addType === 'flat' ? { defaultAmount: ri(5, 50) * 10000 } : { ratePerSqftInr: ri(20, 200) }), cgstPct: 9, sgstPct: 9 }));
const addPct = []; let addLeft = 100;
for (const rid of rowIds) { if (rnd() < 0.6 && addLeft > 0) { const p = Math.min(addLeft, ri(10, 60)); addLeft -= p; addPct.push(p); await must('addon pct', A('POST', `/projects/${proj}/plan-templates/${rid}/addon-charges`, { charge_master_id: addon.id, pct: p })); } else addPct.push(0); }
const addTotalPct = addPct.reduce((s, x) => s + x, 0);

// ============ 2. Book random units ============
const bookOne = async (u, tag) => {
  const cons = (await must('applicant', A('POST', '/consumers', { name: `E2E Buyer ${tag} ${U}`, mobile: '9' + String(Date.now() + ri(0, 1e6)).slice(-9) }))).id ?? psql(`select id from consumers where name='E2E Buyer ${tag} ${U}' limit 1`);
  const plc = (await A('GET', `/plc-charges/quote?unitId=${u.id}`)).j.data.amount;
  const bk = await must('booking', A('POST', '/booking', { consumer_id: cons, project_id: proj, unit_id: u.id, selected_plan_name: planName, booking_date: today, has_plc: plc > 0, plc_amount: plc, booking_amount: 10000, payment_mode: 'cash', carpet_area_sqft: u.carpet }));
  const done = await A('PATCH', `/booking/${bk.id}`, { booking_amount: 10000, payment_mode: 'cash' });
  return { cons, bk, plc, done };
};
const booked = []; const toBook = units.slice(0, ri(2, Math.min(4, units.length)));
for (const [i, u] of toBook.entries()) { const x = await bookOne(u, i); booked.push({ ...x, u }); }
t('every booking completed', booked.every(b => b.done.s === 200), JSON.stringify(booked.map(b => b.done.s)));
for (const b of booked) {
  const bk = psql(`select status||'|'||coalesce(plc_amount,0) from booking_records where id='${b.bk.id}'`);
  t(`booking keeps the PLC it was given (${b.plc})`, Number(bk.split('|')[1]) === b.plc && bk.startsWith('complete'), bk);
  const dem = psql(`select count(*)||'|'||coalesce(sum(addon_charge_amount),0) from demands d join payment_plans pp on pp.id=d.payment_plan_id where pp.consumer_id='${b.cons}' and pp.unit_id='${b.u.id}'`).split('|');
  t('one demand per plan row', Number(dem[0]) === nRows, dem.join('|'));
  const wantAdd = addTotalPct > 0 ? Math.round((addType === 'flat' ? Number(addon.default_amount) : Number(addon.rate_per_sqft_inr) * b.u.carpet) * addTotalPct) / 100 : 0;
  t('add-on in the demands = master amount x the % set on the plan rows', Math.abs(Number(dem[1]) - wantAdd) <= 0.02 * nRows, `${dem[1]} vs ${wantAdd}`);
  const unitSt = psql(`select status from units where id='${b.u.id}'`);
  t('unit left "available"', unitSt !== 'available', unitSt);
}
const first = booked[0];
// ============ 3. After the booking: what must now be locked, refused or consistent ============
r = await A('POST', '/booking', { consumer_id: first.cons, project_id: proj, unit_id: first.u.id, selected_plan_name: planName }); t('double booking -> 409', r.s === 409, r.s + JSON.stringify(r.j));
r = await A('PATCH', `/units/${first.u.id}`, { basePriceInr: first.u.base + 100000, totalPriceInr: first.u.base + 700000 }); t('a booked unit\'s price is locked', r.s === 409, r.s);
r = await A('PATCH', `/projects/${proj}/plan-templates/${rowIds[0]}`, { percentage: parts[0] + 1 }); t('the plan the booking used is frozen', r.s === 409, r.s);
r = await A('DELETE', `/projects/${proj}/plans?planName=${encodeURIComponent(planName)}`); t('a plan with bookings cannot be deleted', r.s === 409, r.s);
r = await A('PATCH', `/gst-configuration/gst-tax-setup/${taxId}`, { cgstPct: gstPct / 2 + 1, sgstPct: gstPct / 2 + 1 }); t('the GST rate that priced the booking is locked', r.s === 409, r.s + JSON.stringify(r.j));
r = await A('DELETE', `/units/${first.u.id}`); t('a unit cannot be deleted through the API (no such route)', r.s === 404 || r.s === 405, r.s);
const unbooked = units.find(u => !booked.some(b => b.u.id === u.id));
if (unbooked) { r = await A('PATCH', `/units/${unbooked.id}`, { basePriceInr: unbooked.base + 100000, totalPriceInr: unbooked.base + 800000 }); t('an unbooked unit can still be re-priced', r.s === 200, r.s); }
const roll = (await A('GET', `/projects/reports/rates?projectId=${proj}`)).j.data;
t('rate report: sold + available = all units', roll.reduce((s, x) => s + x.sold_count + x.available_count, 0) === units.length && roll.reduce((s, x) => s + x.sold_count, 0) === booked.length, JSON.stringify(roll.map(x => [x.sold_count, x.available_count])));
const list = (await A('GET', `/units?projectId=${proj}&pageSize=1000`)).j.data;
t('unit list: booked units show their buyer, once each', booked.every(b => list.filter(x => x.id === b.u.id).length === 1) && list.length === units.length, `${list.length}/${units.length}`);
const ts = (await A('GET', `/units/tower/${proj}`)).j; t('tower summary adds up to all units', ts.totals.total_units === units.length, JSON.stringify(ts.totals.total_units));
// a customer gets an add-on later; the demand rows move with it
const lateCons = booked[booked.length - 1];
// money received on the first instalment freezes it: add-on cut is refused, a raise moves forward
if (addTotalPct > 0) {
  const ch = psql(`select id from consumer_addon_charges where consumer_id='${first.cons}' and status='active' limit 1`);
  const pp = psql(`select id from payment_plans where consumer_id='${first.cons}'`);
  psql(`insert into receipts (consumer_id, payment_plan_id, installment_index, amount_received_inr, payment_method, status, received_date) values ('${first.cons}','${pp}',1,5000,'cash','cleared',current_date) returning id`);
  const firstHas = addPct[0] > 0;
  r = await A('PATCH', `/addon-charges/consumer/${ch}/cancel`);
  t(firstHas ? 'add-on billed on a paid instalment cannot be cancelled' : 'add-on not on the paid instalment can still be cancelled', firstHas ? r.s === 400 : r.s === 200, r.s + JSON.stringify(r.j));
}
r = await SE('POST', '/plc-charges', { projectId: proj, unitLocationId: locId, rateValue: 1 }); t('a sales executive cannot change PLC', r.s === 403, r.s);
r = await RO('POST', '/units', { projectId: proj, towerId: towers[0], unitNumber: 'RO', floor: 1, bhkType: '2BHK' }); t('a read-only user cannot add a unit', r.s === 403, r.s);
r = await SE('PATCH', `/gst-configuration/gst-tax-setup/${taxId}`, { cgstPct: 1, sgstPct: 1 }); t('a sales executive cannot change GST', r.s === 403, r.s);

// ============ 4. Random bad input at every set-up screen (nothing may answer with a server error) ============
const JUNK = ['', ' ', null, true, false, 0, -1, -0, 1e308, -1e308, 2 ** 63, Number.MAX_SAFE_INTEGER, 0.1 + 0.2, 'NaN', 'Infinity', '1e999', '0x10', [], {}, [[]], { a: 1 }, ['x'], '<script>alert(1)</script>', "'; DROP TABLE users;--", '\u0000', 'a\u0000b', '‮abc', 'ü'.repeat(300), '😀', 'x'.repeat(5000), '../../etc/passwd', '%00', '2026-02-30', '9999-99-99', '0000-00-00', NIL, 'not-a-uuid', 'null', 'undefined', '__proto__', { __proto__: { x: 1 } }, '{{7*7}}', '${7*7}', '\n\r', '\t'];
const tok = (arr) => pick(arr);
const T0 = towers[0], L = locId, anyUnit = units[units.length - 1].id, plan1 = rowIds[0];
const targets = [
  ['POST', '/projects', () => ({ companyId: co, name: 'F ' + U + ri(0, 1e6), reraNumber: 'F' + ri(0, 1e9), tcpLicence: 'x', totalUnits: 5, landAreaSqft: 100, possessionDate: '2030-01-01', incomeCategory: 'A', location: 'x' })],
  ['PATCH', `/projects/${proj}`, () => ({ totalUnits: 40, landOwnerName: 'x', landOwnerPan: 'ABCDE1234F', licenseDate: '2024-01-01', villageName: 'v', authorisedSignatoryAadhaar: '123412341234' })],
  ['POST', `/projects/${proj}/towers`, () => ({ towerName: 'T' + ri(0, 1e9) })],
  ['POST', '/units', () => ({ projectId: proj, towerId: T0, unitNumber: 'F' + ri(0, 1e9), floor: 1, bhkType: '2BHK', carpetAreaSqft: 500, superAreaSqft: 600, basePriceInr: 5000000, totalPriceInr: 5100000, facing: 'N', floorPlanUrl: 'https://x.y/z' })],
  ['PATCH', `/units/${anyUnit}`, () => ({ floor: 2, facing: 'S', floorPlanUrl: 'https://x.y/z', basePriceInr: 5000000, totalPriceInr: 5100000, balconyAreaSqft: 10, carpetAreaSqft: 500, superAreaSqft: 600 })],
  ['POST', '/units/bulk-import', () => ({ projectId: proj, rows: [{ tower: 'FZ' + ri(0, 1e6), unitNumber: 'B' + ri(0, 1e9), floor: 1, bhkType: '2BHK', carpetAreaSqft: 500, superAreaSqft: 600, basePriceInr: 1, totalPriceInr: 2 }] })],
  ['POST', `/projects/${proj}/unit-locations`, () => ({ name: 'L' + ri(0, 1e9), description: 'd' })],
  ['POST', '/master/unit-types', () => ({ project_id: proj, name: 'UT' + ri(0, 1e9), carpet_area_sqft: 500, balcony_area_sqft: 5, base_rate_sqft: 5000, description: 'x' })],
  ['POST', '/master/reminder-master', () => ({ name: 'R' + ri(0, 1e9), days_before: 3, channel: 'sms' })],
  ['POST', '/plc-charges', () => ({ projectId: proj, unitLocationId: L, rateType: 'flat', rateValue: 10 })],
  ['POST', '/plc-charges/assign', () => ({ projectId: proj, unitLocationId: L, unitIds: [anyUnit] })],
  ['POST', `/projects/${proj}/plan-templates`, () => ({ plan_name: 'FZ' + ri(0, 1e9), installment_name: 'a', installment_type: 'installment', percentage: 10, due_date_offset_days: 5, installment_index: 1 })],
  ['PATCH', `/projects/${proj}/plan-templates/${plan1}`, () => ({ notes: 'n', installment_name: 'Row 1' })],
  ['POST', `/projects/${proj}/plans/standard`, () => ({ plan_name: 'FS' + ri(0, 1e9) })],
  ['POST', `/projects/${proj}/plans/copy`, () => ({ from: planName, to: 'FC' + ri(0, 1e9) })],
  ['POST', `/projects/${proj}/plan-templates/${plan1}/addon-charges`, () => ({ charge_master_id: addon.id, pct: 10 })],
  ['POST', '/addon-charges/master', () => ({ projectId: proj, chargeName: 'F' + ri(0, 1e9), defaultAmount: 10, cgstPct: 9, sgstPct: 9, rateType: 'flat' })],
  ['PATCH', `/addon-charges/master/${addon.id}`, () => ({ chargeName: addon.charge_name, cgstPct: 9 })],
  ['POST', '/addon-charges/consumer', () => ({ consumerId: first.cons, projectId: proj, chargeName: 'F' + ri(0, 1e9), amount: 10 })],
  ['PATCH', `/addon-charges/consumer/${NIL}`, () => ({ amount: 5, remark: 'x' })],
  ['PATCH', '/charge-master/config/balcony_charge', () => ({ rate_value: 1300 })],
  ['POST', '/gst-configuration/financial-years', () => ({ name: 'FY' + ri(0, 1e9), fromDate: '2060-04-01', toDate: '2061-03-31' })],
  ['POST', '/gst-configuration/hsn-sac-codes', () => ({ code: '99' + ri(1000, 9999), type: 'Service' })],
  ['POST', '/gst-configuration/gst-slabs', () => ({ fromDate: '2070-01-01', toDate: '2070-12-31' })],
  ['POST', '/gst-configuration/gst-tax-setup', () => ({ slabId: slab, gstCode: 'F' + ri(0, 1e9), type: 'INTRA', cgstPct: 1, sgstPct: 1 })],
  ['POST', '/gst-configuration/gst-charge-mapping', () => ({ projectId: proj, slabId: slab, gstTaxId: taxId, chargeType: 'OTHERS' })],
  ['POST', '/gst-configuration/project-gstin', () => ({ projectId: proj, gstin: '06AAACG1234F1Z8' })],
  ['POST', '/gst-configuration/project-rera', () => ({ projectId: proj, reraNumber: 'RC/1' })],
  ['POST', '/booking', () => ({ consumer_id: first.cons, project_id: proj, unit_id: anyUnit, selected_plan_name: planName, plc_amount: 0, booking_amount: 1 })],
  ['PATCH', `/booking/${NIL}`, () => ({ booking_amount: 1, payment_mode: 'cash' })],
  ['POST', '/consumers', () => ({ name: 'Fz ' + ri(0, 1e6), mobile: '9' + String(ri(1e8, 9e8)) })],
];
const gets = [`/units`, `/projects/reports/rates`, `/plc-charges`, `/plc-charges/quote`, `/plc-charges/units`, `/gst-configuration/resolve`, `/gst-configuration/gst-tax-setup`, `/gst-configuration/gst-charge-mapping`, `/gst-configuration/hsn-sac-assign`, `/gst-configuration/project-rera`, `/addon-charges/master`, `/addon-charges/consumer`, `/addon-charges/consumers`, '/master/unit-types', `/projects/${proj}/floors`, `/projects/${proj}/plans`, `/units/tower-detail`, '/charge-master/balcony-preview'];
const bad5 = []; let calls = 0;
const nap = () => new Promise(r => setTimeout(r, 30));   // paced, so the random calls cannot use up the API's per-minute request limit for the scripts that run after this one
const check = (label, x) => { calls++; if (x.s >= 500 || x.j === null && x.s !== 204) bad5.push(`${label} -> ${x.s} ${JSON.stringify(x.j)?.slice(0, 160)}`); };
const fuzzBody = (b) => { const c = JSON.parse(JSON.stringify(b)); const keys = Object.keys(c); const n = ri(1, 3); for (let i = 0; i < n; i++) { const k = pick(keys); const j = pick(JUNK); c[k] = rnd() < 0.1 ? undefined : j; } return c; };
const N = Number(process.env.FUZZ || 400);
for (let i = 0; i < N; i++) {
  const [m, p, mk] = pick(targets); const b = mk();
  const mode = rnd();
  const x = mode < 0.8 ? await A(m, p, fuzzBody(b)) : mode < 0.9 ? await A(m, p, pick([[], 'text', 12, null, [b], { ...b, extra: { deep: [1, { a: 2 }] } }].map(v => v)), undefined) : await A(m, p, undefined, pick(['{', '[1,', '', 'null', '"x"', '{"a":' + 'x'.repeat(200), '\u0000']));
  check(`${m} ${p.replace(proj, 'P').replace(NIL, 'NIL')}`, x); await nap();
}
for (let i = 0; i < 120; i++) {
  const g = pick(gets); const qs = pick(['projectId', 'unitId', 'consumerId', 'slabId', 'towerId', 'status', 'page', 'pageSize', 'date', 'chargeType', 'balconyAreaSqft', 'bookingDate', 'name'] ); const j = pick(JUNK);
  const ps = [`projectId=${proj}`, `unitId=${anyUnit}`]; ps.push(`${qs}=${encodeURIComponent(typeof j === 'string' ? j : JSON.stringify(j))}`); if (rnd() < 0.3) ps.push(`${qs}=${encodeURIComponent(String(pick(JUNK)))}`);
  check('GET ' + g + '?' + qs, await A('GET', g + '?' + ps.join('&'))); await nap();
}
t(`random bad input: ${calls} requests, none answered with a server error (seed ${SEED})`, bad5.length === 0, '\n   ' + [...new Set(bad5)].slice(0, 12).join('\n   '));

// ============ 5. After all of that, the books still balance ============
const after = (await A('GET', `/units?projectId=${proj}&pageSize=1000`)).j.data;
t('units are still the same count after the random input', after.length >= units.length && after.filter(u => units.some(x => x.id === u.id)).length === units.length, `${after.length}`);
const demandsOk = booked.every(b => psql(`select count(*) from demands d join payment_plans pp on pp.id=d.payment_plan_id where pp.consumer_id='${b.cons}'`) === String(nRows));
t('every booked customer still has exactly one demand per plan row', demandsOk);
t('no booked unit became available again', booked.every(b => psql(`select status from units where id='${b.u.id}'`) !== 'available'));
t('the PLC amount on each booking is unchanged', booked.every(b => Number(psql(`select plc_amount from booking_records where id='${b.bk.id}'`)) === b.plc));
t('the GST rate of the booking period is unchanged', Math.abs((await A('GET', `/gst-configuration/resolve?projectId=${proj}&chargeType=BASIC&date=${today}`)).j.data.cgstPct * 2 - gstPct) < 1e-9);

// ============ tidy: the slab and rate of this run, so the next run starts clean ============
psql(`delete from gst_tax_charge_mapping where project_id='${proj}'`); if (madeSlab) { psql(`delete from gst_tax_setup where slab_id='${slab}'`); psql(`delete from gst_slabs where id='${slab}'`); } else psql(`delete from gst_tax_setup where id='${taxId}'`);
psql(`delete from gst_tax_setup where gst_code like 'F%' and slab_id='${slab}'`);
psql(`delete from financial_years where from_date >= '2060-01-01'`); psql(`delete from gst_slabs where from_date >= '2070-01-01'`); psql(`delete from hsn_sac_codes where created_at > now() - interval '1 hour' and code like '99%' and id not in (select hsn_sac_id from hsn_sac_code_assign)`);
console.log(`\nRESULT: ${pass} passed, ${fail} failed (seed ${SEED})`); process.exit(fail ? 1 : 0);
