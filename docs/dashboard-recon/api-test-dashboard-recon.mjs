// Dashboard panels, bank reconciliation, construction milestones.
// Numbers are checked against data this script builds itself (per project, so other data in the database does not matter), roles, hostile input, project scope, races, a random run.
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-dashboard-recon.mjs   (psql must reach the same database; SEED=n repeats the random run)
import { execFileSync } from 'node:child_process';
const B = process.env.BASE || 'http://localhost:3010/api';
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300))); };
const post = async (p, b) => { const r = await fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => null) }; };
const login = async (email, password = 'Test#Pass1234') => (await post('/auth/login', { email, password })).j?.token;
const call = (tok) => async (m, p, b, raw) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: raw ?? (b === undefined ? undefined : JSON.stringify(b)) }); return { s: r.status, j: await r.json().catch(() => null) }; };
const A = call(await login('super_admin@test.local')), PM = call(await login('project_manager@test.local')), SE = call(await login('sales_executive@test.local'));
const AF = call(await login('accounts_finance@test.local')), RO = call(await login('read_only_viewer@test.local')), SA = call(await login('support_agent@test.local')), NO = call(null);
const psql = (sql) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim().split('\n')[0];
const SEED = Number(process.env.SEED || Date.now() % 1e9); let rs = SEED;
const rnd = () => (rs = (rs * 1664525 + 1013904223) % 4294967296) / 4294967296, ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)), pick = (a) => a[ri(0, a.length - 1)];
console.log('SEED=' + SEED);
const U = Date.now().toString(36).slice(-5), NIL = '00000000-0000-0000-0000-000000000000';
const par = (n, f) => Promise.all(Array.from({ length: n }, (_, i) => f(i)));
const no5 = (xs) => xs.every((x) => x.s < 500);
let seq = 0; const mob = () => '9' + String((Date.now() % 1e7) * 100 + ++seq + 100000000).slice(-9).padStart(9, '0');
const ist = (off = 0) => psql(`select ((now() at time zone 'Asia/Kolkata')::date + ${off})::text`);
const TODAY = ist(0);
let r;

// ---------- set-up: two projects, scoped logins ----------
const co = (await A('POST', '/companies', { name: 'DR Co ' + U })).j.data.id;
const mkProj = async (tag) => (await A('POST', '/projects', { companyId: co, name: `Dr ${tag} ${U}`, reraNumber: `DR${tag}-${U}`, tcpLicence: 'x' })).j.data.id;
const P1 = await mkProj('A'), P2 = await mkProj('B');
const tower = async (P) => (await A('POST', `/projects/${P}/towers`, { towerName: 'T' + U })).j.data.id;
const T1 = await tower(P1), T2 = await tower(P2);
const PW = 'Dr#Pass' + U.replace(/\D/g, '') + '1';
const newUser = async (tag, role, projectIds) => { const email = `dr.${tag}.${U}@example.com`; const x = await A('POST', '/users/employee-login', { username: `dr_${tag}_${U}`, email, password: PW, confirmPassword: PW, role, assignedProjectIds: projectIds }); return { id: x.j?.data?.userId, call: call(await login(email, PW)) }; };
const sales1 = await newUser('s1', 'sales_executive', [P1]), sales2 = await newUser('s2', 'sales_executive', [P2]);
const fin1 = await newUser('f1', 'accounts_finance', [P1]), fin2 = await newUser('f2', 'accounts_finance', [P2]);
const pm1 = await newUser('m1', 'project_manager', [P1]), pm2 = await newUser('m2', 'project_manager', [P2]);
t('setup: projects and scoped logins exist', !!(P1 && P2 && sales1.id && sales2.id && fin1.id && fin2.id && pm1.id && pm2.id));
const NAMES = { sales1: psql(`select name from users where id='${sales1.id}'`) };

// A customer with a unit, an allocation, a plan; extra pieces on request
const mk = (P, T, tag, o = {}) => {
  const c = psql(`INSERT INTO consumers (name, mobile, email, project_id) VALUES ('Dr ${tag} ${U}', ${o.mobile === null ? "''" : o.mobile === 'blank' ? "'   '" : `'${mob()}'`}, ${o.email === null ? 'NULL' : `'dr.${tag}.${U}@example.com'`}, '${P}') RETURNING id`);
  const u = psql(`INSERT INTO units (project_id, tower_id, unit_number, status, bhk_type, floor, carpet_area_sqft) VALUES ('${P}', '${T}', '${tag}-${U}', 'allotted', '2BHK', 1, 800) RETURNING id`);
  const al = psql(`INSERT INTO allocations (consumer_id, unit_id, project_id, status) VALUES ('${c}','${u}','${P}','${o.alloc || 'allotted'}') RETURNING id`);
  const pp = psql(`INSERT INTO payment_plans (allocation_id, consumer_id, unit_id, project_id, total_amount_inr) VALUES ('${al}','${c}','${u}','${P}', 1000000) RETURNING id`);
  if (o.booking) psql(`INSERT INTO booking_records (consumer_id, unit_id, project_id, selected_plan_name, status, booking_date) VALUES ('${c}','${u}','${P}','DR ${U}','${o.booking}', ${o.bdate ? `'${o.bdate}'` : 'NULL'}) RETURNING id`);
  return { c, u, al, pp };
};
const dem = (f, idx, status, amount, due, o = {}) => psql(`INSERT INTO demands (payment_plan_id, installment_index, consumer_id, amount_due_inr, status, delivery_status, due_date, cgst_amount, sgst_amount) VALUES ('${f.pp}', ${idx}, '${f.c}', ${amount}, '${status}', '${o.delivery || 'pending'}', ${due ? `'${due}'` : 'NULL'}, ${o.tax || 0}, ${o.tax || 0}) RETURNING id`);
const rec = (f, amount, method, status, date = TODAY, ref = null) => psql(`INSERT INTO receipts (consumer_id, payment_plan_id, amount_received_inr, payment_method, status, received_date, transaction_ref) VALUES ('${f.c}','${f.pp}',${amount},'${method}','${status}','${date}', ${ref ? `'${ref}'` : 'NULL'}) RETURNING id`);

// ================= DASHBOARD =================
const C1 = mk(P1, T1, 'c1', { booking: 'complete', bdate: TODAY }), C4 = mk(P1, T1, 'c4', { booking: 'active', bdate: ist(-3) });
const C2 = mk(P1, T1, 'c2', { booking: 'cancelled', bdate: TODAY }), C3 = mk(P1, T1, 'c3', { booking: 'draft', bdate: TODAY });
// raised demands of C1: due today (sent, with tax), due in 3 days, overdue; and some that must not count
dem(C1, 1, 'demanded', 10000, TODAY, { delivery: 'sent', tax: 900 }); dem(C1, 2, 'demanded', 20000, ist(3)); dem(C1, 3, 'raised', 30000, ist(-1));
dem(C1, 4, 'pending', 99000, null); dem(C1, 5, 'cancelled', 88000, ist(1)); dem(C1, 6, 'paid', 77000, ist(1), { delivery: 'paid' });
dem(C4, 1, 'demanded', 5000, ist(10)); dem(C4, 5, 'demanded', 6000, ist(20));
// receipts of C1: cleared today and yesterday, in-flight cheques, a draft, and the ones that must not count
rec(C1, 5000, 'cash', 'cleared'); rec(C1, 7000, 'cash', 'cleared', ist(-1)); rec(C1, 100, 'cheque', 'cleared');
rec(C1, 3000, 'cheque', 'pending'); rec(C1, 4000, 'cheque', 'deposited'); rec(C1, 600, 'cheque', 'on_hold'); rec(C1, 2500, 'demand_draft', 'pending'); rec(C1, 1234, 'cash', 'pending');
rec(C1, 999, 'cheque', 'cancelled'); rec(C1, 888, 'cheque', 'bounced');
rec(C2, 9999, 'cash', 'cleared');            // the booking is cancelled: not collection
// parking, tasks
for (const [n, st] of [['1', 'allotted'], ['2', 'available'], ['3', 'available']]) psql(`INSERT INTO parking_slots (project_id, slot_number, parking_type, status${st === 'allotted' ? ', allotted_to_consumer_id' : ''}) VALUES ('${P1}', 'S${n}-${U}', 'covered', '${st}'${st === 'allotted' ? `, '${C1.c}'` : ''}) RETURNING id`);
psql(`INSERT INTO tasks (title, status, due_date, assigned_to) VALUES ('Dr overdue ${U}', 'pending', '${ist(-2)}', '${sales1.id}') RETURNING id`);
psql(`INSERT INTO tasks (title, status, due_date, assigned_to) VALUES ('Dr later ${U}', 'pending', '${ist(5)}', '${sales1.id}') RETURNING id`);
psql(`INSERT INTO tasks (title, status, due_date, assigned_to) VALUES ('Dr done ${U}', 'completed', '${ist(-5)}', '${sales1.id}') RETURNING id`);

const PATHS = ['pending-cheques', 'demand-status', 'pending-approval', 'daily-status', 'parking-detail', 'forthcoming-due', 'employee-tickets', 'summary'];
for (const [who, f] of [['viewer', RO], ['support', SA], ['sales', SE], ['pm', PM], ['accounts', AF], ['admin', A]]) for (const p of PATHS) { r = await f('GET', '/dashboard/' + p); if (r.s !== 200) t(`dashboard ${p}: ${who} can read`, false, r); }
t('dashboard: every role reads every panel (6 roles x 8)', true);
t('dashboard: no login is 401 on every panel', (await Promise.all(PATHS.map((p) => NO('GET', '/dashboard/' + p)))).every((x) => x.s === 401));
t('dashboard: a write is not possible', [(await A('POST', '/dashboard/summary', {})).s, (await RO('POST', '/dashboard/summary', {})).s].every((s) => s === 403 || s === 404));

const row = (rows, key, name) => rows.find((x) => x[key] === name);
const N1 = `Dr A ${U}`, N2 = `Dr B ${U}`;
r = await A('GET', '/dashboard/demand-status'); let d = row(r.j.data, 'project', N1);
t('demand status: only raised demands count (pending, cancelled and paid are left out)', d && d.total === 5, d);
t('demand status: sent and unsent per instalment', d && d.demand_send === 1 && d.demand_unsend === 1 && d.rem1_unsend === 1 && d.rem2_unsend === 1 && d.term_unsend === 1 && d.rem1_send + d.rem2_send + d.term_send === 0, d);
t('demand status: instalment 5 is in the 4+ bucket and the numbers are numbers', d && typeof d.total === 'number' && typeof d.outstanding === 'number', d);
t('demand status: overdue is only the raised unpaid demand past its due date (30,000; due today is not overdue)', d && d.outstanding === 30000, d);
r = await A('GET', '/dashboard/forthcoming-due'); d = row(r.j.data, 'project_name', N1);
t('forthcoming due: today, 1-7, 8-14, 15-21 days from raised demands only', d && d.today_dues === 1 && d.days_1_7 === 1 && d.days_8_14 === 1 && d.days_15_21 === 1 && d.days_22_28 === 0, d);
r = await A('GET', '/dashboard/pending-cheques'); d = row(r.j.data, 'project', N1);
t('pending cheques: pending, deposited and the rest of cheques in flight; cancelled, bounced and cleared are not', d && d.pending === 1 && d.deposite === 1 && d.total === 3 && d.amount === 7600, d);
t('pending cheques: demand drafts are counted apart', d && d.pdc === 1 && d.pdc_amount === 2500, d);
t('pending cheques: the totals add up the rows', r.j.totals && r.j.totals.pending === r.j.data.reduce((s, x) => s + x.pending, 0) && r.j.totals.amount === r.j.data.reduce((s, x) => s + x.amount, 0), r.j.totals);
r = await A('GET', '/dashboard/pending-approval'); const mine = r.j.data.filter((x) => x.project_name === N1);
t('pending approval: the 3 pending receipts of the project, with its unit and a date', mine.length === 3 && mine.every((x) => x.unit_number === `c1-${U}` && !!x.received_date && x.payment_date === x.received_date && x.consumer_name === `Dr c1 ${U}`), mine);
t('pending approval: the count is the real count, not the length of the list', typeof r.j.count === 'number' && r.j.count >= 3 && r.j.count === Number(psql(`select count(*) from receipts where status='pending'`)), r.j.count);
r = await A('GET', '/dashboard/daily-status'); d = row(r.j.data, 'project', N1);
t('daily status: sales are live bookings only (cancelled and draft are not sales)', d && d.sales_total === 2 && d.sales_today === 1, d);
t('daily status: collection is cleared receipts only (cancelled booking, pending, bounced left out)', d && d.coll_total === 12100 && d.coll_today === 5100, d);
t('daily status: a customer with several receipts does not multiply sales or collection (the old join did)', d && d.sales_total === 2 && d.coll_total === 12100, d);
t('daily status: a project with nothing is not listed', !row(r.j.data, 'project', N2));
r = await A('GET', '/dashboard/parking-detail'); d = row(r.j.data, 'project', N1);
t('parking detail: total, allotted, available', d && d.total === 3 && d.allotted === 1 && d.available === 2 && d.parking_type === 'covered', d);
r = await A('GET', '/dashboard/employee-tickets'); d = row(r.j.data, 'employee_name', NAMES.sales1);
t('employee tasks: pending is not always 0 any more, completed and overdue are right', d && d.total === 3 && d.pending === 2 && d.completed === 1 && d.overdue === 1, d);
// the summary says the same as the single panels
const S = (await A('GET', '/dashboard/summary')).j.data;
const same = async (p, key, name, field) => JSON.stringify(row(S[field], key, name)) === JSON.stringify(row((await A('GET', '/dashboard/' + p)).j.data, key, name));
t('summary: demand status, cheques and forthcoming dues equal the single panels', await same('demand-status', 'project', N1, 'demandStatus') && await same('pending-cheques', 'project', N1, 'pendingCheques') && await same('forthcoming-due', 'project_name', N1, 'forthcomingDue'));
t('summary: carries the real approval count', S.pendingApprovalCount === Number(psql(`select count(*) from receipts where status='pending'`)));
// scope: a login of project B sees none of project A and the other way round
for (const [p, key] of [['demand-status', 'project'], ['pending-cheques', 'project'], ['daily-status', 'project'], ['parking-detail', 'project'], ['forthcoming-due', 'project_name']]) {
  const a = (await sales2.call('GET', '/dashboard/' + p)).j.data, b = (await sales1.call('GET', '/dashboard/' + p)).j.data;
  t(`scope ${p}: project B login does not see project A, project A login sees it`, !row(a, key, N1) && !!row(b, key, N1) && !row(b, key, N2), { a: a.length, b: b.length });
}
t('scope pending approval: project B login does not see the receipts of project A', !(await sales2.call('GET', '/dashboard/pending-approval')).j.data.some((x) => x.project_name === N1));
t('scope summary: project B login has no row of project A', ![].concat(...Object.values((await sales2.call('GET', '/dashboard/summary')).j.data).filter(Array.isArray)).some((x) => x.project === N1 || x.project_name === N1));
r = await par(PATHS.length, (i) => A('GET', `/dashboard/${PATHS[i]}?x=1;DROP TABLE tasks&project[]=a&pageSize=-1`)); t('dashboard: junk in the query string is ignored, no 5xx', no5(r) && r.every((x) => x.s === 200));
r = await par(12, () => A('GET', '/dashboard/summary')); t('dashboard: 12 parallel summaries all answer the same', no5(r) && new Set(r.map((x) => JSON.stringify(x.j))).size === 1);

// ================= RECONCILIATION =================
const R = mk(P1, T1, 'r1', {}), R2 = mk(P2, T2, 'r2', {});
const rcpt = { r1: rec(R, 50000, 'bank_transfer', 'cleared', TODAY, `UTR-${U}-1`), r2: rec(R, 75000, 'bank_transfer', 'cleared', TODAY, `UTR-${U}-2`), r3: rec(R, 20000, 'bank_transfer', 'cleared', TODAY, `UTR-${U}-3`),
  r4: rec(R, 1000, 'bank_transfer', 'cancelled', TODAY, `UTR-${U}-4`), r5: rec(R2, 4000, 'bank_transfer', 'cleared', TODAY, `UTR-${U}-5`),
  d1: rec(R, 800, 'bank_transfer', 'cleared', TODAY, `UTR-${U}-D`), d2: rec(R, 800, 'bank_transfer', 'cleared', TODAY, `UTR-${U}-D`), r8: rec(R, 900, 'bank_transfer', 'cleared', TODAY, `UTR-${U}-8`), r9: rec(R, 300, 'bank_transfer', 'bounced', TODAY, `UTR-${U}-9`) };
const DM = dem(R, 1, 'demanded', 50000, ist(5)), DMX = dem(R2, 1, 'demanded', 50000, ist(5)), DMC = dem(R, 2, 'cancelled', 1, ist(5));
const csv = [`Date,Description,Amount,Reference,Account`, `05/03/2026,NEFT in r1,"50,000.00",UTR-${U}-1,HDFC 1`, `2026-03-06,NEFT r2,75000,UTR-${U}-2,`, `07-03-2026,Short pay,25000,UTR-${U}-3,`, `08/03/2026,cancelled one,1000,UTR-${U}-4,`,
  `09/03/2026,other project,4000,UTR-${U}-5,`, `10/03/2026,dup ref,800,UTR-${U}-D,`, `11/03/2026,bank charges <b>x</b>,-250.50,,`, `12/03/2026,line a,900,UTR-${U}-8,`, `12/03/2026,line b,900,UTR-${U}-8,`, `13/03/2026,bounced one,300,UTR-${U}-9,`].join('\r\n');
const SUM = 50000 + 75000 + 25000 + 1000 + 4000 + 800 - 250.5 + 900 + 900 + 300;
const imp = (P, c, name = `stmt-${U}.csv`) => A('POST', '/reconciliation/import', { projectId: P, fileName: name, csvContent: c });

for (const [who, f, ok] of [['sales', SE, false], ['viewer', RO, false], ['support', SA, false], ['accounts', AF, true], ['pm', PM, true], ['admin', A, true]]) {
  r = await f('GET', '/reconciliation/imports'); t(`recon: ${who} ${ok ? 'can' : 'cannot'} see bank imports`, ok ? r.s === 200 : r.s === 403, r);
}
for (const [m, p, b] of [['GET', '/reconciliation/imports'], ['POST', '/reconciliation/import', {}], ['GET', `/reconciliation/imports/${NIL}/transactions`], ['PATCH', `/reconciliation/transactions/${NIL}/match`, {}], ['PATCH', `/reconciliation/transactions/${NIL}/ignore`, {}], ['PATCH', `/reconciliation/transactions/${NIL}/unmatch`, {}]]) t(`recon: no login is 401 on ${m} ${p.split('/').slice(2, 4).join('/')}`, (await NO(m, p, b)).s === 401);
for (const [who, f] of [['sales', SE], ['viewer', RO]]) t(`recon: ${who} cannot import or match (403)`, (await f('POST', '/reconciliation/import', { projectId: P1, fileName: 'x.csv', csvContent: csv })).s === 403 && (await f('PATCH', `/reconciliation/transactions/${NIL}/ignore`, {})).s === 403);

const importsBefore = Number(psql(`select count(*) from bank_statement_imports where project_id='${P1}'`));
const bad400 = async (n, b) => { r = await A('POST', '/reconciliation/import', b); t(`recon import refused: ${n}`, r.s >= 400 && r.s < 500 && !!r.j?.error, r); };
await bad400('no body', undefined); await bad400('project missing', { fileName: 'x', csvContent: csv }); await bad400('file name missing', { projectId: P1, csvContent: csv }); await bad400('csv missing', { projectId: P1, fileName: 'x' });
await bad400('project not uuid', { projectId: '1 OR 1=1', fileName: 'x', csvContent: csv }); await bad400('csv is a number', { projectId: P1, fileName: 'x', csvContent: 5 }); await bad400('csv is a list', { projectId: P1, fileName: 'x', csvContent: ['a'] });
await bad400('file name script', { projectId: P1, fileName: '<script>', csvContent: csv }); await bad400('file name 256', { projectId: P1, fileName: 'a'.repeat(256), csvContent: csv });
await bad400('header only', { projectId: P1, fileName: 'x', csvContent: 'Date,Description,Amount' }); await bad400('missing Amount column', { projectId: P1, fileName: 'x', csvContent: 'Date,Description\n2026-03-01,a' });
await bad400('not a csv (quote never closed)', { projectId: P1, fileName: 'x', csvContent: 'Date,Description,Amount\n2026-03-01,"a,5' });
for (const [n, line] of [['31/02/2026', '31/02/2026,a,5'], ['2026-3-5', '2026-3-5,a,5'], ['month 13', '2026-13-01,a,5'], ['text date', 'tomorrow,a,5'], ['year 1999', '2026-01-01x,a,5'], ['amount text', '2026-03-01,a,abc'], ['amount zero', '2026-03-01,a,0'], ['amount 3 decimals', '2026-03-01,a,1.234'], ['amount 1e3', '2026-03-01,a,1e3'], ['amount huge', '2026-03-01,a,99999999999']]) {
  r = await A('POST', '/reconciliation/import', { projectId: P1, fileName: 'x', csvContent: `Date,Description,Amount\n2026-03-01,fine,100\n${line}` }); t(`recon import: one bad row (${n}) stops the whole file with 422 and names the row`, r.s === 422 && /Row 3/.test(r.j?.error || '') && Array.isArray(r.j.errors), r);
}
r = await A('POST', '/reconciliation/import', { projectId: P1, fileName: 'big', csvContent: 'Date,Description,Amount\n' + Array.from({ length: 5001 }, (_, i) => `2026-03-01,l${i},${i + 1}`).join('\n') }); t('recon import: more than 5000 rows is refused', r.s === 400, r);
r = await A('POST', '/reconciliation/import', { projectId: P1, fileName: 'huge', csvContent: 'Date,Description,Amount\n' + 'x'.repeat(2_000_100) }); t('recon import: a file over 2 MB is refused', r.s === 400, r);
t('recon import: unknown project is 404', (await imp(NIL, csv)).s === 404);
t('recon import: every refusal left nothing behind', Number(psql(`select count(*) from bank_statement_imports where project_id='${P1}'`)) === importsBefore);

r = await imp(P1, '﻿' + csv); const IMP = r.j?.data?.importId;
t('recon import: a file with a BOM, Windows line ends, day-first dates and 1,00,000 style amounts is accepted', r.s === 201 && !!IMP && r.j.data.totalTransactions === 10, r);
t('recon import: reference and amount match give 2 auto matches (r1 and r2); everything else waits for a person', r.j.data.matchedCount === 2 && r.j.data.unmatchedCount === 8, r.j.data);
t('recon import: total amount is the sum with the debit', Math.abs(r.j.data.totalAmount - SUM) < 0.001, r.j.data.totalAmount);
const tx = async (q = '') => (await A('GET', `/reconciliation/imports/${IMP}/transactions?pageSize=100${q}`)).j.data;
let lines = await tx(); const byRef = (ref) => lines.filter((x) => x.transaction_ref === `UTR-${U}-${ref}`);
const L = (ref) => byRef(ref)[0];
t('recon import: 05/03/2026 is 5 March (day first), 2026-03-06 and 07-03-2026 are read right too', lines.find((x) => x.description === 'NEFT in r1').transaction_date.slice(0, 10) === '2026-03-05' && L('2').transaction_date.slice(0, 10) === '2026-03-06' && L('3').transaction_date.slice(0, 10) === '2026-03-07', lines.map((x) => x.transaction_date));
t('recon import: r1 and r2 are auto matched to their own receipts with confidence 95', L('1').match_status === 'auto_matched' && L('1').matched_receipt_id === rcpt.r1 && L('2').matched_receipt_id === rcpt.r2 && Number(L('1').match_confidence) === 95 && !!L('1').receipt_number === !!psql(`select receipt_number from receipts where id='${rcpt.r1}'`), L('1'));
t('recon import: same reference but another amount (r3) is NOT matched', L('3').match_status === 'unmatched' && !L('3').matched_receipt_id);
t('recon import: a cancelled receipt, a bounced receipt and a receipt of another project are not matched', ['4', '5', '9'].every((k) => L(k).match_status === 'unmatched'));
t('recon import: two receipts with one reference and amount (ambiguous) are not matched; two lines for one receipt are not matched', L('D').match_status === 'unmatched' && byRef('8').length === 2 && byRef('8').every((x) => x.match_status === 'unmatched'));
t('recon import: a debit is never matched, markup in the description is removed', lines.find((x) => Number(x.amount_inr) < 0).match_status === 'unmatched' && !lines.some((x) => /[<>]/.test(x.description)));
t('recon import: lines carry the project (so project scope applies to them)', Number(psql(`select count(*) from bank_transactions where import_id='${IMP}' and project_id='${P1}'`)) === 10);
t('recon import: the same file again is 409, also under another file name; another project may take it', (await imp(P1, csv)).s === 409 && (await imp(P1, csv, 'renamed.csv')).s === 409);
r = await imp(P2, csv); t('recon import: the same text in another project is a separate import', r.s === 201, r); const IMP2 = r.j?.data?.importId;
t('recon import: 5 parallel imports of one new file make exactly one', await (async () => { const c2 = csv.replace('HDFC 1', 'HDFC 9'); const x = await par(5, () => imp(P1, c2, 'race.csv')); return no5(x) && x.filter((y) => y.s === 201).length === 1 && x.filter((y) => y.s === 409).length === 4; })());

// lists
r = await A('GET', `/reconciliation/imports?projectId=${P1}`); t('recon imports: list of a project with paging and the project name', r.s === 200 && r.j.data.length === 2 && r.j.data[0].project_name === N1 && r.j.pagination.total === 2, r);
r = await A('GET', `/reconciliation/imports?projectId=${P1}&pageSize=1&page=2`); t('recon imports: page 2 of size 1', r.s === 200 && r.j.data.length === 1 && r.j.pagination.page === 2, r);
for (const q of ['pageSize=0', 'pageSize=201', 'pageSize=abc', 'page=0', 'projectId=abc', 'projectId[]=a', 'pageSize=5&pageSize=6', 'pageSize=1;DROP TABLE bank_transactions']) t(`recon imports refused: ${q}`, (await A('GET', '/reconciliation/imports?' + q)).s === 400);
for (const [q, n] of [['&matchStatus=auto_matched', 2], ['&matchStatus=unmatched', 8], ['&matchStatus=ignored', 0], ['&pageSize=3', 3]]) { r = await A('GET', `/reconciliation/imports/${IMP}/transactions?${q.slice(1)}${q.startsWith('&pageSize') ? '' : '&pageSize=100'}`); t(`recon transactions: ${q.slice(1)} gives ${n}`, r.s === 200 && r.j.data.length === n, r.j?.data?.length); }
for (const q of ['matchStatus=done', 'matchStatus[]=ignored', 'pageSize=0', 'pageSize=501', 'page=-1']) t(`recon transactions refused: ${q}`, (await A('GET', `/reconciliation/imports/${IMP}/transactions?${q}`)).s === 400);
t('recon transactions: bad import id 400, unknown 404', (await A('GET', '/reconciliation/imports/abc/transactions')).s === 400 && (await A('GET', `/reconciliation/imports/${NIL}/transactions`)).s === 404);
t('recon transactions: the matched lines carry the receipt number and the customer name', (await A('GET', `/reconciliation/imports/${IMP}/transactions?matchStatus=auto_matched`)).j.data.every((x) => x.consumer_name === `Dr r1 ${U}`));

// manual match
const M = (id, b) => A('PATCH', `/reconciliation/transactions/${id}/match`, b);
const receiptState = () => psql(`select string_agg(status, ',' order by id) from receipts where consumer_id='${R.c}'`);
const before = receiptState();
t('recon match: bad ids and empty body are 400, unknown line 404', (await M('abc', { receiptId: rcpt.r3 })).s === 400 && (await M(L('3').id, {})).s === 400 && (await M(L('3').id, { receiptId: 'abc' })).s === 400 && (await M(L('3').id, { demandId: '1 OR 1=1' })).s === 400 && (await M(NIL, { receiptId: rcpt.r3 })).s === 404);
t('recon match: unknown receipt and demand are 404', (await M(L('3').id, { receiptId: NIL })).s === 404 && (await M(L('3').id, { demandId: NIL })).s === 404);
t('recon match: notes too long or with markup are 400', (await M(L('3').id, { receiptId: rcpt.r3, notes: 'n'.repeat(501) })).s === 400 && (await M(L('3').id, { receiptId: rcpt.r3, notes: '<b>' })).s === 400);
t('recon match: a receipt of another project is 409', (await M(L('3').id, { receiptId: rcpt.r5 })).s === 409);
t('recon match: a cancelled receipt and a bounced receipt are 409', (await M(L('3').id, { receiptId: rcpt.r4 })).s === 409 && (await M(L('3').id, { receiptId: rcpt.r9 })).s === 409);
t('recon match: a receipt already on another line is 409', (await M(L('3').id, { receiptId: rcpt.r1 })).s === 409);
t('recon match: a demand of another project and a cancelled demand are 409', (await M(L('3').id, { demandId: DMX })).s === 409 && (await M(L('3').id, { demandId: DMC })).s === 409);
t('recon match: a debit line cannot be matched (409)', (await M(lines.find((x) => Number(x.amount_inr) < 0).id, { receiptId: rcpt.r3 })).s === 409);
r = await M(L('3').id, { receiptId: rcpt.r3, notes: 'part payment, balance later' }); t('recon match: a person matches the short payment to its receipt', r.s === 200 && r.j.data.match_status === 'manually_matched' && r.j.data.matched_receipt_id === rcpt.r3 && r.j.data.notes === 'part payment, balance later', r);
t('recon match: the import counts are read back (3 matched, 7 unmatched)', psql(`select matched_count||'/'||unmatched_count from bank_statement_imports where id='${IMP}'`) === '3/7');
t('recon match: matching never changes the receipt', receiptState() === before);
r = await M(L('D').id, { demandId: DM }); t('recon match: a line can be matched to a demand of the project', r.s === 200 && r.j.data.matched_demand_id === DM && !r.j.data.matched_receipt_id, r);
r = await M(L('D').id, { receiptId: rcpt.d1 }); t('recon match: matching again replaces what the line pointed at (the demand is dropped)', r.s === 200 && r.j.data.matched_receipt_id === rcpt.d1 && r.j.data.matched_demand_id === null, r);
const [a8, b8] = byRef('8'); const race = await Promise.all([M(a8.id, { receiptId: rcpt.r8 }), M(b8.id, { receiptId: rcpt.r8 })]);
t('recon match: two lines racing for one receipt, exactly one wins (409 for the other, not 500)', race.filter((x) => x.s === 200).length === 1 && race.filter((x) => x.s === 409).length === 1, race);
t('recon match: the unique index holds in the database', psql(`select count(*) from bank_transactions where matched_receipt_id='${rcpt.r8}'`) === '1');
const racer = await par(6, () => M(L('3').id, { receiptId: rcpt.r3 })); t('recon match: the same match sent 6 times at once is fine, no 5xx', no5(racer) && racer.every((x) => x.s === 200), racer.map((x) => x.s));

// ignore, unmatch
const I = (id, b) => A('PATCH', `/reconciliation/transactions/${id}/ignore`, b), Un = (id) => A('PATCH', `/reconciliation/transactions/${id}/unmatch`, {});
t('recon ignore: bad id 400, unknown 404, notes with markup 400', (await I('abc', {})).s === 400 && (await I(NIL, {})).s === 404 && (await I(L('1').id, { notes: '<i>' })).s === 400);
r = await I(L('1').id, { notes: 'posted twice by the bank' }); t('recon ignore: a matched line becomes ignored and drops its receipt', r.s === 200 && r.j.data.match_status === 'ignored' && r.j.data.matched_receipt_id === null && r.j.data.notes === 'posted twice by the bank', r);
t('recon ignore: counts follow (matched 4, ignored line is neither matched nor unmatched)', (() => { const x = psql(`select matched_count||'/'||unmatched_count from bank_statement_imports where id='${IMP}'`); return x === '4/5'; })(), psql(`select matched_count||'/'||unmatched_count from bank_statement_imports where id='${IMP}'`));
r = await M(L('1').id, { receiptId: rcpt.r1 }); t('recon match: an ignored line can be matched again, and the freed receipt is free', r.s === 200 && r.j.data.match_status === 'manually_matched', r);
r = await Un(L('1').id); t('recon unmatch: back to unmatched, links gone', r.s === 200 && r.j.data.match_status === 'unmatched' && !r.j.data.matched_receipt_id, r);
t('recon unmatch: an unmatched line is 409; bad id 400; unknown 404', (await Un(L('1').id)).s === 409 && (await Un('abc')).s === 400 && (await Un(NIL)).s === 404);
t('recon: matched + unmatched + ignored always equals the number of lines', (() => { const x = psql(`select (select matched_count+unmatched_count from bank_statement_imports where id='${IMP}') + (select count(*) from bank_transactions where import_id='${IMP}' and match_status='ignored')`); return Number(x) === 10; })());
t('recon: every change is in the audit log', Number(psql(`select count(*) from audit_logs where resource_type in ('bank_transaction','bank_statement_import') and resource_id in (select id from bank_transactions where import_id='${IMP}' union select '${IMP}'::uuid)`)) >= 5);
// project scope: the finance login of project B
t('recon scope: project B finance login does not list the imports of project A, and sees its own', (await fin2.call('GET', `/reconciliation/imports?projectId=${P1}`)).j.data.length === 0 && (await fin2.call('GET', '/reconciliation/imports')).j.data.some((x) => x.id === IMP2) && !(await fin2.call('GET', '/reconciliation/imports')).j.data.some((x) => x.id === IMP));
t('recon scope: ...cannot open the lines of project A (404), cannot match, ignore or unmatch them (404)', (await fin2.call('GET', `/reconciliation/imports/${IMP}/transactions`)).s === 404 && (await fin2.call('PATCH', `/reconciliation/transactions/${L('3').id}/ignore`, {})).s === 404 && (await fin2.call('PATCH', `/reconciliation/transactions/${L('3').id}/match`, { receiptId: rcpt.r3 })).s === 404 && (await fin2.call('PATCH', `/reconciliation/transactions/${L('3').id}/unmatch`, {})).s === 404);
t('recon scope: ...cannot import into project A (404)', (await fin2.call('POST', '/reconciliation/import', { projectId: P1, fileName: 'z.csv', csvContent: 'Date,Description,Amount\n2026-03-01,z,1' })).s === 404);
t('recon scope: project A finance login can work (import into A, open lines)', (await fin1.call('GET', `/reconciliation/imports/${IMP}/transactions`)).s === 200 && (await fin1.call('POST', '/reconciliation/import', { projectId: P1, fileName: 'a.csv', csvContent: 'Date,Description,Amount\n2026-03-01,a1,11' })).s === 201);
t('recon: after everything the receipts are still as they were', receiptState() === before);

// ================= MILESTONES =================
const MS = (P, name, type, status = 'pending', pct = 0, notify = true) => psql(`INSERT INTO construction_milestones (project_id, milestone_name, milestone_type, status, completion_percentage, notify_allottees${status === 'completed' ? ', actual_date' : ''}) VALUES ('${P}', '${name} ${U}', '${type}', '${status}', ${pct}, ${notify}${status === 'completed' ? `, '${TODAY}'` : ''}) RETURNING id`);
const m1 = MS(P1, 'Foundation', 'foundation'), m2 = MS(P1, 'Structure', 'structure', 'in_progress', 40), m3 = MS(P1, 'Handover', 'handover'), m4 = MS(P1, 'Quiet', 'mep', 'pending', 0, false), m5 = MS(P1, 'Done', 'legal', 'completed', 100), mp2 = MS(P2, 'Other', 'foundation');
// allottees of P1: both contacts, email only, mobile only, none, cancelled, transferred, other project
const W1 = mk(P1, T1, 'w1', {}), W2 = mk(P1, T1, 'w2', { mobile: null }), W3 = mk(P1, T1, 'w3', { email: null }), W4 = mk(P1, T1, 'w4', { email: null, mobile: 'blank' }), W5 = mk(P1, T1, 'w5', { alloc: 'cancelled' }), W6 = mk(P1, T1, 'w6', { alloc: 'transferred' }), W7 = mk(P1, T1, 'w7', { alloc: 'agreement_signed' }), W8 = mk(P1, T1, 'w8', { alloc: 'booked' }), WO = mk(P2, T2, 'wo', {});
const mcount = (cid) => Number(psql(`select count(*) from communications where consumer_id in (${cid.map((x) => `'${x}'`).join(',')}) and subject like 'Construction Update%' or (consumer_id in (${cid.map((x) => `'${x}'`).join(',')}) and message like 'Construction Update%')`));
const msgsOf = (cs) => Number(psql(`select count(*) from communications where message like 'Construction Update:%${U}%' and consumer_id in (${cs.map((x) => `'${x}'`).join(',')})`));

for (const [who, f] of [['viewer', RO], ['support', SA], ['sales', SE], ['pm', PM], ['accounts', AF], ['admin', A]]) t(`milestones list: ${who} can read`, (await f('GET', `/milestones?projectId=${P1}`)).s === 200);
for (const [who, f, ok] of [['viewer', RO, false], ['support', SA, false], ['sales', SE, false], ['pm', PM, true], ['accounts', AF, true], ['admin', A, true]]) t(`milestones complete: ${who} ${ok ? 'can' : 'cannot'} (${ok ? 'not 403' : '403'})`, ok ? (await f('PATCH', `/milestones/${NIL}/complete`, {})).s === 404 : (await f('PATCH', `/milestones/${NIL}/complete`, {})).s === 403);
t('milestones: no login is 401', (await NO('GET', `/milestones?projectId=${P1}`)).s === 401 && (await NO('PATCH', `/milestones/${m1}/complete`, {})).s === 401 && (await NO('GET', `/milestones/project/${P1}/progress`)).s === 401);
for (const q of ['', 'projectId=abc', 'projectId=1 OR 1=1', 'projectId[]=a', `projectId=${P1}&projectId=${P2}`]) t(`milestones list refused: ${q || '(no projectId)'}`, (await A('GET', '/milestones?' + q)).s === 400);
t('milestones list: unknown project is 404', (await A('GET', `/milestones?projectId=${NIL}`)).s === 404);
r = await A('GET', `/milestones?projectId=${P1}`); t('milestones list: the 5 of the project in building order (foundation, structure, mep, legal, handover) and none of the other project', r.s === 200 && r.j.data.length === 5 && r.j.data.map((x) => x.milestone_type).join() === 'foundation,structure,mep,legal,handover' && !r.j.data.some((x) => x.id === mp2), r.j.data?.map((x) => x.milestone_type));
r = await A('GET', `/milestones/project/${P1}/progress`); t('progress: 5 milestones, 1 completed, average 28 (100 + 40 + 0 + 0 + 0 over 5)', r.s === 200 && r.j.data.totalMilestones === 5 && r.j.data.completedMilestones === 1 && r.j.data.progressPercentage === 28 && typeof r.j.data.progressPercentage === 'number', r);
t('progress: a project with no milestones is zeros; bad id 400; unknown 404', (await A('GET', `/milestones/project/${await mkProj('Z')}/progress`)).j.data.totalMilestones === 0 && (await A('GET', '/milestones/project/abc/progress')).s === 400 && (await A('GET', `/milestones/project/${NIL}/progress`)).s === 404);
// scope
t('milestones scope: project B login cannot list or see the progress of project A (404)', (await pm2.call('GET', `/milestones?projectId=${P1}`)).s === 404 && (await pm2.call('GET', `/milestones/project/${P1}/progress`)).s === 404);
t('milestones scope: ...cannot complete a milestone of project A (404) and it stays pending', (await pm2.call('PATCH', `/milestones/${m1}/complete`, {})).s === 404 && psql(`select status from construction_milestones where id='${m1}'`) === 'pending');
// hostile bodies
const C = (id, b, who = A) => who('PATCH', `/milestones/${id}/complete`, b);
for (const [n, b] of [['percent 50', { completionPercentage: 50 }], ['percent 0', { completionPercentage: 0 }], ['percent 101', { completionPercentage: 101 }], ['percent -1', { completionPercentage: -1 }], ['percent text', { completionPercentage: 'abc' }], ['percent 1e2', { completionPercentage: '1e2' }], ['percent list', { completionPercentage: [100] }],
  ['future date', { actualDate: ist(2) }], ['bad date', { actualDate: '2026-02-30' }], ['date text', { actualDate: 'today' }], ['notify string', { notifyAllottees: 'true' }], ['notify 1', { notifyAllottees: 1 }],
  ['photos text', { photosUrls: 'a.jpg' }], ['photos 21', { photosUrls: Array(21).fill('/a.jpg') }], ['photo javascript', { photosUrls: ['javascript:alert(1)'] }], ['photo with space', { photosUrls: ['/a b.jpg'] }], ['photo number', { photosUrls: [5] }], ['photo 501', { photosUrls: ['/' + 'a'.repeat(500)] }],
  ['description 2001', { description: 'd'.repeat(2001) }], ['description markup', { description: '<b>x</b>' }], ['description object', { description: {} }]]) { r = await C(m3, b); t(`milestone complete refused: ${n}`, r.s === 400, r); }
t('milestone complete: bad id 400, unknown 404, a list body 400', (await C('abc', {})).s === 400 && (await C(NIL, {})).s === 404 && (await A('PATCH', `/milestones/${m3}/complete`, undefined, '[1]')).s === 400);
t('milestone complete: every refusal left the milestone pending and queued nothing', psql(`select status from construction_milestones where id='${m3}'`) === 'pending' && msgsOf([W1.c, W2.c, W3.c, W4.c]) === 0);
// complete with notify: 6 parallel clicks
r = await par(6, () => C(m1, { notifyAllottees: true, description: 'Foundation poured', photosUrls: ['/uploads/a.jpg', 'https://example.com/b.jpg'] }));
t('milestone complete: 6 parallel completes give exactly one success, the rest are 409', no5(r) && r.filter((x) => x.s === 200).length === 1 && r.filter((x) => x.s === 409).length === 5, r.map((x) => x.s));
const done = r.find((x) => x.s === 200);
t('milestone complete: 100%, today (India) as the actual date, description and photos saved', done.j.data.completion_percentage === 100 && String(done.j.data.actual_date).slice(0, 10) === TODAY && psql(`select description||'|'||array_length(photos_urls,1) from construction_milestones where id='${m1}'`) === 'Foundation poured|2', done.j);
t('milestone complete: messages for customers who still hold a unit: w1 two, w2 email, w3 whatsapp, w4 none, w7 and w8 two each; not cancelled, transferred or the other project (the 5 customers of the dashboard part get 2 each: 18 in all)', msgsOf([W1.c]) === 2 && msgsOf([W2.c]) === 1 && msgsOf([W3.c]) === 1 && msgsOf([W4.c]) === 0 && msgsOf([W7.c]) === 2 && msgsOf([W8.c]) === 2 && msgsOf([W5.c, W6.c, WO.c]) === 0, [W1, W2, W3, W4, W7, W8, W5, W6, WO].map((x) => msgsOf([x.c])));
t('milestone complete: the messages are queued, never "sent", and say who and where', psql(`select count(*) from communications where message like 'Construction Update:%${U}%' and status <> 'queued'`) === '0' && psql(`select count(*) from communications where message like 'Construction Update:%${U}%' and direction = 'outbound' and sent_by_user_id is not null`) === '18', '');
t('milestone complete: the answer says how many were queued and that nothing is sent yet', done.j.data.messagesQueued === 18 && /queued/.test(done.j.message) && /nothing is sent/i.test(done.j.message), done.j);
t('milestone complete: the second complete is 409 and queued nothing more', (await C(m1, { notifyAllottees: true })).s === 409 && msgsOf([W1.c, W2.c, W3.c, W7.c, W8.c]) === 8);
t('milestone complete: notification time is set once', !!psql(`select notification_sent_at from construction_milestones where id='${m1}'`));
// notify false and the column default
r = await C(m2, { notifyAllottees: false }); t('milestone complete: notifyAllottees false queues nothing (in progress 40% becomes 100%)', r.s === 200 && r.j.data.messagesQueued === 0 && r.j.data.completion_percentage === 100 && msgsOf([W1.c, W2.c, W3.c, W7.c, W8.c]) === 8, r);
r = await C(m4, {}); t('milestone complete: with no flag the milestone\'s own setting decides (this one is switched off: nothing queued)', r.s === 200 && r.j.data.messagesQueued === 0, r);
r = await C(m3, { completionPercentage: 100, actualDate: ist(-1) }); t('milestone complete: an own date in the past and 100 are accepted; the milestone setting (on) queues messages', r.s === 200 && String(r.j.data.actual_date).slice(0, 10) === ist(-1) && r.j.data.messagesQueued === 18, r);
t('milestone complete: a completed milestone always has a date (database check)', psql(`select count(*) from construction_milestones where project_id='${P1}' and status='completed' and actual_date is null`) === '0');
r = await A('GET', `/milestones/project/${P1}/progress`); t('progress after: 5 of 5 completed, 100%', r.j.data.completedMilestones === 5 && r.j.data.progressPercentage === 100, r);
t('milestone: changes are in the audit log', Number(psql(`select count(*) from audit_logs where resource_type='construction_milestones' and resource_id in ('${m1}','${m2}','${m3}','${m4}')`)) >= 4);
t('milestone: the database refuses a bad status and a completed row without a date', (() => { try { psql(`update construction_milestones set status='finished' where id='${mp2}'`); return false; } catch { try { psql(`update construction_milestones set status='completed', actual_date=NULL where id='${mp2}'`); return false; } catch { return true; } } })());

// ================= RANDOM HOSTILE RUN =================
const junk = () => pick(['', ' ', 'abc', '<b>', "' OR 1=1 --", '0', '-1', '1e9', NIL, '2026-02-30', '31/12/2026', 'x'.repeat(300), '\u0000', '😀', null, [], {}, true, 5, -5, 1.5]);
const ids = () => pick([NIL, 'abc', IMP, L('3').id, L('D').id, rcpt.r1, rcpt.r3, DM, m1, m3, P1, P2, junk()]);
const calls = [];
for (let i = 0; i < 160; i++) {
  const w = pick([A, A, AF, PM, fin2.call, pm2.call, SE, RO, NO]);
  const k = ri(1, 12);
  calls.push(
    k === 1 ? w('GET', `/reconciliation/imports?projectId=${encodeURIComponent(String(ids()))}&page=${encodeURIComponent(String(junk()))}&pageSize=${encodeURIComponent(String(junk()))}`)
    : k === 2 ? w('GET', `/reconciliation/imports/${encodeURIComponent(String(ids()))}/transactions?matchStatus=${encodeURIComponent(String(junk()))}&page=${encodeURIComponent(String(junk()))}`)
    : k === 3 ? w('PATCH', `/reconciliation/transactions/${encodeURIComponent(String(ids()))}/match`, { receiptId: junk() === null ? undefined : ids(), demandId: pick([undefined, ids()]), notes: junk() })
    : k === 4 ? w('PATCH', `/reconciliation/transactions/${encodeURIComponent(String(ids()))}/ignore`, { notes: junk() })
    : k === 5 ? w('PATCH', `/reconciliation/transactions/${encodeURIComponent(String(ids()))}/unmatch`, junk())
    : k === 6 ? w('POST', '/reconciliation/import', { projectId: ids(), fileName: junk(), csvContent: pick([junk(), 'Date,Description,Amount\n' + junk() + ',' + junk() + ',' + junk(), 'a,b\n1,2', '"', 'Date,Description,Amount\n2026-03-01,ok,' + ri(1, 99999) + '.' + ri(0, 99)]) })
    : k === 7 ? w('GET', `/milestones?projectId=${encodeURIComponent(String(ids()))}`)
    : k === 8 ? w('PATCH', `/milestones/${encodeURIComponent(String(ids()))}/complete`, { actualDate: junk(), completionPercentage: junk(), description: junk(), photosUrls: pick([junk(), [junk()], ['/ok.jpg']]), notifyAllottees: junk() })
    : k === 9 ? w('GET', `/milestones/project/${encodeURIComponent(String(ids()))}/progress`)
    : k === 10 ? w('GET', `/dashboard/${pick(PATHS)}?${junk() === null ? '' : 'q=' + encodeURIComponent(String(junk()))}`)
    : k === 11 ? w('POST', '/reconciliation/import', undefined, pick(['{', '[', 'null', '"x"', '{"projectId":']))
    : w('PATCH', `/milestones/${encodeURIComponent(String(ids()))}/complete`, undefined, pick(['{', '[1]', 'null', '123'])));
}
const rr = await Promise.all(calls);
t('random: 160 hostile requests across reconciliation, milestones and the dashboard, none gave a 5xx', no5(rr), JSON.stringify(rr.filter((x) => x.s >= 500).slice(0, 3)));
t('random: nothing was damaged (receipts unchanged, matched + unmatched + ignored still equal the lines)', receiptState() === before && Number(psql(`select count(*) from bank_transactions where import_id='${IMP}'`)) === 10);

// ---------- clean up what this script made ----------
const rm = (sql) => { try { psql(sql); } catch {} };
const ps = `'${P1}','${P2}'`;
rm(`DELETE FROM bank_transactions WHERE project_id IN (${ps})`); rm(`DELETE FROM bank_statement_imports WHERE project_id IN (${ps})`);
rm(`DELETE FROM communications WHERE consumer_id IN (SELECT id FROM consumers WHERE project_id IN (${ps}))`);
rm(`DELETE FROM construction_milestones WHERE project_id IN (${ps})`); rm(`DELETE FROM parking_slots WHERE project_id IN (${ps})`);
rm(`DELETE FROM tasks WHERE assigned_to IN ('${sales1.id}')`);
rm(`DELETE FROM receipts WHERE consumer_id IN (SELECT id FROM consumers WHERE project_id IN (${ps}))`); rm(`DELETE FROM demands WHERE consumer_id IN (SELECT id FROM consumers WHERE project_id IN (${ps}))`);
rm(`DELETE FROM booking_records WHERE project_id IN (${ps})`); rm(`DELETE FROM payment_plans WHERE project_id IN (${ps})`); rm(`DELETE FROM allocations WHERE project_id IN (${ps})`);
rm(`DELETE FROM units WHERE project_id IN (${ps})`); rm(`DELETE FROM consumers WHERE project_id IN (${ps})`);

console.log(`\nRESULT: ${pass} passed, ${fail} failed (seed ${SEED})`);
process.exit(fail ? 1 : 0);
