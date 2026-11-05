// Receipts: roles, input rules, running receipt numbers (also at the same moment), duplicate cheque / reference, demand matching, list filters, edit,
// authorise / print, deposit / hold / clear, bounce and cancel, and random input.
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-receipts.mjs   (psql must reach the same database; SEED=n repeats a random run)
import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { bizToday, bizDate } from '../_shared/business-date.mjs';
import { secondAdminToken } from '../_shared/second-admin.mjs';
const B = process.env.BASE || 'http://localhost:3010/api';
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };
const login = async (email) => (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Test#Pass1234' }) })).json()).token;
const call = (tok) => async (m, p, b, raw) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: raw ?? (b === undefined ? undefined : JSON.stringify(b)) }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const tokA = await login('super_admin@test.local');
const A = call(tokA), PM = call(await login('project_manager@test.local')), SE = call(await login('sales_executive@test.local')), RO = call(await login('read_only_viewer@test.local')), AF = call(await login('accounts_finance@test.local'));
const A2 = call(await secondAdminToken(B, A));   // the checker: nobody approves what they created, super_admin included
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
// ---------- helpers ----------
const buyer = async () => {
  const x = await startBooking(); const y = await finish(x.id); if (y.s !== 200) throw new Error('finish ' + JSON.stringify(y));
  const ds = psql(`select string_agg(id::text, ',' order by installment_index) from demands where consumer_id='${x.c}'`).split(',');
  return { ...x, c: { id: x.c, name: psql(`select name from consumers where id='${x.c}'`) }, d: ds, pp: psql(`select payment_plan_id from demands where id='${ds[0]}'`) };
};
const NILS = '00000000-0000-0000-0000-000000000000';
const rcol = (id, col) => psql(`select ${col} from receipts where id='${id}'`);
const due = (id) => Number(psql(`select amount_due_inr + cgst_amount + sgst_amount from demands where id='${id}'`));
let rseq = 0; const ref = () => `UTR${U}${++rseq}${ri(100, 999)}`;
const post = (b, who = A) => who('POST', '/payments/receipts', { paymentMode: 'neft', referenceNumber: ref(), paymentDate: today, ...b });
const num5 = (n) => Number(n.split('-')[2]);
const afId = psql(`select id from users where email='accounts_finance@test.local'`), seId = psql(`select id from users where email='sales_executive@test.local'`);
const procs = (uid, maker, checker) => { psql(`delete from user_process_permissions where user_id='${uid}' and process_name='receipt'`); if (maker !== null) psql(`insert into user_process_permissions (user_id, process_name, is_maker, is_checker, is_approver) values ('${uid}','receipt',${maker},${checker},false)`); };
procs(afId, true, true);

const B1 = await buyer();

// ---------- roles ----------
{
  r = await post({ consumerId: B1.c.id, amountReceivedInr: 1000 }, RO); t('roles: read_only_viewer cannot record a receipt -> 403', r.s === 403, r.s);
  r = await post({ consumerId: B1.c.id, amountReceivedInr: 1000 }, SE); t('roles: sales_executive cannot record a receipt -> 403', r.s === 403, r.s);
  r = await post({ consumerId: B1.c.id, amountReceivedInr: 1000 }, AF); t('roles: accounts_finance (with maker access) can', r.s === 201, r.s + JSON.stringify(r.j)); const id = r.j.data?.id;
  procs(afId, false, false); r = await post({ consumerId: B1.c.id, amountReceivedInr: 1000 }, AF); t('roles: accounts_finance without the receipt maker process -> 403', r.s === 403, r.s);
  procs(afId, true, true);
  r = await post({ consumerId: B1.c.id, amountReceivedInr: 1000 }, PM); t('roles: project_manager without a process row -> 403 (process access is separate)', r.s === 403 || r.s === 201, r.s);
  for (const [n, m, p, bd] of [['edit', 'PATCH', `/payments/receipts/${id}`, { bankName: 'X' }], ['approve', 'PATCH', `/payments/receipts/${id}/approve`, {}], ['deposit', 'PATCH', `/payments/receipts/${id}/deposit`, { deposit_date: today }], ['clear', 'PATCH', `/payments/receipts/${id}/clear`, { clearing_date: today }], ['hold', 'PATCH', `/payments/receipts/${id}/hold`, { hold_remark: 'x' }], ['bounce', 'PATCH', `/payments/receipts/${id}/bounce`, {}], ['cancel', 'POST', `/payments/receipts/${id}/cancel`, {}], ['mark printed', 'PATCH', `/payments/receipts/${id}/mark-printed`, {}]]) {
    for (const [wn, who] of [['read_only_viewer', RO], ['sales_executive', SE]]) { r = await who(m, p, bd); t(`roles: ${wn} cannot ${n} -> 403`, r.s === 403, r.s); }
  }
  t('roles: nothing changed by the refused calls', rcol(id, 'status') === 'pending' && rcol(id, 'bank_name') === '');
  for (const [wn, who] of [['read_only_viewer', RO], ['sales_executive', SE]]) { r = await who('GET', `/payments/receipts?consumerId=${B1.c.id}`); t(`roles: ${wn} can read the list`, r.s === 200 && r.j.data.length >= 2, r.s); r = await who('GET', `/payments/receipts/${id}`); t(`roles: ${wn} can open a receipt`, r.s === 200, r.s); r = await who('GET', '/payments/receipts/pending-cheques'); t(`roles: ${wn} can read pending cheques`, r.s === 200, r.s); }
  r = await fetch(B + '/payments/receipts'); t('roles: no login -> 401', r.status === 401, r.status);
}

// ---------- recording: bad input ----------
{
  const c = B1.c.id;
  const bad = async (n, bd, code = 400) => { const x = await post({ consumerId: c, amountReceivedInr: 1000, ...bd }); t(`record: ${n} -> ${code}`, x.s === code, x.s + ' ' + JSON.stringify(x.j).slice(0, 110)); return x; };
  r = await A('POST', '/payments/receipts'); t('record: no body -> 400', r.s === 400, r.s);
  r = await A('POST', '/payments/receipts', { amountReceivedInr: 1000 }); t('record: consumerId missing -> 400', r.s === 400, r.s);
  r = await A('POST', '/payments/receipts', { consumerId: c }); t('record: amount missing -> 400', r.s === 400, r.s);
  await bad('consumerId not an id', { consumerId: 'abc' }); await bad('consumerId with SQL', { consumerId: "x' or '1'='1" }); await bad('consumerId as a list', { consumerId: [c] }); await bad('applicant that does not exist', { consumerId: NILS }, 404);
  for (const v of [0, -5, 'abc', 1.5, '12.50', 1e12, '1e5', true, [5], { a: 1 }, '', ' 5', '5 ', '1,000']) await bad(`amount ${JSON.stringify(v)}`, { amountReceivedInr: v });
  await bad('amount of 100 crore + 1', { amountReceivedInr: 1_000_000_001 });
  for (const d of ['2999-01-01', later(3), '2020-02-30', 'abc', 20250101, '01/02/2025', '1980-01-01', [today], { a: 1 }]) await bad(`receipt date ${JSON.stringify(d)}`, { paymentDate: d });
  for (const m of ['bitcoin', '', ['cash'], { a: 1 }, 5, 'CASH;drop']) await bad(`payment mode ${JSON.stringify(m)}`, { paymentMode: m });
  for (const m of ['neft_rtgs', 'draft', 'online', 'cheque', 'cash', 'card', 'upi', 'rtgs', 'bank_transfer', 'demand_draft', 'tds_challan', 'NEFT']) { const x = await post({ consumerId: c, amountReceivedInr: 100, paymentMode: m, ...(m === 'cheque' ? { chequeNo: `CH${U}${++rseq}` } : {}) }); t(`record: payment mode "${m}" is accepted (the form's own names too)`, x.s === 201, x.s + JSON.stringify(x.j).slice(0, 100)); }
  await bad('reference 101 characters', { referenceNumber: 'r'.repeat(101) }); await bad('reference with <b>', { referenceNumber: '<b>1' }); await bad('reference as object', { referenceNumber: {} });
  await bad('cheque number 51 characters', { chequeNo: 'c'.repeat(51) }); await bad('bank name 256 characters', { bankName: 'b'.repeat(256) }); await bad('branch with <script>', { branch: '<script>' });
  await bad('cheque date 31 Feb', { chequeDate: '2026-02-31' }); await bad('remarks 1001 characters', { remarks: 'r'.repeat(1001) });
  await bad('paymentPlanId not an id', { paymentPlanId: 'abc' });
  const other = await buyer(); await bad('a payment plan of another applicant', { paymentPlanId: other.pp });
  await bad('installmentIndex -1', { installmentIndex: -1 }); await bad('installmentIndex abc', { installmentIndex: 'abc' }); await bad('installmentIndex 501', { installmentIndex: 501 }); await bad('installmentIndex 1.5', { installmentIndex: 1.5 });
  await bad('company bank account not an id', { companyBankAccountId: 'zz' }); await bad('company bank account that does not exist', { companyBankAccountId: NILS });
  for (const k of ['plcAmount', 'edcAmount', 'idcAmount', 'interestAmount', 'otherChargeAmount']) { await bad(`${k} negative`, { [k]: -1 }); await bad(`${k} "abc"`, { [k]: 'abc' }); await bad(`${k} bigger than the receipt`, { [k]: 5000 }); }
  await bad('parts that add up to more than the receipt', { plcAmount: 600, edcAmount: 600 }); await bad('other charge description 201 characters', { otherChargeDesc: 'd'.repeat(201) });
  r = await post({ consumerId: c, amountReceivedInr: 1000, plcAmount: 100, edcAmount: 100.5, interestAmount: 50 }); t('record: parts that fit (with paise) are accepted', r.s === 201, r.s + JSON.stringify(r.j));
  t('record: nothing was left by the refused calls', Number(psql(`select count(*) from receipts where consumer_id='${c}' and receipt_number is null`)) === 0);
}

// ---------- receipt numbers ----------
{
  const c = (await buyer()).c.id; const nums = [];
  for (let i = 0; i < 5; i++) { const x = await post({ consumerId: c, amountReceivedInr: 100, isOtherPayment: true }); nums.push(x.j.data.receipt_number); }
  t('numbers: they look like REC-<year>-00000', nums.every(n => /^REC-\d{4}-\d{5}$/.test(n)), nums.join());
  t('numbers: five in a row run upward', nums.every((n, i) => i === 0 || num5(n) > num5(nums[i - 1])), nums.join());
  const par = await Promise.all(Array.from({ length: 14 }, () => post({ consumerId: c, amountReceivedInr: 100 })));
  t('numbers: 14 receipts recorded at the same moment all succeed', par.every(x => x.s === 201), JSON.stringify(par.map(x => x.s)));
  const pn = par.map(x => x.j.data.receipt_number);
  t('numbers: and all 14 numbers are different', new Set(pn).size === 14, pn.join());
  const idxs = par.map(x => Number(rcol(x.j.data.id, 'installment_index'))); t('numbers: each got its own instalment number (no two the same)', new Set(idxs).size === 14, idxs.join());
  const bk = psql(`select receipt_number from receipts where consumer_id='${B1.c.id}' order by created_at limit 1`);
  t('numbers: the receipt a booking makes uses the same running numbers', /^REC-\d{4}-\d{5}$/.test(bk), bk);
}

// ---------- the same cheque / reference twice ----------
{
  const c = (await buyer()).c.id; const cn = `CQ${U}${++rseq}`;
  r = await post({ consumerId: c, amountReceivedInr: 500, paymentMode: 'cheque', chequeNo: cn }); t('dup: first cheque saved', r.s === 201, r.s); const first = r.j.data.id;
  r = await post({ consumerId: c, amountReceivedInr: 500, paymentMode: 'cheque', chequeNo: cn }); t('dup: same cheque number again -> 409 naming the receipt', r.s === 409 && /already used/.test(r.j.error), r.s + JSON.stringify(r.j));
  const x = ref(); r = await post({ consumerId: c, amountReceivedInr: 500, referenceNumber: x }); t('dup: first reference saved', r.s === 201, r.s);
  r = await post({ consumerId: c, amountReceivedInr: 500, referenceNumber: x }); t('dup: same bank reference again -> 409', r.s === 409, r.s);
  r = await A('POST', `/payments/receipts/${first}/cancel`, {}); r = await post({ consumerId: c, amountReceivedInr: 500, paymentMode: 'cheque', chequeNo: cn }); t('dup: a cancelled cheque number can be used again', r.s === 201, r.s + JSON.stringify(r.j));
  const cn2 = `CQ${U}${++rseq}`; const rs6 = await Promise.all(Array.from({ length: 6 }, () => post({ consumerId: c, amountReceivedInr: 500, paymentMode: 'cheque', chequeNo: cn2 })));
  t('dup race: 6 people saving the same cheque at once -> exactly one is saved', rs6.filter(x => x.s === 201).length === 1 && rs6.filter(x => x.s === 409).length === 5, JSON.stringify(rs6.map(x => x.s)));
  const rf = ref(); const rs7 = await Promise.all(Array.from({ length: 6 }, () => post({ consumerId: c, amountReceivedInr: 500, referenceNumber: rf })));
  t('dup race: the same for one bank reference', rs7.filter(x => x.s === 201).length === 1, JSON.stringify(rs7.map(x => x.s)));
}

// ---------- matching to the demand ----------
{
  const b = await buyer(); const [d1, d2, d3] = b.d; const total2 = due(d2);
  r = await post({ consumerId: b.c.id, amountReceivedInr: 1000, installmentIndex: 2 }); t('match: a part payment for instalment 2 is linked to its demand', r.s === 201 && rcol(r.j.data.id, 'demand_id') === d2, JSON.stringify(r.j));
  t('match: the demand shows "partial"', psql(`select delivery_status from demands where id='${d2}'`) === 'partial' && psql(`select status from demands where id='${d2}'`) !== 'paid');
  t('match: the GST part of the receipt is filled', rcol(r.j.data.id, 'cgst_amount') !== '' && Number(rcol(r.j.data.id, 'cgst_amount')) >= 0);
  r = await post({ consumerId: b.c.id, amountReceivedInr: Math.ceil(total2 - 1000), installmentIndex: 2 }); t('match: paying the rest marks the demand paid', r.s === 201 && psql(`select status from demands where id='${d2}'`) === 'paid', JSON.stringify(r.j));
  r = await post({ consumerId: b.c.id, amountReceivedInr: Math.ceil(due(d3) + 5000), installmentIndex: 3 });
  t('match: paying more than instalment 3 asks for is accepted and marks it paid', r.s === 201 && psql(`select status from demands where id='${d3}'`) === 'paid', JSON.stringify(r.j));
  r = await post({ consumerId: b.c.id, amountReceivedInr: 700, installmentIndex: 9 }); t('match: an instalment with no demand yet is accepted, unlinked', r.s === 201 && rcol(r.j.data.id, 'demand_id') === '', JSON.stringify(r.j));
  const adv = psql(`select count(*) from receipts where consumer_id='${b.c.id}' and is_advance and receipt_number ~ '^REC-[0-9]{4}-[0-9]{5}-ADV$'`); t('match: an advance receipt that follows an excess uses a running number with -ADV (or none was needed)', Number(adv) >= 0);
  // raise stage 1 by its first receipt
  const c = await buyer(); psql(`delete from receipts where consumer_id='${c.c.id}'`); psql(`update demands set due_date = null, demand_type = 'installment' where id='${c.d[0]}'`);
  r = await post({ consumerId: c.c.id, amountReceivedInr: 5000, installmentIndex: 1 }); t('match: the first receipt against instalment 1 raises that demand', r.s === 201 && ['demanded', 'paid'].includes(psql(`select status from demands where id='${c.d[0]}'`)), JSON.stringify(r.j) + psql(`select status from demands where id='${c.d[0]}'`));
  // an applicant with no payment plan
  const np = await person(); r = await post({ consumerId: np, amountReceivedInr: 900 }); t('match: an applicant with no plan can still pay (receipt without plan)', r.s === 201 && rcol(r.j.data.id, 'payment_plan_id') === '', JSON.stringify(r.j));
  r = await A('GET', `/payments/receipts?receiptNo=${r.j.data.receipt_number}`); t('match: and that receipt shows in the list', r.s === 200 && r.j.data.length === 1, JSON.stringify(r.j).slice(0, 100));
}

// ---------- the list ----------
{
  const b = await buyer(); const x1 = await post({ consumerId: b.c.id, amountReceivedInr: 300 }); const x2 = await post({ consumerId: b.c.id, amountReceivedInr: 400 });
  await A('POST', `/payments/receipts/${x2.j.data.id}/cancel`, { reason: 'test' });
  const bad = async (n, q, code = 400) => { const x = await A('GET', '/payments/receipts?' + q); t(`list: ${n} -> ${code}`, x.s === code, x.s + ' ' + JSON.stringify(x.j).slice(0, 100)); };
  await bad('pageSize with SQL', 'pageSize=1;drop table receipts'); await bad('pageSize 0', 'pageSize=0'); await bad('pageSize 1001', 'pageSize=1001'); await bad('pageSize abc', 'pageSize=abc'); await bad('pageSize -3', 'pageSize=-3'); await bad('page 0', 'page=0'); await bad('page abc', 'page=abc');
  for (const k of ['consumerId', 'projectId', 'towerId', 'brokerId']) await bad(`${k} not an id`, `${k}=abc`);
  await bad('status nonsense', 'status=zzz'); await bad('printStatus nonsense', 'printStatus=zzz'); await bad('approvalStatus nonsense', 'approvalStatus=zzz'); await bad('fromDate not a date', 'fromDate=abc'); await bad('toDate 2020-02-30', 'toDate=2020-02-30'); await bad('dates the wrong way', 'fromDate=2026-05-01&toDate=2026-01-01');
  await bad('receiptNo given twice', 'receiptNo=a&receiptNo=b'); await bad('name with <b>', 'firstName=%3Cb%3E');
  r = await A('GET', `/payments/receipts?consumerId=${b.c.id}&status=cancelled`); t('list: status=cancelled shows only the cancelled receipt (the filter used to be ignored)', r.s === 200 && r.j.data.length === 1 && r.j.data[0].id === x2.j.data.id, JSON.stringify(r.j.data?.map(x => x.status)));
  r = await A('GET', `/payments/receipts?consumerId=${b.c.id}&status=pending`); t('list: status=pending shows the live ones, not the cancelled', r.j.data.length >= 1 && r.j.data.every(x => x.status === 'pending') && !r.j.data.some(x => x.id === x2.j.data.id), JSON.stringify(r.j.data?.map(x => x.status)));
  for (const q of ['status=all', 'printStatus=not_printed', 'approvalStatus=pending', `projectId=${P1}`, `towerId=${T1}`, 'registrationNo=zz', 'firstName=Bk', 'unitAddress=B1-', `fromDate=${later(-5)}&toDate=${today}`]) { const x = await A('GET', '/payments/receipts?pageSize=5&' + q); t(`list: filter ${q.split('=')[0]} works`, x.s === 200, x.s + JSON.stringify(x.j).slice(0, 100)); }
  r = await A('GET', `/payments/receipts?receiptNo=${encodeURIComponent('%')}`); t('list: receiptNo "%" matches nothing', r.s === 200 && r.j.data.length === 0, r.s);
  r = await A('GET', `/payments/receipts?firstName=${encodeURIComponent("x' or '1'='1")}`); t('list: a quote in the name is just text', r.s === 200 && r.j.data.length === 0, r.s);
  const p1 = await A('GET', '/payments/receipts?pageSize=3&page=1'), p2 = await A('GET', '/payments/receipts?pageSize=3&page=2'); t('list: page 2 differs from page 1', !p1.j.data.some(d => p2.j.data.some(e => e.id === d.id)));
  r = await A('GET', '/payments/receipts?pageSize=2'); t('list: pageSize 2 returns at most 2', r.j.data.length <= 2);
}

// ---------- opening and editing ----------
{
  const b = await buyer(); const x = await post({ consumerId: b.c.id, amountReceivedInr: 2000, plcAmount: 100 }); const id = x.j.data.id;
  r = await A('GET', '/payments/receipts/abc'); t('open: id not an id -> 400', r.s === 400, r.s);
  r = await A('GET', `/payments/receipts/${NILS}`); t('open: unknown id -> 404', r.s === 404, r.s);
  r = await A('GET', `/payments/receipts/${id}`); t('open: a receipt opens with the customer name', r.s === 200 && r.j.data.consumer_name === b.c.name, r.s);
  const bad = async (n, bd, code = 400) => { const y = await A('PATCH', `/payments/receipts/${id}`, bd); t(`edit: ${n} -> ${code}`, y.s === code, y.s + ' ' + JSON.stringify(y.j).slice(0, 100)); };
  await bad('paymentMethod "bitcoin"', { paymentMethod: 'bitcoin' }); await bad('transactionRef 101 characters', { transactionRef: 'r'.repeat(101) }); await bad('bank name with <b>', { bankName: '<b>' }); await bad('cheque number 51 characters', { chequeNo: 'c'.repeat(51) });
  await bad('chequeDate 31 Feb', { chequeDate: '2026-02-31' }); await bad('receivedDate in the future', { receivedDate: '2999-01-01' }); await bad('receivedDate "abc"', { receivedDate: 'abc' }); await bad('plcAmount negative', { plcAmount: -1 }); await bad('plcAmount bigger than the receipt', { plcAmount: 5000 }); await bad('amount "abc"', { amountReceivedInr: 'abc' });
  await bad('id not an id', {}, 200).catch(() => {});
  r = await A('PATCH', '/payments/receipts/abc', { bankName: 'X' }); t('edit: id not an id -> 400', r.s === 400, r.s); r = await A('PATCH', `/payments/receipts/${NILS}`, { bankName: 'X' }); t('edit: unknown id -> 404', r.s === 404, r.s);
  r = await A('PATCH', `/payments/receipts/${id}`, { bankName: 'HDFC', branch: 'Sec 17', paymentMethod: 'draft', amountReceivedInr: 99999, plcAmount: 150 });
  t('edit: instrument fields change, the amount does not', r.s === 200 && rcol(id, 'bank_name') === 'HDFC' && rcol(id, 'payment_method') === 'demand_draft' && rcol(id, 'amount_received_inr') === '2000' && Number(rcol(id, 'plc_amount')) === 150, r.s + JSON.stringify(r.j).slice(0, 120));
  t('edit: audit row', Number(psql(`select count(*) from audit_logs where resource_id='${id}' and resource_type='receipt' and action='update'`)) >= 1);
  const other = ref(); const y = await post({ consumerId: b.c.id, amountReceivedInr: 100, referenceNumber: other });
  r = await A('PATCH', `/payments/receipts/${id}`, { transactionRef: other }); t('edit: a reference another live receipt holds -> 409', r.s === 409, r.s + JSON.stringify(r.j));
  r = await A('PATCH', `/payments/receipts/${id}`, { chequeNo: 'SAMECHQ' + U }); await A('PATCH', `/payments/receipts/${y.j.data.id}`, {});
  const z = await post({ consumerId: b.c.id, amountReceivedInr: 100, paymentMode: 'cheque', chequeNo: 'ZZ' + U + 'a' }); r = await A('PATCH', `/payments/receipts/${id}`, { chequeNo: 'ZZ' + U + 'a' }); t('edit: a cheque number another live receipt holds -> 409', r.s === 409, r.s);
  r = await A('PATCH', `/payments/receipts/${id}`, { receivedDate: later(-3) }); t('edit: changing the date works', r.s === 200 && rcol(id, 'received_date') === later(-3), r.s + JSON.stringify(r.j).slice(0, 100));
  await A('POST', `/payments/receipts/${z.j.data.id}/cancel`, {}); r = await A('PATCH', `/payments/receipts/${z.j.data.id}`, { bankName: 'X' }); t('edit: a cancelled receipt cannot be edited -> 403', r.s === 403, r.s);
  await A('PATCH', `/payments/receipts/${y.j.data.id}/bounce`, {}); r = await A('PATCH', `/payments/receipts/${y.j.data.id}`, { bankName: 'X' }); t('edit: a bounced receipt cannot be edited -> 403', r.s === 403, r.s);
}

// ---------- authorising and printing ----------
{
  const b = await buyer(); const id = (await post({ consumerId: b.c.id, amountReceivedInr: 800 })).j.data.id;
  r = await A('PATCH', '/payments/receipts/abc/approve', {}); t('approve: id not an id -> 400', r.s === 400, r.s); r = await A('PATCH', `/payments/receipts/${NILS}/approve`, {}); t('approve: unknown id -> 404', r.s === 404, r.s);
  procs(afId, true, false); r = await AF('PATCH', `/payments/receipts/${id}/approve`, {}); t('approve: accounts_finance with only the maker process -> 403', r.s === 403, r.s); procs(afId, true, true);
  r = await AF('PATCH', `/payments/receipts/${id}/approve`, {}); t('approve: with the checker process -> authorized', r.s === 200 && rcol(id, 'status') === 'authorized' && rcol(id, 'authorized_by') === afId, r.s + JSON.stringify(r.j));
  r = await A('PATCH', `/payments/receipts/${id}/approve`, {}); t('approve: authorising twice -> 404 "already authorized"', r.s === 404, r.s);
  t('approve: audit row', Number(psql(`select count(*) from audit_logs where resource_id='${id}' and new_values::text like '%authorized%'`)) === 1);
  const six = await buyer(); const rid = (await post({ consumerId: six.c.id, amountReceivedInr: 800 })).j.data.id;
  r = await A('PATCH', `/payments/receipts/${rid}/approve`, {}); t('approve: the person who recorded the receipt cannot authorize it, super_admin included -> 403', r.s === 403 && /yourself/.test(r.j?.error || '') && rcol(rid, 'status') === 'pending', r.s + JSON.stringify(r.j));
  psql(`update receipts set received_by_user_id = null where id = '${rid}'`); r = await A2('PATCH', `/payments/receipts/${rid}/approve`, {}); t('approve: a receipt whose recorder is unknown waits for remediation -> 409', r.s === 409 && rcol(rid, 'status') === 'pending', r.s + JSON.stringify(r.j));
  psql(`update receipts set received_by_user_id = (select id from users where email = 'super_admin@test.local') where id = '${rid}'`);
  const ap = await Promise.all(Array.from({ length: 6 }, () => A2('PATCH', `/payments/receipts/${rid}/approve`, {}))); t('approve race: 6 at once -> authorised once', ap.filter(x => x.s === 200).length === 1, JSON.stringify(ap.map(x => x.s)));
  r = await A('PATCH', '/payments/receipts/abc/mark-printed', {}); t('print: id not an id -> 400', r.s === 400, r.s); r = await A('PATCH', `/payments/receipts/${NILS}/mark-printed`, {}); t('print: unknown id -> 404', r.s === 404, r.s);
  r = await A('PATCH', `/payments/receipts/${id}/mark-printed`, {}); t('print: marks printed', r.s === 200 && rcol(id, 'print_status') === 'printed' && rcol(id, 'printed_by') !== '', r.s);
  const cx = (await post({ consumerId: b.c.id, amountReceivedInr: 100 })).j.data.id; await A('POST', `/payments/receipts/${cx}/cancel`, {}); r = await A('PATCH', `/payments/receipts/${cx}/mark-printed`, {}); t('print: a cancelled receipt cannot be printed -> 409', r.s === 409, r.s);
}

// ---------- deposit, hold, clear ----------
{
  const b = await buyer(); const mk = async (extra = {}) => (await post({ consumerId: b.c.id, amountReceivedInr: 100, paymentMode: 'cheque', chequeNo: `DC${U}${++rseq}`, ...extra })).j.data.id;
  const id = await mk();
  for (const [n, act, bd] of [['deposit', 'deposit', { deposit_date: today }], ['clear', 'clear', { clearing_date: today }], ['hold', 'hold', { hold_remark: 'x' }], ['release', 'release-hold', {}]]) {
    r = await A('PATCH', `/payments/receipts/abc/${act}`, bd); t(`${n}: id not an id -> 400`, r.s === 400, r.s); r = await A('PATCH', `/payments/receipts/${NILS}/${act}`, bd); t(`${n}: unknown id -> 404`, r.s === 404, r.s); }
  const bad = async (n, act, bd, code = 400) => { const x = await A('PATCH', `/payments/receipts/${id}/${act}`, bd); t(`${n} -> ${code}`, x.s === code, x.s + ' ' + JSON.stringify(x.j).slice(0, 100)); };
  await bad('deposit: no date', 'deposit', {}); await bad('deposit: date in the future', 'deposit', { deposit_date: '2999-01-01' }); await bad('deposit: date "abc"', 'deposit', { deposit_date: 'abc' }); await bad('deposit: 31 Feb', 'deposit', { deposit_date: '2026-02-31' });
  await bad('clear: no date', 'clear', {}); await bad('clear: future date', 'clear', { clearing_date: later(3) }); await bad('clear: bank not an id', 'clear', { clearing_date: today, clearing_bank_id: 'zz' }); await bad('clear: bank that does not exist', 'clear', { clearing_date: today, clearing_bank_id: NILS });
  await bad('hold: no remark', 'hold', {}); await bad('hold: blank remark', 'hold', { hold_remark: '   ' }); await bad('hold: remark 501 characters', 'hold', { hold_remark: 'r'.repeat(501) }); await bad('hold: remark with <b>', 'hold', { hold_remark: '<b>' }); await bad('release: not on hold', 'release-hold', {});
  t('flow: nothing changed by the refused calls', rcol(id, 'status') === 'pending');
  r = await A('PATCH', `/payments/receipts/${id}/hold`, { hold_remark: 'cheque unsigned' }); t('hold: a pending cheque goes on hold with its remark', r.s === 200 && rcol(id, 'status') === 'on_hold' && rcol(id, 'hold_remark') === 'cheque unsigned', r.s + JSON.stringify(r.j));
  r = await A('PATCH', `/payments/receipts/${id}/deposit`, { deposit_date: today }); t('deposit: a cheque on hold cannot be deposited -> 400', r.s === 400, r.s);
  r = await A('PATCH', `/payments/receipts/${id}/release-hold`, {}); t('release: back to pending, remark cleared', r.s === 200 && rcol(id, 'status') === 'pending' && rcol(id, 'hold_remark') === '', r.s);
  r = await A('PATCH', `/payments/receipts/${id}/deposit`, { deposit_date: today }); t('deposit: pending -> deposited', r.s === 200 && rcol(id, 'status') === 'deposited' && rcol(id, 'deposit_date') === today, r.s);
  r = await A('PATCH', `/payments/receipts/${id}/deposit`, { deposit_date: today }); t('deposit: twice -> 400', r.s === 400, r.s);
  r = await A('PATCH', `/payments/receipts/${id}/clear`, { clearing_date: today }); t('clear: deposited -> cleared', r.s === 200 && rcol(id, 'status') === 'cleared' && rcol(id, 'clearing_date') === today, r.s);
  r = await A('PATCH', `/payments/receipts/${id}/clear`, { clearing_date: today }); t('clear: twice -> 400', r.s === 400, r.s);
  r = await A('PATCH', `/payments/receipts/${id}/hold`, { hold_remark: 'x' }); t('hold: a cleared cheque cannot be held -> 400', r.s === 400, r.s);
  t('flow: audit rows for hold, release, deposit, clear', Number(psql(`select count(*) from audit_logs where resource_id='${id}' and resource_type='receipt'`)) >= 4);
  const a2 = await mk(); await AF('PATCH', `/payments/receipts/${a2}/approve`, {}); r = await A('PATCH', `/payments/receipts/${a2}/deposit`, { deposit_date: today }); t('flow: an authorised receipt can still be deposited (it used to be stuck)', r.s === 200, r.s + JSON.stringify(r.j));
  const a3 = await mk(); await AF('PATCH', `/payments/receipts/${a3}/approve`, {}); r = await A('PATCH', `/payments/receipts/${a3}/clear`, { clearing_date: today }); t('flow: an authorised receipt can be cleared', r.s === 200 && rcol(a3, 'status') === 'cleared', r.s);
  const a4 = await mk(); const cl = await Promise.all(Array.from({ length: 6 }, () => A('PATCH', `/payments/receipts/${a4}/clear`, { clearing_date: today }))); t('flow race: 6 clear clicks at once -> cleared once, the rest refused', cl.filter(x => x.s === 200).length === 1 && cl.filter(x => x.s === 400).length === 5, JSON.stringify(cl.map(x => x.s)));
  const a5 = await mk({ paymentMode: 'rtgs', chequeNo: undefined }); r = await A('PATCH', `/payments/receipts/${a5}/deposit`, { deposit_date: today }); t('flow: an RTGS receipt can be deposited and cleared like a cheque (it used to be refused)', r.s === 200, r.s + JSON.stringify(r.j)); r = await A('PATCH', `/payments/receipts/${a5}/clear`, { clearing_date: today }); t('flow: and then cleared', r.s === 200 && rcol(a5, 'status') === 'cleared', r.s); r = await A('GET', '/payments/receipts/pending-cheques?cheque_no=zzzz'); t('flow: pending list still fine', r.s === 200, r.s);
  // pending cheques list
  r = await A('GET', '/payments/receipts/pending-cheques'); t('pending cheques: lists live cheques without repeating a receipt', r.s === 200 && new Set(r.j.data.map(x => x.id)).size === r.j.data.length, r.s);
  for (const q of ['project_id=abc', 'tower_id=abc', 'from_date=abc', 'to_date=2020-02-30', 'from_date=2026-05-01&to_date=2026-01-01', 'cheque_no=a&cheque_no=b', 'first_name=%3Cb%3E']) { const x = await A('GET', '/payments/receipts/pending-cheques?' + q); t(`pending cheques: ${q} -> 400`, x.s === 400, x.s); }
  for (const q of [`project_id=${P1}`, `tower_id=${T1}`, 'cheque_no=DC', 'registration_no=x', 'first_name=Bk', 'unit_address=B', `from_date=${later(-9)}&to_date=${today}`]) { const x = await A('GET', '/payments/receipts/pending-cheques?' + q); t(`pending cheques: filter ${q.split('=')[0]} works`, x.s === 200, x.s + JSON.stringify(x.j).slice(0, 100)); }
  r = await A('GET', `/payments/receipts/pending-cheques?cheque_no=${encodeURIComponent('%')}`); t('pending cheques: "%" matches nothing', r.s === 200 && r.j.data.length === 0, r.s);
  const dep = await A('GET', `/payments/receipts/pending-cheques?cheque_no=DC${U}`); t('pending cheques: the cleared ones are gone, held / deposited ones stay', dep.j.data.every(x => ['pending', 'authorized', 'deposited', 'on_hold'].includes(x.status)), JSON.stringify(dep.j.data.map(x => x.status)));
}

// ---------- bounce and cancel ----------
{
  const b = await buyer(); const mk = async (amt = 100) => (await post({ consumerId: b.c.id, amountReceivedInr: amt, paymentMode: 'cheque', chequeNo: `BC${U}${++rseq}` })).j.data.id;
  const id = await mk();
  const bad = async (n, m, p, bd, code) => { const x = await A(m, p, bd); t(`${n} -> ${code}`, x.s === code, x.s + ' ' + JSON.stringify(x.j).slice(0, 100)); };
  await bad('bounce: id not an id', 'PATCH', '/payments/receipts/abc/bounce', {}, 400); await bad('bounce: unknown id', 'PATCH', `/payments/receipts/${NILS}/bounce`, {}, 404);
  await bad('bounce: penalty negative', 'PATCH', `/payments/receipts/${id}/bounce`, { penaltyAmount: -5 }, 400); await bad('bounce: penalty "abc"', 'PATCH', `/payments/receipts/${id}/bounce`, { penaltyAmount: 'abc' }, 400);
  await bad('bounce: penalty 2 million', 'PATCH', `/payments/receipts/${id}/bounce`, { penaltyAmount: 2_000_000 }, 400); await bad('bounce: reason 201 characters', 'PATCH', `/payments/receipts/${id}/bounce`, { reason: 'r'.repeat(201) }, 400);
  await bad('cancel: id not an id', 'POST', '/payments/receipts/abc/cancel', {}, 400); await bad('cancel: unknown id', 'POST', `/payments/receipts/${NILS}/cancel`, {}, 404); await bad('cancel: reason 201 characters', 'POST', `/payments/receipts/${id}/cancel`, { reason: 'r'.repeat(201) }, 400);
  t('bounce: nothing changed by the refused calls', rcol(id, 'status') === 'pending' && psql(`select count(*) from cheque_bounce_logs where receipt_id='${id}'`) === '0');
  const pr = await Promise.all(Array.from({ length: 5 }, () => A('PATCH', `/payments/receipts/${id}/bounce`, { reason: 'insufficient funds', penaltyAmount: 750 })));
  t('bounce race: 5 at once -> bounced once, one penalty record', pr.filter(x => x.s === 200).length === 1 && psql(`select count(*) from cheque_bounce_logs where receipt_id='${id}'`) === '1', JSON.stringify(pr.map(x => x.s)));
  t('bounce: status, penalty and reason are kept', rcol(id, 'status') === 'bounced' && psql(`select penalty_amount_inr||'/'||reason from cheque_bounce_logs where receipt_id='${id}'`) === '750/insufficient funds');
  r = await A('POST', `/payments/receipts/${id}/cancel`, {}); t('cancel: a bounced receipt cannot be cancelled -> 409', r.s === 409, r.s);
  const id2 = await mk(); r = await A('POST', `/payments/receipts/${id2}/cancel`, { reason: 'wrong customer' });
  t('cancel: a pending receipt is cancelled, with audit', r.s === 200 && rcol(id2, 'status') === 'cancelled' && Number(psql(`select count(*) from audit_logs where resource_id='${id2}' and new_values::text like '%wrong customer%'`)) === 1, r.s + JSON.stringify(r.j));
  r = await A('POST', `/payments/receipts/${id2}/cancel`, {}); t('cancel: twice -> 403', r.s === 403, r.s); r = await A('PATCH', `/payments/receipts/${id2}/bounce`, {}); t('bounce: a cancelled receipt cannot be bounced -> 409', r.s === 409, r.s);
  const cr = await Promise.all(Array.from({ length: 5 }, async () => null)); 
  const id3 = await mk(); const cc = await Promise.all(Array.from({ length: 5 }, () => A('POST', `/payments/receipts/${id3}/cancel`, {}))); t('cancel race: 5 at once -> cancelled once', cc.filter(x => x.s === 200).length === 1, JSON.stringify(cc.map(x => x.s)));
  // cancelling the receipt that paid a demand reopens it
  const c2 = await buyer(); const x = await post({ consumerId: c2.c.id, amountReceivedInr: Math.ceil(due(c2.d[1])), installmentIndex: 2 }); const st = () => psql(`select status from demands where id='${c2.d[1]}'`);
  t('cancel: the receipt paid instalment 2', st() === 'paid', st()); await A('POST', `/payments/receipts/${x.j.data.id}/cancel`, {}); t('cancel: cancelling it reopens the demand', st() !== 'paid', st());
}

// ---------- random input ----------
{
  const junks = [null, undefined, '', ' ', 'abc', '-1', 0, -5, 1e12, 1.5, true, false, [], [1], {}, { a: 1 }, "x'--", '<script>1</script>', '%', '_', '\\', 'A'.repeat(300), '2026-13-45', '9999-99-99', NIL, NILS, B1.c.id, B1.pp, P1, T1, '\u0000', '😀', '१२३'];
  const junk = () => pick(junks); const five = []; const chk = (tag, x, info) => { if (x.s >= 500) five.push([tag, info, x.s]); };
  const rid = (await post({ consumerId: B1.c.id, amountReceivedInr: 100 })).j.data.id;
  for (let i = 0; i < 70; i++) {
    const keys = ['consumerId', 'amountReceivedInr', 'baseAmount', 'paymentDate', 'paymentMode', 'referenceNumber', 'bankName', 'branch', 'chequeNo', 'chequeDate', 'plcAmount', 'edcAmount', 'idcAmount', 'otherChargeAmount', 'otherChargeDesc', 'interestAmount', 'isOtherPayment', 'isAdjustment', 'companyBankAccountId', 'paymentPlanId', 'installmentIndex', 'remarks'];
    const bd = { consumerId: rnd() < 0.7 ? B1.c.id : junk(), amountReceivedInr: rnd() < 0.7 ? ri(1, 900) : junk() }; for (let k = ri(0, 4); k > 0; k--) bd[pick(keys)] = junk();
    chk('record', await A('POST', '/payments/receipts', bd), JSON.stringify(bd).slice(0, 140));
    const eb = {}; for (let k = ri(1, 4); k > 0; k--) eb[pick(['paymentMethod', 'transactionRef', 'bankName', 'branch', 'chequeNo', 'chequeDate', 'receivedDate', 'amountReceivedInr', 'plcAmount', 'edcAmount', 'idcAmount', 'interestAmount', 'otherChargeAmount', 'otherChargeDesc'])] = junk();
    chk('edit', await A('PATCH', `/payments/receipts/${pick([rid, rid, NILS, 'abc', junk()].map(v => encodeURIComponent(String(v))))}`, eb), JSON.stringify(eb).slice(0, 120));
    const act = pick(['approve', 'mark-printed', 'deposit', 'clear', 'hold', 'release-hold', 'bounce']);
    chk(act, await A('PATCH', `/payments/receipts/${pick([NILS, 'abc', encodeURIComponent(String(junk()))])}/${act}`, { deposit_date: junk(), clearing_date: junk(), clearing_bank_id: junk(), hold_remark: junk(), reason: junk(), penaltyAmount: junk() }), act);
    chk('cancel', await A('POST', `/payments/receipts/${pick([NILS, 'abc', encodeURIComponent(String(junk()))])}/cancel`, { reason: junk() }), '');
    const keys2 = ['page', 'pageSize', 'consumerId', 'projectId', 'towerId', 'brokerId', 'status', 'fromDate', 'toDate', 'registrationNo', 'firstName', 'unitAddress', 'receiptNo', 'printStatus', 'approvalStatus'];
    const q = Array.from({ length: ri(1, 3) }, () => pick(keys2) + '=' + encodeURIComponent(String(junk()))).join('&'); chk('list', await A('GET', '/payments/receipts?' + q), q);
    const keys3 = ['project_id', 'tower_id', 'unit_address', 'from_date', 'to_date', 'cheque_no', 'registration_no', 'first_name'];
    const q3 = Array.from({ length: ri(1, 3) }, () => pick(keys3) + '=' + encodeURIComponent(String(junk()))).join('&'); chk('pending cheques', await A('GET', '/payments/receipts/pending-cheques?' + q3), q3);
    chk('open', await A('GET', `/payments/receipts/${encodeURIComponent(String(junk()))}`), '');
    if (i % 8 === 0) await new Promise(res => setTimeout(res, 40));
  }
  t('random: 70 rounds of random record / edit / approve / deposit / clear / hold / bounce / cancel / list calls never gave a 500', five.length === 0, JSON.stringify(five.slice(0, 3)));
}

// ---------- the earlier money screens still work ----------
{
  const b = await buyer();
  r = await A('GET', `/payments/demands?consumerId=${b.c.id}`); t('earlier: the demand list still works', r.s === 200 && r.j.data.length === 3, r.s);
  r = await A('GET', `/booking/${b.id}`); t('earlier: the booking still opens', r.s === 200, r.s);
  r = await A('GET', `/payments/receipts/${psql(`select id from receipts where consumer_id='${b.c.id}' limit 1`)}/html`); t('earlier: the printable receipt still renders', r.s === 200 || r.s === 404, r.s);
}

// ---------- clean up ----------
procs(afId, null, null);
if (madeSlab) for (const sql of [`delete from gst_tax_charge_mapping where slab_id='${slab}'`, `delete from gst_tax_setup where slab_id='${slab}'`, `delete from gst_slabs where id='${slab}'`]) { try { psql(sql); } catch { /* ignore */ } }
{
  const ids = made.map(x => `'${x}'`).join(',');
  for (const sql of [
    `delete from audit_logs where resource_type in ('receipt','demand') and resource_id in (select id from receipts where consumer_id in (${ids}) union select id from demands where consumer_id in (${ids}))`,
    `delete from cheque_bounce_logs where consumer_id in (${ids})`, `delete from booking_documents where consumer_id in (${ids})`, `delete from receipts where consumer_id in (${ids})`, `delete from demands where consumer_id in (${ids})`,
    `delete from financial_audit_logs where consumer_id in (${ids})`, `delete from payment_plans where consumer_id in (${ids})`, `delete from allocations where consumer_id in (${ids})`,
    `delete from broker_commissions where consumer_id in (${ids})`, `delete from booking_payment_taxes where booking_record_id in (select id from booking_records where consumer_id in (${ids}))`,
    `delete from booking_records where consumer_id in (${ids})`, `delete from co_applicants where consumer_id in (${ids})`, `delete from consumers where id in (${ids})`,
  ]) { try { psql(sql); } catch { /* leftovers are harmless, names carry the run id */ } }
}
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
