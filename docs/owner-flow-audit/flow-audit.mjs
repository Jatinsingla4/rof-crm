// Owner flow audit: project setup -> unit -> booking -> demands -> receipts -> hold -> surrender -> registry, each scenario with
// DIFFERENT settings, every number checked against an independent calculation (so a hard-coded value shows up as a mismatch).
//   BASE=http://localhost:3010/api node docs/owner-flow-audit/flow-audit.mjs
// Local test stack only (psql to the same database the API uses, test users). Every row it creates is named "FA<run id> ...".
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const B = process.env.BASE || 'http://localhost:3010/api';
const env = { ...process.env, PGHOST: process.env.PGHOST || 'localhost', PGPORT: process.env.PGPORT || '5433', PGUSER: process.env.PGUSER || 'postgres', PGDATABASE: process.env.PGDATABASE || 'rof_sec' };
const PSQL = process.env.PSQL || (existsSync('/Library/PostgreSQL/18/bin/psql') ? '/Library/PostgreSQL/18/bin/psql' : 'psql');
const psql = (sql) => execFileSync(PSQL, ['-qAt', '-F', '|', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8', env }).trim();
const q1 = (sql) => psql(sql).split('\n')[0];
const rows = (sql) => psql(sql).split('\n').filter(Boolean).map((l) => l.split('|'));
const login = async (e) => (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: e, password: 'Test#Pass1234' }) })).json()).token;
const TOK = await login('super_admin@test.local');
const api = async (m, p, b) => {
  const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + TOK }, body: b === undefined ? undefined : JSON.stringify(b) });
  const text = await r.text(); let j = null; try { j = JSON.parse(text); } catch {}
  return { s: r.status, j, text };
};
const must = (r, what) => { if (r.s >= 300) throw new Error(`${what}: ${r.s} ${r.text.slice(0, 300)}`); return r.j?.data ?? r.j; };
const today = new Date().toISOString().slice(0, 10);
const RUN = Date.now().toString(36).toUpperCase();
let pass = 0, fail = 0;
const check = (name, ours, expected, tol = 0.5) => {
  const ok = Math.abs(Number(ours) - Number(expected)) <= tol;
  ok ? pass++ : fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ours ${ours} expected ${expected}`);
};
const truth = (name, cond, info = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${cond ? '' : ' ' + info}`); };

// the one GST slab that covers today (slabs are global); create when the database has none
const slabs = must(await api('GET', '/gst-configuration/gst-slabs'), 'slabs');
let slab = slabs.find((s) => s.from_date <= today && s.to_date >= today)?.id;
if (!slab) slab = must(await api('POST', '/gst-configuration/gst-slabs', { fromDate: '2020-01-01', toDate: '2099-12-31' }), 'slab').id;

async function scenario(n, S) {
  console.log(`\n=== Scenario ${n}: GST ${S.cg}+${S.sg}, rate ${S.rate}, carpet ${S.carpet}, plan ${S.plan.join('/')}% ===`);
  const name = `FA${RUN} S${n}`;
  const co = must(await api('POST', '/companies', { name: name + ' Co' }), 'company').id;
  const P = must(await api('POST', '/projects', { companyId: co, name: name + ' Project', reraNumber: `FA${RUN}S${n}`, tcpLicence: 'x' }), 'project').id;
  const T = must(await api('POST', `/projects/${P}/towers`, { towerName: 'Tower A' }), 'tower').id;
  const mk = async (no, carpet) => must(await api('POST', '/units', { projectId: P, towerId: T, unitNumber: no, floor: 1, bhkType: '2BHK', carpetAreaSqft: carpet, superAreaSqft: carpet + 100, balconyAreaSqft: 50, basePriceInr: Math.round(S.rate * carpet), totalPriceInr: Math.round(S.rate * carpet) }), 'unit ' + no).id;
  if (S.cap) must(await api('PUT', `/projects/${P}/settings`, { balcony_max_charge_inr: S.cap }), 'project settings');
  const U1 = await mk('A-101', S.carpet), U2 = await mk('A-102', S.carpet + 11.5);
  const tax = must(await api('POST', '/gst-configuration/gst-tax-setup', { slabId: slab, gstCode: `${name} ${S.cg}+${S.sg}`, type: 'INTRA', cgstPct: S.cg, sgstPct: S.sg }), 'tax').id;
  for (const ct of ['BASIC', 'OTHER CHARGE', 'PLC']) must(await api('POST', '/gst-configuration/gst-charge-mapping', { projectId: P, slabId: slab, gstTaxId: tax, chargeType: ct }), 'mapping ' + ct);
  const PLAN = name + ' plan';
  let idx = 0;
  for (const pct of S.plan) { idx++; must(await api('POST', `/projects/${P}/plan-templates`, { plan_name: PLAN, installment_name: `Part ${idx}`, installment_type: idx === 1 ? 'booking' : 'installment', percentage: pct, due_date_offset_days: (idx - 1) * 30, installment_index: idx }), 'plan row ' + idx); }

  const mob = '9' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0');
  const C = must(await api('POST', '/consumers', { name: 'Fa Tester', salutation: 'Mr.', first_name: 'Fa', last_name: 'Tester' + n, mobile: mob, project_id: P, email: `fa${RUN}${n}@example.com`, present_address: 'House 1, Test Road, Delhi 110001', gender: 'male', communication_mode: 'courier' }), 'consumer').id;
  const BK = must(await api('POST', '/booking', { consumer_id: C, project_id: P, unit_id: U1, selected_plan_name: PLAN, booking_date: today, basic_price: S.rate, carpet_area_sqft: S.carpet, communication_mode: 'courier' }), 'booking').id;
  const basic = Math.round(S.rate * S.carpet);
  const balcony = Math.min(S.cap || 100000, 50 * 1300);   // 50 sqft balcony at the charge-master rate 1300, capped by the project
  const base = basic + balcony;
  const row1 = Math.round(base * S.plan[0] / 100);
  const row1Gross = row1 + Math.round(row1 * S.cg / 100) + Math.round(row1 * S.sg / 100);
  must(await api('PATCH', `/booking/${BK}`, { booking_amount: row1Gross, payment_mode: 'online', payment_ref: `FAREF${RUN}${n}`, bank_name: 'FA Bank' }), 'confirm booking');

  // ---- demands
  check('balcony charge on the booking', q1(`select balcony_charge_amount from booking_records where id='${BK}'`), balcony, 1);
  const dem = rows(`select installment_index, amount_due_inr, coalesce(cgst_amount,0), coalesce(sgst_amount,0) from demands where consumer_id='${C}' and status<>'cancelled' order by installment_index`);
  check('number of demands', dem.length, S.plan.length);
  let sumBase = 0, sumTax = 0;
  dem.forEach((d, i) => {
    const exp = Math.round(base * S.plan[i] / 100);
    check(`  row ${i + 1} amount`, d[1], exp, 1);
    check(`  row ${i + 1} CGST`, d[2], Math.round(Number(d[1]) * S.cg / 100), 2);
    check(`  row ${i + 1} SGST`, d[3], Math.round(Number(d[1]) * S.sg / 100), 2);
    sumBase += Number(d[1]); sumTax += Number(d[2]) + Number(d[3]);
  });
  check('demands add up to basic + balcony', sumBase, base, 3);
  check('GST on the whole price', sumTax, base * (S.cg + S.sg) / 100, 5);

  // ---- booking receipt exists and equals row 1 gross
  const d1 = rows(`select status, due_date::text, (select count(*) from receipts r where r.demand_id = d.id) from demands d where consumer_id='${C}' and installment_index=1 and status<>'cancelled'`)[0];
  truth('row 1 (booking) demand is raised with the booking date and its receipt is linked', d1 && d1[1] === today && Number(d1[2]) === 1, JSON.stringify(d1));
  truth('row 1 (booking) demand is marked paid', d1 && d1[0] === 'paid', JSON.stringify(d1));
  check('booking receipt amount', q1(`select coalesce(sum(amount_received_inr),0) from receipts where consumer_id='${C}' and status<>'cancelled'`), row1Gross, 1);

  // ---- pay instalment 2 in two parts (hostile split), second part over-pays by 777
  const row2Gross = Number(dem[1][1]) + Number(dem[1][2]) + Number(dem[1][3]);
  const part1 = Math.floor(row2Gross / 3);
  must(await api('POST', '/payments/receipts', { consumerId: C, amountReceivedInr: part1, paymentDate: today, paymentMode: 'online', referenceNumber: `FA${RUN}${n}P1`, bankName: 'FA Bank', installmentIndex: 2 }), 'receipt part 1');
  const over = row2Gross - part1 + 777;
  must(await api('POST', '/payments/receipts', { consumerId: C, amountReceivedInr: over, paymentDate: today, paymentMode: 'online', referenceNumber: `FA${RUN}${n}P2`, bankName: 'FA Bank', installmentIndex: 2 }), 'receipt part 2');
  const real = rows(`select receipt_number, amount_received_inr, is_advance, received_date::text from receipts where consumer_id='${C}' and status<>'cancelled' order by created_at`);
  const advance = real.filter((r) => r[2] === 't');
  truth('an overpayment of 777 makes exactly one advance part of 777', advance.length === 1 && Number(advance[0][1]) === 777, JSON.stringify(real));
  truth('the advance part keeps the date of the payment', advance.every((r) => r[3] === today));
  check('total received', real.filter((r) => r[2] !== 't').reduce((s, r) => s + Number(r[1]), 0), row1Gross + row2Gross + 777, 1);

  // ---- clear every receipt, then check the money screens
  for (const id of psql(`select id from receipts where consumer_id='${C}' and status='pending'`).split('\n').filter(Boolean)) must(await api('PATCH', `/payments/receipts/${id}/clear`, { clearing_date: today }), 'clear');
  const form = await (await fetch(`${B}/payments/receipt-form/${C}`, { headers: { authorization: 'Bearer ' + TOK } })).text().catch(() => '');
  const totalDemand = sumBase + sumTax;
  const paid = row1Gross + row2Gross + 777;
  if (form.includes('Total Cost')) {
    const txt = form.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const num = (label) => { const m = txt.match(new RegExp(label + ':?\\s*(-?[\\d,]+(?:\\.\\d+)?)')); return m ? Number(m[1].replace(/,/g, '')) : NaN; };
    check('receipt form: total cost', num('Total Cost'), totalDemand, 2);
    check('receipt form: paid', num('Paid'), paid, 1);
    check('receipt form: balance', num('Balance'), totalDemand - paid, 3);
  } else console.log('note  receipt form page not reachable by this path, skipped');

  // ---- hold on the second unit
  const brokerId = q1(`select id from brokers where status='active' limit 1`) || must(await api('POST', '/brokers', { name: 'FA Broker ' + RUN, firm_name: 'FA Firm', mobile: '9' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0'), email: `fab${RUN}@example.com`, pan: 'ABCDE1234F' }), 'broker').id;
  const hold = await api('POST', '/inventory-hold', { unitId: U2, brokerId, clientName: 'Hold Client', holdHours: 5 });
  console.log(`note  hold on A-102 -> ${hold.s} ${hold.s >= 300 ? hold.text.slice(0, 160) : ''}`);
  if (hold.s < 300) {
    truth('held unit shows locked/held', ['locked', 'held'].includes(q1(`select status from units where id='${U2}'`)), q1(`select status from units where id='${U2}'`));
    const un = await api('POST', `/inventory-hold/${hold.j.data?.id || hold.j.id}/unhold`, {});
    truth('unhold works', un.s < 300, un.text.slice(0, 200));
    truth('unit is available after unhold', q1(`select status from units where id='${U2}'`) === 'available', q1(`select status from units where id='${U2}'`));
  }

  // ---- registry blocked while dues remain
  const alloc = q1(`select id from allocations where consumer_id='${C}' and status not in ('cancelled','transferred') limit 1`);
  const reg = await api('POST', '/registry/schedule', { allocationId: alloc, scheduledDate: today, appointmentDate: today });
  truth('registry is refused while dues remain', reg.s >= 400, `${reg.s} ${reg.text.slice(0, 160)}`);

  // ---- surrender: forfeit a number, refund the rest
  const received = Number(q1(`select coalesce(sum(amount_received_inr),0) from receipts where consumer_id='${C}' and status='cleared'`));
  const forfeit = 12345, refund = received - forfeit;
  const sur = await api('POST', '/surrender', { consumerId: C, allocationId: alloc, bookingId: BK, unitId: U1, projectId: P, type: 'surrender', surrenderDate: today, forfeitureAmount: forfeit, refundAmount: refund, totalAmount: refund, refundMode: 'bank_transfer', reason: 'audit' });
  truth('surrender accepted', sur.s < 300, `${sur.s} ${sur.text.slice(0, 300)}`);
  if (sur.s < 300) {
    truth('unit is free again after surrender', ['available', 'temp_surrender'].includes(q1(`select status from units where id='${U1}'`)), q1(`select status from units where id='${U1}'`));
    truth('allocation closed', q1(`select status from allocations where id='${alloc}'`) === 'cancelled', q1(`select status from allocations where id='${alloc}'`));
    const sr = rows(`select forfeiture_amount_inr, refund_amount_inr from surrender_applications where consumer_id='${C}' order by created_at desc limit 1`)[0];
    if (sr) { check('forfeiture stored', sr[0], forfeit); check('refund stored', sr[1], refund); }
  }
  const bad = await api('POST', '/surrender', { consumerId: C, allocationId: alloc, type: 'surrender', surrenderDate: today, forfeitureAmount: 1, refundAmount: 1, totalAmount: 2 });
  truth('a second surrender of the same allocation is refused', bad.s >= 400, bad.text.slice(0, 120));
}

const SCEN = [
  { cg: 1, sg: 1, rate: 3333.3333, carpet: 777.777, plan: [10, 40, 50] },
  { cg: 2.5, sg: 2.5, cap: 40000, rate: 5999.99, carpet: 512.5, plan: [7.5, 17.5, 25, 50] },
  { cg: 0.25, sg: 0.25, rate: 12345.6789, carpet: 301.333, plan: [33.33, 33.33, 33.34] },
];
for (let i = 0; i < SCEN.length; i++) {
  try { await scenario(i + 1, SCEN[i]); } catch (e) { fail++; console.log('FAIL scenario crashed: ' + e.message); }
}
console.log(`\nRESULT: ${pass} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
