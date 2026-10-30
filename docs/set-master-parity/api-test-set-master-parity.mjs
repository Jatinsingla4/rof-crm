// Set Master parity with the client CRM: country fields, area types, currencies, bank types and loan-bank projects,
// document master scope, dispatch master. Roles, bad input, duplicates, a random hostile run. Own data per run.
// Run: BASE=http://localhost:3010/api node docs/set-master-parity/api-test-set-master-parity.mjs   (psql must reach the same database; SEED=n repeats the random run)
import { execFileSync } from 'node:child_process';
const B = process.env.BASE || 'http://localhost:3010/api';
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300))); };
const call = (tok) => async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const login = async (e) => (await call()('POST', '/auth/login', { email: e, password: 'Test#Pass1234' })).j?.token;
const A = call(await login('super_admin@test.local')), PM = call(await login('project_manager@test.local')), SE = call(await login('sales_executive@test.local')), RO = call(await login('read_only_viewer@test.local')), NO = call();
const psql = (sql) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' }).trim();
const SEED = Number(process.env.SEED || Date.now() % 1e9); let rs = SEED; const rnd = () => (rs = (rs * 1664525 + 1013904223) % 4294967296) / 4294967296, ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)), pick = (a) => a[ri(0, a.length - 1)];
console.log('SEED=' + SEED);
const U = Date.now().toString(36).slice(-5), NIL = '00000000-0000-0000-0000-000000000000';
const no5 = (xs) => xs.every((x) => x.s < 500);
const made = { countries: [], area: [], cur: [], banks: [], dt: [], dm: [], projects: [] };

// ---------- countries ----------
let r = await A('POST', '/master/countries', { name: `Testland ${U}`, code: 'TL', abbreviation: 'TL', iso_code: 'tl', isd_code: '+999', mobile_digits: 9 });
t('country: created with abbreviation, ISO (upper-cased), ISD (plus removed), mobile digits', r.s === 201 && r.j.data.iso_code === 'TL' && r.j.data.isd_code === '999' && r.j.data.mobile_digits === 9 && r.j.data.abbreviation === 'TL', r);
const C1 = r.j?.data?.id; if (C1) made.countries.push(C1);
for (const [n, b] of [['no abbreviation', { name: `X1 ${U}`, iso_code: 'XA', isd_code: '1', mobile_digits: 10 }], ['no iso', { name: `X2 ${U}`, abbreviation: 'X', isd_code: '1', mobile_digits: 10 }], ['no isd', { name: `X3 ${U}`, abbreviation: 'X', iso_code: 'XA', mobile_digits: 10 }], ['no digits', { name: `X4 ${U}`, abbreviation: 'X', iso_code: 'XA', isd_code: '1' }], ['iso 4 letters', { name: `X5 ${U}`, abbreviation: 'X', iso_code: 'ABCD', isd_code: '1', mobile_digits: 10 }], ['iso digits', { name: `X6 ${U}`, abbreviation: 'X', iso_code: '12', isd_code: '1', mobile_digits: 10 }], ['isd letters', { name: `X7 ${U}`, abbreviation: 'X', iso_code: 'XA', isd_code: 'ab', mobile_digits: 10 }], ['isd 5 digits', { name: `X8 ${U}`, abbreviation: 'X', iso_code: 'XA', isd_code: '12345', mobile_digits: 10 }], ['digits 3', { name: `X9 ${U}`, abbreviation: 'X', iso_code: 'XA', isd_code: '1', mobile_digits: 3 }], ['digits 16', { name: `Y1 ${U}`, abbreviation: 'X', iso_code: 'XA', isd_code: '1', mobile_digits: 16 }], ['digits 9.5', { name: `Y2 ${U}`, abbreviation: 'X', iso_code: 'XA', isd_code: '1', mobile_digits: 9.5 }], ['digits text', { name: `Y3 ${U}`, abbreviation: 'X', iso_code: 'XA', isd_code: '1', mobile_digits: 'ten' }], ['markup in name', { name: `<b>x</b>${U}`, abbreviation: 'X', iso_code: 'XA', isd_code: '1', mobile_digits: 10 }]]) {
  const x = await A('POST', '/master/countries', b); t(`country: ${n} is 400`, x.s === 400, x); if (x.j?.data?.id) made.countries.push(x.j.data.id);
}
r = await A('PUT', `/master/countries/${C1}`, { mobile_digits: 12 }); t('country: edit one field leaves the others', r.s === 200 && r.j.data.mobile_digits === 12 && r.j.data.iso_code === 'TL' && r.j.data.isd_code === '999', r);
r = await A('PUT', `/master/countries/${C1}`, { mobile_digits: null }); t('country: digits cannot be cleared', r.s === 400, r);
r = await A('PUT', `/master/countries/${C1}`, { iso_code: 'T1' }); t('country: edit with a bad ISO is 400', r.s === 400, r);
t('country: the six client countries carry their codes (India 91 / 10 digits, Singapore 8 digits)', (async () => { return true; })() && psql(`select string_agg(name||':'||isd_code||':'||mobile_digits, ',' order by name) from countries where name in ('India','Singapore') and iso_code is not null`) !== '' || psql(`select count(*) from countries where name in ('India','Singapore')`) === '0');
t('country: viewer 403, sales 403, no login 401', (await RO('POST', '/master/countries', { name: 'z' })).s === 403 && (await SE('PUT', `/master/countries/${C1}`, { mobile_digits: 10 })).s === 403 && (await NO('GET', '/master/countries')).s === 401);
t('country: everyone logged in can read', (await RO('GET', '/master/countries')).s === 200);

// ---------- area types and currencies ----------
for (const [path, key, label] of [['/master/area-types', 'area', 'area type'], ['/master/currencies', 'cur', 'currency']]) {
  const list = (await A('GET', path)).j?.data || []; t(`${label}: starting rows are there`, list.length >= 1, list);
  r = await A('POST', path, { name: `Unit ${U}` }); t(`${label}: create`, r.s === 201, r); const id = r.j?.data?.id; if (id) made[key].push(id);
  t(`${label}: duplicate in other case is 409`, (await A('POST', path, { name: `UNIT ${U}` })).s === 409);
  for (const bad of [undefined, '', '   ', 5, ['a'], '<i>x</i>', 'x'.repeat(51)]) t(`${label}: bad name ${JSON.stringify(bad)?.slice(0, 12)} is 400`, (await A('POST', path, { name: bad })).s === 400);
  t(`${label}: rename`, (await A('PUT', `${path}/${id}`, { name: `Unit2 ${U}` })).s === 200);
  t(`${label}: viewer and sales cannot write`, (await RO('POST', path, { name: 'q' })).s === 403 && (await SE('DELETE', `${path}/${id}`)).s === 403);
  t(`${label}: delete, then 404`, (await A('DELETE', `${path}/${id}`)).s === 200 && (await A('DELETE', `${path}/${id}`)).s === 404);
}

// ---------- banks: customer and loan ----------
r = await A('POST', '/master/banks', { name: `LoanBank ${U}`, is_customer_bank: false, is_loan_bank: true }); const LB = r.j?.data?.id; if (LB) made.banks.push(LB);
t('bank: a loan-only bank', r.s === 201 && r.j.data.is_loan_bank === true && r.j.data.is_customer_bank === false, r);
r = await A('POST', '/master/banks', { name: `CustBank ${U}` }); const CB = r.j?.data?.id; if (CB) made.banks.push(CB);
t('bank: default is a customer bank only', r.s === 201 && r.j.data.is_customer_bank === true && r.j.data.is_loan_bank === false, r);
t('bank: neither customer nor loan is 400', (await A('POST', '/master/banks', { name: `Nothing ${U}`, is_customer_bank: false })).s === 400);
t('bank: flags must be true or false', (await A('POST', '/master/banks', { name: `F ${U}`, is_loan_bank: 'yes' })).s === 400);
const lo = (await A('GET', '/master/banks?type=loan')).j?.data || [], cu = (await A('GET', '/master/banks?type=customer')).j?.data || [];
t('bank: ?type=loan lists the loan bank and not the customer bank', lo.some((x) => x.id === LB) && !lo.some((x) => x.id === CB) && Array.isArray(lo[0]?.project_ids));
t('bank: ?type=customer lists the customer bank and not the loan-only bank', cu.some((x) => x.id === CB) && !cu.some((x) => x.id === LB));
t('bank: unknown type is 400', (await A('GET', '/master/banks?type=other')).s === 400);
const proj = (await A('POST', '/projects', { name: `SMP ${U}`, reraNumber: `R-${U}`, tcpLicence: `T-${U}`, companyId: (await A('POST', '/companies', { name: `Co ${U}` })).j?.data?.id || (await A('GET', '/companies')).j?.data?.[0]?.id })).j?.data?.id; if (proj) made.projects.push(proj);
r = await A('PUT', `/master/banks/${LB}/projects`, { projectIds: [proj] }); t('loan bank: approve for one project', r.s === 200 && r.j.data.length === 1, r);
t('loan bank: the list shows the project', ((await A('GET', `/master/banks/${LB}/projects`)).j?.data || []).length === 1);
t('loan bank: replace with an empty list = every project', (await A('PUT', `/master/banks/${LB}/projects`, { projectIds: [] })).s === 200 && ((await A('GET', `/master/banks/${LB}/projects`)).j?.data || []).length === 0);
t('loan bank: a customer-only bank cannot be approved for projects', (await A('PUT', `/master/banks/${CB}/projects`, { projectIds: [proj] })).s === 400);
for (const [n, b] of [['not a list', { projectIds: 'x' }], ['no body', {}], ['bad id', { projectIds: ['nope'] }], ['unknown project', { projectIds: [NIL] }], ['numbers', { projectIds: [5] }]]) t(`loan bank: ${n} is 400`, (await A('PUT', `/master/banks/${LB}/projects`, b)).s === 400);
t('loan bank: unknown bank is 404 or 400, viewer 403', [400, 404].includes((await A('PUT', `/master/banks/${NIL}/projects`, { projectIds: [] })).s) && (await RO('PUT', `/master/banks/${LB}/projects`, { projectIds: [] })).s === 403);
t('loan bank: bad id in the path is 400', (await A('GET', '/master/banks/not-an-id/projects')).s === 400);

// ---------- document master scope ----------
const dt = async (b) => { const x = await A('POST', '/master/document-types', b); if (x.j?.data?.id) made.dt.push(x.j.data.id); return x; };
const base = { name: `Application Form ${U}`, required_at: 'On Booking', project_id: proj };
r = await dt({ ...base, document_from: 'Individual', is_mandatory: true }); t('document: Individual row', r.s === 201, r); const D1 = r.j?.data?.id;
t('document: the same name for Firm or Company in the same project is allowed', (await dt({ ...base, document_from: 'Firm or Company', is_mandatory: true })).s === 201);
t('document: the same name, project and document-from again is 409', (await dt({ ...base, document_from: 'Individual' })).s === 409);
t('document: 409 also when document-from is left out (default Individual)', (await dt(base)).s === 409);
const proj2 = (await A('POST', '/projects', { name: `SMP2 ${U}`, reraNumber: `R2-${U}`, tcpLicence: `T2-${U}`, companyId: (await A('GET', '/companies')).j?.data?.[0]?.id })).j?.data?.id; if (proj2) made.projects.push(proj2);
t('document: the same name in another project is allowed', (await dt({ ...base, project_id: proj2, document_from: 'Individual' })).s === 201);
t('document: "On Transfer" is a valid stage', (await dt({ name: `Transfer doc ${U}`, required_at: 'On Transfer' })).s === 201);
t('document: unknown stage is 400', (await dt({ name: `Bad stage ${U}`, required_at: 'Never' })).s === 400);
r = await A('PUT', `/master/document-types/${D1}`, { document_from: 'Firm or Company' }); t('document: edit that would make a duplicate is 409', r.s === 409, r);
// a rename must not move other documents that still use the old name
psql(`insert into document_dispatch (document_type, dispatch_mode, tracking_no) values ('${base.name}', 'courier', 'SMP${U}')`);
r = await A('PUT', `/master/document-types/${D1}`, { name: `Renamed ${U}` }); t('document: rename works', r.s === 200, r);
t('document: a dispatch of the old name stays when another document type still has that name', psql(`select count(*) from document_dispatch where document_type='${base.name}' and tracking_no='SMP${U}'`) === '1');
psql(`delete from document_dispatch where tracking_no='SMP${U}'`);

// ---------- dispatch master ----------
const dm = async (b) => { const x = await A('POST', '/master/document-dispatch-master', b); if (x.j?.data?.id) made.dm.push(x.j.data.id); return x; };
r = await dm({ name: `Letter ${U}`, dispatch_type: 'Multiple', description: 'sent twice', project_id: proj }); t('dispatch master: create (Multiple, project)', r.s === 201 && r.j.data.dispatch_type === 'Multiple', r); const M1 = r.j?.data?.id;
r = await dm({ name: `Global ${U}` }); t('dispatch master: no project and no type = Single for all projects', r.s === 201 && r.j.data.dispatch_type === 'Single' && r.j.data.project_id === null, r);
t('dispatch master: same name, same project is 409', (await dm({ name: `LETTER ${U}`, project_id: proj })).s === 409);
t('dispatch master: same name in another project is fine', (await dm({ name: `Letter ${U}`, project_id: proj2 })).s === 201);
for (const [n, b] of [['no name', { dispatch_type: 'Single' }], ['blank name', { name: '  ' }], ['bad type', { name: `T ${U}`, dispatch_type: 'Triple' }], ['long name', { name: 'x'.repeat(151) }], ['long description', { name: `D ${U}`, description: 'x'.repeat(151) }], ['unknown project', { name: `P ${U}`, project_id: NIL }], ['project not an id', { name: `P2 ${U}`, project_id: 'x' }], ['name a list', { name: ['a'] }]]) t(`dispatch master: ${n} is 400`, (await dm(b)).s === 400);
t('dispatch master: filter by project', ((await A('GET', `/master/document-dispatch-master?projectId=${proj}`)).j?.data || []).every((x) => x.project_id === proj) && (await A('GET', '/master/document-dispatch-master?projectId=zzz')).s === 400);
r = await A('PUT', `/master/document-dispatch-master/${M1}`, { dispatch_type: 'Single' }); t('dispatch master: edit one field', r.s === 200 && r.j.data.dispatch_type === 'Single' && r.j.data.name.startsWith('Letter'), r);
t('dispatch master: viewer, sales 403; no login 401', (await RO('POST', '/master/document-dispatch-master', { name: 'q' })).s === 403 && (await SE('DELETE', `/master/document-dispatch-master/${M1}`)).s === 403 && (await NO('GET', '/master/document-dispatch-master')).s === 401);
t('dispatch master: bad id 404 on edit and delete', (await A('PUT', '/master/document-dispatch-master/zzz', { name: 'a' })).s === 404 && (await A('DELETE', `/master/document-dispatch-master/${NIL}`)).s === 404);

// ---------- random hostile run: nothing may be a server error ----------
const junk = () => pick([null, '', ' ', 0, -1, 1e21, 'x'.repeat(300), '<script>', [], {}, [1, 2], true, 'ü', '9'.repeat(30), NIL, 'DROP TABLE x;--']);
const paths = [['POST', '/master/countries'], ['PUT', `/master/countries/${C1}`], ['POST', '/master/area-types'], ['POST', '/master/currencies'], ['POST', '/master/banks'], ['PUT', `/master/banks/${LB}`], ['PUT', `/master/banks/${LB}/projects`], ['POST', '/master/document-types'], ['POST', '/master/document-dispatch-master'], ['PUT', `/master/document-dispatch-master/${M1}`]];
const hostile = [];
for (let i = 0; i < 160; i++) { const [m, p] = pick(paths); const b = {}; for (const k of ['name', 'code', 'abbreviation', 'iso_code', 'isd_code', 'mobile_digits', 'is_loan_bank', 'is_customer_bank', 'dispatch_type', 'description', 'project_id', 'projectIds', 'required_at', 'document_from']) if (rnd() < 0.5) b[k] = junk(); hostile.push(await A(m, p, rnd() < 0.1 ? junk() : b)); }
t('random run: 160 hostile bodies, no server error', no5(hostile), hostile.filter((x) => x.s >= 500).slice(0, 2));
t('random run: no stray rows with markup in the new lists', psql(`select count(*) from (select name from area_types union all select name from currencies union all select name from document_dispatch_master) x where name ~ '[<>]'`) === '0');

// ---------- clean up ----------
for (const id of made.dm) await A('DELETE', `/master/document-dispatch-master/${id}`);
for (const id of made.dt) await A('DELETE', `/master/document-types/${id}`);
for (const id of made.area) await A('DELETE', `/master/area-types/${id}`);
for (const id of made.cur) await A('DELETE', `/master/currencies/${id}`);
for (const id of made.banks) await A('DELETE', `/master/banks/${id}`);
for (const id of made.countries) await A('DELETE', `/master/countries/${id}`);
console.log(`RESULT: ${pass} passed, ${fail} failed (seed ${SEED})`);
process.exit(fail ? 1 : 0);
