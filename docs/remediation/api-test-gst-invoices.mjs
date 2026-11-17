// Phase 4: GST invoices stay tied to the money behind them. A receipt with a live invoice is not cancelled from under it; a bounce or a bank return that leaves an
// invoice charging more than the money is reported (never silently reversed: cancelling an invoice stays with a checker); a credit note without a rate carries
// the invoice's own rate; history is never deleted. Run against a local test API:
//   BASE=http://localhost:3096/api node api-test-gst-invoices.mjs   (psql must reach the same database)
import { env, project, booking, receipt, psql, t, tally, today } from '../receipt-allocation/lib.mjs';

const E = await env(); const P = await project(E, { tag: 'GI' });
const num = (s) => Number(s || 0);
const inv = (b, rid, x = {}) => E.A('POST', '/payments/gst-invoices', { consumerId: b.c, baseAmount: 1000, receiptId: rid, ...x });
const status = (no) => psql(`select status from gst_invoices where invoice_no='${no}'`);
const exposure = async () => (await E.A('GET', '/booking/reconciliation')).j?.data?.invoices_charging_more_than_the_receipt_behind_them ?? [];
const key = () => 'k' + Math.random().toString(36).slice(2, 10);
const invoicesBefore = num(psql(`select count(*) from gst_invoices`));
psql(`insert into global_settings (key, value) values ('gst_invoice_requires_cleared', 'false') on conflict (key) do update set value = 'false'`);
process.on('exit', () => { try { psql(`delete from global_settings where key = 'gst_invoice_requires_cleared'`); } catch {} });   // this file makes invoices on receipts that are not cleared yet; the default rule is tested in api-test-invoice-cleared.mjs

// ---- an invoice is the receipt's own tax and a second one for the same receipt is refused (also in a race) ----
{
  const b = await booking(E, P); const r = await receipt(E, b, 100000);
  const a = await inv(b, r.j.data.id);
  const rc = psql(`select amount_received_inr || '|' || (cgst_amount + sgst_amount) from receipts where id='${r.j.data.id}'`).split('|').map(Number);
  t('invoice: taxable + GST equals the receipt amount, and the GST is the one stored on the receipt', a.s === 201 && Math.abs(num(a.j.data.total_amount_inr) - rc[0]) < 0.011 && Math.abs(num(a.j.data.cgst_amount_inr) + num(a.j.data.sgst_amount_inr) + num(a.j.data.igst_amount_inr) - rc[1]) < 0.011, JSON.stringify(a.j));
  const rs = await Promise.all([1, 2, 3, 4].map(() => inv(b, r.j.data.id)));
  t('invoice: four more at once for the same receipt are all refused (409) and one live invoice remains', rs.every((x) => x.s === 409) && num(psql(`select count(*) from gst_invoices where receipt_id='${r.j.data.id}' and status<>'cancelled'`)) === 1, rs.map((x) => x.s).join(','));
}

// ---- a receipt with a live invoice cannot be cancelled until the invoice is cancelled by a checker ----
{
  const b = await booking(E, P); const r = await receipt(E, b, 100000, { clear: false }); const rid = r.j.data.id;
  const a = await inv(b, rid); const no = a.j.data.invoice_no;
  const c1 = await E.A('POST', `/payments/receipts/${rid}/cancel`, { reason: 'duplicate' });
  t('cancel: the receipt is not cancelled while invoice ' + no + ' is live (409, names the invoice)', c1.s === 409 && String(c1.j?.error).includes(no) && psql(`select status from receipts where id='${rid}'`) === 'pending', c1.s + JSON.stringify(c1.j));
  t('cancel: the invoice is untouched', status(no) === 'generated');
  const own = await E.A('POST', '/payments/gst-invoices/cancel', { invoiceNumber: no, reason: 'wrong receipt' });
  t('cancel: the maker of the invoice cannot cancel it herself (maker-checker, 403)', own.s === 403, own.s + JSON.stringify(own.j));
  const ck = await E.C('POST', '/payments/gst-invoices/cancel', { invoiceNumber: no, reason: 'wrong receipt' });
  t('cancel: a checker cancels the invoice and a credit note for it is issued', ck.s === 200 && !!ck.j?.data?.creditNoteNumber && status(no) === 'cancelled', ck.s + JSON.stringify(ck.j));
  t('cancel: the cancelled invoice is kept (history), not deleted', num(psql(`select count(*) from gst_invoices where invoice_no='${no}'`)) === 1);
  const c2 = await E.A('POST', `/payments/receipts/${rid}/cancel`, { reason: 'duplicate' });
  t('cancel: now the receipt can be cancelled (200)', c2.s === 200, c2.s + JSON.stringify(c2.j));
}

// ---- a bounced cheque: the bounce is recorded, the invoice is reported, nothing is reversed on its own ----
{
  const b = await booking(E, P);
  const ck = await E.A('POST', '/payments/receipts', { consumerId: b.c, bookingId: b.id, amountReceivedInr: 200000, paymentMode: 'cheque', chequeNo: 'CQ' + Date.now().toString(36), bankName: 'T', chequeDate: today(), referenceNumber: 'CK' + Date.now().toString(36), paymentDate: today() });
  const rid = ck.j.data.id;
  await E.C('PATCH', `/payments/receipts/${rid}/approve`, {}); await E.C('PATCH', `/payments/receipts/${rid}/deposit`, { deposit_date: today() });
  const a = await inv(b, rid); const no = a.j.data.invoice_no;
  const bo = await E.C('PATCH', `/payments/receipts/${rid}/bounce`, {});
  t('bounce: the bounce is recorded (200) and the answer names the invoice that now needs a checker', bo.s === 200 && (bo.j?.invoiceToReverse || []).includes(no) && /cancelled or credited/.test(bo.j?.message || ''), bo.s + JSON.stringify(bo.j));
  t('bounce: the invoice is not reversed on its own, and it is listed in the reconciliation', status(no) === 'generated' && (await exposure()).some((x) => x.invoice_no === no));
  await E.C('POST', '/payments/gst-invoices/cancel', { invoiceNumber: no, reason: 'cheque bounced' });
  t('bounce: once a checker cancels it, it leaves the list', !(await exposure()).some((x) => x.invoice_no === no));
}

// ---- a bank return: the invoice that charges more than the money left is reported; a credit note for the returned part clears it ----
{
  const b = await booking(E, P); const r = await receipt(E, b, 100000); const rid = r.j.data.id;
  const a = await inv(b, rid); const no = a.j.data.invoice_no;
  const q = await E.A('POST', `/payments/receipts/${rid}/returns`, { amount: 60000, reason: 'bank returned part', bank_return_date: today(), idempotency_key: key() });
  const ap = await E.C('POST', `/payments/receipt-returns/${q.j.data.id}/approve`, {});
  t('return: approved (200) and the answer names the invoice to review', ap.s === 200 && (ap.j?.invoices_to_review || []).includes(no), ap.s + JSON.stringify(ap.j));
  const row = (await exposure()).find((x) => x.invoice_no === no);
  t('return: the reconciliation shows the invoice still charging 1,00,000 against 40,000 of money', !!row && Math.abs(row.still_charged - 100000) < 0.011 && Math.abs(row.receipt_net - 40000) < 0.011, JSON.stringify(row));
  // a credit note for the returned part (taxable 60,000 of the invoice's base) brings it back in line
  const base = num(psql(`select taxable_amount_inr from gst_invoices where invoice_no='${no}'`)), rate = num(psql(`select cgst_rate + sgst_rate + igst_rate from gst_invoices where invoice_no='${no}'`));
  const part = Math.round(60000 / (1 + rate / 100) * 100) / 100;
  const n = await E.A('POST', '/payments/credit-debit-notes', { original_invoice_no: no, note_type: 'credit', adjustment_amount: part, reason: 'part of the receipt returned by the bank' });
  const nok = n.s === 201 ? await E.C('PATCH', `/payments/credit-debit-notes/${n.j.data.id}/approve`, {}) : n;
  t('return: the credit note is raised by one user and approved by another (201 / 200)', n.s === 201 && nok.s === 200, n.s + JSON.stringify(n.j) + ' | ' + nok.s);
  const after = (await exposure()).find((x) => x.invoice_no === no);
  t('return: with the credit note issued the invoice no longer charges more than the money', !after || after.still_charged <= after.receipt_net + 0.011, JSON.stringify(after));
}

// ---- a credit note without a rate carries the rate of its invoice, not an assumed 5% ----
{
  const b = await booking(E, P);
  const a = await inv(b, undefined, { baseAmount: 10000, gstRate: 12, supplyType: 'intrastate' }); const no = a.j?.data?.invoice_no;
  const n = await E.A('POST', '/payments/credit-debit-notes', { original_invoice_no: no, note_type: 'credit', adjustment_amount: 1000, reason: 'rate check' });
  t('note: an invoice at 12% and a note with no rate -> the note is at 12% (GST 120)', a.s === 201 && n.s === 201 && num(n.j.data.gst_rate) === 12 && num(n.j.data.gst_amount) === 120, a.s + ' ' + n.s + JSON.stringify(n.j?.data ?? n.j));
  const n2 = await E.A('POST', '/payments/credit-debit-notes', { original_invoice_no: no, note_type: 'credit', adjustment_amount: 1000, gst_rate: 5, reason: 'rate given' });
  t('note: a rate that is given is used as given', n2.s === 201 && num(n2.j.data.gst_rate) === 5, n2.s + JSON.stringify(n2.j?.data ?? n2.j));
  const n3 = await E.A('POST', '/payments/credit-debit-notes', { original_invoice_no: no, note_type: 'credit', adjustment_amount: 20000, reason: 'too much' });
  t('note: credit notes beyond the invoice are refused (409)', n3.s === 409, n3.s + JSON.stringify(n3.j));
}

// ---- old rows the product cannot make any more (an invoice on a receipt cancelled by hand) are still found ----
{
  const b = await booking(E, P); const r = await receipt(E, b, 100000, { clear: false });
  const a = await inv(b, r.j.data.id); const no = a.j.data.invoice_no;
  psql(`update receipts set status='cancelled' where id='${r.j.data.id}'`);
  t('legacy: a live invoice on a cancelled receipt is listed in the reconciliation', (await exposure()).some((x) => x.invoice_no === no && x.receipt_status === 'cancelled'));
  const ck = await E.C('POST', '/payments/gst-invoices/cancel', { invoiceNumber: no, reason: 'legacy clean-up' });
  t('legacy: a checker cancels it and it leaves the list', ck.s === 200 && !(await exposure()).some((x) => x.invoice_no === no));
}

t('history: no invoice was deleted by any of this', num(psql(`select count(*) from gst_invoices`)) >= invoicesBefore);
console.log(`\nRESULT: ${tally()}`);
process.exit(tally().includes(' 0 failed') ? 0 : 1);
