// QA-031: a GST invoice is made only on money that has cleared. Direct API calls, not button visibility, are what is tested.
// Default: a pending receipt is refused (409), a cleared one is accepted. Finance can allow pending receipts with the setting gst_invoice_requires_cleared = 'false'.
// Run against a local test API:  BASE=http://localhost:3097/api node api-test-invoice-cleared.mjs   (psql must reach the same database)
import { env, project, booking, receipt, psql, t, tally } from '../receipt-allocation/lib.mjs';

const E = await env(); const P = await project(E, { tag: 'IC' });
const inv = (b, rid) => E.A('POST', '/payments/gst-invoices', { consumerId: b.c, baseAmount: 1000, receiptId: rid });
const setGate = (v) => psql(v === null ? `delete from global_settings where key = 'gst_invoice_requires_cleared'` : `insert into global_settings (key, value) values ('gst_invoice_requires_cleared', '${v}') on conflict (key) do update set value = '${v}'`);
process.on('exit', () => { try { setGate(null); } catch {} });

setGate(null);   // the default
const b1 = await booking(E, P); const pend = await receipt(E, b1, 100000, { clear: false });
const refused = await inv(b1, pend.j.data.id);
t('default: an invoice on a pending (uncleared) receipt is refused with 409', refused.s === 409 && /cleared/.test(refused.j?.error || ''), refused.s + ' ' + JSON.stringify(refused.j));
t('default: no invoice row was written for it', Number(psql(`select count(*) from gst_invoices where receipt_id = '${pend.j.data.id}'`)) === 0);

const b2 = await booking(E, P); const clr = await receipt(E, b2, 100000);
const ok = await inv(b2, clr.j.data.id);
t('default: an invoice on a cleared receipt is made (201)', ok.s === 201, ok.s + ' ' + JSON.stringify(ok.j));

const b3 = await booking(E, P); const pend2 = await receipt(E, b3, 100000, { clear: false });
setGate('false');
const allowed = await inv(b3, pend2.j.data.id);
t('finance switch gst_invoice_requires_cleared = false allows an invoice on a pending receipt', allowed.s === 201, allowed.s + ' ' + JSON.stringify(allowed.j));
setGate('true');
const b4 = await booking(E, P); const pend3 = await receipt(E, b4, 100000, { clear: false });
const again = await inv(b4, pend3.j.data.id);
t("setting 'true' keeps the rule on", again.s === 409, again.s);

console.log(tally());
process.exit(0);
