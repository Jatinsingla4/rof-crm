// Timely discount: the plan's % and the customer's own %, who earns it (an installment paid in full by its due date), and the credit note it raises.
// Run: PGHOST=.. BASE=http://localhost:3010/api node docs/set-projects-parity/api-test-timely-discount.mjs   (psql must reach the same database)
import { execFileSync } from 'node:child_process';
import { bizToday, bizDate } from '../_shared/business-date.mjs';
import { secondAdminToken } from '../_shared/second-admin.mjs';
const B = process.env.BASE || 'http://localhost:3010/api';
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300))); };
const call = (tok) => async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const login = async (e) => (await call()('POST', '/auth/login', { email: e, password: 'Test#Pass1234' })).j?.token;
const A = call(await login('super_admin@test.local')), RO = call(await login('read_only_viewer@test.local')), SE = call(await login('sales_executive@test.local')), NO = call();
const CK = call(await secondAdminToken(B, A));   // clears receipts: whoever recorded a receipt does not clear it
const psql = (sql) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' }).trim();
const U = Date.now().toString(36).slice(-5), NIL = '00000000-0000-0000-0000-000000000000', today = bizToday();
let seq = 0; const mob = () => '9' + String((Date.now() % 1e7) * 100 + ++seq + 100000000).slice(-9).padStart(9, '0');
const co = (await A('GET', '/companies')).j?.data?.[0]?.id || (await A('POST', '/companies', { name: `Co ${U}` })).j?.data?.id;
const mkProject = async (tag) => {
  const P = (await A('POST', '/projects', { name: `UC ${tag} ${U}`, reraNumber: `U${tag}-${U}`, tcpLicence: 'x', companyId: co })).j.data.id;
  const T = (await A('POST', `/projects/${P}/towers`, { towerName: 'T' + U })).j.data.id;
  let slab = (await A('GET', '/gst-configuration/gst-slabs')).j.data.find((x) => x.from_date <= today && x.to_date >= today)?.id;
  if (!slab) slab = (await A('POST', '/gst-configuration/gst-slabs', { fromDate: bizDate(Date.now() - 3 * 864e5), toDate: bizDate(Date.now() + 40 * 864e5) })).j.data.id;
  const taxId = (await A('POST', '/gst-configuration/gst-tax-setup', { slabId: slab, gstCode: `UC ${tag} ${U}`, type: 'INTRA', cgstPct: 2.5, sgstPct: 2.5 })).j.data.id;
  for (const ct of ['BASIC', 'PLC', 'OTHER CHARGE']) await A('POST', '/gst-configuration/gst-charge-mapping', { projectId: P, slabId: slab, gstTaxId: taxId, chargeType: ct });
  const r1 = (await A('POST', `/projects/${P}/plan-templates`, { plan_name: 'Plan ' + U, installment_name: 'Booking', installment_type: 'booking', percentage: 20, due_date_offset_days: 0, installment_index: 1 })).j.data.id;
  const r2 = (await A('POST', `/projects/${P}/plan-templates`, { plan_name: 'Plan ' + U, installment_name: 'Balance', installment_type: 'installment', percentage: 80, due_date_offset_days: 30, installment_index: 2 })).j.data.id;
  return { P, T, r1, r2 };
};

let un = 0;
const unit = async (X) => (await A('POST', '/units', { projectId: X.P, towerId: X.T, unitNumber: `D${++un}-${U}`, floor: 1, bhkType: '2BHK', carpetAreaSqft: 1000, superAreaSqft: 1200, basePriceInr: 5000000, totalPriceInr: 5000000 })).j.data.id;
const X = await mkProject('T');
const plan = 'Plan ' + U, hdr = (b, who = A, P = X.P) => who('PUT', `/projects/${P}/plans/header`, { plan_name: plan, ...b });
const person = async () => (await A('POST', '/consumers', { name: `TD Buyer ${++seq} ${U}`, mobile: mob(), project_id: X.P })).j.data.id;
const buyer = async () => { const c = await person(), u = await unit(X); const b = await A('POST', '/booking', { consumer_id: c, project_id: X.P, unit_id: u, selected_plan_name: plan, booking_date: today }); const f = await A('PATCH', `/booking/${b.j?.data?.id}`, { booking_amount: 10000, payment_mode: 'cash' }); if (f.s !== 200) throw new Error('book ' + JSON.stringify(f)); return { c, u }; };
const dem = (c, col) => psql(`select ${col} from demands where consumer_id = '${c}' and installment_index = 2`);
const total2 = (c) => Number(psql(`select amount_due_inr + coalesce(cgst_amount,0) + coalesce(sgst_amount,0) + coalesce(addon_charge_amount,0) + coalesce(addon_cgst_amount,0) + coalesce(addon_sgst_amount,0) from demands where consumer_id = '${c}' and installment_index = 2`));
const setDue = (c, offset) => psql(`update demands set due_date = current_date + (${offset}), status = 'raised' where consumer_id = '${c}' and installment_index = 2 returning 1`);
let rno = 0; const pay = (c, amount, date = today) => A('POST', '/payments/receipts', { consumerId: c, amountReceivedInr: amount, paymentMode: 'neft', referenceNumber: `TD${U}${++rno}`, paymentDate: date, installmentIndex: 2 });
// money counts once it is cleared: the transfer is received on `date` and cleared by the bank today
const clearAll = async (c) => { for (const id of psql(`select id from receipts where consumer_id = '${c}' and installment_index = 2 and status = 'pending'`).split('\n').filter(Boolean)) { await CK('PATCH', `/payments/receipts/${id}/approve`, {}); const x = await CK('PATCH', `/payments/receipts/${id}/clear`, { clearing_date: today }); if (x.s !== 200) throw new Error('clear ' + JSON.stringify(x)); } };
const run = (b = {}, who = A, P = X.P) => who('POST', `/projects/${P}/timely-discount/run`, b);
const tdList = async () => (await A('GET', `/projects/${X.P}/timely-discount`)).j;

// ---- the plan's own setting ----
let r = await hdr({ timely_discount: true }); t('plan: timely discount on without a % is 400', r.s === 400, r);
t('plan: a % of 0, 101, -1, text and 5 decimals is 400', (await hdr({ timely_discount: true, discount_pct: 0 })).s === 400 && (await hdr({ timely_discount: true, discount_pct: 101 })).s === 400 && (await hdr({ timely_discount: true, discount_pct: -1 })).s === 400 && (await hdr({ timely_discount: true, discount_pct: 'x' })).s === 400 && (await hdr({ timely_discount: true, discount_pct: 1.23456 })).s === 400);
t('plan: timely_discount must be true or false', (await hdr({ timely_discount: 'yes' })).s === 400 && (await hdr({ timely_discount: 1 })).s === 400);
r = await hdr({ timely_discount: true, discount_pct: 2.5 }); t('plan: 2.5% timely discount saved', r.s === 200 && r.j.data.timely_discount === true && r.j.data.discount_pct === 2.5, r);
r = await hdr({ plan_type: 'Flexi' }); t('plan: saving the type alone keeps the discount', r.s === 200 && r.j.data.timely_discount === true && r.j.data.discount_pct === 2.5, r);
r = await A('GET', `/projects/${X.P}/plans`); const pl = r.j.data.find((x) => x.plan_name === plan); t('plan: the plan list carries the discount', pl && pl.timely_discount === true && pl.discount_pct === 2.5, pl);
r = await A('POST', `/projects/${X.P}/plans/copy`, { from: plan, to: 'Copy ' + U }); const cp = ((await A('GET', `/projects/${X.P}/plans`)).j.data || []).find((x) => x.plan_name === 'Copy ' + U);
t('plan: a copy keeps the discount', r.s < 300 && cp && cp.timely_discount === true && cp.discount_pct === 2.5, cp);
t('plan: viewer and sales cannot change it, no login 401', (await hdr({ discount_pct: 3 }, RO)).s === 403 && (await hdr({ discount_pct: 3 }, SE)).s === 403 && (await hdr({ discount_pct: 3 }, NO)).s === 401);

// ---- customers ----
const B1 = await buyer(), B2 = await buyer(), B3 = await buyer(), B4 = await buyer(), B5 = await buyer();
let L = await tdList();
t('customers: the customers booked on the plan with the plan %', L.success && L.data.customers.length >= 5 && L.data.customers.find((x) => x.consumer_id === B1.c)?.plan_pct === 2.5 && L.data.customers.find((x) => x.consumer_id === B1.c)?.effective_pct === 2.5 && L.data.plans.some((x) => x.plan_name === plan), L);
const own = (c, b, who = A, P = X.P) => who('PUT', `/projects/${P}/timely-discount/customers/${c}`, b);
r = await own(B4.c, { discountPct: 0, note: 'no discount for him' }); t('customers: his own 0% is saved', r.s === 200 && r.j.data.discount_pct === 0, r);
r = await own(B5.c, { discountPct: 4 }); t('customers: his own 4% is saved', r.s === 200 && (await tdList()).data.customers.find((x) => x.consumer_id === B5.c).effective_pct === 4);
t('customers: 101, -1, text, 5 decimals, missing are 400', (await own(B5.c, { discountPct: 101 })).s === 400 && (await own(B5.c, { discountPct: -1 })).s === 400 && (await own(B5.c, { discountPct: 'x' })).s === 400 && (await own(B5.c, { discountPct: 1.23456 })).s === 400 && (await own(B5.c, {})).s === 400);
t('customers: a markup note is 400, a long note is 400', (await own(B5.c, { discountPct: 4, note: '<b>' })).s === 400 && (await own(B5.c, { discountPct: 4, note: 'n'.repeat(301) })).s === 400);
t('customers: a customer not booked in this project is 409, bad ids 400, unknown project 404', (await own(NIL, { discountPct: 1 })).s === 409 && (await own('zzz', { discountPct: 1 })).s === 400 && (await own(B5.c, { discountPct: 1 }, A, NIL)).s === 404);
t('customers: viewer and sales cannot set it, no login 401', (await own(B5.c, { discountPct: 1 }, RO)).s === 403 && (await own(B5.c, { discountPct: 1 }, SE)).s === 403 && (await own(B5.c, { discountPct: 1 }, NO)).s === 401);
r = await A('DELETE', `/projects/${X.P}/timely-discount/customers/${B5.c}`); t('customers: his own % can be removed, back to the plan 2.5', r.s === 200 && (await tdList()).data.customers.find((x) => x.consumer_id === B5.c).effective_pct === 2.5);
t('customers: removing it twice is 404', (await A('DELETE', `/projects/${X.P}/timely-discount/customers/${B5.c}`)).s === 404);

// ---- earning it ----
const base2 = Number(dem(B1.c, 'amount_due_inr')); t('set-up: the balance installment is 80% of 50,00,000', base2 === 4000000, base2);
for (const b of [B1, B2, B3, B4, B5]) setDue(b.c, 10);
r = await run(); t('run: nothing is paid yet, nothing is earned', r.s === 200 && r.j.data.issued === 0 && r.j.data.waiting === 0, r);
r = await pay(B1.c, total2(B1.c)); t('set-up: B1 pays the whole installment before its due date', r.s < 300, r);
r = await pay(B2.c, Math.round(total2(B2.c) / 2)); t('set-up: B2 pays half', r.s < 300, r);
r = await pay(B4.c, total2(B4.c)); t('set-up: B4 pays all but has his own 0%', r.s < 300, r);
r = await pay(B5.c, total2(B5.c)); t('set-up: B5 pays all', r.s < 300, r);
setDue(B3.c, -5); r = await pay(B3.c, total2(B3.c)); t('set-up: B3 pays all, but after the due date', r.s < 300, r);
t('set-up: nothing is earned while the money is only received, not cleared', (await run()).j.data.waiting === 0 && psql(`select count(*) from timely_discount_awards where project_id = '${X.P}'`) === '0');
await clearAll(B1.c);
t('clearing: the moment B1\'s transfer clears, the award is made by itself (waiting for an invoice)', psql(`select count(*) from timely_discount_awards where consumer_id = '${B1.c}' and status = 'waiting'`) === '1');
for (const b of [B2, B3, B4, B5]) await clearAll(b.c);
r = await run(); const want = Math.round(base2 * 2.5) / 100;
t('run: B1 and B5 earned 2.5% of 40,00,000 = 100000 each; no invoice yet, so they wait; B2 (half), B3 (late) and B4 (0%) earn nothing', r.s === 200 && r.j.data.waiting === 2 && r.j.data.issued === 0 && r.j.data.items.every((x) => x.amount === want && x.status === 'waiting'), r);
t('run: the awards are saved as waiting with the reason', psql(`select count(*) from timely_discount_awards where project_id = '${X.P}' and status = 'waiting' and note like 'No invoice%'`) === '2');
const mkInv = async (c) => { const x = await A('POST', '/payments/gst-invoices', { consumerId: c, baseAmount: base2, gstRate: 5, supplyType: 'intrastate', invoiceType: 'tax_invoice' }); psql(`update gst_invoices set installment_name = (select installment_name from plan_schedule_templates where project_id = '${X.P}' and plan_name = '${plan}' and installment_index = 2), payment_plan_id = (select id from payment_plans where consumer_id = '${c}' order by created_at desc limit 1) where id = '${x.j?.data?.id}' returning 1`); return x; };
r = await mkInv(B1.c); t('set-up: an invoice for the installment of B1', r.s < 300, r);
r = await run(); t('run: B1 now gets a credit note (issued), B5 still waits', r.s === 200 && r.j.data.issued === 1 && r.j.data.waiting === 1, r);
const note = psql(`select note_type || ':' || adjustment_amount::numeric(14,2) || ':' || status from credit_debit_notes where consumer_id = '${B1.c}' order by created_at desc limit 1`);
t('run: the credit note is 100000 on that invoice and a checker still approves it (pending)', note === 'credit:100000.00:pending', note);
r = await run(); t('run: running again changes nothing (B1 is done, B5 still waits)', r.s === 200 && r.j.data.issued === 0 && r.j.data.waiting === 1 && psql(`select count(*) from credit_debit_notes where consumer_id = '${B1.c}' and reason like 'Timely payment%'`) === '1', r);
await A('PUT', `/projects/${X.P}/settings`, { journal_auth_mode: 'Automatic' });
await mkInv(B5.c); r = await run({ consumerId: B5.c });
const note5 = psql(`select status || ':' || (approved_by is not null) from credit_debit_notes where consumer_id = '${B5.c}' order by created_at desc limit 1`);
t('run: with the project on Automatic journal authentication the credit note is issued at once', r.s === 200 && r.j.data.issued === 1 && note5 === 'issued:true', { s: r.s, note5 });
r = await A('PUT', `/projects/${X.P}/settings`, { journal_auth_mode: 'Manual' }); t('run: switching the project back to Manual really switches it', r.s === 200 && r.j.data.journal_auth_mode === 'Manual', r);
r = await A('GET', `/projects/${X.P}/timely-discount/awards`); t('awards: the list shows both awards with the credit note number', r.s === 200 && r.j.data.length === 2 && r.j.data.every((x) => x.status === 'issued' && x.note_number && x.discount_amount === want), r);
r = await A('GET', `/projects/${X.P}/timely-discount/awards?consumerId=${B1.c}`); t('awards: one customer', r.s === 200 && r.j.data.length === 1 && r.j.data[0].consumer_id === B1.c, r);
L = await tdList(); t('customers: the screen shows what each customer earned', L.data.customers.find((x) => x.consumer_id === B1.c).earned === want && L.data.customers.find((x) => x.consumer_id === B2.c).earned === 0, L.data.customers.map((x) => x.earned));
// a plan with the discount switched off gives nothing
await hdr({ timely_discount: false }); await pay(B2.c, total2(B2.c) - Math.round(total2(B2.c) / 2)); await clearAll(B2.c);
r = await run(); t('run: with timely discount off on the plan nothing is earned, even for a fully paid installment', r.s === 200 && r.j.data.issued === 0 && r.j.data.waiting === 0, r);
await hdr({ timely_discount: true, discount_pct: 2.5 }); r = await run();
t('run: switched on again, B2 (now fully paid before the due date) earns it and waits for an invoice', r.s === 200 && r.j.data.waiting === 1 && r.j.data.items[0].consumer_id === B2.c, r);
// guards
t('run: viewer and sales are refused, no login 401', (await run({}, RO)).s === 403 && (await run({}, SE)).s === 403 && (await run({}, NO)).s === 401);
t('run: unknown project 404, bad ids 400', (await run({}, A, NIL)).s === 404 && (await run({ consumerId: 'zzz' })).s === 400 && (await A('POST', '/projects/zzz/timely-discount/run', {})).s === 400);
t('awards and customers: unknown project 404, bad ids 400, no login 401', (await A('GET', `/projects/${NIL}/timely-discount`)).s === 404 && (await A('GET', `/projects/${X.P}/timely-discount/awards?consumerId=zzz`)).s === 400 && (await NO('GET', `/projects/${X.P}/timely-discount`)).s === 401);

console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
