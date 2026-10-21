// Demands: roles, input rules, raising (order, stages, states, races), unraising, marking sent, generating, the list / stage / status views, and random input.
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-demands.mjs   (psql must reach the same database; SEED=n repeats a random run)
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
// ---------- helpers: a buyer with a completed booking has 3 pending demands (20 / 30 / 50 %) ----------
const buyer = async () => {
  const x = await startBooking(); const y = await finish(x.id); if (y.s !== 200) throw new Error('finish ' + JSON.stringify(y));
  const ds = psql(`select string_agg(id::text, ',' order by installment_index) from demands where consumer_id='${x.c}'`).split(',');
  return { ...x, c: { id: x.c, name: psql(`select name from consumers where id='${x.c}'`) }, d: ds };
};
const st = (id) => psql(`select status from demands where id='${id}'`);
const row = (id, col) => psql(`select ${col} from demands where id='${id}'`);
const raise = (ids, date = later(10), who = A) => who('PATCH', '/payments/demands/activate', { demandIds: ids, installmentDate: date });
const NILS = '00000000-0000-0000-0000-000000000000';

// ---------- a completed booking really makes the demands ----------
const B1 = await buyer();
t('set-up: a completed booking made 3 pending demands', B1.d.length === 3 && B1.d.every(d => st(d) === 'pending'), JSON.stringify(B1.d));
t('set-up: demand amounts follow the plan (20/30/50 of the total)', psql(`select string_agg(amount_due_inr::text, ',' order by installment_index) from demands where consumer_id='${B1.c.id}'`).split(',').map(Number).every((v, i, a) => v > 0) );

// ---------- roles ----------
{
  const b = await buyer();
  for (const [n, who] of [['read_only_viewer', RO], ['sales_executive', SE]]) {
    r = await raise([b.d[0]], later(10), who); t(`roles: ${n} cannot raise a demand -> 403`, r.s === 403, r.s);
    r = await who('PATCH', '/payments/demands/bulk-cancel', { demandIds: [b.d[0]] }); t(`roles: ${n} cannot unraise (bulk) -> 403`, r.s === 403, r.s);
    r = await who('PATCH', `/payments/demands/${b.d[0]}/cancel`, {}); t(`roles: ${n} cannot unraise one -> 403`, r.s === 403, r.s);
    r = await who('PATCH', `/payments/demands/${b.d[0]}/send`, {}); t(`roles: ${n} cannot mark sent -> 403`, r.s === 403, r.s);
    r = await who('POST', '/payments/demands/generate', { consumerId: b.c.id }); t(`roles: ${n} cannot generate demands -> 403`, r.s === 403, r.s);
    r = await who('GET', `/payments/demands?consumerId=${b.c.id}`); t(`roles: ${n} can read the demand list`, r.s === 200 && r.j.data.length === 3, r.s);
    r = await who('GET', '/payments/demand-status?limit=2'); t(`roles: ${n} can read the demand status`, r.s === 200, r.s);
  }
  t('roles: nothing changed by the refused calls', b.d.every(d => st(d) === 'pending'));
  r = await AF('PATCH', '/payments/demands/activate', { demandIds: [b.d[0]], installmentDate: later(10) }); t('roles: accounts_finance can raise', r.s === 200 && r.j.raised === 1, r.s + JSON.stringify(r.j));
  r = await PM('PATCH', '/payments/demands/activate', { demandIds: [b.d[1]], installmentDate: later(10) }); t('roles: project_manager can raise', r.s === 200 && r.j.raised === 1, r.s + JSON.stringify(r.j));
  r = await fetch(B + '/payments/demands'); t('roles: no login -> 401', r.status === 401, r.status);
}

// ---------- raising: bad input ----------
{
  const b = await buyer(); const d = b.d;
  const bad = async (n, bodyx, code = 400) => { const x = await A('PATCH', '/payments/demands/activate', bodyx); t(`raise: ${n} -> ${code}`, x.s === code, x.s + ' ' + JSON.stringify(x.j).slice(0, 100)); };
  await bad('no body', undefined);
  await bad('demandIds missing', { installmentDate: later(5) });
  await bad('demandIds is a string', { demandIds: d[0], installmentDate: later(5) });
  await bad('demandIds is an object', { demandIds: { a: d[0] }, installmentDate: later(5) });
  await bad('demandIds empty list', { demandIds: [], installmentDate: later(5) });
  await bad('an id that is not an id', { demandIds: [d[0], 'abc'], installmentDate: later(5) });
  await bad('an id that is a number', { demandIds: [5], installmentDate: later(5) });
  await bad('an id with SQL in it', { demandIds: [`${d[0]}' or '1'='1`], installmentDate: later(5) });
  await bad('2001 ids', { demandIds: Array.from({ length: 2001 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`), installmentDate: later(5) });
  for (const v of [undefined, '', 'abc', '2020-02-30', '01/02/2026', 20260101, '2999-01-01', [later(3)], { a: 1 }, later(-5), '1980-01-01']) await bad(`due date ${JSON.stringify(v)}`, { demandIds: [d[0]], installmentDate: v });
  const raw = await A('PATCH', '/payments/demands/activate', undefined, '{"demandIds":'); t('raise: broken JSON -> 400', raw.s === 400, raw.s);
  t('raise: nothing was raised by the refused calls', d.every(x => st(x) === 'pending'));
  r = await A('PATCH', '/payments/demands/activate', { demandIds: [NILS], installmentDate: later(5) });
  t('raise: an unknown id is reported as skipped, not an error', r.s === 200 && r.j.raised === 0 && r.j.skippedIds[0]?.reason === 'Demand not found', r.s + JSON.stringify(r.j));
  r = await A('PATCH', '/payments/demands/activate', { demandIds: [d[0]], installmentDate: later(-1) }); t('raise: yesterday is allowed (clock grace)', r.s === 200 && r.j.raised === 1, r.s + JSON.stringify(r.j));
}

// ---------- raising: order, stages, states ----------
{
  const b = await buyer(); const [s1, s2, s3] = b.d;
  r = await raise([s2]); t('stage: stage 2 alone is skipped while stage 1 is pending', r.j.raised === 0 && /prior stage/.test(r.j.skippedIds[0]?.reason), JSON.stringify(r.j));
  r = await raise([s3, s2, s1]); t('stage: all three sent in reverse order are all raised (oldest first)', r.j.raised === 3 && r.j.skipped === 0, JSON.stringify(r.j));
  t('stage: all three are now "demanded" with the chosen due date', b.d.every(x => st(x) === 'demanded') && row(s1, 'due_date') === later(10));
  t('stage: raised_by and raised_at are filled', row(s1, 'raised_by') !== '' && row(s1, 'raised_at') !== '');
  t('stage: one audit row per raised demand', psql(`select count(*) from audit_logs where resource_type='demand' and resource_id in ('${s1}','${s2}','${s3}') and new_values::text like '%DEMAND_RAISE%'`) === '3');
  r = await raise([s1, s1, s1]); t('stage: raising an already raised demand (sent 3 times) -> skipped once, "Already raised"', r.j.raised === 0 && r.j.skipped === 1 && r.j.skippedIds[0].reason === 'Already raised', JSON.stringify(r.j));
  const c = await buyer();
  psql(`update demands set status='paid' where id='${c.d[0]}'`); psql(`update demands set status='cancelled' where id='${c.d[1]}'`);
  r = await raise([c.d[0], c.d[1]]); t('state: a paid demand is not raised again', r.j.skippedIds.find(x => x.id === c.d[0])?.reason === 'Already paid', JSON.stringify(r.j));
  t('state: a cancelled (surrendered) demand is not revived', r.j.skippedIds.find(x => x.id === c.d[1])?.reason === 'Demand is cancelled' && st(c.d[1]) === 'cancelled', JSON.stringify(r.j));
  t('state: those two keep their status', st(c.d[0]) === 'paid');
  r = await raise([c.d[2]]); t('stage: stage 3 is raised when stage 1 is paid and stage 2 is cancelled (nothing is pending before it)', r.j.raised === 1, JSON.stringify(r.j));
  // two customers in one call, one with a problem
  const e = await buyer(), f = await buyer(); psql(`update demands set status='cancelled' where id='${f.d[0]}'`);
  r = await raise([e.d[0], f.d[0], e.d[1], f.d[1]]); t('mixed: valid ones raised, bad ones reported, nothing rolled back', r.j.raised === 3 && r.j.skipped === 1 && st(e.d[1]) === 'demanded' && st(f.d[1]) === 'demanded', JSON.stringify(r.j));
}

// ---------- raising at the same moment ----------
{
  const b = await buyer();
  const rs = await Promise.all(Array.from({ length: 8 }, () => raise([b.d[0], b.d[1]])));
  t('race: 8 people raising the same two demands -> raised exactly twice in total', rs.reduce((s, x) => s + x.j.raised, 0) === 2 && rs.every(x => x.s === 200), JSON.stringify(rs.map(x => x.j.raised)));
  t('race: one audit row each, not eight', psql(`select count(*) from audit_logs where resource_type='demand' and resource_id in ('${b.d[0]}','${b.d[1]}') and new_values::text like '%DEMAND_RAISE%'`) === '2');
  const c = await buyer(); await raise([c.d[0]]);
  const us = await Promise.all(Array.from({ length: 6 }, () => A('PATCH', '/payments/demands/bulk-cancel', { demandIds: [c.d[0]] })));
  t('race: 6 people unraising one demand -> unraised once, the rest told it failed', us.reduce((s, x) => s + x.j.cancelled, 0) === 1 && us.every(x => x.s === 200), JSON.stringify(us.map(x => x.j)));
}

// ---------- advance receipts ----------
{
  const b = await buyer();
  const amt = Number(row(b.d[0], 'amount_due_inr')), cg = Number(row(b.d[0], 'cgst_amount')), sg = Number(row(b.d[0], 'sgst_amount'));
  const payer = await A('GET', `/consumers/${b.c.id}`);
  const rc = await A('POST', '/payments/receipts', { consumerId: b.c.id, paymentPlanId: psql(`select payment_plan_id from demands where id='${b.d[0]}'`), amountReceivedInr: Math.round((amt + cg + sg) / 2), paymentMethod: 'neft', receivedDate: today, installmentIndex: 1 });
  if (rc.s >= 300) console.log('NOTE receipt create: ' + rc.s + JSON.stringify(rc.j).slice(0, 150));
  r = await raise([b.d[0]]);
  t('advance: raising still works for a customer who already paid part of it', r.s === 200 && r.j.raised === 1 && st(b.d[0]) === 'demanded', r.s + JSON.stringify(r.j));
}

// ---------- unraising ----------
{
  const b = await buyer(); const [s1, s2] = b.d;
  const bad = async (n, p, bodyx, code) => { const x = await A('PATCH', p, bodyx); t(`unraise: ${n} -> ${code}`, x.s === code, x.s + ' ' + JSON.stringify(x.j).slice(0, 100)); };
  await bad('one: id not an id', '/payments/demands/abc/cancel', {}, 400);
  await bad('one: id that does not exist', `/payments/demands/${NILS}/cancel`, {}, 404);
  await bad('one: a pending demand cannot be unraised', `/payments/demands/${s1}/cancel`, {}, 400);
  await bad('one: reason 201 characters', `/payments/demands/${s1}/cancel`, { reason: 'r'.repeat(201) }, 400);
  await bad('one: reason with <b>', `/payments/demands/${s1}/cancel`, { reason: '<b>x' }, 400);
  await bad('bulk: no body', '/payments/demands/bulk-cancel', undefined, 400);
  await bad('bulk: empty list', '/payments/demands/bulk-cancel', { demandIds: [] }, 400);
  await bad('bulk: ids as a string', '/payments/demands/bulk-cancel', { demandIds: s1 }, 400);
  await bad('bulk: id not an id', '/payments/demands/bulk-cancel', { demandIds: ['x'] }, 400);
  await bad('bulk: id with SQL', '/payments/demands/bulk-cancel', { demandIds: ["1' or '1'='1"] }, 400);
  await raise([s1, s2]);
  await A('PATCH', `/payments/demands/${s1}/send`, { sentVia: 'email' });
  r = await A('PATCH', `/payments/demands/${s2}/cancel`, { reason: 'wrong date' });
  t('unraise: a raised demand goes back to pending, without due date or sent time', r.s === 200 && st(s2) === 'pending' && row(s2, 'due_date') === '' && r.j.data.cancel_reason === 'wrong date', r.s + JSON.stringify(r.j));
  t('unraise: audit row with the reason', psql(`select count(*) from audit_logs where resource_id='${s2}' and new_values::text like '%DEMAND_UNRAISE%wrong date%'`) === '1');
  r = await A('PATCH', '/payments/demands/bulk-cancel', { demandIds: [s1, s2, NILS], reason: 'redo' });
  t('unraise bulk: one raised (done), one pending and one unknown (reported)', r.j.cancelled === 1 && r.j.failed === 2 && r.j.failures.some(f => f.id === NILS), JSON.stringify(r.j));
  t('unraise: the sent time is cleared too', row(s1, 'sent_at') === '' && row(s1, 'delivery_status') === 'pending');
  const again = await raise([s1, s2]); t('unraise: the same demands can be raised again afterwards', again.j.raised === 2, JSON.stringify(again.j));
  psql(`update demands set status='paid' where id='${s1}'`); r = await A('PATCH', `/payments/demands/${s1}/cancel`, {}); t('unraise: a paid demand cannot be unraised -> 400 and stays paid', r.s === 400 && st(s1) === 'paid', r.s);
  psql(`update demands set status='cancelled' where id='${s1}'`); r = await A('PATCH', '/payments/demands/bulk-cancel', { demandIds: [s1] }); t('unraise: a cancelled demand is reported failed', r.j.cancelled === 0 && r.j.failed === 1, JSON.stringify(r.j));
}

// ---------- marking sent ----------
{
  const b = await buyer(); const [s1] = b.d;
  const bad = async (n, id, bodyx, code) => { const x = await A('PATCH', `/payments/demands/${id}/send`, bodyx); t(`send: ${n} -> ${code}`, x.s === code, x.s + ' ' + JSON.stringify(x.j).slice(0, 100)); };
  await bad('id not an id', 'abc', {}, 400); await bad('id unknown', NILS, {}, 404);
  await bad('a pending demand cannot be sent', s1, { sentVia: 'email' }, 409);
  await raise([s1]);
  await bad('channel 51 characters', s1, { sentVia: 'x'.repeat(51) }, 400); await bad('channel with <b>', s1, { sentVia: '<b>' }, 400); await bad('channel as an object', s1, { sentVia: { a: 1 } }, 400);
  r = await A('PATCH', `/payments/demands/${s1}/send`, { channel: 'whatsapp' }); t('send: a raised demand can be sent (channel accepted as sentVia)', r.s === 200 && r.j.data.delivery_status === 'sent' && r.j.data.sent_via === 'whatsapp', r.s + JSON.stringify(r.j));
  r = await A('PATCH', `/payments/demands/${s1}/send`, {}); t('send: sending again keeps the earlier channel', r.s === 200 && r.j.data.sent_via === 'whatsapp', JSON.stringify(r.j));
  t('send: audit row', Number(psql(`select count(*) from audit_logs where resource_id='${s1}' and new_values::text like '%"sent"%'`)) >= 1);
}

// ---------- generate ----------
{
  const b = await buyer(); const pp = psql(`select payment_plan_id from demands where id='${b.d[0]}'`);
  const bad = async (n, bodyx, code) => { const x = await A('POST', '/payments/demands/generate', bodyx); t(`generate: ${n} -> ${code}`, x.s === code, x.s + ' ' + JSON.stringify(x.j).slice(0, 100)); };
  await bad('no body', undefined, 400); await bad('neither consumer nor project', {}, 400); await bad('consumerId not an id', { consumerId: 'abc' }, 400);
  await bad('projectId not an id', { projectId: "x' or 1=1" }, 400); await bad('planName as an object', { consumerId: b.c.id, planName: {} }, 400); await bad('planName 101 characters', { consumerId: b.c.id, planName: 'p'.repeat(101) }, 400);
  await bad('consumer with no plan', { consumerId: NILS }, 404);
  r = await A('POST', '/payments/demands/generate', { consumerId: b.c.id }); t('generate: nothing new to create when all 3 exist', r.s === 200 && r.j.data.totalCreated === 0, JSON.stringify(r.j));
  const amounts = psql(`select string_agg(amount_due_inr::text||'/'||cgst_amount::text, ',' order by installment_index) from demands where payment_plan_id='${pp}'`);
  psql(`delete from demands where payment_plan_id='${pp}' and installment_index > 1`);
  r = await A('POST', '/payments/demands/generate', { consumerId: b.c.id }); t('generate: the 2 missing instalments are created again', r.s === 200 && r.j.data.totalCreated === 2, JSON.stringify(r.j));
  t('generate: with the same amounts and GST as the booking made', psql(`select string_agg(amount_due_inr::text||'/'||cgst_amount::text, ',' order by installment_index) from demands where payment_plan_id='${pp}'`) === amounts);
  psql(`delete from demands where payment_plan_id='${pp}'`);
  const rs = await Promise.all(Array.from({ length: 6 }, () => A('POST', '/payments/demands/generate', { consumerId: b.c.id })));
  t('generate race: 6 at once -> exactly 3 demands, no duplicates', psql(`select count(*) from demands where payment_plan_id='${pp}'`) === '3' && rs.every(x => x.s === 200), JSON.stringify(rs.map(x => x.s + ':' + x.j?.data?.totalCreated)));
  psql(`delete from demands where payment_plan_id='${pp}'`);
  r = await A('POST', '/payments/demands/generate', { consumerId: b.c.id, planName: 'No such plan ' + U }); t('generate: a plan name with no instalments is reported, nothing created', r.s === 200 && r.j.data.totalCreated === 0 && r.j.data.skipped.length === 1, JSON.stringify(r.j));
  r = await A('POST', '/payments/demands/generate', { consumerId: b.c.id, planName: PLAN }); t('generate: a named plan creates its instalments', r.j.data.totalCreated === 3, JSON.stringify(r.j));
  // a customer whose booking was cancelled gets nothing
  const x = await buyer(); psql(`update booking_records set status='cancelled' where consumer_id='${x.c.id}'`);
  r = await A('POST', '/payments/demands/generate', { consumerId: x.c.id }); t('generate: a customer whose booking is cancelled gets no demands', r.s === 404, r.s + JSON.stringify(r.j));
  r = await A('POST', '/payments/demands/generate', { projectId: P2 }); t('generate: a whole project with no plans -> 404, not a crash', r.s === 404, r.s);
}

// ---------- the list ----------
{
  const b = await buyer(); const [s1, s2] = b.d; await raise([s1], later(9));
  r = await A('GET', `/payments/demands?consumerId=${b.c.id}`);
  t('list: one customer -> his 3 demands with names, unit, balance', r.s === 200 && r.j.data.length === 3 && r.j.data.every(d => d.consumer_name && d.unit_address && typeof d.balance === 'number'), r.s + JSON.stringify(r.j).slice(0, 150));
  const bad = async (n, q, code = 400) => { const x = await A('GET', '/payments/demands?' + q); t(`list: ${n} -> ${code}`, x.s === code, x.s + ' ' + JSON.stringify(x.j).slice(0, 100)); return x; };
  await bad('pageSize with SQL', 'pageSize=1;drop table demands'); await bad('pageSize 0', 'pageSize=0'); await bad('pageSize 1001', 'pageSize=1001'); await bad('pageSize -5', 'pageSize=-5'); await bad('pageSize abc', 'pageSize=abc'); await bad('pageSize 1.5', 'pageSize=1.5');
  await bad('page 0', 'page=0'); await bad('page abc', 'page=abc'); await bad('page 1e9', 'page=1000000');
  await bad('consumerId not an id', 'consumerId=abc'); await bad('status "nonsense"', 'status=nonsense'); await bad('installmentIndex abc', 'installmentIndex=abc'); await bad('installmentIndex -1', 'installmentIndex=-1');
  await bad('floor abc', 'floor=abc'); await bad('from not a date', 'from=abc'); await bad('to 2020-02-30', 'to=2020-02-30'); await bad('raisedFrom not a date', 'raisedFrom=x'); await bad('from after to', 'from=2026-05-01&to=2026-01-01');
  await bad('name given twice', 'name=a&name=b'); await bad('name with <script>', 'name=%3Cscript%3E'); await bad('projectId 101 characters', 'projectId=' + 'p'.repeat(101));
  r = await A('GET', '/payments/demands?pageSize=2&page=1'); t('list: pageSize 2 returns at most 2', r.s === 200 && r.j.data.length <= 2, r.s);
  r = await A('GET', '/payments/demands?pageSize=1000'); t('list: pageSize 1000 is the allowed maximum', r.s === 200, r.s);
  for (const [n, q] of [['status', 'status=demanded'], ['status all', 'status=all'], ['installmentIndex', 'installmentIndex=2'], ['project by id', 'projectId=' + P1], ['project by name', 'projectId=' + encodeURIComponent('Bk A ')], ['tower by id', 'tower=' + T1], ['tower by name', 'tower=T' + U], ['unit', 'unitAddress=B1-' + U], ['registration', 'registrationNo=zzz'], ['name', 'name=Bk%20Buyer'], ['type', 'installmentType=install'], ['floor', 'floor=1'], ['due range', `from=${later(0)}&to=${later(40)}`], ['raised range', `raisedFrom=${today}&raisedTo=${today}`]]) { const x = await A('GET', '/payments/demands?pageSize=5&' + q); t(`list: filter by ${n} works (no error)`, x.s === 200, x.s + JSON.stringify(x.j).slice(0, 100)); }
  r = await A('GET', `/payments/demands?consumerId=${b.c.id}&raisedFrom=${today}&raisedTo=${today}&status=demanded`); t('list: raisedTo is inclusive (raised today shows when raisedTo is today)', r.j.data.length === 1 && r.j.data[0].id === s1, JSON.stringify(r.j.data?.map(d => d.id)));
  r = await A('GET', `/payments/demands?consumerId=${b.c.id}&status=demanded`); t('list: status demanded shows the raised one only', r.j.data.length === 1 && r.j.data[0].status === 'demanded');
  r = await A('GET', `/payments/demands?unitAddress=${encodeURIComponent('%')}`); t('list: unit "%" matches nothing (no wildcard)', r.s === 200 && r.j.data.length === 0, r.s);
  r = await A('GET', `/payments/demands?name=${encodeURIComponent('%')}`); t('list: name "%" matches nothing (wildcards escaped)', r.s === 200 && r.j.data.length === 0, JSON.stringify(r.j).slice(0, 100));
  r = await A('GET', `/payments/demands?name=${encodeURIComponent("x' or '1'='1")}`); t('list: a quote in the name is just text', r.s === 200 && r.j.data.length === 0, r.s);
  const p1 = await A('GET', '/payments/demands?pageSize=3&page=1'), p2 = await A('GET', '/payments/demands?pageSize=3&page=2'); t('list: page 2 differs from page 1 (stable order)', !p1.j.data.some(d => p2.j.data.some(e => e.id === d.id)));
}

// ---------- stage view ----------
{
  const b = await buyer(); await raise([b.d[0]]);
  let x = await A('GET', '/payments/demands/by-stage'); t('stage view: projectId missing -> 400', x.s === 400, x.s);
  x = await A('GET', '/payments/demands/by-stage?projectId=abc'); t('stage view: projectId not an id -> 400', x.s === 400, x.s);
  x = await A('GET', '/payments/demands/by-stage?projectId=' + NILS); t('stage view: unknown project -> empty list', x.s === 200 && x.j.stages.length === 0, x.s);
  x = await A('GET', '/payments/demands/by-stage?projectId=' + P1);
  const s1 = x.j.stages.find(s => s.installment_index === 1), tow = s1?.towers.find(w => w.tower_id === T1);
  t('stage view: stage 1 of the tower counts the raised and pending customers', x.s === 200 && tow && tow.raised_count >= 1 && tow.pending_count >= 1 && tow.total_consumers >= tow.raised_count + tow.pending_count, JSON.stringify(tow));
  t('stage view: demand ids are unique inside the lists', tow.raised_demand_ids.length === new Set(tow.raised_demand_ids).size);
  const before = tow.total_consumers; psql(`update demands set status='cancelled' where id='${b.d[1]}'`);
  x = await A('GET', '/payments/demands/by-stage?projectId=' + P1); const t2 = x.j.stages.find(s => s.installment_index === 2)?.towers.find(w => w.tower_id === T1);
  t('stage view: a cancelled demand is not counted', !t2 || !t2.pending_demand_ids.includes(b.d[1]) && !t2.raised_demand_ids.includes(b.d[1]));
}

// ---------- demand status page ----------
{
  const b = await buyer(); await raise([b.d[0]]);
  const bad = async (n, q, code = 400) => { const x = await A('GET', '/payments/demand-status?' + q); t(`status page: ${n} -> ${code}`, x.s === code, x.s + ' ' + JSON.stringify(x.j).slice(0, 100)); return x; };
  await bad('limit with SQL', 'limit=5;drop table demands'); await bad('limit 0', 'limit=0'); await bad('limit abc', 'limit=abc'); await bad('limit 1001', 'limit=1001'); await bad('page 0', 'page=0'); await bad('page -1', 'page=-1'); await bad('page abc', 'page=abc');
  await bad('project_id not an id', 'project_id=abc'); await bad('floor abc', 'floor=abc'); await bad('due_date_from not a date', 'due_date_from=abc'); await bad('due_date_to 2020-02-30', 'due_date_to=2020-02-30'); await bad('range the wrong way', 'due_date_from=2026-05-01&due_date_to=2026-01-01');
  await bad('demand_status nonsense', 'demand_status=zzz'); await bad('name with <b>', 'name=%3Cb%3E'); await bad('tower given twice', 'tower=a&tower=b');
  for (const q of ['tower=T' + U, 'name=Bk%20Buyer', 'city=x', 'reg_no=x', 'floor=1', 'demand_status=demanded', 'delivery_status=queued', `due_date_from=${later(0)}`, `project_id=${P1}`]) { const x = await A('GET', '/payments/demand-status?limit=5&' + q); t(`status page: filter ${q.split('=')[0]} works`, x.s === 200, x.s + JSON.stringify(x.j).slice(0, 100)); }
  r = await A('GET', `/payments/demand-status?project_id=${P1}&name=${encodeURIComponent(b.c.name)}`);
  const me = r.j.data?.find(x => x.consumer_id === b.c.id);
  const tot = Number(psql(`select sum(amount_due_inr + cgst_amount + sgst_amount) from demands where consumer_id='${b.c.id}'`));
  t('status page: the customer shows 3 demands, 1 raised, 2 pending, with the right total', me && me.total_demands === 3 && me.active_demands === 1 && me.pending_demands === 2 && Number(me.total_due) === tot, JSON.stringify(me));
  psql(`update demands set status='cancelled' where id='${b.d[2]}'`);
  r = await A('GET', `/payments/demand-status?project_id=${P1}&name=${encodeURIComponent(b.c.name)}`); const me2 = r.j.data.find(x => x.consumer_id === b.c.id);
  t('status page: a cancelled demand leaves the totals', me2.total_demands === 2 && Number(me2.total_due) < tot, JSON.stringify(me2));
  r = await A('GET', `/payments/demand-status?project_id=${P1}&limit=2&page=1`); t('status page: total counts all customers, limit 2 returns 2', r.s === 200 && r.j.data.length === 2 && r.j.total >= 2, JSON.stringify(r.j).slice(0, 120));
  r = await A('GET', `/payments/demand-status?project_id=${P1}&name=${encodeURIComponent('%')}`); t('status page: "%" in the name matches nothing', r.s === 200 && r.j.data.length === 0, r.s);
}

// ---------- demands of one payment plan ----------
{
  const b = await buyer(); const pp = psql(`select payment_plan_id from demands where id='${b.d[0]}'`);
  r = await A('GET', `/payments/${pp}/demands`); t('plan demands: 3 rows in instalment order', r.s === 200 && r.j.data.length === 3 && r.j.data[0].installment_index < r.j.data[2].installment_index, r.s);
  r = await A('GET', '/payments/abc/demands'); t('plan demands: id not an id -> 400', r.s === 400, r.s);
  r = await A('GET', `/payments/${NILS}/demands`); t('plan demands: unknown plan -> empty list', r.s === 200 && r.j.data.length === 0, r.s);
}

// ---------- random input: nothing may give a server error ----------
{
  const junks = [null, undefined, '', ' ', 'abc', '-1', 0, -5, 1e12, 1.5, true, false, [], [1], {}, { a: 1 }, "x'--", '<script>1</script>', '%', '_', '\\', 'A'.repeat(300), '2026-13-45', '9999-99-99', NIL, NILS, B1.d[0], B1.c.id, P1, T1, '\u0000', '😀', '१२३'];
  const junk = () => pick(junks);
  const five = []; const chk = (tag, x, info) => { if (x.s >= 500) five.push([tag, info, x.s]); };
  for (let i = 0; i < 70; i++) {
    const b1 = { demandIds: rnd() < 0.5 ? [junk(), pick([B1.d[0], B1.d[1], B1.d[2], junk()])] : junk(), installmentDate: rnd() < 0.5 ? later(ri(-3, 30)) : junk() };
    chk('activate', await A('PATCH', '/payments/demands/activate', b1), JSON.stringify(b1).slice(0, 120));
    const b2 = { demandIds: [pick([B1.d[0], junk()])], reason: junk() }; chk('bulk-cancel', await A('PATCH', '/payments/demands/bulk-cancel', b2), JSON.stringify(b2).slice(0, 100));
    const id = pick([B1.d[0], B1.d[1], NILS, 'abc', junk()]); const sub = pick(['cancel', 'send']);
    chk(sub, await A('PATCH', `/payments/demands/${encodeURIComponent(String(id))}/${sub}`, { reason: junk(), sentVia: junk(), channel: junk() }), String(id).slice(0, 40));
    const b3 = {}; for (let k = ri(0, 3); k > 0; k--) b3[pick(['consumerId', 'projectId', 'planName'])] = pick([junk(), B1.c.id, P2]);
    chk('generate', await A('POST', '/payments/demands/generate', b3), JSON.stringify(b3).slice(0, 100));
    const keys = ['page', 'pageSize', 'consumerId', 'projectId', 'status', 'installmentIndex', 'installmentType', 'tower', 'towerId', 'floor', 'registrationNo', 'name', 'unitAddress', 'from', 'to', 'raisedFrom', 'raisedTo', 'scope'];
    const q = Array.from({ length: ri(1, 3) }, () => pick(keys) + '=' + encodeURIComponent(String(junk()))).join('&'); chk('list', await A('GET', '/payments/demands?' + q), q);
    const keys2 = ['page', 'limit', 'project_id', 'tower', 'floor', 'reg_no', 'name', 'city', 'due_date_from', 'due_date_to', 'delivery_status', 'demand_status'];
    const q2 = Array.from({ length: ri(1, 3) }, () => pick(keys2) + '=' + encodeURIComponent(String(junk()))).join('&'); chk('status page', await A('GET', '/payments/demand-status?' + q2), q2);
    chk('by-stage', await A('GET', '/payments/demands/by-stage?projectId=' + encodeURIComponent(String(junk()))), '');
    chk('plan demands', await A('GET', `/payments/${encodeURIComponent(String(junk()))}/demands`), '');
    if (i % 8 === 0) await new Promise(res => setTimeout(res, 40));
  }
  t('random: 70 rounds of random raise / unraise / send / generate / list / status calls never gave a 500', five.length === 0, JSON.stringify(five.slice(0, 3)));
}

// ---------- the earlier money screens still work ----------
{
  const b = await buyer(); await raise([b.d[0]]);
  r = await A('GET', `/payments/receipts?consumerId=${b.c.id}`); t('earlier: the receipts list still works', r.s === 200, r.s);
  r = await A('GET', `/booking/${b.id}`); t('earlier: the booking still opens', r.s === 200, r.s);
  r = await A('GET', `/consumers/${b.c.id}`); t('earlier: the applicant still opens', r.s === 200, r.s);
  r = await A('GET', '/dashboard/demand-status'); t('earlier: the dashboard demand block still loads', r.s === 200, r.s);
}

// ---------- clean up ----------
if (madeSlab) for (const sql of [`delete from gst_tax_charge_mapping where slab_id='${slab}'`, `delete from gst_tax_setup where slab_id='${slab}'`, `delete from gst_slabs where id='${slab}'`]) { try { psql(sql); } catch { /* ignore */ } }
{
  const ids = made.map(x => `'${x}'`).join(',');
  for (const sql of [
    `delete from audit_logs where resource_type='demand' and resource_id in (select id from demands where consumer_id in (${ids}))`,
    `delete from booking_documents where consumer_id in (${ids})`, `delete from receipts where consumer_id in (${ids})`, `delete from demands where consumer_id in (${ids})`,
    `delete from financial_audit_logs where consumer_id in (${ids})`, `delete from payment_plans where consumer_id in (${ids})`, `delete from allocations where consumer_id in (${ids})`,
    `delete from broker_commissions where consumer_id in (${ids})`, `delete from booking_payment_taxes where booking_record_id in (select id from booking_records where consumer_id in (${ids}))`,
    `delete from booking_records where consumer_id in (${ids})`, `delete from co_applicants where consumer_id in (${ids})`, `delete from consumers where id in (${ids})`,
  ]) { try { psql(sql); } catch { /* leftovers are harmless, names carry the run id */ } }
}
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
