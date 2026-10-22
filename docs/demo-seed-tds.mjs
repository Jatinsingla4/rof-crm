// Adds TDS challans to the LOCAL demo database: an unused one, a part-assigned one, a fully assigned one, one whose receipt was cancelled (amount came back).
// Run after demo-seed-receipts.mjs:  BASE=http://localhost:3020/api node docs/demo-seed-tds.mjs     (never against live)
const B = process.env.BASE || 'http://localhost:3020/api';
if (!/localhost|127\.0\.0\.1/.test(B)) throw new Error('demo seed runs on a local API only');
let tok = '', bad = 0;
const call = async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: b === undefined ? undefined : JSON.stringify(b) }); const j = await r.json().catch(() => null); if (r.status >= 300) { bad++; console.log('FAILED', m, p, r.status, JSON.stringify(j).slice(0, 120)); } return j; };
tok = (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'super_admin@demo.local', password: 'Demo#Pass1234' }) })).json()).token;
const today = new Date().toISOString().slice(0, 10), tag = Date.now().toString(36).slice(-4).toUpperCase();
const live = (await call('GET', '/payments/receipts?pageSize=100')).data.filter(r => !['cancelled', 'bounced'].includes(r.status) && Number(r.amount_received_inr) >= 20000);
if (live.length < 3) throw new Error('run demo-seed-receipts.mjs first');
const ch = async (n, amount, bank) => (await call('POST', '/payments/tds/challans', { challanNumber: `DEMO-TDS-${tag}-${n}`, challanDate: today, amount, bankName: bank }))?.data?.id;
const unused = await ch(1, 50000, 'HDFC Bank'), part = await ch(2, 40000, 'State Bank of India'), full = await ch(3, 15000, 'ICICI Bank'), back = await ch(4, 8000, 'Axis Bank');
const a = (c, r, amount) => call('POST', '/payments/tds/assign', { challanId: c, receiptId: r.id, amount });
await a(part, live[0], 12000.5); await a(full, live[1], 15000); await a(back, live[2], 8000);
// the receipt behind the last challan is cancelled: the 8000 returns to the challan
await call('POST', `/payments/receipts/${live[2].id}/cancel`, { reason: 'Entered against wrong customer' });
console.log(`done, ${bad} failed calls`, unused ? '' : '');
