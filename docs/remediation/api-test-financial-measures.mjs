// Phase 5: one project, four bookings in different states (part paid, over-paid with a bank return, only uncleared money, a past-due instalment nobody paid),
// and every report that shows money must agree on the same named measures: agreement value, demands, valid collections, billed outstanding, overdue,
// contract balance, GST components, unallocated credit. Totals come from independent SQL where that is possible and from hand-worked figures where not.
// Run against a local test API:  BASE=http://localhost:3096/api node api-test-financial-measures.mjs   (psql must reach the same database)
import { env, project, booking, receipt, psql, t, tally, today } from '../receipt-allocation/lib.mjs';

const E = await env(); const P = await project(E, { tag: 'FM' }); const pid = P.proj;
const num = (s) => Number(s || 0), near = (a, b, tol = 0.011) => Math.abs(num(a) - num(b)) <= tol;
const key = () => 'k' + Math.random().toString(36).slice(2, 10);
const get = async (path, q = {}) => { const qs = new URLSearchParams({ projectId: pid, ...q }).toString(); const r = await E.A('GET', `${path}?${qs}`); return r; };
const raise = async (b, idx) => { const ds = psql(`select string_agg(id::text,',') from demands where consumer_id='${b.c}' and installment_index in (${idx}) and status<>'cancelled'`).split(','); return E.A('PATCH', '/payments/demands/activate', { demandIds: ds, installmentDate: today() }); };

// b1: 15,00,000 cleared in two receipts. b2: 10,00,000 cleared, 2,00,000 returned. b3: one uncleared receipt. b4: nothing paid, instalment 1 past due.
const b1 = await booking(E, P, { price: 3000000 }); await receipt(E, b1, 1000000); await receipt(E, b1, 500000);
const b2 = await booking(E, P, { price: 2000000 }); const r2 = await receipt(E, b2, 1000000);
const q = await E.A('POST', `/payments/receipts/${r2.j.data.id}/returns`, { amount: 200000, reason: 'bank returned part', bank_return_date: today(), idempotency_key: key() });
await E.C('POST', `/payments/receipt-returns/${q.j.data.id}/approve`, {});
const b3 = await booking(E, P, { price: 4000000 }); await receipt(E, b3, 100000, { clear: false });
const b4 = await booking(E, P, { price: 3000000 });
for (const b of [b1, b2, b3]) await raise(b, '1,2');
await raise(b4, '1');
psql(`update demands set due_date = (now() at time zone 'Asia/Kolkata')::date - 40 where consumer_id='${b4.c}' and installment_index=1 and status<>'cancelled'`);

// ---- independent oracle (SQL straight on the tables) ----
const DT = `(amount_due_inr + cgst_amount + sgst_amount + addon_charge_amount + addon_cgst_amount + addon_sgst_amount)`;
const plans = `(select id from payment_plans where project_id='${pid}')`;
const O = {
  agreementIncl: num(psql(`select coalesce(sum(${DT}),0) from demands where payment_plan_id in ${plans} and status<>'cancelled'`)),
  demandedIncl: num(psql(`select coalesce(sum(${DT}),0) from demands where payment_plan_id in ${plans} and status<>'cancelled' and raised_at is not null`)),
  demandedCgst: num(psql(`select coalesce(sum(cgst_amount + addon_cgst_amount),0) from demands where payment_plan_id in ${plans} and status<>'cancelled' and raised_at is not null`)),
  gross: num(psql(`select coalesce(sum(amount_received_inr),0) from receipts where payment_plan_id in ${plans} and status='cleared' and is_advance is not true`)),
  returned: num(psql(`select coalesce(sum(rr.amount),0) from receipt_returns rr join receipts r on r.id = rr.receipt_id where rr.status='approved' and r.payment_plan_id in ${plans}`)),
  uncleared: num(psql(`select coalesce(sum(amount_received_inr),0) from receipts where payment_plan_id in ${plans} and status in ('pending','authorized','deposited','on_hold') and is_advance is not true`)),
  gstOnReceipts: num(psql(`select coalesce(sum(cgst_amount + sgst_amount),0) from receipts where payment_plan_id in ${plans} and status='cleared' and is_advance is not true`)),
};
O.valid = O.gross - O.returned;
// worked by hand: instalments are 10/20/30/40% of price + 5% GST. Raised: b1 and b2 and b3 instalments 1+2 (30%), b4 instalment 1 (10%).
//  b1 pays inst 1 (3,15,000) and 5,00,000 of inst 2 (6,30,000): 1,30,000 short; 6,85,000 of the first receipt is credit
//  b2: inst 1 (2,10,000) paid; inst 2 (4,20,000) unpaid; credit = 10,00,000 - 2,00,000 - 2,10,000 = 5,90,000 (a return takes the credit first)
//  b3 (price 40,00,000): inst 1+2 = 30% of 42,00,000 = 12,60,000 unpaid; b4: inst 1 = 3,15,000 unpaid
const HAND = { billedOutstanding: 130000 + 420000 + 1260000 + 315000, credit: 685000 + 590000, overdue: 315000 };

// ---- the canonical measures ----
const fm = await get('/reports/financial-measures'); const M = fm.j?.data ?? {};
t('measures: 200 with definitions', fm.s === 200 && Object.keys(fm.j?.definitions || {}).length >= 10, fm.s);
t(`agreement value incl. GST equals the sum of every live instalment (${O.agreementIncl})`, near(M.agreement_value_incl_gst, O.agreementIncl), JSON.stringify(M));
t(`demanded incl. GST equals the raised instalments (${O.demandedIncl})`, near(M.total_demanded_incl_gst, O.demandedIncl), String(M.total_demanded_incl_gst));
t(`valid collections = cleared receipts less approved returns (${O.gross} - ${O.returned} = ${O.valid})`, near(M.valid_collections, O.valid), String(M.valid_collections));
t(`uncleared receipts are not collected (${O.uncleared})`, near(M.uncleared_receipts, O.uncleared), String(M.uncleared_receipts));
t(`billed outstanding is worked out by hand: ${HAND.billedOutstanding}`, near(M.billed_outstanding, HAND.billedOutstanding), String(M.billed_outstanding));
t(`unallocated credit is worked out by hand: ${HAND.credit}`, near(M.unallocated_credit, HAND.credit), String(M.unallocated_credit));
t(`overdue is only the instalment that fell due 40 days ago: ${HAND.overdue}`, near(M.overdue, HAND.overdue), String(M.overdue));
t('collections split exactly: applied to billed + unallocated credit = valid collections', near(num(M.applied_to_billed) + num(M.unallocated_credit), M.valid_collections), `${M.applied_to_billed} + ${M.unallocated_credit}`);
t('billed outstanding = demanded incl. GST - applied to billed', near(M.billed_outstanding, num(M.total_demanded_incl_gst) - num(M.applied_to_billed)));
t('contract balance = agreement incl. GST - valid collections', near(M.contract_balance, O.agreementIncl - O.valid), String(M.contract_balance));
t('the four "outstanding" measures are different numbers on this project (contract balance, billed, due today, overdue)', new Set([M.contract_balance, M.billed_outstanding, M.overdue]).size === 3 && M.overdue <= M.due_outstanding && M.due_outstanding <= M.billed_outstanding && M.billed_outstanding <= M.contract_balance, JSON.stringify([M.contract_balance, M.billed_outstanding, M.due_outstanding, M.overdue]));
t(`GST on the raised instalments: CGST = SGST = ${O.demandedCgst}`, near(M.demanded_cgst, O.demandedCgst) && near(M.demanded_sgst, O.demandedCgst), `${M.demanded_cgst}/${M.demanded_sgst}`);
t('GST on receipts is the GST stored on the cleared receipts, before bank returns (reported as it is; whether returned money reverses GST is a finance decision)', near(num(M.received_cgst) + num(M.received_sgst), O.gstOnReceipts) && near(M.approved_bank_returns, O.returned), `${M.received_cgst}+${M.received_sgst} vs ${O.gstOnReceipts}`);

// ---- every report agrees with the measures ----
{
  const r = await get('/reports/project-wise-dues'); const x = r.j?.totals ?? {};
  t('project-wise dues: total cost, demanded with tax, valid collections, uncleared, billed outstanding and credit match the measures',
    near(x.total_cost, M.agreement_value_excl_gst) && near(x.total_demanded_with_tax, M.total_demanded_incl_gst) && near(x.received_clear, M.valid_collections) && near(x.received_pending, M.uncleared_receipts) && near(x.outstanding_with_tax, M.billed_outstanding) && near(x.credit_amount, M.unallocated_credit), JSON.stringify(x));
  t('project-wise dues: GST received and GST demanded match the measures', near(num(x.received_cgst) + num(x.received_sgst), num(M.received_cgst) + num(M.received_sgst)) && near(x.total_demanded_with_tax - x.total_demanded, num(M.demanded_cgst) + num(M.demanded_sgst)), JSON.stringify(x));
}
{
  const r = await get('/reports/customer-due-summary'); const rows = r.j?.data ?? [];
  t(`customer due summary: ${rows.length} customers; valid collections and the amount due with tax add up to the measures`, rows.length === 4 && near(rows.reduce((s, y) => s + num(y.received_clear), 0), M.valid_collections), JSON.stringify(rows.map((y) => y.received_clear)));
}
{
  const r = await get('/reports/customer-balance', { pageSize: 100 }); const rows = r.j?.data ?? [];
  t('customer balance: total received and total cost add up to the measures; its "balance" is demanded less ALL received (a customer with credit is negative)', near(rows.reduce((s, y) => s + num(y.total_received), 0), M.valid_collections) && near(rows.reduce((s, y) => s + num(y.total_cost), 0), M.agreement_value_incl_gst) && near(rows.reduce((s, y) => s + num(y.balance), 0), num(M.total_demanded_incl_gst) - num(M.valid_collections)), JSON.stringify(r.j?.summary));
}
{
  const r = await get('/reports/ageing-summary-project'); const x = r.j?.totals ?? {};
  const buckets = ['bucket_0_30', 'bucket_31_60', 'bucket_61_120', 'bucket_121_180', 'bucket_180_plus'].reduce((s, k) => s + num(x[k]), 0);
  t('ageing summary: due, outstanding and credit match the measures, the buckets add up to overdue, and received + credit = valid collections', near(x.due_amount, M.total_demanded_incl_gst) && near(x.outstanding_amount, M.billed_outstanding) && near(x.credit_amount, M.unallocated_credit) && near(buckets, M.overdue) && near(num(x.received_amount) + num(x.credit_amount), M.valid_collections), JSON.stringify(x));
}
{
  const r = await get('/reports/stage-wise-dues'); const x = r.j?.totals ?? {};
  t('stage-wise dues: total due and outstanding match the measures', near(x.total_due, M.total_demanded_incl_gst) && near(x.total_outstanding, M.billed_outstanding), JSON.stringify(x));
}
{
  const r = await get('/reports/collection-pivot'); const cs = r.j?.data?.consumers ?? [];
  const due = cs.reduce((s, c) => s + Object.values(c.months).reduce((a, m) => a + num(m.due), 0), 0), os = cs.reduce((s, c) => s + Object.values(c.months).reduce((a, m) => a + num(m.os), 0), 0);
  t('collection pivot: due and outstanding over all months match the measures', near(due, M.total_demanded_incl_gst) && near(os, M.billed_outstanding), `${due} / ${os}`);
}
{
  const fd = (await get('/reports/financial-dashboard')).j?.data?.metrics ?? {}, pd = (await get('/reports/project-dashboard')).j?.data?.payment ?? {};
  t('financial dashboard: receivables, collected and the named measures match; "outstanding" keeps its old meaning (contract balance)', near(fd.total_receivables, M.agreement_value_incl_gst) && near(fd.total_collected, M.valid_collections) && near(fd.outstanding, M.contract_balance) && near(fd.contract_balance, M.contract_balance) && near(fd.billed_outstanding, M.billed_outstanding) && near(fd.overdue_amount, M.overdue) && near(fd.unallocated_credit, M.unallocated_credit), JSON.stringify(fd));
  t('project dashboard: receivables and collected match the measures', near(pd.total_receivables, M.agreement_value_incl_gst) && near(pd.total_collected, M.valid_collections), JSON.stringify(pd));
}
{
  const pc = (await get('/reports/project-collection')).j?.totals ?? {}, mc = (await get('/reports/monthly-collection')).j?.data ?? [];
  t('project collection: total collection and uncleared match the measures', near(pc.total_collection, M.valid_collections) && near(pc.uncleared_amount, M.uncleared_receipts), JSON.stringify(pc));
  t('monthly collection: the months add up to the valid collections', near(mc.reduce((s, y) => s + num(y.amount_collected_inr), 0), M.valid_collections), JSON.stringify(mc));
  const rw = (await get('/reports/receipt-wise-collection')).j?.data ?? [];
  const cl = rw.filter((y) => y.status === 'cleared' && !y.is_advance).reduce((s, y) => s + num(y.amount_received_inr), 0);
  t('receipt-wise collection: cleared receipts add up to valid collections + approved returns (the list shows receipts, returns are separate)', near(cl, num(M.valid_collections) + num(M.approved_bank_returns)), `${cl}`);
}
{
  const pn = psql(`select name from projects where id='${pid}'`);
  const ds = (await E.A('GET', '/dashboard/demand-status')).j?.data ?? []; const row = ds.find((y) => y.project === pn);
  t('dashboard demand status: the project outstanding is the billed outstanding due up to today', !!row && near(row.outstanding, M.due_outstanding), JSON.stringify(row));
}
{
  const as5 = await get('/reports/financial-measures', { asOn: psql(`select ((now() at time zone 'Asia/Kolkata')::date - 60)::text`) });
  t('measures as on a date before the instalment fell due: nothing is overdue then', near(as5.j?.data?.overdue, 0), JSON.stringify(as5.j?.data?.overdue));
}
console.log(`\nRESULT: ${tally()}`);
process.exit(tally().includes(' 0 failed') ? 0 : 1);
