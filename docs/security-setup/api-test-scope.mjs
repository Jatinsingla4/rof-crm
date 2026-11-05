// Project scope: a login assigned to projects sees and changes only those projects (row level security).
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-scope.mjs
// Needs psql (PSQL, PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE) to put rows straight into the database.
import { execFileSync } from 'node:child_process';
const B = process.env.BASE || 'http://localhost:3010/api';
const PSQL = process.env.PSQL || 'psql';
const sql = (q) => execFileSync(PSQL, ['-X', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8' }).trim();
let pass = 0, fail = 0; const fails = [];
const t = (n, ok, x = '') => { ok ? pass++ : (fail++, fails.push(n + ' -> ' + x)); console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };
const post = async (p, b) => { const r = await fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => null) }; };
const login = async (email, password = 'Test#Pass1234') => (await post('/auth/login', { email, password })).j?.token;
const call = tok => async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: b === undefined ? undefined : JSON.stringify(b) }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const A = call(await login('super_admin@test.local'));
const U = Date.now().toString(36).slice(-6);
const PW = 'Scope#Pass' + U.replace(/\D/g, '') + '1';
const rows = (r) => r.j?.data?.consumers || r.j?.data?.units || r.j?.data?.receipts || r.j?.data || [];
const has = (r, id) => rows(r).some((x) => x.id === id);
let r;

// ---------- the guard: every table that points at a project, consumer or unit is covered ----------
const uncovered = sql(`SELECT string_agg(c.relname, ', ') FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relispartition
    AND (c.relname = 'projects' OR EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attname IN ('project_id','consumer_id','unit_id') AND a.atttypid = 'uuid'::regtype AND NOT a.attisdropped))
    AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname AND p.policyname = 'rof_project_scope')`);
t('every table with project_id, consumer_id or unit_id has a project scope policy (add: SELECT rof_apply_project_scope(); to your migration)', uncovered === '', uncovered);
t('no view or materialized view in public (a view would run as its owner and skip the scope)', sql(`SELECT count(*) FROM (SELECT 1 FROM pg_views WHERE schemaname='public' UNION ALL SELECT 1 FROM pg_matviews WHERE schemaname='public') v`) === '0');
t('the limited role cannot bypass row level security', sql(`SELECT rolbypassrls OR rolsuper FROM pg_roles WHERE rolname = 'rof_app'`) === 'f');

// ---------- data: two projects, each with a unit, an applicant and a receipt ----------
const CO = (await A('POST', '/companies', { name: 'Scope Co ' + U })).j.data.id;
const mk = async (tag) => {
  const pid = (await A('POST', '/projects', { companyId: CO, name: `Scope ${tag} ${U}`, reraNumber: `SC${tag}-${U}`, tcpLicence: 'x' })).j.data.id;
  const tid = (await A('POST', `/projects/${pid}/towers`, { towerName: 'T' + tag })).j.data.id;
  const uid = (await A('POST', '/units', { projectId: pid, towerId: tid, floor: 1, unitNumber: `${tag}-101`, bhkType: '2BHK', carpetAreaSqft: 500 })).j.data.id;
  const cid = sql(`INSERT INTO consumers (name, mobile, project_id) VALUES ('Scope Person ${tag} ${U}', lpad((random()*1e9)::int::text, 10, '9') || '', '${pid}') RETURNING id`).split('\n')[0];
  const alloc = sql(`INSERT INTO allocations (consumer_id, unit_id, project_id) VALUES ('${cid}', '${uid}', '${pid}') RETURNING id`).split('\n')[0];
  const plan = sql(`INSERT INTO payment_plans (allocation_id, consumer_id, unit_id, project_id, total_amount_inr) VALUES ('${alloc}', '${cid}', '${uid}', '${pid}', 100000) RETURNING id`).split('\n')[0];
  const rid = sql(`INSERT INTO receipts (consumer_id, payment_plan_id, amount_received_inr, received_date) VALUES ('${cid}', '${plan}', 1000, CURRENT_DATE) RETURNING id`).split('\n')[0];
  return { pid, tid, uid, cid, rid };
};
const P1 = await mk('A'), P2 = await mk('B');
const newUser = async (tag, role, projectIds) => {
  const email = `scope.${tag}.${U}@example.com`;
  const x = await A('POST', '/users/employee-login', { username: `scope_${tag}_${U}`, email, password: PW, confirmPassword: PW, role, assignedProjectIds: projectIds, unitStatusAccess: 'all', authorizedPrint: true, authorizedDownload: true });   // capability grants are their own gates; this login tests project scope
  return { id: x.j?.data?.userId, call: call(await login(email, PW)), email };
};
const one = await newUser('one', 'sales_executive', [P1.pid]);
const both = await newUser('both', 'sales_executive', [P1.pid, P2.pid]);
const none = await newUser('none', 'sales_executive', []);
const pm = await newUser('pm', 'project_manager', [P1.pid]);
t('setup: users created', !!(one.id && both.id && none.id && pm.id));

// ---------- a login assigned to project 1 ----------
r = await one.call('GET', '/projects'); t('projects list: only the assigned project', has(r, P1.pid) && !has(r, P2.pid), r.s + ' ' + rows(r).length);
r = await one.call('GET', '/projects/' + P2.pid); t('project detail: another project -> 404', r.s === 404, r.s);
r = await one.call('GET', '/projects/' + P1.pid); t('project detail: own project -> 200', r.s === 200, r.s);
r = await one.call('GET', '/units?pageSize=500'); t('units list: own unit yes, other project no', has(r, P1.uid) && !has(r, P2.uid), r.s);
r = await one.call('GET', `/units?projectId=${P2.pid}`); t('units list: asking for the other project gives nothing', r.s === 200 && rows(r).length === 0, rows(r).length);
r = await one.call('GET', '/units/' + P2.uid); t('unit detail: other project -> 404', r.s === 404, r.s);
r = await one.call('GET', '/consumers?limit=500&pageSize=500'); t('applicants list: own yes, other project no', has(r, P1.cid) && !has(r, P2.cid), r.s);
r = await one.call('GET', '/consumers/' + P2.cid); t('applicant detail: other project -> 404', r.s === 404, r.s);
r = await one.call('GET', '/consumers/' + P1.cid); t('applicant detail: own -> 200', r.s === 200, r.s);
r = await one.call('PATCH', '/consumers/' + P2.cid, { email: 'x@example.com' }); t('applicant edit: other project refused, nothing changed', [403, 404].includes(r.s) && sql(`SELECT count(*) FROM consumers WHERE id='${P2.cid}' AND email='x@example.com'`) === '0', r.s);
r = await one.call('PATCH', '/units/' + P2.uid, { carpetAreaSqft: 999 }); t('unit edit: other project refused', [403, 404].includes(r.s) && sql(`SELECT carpet_area_sqft FROM units WHERE id='${P2.uid}'`) !== '999', r.s);
r = await one.call('POST', '/units', { projectId: P2.pid, towerId: P2.tid, floor: 2, unitNumber: 'B-hack', bhkType: '2BHK', carpetAreaSqft: 500 }); t('unit add: into another project refused', [403, 404].includes(r.s) && sql(`SELECT count(*) FROM units WHERE unit_number='B-hack'`) === '0', r.s + ' ' + JSON.stringify(r.j));
r = await one.call('GET', '/payments/receipts'); t('receipts: only receipts of own project applicants', r.s === 200 && has(r, P1.rid) && !has(r, P2.rid), r.s + ' ' + rows(r).length);
r = await one.call('POST', '/projects', { companyId: CO, name: 'Scope New ' + U, reraNumber: 'SN-' + U, tcpLicence: 'x' }); t('project add: a limited login cannot create a project -> 403', r.s === 403, r.s);
r = await one.call('GET', '/dashboard/summary'); t('dashboard still loads', r.s === 200, r.s);
r = await one.call('POST', `/consumers/${P1.cid}/multi-applicants`, { applicants: [] }); t('a route that holds its own connection works for the limited login', r.s !== 500 && r.s !== 403, r.s + ' ' + JSON.stringify(r.j).slice(0, 100));
r = await one.call('POST', `/consumers/${P2.cid}/multi-applicants`, { applicants: [] });
// the connection must come back clean: after many limited requests an unlimited one still sees everything
await Promise.all(Array.from({ length: 24 }, () => one.call('GET', '/projects')));
r = await A('GET', '/projects'); t('after many limited requests the unlimited admin still sees both projects', has(r, P1.pid) && has(r, P2.pid), rows(r).length);
// each project asked for by itself: the test database holds thousands of units after the other test scripts, and one page would miss these two
r = await A('GET', `/units?projectId=${P1.pid}&pageSize=500`); const u1ok = has(r, P1.uid); r = await A('GET', `/units?projectId=${P2.pid}&pageSize=500`); t('and both units', u1ok && has(r, P2.uid));
r = await A('GET', '/consumers?limit=500&pageSize=500'); t('and both applicants', has(r, P1.cid) && has(r, P2.cid));

// ---------- the other logins ----------
r = await both.call('GET', '/projects'); t('assigned to two projects: sees both', has(r, P1.pid) && has(r, P2.pid), rows(r).length);
r = await none.call('GET', '/projects'); t('assigned to none: sees every project (unchanged behaviour)', has(r, P1.pid) && has(r, P2.pid), rows(r).length);
r = await none.call('GET', '/consumers?limit=500&pageSize=500'); t('assigned to none: sees every applicant', has(r, P1.cid) && has(r, P2.cid));
r = await pm.call('GET', '/projects/' + P2.pid); t('project manager is limited too -> 404 on another project', r.s === 404, r.s);
r = await pm.call('PATCH', '/projects/' + P2.pid, { name: 'Hijack ' + U }); t('project manager cannot edit another project', [403, 404].includes(r.s) && sql(`SELECT count(*) FROM projects WHERE name='Hijack ${U}'`) === '0', r.s);

// ---------- changes apply at once, and super admin is never limited ----------
r = await A('PATCH', '/users/employee-login/' + one.id, { assignedProjectIds: [P1.pid, P2.pid] }); t('admin adds project 2 to the login', r.s === 200, r.s);
r = await one.call('GET', '/projects/' + P2.pid); t('takes effect on the next request, no new sign in', r.s === 200, r.s);
r = await A('PATCH', '/users/employee-login/' + one.id, { assignedProjectIds: [] }); r = await one.call('GET', '/projects/' + P2.pid); t('clearing the projects opens everything again', r.s === 200, r.s);
r = await A('PATCH', '/users/employee-login/' + one.id, { assignedProjectIds: [P1.pid] }); r = await one.call('GET', '/projects/' + P2.pid); t('limited again', r.s === 404, r.s);
const me = (await A('GET', '/users/me')).j.data;
await A('PATCH', '/users/employee-login/' + me.id, { assignedProjectIds: [P1.pid] });
r = await A('GET', '/projects/' + P2.pid); t('super admin ignores its own project list', r.s === 200, r.s);
await A('PATCH', '/users/employee-login/' + me.id, { assignedProjectIds: [] });
sql(`UPDATE users SET assigned_project_ids = '["${'00000000-0000-0000-0000-0000000000aa'}"]' WHERE id = '${both.id}'`);
await new Promise((res) => setTimeout(res, 16000)); // the sign-in cache lasts 15 seconds
r = await both.call('GET', '/projects'); t('assigned only to a project that does not exist: sees nothing, not everything', r.s === 200 && !has(r, P1.pid) && !has(r, P2.pid), r.s + ' ' + rows(r).length);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`); if (fails.length) console.log('FAILED:\n' + fails.join('\n'));
process.exit(fail ? 1 : 0);
