// Transfers: roles, input rules, what moves with a unit (plan, demands, receipts, booking), seller balance snapshot, chains, races, lists, fee master,
// date edits, the printable letter (escaped), and random input.
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-transfers.mjs   (psql must reach the same database; SEED=n repeats a random run)
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
const buyer = async (P = P1, T = T1) => {   // a seller: completed booking, so the unit, plan, demands and a booking receipt exist
  const c = await person(P); const u = await unit(P, T); const x = await book(c, u, P === P1 ? {} : { project_id: P, selected_plan_name: PLAN_B }); if (x.s !== 201) throw new Error('book ' + JSON.stringify(x));
  const y = await finish(x.j.data.id); if (y.s !== 200) throw new Error('finish ' + JSON.stringify(y));
  return { c, u, id: x.j.data.id };
};
const col = (tbl, id, c) => psql(`select ${c} from ${tbl} where id='${id}'`);
const own = (c) => psql(`select coalesce(allocated_unit_id::text,'') || '/' || lead_stage from consumers where id='${c}'`);
const xfer = (S, newC, extra = {}, who = A) => who('POST', '/transfers', { unitId: S.u, oldConsumerId: S.c, newConsumerId: newC, ...extra });
const pmId = psql(`select id from users where email='project_manager@test.local'`), afId = psql(`select id from users where email='accounts_finance@test.local'`);
const proc = (uid, on) => { psql(`delete from user_process_permissions where user_id='${uid}' and process_name='applicant_transfer'`); if (on) psql(`insert into user_process_permissions (user_id, process_name, is_maker, is_checker, is_approver) values ('${uid}','applicant_transfer',true,false,false)`); };
proc(pmId, false);
let tno = 0; const TN = () => `TR${U}${++tno}`;

// ---------- roles ----------
{
  const S = await buyer(), nb = await person();
  for (const [n, who] of [['read_only_viewer', RO], ['sales_executive', SE], ['accounts_finance', AF]]) { r = await xfer(S, nb, {}, who); t(`roles: ${n} cannot transfer a unit -> 403`, r.s === 403, r.s); }
  r = await xfer(S, nb, {}, PM); t('roles: project_manager without the transfer process -> 403', r.s === 403, r.s);
  t('roles: nothing moved by the refused calls', own(S.c).startsWith(S.u) && own(nb).startsWith('/'));
  proc(pmId, true); r = await xfer(S, nb, { transferNo: TN() }, PM); t('roles: project_manager with the transfer process can', r.s === 201, r.s + JSON.stringify(r.j)); proc(pmId, false);
  const tid = r.j.data?.id;
  for (const [n, who] of [['read_only_viewer', RO], ['sales_executive', SE], ['accounts_finance', AF]]) { r = await who('PATCH', `/transfers/${tid}`, { transfer_date: today }); t(`roles: ${n} cannot change a transfer date -> 403`, r.s === 403, r.s); }
  for (const [n, who] of [['read_only_viewer', RO], ['sales_executive', SE]]) { r = await who('POST', '/transfers/fee-master', { projectId: P1 }); t(`roles: ${n} cannot set the fee master -> 403`, r.s === 403, r.s); }
  r = await AF('POST', '/transfers/fee-master', { projectId: P1 }); t('roles: accounts_finance has no master-data edit, cannot set the fee master -> 403', r.s === 403, r.s);
  for (const [n, who] of [['read_only_viewer', RO], ['sales_executive', SE], ['accounts_finance', AF], ['project_manager', PM]]) {
    for (const p of ['/transfers/list', '/transfers/report', `/transfers/history/${S.u}`, `/transfers/unit-owner/${S.u}`, `/transfers/${tid}`, `/transfers/${tid}/letter`, `/transfers/fee-master?projectId=${P1}`]) { r = await who('GET', p); t(`roles: ${n} can read ${p.replace(/[0-9a-f-]{36}/g, ':id').replace(/\?.*/, '')}`, r.s === 200 || (r.s === 404 && /fee-master/.test(p)), r.s); }
  }
  r = await fetch(B + '/transfers/list'); t('roles: no login -> 401', r.status === 401, r.status);
}

// ---------- a transfer: bad input ----------
{
  const S = await buyer(), nb = await person(); const other = await buyer(); const nb2 = await person();
  const bad = async (n, bd, code = 400, S2 = S, nb_ = nb) => { const x = await xfer(S2, nb_, bd); t(`transfer: ${n} -> ${code}`, x.s === code, x.s + ' ' + JSON.stringify(x.j).slice(0, 110)); return x; };
  r = await A('POST', '/transfers'); t('transfer: no body -> 400', r.s === 400, r.s);
  r = await A('POST', '/transfers', { oldConsumerId: S.c, newConsumerId: nb }); t('transfer: unitId missing -> 400', r.s === 400, r.s);
  r = await A('POST', '/transfers', { unitId: S.u, newConsumerId: nb }); t('transfer: seller missing -> 400', r.s === 400, r.s);
  r = await A('POST', '/transfers', { unitId: S.u, oldConsumerId: S.c }); t('transfer: buyer missing -> 400', r.s === 400, r.s);
  for (const k of ['unitId', 'oldConsumerId', 'newConsumerId']) { r = await A('POST', '/transfers', { unitId: S.u, oldConsumerId: S.c, newConsumerId: nb, [k]: 'abc' }); t(`transfer: ${k} not an id -> 400`, r.s === 400, r.s); r = await A('POST', '/transfers', { unitId: S.u, oldConsumerId: S.c, newConsumerId: nb, [k]: [S.u] }); t(`transfer: ${k} as a list -> 400`, r.s === 400, r.s); }
  r = await A('POST', '/transfers', { unitId: S.u, oldConsumerId: S.c, newConsumerId: S.c }); t('transfer: seller and buyer the same person -> 400', r.s === 400, r.s);
  r = await A('POST', '/transfers', { unitId: NILS, oldConsumerId: S.c, newConsumerId: nb }); t('transfer: unit that does not exist -> 404', r.s === 404, r.s);
  r = await A('POST', '/transfers', { unitId: S.u, oldConsumerId: NILS, newConsumerId: nb }); t('transfer: seller that does not exist -> 404', r.s === 404, r.s);
  r = await A('POST', '/transfers', { unitId: S.u, oldConsumerId: S.c, newConsumerId: NILS }); t('transfer: buyer that does not exist -> 404', r.s === 404, r.s);
  r = await A('POST', '/transfers', { unitId: other.u, oldConsumerId: S.c, newConsumerId: nb }); t('transfer: seller who does not own that unit -> 400', r.s === 400, r.s);
  r = await A('POST', '/transfers', { unitId: S.u, oldConsumerId: nb, newConsumerId: nb2 }); t('transfer: an applicant with no unit as seller -> 400', r.s === 400, r.s);
  r = await A('POST', '/transfers', { unitId: S.u, oldConsumerId: S.c, newConsumerId: other.c }); t('transfer: a buyer who already owns another unit -> 409 (it used to overwrite their unit)', r.s === 409, r.s + JSON.stringify(r.j));
  t('transfer: the other owner still has their unit', own(other.c).startsWith(other.u));
  const nbP2 = await person(P2); r = await A('POST', '/transfers', { unitId: S.u, oldConsumerId: S.c, newConsumerId: nbP2 }); t('transfer: a buyer of another project -> 400', r.s === 400, r.s + JSON.stringify(r.j));
  for (const k of ['transferFee', 'adminCharges', 'transferAmountInr', 'staxAmount', 'cgstAmount', 'sgstAmount', 'igstAmount', 'ugstAmount', 'basicPrice']) for (const v of [-1, 'abc', 1e12, true, [5], '1e5']) await bad(`${k} ${JSON.stringify(v)}`, { [k]: v });
  for (const d of ['2999-01-01', later(3), '2020-02-30', 'abc', 20250101, '01/02/2025', '1980-01-01']) { await bad(`transferDate ${JSON.stringify(d)}`, { transferDate: d }); await bad(`applicationDate ${JSON.stringify(d)}`, { applicationDate: d }); }
  await bad('application date after the transfer date', { applicationDate: later(-1), transferDate: later(-5) });
  await bad('transferType "weird"', { transferType: 'weird' }); await bad('transferType as object', { transferType: {} });
  await bad('GSTIN "123"', { gstin: '123' }); await bad('transferNo 51 characters', { transferNo: 'n'.repeat(51) }); await bad('transferNo with <b>', { transferNo: '<b>' }); await bad('remarks 1001 characters', { remarks: 'r'.repeat(1001) }); await bad('remarks with <script>', { remarks: '<script>' });
  await bad('brokerCompany 151 characters', { brokerCompany: 'b'.repeat(151) }); await bad('salesPersonName with <b>', { salesPersonName: '<b>' }); await bad('transferReceiptNo 51 characters', { transferReceiptNo: 'r'.repeat(51) });
  t('transfer: nothing moved by all the refused calls', own(S.c).startsWith(S.u) && own(nb).startsWith('/') && psql(`select count(*) from ownership_transfers where unit_id='${S.u}'`) === '0');
  r = await xfer(S, nb, { transferNo: 'DUP' + U }); t('transfer: a transfer number is accepted once', r.s === 201, r.s + JSON.stringify(r.j));
  const S2 = await buyer(), nb3 = await person(); r = await xfer(S2, nb3, { transferNo: 'dup' + U }); t('transfer: the same number again (any case) -> 409', r.s === 409, r.s + JSON.stringify(r.j));
}

// ---------- a transfer: what moves ----------
{
  const S = await buyer(), nb = await person();
  const rc = await A('POST', '/payments/receipts', { consumerId: S.c, amountReceivedInr: 7000, paymentMode: 'neft', referenceNumber: 'TRX' + U + 'a', paymentDate: today, installmentIndex: 1 });
  const rc2 = await A('POST', '/payments/receipts', { consumerId: S.c, amountReceivedInr: 3000, paymentMode: 'neft', referenceNumber: 'TRX' + U + 'b', paymentDate: today, installmentIndex: 2 }); await A('POST', `/payments/receipts/${rc2.j.data.id}/cancel`, {});
  const plan = psql(`select id from payment_plans where consumer_id='${S.c}'`);
  const paid = Number(psql(`select coalesce(sum(amount_received_inr),0) from receipts where consumer_id='${S.c}' and status not in ('cancelled','bounced')`));
  const dueT = Number(psql(`select coalesce(sum(amount_due_inr + coalesce(cgst_amount,0) + coalesce(sgst_amount,0) + coalesce(addon_charge_amount,0) + coalesce(addon_cgst_amount,0) + coalesce(addon_sgst_amount,0)),0) from demands where consumer_id='${S.c}' and status<>'cancelled'`));
  const nRec = psql(`select count(*) from receipts where consumer_id='${S.c}'`), nDem = psql(`select count(*) from demands where consumer_id='${S.c}'`);
  r = await xfer(S, nb, { transferNo: TN(), transferFee: 2500.5, adminCharges: 500, transferAmountInr: 9500000, staxAmount: 309, cgstAmount: 12.25, transferDate: later(-2), applicationDate: later(-6), transferType: 'Company', gstin: '', remarks: 'Sold to relative', brokerCompany: 'Zen Realty', salesPersonName: 'Ravi' });
  t('move: the transfer is saved (201 with an id)', r.s === 201 && /^[0-9a-f-]{36}$/.test(r.j.data.id), r.s + JSON.stringify(r.j)); const tid = r.j.data?.id;
  t('move: seller no longer owns the unit and is "transferred"', own(S.c) === '/transferred', own(S.c));
  t('move: buyer owns the unit and is "allotted"', own(nb) === `${S.u}/allotted`, own(nb));
  t('move: the plan, all demands, all receipts and the booking went to the buyer', psql(`select consumer_id from payment_plans where id='${plan}'`) === nb && psql(`select count(*) from demands where consumer_id='${nb}'`) === nDem && psql(`select count(*) from receipts where consumer_id='${nb}'`) === nRec && psql(`select consumer_id from booking_records where id='${S.id}'`) === nb);
  t('move: the seller keeps none of them', psql(`select count(*) from demands where consumer_id='${S.c}'`) === '0' && psql(`select count(*) from receipts where consumer_id='${S.c}'`) === '0');
  t('move: old allocation is "transferred", a new "allotted" one exists for the buyer', psql(`select status from allocations where unit_id='${S.u}' and consumer_id='${S.c}'`).includes('transferred') && psql(`select count(*) from allocations where unit_id='${S.u}' and consumer_id='${nb}' and status='allotted'`) === '1');
  t('move: the seller\'s paid / due / balance were written down (cancelled receipt left out, GST in the due)', Number(col('ownership_transfers', tid, 'seller_total_paid_inr')) === paid && Math.abs(Number(col('ownership_transfers', tid, 'seller_total_due_inr')) - dueT) < 0.01 && Math.abs(Number(col('ownership_transfers', tid, 'seller_balance_inr')) - (dueT - paid)) < 0.01, `${col('ownership_transfers', tid, 'seller_total_paid_inr')}/${paid} ${col('ownership_transfers', tid, 'seller_total_due_inr')}/${dueT}`);
  t('move: transfer date, application date and fee (with paise) are kept as sent', col('ownership_transfers', tid, 'transfer_date') === later(-2) && col('ownership_transfers', tid, 'application_date') === later(-6) && Number(col('ownership_transfers', tid, 'transfer_fee_inr')) === 2500.5 && col('ownership_transfers', tid, 'transfer_type') === 'Company', JSON.stringify([col('ownership_transfers', tid, 'transfer_date'), col('ownership_transfers', tid, 'transfer_fee_inr')]));
  t('move: audit row for the transfer', Number(psql(`select count(*) from audit_logs where resource_id='${tid}' and resource_type='ownership_transfer'`)) === 1);
  r = await A('GET', `/transfers/unit-owner/${S.u}`); t('after: the unit\'s owner is now the buyer, transfer count 1', r.s === 200 && r.j.data.id === nb && r.j.data.transfer_count === 1, r.s + JSON.stringify(r.j).slice(0, 120));
  r = await A('GET', `/transfers/history/${S.u}`); t('after: history lists one transfer with both names', r.s === 200 && r.j.data.length === 1 && r.j.data[0].new_consumer_id === nb, r.s);
  r = await A('GET', `/transfers/list?search=${encodeURIComponent('Bk Buyer')}&pageSize=200`); t('after: the list finds it by name', r.s === 200 && r.j.data.some(x => x.id === tid) && r.j.total >= 1, r.s);
  { const reg = psql(`select registration_no from consumers where id='${S.c}'`) || psql(`select registration_no from booking_records where consumer_id='${nb}' limit 1`);
    r = await A('GET', `/transfers/list?projectId=${P1}&search=${encodeURIComponent(reg)}`); t('after: the list finds it by the seller\'s registration number', r.s === 200 && r.j.data.some(x => x.id === tid), r.s + ' ' + reg);
    r = await A('GET', `/transfers/list?projectId=${P1}&dateFrom=${later(-3)}&dateTo=${later(-1)}`); t('after: dateFrom/dateTo hold a transfer dated inside the range', r.s === 200 && r.j.data.some(x => x.id === tid), r.s);
    r = await A('GET', `/transfers/list?projectId=${P1}&dateFrom=${later(-30)}&dateTo=${later(-20)}`); t('after: dateFrom/dateTo leave out a transfer dated outside the range', r.s === 200 && !r.j.data.some(x => x.id === tid), r.s);
    r = await A('GET', `/transfers/list?dateFrom=${later(2)}&dateTo=${later(1)}`); t('after: a backwards date range -> 400', r.s === 400, r.s);
    r = await A('GET', '/transfers/list?dateFrom=junk'); t('after: a junk dateFrom -> 400', r.s === 400, r.s); }
  r = await A('GET', `/transfers/report?projectId=${P1}`); t('after: the report shows the unit with its current owner', r.s === 200 && r.j.data.some(x => x.consumer_id === nb && x.no_of_transfers === 1), r.s + JSON.stringify(r.j).slice(0, 100));
  r = await xfer(S, await person()); t('after: the old seller cannot transfer the unit again -> 400', r.s === 400, r.s);
  const third = await person(); r = await xfer({ u: S.u, c: nb }, third, { transferNo: TN() }); t('after: the buyer can pass it on (second transfer)', r.s === 201, r.s + JSON.stringify(r.j)); const tid2 = r.j.data?.id;
  r = await A('GET', `/transfers/${tid2}`); t('after: the second transfer is number 2 for the unit and carries the seller balance', r.s === 200 && r.j.data.transfer_sequence === 2 && r.j.data.seller_name && r.j.data.buyer_id === third, r.s + JSON.stringify(r.j).slice(0, 100));
  t('after: the demands followed to the third person', psql(`select count(*) from demands where consumer_id='${third}'`) === nDem);
  // letter and stored XSS
  psql(`update consumers set name='<img src=x onerror=alert(1)>Evil & Co' where id='${third}'`);
  r = await fetch(B + `/transfers/${tid2}/letter`, { headers: { authorization: 'Bearer ' + tokA } }); const html = await r.text();
  t('letter: renders for the transfer (200, HTML)', r.status === 200 && /text\/html/.test(r.headers.get('content-type')) && html.includes('Transfer'), r.status);
  t('letter: a name with HTML in it is escaped, not run', html.includes('&lt;img src=x onerror=alert(1)&gt;Evil &amp; Co') && !html.includes('<img src=x'), html.includes('<img src=x') ? 'RAW' : 'missing');
  // the seller list and the unit-owner no longer show a cancelled / transferred allocation
  const C = await buyer(); psql(`update allocations set status='cancelled' where consumer_id='${C.c}'`); r = await A('GET', `/transfers/unit-owner/${C.u}`); t('after: a unit whose allocation was cancelled (surrendered) has no owner -> 404', r.s === 404, r.s);
  psql(`update consumers set allocated_unit_id=null where id='${C.c}'`); r = await xfer(C, await person()); t('after: and a surrendered applicant cannot transfer it -> 400', r.s === 400, r.s);
}

// ---------- at the same moment ----------
{
  const S = await buyer(); const nbs = await Promise.all([person(), person(), person(), person()]);
  const rs1 = await Promise.all(nbs.map(n => xfer(S, n)));
  t('race: 4 transfers of one unit to 4 buyers at once -> exactly one is made', rs1.filter(x => x.s === 201).length === 1 && rs1.filter(x => x.s === 400).length === 3, JSON.stringify(rs1.map(x => x.s)));
  t('race: one transfer record and one new owner', psql(`select count(*) from ownership_transfers where unit_id='${S.u}'`) === '1' && psql(`select count(*) from consumers where allocated_unit_id='${S.u}'`) === '1');
  const sellers = await Promise.all([buyer(), buyer(), buyer()]); const one = await person();
  const rs2 = await Promise.all(sellers.map(s => xfer(s, one)));
  t('race: one buyer taking 3 units at once -> exactly one is made, the others refused', rs2.filter(x => x.s === 201).length === 1 && rs2.filter(x => x.s === 409).length === 2, JSON.stringify(rs2.map(x => x.s)));
  const S3 = await buyer(), nb = await person(); const rs3 = await Promise.all(Array.from({ length: 6 }, () => xfer(S3, nb)));
  t('race: the same transfer sent 6 times -> made once', rs3.filter(x => x.s === 201).length === 1 && psql(`select count(*) from ownership_transfers where unit_id='${S3.u}'`) === '1', JSON.stringify(rs3.map(x => x.s)));
  const S4 = await buyer(), n4 = await Promise.all([person(), person(), person()]); const tn = TN();
  const rs4 = await Promise.all(S4 && n4.map(async (n, i) => { const s = i === 0 ? S4 : await buyer(); return xfer(s, n, { transferNo: tn }); }));
  t('race: the same transfer number used by 3 transfers at once -> one wins', rs4.filter(x => x.s === 201).length === 1 && rs4.filter(x => x.s === 409).length === 2, JSON.stringify(rs4.map(x => x.s)));
}

// ---------- the lists ----------
{
  const bad = async (n, q, code = 400) => { const x = await A('GET', '/transfers/list?' + q); t(`list: ${n} -> ${code}`, x.s === code, x.s + ' ' + JSON.stringify(x.j).slice(0, 100)); };
  await bad('pageSize with SQL', 'pageSize=1;drop table ownership_transfers'); await bad('pageSize 0', 'pageSize=0'); await bad('pageSize 201', 'pageSize=201'); await bad('pageSize abc', 'pageSize=abc'); await bad('page 0', 'page=0'); await bad('page abc', 'page=abc');
  await bad('projectId not an id', 'projectId=abc'); await bad('search 101 characters', 'search=' + 'a'.repeat(101)); await bad('search given twice', 'search=a&search=b'); await bad('search with <b>', 'search=%3Cb%3E');
  for (const q of ['', `projectId=${P1}`, 'search=Bk', 'pageSize=5&page=2', 'pageSize=200']) { const x = await A('GET', '/transfers/list?' + q); t(`list: "${q}" works`, x.s === 200 && Array.isArray(x.j.data) && typeof x.j.total === 'number', x.s); }
  let x = await A('GET', `/transfers/list?search=${encodeURIComponent('%')}`); t('list: search "%" matches nothing', x.s === 200 && x.j.data.length === 0, x.s);
  x = await A('GET', `/transfers/list?search=${encodeURIComponent("x' or '1'='1")}`); t('list: a quote in the search is just text', x.s === 200 && x.j.data.length === 0, x.s);
  const p1 = await A('GET', '/transfers/list?pageSize=3&page=1'), p2 = await A('GET', '/transfers/list?pageSize=3&page=2'); t('list: page 2 differs from page 1', !p1.j.data.some(d => p2.j.data.some(e => e.id === d.id)));
  for (const [n, q] of [['projectId not an id', 'projectId=abc'], ['registrationNo given twice', 'registrationNo=a&registrationNo=b'], ['firstName with <b>', 'firstName=%3Cb%3E'], ['unitAddress 101 characters', 'unitAddress=' + 'u'.repeat(101)]]) { x = await A('GET', '/transfers/report?' + q); t(`report: ${n} -> 400`, x.s === 400, x.s); }
  for (const q of ['', `projectId=${P1}`, 'registrationNo=zz', 'firstName=Bk', 'unitAddress=B']) { x = await A('GET', '/transfers/report?' + q); t(`report: "${q}" works`, x.s === 200, x.s); }
  x = await A('GET', `/transfers/report?firstName=${encodeURIComponent('%')}`); t('report: "%" matches nothing', x.s === 200 && x.j.data.length === 0, x.s);
  for (const [n, p] of [['history', '/transfers/history/'], ['unit owner', '/transfers/unit-owner/'], ['detail', '/transfers/'], ['letter', '/transfers/']]) {
    const suffix = n === 'letter' ? '/letter' : ''; x = await A('GET', p + 'abc' + suffix); t(`${n}: id not an id -> 400`, x.s === 400, x.s); x = await A('GET', p + NILS + suffix); t(`${n}: unknown id -> ${n === 'history' ? '200 empty' : '404'}`, n === 'history' ? x.s === 200 && x.j.data.length === 0 : x.s === 404, x.s); }
}

// ---------- fee master ----------
{
  const P4 = await mkProj('F');
  let x = await A('GET', '/transfers/fee-master'); t('fee master: projectId missing -> 400', x.s === 400, x.s);
  x = await A('GET', '/transfers/fee-master?projectId=abc'); t('fee master: projectId not an id -> 400', x.s === 400, x.s);
  x = await A('GET', '/transfers/fee-master?projectId=' + P4); t('fee master: a project with no fee set -> 404', x.s === 404, x.s);
  const bad = async (n, bd, code = 400) => { const y = await A('POST', '/transfers/fee-master', { projectId: P4, ...bd }); t(`fee master: ${n} -> ${code}`, y.s === code, y.s + ' ' + JSON.stringify(y.j).slice(0, 100)); };
  x = await A('POST', '/transfers/fee-master'); t('fee master: no body -> 400', x.s === 400, x.s); x = await A('POST', '/transfers/fee-master', { projectId: 'abc' }); t('fee master: projectId not an id -> 400', x.s === 400, x.s); x = await A('POST', '/transfers/fee-master', { projectId: NILS }); t('fee master: unknown project -> 404', x.s === 404, x.s);
  for (const k of ['transferFeeInr', 'adminChargesInr']) for (const v of [-1, 'abc', 1e12, true, [1]]) await bad(`${k} ${JSON.stringify(v)}`, { [k]: v });
  for (const k of ['cgstPct', 'sgstPct', 'igstPct', 'ugstPct', 'servicetaxPct']) for (const v of [-1, 101, 'abc', true, 12.34567]) await bad(`${k} ${JSON.stringify(v)}`, { [k]: v });
  await bad('isFoc "yes"', { isFoc: 'yes' }); await bad('effectiveFrom 31 Feb', { effectiveFrom: '2026-02-31' }); await bad('effectiveFrom "abc"', { effectiveFrom: 'abc' });
  t('fee master: nothing saved by the refused calls', (await A('GET', '/transfers/fee-master?projectId=' + P4)).s === 404);
  x = await PM('POST', '/transfers/fee-master', { projectId: P4, transferFeeInr: 5000.5, adminChargesInr: 250, cgstPct: 9, sgstPct: 9, isFoc: false, effectiveFrom: today }); t('fee master: project_manager (master-data edit) can set it', x.s === 200 && Number(x.j.data.transfer_fee_inr) === 5000.5, x.s + JSON.stringify(x.j).slice(0, 100));
  x = await A('POST', '/transfers/fee-master', { projectId: P4, transferFeeInr: 6000, isFoc: true }); t('fee master: set again replaces it', x.s === 200 && Number(x.j.data.transfer_fee_inr) === 6000 && x.j.data.is_foc === true && Number(x.j.data.cgst_pct) === 0, x.s + JSON.stringify(x.j).slice(0, 100));
  x = await A('GET', '/transfers/fee-master?projectId=' + P4); t('fee master: reads back', x.s === 200 && Number(x.j.data.transfer_fee_inr) === 6000, x.s);
  t('fee master: audit rows (create, then update)', Number(psql(`select count(*) from audit_logs where resource_type='transfer_fee_master' and resource_id='${x.j.data.id}'`)) === 2);
  const rs5 = await Promise.all(Array.from({ length: 6 }, (_, i) => A('POST', '/transfers/fee-master', { projectId: P4, transferFeeInr: 100 + i }))); t('fee master: 6 saves at once -> all fine, one row', rs5.every(y => y.s === 200) && psql(`select count(*) from transfer_fee_master where project_id='${P4}'`) === '1', JSON.stringify(rs5.map(y => y.s)));
  psql(`delete from transfer_fee_master where project_id='${P4}'`);
}

// ---------- changing the dates ----------
{
  const S = await buyer(), nb = await person(); r = await xfer(S, nb, { transferDate: later(-4), applicationDate: later(-8) }); const tid = r.j.data.id;
  const bad = async (n, bd, code = 400, id = tid) => { const x = await A('PATCH', `/transfers/${id}`, bd); t(`dates: ${n} -> ${code}`, x.s === code, x.s + ' ' + JSON.stringify(x.j).slice(0, 100)); };
  await bad('no body', undefined); await bad('empty body', {}); await bad('id not an id', { transfer_date: today }, 400, 'abc'); await bad('unknown id', { transfer_date: today }, 404, NILS);
  await bad('transfer_date empty', { transfer_date: '' }); await bad('transfer_date null', { transfer_date: null }); await bad('transfer_date in the future', { transfer_date: '2999-01-01' }); await bad('transfer_date 31 Feb', { transfer_date: '2026-02-31' }); await bad('transfer_date as a list', { transfer_date: [today] }); await bad('transfer_date as a number', { transfer_date: 20260101 });
  await bad('application_date in the future', { application_date: later(5) }); await bad('application_date after the transfer date', { application_date: later(-1) }); await bad('transfer_date before the application date', { transfer_date: later(-10) });
  t('dates: nothing changed by the refused calls', col('ownership_transfers', tid, 'transfer_date') === later(-4) && col('ownership_transfers', tid, 'application_date') === later(-8));
  r = await A('PATCH', `/transfers/${tid}`, { transfer_date: later(-3) }); t('dates: changing only the transfer date keeps the application date (it used to be wiped)', r.s === 200 && col('ownership_transfers', tid, 'transfer_date') === later(-3) && col('ownership_transfers', tid, 'application_date') === later(-8), r.s + JSON.stringify(r.j));
  r = await A('PATCH', `/transfers/${tid}`, { application_date: later(-7) }); t('dates: changing only the application date keeps the transfer date', r.s === 200 && col('ownership_transfers', tid, 'transfer_date') === later(-3) && col('ownership_transfers', tid, 'application_date') === later(-7));
  r = await A('PATCH', `/transfers/${tid}`, { application_date: null }); t('dates: the application date can be cleared with null', r.s === 200 && col('ownership_transfers', tid, 'application_date') === '', r.s);
  t('dates: audit rows for the 3 changes', Number(psql(`select count(*) from audit_logs where resource_id='${tid}' and action='update'`)) === 3);
  const ps = await Promise.all(Array.from({ length: 6 }, (_, i) => A('PATCH', `/transfers/${tid}`, { transfer_date: later(-i) }))); t('dates: 6 edits at once all succeed, one value wins', ps.every(x => x.s === 200), JSON.stringify(ps.map(x => x.s)));
}

// ---------- random input ----------
{
  const junks = [null, undefined, '', ' ', 'abc', '-1', 0, -5, 1e12, 1.5, true, false, [], [1], {}, { a: 1 }, "x'--", '<script>1</script>', '%', '_', '\\', 'A'.repeat(300), '2026-13-45', '9999-99-99', NIL, NILS, '\u0000', '😀', '१२३'];
  const junk = () => pick(junks); const five = []; const chk = (tag, x, info) => { if (x.s >= 500) five.push([tag, info, x.s]); };
  const S = await buyer(); const nb = await person();
  for (let i = 0; i < 70; i++) {
    const keys = ['unitId', 'oldConsumerId', 'newConsumerId', 'transferFee', 'adminCharges', 'remarks', 'transferNo', 'applicationDate', 'transferDate', 'transferType', 'transferAmountInr', 'staxAmount', 'cgstAmount', 'sgstAmount', 'igstAmount', 'ugstAmount', 'basicPrice', 'gstin', 'brokerCompany', 'mainBroker', 'salesPersonName', 'transferReceiptNo'];
    const bd = { unitId: rnd() < 0.5 ? S.u : junk(), oldConsumerId: rnd() < 0.5 ? S.c : junk(), newConsumerId: rnd() < 0.5 ? nb : junk() }; for (let k = ri(0, 4); k > 0; k--) bd[pick(keys)] = junk();
    if (bd.unitId === S.u && bd.oldConsumerId === S.c && bd.newConsumerId === nb && Object.keys(bd).length === 3) bd.transferFee = 'x';   // keep the real one for the end
    chk('transfer', await A('POST', '/transfers', bd), JSON.stringify(bd).slice(0, 150));
    const q = Array.from({ length: ri(1, 3) }, () => pick(['page', 'pageSize', 'projectId', 'search']) + '=' + encodeURIComponent(String(junk()))).join('&'); chk('list', await A('GET', '/transfers/list?' + q), q);
    const q2 = Array.from({ length: ri(1, 3) }, () => pick(['projectId', 'registrationNo', 'firstName', 'unitAddress']) + '=' + encodeURIComponent(String(junk()))).join('&'); chk('report', await A('GET', '/transfers/report?' + q2), q2);
    const id = encodeURIComponent(String(pick([NILS, 'abc', junk(), S.u])));
    chk('detail', await A('GET', `/transfers/${id}`), id); chk('letter', await A('GET', `/transfers/${id}/letter`), id); chk('history', await A('GET', `/transfers/history/${id}`), id); chk('owner', await A('GET', `/transfers/unit-owner/${id}`), id);
    const eb = {}; for (let k = ri(0, 3); k > 0; k--) eb[pick(['transfer_date', 'application_date'])] = junk(); chk('dates', await A('PATCH', `/transfers/${id}`, eb), JSON.stringify(eb));
    const fb = {}; for (let k = ri(0, 4); k > 0; k--) fb[pick(['projectId', 'transferFeeInr', 'adminChargesInr', 'cgstPct', 'sgstPct', 'igstPct', 'ugstPct', 'servicetaxPct', 'isFoc', 'effectiveFrom'])] = pick([junk(), P1]); chk('fee master', await A('POST', '/transfers/fee-master', fb), JSON.stringify(fb).slice(0, 120));
    chk('fee master get', await A('GET', `/transfers/fee-master?projectId=${id}`), id);
    if (i % 8 === 0) await new Promise(res => setTimeout(res, 40));
  }
  t('random: 70 rounds of random transfers, lists, reports, letters, date edits and fee settings never gave a 500', five.length === 0, JSON.stringify(five.slice(0, 3)));
  t('random: whatever the junk did, the data is consistent (the unit is with the seller, or moved exactly once)', own(S.c).startsWith(S.u) ? psql(`select count(*) from ownership_transfers where unit_id='${S.u}'`) === '0' : psql(`select count(*) from ownership_transfers where unit_id='${S.u}'`) === '1' && own(nb).startsWith(S.u));
  psql(`delete from transfer_fee_master where project_id='${P1}'`);
}

// ---------- the earlier screens still work after a transfer ----------
{
  const S = await buyer(), nb = await person(); await xfer(S, nb);
  r = await A('GET', `/payments/demands?consumerId=${nb}`); t('earlier: the buyer\'s demand list shows the 3 demands', r.s === 200 && r.j.data.length === 3, r.s + ' ' + (r.j.data || []).length);
  r = await A('GET', `/payments/receipts?consumerId=${nb}`); t('earlier: the buyer\'s receipts list shows the booking receipt', r.s === 200 && r.j.data.length >= 1, r.s);
  r = await A('GET', `/booking/${S.id}`); t('earlier: the booking opens under the buyer', r.s === 200 && r.j.data.consumer_id === nb, r.s);
  r = await A('GET', `/consumers/${nb}`); t('earlier: the buyer opens', r.s === 200, r.s);
  r = await A('PATCH', `/consumers/${S.c}`, { remarks: 'old owner note' }); t('earlier: the old owner can still be edited', r.s === 200, r.s);
}

// ---------- clean up ----------
proc(pmId, false);
if (madeSlab) for (const sql of [`delete from gst_tax_charge_mapping where slab_id='${slab}'`, `delete from gst_tax_setup where slab_id='${slab}'`, `delete from gst_slabs where id='${slab}'`]) { try { psql(sql); } catch { /* ignore */ } }
{
  const ids = made.map(x => `'${x}'`).join(',');
  for (const sql of [
    `delete from audit_logs where resource_type = 'ownership_transfer' and resource_id in (select id from ownership_transfers where old_consumer_id in (${ids}) or new_consumer_id in (${ids}))`,
    `delete from ownership_transfers where old_consumer_id in (${ids}) or new_consumer_id in (${ids})`,
    `delete from audit_logs where resource_type in ('receipt','demand') and resource_id in (select id from receipts where consumer_id in (${ids}) union select id from demands where consumer_id in (${ids}))`,
    `delete from cheque_bounce_logs where consumer_id in (${ids})`, `delete from booking_documents where consumer_id in (${ids})`, `delete from receipts where consumer_id in (${ids})`, `delete from demands where consumer_id in (${ids})`,
    `delete from financial_audit_logs where consumer_id in (${ids})`, `delete from payment_plans where consumer_id in (${ids})`, `delete from allocations where consumer_id in (${ids})`,
    `delete from broker_commissions where consumer_id in (${ids})`, `delete from booking_payment_taxes where booking_record_id in (select id from booking_records where consumer_id in (${ids}))`,
    `delete from booking_records where consumer_id in (${ids})`, `delete from co_applicants where consumer_id in (${ids})`, `delete from consumers where id in (${ids})`,
  ]) { try { psql(sql); } catch { /* leftovers are harmless, names carry the run id */ } }
}
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
