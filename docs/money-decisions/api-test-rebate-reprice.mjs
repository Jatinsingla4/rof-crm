// DEF-10 (the parts that need no GST decision): approving a rebate re-prices the demands with the SAME split as the booking confirmation, so the demands add up
// to the plan total exactly (no 1-rupee drift), the result does not depend on whether the rebate is approved before or after the confirmation, and the guard
// compares the money received (which includes GST) with the new demand total on the same basis. Statuses follow the new amounts.
// The GST basis itself (Q12, net taxable value) is NOT part of this test.
// Run against a local test API (psql must reach the same database).
import * as L from '../receipt-allocation/lib.mjs';
const { psql, today, U, t, tally } = L;
const E = await L.env();
const num = (v) => Number(v ?? 0);
const PCT = [33.33, 33.33, 33.34], REB = 100001;
const mk = (P, complete = true) => L.booking(E, P, { price: 3000000, carpet: 500, complete, extra: { company_rebate_rs: REB } });
const planOf = (c) => psql(`select id from payment_plans where consumer_id='${c}' order by created_at desc limit 1`);
const dem = (plan) => psql(`select string_agg(installment_index||':'||amount_due_inr||'/'||coalesce(cgst_amount,0)||'/'||coalesce(sgst_amount,0), ' ' order by installment_index) from demands where payment_plan_id='${plan}' and status<>'cancelled'`);
const gap = (plan) => num(psql(`select (select total_amount_inr from payment_plans where id='${plan}') - coalesce(sum(amount_due_inr),0) from demands where payment_plan_id='${plan}' and status<>'cancelled'`));
const d1 = (plan) => psql(`select amount_due_inr||'|'||(coalesce(cgst_amount,0)+coalesce(sgst_amount,0))||'|'||status from demands where payment_plan_id='${plan}' and installment_index=1 and status<>'cancelled' order by created_at limit 1`).split('|');

{ const P = await L.project(E, { tag: 'RR1', plan: PCT }); const b = await mk(P); const plan = planOf(b.c);
  t('P0: before the approval the demands add up to the plan total', gap(plan) === 0, gap(plan));
  const ap = await E.C('POST', `/booking/${b.id}/rebate/approve`, {});
  t('P1: after approving a 1,00,001 rebate the demands add up to the plan total exactly (no drift)', ap.s === 200 && gap(plan) === 0, `${ap.s} gap ${gap(plan)} ${dem(plan)}`); }
{ const P = await L.project(E, { tag: 'RR2', plan: PCT });
  const x = await mk(P, false); const ax = await E.C('POST', `/booking/${x.id}/rebate/approve`, {}); const cx = await E.A('PATCH', `/booking/${x.id}`, { booking_amount: 10000, payment_mode: 'cash' });
  const y = await mk(P, true); const ay = await E.C('POST', `/booking/${y.id}/rebate/approve`, {});
  const dx = dem(planOf(x.c)), dy = dem(planOf(y.c));
  t('P2: the same rebate approved before the confirmation or after it gives the same plan total and the same demands', ax.s === 200 && cx.s === 200 && ay.s === 200 && dx === dy, `${dx} || ${dy}`); }
{ const P = await L.project(E, { tag: 'RR3', plan: PCT }); const b = await mk(P); const plan = planOf(b.c); const [, gst] = d1(plan);
  const newNet = Math.round((3000000 - REB) * (33.33 / 100)); const X = newNet + num(gst);
  const r = await L.receipt(E, b, X); const ap = await E.C('POST', `/booking/${b.id}/rebate/approve`, {}); const [amt, g, st] = d1(plan);
  t('P3: paying exactly the new instalment 1 total (amount and GST) does not block the approval, and the instalment becomes paid', r.step === 'clear' && ap.s === 200 && num(amt) + num(g) === X && st === 'paid', `${ap.s} ${JSON.stringify(ap.j).slice(0, 120)} amount ${amt} gst ${g} status ${st} paid ${X}`); }
{ const P = await L.project(E, { tag: 'RR4', plan: PCT }); const b = await mk(P); const plan = planOf(b.c); const [amt0, gst] = d1(plan);
  const r = await L.receipt(E, b, num(amt0) + num(gst)); const ap = await E.C('POST', `/booking/${b.id}/rebate/approve`, {});
  t('P4: control: an instalment already paid in full before the approval still blocks it (409)', r.step === 'clear' && ap.s === 409, `${ap.s} ${JSON.stringify(ap.j).slice(0, 100)}`); }
{ const P = await L.project(E, { tag: 'RR5', plan: PCT }); const b = await mk(P); const plan = planOf(b.c);
  const newNet = Math.round((3000000 - REB) * (33.33 / 100));
  await L.receipt(E, b, newNet); const ap = await E.C('POST', `/booking/${b.id}/rebate/approve`, {}); const [, , st] = d1(plan);
  t('P5: paying less than the new total leaves the instalment partial after the approval', ap.s === 200 && st === 'partial', `${ap.s} ${st}`); }
{ const P = await L.project(E, { tag: 'RR6', plan: PCT }); const b = await mk(P); const own = await E.A('POST', `/booking/${b.id}/rebate/approve`, {});
  t('P6: control: the requester still cannot approve their own rebate (403)', own.s === 403, own.s); }

console.log(`\nRESULT: ${tally()}`);
process.exit(/ 0 failed/.test(tally()) ? 0 : 1);
