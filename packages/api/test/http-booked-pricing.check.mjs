// HTTP + DB check for QA-001 / 005 / 030 / 032: a booking is priced from its plan (what was sold), not from the CURRENT unit master.
// THROWAWAY local database only. Run: BASE=http://localhost:3098/api DB_NAME=rof_remed_regress npx tsx test/http-booked-pricing.check.mjs
import pg from 'pg';
const BASE = process.env.BASE || 'http://localhost:3098/api';
const db = new pg.Pool({ host: 'localhost', user: 'postgres', password: process.env.DB_PASSWORD || 'postgres', database: process.env.DB_NAME || 'rof_remed_regress' });
let failed = 0;
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!cond) failed++; };
const login = async (email) => (await (await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Test#Pass1234' }) })).json()).token;
const get = async (tok, path) => { const r = await fetch(`${BASE}${path}`, { headers: { authorization: `Bearer ${tok}` } }); let j = {}; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const tok = await login('super_admin@test.local');

// The Sh Tester case: the unit master says 800 sq ft at Rs 4,040 (Rs 32,32,000) but the booking was sold, and its plan cut, at Rs 25,85,600 (640 sq ft).
// The fixture booking is set to that state and restored afterwards. Expected figures come from the stored plan, never from the unit.
const b = (await db.query(`SELECT br.id AS booking_id, br.consumer_id, c.registration_no, u.id AS unit_id, pp.id AS plan_id,
       br.plc_amount, br.other_charge_amount, br.basic_rate_inr_sqft, br.balcony_charge_amount, br.company_inaugural_disc, br.approved_rebate_amount, br.dealer_adjustment_amount,
       u.carpet_area_sqft, u.base_price_inr, pp.total_amount_inr
    FROM booking_records br JOIN payment_plans pp ON pp.consumer_id = br.consumer_id AND pp.unit_id = br.unit_id
    JOIN consumers c ON c.id = br.consumer_id JOIN units u ON u.id = br.unit_id WHERE br.status = 'active' LIMIT 1`)).rows[0];
ok('fixture has an active booking with a plan', !!b);
const SOLD = 2585600, UNIT_AREA = 800, RATE = 4040;
await db.query(`UPDATE units SET carpet_area_sqft = $2, base_price_inr = $3 WHERE id = $1`, [b.unit_id, UNIT_AREA, UNIT_AREA * RATE]);
await db.query(`UPDATE booking_records SET basic_rate_inr_sqft = $2, plc_amount = 0, other_charge_amount = 0, balcony_charge_amount = NULL, company_inaugural_disc = 0, approved_rebate_amount = 0, dealer_adjustment_amount = 0 WHERE id = $1`, [b.booking_id, RATE]);
await db.query(`UPDATE payment_plans SET total_amount_inr = $2 WHERE id = $1`, [b.plan_id, SOLD]);
let last = {};
const rowOf = async () => { last = await get(tok, '/reports/customer-due-summary'); return last.j.data?.find((x) => x.consumer_id === b.consumer_id); };
const card = async () => (await get(tok, `/consumers/${b.consumer_id}`)).j.data;
try {
  const row = await rowOf();
  ok('report net basic is the sold price (25,85,600), not rate x unit area (32,32,000)', Number(row?.net_basic_price) === SOLD, `got ${row?.net_basic_price} (http ${last.s}, ${last.j.data?.length} rows, ${JSON.stringify(last.j).slice(0, 150)})`);
  ok('report total unit cost follows the plan', Number(row?.total_unit_cost) === SOLD, `got ${row?.total_unit_cost}`);
  ok('pricing card basic is the sold price', Number((await card())?.booked_basic_inr) === SOLD, `got ${(await card())?.booked_basic_inr}`);

  // the unit is re-measured and re-priced afterwards: nothing about the booked price may move
  await db.query(`UPDATE units SET carpet_area_sqft = $2, base_price_inr = $3 WHERE id = $1`, [b.unit_id, UNIT_AREA * 1.25, UNIT_AREA * RATE * 1.25]);
  ok('after the unit master changes: report net basic unchanged', Number((await rowOf())?.net_basic_price) === SOLD);
  ok('after the unit master changes: pricing card unchanged', Number((await card())?.booked_basic_inr) === SOLD);

  // plc is taken out of the plan total and the discount (already out of the plan) is added back for the gross basic
  await db.query(`UPDATE booking_records SET plc_amount = 100000, company_inaugural_disc = 50000 WHERE id = $1`, [b.booking_id]);
  const r2 = await rowOf();
  ok('plc 1,00,000 and discount 50,000: net basic = plan - plc (the plan already has discount and rebate out)', Number(r2?.net_basic_price) === SOLD - 100000, `got ${r2?.net_basic_price}`);
  ok('pricing card gross basic = plan - plc + discount', Number((await card())?.booked_basic_inr) === SOLD - 100000 + 50000, `got ${(await card())?.booked_basic_inr}`);
} finally {
  await db.query(`UPDATE units SET carpet_area_sqft = $2, base_price_inr = $3 WHERE id = $1`, [b.unit_id, b.carpet_area_sqft, b.base_price_inr]);
  await db.query(`UPDATE booking_records SET basic_rate_inr_sqft = $2, plc_amount = $3, other_charge_amount = $4, balcony_charge_amount = $5, company_inaugural_disc = $6, approved_rebate_amount = $7, dealer_adjustment_amount = $8 WHERE id = $1`,
    [b.booking_id, b.basic_rate_inr_sqft, b.plc_amount, b.other_charge_amount, b.balcony_charge_amount, b.company_inaugural_disc, b.approved_rebate_amount, b.dealer_adjustment_amount]);
  await db.query(`UPDATE payment_plans SET total_amount_inr = $2 WHERE id = $1`, [b.plan_id, b.total_amount_inr]);
}
await db.end();
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
