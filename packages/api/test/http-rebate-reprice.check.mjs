// HTTP + DB check for QA-001 / QA-005: approving a rebate re-cuts the plan from the price the booking was SOLD at, never from the current unit master.
// Sh Tester shape: unit master 800 sq ft x 4040 = 32,32,000, but the booking was sold and its plan cut at 25,85,600 (640 sq ft).
// THROWAWAY local database only. Run: BASE=http://localhost:3098/api DB_NAME=rof_remed_regress npx tsx test/http-rebate-reprice.check.mjs
import pg from 'pg';
const BASE = process.env.BASE || 'http://localhost:3098/api';
const db = new pg.Pool({ host: 'localhost', user: 'postgres', password: process.env.DB_PASSWORD || 'postgres', database: process.env.DB_NAME || 'rof_remed_regress' });
let failed = 0;
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!cond) failed++; };
const login = async (email) => (await (await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Test#Pass1234' }) })).json()).token;
const post = async (tok, path) => { const r = await fetch(`${BASE}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tok}` }, body: '{}' }); let j = {}; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const checker = await login('super_admin@test.local');
const makerId = (await db.query(`SELECT id FROM users WHERE email = 'accounts_finance@test.local'`)).rows[0].id;
const b = (await db.query(`SELECT br.*, pp.id AS plan_id, pp.total_amount_inr AS plan_total, u.carpet_area_sqft AS u_carpet, u.base_price_inr AS u_price
    FROM booking_records br JOIN payment_plans pp ON pp.consumer_id = br.consumer_id AND pp.unit_id = br.unit_id JOIN units u ON u.id = br.unit_id WHERE br.status = 'active' LIMIT 1`)).rows[0];
ok('fixture has an active booking with a plan', !!b);
const SOLD = 2585600;
const planTotal = async () => Number((await db.query(`SELECT total_amount_inr FROM payment_plans WHERE id = $1`, [b.plan_id])).rows[0].total_amount_inr);
const setup = async (rs, pct) => {
  await db.query(`UPDATE units SET carpet_area_sqft = 800, base_price_inr = 3232000 WHERE id = $1`, [b.unit_id]);
  await db.query(`UPDATE payment_plans SET total_amount_inr = $2 WHERE id = $1`, [b.plan_id, SOLD]);
  await db.query(`UPDATE booking_records SET basic_rate_inr_sqft = 4040, plc_amount = 0, other_charge_amount = 0, balcony_charge_amount = NULL, company_inaugural_disc = 0, approved_rebate_amount = 0,
      company_rebate_rs = $2, company_rebate_sqft = NULL, company_rebate_pct = $3, company_rebate_status = 'pending', rebate_requested_by = $4 WHERE id = $1`, [b.id, rs, pct, makerId]);
};
try {
  await setup(85600, null);
  let r = await post(checker, `/booking/${b.id}/rebate/approve`);
  ok('fixed rebate 85,600 approved (200)', r.s === 200 && Number(r.j.data?.approved_rebate_amount) === 85600, `status ${r.s} ${JSON.stringify(r.j).slice(0, 160)}`);
  ok('plan total = sold price less rebate (25,00,000), not the unit master price less rebate (31,46,400)', (await planTotal()) === SOLD - 85600, `got ${await planTotal()}`);

  await setup(null, 10);
  r = await post(checker, `/booking/${b.id}/rebate/approve`);
  ok('10% rebate is 10% of the SOLD basic (2,58,560), not of the unit master basic (3,23,200)', r.s === 200 && Number(r.j.data?.approved_rebate_amount) === 258560, `status ${r.s} amount ${r.j.data?.approved_rebate_amount}`);
  ok('plan total after the 10% rebate = 23,27,040', (await planTotal()) === SOLD - 258560, `got ${await planTotal()}`);

  // changing an approved rebate sends it back to pending and takes it out of the price again: the booking edit calls repriceBooking with the new amount 0
  // and the amount the plan total already has out. The sold price must come back exactly.
  await setup(85600, null);
  await post(checker, `/booking/${b.id}/rebate/approve`);
  await db.query(`UPDATE booking_records SET status = 'complete' WHERE id = $1`, [b.id]);
  ok('rebate 85,600 is in the plan (25,00,000) before the change', (await planTotal()) === SOLD - 85600, `got ${await planTotal()}`);
  const e = await fetch(`${BASE}/booking/${b.id}/edit`, { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: `Bearer ${checker}` }, body: JSON.stringify({ company_rebate_rs: 90000 }) });
  const ej = await e.json().catch(() => ({}));
  const st = (await db.query(`SELECT company_rebate_status, approved_rebate_amount FROM booking_records WHERE id = $1`, [b.id])).rows[0];
  ok('changing the rebate sends it back to pending', e.status === 200 && st.company_rebate_status === 'pending' && Number(st.approved_rebate_amount) === 0, `status ${e.status} ${JSON.stringify(ej).slice(0, 120)} ${JSON.stringify(st)}`);
  ok('the sold price (25,85,600) is back exactly, not the unit master price (32,32,000)', (await planTotal()) === SOLD, `got ${await planTotal()}`);
} finally {
  await db.query(`UPDATE units SET carpet_area_sqft = $2, base_price_inr = $3 WHERE id = $1`, [b.unit_id, b.u_carpet, b.u_price]);
  await db.query(`UPDATE payment_plans SET total_amount_inr = $2 WHERE id = $1`, [b.plan_id, b.plan_total]);
  await db.query(`UPDATE booking_records SET basic_rate_inr_sqft = $2, plc_amount = $3, other_charge_amount = $4, balcony_charge_amount = $5, company_inaugural_disc = $6, approved_rebate_amount = $7,
      company_rebate_rs = $8, company_rebate_sqft = $9, company_rebate_pct = $10, company_rebate_status = $11, rebate_requested_by = $12, status = $13 WHERE id = $1`,
    [b.id, b.basic_rate_inr_sqft, b.plc_amount, b.other_charge_amount, b.balcony_charge_amount, b.company_inaugural_disc, b.approved_rebate_amount, b.company_rebate_rs, b.company_rebate_sqft, b.company_rebate_pct, b.company_rebate_status, b.rebate_requested_by, b.status]);
}
await db.end();
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
