import { bizToday } from '../_shared/business-date.mjs';
// Security module checks (roles, role menu access, logins, permissions, IP allow list, audit log).
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-security.mjs
const B = process.env.BASE || 'http://localhost:3010/api';
let pass = 0, fail = 0; const fails = [];
const t = (n, ok, x = '') => { ok ? pass++ : (fail++, fails.push(n + ' -> ' + x)); console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };
const post = async (p, b, tok) => { const r = await fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => null) }; };
const login = async (email, password = 'Test#Pass1234') => (await post('/auth/login', { email, password })).j?.token;
const call = tok => async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: b === undefined ? undefined : JSON.stringify(b) }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const A = call(await login('super_admin@test.local'));
const PM = call(await login('project_manager@test.local'));
const SE = call(await login('sales_executive@test.local'));
const U = Date.now().toString(36).slice(-6);
const NIL = '00000000-0000-0000-0000-000000000000';
const PW = 'Sec#Pass' + U.replace(/\D/g, '') + '1';
let r;

// ---------- Roles ----------
r = await SE('POST', '/master/not-listed-anywhere', { name: 'x' }); t('master: a write on a path nobody listed is refused for sales_executive -> 403', r.s === 403, r.s);
r = await A('POST', '/master/not-listed-anywhere', { name: 'x' }); t('master: same path for super_admin is just not found -> 404', r.s === 404, r.s);
r = await A('GET', '/roles'); t('roles: super_admin lists roles', r.s === 200 && r.j.data.length >= 6, r.s);
t('roles: the six system roles are marked system', ['super_admin', 'project_manager', 'sales_executive', 'accounts_finance', 'support_agent', 'read_only_viewer'].every(n => r.j.data.find(x => x.name === n)?.is_system === true));
r = await SE('GET', '/roles'); t('roles: sales_executive cannot list roles -> 403', r.s === 403, r.s);
r = await PM('GET', '/roles'); t('roles: project_manager cannot view the list (UR-001, super_admin only)', r.s === 403, r.s);
r = await PM('POST', '/roles', { name: 'pm_role_' + U, label: 'X', baseRole: 'read_only_viewer' }); t('roles: project_manager cannot create -> 403', r.s === 403, r.s);

const rn = 'collector_' + U;
r = await A('POST', '/roles', { name: 'Bad Name', label: 'x', baseRole: 'support_agent' }); t('role: spaces and capitals in the name -> 400', r.s === 400, r.s);
r = await A('POST', '/roles', { name: 'ab', label: 'x', baseRole: 'support_agent' }); t('role: name shorter than 3 -> 400', r.s === 400, r.s);
r = await A('POST', '/roles', { name: 'sales_executive', label: 'x', baseRole: 'support_agent' }); t('role: system role name -> 409', r.s === 409, r.s);
r = await A('POST', '/roles', { name: rn, label: '', baseRole: 'support_agent' }); t('role: empty label -> 400', r.s === 400, r.s);
r = await A('POST', '/roles', { name: rn, label: 'x'.repeat(101), baseRole: 'support_agent' }); t('role: label over 100 -> 400', r.s === 400, r.s);
r = await A('POST', '/roles', { name: rn, label: 'Collector' }); t('role: no base role -> 400', r.s === 400, r.s);
r = await A('POST', '/roles', { name: rn, label: 'Collector', baseRole: 'super_admin' }); t('role: base role super_admin refused -> 400', r.s === 400, r.s);
r = await A('POST', '/roles', { name: rn, label: 'Collector', baseRole: 'nonsense' }); t('role: unknown base role -> 400', r.s === 400, r.s);
r = await A('POST', '/roles', { name: rn, label: 'Collector', baseRole: 'sales_executive', pageIds: ['x'] }); t('role: pageIds not ids -> 400', r.s === 400, r.s);
r = await A('POST', '/roles', { name: rn, label: 'Collector', baseRole: 'sales_executive', pageIds: [NIL] }); t('role: unknown page id -> 400', r.s === 400, r.s);
const nav = (await A('GET', '/roles/nav-pages')).j.data; const pages = Object.values(nav).flat();
t('pages: the page list is filled (migration 099)', pages.length >= 60, pages.length);
const pageOf = route => pages.find(p => p.route === route).id;
r = await A('POST', '/roles', { name: rn, label: 'Collector', description: 'Follows up dues', baseRole: 'sales_executive', pageIds: [pageOf('/dashboard'), pageOf('/consumers'), pageOf('/consumers')] });
t('role: create with pages (duplicate id ignored)', r.s === 201 && r.j.data.name === rn && r.j.data.base_role === 'sales_executive', JSON.stringify(r.j));
const rid = r.j?.data?.id;
r = await A('POST', '/roles', { name: rn.toUpperCase(), label: 'Again', baseRole: 'sales_executive' }); t('role: same name other case -> 409', r.s === 409, r.s);
r = await A('GET', '/roles'); const row = r.j.data.find(x => x.name === rn); t('roles: list shows user_count 0 and page_count 2', row?.user_count === 0 && row?.page_count === 2, JSON.stringify(row));
r = await A('PATCH', '/roles/' + rn, { label: 'Dues Collector', baseRole: 'support_agent' }); t('role: edit label and base role', r.s === 200 && r.j.data.label === 'Dues Collector' && r.j.data.base_role === 'support_agent', JSON.stringify(r.j));
r = await A('PATCH', '/roles/' + rn, { baseRole: 'super_admin' }); t('role: edit base role to super_admin -> 400', r.s === 400, r.s);
r = await A('PATCH', '/roles/sales_executive', { label: 'x' }); t('role: system role cannot be edited -> 403', r.s === 403, r.s);
r = await A('PATCH', '/roles/nope_' + U, { label: 'x' }); t('role: edit unknown -> 404', r.s === 404, r.s);

// ---------- Role Menu Access ----------
r = await A('GET', '/roles/matrix'); t('matrix: roles, pages and access in one call', r.s === 200 && r.j.data.roles.length >= 7 && r.j.data.pages.length >= 60 && Array.isArray(r.j.data.access[rn]) && r.j.data.access[rn].length === 2, r.s);
r = await SE('GET', '/roles/matrix'); t('matrix: sales_executive -> 403', r.s === 403, r.s);
r = await SE('GET', '/roles/sales_executive/pages'); t('pages: a user may read their own role', r.s === 200 && r.j.data.some(p => p.has_access), r.s);
r = await SE('GET', '/roles/accounts_finance/pages'); t('pages: a user may not read another role -> 403', r.s === 403, r.s);
r = await A('GET', '/roles/nope_' + U + '/pages'); t('pages: unknown role -> 404', r.s === 404, r.s);
r = await A('PUT', '/roles/' + rn + '/pages', {}); t('pages: pageIds missing -> 400', r.s === 400, r.s);
r = await A('PUT', '/roles/' + rn + '/pages', { pageIds: [NIL] }); t('pages: unknown page -> 400', r.s === 400, r.s);
r = await A('PUT', '/roles/super_admin/pages', { pageIds: [] }); t('pages: super_admin cannot be restricted -> 400', r.s === 400, r.s);
r = await A('PUT', '/roles/nope_' + U + '/pages', { pageIds: [] }); t('pages: unknown role -> 404', r.s === 404, r.s);
r = await PM('PUT', '/roles/' + rn + '/pages', { pageIds: [] }); t('pages: project_manager cannot save -> 403', r.s === 403, r.s);
r = await A('PUT', '/roles/' + rn + '/pages', { pageIds: [pageOf('/dashboard'), pageOf('/consumers'), pageOf('/receipts')] }); t('pages: save replaces the set (3 pages)', r.s === 200 && r.j.data.pages === 3, JSON.stringify(r.j));
r = await A('GET', '/roles/' + rn + '/pages'); t('pages: saved access reads back', r.j.data.filter(p => p.has_access).map(p => p.route).sort().join() === '/consumers,/dashboard,/receipts', r.j.data.filter(p => p.has_access).length);
r = await A('PUT', '/roles/' + rn + '/pages', { pageIds: [] }); t('pages: empty set is allowed (role sees nothing)', r.s === 200 && r.j.data.pages === 0, r.s);
r = await A('PUT', '/roles/' + rn + '/pages', { pageIds: [pageOf('/dashboard')] });
// system roles start with sensible access
const sys = r2 => r2.j.data.filter(p => p.has_access).map(p => p.route);
const pmPages = sys(await A('GET', '/roles/project_manager/pages')); t('default access: project_manager has Set Master but not Security', pmPages.includes('/set-master') && !pmPages.includes('/users'), pmPages.length);
const rvPages = sys(await A('GET', '/roles/read_only_viewer/pages')); t('default access: read_only_viewer cannot open Booking, Receipts or Set Master', !rvPages.includes('/booking') && !rvPages.includes('/receipts') && !rvPages.includes('/set-master') && rvPages.includes('/consumers'), rvPages.join());

// ---------- Logins ----------
const CO = (await A('POST', '/companies', { name: 'Sec Co ' + U })).j.data.id;
await A('POST', '/projects', { companyId: CO, name: 'Sec-' + U, reraNumber: 'SEC-' + U, tcpLicence: 'x' });
const form = (await A('GET', '/users/employee-login/form-data')).j.data;
t('form data: roles include the custom role, processes match the API', form.roles.some(x => x.value === rn) && form.processes.length === 9 && form.projects.length >= 1, JSON.stringify(form.roles.map(x => x.value)));
r = await SE('GET', '/users/employee-login/form-data'); t('logins: sales_executive cannot open the login form -> 403', r.s === 403, r.s);
const email = `Mixed.Case.${U}@Example.com`, username = 'user_' + U;
const base = { username, email, password: PW, confirmPassword: PW, role: 'sales_executive' };
const bad = async (n, o, re) => { const x = await A('POST', '/users/employee-login', { ...base, ...o }); t('login create: ' + n, x.s === 400 && (!re || re.test(x.j.error)), x.s + ' ' + JSON.stringify(x.j)); };
await bad('missing username', { username: '' });
await bad('username with spaces', { username: 'a b c' });
await bad('invalid email', { email: 'not-an-email' });
await bad('passwords differ', { confirmPassword: 'Other#1234' }, /match/);
await bad('password too short', { password: 'a1', confirmPassword: 'a1' });
await bad('password without a number', { password: 'OnlyLetters', confirmPassword: 'OnlyLetters' }, /number/);
await bad('password over 72 bytes', { password: 'a1'.repeat(40), confirmPassword: 'a1'.repeat(40) }, /72/);
await bad('unknown role', { role: 'nobody' }, /role/i);
await bad('unknown process', { processPermissions: [{ processName: 'fly_to_moon', isMaker: true }] }, /process/i);
await bad('checker on a process that has none', { processPermissions: [{ processName: 'new_applicant', isChecker: true }] }, /checker/);
await bad('approver is not used', { processPermissions: [{ processName: 'receipt', isApprover: true }] }, /pprover/);
await bad('same process twice', { processPermissions: [{ processName: 'receipt', isMaker: true }, { processName: 'receipt', isChecker: true }] }, /twice/);
await bad('unknown company', { companyIds: [NIL] }, /compan/i);
await bad('unknown project', { assignedProjectIds: [NIL] }, /project/i);
await bad('bad unit status access', { unitStatusAccess: 'everything' });
await bad('unknown home widget', { homePageWidgets: ['nope'] });
const proj = form.projects[0].id, comp = form.companies[0]?.id;
r = await A('POST', '/users/employee-login', { ...base, assignedProjectIds: [proj], companyIds: comp ? [comp] : [], unitStatusAccess: 'available', homePageWidgets: ['enquiry'], authorizedPrint: true,
  processPermissions: [{ processName: 'receipt', isMaker: true, isChecker: false }, { processName: 'new_applicant', isMaker: false }] });
t('login create: valid -> 201', r.s === 201 && r.j.data.userId, JSON.stringify(r.j)); const uid = r.j?.data?.userId;
r = await A('POST', '/users/employee-login', { ...base, username: 'other_' + U, email: email.toLowerCase() }); t('login create: same email other case -> 409', r.s === 409, r.s);
r = await A('POST', '/users/employee-login', { ...base, username: username.toUpperCase(), email: `second.${U}@example.com` }); t('login create: same username other case -> 409', r.s === 409, r.s);
r = await A('GET', '/users/employee-login?username=' + username); const mine = r.j.data[0];
t('login list: stored email is lowercase, only permissions with a role are kept, project and company shown', mine?.email === email.toLowerCase() && mine.process_permissions.length === 1 && mine.process_permissions[0].process_name === 'receipt' && mine.project_names !== '' && mine.role_label === 'Sales Executive', JSON.stringify(mine));
r = await A('GET', '/users/employee-login?username=' + encodeURIComponent('%')); t('login list: % in the search is text, not a wildcard', r.s === 200 && r.j.data.length === 0, r.j.data?.length);
let tok = await login(email.toUpperCase(), PW); t('login: sign in with the email in other letter case', !!tok);
const UT = call(tok);
r = await UT('GET', '/users/me'); t('me: process permissions come back', r.s === 200 && r.j.data.processPermissions.receipt?.includes('maker'), JSON.stringify(r.j));
r = await A('GET', '/users/' + uid); t('user: last_login_at was recorded', !!r.j.data.last_login_at, JSON.stringify(r.j));
r = await UT('GET', '/reports/summary'); const reportsOk = r.s !== 403; t('role change: before — sales_executive may reach reports', reportsOk, r.s);
r = await UT('GET', '/users'); t('users: sales_executive cannot list users -> 403', r.s === 403, r.s);
r = await UT('GET', '/users/directory'); t('directory: every signed-in user can read names', r.s === 200 && r.j.data.length > 3, r.s);
r = await UT('GET', '/users/directory'); t('directory: no password hash or email leaks', !JSON.stringify(r.j).includes('hash') && !('email' in r.j.data[0]));

// edits
const patch = (id, b) => A('PATCH', '/users/employee-login/' + id, b);
r = await patch(NIL, { isActive: true }); t('login edit: unknown user -> 404', r.s === 404, r.s);
r = await patch('abc', { isActive: true }); t('login edit: bad id -> 404', r.s === 404, r.s);
r = await patch(uid, { role: 'nobody' }); t('login edit: unknown role -> 400', r.s === 400, r.s);
r = await patch(uid, { email: 'nope' }); t('login edit: bad email -> 400', r.s === 400, r.s);
r = await patch(uid, { mobile: 'abc' }); t('login edit: bad mobile -> 400', r.s === 400, r.s);
r = await patch(uid, { password: 'short' }); t('login edit: weak password -> 400', r.s === 400, r.s);
r = await patch(uid, { isActive: 'yes' }); t('login edit: isActive must be boolean -> 400', r.s === 400, r.s);
r = await patch(uid, { name: '   ' }); t('login edit: blank name -> 400', r.s === 400, r.s);
r = await PM('PATCH', '/users/employee-login/' + uid, { isActive: false }); t('login edit: project_manager cannot edit -> 403', r.s === 403, r.s);
r = await patch(uid, { name: 'Test User ' + U, mobile: '+91 98765-43210' }); t('login edit: name and mobile', r.s === 200, JSON.stringify(r.j));
r = await patch(uid, { processPermissions: [{ processName: 'receipt', isMaker: true, isChecker: true }, { processName: 'jv_refund_drcr', isMaker: true }], companyIds: [] }); t('login edit: replace permissions and clear companies', r.s === 200, JSON.stringify(r.j));
r = await UT('GET', '/users/me'); t('login edit: new permissions are live', r.j.data.processPermissions.receipt?.length === 2 && r.j.data.processPermissions.jv_refund_drcr?.includes('maker') && r.j.data.companyIds.length === 0, JSON.stringify(r.j.data.processPermissions));

// role and status changes take effect at once (no waiting for the cache)
r = await patch(uid, { role: 'support_agent' }); t('role change: saved', r.s === 200, r.s);
r = await UT('GET', '/users/me'); t('role change: signs the user out so their menu is rebuilt on the next sign in', r.s === 401, r.s);
let UT2 = call(await login(email, PW));
r = await UT2('GET', '/reports/summary'); t('role change: new role applies (support_agent has no reports)', r.s === 403, r.s);
r = await patch(uid, { role: rn }); t('custom role: assigned to the user', r.s === 200, r.s);
UT2 = call(await login(email, PW));
r = await UT2('GET', '/consumers'); t('custom role: works on the API through its base role (support_agent can view consumers)', r.s === 200, r.s);
r = await UT2('GET', '/users'); t('custom role: still blocked where the base role is blocked', r.s === 403, r.s);
r = await UT2('POST', '/master/salutations', { name: 'Zz' + U }); t('custom role: cannot write master data (base role has none)', r.s === 403, r.s);
r = await A('DELETE', '/roles/' + rn); t('role delete: refused while a user holds it -> 409', r.s === 409 && /1 user/.test(r.j.error), JSON.stringify(r.j));
r = await UT2('GET', '/roles/' + rn + '/pages'); t('custom role: user reads own page access', r.s === 200 && r.j.data.filter(p => p.has_access).length === 1, JSON.stringify(r.j).slice(0, 100));
r = await A('PATCH', '/roles/' + rn, { baseRole: 'read_only_viewer' }); t('custom role: base role change', r.s === 200, r.s);
r = await UT2('GET', '/consumers'); t('custom role: base role change applies at once', r.s === 200, r.s);
r = await patch(uid, { role: 'sales_executive' });
r = await A('DELETE', '/roles/' + rn); t('role delete: custom role with no users -> 200', r.s === 200, JSON.stringify(r.j));
r = await A('GET', '/roles/matrix'); t('role delete: its page access rows are gone', !(rn in r.j.data.access), JSON.stringify(r.j.data.access[rn]));
r = await A('POST', '/roles', { name: rn, label: 'Collector again', baseRole: 'support_agent' }); const again = (await A('GET', '/roles/' + rn + '/pages')).j.data.filter(p => p.has_access).length;
t('role delete: a role created again with the same name starts with no pages', r.s === 201 && again === 0, again);
await A('DELETE', '/roles/' + rn);
r = await A('DELETE', '/roles/sales_executive'); t('role delete: system role -> 403', r.s === 403, r.s);
r = await A('DELETE', '/roles/nope_' + U); t('role delete: unknown -> 404', r.s === 404, r.s);

// sessions
r = await patch(uid, { password: PW + 'x' }); t('password reset by admin', r.s === 200, r.s);
r = await UT2('GET', '/users/me'); t('password reset: the old session ends', r.s === 401, r.s);
tok = await login(email, PW + 'x'); t('password reset: new password works', !!tok);
r = await post('/auth/login', { email, password: PW }); t('password reset: old password refused', r.s === 401, r.s);
r = await A('POST', `/users/employee-login/${uid}/sign-out`); t('sign out everywhere', r.s === 200, r.s);
r = await call(tok)('GET', '/users/me'); t('sign out everywhere: the session ends', r.s === 401, r.s);
r = await A('POST', `/users/employee-login/${NIL}/sign-out`); t('sign out: unknown user -> 404', r.s === 404, r.s);
tok = await login(email, PW + 'x');
r = await patch(uid, { isActive: false }); t('deactivate', r.s === 200, r.s);
r = await call(tok)('GET', '/users/me'); t('deactivate: the session ends at once', r.s === 401, r.s);
r = await post('/auth/login', { email, password: PW + 'x' }); t('deactivate: sign in refused', r.s === 401, r.s);
r = await patch(uid, { isActive: true }); t('reactivate without reviewedGrants -> 409 (UR-011)', r.s === 409 && /reviewedGrants/.test(r.j?.error), JSON.stringify(r.j));
r = await patch(uid, { isActive: true, reviewedGrants: true }); t('reactivate with reviewedGrants', r.s === 200, r.s);

// the last super_admin and yourself
const me = (await A('GET', '/users/me')).j.data;
r = await patch(me.id, { role: 'sales_executive' }); t('self: cannot change your own role -> 400', r.s === 400, r.s);
r = await patch(me.id, { isActive: false }); t('self: cannot deactivate yourself -> 400', r.s === 400, r.s);
r = await patch(me.id, { name: me.name }); t('self: other edits are fine', r.s === 200, r.s);

// ---------- IP allow list ----------
r = await A('GET', `/users/employee-login/${NIL}/ips`); t('ip: unknown user -> 404', r.s === 404, r.s);
for (const v of ['999.1.1.1', 'abc', '1.2.3', '1.2.3.4/24', '']) { r = await A('POST', `/users/employee-login/${uid}/ips`, { ip_address: v }); t(`ip: "${v}" -> 400`, r.s === 400, r.s); }
r = await patch(uid, { ipSecurityEnabled: true }); t('ip: cannot switch on with an empty list -> 400', r.s === 400, r.s);
r = await A('POST', `/users/employee-login/${uid}/ips`, { ip_address: '203.0.113.7', description: 'Sales office' }); t('ip: add IPv4', r.s === 201, JSON.stringify(r.j)); const ipid = r.j?.data?.id;
r = await A('POST', `/users/employee-login/${uid}/ips`, { ip_address: '2001:DB8::1' }); t('ip: add IPv6 (stored lowercase)', r.s === 201 && r.j.data.ip_address === '2001:db8::1', JSON.stringify(r.j));
r = await A('POST', `/users/employee-login/${uid}/ips`, { ip_address: '203.0.113.7' }); r = await A('GET', `/users/employee-login/${uid}/ips`); t('ip: adding the same address twice keeps one row', r.j.data.filter(x => x.ip_address === '203.0.113.7').length === 1, JSON.stringify(r.j.data.length));
const mineIps = await A('POST', `/users/employee-login/${me.id}/ips`, { ip_address: '198.51.100.9' }); const myIpRow = mineIps.j?.data?.id;
r = await patch(me.id, { ipSecurityEnabled: true }); t('ip: admin cannot lock themselves out (own address not on the list) -> 400', r.s === 400 && /lock/.test(r.j.error), JSON.stringify(r.j));
await A('DELETE', `/users/employee-login/${me.id}/ips/${myIpRow}`);
tok = await login(email, PW + 'x'); const live = call(tok);
r = await patch(uid, { ipSecurityEnabled: true }); t('ip: switch on with addresses listed', r.s === 200, JSON.stringify(r.j));
r = await live('GET', '/users/me'); t('ip: a request from an address not on the list is refused -> 401 Authentication required (UR-016)', r.s === 401 && r.j?.error === 'Authentication required', JSON.stringify(r));
r = await post('/auth/login', { email, password: PW + 'x' }); t('ip: sign in from an address not on the list is refused like a failed sign-in -> 401 Invalid email or password (UR-016)', r.s === 401 && r.j?.error === 'Invalid email or password', JSON.stringify(r));
r = await A('DELETE', `/users/employee-login/${uid}/ips/${ipid}`); t('ip: remove one of two addresses', r.s === 200, r.s);
const left = (await A('GET', `/users/employee-login/${uid}/ips`)).j.data[0];
r = await A('DELETE', `/users/employee-login/${uid}/ips/${left.id}`); t('ip: removing the last address while IP security is on -> 409', r.s === 409, r.s);
r = await A('DELETE', `/users/employee-login/${uid}/ips/${NIL}`); t('ip: delete unknown -> 404', r.s === 404, r.s);
r = await patch(uid, { ipSecurityEnabled: false }); t('ip: switch off', r.s === 200, r.s);
r = await live('GET', '/users/me'); t('ip: access is back after switching off', r.s === 200, r.s);

// ---------- Injection and bad input in the list endpoints ----------
const t0 = Date.now();
r = await A('GET', "/users?pageSize=1;select pg_sleep(4)--"); t('users list: text in pageSize cannot reach SQL (no 500, no delay)', r.s === 200 && Date.now() - t0 < 3000, r.s + ' ' + (Date.now() - t0) + 'ms');
r = await A('GET', '/users?pageSize=99999&page=-5'); t('users list: huge page size and negative page are clamped', r.s === 200 && r.j.data.length <= 500, r.s);
r = await A('GET', '/users?projectId=x'); t('users list: bad projectId -> 400', r.s === 400, r.s);
r = await A('GET', `/users?projectId=${proj}`); t('users list: filter by project works', r.s === 200 && r.j.data.some(x => x.id === uid), r.s + ' ' + r.j?.data?.length);
r = await A('GET', "/users/activity?period=1' day'); select pg_sleep(4)--"); t('activity: text in period cannot reach SQL', r.s === 200, r.s);
r = await A('GET', '/users/activity?period=7'); t('activity: normal period', r.s === 200, r.s);
r = await A('GET', '/users/nope'); t('user: bad id -> 404', r.s === 404, r.s);
r = await A('GET', '/users/' + NIL); t('user: unknown id -> 404', r.s === 404, r.s);

// ---------- Audit log ----------
r = await A('GET', '/users/audit-logs?action=login&pageSize=5'); t('audit: sign ins are recorded with the user name', r.s === 200 && r.j.data.length > 0 && r.j.data.every(x => x.action === 'login') && r.j.data.some(x => x.user_name), JSON.stringify(r.j).slice(0, 160));
r = await A('GET', '/users/audit-logs?action=LOGIN&pageSize=1'); t('audit: action filter ignores letter case', r.s === 200 && r.j.data.length === 1, r.s);
r = await A('GET', '/users/audit-logs?resourceType=role&action=create'); t('audit: role creation is logged', r.s === 200 && r.j.data.length > 0, r.s);
r = await A('GET', '/users/audit-logs?resourceType=user&userId=' + me.id); t('audit: user changes are logged against the admin', r.s === 200 && r.j.data.length > 0, r.s);
const logs = JSON.stringify((await A('GET', '/users/audit-logs?resourceType=user&pageSize=200')).j);
t('audit: no password or hash is ever written to the log', !/\$2[aby]\$/.test(logs) && !logs.includes(PW), '');
const today = bizToday();
r = await A('GET', `/users/audit-logs?fromDate=${today}&toDate=${today}&pageSize=3`); t('audit: date range today finds rows (To date is inclusive)', r.s === 200 && r.j.data.length > 0, r.s);
r = await A('GET', '/users/audit-logs?fromDate=2000-01-01&toDate=2000-01-02'); t('audit: old date range is empty', r.s === 200 && r.j.data.length === 0, r.s);
r = await A('GET', '/users/audit-logs?fromDate=yesterday'); t('audit: bad date -> 400', r.s === 400, r.s);
r = await A('GET', '/users/audit-logs?userId=x'); t('audit: bad userId -> 400', r.s === 400, r.s);
r = await PM('GET', '/users/audit-logs'); t('audit: project_manager cannot read the log (UR-001, super_admin only)', r.s === 403, r.s);
r = await SE('GET', '/users/audit-logs'); t('audit: sales_executive may not -> 403', r.s === 403, r.s);
r = await A('POST', '/users/audit-logs', { action: 'create' }); t('audit: the log cannot be written from outside', r.s === 404, r.s);

// ---------- Password change by the user ----------
r = await post('/users/' + uid + '/change-password', { newPassword: 'short1' }, tok); t('change password: weak -> 400', r.s === 400, r.s);
r = await post('/users/' + uid + '/change-password', { newPassword: PW + 'y' }, tok); t('change password: current password required -> 400', r.s === 400, r.s);
r = await post('/users/' + uid + '/change-password', { newPassword: PW + 'y', currentPassword: 'wrong' }, tok); t('change password: wrong current -> 401', r.s === 401, r.s);
r = await post('/users/' + me.id + '/change-password', { newPassword: PW + 'y', currentPassword: PW + 'x' }, tok); t('change password: cannot change someone else\'s -> 403', r.s === 403, r.s);
r = await post('/users/' + uid + '/change-password', { newPassword: PW + 'y', currentPassword: PW + 'x' }, tok); t('change password: own password with the current one', r.s === 200, r.s);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`); if (fails.length) console.log('FAILED:\n' + fails.join('\n'));
process.exit(fail ? 1 : 0);
