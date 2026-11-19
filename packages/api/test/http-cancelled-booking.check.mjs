// HTTP check for QA-012 / QA-014 / QA-015 on a THROWAWAY local database (see db-cancelled-booking.check.mjs for the setup).
// Run: BASE=http://localhost:3097/api DB_NAME=rof_remed_b1 npx tsx test/http-cancelled-booking.check.mjs     Tokens are never printed.
import pg from 'pg';
const BASE = process.env.BASE || 'http://localhost:3097/api';
const db = new pg.Pool({ host: 'localhost', user: 'postgres', password: process.env.DB_PASSWORD || 'postgres', database: process.env.DB_NAME || 'rof_remed_b1' });
const PW = 'Test#Pass1234';   // local test databases only
let failed = 0;
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!cond) failed++; };
async function login(email) { const r = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PW }) }); return (await r.json()).token; }
const call = async (tok, method, path, body) => { const r = await fetch(`${BASE}${path}`, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${tok}` }, body: body ? JSON.stringify(body) : undefined }); let j = {}; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const msg = (r) => String(r.j.error || r.j.message || '');

// throwaway DB only: the accounts login is made a receipt maker (super_admin is the checker, it bypasses process rights)
await db.query(`INSERT INTO user_process_permissions (user_id, process_name, is_maker) SELECT id, 'receipt', true FROM users WHERE email = 'accounts_finance@test.local' ON CONFLICT (user_id, process_name) DO UPDATE SET is_maker = true`);
// throwaway DB only: a BASIC GST mapping for the fixture project so the control receipt can be recorded
if (!(await db.query(`SELECT 1 FROM gst_tax_charge_mapping m JOIN projects p ON p.id = m.project_id WHERE p.name = 'FX'`)).rows.length) {
  await db.query(`INSERT INTO gst_slabs (from_date, to_date) VALUES ('2020-01-01', '2099-12-31') ON CONFLICT DO NOTHING`);
  const sl = (await db.query(`SELECT id FROM gst_slabs WHERE from_date = '2020-01-01' AND to_date = '2099-12-31'`)).rows[0].id;
  const tx = (await db.query(`INSERT INTO gst_tax_setup (gst_code, slab_id, type, cgst_pct, sgst_pct) VALUES ('FXT', $1, 'INTRA', 2.5, 2.5) RETURNING id`, [sl])).rows[0].id;
  await db.query(`INSERT INTO gst_tax_charge_mapping (project_id, charge_type, slab_id, gst_tax_id) SELECT id, 'BASIC', $1, $2 FROM projects WHERE name = 'FX'`, [sl, tx]);
}
const maker = await login('accounts_finance@test.local'), checker = await login('super_admin@test.local');
const canc = (await db.query(`SELECT co.id consumer_id, pp.id plan_id, pp.unit_id FROM payment_plans pp JOIN consumers co ON co.id = pp.consumer_id WHERE co.name = 'Cancelled Cust'`)).rows[0];
const live = (await db.query(`SELECT co.id consumer_id, pp.id plan_id FROM payment_plans pp JOIN consumers co ON co.id = pp.consumer_id WHERE co.name <> 'Cancelled Cust' LIMIT 1`)).rows[0];
const cancReceipt = (await db.query(`SELECT id FROM receipts WHERE payment_plan_id = $1 LIMIT 1`, [canc.plan_id])).rows[0].id;

await db.query(`UPDATE receipts SET status = 'pending', approval_status = 'pending', authorized_by = NULL, received_by_user_id = NULL WHERE id = $1`, [cancReceipt]);   // repeatable
await db.query(`DELETE FROM demands WHERE payment_plan_id = $1`, [canc.plan_id]);
let r = await call(maker, 'POST', '/payments/receipts', { consumerId: canc.consumer_id, amountReceivedInr: 1000, paymentMode: 'cash' });
ok('new receipt on a cancelled booking is refused (409)', r.s === 409 && /cancelled/i.test(msg(r)), `status ${r.s} ${msg(r).slice(0, 80)}`);

r = await call(maker, 'POST', '/payments/receipts', { consumerId: live.consumer_id, amountReceivedInr: 1000, paymentMode: 'cash' });
ok('control: new receipt on a live booking is not refused for cancellation', r.s < 400 || !/cancelled/i.test(msg(r)), `status ${r.s} ${r.s >= 400 ? msg(r).slice(0, 80) : ''}`);
const newId = r.j?.data?.id || r.j?.id;

r = await call(checker, 'PATCH', `/payments/receipts/${cancReceipt}/approve`);
ok('approving a pending receipt of a cancelled booking is refused (409)', r.s === 409 && /cancelled/i.test(msg(r)), `status ${r.s}`);

r = await call(checker, 'GET', '/dashboard/pending-approval');
const rows = r.j.data || [];
const row = rows.find((x) => x.id === cancReceipt);
ok('approval queue marks the cancelled-booking receipt', !!row && row.booking_cancelled === true, `rows ${rows.length}`);

// as a historical case: the receipt was recorded by the maker and authorised before the booking was cancelled
await db.query(`UPDATE receipts SET received_by_user_id = (SELECT id FROM users WHERE email = 'accounts_finance@test.local'), status = 'authorized', approval_status = 'approved',
  authorized_by = (SELECT id FROM users WHERE email = 'super_admin@test.local') WHERE id = $1`, [cancReceipt]);
r = await call(checker, 'PATCH', `/payments/receipts/${cancReceipt}/clear`, { clearing_date: new Date().toISOString().slice(0, 10) });
ok('clearing a receipt of a cancelled booking is refused (409)', r.s === 409 && /cancelled/i.test(msg(r)), `status ${r.s} ${msg(r).slice(0, 100)}`);

if (newId) { r = await call(checker, 'PATCH', `/payments/receipts/${newId}/approve`); ok('control: a live receipt is approved by a different user', r.s === 200, `status ${r.s}`); }

// a pending demand on the cancelled plan: raising it must be skipped
const d = (await db.query(`INSERT INTO demands (consumer_id, payment_plan_id, installment_index, amount_due_inr, status) VALUES ($1, $2, 1, 1000, 'pending') RETURNING id`, [canc.consumer_id, canc.plan_id])).rows[0];
const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
r = await call(checker, 'PATCH', '/payments/demands/activate', { demandIds: [d.id], installmentDate: tomorrow });
const skipped = JSON.stringify(r.j).includes('Booking is cancelled');
ok('raising a demand of a cancelled booking is skipped', skipped, `status ${r.s}`);
const still = (await db.query(`SELECT status, raised_at FROM demands WHERE id = $1`, [d.id])).rows[0];
ok('the demand is left unraised', still.status === 'pending' && !still.raised_at);


const cheq = await call(checker, 'GET', '/dashboard/pending-cheques');
const tot = cheq.j.totals || {};
ok('pending cheques count only the live cheque (no bank transfer, no cancelled-booking cheque)', tot.total === 1 && Number(tot.amount) === 100, JSON.stringify(tot));
await db.end();
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
