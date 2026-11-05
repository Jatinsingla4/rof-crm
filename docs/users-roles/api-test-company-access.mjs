// Users & Roles, UR-002 (company access): user_company_access is enforced by the API, not only shown in the UI. A login with company grants
// reaches the projects of those companies only (every project-bound table follows, through the project scope), the companies themselves, their
// bank accounts and the bank-account ids typed into writes. A login with no company grant is unchanged (the strict "no grant means no access"
// rule waits for the owner's per-user mapping, data operation D5). A grant never widens a project assignment. super_admin is unchanged.
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-company-access.mjs   (needs psql env)
import { execFileSync } from 'node:child_process';

const B = process.env.BASE || 'http://localhost:3010/api';
const PSQL = process.env.PSQL || 'psql';
const sql = (q) => execFileSync(PSQL, ['-X', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8' }).trim();
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : (fail++), console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };
const raw = async (tok, m, p, b) => {
  const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: b === undefined ? undefined : JSON.stringify(b) });
  let j = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
};
const login = async (email, password) => (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()).token;
const SA = await login('super_admin@test.local', 'Test#Pass1234');
const U = Date.now().toString(36).slice(-6), PW = 'Ca#Pass' + U.replace(/\D/g, '') + '1x';
const must = (r, what) => { if (r.s >= 300) throw new Error(what + ' ' + JSON.stringify(r)); return r.j.data; };

// two companies, one project each, one unit, one applicant, one bank account
const mkCo = async (n) => must(await raw(SA, 'POST', '/companies', { name: `CA ${n} ${U}` }), 'company');
const coA = await mkCo('A'), coB = await mkCo('B');
const mkProj = async (co, n) => must(await raw(SA, 'POST', '/projects', { companyId: co.id, name: `CA-${n}-${U}`, reraNumber: `CA${n}-${U}`, tcpLicence: 'x' }), 'project');
const pA = await mkProj(coA, 'A'), pB = await mkProj(coB, 'B');
const person = async (p, n) => must(await raw(SA, 'POST', '/consumers', { name: `CA Buyer ${n} ${U}`, mobile: '9' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0'), project_id: p.id }), 'consumer');
const cA = await person(pA, 'A'), cB = await person(pB, 'B');
const bank = async (co) => (await raw(SA, 'POST', `/companies/${co.id}/bank-accounts`, { bankName: 'HDFC Bank', accountNumber: String(Math.floor(Math.random() * 1e12)).padStart(12, '1'), ifscCode: 'HDFC0001234', isPrimary: true })).j;
await bank(coA); await bank(coB);
const bankB = sql(`SELECT id FROM company_bank_accounts WHERE company_id = '${coB.id}' LIMIT 1`), bankA = sql(`SELECT id FROM company_bank_accounts WHERE company_id = '${coA.id}' LIMIT 1`);

const mkUser = async (name, extra) => {
  const email = `ca.${name}.${U}@test.local`;
  const r = await raw(SA, 'POST', '/users/employee-login', { username: `ca${name}${U}`, email, password: PW, confirmPassword: PW, role: 'project_manager', authorizedPrint: true, authorizedDownload: true, unitStatusAccess: 'all', ...extra });
  if (r.s !== 201) throw new Error(name + ' ' + JSON.stringify(r));
  return { name, id: r.j.data.userId, tok: await login(email, PW) };
};
const uA = await mkUser('a', { companyIds: [coA.id], processPermissions: [{ processName: 'receipt', isMaker: true, isChecker: false }] }), uB = await mkUser('b', { companyIds: [coB.id] }), uBoth = await mkUser('both', { companyIds: [coA.id, coB.id] });
const uNone = await mkUser('none', {});                                                       // no company grant: unchanged
const uAssignedOther = await mkUser('x', { companyIds: [coA.id], assignedProjectIds: [pB.id] }); // a grant never widens an assignment: B's project is not company A's
const names = (r) => (r.j?.data || r.j?.projects || []).map((x) => x.name || x.project_name || '');
const ids = (r) => (r.j?.data || []).map((x) => x.id);

// ---------- companies ----------
let r = await raw(uA.tok, 'GET', '/companies');
t('company A login: the company list holds company A only', ids(r).includes(coA.id) && !ids(r).includes(coB.id), r.s + ' ' + JSON.stringify(ids(r)).slice(0, 120));
t('company A login: company B by id -> 404', (await raw(uA.tok, 'GET', `/companies/${coB.id}`)).s === 404);
t('company A login: company A by id -> 200', (await raw(uA.tok, 'GET', `/companies/${coA.id}`)).s === 200);
t("company A login: company B's bank accounts -> 404", (await raw(uA.tok, 'GET', `/companies/${coB.id}/bank-accounts`)).s === 404);
t("company A login: cannot add a bank account to company B -> 404", (await raw(uA.tok, 'POST', `/companies/${coB.id}/bank-accounts`, { bankName: 'X', accountNumber: '123456789012', ifscCode: 'HDFC0001234' })).s === 404);
t('company A login: cannot edit company B (PUT) -> 404', (await raw(uA.tok, 'PUT', `/companies/${coB.id}`, { name: 'hijack' })).s === 404 && sql(`SELECT name FROM companies WHERE id = '${coB.id}'`) === coB.name);
t('company A login: cannot touch a bank account of company B through company A\'s path -> 404', (await raw(uA.tok, 'PATCH', `/companies/${coB.id}/bank-accounts/${bankB}`, { bankName: 'x' })).s === 404);
r = await raw(uBoth.tok, 'GET', '/companies'); t('both grants: both companies listed', ids(r).includes(coA.id) && ids(r).includes(coB.id));
r = await raw(uNone.tok, 'GET', '/companies'); t('no company grant: unchanged, both listed', ids(r).includes(coA.id) && ids(r).includes(coB.id));
r = await raw(SA, 'GET', '/companies'); t('super_admin: both listed', ids(r).includes(coA.id) && ids(r).includes(coB.id));

// ---------- project-bound data follows the company (central, through the project scope) ----------
// which of the two test projects this login can open (by id: the project list is paged and the test database holds hundreds of projects)
const projNames = async (u) => { const out = []; for (const p of [pA, pB]) { const x = await raw(u.tok, 'GET', `/projects/${p.id}`); if (x.s === 200) out.push(p.name); } return out; };
t('company A login: projects of company A only', JSON.stringify((await projNames(uA)).sort()) === JSON.stringify([`CA-A-${U}`]), JSON.stringify(await projNames(uA)));
t('company B login: projects of company B only', JSON.stringify((await projNames(uB)).sort()) === JSON.stringify([`CA-B-${U}`]));
t('both grants: both projects', (await projNames(uBoth)).length === 2);
t('no company grant: both projects (unchanged)', (await projNames(uNone)).length === 2);
t("company A login: project B by id -> 404", [404, 403].includes((await raw(uA.tok, 'GET', `/projects/${pB.id}`)).s));
const seen = async (u, p) => { const x = await raw(u.tok, 'GET', p); return x.s === 200 ? JSON.stringify(x.j) : `<${x.s}>`; };
t("company A login: applicant of company B is not listed and not readable (consumers)", !(await seen(uA, '/consumers?pageSize=500')).includes(cB.id) && (await seen(uA, '/consumers?pageSize=500')).includes(cA.id) && [404, 403].includes((await raw(uA.tok, 'GET', `/consumers/${cB.id}`)).s));
t('company A login: applicant of company A is readable', (await raw(uA.tok, 'GET', `/consumers/${cA.id}`)).s === 200);
t("company A login: cannot create an applicant in company B's project", (await raw(uA.tok, 'POST', '/consumers', { name: 'Intruder ' + U, mobile: '9000000099', project_id: pB.id })).s >= 400);
t("company A login: units of company B are not listed", !(await seen(uA, `/units?projectId=${pB.id}&pageSize=50`)).includes(pB.id) || (await raw(uA.tok, 'GET', `/units?projectId=${pB.id}&pageSize=50`)).j?.data?.length === 0);
t('a grant never widens an assignment: assigned to a project of another company, the login sees no project of the test', (await projNames(uAssignedOther)).length === 0, JSON.stringify(await projNames(uAssignedOther)));
t('super_admin sees both projects', (await projNames({ tok: SA })).length === 2);

// ---------- a typed bank-account id of another company in a write ----------
const rcp = (u, bank) => raw(u.tok, 'POST', '/payments/receipts', { consumerId: cA.id, amountReceivedInr: 1000, paymentMethod: 'cash', companyBankAccountId: bank });
const rB = await rcp(uA, bankB);
t("a receipt for a company A applicant naming company B's bank account is refused by the company limit", rB.s >= 400 && /bank account/i.test(JSON.stringify(rB.j)) && sql(`SELECT count(*) FROM receipts WHERE consumer_id = '${cA.id}'`) === '0', rB.s + JSON.stringify(rB.j));
{ const l = await raw(uA.tok, 'GET', '/reports/bank-ledger-company-banks'); const lb = await raw(SA, 'GET', '/reports/bank-ledger-company-banks'); t('the bank filter list of the bank ledger report holds company A only (super_admin sees both)', l.s === 200 && ids(l).includes(bankA) && !ids(l).includes(bankB) && ids(lb).includes(bankB), l.s + JSON.stringify(ids(l))); }

// ---------- a grant change takes effect at once and is audited ----------
await raw(SA, 'PATCH', `/users/employee-login/${uNone.id}`, { companyIds: [coB.id] });
t('granting company B to a login with none limits it at once', JSON.stringify((await projNames(uNone)).sort()) === JSON.stringify([`CA-B-${U}`]), JSON.stringify(await projNames(uNone)));
await raw(SA, 'POST', `/users/employee-login/${uNone.id}/revoke-all`, {});
t('revoke all removes the grants (and the login)', sql(`SELECT count(*) FROM user_company_access WHERE user_id = '${uNone.id}'`) === '0');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
