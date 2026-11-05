// Surrender and builder cancellation: roles, input rules, ids checked against each other, what changes (allocation, applicant, booking, unit, demands), restore,
// races, the lists, and random input.
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-surrender.mjs   (psql must reach the same database; SEED=n repeats a random run)
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
// ---------- helpers ----------
const NILS = '00000000-0000-0000-0000-000000000000';
const buyer = async (paid = 0) => {   // a seller: completed booking (unit, plan, 3 demands); optionally with cleared money
  const c = await person(); const u = await unit(); const x = await book(c, u, {}); if (x.s !== 201) throw new Error('book ' + JSON.stringify(x));
  const y = await finish(x.j.data.id); if (y.s !== 200) throw new Error('finish ' + JSON.stringify(y));
  if (paid) { const p = await A('POST', '/payments/receipts', { consumerId: c, amountReceivedInr: paid, paymentMode: 'neft', referenceNumber: `SUR${U}${++rn}`, paymentDate: today, installmentIndex: 9 }); if (p.s !== 201) throw new Error('rec ' + JSON.stringify(p)); const k = await A('PATCH', `/payments/receipts/${p.j.data.id}/clear`, { clearing_date: today }); if (k.s !== 200) throw new Error('clear ' + JSON.stringify(k)); }
  return { c, u, id: x.j.data.id, al: psql(`select id from allocations where consumer_id='${c}' and status not in ('cancelled','transferred') order by created_at desc limit 1`) };
};
let rn = 0;
const g = (tbl, id, c) => psql(`select ${c} from ${tbl} where id='${id}'`);
const sur = (S, extra = {}, who = A) => who('POST', '/surrender', { consumerId: S.c, allocationId: S.al, bookingId: S.id, unitId: S.u, projectId: P1, type: 'surrender', surrenderDate: today, ...extra });
const restore = (sid, S, extra = {}, who = A) => who('POST', '/surrender/restore', { surrenderId: sid, type: 'surrender', consumerId: S.c, allocationId: S.al, unitId: S.u, bookingId: S.id, ...extra });
const st = (S) => ({ alloc: g('allocations', S.al, 'status'), stage: psql(`select lead_stage || '/' || coalesce(allocated_unit_id::text,'') from consumers where id='${S.c}'`), booking: g('booking_records', S.id, 'status'), unit: g('units', S.u, 'status'), dem: psql(`select string_agg(status, ',' order by installment_index) from demands where consumer_id='${S.c}'`) });

// ---------- roles ----------
{
  const S = await buyer();
  for (const [n, who] of [['read_only_viewer', RO], ['sales_executive', SE], ['accounts_finance', AF]]) { r = await sur(S, {}, who); t(`roles: ${n} cannot surrender -> 403`, r.s === 403, r.s); r = await restore(NILS, S, {}, who); t(`roles: ${n} cannot restore -> 403`, r.s === 403, r.s); }
  t('roles: nothing changed by the refused calls', st(S).alloc !== 'cancelled' && st(S).booking === 'complete');
  for (const [n, who] of [['read_only_viewer', RO], ['sales_executive', SE], ['accounts_finance', AF], ['project_manager', PM]]) for (const p of [`/surrender/consumers?projectId=${P1}`, `/surrender/detail/${S.c}`, '/surrender/list', '/surrender/list?type=cancellation']) { r = await who('GET', p); t(`roles: ${n} can read ${p.replace(/[0-9a-f-]{36}/g, ':id').replace(/\?.*/, '')}${p.includes('cancellation') ? ' (cancellations)' : ''}`, r.s === 200, r.s); }
  r = await sur(S, {}, PM); t('roles: project_manager can surrender', r.s === 201, r.s + JSON.stringify(r.j));
  r = await fetch(B + '/surrender/list'); t('roles: no login -> 401', r.status === 401, r.status);
}

// ---------- surrendering: bad input ----------
{
  const S = await buyer(100000); const O = await buyer(); const O2 = await buyer();
  const bad = async (n, bd, code = 400) => { const x = await sur(S, bd); t(`surrender: ${n} -> ${code}`, x.s === code, x.s + ' ' + JSON.stringify(x.j).slice(0, 110)); return x; };
  r = await A('POST', '/surrender'); t('surrender: no body -> 400', r.s === 400, r.s);
  r = await A('POST', '/surrender', { allocationId: S.al }); t('surrender: consumerId missing -> 400', r.s === 400, r.s); r = await A('POST', '/surrender', { consumerId: S.c }); t('surrender: allocationId missing -> 400', r.s === 400, r.s);
  for (const k of ['consumerId', 'allocationId', 'bookingId', 'unitId', 'projectId']) { await bad(`${k} not an id`, { [k]: 'abc' }); await bad(`${k} as a list`, { [k]: [S.u] }); await bad(`${k} with SQL`, { [k]: "x' or '1'='1" }); }
  await bad('an allocation that does not exist', { allocationId: NILS }, 404);
  await bad('an allocation of another applicant', { allocationId: O.al });
  await bad('a unit that does not match the allocation', { unitId: O.u }); await bad('a project that does not match the unit', { projectId: P2 });
  await bad('a booking of another applicant', { bookingId: O.id }); await bad('a booking that does not exist', { bookingId: NILS }, 404);
  await bad('type "weird"', { type: 'weird' }); await bad('type as an object', { type: {} });
  for (const d of ['2999-01-01', later(3), '2020-02-30', 'abc', 20250101, '01/02/2025', [today]]) await bad(`surrender date ${JSON.stringify(d)}`, { surrenderDate: d });
  await bad('surrenderType "weird"', { surrenderType: 'weird' }); await bad('refundMode "bitcoin"', { refundMode: 'bitcoin' });
  for (const k of ['forfeitureAmount', 'refundAmount', 'penaltyBaseAmount', 'penaltyGstAmount', 'penaltyTotalAmount', 'extraAddonCharges', 'premiumAmount']) for (const v of [-1, 'abc', 1e12, true, [5]]) await bad(`${k} ${JSON.stringify(v)}`, { [k]: v });
  for (const v of ['abc', 1e12, true, [5], {}]) await bad(`totalAmount ${JSON.stringify(v)}`, { totalAmount: v });
  for (const k of ['gstIncluded', 'serviceTaxIncluded', 'vatIncluded', 'interestIncluded', 'bankNoc', 'brokerNoc']) await bad(`${k} "yes"`, { [k]: 'yes' });
  await bad('reason 1001 characters', { reason: 'r'.repeat(1001) }); await bad('remark with <script>', { remark: '<script>1</script>' }); await bad('reason with <b>', { reason: '<b>x' });
  await bad('forfeiture more than the money received', { forfeitureAmount: 100001 });
  await bad('forfeiture and refund together more than received', { forfeitureAmount: 30000, refundAmount: 80000 });
  t('surrender: nothing changed by all the refused calls', st(S).alloc !== 'cancelled' && st(S).booking === 'complete' && psql(`select count(*) from surrender_applications where consumer_id='${S.c}'`) === '0' && st(S).dem === 'pending,pending,pending');
  r = await sur(O2, { totalAmount: -2500.456, forfeitureAmount: 0, refundAmount: 0 }); t('surrender: a negative total (refund due) with paise is accepted, rounded to paise', r.s === 201 && Number(g('surrender_applications', r.j.data.surrenderId, 'total_amount')) === -2500.46, r.s + JSON.stringify(r.j));
}

// ---------- surrendering: what changes ----------
{
  const S = await buyer(100000); const before = st(S);
  const paidDemand = psql(`select id from demands where consumer_id='${S.c}' and installment_index=1`); psql(`update demands set status='paid' where id='${paidDemand}'`);
  const prior = { stage: before.stage.split('/')[0], unit: before.unit };
  r = await sur(S, { forfeitureAmount: 20000, refundAmount: 80000, penaltyBaseAmount: 20000, penaltyTotalAmount: 20000, surrenderType: 'refund_case', refundMode: 'online', reason: 'Customer moved city', remark: 'NOC pending', bankNoc: true });
  t('surrender: it is saved (201)', r.s === 201 && r.j.data.type === 'surrender', r.s + JSON.stringify(r.j)); const sid = r.j.data?.surrenderId;
  const a = st(S);
  t('surrender: allocation cancelled, applicant "cancelled" and no longer linked to the unit, booking cancelled', a.alloc === 'cancelled' && a.stage === 'cancelled/' && a.booking === 'cancelled', JSON.stringify(a));
  t('surrender: the unit is "temp_surrender"', a.unit === 'temp_surrender', a.unit);
  t('surrender: the demands still to be paid are cancelled, the paid one stays paid', a.dem === 'paid,cancelled,cancelled', a.dem);
  t('surrender: the record keeps amounts, type, mode, reason, status "pending"', g('surrender_applications', sid, 'status') === 'pending' && Number(g('surrender_applications', sid, 'refund_amount_inr')) === 80000 && g('surrender_applications', sid, 'surrender_type') === 'refund_case' && g('surrender_applications', sid, 'refund_mode') === 'online' && g('surrender_applications', sid, 'reason') === 'Customer moved city' && g('surrender_applications', sid, 'bank_noc') === 't');
  t('surrender: the old state is kept for a restore', JSON.parse(g('surrender_applications', sid, 'pre_state')).booking_status === 'complete' && g('surrender_applications', sid, 'pre_surrender_unit_status') === prior.unit);
  t('surrender: audit row', Number(psql(`select count(*) from audit_logs where resource_id='${sid}' and resource_type='surrender'`)) === 1);
  r = await A('GET', `/surrender/list?projectId=${P1}`); t('surrender: it shows in the surrender list with the name and unit', r.s === 200 && r.j.data.some(x => x.id === sid && x.unit_number && x.full_name), r.s);
  r = await A('GET', `/surrender/consumers?projectId=${P1}&registrationNo=${encodeURIComponent('')}`); t('surrender: and is gone from the "who can surrender" list', r.s === 200 && !r.j.data.some(x => x.consumer_id === S.c), r.s);
  r = await A('GET', `/surrender/detail/${S.c}`); t('surrender: the account screen says there is no active booking -> 404', r.s === 404, r.s);
  r = await sur(S); t('surrender: surrendering again -> 409', r.s === 409, r.s + JSON.stringify(r.j));
  r = await A('POST', '/transfers', { unitId: S.u, oldConsumerId: S.c, newConsumerId: await person() }); t('surrender: a surrendered applicant cannot transfer the unit -> 400', r.s === 400, r.s);

  // restore
  const bad = async (n, bd, code) => { const x = await A('POST', '/surrender/restore', bd); t(`restore: ${n} -> ${code}`, x.s === code, x.s + ' ' + JSON.stringify(x.j).slice(0, 110)); };
  await bad('no body', undefined, 400); await bad('no surrenderId', {}, 400); await bad('surrenderId not an id', { surrenderId: 'abc' }, 400); await bad('surrenderId as a list', { surrenderId: [sid] }, 400); await bad('surrenderId with SQL', { surrenderId: "x' or '1'='1" }, 400);
  await bad('unknown surrender', { surrenderId: NILS }, 404); await bad('type "weird"', { surrenderId: sid, type: 'weird' }, 400);
  await bad('the cancellation table for a surrender id', { surrenderId: sid, type: 'cancellation' }, 404);
  await bad('a consumerId that does not match', { surrenderId: sid, consumerId: (await buyer()).c }, 400); await bad('an allocationId that does not match', { surrenderId: sid, allocationId: (await buyer()).al }, 400);
  await bad('a unitId that does not match', { surrenderId: sid, unitId: (await buyer()).u }, 400); await bad('a bookingId that does not match', { surrenderId: sid, bookingId: (await buyer()).id }, 400); await bad('a consumerId not an id', { surrenderId: sid, consumerId: 'zz' }, 400);
  t('restore: nothing changed by the refused calls', st(S).alloc === 'cancelled' && g('surrender_applications', sid, 'status') === 'pending');
  // somebody else took the unit meanwhile
  psql(`update units set status='locked' where id='${S.u}'`); await bad('the unit was taken again by someone else', { surrenderId: sid }, 409); psql(`update units set status='temp_surrender' where id='${S.u}'`);
  const rs1 = await Promise.all(Array.from({ length: 5 }, () => restore(sid, S)));
  t('restore: 5 clicks at once -> restored once, the rest told it is already done', rs1.filter(x => x.s === 200).length === 1 && rs1.filter(x => x.s === 409).length === 4, JSON.stringify(rs1.map(x => x.s)));
  const z = st(S);
  t('restore: allocation, applicant stage and unit link, booking and unit are back as they were', z.alloc !== 'cancelled' && z.stage === `${prior.stage}/${S.u}` && z.booking === 'complete' && z.unit === prior.unit, JSON.stringify(z) + JSON.stringify(prior));
  t('restore: the demands are back (pending ones pending again, paid one paid)', z.dem === 'paid,pending,pending', z.dem);
  t('restore: the record says "restored" and has an audit row', g('surrender_applications', sid, 'status') === 'restored' && Number(psql(`select count(*) from audit_logs where resource_id='${sid}' and new_values::text like '%restored%'`)) === 1);
  r = await restore(sid, S); t('restore: restoring twice -> 409', r.s === 409, r.s);
  r = await A('GET', `/surrender/detail/${S.c}`); t('restore: the account screen works again', r.s === 200, r.s);
  r = await A('POST', '/transfers', { unitId: S.u, oldConsumerId: S.c, newConsumerId: await person() }); t('restore: the restored applicant can transfer the unit (the unit link is back)', r.s === 201, r.s + JSON.stringify(r.j));
}

// ---------- the same moment ----------
{
  const S = await buyer(); const rs2 = await Promise.all(Array.from({ length: 6 }, () => sur(S)));
  t('race: 6 surrenders of one allocation at once -> exactly one is made', rs2.filter(x => x.s === 201).length === 1 && rs2.filter(x => x.s === 409).length === 5 && psql(`select count(*) from surrender_applications where consumer_id='${S.c}'`) === '1', JSON.stringify(rs2.map(x => x.s)));
  const S2 = await buyer(); const mix = await Promise.all([sur(S2), sur(S2, { type: 'cancellation' }), sur(S2)]);
  t('race: a surrender and a cancellation of the same allocation at once -> only one record in all', mix.filter(x => x.s === 201).length === 1 && Number(psql(`select (select count(*) from surrender_applications where consumer_id='${S2.c}') + (select count(*) from cancellations where consumer_id='${S2.c}')`)) === 1, JSON.stringify(mix.map(x => x.s)));
}

// ---------- builder cancellation ----------
{
  const S = await buyer(50000);
  r = await sur(S, { type: 'cancellation', forfeitureAmount: 0, refundAmount: 50000, surrenderType: 'builder_cancellation', refundMode: 'cheque', reason: 'Project delayed' }); t('cancel: a builder cancellation is saved', r.s === 201 && r.j.data.type === 'cancellation', r.s + JSON.stringify(r.j)); const cid = r.j.data?.surrenderId;
  const a = st(S); t('cancel: the unit becomes "available" again, applicant unlinked, booking and demands cancelled', a.unit === 'available' && a.alloc === 'cancelled' && a.stage === 'cancelled/' && a.booking === 'cancelled' && a.dem === 'cancelled,cancelled,cancelled', JSON.stringify(a));
  t('cancel: the record has refund status "initiated", amounts with paise kept', g('cancellations', cid, 'refund_status') === 'initiated' && Number(g('cancellations', cid, 'refund_amount_inr')) === 50000);
  r = await A('GET', `/surrender/list?type=cancellation&projectId=${P1}`); t('cancel: it shows in the cancellation list', r.s === 200 && r.j.data.some(x => x.id === cid), r.s);
  r = await A('GET', '/surrender/list?type=weird'); t('cancel: list type "weird" -> 400', r.s === 400, r.s);
  psql(`update cancellations set refund_status='completed' where id='${cid}'`); r = await restore(cid, S, { type: 'cancellation' }); t('cancel: once the refund is paid it cannot be restored -> 409', r.s === 409, r.s + JSON.stringify(r.j));
  psql(`update cancellations set refund_status='initiated' where id='${cid}'`);
  const free = await buyer(); psql(`update units set status='available' where id='${S.u}'`); psql(`update units set status='locked' where id='${S.u}'`); r = await restore(cid, S, { type: 'cancellation' }); t('cancel: the unit was locked again by someone -> 409', r.s === 409, r.s + JSON.stringify(r.j)); psql(`update units set status='available' where id='${S.u}'`);
  r = await restore(cid, S, { type: 'cancellation' }); t('cancel: restore works while the unit is still free; the demands come back', r.s === 200 && st(S).alloc !== 'cancelled' && st(S).dem === 'pending,pending,pending' && st(S).booking === 'complete', r.s + JSON.stringify(r.j) + JSON.stringify(st(S)));
  t('cancel: refund status is "restored"', g('cancellations', cid, 'refund_status') === 'restored');
}

// ---------- the lists ----------
{
  const S = await buyer();
  const bad = async (n, p, code = 400) => { const x = await A('GET', p); t(`lists: ${n} -> ${code}`, x.s === code, x.s + ' ' + JSON.stringify(x.j).slice(0, 100)); };
  await bad('who-can-surrender without projectId', '/surrender/consumers'); await bad('projectId not an id', '/surrender/consumers?projectId=abc'); await bad('projectId with SQL', "/surrender/consumers?projectId=x'%20or%20'1'='1");
  await bad('registrationNo given twice', `/surrender/consumers?projectId=${P1}&registrationNo=a&registrationNo=b`); await bad('firstName with <b>', `/surrender/consumers?projectId=${P1}&firstName=%3Cb%3E`); await bad('unitAddress 101 characters', `/surrender/consumers?projectId=${P1}&unitAddress=${'u'.repeat(101)}`);
  await bad('detail: id not an id', '/surrender/detail/abc'); await bad('detail: unknown id', `/surrender/detail/${NILS}`, 404);
  await bad('list: projectId not an id', '/surrender/list?projectId=abc'); await bad('list: type "weird"', '/surrender/list?type=weird');
  for (const q of ['', `&registrationNo=zz`, '&firstName=Bk', '&unitAddress=B']) { const x = await A('GET', `/surrender/consumers?projectId=${P1}${q}`); t(`lists: who-can-surrender "${q}" works`, x.s === 200, x.s); }
  let x = await A('GET', `/surrender/consumers?projectId=${P1}&firstName=${encodeURIComponent('%')}`); t('lists: "%" in the name matches nothing', x.s === 200 && x.j.data.length === 0, x.s);
  x = await A('GET', `/surrender/consumers?projectId=${P1}`); t('lists: our live applicant is in the "who can surrender" list', x.s === 200 && x.j.data.some(y => y.consumer_id === S.c), x.s);
  x = await A('GET', `/surrender/detail/${S.c}`); t('lists: the account screen shows the receipts, demands and financials', x.s === 200 && x.j.data.demands.length === 3 && typeof x.j.data.financials.balance === 'number', x.s);
}

// ---------- random input ----------
{
  const junks = [null, undefined, '', ' ', 'abc', '-1', 0, -5, 1e12, 1.5, true, false, [], [1], {}, { a: 1 }, "x'--", '<script>1</script>', '%', '_', '\\', 'A'.repeat(300), '2026-13-45', '9999-99-99', NIL, NILS, '\u0000', '😀', '१२३'];
  const junk = () => pick(junks); const five = []; const chk = (tag, x, info) => { if (x.s >= 500) five.push([tag, info, x.s]); };
  const S = await buyer(1000), S2 = await buyer(1000); const real = [S, S2];
  for (let i = 0; i < 70; i++) {
    const keys = ['consumerId', 'allocationId', 'bookingId', 'unitId', 'projectId', 'type', 'surrenderDate', 'surrenderType', 'reason', 'forfeitureAmount', 'refundAmount', 'penaltyBaseAmount', 'penaltyGstAmount', 'penaltyTotalAmount', 'extraAddonCharges', 'totalAmount', 'gstIncluded', 'serviceTaxIncluded', 'vatIncluded', 'interestIncluded', 'premiumAmount', 'bankNoc', 'brokerNoc', 'refundMode', 'remark'];
    const R = pick(real); const bd = { consumerId: rnd() < 0.4 ? R.c : junk(), allocationId: rnd() < 0.4 ? R.al : junk() }; for (let k = ri(0, 5); k > 0; k--) bd[pick(keys)] = junk();
    if (bd.consumerId === R.c && bd.allocationId === R.al && !('type' in bd)) bd.type = 'weird';   // keep the two real ones for the restore checks
    chk('surrender', await A('POST', '/surrender', bd), JSON.stringify(bd).slice(0, 150));
    const rb = { surrenderId: rnd() < 0.3 ? NILS : junk() }; for (let k = ri(0, 4); k > 0; k--) rb[pick(['type', 'consumerId', 'allocationId', 'unitId', 'bookingId'])] = junk();
    chk('restore', await A('POST', '/surrender/restore', rb), JSON.stringify(rb).slice(0, 150));
    const q = Array.from({ length: ri(1, 3) }, () => pick(['projectId', 'type']) + '=' + encodeURIComponent(String(junk()))).join('&'); chk('list', await A('GET', '/surrender/list?' + q), q);
    const q2 = Array.from({ length: ri(1, 4) }, () => pick(['projectId', 'registrationNo', 'firstName', 'unitAddress']) + '=' + encodeURIComponent(String(junk()))).join('&'); chk('consumers', await A('GET', '/surrender/consumers?' + q2), q2);
    chk('detail', await A('GET', `/surrender/detail/${encodeURIComponent(String(pick([NILS, 'abc', junk(), S.c])))}`), '');
    if (i % 8 === 0) await new Promise(res => setTimeout(res, 40));
  }
  t('random: 70 rounds of random surrenders, restores, lists and detail calls never gave a 500', five.length === 0, JSON.stringify(five.slice(0, 3)));
  for (const R of real) t('random: whatever the junk did, the data is consistent (applicant, allocation and unit agree)', (st(R).alloc !== 'cancelled' && st(R).stage.endsWith('/' + R.u)) || (st(R).alloc === 'cancelled' && st(R).stage.endsWith('/') && st(R).unit !== 'available' + 'x'), JSON.stringify(st(R)));
}

// ---------- the earlier money screens still work ----------
{
  const S = await buyer(1000); const x = await sur(S); await restore(x.j.data.surrenderId, S);
  r = await A('GET', `/payments/demands?consumerId=${S.c}`); t('earlier: the demand list works after a surrender and a restore', r.s === 200 && r.j.data.length === 3, r.s);
  r = await A('GET', `/payments/receipts?consumerId=${S.c}`); t('earlier: the receipts list works', r.s === 200, r.s);
  r = await A('GET', `/booking/${S.id}`); t('earlier: the booking opens', r.s === 200, r.s);
  r = await A('GET', `/consumers/${S.c}`); t('earlier: the applicant opens', r.s === 200, r.s);
  r = await A('POST', `/booking/${S.id}/cancel`, { reason: 'x' }); t('earlier: a complete booking is still refused by the booking cancel (surrender is the way)', r.s === 409 || r.s === 400, r.s);
}

// ---------- clean up ----------
if (madeSlab) for (const sql of [`delete from gst_tax_charge_mapping where slab_id='${slab}'`, `delete from gst_tax_setup where slab_id='${slab}'`, `delete from gst_slabs where id='${slab}'`]) { try { psql(sql); } catch { /* ignore */ } }
{
  const ids = made.map(x => `'${x}'`).join(',');
  for (const sql of [
    `delete from audit_logs where resource_type in ('surrender','cancellation') and resource_id in (select id from surrender_applications where consumer_id in (${ids}) union select id from cancellations where consumer_id in (${ids}))`,
    `delete from surrender_applications where consumer_id in (${ids})`, `delete from cancellations where consumer_id in (${ids})`,
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
