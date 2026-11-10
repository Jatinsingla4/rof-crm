// Owner decision D-COLLECTED and the P0 defect DEF-03: an approved receipt return is taken off the money in EVERY reader (surrender cap, allocation cancel,
// refund room, transfer snapshot, dashboard, Project Collection, customer balance, credit summary), so refund plus forfeit can never exceed real money.
// Scenario: one cleared receipt of 100,000, an approved return of 40,000, eligible money 60,000. Control: the same readers without a return give 100,000.
// Run against a local test API (psql must reach the same database).
import * as L from '../receipt-allocation/lib.mjs';
import { spawn } from 'node:child_process';
const { psql, today, U, t, tally } = L;
const E = await L.env();
const num = (v) => Number(v ?? 0);
let kn = 0; const key = () => `K${U}${++kn}${Math.random().toString(36).slice(2, 6)}`;
const eligible = (c) => num(psql(`select coalesce(sum(r.amount_received_inr - coalesce((select sum(x.amount) from receipt_returns x where x.receipt_id=r.id and x.status='approved'),0)),0) from receipts r where r.consumer_id='${c}' and r.status='cleared' and r.is_advance is not true`));
async function scen(tag, { ret = true } = {}) {
  const P = await L.project(E, { tag, plan: [10, 20, 30, 40] });
  const b = await L.booking(E, P, { price: 3000000, carpet: 500 });
  const r = await L.receipt(E, b, 100000);
  if (r.step !== 'clear' || r.s2 !== 200) throw new Error('clear ' + JSON.stringify(r).slice(0, 200));
  if (ret) {
    const q = await E.A('POST', `/payments/receipts/${r.j.data.id}/returns`, { amount: 40000, reason: 'bank returned the cheque', bank_return_date: today(), idempotency_key: key() });
    const ap = await E.C('POST', `/payments/receipt-returns/${q.j.data.id}/approve`, {});
    if (q.s !== 201 || ap.s !== 200) throw new Error('return ' + q.s + ap.s);
  }
  return { P, b, rid: r.j.data.id, alloc: psql(`select id from allocations where consumer_id='${b.c}' limit 1`) };
}
const surrender = (s, refund, forfeit = 0) => E.A('POST', '/surrender', { consumerId: s.b.c, allocationId: s.alloc, bookingId: s.b.id, unitId: s.b.u, projectId: s.P.proj, type: 'cancellation', forfeitureAmount: forfeit, refundAmount: refund, surrenderDate: today() });
const readers = async (s) => {
  const det = await E.A('GET', `/surrender/detail/${s.b.c}`);
  const ds = await E.A('GET', '/dashboard/daily-status');
  const pc = await E.A('GET', `/reports/project-collection?projectId=${s.P.proj}`);
  const cb = await E.A('GET', `/reports/customer-balance?projectId=${s.P.proj}`);
  const cr = await E.A('GET', `/payments/credit-allocations/summary?consumerId=${s.b.c}`);
  return {
    surrenderDetail: num(det.j?.data?.financials?.totalReceived),
    dashboard: num((ds.j?.data ?? []).find((x) => x.project_id === s.P.proj)?.coll_total),
    projectCollection: num(pc.j?.data?.[0]?.total_collection),
    customerBalance: num((cb.j?.data ?? []).find((x) => x.consumer_id === s.b.c)?.total_received),
    creditEligible: num(cr.j?.data?.[0]?.eligible),
  };
};

{ const s = await scen('N1'); const el = eligible(s.b.c);
  t('N0: eligible money after the return is 60,000', el === 60000, el);
  const r = await surrender(s, 100000);
  t('N1: surrender with refund 100,000 against 60,000 of eligible money is refused', r.s >= 400 && psql(`select count(*) from cancellations where consumer_id='${s.b.c}'`) === '0', r.s + JSON.stringify(r.j).slice(0, 120));
  const ok = await surrender(s, 60000);
  t('N1b: a surrender within the eligible money (refund 60,000) is accepted', ok.s === 201, ok.s + JSON.stringify(ok.j).slice(0, 120)); }
{ const s = await scen('N2');
  const x = await E.A('POST', `/allocations/${s.alloc}/cancel`, { reason: 'N2' });
  const row = psql(`select forfeiture_amount_inr||'|'||refund_amount_inr from cancellations where consumer_id='${s.b.c}'`).split('|').map(num);
  t('N2: allocation cancel works out forfeit and refund from the 60,000 (forfeit + refund = 60,000)', x.s === 200 && row[0] + row[1] === 60000, JSON.stringify(row)); }
{ const s = await scen('N3');
  const x = await E.A('POST', '/payments/refunds', { consumer_id: s.b.c, refund_amount_inr: 70000, reason: 'N3', refund_mode: 'neft' });
  t('N3: a refund request of 70,000 against 60,000 is refused (409)', x.s === 409, x.s);
  const ok = await E.A('POST', '/payments/refunds', { consumer_id: s.b.c, refund_amount_inr: 60000, reason: 'N3', refund_mode: 'neft' });
  t('N3b: a refund request of exactly 60,000 is accepted', ok.s === 201, ok.s + JSON.stringify(ok.j).slice(0, 100)); }
{ const s = await scen('N4'); const buyer = await L.applicant(E, s.P, 'Buyer');
  const x = await E.A('POST', '/transfers', { unitId: s.b.u, oldConsumerId: s.b.c, newConsumerId: buyer, transferFee: 0, adminCharges: 0 });
  const paid = num(psql(`select seller_total_paid_inr from ownership_transfers where old_consumer_id='${s.b.c}'`));
  t('N4: the transfer snapshot of what the seller paid is 60,000', x.s === 201 && paid === 60000, x.s + ' ' + paid); }
for (const [id, withRet, want] of [['N5', true, 60000], ['N6', false, 100000]]) {
  const s = await scen(id, { ret: withRet }); const rd = await readers(s);
  t(`${id}: dashboard, Project Collection, customer balance, credit summary and the surrender screen all show ${want}`, Object.values(rd).every((v) => v === want), JSON.stringify(rd)); }
{ // surrender and refund requests take the consumer lock (the one returns and clearing take), so the money they read cannot go stale while a return is approved
  const holdLock = (consumerId, secs) => spawn('psql', ['-qAt', '-c', `begin; select pg_advisory_xact_lock(hashtext('receipt-consumer:${consumerId}')); select pg_sleep(${secs}); commit;`], { stdio: 'ignore' });
  const finished = (h) => new Promise((r) => (h.exitCode !== null ? r() : h.on('close', r)));
  const timed = async (f) => { const t0 = Date.now(); const r = await f(); return { r, ms: Date.now() - t0 }; };
  const s = await scen('N7', { ret: false });
  const h1 = holdLock(s.b.c, 4); await new Promise((r) => setTimeout(r, 900));
  const x = await timed(() => surrender(s, 50000));
  t('N7: a surrender waits while another session holds the consumer lock (it takes the same lock as returns)', x.ms >= 2000 && x.r.s === 201, x.ms + 'ms HTTP ' + x.r.s);
  await finished(h1);
  const s2 = await scen('N7b', { ret: false });
  const h2 = holdLock(s2.b.c, 4); await new Promise((r) => setTimeout(r, 900));
  const y = await timed(() => E.A('POST', '/payments/refunds', { consumer_id: s2.b.c, refund_amount_inr: 1000, reason: 'N7b', refund_mode: 'neft' }));
  t('N7b: a refund request waits while another session holds the consumer lock', y.ms >= 2000 && y.r.s === 201, y.ms + 'ms HTTP ' + y.r.s);
  await finished(h2); }
{ // booking amount must not come from a legacy ADV row
  const P = await L.project(E, { tag: 'N8', plan: [10, 20, 30, 40] }); const b = await L.booking(E, P, { price: 3000000, carpet: 500 });
  const adv = await L.receipt(E, b, 100000); psql(`update receipts set is_advance=true where id='${adv.j.data.id}'`);
  const p2 = await L.receipt(E, b, 5000, { clear: false }); await E.C('PATCH', `/payments/receipts/${p2.j.data.id}/bounce`, { reason: 'N8' });
  const ba = num(psql(`select booking_amount from booking_records where id='${b.id}'`));
  t('N8: the booking amount recompute ignores a legacy ADV receipt', ba !== 100000, ba); }

console.log(`\nRESULT: ${tally()}`);
process.exit(/ 0 failed/.test(tally()) ? 0 : 1);
