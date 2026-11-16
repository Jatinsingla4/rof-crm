import { env, project, booking, receipt, psql, today } from '../receipt-allocation/lib.mjs';
const E = await env(); const P = await project(E, { tag: 'IV' });
const inv = (b, rid, x = {}) => E.A('POST', '/payments/gst-invoices', { consumerId: b.c, baseAmount: 1000, receiptId: rid, ...x });
const show = (l, r) => console.log(l, r.s, JSON.stringify(r.j?.data?.invoice_no ?? r.j?.error ?? r.j).slice(0, 160));
let b = await booking(E, P);
// P1 invoice on a pending (uncleared) receipt
let r = await receipt(E, b, 100000, { clear: false }); show('P1 invoice on PENDING receipt', await inv(b, r.j.data.id));
// P2 cancel that receipt with live invoice
const c2 = await E.A('POST', `/payments/receipts/${r.j.data.id}/cancel`, { reason: 'x' }); console.log('P2 cancel receipt', c2.s);
console.log('P2 invoice state after receipt cancel:', psql(`select status from gst_invoices where receipt_id='${r.j.data.id}'`));
// P3 deposited cheque with invoice, bounce
b = await booking(E, P);
const ck = await E.A('POST', '/payments/receipts', { consumerId: b.c, bookingId: b.id, amountReceivedInr: 200000, paymentMode: 'cheque', chequeNo: 'CQ' + Date.now().toString(36), bankName: 'T', chequeDate: today(), referenceNumber: 'CK' + Date.now().toString(36), paymentDate: today() });
await E.C('PATCH', `/payments/receipts/${ck.j.data.id}/approve`, {}); await E.C('PATCH', `/payments/receipts/${ck.j.data.id}/deposit`, { deposit_date: today() });
show('P3 invoice on DEPOSITED cheque', await inv(b, ck.j.data.id));
console.log('P3 bounce', (await E.C('PATCH', `/payments/receipts/${ck.j.data.id}/bounce`, {})).s, 'invoice state:', psql(`select status from gst_invoices where receipt_id='${ck.j.data.id}'`));
// P4 cleared receipt, invoice, then partial return
b = await booking(E, P); r = await receipt(E, b, 100000); const rid = r.j.data.id;
show('P4 invoice on cleared', await inv(b, rid));
const q = await E.A('POST', `/payments/receipts/${rid}/returns`, { amount: 60000, reason: 'bank', bank_return_date: today(), idempotency_key: 'k' + Date.now() });
const ap = await E.C('POST', `/payments/receipt-returns/${q.j.data.id}/approve`, {}); console.log('P4 return approved', ap.s, 'invoice state:', psql(`select status||' total='||total_amount_inr from gst_invoices where receipt_id='${rid}'`), 'receipt net:', 100000 - 60000);
// P6 race duplicates
b = await booking(E, P); r = await receipt(E, b, 100000);
const rs = await Promise.all([1, 2, 3, 4].map(() => inv(b, r.j.data.id))); console.log('P6 race statuses', rs.map((x) => x.s).join(','), 'live invoices:', psql(`select count(*) from gst_invoices where receipt_id='${r.j.data.id}' and status<>'cancelled'`));
// P8 note default rate vs invoice rate
const iv = (await inv(b, 'x' === 'y' ? '' : undefined)); show('P7 direct invoice (no receipt) twice', iv); show('P7b again', await inv(b, undefined));
const live = psql(`select invoice_no||' rate='||(cgst_rate+sgst_rate+igst_rate) from gst_invoices where receipt_id='${r.j.data.id}'`);
const no = live.split(' ')[0]; const n = await E.A('POST', '/payments/credit-debit-notes', { original_invoice_no: no, note_type: 'credit', adjustment_amount: 1000, reason: 'probe' });
console.log('P8 invoice', live, '-> note without rate:', n.s, 'gst_rate used:', n.j?.data?.gst_rate, 'gst', n.j?.data?.gst_amount);
