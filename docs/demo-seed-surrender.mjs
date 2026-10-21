// Adds surrender / cancellation records to the LOCAL demo database: Online Omkar surrenders, Upi Uma is cancelled by the builder, a surrender is restored.
// Run after demo-seed-bookings.mjs:  BASE=http://localhost:3020/api node docs/demo-seed-surrender.mjs     (never against live)
const B = process.env.BASE || 'http://localhost:3020/api';
if (!/localhost|127\.0\.0\.1/.test(B)) throw new Error('demo seed runs on a local API only');
let tok = '', bad = 0;
const call = async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: b === undefined ? undefined : JSON.stringify(b) }); const j = await r.json().catch(() => null); if (r.status >= 300) { bad++; console.log(m, p, r.status, JSON.stringify(j).slice(0, 140)); } return j; };
tok = (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'super_admin@demo.local', password: 'Demo#Pass1234' }) })).json()).token;
const today = new Date().toISOString().slice(0, 10);
const projects = await call('GET', '/projects'); const proj = (projects.data || projects).find(p => /Grapes Greens/.test(p.name));
const who = (await call('GET', `/surrender/consumers?projectId=${proj.id}`)).data;
const find = (n) => who.find(x => x.full_name === n || x.full_name?.startsWith(n));
const go = async (n, type, extra) => { const x = find(n); if (!x) { console.log('skip, not found or already done:', n); return null; } const d = (await call('GET', `/surrender/detail/${x.consumer_id}`)).data;
  const received = d.financials.totalReceived;
  return call('POST', '/surrender', { consumerId: x.consumer_id, allocationId: d.allocation.id, bookingId: d.booking.id, unitId: d.unit.id, projectId: d.project.id, type, surrenderDate: today, forfeitureAmount: 0, refundAmount: received, totalAmount: 0, ...extra }); };
const s1 = await go('Online Omkar', 'surrender', { surrenderType: 'refund_case', refundMode: 'online', reason: 'Customer moved to another city', remark: 'Refund after NOC' });
await go('Upi Uma', 'cancellation', { surrenderType: 'builder_cancellation', refundMode: 'cheque', reason: 'Tower delayed' });
const s2 = await go('Draft Divya', 'surrender', { surrenderType: 'non_refund', reason: 'Forfeited, no refund' });
if (s2?.data) await call('POST', '/surrender/restore', { surrenderId: s2.data.surrenderId, type: 'surrender' });
console.log(`done, ${bad} failed calls`, s1?.data?.surrenderId || '');
