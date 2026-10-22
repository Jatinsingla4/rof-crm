// Adds demo data for Payments (rest) to the LOCAL demo database: GST invoices (one cancelled with its credit note), credit / debit notes (one pending, one issued),
// an interest rate for a project, refunds (pending, approved, processed) and a waiver on an applicant who has interest.
// Run after demo-seed-receipts.mjs:  BASE=http://localhost:3020/api node docs/demo-seed-payments-rest.mjs     (never against live)
const B = process.env.BASE || 'http://localhost:3020/api';
if (!/localhost|127\.0\.0\.1/.test(B)) throw new Error('demo seed runs on a local API only');
let tok = '', bad = 0;
const call = async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: b === undefined ? undefined : JSON.stringify(b) }); const j = await r.json().catch(() => ({})); if (r.status >= 400) { bad++; console.log(m, p, r.status, JSON.stringify(j).slice(0, 120)); } return j; };
tok = (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'super_admin@demo.local', password: 'Demo#Pass1234' }) })).json()).token;
const today = new Date().toISOString().slice(0, 10), tag = Date.now().toString(36).slice(-4).toUpperCase();
const live = (await call('GET', '/payments/receipts?pageSize=100')).data.filter(r => !['cancelled', 'bounced'].includes(r.status) && !r.invoice_number && Number(r.amount_received_inr) >= 20000);
if (live.length < 6) throw new Error('run demo-seed-receipts.mjs first');
// invoices
const inv = async (r, extra = {}) => (await call('POST', '/payments/gst-invoices', { consumerId: r.consumer_id, receiptId: r.id, baseAmount: Math.round(Number(r.amount_received_inr) / 1.05), gstRate: 5, supplyType: 'intrastate', invoiceType: 'tax_invoice', description: 'Payment towards unit', ...extra })).data;
const i1 = await inv(live[0]), i2 = await inv(live[1]), i3 = await inv(live[2], { supplyType: 'interstate' });
await call('POST', '/payments/gst-invoices/cancel', { invoiceNumber: i2.invoice_number, reason: 'Duplicate invoice' });
// credit and debit notes: one waits for approval, one is issued
await call('POST', '/payments/credit-debit-notes', { invoice_id: i1.id, note_type: 'credit', adjustment_amount: 1500, gst_rate: 5, reason: 'Rate correction' });
const n2 = (await call('POST', '/payments/credit-debit-notes', { invoice_id: i3.id, note_type: 'debit', adjustment_amount: 800, gst_rate: 5, reason: 'Extra charge' })).data;
await call('PATCH', `/payments/credit-debit-notes/${n2.id}/approve`, {});
// interest rate for the project of the first receipt
await call('POST', '/payments/interest-master', { project_id: live[0].project_id, rate_percent: 11.1, effective_from: '2026-04-01' });
// refunds: pending, approved, processed (each well inside what the applicant paid)
const refund = async (r, amount, mode) => { const x = (await call('POST', '/payments/refunds', { consumer_id: r.consumer_id, original_receipt_id: r.id, refund_amount_inr: amount, refund_mode: mode, reason: 'Customer request' })).data; return x?.id; };
const f1 = await refund(live[3], 5000, 'neft'), f2 = await refund(live[4], 7500, 'rtgs'), f3 = await refund(live[5], 3000, 'cheque');
if (f2) await call('PATCH', `/payments/refunds/${f2}/approve`, {});
if (f3) { await call('PATCH', `/payments/refunds/${f3}/approve`, {}); await call('PATCH', `/payments/refunds/${f3}/process`, { refund_mode: 'cheque', refund_reference: `DEMO-CHQ-${tag}`, refund_date: today }); }
// a waiver where there is interest
for (const r of live.slice(0, 12)) {
  const d = await call('POST', `/payments/consumer-interest-detail/${r.consumer_id}`);
  if (d.summary?.total_interest > 2000) { await call('POST', '/payments/interest-waivers/direct', { consumer_id: r.consumer_id, waiver_amount_inr: 1000, authorized_by_name: 'Demo Owner', reason: 'Goodwill' }); break; }
}
console.log(`done, ${bad} failed calls`, f1 ? '' : '');
