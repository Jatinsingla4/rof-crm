// Employees checks: departments, employee profiles, who reports to whom, teams.
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-employees.mjs
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
const PW = 'Emp#Pass' + U.replace(/\D/g, '') + '1';
let r;

// people (logins) to work with
const mkUser = async (tag, role = 'sales_executive') => {
  const email = `emp.${tag}.${U}@example.com`;
  const x = await A('POST', '/users/employee-login', { username: `emp_${tag}_${U}`, email, password: PW, confirmPassword: PW, role });
  return { id: x.j?.data?.userId, email };
};
const u1 = await mkUser('a'), u2 = await mkUser('b'), u3 = await mkUser('c'), u4 = await mkUser('d');
const me = (await A('GET', '/users/me')).j.data;

// ---------- who may do what ----------
r = await SE('GET', '/employees'); t('roles: sales_executive cannot read employee profiles -> 403', r.s === 403, r.s);
r = await SE('GET', '/employees/departments'); t('roles: sales_executive cannot read departments -> 403', r.s === 403, r.s);
r = await SE('GET', '/employees/directory'); t('directory: every signed-in user can read names', r.s === 200 && Array.isArray(r.j.data), r.s);
r = await PM('POST', '/employees/departments', { name: 'PM dept ' + U }); t('roles: project_manager cannot add a department -> 403', r.s === 403, r.s);
r = await PM('GET', '/employees/departments'); t('roles: project_manager cannot look (UR-001, super_admin only) -> 403', r.s === 403, r.s);

// ---------- departments ----------
const dn = 'Dept ' + U;
r = await A('POST', '/employees/departments', {}); t('department: no name -> 400', r.s === 400, r.s);
r = await A('POST', '/employees/departments', { name: '<b>x' }); t('department: markup -> 400', r.s === 400, r.s);
r = await A('POST', '/employees/departments', { name: 'x'.repeat(151) }); t('department: name over 150 -> 400', r.s === 400, r.s);
r = await A('POST', '/employees/departments', { name: dn, description: 'x'.repeat(501) }); t('department: description over 500 -> 400', r.s === 400, r.s);
r = await A('POST', '/employees/departments', { name: dn, head_user_id: NIL }); t('department: unknown head -> 400', r.s === 400, r.s);
r = await A('POST', '/employees/departments', { name: dn, head_user_id: u1.id, description: 'Sales people' }); t('department: add with a head', r.s === 201 && r.j.data.head_user_id === u1.id, JSON.stringify(r.j)); const d1 = r.j?.data?.id;
r = await A('POST', '/employees/departments', { name: dn.toUpperCase() }); t('department: same name other case -> 409', r.s === 409, r.s);
r = await A('PATCH', '/employees/departments/' + d1, { name: dn + ' Renamed' }); t('department: renaming keeps the head (was cleared before)', r.s === 200 && r.j.data.head_user_id === u1.id && r.j.data.description === 'Sales people', JSON.stringify(r.j));
r = await A('PATCH', '/employees/departments/' + d1, { head_user_id: null }); t('department: head can be cleared on purpose', r.s === 200 && r.j.data.head_user_id === null, JSON.stringify(r.j));
r = await A('PATCH', '/employees/departments/' + d1, {}); t('department: edit with nothing -> 400', r.s === 400, r.s);
r = await A('PATCH', '/employees/departments/' + d1, { is_active: 'no' }); t('department: is_active must be true/false -> 400', r.s === 400, r.s);
r = await A('PATCH', '/employees/departments/abc', { name: 'x' }); t('department: bad id -> 404', r.s === 404, r.s);
r = await A('PATCH', '/employees/departments/' + NIL, { name: 'x' + U }); t('department: unknown -> 404', r.s === 404, r.s);
const d2 = (await A('POST', '/employees/departments', { name: 'Other ' + U })).j.data.id;
r = await A('PATCH', '/employees/departments/' + d2, { name: (dn + ' Renamed').toLowerCase() }); t('department: rename to an existing name -> 409', r.s === 409, r.s);
r = await A('PATCH', '/employees/departments/' + d2, { is_active: false }); t('department: mark inactive', r.s === 200 && r.j.data.is_active === false, r.s);
r = await A('PATCH', '/employees/departments/' + d2, { is_active: true });

// ---------- employee profiles ----------
const code = 'EMP-' + U;
const pf = (o = {}) => ({ user_id: u1.id, department_id: d1, employee_code: code, designation: 'Sales Manager', joining_date: '2024-04-01', mobile_office: '98765 43210', mobile_personal: '90000 11111', emergency_contact: '90000 22222', salary_grade: 'G4', address: '12 MG Road', city: 'Gurugram', state: 'Haryana', ...o });
const badEmp = async (n, o, re) => { const x = await A('POST', '/employees', pf(o)); t('employee: ' + n, x.s === 400 && (!re || re.test(x.j.error)), x.s + ' ' + JSON.stringify(x.j)); };
await badEmp('no user', { user_id: undefined });
await badEmp('unknown user', { user_id: NIL });
await badEmp('code with spaces', { employee_code: 'A B' }, /code/i);
await badEmp('code over 50', { employee_code: 'x'.repeat(51) });
await badEmp('designation over 150', { designation: 'x'.repeat(151) });
await badEmp('bad office mobile', { mobile_office: 'abc' }, /mobile/i);
await badEmp('bad personal mobile', { mobile_personal: '12' });
await badEmp('bad emergency contact', { emergency_contact: 'call me' });
await badEmp('bad joining date', { joining_date: '31-12-2024' }, /date/i);
await badEmp('markup in address', { address: '<script>' });
await badEmp('unknown department', { department_id: NIL }, /Department/);
await badEmp('unknown manager', { manager_id: NIL }, /Manager/);
await badEmp('manager is the person', { manager_id: u1.id }, /own manager/);
r = await A('POST', '/employees', pf()); t('employee: add', r.s === 201 && r.j.data.user_id === u1.id, JSON.stringify(r.j)); const e1 = r.j?.data?.id;
r = await A('POST', '/employees', pf()); t('employee: a second profile for the same person -> 409', r.s === 409, r.s);
r = await A('POST', '/employees', pf({ user_id: u2.id, employee_code: code.toLowerCase() })); t('employee: same code other case -> 409', r.s === 409, r.s);
r = await A('POST', '/employees', pf({ user_id: u2.id, employee_code: code + 'B', manager_id: u1.id, designation: 'Executive' })); t('employee: add with a manager', r.s === 201 && r.j.data.manager_id === u1.id, JSON.stringify(r.j)); const e2 = r.j?.data?.id;
r = await A('POST', '/employees', pf({ user_id: u3.id, employee_code: code + 'C', manager_id: u2.id, department_id: null, designation: 'Trainee' })); const e3 = r.j?.data?.id;
t('employee: add with no department', r.s === 201 && r.j.data.department_id === null, JSON.stringify(r.j));

// partial edit: the fields not sent stay (a bug before: editing anything cleared the manager)
r = await A('PATCH', '/employees/' + e2, { designation: 'Senior Executive' }); t('employee edit: one field changes, the manager stays', r.s === 200 && r.j.data.designation === 'Senior Executive' && r.j.data.manager_id === u1.id && r.j.data.employee_code === code + 'B', JSON.stringify(r.j));
r = await A('PATCH', '/employees/' + e2, { mobile_personal: null }); t('employee edit: a field can be cleared with null', r.s === 200 && r.j.data.mobile_personal === null, JSON.stringify(r.j));
r = await A('PATCH', '/employees/' + e2, {}); t('employee edit: nothing to update -> 400', r.s === 400, r.s);
r = await A('PATCH', '/employees/' + u2.id, { city: 'Delhi' }); t('employee edit: by login id works too', r.s === 200 && r.j.data.city === 'Delhi', r.s);
r = await A('PATCH', '/employees/' + e2, { employee_code: code }); t('employee edit: a code another person has -> 409', r.s === 409, r.s);
r = await A('PATCH', '/employees/' + e2, { employee_code: code + 'B' }); t('employee edit: its own code again is fine', r.s === 200, r.s);
r = await A('PATCH', '/employees/' + e2, { is_active: 'yes' }); t('employee edit: is_active must be true/false -> 400', r.s === 400, r.s);
r = await A('PATCH', '/employees/' + NIL, { city: 'x' }); t('employee edit: unknown -> 404', r.s === 404, r.s);
r = await A('PATCH', '/employees/abc', { city: 'x' }); t('employee edit: bad id -> 404', r.s === 404, r.s);
r = await PM('PATCH', '/employees/' + e2, { city: 'x' }); t('employee edit: project_manager -> 403', r.s === 403, r.s);

// who sees what
r = await A('GET', '/employees/' + e1); t('details: super_admin sees pay and private contacts', r.s === 200 && r.j.data.salary_grade === 'G4' && r.j.data.emergency_contact && r.j.data.address, JSON.stringify(r.j).slice(0, 120));
r = await PM('GET', '/employees/' + e1); t('details: project_manager cannot open a profile at all (UR-001) -> 403', r.s === 403, r.s);
r = await PM('GET', '/employees?search=' + code); t('list: project_manager cannot list profiles (UR-001) -> 403', r.s === 403, JSON.stringify(r.j).slice(0, 100));
r = await SE('GET', '/employees/directory'); t('directory: names only, no pay or private details', r.s === 200 && r.j.data.length >= 3 && !JSON.stringify(r.j).includes('salary_grade') && !JSON.stringify(r.j).includes('mobile'), JSON.stringify(r.j.data[0]));
t('directory: its id is the login id (what bookings and calls store)', r.j.data.some((x) => x.id === u1.id));
r = await A('GET', '/employees/' + NIL); t('details: unknown -> 404', r.s === 404, r.s);
r = await A('GET', '/employees?department_id=x'); t('list: bad department filter -> 400', r.s === 400, r.s);
r = await A('GET', '/employees?department_id=' + d1); t('list: filter by department', r.s === 200 && r.j.data.every((x) => x.department_id === d1) && r.j.data.length === 2, r.j.data?.length);
r = await A('GET', '/employees?search=' + encodeURIComponent('%')); t('list: % in the search is text', r.s === 200 && r.j.data.length === 0, r.j.data?.length);
r = await A('GET', '/employees?search=' + code + 'B'); t('list: search by code', r.s === 200 && r.j.data.length === 1 && r.j.data[0].manager_name, JSON.stringify(r.j.data[0]?.manager_name));

// ---------- who reports to whom ----------
r = await A('PATCH', `/employees/${e1}/set-manager`, { manager_id: u2.id }); t('manager: a person cannot be managed by their own reportee (loop) -> 400', r.s === 400 && /loop/.test(r.j.error), JSON.stringify(r.j));
r = await A('PATCH', `/employees/${e1}/set-manager`, { manager_id: u3.id }); t('manager: nor by someone further down (loop through two) -> 400', r.s === 400, r.s);
r = await A('PATCH', `/employees/${e1}/set-manager`, { manager_id: u1.id }); t('manager: nor by themselves -> 400', r.s === 400, r.s);
r = await A('PATCH', `/employees/${e1}`, { manager_id: u3.id }); t('manager: the loop check works from the edit form too -> 400', r.s === 400, r.s);
r = await A('PATCH', `/employees/${e1}/set-manager`, { manager_id: NIL }); t('manager: unknown -> 400', r.s === 400, r.s);
r = await A('PATCH', `/employees/${NIL}/set-manager`, { manager_id: u1.id }); t('manager: unknown employee -> 404', r.s === 404, r.s);
r = await A('PATCH', `/employees/${e3}/set-manager`, { manager_id: u1.id }); t('manager: change a manager', r.s === 200 && r.j.data.manager_id === u1.id, JSON.stringify(r.j));
r = await A('PATCH', `/employees/${e3}/set-manager`, { manager_id: null }); t('manager: clear a manager', r.s === 200 && r.j.data.manager_id === null, JSON.stringify(r.j));
await A('PATCH', `/employees/${e3}/set-manager`, { manager_id: u2.id });
r = await A('GET', '/employees/tree'); const find = (nodes, id) => { for (const n of nodes) { if (n.id === id) return n; const f = find(n.children || [], id); if (f) return f; } return null; };
t('org chart: reportees sit under their manager', r.s === 200 && find(r.j.data, u1.id)?.children.some((c) => c.id === u2.id) && find(r.j.data, u2.id)?.children.some((c) => c.id === u3.id), r.s);
// old data with a loop must not make people vanish
await A('PATCH', `/employees/${e1}`, { manager_id: null });
const { execFileSync } = await import('node:child_process');
const sql = (q) => execFileSync(process.env.PSQL || 'psql', ['-X', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8' }).trim();
sql(`UPDATE employee_profiles SET manager_id = '${u2.id}' WHERE user_id = '${u1.id}'`);
r = await A('GET', '/employees/tree'); t('org chart: people in an old loop still show (nobody vanishes)', r.s === 200 && !!find(r.j.data, u1.id) && !!find(r.j.data, u2.id) && !!find(r.j.data, u3.id), r.s);
sql(`UPDATE employee_profiles SET manager_id = NULL WHERE user_id = '${u1.id}'`);
r = await A('GET', '/employees/report'); t('report: counts per department, and people with no department are listed', r.s === 200 && r.j.data.find((x) => x.department === dn + ' Renamed')?.total === 2 && r.j.data.some((x) => x.department === 'No department' && x.total >= 1), JSON.stringify(r.j.data.slice(0, 3)));

// ---------- an employee who leaves ----------
const lg = await login(u4.email, PW);
r = await A('POST', '/employees', pf({ user_id: u4.id, employee_code: code + 'D', manager_id: null })); const e4 = r.j?.data?.id;
r = await call(lg)('GET', '/users/me'); t('leaver: the login works before', r.s === 200, r.s);
r = await A('PATCH', '/employees/' + e4, { is_active: false }); t('leaver: switching the employee off', r.s === 200 && r.j.data.is_active === false, JSON.stringify(r.j));
r = await call(lg)('GET', '/users/me'); t('leaver: the login stops at once (session ended)', r.s === 401, r.s);
r = await post('/auth/login', { email: u4.email, password: PW }); t('leaver: cannot sign in again', r.s === 401, r.s);
r = await A('GET', '/employees/tree'); t('leaver: not in the org chart', !find(r.j.data, u4.id));
r = await A('GET', '/employees/directory'); t('leaver: not in the directory', !r.j.data.some((x) => x.id === u4.id));
r = await A('PATCH', '/employees/' + e4, { is_active: true }); t('leaver: switching the employee back on needs reviewedGrants -> 409 (UR-011)', r.s === 409, r.s);
r = await A('PATCH', '/employees/' + e4, { is_active: true, reviewedGrants: true }); t('leaver: switching the employee back on', r.s === 200, r.s);
r = await post('/auth/login', { email: u4.email, password: PW }); t('leaver: the login works again', r.s === 200, r.s);
await A('POST', '/employees', pf({ user_id: me.id, employee_code: code + 'ME', department_id: null })); r = await A('PATCH', '/employees/' + me.id, { is_active: false });
t('leaver: you cannot switch yourself off -> 400', r.s === 400, r.s + ' ' + JSON.stringify(r.j));

// ---------- teams ----------
const tn = 'Team ' + U;
r = await A('POST', '/employees/teams', {}); t('team: no name -> 400', r.s === 400, r.s);
r = await A('POST', '/employees/teams', { name: '<x>' }); t('team: markup -> 400', r.s === 400, r.s);
r = await A('POST', '/employees/teams', { name: tn, department_id: NIL }); t('team: unknown department -> 400', r.s === 400, r.s);
r = await A('POST', '/employees/teams', { name: tn, team_head_id: NIL }); t('team: unknown head -> 400', r.s === 400, r.s);
r = await A('POST', '/employees/teams', { name: tn, department_id: d1, team_head_id: u1.id }); t('team: add with a head', r.s === 201 && r.j.data.team_head_id === u1.id, JSON.stringify(r.j)); const t1 = r.j?.data?.id;
r = await A('POST', '/employees/teams', { name: tn.toUpperCase(), department_id: d1 }); t('team: same name in the same department -> 409', r.s === 409, r.s);
r = await A('POST', '/employees/teams', { name: tn, department_id: d2 }); t('team: same name in another department is fine', r.s === 201, r.s); const t2 = r.j?.data?.id;
r = await A('GET', `/employees/teams/${t1}/members`); t('team: the head is a member automatically', r.s === 200 && r.j.data.length === 1 && r.j.data[0].user_id === u1.id && r.j.data[0].role_in_team === 'head', JSON.stringify(r.j.data));
r = await A('PATCH', '/employees/teams/' + t1, { description: 'North zone' }); t('team edit: the head stays when only the description is sent (was cleared before)', r.s === 200 && r.j.data.team_head_id === u1.id && r.j.data.department_id === d1, JSON.stringify(r.j));
r = await A('PATCH', '/employees/teams/' + t1, {}); t('team edit: nothing to update -> 400', r.s === 400, r.s);
r = await A('PATCH', '/employees/teams/' + t1, { is_active: 1 }); t('team edit: is_active must be true/false -> 400', r.s === 400, r.s);
r = await A('PATCH', '/employees/teams/' + NIL, { name: 'x' }); t('team edit: unknown -> 404', r.s === 404, r.s);
r = await A('POST', `/employees/teams/${t1}/members`, { user_id: u2.id, role_in_team: 'Closer' }); t('members: add one with a role', r.s === 201 && r.j.data.role_in_team === 'Closer', JSON.stringify(r.j));
r = await A('POST', `/employees/teams/${t1}/members`, { user_id: u2.id }); r = await A('GET', `/employees/teams/${t1}/members`); t('members: adding the same person twice keeps one row', r.j.data.filter((m) => m.user_id === u2.id).length === 1, r.j.data.length);
r = await A('POST', `/employees/teams/${t1}/members`, { user_id: NIL }); t('members: unknown person -> 400', r.s === 400, r.s);
r = await A('POST', `/employees/teams/${t1}/members`, {}); t('members: no person -> 400', r.s === 400, r.s);
r = await A('POST', `/employees/teams/${t1}/members`, { user_id: u2.id, role_in_team: 'head' }); t('members: "head" is set through Set head, not as a role -> 400', r.s === 400, r.s);
r = await A('POST', `/employees/teams/${NIL}/members`, { user_id: u2.id }); t('members: unknown team -> 404', r.s === 404, r.s);
r = await A('PATCH', `/employees/teams/${t1}/set-head`, { team_head_id: u3.id }); t('head: change the head', r.s === 200 && r.j.data.team_head_id === u3.id, JSON.stringify(r.j));
r = await A('GET', `/employees/teams/${t1}/members`); const roles = Object.fromEntries(r.j.data.map((m) => [m.user_id, m.role_in_team]));
t('head: the new head is added as a member, the old one stays as a member', roles[u3.id] === 'head' && roles[u1.id] === 'member', JSON.stringify(roles));
r = await A('PATCH', `/employees/teams/${t1}/set-head`, { team_head_id: NIL }); t('head: unknown person -> 400', r.s === 400, r.s);
r = await A('GET', '/employees/teams'); t('teams: list counts members and shows the head', r.j.data.find((x) => x.id === t1)?.member_count === 3 && r.j.data.find((x) => x.id === t1)?.team_head_name, JSON.stringify(r.j.data.find((x) => x.id === t1)));
r = await A('GET', '/employees/teams?department_id=x'); t('teams: bad department filter -> 400', r.s === 400, r.s);
r = await A('DELETE', `/employees/teams/${t1}/members/${u3.id}`); t('members: removing the head clears the head', r.s === 200, r.s);
r = await A('GET', '/employees/teams'); t('members: the team then has no head', r.j.data.find((x) => x.id === t1)?.team_head_id === null);
r = await A('DELETE', `/employees/teams/${t1}/members/${u3.id}`); t('members: removing someone who is not in the team -> 404', r.s === 404, r.s);
r = await PM('POST', `/employees/teams/${t1}/members`, { user_id: u1.id }); t('members: project_manager cannot add -> 403', r.s === 403, r.s);

// ---------- deleting ----------
r = await A('DELETE', '/employees/departments/' + d1); t('department: in use by employees and a team -> 409', r.s === 409 && /employee/.test(r.j.error), JSON.stringify(r.j));
r = await PM('DELETE', '/employees/teams/' + t1); t('team: project_manager cannot delete -> 403', r.s === 403, r.s);
r = await A('DELETE', '/employees/teams/' + t1); t('team: delete', r.s === 200, r.s);
r = await A('DELETE', '/employees/teams/' + t1); t('team: delete again -> 404', r.s === 404, r.s);
r = await A('DELETE', '/employees/teams/' + t2);
r = await A('DELETE', '/employees/departments/' + d2); t('department: delete when nothing uses it', r.s === 200, r.s);
r = await A('DELETE', '/employees/departments/' + d2); t('department: delete again -> 404', r.s === 404, r.s);
r = await A('DELETE', '/employees/departments/abc'); t('department: bad id -> 404', r.s === 404, r.s);

// ---------- audit ----------
r = await A('GET', '/users/audit-logs?resourceType=employee&userId=' + me.id); t('audit: employee changes are logged', r.s === 200 && r.j.data.length > 0, r.s);
r = await A('GET', '/users/audit-logs?resourceType=department'); t('audit: department changes are logged', r.s === 200 && r.j.data.length > 0, r.s);
const logs = JSON.stringify((await A('GET', '/users/audit-logs?resourceType=employee&pageSize=200')).j);
t('audit: pay and private contacts never go into the log', !logs.includes('G4') && !logs.includes('12 MG Road') && !logs.includes('90000 22222'), '');

console.log(`\nRESULT: ${pass} passed, ${fail} failed`); if (fails.length) console.log('FAILED:\n' + fails.join('\n'));
process.exit(fail ? 1 : 0);
