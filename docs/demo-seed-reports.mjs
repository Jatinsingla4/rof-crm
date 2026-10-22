// Adds demo data for Reports to the LOCAL demo database: a project with eight applicants whose instalments are paid, part paid, late by 20 to 200 days or not raised yet,
// with cleared, pending, bounced and cancelled receipts, a customer who gave the unit back, and bank accounts, so every Reports screen has something to show.
// Run:  PGHOST=/tmp/rofpg PGPORT=5433 PGUSER=postgres PGDATABASE=rof_demo PATH=$PATH:/Library/PostgreSQL/18/bin BASE=http://localhost:3020/api node docs/demo-seed-reports.mjs   (never against live)
import { execFileSync } from 'node:child_process';
const B = process.env.BASE || 'http://localhost:3020/api';
if (!/localhost|127\.0\.0\.1/.test(B)) throw new Error('demo seed runs on a local API only');
let tok = '', bad = 0;
const call = async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: b === undefined ? undefined : JSON.stringify(b) }); const j = await r.json().catch(() => ({})); if (r.status >= 300) { bad++; console.log('FAILED', m, p, r.status, JSON.stringify(j).slice(0, 120)); } return j; };
const psql = (sql) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' }).trim();
tok = (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'super_admin@demo.local', password: 'Demo#Pass1234' }) })).json()).token;
const today = new Date().toISOString().slice(0, 10), later = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
const tag = Date.now().toString(36).slice(-4).toUpperCase();
let seq = 0; const mob = () => '9' + String((Date.now() % 1e7) * 100 + ++seq + 100000000).slice(-9).padStart(9, '0');

const co = (await call('POST', '/companies', { name: `Demo Reports Co ${tag}` })).data.id;
const bank = psql(`insert into company_bank_accounts (company_id, bank_name, account_number, is_active, is_primary) values ('${co}', 'Demo Bank ${tag}', 'DR${tag}', true, false) returning id`);
const P = (await call('POST', '/projects', { companyId: co, name: `Demo Reports Heights ${tag}`, reraNumber: `DRH-${tag}`, tcpLicence: 'x' })).data.id;
const T = (await call('POST', `/projects/${P}/towers`, { towerName: `Tower R${tag}` })).data.id;
const plan = `Demo Plan ${tag}`; let k = 0;
for (const pc of [20, 30, 50]) await call('POST', `/projects/${P}/plan-templates`, { plan_name: plan, installment_name: `Stage ${++k}`, installment_type: k === 1 ? 'booking' : 'installment', percentage: pc, due_date_offset_days: k * 30, installment_index: k });
let slab = (await call('GET', '/gst-configuration/gst-slabs')).data.find(s => s.from_date <= today && s.to_date >= today)?.id;
if (!slab) slab = (await call('POST', '/gst-configuration/gst-slabs', { fromDate: later(-3), toDate: later(60) })).data.id;
const taxId = (await call('POST', '/gst-configuration/gst-tax-setup', { slabId: slab, gstCode: `DR ${tag}`, type: 'INTRA', cgstPct: 2.5, sgstPct: 2.5 })).data.id;
for (const ct of ['BASIC', 'PLC', 'OTHER CHARGE']) await call('POST', '/gst-configuration/gst-charge-mapping', { projectId: P, slabId: slab, gstTaxId: taxId, chargeType: ct });

let n = 0;
const buyer = async (name, base) => {
  const c = (await call('POST', '/consumers', { name: `${name} ${tag}`, mobile: mob(), project_id: P })).data.id;
  const u = (await call('POST', '/units', { projectId: P, towerId: T, unitNumber: `DR${++n}-${tag}`, floor: 1 + n % 5, bhkType: n % 2 ? '2BHK' : '3BHK', carpetAreaSqft: 1000 + n * 10, superAreaSqft: 1250, basePriceInr: base, totalPriceInr: base + 400000 })).data.id;
  const b = (await call('POST', '/booking', { consumer_id: c, project_id: P, unit_id: u, selected_plan_name: plan, booking_date: today })).data.id;
  await call('PATCH', `/booking/${b}`, { booking_amount: 15000, payment_mode: 'cash' });
  psql(`update booking_records set basic_rate_inr_sqft = ${Math.round(base / (1000 + n * 10) * 100) / 100}, plc_amount = 25000, other_charge_amount = 5000 where id = '${b}' returning 1`);
  return { c, u, b, plan: psql(`select id from payment_plans where consumer_id='${c}' order by created_at desc limit 1`) };
};
const raise = (B_, idx, days) => psql(`update demands set status='demanded', due_date = current_date - ${days}, raised_at = now() where payment_plan_id='${B_.plan}' and installment_index=${idx} returning 1`);
const total = (B_, idx) => Number(psql(`select amount_due_inr + cgst_amount + sgst_amount from demands where payment_plan_id='${B_.plan}' and installment_index=${idx}`));
let rn = 0;
const rcp = async (B_, amt, idx, st, mode = 'neft') => {
  const id = (await call('POST', '/payments/receipts', { consumerId: B_.c, amountReceivedInr: amt, paymentMode: mode, referenceNumber: `DR${tag}-${++rn}`, paymentDate: today, installmentIndex: idx, companyBankAccountId: bank, ...(mode === 'cheque' ? { chequeNo: `DQ${tag}${rn}` } : {}) })).data.id;
  if (st === 'clear') await call('PATCH', `/payments/receipts/${id}/clear`, { clearing_date: today });
  if (st === 'bounce') await call('PATCH', `/payments/receipts/${id}/bounce`, { reason: 'Insufficient funds' });
  if (st === 'cancel') await call('POST', `/payments/receipts/${id}/cancel`, { reason: 'Entered twice' });
};
const a = await buyer('Anil Reports', 7200000); raise(a, 1, 20); raise(a, 2, 70); await rcp(a, Math.floor(total(a, 1) / 2), 1, 'clear'); await rcp(a, 100000, 2, 'clear', 'cheque'); await rcp(a, 55000, 2, 'bounce', 'cheque'); await rcp(a, 33000, 2, 'pending');
const b = await buyer('Bina Reports', 5100000); raise(b, 1, 40); raise(b, 2, -15); await rcp(b, total(b, 1), 1, 'clear'); await rcp(b, Math.floor(total(b, 2) / 3), 2, 'clear');
const c = await buyer('Chetan Reports', 6600000); raise(c, 1, 200); raise(c, 2, 100); raise(c, 3, 5);
const d = await buyer('Deepa Reports', 7700000); raise(d, 1, 30); await rcp(d, 300000, 1, 'clear');
await buyer('Esha Reports', 4100000);
const f = await buyer('Farid Reports', 5900000); raise(f, 1, 95); raise(f, 2, 35); await rcp(f, 90000, 1, 'clear', 'cheque'); await rcp(f, 20000, 1, 'cancel');
const g = await buyer('Gita Reports', 8300000); raise(g, 1, 150); await rcp(g, total(g, 1) + 25000, 1, 'clear');
const h = await buyer('Harsh Reports', 4600000); raise(h, 1, 8); await rcp(h, 60000, 1, 'pending');
// Deepa gives the unit back: she leaves the dues reports, her cleared money stays in Collection
const al = psql(`select id from allocations where consumer_id='${d.c}' and status not in ('cancelled','transferred') order by created_at desc limit 1`);
await call('POST', '/surrender', { consumerId: d.c, allocationId: al, bookingId: d.b, unitId: d.u, projectId: P, type: 'surrender', surrenderDate: today });
console.log(`done: project "Demo Reports Heights ${tag}", 8 applicants, ${bad} failed calls`);
