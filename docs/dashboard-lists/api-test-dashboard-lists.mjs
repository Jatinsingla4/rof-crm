// Dashboard: every number on the Demand Status card and the Daily Status card opens the list it counts.
// The list behind a number must have exactly as many rows as the number says (and, for Collection, add up to the same rupees),
// for every project, for every column, and for the Total row ("all"). Own project and data (new every run), own second login.
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-dashboard-lists.mjs   (psql must reach the same database)
import { execFileSync } from 'node:child_process';
const B = process.env.BASE || 'http://localhost:3010/api';
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };
const login = async (email) => (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Test#Pass1234' }) })).json()).token;
const call = (tok) => async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const psql = (sql) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' }).trim();
const U = Date.now().toString(36).slice(-5);
const A = call(await login('super_admin@test.local')), RO = call(await login('read_only_viewer@test.local')), NONE = call('');
const hash = psql(`select password_hash from users where email='super_admin@test.local'`), checkerMail = `dashlist_${U}@test.local`;
psql(`insert into users (email,name,role,password_hash,is_active,username) values ('${checkerMail}','Dash list ${U}','super_admin','${hash}',true,'dashlist_${U}')`);
const C = call(await login(checkerMail));
const must = async (label, p) => { const x = await p; if (x.s >= 300) { console.log(`FAIL setup: ${label} -> ${x.s} ${JSON.stringify(x.j).slice(0, 250)}`); fail++; end(1); } return x.j.data ?? x.j; };
let tax = '', slab = '', madeSlab = false;
function end(code) { try { psql(`update users set is_active=false where email='${checkerMail}'`); if (tax) { psql(`delete from gst_tax_charge_mapping where gst_tax_id='${tax}'`); psql(`delete from gst_tax_setup where id='${tax}'`); } if (madeSlab) psql(`delete from gst_slabs where id='${slab}'`); } catch (e) { console.log('cleanup problem: ' + e.message.slice(0, 100)); } console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(code ?? (fail ? 1 : 0)); }

// ---------- set-up: a project, a 10/20/30/40 plan, GST, and bookings spread over today, this month and an earlier month ----------
const today = psql(`select (now() at time zone 'Asia/Kolkata')::date`), monthStart = psql(`select date_trunc('month', (now() at time zone 'Asia/Kolkata')::date)::date`), earlier = psql(`select (date_trunc('month', (now() at time zone 'Asia/Kolkata')::date) - interval '40 days')::date`);
const co = (await must('company', A('POST', '/companies', { name: 'DashList Co ' + U }))).id;
const mkProject = async (tag) => {
  const proj = (await must('project', A('POST', '/projects', { companyId: co, name: `DashList ${tag} ${U}`, reraNumber: `DL${tag}-${U}`, tcpLicence: 'x', totalUnits: 30, landAreaSqft: 30000 }))).id;
  const tw = (await must('tower', A('POST', `/projects/${proj}/towers`, { towerName: `DL${tag} ${U}` }))).id;
  const plan = `DL plan ${tag} ${U}`;
  for (const [i, p] of [10, 20, 30, 40].entries()) await must('plan row', A('POST', `/projects/${proj}/plan-templates`, { plan_name: plan, installment_name: `Row ${i + 1}`, installment_type: i === 0 ? 'booking' : 'installment', percentage: p, due_date_offset_days: i * 30, installment_index: i + 1 }));
  return { proj, tw, plan };
};
const P1 = await mkProject('A'), P2 = await mkProject('B');
slab = (await A('GET', '/gst-configuration/gst-slabs')).j.data.find((s) => s.from_date <= today && s.to_date >= today)?.id; madeSlab = !slab;
if (!slab) slab = (await must('slab', A('POST', '/gst-configuration/gst-slabs', { fromDate: psql(`select ('${today}'::date - 3)`), toDate: psql(`select ('${today}'::date + 5)`) }))).id;
tax = (await must('tax', A('POST', '/gst-configuration/gst-tax-setup', { slabId: slab, gstCode: 'DL' + U, type: 'INTRA', cgstPct: 2.5, sgstPct: 2.5 }))).id;
for (const P of [P1, P2]) for (const ct of ['BASIC', 'PLC', 'OTHER CHARGE']) await must('mapping', A('POST', '/gst-configuration/gst-charge-mapping', { projectId: P.proj, slabId: slab, gstTaxId: tax, chargeType: ct }));
let seq = 0;
const book = async (P, date) => {
  const unit = (await must('unit', A('POST', '/units', { projectId: P.proj, towerId: P.tw, unitNumber: `D${U}${++seq}`, floor: 1, bhkType: '2BHK', carpetAreaSqft: 500, superAreaSqft: 600, basePriceInr: 3000000 }))).id;
  const cons = (await must('applicant', A('POST', '/consumers', { name: `DashList Buyer ${seq} ${U}`, mobile: '9' + String(Math.random()).slice(2, 11), project_id: P.proj }))).id;
  const b = await must('booking', A('POST', '/booking', { consumer_id: cons, project_id: P.proj, unit_id: unit, selected_plan_name: P.plan, booking_date: today, booking_amount: 10000, payment_mode: 'cash' }));
  await must('confirm', A('PATCH', `/booking/${b.id}`, { booking_amount: 10000, payment_mode: 'cash' }));
  if (date !== today) psql(`update booking_records set booking_date='${date}' where id='${b.id}'`);
  return { id: b.id, cons, unit, P };
};
const clearedReceipt = async (b, amount, date) => {
  const r = await must('receipt', A('POST', '/payments/receipts', { consumerId: b.cons, bookingId: b.id, amountReceivedInr: amount, paymentMode: 'neft', referenceNumber: `DL${U}${++seq}`, paymentDate: today }));
  await must('approve', C('PATCH', `/payments/receipts/${r.id}/approve`, {}));
  await must('deposit', C('PATCH', `/payments/receipts/${r.id}/deposit`, { deposit_date: today }));
  await must('clear', C('PATCH', `/payments/receipts/${r.id}/clear`, { clearing_date: today }));
  if (date !== today) psql(`update receipts set received_date='${date}' where id='${r.id}'`);
  return r.id;
};
const bks = [await book(P1, today), await book(P1, today), await book(P1, monthStart), await book(P1, earlier), await book(P2, today), await book(P2, earlier)];
for (const [i, b] of bks.entries()) await clearedReceipt(b, 20000 + i * 5000, [today, monthStart, monthStart, earlier, today, earlier][i]);
// raised demands in every bucket, sent and unsent (demand 1 is raised automatically and is "queued" = not sent)
const dem = (b, idx, status, delivery) => psql(`update demands set status='${status}', delivery_status='${delivery}' where consumer_id='${b.cons}' and installment_index=${idx}`);
dem(bks[0], 1, 'demanded', 'sent'); dem(bks[1], 1, 'demanded', 'sent'); dem(bks[1], 2, 'demanded', 'pending'); dem(bks[2], 2, 'demanded', 'sent'); dem(bks[2], 3, 'demanded', 'pending');
dem(bks[3], 3, 'demanded', 'sent'); dem(bks[3], 4, 'demanded', 'pending'); dem(bks[4], 4, 'demanded', 'sent'); dem(bks[5], 2, 'demanded', 'sent');
// a cancelled booking's receipt and a pending demand must stay out of every number
const cancelled = await book(P1, today); psql(`update booking_records set status='cancelled' where id='${cancelled.id}'`);

const rowsOf = async (path) => (await A('GET', path)).j.data;
const cardDemand = (await rowsOf('/dashboard/demand-status')).filter((r) => [P1.proj, P2.proj].includes(r.project_id));
const cardDaily = (await rowsOf('/dashboard/daily-status')).filter((r) => [P1.proj, P2.proj].includes(r.project_id));
t('the cards carry the project id of each row (the link needs it)', cardDemand.length === 2 && cardDaily.length === 2 && cardDemand.every((r) => /^[0-9a-f-]{36}$/.test(r.project_id)));
t('set-up: the test bookings show up on the Daily Status card (5 sales this month in A is not assumed, the card is the reference)', cardDaily.reduce((s, r) => s + r.sales_total, 0) === 6, JSON.stringify(cardDaily));

// ============ 1. Demand Status: every Send / UnSend number against its list ============
const BUCKETS = [['demand', 'demand'], ['rem1', 'rem1'], ['rem2', 'rem2'], ['term', 'term']];
let demandChecked = 0, demandNonZero = 0;
for (const row of cardDemand) for (const [bucket, col] of BUCKETS) for (const sent of ['sent', 'unsent']) {
  const want = row[`${col}_${sent === 'sent' ? 'send' : 'unsend'}`];
  const r = await A('GET', `/dashboard/demand-status/list?projectId=${row.project_id}&bucket=${bucket}&sent=${sent}`);
  const ok = r.s === 200 && r.j.count === want && r.j.data.length === Math.min(want, 500);
  demandChecked++; if (want > 0) demandNonZero++;
  t(`demand card: ${row.project.split(' ')[1]} ${bucket} ${sent} = ${want} and the list has ${r.j?.count} rows`, ok, r.s + ' ' + JSON.stringify(r.j).slice(0, 200));
  if (want > 0) t(`demand list ${bucket} ${sent}: every row is a raised demand of that kind and that project, with a customer and an amount`, r.j.data.every((d) => ['demanded', 'raised', 'partial'].includes(d.status) && d.project === row.project && d.name && Number(d.amount) > 0 && (sent === 'sent' ? d.delivery_status === 'sent' : d.delivery_status !== 'sent') && (bucket === 'term' ? d.installment_index >= 4 : d.installment_index === ({ demand: 1, rem1: 2, rem2: 3 })[bucket])), JSON.stringify(r.j.data[0]));
}
t('demand card: the checks covered numbers that are not zero in several buckets', demandChecked === 16 && demandNonZero >= 6, `${demandChecked} checked, ${demandNonZero} not zero`);
for (const [bucket, col] of BUCKETS) for (const sent of ['sent', 'unsent']) {
  const all = (await rowsOf('/dashboard/demand-status')).reduce((s, r) => s + r[`${col}_${sent === 'sent' ? 'send' : 'unsend'}`], 0);
  const r = await A('GET', `/dashboard/demand-status/list?projectId=all&bucket=${bucket}&sent=${sent}`);
  t(`demand card, all projects: ${bucket} ${sent} = ${all} and the list has ${r.j?.count} rows`, r.s === 200 && r.j.count === all, r.s + ' ' + JSON.stringify(r.j).slice(0, 160));
}

// ============ 2. Daily Status: every Sales and Collection number against its list ============
for (const row of cardDaily) for (const period of ['today', 'month', 'total']) {
  const nSales = row[`sales_${period}`], coll = row[`coll_${period}`];
  let r = await A('GET', `/dashboard/daily-status/list?projectId=${row.project_id}&kind=sales&period=${period}`);
  t(`daily card: ${row.project.split(' ')[1]} sales ${period} = ${nSales} and the list has ${r.j?.count} rows`, r.s === 200 && r.j.count === nSales && r.j.data.length === nSales, r.s + ' ' + JSON.stringify(r.j).slice(0, 200));
  if (nSales > 0) t(`sales list ${period}: every row is a live booking of the project with its customer, unit and date`, r.j.data.every((x) => x.project === row.project && x.name && x.unit_number && x.booking_date && ['complete', 'pending_payment', 'active'].includes(x.status)), JSON.stringify(r.j.data[0]));
  r = await A('GET', `/dashboard/daily-status/list?projectId=${row.project_id}&kind=collection&period=${period}`);
  const sum = r.j?.data?.reduce((s, x) => s + x.amount, 0);
  t(`daily card: ${row.project.split(' ')[1]} collection ${period} = ${coll} and the list adds up to ${r.j?.amount} over ${r.j?.count} receipts`, r.s === 200 && Math.abs(r.j.amount - coll) < 0.01 && Math.abs(sum - coll) < 0.01, r.s + ' ' + JSON.stringify(r.j).slice(0, 200));
  if (coll > 0) t(`collection list ${period}: every row is a cleared receipt with its number, date, customer and mode`, r.j.data.every((x) => x.receipt_number && x.received_date && x.name && x.payment_method && x.amount > 0), JSON.stringify(r.j.data[0]));
  if (period === 'today' && coll > 0) t('collection list today: every receipt is dated today', r.j.data.every((x) => x.received_date === today), JSON.stringify(r.j.data.map((x) => x.received_date)));
  if (period === 'month' && coll > 0) t('collection list this month: no receipt is dated before this month', r.j.data.every((x) => x.received_date >= monthStart), JSON.stringify(r.j.data.map((x) => x.received_date)));
}
for (const period of ['today', 'month', 'total']) {
  const tot = (await rowsOf('/dashboard/daily-status')).reduce((a, r) => ({ s: a.s + r[`sales_${period}`], c: a.c + r[`coll_${period}`] }), { s: 0, c: 0 });
  let r = await A('GET', `/dashboard/daily-status/list?projectId=all&kind=sales&period=${period}`);
  t(`daily card, Total row: sales ${period} = ${tot.s} and the list has ${r.j?.count} rows`, r.s === 200 && r.j.count === tot.s, r.s);
  r = await A('GET', `/dashboard/daily-status/list?projectId=all&kind=collection&period=${period}`);
  t(`daily card, Total row: collection ${period} = ${tot.c} and the list adds up to ${r.j?.amount}`, r.s === 200 && Math.abs(r.j.amount - tot.c) < 0.01, r.s);
}
t('the cancelled booking and its receipts are in no list (same rule as the numbers)', !(await A('GET', `/dashboard/daily-status/list?projectId=${P1.proj}&kind=sales&period=total`)).j.data.some((x) => x.id === cancelled.id));

// ============ 3. Input checks, roles, nothing written ============
const bad = async (n, path) => { const r = await A('GET', path); t(`list: ${n} -> 400`, r.s === 400, r.s + ' ' + JSON.stringify(r.j)); };
await bad('no projectId', '/dashboard/demand-status/list?bucket=demand&sent=sent');
await bad('projectId "abc"', '/dashboard/demand-status/list?projectId=abc&bucket=demand&sent=sent');
await bad('projectId with SQL', `/dashboard/daily-status/list?projectId=${encodeURIComponent("x' or '1'='1")}&kind=sales&period=today`);
await bad('bucket "weird"', `/dashboard/demand-status/list?projectId=all&bucket=weird&sent=sent`);
await bad('sent "maybe"', `/dashboard/demand-status/list?projectId=all&bucket=demand&sent=maybe`);
await bad('kind "refunds"', `/dashboard/daily-status/list?projectId=all&kind=refunds&period=today`);
await bad('period "year"', `/dashboard/daily-status/list?projectId=all&kind=sales&period=year`);
await bad('bucket missing', `/dashboard/demand-status/list?projectId=all&sent=sent`);
let r = await NONE('GET', '/dashboard/demand-status/list?projectId=all&bucket=demand&sent=sent'); t('no login -> 401 (demand list)', r.s === 401, r.s);
r = await NONE('GET', '/dashboard/daily-status/list?projectId=all&kind=sales&period=today'); t('no login -> 401 (daily list)', r.s === 401, r.s);
r = await RO('GET', '/dashboard/daily-status/list?projectId=all&kind=sales&period=total'); t('read-only viewer may read the list (the card is theirs too)', r.s === 200 && r.j.count >= 6, r.s);
r = await A('GET', '/dashboard/demand-status/list?projectId=00000000-0000-0000-0000-000000000000&bucket=demand&sent=sent'); t('an unknown project gives an empty list, not an error', r.s === 200 && r.j.count === 0 && r.j.data.length === 0, r.s + JSON.stringify(r.j));
r = await A('POST', '/dashboard/demand-status/list', {}); t('the list cannot be written to (POST -> 404)', r.s === 404, r.s);
t('nothing was changed by reading the lists (the Daily Status card is the same before and after)', JSON.stringify((await rowsOf('/dashboard/daily-status')).filter((x) => [P1.proj, P2.proj].includes(x.project_id))) === JSON.stringify(cardDaily));

end();
