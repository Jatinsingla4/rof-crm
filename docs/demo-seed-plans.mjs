// Adds payment plans to the LOCAL demo database (run after demo-seed.mjs). Never against live.
//   BASE=http://localhost:3020/api node docs/demo-seed-plans.mjs
const B = process.env.BASE || 'http://localhost:3020/api';
if (!/localhost|127\.0\.0\.1/.test(B)) throw new Error('demo seed runs on a local API only');
const post = async (tok, p, b) => { const r = await fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: JSON.stringify(b) }); const j = await r.json().catch(() => null); if (!r.ok) console.log('FAIL', p, r.status, JSON.stringify(j)); return j?.data ?? j; };
const tok = (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'super_admin@demo.local', password: 'Demo#Pass1234' }) })).json()).token;
const proj = (await (await fetch(B + '/projects', { headers: { authorization: 'Bearer ' + tok } })).json()).data.find((p) => p.name === 'Grapes Greens').id;
await post(tok, `/projects/${proj}/plans/standard`, { plan_name: 'Standard AHP Plan' });
const rows = [['Booking Amount', 'booking', 10, 0], ['Within 30 days', 'installment', 20, 30], ['On Possession', 'possession', 70, 0]];
for (const [i, [n, t, p, d]] of rows.entries()) await post(tok, `/projects/${proj}/plan-templates`, { plan_name: 'CLP 10:20:70', installment_name: n, installment_type: t, percentage: p, due_date_offset_days: d, installment_index: i + 1 });
await post(tok, `/projects/${proj}/plan-templates`, { plan_name: 'Draft plan', installment_name: 'Booking Amount', installment_type: 'booking', percentage: 5, installment_index: 1 });
await post(tok, `/projects/${proj}/plan-templates`, { plan_name: 'Draft plan', installment_name: 'Club membership', installment_type: 'other_charge', flat_amount_inr: 150000, installment_index: 2 });
console.log('plans added');
