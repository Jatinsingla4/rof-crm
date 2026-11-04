// Users & Roles, UR-011: the two lifecycle actions. Disable keeps the configuration (a suspension) and enabling needs
// reviewedGrants; Revoke all disables AND removes every grant in one step, keeps the role, kills old tokens, and records
// what was removed. A login cannot revoke itself and the last active super_admin cannot be revoked.
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-ur011.mjs   (needs psql env)
import { execFileSync } from 'node:child_process';

const B = process.env.BASE || 'http://localhost:3010/api';
const PSQL = process.env.PSQL || 'psql';
const sql = (q) => execFileSync(PSQL, ['-X', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8' }).trim();
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : (fail++), console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };
const call = (tok) => async (m, p, b) => {
  const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
  let j = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
};
const login = (email, password) => call()('POST', '/auth/login', { email, password });
const A = call((await login('super_admin@test.local', 'Test#Pass1234')).j.token);
const PM = call((await login('project_manager@test.local', 'Test#Pass1234')).j.token);
const U = Date.now().toString(36).slice(-6);
const PW = 'Ur011#Pass' + U.replace(/\D/g, '') + '1';
const audit = (id) => JSON.parse(sql(`SELECT json_build_object('p', previous_values, 'n', new_values) FROM audit_logs WHERE resource_type='user' AND resource_id='${id}' AND action='update' ORDER BY timestamp DESC LIMIT 1`) || 'null');
const counts = (id) => JSON.parse(sql(`SELECT json_build_object('proj', jsonb_array_length(assigned_project_ids), 'co', (SELECT count(*) FROM user_company_access WHERE user_id=u.id), 'pr', (SELECT count(*) FROM user_process_permissions WHERE user_id=u.id), 'ip', (SELECT count(*) FROM user_ip_restrictions WHERE user_id=u.id), 'ipOn', ip_security_enabled, 'print', authorized_print, 'dl', authorized_download, 'unit', unit_status_access, 'active', is_active, 'role', role) FROM users u WHERE id='${id}'`));

const form = (await A('GET', '/users/employee-login/form-data')).j.data;
const email = `ur11.${U}@test.local`;
let r = await A('POST', '/users/employee-login', {
  username: 'ur11u' + U, email, password: PW, confirmPassword: PW, role: 'sales_executive',
  processPermissions: [{ processName: 'receipt', isMaker: true, isChecker: false }, { processName: 'new_applicant', isMaker: true, isChecker: false }],
  companyIds: form.companies.slice(0, 1).map((c) => c.id), assignedProjectIds: form.projects.slice(0, 1).map((p) => p.id),
  authorizedPrint: true, authorizedDownload: true, unitStatusAccess: 'available',
});
t('login with a full set of grants created', r.s === 201, JSON.stringify(r.j));
const id = r.j?.data?.userId;
await A('POST', `/users/employee-login/${id}/ips`, { ip_address: '203.0.113.7' });
const full = counts(id);
t('setup holds projects, company, 2 process rights, 1 IP, print, download, unit status', full.proj === 1 && full.co === 1 && full.pr === 2 && full.ip === 1 && full.print && full.dl && full.unit === 'available', JSON.stringify(full));
const tok = (await login(email, PW)).j.token;
t('the login works before', (await call(tok)('GET', '/users/me')).s === 200);

// ---------- Disable keeps everything; enabling needs a review ----------
r = await A('PATCH', `/users/employee-login/${id}`, { isActive: false });
t('disable: 200', r.s === 200, JSON.stringify(r.j));
t('disable keeps every grant (a suspension)', JSON.stringify({ ...counts(id), active: true }) === JSON.stringify({ ...full, active: true }), JSON.stringify(counts(id)));
r = await A('PATCH', `/users/employee-login/${id}`, { isActive: true });
t('enable without reviewedGrants: 409 and the text says what the login holds', r.s === 409 && /reviewedGrants/.test(r.j?.error) && /1 project\(s\), 1 company\(ies\), 2 process right\(s\), 1 IP address\(es\)/.test(r.j?.error), JSON.stringify(r.j));
t('still inactive after the refused enable', counts(id).active === false);
r = await A('PATCH', `/users/employee-login/${id}`, { isActive: true, reviewedGrants: 'yes' });
t('reviewedGrants must be exactly true', r.s === 409, r.s);
r = await A('PATCH', `/users/employee-login/${id}`, { isActive: true, reviewedGrants: true });
t('enable with reviewedGrants: 200', r.s === 200, JSON.stringify(r.j));
const a1 = audit(id);
t('enable audit: reactivated and the reviewed grant summary', a1?.n?.reactivated === true && a1?.n?.grantsReviewed?.process_rights === 2, JSON.stringify(a1?.n));
t('the old token stays dead after enabling (disable ended the session)', (await call(tok)('GET', '/users/me')).s === 401);

// ---------- Revoke all ----------
r = await PM('POST', `/users/employee-login/${id}/revoke-all`, {});
t('revoke-all: project_manager -> 403', r.s === 403, r.s);
r = await A('POST', `/users/employee-login/00000000-0000-0000-0000-000000000009/revoke-all`, {});
t('revoke-all: unknown login -> 404', r.s === 404, r.s);
const me = (await A('GET', '/users/me')).j.data.id;
r = await A('POST', `/users/employee-login/${me}/revoke-all`, {});
t('revoke-all: a login cannot revoke itself -> 400', r.s === 400, JSON.stringify(r.j));
const tok2 = (await login(email, PW)).j.token;
r = await A('POST', `/users/employee-login/${id}/revoke-all`, {});
t('revoke-all: 200', r.s === 200 && r.j?.data?.revoked?.process_rights === 2, JSON.stringify(r.j));
const z = counts(id);
t('after revoke-all: inactive, no project/company/process/IP, IP security off, print/download off, unit status none, role unchanged',
  z.active === false && z.proj === 0 && z.co === 0 && z.pr === 0 && z.ip === 0 && !z.ipOn && !z.print && !z.dl && z.unit === 'none' && z.role === 'sales_executive', JSON.stringify(z));
t('the user row and its audit history remain', sql(`SELECT count(*) FROM users WHERE id='${id}'`) === '1' && Number(sql(`SELECT count(*) FROM audit_logs WHERE resource_id='${id}'`)) >= 3);
t('the token from before is dead', (await call(tok2)('GET', '/users/me')).s === 401);
const a2 = audit(id);
t('revoke audit keeps what was removed: company ids, process rights, IP, project list, counts', a2?.n?.revokedAll === true && a2?.p?.companyIds?.length === 1 && a2?.p?.ipAddresses?.[0] === '203.0.113.7' && a2?.p?.projects?.length === 1 && a2?.p?.process_rights === 2 && /receipt/i.test(JSON.stringify(a2?.p?.processes)), JSON.stringify(a2?.p));

// ---------- reactivation after revoke-all starts with zero grants ----------
r = await A('PATCH', `/users/employee-login/${id}`, { isActive: true });
t('enable after revoke-all also needs reviewedGrants', r.s === 409 && /0 project\(s\), 0 company\(ies\), 0 process right\(s\)/.test(r.j?.error), JSON.stringify(r.j));
r = await A('PATCH', `/users/employee-login/${id}`, { isActive: true, reviewedGrants: true });
t('enabled again with zero grants', r.s === 200 && counts(id).active && counts(id).pr === 0 && counts(id).co === 0, JSON.stringify(counts(id)));
const tok3 = call((await login(email, PW)).j.token);
t('zero process rights: a receipt action is refused', [401, 403].includes((await tok3('POST', '/payments/receipts', {})).s));
const dirs = (await tok3('GET', '/users/directory')).s;
t('a login with no grants still gets its own profile and the directory (not a grant)', dirs === 200 && (await tok3('GET', '/users/me')).s === 200);
t("unit status 'none' shows no unit on the inventory list", ((await tok3('GET', '/units?limit=5')).j?.data ?? []).length === 0 && (await tok3('GET', '/units?limit=5')).s === 200, JSON.stringify((await tok3('GET', '/units?limit=5')).j)?.slice(0, 160));

// ---------- last active super_admin ----------
const sa2 = await A('POST', '/users/employee-login', { username: 'ur11sa' + U, email: `ur11sa.${U}@test.local`, password: PW, confirmPassword: PW, role: 'super_admin' });
r = await A('POST', `/users/employee-login/${sa2.j?.data?.userId}/revoke-all`, {});
t('revoking a second super_admin works while another stays active', r.s === 200, JSON.stringify(r.j));
const onlyActive = sql(`SELECT count(*) FROM users WHERE role='super_admin' AND is_active`);
t('at least one active super_admin remains', Number(onlyActive) >= 1, onlyActive);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
