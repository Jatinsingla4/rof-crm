// Adds varied bookings to the LOCAL demo database: started (pending), held (active), complete with different payment modes, a broker booking,
// a cancelled draft, a booking with documents. Needs the Grapes Greens project with units, a complete payment plan and GST (demo-seed*.mjs).
// Run:  BASE=http://localhost:3020/api node docs/demo-seed-bookings.mjs     (never against live)
const B = process.env.BASE || 'http://localhost:3020/api';
if (!/localhost|127\.0\.0\.1/.test(B)) throw new Error('demo seed runs on a local API only');
let tok = '', bad = 0;
const call = async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: b === undefined ? undefined : JSON.stringify(b) }); const j = await r.json().catch(() => null); if (!r.ok) { bad++; console.log(`FAIL ${m} ${p} ${r.status} ${JSON.stringify(j)?.slice(0, 160)}`); } return j?.data ?? j; };
tok = (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'super_admin@demo.local', password: 'Demo#Pass1234' }) })).json()).token;
const proj = (await call('GET', '/projects')).find(p => /Grapes Greens/.test(p.name))?.id;
const units = (await call('GET', `/units?projectId=${proj}&pageSize=200`)).filter?.(u => u.status === 'available') ?? [];
const plans = (await call('GET', `/projects/${proj}/plans`)).filter(p => p.complete);
if (!plans.length || units.length < 8) throw new Error('needs a complete payment plan and 8 available units in Grapes Greens');
const plan = plans[0].plan_name, today = new Date().toISOString().slice(0, 10);
let n = 0; const person = async (nm) => (await call('POST', '/consumers', { name: nm, mobile: `97${String(20000000 + ++n * 91117).slice(-8)}`, project_id: proj, email: `${nm.split(' ')[0].toLowerCase()}${n}@example.com` })).id;
const start = async (nm, u, extra = {}) => { const c = await person(nm); const b = await call('POST', '/booking', { consumer_id: c, project_id: proj, unit_id: u.id, selected_plan_name: plan, booking_date: today, ...extra }); return { c, b }; };
await start('Pending Pooja', units[0]);
await start('Active Arjun', units[1], { booking_amount: 100000, payment_mode: 'cheque', payment_ref: 'DEMOCHQ001', bank_name: 'HDFC Bank', cheque_date: today });
for (const [i, [nm, mode]] of [['Cash Chetan', 'cash'], ['Online Omkar', 'online'], ['Draft Divya', 'draft'], ['Upi Uma', 'upi']].entries()) {
  const { b } = await start(nm, units[2 + i], { basic_price: 9000 + i * 100, plc_amount: i * 50000, has_plc: i > 0 });
  await call('PATCH', `/booking/${b.id}`, { booking_amount: 150000 + i * 25000, payment_mode: mode, ...(mode === 'cash' ? {} : { payment_ref: `DEMO${mode.toUpperCase()}${i}`, bank_name: 'SBI' }) });
}
const cancelled = await start('Cancelled Charu', units[6]); await call('POST', `/booking/${cancelled.b.id}/cancel`, { reason: 'Customer changed plan' });
const doc = await start('Docs Deepak', units[7]);
const fd = new FormData(); fd.append('booking_record_id', doc.b.id); fd.append('consumer_id', doc.c); fd.append('document_type', 'PAN Card'); fd.append('file', new Blob(['%PDF-1.4 demo'], { type: 'application/pdf' }), 'pan.pdf');
await fetch(B + '/booking-documents/upload', { method: 'POST', headers: { authorization: 'Bearer ' + tok }, body: fd });
console.log(`done, ${bad} failed calls`);
