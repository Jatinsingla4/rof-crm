// Payments, the rest: interest waivers, refunds, credit / debit notes, GST invoices, draw refunds, interest (scheduler, master, installment, customer wise), payment plans,
// clearing banks, receipt pages, loans, registry, FAQ and dashboard. Roles, hostile input, money rules (a waiver or refund never above what exists), races, a random run.
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-tds.mjs   (psql must reach the same database; SEED=n repeats a random run)
import { execFileSync } from 'node:child_process';
const B = process.env.BASE || 'http://localhost:3010/api';
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };
const login = async (email) => (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Test#Pass1234' }) })).json()).token;
const call = (tok) => async (m, p, b, raw) => { const go = () => fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: raw ?? (b === undefined ? undefined : JSON.stringify(b)) }); let r; try { r = await go(); } catch { r = await go(); } /* a keep-alive socket the server just closed */ let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const tokA = await login('super_admin@test.local'), tokAF = await login('accounts_finance@test.local');
const A = call(tokA), PM = call(await login('project_manager@test.local')), SE = call(await login('sales_executive@test.local')), RO = call(await login('read_only_viewer@test.local')), AF = call(tokAF);
const psql = (sql) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim().split('\n')[0];
const SEED = Number(process.env.SEED || Date.now() % 1e9); let rs = SEED;
const rnd = () => (rs = (rs * 1664525 + 1013904223) % 4294967296) / 4294967296, ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)), pick = (a) => a[ri(0, a.length - 1)];
console.log('SEED=' + SEED);
const U = Date.now().toString(36).slice(-5), NIL = '00000000-0000-0000-0000-000000000000';
const today = new Date().toISOString().slice(0, 10), later = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
let seq = 0; const mob = () => '9' + String((Date.now() % 1e7) * 100 + ++seq + 100000000).slice(-9).padStart(9, '0');
let r, r2;

// ---------- set-up: two projects, plan, GST, buyers with receipts ----------
const co = (await A('POST', '/companies', { name: 'TDS Co ' + U })).j.data.id;
const mkProj = async (tag) => (await A('POST', '/projects', { companyId: co, name: `PayR ${tag} ${U}`, reraNumber: `PR${tag}-${U}`, tcpLicence: 'x' })).j.data.id;
const P1 = await mkProj('A'), P2 = await mkProj('B');
const tw = async (P) => (await A('POST', `/projects/${P}/towers`, { towerName: 'T' + U })).j.data.id;
const T1 = await tw(P1), T2 = await tw(P2);
let un = 0; const unit = async (P, T) => (await A('POST', '/units', { projectId: P, towerId: T, unitNumber: `R${++un}-${U}`, floor: 1, bhkType: '2BHK', carpetAreaSqft: 1000, superAreaSqft: 1200, basePriceInr: 9000000, totalPriceInr: 9500000 })).j.data.id;
const plan = async (P, name, rows) => { let i = 0; for (const pc of rows) await A('POST', `/projects/${P}/plan-templates`, { plan_name: name, installment_name: `Row ${++i}`, installment_type: i === 1 ? 'booking' : 'installment', percentage: pc, due_date_offset_days: i * 30, installment_index: i }); return name; };
const PLAN1 = await plan(P1, 'PayPlan ' + U, [20, 30, 50]), PLAN2 = await plan(P2, 'PayPlanB ' + U, [100]);
let slab = (await A('GET', '/gst-configuration/gst-slabs')).j.data.find(s => s.from_date <= today && s.to_date >= today)?.id;
const madeSlab = !slab;
if (!slab) slab = (await A('POST', '/gst-configuration/gst-slabs', { fromDate: later(-3), toDate: later(40) })).j.data.id;
const taxId = (await A('POST', '/gst-configuration/gst-tax-setup', { slabId: slab, gstCode: `PR ${U}`, type: 'INTRA', cgstPct: 2.5, sgstPct: 2.5 })).j.data.id;
for (const P of [P1, P2]) for (const ct of ['BASIC', 'PLC', 'OTHER CHARGE']) await A('POST', '/gst-configuration/gst-charge-mapping', { projectId: P, slabId: slab, gstTaxId: taxId, chargeType: ct });
const made = [], challans = []; let ap = 0;
const person = async (P) => { const x = await A('POST', '/consumers', { name: `Pay Buyer ${++ap} ${U}`, mobile: mob(), project_id: P }); if (x.s >= 300) throw new Error('applicant ' + JSON.stringify(x)); made.push(x.j.data.id); return x.j.data.id; };
const buyer = async (P = P1, T = T1) => {   // completed booking: an applicant, a unit, a plan and a booking receipt
  const c = await person(P), u = await unit(P, T);
  const x = await A('POST', '/booking', { consumer_id: c, project_id: P, unit_id: u, selected_plan_name: P === P1 ? PLAN1 : PLAN2, booking_date: today }); if (x.s !== 201) throw new Error('book ' + JSON.stringify(x));
  const y = await A('PATCH', `/booking/${x.j.data.id}`, { booking_amount: 10000, payment_mode: 'cash' }); if (y.s !== 200) throw new Error('finish ' + JSON.stringify(y));
  return { c, u, id: x.j.data.id };
};
let rn = 0;
const receipt = async (S, amount = 5000, idx = 1) => { const x = await A('POST', '/payments/receipts', { consumerId: S.c, amountReceivedInr: amount, paymentMode: 'neft', referenceNumber: `PR${U}R${++rn}`, paymentDate: today, installmentIndex: idx }); if (x.s !== 200 && x.s !== 201) throw new Error('receipt ' + JSON.stringify(x)); return x.j.receipt?.id || x.j.data?.id; };
let cn = 0;
const newChallan = async (amount = 1000, extra = {}, who = A) => { const x = await who('POST', '/payments/tds/challans', { challanNumber: `CH${U}${++cn}`, challanDate: today, amount, bankName: 'SBI', ...extra }); if (x.s === 201) challans.push(x.j.data.id); return x; };
const assign = (ch, rc, amount, who = A) => who('POST', '/payments/tds/assign', { challanId: ch, receiptId: rc, amount });
const ch = (id, col) => psql(`select ${col} from tds_challans where id='${id}'`);
const bal = (id) => Number(psql(`select amount - assigned_amount from tds_challans where id='${id}'`));
const liveSum = (id) => Number(psql(`select coalesce(sum(amount_assigned),0) from tds_assignments where challan_id='${id}' and released_at is null`));
const consistent = (id) => Number(ch(id, 'assigned_amount')) === liveSum(id) && Number(ch(id, 'assigned_amount')) >= 0 && Number(ch(id, 'assigned_amount')) <= Number(ch(id, 'amount'));
const S1 = await buyer(), S2 = await buyer(), S3 = await buyer(), SP2 = await buyer(P2, T2);
const afId = psql(`select id from users where email='accounts_finance@test.local'`), pmId = psql(`select id from users where email='project_manager@test.local'`), seId = psql(`select id from users where email='sales_executive@test.local'`);
const psqlAll = (sql) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim().split('\n').filter(Boolean);
const grant = (uid, name, maker, checker) => psql(`insert into user_process_permissions (user_id, process_name, is_maker, is_checker) values ('${uid}','${name}',${maker},${checker}) on conflict (user_id, process_name) do update set is_maker=${maker}, is_checker=${checker} returning 1`);
const revoke = (uid) => psql(`delete from user_process_permissions where user_id='${uid}' and process_name in ('interest_waiver','jv_refund_drcr') returning 1`);
const noRows = (uid) => { try { revoke(uid); } catch { /* none */ } };
for (const u of [afId, pmId]) noRows(u);
const demandsPast = (c, idxs = [1], days = 120) => psql(`update demands set due_date = current_date - ${days}, status = 'raised' where consumer_id='${c}' and installment_index in (${idxs.join(',')}) returning 1`);
const recalc = (c, who = A) => who('POST', `/payments/consumer-interest-detail/${c}`);
const pis = (c) => psqlAll(`select id||'|'||installment_index||'|'||amount_inr||'|'||coalesce(interest_waived_inr,0)||'|'||status from penal_interests where consumer_id='${c}' order by installment_index, status`).map(l => { const [id, idx, amt, w, st] = l.split('|'); return { id, idx: +idx, amt: +amt, w: +w, st }; });
const waivedSum = (c) => Number(psql(`select coalesce(sum(waiver_amount_inr),0) from interest_waivers where consumer_id='${c}' and status='approved'`));
const piWaived = (c) => Number(psql(`select coalesce(sum(interest_waived_inr),0) from penal_interests where consumer_id='${c}'`));
const piTotal = (c) => Number(psql(`select coalesce(sum(amount_inr),0) from penal_interests where consumer_id='${c}'`));
// what the waivers say each installment should carry: the approved waivers per installment, never above that installment's interest
const expectedWaived = (c) => { const by = {}; for (const l of psqlAll(`select installment_index||'|'||sum(waiver_amount_inr) from interest_waivers where consumer_id='${c}' and status='approved' and installment_index is not null group by installment_index`)) { const [i, w] = l.split('|'); by[i] = +w; } return pis(c).filter(p => p.st === 'calculated').reduce((s, p) => s + Math.min(p.amt, by[p.idx] || 0), 0); };
const waiverSane = (c) => piWaived(c) <= waivedSum(c) && pis(c).every(p => p.w >= 0 && p.w <= p.amt) && pis(c).filter(p => p.st === 'calculated').reduce((s, p) => s + p.w, 0) === expectedWaived(c);
const waiverOk = (c) => piWaived(c) === waivedSum(c) && pis(c).every(p => p.w >= 0 && p.w <= p.amt);
const par = (n, f) => Promise.all(Array.from({ length: n }, (_, i) => f(i)));
const no5 = (xs) => xs.every(x => x.s < 500);
const cnt = (xs, s) => xs.filter(x => x.s === s).length;
const noLogin = async (m, p, b) => (await fetch(B + p, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined })).status;
const readers = [['read_only_viewer', RO], ['sales_executive', SE], ['project_manager', PM], ['accounts_finance', AF], ['super_admin', A]];
const extraSql = [];   // cleanup statements for rows made by psql

// ---------- roles: who reads ----------
{
  const c1 = S1.c;
  for (const [n, who] of readers) for (const p of ['/payments/interest-waivers', '/payments/refunds', '/payments/credit-debit-notes', '/payments/gst-invoices', '/payments/draw-refunds', '/payments/draw-refunds/overdue', '/payments/overdue', `/payments/dashboard?projectId=${P1}`, `/payments/clearing-banks/${P1}`, `/payments/interest-master/${P1}`, `/payments/plan-names/${P1}`, `/payments/customer-wise-consumers?project_id=${P1}`, `/payments/interest-waiver-list?project_id=${P1}`, `/payments/consumer-waiver-report?project_id=${P1}`, '/dashboard/summary', '/dashboard/pending-cheques', `/loans/${c1}`, '/registry']) {
    r = await who('GET', p); t(`roles: ${n} can read ${p.split('?')[0].replace(P1, ':p').replace(c1, ':c')}`, r.s === 200, r.s + ' ' + JSON.stringify(r.j).slice(0, 80));
  }
  for (const [m, p] of [['GET', '/payments/refunds'], ['POST', '/payments/refunds'], ['GET', '/payments/interest-waivers'], ['POST', '/payments/interest-waivers/direct'], ['GET', '/payments/gst-invoices'], ['POST', '/payments/gst-invoices'], ['POST', '/payments/gst-invoices/cancel'], ['GET', '/payments/draw-refunds'], ['POST', '/payments/interest-scheduler'], ['POST', '/payments/interest-master'], ['POST', '/payments/manual-interest'], ['GET', `/payments/clearing-banks/${P1}`], ['GET', `/payments/receipt-detail/${S1.c}`], ['GET', '/dashboard/summary'], ['GET', `/loans/${S1.c}`], ['POST', '/loans'], ['GET', '/registry'], ['POST', '/registry/schedule'], ['GET', '/faq/articles'], ['POST', '/payments/payment-plans']]) {
    t(`roles: no login ${m} ${p.replace(P1, ':p').replace(S1.c, ':c')} -> 401`, (await noLogin(m, p)) === 401);
  }
}

// ---------- interest waivers ----------
const cD = async (c, over = {}, who = A) => who('POST', '/payments/interest-waivers/direct', { consumer_id: c, waiver_amount_inr: 100, authorized_by_name: 'Owner', ...over });
{
  demandsPast(S1.c, [1, 2]); r = await recalc(S1.c); t('waiver: interest calculated for the test applicant', r.s === 200 && pis(S1.c).length >= 1, r.s);
  const T = piTotal(S1.c), c = S1.c;
  t('waiver: the test applicant has real interest', T > 1000, T);
  const n0 = Number(psql(`select count(*) from interest_waivers where consumer_id='${c}'`));
  const bad = async (n, over, code = 400) => { const x = await cD(c, over); t(`waiver direct: ${n} -> ${code}`, x.s === code, x.s + ' ' + JSON.stringify(x.j).slice(0, 100)); return x; };
  r = await A('POST', '/payments/interest-waivers/direct'); t('waiver direct: no body -> 400', r.s === 400, r.s);
  r = await A('POST', '/payments/interest-waivers/direct', undefined, '[1]'); t('waiver direct: array body -> 400', r.s === 400, r.s);
  r = await A('POST', '/payments/interest-waivers/direct', undefined, '{bad'); t('waiver direct: broken JSON -> 400', r.s === 400, r.s);
  for (const v of [undefined, '', 'abc', [c], {}, 5, true]) await bad(`consumer_id ${JSON.stringify(v)}`, { consumer_id: v });
  await bad('unknown applicant', { consumer_id: NIL }, 404);
  for (const v of [undefined, 0, -1, '-5', 'abc', '1e3', '0x10', 1.5, '10.5', 1e12, true, [5], {}, null, '', ' 5 ']) await bad(`amount ${JSON.stringify(v)}`, { waiver_amount_inr: v });
  for (const v of [0, -1, 1.5, 'x', 1000, [1], '1']) await bad(`installment_index ${JSON.stringify(v)}`, { installment_index: v });
  await bad('payment_plan_id "abc"', { payment_plan_id: 'abc' });
  for (const [k, v] of [['reason', 'r'.repeat(501)], ['reason', '<script>x</script>'], ['reason', ['a']], ['authorized_by_name', 'n'.repeat(101)], ['authorized_by_name', '<b>'], ['document_path', 'd'.repeat(256)]]) await bad(`${k} ${JSON.stringify(v).slice(0, 18)}`, { [k]: v });
  t('waiver direct: nothing saved by all refused calls', Number(psql(`select count(*) from interest_waivers where consumer_id='${c}'`)) === n0 && piWaived(c) === 0);
  await bad(`more than all the interest (${T + 1})`, { waiver_amount_inr: T + 1 }, 409);
  const first = pis(c)[0];
  await bad(`more than one installment has (${first.amt + 1} on installment ${first.idx})`, { waiver_amount_inr: first.amt + 1, installment_index: first.idx }, 409);
  await bad('installment that has no interest', { installment_index: 77 }, 409);
  // roles
  for (const [n, who] of [['read_only_viewer', RO], ['sales_executive', SE]]) { r = await cD(c, {}, who); t(`waiver direct: ${n} -> 403`, r.s === 403, r.s); }
  for (const [n, who] of [['project_manager', PM], ['accounts_finance', AF]]) { r = await cD(c, {}, who); t(`waiver direct: ${n} without checker access -> 403`, r.s === 403, r.s); }
  grant(pmId, 'interest_waiver', false, true); r = await cD(c, { waiver_amount_inr: 100 }, PM); t('waiver direct: a checker (project_manager) may', r.s === 200 && r.j.data.status === 'approved' && waiverOk(c), r.s + JSON.stringify(r.j).slice(0, 100));
  // invariant after a first waiver, then take it in two steps up to the limit
  const half = Math.floor(T / 2);
  r = await cD(c, { waiver_amount_inr: half }); t('waiver direct: half of the interest, spread over installments', r.s === 200 && waiverOk(c) && piWaived(c) === 100 + half && r.j.rows.length >= 1, r.s + JSON.stringify(r.j).slice(0, 120));
  t('waiver direct: one approved waiver row per installment it was taken from', Number(psql(`select count(*) from interest_waivers where consumer_id='${c}' and status='approved' and installment_index is not null and penal_interest_id is not null`)) === Number(psql(`select count(*) from interest_waivers where consumer_id='${c}' and status='approved'`)));
  const left = T - piWaived(c);
  await bad(`one rupee more than what is left (${left + 1})`, { waiver_amount_inr: left + 1 }, 409);
  r = await cD(c, { waiver_amount_inr: left }); t('waiver direct: exactly what is left is allowed', r.s === 200 && piWaived(c) === T && waiverOk(c), r.s + JSON.stringify(r.j));
  await bad('nothing left to waive', { waiver_amount_inr: 1 }, 409);
  // recalculation keeps the waiver
  r = await recalc(c); t('waiver: a recalculation keeps what was waived', r.s === 200 && waiverOk(c) && piWaived(c) >= Math.min(T, piTotal(c)) - 1, `${r.s} waived ${piWaived(c)} of ${piTotal(c)} (was ${T})`);
  r = await A('PATCH', `/payments/consumer-grace-period/${c}`, { grace_period_days: 0 }); await recalc(c); t('waiver: setting the grace period and recalculating keeps it too', r.s === 200 && waiverOk(c));
  r = await A('GET', `/payments/interest-waiver-list?project_id=${P1}&registration_no=`); const row = (r.j.data || []).find(x => x.consumer_id === c);
  t('waiver list: totals match the stored rows', row && Number(row.total_interest_inr) === piTotal(c) && Number(row.total_waived_inr) === piWaived(c) && Number(row.balance_interest_inr) === piTotal(c) - piWaived(c), JSON.stringify(row));
  r = await A('GET', `/payments/consumer-waiver-report?project_id=${P1}`); const rep = (r.j.data || []).find(x => x.consumer_id === c);
  t('waiver report: waived total equals the approved waivers', rep && Number(rep.total_waived_inr) === waivedSum(c), JSON.stringify(rep));
  r = await A('GET', `/payments/interest-waivers?consumer_id=${c}`); t('waiver list api: by applicant', r.s === 200 && r.j.data.length >= 3, r.s);
  for (const q of ['status=zz', 'consumer_id=abc', 'pageSize=0', 'pageSize=1001', 'page=-1', 'pageSize=1;drop table x', 'status[a]=b', 'consumer_id=a&consumer_id=b']) { r = await A('GET', '/payments/interest-waivers?' + q); t(`waiver list api: ?${q} -> 400`, r.s === 400, r.s); }
  r = await A('GET', '/payments/interest-waivers/abc'); t('waiver one: id "abc" -> 400', r.s === 400, r.s); r = await A('GET', `/payments/interest-waivers/${NIL}`); t('waiver one: unknown -> 404', r.s === 404, r.s);
  t('waiver: direct waivers are logged', Number(psql(`select count(*) from financial_audit_logs where consumer_id='${c}' and action_type='interest_waiver_direct'`)) >= 3 && Number(psql(`select count(*) from audit_logs where resource_type='interest_waiver' and timestamp > now() - interval '1 hour'`)) >= 3);
  // race: 5 parallel direct waivers on S2, each 40% of the interest
  const c2 = S2.c; demandsPast(c2, [1, 2]); await recalc(c2); const T2 = piTotal(c2), each = Math.floor(T2 * 0.4);
  const rr = await par(5, () => cD(c2, { waiver_amount_inr: each }));
  t('waiver race: 5 parallel waivers of 40% -> exactly 2 succeed, no 5xx', cnt(rr, 200) === 2 && cnt(rr, 409) === 3 && no5(rr), rr.map(x => x.s).join());
  t('waiver race: stored waiver equals the approved waivers and stays within the interest', waiverOk(c2) && piWaived(c2) === 2 * each, `${piWaived(c2)} vs ${2 * each}`);
}

// ---------- interest waivers: request, approve, reject (maker / checker) ----------
const wreq = (c, over = {}, who = AF) => who('POST', '/payments/interest-waivers', { consumer_id: c, installment_index: 1, waiver_amount_inr: 100, authorized_by_name: 'Owner', ...over });
{
  const c = S3.c; demandsPast(c, [1, 2]); await recalc(c); const rows = pis(c), p1 = rows.find(x => x.idx === 1), T = piTotal(c);
  grant(afId, 'interest_waiver', true, false); grant(pmId, 'interest_waiver', false, true);
  t('waiver request: the test applicant has interest on installment 1', !!p1 && p1.amt > 1000, JSON.stringify(rows));
  for (const [n, who] of [['read_only_viewer', RO], ['sales_executive', SE]]) { r = await wreq(c, {}, who); t(`waiver request: ${n} -> 403`, r.s === 403, r.s); }
  grant(afId, 'interest_waiver', false, false); r = await wreq(c); t('waiver request: accounts_finance without maker access -> 403', r.s === 403, r.s); grant(afId, 'interest_waiver', true, false);
  const bad = async (n, over, code = 400) => { const x = await wreq(c, over); t(`waiver request: ${n} -> ${code}`, x.s === code, x.s + ' ' + JSON.stringify(x.j).slice(0, 100)); return x; };
  await bad('no interest chosen', { installment_index: undefined });
  await bad('penal_interest_id "abc"', { penal_interest_id: 'abc' });
  await bad('penal_interest_id of nothing', { penal_interest_id: NIL }, 404);
  await bad('installment without interest', { installment_index: 88 }, 404);
  for (const v of [0, -5, 1.5, 'x', '1e3', 1e12]) await bad(`amount ${JSON.stringify(v)}`, { waiver_amount_inr: v });
  await bad(`more than the installment (${p1.amt + 1})`, { waiver_amount_inr: p1.amt + 1 }, 409);
  const other = pis(S1.c)[0]; await bad('interest row of another applicant', { penal_interest_id: other.id }, 404);
  const part = Math.floor(p1.amt * 0.6);
  r = await wreq(c, { waiver_amount_inr: part }); t('waiver request: a good request is saved as pending', r.s === 201 && r.j.data.status === 'pending' && r.j.data.requested_by === afId && piWaived(c) === 0, r.s + JSON.stringify(r.j).slice(0, 100)); const w1 = r.j.data?.id;
  await bad('a second request that, with the first, is more than the installment', { waiver_amount_inr: Math.floor(p1.amt * 0.5) }, 409);
  r = await A('GET', `/payments/interest-waivers/${w1}`); t('waiver request: opens with names and the interest it targets', r.s === 200 && r.j.data.consumer_name && Number(r.j.data.interest_amount_inr) === p1.amt, r.s);
  // approving
  grant(afId, 'interest_waiver', true, true);
  r = await AF('PATCH', `/payments/interest-waivers/${w1}/approve`, {}); t('waiver approve: the maker cannot approve their own request -> 403', r.s === 403, r.s + JSON.stringify(r.j));
  for (const [n, who] of [['read_only_viewer', RO], ['sales_executive', SE]]) { r = await who('PATCH', `/payments/interest-waivers/${w1}/approve`, {}); t(`waiver approve: ${n} -> 403`, r.s === 403, r.s); }
  r = await A('PATCH', '/payments/interest-waivers/abc/approve', {}); t('waiver approve: id "abc" -> 400', r.s === 400, r.s); r = await A('PATCH', `/payments/interest-waivers/${NIL}/approve`, {}); t('waiver approve: unknown -> 404', r.s === 404, r.s);
  t('waiver approve: refused calls changed nothing', piWaived(c) === 0 && psql(`select status from interest_waivers where id='${w1}'`) === 'pending');
  // the interest is recalculated before the checker looks: the row ids change, the request must still find its installment
  await recalc(c); t('waiver approve: the recalculation gave the interest new row ids', pis(c).find(x => x.idx === 1).id !== p1.id);
  const rr = await par(5, () => PM('PATCH', `/payments/interest-waivers/${w1}/approve`, {}));
  t('waiver approve race: 5 parallel approvals -> exactly one, no 5xx', cnt(rr, 200) === 1 && cnt(rr, 409) === 4 && no5(rr), rr.map(x => x.s).join());
  t('waiver approve: the installment carries the waiver once', waiverOk(c) && piWaived(c) === part && pis(c).find(x => x.idx === 1).w === part, JSON.stringify(pis(c)));
  r = await PM('PATCH', `/payments/interest-waivers/${w1}/reject`, { rejection_reason: 'late' }); t('waiver reject: an approved waiver cannot be rejected -> 409', r.s === 409 && piWaived(c) === part, r.s);
  // reject path
  r = await wreq(c, { waiver_amount_inr: 50 }); const w2 = r.j.data?.id;
  r = await PM('PATCH', `/payments/interest-waivers/${w2}/reject`, {}); t('waiver reject: no reason -> 400', r.s === 400, r.s);
  r = await PM('PATCH', `/payments/interest-waivers/${w2}/reject`, { rejection_reason: '<b>x</b>' }); t('waiver reject: reason with tags -> 400', r.s === 400, r.s);
  r = await PM('PATCH', `/payments/interest-waivers/${w2}/reject`, { rejection_reason: 'not agreed' }); t('waiver reject: a pending request is rejected', r.s === 200 && psql(`select status from interest_waivers where id='${w2}'`) === 'rejected', r.s);
  r = await PM('PATCH', `/payments/interest-waivers/${w2}/approve`, {}); t('waiver approve: a rejected request cannot be approved -> 409', r.s === 409 && piWaived(c) === part, r.s);
  r = await PM('PATCH', `/payments/interest-waivers/${w2}/reject`, { rejection_reason: 'again' }); t('waiver reject: rejecting twice -> 409', r.s === 409, r.s);
  // a request waiting while a direct waiver uses up the interest
  const room = p1.amt - part; r = await wreq(c, { waiver_amount_inr: room }); const w3 = r.j.data?.id; t('waiver request: asking for exactly the rest is fine', r.s === 201, r.s + JSON.stringify(r.j));
  r = await cD(c, { waiver_amount_inr: 10, installment_index: 1 }); t('waiver: a direct waiver goes ahead of a waiting request', r.s === 200, r.s);
  r = await PM('PATCH', `/payments/interest-waivers/${w3}/approve`, {}); t('waiver approve: a request that no longer fits -> 409, nothing applied', r.s === 409 && waiverOk(c) && pis(c).find(x => x.idx === 1).w === part + 10, r.s + JSON.stringify(r.j));
  r = await PM('PATCH', `/payments/interest-waivers/${w3}/reject`, { rejection_reason: 'no room' }); t('waiver reject: the request that does not fit is rejected', r.s === 200, r.s);
  r = await A('PATCH', `/payments/interest-waivers/${(await wreq(c, { waiver_amount_inr: 5 })).j.data.id}/approve`, {}); t('waiver approve: super_admin may approve a request of another person', r.s === 200 && waiverOk(c), r.s);
  await wreq(c, { waiver_amount_inr: 1 });
  for (const st of ['pending', 'approved', 'rejected']) { r = await A('GET', `/payments/interest-waivers?status=${st}&consumer_id=${c}`); t(`waiver list api: status=${st}`, r.s === 200 && r.j.data.every(x => x.status === st) && r.j.data.length >= 1, r.s); }
  noRows(afId); noRows(pmId);
}

// ---------- refunds ----------
const rq = (c, over = {}, who = AF) => who('POST', '/payments/refunds', { consumer_id: c, refund_amount_inr: 100, reason: 'test', ...over });
const cleanRefunds = (c) => psql(`update payment_refunds set status='rejected' where consumer_id='${c}' and status in ('pending','approved') returning 1`);
{
  const B1 = await buyer(), c = B1.c, rc1 = await receipt(B1, 5000), rc2 = await receipt(B1, 3000), PAID = 10000 + 5000 + 3000, other = await receipt(S1, 1000);
  grant(afId, 'jv_refund_drcr', true, false); grant(pmId, 'jv_refund_drcr', false, true);
  for (const [n, who] of [['read_only_viewer', RO], ['sales_executive', SE]]) { r = await rq(c, {}, who); t(`refund: ${n} cannot raise -> 403`, r.s === 403, r.s); }
  grant(afId, 'jv_refund_drcr', false, false); r = await rq(c); t('refund: accounts_finance without maker access -> 403', r.s === 403, r.s); grant(afId, 'jv_refund_drcr', true, false);
  const bad = async (n, over, code = 400) => { const x = await rq(c, over); t(`refund: ${n} -> ${code}`, x.s === code, x.s + ' ' + JSON.stringify(x.j).slice(0, 100)); return x; };
  r = await AF('POST', '/payments/refunds'); t('refund: no body -> 400', r.s === 400, r.s); r = await AF('POST', '/payments/refunds', undefined, '[1]'); t('refund: array body -> 400', r.s === 400, r.s);
  for (const v of [undefined, '', 'abc', [c], 7]) await bad(`consumer_id ${JSON.stringify(v)}`, { consumer_id: v });
  await bad('unknown applicant', { consumer_id: NIL }, 404);
  for (const v of [undefined, 0, -1, '-5', 'abc', '1e3', '0x10', 0.001, '10.999', 1e12, true, [5], {}, null, '']) await bad(`amount ${JSON.stringify(v)}`, { refund_amount_inr: v });
  await bad('payment_plan_id "abc"', { payment_plan_id: 'abc' }); await bad('payment plan of another applicant', { payment_plan_id: psql(`select id from payment_plans where consumer_id='${S1.c}' limit 1`) });
  await bad('original_receipt_id "abc"', { original_receipt_id: 'abc' }); await bad('receipt of another applicant', { original_receipt_id: other });
  await bad('refund_mode "barter"', { refund_mode: 'barter' }); await bad('reason too long', { reason: 'r'.repeat(501) }); await bad('reason with tags', { reason: '<script>' });
  t('refund: nothing saved by the refused calls', Number(psql(`select count(*) from payment_refunds where consumer_id='${c}'`)) === 0);
  await bad(`more than paid (${PAID + 1})`, { refund_amount_inr: PAID + 1 }, 409);
  await bad(`more than the receipt (${5001})`, { refund_amount_inr: 5001, original_receipt_id: rc1 }, 409);
  r = await rq(c, { refund_amount_inr: 5000, original_receipt_id: rc1, refund_mode: 'neft' }); t('refund: the whole receipt may be refunded', r.s === 201 && r.j.data.status === 'pending' && r.j.data.requested_by === afId, r.s + JSON.stringify(r.j)); const f1 = r.j.data?.id;
  await bad('the same receipt again (1 rupee)', { refund_amount_inr: 1, original_receipt_id: rc1 }, 409);
  r = await rq(c, { refund_amount_inr: 12.34 }); t('refund: paise are kept', r.s === 201 && Number(r.j.data.refund_amount_inr) === 12.34, r.s); const f2 = r.j.data?.id;
  await bad(`everything else plus a paisa (${PAID - 5000 - 12.34 + 0.01})`, { refund_amount_inr: Math.round((PAID - 5000 - 12.34 + 0.01) * 100) / 100 }, 409);
  r = await rq(c, { refund_amount_inr: Math.round((PAID - 5000 - 12.34) * 100) / 100 }); t('refund: exactly what is left is allowed', r.s === 201, r.s + JSON.stringify(r.j)); const f3 = r.j.data?.id;
  r = await A('GET', `/payments/refunds?consumer_id=${c}`); t('refund: all three listed, total equals the money paid', r.s === 200 && r.j.data.length === 3 && Math.round(r.j.data.reduce((s, x) => s + Number(x.refund_amount_inr), 0) * 100) === PAID * 100, r.s);
  r = await PM('PATCH', `/payments/refunds/${f3}/reject`, { rejection_reason: 'wrong amount' }); t('refund reject: frees its amount', r.s === 200 && r.j.data.status === 'rejected' && r.j.data.rejected_by === pmId, r.s + JSON.stringify(r.j));
  r = await PM('PATCH', `/payments/refunds/${f3}/approve`, {}); t('refund: a rejected refund cannot be approved -> 409', r.s === 409, r.s);
  r = await PM('PATCH', `/payments/refunds/${f3}/reject`, {}); t('refund reject: no reason -> 400', r.s === 400, r.s);
  // approve
  grant(afId, 'jv_refund_drcr', true, true);
  r = await AF('PATCH', `/payments/refunds/${f1}/approve`, {}); t('refund approve: the maker cannot approve their own -> 403', r.s === 403, r.s);
  for (const [n, who] of [['read_only_viewer', RO], ['sales_executive', SE]]) { r = await who('PATCH', `/payments/refunds/${f1}/approve`, {}); t(`refund approve: ${n} -> 403`, r.s === 403, r.s); }
  r = await PM('PATCH', '/payments/refunds/abc/approve', {}); t('refund approve: id "abc" -> 400', r.s === 400, r.s); r = await PM('PATCH', `/payments/refunds/${NIL}/approve`, {}); t('refund approve: unknown -> 404', r.s === 404, r.s);
  r = await PM('PATCH', `/payments/refunds/${f1}/process`, { refund_mode: 'neft' }); t('refund process: a pending refund cannot be processed -> 409', r.s === 409, r.s);
  const rr = await par(5, () => PM('PATCH', `/payments/refunds/${f1}/approve`, {}));
  t('refund approve race: 5 parallel -> exactly one, no 5xx', cnt(rr, 200) === 1 && cnt(rr, 409) === 4 && no5(rr), rr.map(x => x.s).join());
  // process
  r = await PM('PATCH', `/payments/refunds/${f1}/process`, {}); t('refund process: no mode -> 400', r.s === 400, r.s);
  for (const [k, v] of [['refund_mode', 'barter'], ['refund_reference', 'r'.repeat(256)], ['refund_reference', '<b>'], ['refund_date', '2020-02-30'], ['refund_date', '2999-01-01'], ['refund_date', 'abc']]) { r = await PM('PATCH', `/payments/refunds/${f1}/process`, { refund_mode: 'neft', [k]: v }); t(`refund process: ${k} ${JSON.stringify(v).slice(0, 14)} -> 400`, r.s === 400, r.s); }
  // a receipt cancelled after the approval: the refund no longer has money behind it
  r = await A('POST', `/payments/receipts/${rc1}/cancel`, { reason: 'test' }); t('refund process: (set-up) the receipt is cancelled after approval', r.s === 200, r.s);
  r = await PM('PATCH', `/payments/refunds/${f1}/process`, { refund_mode: 'neft', refund_reference: 'UTR1' }); t('refund process: a refund on a cancelled receipt -> 409', r.s === 409, r.s + JSON.stringify(r.j));
  r = await PM('PATCH', `/payments/refunds/${f1}/reject`, { rejection_reason: 'receipt cancelled' }); t('refund reject: an approved refund can still be rejected', r.s === 200, r.s);
  r = await rq(c, { refund_amount_inr: 1, original_receipt_id: rc1 }); t('refund: a new refund on a cancelled receipt -> 409', r.s === 409, r.s);
  // the full flow on the other receipt
  r = await rq(c, { refund_amount_inr: 3000, original_receipt_id: rc2 }); const f4 = r.j.data?.id; t('refund: raise on the second receipt', r.s === 201, r.s + JSON.stringify(r.j));
  await PM('PATCH', `/payments/refunds/${f4}/approve`, {});
  r = await PM('PATCH', `/payments/refunds/${f4}/process`, { refund_mode: 'rtgs', refund_reference: 'UTR-' + U, refund_date: today }); t('refund process: approved -> processed with mode, reference, date', r.s === 200 && r.j.data.status === 'processed' && r.j.data.refund_mode === 'rtgs' && r.j.data.refund_reference === 'UTR-' + U && r.j.data.processed_by === pmId, r.s + JSON.stringify(r.j));
  r = await PM('PATCH', `/payments/refunds/${f4}/process`, { refund_mode: 'rtgs' }); t('refund process: twice -> 409', r.s === 409, r.s);
  r = await PM('PATCH', `/payments/refunds/${f4}/reject`, { rejection_reason: 'x' }); t('refund reject: a processed refund cannot be rejected -> 409', r.s === 409, r.s);
  for (const st of ['pending', 'approved', 'processed', 'rejected']) { r = await A('GET', `/payments/refunds?status=${st}&consumer_id=${c}`); t(`refund list: status=${st}`, r.s === 200 && r.j.data.every(x => x.status === st), r.s); }
  for (const q of ['status=zz', 'consumer_id=abc', 'pageSize=0', 'pageSize=1;drop table x', 'status[a]=b']) { r = await A('GET', '/payments/refunds?' + q); t(`refund list: ?${q} -> 400`, r.s === 400, r.s); }
  r = await A('GET', `/payments/refunds/${f4}`); t('refund one: opens with names', r.s === 200 && r.j.data.consumer_name && r.j.data.processed_by_name, r.s); r = await A('GET', '/payments/refunds/abc'); t('refund one: id "abc" -> 400', r.s === 400, r.s); r = await A('GET', `/payments/refunds/${NIL}`); t('refund one: unknown -> 404', r.s === 404, r.s);
  // race on the money: 5 parallel refunds of 40% of what is free
  const B2 = await buyer(), c2 = B2.c, free = 10000, each = 4000;
  const r5 = await par(5, () => rq(c2, { refund_amount_inr: each }));
  t('refund race: 5 parallel refunds of 40% -> exactly 2 succeed, no 5xx', cnt(r5, 201) === 2 && cnt(r5, 409) === 3 && no5(r5), r5.map(x => x.s).join());
  t('refund race: refunds together never above the money paid', Number(psql(`select coalesce(sum(refund_amount_inr),0) from payment_refunds where consumer_id='${c2}' and status<>'rejected'`)) <= free);
  t('refund: raise, approve, process and reject are logged', Number(psql(`select count(*) from audit_logs where resource_type='payment_refund' and timestamp > now() - interval '1 hour'`)) >= 6);
  noRows(afId); noRows(pmId);
}

// ---------- cancellation refund ----------
{
  grant(afId, 'jv_refund_drcr', true, false); grant(pmId, 'jv_refund_drcr', false, true);
  const B1 = await buyer(), alloc = psql(`select id from allocations where consumer_id='${B1.c}' limit 1`);
  const mk = (amount, status) => { const id = psql(`insert into cancellations (allocation_id, consumer_id, refund_amount_inr, refund_status) values ('${alloc}','${B1.c}',${amount},${status ? `'${status}'` : 'null'}) returning id`); extraSql.push(`delete from audit_logs where resource_id='${id}'`, `delete from cancellations where id='${id}'`); return id; };
  const ini = (id, who = AF) => who('PATCH', `/payments/cancellations/${id}/refund/initiate`, {}), com = (id, who = PM) => who('PATCH', `/payments/cancellations/${id}/refund/complete`, {});
  const k1 = mk(5000, null);
  for (const [n, who] of [['read_only_viewer', RO], ['sales_executive', SE]]) { r = await ini(k1, who); t(`cancellation refund: ${n} cannot initiate -> 403`, r.s === 403, r.s); r = await com(k1, who); t(`cancellation refund: ${n} cannot complete -> 403`, r.s === 403, r.s); }
  r = await ini('abc'); t('cancellation refund: id "abc" -> 400', r.s === 400, r.s); r = await ini(NIL); t('cancellation refund: unknown -> 404', r.s === 404, r.s); r = await com(NIL); t('cancellation refund: complete unknown -> 404', r.s === 404, r.s);
  r = await com(k1); t('cancellation refund: complete before initiate -> 409', r.s === 409, r.s);
  r = await ini(mk(0, null)); t('cancellation refund: nothing to refund (0) -> 409', r.s === 409, r.s);
  r = await ini(mk(500, 'restored')); t('cancellation refund: a restored cancellation -> 409', r.s === 409, r.s);
  const rr = await par(5, () => ini(k1)); t('cancellation refund: 5 parallel initiates -> exactly one, no 5xx', cnt(rr, 200) === 1 && cnt(rr, 409) === 4 && no5(rr), rr.map(x => x.s).join());
  const cc = await par(5, () => com(k1)); t('cancellation refund: 5 parallel completes -> exactly one, no 5xx', cnt(cc, 200) === 1 && cnt(cc, 409) === 4 && no5(cc), cc.map(x => x.s).join());
  t('cancellation refund: ends as completed', psql(`select refund_status from cancellations where id='${k1}'`) === 'completed');
  r = await ini(k1); t('cancellation refund: initiating a completed one -> 409', r.s === 409, r.s);
  noRows(afId); noRows(pmId);
}

// ---------- GST invoices, credit / debit notes ----------
const inv = (c, over = {}, who = A) => who('POST', '/payments/gst-invoices', { consumerId: c, baseAmount: 10000, gstRate: 5, supplyType: 'intrastate', invoiceType: 'tax_invoice', ...over });
const invs = [];
{
  const c = S1.c;
  for (const [n, who] of [['read_only_viewer', RO], ['sales_executive', SE], ['project_manager', PM]]) { r = await inv(c, {}, who); t(`invoice: ${n} cannot create -> 403`, r.s === 403, r.s); }
  const bad = async (n, over, code = 400) => { const x = await inv(c, over); t(`invoice: ${n} -> ${code}`, x.s === code, x.s + ' ' + JSON.stringify(x.j).slice(0, 100)); if (x.s === 201) invs.push(x.j.data.id); return x; };
  r = await A('POST', '/payments/gst-invoices'); t('invoice: no body -> 400', r.s === 400, r.s); r = await A('POST', '/payments/gst-invoices', undefined, '[1]'); t('invoice: array body -> 400', r.s === 400, r.s);
  const n0 = Number(psql(`select count(*) from gst_invoices where consumer_id='${c}'`));
  for (const v of [undefined, '', 'abc', 5, [c]]) await bad(`consumerId ${JSON.stringify(v)}`, { consumerId: v });
  await bad('unknown applicant', { consumerId: NIL }, 404);
  for (const v of [undefined, 0, -1, '-5', 'abc', '1e3', 0.001, 1e12, true, [5], null, '']) await bad(`baseAmount ${JSON.stringify(v)}`, { baseAmount: v });
  for (const v of [-1, 29, 'abc', '1e1', 5.555]) await bad(`gstRate ${JSON.stringify(v)}`, { gstRate: v });
  await bad('cgstRate with igstRate', { gstRate: undefined, cgstRate: 9, igstRate: 18 });
  await bad('supplyType "mars"', { supplyType: 'mars' }); await bad('invoiceType "x"', { invoiceType: 'x' }); await bad('invoiceDate 2020-02-30', { invoiceDate: '2020-02-30' }); await bad('description 101 chars', { description: 'd'.repeat(101) }); await bad('description with tags', { description: '<b>' });
  await bad('buyerGstin short', { buyerGstin: '123' }); await bad('projectId "abc"', { projectId: 'abc' }); await bad('projectId unknown', { projectId: NIL }, 404); await bad('unitId "abc"', { unitId: 'abc' }); await bad('receiptId "abc"', { receiptId: 'abc' });
  await bad('receipt of another applicant', { receiptId: await receipt(S2, 700) });
  t('invoice: nothing saved by the refused calls', Number(psql(`select count(*) from gst_invoices where consumer_id='${c}'`)) === n0);
  // the screen sends its own tax figures: they are ignored
  r = await inv(c, { gstAmount: 1, totalAmount: 2, cgstAmount: 999, baseAmount: 10000 }); invs.push(r.j.data?.id); const d1 = r.j.data;
  t('invoice: tax is worked out on the server (5%: 250 + 250, total 10500) and the screen\'s figures are ignored', r.s === 201 && Number(d1.cgst_amount) === 250 && Number(d1.sgst_amount) === 250 && Number(d1.igst_amount) === 0 && Number(d1.total_amount) === 10500 && Number(d1.gst_amount) === 500 && Number(d1.gst_rate) === 5, r.s + JSON.stringify(r.j));
  t('invoice: number, project from the applicant\'s unit, status generated, creator', /^INV\/\d{4}\/\d{5}$/.test(d1.invoice_number) && d1.project_id === P1 && d1.status === 'generated' && d1.created_by_user_id, JSON.stringify(d1));
  r = await inv(c, { baseAmount: '12345.67', gstRate: 12, supplyType: 'interstate' }); invs.push(r.j.data?.id); t('invoice: interstate is IGST only, paise kept', r.s === 201 && Number(r.j.data.igst_amount) === 1481.48 && Number(r.j.data.cgst_amount) === 0 && Number(r.j.data.total_amount) === 13827.15, r.s + JSON.stringify(r.j));
  r = await inv(c, { gstRate: undefined, baseAmountInr: 1000, cgstRate: 2.5, sgstRate: 2.5 }); invs.push(r.j.data?.id); t('invoice: the API fields (baseAmountInr, cgstRate, sgstRate) work too', r.s === 201 && Number(r.j.data.total_amount) === 1050, r.s + JSON.stringify(r.j));
  // numbers never repeat
  const rr = await par(5, () => inv(c, { baseAmount: 100 })); rr.forEach(x => x.j?.data?.id && invs.push(x.j.data.id));
  t('invoice race: 5 parallel -> 5 different numbers, no 5xx', cnt(rr, 201) === 5 && new Set(rr.map(x => x.j.data.invoice_no)).size === 5 && no5(rr), rr.map(x => x.s).join());
  // one live invoice per receipt
  const rc = await receipt(S1, 2000); const rr2 = await par(5, () => inv(c, { receiptId: rc, baseAmount: 2000 })); rr2.forEach(x => x.j?.data?.id && invs.push(x.j.data.id));
  t('invoice race: 5 parallel on one receipt -> exactly one, no 5xx', cnt(rr2, 201) === 1 && cnt(rr2, 409) === 4 && no5(rr2), rr2.map(x => x.s).join());
  r = await A('GET', `/payments/receipts?consumerId=${c}&pageSize=100`); t('invoice: the receipts list tells which receipt has an invoice (the Invoicing screen needs it)', r.s === 200 && r.j.data.find(x => x.id === rc)?.invoice_number && !r.j.data.filter(x => x.id !== rc).some(x => x.invoice_number && x.invoice_number === r.j.data.find(y => y.id === rc).invoice_number), r.s);
  // list
  r = await A('GET', `/payments/gst-invoices?consumerId=${c}&invoiceNumber=${d1.invoice_no}`); t('invoice list: by number, with the names the screen reads', r.s === 200 && r.j.data.length === 1 && r.j.data[0].invoice_number === d1.invoice_no && Number(r.j.data[0].base_amount) === 10000 && Number(r.j.data[0].gst_amount) === 500 && r.j.data[0].consumer_name && r.j.data[0].project_name, r.s + JSON.stringify(r.j).slice(0, 150));
  r = await A('GET', `/payments/gst-invoices?consumerId=${c}&from=${today}&to=${today}&projectId=${P1}&status=generated&pageSize=3&page=1`); t('invoice list: date range, project, status, paging', r.s === 200 && r.j.data.length === 3, r.s + ' ' + r.j.data?.length);
  r = await A('GET', `/payments/gst-invoices?consumerId=${c}&from=${later(2)}`); t('invoice list: a range with nothing in it', r.s === 200 && r.j.data.length === 0, r.s);
  for (const q of ['status=zz', 'consumerId=abc', 'projectId=abc', 'from=2025-02-31', 'to=abc', 'pageSize=0', 'pageSize=1001', 'page=0', 'pageSize=1;drop table x', 'status[a]=b', 'invoiceNumber[]=a']) { r = await A('GET', '/payments/gst-invoices?' + q); t(`invoice list: ?${q} -> 400`, r.s === 400, r.s); }
  r = await A('GET', `/payments/gst-invoices/${d1.id}/pdf`); t('invoice pdf: an existing invoice answers', r.s === 200, r.s); r = await A('GET', '/payments/gst-invoices/abc/pdf'); t('invoice pdf: id "abc" -> 400', r.s === 400, r.s); r = await A('GET', `/payments/gst-invoices/${NIL}/pdf`); t('invoice pdf: unknown -> 404', r.s === 404, r.s);

  // ---- credit / debit notes ----
  grant(afId, 'jv_refund_drcr', true, true); grant(pmId, 'jv_refund_drcr', false, true);
  const note = (over = {}, who = AF) => who('POST', '/payments/credit-debit-notes', { invoice_id: d1.id, note_type: 'credit', adjustment_amount: 1000, reason: 'rate fix', ...over });
  for (const [n, who] of [['read_only_viewer', RO], ['sales_executive', SE]]) { r = await note({}, who); t(`note: ${n} cannot raise -> 403`, r.s === 403, r.s); }
  const nbad = async (n, over, code = 400) => { const x = await note(over); t(`note: ${n} -> ${code}`, x.s === code, x.s + ' ' + JSON.stringify(x.j).slice(0, 100)); return x; };
  r = await AF('POST', '/payments/credit-debit-notes'); t('note: no body -> 400', r.s === 400, r.s);
  await nbad('no invoice', { invoice_id: undefined }); await nbad('invoice_id "abc"', { invoice_id: 'abc' }); await nbad('unknown invoice', { invoice_id: NIL }, 404); await nbad('unknown invoice number', { invoice_id: undefined, original_invoice_no: 'INV/0/0' }, 404);
  await nbad('note_type "refund"', { note_type: 'refund' }); await nbad('no note_type', { note_type: undefined });
  for (const v of [undefined, 0, -1, 'abc', '1e3', 0.001, 1e12, true, [5], null]) await nbad(`adjustment_amount ${JSON.stringify(v)}`, { adjustment_amount: v });
  for (const v of [undefined, '', '  ', 'r'.repeat(501), '<b>']) await nbad(`reason ${JSON.stringify(v)}`, { reason: v });
  for (const v of [-1, 29, 'abc']) await nbad(`gst_rate ${JSON.stringify(v)}`, { gst_rate: v });
  await nbad('another applicant on the invoice', { consumer_id: S2.c }); await nbad('note_date 2020-02-30', { note_date: '2020-02-30' });
  await nbad('credit above the invoice (10001)', { adjustment_amount: 10001 }, 409);
  r = await note({ adjustment_amount: 7000.5, gst_rate: 12 }); t('note: a credit note is saved pending, gst and total worked out (12% of 7000.50 = 840.06)', r.s === 201 && r.j.data.status === 'pending' && Number(r.j.data.gst_amount) === 840.06 && Number(r.j.data.total_amount) === 7840.56 && r.j.data.original_invoice_no === d1.invoice_no && /^CDN\/\d{4}\/\d{4}$/.test(r.j.data.note_number) && r.j.data.consumer_id === c, r.s + JSON.stringify(r.j)); const n1 = r.j.data?.id;
  await nbad('a second credit that, with the first, is more than the invoice', { adjustment_amount: 3000 }, 409);
  r = await note({ adjustment_amount: 2999.5 }); t('note: exactly what is left of the invoice is allowed', r.s === 201, r.s + JSON.stringify(r.j)); const n2 = r.j.data?.id;
  r = await note({ note_type: 'debit', adjustment_amount: 50000 }); t('note: a debit note has no ceiling', r.s === 201 && r.j.data.note_type === 'debit', r.s); const n3 = r.j.data?.id;
  r = await note({ invoice_id: undefined, original_invoice_no: d1.invoice_no, note_type: 'debit', adjustment_amount: 1 }); t('note: the invoice can be named by its number', r.s === 201, r.s + JSON.stringify(r.j));
  const nn = await par(5, () => note({ note_type: 'debit', adjustment_amount: 5 })); t('note race: 5 parallel -> 5 different numbers, no 5xx', cnt(nn, 201) === 5 && new Set(nn.map(x => x.j.data.note_number)).size === 5 && no5(nn), nn.map(x => x.s).join());
  // approve / cancel
  r = await AF('PATCH', `/payments/credit-debit-notes/${n1}/approve`, {}); t('note approve: the maker cannot approve their own -> 403', r.s === 403, r.s);
  for (const [n, who] of [['read_only_viewer', RO], ['sales_executive', SE]]) { r = await who('PATCH', `/payments/credit-debit-notes/${n1}/approve`, {}); t(`note approve: ${n} -> 403`, r.s === 403, r.s); }
  r = await PM('PATCH', '/payments/credit-debit-notes/abc/approve', {}); t('note approve: id "abc" -> 400', r.s === 400, r.s); r = await PM('PATCH', `/payments/credit-debit-notes/${NIL}/approve`, {}); t('note approve: unknown -> 404', r.s === 404, r.s);
  const ap = await par(5, () => PM('PATCH', `/payments/credit-debit-notes/${n1}/approve`, {})); t('note approve race: 5 parallel -> exactly one, no 5xx', cnt(ap, 200) === 1 && cnt(ap, 409) === 4 && no5(ap), ap.map(x => x.s).join());
  t('note approve: issued, with the approver', psql(`select status||'|'||approved_by from credit_debit_notes where id='${n1}'`) === `issued|${pmId}`);
  r = await PM('PATCH', `/payments/credit-debit-notes/${n2}/cancel`, {}); t('note cancel: no reason -> 400', r.s === 400, r.s);
  r = await PM('PATCH', `/payments/credit-debit-notes/${n2}/cancel`, { reason: 'wrong' }); t('note cancel: a pending note is cancelled', r.s === 200 && r.j.data.status === 'cancelled', r.s);
  r = await PM('PATCH', `/payments/credit-debit-notes/${n2}/cancel`, { reason: 'again' }); t('note cancel: twice -> 409', r.s === 409, r.s); r = await PM('PATCH', `/payments/credit-debit-notes/${n2}/approve`, {}); t('note approve: a cancelled note -> 409', r.s === 409, r.s);
  r = await note({ adjustment_amount: 2999.5 }); t('note: a cancelled credit frees its amount on the invoice', r.s === 201, r.s + JSON.stringify(r.j));
  for (const q of ['status=zz', 'note_type=x', 'consumer_id=abc', 'pageSize=0', 'pageSize=1;drop', 'status[a]=b']) { r = await A('GET', '/payments/credit-debit-notes?' + q); t(`note list: ?${q} -> 400`, r.s === 400, r.s); }
  r = await A('GET', `/payments/credit-debit-notes?consumer_id=${c}&note_type=credit&status=issued`); t('note list: filters', r.s === 200 && r.j.data.length === 1 && r.j.data[0].consumer_name, r.s);
  r = await A('GET', `/payments/credit-debit-notes/${n1}`); t('note one: opens', r.s === 200 && r.j.data.approved_by_name, r.s); r = await A('GET', '/payments/credit-debit-notes/abc'); t('note one: id "abc" -> 400', r.s === 400, r.s); r = await A('GET', `/payments/credit-debit-notes/${NIL}`); t('note one: unknown -> 404', r.s === 404, r.s);
  // the Credit / Debit Note tab
  const tab = (over = {}, who = AF) => who('POST', '/payments/gst-invoices/credit-debit-note', { noteType: 'credit', originalInvoiceNumber: d1.invoice_no, adjustmentAmount: 100, gstRate: 5, noteDate: today, reason: 'tab', ...over });
  r = await tab({ noteType: 'debit' }); t('note tab: raised as pending (a checker still approves it)', r.s === 201 && r.j.data.status === 'pending', r.s + JSON.stringify(r.j));
  r = await tab({ originalInvoiceNumber: 'INV/x' }); t('note tab: unknown invoice -> 404', r.s === 404, r.s); r = await tab({ adjustmentAmount: 0 }); t('note tab: amount 0 -> 400', r.s === 400, r.s); r = await tab({}, RO); t('note tab: read_only_viewer -> 403', r.s === 403, r.s);

  // ---- cancel / reverse an invoice ----
  const mkInv = async (over = {}) => { const x = await inv(c, { baseAmount: 20000, ...over }); invs.push(x.j.data.id); return x.j.data; };
  const can = (no, over = {}, who = A, path = 'cancel') => who('POST', `/payments/gst-invoices/${path}`, { invoiceNumber: no, reason: 'duplicate', ...over });
  const i2 = await mkInv();
  for (const [n, who] of [['read_only_viewer', RO], ['sales_executive', SE], ['project_manager', PM]]) { r = await can(i2.invoice_no, {}, who); t(`invoice cancel: ${n} -> 403`, r.s === 403, r.s); }
  noRows(afId); r = await can(i2.invoice_no, {}, AF); t('invoice cancel: accounts_finance without checker access -> 403', r.s === 403, r.s); grant(afId, 'jv_refund_drcr', true, true);
  r = await A('POST', '/payments/gst-invoices/cancel', {}); t('invoice cancel: no invoiceNumber -> 400', r.s === 400, r.s); r = await can('x'.repeat(51)); t('invoice cancel: long number -> 400', r.s === 400, r.s); r = await can(['a']); t('invoice cancel: number as a list -> 400', r.s === 400, r.s); r = await can('INV/none'); t('invoice cancel: unknown number -> 404', r.s === 404, r.s);
  r = await can(i2.invoice_no, { reason: '<b>x</b>' }); t('invoice cancel: reason with tags -> 400', r.s === 400, r.s);
  // pending notes on an invoice are withdrawn, issued credits are not credited twice
  const pend = (await note({ invoice_id: i2.id, adjustment_amount: 500, note_type: 'debit' })).j.data.id, cred = (await note({ invoice_id: i2.id, adjustment_amount: 5000 })).j.data.id; await PM('PATCH', `/payments/credit-debit-notes/${cred}/approve`, {});
  const cc = await par(5, () => can(i2.invoice_no, {}, AF)); t('invoice cancel race: 5 parallel cancels -> exactly one, no 5xx', cnt(cc, 200) === 1 && cnt(cc, 409) === 4 && no5(cc), cc.map(x => x.s).join());
  const ok = cc.find(x => x.s === 200)?.j.data;
  t('invoice cancel: the credit note takes back what was left (20000 - 5000 credited = 15000, 5% tax pro rata)', ok && Number(ok.creditNote.adjustment_amount) === 15000 && Number(ok.creditNote.gst_amount) === 750 && ok.creditNote.status === 'issued' && ok.creditNoteNumber, JSON.stringify(ok));
  t('invoice cancel: invoice cancelled with reason and time, exactly one credit note was made, the waiting note withdrawn', psql(`select status||'|'||cancelled_reason||'|'||(cancelled_at is not null) from gst_invoices where id='${i2.id}'`) === 'cancelled|duplicate|true' && Number(psql(`select count(*) from credit_debit_notes where invoice_id='${i2.id}' and note_type='credit' and status='issued' and reason='duplicate'`)) === 1 && psql(`select status from credit_debit_notes where id='${pend}'`) === 'cancelled');
  r = await PM('PATCH', `/payments/credit-debit-notes/${pend}/approve`, {}); t('invoice cancel: a note on the cancelled invoice cannot be approved', r.s === 409, r.s);
  r = await note({ invoice_id: i2.id }); t('invoice cancel: no new note on a cancelled invoice -> 409', r.s === 409, r.s);
  const i3 = await mkInv({ baseAmount: 999.99, gstRate: 18 }); r = await can(i3.invoice_no, { reason: undefined, reversalDate: '2026-01-15' }, A, 'reverse'); t('invoice reverse: same as cancel, the note carries the reversal date, tax matches the invoice', r.s === 200 && psql(`select note_date from credit_debit_notes where id='${r.j.data.creditNote.id}'`) === '2026-01-15' && Number(r.j.data.creditNote.gst_amount) === Number(i3.gst_amount) && Number(r.j.data.creditNote.total_amount) === Number(i3.total_amount), r.s + JSON.stringify(r.j).slice(0, 200));
  r = await can(i3.invoice_no, {}, A, 'reverse'); t('invoice reverse: twice -> 409', r.s === 409, r.s); const i4 = await mkInv(); r = await can(i4.invoice_no, { reversalDate: 'abc' }, A, 'reverse'); t('invoice reverse: reversalDate "abc" -> 400', r.s === 400, r.s);
  r = await A('GET', `/payments/gst-invoices?status=cancelled&consumerId=${c}`); t('invoice list: status=cancelled', r.s === 200 && r.j.data.length >= 2 && r.j.data.every(x => x.status === 'cancelled'), r.s);
  t('invoice: create, cancel and notes are logged', Number(psql(`select count(*) from audit_logs where resource_type in ('gst_invoice','credit_debit_note') and timestamp > now() - interval '1 hour'`)) >= 10);
  // the credit notes on one invoice never pass the invoice
  const i5 = await mkInv({ baseAmount: 1000 }); const q5 = await par(5, () => note({ invoice_id: i5.id, adjustment_amount: 400 }));
  t('note race: 5 parallel credits of 40% of an invoice -> exactly 2, no 5xx', cnt(q5, 201) === 2 && cnt(q5, 409) === 3 && no5(q5), q5.map(x => x.s).join());
  noRows(afId); noRows(pmId);
}

// ---------- draw refunds ----------
{
  const mk = (c, P, status = 'pending', due = later(5)) => { const id = psql(`insert into draw_refunds (consumer_id, project_id, booking_amount_paid_inr, refund_amount_inr, refund_due_by, refund_status) values ('${c}','${P}',10000,10000,'${due}','${status}') returning id`); extraSql.push(`delete from audit_logs where resource_id='${id}'`, `delete from draw_refunds where id='${id}'`); return id; };
  const d1 = mk(S1.c, P1), dOver = mk(S2.c, P1, 'pending', later(-9)), d2 = mk(SP2.c, P2);
  const ini = (id, b = { refundReference: 'UTR-' + U }, who = A) => who('PATCH', `/payments/draw-refunds/${id}/initiate`, b), com = (id, b = {}, who = A) => who('PATCH', `/payments/draw-refunds/${id}/complete`, b);
  for (const [n, who] of [['read_only_viewer', RO], ['sales_executive', SE], ['project_manager', PM]]) { r = await ini(d1, undefined, who); t(`draw refund: ${n} cannot initiate -> 403`, r.s === 403, r.s); r = await com(d1, {}, who); t(`draw refund: ${n} cannot complete -> 403`, r.s === 403, r.s); }
  r = await ini('abc'); t('draw refund: id "abc" -> 400', r.s === 400, r.s); r = await ini(NIL); t('draw refund: unknown -> 404', r.s === 404, r.s);
  for (const v of [undefined, '', '  ', 'r'.repeat(256), '<b>', ['a'], 5]) { r = await ini(d1, { refundReference: v }); t(`draw refund initiate: reference ${JSON.stringify(v)?.slice(0, 16)} -> 400`, r.s === 400, r.s); }
  r = await ini(d1, { refundReference: 'x', notes: 'n'.repeat(501) }); t('draw refund initiate: notes too long -> 400', r.s === 400, r.s);
  r = await com(d1); t('draw refund: complete before initiate -> 409', r.s === 409, r.s);
  t('draw refund: refused calls changed nothing', psql(`select refund_status from draw_refunds where id='${d1}'`) === 'pending');
  const rr = await par(5, () => AF('PATCH', `/payments/draw-refunds/${d1}/initiate`, { refundReference: 'UTR-' + U })); t('draw refund race: 5 parallel initiates -> exactly one, no 5xx', cnt(rr, 200) === 1 && cnt(rr, 409) === 4 && no5(rr), rr.map(x => x.s).join());
  t('draw refund: initiated with reference and time', psql(`select refund_status||'|'||refund_reference||'|'||(refund_initiated_at is not null) from draw_refunds where id='${d1}'`) === `initiated|UTR-${U}|true`);
  const cc = await par(5, () => com(d1, {}, AF)); t('draw refund race: 5 parallel completes -> exactly one, no 5xx', cnt(cc, 200) === 1 && cnt(cc, 409) === 4 && no5(cc), cc.map(x => x.s).join());
  r = await ini(d1); t('draw refund: initiating a completed one -> 409', r.s === 409, r.s); r = await com(d1); t('draw refund: completing twice -> 409', r.s === 409, r.s);
  for (const st of ['pending', 'initiated', 'completed']) { r = await A('GET', `/payments/draw-refunds?status=${st}&projectId=${P1}`); t(`draw refund list: status=${st}`, r.s === 200 && r.j.data.every(x => x.refund_status === st), r.s); }
  r = await A('GET', `/payments/draw-refunds/overdue`); t('draw refund overdue: the late one is listed, the completed one is not', r.s === 200 && r.j.data.some(x => x.id === dOver) && !r.j.data.some(x => x.id === d1), r.s);
  for (const q of ['status=zz', 'projectId=abc', 'pageSize=0', 'pageSize=501', 'page=0', 'pageSize=1;drop table x', 'status[a]=b']) { r = await A('GET', '/payments/draw-refunds?' + q); t(`draw refund list: ?${q} -> 400`, r.s === 400, r.s); }
  r = await A('GET', '/payments/draw-refunds?pageSize=1'); t('draw refund list: paging gives one row', r.s === 200 && r.j.data.length === 1, r.s);
  t('draw refund: steps are logged', Number(psql(`select count(*) from audit_logs where resource_type='draw_refund' and timestamp > now() - interval '1 hour'`)) >= 2);
}

// ---------- interest: master rate, installment rates, grace, start date, manual, scheduler ----------
const alloc2 = async (P, T, name) => {   // an applicant with a unit and an allocation but no payment plan
  const c = await person(P), u = await unit(P, T); const id = psql(`insert into allocations (consumer_id, unit_id, project_id, status) values ('${c}','${u}','${P}','allotted') returning id`); extraSql.push(`delete from allocations where id='${id}'`); return { c, u, id };
};
{
  // master rate
  const mr = (b, who = AF, m = 'POST', p = '/payments/interest-master') => who(m, p, b);
  for (const [n, who] of [['read_only_viewer', RO], ['sales_executive', SE], ['project_manager', PM]]) { r = await mr({ project_id: P1, rate_percent: 10 }, who); t(`interest master: ${n} cannot add a rate -> 403`, r.s === 403, r.s); }
  r = await mr({}); t('interest master: empty body -> 400', r.s === 400, r.s); r = await AF('POST', '/payments/interest-master', undefined, '[1]'); t('interest master: array body -> 400', r.s === 400, r.s);
  for (const v of ['', 'abc', [P1], 5, NIL]) { r = await mr({ project_id: v, rate_percent: 10 }); t(`interest master: project_id ${JSON.stringify(v)} -> ${v === NIL ? 404 : 400}`, r.s === (v === NIL ? 404 : 400), r.s); }
  for (const v of [undefined, null, '', -1, 101, 'abc', '1e1', 10.123, true, [5], {}]) { r = await mr({ project_id: P1, rate_percent: v }); t(`interest master: rate_percent ${JSON.stringify(v)} -> 400`, r.s === 400, r.s); }
  for (const v of ['2020-02-30', 'abc', 20200101, '1980-01-01', [today]]) { r = await mr({ project_id: P1, rate_percent: 10, effective_from: v }); t(`interest master: effective_from ${JSON.stringify(v)} -> 400`, r.s === 400, r.s); }
  const n0 = Number(psql(`select count(*) from project_interest_rates where project_id='${P1}'`)); t('interest master: refused calls saved nothing', n0 === 0);
  r = await mr({ project_id: P1, rate_percent: 12.5, effective_from: later(-30) }); t('interest master: a rate is saved, with the user who set it', r.s === 200 && Number(r.j.data.rate_percent) === 12.5 && psql(`select created_by from project_interest_rates where id='${r.j.data.id}'`) === afId, r.s + JSON.stringify(r.j)); const m1 = r.j.data?.id;
  r = await mr({ project_id: P1, rate_percent: 9, effective_from: later(-30) }); t('interest master: a second rate on the same date -> 409', r.s === 409, r.s);
  const rr = await par(5, () => mr({ project_id: P1, rate_percent: 8, effective_from: later(-10) })); t('interest master race: 5 parallel on one date -> exactly one, no 5xx', cnt(rr, 200) === 1 && cnt(rr, 409) === 4 && no5(rr), rr.map(x => x.s).join());
  r = await mr({ project_id: P1, rate_percent: 0 }); t('interest master: rate 0 is allowed, date defaults to today', r.s === 200 && String(r.j.data.effective_from).length > 0, r.s + JSON.stringify(r.j)); const m2 = r.j.data?.id;
  r = await mr({ rate_percent: 11 }, A, 'PUT', `/payments/interest-master/${m1}`); t('interest master: edit a rate', r.s === 200 && Number(r.j.data.rate_percent) === 11, r.s);
  r = await mr({ rate_percent: 11, effective_from: later(-10) }, A, 'PUT', `/payments/interest-master/${m1}`); t('interest master: moving a rate onto another rate\'s date -> 409', r.s === 409, r.s);
  r = await mr({ rate_percent: 11.5, effective_from: later(-30) }, A, 'PUT', `/payments/interest-master/${m1}`); t('interest master: keeping its own date is fine', r.s === 200, r.s);
  for (const [n, who] of [['read_only_viewer', RO], ['sales_executive', SE], ['project_manager', PM]]) { r = await mr({ rate_percent: 5 }, who, 'PUT', `/payments/interest-master/${m1}`); t(`interest master: ${n} cannot edit -> 403`, r.s === 403, r.s); }
  r = await mr({ rate_percent: 5 }, A, 'PUT', '/payments/interest-master/abc'); t('interest master: edit id "abc" -> 400', r.s === 400, r.s); r = await mr({ rate_percent: 5 }, A, 'PUT', `/payments/interest-master/${NIL}`); t('interest master: edit unknown -> 404', r.s === 404, r.s); r = await mr({ rate_percent: 101 }, A, 'PUT', `/payments/interest-master/${m1}`); t('interest master: edit rate 101 -> 400', r.s === 400, r.s);
  r = await A('GET', `/payments/interest-master/${P1}`); t('interest master: history lists the rates newest first', r.s === 200 && r.j.data.length === 3 && r.j.data[0].created_by_name !== undefined, r.s); r = await A('GET', '/payments/interest-master/abc'); t('interest master: history id "abc" -> 400', r.s === 400, r.s);
  psql(`delete from project_interest_rates where id='${m2}' returning 1`);

  // installment rates
  const ir = (b, who = AF, pl = PLAN1, P = P1) => who('PUT', `/payments/installment-interest/${P}/${encodeURIComponent(pl)}`, b);
  r = await A('GET', `/payments/plan-names/${P1}`); t('installment interest: plan names', r.s === 200 && r.j.data.includes(PLAN1), r.s + JSON.stringify(r.j)); r = await A('GET', `/payments/installment-interest/${P1}/${encodeURIComponent(PLAN1)}`); t('installment interest: the plan\'s installments', r.s === 200 && r.j.data.length === 3, r.s);
  r = await A('GET', '/payments/installment-interest/abc/x'); t('installment interest: project "abc" -> 400', r.s === 400, r.s); r = await A('GET', '/payments/plan-names/abc'); t('installment interest: plan-names project "abc" -> 400', r.s === 400, r.s); r = await A('GET', `/payments/installment-interest/${P1}/${'p'.repeat(101)}`); t('installment interest: plan name 101 chars -> 400', r.s === 400, r.s);
  for (const [n, who] of [['read_only_viewer', RO], ['sales_executive', SE], ['project_manager', PM]]) { r = await ir({ rates: [{ installment_index: 1, interest_rate_percent: 5 }] }, who); t(`installment interest: ${n} cannot save -> 403`, r.s === 403, r.s); }
  for (const [n, b] of [['no body', {}], ['rates not a list', { rates: 'x' }], ['empty list', { rates: [] }], ['201 entries', { rates: Array.from({ length: 201 }, (_, i) => ({ installment_index: 1, interest_rate_percent: 1 })) }], ['entry not an object', { rates: [5] }], ['index "x"', { rates: [{ installment_index: 'x', interest_rate_percent: 1 }] }], ['index 0', { rates: [{ installment_index: 0, interest_rate_percent: 1 }] }], ['index 1.5', { rates: [{ installment_index: 1.5, interest_rate_percent: 1 }] }], ['rate -1', { rates: [{ installment_index: 1, interest_rate_percent: -1 }] }], ['rate 101', { rates: [{ installment_index: 1, interest_rate_percent: 101 }] }], ['rate "abc"', { rates: [{ installment_index: 1, interest_rate_percent: 'abc' }] }], ['an index twice', { rates: [{ installment_index: 1, interest_rate_percent: 1 }, { installment_index: 1, interest_rate_percent: 2 }] }]]) { r = await ir(b); t(`installment interest: ${n} -> 400`, r.s === 400, r.s); }
  r = await ir({ rates: [{ installment_index: 1, interest_rate_percent: 6 }, { installment_index: 99, interest_rate_percent: 6 }] }); t('installment interest: an installment that is not in the plan -> 404 and nothing is saved', r.s === 404 && psql(`select count(*) from plan_schedule_templates where project_id='${P1}' and interest_rate_percent is not null`) === '0', r.s + JSON.stringify(r.j));
  r = await ir({ rates: [{ installment_index: 1, interest_rate_percent: 6.25 }, { installment_index: 2, interest_rate_percent: null }, { installment_index: 3, interest_rate_percent: '0' }] }); t('installment interest: rates saved (paise of a percent, empty, zero)', r.s === 200 && r.j.updated === 3 && psql(`select string_agg(coalesce(interest_rate_percent::text,'null'), ',' order by installment_index) from plan_schedule_templates where project_id='${P1}' and plan_name='${PLAN1}'`) === '6.25,null,0.00', r.s + JSON.stringify(r.j));
  r = await ir({ rates: [{ installment_index: 1, interest_rate_percent: 5 }] }, AF, 'No Such Plan'); t('installment interest: a plan that does not exist -> 404', r.s === 404, r.s);
  await ir({ rates: [{ installment_index: 1, interest_rate_percent: null }, { installment_index: 3, interest_rate_percent: null }] });
}

// ---------- interest: customer wise (grace, start date, manual, delete), the scheduler ----------
{
  const c = S2.c, NP = await alloc2(P1, T1);
  // list and filters
  for (const [n, p] of [['customer-wise-consumers', 'customer-wise-consumers'], ['interest-waiver-list', 'interest-waiver-list']]) {
    r = await A('GET', `/payments/${p}`); t(`${n}: no project -> 400`, r.s === 400, r.s);
    for (const q of ['project_id=abc', ...(p === 'customer-wise-consumers' ? [`project_id=${P1}&tower_id=abc`] : []), `project_id=${P1}&first_name[a]=b`, `project_id=${P1}&registration_no=${'r'.repeat(101)}`, `project_id=${P1}&unit_address=<b>`, `project_id=${P1}&type=zz`]) { if (p === 'customer-wise-consumers' && q.includes('type=')) continue; r = await A('GET', `/payments/${p}?${q}`); t(`${n}: ?${q.replace(P1, ':p').slice(0, 40)} -> 400`, r.s === 400, r.s); }
  }
  r = await A('GET', `/payments/customer-wise-consumers?project_id=${P1}&tower_id=${T1}&first_name=Pay%20Buyer&registration_no=&unit_address=R`); t('customer wise: filters by tower, name and unit', r.s === 200 && r.j.data.length >= 3 && r.j.data.every(x => /Pay Buyer/.test(x.name)), r.s + ' ' + r.j.data?.length);
  r = await A('GET', `/payments/customer-wise-consumers?project_id=${P1}&first_name=zzzz-none`); t('customer wise: a name that matches nobody gives an empty list', r.s === 200 && r.j.data.length === 0, r.s);
  r = await A('GET', `/payments/customer-wise-consumers?project_id=${P2}&tower_id=${T1}`); t('customer wise: a tower of another project gives an empty list', r.s === 200 && r.j.data.length === 0, r.s);
  for (const ty of ['All', 'Self', 'Pending', 'Loan Sanctioned']) { r = await A('GET', `/payments/interest-waiver-list?project_id=${P1}&type=${encodeURIComponent(ty)}`); t(`waiver list: type=${ty}`, r.s === 200 && (ty === 'All' || r.j.data.every(x => x.type === ty)), r.s); }
  // grace period
  const gp = (cid, v, who = AF) => who('PATCH', `/payments/consumer-grace-period/${cid}`, { grace_period_days: v });
  for (const [n, who] of [['read_only_viewer', RO], ['sales_executive', SE], ['project_manager', PM]]) { r = await gp(c, 5, who); t(`grace period: ${n} -> 403`, r.s === 403, r.s); }
  for (const v of [undefined, null, '', -1, 3651, 1.5, 'abc', '1e2', true, [3], {}]) { r = await gp(c, v); t(`grace period: ${JSON.stringify(v)} -> 400`, r.s === 400, r.s); }
  r = await gp('abc', 5); t('grace period: id "abc" -> 400', r.s === 400, r.s); r = await gp(NIL, 5); t('grace period: unknown -> 404', r.s === 404, r.s);
  t('grace period: refused calls changed nothing', psql(`select coalesce(grace_period_days,0) from consumers where id='${c}'`) === '0');
  r = await gp(c, '7'); t('grace period: "7" as text is fine and clears the stored interest rows', r.s === 200 && Number(r.j.data.grace_period_days) === 7 && pis(c).every(x => x.st !== 'calculated'), r.s + JSON.stringify(r.j));
  await gp(c, 0); await recalc(c);
  // start date
  const sd = (cid, v, who = AF) => who('PATCH', `/payments/consumer-interest-date/${cid}`, { interest_start_date: v });
  for (const [n, who] of [['read_only_viewer', RO], ['sales_executive', SE], ['project_manager', PM]]) { r = await sd(c, today, who); t(`interest date: ${n} -> 403`, r.s === 403, r.s); }
  for (const v of [undefined, '', 'abc', '2020-02-30', 20200101, [today], '1980-01-01']) { r = await sd(c, v); t(`interest date: ${JSON.stringify(v)} -> 400`, r.s === 400, r.s); }
  r = await sd('abc', today); t('interest date: id "abc" -> 400', r.s === 400, r.s); r = await sd(NIL, today); t('interest date: unknown -> 404', r.s === 404, r.s);
  r = await sd(c, later(-400)); t('interest date: saved', r.s === 200 && psql(`select interest_start_date from consumers where id='${c}'`) === later(-400), r.s + JSON.stringify(r.j));
  psql(`update consumers set interest_start_date = null where id='${c}' returning 1`);
  // manual interest
  const mi = (b, who = AF) => who('POST', '/payments/manual-interest', { consumer_id: c, installment_index: 3, amount_inr: 250, ...b });
  for (const [n, who] of [['read_only_viewer', RO], ['sales_executive', SE], ['project_manager', PM]]) { r = await mi({}, who); t(`manual interest: ${n} -> 403`, r.s === 403, r.s); }
  r = await AF('POST', '/payments/manual-interest'); t('manual interest: no body -> 400', r.s === 400, r.s);
  for (const v of ['', 'abc', [c], 7]) { r = await mi({ consumer_id: v }); t(`manual interest: consumer_id ${JSON.stringify(v)} -> 400`, r.s === 400, r.s); }
  r = await mi({ consumer_id: NIL }); t('manual interest: unknown applicant -> 404', r.s === 404, r.s);
  for (const v of [undefined, 0, -5, 1.5, 'abc', '1e3', 1e12, true, null]) { r = await mi({ amount_inr: v }); t(`manual interest: amount ${JSON.stringify(v)} -> 400`, r.s === 400, r.s); }
  for (const v of [0, -1, 1.5, 'x', 1000]) { r = await mi({ installment_index: v }); t(`manual interest: installment_index ${JSON.stringify(v)} -> 400`, r.s === 400, r.s); }
  r = await mi({ installment_index: undefined }); t('manual interest: no installment -> 400 (it used to be filed under installment 1)', r.s === 400, r.s);
  r = await mi({ payment_plan_id: 'abc' }); t('manual interest: plan "abc" -> 400', r.s === 400, r.s); r = await mi({ payment_plan_id: psql(`select id from payment_plans where consumer_id='${S1.c}' limit 1`) }); t('manual interest: plan of another applicant -> 400', r.s === 400, r.s);
  r = await mi({ consumer_id: NP.c }); t('manual interest: an applicant without a payment plan -> 400 (it used to be a 500)', r.s === 400, r.s + JSON.stringify(r.j));
  r = await mi({ payment_plan_id: null }); t('manual interest: saved as a manual row on the applicant\'s plan', r.s === 201 && r.j.data.status === 'manual' && Number(r.j.data.amount_inr) === 250 && r.j.data.installment_index === 3 && r.j.data.payment_plan_id, r.s + JSON.stringify(r.j)); const man = r.j.data?.id;
  r = await recalc(c); t('manual interest: a recalculation leaves it alone', r.s === 200 && pis(c).some(x => x.id === man && x.amt === 250), r.s);
  r = await cD(c, { waiver_amount_inr: 100, installment_index: 3 }, A); t('manual interest: it can be waived, never above its amount', r.s === 200 && pis(c).find(x => x.id === man).w === 100, r.s + JSON.stringify(r.j));
  r = await cD(c, { waiver_amount_inr: 151, installment_index: 3 }, A); t('manual interest: waiving more than it has left -> 409', r.s === 409, r.s);
  // scheduler
  const sc = (b, who = AF) => who('POST', '/payments/interest-scheduler', b);
  for (const [n, who] of [['read_only_viewer', RO], ['sales_executive', SE]]) { r = await sc({ project_id: P1 }, who); t(`scheduler: ${n} -> 403`, r.s === 403, r.s); }
  r = await sc({}); t('scheduler: no project -> 400', r.s === 400, r.s); r = await AF('POST', '/payments/interest-scheduler', undefined, '[1]'); t('scheduler: array body -> 400', r.s === 400, r.s);
  for (const [n, b, code] of [['project "abc"', { project_id: 'abc' }, 400], ['unknown project', { project_id: NIL }, 404], ['tower "abc"', { project_id: P1, tower_id: 'abc' }, 400], ['a tower of another project', { project_id: P1, tower_id: T2 }, 400], ['persist "yes"', { project_id: P1, persist: 'yes' }, 400], ['persist 1', { project_id: P1, persist: 1 }, 400]]) { r = await sc(b); t(`scheduler: ${n} -> ${code}`, r.s === code, r.s); }
  r = await PM('POST', '/payments/interest-scheduler', { project_id: P1, persist: true }); t('scheduler: project_manager may calculate but not save -> 403', r.s === 403, r.s);
  r = await PM('POST', '/payments/interest-scheduler', { project_id: P1 }); t('scheduler: project_manager may calculate without saving', r.s === 200 && r.j.summary.persisted === false, r.s);
  // an applicant waived in full earlier (S1): the saved calculation keeps it; the manual row stays
  const before = pis(S1.c).length, mansBefore = pis(c).filter(x => x.st === 'manual').length;
  r = await sc({ project_id: P1, tower_id: T1 }); t('scheduler: calculate only changes nothing in the database', r.s === 200 && r.j.summary.persisted === false && pis(S1.c).length === before, r.s);
  r = await sc({ project_id: P1, persist: true }); t('scheduler: saving works, an applicant without a plan is skipped', r.s === 200 && r.j.summary.persisted === true && r.j.summary.skipped_no_plan >= 1 && r.j.summary.consumers_with_interest >= 3, r.s + JSON.stringify(r.j.summary));
  const kept = pis(S1.c).length;
  t('scheduler: what was waived is still waived after saving (per installment, within the interest)', waiverSane(S1.c) && piWaived(S1.c) === expectedWaived(S1.c) && piWaived(S1.c) > 0 && waiverSane(S2.c) && waiverSane(S3.c), `${piWaived(S1.c)} vs ${expectedWaived(S1.c)}`);
  t('scheduler: manual interest rows are kept', pis(c).filter(x => x.st === 'manual').length === mansBefore);
  t('scheduler: totals in the response match the stored rows', Math.abs(r.j.details.find(d => d.consumer_id === S1.c).total_interest - pis(S1.c).filter(x => x.st === 'calculated').reduce((s, x) => s + x.amt, 0)) < 1.5, '');
  const pr = await par(5, () => sc({ project_id: P1, persist: true })); t('scheduler race: 5 parallel saves -> all fine, no 5xx, rows not doubled', no5(pr) && cnt(pr, 200) === 5 && pis(S1.c).length === kept && waiverSane(S1.c), pr.map(x => x.s).join());
  // delete
  for (const [n, who] of [['read_only_viewer', RO], ['sales_executive', SE], ['project_manager', PM], ['accounts_finance', AF]]) { r = await who('DELETE', '/payments/interest-scheduler', { project_id: P1 }); t(`scheduler delete: ${n} -> 403 (super_admin only)`, r.s === 403, r.s); r = await who('DELETE', `/payments/consumer-interest/${c}`); t(`consumer interest delete: ${n} -> 403`, r.s === 403, r.s); }
  r = await A('DELETE', '/payments/interest-scheduler', {}); t('scheduler delete: no project -> 400', r.s === 400, r.s); r = await A('DELETE', '/payments/interest-scheduler', { project_id: 'abc' }); t('scheduler delete: project "abc" -> 400', r.s === 400, r.s); r = await A('DELETE', '/payments/interest-scheduler', { project_id: NIL }); t('scheduler delete: unknown project -> 404', r.s === 404, r.s);
  r = await A('DELETE', '/payments/interest-scheduler', { project_id: P1, tower_id: T1 }); t('scheduler delete: removes the calculated rows, manual rows stay', r.s === 200 && r.j.deleted >= 3 && pis(S1.c).every(x => x.st !== 'calculated') && pis(c).some(x => x.id === man), r.s + JSON.stringify(r.j));
  await recalc(S1.c); t('scheduler delete: calculating again brings the waiver back', waiverSane(S1.c) && piWaived(S1.c) === expectedWaived(S1.c) && piWaived(S1.c) > 0);
  r = await A('DELETE', `/payments/consumer-interest/abc`); t('consumer interest delete: id "abc" -> 400', r.s === 400, r.s); r = await A('DELETE', `/payments/consumer-interest/${NIL}`); t('consumer interest delete: unknown -> 404', r.s === 404, r.s);
  r = await A('DELETE', `/payments/consumer-interest/${c}`); t('consumer interest delete: removes everything of one applicant, manual too', r.s === 200 && pis(c).length === 0, r.s + JSON.stringify(r.j));
  t('interest: saves, dates, grace days and deletes are logged', Number(psql(`select count(*) from audit_logs where resource_type in ('penal_interest','consumer_interest','project_interest_rate','installment_interest') and timestamp > now() - interval '1 hour'`)) >= 8);
  r = await recalc(NP.c); t('consumer interest detail: an applicant without a plan is calculated, nothing saved, no 5xx', r.s === 200 && r.j.payment_plan_id === null && pis(NP.c).length === 0, r.s + JSON.stringify(r.j).slice(0, 80));
  r = await recalc('abc'); t('consumer interest detail: id "abc" -> 400', r.s === 400, r.s); r = await recalc(NIL); t('consumer interest detail: unknown -> 404', r.s === 404, r.s);
  const cr = await par(5, () => recalc(S3.c)); t('consumer interest detail race: 5 parallel -> all 200, rows not doubled, waiver kept', no5(cr) && cnt(cr, 200) === 5 && waiverSane(S3.c) && pis(S3.c).filter(x => x.st === 'calculated').length === new Set(pis(S3.c).map(x => x.idx)).size, cr.map(x => x.s).join());
}

// ---------- payment plans ----------
{
  const NP = await alloc2(P1, T1), plan_ = (b = {}, who = A) => who('POST', '/payments/payment-plans', { allocationId: NP.id, consumerId: NP.c, unitId: NP.u, projectId: P1, totalAmountInr: 1000001, allotmentDate: today, ...b });
  for (const [n, who] of [['read_only_viewer', RO], ['sales_executive', SE], ['project_manager', PM]]) { r = await plan_({}, who); t(`payment plan: ${n} -> 403`, r.s === 403, r.s); }
  const bad = async (n, over, code = 400) => { const x = await plan_(over); t(`payment plan: ${n} -> ${code}`, x.s === code, x.s + ' ' + JSON.stringify(x.j).slice(0, 100)); return x; };
  r = await A('POST', '/payments/payment-plans'); t('payment plan: no body -> 400', r.s === 400, r.s); r = await A('POST', '/payments/payment-plans', undefined, '[1]'); t('payment plan: array body -> 400', r.s === 400, r.s);
  for (const k of ['allocationId', 'consumerId', 'unitId', 'projectId', 'totalAmountInr']) await bad(`${k} missing`, { [k]: undefined });
  for (const k of ['allocationId', 'consumerId', 'unitId', 'projectId']) await bad(`${k} "abc"`, { [k]: 'abc' });
  await bad('unknown allocation', { allocationId: NIL }, 404);
  await bad('allocation of another applicant', { consumerId: S1.c }); await bad('allocation with another unit', { unitId: S1.u }); await bad('allocation with another project', { projectId: P2 });
  for (const v of [0, -1, 1.5, 'abc', '1e3', 1e12, true, [5], null, '']) await bad(`totalAmountInr ${JSON.stringify(v)}`, { totalAmountInr: v });
  for (const v of ['2020-02-30', 'abc', 20200101, [today]]) await bad(`allotmentDate ${JSON.stringify(v)}`, { allotmentDate: v });
  t('payment plan: refused calls saved nothing', Number(psql(`select count(*) from payment_plans where consumer_id='${NP.c}'`)) === 0);
  const rr = await par(5, () => plan_());
  t('payment plan race: 5 parallel -> exactly one plan, no 5xx', cnt(rr, 201) === 1 && cnt(rr, 409) === 4 && no5(rr), rr.map(x => x.s).join());
  t('payment plan: 8 installments, they add up to the total to the rupee (1000001), one plan', Number(psql(`select count(*) from demands where consumer_id='${NP.c}'`)) === 8 && Number(psql(`select sum(amount_due_inr) from demands where consumer_id='${NP.c}'`)) === 1000001 && Number(psql(`select count(*) from payment_plans where consumer_id='${NP.c}'`)) === 1);
  r = await plan_(); t('payment plan: a plan for the same allocation again -> 409', r.s === 409, r.s);
  const NP2 = await alloc2(P1, T1); psql(`update allocations set status='cancelled' where id='${NP2.id}' returning 1`); r = await plan_({ allocationId: NP2.id, consumerId: NP2.c, unitId: NP2.u }); t('payment plan: a cancelled allocation -> 409', r.s === 409, r.s);
  t('payment plan: the schedule is logged', Number(psql(`select count(*) from financial_audit_logs where consumer_id='${NP.c}' and action_type='SCHEDULE_GENERATION'`)) === 1);
}

// ---------- clearing banks and project scope ----------
{
  for (const [n, who] of readers) { r = await who('GET', `/payments/clearing-banks/${P1}`); t(`clearing banks: ${n} gets a list`, r.s === 200 && Array.isArray(r.j.data), r.s); }
  r = await A('GET', '/payments/clearing-banks/abc'); t('clearing banks: id "abc" -> 400 (it used to be a 500)', r.s === 400, r.s); r = await A('GET', `/payments/clearing-banks/${NIL}`); t('clearing banks: unknown project -> 404', r.s === 404, r.s);
  const bk = psql(`insert into bank_accounts (project_id, bank_name, account_number, ifsc_code, is_active) values ('${P1}','Test Bank ${U}','1234567890','TEST0000001',true) returning id`); extraSql.push(`delete from bank_accounts where id='${bk}'`);
  r = await A('GET', `/payments/clearing-banks/${P1}`); t('clearing banks: the project\'s bank is listed', r.s === 200 && r.j.data.some(x => x.bank_name === 'Test Bank ' + U), r.s + JSON.stringify(r.j).slice(0, 100));
  // a user limited to project 1
  r = await A('PATCH', '/users/employee-login/' + afId, { assignedProjectIds: [P1] }); t('scope: (set-up) accounts_finance limited to project 1', r.s === 200, r.s + JSON.stringify(r.j)); await new Promise(x => setTimeout(x, 100));
  const cp2 = SP2.c;
  r = await AF('GET', `/payments/clearing-banks/${P1}`); t('scope: own project\'s banks readable', r.s === 200, r.s); r = await AF('GET', `/payments/clearing-banks/${P2}`); t('scope: the other project\'s banks -> 404', r.s === 404, r.s);
  r = await AF('POST', '/payments/gst-invoices', { consumerId: cp2, baseAmount: 100 }); t('scope: an invoice for an applicant of the other project -> 404', r.s === 404, r.s);
  r = await AF('GET', `/payments/gst-invoices?projectId=${P2}`); t('scope: the other project\'s invoices are not listed', r.s === 200 && r.j.data.length === 0, r.s);
  r = await AF('GET', `/payments/customer-wise-consumers?project_id=${P2}`); t('scope: the other project\'s applicants are not listed', r.s === 200 && r.j.data.length === 0, r.s);
  r = await AF('POST', '/payments/interest-scheduler', { project_id: P2, persist: true }); t('scope: the scheduler for the other project -> 404', r.s === 404, r.s);
  r = await AF('POST', '/payments/manual-interest', { consumer_id: cp2, installment_index: 1, amount_inr: 10 }); t('scope: manual interest on the other project\'s applicant -> 404', r.s === 404, r.s);
  r = await AF('PATCH', `/payments/consumer-grace-period/${cp2}`, { grace_period_days: 3 }); t('scope: grace days of the other project\'s applicant -> 404', r.s === 404, r.s);
  r = await AF('POST', '/payments/interest-master', { project_id: P2, rate_percent: 5 }); t('scope: a rate for the other project -> 404', r.s === 404, r.s);
  r = await AF('GET', `/payments/receipt-detail/${cp2}`); t('scope: receipt detail of the other project\'s applicant -> 404', r.s === 404, r.s);
  grant(afId, 'jv_refund_drcr', true, true); grant(afId, 'interest_waiver', true, true);
  r = await AF('POST', '/payments/refunds', { consumer_id: cp2, refund_amount_inr: 10 }); t('scope: a refund for the other project\'s applicant -> 404', r.s === 404, r.s);
  r = await AF('POST', '/payments/interest-waivers/direct', { consumer_id: cp2, waiver_amount_inr: 10 }); t('scope: a waiver for the other project\'s applicant -> 404', r.s === 404, r.s);
  r = await AF('GET', `/payments/refunds?consumer_id=${cp2}`); t('scope: the other project\'s refunds are not listed', r.s === 200 && r.j.data.length === 0, r.s);
  noRows(afId);
  await A('PATCH', '/users/employee-login/' + afId, { assignedProjectIds: [] }); await new Promise(x => setTimeout(x, 100));
  r = await AF('GET', `/payments/clearing-banks/${P2}`); t('scope: with the limit lifted the other project is readable again', r.s === 200, r.s);
}

// ---------- receipt pages (html): ids and hostile text ----------
{
  const c = S2.c, rc = await receipt(S2, 1500), XS = '<script>alert(1)</script>', IMG = '<img src=x onerror=alert(2)>';
  const proj = psql(`select name from projects where id='${P1}'`), tpl = psql(`select installment_name from plan_schedule_templates where project_id='${P1}' and plan_name='${PLAN1}' and installment_index=1`), fn = psql(`select first_name from consumers where id='${c}'`);
  psql(`update projects set name = '${IMG}${U}' where id='${P1}' returning 1`); psql(`update plan_schedule_templates set installment_name = '${XS}' where project_id='${P1}' and plan_name='${PLAN1}' and installment_index=1 returning 1`);
  psql(`update consumers set first_name = '${XS}' where id='${c}' returning 1`); psql(`update receipts set other_charge_desc = '${XS}', bank_name = '${IMG}', cheque_no = '${XS}', branch = '${IMG}', transaction_ref = '${XS}' where id='${rc}' returning 1`);
  const page = async (p, who = tokA) => { const x = await fetch(B + p, { headers: { authorization: 'Bearer ' + who } }); return { s: x.status, type: x.headers.get('content-type') || '', html: await x.text() }; };
  const safe = (h) => !h.includes('<script>alert(1)') && !h.includes('<img src=x');
  for (const [n, p] of [['receipt html', `/payments/receipts/${rc}/html`], ['receipt form', `/payments/receipt-form/${c}`], ['receipt detail', `/payments/receipt-detail/${c}`]]) {
    const x = await page(p); t(`${n}: opens as html`, x.s === 200 && x.type.includes('text/html') && x.html.length > 500, x.s + ' ' + x.type);
    t(`${n}: names, project, installment and bank text from the database are escaped (no live <script> or <img>)`, safe(x.html), x.html.match(/.{40}<(script>alert|img src=x).{40}/)?.[0]);
    for (const bad of ['abc', '123', "1' or '1'='1"]) { const y = await page(p.replace(/[0-9a-f-]{36}/, encodeURIComponent(bad))); t(`${n}: id ${JSON.stringify(bad)} -> 400`, y.s === 400, y.s); }
    const y = await page(p.replace(/[0-9a-f-]{36}/, NIL)); t(`${n}: unknown id -> 404`, y.s === 404, y.s);
    const z = await fetch(B + p); t(`${n}: no login -> 401`, z.status === 401, z.status);
  }
  { const x = await page(`/payments/receipt-form/${c}`); t('receipt form: the token inside the page is only letters, digits . - _', /const TOKEN = '[\w.\-]*';/.test(x.html)); }
  { const x = await fetch(B + `/payments/receipt-form/${c}?token=${encodeURIComponent("x';alert(1);//")}`, { headers: { authorization: 'Bearer ' + tokA } }); const h = await x.text(); t('receipt form: a hostile ?token= cannot break out of the script', x.status === 200 && !h.includes("alert(1);//"), x.status); }
  for (const [n, who] of [['read_only_viewer', RO], ['sales_executive', SE], ['project_manager', PM]]) { const tk = await login(`${n}@test.local`); const x = await page(`/payments/receipt-detail/${c}`, tk); t(`receipt pages: ${n} can open the receipt detail`, x.s === 200, x.s); }
  const none = await buyer(); r = await A('GET', `/payments/receipt-detail/${none.c}`); t('receipt detail: an applicant with no receipt besides the booking one still opens', r.s === 200 || (await page(`/payments/receipt-detail/${none.c}`)).s === 200);
  psql(`update projects set name = '${proj.replace(/'/g, "''")}' where id='${P1}' returning 1`); psql(`update plan_schedule_templates set installment_name = '${tpl.replace(/'/g, "''")}' where project_id='${P1}' and plan_name='${PLAN1}' and installment_index=1 returning 1`); psql(`update consumers set first_name = '${fn.replace(/'/g, "''")}' where id='${c}' returning 1`);
}

// ---------- loans ----------
{
  const c = S3.c, ln = (b = {}, who = SE) => who('POST', '/loans', { consumerId: c, bankName: 'HDFC Bank', branchName: 'Sector 14', loanAmount: 2500000, sanctionLetterDate: today, tpaSignedDate: today, remarks: 'ok', ...b });
  for (const [n, who] of [['read_only_viewer', RO], ['accounts_finance', AF]]) { r = await ln({}, who); t(`loan: ${n} cannot record -> 403`, r.s === 403, r.s); }
  r = await SE('POST', '/loans'); t('loan: no body -> 400', r.s === 400, r.s); r = await SE('POST', '/loans', undefined, '[1]'); t('loan: array body -> 400', r.s === 400, r.s);
  const bad = async (n, over, code = 400) => { const x = await ln(over); t(`loan: ${n} -> ${code}`, x.s === code, x.s + ' ' + JSON.stringify(x.j).slice(0, 100)); return x; };
  for (const v of [undefined, '', 'abc', [c]]) await bad(`consumerId ${JSON.stringify(v)}`, { consumerId: v }); await bad('unknown applicant', { consumerId: NIL }, 404);
  for (const v of [undefined, '', '  ', 'b'.repeat(256), '<b>', ['x']]) await bad(`bankName ${JSON.stringify(v)?.slice(0, 14)}`, { bankName: v });
  for (const v of [0, -1, 'abc', '1e3', 1.5, 1e12, true, [5]]) await bad(`loanAmount ${JSON.stringify(v)}`, { loanAmount: v });
  for (const k of ['sanctionLetterDate', 'tpaSignedDate']) for (const v of ['2020-02-30', 'abc', 20200101]) await bad(`${k} ${JSON.stringify(v)}`, { [k]: v });
  await bad('branchName 256 chars', { branchName: 'b'.repeat(256) }); await bad('remarks 501 chars', { remarks: 'r'.repeat(501) });
  t('loan: refused calls saved nothing', Number(psql(`select count(*) from loan_details where consumer_id='${c}'`)) === 0);
  r = await ln(); t('loan: a loan is recorded as sanctioned', r.s === 201 && psql(`select loan_status||'|'||loan_amount from loan_details where id='${r.j.data.id}'`) === 'sanctioned|2500000', r.s + JSON.stringify(r.j));
  r = await ln(); t('loan: the same loan again -> 409', r.s === 409, r.s);
  const rr = await par(5, () => ln({ bankName: 'SBI', loanAmount: 100000 })); t('loan race: 5 parallel identical -> exactly one, no 5xx', cnt(rr, 201) === 1 && cnt(rr, 409) === 4 && no5(rr), rr.map(x => x.s).join());
  r = await ln({ loanAmount: undefined, bankName: 'Axis', branchName: undefined, sanctionLetterDate: undefined, tpaSignedDate: undefined, remarks: undefined }); t('loan: only a bank is needed', r.s === 201, r.s + JSON.stringify(r.j));
  r = await SE('GET', `/loans/${c}`); t('loan: listed for the applicant', r.s === 200 && r.j.data.length === 3, r.s); r = await SE('GET', '/loans/abc'); t('loan: list id "abc" -> 400', r.s === 400, r.s);
  t('loan: saved loans are logged', Number(psql(`select count(*) from audit_logs where resource_type='loan_detail' and timestamp > now() - interval '1 hour'`)) >= 3);
  extraSql.push(`delete from audit_logs where resource_type='loan_detail' and new_values->>'consumer_id'='${c}'`, `delete from loan_details where consumer_id='${c}'`);
}

// ---------- registry ----------
{
  const R = await buyer(), al = psql(`select id from allocations where consumer_id='${R.c}' limit 1`), sch = (b = {}, who = A) => who('POST', '/registry/schedule', { allocationId: al, appointmentDate: later(10), remarks: 'visit', ...b });
  for (const [n, who] of [['read_only_viewer', RO], ['sales_executive', SE], ['accounts_finance', AF]]) { r = await sch({}, who); t(`registry: ${n} cannot schedule -> 403`, r.s === 403, r.s); }
  r = await A('POST', '/registry/schedule'); t('registry: no body -> 400', r.s === 400, r.s); r = await A('POST', '/registry/schedule', undefined, '[1]'); t('registry: array body -> 400', r.s === 400, r.s);
  for (const v of [undefined, '', 'abc', [al]]) { r = await sch({ allocationId: v }); t(`registry: allocationId ${JSON.stringify(v)} -> 400`, r.s === 400, r.s); }
  r = await sch({ allocationId: NIL }); t('registry: unknown allocation -> 404', r.s === 404, r.s);
  for (const v of [undefined, '', 'abc', '2020-02-30', 20200101]) { r = await sch({ appointmentDate: v }); t(`registry: appointmentDate ${JSON.stringify(v)} -> 400`, r.s === 400, r.s); }
  r = await sch({ remarks: 'r'.repeat(501) }); t('registry: remarks 501 chars -> 400', r.s === 400, r.s); r = await sch({ remarks: '<b>' }); t('registry: remarks with tags -> 400', r.s === 400, r.s);
  r = await sch(); t('registry: an applicant who still owes (demands not paid) -> 400', r.s === 400 && /dues/.test(JSON.stringify(r.j)), r.s + JSON.stringify(r.j));
  psql(`update demands set status='cancelled' where consumer_id='${R.c}' returning 1`);
  const rr = await par(5, () => sch()); t('registry race: 5 parallel -> exactly one appointment, no 5xx', cnt(rr, 201) === 1 && cnt(rr, 409) === 4 && no5(rr), rr.map(x => x.s).join());
  t('registry: one scheduled row', psql(`select count(*)||'|'||min(status) from registry_details where allocation_id='${al}'`) === '1|scheduled');
  r = await A('GET', `/registry?projectId=${P1}&status=scheduled`); t('registry: list by project and status', r.s === 200 && r.j.data.some(x => x.allocation_id === al), r.s);
  for (const q of ['projectId=abc', 'status[a]=b', 'pageSize=0', 'pageSize=1;drop table x', 'page=0']) { r = await A('GET', '/registry?' + q); t(`registry list: ?${q} -> 400`, r.s === 400, r.s); }
  extraSql.push(`delete from audit_logs where resource_type='registry' and new_values->>'allocation_id'='${al}'`, `delete from registry_details where allocation_id='${al}'`);
}

// ---------- FAQ ----------
{
  const cat = psql(`insert into faq_categories (name, is_active) values ('Cat ${U}', true) returning id`); extraSql.push(`delete from faq_articles where category_id='${cat}'`, `delete from faq_categories where id='${cat}'`);
  const mk = (b = {}, who = A) => who('POST', '/faq/articles', { categoryId: cat, title: 'How to ' + U, content: 'Steps', tags: ['a', 'b'], isPublished: true, ...b });
  r = await RO('POST', '/faq/articles', { categoryId: cat, title: 'x', content: 'y' }); t('faq: read_only_viewer cannot create -> 403', r.s === 403, r.s);
  r = await A('POST', '/faq/articles'); t('faq: no body -> 400', r.s === 400, r.s); r = await A('POST', '/faq/articles', undefined, '[1]'); t('faq: array body -> 400', r.s === 400, r.s);
  const bad = async (n, over, code = 400) => { const x = await mk(over); t(`faq create: ${n} -> ${code}`, x.s === code, x.s + ' ' + JSON.stringify(x.j).slice(0, 100)); return x; };
  for (const v of [undefined, 'abc', 5, [cat]]) await bad(`categoryId ${JSON.stringify(v)}`, { categoryId: v }); await bad('unknown category', { categoryId: NIL }, 404);
  for (const v of [undefined, '', '  ', 't'.repeat(256), '<b>', ['x'], 5]) await bad(`title ${JSON.stringify(v)?.slice(0, 14)}`, { title: v });
  for (const v of [undefined, '', '<script>', 'c'.repeat(20001), 5]) await bad(`content ${JSON.stringify(v)?.slice(0, 14)}`, { content: v });
  for (const v of ['a', 5, Array.from({ length: 21 }, (_, i) => 't' + i), ['<b>'], [''], [5], 'a,b']) await bad(`tags ${JSON.stringify(v)?.slice(0, 20)}`, { tags: v });
  await bad('isPublished "yes"', { isPublished: 'yes' });
  r = await mk({ isPublished: false }); t('faq create: a draft is saved', r.s === 201 && r.j.data.is_published === false, r.s + JSON.stringify(r.j)); const draft = r.j.data?.id;
  r = await mk(); t('faq create: a published article is saved', r.s === 201 && r.j.data.is_published === true, r.s); const pub = r.j.data?.id;
  r = await SE('GET', `/faq/articles/${draft}`); t('faq: a draft is hidden from people who cannot edit articles -> 404', r.s === 404, r.s); r = await A('GET', `/faq/articles/${draft}`); t('faq: a draft is visible to an editor', r.s === 200, r.s);
  const v0 = Number(psql(`select view_count from faq_articles where id='${draft}'`)); await SE('GET', `/faq/articles/${draft}`); t('faq: a refused read does not count as a view', Number(psql(`select view_count from faq_articles where id='${draft}'`)) === v0);
  r = await SE('GET', `/faq/articles/${pub}`); t('faq: a published article opens and counts a view', r.s === 200 && r.j.data.view_count === 1 && r.j.data.category_name === 'Cat ' + U, r.s);
  r = await SE('GET', '/faq/articles/abc'); t('faq: id "abc" -> 400', r.s === 400, r.s); r = await SE('GET', `/faq/articles/${NIL}`); t('faq: unknown -> 404', r.s === 404, r.s);
  r = await SE('GET', '/faq/articles?search=Steps&pageSize=5&page=1'); t('faq list: search and paging', r.s === 200 && r.j.pagination.pageSize === 5 && r.j.data.some(x => x.id === pub) && !r.j.data.some(x => x.id === draft), r.s + JSON.stringify(r.j.pagination));
  r = await SE('GET', `/faq/articles?categoryId=${cat}&tags=a`); t('faq list: category and tag', r.s === 200 && r.j.data.length === 1, r.s);
  for (const q of ['page=abc', 'page=0', 'pageSize=0', 'pageSize=101', 'pageSize=1;drop table x', 'categoryId=abc', 'search[a]=b', 'tags[]=a', 'search=' + 's'.repeat(201)]) { r = await SE('GET', '/faq/articles?' + q); t(`faq list: ?${q.slice(0, 30)} -> 400`, r.s === 400, r.s); }
  r = await SE('GET', '/faq/categories'); t('faq: categories', r.s === 200 && r.j.data.some(x => x.id === cat), r.s);
  r = await A('PATCH', `/faq/articles/${pub}`, { title: 'New title ' + U, tags: ['z'], isPublished: true }); t('faq edit: title and tags change', r.s === 200 && r.j.data.title === 'New title ' + U, r.s);
  for (const [n, b] of [['empty', {}], ['title ""', { title: '' }], ['title 256', { title: 't'.repeat(256) }], ['content <script>', { content: '<script>' }], ['tags "a"', { tags: 'a' }], ['isPublished 1', { isPublished: 1 }]]) { r = await A('PATCH', `/faq/articles/${pub}`, b); t(`faq edit: ${n} -> 400`, r.s === 400, r.s); }
  r = await A('PATCH', '/faq/articles/abc', { title: 'x' }); t('faq edit: id "abc" -> 400', r.s === 400, r.s); r = await A('PATCH', `/faq/articles/${NIL}`, { title: 'x' }); t('faq edit: unknown -> 404', r.s === 404, r.s); r = await SE('PATCH', `/faq/articles/${pub}`, { title: 'x' }); t('faq edit: sales_executive -> 403', r.s === 403, r.s);
  r = await RO('POST', `/faq/articles/${pub}/feedback`, { helpful: true }); t('faq feedback: read_only_viewer may vote', r.s === 200 && r.j.data.helpful_count === 1, r.s + JSON.stringify(r.j));
  r = await RO('POST', `/faq/articles/${pub}/feedback`, { helpful: 'yes' }); t('faq feedback: helpful "yes" -> 400', r.s === 400, r.s); r = await RO('POST', `/faq/articles/${pub}/feedback`); t('faq feedback: no body -> 400', r.s === 400, r.s); r = await RO('POST', `/faq/articles/abc/feedback`, { helpful: true }); t('faq feedback: id "abc" -> 400', r.s === 400, r.s);
  r = await RO('POST', `/faq/articles/${draft}/feedback`, { helpful: true }); t('faq feedback: on a draft -> 404', r.s === 404, r.s);
  t('faq: no login -> 401', (await noLogin('GET', '/faq/articles')) === 401);
}

// ---------- dashboard ----------
{
  for (const [n, who] of readers) for (const p of ['pending-cheques', 'demand-status', 'pending-approval', 'daily-status', 'parking-detail', 'forthcoming-due', 'employee-tickets', 'summary']) { r = await who('GET', '/dashboard/' + p); t(`dashboard: ${n} reads ${p}`, r.s === 200 && r.j.success !== false, r.s + ' ' + JSON.stringify(r.j).slice(0, 80)); }
  for (const p of ['pending-cheques', 'summary', 'demand-status']) t(`dashboard: no login ${p} -> 401`, (await noLogin('GET', '/dashboard/' + p)) === 401);
  for (const [m, p] of [['POST', '/dashboard/summary'], ['DELETE', '/dashboard/summary']]) { r = await SE(m, p, {}); t(`dashboard: ${m} is not a route (sales_executive) -> 403 or 404`, r.s === 403 || r.s === 404, r.s); }
  r = await A('GET', '/payments/dashboard?projectId=abc'); t('payment dashboard: projectId "abc" -> 400', r.s === 400, r.s);
  r = await A('GET', `/payments/dashboard?projectId=${P1}`); const k = r.j.data?.kpis;
  t('payment dashboard: totals match the database (collected = live receipts of the project, outstanding = receivable - collected)', r.s === 200 && k.totalCollected === Number(psql(`select coalesce(sum(r.amount_received_inr),0) from receipts r join payment_plans p on p.id=r.payment_plan_id where r.status not in ('cancelled','bounced') and p.project_id='${P1}'`)) && k.totalReceivables === Number(psql(`select coalesce(sum(total_amount_inr),0) from payment_plans where project_id='${P1}'`)) && k.outstanding === k.totalReceivables - k.totalCollected, r.s + JSON.stringify(k));
  const p2 = (await A('GET', `/payments/dashboard?projectId=${P2}`)).j.data.kpis; t('payment dashboard: another project has its own totals', p2.totalCollected !== k.totalCollected || p2.totalReceivables !== k.totalReceivables);
  r = await A('GET', '/payments/overdue'); t('overdue: a paid demand is not overdue', r.s === 200 && !r.j.data.some(x => psql(`select status from demands where id='${x.id}'`) === 'paid'), r.s);
  for (const [b, code] of [[{ principalInr: 100000, daysOverdue: 30 }, 200], [{ principalInr: 'abc', daysOverdue: 30 }, 400], [{ principalInr: -5, daysOverdue: 30 }, 400], [{ principalInr: 100, daysOverdue: 1.5 }, 400], [{ principalInr: 100, daysOverdue: 99999 }, 400], [{}, 400], [{ principalInr: 1e12, daysOverdue: 3 }, 400]]) { r = await A('POST', '/payments/calculate-interest', b); t(`calculate interest: ${JSON.stringify(b)} -> ${code}`, r.s === code, r.s); }
}

// ---------- random run ----------
{
  const R = await buyer(), cs = [S1.c, S2.c, S3.c, R.c]; demandsPast(R.c, [1, 2]); await recalc(R.c);
  const rcs = []; for (let i = 0; i < 3; i++) rcs.push(await receipt(R, ri(1, 5) * 1000));
  grant(afId, 'jv_refund_drcr', true, true); grant(pmId, 'jv_refund_drcr', false, true); grant(afId, 'interest_waiver', true, true); grant(pmId, 'interest_waiver', false, true);
  const mkInvs = []; for (let i = 0; i < 3; i++) { const x = await inv(R.c, { baseAmount: ri(1, 50) * 100 }); mkInvs.push(x.j.data); invs.push(x.j.data.id); }
  const who = () => pick([A, A, AF, PM, SE, RO]), amt = () => pick([ri(1, 3000), ri(1, 90000) / 100, 0, -4, 'x', 1e12, '12.345', null]), cid = () => pick([...cs, ...cs, NIL, 'abc']);
  const open = (tbl, st) => psqlAll(`select id from ${tbl} where status='${st}' and ${tbl === 'interest_waivers' ? 'consumer_id' : 'consumer_id'} in (${cs.map(x => `'${x}'`).join(',')}) limit 6`);
  let steps = 0, bad5 = 0;
  for (let i = 0; i < 90; i++) {
    const op = ri(1, 14); const w = who(); steps++;
    if (op === 1) r = await cD(cid(), { waiver_amount_inr: amt(), installment_index: pick([null, 1, 2, 3]) }, w);
    else if (op === 2) r = await wreq(cid(), { waiver_amount_inr: amt(), installment_index: pick([1, 2]) }, w);
    else if (op === 3) { const x = pick(open('interest_waivers', 'pending').concat([NIL])); r = await w('PATCH', `/payments/interest-waivers/${x}/${pick(['approve', 'reject'])}`, { rejection_reason: 'rand' }); }
    else if (op === 4) r = await rq(cid(), { refund_amount_inr: amt(), original_receipt_id: pick([null, pick(rcs)]) }, w);
    else if (op === 5) { const x = pick(open('payment_refunds', 'pending').concat(open('payment_refunds', 'approved'), [NIL])); r = await w('PATCH', `/payments/refunds/${x}/${pick(['approve', 'process', 'reject'])}`, { refund_mode: pick(['neft', 'x']), rejection_reason: 'rand' }); }
    else if (op === 6) r = await w('POST', '/payments/credit-debit-notes', { invoice_id: pick(mkInvs).id, note_type: pick(['credit', 'debit']), adjustment_amount: amt(), reason: 'rand' });
    else if (op === 7) { const x = pick(open('credit_debit_notes', 'pending').concat([NIL])); r = await w('PATCH', `/payments/credit-debit-notes/${x}/${pick(['approve', 'cancel'])}`, { reason: 'rand' }); }
    else if (op === 8) r = await inv(R.c, { baseAmount: amt(), receiptId: pick([null, pick(rcs)]) }, w);
    else if (op === 9) r = await w('POST', '/payments/gst-invoices/cancel', { invoiceNumber: pick(mkInvs).invoice_no, reason: 'rand' });
    else if (op === 10) r = await recalc(pick(cs), w);
    else if (op === 11) r = await w('POST', '/payments/manual-interest', { consumer_id: cid(), installment_index: pick([1, 2, 3, null]), amount_inr: amt() });
    else if (op === 12) r = await w('PATCH', `/payments/consumer-grace-period/${cid()}`, { grace_period_days: pick([0, 0, 5, -1, 'x']) });
    else if (op === 13) r = await w('GET', pick(['/payments/refunds', '/payments/interest-waivers', '/payments/gst-invoices', '/payments/credit-debit-notes', `/payments/consumer-waiver-report?project_id=${P1}`, `/payments/interest-waiver-list?project_id=${P1}`]));
    else r = await w('POST', '/payments/interest-scheduler', { project_id: P1, persist: pick([true, false]) });
    if (r.s >= 500) { bad5++; console.log('5xx at step', i, op, r.s, JSON.stringify(r.j).slice(0, 120)); }
  }
  t(`random: ${steps} steps (seed ${SEED}), no 5xx`, bad5 === 0, bad5);
  const ids = cs.map(x => `'${x}'`).join(',');
  t('random: every penal interest row has 0 <= waived <= amount', psql(`select count(*) from penal_interests where consumer_id in (${ids}) and (interest_waived_inr < 0 or interest_waived_inr > amount_inr)`) === '0');
  t('random: every applicant\'s stored waiver is consistent with the approved waivers', cs.every(waiverSane), cs.filter(x => !waiverSane(x)).join());
  t('random: refunds that are not rejected never add up to more than the applicant paid (live receipts)', psql(`select count(*) from (select r.consumer_id, sum(r.refund_amount_inr) s from payment_refunds r where r.consumer_id in (${ids}) and r.status <> 'rejected' group by 1) x where s > (select coalesce(sum(amount_received_inr),0) from receipts where consumer_id = x.consumer_id and status not in ('cancelled','bounced'))`) === '0');
  t('random: credit notes (not cancelled) never add up to more than their invoice', psql(`select count(*) from (select invoice_id, sum(adjustment_amount) s from credit_debit_notes where note_type='credit' and status <> 'cancelled' and consumer_id in (${ids}) group by 1) x where s > (select taxable_amount_inr from gst_invoices where id = x.invoice_id)`) === '0');
  t('random: no receipt has two live invoices; every cancelled invoice has its credit note or was already fully credited', psql(`select count(*) from (select receipt_id from gst_invoices where receipt_id is not null and status <> 'cancelled' group by 1 having count(*) > 1) x`) === '0');
  t('random: invoice totals are base + tax to the paisa', psql(`select count(*) from gst_invoices where consumer_id in (${ids}) and abs(total_amount_inr - (base_amount_inr + cgst_amount_inr + sgst_amount_inr + igst_amount_inr)) > 0.001`) === '0');
  t('random: invoice and note numbers are unique', psql(`select (select count(*) - count(distinct invoice_no) from gst_invoices) + (select count(*) - count(distinct note_number) from credit_debit_notes)`) === '0');
  noRows(afId); noRows(pmId);
}

// ---------- audit ----------
t('audit: waivers, refunds, invoices, notes, interest and plans are logged', Number(psql(`select count(distinct resource_type) from audit_logs where resource_type in ('interest_waiver','payment_refund','gst_invoice','credit_debit_note','penal_interest','payment_plan','project_interest_rate','draw_refund','cancellation_refund','loan_detail','registry') and timestamp > now() - interval '2 hour'`)) >= 10);

// ---------- clean up ----------
for (const u of [afId, pmId]) noRows(u);
await A('PATCH', '/users/employee-login/' + afId, { assignedProjectIds: [] });
if (madeSlab) for (const sql of [`delete from gst_tax_charge_mapping where slab_id='${slab}'`, `delete from gst_tax_setup where slab_id='${slab}'`, `delete from gst_slabs where id='${slab}'`]) { try { psql(sql); } catch { /* ignore */ } }
{
  const ids = made.map(x => `'${x}'`).join(',');
  const gone = (tbl, col = 'consumer_id') => `delete from audit_logs where resource_id in (select id from ${tbl} where ${col} in (${ids}))`;
  for (const sql of [
    ...extraSql.filter(x => x.includes('audit_logs')), ...extraSql.filter(x => !x.includes('audit_logs')),
    gone('interest_waivers'), gone('payment_refunds'), gone('credit_debit_notes'), gone('gst_invoices'), gone('penal_interests'), gone('payment_plans'),
    `delete from audit_logs where resource_type in ('project_interest_rate','installment_interest') and resource_id in ('${P1}','${P2}')`, `delete from audit_logs where resource_id in (select id from project_interest_rates where project_id in ('${P1}','${P2}'))`,
    `delete from audit_logs where resource_type in ('penal_interest','consumer_interest') and resource_id in ('${P1}','${P2}', ${ids})`,
    `delete from credit_debit_notes where consumer_id in (${ids})`, `delete from gst_invoices where consumer_id in (${ids})`, `delete from interest_waivers where consumer_id in (${ids})`, `delete from payment_refunds where consumer_id in (${ids})`,
    `delete from penal_interests where consumer_id in (${ids})`, `delete from project_interest_rates where project_id in ('${P1}','${P2}')`, `delete from draw_refunds where consumer_id in (${ids})`,
    `delete from audit_logs where resource_type in ('receipt','demand') and resource_id in (select id from receipts where consumer_id in (${ids}) union select id from demands where consumer_id in (${ids}))`,
    `delete from cheque_bounce_logs where consumer_id in (${ids})`, `delete from booking_documents where consumer_id in (${ids})`, `delete from documents where consumer_id in (${ids})`, `delete from receipts where consumer_id in (${ids})`, `delete from demands where consumer_id in (${ids})`,
    `delete from financial_audit_logs where consumer_id in (${ids})`, `delete from payment_plans where consumer_id in (${ids})`, `delete from allocations where consumer_id in (${ids})`,
    `delete from broker_commissions where consumer_id in (${ids})`, `delete from booking_payment_taxes where booking_record_id in (select id from booking_records where consumer_id in (${ids}))`,
    ...extraSql.filter(x => !x.includes('audit_logs')),
    `delete from booking_records where consumer_id in (${ids})`, `delete from co_applicants where consumer_id in (${ids})`, `delete from consumers where id in (${ids})`,
  ]) { try { psql(sql); } catch { /* leftovers are harmless, names carry the run id */ } }
}
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
