// Adds demand states to the LOCAL demo database for the customers made by demo-seed-bookings.mjs: stage 1 raised and sent, stage 2 raised,
// one raised demand withdrawn again, and stage 1 part-paid by a receipt. Run after demo-seed-bookings.mjs.
// Run:  BASE=http://localhost:3020/api node docs/demo-seed-demands.mjs     (never against live)
const B = process.env.BASE || 'http://localhost:3020/api';
if (!/localhost|127\.0\.0\.1/.test(B)) throw new Error('demo seed runs on a local API only');
let tok = '', bad = 0;
const call = async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: b === undefined ? undefined : JSON.stringify(b) }); const j = await r.json().catch(() => null); if (r.status >= 300) { bad++; console.log(m, p, r.status, JSON.stringify(j).slice(0, 120)); } return j; };
tok = (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'super_admin@demo.local', password: 'Demo#Pass1234' }) })).json()).token;
const due = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
const consumers = (await call('GET', '/consumers?pageSize=200')).data.filter(c => ['Cash Chetan', 'Online Omkar', 'Draft Divya', 'Upi Uma'].includes(c.name));
const dem = async (c) => (await call('GET', `/payments/demands?consumerId=${c.id}`)).data.sort((a, b) => a.installment_index - b.installment_index);
const [chetan, omkar, divya, uma] = ['Cash Chetan', 'Online Omkar', 'Draft Divya', 'Upi Uma'].map(n => consumers.find(c => c.name === n));
const D = {}; for (const c of [chetan, omkar, divya, uma]) D[c.name] = await dem(c);
const pend = (c) => D[c.name].filter(d => d.status === 'pending');
await call('PATCH', '/payments/demands/activate', { demandIds: [chetan, omkar, divya].map(c => pend(c)[0].id), installmentDate: due(15) });
await call('PATCH', `/payments/demands/${pend(chetan)[0].id}/send`, { sentVia: 'email' });
await call('PATCH', `/payments/demands/${pend(omkar)[0].id}/send`, { sentVia: 'whatsapp' });
await call('PATCH', '/payments/demands/activate', { demandIds: [pend(chetan)[1]?.id].filter(Boolean), installmentDate: due(45) });
const wrong = (await dem(divya)).find(d => d.status === 'demanded'); if (wrong) await call('PATCH', `/payments/demands/${wrong.id}/cancel`, { reason: 'Raised by mistake' });
console.log(`done, ${bad} failed calls`);
