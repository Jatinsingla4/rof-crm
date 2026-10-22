// Adds demo data for Broker and Investor / Hold to the LOCAL demo database: four brokers (active, pending, rejected, suspended), tax setups,
// project mapping, broker bookings with commissions (pending, paid with GST and TDS, cancelled), and unit holds (active, released, expired).
// Needs the Grapes Greens project with units, a complete payment plan and GST (demo-seed*.mjs).
// Run:  BASE=http://localhost:3020/api node docs/demo-seed-broker-hold.mjs     (never against live; EMAIL / PASSWORD pick another login)
import { execFileSync } from 'node:child_process';
const B = process.env.BASE || 'http://localhost:3020/api';
if (!/localhost|127\.0\.0\.1/.test(B)) throw new Error('demo seed runs on a local API only');
let tok = '', bad = 0;
const call = async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: b === undefined ? undefined : JSON.stringify(b) }); const j = await r.json().catch(() => null); if (!r.ok) { bad++; console.log('  ' + m + ' ' + p + ' -> ' + r.status + ' ' + JSON.stringify(j).slice(0, 160)); } return j?.data ?? j; };
tok = (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: process.env.EMAIL || 'super_admin@demo.local', password: process.env.PASSWORD || 'Demo#Pass1234' }) })).json()).token;
const tag = Date.now().toString(36).slice(-4).toUpperCase(), today = new Date().toISOString().slice(0, 10);
const proj = (await call('GET', '/projects')).find(p => /Grapes Greens/.test(p.name))?.id;
const units = ((await call('GET', `/units?projectId=${proj}&pageSize=200`)) || []).filter(u => u.status === 'available');
const plans = ((await call('GET', `/projects/${proj}/plans`)) || []).filter(p => p.complete);
if (!plans.length || units.length < 8) throw new Error('needs a complete payment plan and 8 available units in Grapes Greens');
const plan = plans[0].plan_name;
let n = 0; const mob = () => `96${String(30000000 + ++n * 77123 + (Date.now() % 1000)).slice(-8)}`;
const broker = async (firm, extra = {}) => (await call('POST', '/brokers', { firmName: `${firm} ${tag}`, contact_person: firm.split(' ')[0] + ' Sharma', mobile: mob(), email: `${firm.split(' ')[0].toLowerCase()}${tag.toLowerCase()}@example.com`, city: 'Gurugram', state: 'Haryana', commissionPct: 2, ...extra }))?.id;
const bA = await broker('Shree Realty', { commissionPct: 1.5, bankAccountDetails: { accountName: 'Shree Realty', accountNo: '50100123456789', ifsc: 'HDFC0001234', bankName: 'HDFC Bank' } });
const bB = await broker('Pending Properties'), bC = await broker('Rejected Estates'), bD = await broker('Suspended Sales');
for (const id of [bA, bD]) await call('PATCH', `/brokers/${id}/approve`, { notes: 'Documents verified' });
await call('PATCH', `/brokers/${bC}/reject`, { notes: 'RERA number could not be verified' });
await call('PATCH', `/brokers/${bD}/status`, { status: 'suspended' });
await call('POST', `/broker-setup/${bA}`, { tdsRatePct: 5, gstRatePct: 18 });
await call('POST', `/broker-setup/${bD}`, { tdsRatePct: 10, isGstExempt: true });
await call('POST', `/brokers/${bA}/projects`, { projectIds: [proj] });
// bookings through the active broker: a pending commission, a paid one, a cancelled one
const person = async (nm) => (await call('POST', '/consumers', { name: `${nm} ${tag}`, mobile: mob(), project_id: proj }))?.id;
const book = async (nm, u, extra = {}) => { const c = await person(nm); const b = await call('POST', '/booking', { consumer_id: c, project_id: proj, unit_id: u.id, selected_plan_name: plan, booking_date: today, booking_type: 'broker', broker_id: bA, ...extra }); return { c, b }; };
const x1 = await book('Pending Commission Priya', units[0], { broker_commission: 1.5, broker_commission_type: 'percent', booking_amount: 100000, payment_mode: 'cash' });
const x2 = await book('Paid Commission Paras', units[1], { broker_commission: 75000, broker_commission_type: 'flat', booking_amount: 100000, payment_mode: 'cash' });
const x3 = await book('Cancelled Commission Chetna', units[2], { broker_commission: 50000, broker_commission_type: 'flat' });
const commission = (c) => execFileSync('psql', ['-qAt', '-c', `select id from broker_commissions where consumer_id = '${c}'`], { encoding: 'utf8' }).trim();
if (process.env.PGDATABASE) {
  const c2 = commission(x2.c); if (c2) await call('PATCH', `/brokers/commission/${c2}`, { status: 'paid', notes: 'Paid by NEFT, demo' });
} else console.log('  (set PGHOST / PGPORT / PGUSER / PGDATABASE to the demo database to also pay one commission)');
if (x3.b?.id) await call('POST', `/booking/${x3.b.id}/cancel`, { reason: 'Customer changed plan' });
// holds: active (24 h), released, expired
const hold = (u, extra = {}) => call('POST', '/inventory-hold', { unitId: u.id, brokerId: bA, ...extra });
await hold(units[3], { clientName: 'Hold Himanshu', clientMobile: mob(), holdHours: 48, notes: 'Site visit on Saturday' });
await hold(units[4], { clientName: 'Hold Harpreet', clientMobile: mob() });
const h3 = await hold(units[5], { clientName: 'Released Rohan', holdHours: 24 });
if (h3?.id) await call('POST', `/inventory-hold/${h3.id}/unhold`);
const h4 = await hold(units[6], { clientName: 'Expired Esha', holdHours: 1 });
if (h4?.id && process.env.PGDATABASE) { execFileSync('psql', ['-qAt', '-c', `update unit_holds set expires_at = now() - interval '5 minutes' where id = '${h4.id}'`]); await call('GET', '/inventory-hold'); }
console.log(`done, ${bad} failed calls`);
