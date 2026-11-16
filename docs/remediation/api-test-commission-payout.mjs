// Phase 6: broker commission. The amount (base price x rate), the payout maths (GST and TDS from the broker's tax setup, to the paisa), and the payout gate:
// with the flag commission_requires_cleared_v1 OFF (the default) a commission can be paid once the booking is active/complete, as before; with it ON the booking
// amount must have CLEARED (BR-03, collected = cleared). The flag is switched for the run and put back. Run against a local test API:
//   BASE=http://localhost:3096/api node api-test-commission-payout.mjs   (psql must reach the same database)
import { env, project, booking, receipt, psql, t, tally, today } from '../receipt-allocation/lib.mjs';

const E = await env(); const P = await project(E, { tag: 'CM' });
const U = Date.now().toString(36).slice(-5), num = (s) => Number(s || 0);
const pan = () => 'ABCDE' + String(Math.floor(1000 + Math.random() * 8999)) + 'F', mob = () => '9' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0');
const FLAG = 'commission_requires_cleared_v1';
const flagBefore = psql(`select value from global_settings where key='${FLAG}'`);
const setFlag = (v) => psql(`insert into global_settings (key, value) values ('${FLAG}', '${v}') on conflict (key) do update set value = '${v}' returning 1`);
const broker = async ({ pan: p = pan(), tds = 5, gst = 18, exempt = false } = {}) => {
  const nb = await E.A('POST', '/brokers', { firmName: `Cm Firm ${Math.random().toString(36).slice(2, 7)} ${U}`, mobile: mob(), commissionPct: 2, ...(p ? { pan: p } : {}) });
  const id = nb.j.data.id; await E.C('PATCH', `/brokers/${id}/approve`, {}); await E.A('POST', `/broker-setup/${id}`, { tdsRatePct: tds, gstRatePct: gst, ...(exempt ? { isGstExempt: true } : {}) });
  return id;
};
const brokerBooking = async (bid, o = {}) => booking(E, P, { price: o.price ?? 3000000, extra: { booking_type: 'broker', broker_id: bid, broker_commission: o.comm ?? 2, broker_commission_type: o.ctype ?? 'percent' } });
const commOf = (b) => psql(`select id from broker_commissions where consumer_id='${b.c}' order by created_at desc limit 1`);
const pay = (id) => E.A('PATCH', `/brokers/commission/${id}`, { status: 'paid' });
const clearBookingReceipt = async (b) => { const rid = psql(`select id from receipts where consumer_id='${b.c}' order by created_at limit 1`); await E.C('PATCH', `/payments/receipts/${rid}/approve`, {}); await E.C('PATCH', `/payments/receipts/${rid}/deposit`, { deposit_date: today() }); return E.C('PATCH', `/payments/receipts/${rid}/clear`, { clearing_date: today() }); };

try {
  const bid = await broker();

  // ---- the amount: base price x rate, or a flat sum ----
  {
    const b = await brokerBooking(bid, { price: 3000000, comm: 2 }); const c = commOf(b);
    t('amount: 2% of a 30,00,000 price is 60,000', num(psql(`select commission_amount_inr from broker_commissions where id='${c}'`)) === 60000);
    const f = await brokerBooking(bid, { price: 3000000, comm: 12345.67, ctype: 'flat' });
    t('amount: a flat commission is kept to the paisa (12,345.67)', num(psql(`select commission_amount_inr from broker_commissions where id='${commOf(f)}'`)) === 12345.67);
  }

  // ---- flag OFF (the default): the old rule, unchanged ----
  setFlag('off');
  {
    const b = await brokerBooking(bid); const c = commOf(b);
    t('flag off: nothing has cleared on this booking', num(psql(`select count(*) from receipts where consumer_id='${b.c}' and status='cleared'`)) === 0);
    const r = await pay(c);
    t('flag off: the commission is paid as before: 60,000 + GST 10,800 - TDS 3,000 = net 67,800', r.s === 200 && num(r.j.data.gst_amount) === 10800 && num(r.j.data.tds_amount) === 3000 && num(r.j.data.net_amount_inr) === 67800, r.s + JSON.stringify(r.j));
    t('flag off: the reconciliation lists a paid commission with no cleared receipt behind it', ((await E.A('GET', '/booking/reconciliation')).j?.data?.commissions_paid_with_no_cleared_receipt || []).some((x) => x.id === c));
  }

  // ---- flag ON: paid only on cleared money ----
  setFlag('on');
  {
    const b = await brokerBooking(bid); const c = commOf(b);
    const r = await pay(c);
    t('flag on: nothing cleared, so the commission is refused (409) and says why', r.s === 409 && /cleared/i.test(r.j?.error || '') && psql(`select status from broker_commissions where id='${c}'`) === 'pending', r.s + JSON.stringify(r.j));
    await receipt(E, b, 5000, { clear: false });
    t('flag on: a receipt that is only recorded (not cleared) still does not unlock it', (await pay(c)).s === 409);
    const cl = await clearBookingReceipt(b);
    const ok = await pay(c);
    t('flag on: once the booking amount has cleared it is paid, 60,000 + 10,800 - 3,000 = 67,800', cl.s === 200 && ok.s === 200 && num(ok.j.data.net_amount_inr) === 67800, `${cl.s} ${ok.s} ${JSON.stringify(ok.j)}`);
    t('flag on: a second payment is refused (409), the amounts do not move', (await pay(c)).s === 409 && num(psql(`select net_amount_inr from broker_commissions where id='${c}'`)) === 67800);
  }
  {
    const b = await brokerBooking(bid); const c = commOf(b);
    await receipt(E, b, 400000);   // a cleared 4,00,000 covers the 10,000 booking amount
    const r = await pay(c);
    t('flag on: cleared money above the booking amount unlocks the payment', r.s === 200, r.s + JSON.stringify(r.j));
  }
  {
    const b = await brokerBooking(bid); const c = commOf(b);
    await receipt(E, b, 400000);
    const rid = psql(`select id from receipts where consumer_id='${b.c}' and amount_received_inr=400000`);
    const q = await E.A('POST', `/payments/receipts/${rid}/returns`, { amount: 395000, reason: 'bank returned', bank_return_date: today(), idempotency_key: 'k' + Math.random().toString(36).slice(2, 9) });
    await E.C('POST', `/payments/receipt-returns/${q.j.data.id}/approve`, {});
    t('flag on: money that the bank returned no longer counts (5,000 left of a 10,000 booking amount -> 409)', (await pay(c)).s === 409);
  }
  {
    const b = await booking(E, P, { price: 3000000, complete: false, extra: { booking_type: 'broker', broker_id: bid, broker_commission: 2, broker_commission_type: 'percent' } }); const c = commOf(b);
    const cn = await E.A('POST', `/booking/${b.id}/cancel`, { reason: 'probe' });
    const r = await pay(c);
    t('a commission of a cancelled booking is cancelled with it and cannot be paid (409)', cn.s === 200 && psql(`select status from broker_commissions where id='${c}'`) === 'cancelled' && r.s === 409, `${cn.s} ${r.s} ${JSON.stringify(r.j)}`);
  }

  // ---- the payout maths, to the paisa (flag on, money cleared) ----
  setFlag('on');
  {
    const exempt = await broker({ tds: 5, gst: 18, exempt: true }); const b = await brokerBooking(exempt, { comm: 100000, ctype: 'flat' }); await receipt(E, b, 400000);
    const r = await pay(commOf(b));
    t('maths: a GST-exempt broker gets no GST: 1,00,000 - TDS 5,000 = 95,000', r.s === 200 && num(r.j.data.gst_amount) === 0 && num(r.j.data.tds_amount) === 5000 && num(r.j.data.net_amount_inr) === 95000, r.s + JSON.stringify(r.j));
    const nopan = await broker({ pan: null, tds: 5, gst: 18 }); const b2 = await brokerBooking(nopan, { comm: 10000, ctype: 'flat' }); await receipt(E, b2, 400000);
    const r2 = await pay(commOf(b2));
    t('maths: a broker with no PAN is deducted at least 20% (setup 5%): TDS 2,000, GST 1,800, net 9,800', r2.s === 200 && num(r2.j.data.tds_amount) === 2000 && num(r2.j.data.gst_amount) === 1800 && num(r2.j.data.net_amount_inr) === 9800, r2.s + JSON.stringify(r2.j));
    const odd = await broker({ tds: 5, gst: 18 }); const b3 = await brokerBooking(odd, { comm: 12345.67, ctype: 'flat' }); await receipt(E, b3, 400000);
    const r3 = await pay(commOf(b3));
    t('maths: 12,345.67 at 5% TDS and 18% GST -> GST 2,222.22, TDS 617.28, net 13,950.61', r3.s === 200 && num(r3.j.data.gst_amount) === 2222.22 && num(r3.j.data.tds_amount) === 617.28 && num(r3.j.data.net_amount_inr) === 13950.61, r3.s + JSON.stringify(r3.j));
  }

  // ---- no tax setup: refused with the reason, nothing paid ----
  {
    const raw = await E.A('POST', '/brokers', { firmName: `Cm NoTax ${U}${Math.random().toString(36).slice(2, 5)}`, mobile: mob(), commissionPct: 2, pan: pan() });
    await E.C('PATCH', `/brokers/${raw.j.data.id}/approve`, {});
    const b = await brokerBooking(raw.j.data.id); await receipt(E, b, 400000);
    const r = await pay(commOf(b));
    t('a broker with no tax setup cannot be paid (409, says to save the setup first)', r.s === 409 && /tax setup/i.test(r.j?.error || ''), r.s + JSON.stringify(r.j));
  }
} finally {
  if (flagBefore) setFlag(flagBefore); else psql(`delete from global_settings where key='${FLAG}' returning 1`);
}
console.log(`\nRESULT: ${tally()}`);
process.exit(tally().includes(' 0 failed') ? 0 : 1);
