// HTTP + DB check for QA-026 / QA-038: GET /payments/overdue shows the unpaid balance and the engine's interest, not the whole instalment x days.
// Dup Mobile shape: instalment 5,14,000 due 20 days ago, 5,00,000 cleared on the due date. THROWAWAY local database only.
// Run: BASE=http://localhost:3098/api DB_NAME=rof_remed_regress npx tsx test/http-overdue-interest.check.mjs
import pg from 'pg';
const BASE = process.env.BASE || 'http://localhost:3098/api';
const db = new pg.Pool({ host: 'localhost', user: 'postgres', password: process.env.DB_PASSWORD || 'postgres', database: process.env.DB_NAME || 'rof_remed_regress' });
let failed = 0;
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!cond) failed++; };
const login = async (email) => (await (await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Test#Pass1234' }) })).json()).token;
const get = async (tok, path) => { const r = await fetch(`${BASE}${path}`, { headers: { authorization: `Bearer ${tok}` } }); let j = {}; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const tok = await login('super_admin@test.local');
const makerId = (await db.query(`SELECT id FROM users WHERE email = 'accounts_finance@test.local'`)).rows[0].id;
const b = (await db.query(`SELECT br.consumer_id, br.unit_id, pp.id AS plan_id FROM booking_records br JOIN payment_plans pp ON pp.consumer_id = br.consumer_id AND pp.unit_id = br.unit_id WHERE br.status = 'active' LIMIT 1`)).rows[0];
const today = (await db.query(`SELECT (NOW() AT TIME ZONE 'Asia/Kolkata')::date::text AS d`)).rows[0].d;
const due = (await db.query(`SELECT ($1::date - 20)::text AS d`, [today])).rows[0].d;
const rate = Number((await db.query(`SELECT value FROM global_settings WHERE key = 'penal_interest_rate_percent'`)).rows[0]?.value ?? 15);
const grace = Number((await db.query(`SELECT COALESCE(grace_period_days, 0) AS g FROM consumers WHERE id = $1`, [b.consumer_id])).rows[0].g);

// other demands of this plan are put aside while the test runs, so the receipt below can only settle the test demand
const others = (await db.query(`SELECT id, status FROM demands WHERE payment_plan_id = $1`, [b.plan_id])).rows;
await db.query(`UPDATE demands SET status = 'cancelled' WHERE payment_plan_id = $1`, [b.plan_id]);
let dId = null, rId = null;
try {
  dId = (await db.query(`INSERT INTO demands (payment_plan_id, installment_index, consumer_id, due_date, amount_due_inr, cgst_amount, sgst_amount, status, demand_type, raised_at)
    VALUES ($1, 98, $2, $3, 514000, 0, 0, 'demanded', 'installment', NOW() - interval '25 days') RETURNING id`, [b.plan_id, b.consumer_id, due])).rows[0].id;
  rId = (await db.query(`INSERT INTO receipts (consumer_id, payment_plan_id, demand_id, installment_index, amount_received_inr, received_date, clearing_date, status, approval_status, payment_method, received_by_user_id)
    VALUES ($1, $2, $3, 98, 500000, $4, $4, 'cleared', 'approved', 'neft', $5) RETURNING id`, [b.consumer_id, b.plan_id, dId, due, makerId])).rows[0].id;

  const r = await get(tok, '/payments/overdue');
  const row = (r.j.data || []).find((x) => x.id === dId);
  ok('the instalment is on the overdue list', r.s === 200 && !!row, `status ${r.s}, ${(r.j.data || []).length} rows`);
  const lateDays = 20 - grace;
  const expected = Math.round((14000 * rate / 100 / 365) * lateDays * 100) / 100;
  const whole = Math.round((514000 * rate / 100 / 365) * 20 * 100) / 100;
  ok('principal shown is the 14,000 still unpaid, not the 5,14,000 instalment', Number(row?.amount_due_inr) === 14000 && Number(row?.instalment_total_inr) === 514000 && Number(row?.amount_paid_inr) === 500000, JSON.stringify(row));
  ok(`interest is on the 14,000 for ${lateDays} days at ${rate}% (${expected}), not on the whole instalment (${whole})`, Math.abs(Number(row?.penal_interest_inr) - expected) <= 0.01 && Number(row?.penal_interest_inr) !== whole, `got ${row?.penal_interest_inr}`);
  ok('days overdue is counted from the due date', Number(row?.days_overdue) === 20, `got ${row?.days_overdue}`);

  // fully paid: the instalment leaves the list
  await db.query(`UPDATE receipts SET amount_received_inr = 514000 WHERE id = $1`, [rId]);
  const r2 = await get(tok, '/payments/overdue');
  ok('fully paid: no longer overdue', !(r2.j.data || []).some((x) => x.id === dId));
  const bad = await get(tok, '/payments/overdue?projectId=not-a-uuid');
  ok('a bad projectId is refused (400)', bad.s === 400, `status ${bad.s}`);
} finally {
  if (rId) await db.query(`DELETE FROM receipts WHERE id = $1`, [rId]);
  if (dId) await db.query(`DELETE FROM demands WHERE id = $1`, [dId]);
  for (const o of others) await db.query(`UPDATE demands SET status = $2 WHERE id = $1`, [o.id, o.status]);
}
await db.end();
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
