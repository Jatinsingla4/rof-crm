// Phase 3: the receipt allocation (flag receipt_allocation_v1 ON) through the real money flows, checked after every step by rules that do not
// use the allocation code: partial payments, several instalments, a bounced cheque, a cancelled receipt, a return, a credit allocation.
// The flag is switched ON for the run and put back afterwards. Run against a local test API:
//   BASE=http://localhost:3096/api node api-test-allocation-flows.mjs   (psql must reach the same database)
import { env, project, booking, receipt, psql, t, tally, today, rupees, paise } from '../receipt-allocation/lib.mjs';

const E = await env();
const flagBefore = psql(`select value from global_settings where key='receipt_allocation_v1'`);
psql(`update global_settings set value='on' where key='receipt_allocation_v1'`);
const num = (s) => Number(s || 0);
const TOT = `(d.amount_due_inr + d.cgst_amount + d.sgst_amount + d.addon_charge_amount + d.addon_cgst_amount + d.addon_sgst_amount)`;

// The rules, for one applicant. Each returns the offending rows as text ('' = the rule holds).
const rules = (c) => ({
  'a demand is allocated more than its total': psql(`select string_agg(d.installment_index::text, ',') from demands d join receipt_allocation a on a.demand_id = d.id where d.consumer_id='${c}' group by d.id having sum(a.principal + a.cgst + a.sgst) > ${TOT} + 0.01`),
  'a receipt is allocated more than it received less approved returns': psql(`select string_agg(r.id::text, ',') from (select r.id from receipts r join receipt_allocation a on a.receipt_id = r.id where r.consumer_id='${c}' group by r.id, r.amount_received_inr having sum(a.principal + a.cgst + a.sgst) > r.amount_received_inr - coalesce((select sum(rr.amount) from receipt_returns rr where rr.receipt_id = r.id and rr.status = 'approved'), 0) + 0.01) r`),
  'allocation on a receipt that is not cleared': psql(`select string_agg(a.id::text, ',') from receipt_allocation a join receipts r on r.id = a.receipt_id where r.consumer_id='${c}' and (r.status <> 'cleared' or r.is_advance is true)`),
  'allocation across two plans': psql(`select string_agg(a.id::text, ',') from receipt_allocation a join receipts r on r.id = a.receipt_id join demands d on d.id = a.demand_id where r.consumer_id='${c}' and r.payment_plan_id is distinct from d.payment_plan_id`),
  // paid / partial / unpaid must agree with what is covered: receipt allocation plus approved credit allocation
  'a demand status disagrees with what is allocated to it': psql(`select string_agg(x.installment_index || ':' || x.status, ',') from (
      select d.installment_index, d.status, ${TOT} tot,
             coalesce((select sum(a.principal + a.cgst + a.sgst) from receipt_allocation a where a.demand_id = d.id), 0) + coalesce((select sum(ca.amount) from credit_allocations ca where ca.demand_id = d.id and ca.status = 'approved'), 0) cov
        from demands d where d.consumer_id='${c}' and d.status <> 'cancelled') x
     where (x.status = 'paid' and x.cov < x.tot - 0.01) or (x.status = 'partial' and x.cov <= 0.005) or (x.status in ('pending','demanded') and x.cov > 0.005)`),
  // the three parts of a row add up to the money, and the GST part follows the demand's own GST
  'a row\'s GST is not in proportion to its demand': psql(`select string_agg(a.id::text, ',') from receipt_allocation a join demands d on d.id = a.demand_id join receipts r on r.id = a.receipt_id where r.consumer_id='${c}'
      and abs(a.cgst - round((a.principal + a.cgst + a.sgst) * (d.cgst_amount + d.addon_cgst_amount) / nullif(${TOT}, 0), 2)) > 0.011`),
});
const clean = (label, c) => { const r = rules(c); const bad = Object.entries(r).filter(([, v]) => v); t(`${label}: all ${Object.keys(r).length} allocation rules hold`, bad.length === 0, JSON.stringify(bad)); };
const sumAlloc = (where) => num(psql(`select coalesce(sum(a.principal + a.cgst + a.sgst), 0) from receipt_allocation a join demands d on d.id = a.demand_id join receipts r on r.id = a.receipt_id where ${where}`));
const demandAlloc = (c, i) => sumAlloc(`d.consumer_id='${c}' and d.installment_index=${i} and d.status<>'cancelled'`);
const receiptAlloc = (id) => sumAlloc(`r.id='${id}'`);
const ids = (c) => psql(`select string_agg(id::text, ' ' order by created_at) from receipts where consumer_id='${c}' and status='cleared'`).split(' ');
const total = (c, i) => num(psql(`select ${TOT} from demands d where d.consumer_id='${c}' and d.installment_index=${i} and d.status<>'cancelled' limit 1`));
const key = () => 'k' + Math.random().toString(36).slice(2, 10);

try {
  const P = await project(E, { tag: 'AF' });

  // ---- F1: partial payments, one receipt paying two instalments ----
  {
    const b = await booking(E, P, { price: 3000000 });
    for (let i = 0; i < 5; i++) await receipt(E, b, 100000);
    const d1 = total(b.c, 1), per = ids(b.c).map(receiptAlloc).sort((x, y) => x - y);
    t(`F1: instalment 1 (${d1}) is covered to the paisa`, Math.abs(demandAlloc(b.c, 1) - d1) < 0.011, String(demandAlloc(b.c, 1)));
    t(`F1: four receipts are allocated in full and the one that crosses the end of instalment 1 pays only its last ${rupees(paise(String(d1)) - 30000000n)} (${per})`, per.length === 5 && per.slice(1).every((x) => x === 100000) && Math.abs(per[0] - (d1 - 300000)) < 0.011, String(per));
    t('F1: the rest of that receipt is customer credit, not moved to the next instalment on its own (the BR-04 overflow rule is still open)', Math.abs(demandAlloc(b.c, 1) + demandAlloc(b.c, 2) - per.reduce((x, y) => x + y, 0)) < 0.011);
    clean('F1', b.c);
  }

  // ---- F2: several instalments and money beyond what is billed ----
  const b2 = await booking(E, P, { price: 3000000 });
  await receipt(E, b2, 1000000); await receipt(E, b2, 2500000);
  const st2 = psql(`select string_agg(installment_index||':'||status,' ' order by installment_index) from demands where consumer_id='${b2.c}'`);
  const alloc2 = [1, 2, 3, 4].map((i) => demandAlloc(b2.c, i));
  t(`F2: allocation follows the status (${st2}; allocated ${alloc2.join(' / ')})`, [1, 2, 3, 4].every((i, k) => (st2.includes(`${i}:paid`) ? Math.abs(alloc2[k] - total(b2.c, i)) < 0.011 : alloc2[k] < total(b2.c, i) - 0.01)), st2 + ' ' + alloc2);
  clean('F2', b2.c);

  // ---- F3: a deposited cheque that bounces never creates a row ----
  {
    const b = await booking(E, P, { price: 3000000 }); await receipt(E, b, 400000);
    const ck = await E.A('POST', '/payments/receipts', { consumerId: b.c, bookingId: b.id, amountReceivedInr: 200000, paymentMode: 'cheque', chequeNo: 'CQ' + Date.now().toString(36), bankName: 'Test Bank', chequeDate: today(), referenceNumber: 'CKR' + Date.now().toString(36), paymentDate: today() });
    await E.C('PATCH', `/payments/receipts/${ck.j.data.id}/approve`, {}); await E.C('PATCH', `/payments/receipts/${ck.j.data.id}/deposit`, { deposit_date: today() });
    t('F3: a deposited cheque has no allocation yet', receiptAlloc(ck.j.data.id) === 0);
    const bo = await E.C('PATCH', `/payments/receipts/${ck.j.data.id}/bounce`, {});
    t('F3: the cheque bounces (200) and still has no allocation', bo.s === 200 && receiptAlloc(ck.j.data.id) === 0, String(bo.s));
    clean('F3', b.c);
  }

  // ---- F4: a cleared receipt cannot be cancelled (a bank return goes through the return workflow); an authorised one can, and never had rows ----
  {
    const b = await booking(E, P, { price: 3000000 });
    await receipt(E, b, 300000);
    const [x1] = ids(b.c); const before = receiptAlloc(x1);
    const cn = await E.C('POST', `/payments/receipts/${x1}/cancel`, { reason: 'wrong customer' });
    t('F4: cancelling a cleared receipt is refused (409) and its rows stay', cn.s === 409 && receiptAlloc(x1) === before && before > 0, cn.s + JSON.stringify(cn.j));
    const au = await receipt(E, b, 50000, { clear: false }); await E.C('PATCH', `/payments/receipts/${au.j.data.id}/approve`, {});
    t('F4: an authorised receipt has no allocation rows', receiptAlloc(au.j.data.id) === 0);
    const c2 = await E.C('POST', `/payments/receipts/${au.j.data.id}/cancel`, { reason: 'duplicate entry' });
    t('F4: a checker cancels the authorised receipt (200) and nothing was ever allocated to it', c2.s === 200 && receiptAlloc(au.j.data.id) === 0, c2.s + JSON.stringify(c2.j));
    clean('F4', b.c);
  }

  // ---- F5: an approved return takes its amount off the receipt's allocation ----
  {
    const b = await booking(E, P, { price: 3000000 });
    const r = await receipt(E, b, 500000); const rid = r.j.data.id;
    const q = await E.A('POST', `/payments/receipts/${rid}/returns`, { amount: 250000, reason: 'bank returned part', bank_return_date: today(), idempotency_key: key() });
    t('F5: a return is requested (201)', q.s === 201, q.s + JSON.stringify(q.j));
    const a0 = receiptAlloc(rid);
    t(`F5: before approval the receipt is allocated what instalment 1 takes (${a0}); the rest of the 5,00,000 is credit`, a0 > 0 && a0 < 500000);
    const ap = await E.C('POST', `/payments/receipt-returns/${q.j.data.id}/approve`, {});
    t('F5: the checker approves it (200)', ap.s === 200, ap.s + JSON.stringify(ap.j));
    t(`F5: after a return of 2,50,000 the receipt is allocated 2,50,000, never more than it still holds (${receiptAlloc(rid)})`, Math.abs(receiptAlloc(rid) - 250000) < 0.011, String(receiptAlloc(rid)));
    clean('F5', b.c);
  }

  // ---- F6: credit allocated to an instalment counts with the receipt money, never twice ----
  {
    const b = await booking(E, P, { price: 3000000 });
    await receipt(E, b, 400000);   // pays instalment 1 (3,15,000); 85,000 of that receipt is not used by any instalment yet? checked below
    const d2 = psql(`select id from demands where consumer_id='${b.c}' and installment_index=2 and status<>'cancelled' limit 1`);
    await E.A('PATCH', '/payments/demands/activate', { demandIds: [d2], installmentDate: today() });
    const ca = await E.A('POST', '/payments/credit-allocations', { demand_id: d2, amount: 5000, reason: 'allocate credit', idempotency_key: key() });
    if (ca.s === 201) {
      const ap = await E.C('POST', `/payments/credit-allocations/${ca.j.data.id}/approve`, {});
      t('F6: the credit allocation is approved (200)', ap.s === 200, ap.s + JSON.stringify(ap.j));
    } else t('F6: the credit allocation is accepted or refused for a stated reason (no 5xx)', ca.s < 500, ca.s + JSON.stringify(ca.j));
    clean('F6', b.c);
  }

  // ---- running the allocation again changes nothing (idempotent) ----
  {
    const snap = () => psql(`select coalesce(string_agg(a.receipt_id||'>'||a.demand_id||'='||a.principal||'/'||a.cgst||'/'||a.sgst, ',' order by a.receipt_id, a.demand_id),'') from receipt_allocation a join receipts r on r.id=a.receipt_id where r.consumer_id='${b2.c}'`);
    const s1 = snap();
    const c = await E.A('POST', '/payments/receipts', { consumerId: b2.c, bookingId: b2.id, amountReceivedInr: 1, paymentMode: 'neft', referenceNumber: 'IDEM' + Date.now().toString(36), paymentDate: today() });
    if (c.s === 201) await E.A('POST', `/payments/receipts/${c.j.data.id}/cancel`, { reason: 'idempotence check' });
    t('idempotent: a recompute after an unrelated receipt is cancelled leaves the rows as they were', snap() === s1);
  }
  // ---- the pre-activation shadow report agrees with the status rules on every plan, and is for finance only ----
  {
    const sh = await E.A('GET', '/payments/receipt-allocation-shadow');
    t(`shadow: ${sh.j?.plans_checked} plans / ${sh.j?.demands_checked} demands checked, the allocation and the status rules agree on every demand`, sh.s === 200 && sh.j.plans_checked > 0 && sh.j.mismatch_count === 0 && sh.j.receipts_over_allocated === 0, sh.s + JSON.stringify(sh.j?.mismatches?.slice(0, 3)));
    t('shadow: a sales executive is refused (403)', (await E.SE('GET', '/payments/receipt-allocation-shadow')).s === 403);
  }
} finally {
  psql(`update global_settings set value='${flagBefore || 'off'}' where key='receipt_allocation_v1'`);
}
console.log(`\nRESULT: ${tally()}`);
process.exit(tally().includes(' 0 failed') ? 0 : 1);
