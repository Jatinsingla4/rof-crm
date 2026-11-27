// HTTP check for QA-013 / QA-017 / QA-023 / QA-024 / QA-025 on a THROWAWAY local database (setup: see db-cancelled-booking.check.mjs).
// Run: BASE=http://localhost:3097/api DB_NAME=rof_remed_b1 npx tsx test/http-reports-batch5.check.mjs      Tokens are never printed.
import pg from 'pg';
const BASE = process.env.BASE || 'http://localhost:3097/api';
const db = new pg.Pool({ host: 'localhost', user: 'postgres', password: process.env.DB_PASSWORD || 'postgres', database: process.env.DB_NAME || 'rof_remed_b1' });
let failed = 0;
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!cond) failed++; };
const login = async (email) => (await (await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Test#Pass1234' }) })).json()).token;
const get = async (tok, path) => { const r = await fetch(`${BASE}${path}`, { headers: { authorization: `Bearer ${tok}` } }); let j = {}; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const admin = await login('super_admin@test.local');
const liveC = (await db.query(`SELECT co.id consumer_id, pp.id plan_id, pp.unit_id, pp.project_id FROM payment_plans pp JOIN consumers co ON co.id = pp.consumer_id WHERE co.name <> 'Cancelled Cust' LIMIT 1`)).rows[0];
const cancC = (await db.query(`SELECT co.id consumer_id, pp.id plan_id FROM payment_plans pp JOIN consumers co ON co.id = pp.consumer_id WHERE co.name = 'Cancelled Cust'`)).rows[0];
const uid = (await db.query(`SELECT id FROM users WHERE email = 'accounts_finance@test.local'`)).rows[0].id;
const rcpt = (c, plan, amt, method) => db.query(`INSERT INTO receipts (consumer_id, payment_plan_id, amount_received_inr, received_date, status, payment_method, received_by_user_id, authorized_by, approval_status) VALUES ($1, $2, $3, current_date, 'cleared', $4, $5, $5, 'approved')`, [c, plan, amt, method, uid]);

// QA-017 / QA-024: read-only exception lists
await db.query(`UPDATE booking_records SET basic_rate_inr_sqft = NULL, status = 'active', registration_no = 'REG-FX-1' WHERE consumer_id = $1`, [liveC.consumer_id]);
await db.query(`UPDATE units SET status = 'available' WHERE id = $1`, [liveC.unit_id]);
let r = await get(admin, '/reports/booking-exceptions');
const d = r.j.data || {};
ok('booking exceptions: 200 with all six lists', r.s === 200 && ['zero_rate', 'zero_gst', 'unit_status_mismatch', 'awaiting_payment', 'duplicate_registrations', 'registrations_without_booking'].every((k) => Array.isArray(d[k])), `status ${r.s}`);
ok('a live booking with no rate is listed', (d.zero_rate || []).some((x) => x.registration_no === 'REG-FX-1'));
ok('an active booking whose unit says Available is listed', (d.unit_status_mismatch || []).some((x) => x.registration_no === 'REG-FX-1'));
ok('the cancelled booking is not listed as a live exception', !(d.zero_rate || []).some((x) => x.consumer_name === 'Cancelled Cust'));

// QA-013: cancelled-booking money and no-plan money are separate figures
await rcpt(cancC.consumer_id, cancC.plan_id, 3000, 'cheque');
await db.query(`INSERT INTO receipts (consumer_id, payment_plan_id, amount_received_inr, received_date, status, payment_method, received_by_user_id, authorized_by, approval_status) VALUES ($1, NULL, 700, current_date, 'cleared', 'cash', $2, $2, 'approved')`, [liveC.consumer_id, uid]);
r = await get(admin, '/reports/customer-balance');
const sm = r.j.summary || {};
ok('customer balance: cleared money of a cancelled booking is its own figure', r.s === 200 && Number(sm.receivedCancelled) >= 3000, JSON.stringify({ c: sm.receivedCancelled, n: sm.receivedNoPlan, o: sm.receivedOther }));
ok('customer balance: cleared money with no plan is its own figure', Number(sm.receivedNoPlan) >= 700);
ok('the three parts add up to the old combined figure', Math.abs(Number(sm.receivedNotInRows) - (Number(sm.receivedCancelled) + Number(sm.receivedNoPlan) + Number(sm.receivedOther))) < 0.01);

// QA-025: Cash column data
await rcpt(liveC.consumer_id, liveC.plan_id, 1234, 'cash');
r = await get(admin, '/reports/project-collection');
const fx = (r.j.data || []).find((x) => x.project_name === 'FX') || {};
ok('project collection carries cash_amount and it includes the cleared cash receipt', r.s === 200 && Number(fx.cash_amount) >= 1234 && Number(r.j.totals?.cash_amount) >= 1234, `cash ${fx.cash_amount}`);

// QA-023: a tower name shared by two projects is told apart when no project is chosen
await db.query(`INSERT INTO projects (name, rera_number, tcp_licence) SELECT 'FX2', 'R2', 'T2' WHERE NOT EXISTS (SELECT 1 FROM projects WHERE name = 'FX2')`);
await db.query(`INSERT INTO towers (project_id, tower_name) SELECT id, 'T' FROM projects WHERE name = 'FX2' AND NOT EXISTS (SELECT 1 FROM towers t WHERE t.project_id = projects.id)`);
r = await get(admin, '/units/towers');
const names = (r.j.data || []).map((t) => t.tower_name);
ok('towers with no project chosen: the shared name carries its project', r.s === 200 && names.includes('T (FX)') && names.includes('T (FX2)') && new Set(names).size === names.length, names.join(' | '));
r = await get(admin, `/units/towers?projectId=${liveC.project_id}`);
ok('towers of one project keep the plain name', (r.j.data || []).every((t) => t.tower_name === 'T') && (r.j.data || []).every((t) => t.name === t.tower_name), JSON.stringify((r.j.data || []).map((t) => t.tower_name)));
await db.end();
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
