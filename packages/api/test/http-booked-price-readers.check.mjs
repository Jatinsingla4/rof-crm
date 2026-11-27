// HTTP + DB check for QA-001 / 005 / 030 / 032 (the other readers of the price): the receipt form, the booking edit checks and the surrender page
// read the price a booking was SOLD at (its plan), not the unit master. Sh Tester shape: unit master 800 sq ft x 4040 = 32,32,000, sold and billed at 25,85,600.
// THROWAWAY local database only. Run: BASE=http://localhost:3098/api DB_NAME=rof_remed_regress npx tsx test/http-booked-price-readers.check.mjs
import pg from 'pg';
const BASE = process.env.BASE || 'http://localhost:3098/api';
const db = new pg.Pool({ host: 'localhost', user: 'postgres', password: process.env.DB_PASSWORD || 'postgres', database: process.env.DB_NAME || 'rof_remed_regress' });
let failed = 0;
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!cond) failed++; };
const login = async (email) => (await (await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Test#Pass1234' }) })).json()).token;
const call = async (tok, method, path, body) => { const r = await fetch(`${BASE}${path}`, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${tok}` }, body: body ? JSON.stringify(body) : undefined }); const text = await r.text(); let j = {}; try { j = JSON.parse(text); } catch {} return { s: r.status, j, text }; };
const tok = await login('super_admin@test.local');
const makerId = (await db.query(`SELECT id FROM users WHERE email = 'accounts_finance@test.local'`)).rows[0].id;
const b = (await db.query(`SELECT br.*, pp.id AS plan_id, pp.total_amount_inr AS plan_total, u.carpet_area_sqft AS u_carpet, u.base_price_inr AS u_price
    FROM booking_records br JOIN payment_plans pp ON pp.consumer_id = br.consumer_id AND pp.unit_id = br.unit_id JOIN units u ON u.id = br.unit_id WHERE br.status = 'active' LIMIT 1`)).rows[0];
ok('fixture has an active booking with a plan', !!b);
const SOLD = 2585600;
let rid = null;
try {
  await db.query(`UPDATE units SET carpet_area_sqft = 800, base_price_inr = 3232000 WHERE id = $1`, [b.unit_id]);
  await db.query(`UPDATE payment_plans SET total_amount_inr = $2 WHERE id = $1`, [b.plan_id, SOLD]);
  await db.query(`UPDATE booking_records SET basic_rate_inr_sqft = 4040, plc_amount = 0, other_charge_amount = 0, balcony_charge_amount = NULL, company_inaugural_disc = 0, approved_rebate_amount = 0, dealer_adjustment_amount = 0 WHERE id = $1`, [b.id]);
  rid = (await db.query(`INSERT INTO receipts (consumer_id, payment_plan_id, amount_received_inr, received_date, clearing_date, status, approval_status, payment_method, received_by_user_id)
    VALUES ($1, $2, 10000, current_date, current_date, 'cleared', 'approved', 'neft', $3) RETURNING id`, [b.consumer_id, b.plan_id, makerId])).rows[0].id;

  // receipt form: the booked price
  let r = await call(tok, 'GET', `/payments/receipt-form/${b.consumer_id}`);
  const form = r.text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  ok('receipt form: Unit Cost is the sold price 25,85,600, and no 32,32,000 anywhere on the page', r.s === 200 && /Unit Cost:?\s*25,85,600/.test(form) && !/32,32,000|3,232,000/.test(form), `status ${r.s} ${(form.match(/Unit Cost[\s\S]{0,60}/) || [form.slice(0, 120)])[0]}`);

  // booking edit: a discount is checked against the basic price of the BOOKED area (640 sq ft = 25,85,600), not the unit's current 800 (32,32,000)
  r = await call(tok, 'PATCH', `/booking/${b.id}/edit`, { company_inaugural_disc: 3000000 });
  ok('discount 30,00,000 on a booking sold at 25,85,600: refused (400)', r.s === 400 && /more than the basic price/i.test(r.text), `status ${r.s} ${r.text.slice(0, 140)}`);
  r = await call(tok, 'PATCH', `/booking/${b.id}/edit`, { company_inaugural_disc: 100000 });
  ok('a discount inside the booked basic price is accepted (200)', r.s === 200, `status ${r.s} ${r.text.slice(0, 140)}`);

  // surrender: the price on the page
  r = await call(tok, 'GET', `/surrender/detail/${b.consumer_id}`);
  const sd = JSON.stringify(r.j);
  ok('surrender page prices the booking from its plan (no 32,32,000 anywhere)', r.s === 200 && /2585600|25,85,600/.test(sd) && !/3232000|32,32,000/.test(sd), `status ${r.s} ${sd.slice(0, 160)}`);
} finally {
  if (rid) await db.query(`DELETE FROM receipts WHERE id = $1`, [rid]);
  await db.query(`UPDATE units SET carpet_area_sqft = $2, base_price_inr = $3 WHERE id = $1`, [b.unit_id, b.u_carpet, b.u_price]);
  await db.query(`UPDATE payment_plans SET total_amount_inr = $2 WHERE id = $1`, [b.plan_id, b.plan_total]);
  await db.query(`UPDATE booking_records SET basic_rate_inr_sqft = $2, plc_amount = $3, other_charge_amount = $4, balcony_charge_amount = $5, company_inaugural_disc = $6, approved_rebate_amount = $7, dealer_adjustment_amount = $8 WHERE id = $1`,
    [b.id, b.basic_rate_inr_sqft, b.plc_amount, b.other_charge_amount, b.balcony_charge_amount, b.company_inaugural_disc, b.approved_rebate_amount, b.dealer_adjustment_amount]);
}
await db.end();
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
