// HTTP check for QA-009 / QA-010 / QA-011 on a THROWAWAY local database (setup: see db-cancelled-booking.check.mjs and http-cancelled-booking.check.mjs).
// Run: BASE=http://localhost:3097/api DB_NAME=rof_remed_b1 npx tsx test/http-security.check.mjs      Token values are never printed.
import pg from 'pg';
import jwt from 'jsonwebtoken';
const BASE = process.env.BASE || 'http://localhost:3097/api';
const ROOT = BASE.replace(/\/api$/, '');
const db = new pg.Pool({ host: 'localhost', user: 'postgres', password: process.env.DB_PASSWORD || 'postgres', database: process.env.DB_NAME || 'rof_remed_b1' });
let failed = 0;
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!cond) failed++; };
const login = async (email) => (await (await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Test#Pass1234' }) })).json()).token;
const call = async (tok, method, path, body, raw = false) => { const r = await fetch(`${raw ? ROOT : BASE}${path}`, { method, headers: { 'content-type': 'application/json', ...(tok ? { authorization: `Bearer ${tok}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); let j = {}; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const get = async (url) => (await fetch(`${ROOT}${url}`)).status;
const maker = await login('accounts_finance@test.local'), admin = await login('super_admin@test.local');
const live = (await db.query(`SELECT co.id consumer_id FROM payment_plans pp JOIN consumers co ON co.id = pp.consumer_id WHERE co.name <> 'Cancelled Cust' LIMIT 1`)).rows[0];
const page = `/api/consumers/${live.consumer_id}/applicant-file`;

// ---- QA-011: what may sit in a web address
ok('the login token in a URL is refused (401)', (await get(`${page}?token=${admin}`)) === 401);
const lt = (await call(admin, 'POST', '/auth/link-token', { path: page })).j.token;
const claims = jwt.decode(lt) || {};
ok('a link token carries only user id, session version, purpose and its one path (no email, name, role)', ['userId', 'tv', 'purpose', 'p', 'iat', 'exp'].every((k) => k in claims) && !('email' in claims) && !('role' in claims) && !('name' in claims) && !('permissions' in claims), Object.keys(claims).join(','));
ok('its life is 60 seconds', claims.exp - claims.iat === 60, `${claims.exp - claims.iat}s`);
ok('a link token opens its own page (200)', (await get(`${page}?token=${lt}`)) === 200);
ok('the same link token does not open another page (401)', (await get(`/api/consumers?token=${lt}`)) === 401);
ok('a link token is not accepted as a login token in the Authorization header (401)', (await call(lt, 'GET', '/consumers')).s === 401);
const lt2 = (await call(admin, 'POST', '/auth/link-token', { path: page })).j.token;
await db.query(`UPDATE users SET token_version = COALESCE(token_version, 0) + 1 WHERE email = 'super_admin@test.local'`);
await new Promise((r) => setTimeout(r, 16000));   // the user lookup is cached for up to 15 seconds (AUTH_CACHE_MS), so revocation takes effect within 15 s
ok('after the session is invalidated (token_version bump) the link token stops working (401)', (await get(`${page}?token=${lt2}`)) === 401);
const admin2 = await login('super_admin@test.local');

// ---- QA-010: approvals cannot be bypassed by calling the API
await db.query(`INSERT INTO user_process_permissions (user_id, process_name, is_maker) SELECT id, 'receipt', true FROM users WHERE email = 'accounts_finance@test.local' ON CONFLICT (user_id, process_name) DO UPDATE SET is_maker = true, is_checker = false`);
const mk = await call(maker, 'POST', '/payments/receipts', { consumerId: live.consumer_id, amountReceivedInr: 700, paymentMode: 'cash' });
const rid = mk.j?.data?.id;
ok('control: the maker recorded a receipt', mk.s === 201 && !!rid, `status ${mk.s} ${mk.s >= 400 ? JSON.stringify(mk.j).slice(0, 80) : ''}`);
let r = await call(maker, 'PATCH', `/payments/receipts/${rid}/approve`);
ok('a maker-only login cannot approve (403)', r.s === 403, `status ${r.s}`);
const own = await call(admin2, 'POST', '/payments/receipts', { consumerId: live.consumer_id, amountReceivedInr: 800, paymentMode: 'cash' });
r = await call(admin2, 'PATCH', `/payments/receipts/${own.j?.data?.id}/approve`);
ok('a super admin cannot approve their own receipt (self-approval refused)', own.s === 201 && (r.s === 403 || r.s === 409), `status ${own.s}/${r.s} ${msgOf(r)}`);
function msgOf(x) { return String(x.j.error || x.j.message || '').slice(0, 70); }
const fake = '00000000-0000-4000-8000-000000000001';
const routes = [['PATCH', `/payments/interest-waivers/${fake}/approve`], ['PATCH', `/payments/refunds/${fake}/approve`], ['POST', `/payments/credit-allocations/${fake}/approve`],
  ['POST', `/payments/receipt-returns/${fake}/approve`], ['PATCH', `/payments/journals/${fake}/approve`], ['PATCH', `/payments/credit-debit-notes/${fake}/approve`], ['PATCH', `/brokers/${fake}/approve`]];
await db.query(`DELETE FROM user_process_permissions WHERE user_id = (SELECT id FROM users WHERE email = 'read_only_viewer@test.local')`);
const viewer = await login('read_only_viewer@test.local');
for (const [m, p] of routes) { const x = await call(viewer, m, p, {}); ok(`no process rights: ${m} ${p.replace(fake, ':id')} refused`, x.s === 403 || x.s === 401, `status ${x.s}`); }

// ---- QA-009: the commission list shows what backs a Paid status
const brk = (await db.query(`INSERT INTO brokers (name, mobile, status) VALUES ('FX Broker', '9' || lpad((floor(random()*1e9))::text, 9, '0'), 'active') RETURNING id`)).rows[0].id;
const bkg = (await db.query(`SELECT id FROM booking_records WHERE consumer_id = $1 AND status <> 'cancelled' LIMIT 1`, [live.consumer_id])).rows[0].id;
await db.query(`UPDATE booking_records SET booking_amount = 99999999 WHERE id = $1`, [bkg]);
await db.query(`INSERT INTO broker_commissions (broker_id, consumer_id, booking_id, commission_amount_inr, status) VALUES ($1, $2, $3, 1000, 'paid')`, [brk, live.consumer_id, bkg]);
r = await call(admin2, 'GET', `/brokers/commission?brokerId=${brk}`);
const row = (r.j.data || [])[0];
ok('a Paid commission with no cleared money behind it is flagged (cleared_basis_ok false)', r.s === 200 && row?.status === 'paid' && row.cleared_basis_ok === false, `status ${r.s}`);
await db.query(`DELETE FROM broker_commissions WHERE broker_id = $1`, [brk]);
await db.end();
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
