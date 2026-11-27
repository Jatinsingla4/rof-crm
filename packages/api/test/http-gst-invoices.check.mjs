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
const mkReceipt = async (status, cgst) => (await db.query(`INSERT INTO receipts (consumer_id, payment_plan_id, amount_received_inr, received_date, status, payment_method, received_by_user_id, cgst_amount, sgst_amount, approval_status) VALUES ($1, $2, 10500, current_date, $3, 'bank_transfer', $4, $5, $5, $6) RETURNING id`, [live.consumer_id, live.plan_id, status, uid, cgst, ['cleared', 'authorized'].includes(status) ? 'approved' : 'pending'])).rows[0].id;
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

// QA-002 / QA-049: a credit note or a reversal is never dated in the future (2099) or before the invoice it adjusts
const noteBody = { originalInvoiceNumber: invNo, noteType: 'credit', adjustmentAmount: 100, reason: 'date check' };
r = await call(checker, 'POST', '/payments/gst-invoices/credit-debit-note', { ...noteBody, noteDate: '2099-01-01' });
ok('credit note dated 2099: refused (400)', r.s === 400 && /future/i.test(msg(r)), `status ${r.s} ${msg(r)}`);
r = await call(checker, 'POST', '/payments/gst-invoices/credit-debit-note', { ...noteBody, noteDate: '2000-01-01' });
ok('credit note dated before the invoice: refused (400)', r.s === 400 && /before/i.test(msg(r)), `status ${r.s} ${msg(r)}`);
r = await call(checker, 'POST', '/payments/gst-invoices/reverse', { invoiceNumber: invNo, reason: 'date check', reversalDate: '2099-01-01' });
ok('reversal dated 2099: refused (400)', r.s === 400 && /future/i.test(msg(r)), `status ${r.s} ${msg(r)}`);
r = await call(checker, 'POST', '/payments/gst-invoices/reverse', { invoiceNumber: invNo, reason: 'date check', reversalDate: '2000-01-01' });
ok('reversal dated before the invoice: refused (400)', r.s === 400 && /before/i.test(msg(r)), `status ${r.s} ${msg(r)}`);

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
// QA-049: buyer GSTIN check character, place of supply from the buyer's and the project's state codes (project GSTIN above is state 06)
r = await call(maker, 'POST', '/payments/gst-invoices', { ...direct, buyerGstin: '06AAAAA0000A1Z5' });
ok('buyer GSTIN with a wrong check character: refused (400)', r.s === 400 && /valid GSTIN/i.test(msg(r)), `status ${r.s} ${msg(r)}`);
r = await call(maker, 'POST', '/payments/gst-invoices', { ...direct, buyerGstin: '07AAAAA0000A1Z4', supplyType: 'intrastate' });
ok('buyer in state 07, project in state 06, sent as intrastate: refused (400)', r.s === 400 && /place of supply/i.test(msg(r)), `status ${r.s} ${msg(r)}`);
r = await call(maker, 'POST', '/payments/gst-invoices', { ...direct, supplyType: undefined, buyerGstin: '07AAAAA0000A1Z4' });
const pos = r.j.data?.id ? (await db.query(`SELECT supply_type, place_of_supply, igst_amount_inr, cgst_amount_inr FROM gst_invoices WHERE id = $1`, [r.j.data.id])).rows[0] : {};
ok('buyer in another state, no supply type sent: made as interstate, IGST 250, place of supply 07', r.s === 201 && pos.supply_type === 'interstate' && Number(pos.igst_amount_inr) === 250 && Number(pos.cgst_amount_inr) === 0 && pos.place_of_supply === '07', `status ${r.s} ${msg(r)} ${JSON.stringify(pos)}`);
r = await call(maker, 'POST', '/payments/gst-invoices', { ...direct, supplyType: undefined, buyerGstin: '06AAAAA0000A1Z6' });
const pos2 = r.j.data?.id ? (await db.query(`SELECT supply_type, place_of_supply, cgst_amount_inr, sgst_amount_inr FROM gst_invoices WHERE id = $1`, [r.j.data.id])).rows[0] : {};
ok('buyer in the project state: made as intrastate, CGST 125 + SGST 125', r.s === 201 && pos2.supply_type === 'intrastate' && Number(pos2.cgst_amount_inr) === 125 && Number(pos2.sgst_amount_inr) === 125 && pos2.place_of_supply === '06', `status ${r.s} ${msg(r)} ${JSON.stringify(pos2)}`);

// QA-049: HSN/SAC from the project's configuration
const hsnRow = await db.query(`INSERT INTO hsn_sac_codes (code, type) VALUES ('995411', 'Service') ON CONFLICT (code) DO UPDATE SET is_active = true RETURNING id`);
await db.query(`INSERT INTO hsn_sac_code_assign (hsn_sac_id, project_id, charge_type) VALUES ($1, $2, 'BASIC') ON CONFLICT (project_id, charge_type) DO UPDATE SET hsn_sac_id = EXCLUDED.hsn_sac_id`, [hsnRow.rows[0].id, live.project_id]);
try {
  r = await call(maker, 'POST', '/payments/gst-invoices', { ...direct, hsnCode: '999999' });
  ok('HSN/SAC not assigned to the project: refused (400)', r.s === 400 && /not assigned/i.test(msg(r)), `status ${r.s} ${msg(r)}`);
  r = await call(maker, 'POST', '/payments/gst-invoices', { ...direct });
  const h1 = r.j.data?.id ? (await db.query(`SELECT hsn_sac_code FROM gst_invoices WHERE id = $1`, [r.j.data.id])).rows[0] : {};
  ok('no HSN/SAC sent: the project\'s assigned BASIC code is used (995411)', r.s === 201 && h1.hsn_sac_code === '995411', `status ${r.s} ${msg(r)} ${JSON.stringify(h1)}`);
  r = await call(maker, 'POST', '/payments/gst-invoices', { ...direct, hsnCode: '995411' });
  ok('the assigned HSN/SAC sent explicitly: accepted', r.s === 201, `status ${r.s} ${msg(r)}`);
} finally {
  await db.query(`DELETE FROM hsn_sac_code_assign WHERE project_id = $1`, [live.project_id]);
}

// QA-031: the Report tab's totals come from one server query (same figures as the GSTR-3B export), every invoice, notes netted
const sum = await call(maker, 'GET', '/payments/gst-invoices-summary');
const dbSum = (await db.query(`SELECT COUNT(*) FILTER (WHERE status <> 'cancelled')::int AS live, COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled, COALESCE(SUM(base_amount_inr) FILTER (WHERE status <> 'cancelled'),0) AS taxable, COALESCE(SUM(cgst_amount_inr) FILTER (WHERE status <> 'cancelled'),0) AS cgst, COALESCE(SUM(igst_amount_inr) FILTER (WHERE status <> 'cancelled'),0) AS igst FROM gst_invoices`)).rows[0];
const dbNotes = (await db.query(`SELECT COUNT(*)::int AS n, COALESCE(SUM(CASE WHEN note_type='credit' THEN -gst_amount ELSE gst_amount END),0) AS tax FROM credit_debit_notes WHERE status = 'issued'`)).rows[0];
ok('summary: live and cancelled counts, taxable, CGST and IGST equal the database', sum.s === 200 && sum.j.data.invoices_live === dbSum.live && sum.j.data.invoices_cancelled === dbSum.cancelled && Math.abs(sum.j.data.taxable - Number(dbSum.taxable)) < 0.01 && Math.abs(sum.j.data.cgst - Number(dbSum.cgst)) < 0.01 && Math.abs(sum.j.data.igst - Number(dbSum.igst)) < 0.01, JSON.stringify(sum.j.data) + ' vs ' + JSON.stringify(dbSum));
ok('summary: issued credit/debit notes are netted (the earlier cancel issued one)', dbNotes.n >= 1 && sum.j.data.notes_issued === dbNotes.n && Math.abs(sum.j.data.notes_tax_net - Number(dbNotes.tax)) < 0.01, JSON.stringify(sum.j.data) + ' vs ' + JSON.stringify(dbNotes));
r = await call(maker, 'GET', '/payments/gst-invoices-summary?from=2099-01-01&to=2099-01-31');
ok('summary: an empty period gives zeros', r.s === 200 && r.j.data.invoices_live === 0 && r.j.data.taxable === 0, JSON.stringify(r.j.data));
r = await call(maker, 'GET', '/payments/gst-invoices-summary?from=2026-12-01&to=2026-01-01');
ok('summary: from after to is refused (400)', r.s === 400);

await db.end();
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
