// Owner decision U1: only CLEARED receipts reduce interest, from their clearing date (not the date they were recorded); a pending, authorised, deposited or
// bounced receipt does not; only a formally raised demand bears interest (a passed due date alone is not enough); the scheduler and the single-customer
// calculation use the same engine.  Interest runs on the basic amount (the existing rule), so only the differences between cases are asserted.
// Run against a local test API (psql must reach the same database).
import * as L from '../receipt-allocation/lib.mjs';
const { psql, today, U, t, tally } = L;
const E = await L.env();
const num = (v) => Number(v ?? 0);
const biz = (off) => psql(`select ((now() at time zone 'Asia/Kolkata')::date + (${off}))::text`);
const find = (o, re) => { if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (re.test(k) && typeof v !== 'object') return num(v); const r = find(v, re); if (r !== undefined) return r; } return undefined; };

async function scen(tag) {
  const P = await L.project(E, { tag, plan: [10, 20, 30, 40] });
  const b = await L.booking(E, P, { price: 3000000, carpet: 500 });
  const plan = psql(`select id from payment_plans where consumer_id='${b.c}' order by created_at desc limit 1`);
  psql(`update booking_records set booking_date=(now() at time zone 'Asia/Kolkata')::date - 3 where id='${b.id}'`);   // test set-up: receipts may be dated up to 2 days back
  psql(`update demands set status='demanded', raised_at=now(), due_date=(now() at time zone 'Asia/Kolkata')::date - 60 where payment_plan_id='${plan}' and installment_index=1`);   // test set-up: demand 1 raised and 60 days late
  return { P, b, plan };
}
const sched = async (s) => find((await E.A('POST', '/payments/interest-scheduler', { project_id: s.P.proj, persist: false })).j, /^total_interest_inr$/);
// a receipt recorded on `rec` and cleared on `clr` (days from today, negative = past), or left in the given state
const receipt = async (s, rec, clr, upto = 'cleared') => {
  const r = await E.A('POST', '/payments/receipts', { consumerId: s.b.c, bookingId: s.b.id, amountReceivedInr: 100000, paymentMode: 'neft', referenceNumber: `IB${U}${Math.random().toString(36).slice(2, 8)}`, paymentDate: biz(rec) });
  if (r.s !== 201) throw new Error('receipt ' + r.s + JSON.stringify(r.j).slice(0, 150));
  const id = r.j.data.id;
  if (upto !== 'pending') await E.C('PATCH', `/payments/receipts/${id}/approve`, {});
  if (upto === 'deposited' || upto === 'cleared') await E.C('PATCH', `/payments/receipts/${id}/deposit`, { deposit_date: biz(clr) });
  if (upto === 'cleared') { const c = await E.C('PATCH', `/payments/receipts/${id}/clear`, { clearing_date: biz(clr) }); if (c.s !== 200) throw new Error('clear ' + c.s + JSON.stringify(c.j).slice(0, 150)); }
  return id;
};

const base = await (async () => { const s = await scen('IB0'); return sched(s); })();
t('I0: with no payment the 60-day-late demand carries interest', base > 0, base);
for (const upto of ['pending', 'authorized', 'deposited']) {
  const s = await scen('IB' + upto); await receipt(s, -2, -2, upto); const v = await sched(s);
  t(`I1: a ${upto} receipt does not reduce interest (same as no payment)`, v === base, `${v} vs ${base}`); }
{ const s = await scen('IBc'); await receipt(s, -2, -2, 'cleared'); const v = await sched(s);
  t('I2: a cleared receipt reduces interest', v > 0 && v < base, `${v} vs ${base}`); }
{ const a = await scen('IBa'); await receipt(a, -3, -1, 'cleared'); const b = await scen('IBb'); await receipt(b, -1, -1, 'cleared');
  const va = await sched(a), vb = await sched(b);
  t('I3: interest counts from the clearing date, not the date the receipt was recorded (recorded 3 days ago and cleared yesterday = recorded and cleared yesterday)', va === vb, `${va} vs ${vb}`); }
{ const s = await scen('IBd'); const bn = await receipt(s, -2, -2, 'pending'); await E.C('PATCH', `/payments/receipts/${bn}/bounce`, { reason: 'I' }); const v = await sched(s);
  t('I4: a bounced receipt does not reduce interest', v === base, `${v} vs ${base}`); }
{ const s = await scen('IBe'); const plan = s.plan;
  psql(`update demands set status='demanded', raised_at=now(), due_date=(now() at time zone 'Asia/Kolkata')::date where payment_plan_id='${plan}' and installment_index=1`);
  psql(`update demands set due_date=(now() at time zone 'Asia/Kolkata')::date - 60 where payment_plan_id='${plan}' and installment_index=2`);   // demand 2: past due, never raised
  const v = await sched(s);
  t('I5: a demand that was never raised bears no interest although its due date has passed', v === 0, v); }
{ const s = await scen('IBf'); await receipt(s, -2, -2, 'cleared');
  const sch = await sched(s); const det = await E.A('POST', `/payments/consumer-interest-detail/${s.b.c}`, {}); const d = find(det.j, /total_interest/);
  t('I6: the scheduler and the single-customer calculation give the same interest', det.s === 200 && d === sch, `${det.s} scheduler ${sch} detail ${d}`); }

console.log(`\nRESULT: ${tally()}`);
process.exit(/ 0 failed/.test(tally()) ? 0 : 1);
