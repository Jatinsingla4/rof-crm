// HTTP check for QA-002 / QA-003 / QA-004 / QA-031 on a THROWAWAY local database (setup: see db-cancelled-booking.check.mjs and http-cancelled-booking.check.mjs).
// Run: BASE=http://localhost:3097/api DB_NAME=rof_remed_b1 npx tsx test/http-gst-invoices.check.mjs      Tokens are never printed. Test GSTIN and financial year are made up, local only.
import pg from 'pg';
const BASE = process.env.BASE || 'http://localhost:3097/api';
const db = new pg.Pool({ host: 'localhost', user: 'postgres', password: process.env.DB_PASSWORD || 'postgres', database: process.env.DB_NAME || 'rof_remed_b1' });
let failed = 0;
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!cond) failed++; };
const login = async (email) => (await (await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Test#Pass1234' }) })).json()).token;
const call = async (tok, method, path, body) => { const r = await fetch(`${BASE}${path}`, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${tok}` }, body: body ? JSON.stringify(body) : undefined }); let j = {}; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const msg = (r) => String(r.j.error || r.j.message || '');
const maker = await login('accounts_finance@test.local'), checker = await login('super_admin@test.local');

const live = (await db.query(`SELECT co.id consumer_id, pp.id plan_id, pp.project_id FROM payment_plans pp JOIN consumers co ON co.id = pp.consumer_id WHERE co.name <> 'Cancelled Cust' LIMIT 1`)).rows[0];
// repeatable: start with no GSTIN, no financial year, no invoices, a known booking value and two receipts (one cleared, one waiting)
await db.query(`DELETE FROM credit_debit_notes WHERE consumer_id = $1`, [live.consumer_id]);
await db.query(`DELETE FROM gst_invoices WHERE consumer_id = $1`, [live.consumer_id]);
await db.query(`DELETE FROM project_gstin WHERE project_id = $1`, [live.project_id]);
await db.query(`DELETE FROM financial_years`);
await db.query(`UPDATE booking_records SET total_price_inr = 1000000 WHERE consumer_id = $1`, [live.consumer_id]);
const uid = (await db.query(`SELECT id FROM users WHERE email = 'accounts_finance@test.local'`)).rows[0].id;
const mkReceipt = async (status, cgst) => (await db.query(`INSERT INTO receipts (consumer_id, payment_plan_id, amount_received_inr, received_date, status, payment_method, received_by_user_id, cgst_amount, sgst_amount) VALUES ($1, $2, 10500, current_date, $3, 'bank_transfer', $4, $5, $5) RETURNING id`, [live.consumer_id, live.plan_id, status, uid, cgst])).rows[0].id;
const clearedR = await mkReceipt('cleared', 250), waitingR = await mkReceipt('authorized', 250);
const direct = { consumerId: live.consumer_id, baseAmount: 5000, gstRate: 5, supplyType: 'intrastate', invoiceType: 'tax_invoice' };

let r = await call(maker, 'POST', '/payments/gst-invoices', direct);
ok('no project GSTIN: refused (409)', r.s === 409 && /GSTIN/i.test(msg(r)), `status ${r.s}`);
await db.query(`INSERT INTO project_gstin (project_id, gstin) VALUES ($1, '06TESTX1234F1Z5')`, [live.project_id]);
r = await call(maker, 'POST', '/payments/gst-invoices', direct);
ok('no financial year for the date: refused (409)', r.s === 409 && /financial year/i.test(msg(r)), `status ${r.s}`);
await db.query(`INSERT INTO financial_years (name, from_date, to_date, is_active) VALUES ('FY test', '2026-04-01', '2027-03-31', true)`);
r = await call(maker, 'POST', '/payments/gst-invoices', { ...direct, gstRate: undefined });
ok('no rate sent: refused, no 18% default (400)', r.s === 400 && /rate/i.test(msg(r)), `status ${r.s}`);
r = await call(maker, 'POST', '/payments/gst-invoices', { ...direct, baseAmount: 300000000 });
ok('30 crore invoice against a 10 lakh booking: refused (400)', r.s === 400 && /booking value/i.test(msg(r)), `status ${r.s}`);
r = await call(maker, 'POST', '/payments/gst-invoices', { ...direct, receiptId: waitingR });
ok('invoice on an uncleared receipt: refused by the server (409)', r.s === 409 && /cleared/i.test(msg(r)), `status ${r.s}`);
r = await call(maker, 'POST', '/payments/gst-invoices', { ...direct, receiptId: clearedR });
ok('invoice on a cleared receipt: made, taxable = amount less stored GST (201)', r.s === 201 && Number(r.j.data?.base_amount) === 10000, `status ${r.s} ${r.s >= 400 ? msg(r) : ''}`);
const invNo = r.j.data?.invoice_no;

// historical case: the receipt is cancelled underneath a live invoice (INV/2026/00003 in the report)
await db.query(`UPDATE receipts SET status = 'cancelled' WHERE id = $1`, [clearedR]);
r = await call(checker, 'GET', '/payments/gst-invoices/exceptions');
ok('exception list shows the live invoice of a cancelled receipt', (r.j.data || []).some((x) => x.invoice_number === invNo && x.receipt_status === 'cancelled'), `count ${r.j.count}`);
r = await call(maker, 'POST', '/payments/gst-invoices/cancel', { invoiceNumber: invNo, reason: 'receipt cancelled' });
ok('the maker cannot cancel their own invoice', r.s === 403 || r.s === 409, `status ${r.s}`);
r = await call(checker, 'POST', '/payments/gst-invoices/cancel', { invoiceNumber: invNo, reason: 'receipt cancelled' });
ok('a checker cancels it and a credit note is issued', r.s === 200 && !!r.j.data?.creditNoteNumber, `status ${r.s} ${r.s >= 400 ? msg(r) : ''}`);
r = await call(checker, 'GET', '/payments/gst-invoices/exceptions');
ok('the exception list is empty afterwards', (r.j.count || 0) === 0);
await db.end();
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
