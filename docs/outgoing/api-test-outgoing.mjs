// Outgoing payments (and the role gate on the financial-ops router): roles, input rules, list filters.
// Run:  BASE=http://localhost:3010/api node api-test-outgoing.mjs   (psql must reach the same database)
import { execFileSync } from 'node:child_process';
const B = process.env.BASE || 'http://localhost:3010/api';
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };
const login = async (e) => (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: e, password: 'Test#Pass1234' }) })).json()).token;
const call = (tok) => async (m, p, b, raw) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: raw ?? (b === undefined ? undefined : JSON.stringify(b)) }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const A = call(await login('super_admin@test.local')), AF = call(await login('accounts_finance@test.local')), PM = call(await login('project_manager@test.local')), SE = call(await login('sales_executive@test.local')), RO = call(await login('read_only_viewer@test.local'));
const psql = (sql) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' }).trim().split('\n')[0];
const U = Date.now().toString(36).slice(-5), NIL = '00000000-0000-0000-0000-000000000000', acct = psql(`select id from company_bank_accounts limit 1`);
const today = new Date().toISOString().slice(0, 10);
let r; const made = [];
const add = async (b, who = A) => { const x = await who('POST', '/payments/outgoing-payments', { company_bank_account_id: acct, amount_inr: 100, payee: 'P' + U, ...b }); if (x.s === 201) made.push(x.j.data.id); return x; };

for (const [n, who] of [['read_only_viewer', RO], ['sales_executive', SE]]) { r = await add({}, who); t(`roles: ${n} cannot add -> 403`, r.s === 403, r.s); }
for (const [n, who] of [['read_only_viewer', RO], ['sales_executive', SE], ['project_manager', PM], ['accounts_finance', AF], ['super_admin', A]]) { r = await who('GET', '/payments/outgoing-payments'); t(`roles: ${n} can read`, r.s === 200, r.s); }
r = await add({}, AF); t('roles: accounts_finance can add', r.s === 201, r.s + JSON.stringify(r.j));
r = await fetch(B + '/payments/outgoing-payments'); t('roles: no login -> 401', r.status === 401, r.status);
for (const [n, who] of [['read_only_viewer', RO], ['sales_executive', SE]]) { r = await who('POST', '/payments/refunds', {}); t(`roles: ${n} cannot add a refund (financial-ops gate) -> 403`, r.s === 403, r.s); }
for (const [n, b, code] of [
  ['bank account missing', { company_bank_account_id: undefined }, 400], ['bank account "abc"', { company_bank_account_id: 'abc' }, 400], ['unknown bank account', { company_bank_account_id: NIL }, 404],
  ['amount missing', { amount_inr: undefined }, 400], ['amount 0', { amount_inr: 0 }, 400], ['amount -1', { amount_inr: -1 }, 400], ['amount "abc"', { amount_inr: 'abc' }, 400], ['amount "1e3"', { amount_inr: '1e3' }, 400], ['amount 1e12', { amount_inr: 1e12 }, 400], ['amount 0.001', { amount_inr: 0.001 }, 400], ['amount [5]', { amount_inr: [5] }, 400],
  ['date 2020-02-30', { payment_date: '2020-02-30' }, 400], ['date "abc"', { payment_date: 'abc' }, 400], ['status "weird"', { status: 'weird' }, 400],
  ['payee <b>', { payee: '<b>' }, 400], ['payee 201 chars', { payee: 'p'.repeat(201) }, 400], ['reference 101 chars', { reference_number: 'r'.repeat(101) }, 400], ['notes 1001 chars', { notes: 'n'.repeat(1001) }, 400],
]) { r = await add(b); t(`add: ${n} -> ${code}`, r.s === code, r.s + JSON.stringify(r.j).slice(0, 90)); }
r = await A('POST', '/payments/outgoing-payments'); t('add: no body -> 400', r.s === 400, r.s); r = await A('POST', '/payments/outgoing-payments', undefined, '[1]'); t('add: array body -> 400', r.s === 400, r.s);
t('add: nothing saved by the refused calls', psql(`select count(*) from outgoing_payments where payee='P${U}'`) === '1');
r = await add({ amount_inr: 12.5, payment_date: today, status: 'paid', notes: 'ok' }); t('add: paise, date and status are kept', r.s === 201 && Number(r.j.data.amount_inr) === 12.5 && r.j.data.status === 'paid', r.s);
r = await A('GET', `/payments/outgoing-payments?company_bank_account_id=${acct}&status=paid&fromDate=${today}&toDate=${today}`); t('list: filters work', r.s === 200 && r.j.data.some(x => x.id === made.at(-1)) && r.j.data.every(x => x.status === 'paid'), r.s);
for (const q of ['company_bank_account_id=abc', 'fromDate=nope', 'toDate=2020-13-01', 'status[]=a', 'status=' + 'x'.repeat(30)]) { r = await A('GET', '/payments/outgoing-payments?' + q); t(`list: ?${q.slice(0, 25)} -> 400`, r.s === 400, r.s); }
if (made.length) { try { psql(`delete from outgoing_payments where id in (${made.map(x => `'${x}'`).join(',')})`); } catch {} }
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
