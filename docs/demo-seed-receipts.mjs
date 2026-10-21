// Adds receipts in different states to the LOCAL demo database: pending cheque, deposited, held, cleared, bounced, cancelled, authorised, part payment, excess payment.
// Run after demo-seed-bookings.mjs / demo-seed-demands.mjs:  BASE=http://localhost:3020/api node docs/demo-seed-receipts.mjs     (never against live)
const B = process.env.BASE || 'http://localhost:3020/api';
if (!/localhost|127\.0\.0\.1/.test(B)) throw new Error('demo seed runs on a local API only');
let tok = '', bad = 0;
const call = async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: b === undefined ? undefined : JSON.stringify(b) }); const j = await r.json().catch(() => null); if (r.status >= 300) { bad++; console.log(m, p, r.status, JSON.stringify(j).slice(0, 120)); } return j; };
tok = (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'super_admin@demo.local', password: 'Demo#Pass1234' }) })).json()).token;
const today = new Date().toISOString().slice(0, 10), tag = Date.now().toString(36).slice(-4);
const people = (await call('GET', '/consumers?pageSize=200')).data.filter(c => ['Cash Chetan', 'Online Omkar', 'Draft Divya', 'Upi Uma'].includes(c.name));
const [chetan, omkar, divya, uma] = ['Cash Chetan', 'Online Omkar', 'Draft Divya', 'Upi Uma'].map(n => people.find(c => c.name === n));
const rec = async (c, b) => (await call('POST', '/payments/receipts', { consumerId: c.id, paymentDate: today, ...b }))?.data?.id;
const cq = (n) => `DEMO${tag}${n}`;
const pend = await rec(chetan, { amountReceivedInr: 50000, paymentMode: 'cheque', chequeNo: cq(1), bankName: 'HDFC Bank', referenceNumber: undefined });
const dep = await rec(chetan, { amountReceivedInr: 75000, paymentMode: 'cheque', chequeNo: cq(2), bankName: 'SBI' });
const hold = await rec(omkar, { amountReceivedInr: 60000, paymentMode: 'cheque', chequeNo: cq(3), bankName: 'ICICI Bank' });
const clr = await rec(omkar, { amountReceivedInr: 90000, paymentMode: 'neft', referenceNumber: `DEMOUTR${tag}1` });
const bnc = await rec(divya, { amountReceivedInr: 40000, paymentMode: 'cheque', chequeNo: cq(4), bankName: 'Axis Bank' });
const can = await rec(divya, { amountReceivedInr: 25000, paymentMode: 'cash' });
const auth = await rec(uma, { amountReceivedInr: 30000, paymentMode: 'upi', referenceNumber: `DEMOUPI${tag}1` });
await rec(uma, { amountReceivedInr: 1000, paymentMode: 'cash', installmentIndex: 2 });
await call('PATCH', `/payments/receipts/${dep}/deposit`, { deposit_date: today });
await call('PATCH', `/payments/receipts/${hold}/hold`, { hold_remark: 'Signature mismatch, ask customer' });
await call('PATCH', `/payments/receipts/${clr}/clear`, { clearing_date: today });
await call('PATCH', `/payments/receipts/${bnc}/bounce`, { reason: 'Insufficient funds', penaltyAmount: 500 });
await call('POST', `/payments/receipts/${can}/cancel`, { reason: 'Entered against wrong customer' });
await call('PATCH', `/payments/receipts/${auth}/approve`, {});
await call('PATCH', `/payments/receipts/${auth}/mark-printed`, {});
console.log(`done, ${bad} failed calls`);
