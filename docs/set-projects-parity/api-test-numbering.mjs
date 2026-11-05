import { bizToday, bizDate } from '../_shared/business-date.mjs';
// Per-project numbering: receipt prefix and Automatic / Manual, registration prefix, size and Automatic / Manual. The settings route and the real numbers on bookings and receipts.
// Run: BASE=http://localhost:3010/api node docs/set-projects-parity/api-test-numbering.mjs
const B = process.env.BASE || 'http://localhost:3010/api';
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300))); };
const call = (tok) => async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const login = async (e) => (await call()('POST', '/auth/login', { email: e, password: 'Test#Pass1234' })).j?.token;
const A = call(await login('super_admin@test.local')), RO = call(await login('read_only_viewer@test.local')), SE = call(await login('sales_executive@test.local')), NO = call();
const U = Date.now().toString(36).slice(-5), NIL = '00000000-0000-0000-0000-000000000000', today = bizToday();
let seq = 0; const mob = () => '9' + String((Date.now() % 1e7) * 100 + ++seq + 100000000).slice(-9).padStart(9, '0');
const co = (await A('GET', '/companies')).j?.data?.[0]?.id || (await A('POST', '/companies', { name: `Co ${U}` })).j?.data?.id;
const mk = async (tag) => {
  const P = (await A('POST', '/projects', { name: `Num ${tag} ${U}`, reraNumber: `N${tag}-${U}`, tcpLicence: 'x', companyId: co })).j.data.id;
  const T = (await A('POST', `/projects/${P}/towers`, { towerName: 'T' + U })).j.data.id;
  let slab = (await A('GET', '/gst-configuration/gst-slabs')).j.data.find((x) => x.from_date <= today && x.to_date >= today)?.id;
  if (!slab) slab = (await A('POST', '/gst-configuration/gst-slabs', { fromDate: bizDate(Date.now() - 3 * 864e5), toDate: bizDate(Date.now() + 40 * 864e5) })).j.data.id;
  const taxId = (await A('POST', '/gst-configuration/gst-tax-setup', { slabId: slab, gstCode: `NM ${tag} ${U}`, type: 'INTRA', cgstPct: 2.5, sgstPct: 2.5 })).j.data.id;
  for (const ct of ['BASIC', 'PLC', 'OTHER CHARGE']) await A('POST', '/gst-configuration/gst-charge-mapping', { projectId: P, slabId: slab, gstTaxId: taxId, chargeType: ct });
  await A('POST', `/projects/${P}/plan-templates`, { plan_name: 'Plan ' + U, installment_name: 'Booking', installment_type: 'booking', percentage: 100, due_date_offset_days: 0, installment_index: 1 });
  return { P, T };
};
let un = 0;
const unit = async ({ P, T }) => (await A('POST', '/units', { projectId: P, towerId: T, unitNumber: `N${++un}-${U}`, floor: 1, bhkType: '2BHK', carpetAreaSqft: 1000, superAreaSqft: 1200, basePriceInr: 9000000, totalPriceInr: 9500000 })).j.data.id;
const person = async (P) => (await A('POST', '/consumers', { name: `Num Buyer ${++seq} ${U}`, mobile: mob(), project_id: P })).j.data.id;
const book = async (X, b = {}) => A('POST', '/booking', { consumer_id: await person(X.P), project_id: X.P, unit_id: await unit(X), selected_plan_name: 'Plan ' + U, booking_date: today, ...b });
const S = (P, b) => A('PUT', `/projects/${P}/settings`, b);

const X = await mk('A'), Y = await mk('B');
let r = await A('GET', `/projects/${X.P}/settings`);
t('settings: a project with none gets the old defaults', r.s === 200 && r.j.data.receipt_number_mode === 'Automatic' && r.j.data.registration_number_size === 4 && r.j.data.receipt_prefix === null, r);
r = await book(X); const regDefault = r.j?.data?.registration_no;
t('registration: default is <4 letters>-<year>-0001 style', r.s === 201 && /^[A-Z]{4}-\d{4}-\d{4}$/.test(regDefault), r);
r = await S(X.P, { registration_prefix: 'galleria', registration_number_size: 6, receipt_prefix: 'gal-r' });
t('settings: prefixes are saved in capitals, size 6', r.s === 200 && r.j.data.registration_prefix === 'GALLERIA' && r.j.data.receipt_prefix === 'GAL-R' && r.j.data.registration_number_size === 6, r);
r = await book(X); t('registration: uses the project prefix and 6 digits', r.s === 201 && /^GALLERIA-\d{4}-\d{6}$/.test(r.j.data.registration_no), r);
const c1 = await person(X.P);
r = await A('POST', '/payments/receipts', { consumerId: c1, amountReceivedInr: 1000, paymentMode: 'cash', paymentDate: today }); t('receipt: uses the project prefix', r.s === 201 && /^GAL-R-\d{4}-\d{5}$/.test(r.j.data.receipt_number), r);
const c2 = await person(Y.P);
r = await A('POST', '/payments/receipts', { consumerId: c2, amountReceivedInr: 1000, paymentMode: 'cash', paymentDate: today }); t('receipt: another project keeps REC', r.s === 201 && /^REC-\d{4}-\d{5}$/.test(r.j.data.receipt_number), r);
r = await S(X.P, { receipt_prefix: '' }); t('settings: a blank prefix goes back to REC', r.s === 200 && r.j.data.receipt_prefix === null, r);

// manual numbering
await S(X.P, { receipt_number_mode: 'Manual', registration_number_mode: 'Manual' });
r = await A('POST', '/payments/receipts', { consumerId: c1, amountReceivedInr: 500, paymentMode: 'cash', paymentDate: today }); t('receipt manual: without a number is 400', r.s === 400, r);
r = await A('POST', '/payments/receipts', { consumerId: c1, amountReceivedInr: 500, paymentMode: 'cash', paymentDate: today, receiptNumber: `M-${U}-1` }); t('receipt manual: the typed number is kept', r.s === 201 && r.j.data.receipt_number === `M-${U}-1`, r);
r = await A('POST', '/payments/receipts', { consumerId: c1, amountReceivedInr: 500, paymentMode: 'cash', paymentDate: today, receiptNumber: `m-${U}-1` }); t('receipt manual: the same number again (any case) is 409', r.s === 409, r);
r = await A('POST', '/payments/receipts', { consumerId: c1, amountReceivedInr: 500, paymentMode: 'cash', paymentDate: today, receiptNumber: '<b>' + 'x'.repeat(50) }); t('receipt manual: a 51 char number is 400', r.s === 400, r);
r = await A('POST', '/payments/receipts', { consumerId: c2, amountReceivedInr: 500, paymentMode: 'cash', paymentDate: today, receiptNumber: 'IGNORED-1' }); t('receipt: an Automatic project ignores a typed number', r.s === 201 && r.j.data.receipt_number !== 'IGNORED-1', r);
r = await book(X); t('registration manual: without a number is 400', r.s === 400, r);
r = await book(X, { registration_no: `MR-${U}-1` }); t('registration manual: the typed number is kept', r.s === 201 && r.j.data.registration_no === `MR-${U}-1`, r);
r = await book(X, { registration_no: `mr-${U}-1` }); t('registration manual: the same number again (any case) is 409', r.s === 409, r);
r = await book(Y, { registration_no: 'IGNORED-2' }); t('registration: an Automatic project ignores a typed number', r.s === 201 && r.j.data.registration_no !== 'IGNORED-2', r);

// the settings route
for (const [n, b] of [['unknown mode', { receipt_number_mode: 'Both' }], ['size 2', { registration_number_size: 2 }], ['size 9', { registration_number_size: 9 }], ['size 4.5', { registration_number_size: 4.5 }], ['prefix with a space', { receipt_prefix: 'A B' }], ['prefix 11 chars', { registration_prefix: 'ABCDEFGHIJK' }], ['prefix markup', { receipt_prefix: '<x>' }]]) t(`settings: ${n} is 400`, (await S(X.P, b)).s === 400, n);
t('settings: unknown project is 404, bad id 400', (await S(NIL, { receipt_prefix: 'A' })).s === 404 && (await S('zzz', {})).s === 400);
t('settings: viewer and sales cannot write, no login is 401', (await RO('PUT', `/projects/${X.P}/settings`, { receipt_prefix: 'Z' })).s === 403 && (await SE('PUT', `/projects/${X.P}/settings`, { receipt_prefix: 'Z' })).s === 403 && (await NO('GET', `/projects/${X.P}/settings`)).s === 401);
console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
