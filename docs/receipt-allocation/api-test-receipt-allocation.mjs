// TA-03 / TA-04 / TA-05 / TA-14: a receipt goes to the first open instalment, a bounce or cancel undoes everything it paid, the printed receipt
// shows the stored GST to the paisa, and a GST invoice made for a receipt is that receipt's own tax.
import { env, project, booking, receipt, psql, t, tally, today, paise, rupees } from './lib.mjs';

// ---- t3d_alloc_undo.mjs (rewritten for the cleared payment basis, Q13) ----
{
// Only cleared money pays an instalment. A receipt is directed to the first instalment that the money recorded so far does not cover, and once cleared it pays that
// instalment up to its total; the excess is customer credit and never moves to another instalment by itself. Checked against an independent oracle.
const E = await env(); const P = await project(E, { tag: 'AU' });
const state = (c) => psql(`select coalesce(string_agg(installment_index||':'||status,' ' order by installment_index),'') from demands where consumer_id='${c}'`);
const advRows = (c) => Number(psql(`select count(*) from receipts where consumer_id='${c}' and is_advance`));
const oracle = (c) => psql(`select coalesce(string_agg(installment_index||':'||case when p >= tot - 0.005 then 'paid' when p > 0.005 then 'partial' else 'X' end, ' ' order by installment_index), '')
  from (select d.installment_index, d.amount_due_inr + coalesce(d.cgst_amount,0) + coalesce(d.sgst_amount,0) + coalesce(d.addon_charge_amount,0) + coalesce(d.addon_cgst_amount,0) + coalesce(d.addon_sgst_amount,0) tot,
               coalesce((select sum(r.amount_received_inr) from receipts r where r.status = 'cleared' and not coalesce(r.is_advance, false) and (r.demand_id = d.id or (r.demand_id is null and r.consumer_id = d.consumer_id and r.installment_index = d.installment_index))), 0) p
          from demands d where d.consumer_id = '${c}' and d.status <> 'cancelled') x`);
const norm = (s) => s.replace(/:(pending|demanded|queued)/g, ':X');
// A. 10,00,000 then 25,00,000 against a 31,50,000 bill, both cleared
const b = await booking(E, P, { price: 3000000 });
await receipt(E, b, 1000000); await receipt(E, b, 2500000);
t(`A: cleared 35,00,000 pays instalments 1 and 2 only; the excess is credit and no advance row is made (${state(b.c)})`, norm(state(b.c)) === oracle(b.c) && norm(state(b.c)) === '1:paid 2:paid 3:X 4:X' && advRows(b.c) === 0, state(b.c) + ' | oracle ' + oracle(b.c) + ' | adv ' + advRows(b.c));
// B. a cheque that bounces before it clears changes nothing; a cleared receipt cannot be bounced
const before = state(b.c);
const ck = await E.A('POST', '/payments/receipts', { consumerId: b.c, bookingId: b.id, amountReceivedInr: 2500000, paymentMode: 'cheque', chequeNo: 'CQ' + Date.now().toString(36), bankName: 'Test Bank', chequeDate: today(), referenceNumber: 'CKR' + Date.now().toString(36), paymentDate: today() });
await E.C('PATCH', `/payments/receipts/${ck.j.data.id}/approve`, {}); await E.C('PATCH', `/payments/receipts/${ck.j.data.id}/deposit`, { deposit_date: today() });
t(`B: while the cheque is only deposited the instalments do not move (${state(b.c)})`, state(b.c) === before, state(b.c) + ' vs ' + before);
const bo = await E.C('PATCH', `/payments/receipts/${ck.j.data.id}/bounce`, {});
t(`B: the deposited cheque bounces (${bo.s}) and the instalments are as before (${state(b.c)})`, bo.s === 200 && state(b.c) === before && norm(state(b.c)) === oracle(b.c), state(b.c) + ' | oracle ' + oracle(b.c));
const clearedId = psql(`select id from receipts where consumer_id='${b.c}' and status='cleared' and amount_received_inr=2500000`);
const bo2 = await E.C('PATCH', `/payments/receipts/${clearedId}/bounce`, {});
t(`B: a cleared receipt cannot be bounced (${bo2.s}) and the instalments stay (${state(b.c)})`, bo2.s === 409 && state(b.c) === before, JSON.stringify(bo2.j));
// C. a new receipt after the bounce is directed to the first instalment the recorded money does not cover
await receipt(E, b, 500000);
t(`C: a new receipt after the bounce is allocated like the oracle (${state(b.c)})`, norm(state(b.c)) === oracle(b.c), state(b.c) + ' | oracle ' + oracle(b.c));
// D. cancel of a not yet approved receipt restores the exact earlier state
const b2 = await booking(E, P, { price: 3000000 }); await receipt(E, b2, 1000000);
const before2 = state(b2.c);
const r = await receipt(E, b2, 2500000, { clear: false });
const cn = await E.A('POST', `/payments/receipts/${r.j.data.id}/cancel`, { reason: 'test' });
t(`D: cancel answers 200 (${cn.s}); instalments are back to what they were (${state(b2.c)}) and no advance row exists (${advRows(b2.c)})`, cn.s === 200 && state(b2.c) === before2 && advRows(b2.c) === 0, `${before2} -> ${state(b2.c)}`);
// E. five cleared receipts of 1,00,000 in a row: the first four go to instalment 1 (covered at 3,15,000), the fifth to instalment 2
const b3 = await booking(E, P, { price: 3000000 });
for (let i = 0; i < 5; i++) await receipt(E, b3, 100000);
t(`E: five receipts of 1,00,000 give the oracle's allocation (${state(b3.c)})`, norm(state(b3.c)) === oracle(b3.c) && norm(state(b3.c)) === '1:paid 2:partial 3:X 4:X', state(b3.c) + ' | oracle ' + oracle(b3.c));
}

// ---- t9_print.mjs ----
{
const E = await env(); const P = await project(E, { tag: 'D' });
const b = await booking(E, P);
const strip = (h) => h.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&#8377;/g, '₹').replace(/\s+/g, ' ');
const indian = (s) => { const [i, d] = s.split('.'); const n = i.replace('-', ''); const last3 = n.slice(-3), rest = n.slice(0, -3); return (i.startsWith('-') ? '-' : '') + (rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' : '') + last3 + '.' + d; };
for (const amt of [123457, 99999, 1000001, 777777]) {
  const r = await receipt(E, b, amt); const id = r.j.data.id;
  const row = psql(`select amount_received_inr, cgst_amount, sgst_amount from receipts where id='${id}'`).split(' | ');
  const [A, C, S] = row; const base = rupees(paise(A) - paise(C) - paise(S));
  const h = await E.A('GET', `/payments/receipts/${id}/html`); const txt = strip(h.txt);
  const need = { 'amount': indian(rupees(paise(A))), 'cgst': indian(rupees(paise(C))), 'sgst': indian(rupees(paise(S))), 'base (amount - gst)': indian(base) };
  const missing = Object.entries(need).filter(([k, v]) => !txt.includes(v));
  t(`printed receipt of ${amt}: shows amount ${need.amount}, CGST ${need.cgst}, SGST ${need.sgst}, base ${need['base (amount - gst)']} exactly as stored`, h.s === 200 && missing.length === 0, `missing ${JSON.stringify(Object.fromEntries(missing))}; HTTP ${h.s}; stored ${A}/${C}/${S}; money figures on the page: ${(txt.match(/\d[\d,]*\.\d{2}/g) || []).slice(0, 14).join(' ')}`);
  t(`printed receipt of ${amt}: has no unreplaced placeholder (undefined, NaN, {{)`, !/undefined|NaN|\{\{/.test(txt), (txt.match(/.{0,30}(undefined|NaN|\{\{).{0,30}/) || [''])[0]);
}
}

// ---- t12_invoice.mjs ----
{
const E = await env(); const P = await project(E, { tag: 'GI', gst: 1 });          // an affordable-housing style project: GST 1% (0.5 + 0.5)
const b = await booking(E, P); const r = await receipt(E, b, 100000); const rid = r.j.data.id;
const stored = psql(`select amount_received_inr||' | cgst '||cgst_amount||' | sgst '||sgst_amount from receipts where id='${rid}'`);
console.log('stored receipt:', stored);
const mk = async (extra, label) => { const x = await E.A('POST', '/payments/gst-invoices', { consumerId: b.c, receiptId: rid, baseAmount: 100000, ...extra }); console.log(`${label}: HTTP ${x.s}`, x.j?.data ? `base ${x.j.data.base_amount_inr} cgst ${x.j.data.cgst_amount_inr} sgst ${x.j.data.sgst_amount_inr} total ${x.j.data.total_amount_inr}` : (x.j?.error || '')); if (x.s === 201) await E.A('POST', '/payments/gst-invoices/cancel', { invoiceNumber: x.j.data.invoice_no, reason: 'test' }); return x; };
const a = await mk({}, 'invoice for the Rs 1,00,000 receipt, no rate given');
t('an invoice made for a receipt of Rs 1,00,000 (GST 1% project) cannot total more than the money received', !(a.s === 201 && Number(a.j.data.total_amount_inr) > 100000), a.s === 201 ? `invoice total ${a.j.data.total_amount_inr} > receipt 100000 (default 9% + 9% GST applied, project GST is 1%)` : '');
t('the invoice GST equals the GST stored on the receipt (or the project slab), not a rate the caller or a default picks', !(a.s === 201 && Math.abs(Number(a.j.data.cgst_amount_inr) - 495.05) > 0.01), a.s === 201 ? `invoice CGST ${a.j.data.cgst_amount_inr} vs receipt CGST ${stored}` : '');
const c = await mk({ baseAmount: 1, cgstRate: 0, sgstRate: 0 }, 'invoice for the same receipt with base Rs 1 and zero GST (caller-chosen)');
t('whatever base or rate a caller sends, an invoice for the Rs 1,00,000 receipt is the receipt itself: total 1,00,000 and the receipt GST', c.s === 409 || (c.s === 201 && Number(c.j.data.total_amount_inr) === 100000 && Math.abs(Number(c.j.data.cgst_amount_inr) - 495.05) < 0.01), c.s === 201 ? `total ${c.j.data.total_amount_inr} cgst ${c.j.data.cgst_amount_inr}` : `HTTP ${c.s}`);
}

// ---- TA-15: two projects whose names start with the same four letters never hand out the same registration number ----
{
  const E = await env(); const P1 = await project(E, { tag: 'RA' }), P2 = await project(E, { tag: 'RB' });
  const regs = [];
  for (let i = 0; i < 3; i++) for (const P of [P1, P2]) { const b = await booking(E, P, { complete: false }); regs.push(b.r?.j?.data?.registration_no ?? b.r?.j?.data?.registrationNo); }
  t(`6 bookings in two projects with the same name prefix get 6 different registration numbers (${regs.join(' ')})`, regs.every(Boolean) && new Set(regs).size === 6, regs.join(' '));
}

console.log('\nRESULT:', tally());
process.exit(Number(tally().split(' ')[2]) ? 1 : 0);
