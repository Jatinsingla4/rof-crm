// Charges attached to a unit in advance: the list route and its rules, and what a booking of the unit puts on the customer (quantity, Mandatory charges).
// Run: PGHOST=.. BASE=http://localhost:3010/api node docs/set-projects-parity/api-test-unit-charges.mjs   (psql must reach the same database)
import { execFileSync } from 'node:child_process';
const B = process.env.BASE || 'http://localhost:3010/api';
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300))); };
const call = (tok) => async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const login = async (e) => (await call()('POST', '/auth/login', { email: e, password: 'Test#Pass1234' })).j?.token;
const A = call(await login('super_admin@test.local')), RO = call(await login('read_only_viewer@test.local')), SE = call(await login('sales_executive@test.local')), NO = call();
const psql = (sql) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' }).trim();
const U = Date.now().toString(36).slice(-5), NIL = '00000000-0000-0000-0000-000000000000', today = new Date().toISOString().slice(0, 10);
let seq = 0; const mob = () => '9' + String((Date.now() % 1e7) * 100 + ++seq + 100000000).slice(-9).padStart(9, '0');
const co = (await A('GET', '/companies')).j?.data?.[0]?.id || (await A('POST', '/companies', { name: `Co ${U}` })).j?.data?.id;
const mkProject = async (tag) => {
  const P = (await A('POST', '/projects', { name: `UC ${tag} ${U}`, reraNumber: `U${tag}-${U}`, tcpLicence: 'x', companyId: co })).j.data.id;
  const T = (await A('POST', `/projects/${P}/towers`, { towerName: 'T' + U })).j.data.id;
  let slab = (await A('GET', '/gst-configuration/gst-slabs')).j.data.find((x) => x.from_date <= today && x.to_date >= today)?.id;
  if (!slab) slab = (await A('POST', '/gst-configuration/gst-slabs', { fromDate: new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10), toDate: new Date(Date.now() + 40 * 864e5).toISOString().slice(0, 10) })).j.data.id;
  const taxId = (await A('POST', '/gst-configuration/gst-tax-setup', { slabId: slab, gstCode: `UC ${tag} ${U}`, type: 'INTRA', cgstPct: 2.5, sgstPct: 2.5 })).j.data.id;
  for (const ct of ['BASIC', 'PLC', 'OTHER CHARGE']) await A('POST', '/gst-configuration/gst-charge-mapping', { projectId: P, slabId: slab, gstTaxId: taxId, chargeType: ct });
  const r1 = (await A('POST', `/projects/${P}/plan-templates`, { plan_name: 'Plan ' + U, installment_name: 'Booking', installment_type: 'booking', percentage: 20, due_date_offset_days: 0, installment_index: 1 })).j.data.id;
  const r2 = (await A('POST', `/projects/${P}/plan-templates`, { plan_name: 'Plan ' + U, installment_name: 'Balance', installment_type: 'installment', percentage: 80, due_date_offset_days: 30, installment_index: 2 })).j.data.id;
  return { P, T, r1, r2 };
};
let un = 0;
const unit = async (X) => (await A('POST', '/units', { projectId: X.P, towerId: X.T, unitNumber: `C${++un}-${U}`, floor: 1, bhkType: '2BHK', carpetAreaSqft: 1000, superAreaSqft: 1200, basePriceInr: 9000000, totalPriceInr: 9500000 })).j.data.id;
const master = async (X, b) => (await A('POST', '/addon-charges/master', { projectId: X.P, rateType: 'flat', ...b })).j.data.id;

const X = await mkProject('A'), Y = await mkProject('B');
const PARK = await master(X, { chargeName: `Parking ${U}`, defaultAmount: 100000, chargeType: 'Parking', isParking: true, multipleBooking: true, cgstPct: 9, sgstPct: 9 });
const MAND = await master(X, { chargeName: `Club ${U}`, defaultAmount: 5000, isMandatory: true, cgstPct: 9, sgstPct: 9 });
const RESTO = await master(X, { chargeName: `Restoration ${U}`, defaultAmount: 20000, cgstPct: 9, sgstPct: 9 });
const OTHER = await master(Y, { chargeName: `Other ${U}`, defaultAmount: 1 });
for (const m of [PARK, MAND]) await A('POST', `/projects/${X.P}/plan-templates/${X.r2}/addon-charges`, { charge_master_id: m, pct: 100 });

const u1 = await unit(X), put = (id, charges, who = A) => who('PUT', `/units/${id}/charges`, { charges });
let r = await put(u1, [{ chargeMasterId: PARK, quantity: 2 }, { chargeMasterId: MAND, quantity: 1 }]);
t('unit charges: parking x2 saved; a Mandatory charge is accepted but not stored', r.s === 200, r);
r = await A('GET', `/units/${u1}/charges`); t('unit charges: the list shows parking x2 and the Mandatory one separately', r.j?.data?.attached?.length === 1 && r.j.data.attached[0].quantity === 2 && r.j.data.mandatory.some((m) => m.charge_master_id === MAND), r.j?.data);
t('unit charges: the master list says which charge is in no plan', ((await A('GET', `/addon-charges/master?projectId=${X.P}`)).j?.data || []).find((m) => m.id === RESTO)?.plan_pct_rows === 0);
t('unit charges: quantity 2 on a charge that is not for multiple booking is 400', (await put(u1, [{ chargeMasterId: RESTO, quantity: 2 }])).s === 400);
t('unit charges: quantity 0, 21 and 1.5 are 400', (await put(u1, [{ chargeMasterId: PARK, quantity: 0 }])).s === 400 && (await put(u1, [{ chargeMasterId: PARK, quantity: 21 }])).s === 400 && (await put(u1, [{ chargeMasterId: PARK, quantity: 1.5 }])).s === 400);
t('unit charges: a charge of another project is 400', (await put(u1, [{ chargeMasterId: OTHER, quantity: 1 }])).s === 400);
t('unit charges: the same charge twice, a bad id and a non-list are 400', (await put(u1, [{ chargeMasterId: PARK }, { chargeMasterId: PARK }])).s === 400 && (await put(u1, [{ chargeMasterId: 'zzz' }])).s === 400 && (await A('PUT', `/units/${u1}/charges`, { charges: 'x' })).s === 400);
t('unit charges: a failed save keeps the old list', (await A('GET', `/units/${u1}/charges`)).j.data.attached.length === 1);
t('unit charges: unknown unit is 404', (await put(NIL, [])).s === 404);
t('unit charges: viewer and sales cannot write, no login is 401', (await put(u1, [], RO)).s === 403 && (await put(u1, [], SE)).s === 403 && (await put(u1, [], NO)).s === 401);
r = await A('POST', '/units', { projectId: X.P, towerId: X.T, unitNumber: `C9-${U}`, floor: 1, bhkType: '1BHK', charges: [{ chargeMasterId: PARK, quantity: 1 }] }); t('unit charges: a new unit can be created with its charges in one call', r.s === 201 && (await A('GET', `/units/${r.j.data.id}/charges`)).j.data.attached.length === 1, r);
t('unit charges: a bad charge on create makes no unit', (await A('POST', '/units', { projectId: X.P, towerId: X.T, unitNumber: `C10-${U}`, floor: 1, bhkType: '1BHK', charges: [{ chargeMasterId: OTHER }] })).s === 400 && psql(`select count(*) from units where unit_number = 'C10-${U}'`) === '0');

// a booking of the unit puts the charges on the customer
const person = async (P) => (await A('POST', '/consumers', { name: `UC Buyer ${++seq} ${U}`, mobile: mob(), project_id: P })).j.data.id;
const bookAndFinish = async (unitId) => {
  const c = await person(X.P);
  const b = await A('POST', '/booking', { consumer_id: c, project_id: X.P, unit_id: unitId, selected_plan_name: 'Plan ' + U, booking_date: today });
  if (b.s !== 201) return { err: b };
  const f = await A('PATCH', `/booking/${b.j.data.id}`, { booking_amount: 10000, payment_mode: 'cash' });
  return { c, f };
};
const k1 = await bookAndFinish(u1);
t('booking: the unit with parking x2 completes', k1.f?.s === 200, k1);
const rowsOf = (c) => psql(`select charge_name || '=' || amount from consumer_addon_charges where consumer_id = '${k1.c}' and status = 'active' order by charge_name`).split('\n');
const got = rowsOf();
t('booking: the customer carries parking x2 (200000) and the Mandatory charge (5000), not the charge nobody attached', got.includes(`Parking ${U}=200000.00`) && got.includes(`Club ${U}=5000.00`) && !got.some((x) => x.startsWith('Restoration')), got);
t('booking: the installment that bills them carries both (205000 before GST)', psql(`select coalesce(sum(d.addon_charge_amount),0) from demands d join payment_plans pp on pp.id = d.payment_plan_id where pp.consumer_id = '${k1.c}'`) === '205000.00');
const u2 = await unit(X); const k2 = await bookAndFinish(u2);
t('booking: a unit with nothing attached still gets the Mandatory charge', k2.f?.s === 200 && psql(`select string_agg(charge_name || '=' || amount, ',') from consumer_addon_charges where consumer_id = '${k2.c}' and status = 'active'`) === `Club ${U}=5000.00`, k2);
t('unit charges: a booked unit refuses a change (409)', (await put(u1, [])).s === 409);
console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
