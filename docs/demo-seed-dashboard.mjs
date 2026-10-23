// Adds demo data for Milestones and Bank Reconciliation to the LOCAL demo database: five construction milestones of Grapes Greens (one completed with the
// allottees told), and one bank statement whose lines match real receipts of the project (and some that do not). Dashboard needs no seed (it reads the other demo data).
// Run:  BASE=http://localhost:3020/api PGDATABASE=rof_demo node docs/demo-seed-dashboard.mjs     (never against live; psql must reach the demo database)
import { execFileSync } from 'node:child_process';
const B = process.env.BASE || 'http://localhost:3020/api';
if (!/localhost|127\.0\.0\.1/.test(B)) throw new Error('demo seed runs on a local API only');
const psql = (sql) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' }).trim();
const call = async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: b === undefined ? undefined : JSON.stringify(b) }); const j = await r.json().catch(() => null); if (r.status >= 400) console.log('  ', m, p, r.status, j?.error); return j; };
const tok = (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: process.env.EMAIL || 'super_admin@demo.local', password: process.env.PASSWORD || 'Demo#Pass1234' }) })).json()).token;
const tag = Date.now().toString(36).slice(-3).toUpperCase();
const proj = (await call('GET', '/projects')).data.find((p) => /Grapes Greens/.test(p.name))?.id;
if (!proj) throw new Error('needs the Grapes Greens project');

if (psql(`select count(*) from construction_milestones where project_id='${proj}'`) === '0') {
  for (const [name, type, status, pct] of [['Foundation', 'foundation', 'pending', 0], ['Structure up to 10th floor', 'structure', 'in_progress', 55], ['Electrical and plumbing', 'mep', 'pending', 0], ['Occupancy certificate', 'legal', 'pending', 0], ['Handover', 'handover', 'pending', 0]])
    psql(`INSERT INTO construction_milestones (project_id, milestone_name, milestone_type, status, completion_percentage, notify_allottees) VALUES ('${proj}', '${name}', '${type}', '${status}', ${pct}, true)`);
  const first = psql(`select id from construction_milestones where project_id='${proj}' and milestone_type='foundation'`);
  const r = await call('PATCH', `/milestones/${first}/complete`, { description: 'Foundation raft poured and cured', notifyAllottees: true });
  console.log('milestone completed:', r?.message);
}

const refs = psql(`select r.transaction_ref||'|'||r.amount_received_inr from receipts r join payment_plans pp on pp.id=r.payment_plan_id where pp.project_id='${proj}' and r.transaction_ref is not null and r.status not in ('cancelled','bounced') order by r.created_at limit 3`).split('\n').filter(Boolean).map((x) => x.split('|'));
const lines = ['Date,Description,Amount,Reference,Account'];
const d = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10).split('-').reverse().join('/');
refs.forEach(([ref, amt], i) => lines.push(`${d(i + 1)},NEFT credit ${ref},"${Number(amt).toLocaleString('en-IN')}.00",${ref},HDFC 0042`));
lines.push(`${d(4)},UPI credit unknown payer,15000,UPI${tag}001,HDFC 0042`, `${d(5)},Bank charges,-590.00,,HDFC 0042`, `${d(6)},Interest credited,1240.55,,HDFC 0042`);
const r = await call('POST', '/reconciliation/import', { projectId: proj, fileName: `demo-statement-${tag}.csv`, csvContent: lines.join('\n') });
console.log('statement imported:', JSON.stringify(r?.data));
