// Adds add-on charges to the LOCAL demo database (run after demo-seed.mjs and demo-seed-plans.mjs). Never against live.
//   PGHOST=/tmp/rofpg PGPORT=5433 PGUSER=postgres PGDATABASE=rof_demo BASE=http://localhost:3020/api node docs/demo-seed-addons.mjs
import { execFileSync } from 'node:child_process';
const B = process.env.BASE || 'http://localhost:3020/api';
if (!/localhost|127\.0\.0\.1/.test(B) || process.env.PGDATABASE !== 'rof_demo') throw new Error('demo seed runs on the local demo database only');
const psql = (sql) => execFileSync('psql', ['-qAt', '-c', sql], { encoding: 'utf8' }).trim().split('\n')[0];
const tok = (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'super_admin@demo.local', password: 'Demo#Pass1234' }) })).json()).token;
const call = async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: b && JSON.stringify(b) }); const j = await r.json().catch(() => null); if (!r.ok) console.log('FAIL', m, p, r.status, JSON.stringify(j)); return j?.data ?? j; };
const proj = (await call('GET', '/projects')).find((p) => p.name === 'Grapes Greens').id;
const mk = async (chargeName, o) => (await call('POST', '/addon-charges/master', { projectId: proj, chargeName, ...o })).id;
const club = await mk('Club Membership', { defaultAmount: 150000 });
const power = await mk('Power Backup (per sq.ft.)', { rateType: 'per_sqft', ratePerSqftInr: 80 });
const park = await mk('Open Parking', { defaultAmount: 100000, cgstPct: 9, sgstPct: 9 });
await mk('Maintenance Deposit', { defaultAmount: 50000, cgstPct: 0, sgstPct: 0 });
// Plan CLP 10:20:70 bills Club Membership 50% / 50% on the first two instalments and Power Backup 100% on the last
const tpl = (i) => psql(`SELECT id FROM plan_schedule_templates WHERE project_id='${proj}' AND plan_name='CLP 10:20:70' AND installment_index=${i}`);
for (const [i, c, pct] of [[1, club, 50], [2, club, 50], [3, power, 100]]) await call('POST', `/projects/${proj}/plan-templates/${tpl(i)}/addon-charges`, { charge_master_id: c, pct });
// Three bookings with their demands
const cons = psql(`SELECT string_agg(id::text, ',') FROM (SELECT id FROM consumers WHERE name IN ('Anil Malhotra','Priya Kapoor','Sandeep Chauhan') ORDER BY name) x`).split(',');
const units = psql(`SELECT string_agg(id::text, ',') FROM (SELECT id FROM units WHERE project_id='${proj}' ORDER BY unit_number LIMIT 3) x`).split(',');
const made = [];
for (const [k, c] of cons.entries()) {
  const u = units[k], price = Number(psql(`SELECT total_price_inr FROM units WHERE id='${u}'`));
  const al = psql(`INSERT INTO allocations (consumer_id, unit_id, project_id) VALUES ('${c}','${u}','${proj}') RETURNING id`);
  const pp = psql(`INSERT INTO payment_plans (allocation_id, consumer_id, unit_id, project_id, total_amount_inr) VALUES ('${al}','${c}','${u}','${proj}',${price}) RETURNING id`);
  psql(`INSERT INTO booking_records (consumer_id, unit_id, project_id, selected_plan_name, status, booking_date) VALUES ('${c}','${u}','${proj}','CLP 10:20:70','confirmed', CURRENT_DATE) RETURNING id`);
  psql(`UPDATE units SET status='booked' WHERE id='${u}' RETURNING id`);
  for (const [i, pc] of [[1, 10], [2, 20], [3, 70]]) psql(`INSERT INTO demands (payment_plan_id, installment_index, consumer_id, amount_due_inr, status, due_date) VALUES ('${pp}',${i},'${c}',${Math.round(price * pc / 100)},'raised', CURRENT_DATE + ${i * 30}) RETURNING id`);
  made.push(c);
}
const give = (c, m, amount, extra) => call('POST', '/addon-charges/consumer', { consumerId: c, projectId: proj, chargeMasterId: m, amount, ...extra });
await give(made[0], club, 150000, { remark: 'Club membership with booking' });
const psq = Math.round(80 * Number(psql(`SELECT carpet_area_sqft FROM units WHERE id='${units[0]}'`)) * 100) / 100;
await give(made[0], power, psq);
await give(made[1], club, 150000);
const wv = await give(made[1], park, 100000, { remark: 'Allotted parking' });
await call('PATCH', `/addon-charges/consumer/${wv.id}/waive`, { waiveRemark: 'Waived as a goodwill gesture by VP Sales' });
const cx = await give(made[2], park, 100000);
await call('PATCH', `/addon-charges/consumer/${cx.id}/cancel`);
console.log('add-on demo data added');
