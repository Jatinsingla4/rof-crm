// Booking: roles, input rules, one unit one booking (also in a race), starting / completing / cancelling a booking, edit locks,
// what a completed booking creates (plan, demands, receipt), booking documents, and random input.
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-booking.mjs   (psql must reach the same database; SEED=n repeats a random run)
import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { bizToday, bizDate } from '../_shared/business-date.mjs';
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
const today = bizToday(), later = (d) => bizDate(Date.now() + d * 864e5);
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

// ---------- a project with no GST set up ----------
{
  const P3 = await mkProj('C'), T3 = await tw(P3); const u3 = await unit(P3, T3); await plan(P3, 'NoGst ' + U, [100]); const c3 = await person(P3);
  r = await A('POST', '/booking', { consumer_id: c3, project_id: P3, unit_id: u3, selected_plan_name: 'NoGst ' + U, booking_date: today });
  t('no GST: a project without a GST rate gets a plain 422 telling to set it up (not a server error)', r.s === 422 && /GST/.test(r.j?.error || ''), r.s + JSON.stringify(r.j));
  t('no GST: nothing was left behind (no booking, unit still available)', psql(`select count(*) from booking_records where unit_id='${u3}'`) === '0' && psql(`select status from units where id='${u3}'`) === 'available');
}

// ---------- a unit shift keeps the deal: the file and the demands stay on the booked area and price ----------
{
  const x = await startBooking({ basic_price: 4000, carpet_area_sqft: 640 }); const xc = x.c.id ?? x.c; r = await finish(x.id, { booking_amount: 40000 }); t('shift price: booking confirmed', r.s === 200, r.s + JSON.stringify(r.j));
  const big = await unit(P1, T1, 800, 3200000);
  r = await A('POST', '/allocations/shift', { consumerId: xc, newUnitId: big, reason: 'bigger unit' }); t('shift price: the shift is accepted', r.s === 200, r.s + JSON.stringify(r.j));
  const lt = await A('POST', '/auth/link-token', { path: `/api/consumers/${xc}/applicant-file` });
  const html = await (await fetch(B + `/consumers/${xc}/applicant-file?token=${lt.j.token || lt.j.data?.token}`)).text();
  const txt = html.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  t('shift price: the file still shows the booked carpet area 640 (not the new unit 800)', /Carpet Area \(Sq\. Ft\.\) 640\.000/.test(txt), (txt.match(/Carpet Area \(Sq\. Ft\.\) \S+/) || [''])[0]);
  t('shift price: the Agreement Value is still 25,60,000 (the demands are on that price)', /Agreement Value Rs\. 25,60,000\.00/.test(txt), (txt.match(/Agreement Value Rs\. \S+/) || [''])[0]);
}

// ---------- roles ----------
{
  const c = await person(), u = await unit();
  r = await book(c, u, {}, RO); t('roles: read_only_viewer cannot start a booking -> 403', r.s === 403, r.s);
  r = await book(c, u, {}, AF); t('roles: accounts_finance cannot start a booking -> 403', r.s === 403, r.s);
  r = await book(c, u, {}, SE); t('roles: sales_executive can start a booking', r.s === 201, r.s + JSON.stringify(r.j)); const id = r.j.data?.id;
  for (const [n, m, p, b] of [['edit', 'PATCH', `/booking/${id}/edit`, { remarks: 'x' }], ['cancel', 'POST', `/booking/${id}/cancel`, { reason: 'x' }], ['confirm the payment step', 'PATCH', `/booking/${id}`, { booking_amount: 1000, payment_mode: 'cash' }]]) { r = await RO(m, p, b); t(`roles: read_only_viewer cannot ${n} -> 403`, r.s === 403, r.s); }
  for (const [n, m, p, b] of [['edit', 'PATCH', `/booking/${id}/edit`, { remarks: 'x' }], ['cancel', 'POST', `/booking/${id}/cancel`, { reason: 'x' }]]) { r = await AF(m, p, b); t(`roles: accounts_finance cannot ${n} -> 403`, r.s === 403, r.s); }
  r = await RO('GET', '/booking?pageSize=2'); t('roles: read_only_viewer can list bookings', r.s === 200, r.s);
  r = await RO('GET', `/booking/${id}`); t('roles: read_only_viewer can open a booking', r.s === 200, r.s);
  r = await AF('PATCH', `/booking/${id}`, { booking_amount: 10000, payment_mode: 'cash' }); t('roles: accounts_finance can confirm the payment step', r.s === 200, r.s + JSON.stringify(r.j));
}

// ---------- starting a booking: bad input ----------
{
  const c = await person(), u = await unit();
  const bad400 = async (name, patch, code = 400) => { const x = await book(c, patch.unit_id ?? u, patch); t(`start: ${name} -> ${code}`, x.s === code, x.s + ' ' + JSON.stringify(x.j).slice(0, 110)); if (x.s === 201) { await A('POST', `/booking/${x.j.data.id}/cancel`, { reason: 'test cleanup' }); } return x; };
  r = await A('POST', '/booking', { project_id: P1, unit_id: u, selected_plan_name: PLAN }); t('start: consumer_id missing -> 400', r.s === 400, r.s);
  await bad400('consumer_id not an id', { consumer_id: 'abc' });
  await bad400('applicant that does not exist', { consumer_id: NIL }, 404);
  r = await A('POST', '/booking', { consumer_id: c, project_id: P1, selected_plan_name: PLAN }); t('start: unit missing -> 400', r.s === 400, r.s);
  await bad400('unit_id not an id', { unit_id: 'xyz' });
  await bad400('unit that does not exist', { unit_id: NIL });
  r = await A('POST', '/booking', { consumer_id: c, project_id: P1, unit_id: u }); t('start: plan missing -> 400', r.s === 400, r.s);
  await bad400('plan that does not exist', { selected_plan_name: 'Nope ' + U });
  await bad400('plan that adds up to 90%', { selected_plan_name: PLAN90 });
  await bad400('plan of another project', { selected_plan_name: PLAN_B });
  await bad400('plan name as object', { selected_plan_name: {} });
  const uB = await unit(P2, T2); await bad400('unit that belongs to another project', { unit_id: uB });
  await bad400('project that does not match the applicant', { project_id: P2, unit_id: uB, selected_plan_name: PLAN_B }, 409);
  for (const d of [later(3), '2999-01-01', '2020-02-30', 'abc', 20250101, '01/02/2025', '']) { const x = await book(c, u, { booking_date: d }); if (d === '') t('start: blank date means today (201)', x.s === 201, x.s), x.s === 201 && await A('POST', `/booking/${x.j.data.id}/cancel`, { reason: 'cleanup' }); else t(`start: booking_date ${JSON.stringify(d)} -> 400`, x.s === 400, x.s + JSON.stringify(x.j)); }
  for (const v of [-1, 'abc', '1e5', 1e12, true, [5], { a: 1 }, '12,000']) await bad400(`booking_amount ${JSON.stringify(v)}`, { booking_amount: v, payment_mode: 'cash' });
  await bad400('booking_amount 7 crore on a 90 lakh unit (out by ten times)', { booking_amount: 70000000, payment_mode: 'cash' });
  await bad400('payment_mode "bitcoin"', { booking_amount: 1000, payment_mode: 'bitcoin' });
  await bad400('payment_mode as list', { booking_amount: 1000, payment_mode: ['cash'] });
  await bad400('amount without a payment mode', { booking_amount: 1000 });
  await bad400('payment mode without an amount', { payment_mode: 'cash' });
  await bad400('payment_ref 101 characters', { booking_amount: 1000, payment_mode: 'cheque', payment_ref: 'r'.repeat(101) });
  await bad400('payment_ref with <b>', { booking_amount: 1000, payment_mode: 'cheque', payment_ref: '<b>1' });
  await bad400('cheque_date in the future', { booking_amount: 1000, payment_mode: 'cheque', cheque_date: later(5) });
  await bad400('discount bigger than the basic price', { company_inaugural_disc: 99999999 });
  await bad400('discount negative', { company_inaugural_disc: -5 });
  await bad400('basic rate negative', { basic_price: -1 });
  await bad400('basic rate 10 lakh a sq ft x 10', { basic_price: 1e7 });
  await bad400('carpet area "x"', { carpet_area_sqft: 'x' });
  await bad400('carpet area 0', { carpet_area_sqft: 0 });
  await bad400('basic rate 0 (billing must not fall back to the unit master price)', { basic_price: 0 });
  { const x = await book(c, u, { basic_price: 0 }); t('start: basic rate 0 says why', /Rate per sq ft must be more than 0/.test(x.j?.error || ''), JSON.stringify(x.j).slice(0, 110)); }
  await bad400('basic rate with 5 decimals', { basic_price: 7857.14286 });
  await bad400('booking_type "weird"', { booking_type: 'weird' });
  await bad400('commission type "x"', { broker_commission_type: 'x' });
  await bad400('percentage commission 150', { broker_commission_type: 'percent', broker_commission: 150 });
  await bad400('commission negative', { broker_commission: -1 });
  await bad400('broker id not an id', { broker_id: 'zz' });
  await bad400('broker that does not exist', { booking_type: 'broker', broker_id: NIL }, 400);
  await bad400('PLC amount negative', { plc_amount: -5 });
  await bad400('PLC amount 100 crore + 1', { plc_amount: 1_000_000_001 });
  await bad400('other charge amount "abc"', { other_charge_amount: 'abc' });
  await bad400('has_plc "maybe"', { has_plc: 'maybe' });
  await bad400('form_no 101 characters', { form_no: 'f'.repeat(101) });
  await bad400('remarks 2001 characters', { remarks: 'r'.repeat(2001) });
  await bad400('remarks with <script>', { remarks: '<script>1</script>' });
  await bad400('comm PIN "1" for India', { comm_pin: '1' });
  await bad400('rebate percent 101', { company_rebate_pct: 101 });
  await bad400('sales_employee_id not an id', { sales_employee_id: '1' });
  r = await A('POST', '/booking', undefined, '[1]'); t('start: body as list -> 400', r.s === 400, r.s);
  r = await A('POST', '/booking', undefined, '{oops'); t('start: broken JSON -> 400', r.s === 400, r.s);
  r = await A('POST', '/booking', {}); t('start: empty body -> 400', r.s === 400, r.s);
  t('start: none of the refused attempts left a booking or locked the unit', psql(`select count(*) from booking_records where unit_id='${u}' and status<>'cancelled'`) === '0' && psql(`select status from units where id='${u}'`) === 'available');
}

// ---------- starting a booking: good ----------
let bk1;
{
  bk1 = await startBooking({ nominee_name: 'Nominee One', remarks: 'first', basic_price: 5000, carpet_area_sqft: 1200 });
  r = await A('GET', `/booking/${bk1.id}`);
  t('start: pending booking, no payment yet', bk1.x.j.data.status === 'pending_payment' && r.j.data.status === 'pending_payment', bk1.x.j.data.status);
  { const cd = await A('GET', `/consumers/${bk1.c}`); t('consumer detail carries the booking rate, so the profile prices on the same basis as the booking', Number(cd.j.data?.basic_price) === 5000, JSON.stringify(cd.j.data?.basic_price)); }
  t('start: registration number is project-letters-year-number', /^BKA\w-\d{4}-\d{4}$/.test(bk1.reg) || /^[A-Z]{4}-\d{4}-\d{4}$/.test(bk1.reg), bk1.reg);
  t('start: form number defaults to the registration number', bk1.x.j.data.form_no === bk1.reg, bk1.x.j.data.form_no);
  t('start: a pending booking keeps the unit available', psql(`select status from units where id='${bk1.u}'`) === 'available');
  t('start: the applicant got the registration number and the booking has a tax row', psql(`select registration_no from consumers where id='${bk1.c}'`) === bk1.reg && psql(`select count(*) from booking_payment_taxes where booking_record_id='${bk1.id}'`) === '1');
  t('start: rate and area entered are stored as given', Number(r.j.data.basic_rate_inr_sqft) === 5000 && Number(r.j.data.carpet_area_sqft) === 1200, JSON.stringify([r.j.data.basic_rate_inr_sqft, r.j.data.carpet_area_sqft]));
  const c2 = await person(), u2 = await unit();
  r = await book(c2, u2, { booking_amount: 50000, payment_mode: 'cheque', payment_ref: 'CHQ' + U + '1', bank_name: 'HDFC', cheque_date: today });
  t('start: with an amount and mode the booking is active and the unit is held', r.s === 201 && r.j.data.status === 'active' && psql(`select status from units where id='${u2}'`) === 'locked', r.s + JSON.stringify(r.j));
  t('start: unit status history has the hold', psql(`select count(*) from unit_status_history where unit_id='${u2}' and new_status='locked'`) === '1');
  r2 = await book(await person(), u2); t('start: the same unit again (another applicant) -> 409', r2.s === 409, r2.s + JSON.stringify(r2.j));
  r2 = await book(bk1.c, bk1.u); t('start: the same unit again while pending -> 409', r2.s === 409, r2.s);
}

// ---------- one unit, one booking, also in a race ----------
{
  const u = await unit(); const people = await Promise.all(Array.from({ length: 8 }, () => person()));
  const rs2 = await Promise.all(people.map(c => book(c, u)));
  t('race: 8 people book one unit at once -> exactly one 201, the rest 409', rs2.filter(x => x.s === 201).length === 1 && rs2.filter(x => x.s === 409).length === 7, rs2.map(x => x.s).join());
  t('race: only one live booking row for the unit', psql(`select count(*) from booking_records where unit_id='${u}' and status<>'cancelled'`) === '1');
  const regs = await Promise.all(Array.from({ length: 6 }, async () => { const c = await person(); return book(c, await unit()); }));
  const nos = regs.map(x => x.j.data?.registration_no); t('race: 6 bookings at once get 6 different registration numbers', new Set(nos).size === 6 && nos.every(Boolean), nos.join());
  const fn = 'FORM-' + U; const c3 = await person(), c4 = await person();
  r = await book(c3, await unit(), { form_no: fn }); r2 = await book(c4, await unit(), { form_no: fn });
  t('form number: the same form number twice -> second 409', r.s === 201 && r2.s === 409, r.s + '/' + r2.s);
  const rf = await Promise.all(Array.from({ length: 6 }, async () => book(await person(), await unit(), { form_no: 'RACE-' + U })));
  t('race: 6 bookings with one form number -> exactly one wins', rf.filter(x => x.s === 201).length === 1, rf.map(x => x.s).join());
  r = await A('GET', `/booking/check-form-no?formNo=${fn}`); t('check-form-no: shows it is used', r.j.available === false, JSON.stringify(r.j));
  r = await A('GET', `/booking/check-form-no?formNo=${fn}&excludeId=${r2.s === 409 ? NIL : ''}`); t('check-form-no: an unknown excludeId changes nothing', r.j.available === false);
  r = await A('GET', '/booking/check-form-no?formNo=nobody-' + U); t('check-form-no: a free number is available', r.j.available === true);
  r = await A('GET', '/booking/check-form-no?excludeId=abc&formNo=x'); t('check-form-no: excludeId not an id -> 400', r.s === 400, r.s);
  r = await A('GET', '/booking/check-form-no?formNo=' + 'x'.repeat(101)); t('check-form-no: 101 characters -> 400', r.s === 400, r.s);
  const refx = 'REF' + U; const c5 = await person();
  r = await book(c5, await unit(), { booking_amount: 1000, payment_mode: 'cheque', payment_ref: refx });
  r2 = await book(await person(), await unit(), { booking_amount: 1000, payment_mode: 'cheque', payment_ref: refx }); t('reference: the same cheque / reference twice -> 409', r.s === 201 && r2.s === 409, r.s + '/' + r2.s);
  r2 = await book(await person(), await unit(), { booking_amount: 1000, payment_mode: 'cash', payment_ref: refx }); t('reference: cash does not need a unique reference (201)', r2.s === 201, r2.s);
  r = await A('GET', `/booking/check-cheque?ref=${refx}`); t('check-cheque: finds the used reference', r.j.exists === true, JSON.stringify(r.j));
  for (const q of ['', 'ref=' + 'x'.repeat(101), 'ref=a&exclude_id=bad']) { r = await A('GET', '/booking/check-cheque?' + q); t(`check-cheque: ${JSON.stringify(q.slice(0, 25))} -> 400`, r.s === 400, r.s); }
}

// ---------- cancelling a booking that was never completed ----------
{
  const b = await startBooking();
  r = await A('POST', `/booking/${b.id}/cancel`, {}); t('cancel: a reason is required -> 400', r.s === 400, r.s);
  r = await A('POST', `/booking/${b.id}/cancel`, { reason: { a: 1 } }); t('cancel: reason as object -> 400', r.s === 400, r.s);
  r = await A('POST', `/booking/${b.id}/cancel`, { reason: 'x'.repeat(501) }); t('cancel: reason over 500 characters -> 400', r.s === 400, r.s);
  r = await A('POST', `/booking/${b.id}/cancel`, { reason: 'Customer changed mind' }); t('cancel: a pending booking is cancelled', r.s === 200 && brk(b.id) === 'cancelled', r.s + JSON.stringify(r.j));
  t('cancel: the reason is kept in the remarks', /Cancelled: Customer changed mind/.test(psql(`select remarks from booking_records where id='${b.id}'`)));
  r = await A('POST', `/booking/${b.id}/cancel`, { reason: 'again' }); t('cancel: cancelling twice -> 409', r.s === 409, r.s);
  r = await book(await person(), b.u); t('cancel: the unit can be booked again at once', r.s === 201, r.s + JSON.stringify(r.j));
  r = await A('POST', `/booking/${NIL}/cancel`, { reason: 'x' }); t('cancel: unknown booking -> 404', r.s === 404, r.s);
  r = await A('POST', '/booking/not-an-id/cancel', { reason: 'x' }); t('cancel: id that is not an id -> 400', r.s === 400, r.s);
  r = await finish(b.id); t('cancel: a cancelled booking cannot be confirmed -> 409', r.s === 409, r.s);
  r = await A('PATCH', `/booking/${b.id}/edit`, { remarks: 'x' }); t('cancel: a cancelled booking cannot be edited -> 409', r.s === 409, r.s);
  const act = await startBooking({ booking_amount: 20000, payment_mode: 'cash' });
  t('cancel: an active booking holds its unit', psql(`select status from units where id='${act.u}'`) === 'locked');
  r = await A('POST', `/booking/${act.id}/cancel`, { reason: 'Cheque bounced' }); t('cancel: an active booking is cancelled and the unit is released', r.s === 200 && psql(`select status from units where id='${act.u}'`) === 'available', r.s + JSON.stringify(r.j));
  t('cancel: the release is in the unit history', psql(`select count(*) from unit_status_history where unit_id='${act.u}' and new_status='available'`) === '1');
  const done = await startBooking(); await finish(done.id);
  r = await A('POST', `/booking/${done.id}/cancel`, { reason: 'x' }); t('cancel: a complete booking cannot be cancelled here (Surrender does it) -> 409', r.s === 409 && brk(done.id) === 'complete', r.s);
  const cb = await startBooking({ booking_type: 'broker', broker_id: psql(`insert into brokers(name, mobile) values('Brk ${U}', '9000000000') returning id`).split(' ')[0] ?? '', broker_commission: 25000 });
  t('cancel: a broker booking starts a pending commission', psql(`select status from broker_commissions where consumer_id='${cb.c}'`) === 'pending');
  await A('POST', `/booking/${cb.id}/cancel`, { reason: 'x' }); t('cancel: and cancelling cancels that pending commission', psql(`select status from broker_commissions where consumer_id='${cb.c}'`) === 'cancelled');
}

// ---------- completing a booking ----------
let done1;
{
  const fin = await startBooking({ basic_price: 5000, plc_amount: 100000, other_charge_amount: 50000, company_inaugural_disc: 25000, has_plc: true });
  const bad = async (name, b, code = 400) => { const x = await finish(fin.id, b); t(`complete: ${name} -> ${code}`, x.s === code, x.s + ' ' + JSON.stringify(x.j).slice(0, 110)); };
  r = await A('PATCH', `/booking/${fin.id}`, undefined, '{}'); t('complete: empty body -> 400', r.s === 400, r.s);
  for (const v of [0, -5, 'abc', '1e4', null, undefined, [5], true, 1e12]) await bad(`booking_amount ${JSON.stringify(v)}`, { booking_amount: v });
  await bad('amount 10 times the price', { booking_amount: 90000000 });
  for (const v of [undefined, 'bitcoin', '', ['cash'], null]) await bad(`payment_mode ${JSON.stringify(v)}`, { payment_mode: v });
  await bad('payment_ref 101 characters', { payment_mode: 'cheque', payment_ref: 'r'.repeat(101) });
  await bad('cheque date in the future', { payment_mode: 'cheque', payment_ref: 'C1', cheque_date: later(9) });
  await bad('interest_amount negative', { interest_amount: -1 });
  await bad('tds_challan_id not an id', { tds_challan_id: '5' });
  await bad('companyBankAccountId not an id', { companyBankAccountId: 'x' });
  await bad('bank_name with <b>', { bank_name: '<b>' });
  r = await A('PATCH', `/booking/${NIL}`, { booking_amount: 1, payment_mode: 'cash' }); t('complete: unknown booking -> 404', r.s === 404, r.s);
  r = await A('PATCH', '/booking/not-an-id', { booking_amount: 1, payment_mode: 'cash' }); t('complete: id that is not an id -> 400', r.s === 400, r.s);
  t('complete: none of the refused tries changed the booking', brk(fin.id) === 'pending_payment' && psql(`select count(*) from receipts where consumer_id='${fin.c}'`) === '0');
  r = await finish(fin.id, { booking_amount: 100000, payment_mode: 'cheque', payment_ref: 'CH' + U + '9', bank_name: 'SBI', cheque_date: today });
  t('complete: confirming the payment -> 200, status complete', r.s === 200 && brk(fin.id) === 'complete', r.s + JSON.stringify(r.j));
  const pp = psql(`select total_amount_inr from payment_plans where consumer_id='${fin.c}'`);
  t('complete: plan total = rate x carpet + PLC + other charge - discount (5,000 x 1,000 + 100,000 + 50,000 - 25,000)', Number(pp) === 5125000, pp);
  const dem = psql(`select count(*)||'|'||sum(d.amount_due_inr) from demands d join payment_plans p on p.id=d.payment_plan_id where p.consumer_id='${fin.c}'`).split('|');
  t('complete: one demand per plan row and they add up to the plan total', Number(dem[0]) === 3 && Math.abs(Number(dem[1]) - 5125000) <= 3, dem.join('|'));
  { // the form sends price / carpet area as the rate; the plan must come to the unit's price to the rupee (55,00,000 / 700 = 7857.142857...)
    const c7 = await person(), u7 = await unit(P1, T1, 700, 5500000);
    const x7 = await book(c7, u7, { basic_price: Math.round(5500000 * 10000 / 700) / 10000 });
    const f7 = await finish(x7.j.data.id, { booking_amount: 100000, payment_mode: 'cash' });
    const p7 = psql(`select total_amount_inr from payment_plans where consumer_id='${c7}'`);
    t('complete: a rate of price / area (4 decimals) gives a plan total equal to the unit price', f7.s === 200 && Number(p7) === 5500000, f7.s + ' ' + p7);
  }
  { // a unit whose price is not set yet must not be booked: the plan, GST and demands would all be 0
    const c8 = await person(), mk = await A('POST', '/units', { projectId: P1, towerId: T1, unitNumber: `NP${++un}-${U}`, floor: 1, bhkType: '2BHK', carpetAreaSqft: 700, superAreaSqft: 900 });
    const x8 = await book(c8, mk.j.data.id, {});
    t('create: a unit with no price cannot be booked -> 400', mk.s === 201 && x8.s === 400 && /no price/.test(x8.j.error || ''), mk.s + ' ' + x8.s + ' ' + JSON.stringify(x8.j).slice(0, 120));
  }
  t('complete: allocation booked, applicant linked to the unit, unit booked', psql(`select status from allocations where consumer_id='${fin.c}'`) === 'booked' && psql(`select allocated_unit_id from consumers where id='${fin.c}'`) === fin.u && psql(`select status from units where id='${fin.u}'`) === 'booked');
  t('complete: a cheque booking makes a cheque receipt for the amount', psql(`select method||'|'||amt from (select payment_method::text as method, amount_received_inr as amt from receipts where consumer_id='${fin.c}') x`) === 'cheque|100000');
  r = await finish(fin.id); t('complete: confirming again -> 409, nothing doubled', r.s === 409 && psql(`select count(*) from receipts where consumer_id='${fin.c}'`) === '1' && psql(`select count(*) from payment_plans where consumer_id='${fin.c}'`) === '1', r.s + JSON.stringify(r.j));
  done1 = fin;
  for (const [mode, want] of [['cash', 'cash'], ['draft', 'demand_draft'], ['upi', 'upi'], ['neft', 'neft'], ['online', 'bank_transfer'], ['card', 'card'], ['adjust', 'bank_transfer']]) {
    const x = await startBooking(); r = await finish(x.id, { payment_mode: mode, payment_ref: mode === 'cash' ? undefined : `M${mode}${U}` });
    t(`complete: mode "${mode}" is saved as a "${want}" receipt`, r.s === 200 && psql(`select payment_method::text from receipts where consumer_id='${x.c}'`) === want, r.s + JSON.stringify(r.j) + psql(`select payment_method::text from receipts where consumer_id='${x.c}'`));
  }
  const x1 = await startBooking(), x2 = await startBooking();
  r = await finish(x1.id, { payment_mode: 'cheque', payment_ref: 'CH' + U + '9' }); t('complete: a cheque reference already used by another booking -> 409', r.s === 409, r.s);
  r = await finish(x2.id, { payment_mode: 'cash', payment_ref: 'CH' + U + '9' }); t('complete: cash with the same reference text is fine', r.s === 200, r.s);
  const fl = await startBooking(); r = await finish(fl.id, { interest_amount: 100.123456789, tds_amount: 1234.5678901, dealer_adjustment_amount: 0.1 + 0.2, s_tax_pct: 0.30000000000000004 });
  t('complete: amounts the page works out (floating-point tails) are rounded, not refused', r.s === 200, r.s + JSON.stringify(r.j));
  const rc = await startBooking(); const rr = await Promise.all(Array.from({ length: 6 }, () => finish(rc.id)));
  t('race: 6 confirmations at once -> exactly one 200, the rest 409', rr.filter(x => x.s === 200).length === 1 && rr.filter(x => x.s === 409).length === 5, rr.map(x => x.s).join());
  t('race: one receipt, one plan, one allocation, three demands', psql(`select count(*) from receipts where consumer_id='${rc.c}'`) === '1' && psql(`select count(*) from payment_plans where consumer_id='${rc.c}'`) === '1' && psql(`select count(*) from allocations where consumer_id='${rc.c}'`) === '1' && psql(`select count(*) from demands where consumer_id='${rc.c}'`) === '3');
  r = await A('GET', `/booking/${rc.id}/receipt-html`); t('receipt page opens for a complete booking', r.s === 200 || r.s === undefined, r.s);
  const rh = await fetch(B + `/booking/${rc.id}/receipt-html`, { headers: { authorization: 'Bearer ' + tokA } }); t('receipt page is HTML', rh.status === 200 && /html/.test(rh.headers.get('content-type') || ''), rh.status);
  r = await A('GET', `/booking/${NIL}/receipt-html`); t('receipt page: unknown booking -> 404', r.s === 404, r.s);
  r = await A('GET', '/booking/not-an-id/receipt-html'); t('receipt page: id that is not an id -> 400', r.s === 400, r.s);
}

// ---------- booking again after a surrender (the earlier allocation is cancelled) ----------
{
  const s = await startBooking(); await finish(s.id);
  psql(`update booking_records set status='cancelled' where id='${s.id}'`); psql(`update allocations set status='cancelled' where consumer_id='${s.c}' and unit_id='${s.u}'`);
  psql(`update units set status='available' where id='${s.u}'`); psql(`update consumers set allocated_unit_id=null where id='${s.c}'`);
  r = await book(s.c, s.u); const id2 = r.j.data?.id; r2 = await finish(id2);
  t('re-book: the same applicant can book the same unit again after a surrender', r.s === 201 && r2.s === 200, r.s + '/' + r2.s);
  t('re-book: the new booking gets its own plan and 3 demands (it used to get none)', psql(`select count(*) from payment_plans where consumer_id='${s.c}' and unit_id='${s.u}'`) === '2' && psql(`select count(*) from demands d join payment_plans p on p.id=d.payment_plan_id join allocations a on a.id=p.allocation_id where a.consumer_id='${s.c}' and a.status='booked'`) === '3');
}

// ---------- edit ----------
{
  const e = await startBooking({ basic_price: 4000 }); const other = await person();
  const ed = (b, who = A, id = e.id) => who('PATCH', `/booking/${id}/edit`, b);
  const bad = async (name, b, code = 400) => { const x = await ed(b); t(`edit: ${name} -> ${code}`, x.s === code, x.s + ' ' + JSON.stringify(x.j).slice(0, 110)); };
  await bad('booking_date in the future', { booking_date: later(4) });
  await bad('booking_date impossible', { booking_date: '2025-13-40' });
  await bad('rate negative', { basic_rate_inr_sqft: -1 });
  await bad('rate "abc"', { basic_rate_inr_sqft: 'abc' });
  await bad('carpet area 10 million', { carpet_area_sqft: 1e7 });
  await bad('discount bigger than the basic price', { company_inaugural_disc: 99999999 });
  await bad('rebate percent 150', { company_rebate_pct: 150 });
  await bad('broker_id not an id', { broker_id: 'zz' });
  await bad('booking_type "x"', { booking_type: 'x' });
  await bad('commission type "x"', { broker_commission_type: 'x' });
  await bad('form_no 101 characters', { form_no: 'f'.repeat(101) });
  await bad('remarks with <b>', { remarks: '<b>' });
  await bad('applicant PAN "zzz"', { pan_no: 'zzz' });
  await bad('applicant mobile "12"', { mobile: '12' });
  await bad('applicant email "x"', { email: 'x' });
  await bad('applicant date of birth a minor', { dob: '2020-01-01' });
  await bad('applicant gender "q"', { gender: 'q' });
  await bad('applicant income category "HIG"', { income_category: 'HIG' });
  await bad('applicant PIN "1"', { present_pin: '1' });
  await bad('applicant annual income -5', { annual_income: -5 });
  await bad('applicant name as object', { first_name: { a: 1 } });
  await bad('applicant mobile of another applicant in the project', { mobile: (await A('GET', `/consumers/${other}`)).j.data.mobile }, 409);
  r = await A('PATCH', `/consumers/${e.c}`, { present_address_line1: '' }); t('applicant: the present address cannot be cleared while a booking exists -> 400', r.s === 400 && /present address/.test(r.j.error || ''), r.s + JSON.stringify(r.j).slice(0, 120));
  r = await A('PATCH', `/booking/${NIL}/edit`, { remarks: 'x' }); t('edit: unknown booking -> 404', r.s === 404, r.s);
  r = await A('PATCH', '/booking/not-an-id/edit', { remarks: 'x' }); t('edit: id that is not an id -> 400', r.s === 400, r.s);
  t('edit: nothing from the refused tries was saved', psql(`select basic_rate_inr_sqft from booking_records where id='${e.id}'`) === '4000.0000' && psql(`select coalesce(remarks,'') from booking_records where id='${e.id}'`) === '');
  r = await ed({ basic_rate_inr_sqft: 4500, remarks: 'edited', first_name: 'newfirst', last_name: 'newlast', email: 'NEW@Mail.com', pan_no: 'abcde1234f', present_city: 'Rohtak' });
  t('edit: a pending booking takes a new rate, note and applicant details', r.s === 200 && r.j.data.booking.basic_rate_inr_sqft === '4500.0000' && r.j.data.consumer.name === 'Newfirst Newlast' && r.j.data.consumer.email === 'new@mail.com' && r.j.data.consumer.pan_no === 'ABCDE1234F' && r.j.data.consumer.present_city === 'Rohtak', r.s + JSON.stringify(r.j).slice(0, 200));
  await bad('rate with 5 decimals', { basic_rate_inr_sqft: 7857.14286 });
  r = await ed({ basic_rate_inr_sqft: 7857.1429 }); t('edit: a rate keeps 4 decimals, so rate x area stays within 50 paise of the unit price', r.s === 200 && psql(`select basic_rate_inr_sqft from booking_records where id='${e.id}'`) === '7857.1429', r.s + JSON.stringify(r.j).slice(0, 120));
  await ed({ basic_rate_inr_sqft: 4500 }); // back to the rate the later tests expect
  r = await ed({ email: '', present_city: '', remarks: 'edited' }); t('edit: blank boxes from the form leave the applicant values as they are', r.s === 200 && r.j.data.consumer.email === 'new@mail.com' && r.j.data.consumer.present_city === 'Rohtak', JSON.stringify(r.j.data?.consumer).slice(0, 120));
  r = await ed({}); t('edit: nothing to change -> 200, changed is empty', r.s === 200 && r.j.changed.length === 0, JSON.stringify(r.j.changed));
  r = await ed({ form_no: 'FORM-' + U }); t('edit: a form number used by another booking -> 409', r.s === 409, r.s);
  r = await ed({ form_no: 'MYFORM-' + U }); t('edit: a free form number is saved on the booking and the applicant', r.s === 200 && psql(`select form_no from consumers where id='${e.c}'`) === 'MYFORM-' + U, r.s);
  t('edit: the change is audited with PAN masked', psql(`select count(*) from audit_logs where resource_id='${e.id}'`) !== '0' && psql(`select count(*) from audit_logs where resource_id='${e.id}' and new_values::text like '%ABCDE1234F%'`) === '0');
  // legacy: an old bad value sent back unchanged passes
  psql(`update consumers set present_pin='12' where id='${e.c}'`);
  r = await ed({ present_pin: '12', present_city: 'Hisar' }); t('edit: an old bad PIN sent back unchanged does not block the edit', r.s === 200, r.s + JSON.stringify(r.j));
  r = await ed({ present_pin: '13' }); t('edit: a different bad PIN is refused', r.s === 400, r.s);
  // after completion
  r = await finish(e.id); t('edit: (booking completed for the next checks)', r.s === 200, r.s);
  const before = psql(`select basic_rate_inr_sqft||'|'||carpet_area_sqft||'|'||coalesce(company_inaugural_disc,0)||'|'||booking_date from booking_records where id='${e.id}'`);
  for (const [k, v] of [['basic_rate_inr_sqft', 9999], ['carpet_area_sqft', 777], ['company_inaugural_disc', 1000], ['booking_date', later(0) === today ? '2020-01-01' : today]]) { r = await ed({ [k]: v }); t(`edit: complete booking, ${k} cannot change -> 409`, r.s === 409, r.s + JSON.stringify(r.j)); }
  t('edit: the price basis is exactly as it was', psql(`select basic_rate_inr_sqft||'|'||carpet_area_sqft||'|'||coalesce(company_inaugural_disc,0)||'|'||booking_date from booking_records where id='${e.id}'`) === before);
  r = await ed({ basic_rate_inr_sqft: 4500, remarks: 'after completion', form_no: 'MYFORM-' + U }); t('edit: complete booking, the same values and a note are fine', r.s === 200 && r.j.changed.join() === 'remarks', r.s + JSON.stringify(r.j));
  r = await ed({ mobile: mob(), present_city: 'Pune' }, PM); t('edit: project_manager edits the applicant part of a complete booking', r.s === 200, r.s + JSON.stringify(r.j));
  // broker commission follows an edit while pending, then stops
  const brId = psql(`insert into brokers(name, mobile) values('Edit Brk ${U}', '9000000001') returning id`).split(' ')[0];
  const bb = await startBooking({ booking_type: 'broker', broker_id: brId, broker_commission: 10000, basic_price: 5000 });
  r = await A('PATCH', `/booking/${bb.id}/edit`, { broker_commission: 30000 }); t('edit: a pending commission follows the new commission', r.s === 200 && Number(psql(`select commission_amount_inr from broker_commissions where consumer_id='${bb.c}'`)) === 30000, r.s + JSON.stringify(r.j));
  r = await A('PATCH', `/booking/${bb.id}/edit`, { broker_commission_type: 'percent', broker_commission: 2 }); t('edit: a percentage commission is worked out on the basic price (2% of 5,000 x 1,000 = 100,000... of the unit)', r.s === 200 && Number(psql(`select commission_amount_inr from broker_commissions where consumer_id='${bb.c}'`)) === 100000, r.s + psql(`select commission_amount_inr from broker_commissions where consumer_id='${bb.c}'`));
  psql(`update broker_commissions set status='paid' where consumer_id='${bb.c}'`);
  r = await A('PATCH', `/booking/${bb.id}/edit`, { broker_commission: 1 }); t('edit: a paid commission cannot be changed here -> 409', r.s === 409, r.s + JSON.stringify(r.j));
  r = await A('PATCH', `/booking/${bb.id}/edit`, { remarks: 'still editable' }); t('edit: other fields of that booking are still editable', r.s === 200, r.s);
}

// ---------- list and open ----------
{
  for (const [n, q] of [['page 0', 'page=0'], ['page text', 'page=x'], ['pageSize 1001', 'pageSize=1001'], ['pageSize -1', 'pageSize=-1'], ['project_id not an id', 'project_id=abc'], ['consumer_id not an id', "consumer_id=' or 1=1"], ['status with a quote', "status='x"], ['status repeated', 'status=active&status=complete']]) { r = await A('GET', '/booking?' + q); t(`list: ${n} -> 400`, r.s === 400, r.s + JSON.stringify(r.j).slice(0, 80)); }
  r = await A('GET', `/booking?project_id=${P1}&status=complete&pageSize=1000`); t('list: filter by project and status', r.s === 200 && r.j.data.length > 0 && r.j.data.every(x => x.project_id === P1 && x.status === 'complete'), r.s);
  r = await A('GET', `/booking?consumer_id=${done1.c}`); t('list: filter by applicant gives that applicant\'s bookings', r.j.data.length === 1 && r.j.data[0].id === done1.id, r.j.data?.length);
  r = await A('GET', `/booking/${done1.id}`); t('open: a booking carries project, unit, broker and tax details', r.s === 200 && r.j.data.project_name && r.j.data.unit_number && r.j.data.taxes, JSON.stringify(Object.keys(r.j.data || {})).slice(0, 80));
  r = await A('GET', `/booking/${NIL}`); t('open: unknown booking -> 404', r.s === 404, r.s);
  r = await A('GET', '/booking/not-an-id'); t('open: id that is not an id -> 400', r.s === 400, r.s);
}

// ---------- booking documents ----------
{
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'), pdf = Buffer.from('%PDF-1.4 test document');
  const up = async (fields, file, tok = tokA) => { const fd = new FormData(); for (const [k, v] of Object.entries(fields)) if (v !== undefined) fd.append(k, v); if (file) fd.append('file', new Blob([file.buf], { type: file.type }), file.name); const rr = await fetch(B + '/booking-documents/upload', { method: 'POST', headers: { authorization: 'Bearer ' + tok }, body: fd }); let j = null; try { j = await rr.json(); } catch {} return { s: rr.status, j }; };
  const d1 = await startBooking(); const f = { booking_record_id: d1.id, consumer_id: d1.c, document_type: 'PAN Card' };
  r = await up(f, { buf: png, type: 'image/png', name: 'evil.html' }, await login('read_only_viewer@test.local')); t('documents: read_only_viewer cannot upload -> 403', r.s === 403, r.s);
  r = await up({ ...f, booking_record_id: NIL }, { buf: png, type: 'image/png', name: 'a.png' }); t('documents: unknown booking -> 404', r.s === 404, r.s);
  r = await up({ ...f, booking_record_id: 'abc' }, { buf: png, type: 'image/png', name: 'a.png' }); t('documents: booking id not an id -> 400', r.s === 400, r.s);
  r = await up({ ...f, consumer_id: await person() }, { buf: png, type: 'image/png', name: 'a.png' }); t("documents: another applicant's id -> 400", r.s === 400, r.s);
  r = await up({ ...f, document_type: undefined }, { buf: png, type: 'image/png', name: 'a.png' }); t('documents: document type missing -> 400', r.s === 400, r.s);
  r = await up({ ...f, applicant_number: '13' }, { buf: png, type: 'image/png', name: 'a.png' }); t('documents: applicant number 13 -> 400', r.s === 400, r.s);
  r = await up({ ...f, applicant_number: 'x' }, { buf: png, type: 'image/png', name: 'a.png' }); t('documents: applicant number "x" -> 400', r.s === 400, r.s);
  r = await up({ ...f, document_name: '<b>' }, { buf: png, type: 'image/png', name: 'a.png' }); t('documents: name with <b> -> 400', r.s === 400, r.s);
  r = await up(f, { buf: Buffer.from('<html><script>alert(1)</script></html>'), type: 'image/png', name: 'page.png' }); t('documents: HTML sent as "image/png" is refused (the file itself is checked)', r.s === 400, r.s + JSON.stringify(r.j));
  r = await up(f, { buf: Buffer.from('<svg onload=alert(1)>'), type: 'image/svg+xml', name: 'a.svg' }); t('documents: svg refused', r.s === 400, r.s);
  r = await up(f, { buf: Buffer.alloc(11 * 1024 * 1024, 0x25), type: 'application/pdf', name: 'big.pdf' }); t('documents: over 10 MB -> 400', r.s === 400, r.s);
  r = await up({ ...f, applicant_number: '0', document_name: 'PAN of buyer', barcode_no: 'BC1' }, { buf: png, type: 'image/png', name: 'evil.html' }); const doc = r.j?.data;
  t('documents: a png named evil.html is saved; the record never exposes the stored bytes', r.s === 201 && doc?.file_mime_type === 'image/png' && !('file_data' in doc), r.s + JSON.stringify(r.j).slice(0, 200));
  r = await up({ ...f, document_type: 'Address Proof' }, { buf: pdf, type: 'application/pdf', name: 'proof.pdf' }); const doc2 = r.j?.data; t('documents: a pdf is saved', r.s === 201 && doc2?.file_mime_type === 'application/pdf', r.s);
  r = await up({ ...f, document_type: 'Note only' }); t('documents: a record with no file is allowed', r.s === 201 && r.j.data.file_url === null, r.s);
  const fr = await fetch(B + `/booking-documents/${doc.id}/file`, { headers: { authorization: 'Bearer ' + tokA } });
  t('documents: the file opens with a login, with its true type, nosniff and a locked-down policy', fr.status === 200 && fr.headers.get('content-type') === 'image/png' && fr.headers.get('x-content-type-options') === 'nosniff' && /sandbox/.test(fr.headers.get('content-security-policy') || ''), fr.status);
  t('documents: the file is the same bytes', Buffer.from(await fr.arrayBuffer()).equals(png));
  t('documents: without a login the file does not open -> 401', (await fetch(B + `/booking-documents/${doc.id}/file`)).status === 401);
  const lt = (await A('POST', '/auth/link-token', { path: `/api/booking-documents/${doc.id}/file` })).j.token;
  t('documents: a link token opens that file in a new tab', (await fetch(B + `/booking-documents/${doc.id}/file?token=${lt}`)).status === 200);
  t("documents: the same link token does not open another document -> 401", (await fetch(B + `/booking-documents/${doc2.id}/file?token=${lt}`)).status === 401);
  r = await A('GET', `/booking-documents/${NIL}/file`); t('documents: unknown file -> 404', r.s === 404, r.s);
  r = await A('GET', '/booking-documents/not-an-id/file'); t('documents: id not an id -> 400', r.s === 400, r.s);
  r = await A('GET', `/booking-documents?booking_record_id=${d1.id}`); t('documents: list shows the three records, newest last', r.s === 200 && r.j.data.length === 3 && r.j.data.every(x => !('file_data' in x)), r.j.data?.length);
  r = await A('GET', `/booking-documents?booking_record_id=${d1.id}&document_type=Address%20Proof`); t('documents: list filter by type', r.j.data.length === 1, r.j.data?.length);
  for (const q of ['', 'booking_record_id=abc', `booking_record_id=${d1.id}&consumer_id=zz`, `booking_record_id=${d1.id}&applicant_number=x`, `booking_record_id=${d1.id}&booking_record_id=${d1.id}`]) { r = await A('GET', '/booking-documents?' + q); t(`documents: list ${JSON.stringify(q.slice(0, 40))} -> 400`, r.s === 400, r.s); }
  r = await A('PATCH', `/booking-documents/${doc.id}`, { document_name: 'Renamed', remarks: 'checked' }); t('documents: rename and add a remark', r.s === 200 && r.j.data.document_name === 'Renamed', r.s);
  r = await A('PATCH', `/booking-documents/${doc.id}`, { document_name: 'x'.repeat(300) }); t('documents: name of 300 characters -> 400', r.s === 400, r.s);
  r = await A('PATCH', `/booking-documents/${NIL}`, { document_name: 'x' }); t('documents: patch unknown -> 404', r.s === 404, r.s);
  r = await RO('PATCH', `/booking-documents/${doc.id}`, { document_name: 'x' }); t('documents: read_only_viewer cannot rename -> 403', r.s === 403, r.s);
  r = await RO('DELETE', `/booking-documents/${doc.id}`); t('documents: read_only_viewer cannot delete -> 403', r.s === 403, r.s);
  r = await A('DELETE', `/booking-documents/${doc.id}`); t('documents: delete works', r.s === 200, r.s);
  t('documents: a deleted file no longer opens (404) and its bytes are gone', (await fetch(B + `/booking-documents/${doc.id}/file`, { headers: { authorization: 'Bearer ' + tokA } })).status === 404 && psql(`select count(*) from booking_documents where id='${doc.id}' and file_data is not null`) === '0');
  r = await A('DELETE', `/booking-documents/${doc.id}`); t('documents: deleting twice -> 404', r.s === 404, r.s);
  await A('POST', `/booking/${d1.id}/cancel`, { reason: 'test' });
  r = await up(f, { buf: png, type: 'image/png', name: 'a.png' }); t('documents: upload to a cancelled booking -> 409', r.s === 409, r.s);
}

// ---------- random input: never a 500 ----------
{
  const junk = () => pick([null, '', ' ', 0, -1, 1e30, true, false, [], {}, [1], { a: 1 }, 'a'.repeat(ri(1, 300)), '<img src=x onerror=1>', "'; drop table booking_records;--", '\u0000', '‮', '9'.repeat(ri(1, 25)), 'NaN', '1e999', '2020-02-30', NIL, 'cash', 'cheque', 'percent']);
  const keys = ['consumer_id', 'unit_id', 'project_id', 'selected_plan_name', 'booking_date', 'booking_amount', 'payment_mode', 'payment_ref', 'bank_name', 'cheque_date', 'company_inaugural_disc', 'company_rebate_pct', 'broker_id', 'main_broker_id', 'broker_commission', 'broker_commission_type', 'booking_type', 'plc_amount', 'other_charge_amount', 'has_plc', 'form_no', 'remarks', 'basic_price', 'carpet_area_sqft', 'comm_pin', 'loan_amount', 'nominee_name', 'sales_employee_id', 'interest_amount', 'tds_challan_id'];
  let five = [], made2 = 0;
  for (let i = 0; i < 70; i++) {
    const body = { consumer_id: await person(), project_id: P1, unit_id: await unit(), selected_plan_name: PLAN, booking_date: today };
    for (let k = ri(1, 4); k > 0; k--) body[pick(keys)] = junk();
    const x = await A('POST', '/booking', body); if (x.s >= 500) five.push(['POST', JSON.stringify(body).slice(0, 160), x.s]);
    if (x.s === 201) { made2++; const id = x.j.data.id;
      const eb = {}; for (let k = ri(1, 3); k > 0; k--) eb[pick(keys.concat(['first_name', 'mobile', 'email', 'pan_no', 'dob', 'present_pin', 'annual_income']))] = junk();
      const y = await A('PATCH', `/booking/${id}/edit`, eb); if (y.s >= 500) five.push(['EDIT', JSON.stringify(eb).slice(0, 160), y.s]);
      const fb = {}; for (let k = ri(1, 4); k > 0; k--) fb[pick(keys)] = junk(); const z = await A('PATCH', `/booking/${id}`, fb); if (z.s >= 500) five.push(['COMPLETE', JSON.stringify(fb).slice(0, 160), z.s]);
      if (rnd() < 0.5) { const w = await A('POST', `/booking/${id}/cancel`, { reason: junk() }); if (w.s >= 500) five.push(['CANCEL', w.s]); } }
    if (i % 8 === 0) await new Promise(res => setTimeout(res, 40));
  }
  t(`random: 70 random starts (${made2} accepted) with random edits, confirmations and cancellations never gave a 500`, five.length === 0, JSON.stringify(five.slice(0, 3)));
  five = []; for (let i = 0; i < 50; i++) { const q = pick(['page', 'pageSize', 'project_id', 'consumer_id', 'status']) + '=' + encodeURIComponent(String(junk())); const x = await A('GET', '/booking?' + q); if (x.s >= 500) five.push([q, x.s]); if (i % 10 === 0) await new Promise(res => setTimeout(res, 40)); }
  t('random: 50 random list queries never gave a 500', five.length === 0, JSON.stringify(five.slice(0, 3)));
  five = []; for (let i = 0; i < 30; i++) { const id = pick([NIL, 'abc', done1.id]); const x = await A(pick(['PATCH', 'POST']), `/booking/${id}/${pick(['edit', 'cancel'])}`, { reason: junk(), remarks: junk(), booking_date: junk() }); if (x.s >= 500) five.push([id, x.s]); }
  t('random: 30 random edits / cancels on odd ids never gave a 500', five.length === 0, JSON.stringify(five.slice(0, 3)));
}

// ---------- the price quote: one server-side price, the same one the schedule bills (CRM-CALC-002, 006, 012) ----------
{
  const P4 = await mkProj('Q'), T4 = await tw(P4); const u4 = await unit(P4, T4, 100, 5000000); const plan4 = await plan(P4, 'PlanQ ' + U, [100]);
  const tax = async (code, pct) => (await A('POST', '/gst-configuration/gst-tax-setup', { slabId: slab, gstCode: `${code} ${U}`, type: 'INTRA', cgstPct: pct, sgstPct: pct })).j.data.id;
  const lowTax = await tax('QLOW', 0.5), midTax = await tax('QMID', 2.5);
  await A('POST', '/gst-configuration/gst-charge-mapping', { projectId: P4, slabId: slab, gstTaxId: lowTax, chargeType: 'BASIC' });
  for (const ct of ['PLC', 'OTHER CHARGE']) await A('POST', '/gst-configuration/gst-charge-mapping', { projectId: P4, slabId: slab, gstTaxId: midTax, chargeType: ct });
  const before = psql('select count(*) from booking_records');
  r = await A('POST', '/booking/quote', { unit_id: u4, basic_price: 500, plc_amount: 40000, booking_date: today });
  t('quote: 100 sq ft x 500 + PLC 40,000 -> 200', r.s === 200, r.s + JSON.stringify(r.j));
  const q = r.j?.data || {};
  t('quote: basic 50,000, agreement value 90,000', q.basic_inr === 50000 && q.agreement_value_inr === 90000, JSON.stringify(q));
  t('quote: GST per charge head: BASIC 250+250, PLC 1,000+1,000 (not one flat rate)', JSON.stringify((q.tax_lines || []).map(l => [l.charge_head, l.cgst, l.sgst])) === JSON.stringify([['BASIC', 250, 250], ['PLC', 1000, 1000]]), JSON.stringify(q.tax_lines));
  t('quote: total with GST is 92,500', q.gst_inr === 2500 && q.total_with_gst_inr === 92500, JSON.stringify([q.gst_inr, q.total_with_gst_inr]));
  t('quote: it saved nothing', psql('select count(*) from booking_records') === before);
  r2 = await A('POST', '/booking/quote', { unit_id: u4, basic_price: 500, plc_amount: 40000, company_inaugural_disc: 10000 });
  t('quote: a discount comes off the price, GST stays on the full price (as the demands bill it)', r2.s === 200 && r2.j.data.agreement_value_inr === 80000 && r2.j.data.gst_inr === 2500, JSON.stringify(r2.j));
  t('quote: the browser sees what the quote says: read_only_viewer can ask for it', (await RO('POST', '/booking/quote', { unit_id: u4, basic_price: 500 })).s === 200);
  for (const [n, body] of [['rate 0', { unit_id: u4, basic_price: 0 }], ['rate -5', { unit_id: u4, basic_price: -5 }], ['no rate', { unit_id: u4 }], ['discount above the basic price', { unit_id: u4, basic_price: 500, company_inaugural_disc: 60000 }]]) {
    r = await A('POST', '/booking/quote', body);
    t(`quote: ${n} -> 422 with {field, message}`, r.s === 422 && !!r.j?.field && !!r.j?.message, r.s + JSON.stringify(r.j));
  }
  t('quote: an unknown unit -> 404', (await A('POST', '/booking/quote', { unit_id: NIL, basic_price: 500 })).s === 404);
  // quote = what the schedule bills
  const c = await person(P4); const bk = await A('POST', '/booking', { consumer_id: c, project_id: P4, unit_id: u4, selected_plan_name: plan4, booking_date: today, basic_price: 500, carpet_area_sqft: 100, has_plc: true, plc_amount: 40000 });
  t('quote = schedule: booking started', bk.s === 201, bk.s + JSON.stringify(bk.j));
  r = await finish(bk.j.data.id, { booking_amount: 10000 }); t('quote = schedule: booking confirmed', r.s === 200, r.s + JSON.stringify(r.j));
  const sched = psql(`select coalesce(sum(amount_due_inr),0) || '|' || coalesce(sum(cgst_amount + sgst_amount),0) from demands where consumer_id='${c}'`).split('|').map(Number);
  t('quote = schedule: the demands add up to the quote (price 90,000 and GST 2,500)', sched[0] === q.agreement_value_inr && sched[1] === q.gst_inr, JSON.stringify([sched, q.agreement_value_inr, q.gst_inr]));
  // the GST inside a receipt amount, and the interest preview: both read-only
  r = await A('POST', '/payments/receipts/quote', { amount: 10100, project_id: P4, received_date: today });
  t('receipts quote: 10,100 at BASIC 0.5% + 0.5% inclusive -> taxable 10,000, CGST 50, SGST 50', r.s === 200 && r.j.data.taxable_inr === 10000 && r.j.data.cgst_inr === 50 && r.j.data.sgst_inr === 50, r.s + JSON.stringify(r.j));
  for (const [n, body] of [['amount 0', { amount: 0, project_id: P4 }], ['no project', { amount: 500 }]]) { r = await A('POST', '/payments/receipts/quote', body); t(`receipts quote: ${n} is refused (4xx)`, r.s >= 400 && r.s < 500, r.s + JSON.stringify(r.j)); }
  t('receipts quote: accounts_finance may ask; read_only_viewer keeps the payments rule (403)', (await AF('POST', '/payments/receipts/quote', { amount: 10100, project_id: P4 })).s === 200 && (await RO('POST', '/payments/receipts/quote', { amount: 10100, project_id: P4 })).s === 403);
  const dId = psql(`select id from demands where consumer_id='${c}' order by installment_index limit 1`);
  r = await A('GET', `/payments/interest/preview/${dId}`);
  t('interest preview: 200 with the formula, the rate and a number', r.s === 200 && /365/.test(r.j?.data?.formula || '') && typeof r.j.data.interest_inr === 'number' && typeof r.j.data.penal_rate_percent === 'number', r.s + JSON.stringify(r.j));
  t('interest preview: unknown demand -> 404', (await A('GET', `/payments/interest/preview/${NIL}`)).s === 404);
  t('interest preview: bad id -> 400', (await A('GET', '/payments/interest/preview/abc')).s === 400);
  // the payment screen's GST comes from the server and equals what the confirm step saved (never worked out in the browser)
  const bkId = bk.j.data.id;
  const saved = psql(`select cgst_amount || '|' || sgst_amount from booking_payment_taxes where booking_record_id='${bkId}'`).split('|').map(Number);
  r = await A('POST', `/booking/${bkId}/payment-quote`, { amount: 10000 });
  t('payment-quote: the GST on 10,000 equals what the confirm step saved', r.s === 200 && r.j.data.cgst_inr === saved[0] && r.j.data.sgst_inr === saved[1] && r.j.data.exempt === false, r.s + JSON.stringify([r.j, saved]));
  r2 = await A('POST', `/booking/${bkId}/payment-quote`, { amount: 10000, interest_amount: 5000, cgst_pct: 9, sgst_pct: 9 });
  t('payment-quote: interest and typed rates change nothing (GST is on the amount, at the server rate)', r2.s === 200 && r2.j.data.cgst_inr === r.j.data.cgst_inr && r2.j.data.cgst_pct === 0.5, r2.s + JSON.stringify(r2.j));
  r = await A('POST', `/booking/${bkId}/payment-quote`, { amount: 10100 });
  t('payment-quote: 10,100 -> taxable 10,000, CGST 50, SGST 50 (same as receipts quote)', r.s === 200 && r.j.data.taxable_inr === 10000 && r.j.data.cgst_inr === 50 && r.j.data.sgst_inr === 50, r.s + JSON.stringify(r.j));
  const nat = psql(`select coalesce(nationality,'') from consumers where id='${c}'`);
  psql(`update consumers set nationality='NRI' where id='${c}'`);
  r = await A('POST', `/booking/${bkId}/payment-quote`, { amount: 10100 });
  t('payment-quote: NRI buyer -> no GST', r.s === 200 && r.j.data.cgst_inr === 0 && r.j.data.sgst_inr === 0 && r.j.data.taxable_inr === 10100 && r.j.data.exempt === true, r.s + JSON.stringify(r.j));
  psql(`update consumers set nationality=${nat ? `'${nat}'` : 'null'} where id='${c}'`);
  for (const [n, body] of [['no amount', {}], ['negative', { amount: -5 }], ['text', { amount: 'abc' }]]) { r = await A('POST', `/booking/${bkId}/payment-quote`, body); t(`payment-quote: ${n} is refused (4xx)`, r.s >= 400 && r.s < 500, r.s + JSON.stringify(r.j)); }
  t('payment-quote: unknown booking -> 404, bad id -> 400', (await A('POST', `/booking/${NIL}/payment-quote`, { amount: 100 })).s === 404 && (await A('POST', '/booking/abc/payment-quote', { amount: 100 })).s === 400);
  t('payment-quote: nothing is saved (taxes row unchanged)', psql(`select cgst_amount || '|' || sgst_amount from booking_payment_taxes where booking_record_id='${bkId}'`).split('|').map(Number).join('|') === saved.join('|'), '');
  // agreement snapshot (flag agreement_snapshot_v1): off = nothing stored, on = version 1 stored once, immutable
  t('snapshot: flag off by default and a booking confirmed with it off has no snapshot', psql(`select value from global_settings where key='agreement_snapshot_v1'`) === 'off' && (await A('GET', `/booking/${bk.j.data.id}/agreement`)).s === 404);
  psql(`update global_settings set value='on' where key='agreement_snapshot_v1'`);
  try {
    const c2 = await person(P4), u5 = await unit(P4, T4, 100, 5000000);
    const bk2 = await A('POST', '/booking', { consumer_id: c2, project_id: P4, unit_id: u5, selected_plan_name: plan4, booking_date: today, basic_price: 500, carpet_area_sqft: 100, has_plc: true, plc_amount: 40000 });
    r = await finish(bk2.j.data.id, { booking_amount: 10000 }); t('snapshot: booking confirmed with the flag on', r.s === 200, r.s + JSON.stringify(r.j));
    r = await A('GET', `/booking/${bk2.j.data.id}/agreement`); const ag = r.j?.data || {};
    t('snapshot: version 1 is current: rate 500, basic 50,000, PLC 40,000, agreement 90,000, GST lines kept', r.s === 200 && ag.version === 1 && ag.is_current && Number(ag.rate_inr_sqft) === 500 && Number(ag.basic_inr) === 50000 && Number(ag.agreement_value_inr) === 90000 && ag.tax_lines.length === 2, r.s + JSON.stringify(r.j));
    t('snapshot: total_price_inr on the booking is filled from it', psql(`select total_price_inr from booking_records where id='${bk2.j.data.id}'`) === '90000.00' || psql(`select total_price_inr from booking_records where id='${bk2.j.data.id}'`) === '90000', psql(`select total_price_inr from booking_records where id='${bk2.j.data.id}'`));
    t('snapshot: it equals what the schedule billed', Number(psql(`select coalesce(sum(amount_due_inr),0) from demands where consumer_id='${c2}'`)) === Number(ag.agreement_value_inr));
    let blocked = 0; for (const sql of [`update booking_agreement set basic_inr = 1 where booking_id='${bk2.j.data.id}'`, `delete from booking_agreement where booking_id='${bk2.j.data.id}'`]) { try { psql(sql); } catch { blocked++; } }
    t('snapshot: rows cannot be changed or deleted', blocked === 2);
    r = await A('GET', '/booking/agreement-shadow'); const sh = (r.j?.data || []).find((x) => x.booking_id === bk2.j.data.id);
    t('shadow report: lists the booking; quote, schedule and snapshot all say 90,000 (difference 0)', r.s === 200 && sh && sh.quote_value_inr === 90000 && sh.plan_total_inr === 90000 && sh.snapshot_value_inr === 90000 && sh.difference_inr === 0, r.s + JSON.stringify(sh));
    r = await A('GET', '/booking/reconciliation');
    t('reconciliation: five read-only checks, each with a count; nothing here has a paid demand with a balance', r.s === 200 && Object.keys(r.j.counts).length === 5 && Object.values(r.j.counts).every((n) => Number.isInteger(n)) && r.j.data.demands_paid_with_balance_over_1.filter((x) => x.registration_no).every((x) => x.balance > 1), r.s + JSON.stringify(r.j?.counts));
    t('reconciliation: only finance may read it', (await RO('GET', '/booking/reconciliation')).s >= 401);
    t('shadow report: only finance may read it', (await RO('GET', '/booking/agreement-shadow')).s === 403 || (await RO('GET', '/booking/agreement-shadow')).s === 401);
  } finally { psql(`update global_settings set value='off' where key='agreement_snapshot_v1'`); }
}

// ---------- clean up ----------
if (madeSlab) for (const sql of [`delete from gst_tax_charge_mapping where slab_id='${slab}'`, `delete from gst_tax_setup where slab_id='${slab}'`, `delete from gst_slabs where id='${slab}'`]) { try { psql(sql); } catch {} }
{
  const ids = made.map(x => `'${x}'`).join(',');
  for (const sql of [
    `delete from booking_documents where consumer_id in (${ids})`, `delete from receipts where consumer_id in (${ids})`, `delete from demands where consumer_id in (${ids})`,
    `delete from financial_audit_logs where consumer_id in (${ids})`, `delete from payment_plans where consumer_id in (${ids})`, `delete from allocations where consumer_id in (${ids})`,
    `delete from broker_commissions where consumer_id in (${ids})`, `delete from booking_payment_taxes where booking_record_id in (select id from booking_records where consumer_id in (${ids}))`,
    `alter table booking_agreement disable trigger booking_agreement_immutable`, `delete from booking_agreement where booking_id in (select id from booking_records where consumer_id in (${ids}))`, `alter table booking_agreement enable trigger booking_agreement_immutable`,
    `delete from booking_records where consumer_id in (${ids})`, `delete from co_applicants where consumer_id in (${ids})`, `delete from consumers where id in (${ids})`,
    `delete from brokers where name like '% ${U}' or name like 'Brk ${U}'`,
  ]) { try { psql(sql); } catch (e) { /* leftovers are harmless, names carry the run id */ } }
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
