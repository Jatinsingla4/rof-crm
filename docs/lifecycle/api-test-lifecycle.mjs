// Booking / unit / customer lifecycle (QA-012, 017, 019, 044, 045): a cancelled booking takes no new money movement through the API (not only through the screens),
// a unit with a live booking cannot be allotted to somebody else, and the reconciliation lists the states that disagree. Own project, units and applicants (new every run).
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-lifecycle.mjs   (psql must reach the same database)
import { env, project, booking, applicant, unit, receipt, psql, t, tally, today } from '../receipt-allocation/lib.mjs';

const E = await env(); const P = await project(E, { tag: 'LC' });
const cancelledMsg = (r) => r.s === 409 && /cancelled/i.test(r.j?.error || '');

// ---- a booking that is cancelled underneath its money: no new movement through the API ----
{
  const b = await booking(E, P);
  t('setup: a confirmed booking', !!b.id, JSON.stringify(b.r?.j).slice(0, 200));
  const pend = await receipt(E, b, 5000, { clear: false });   // a receipt that is only recorded
  const rid = pend.j.data.id;
  const live = await E.A('PATCH', `/payments/receipts/${rid}`, { transactionRef: 'LIVE-' + rid.slice(0, 6) });
  t('control: while the booking is live, a pending receipt can be edited (200)', live.s === 200, live.s + JSON.stringify(live.j).slice(0, 160));

  // an approved, cleared receipt and a demand, for the invoice and credit checks
  const plan = psql(`select id from payment_plans where consumer_id='${b.c}' order by created_at desc limit 1`);
  const clr = psql(`insert into receipts (consumer_id, payment_plan_id, amount_received_inr, received_date, clearing_date, status, approval_status, payment_method, received_by_user_id)
    select '${b.c}', '${plan}', 21000, current_date, current_date, 'cleared', 'approved', 'neft', id from users where email='accounts_finance@test.local' returning id`).split('\n')[0];
  const dem = psql(`select id from demands where payment_plan_id='${plan}' order by installment_index limit 1`);

  psql(`update booking_records set status='cancelled' where id='${b.id}' returning 1`);   // the booking is cancelled underneath its money (what a surrender or cancellation leaves)

  let r = await E.A('PATCH', `/payments/receipts/${rid}`, { transactionRef: 'AFTER-CANCEL' });
  t('cancelled booking: editing a receipt is refused (409)', cancelledMsg(r), r.s + JSON.stringify(r.j).slice(0, 200));
  r = await E.C('PATCH', `/payments/receipts/${rid}/hold`, { hold_remark: 'x' });
  t('cancelled booking: holding a receipt is refused (409)', cancelledMsg(r), r.s + JSON.stringify(r.j).slice(0, 200));
  r = await E.A('POST', '/payments/credit-allocations', { demand_id: dem, amount: 1, reason: 'after cancel', idempotency_key: 'lc' + Math.random().toString(36).slice(2, 10) });
  t('cancelled booking: a credit allocation is refused (409)', cancelledMsg(r), r.s + JSON.stringify(r.j).slice(0, 200));
  r = await E.A('POST', '/payments/gst-invoices', { consumerId: b.c, receiptId: clr, baseAmount: 1000, supplyType: 'intrastate', invoiceType: 'tax_invoice' });
  t('cancelled booking: a tax invoice on its receipt is refused (409)', cancelledMsg(r), r.s + JSON.stringify(r.j).slice(0, 200));
  r = await E.A('POST', '/payments/gst-invoices', { consumerId: b.c, baseAmount: 1000, gstRate: 5, supplyType: 'intrastate', invoiceType: 'tax_invoice' });
  t('cancelled booking: a direct tax invoice for the applicant is refused (409)', cancelledMsg(r), r.s + JSON.stringify(r.j).slice(0, 200));
  r = await E.C('POST', `/payments/receipts/${rid}/cancel`, { reason: 'booking cancelled' });
  t('the way out stays open: a checker can still cancel the pending receipt of the cancelled booking', r.s === 200, r.s + JSON.stringify(r.j).slice(0, 200));

  // the reconciliation sees the demands the cancellation left live
  const rec = await E.A('GET', '/booking/reconciliation');
  const sets = rec.j?.data || {};
  t('reconciliation: the new lifecycle sets are there', ['live_bookings_whose_unit_is_available', 'complete_bookings_with_no_live_allocation', 'units_linked_to_several_applicants', 'live_demands_on_a_cancelled_booking', 'cancelled_stage_with_a_live_booking'].every((k) => Array.isArray(sets[k])), Object.keys(sets).join(','));
  t('reconciliation: the live demands left on the cancelled booking are listed', (sets.live_demands_on_a_cancelled_booking || []).some((x) => x.consumer_id === b.c), JSON.stringify(sets.live_demands_on_a_cancelled_booking || []).slice(0, 200));
}

// ---- a booking waiting for its payment holds the unit ----
{
  // a booking started without a payment: it waits for its payment and leaves the unit 'available'
  const ou = await unit(E, P), oc = await applicant(E, P, 'W');
  const started = await E.A('POST', '/booking', { consumer_id: oc, project_id: P.proj, unit_id: ou, selected_plan_name: P.planName, booking_date: today() });
  const owner = { id: started.j?.data?.id, u: ou, c: oc };
  t('setup: a booking waiting for payment (pending_payment)', started.s === 201 && psql(`select status from booking_records where id='${owner.id}'`) === 'pending_payment', started.s + JSON.stringify(started.j).slice(0, 200));
  const other = await applicant(E, P, 'O');
  const r = await E.A('POST', '/allocations', { consumerId: other, unitId: owner.u, projectId: P.proj, allotmentDate: today(), remarks: 'over a live booking' });
  t('a unit with a live booking of another applicant cannot be allotted (409)', r.s === 409 && /live booking/i.test(r.j?.error || ''), r.s + JSON.stringify(r.j).slice(0, 200));
  t('and nothing was allotted', psql(`select count(*) from allocations where unit_id='${owner.u}'`) === '0');

  const st = await E.A('PATCH', `/consumers/${owner.c}`, { lead_stage: 'cancelled' });
  t('an applicant whose booking waits for payment cannot be moved to "cancelled" by editing the stage (409)', st.s === 409 && /live booking/i.test(st.j?.error || ''), st.s + JSON.stringify(st.j).slice(0, 200));
}

// ---- the reconciliation lists a confirmed booking whose unit says it is free ----
{
  const b = await booking(E, P);
  const before = psql(`select status from units where id='${b.u}'`);
  psql(`update units set status='available' where id='${b.u}' returning 1`);
  try {
    const sets = (await E.A('GET', '/booking/reconciliation')).j?.data || {};
    t(`reconciliation: a complete booking whose unit says available is listed (the unit was ${before})`, (sets.live_bookings_whose_unit_is_available || []).some((x) => x.id === b.id), JSON.stringify(sets.live_bookings_whose_unit_is_available || []).slice(0, 200));
  } finally { psql(`update units set status='${before}' where id='${b.u}' returning 1`); }
  const sets2 = (await E.A('GET', '/booking/reconciliation')).j?.data || {};
  t('and not listed once the unit is back in step', !(sets2.live_bookings_whose_unit_is_available || []).some((x) => x.id === b.id));
}

console.log(`\nRESULT: ${tally()}`);
process.exit(tally().includes(' 0 failed') ? 0 : 1);
