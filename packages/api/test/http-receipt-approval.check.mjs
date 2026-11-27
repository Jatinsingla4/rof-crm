// HTTP + DB check for QA-010 / QA-036 / QA-042 on a THROWAWAY local database: a receipt can become 'cleared' only after a checker approved it,
// through the API and also through direct SQL (database trigger from migration 153). Separate maker and checker accounts.
// Run: BASE=http://localhost:3098/api DB_NAME=rof_remed_regress npx tsx test/http-receipt-approval.check.mjs
import pg from 'pg';
const BASE = process.env.BASE || 'http://localhost:3098/api';
const db = new pg.Pool({ host: 'localhost', user: 'postgres', password: process.env.DB_PASSWORD || 'postgres', database: process.env.DB_NAME || 'rof_remed_regress' });
let failed = 0;
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!cond) failed++; };
const login = async (email) => (await (await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Test#Pass1234' }) })).json()).token;
const call = async (tok, method, path, body) => { const r = await fetch(`${BASE}${path}`, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${tok}` }, body: body ? JSON.stringify(body) : undefined }); let j = {}; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const msg = (r) => String(r.j.error || r.j.message || '');
const checker = await login('super_admin@test.local');
const makerId = (await db.query(`SELECT id FROM users WHERE email = 'accounts_finance@test.local'`)).rows[0].id;
const checkerId = (await db.query(`SELECT id FROM users WHERE email = 'super_admin@test.local'`)).rows[0].id;
const live = (await db.query(`SELECT co.id consumer_id, pp.id plan_id FROM payment_plans pp JOIN consumers co ON co.id = pp.consumer_id WHERE co.name <> 'Cancelled Cust' LIMIT 1`)).rows[0];
const mk = async (status, approval, authorizedBy = null, maker = makerId) => (await db.query(
  `INSERT INTO receipts (consumer_id, payment_plan_id, amount_received_inr, received_date, status, payment_method, received_by_user_id, authorized_by, approval_status)
   VALUES ($1, $2, 777, current_date, $3, 'cheque', $4, $5, $6) RETURNING id`, [live.consumer_id, live.plan_id, status, maker, authorizedBy, approval])).rows[0].id;
const fails = async (sql, params) => { try { await db.query(sql, params); return null; } catch (e) { return String(e.message); } };

// database level: the trigger refuses every way of creating cleared money without approval
let e = await fails(`INSERT INTO receipts (consumer_id, payment_plan_id, amount_received_inr, received_date, status, payment_method, received_by_user_id, approval_status) VALUES ($1, $2, 1, current_date, 'cleared', 'cheque', $3, 'pending')`, [live.consumer_id, live.plan_id, makerId]);
ok('SQL insert as cleared without approval: refused by the database', !!e && /approved it/.test(e), e || 'accepted');
const pend = await mk('pending', 'pending');
e = await fails(`UPDATE receipts SET status = 'cleared' WHERE id = $1`, [pend]);
ok('SQL update to cleared without approval: refused by the database', !!e && /approved it/.test(e), e || 'accepted');
e = await fails(`UPDATE receipts SET status = 'cleared' WHERE id = $1`, [await mk('authorized', 'rejected', checkerId)]);
ok('SQL update to cleared on a rejected receipt: refused', !!e);
e = await fails(`UPDATE receipts SET status = 'cleared' WHERE id = $1`, [await mk('authorized', 'approved', checkerId)]);
ok('SQL update to cleared on an approved receipt: allowed', e === null, e || '');

// API level: legacy state (authorized_by set, approval_status still pending) can no longer be cleared
const legacy = await mk('authorized', 'pending', checkerId);
let r = await call(checker, 'PATCH', `/payments/receipts/${legacy}/clear`, { clearing_date: new Date().toISOString().slice(0, 10) });
ok('clear with authorized_by set but not approved: refused (409)', r.s === 409 && /authorized/i.test(msg(r)), `status ${r.s} ${msg(r)}`);
ok('that receipt is still not cleared', (await db.query(`SELECT status FROM receipts WHERE id = $1`, [legacy])).rows[0].status === 'authorized');

// the normal lifecycle, one maker and a different checker
const fresh = await mk('pending', 'pending');
r = await call(checker, 'PATCH', `/payments/receipts/${fresh}/clear`, { clearing_date: new Date().toISOString().slice(0, 10) });
ok('pending receipt cannot be cleared directly (refused, still pending)', r.s >= 400 && (await db.query(`SELECT status FROM receipts WHERE id = $1`, [fresh])).rows[0].status === 'pending', `status ${r.s} ${msg(r)}`);
r = await call(checker, 'PATCH', `/payments/receipts/${fresh}/approve`, {});
ok('a different checker approves it', r.s === 200, `status ${r.s} ${msg(r)}`);
const row = (await db.query(`SELECT status, approval_status FROM receipts WHERE id = $1`, [fresh])).rows[0];
ok('approve sets authorized and approved together', row.status === 'authorized' && row.approval_status === 'approved', JSON.stringify(row));
r = await call(checker, 'PATCH', `/payments/receipts/${fresh}/clear`, { clearing_date: new Date().toISOString().slice(0, 10) });
ok('the approved receipt clears', r.s === 200 && r.j.data?.status === 'cleared', `status ${r.s} ${msg(r)}`);

// maker = checker is refused
const own = await mk('pending', 'pending', null, checkerId);
r = await call(checker, 'PATCH', `/payments/receipts/${own}/approve`, {});
ok('a checker cannot approve a receipt they recorded themselves', r.s === 403 || r.s === 409, `status ${r.s} ${msg(r)}`);

await db.query(`DELETE FROM receipts WHERE amount_received_inr = 777 AND received_by_user_id IN ($1, $2)`, [makerId, checkerId]).catch(() => {});
await db.end();
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
