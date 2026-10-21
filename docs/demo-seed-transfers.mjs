// Adds transfers to the LOCAL demo database: Cash Chetan sells to a new buyer, who passes the unit on again; a fee master for Grapes Greens.
// Run after demo-seed-bookings.mjs:  BASE=http://localhost:3020/api node docs/demo-seed-transfers.mjs     (never against live)
const B = process.env.BASE || 'http://localhost:3020/api';
if (!/localhost|127\.0\.0\.1/.test(B)) throw new Error('demo seed runs on a local API only');
let tok = '', bad = 0;
const call = async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: b === undefined ? undefined : JSON.stringify(b) }); const j = await r.json().catch(() => null); if (r.status >= 300) { bad++; console.log(m, p, r.status, JSON.stringify(j).slice(0, 120)); } return j; };
tok = (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'super_admin@demo.local', password: 'Demo#Pass1234' }) })).json()).token;
const today = new Date().toISOString().slice(0, 10), day = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
const proj = (await call('GET', '/projects')).data?.find?.(p => /Grapes Greens/.test(p.name)) || (await call('GET', '/projects')).find?.(p => /Grapes Greens/.test(p.name));
const people = (await call('GET', '/consumers?pageSize=200')).data;
const chetan = people.find(c => c.name === 'Cash Chetan'); if (!chetan?.allocated_unit_id) throw new Error('run demo-seed-bookings.mjs first (Cash Chetan needs a unit)');
await call('POST', '/transfers/fee-master', { projectId: proj.id, transferFeeInr: 25000, adminChargesInr: 5000, cgstPct: 9, sgstPct: 9, effectiveFrom: day(-90) });
const mk = async (name, mobile) => (await call('POST', '/consumers', { name, mobile, project_id: proj.id, email: `${name.split(' ')[0].toLowerCase()}@demo.local` })).data.id;
const buyer1 = await mk('Transfer Tanya', '9733300011'), buyer2 = await mk('Transfer Tarun', '9733300022');
const t1 = await call('POST', '/transfers', { unitId: chetan.allocated_unit_id, oldConsumerId: chetan.id, newConsumerId: buyer1, transferNo: 'DEMO-TR-1', transferFee: 25000, adminCharges: 5000, staxAmount: 4500, cgstAmount: 2250, sgstAmount: 2250, transferAmountInr: 9200000, transferType: 'Individual', applicationDate: day(-20), transferDate: day(-15), remarks: 'Sold to a relative', brokerCompany: 'Zen Realty', salesPersonName: 'Ravi' });
await call('POST', '/transfers', { unitId: chetan.allocated_unit_id, oldConsumerId: buyer1, newConsumerId: buyer2, transferNo: 'DEMO-TR-2', transferFee: 25000, adminCharges: 5000, transferAmountInr: 9400000, transferType: 'Individual', applicationDate: day(-5), transferDate: day(-2) });
console.log(`done, ${bad} failed calls`, t1?.data?.id || '');
