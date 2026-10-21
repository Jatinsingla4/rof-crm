// Applicants (consumers): roles, field rules, duplicates, list/search/paging, update, photos, KYC, remarks, base rate, additional applicants, random input.
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-applicants.mjs   (psql must reach the same database; SEED=n repeats a random run)
import { execFileSync } from 'node:child_process';
import { createHash, createHmac } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const B = process.env.BASE || 'http://localhost:3010/api';
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + x)); };
const login = async (email) => (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Test#Pass1234' }) })).json()).token;
const call = (tok) => async (m, p, b, raw) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: raw ?? (b === undefined ? undefined : JSON.stringify(b)) }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const A = call(await login('super_admin@test.local')), PM = call(await login('project_manager@test.local')), SE = call(await login('sales_executive@test.local')), RO = call(await login('read_only_viewer@test.local'));
const psql = (sql) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' }).trim().split('\n')[0];
const U = Date.now().toString(36).slice(-5), NIL = '00000000-0000-0000-0000-000000000000';
const SEED = Number(process.env.SEED || Date.now() % 1e9); let rs = SEED;
const rnd = () => (rs = (rs * 1664525 + 1013904223) % 4294967296) / 4294967296, ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)), pick = (a) => a[ri(0, a.length - 1)];
console.log('SEED=' + SEED);
const sha = (s) => createHash('sha256').update(s).digest('hex');
// a fresh valid mobile / PAN / Aadhaar every call
let seq = 0; const uniq = () => (Date.now() % 1e7) * 100 + (++seq % 100);
const mob = () => '9' + String(uniq() + 100000000).slice(-9).padStart(9, '0');
const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; const pan = () => { const n = uniq(); return `${pick([...L])}${pick([...L])}${pick([...L])}${pick([...L])}${pick([...L])}${String(n % 10000).padStart(4, '0')}${pick([...L])}`; };
const aad = () => '2' + String(uniq() * 7919).padStart(11, '0').slice(-11);
const co = (await A('POST', '/companies', { name: 'Applicant Co ' + U })).j.data.id;
const mkProj = async (tag) => (await A('POST', '/projects', { companyId: co, name: `Appl ${tag} ${U}`, reraNumber: `AP${tag}-${U}`, tcpLicence: 'x' })).j.data.id;
const P1 = await mkProj('A'), P2 = await mkProj('B');
const tw = (await A('POST', `/projects/${P1}/towers`, { towerName: 'T' + U })).j.data.id;
const mkUnit = async (n) => (await A('POST', '/units', { projectId: P1, towerId: tw, unitNumber: n + U, floor: 1, bhkType: '2BHK', carpetAreaSqft: 900, superAreaSqft: 1100, basePriceInr: 9000000, totalPriceInr: 9500000 })).j.data.id;
const mk = async (b = {}, c = A) => { const r = await c('POST', '/consumers', { name: 'Test Buyer ' + U, mobile: mob(), project_id: P1, ...b }); return r; };
let r, r2;
const made = []; const newOne = async (b = {}) => { const x = await mk(b); if (x.s >= 300) throw new Error('setup failed ' + JSON.stringify(x)); made.push(x.j.data.id); return x.j.data.id; };

// ---------- roles ----------
r = await RO('POST', '/consumers', { name: 'Ro Try', mobile: mob() }); t('roles: read_only_viewer cannot create -> 403', r.s === 403, r.s);
r = await RO('GET', '/consumers?pageSize=2'); t('roles: read_only_viewer can list', r.s === 200, r.s);
const seId = psql(`select id from users where email='sales_executive@test.local'`);
psql(`delete from user_process_permissions where user_id='${seId}' and process_name in ('new_applicant','edit_applicant')`);
r = await SE('POST', '/consumers', { name: 'Se Try', mobile: mob() }); t('roles: sales_executive without the maker right for new applicants -> 403', r.s === 403, r.s);
psql(`insert into user_process_permissions(user_id, process_name, is_maker) select '${seId}', p, true from unnest(array['new_applicant','edit_applicant']) p where not exists (select 1 from user_process_permissions where user_id='${seId}' and process_name=p)`);
r = await mk({ name: 'Se Buyer' }, SE); t('roles: sales_executive with the maker right can create', r.s === 201, r.s + JSON.stringify(r.j)); if (r.s === 201) made.push(r.j.data.id);
const roTarget = await newOne();
for (const [p, m, b] of [[`/consumers/${roTarget}`, 'PATCH', { email: 'x@y.com' }], [`/consumers/${roTarget}/remarks`, 'POST', { notes: 'x' }], [`/consumers/${roTarget}/kyc-documents`, 'POST', { documentType: 'pan', fileUrl: 'https://x.com/a.pdf' }], [`/consumers/${roTarget}/multi-applicants`, 'POST', { applicants: [] }], [`/consumers/${roTarget}/base-rate`, 'POST', { baseRate: 5 }]]) {
  r = await RO(m, p, b); t(`roles: read_only_viewer ${m} ${p.split('/').slice(3).join('/') || 'applicant'} -> 403`, r.s === 403, r.s);
}
r = await SE('POST', `/consumers/${roTarget}/base-rate`, { baseRate: 5 }); t('roles: sales_executive cannot change a unit price (base-rate) -> 403', r.s === 403, r.s);

// ---------- create: field rules ----------
const bad400 = async (name, patch, hint) => { const x = await mk(patch); t(`create: ${name} -> 400`, x.s === 400, x.s + ' ' + JSON.stringify(x.j).slice(0, 120)); if (x.s < 300) made.push(x.j.data.id); return x; };
await bad400('mobile missing', { mobile: undefined });
for (const m of ['123', '5876543210', 'abcdefghij', '98765432101', '+91 98765', '9876543210; drop table consumers', '', '0000000000', '++919876543210', '+0123456789', ' ']) await bad400(`mobile ${JSON.stringify(m)}`, { mobile: m });
for (const m of [[9876543210], { a: 1 }, true]) await bad400(`mobile of type ${typeof m}${Array.isArray(m) ? ' list' : ''}`, { mobile: m });
for (const e of ['a@b', '@x.com', 'a b@c.com', 'a..b@c.com', 'a@b..com', 'plain', 'a@b.c', '<s>@x.com', 'a@-.com']) await bad400(`email ${JSON.stringify(e)}`, { email: e });
for (const p of ['ABCDE12345', 'abcde1234', 'ABCD1234E', '1234567890', 'ABCDE1234FF', 'ABC DE1234F ZZ']) await bad400(`PAN ${p}`, { pan_no: p });
for (const a of ['123', '012345678901', '112345678901', '12345678901a', '2345 6789 012', '23456789012345']) await bad400(`Aadhaar ${a}`, { aadhaar_no: a });
const today = new Date().toISOString().slice(0, 10), yrs = (n) => { const d = new Date(); d.setFullYear(d.getFullYear() - n); return d.toISOString().slice(0, 10); };
for (const [n, d] of [['in the future', '2999-01-01'], ['before 1900', '1899-12-31'], ['impossible 2020-02-30', '2020-02-30'], ['wrong format 31/12/1990', '31/12/1990'], ['today (age 0)', today], ['aged 17', yrs(17)], ['text', 'yesterday'], ['number', 19900101]]) await bad400(`dob ${n}`, { dob: d });
r = await mk({ dob: yrs(18), first_name: 'Eigh', last_name: 'Teen', name: undefined }); t('create: aged exactly 18 is accepted', r.s === 201, r.s + JSON.stringify(r.j)); if (r.s === 201) made.push(r.j.data.id);
r = await mk({ dob: '1931-07-04', name: 'Old Buyer' }); t('create: born in 1931 is accepted (date range is not cut at 1990)', r.s === 201, r.s + JSON.stringify(r.j)); if (r.s === 201) made.push(r.j.data.id);
await bad400('gender "xyz"', { gender: 'xyz' });
await bad400('name missing', { name: undefined });
await bad400('name only digits', { name: '12345' });
await bad400('name with <script>', { name: '<script>alert(1)</script>' });
await bad400('name 300 letters', { name: 'a'.repeat(300) });
await bad400('name with control character', { name: 'Bad\u0007Name' });
await bad400('name with right-to-left override', { name: 'Evil‮gnp' });
await bad400('first_name as object', { first_name: { x: 1 }, name: undefined });
await bad400('first_name as list', { first_name: ['a'], name: undefined });
await bad400('income_category "XXL"', { income_category: 'XXL' });
await bad400('lead_stage "allotted" for a new applicant', { lead_stage: 'allotted' });
await bad400('lead_stage "nonsense"', { lead_stage: 'nonsense' });
await bad400('projectId not an id', { project_id: 'abc' });
await bad400('no_of_children -1', { no_of_children: -1 });
await bad400('no_of_children 99', { no_of_children: 99 });
await bad400('no_of_children "1e1"', { no_of_children: '1e1' });
for (const v of ['1e5', -5, 'abc', 1e12, '12,00,000', true]) await bad400(`annual_income ${JSON.stringify(v)}`, { annual_income: v });
await bad400('nominee_share 101', { nominee_share: 101 });
await bad400('loan_amount negative', { loan_amount: -1 });
await bad400('PIN "12" for India', { present_pin: '12' });
await bad400('PIN "000000" for India', { present_pin: '000000' });
await bad400('company GSTIN invalid', { company_gstin: '22AAAAA0000A1Z6' });
await bad400('has_poa "maybe"', { has_poa: 'maybe' });
await bad400('passport "12"', { passport_no: '12' });
await bad400('phone with letters', { phone_no: 'call me' });
await bad400('anniversary in the future', { anniversary_date: '2999-01-01' });
await bad400('marital_status 40 letters', { marital_status: 'm'.repeat(40) });
await bad400('applicant_type "Indiv idual!"', { applicant_type: 'Indiv idual!' });
r = await A('POST', '/consumers', undefined, '[1,2]'); t('create: body is a list -> 400', r.s === 400, r.s);
r = await A('POST', '/consumers', undefined, '{broken'); t('create: broken JSON -> 400', r.s === 400, r.s);
r = await A('POST', '/consumers', {}); t('create: empty body -> 400', r.s === 400, r.s);
r = await mk({ project_id: NIL }); t('create: project that does not exist -> 404', r.s === 404, r.s);

// ---------- create: good data, normalising, reuse ----------
const M1 = mob(), P_1 = pan(), A_1 = aad();
r = await mk({ name: 'ramesh KUMAR  singh', mobile: '+91 ' + M1.slice(0, 5) + '-' + M1.slice(5), email: ' Ramesh.K@Example.COM ', pan_no: P_1.toLowerCase(), aadhaar_no: A_1.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3'), dob: '1985-03-09', gender: 'Female', present_address_line1: '12 MG Road', present_city: 'Gurugram', present_pin: '122001', annual_income: '1250000.50', no_of_children: 2, has_poa: true });
t('create: good applicant -> 201', r.s === 201 && r.j.reused === false, r.s + JSON.stringify(r.j));
const c1 = r.j.data?.id; made.push(c1);
r = await A('GET', `/consumers/${c1}`); const d = r.j.data;
t('create: name is tidied (Ramesh Kumar Singh)', d.name === 'Ramesh Kumar Singh', d.name);
t('create: mobile stored as 10 digits', d.mobile === M1, d.mobile);
t('create: email lower-cased and trimmed', d.email === 'ramesh.k@example.com', d.email);
t('create: PAN upper-cased', d.pan_no === P_1, d.pan_no);
t('create: Aadhaar stored without spaces', d.aadhaar_no === A_1, d.aadhaar_no);
t('create: date of birth comes back as a plain date', d.dob === '1985-03-09', d.dob);
t('create: gender normalised', d.gender === 'female', d.gender);
t('create: annual income kept with paise', Number(d.annual_income) === 1250000.5, d.annual_income);
t('create: PAN hash and Aadhaar hash are stored', psql(`select (pan_hash='${sha(P_1)}' and aadhaar_hash='${sha(A_1)}')::text from consumers where id='${c1}'`) === 'true');
t('create: lead stage defaults to enquiry', d.lead_stage === 'enquiry', d.lead_stage);
r = await mk({ name: 'Ramesh', mobile: M1 }); t('reuse: same mobile + project returns the same applicant (200, reused)', r.s === 200 && r.j.reused === true && r.j.data.id === c1, r.s + JSON.stringify(r.j));
r = await A('GET', `/consumers/${c1}`); t('reuse: applicant with fewer fields does not blank PAN, Aadhaar, email or date of birth', r.j.data.pan_no === P_1 && r.j.data.aadhaar_no === A_1 && r.j.data.email === 'ramesh.k@example.com' && r.j.data.dob === '1985-03-09' && r.j.data.name === 'Ramesh Kumar Singh', JSON.stringify(r.j.data).slice(0, 200));
t('reuse: the stored name is not overwritten by the shorter name', r.j.data.name === 'Ramesh Kumar Singh', r.j.data.name);
r = await mk({ name: 'Ramesh', mobile: M1, profession: 'Doctor' }); r = await A('GET', `/consumers/${c1}`); t('reuse: a new detail (profession) is filled in', r.j.data.profession === 'Doctor', r.j.data.profession);
r = await mk({ mobile: M1, pan_no: pan() }); t('reuse: same mobile but a different PAN -> 409', r.s === 409, r.s + JSON.stringify(r.j));
r = await mk({ mobile: mob(), pan_no: P_1 }); t('PAN: same PAN on another mobile in the same project -> 409 naming the applicant', r.s === 409 && /Ramesh Kumar Singh/.test(r.j?.error || ''), r.s + JSON.stringify(r.j));
r = await mk({ mobile: mob(), pan_no: P_1.toLowerCase() }); t('PAN: same PAN in lower case -> 409 too', r.s === 409, r.s);
r = await mk({ mobile: M1, project_id: P2, pan_no: P_1 }); t('same mobile and PAN in another project is a separate applicant (201)', r.s === 201 && r.j.data.id !== c1, r.s + JSON.stringify(r.j)); if (r.s === 201) made.push(r.j.data.id);
const MN = mob(); const n1 = await mk({ mobile: MN, project_id: null, name: 'No Project' }), n2 = await mk({ mobile: MN, project_id: null, name: 'No Project' });
made.push(n1.j.data.id);
t('no project: same mobile twice gives one applicant, not two', n1.s === 201 && n2.s === 200 && n2.j.data.id === n1.j.data.id && psql(`select count(*) from consumers where mobile='${MN}' and project_id is null`) === '1', n1.s + '/' + n2.s);
const MR = mob(); const race = await Promise.all(Array.from({ length: 12 }, () => mk({ mobile: MR, name: 'Race Buyer' })));
t('race: 12 parallel creates of one mobile make exactly one applicant', psql(`select count(*) from consumers where mobile='${MR}' and project_id='${P1}'`) === '1' && race.every(x => x.s === 200 || x.s === 201) && race.filter(x => x.s === 201).length === 1, race.map(x => x.s).join(','));
made.push(race.find(x => x.s === 201)?.j.data.id);
const PR = pan(); const race2 = await Promise.all(Array.from({ length: 8 }, () => mk({ mobile: mob(), pan_no: PR, name: 'Pan Race' })));
t('race: 8 parallel creates with one PAN make exactly one applicant', psql(`select count(*) from consumers where pan_no='${PR}' and project_id='${P1}'`) === '1' && race2.filter(x => x.s === 201).length === 1 && race2.every(x => [201, 409].includes(x.s)), race2.map(x => x.s).join(','));
for (const x of race2) if (x.s === 201) made.push(x.j.data.id);
r = await mk({ name: 'श्री राम शर्मा', mobile: mob() }); t('create: Hindi name is accepted', r.s === 201, r.s + JSON.stringify(r.j)); if (r.s === 201) made.push(r.j.data.id);
r = await mk({ name: "D'Souza O'Neil-Smith", mobile: mob() }); t("create: names with ' and - are accepted", r.s === 201, r.s); if (r.s === 201) made.push(r.j.data.id);
r = await mk({ name: 'Acme Infra Pvt Ltd', applicant_type: 'company', company_name: 'Acme Infra Pvt Ltd', mobile: mob() }); t('create: company applicant keeps the company name as typed', r.s === 201 && r.j.data.name === 'Acme Infra Pvt Ltd', r.s + JSON.stringify(r.j)); if (r.s === 201) made.push(r.j.data.id);

// ---------- co-applicant (second applicant) on create ----------
const MC = mob(), PC = pan();
r = await mk({ applicant_type: 'multiple', mobile: MC, pan_no: pan(), co_applicant_first_name: 'Sita', co_applicant_last_name: 'Devi', co_applicant_pan_no: PC, co_applicant_mobile: '+91' + mob(), co_applicant_dob: '1988-01-01', co_applicant_relation: 'Spouse', co_present_city: 'Delhi', co_present_pin: '110001' });
t('co-applicant: created with the applicant (201)', r.s === 201, r.s + JSON.stringify(r.j)); const cm = r.j.data?.id; made.push(cm);
t('co-applicant: row saved with name, relation, PAN and plain date', psql(`select (name='Sita Devi' and relationship='Spouse' and pan_no='${PC}' and present_city='Delhi' and applicant_number=2 and dob='1988-01-01')::text from co_applicants where consumer_id='${cm}'`) === 'true');
const before = psql(`select count(*) from consumers`);
const coBad = [['PAN same as main', { pan_no: PC, co_applicant_pan_no: PC }], ['mobile same as main', { co_applicant_mobile: undefined, mobile: M1 + '0' }], ['PAN invalid', { co_applicant_pan_no: 'bad' }], ['mobile invalid', { co_applicant_mobile: '12' }], ['email invalid', { co_applicant_email: 'nope' }], ['dob minor', { co_applicant_dob: yrs(5) }], ['PIN invalid', { co_present_pin: 'x' }], ['Aadhaar invalid', { co_applicant_aadhaar_no: '1' }]];
for (const [n, p] of coBad) { const x = await A('POST', '/consumers', { name: 'Co Bad', applicant_type: 'multiple', mobile: mob(), project_id: P1, co_applicant_first_name: 'Cob', ...p }); t(`co-applicant: ${n} -> 400`, x.s === 400, x.s + JSON.stringify(x.j).slice(0, 100)); }
t('co-applicant: a bad co-applicant leaves no applicant behind', psql(`select count(*) from consumers`) === before);
r = await mk({ applicant_type: 'individual', co_applicant_first_name: 'Ignored', co_applicant_pan_no: 'junk' }); t('co-applicant: details are ignored when the type is not "multiple"', r.s === 201 && psql(`select count(*) from co_applicants where consumer_id='${r.j.data.id}'`) === '0', r.s); if (r.s === 201) made.push(r.j.data.id);

// ---------- list / search / paging ----------
const tag = 'Zq' + U.replace(/[^a-z]/gi, 'x');
const lst = []; for (let i = 0; i < 7; i++) lst.push(await newOne({ name: `${tag}Name${i}`, first_name: `${tag}F${i}`, last_name: 'Lister', present_city: i % 2 ? 'Rohtak' : 'Hisar', dob: `198${i}-0${i + 1}-1${i}`, email: `${tag.toLowerCase()}${i}@list.com`, loan_amount: i === 0 ? 500000 : undefined }));
const get = (q) => A('GET', '/consumers?' + q);
for (const [n, q] of [['sortBy with SQL', "sortBy=created_at;drop table consumers"], ['sortBy unknown', 'sortBy=password'], ['sortBy subselect', 'sortBy=(select 1)'], ['sortOrder junk', 'sortOrder=sideways'], ['pageSize 0', 'pageSize=0'], ['pageSize 1001', 'pageSize=1001'], ['pageSize -1', 'pageSize=-1'], ['pageSize text', 'pageSize=abc'], ['pageSize with SQL', 'pageSize=5;select 1'], ['pageSize decimal', 'pageSize=2.5'], ['page 0', 'page=0'], ['page -3', 'page=-3'], ['page text', 'page=x'], ['page huge', 'page=99999999999'], ['projectId not an id', 'projectId=abc'], ['projectId sql', "projectId=' or 1=1 --"], ['leadStage unknown', 'leadStage=zzz'], ['dob not a date', 'dob=notadate'], ['dob impossible', 'dob=2020-13-45'], ['repeated parameter', 'search=a&search=b'], ['nested parameter', 'search[a]=b']]) { r = await get(q); t(`list: ${n} -> 400`, r.s === 400, r.s + ' ' + JSON.stringify(r.j).slice(0, 80)); }
t('list: table still exists after the injection attempts', Number(psql('select count(*) from consumers')) > 10);
r = await get(`search=${tag}&pageSize=100`); t('list: search finds the 7 test applicants', r.j.data.length === 7 && r.j.pagination.total === 7, JSON.stringify(r.j.pagination));
for (const [so, ex] of [['asc', (a, b) => a <= b], ['desc', (a, b) => a >= b]]) { r = await get(`search=${tag}&sortBy=name&sortOrder=${so}&pageSize=100`); const n = r.j.data.map(x => x.name); t(`list: sort by name ${so}`, n.every((v, i) => !i || ex(n[i - 1], v)), n.join()); }
r = await get(`search=${tag}&sortBy=mobile&pageSize=100`); t('list: sort by mobile works', r.s === 200, r.s);
const seen = new Set(); let tot = 0; for (let p = 1; p <= 5; p++) { r = await get(`search=${tag}&pageSize=3&page=${p}&sortBy=name&sortOrder=asc`); tot = r.j.pagination.total; for (const x of r.j.data) seen.add(x.id); }
t('list: paging 3 at a time visits all 7 applicants once, total is right', seen.size === 7 && tot === 7, seen.size + '/' + tot);
r = await get(`search=${tag}&pageSize=3&page=99`); t('list: a page past the end is empty, not an error', r.s === 200 && r.j.data.length === 0 && r.j.pagination.total === 7, r.s);
r = await get(`city=Rohtak&search=${tag}`); t('list: city filter and its total agree', r.j.data.length === 3 && r.j.pagination.total === 3, JSON.stringify(r.j.pagination));
r = await get(`dob=1982-03-12&search=${tag}`); t('list: dob filter and its total agree (total used to ignore it)', r.j.data.length === 1 && r.j.pagination.total === 1, JSON.stringify(r.j.pagination));
r = await get(`firstName=${tag}F3&lastName=lister`); t('list: first + last name filters combine', r.j.data.length === 1 && r.j.pagination.total === 1, JSON.stringify(r.j.pagination));
r = await get(`email=${tag.toLowerCase()}5@`); t('list: email filter', r.j.data.length === 1, r.j.data.length);
r = await get(`mobile=${M1}`); t('list: mobile filter finds the applicant', r.j.data.some(x => x.id === c1), r.j.data.length);
r = await get(`pan=${P_1.toLowerCase()}`); t('list: PAN filter is case-insensitive', r.j.data.some(x => x.id === c1), r.j.data.length);
r = await get(`projectId=${P1}&leadStage=enquiry&pageSize=1000`); t('list: project + stage filter, pageSize 1000 allowed', r.s === 200 && r.j.data.every(x => x.project_id === P1 && x.lead_stage === 'enquiry') && r.j.data.length === r.j.pagination.total, r.s);
r = await get('hasLoan=true&pageSize=1000'); t('list: hasLoan only returns applicants with a loan', r.s === 200 && r.j.data.some(x => x.id === lst[0]) && !r.j.data.some(x => x.id === lst[1]), r.s);
for (const s of ['%', '_', '\\', "'", '"', ';--', '<b>', '%%%%', '*', '🙂', 'a'.repeat(500)]) { r = await get('search=' + encodeURIComponent(s)); t(`list: search ${JSON.stringify(s.slice(0, 12))} is plain text (200)`, r.s === 200, r.s); }
r = await get(`search=${encodeURIComponent('%')}&pageSize=1000`); t('list: searching "%" does not match everything', r.j.pagination.total < Number(psql('select count(*) from consumers')), r.j.pagination.total);
r = await get('search='); t('list: empty search = no filter', r.s === 200 && r.j.pagination.total > 10, r.s);

// ---------- update ----------
const ua = await newOne({ name: 'Update Alpha', email: 'ua@x.com', pan_no: pan(), present_city: 'Goa' }), ub = await newOne({ name: 'Update Beta', pan_no: pan() });
r = await A('PATCH', `/consumers/${ua}`, { lead_stage: 'interested' }); t('update: only the lead stage changes, other fields stay', r.s === 200 && r.j.data.lead_stage === 'interested' && r.j.data.email === 'ua@x.com' && r.j.changed.join() === 'lead_stage', r.s + JSON.stringify(r.j));
r = await A('PATCH', `/consumers/${ua}`, { leadStage: 'interested' }); t('update: same value again reports nothing changed', r.s === 200 && r.j.changed.length === 0, JSON.stringify(r.j));
r = await A('PATCH', `/consumers/${ua}`, {}); t('update: empty body is harmless (200, nothing changed)', r.s === 200 && r.j.changed.length === 0, r.s);
t('update: the answer never carries PAN, Aadhaar or hashes', !/pan|aadhaar/i.test(JSON.stringify(r.j)), JSON.stringify(r.j).slice(0, 120));
r = await A('PATCH', `/consumers/${ua}`, { email: '' }); r2 = await A('GET', `/consumers/${ua}`); t('update: a blank email clears it', r.s === 200 && r2.j.data.email === null, r.s + ' ' + r2.j.data.email);
r = await A('PATCH', `/consumers/${ua}`, { email: 'Back@Again.com', present_city: '' }); r2 = await A('GET', `/consumers/${ua}`); t('update: email set again (lower-cased), a blank city cleared', r2.j.data.email === 'back@again.com' && r2.j.data.present_city === null, JSON.stringify([r2.j.data.email, r2.j.data.present_city]));
for (const [n, p] of [['mobile blank', { mobile: '' }], ['mobile null', { mobile: null }], ['mobile bad', { mobile: '12345' }], ['name blank', { name: '' }], ['name digits', { name: '999' }], ['first and last blank', { first_name: '', last_name: '', name: '' }], ['email bad', { email: 'x' }], ['PAN bad', { pan_no: 'zzz' }], ['dob minor', { dob: yrs(10) }], ['dob future', { dob: '2999-01-01' }], ['gender bad', { gender: 'q' }], ['lead_stage bad', { lead_stage: 'zzz' }], ['lead_stage blank', { lead_stage: '' }], ['lead_stage null', { lead_stage: null }], ['income_category bad', { income_category: 'HIG' }], ['annual_income bad', { annual_income: -1 }], ['children bad', { no_of_children: 'many' }], ['PIN bad', { present_pin: '1' }], ['city as object', { present_city: { a: 1 } }], ['address 400 chars', { present_address_line1: 'x'.repeat(400) }], ['has_poa bad', { has_poa: 'yes' }]]) { r = await A('PATCH', `/consumers/${ua}`, p); t(`update: ${n} -> 400`, r.s === 400, r.s + JSON.stringify(r.j).slice(0, 90)); }
r = await A('GET', `/consumers/${ua}`); t('update: after all the bad updates the applicant is unchanged', r.j.data.name === 'Update Alpha' && r.j.data.mobile && r.j.data.lead_stage === 'interested');
r = await A('PATCH', `/consumers/${ua}`, { mobile: (await A('GET', `/consumers/${ub}`)).j.data.mobile }); t("update: mobile that belongs to another applicant in the project -> 409", r.s === 409, r.s + JSON.stringify(r.j));
r = await A('PATCH', `/consumers/${ua}`, { pan_no: (await A('GET', `/consumers/${ub}`)).j.data.pan_no.toLowerCase() }); t('update: PAN that belongs to another applicant -> 409', r.s === 409, r.s);
const NM = mob(); r = await A('PATCH', `/consumers/${ua}`, { mobile: '+91 ' + NM }); t('update: mobile changed (normalised)', r.s === 200 && psql(`select mobile from consumers where id='${ua}'`) === NM, r.s);
r = await A('PATCH', `/consumers/${ua}`, { mobile: NM }); t('update: keeping its own mobile is not a clash', r.s === 200, r.s);
r = await A('PATCH', `/consumers/${ua}`, { first_name: 'alpha', last_name: 'sharma', name: undefined }); r2 = await A('GET', `/consumers/${ua}`); t('update: first/last name changes rebuild the name (Alpha Sharma)', r2.j.data.name === 'Alpha Sharma', r2.j.data.name);
const PNEW = pan(); r = await A('PATCH', `/consumers/${ua}`, { pan_no: PNEW, aadhaar_no: aad() }); t('update: PAN hash follows the PAN', psql(`select (pan_hash='${sha(PNEW)}' and aadhaar_hash=encode(sha256(aadhaar_no::bytea),'hex'))::text from consumers where id='${ua}'`) === 'true');
r = await A('PATCH', `/consumers/${ua}`, { present_address_line1: 'New House 5', present_address_line2: 'Sector 9', office_city: 'Noida', perm_pin: '110011', comm_city: 'Pune', company: 'Acme', nominee_name: 'Nom', nominee_dob: '2010-05-05', nominee_share: 60, loan_amount: 750000, loan_sanction_date: '2026-09-01', passport_no: 'a1234567' }); r2 = await A('GET', `/consumers/${ua}`);
t('update: address, nominee, loan and passport fields all save', r.s === 200 && r2.j.data.present_address === 'New House 5' && r2.j.data.present_address_line2 === 'Sector 9' && r2.j.data.office_city === 'Noida' && r2.j.data.perm_pin === '110011' && r2.j.data.comm_city === 'Pune' && r2.j.data.nominee_dob === '2010-05-05' && Number(r2.j.data.nominee_share) === 60 && Number(r2.j.data.loan_amount) === 750000 && r2.j.data.loan_sanction_date === '2026-09-01' && r2.j.data.passport_no === 'A1234567', r.s + JSON.stringify(r.j).slice(0, 150));
r = await A('PATCH', `/consumers/${ua}`, { nominee_share: null, no_of_children: '', marital_status: null }); r2 = await A('GET', `/consumers/${ua}`); t('update: clearing share / children / marital status falls back to defaults', Number(r2.j.data.nominee_share) === 100 && r2.j.data.no_of_children === 0 && r2.j.data.marital_status === 'not_specified', JSON.stringify([r2.j.data.nominee_share, r2.j.data.no_of_children, r2.j.data.marital_status]));
r = await A('PATCH', `/consumers/${NIL}`, { email: 'a@b.co' }); t('update: unknown id -> 404', r.s === 404, r.s);
r = await A('PATCH', '/consumers/not-an-id', { email: 'a@b.co' }); t('update: id that is not an id -> 400', r.s === 400, r.s);
r = await A('PATCH', `/consumers/${ua}`, undefined, '[1]'); t('update: body as list -> 200 nothing changed (or 400), never 500', [200, 400].includes(r.s), r.s);
r = await A('PATCH', `/consumers/${ua}`, { lead_stage: 'allotted' }); t('update: "allotted" without an allotted unit -> 409', r.s === 409, r.s + JSON.stringify(r.j));
r = await A('PATCH', `/consumers/${ua}`, { lead_stage: 'onboarded' }); t('update: "onboarded" without an allotted unit -> 409', r.s === 409, r.s);
const sw1 = await newOne({ name: 'Swap One' }), sw2 = await newOne({ name: 'Swap Two' }); const SM = mob();
const sr = await Promise.all([A('PATCH', `/consumers/${sw1}`, { mobile: SM }), A('PATCH', `/consumers/${sw2}`, { mobile: SM })]);
t('race: two applicants taking the same new mobile at once -> one 200, one 409', sr.map(x => x.s).sort().join() === '200,409' && psql(`select count(*) from consumers where mobile='${SM}' and project_id='${P1}'`) === '1', sr.map(x => x.s).join());
// live booking blocks cancelled / transferred
const bu = await mkUnit('BK'); psql(`update consumers set allocated_unit_id='${bu}' where id='${ub}'`);
psql(`insert into booking_records(consumer_id, unit_id, status, booking_amount) values('${ub}','${bu}','active',100000)`);
for (const st of ['cancelled', 'transferred']) { r = await A('PATCH', `/consumers/${ub}`, { lead_stage: st }); t(`update: "${st}" while a booking is live -> 409 (use the process)`, r.s === 409, r.s + JSON.stringify(r.j)); }
r = await A('PATCH', `/consumers/${ub}`, { lead_stage: 'allotted' }); t('update: "allotted" is fine when a unit is allotted', r.s === 200, r.s + JSON.stringify(r.j));
r = await A('PATCH', `/consumers/${ub}`, { email: 'booked@x.com', present_city: 'Mumbai' }); t('update: contact details of a booked applicant can still be corrected', r.s === 200, r.s);
// audit
const aud = psql(`select count(*) from audit_logs where resource_id='${ua}'`); t('audit: updates leave audit rows', Number(aud) >= 5, aud);
t('audit: PAN and Aadhaar are masked in the log', psql(`select count(*) from audit_logs where resource_id='${ua}' and (new_values::text like '%${PNEW}%' or previous_values::text like '%${PNEW}%')`) === '0' && psql(`select count(*) from audit_logs where resource_id='${ua}' and new_values::text like '%XXXX%'`) !== '0');

// ---------- photos (kept in the database) ----------
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('JFIF test image bytes')]);
const up = async (path, type, name, buf = png, tok) => { const fd = new FormData(); if (type) fd.append('photo', new Blob([buf], { type }), name); const rr = await fetch(B + path, { method: 'POST', headers: { authorization: 'Bearer ' + (tok || '') }, body: fd }); let j = null; try { j = await rr.json(); } catch {} return { s: rr.status, j }; };
const tokA = await login('super_admin@test.local');
const show = (url) => fetch(B + url.replace(/^\/api/, ''));
r = await up(`/consumers/${ua}/photo`, 'image/png', 'evil.html', png, tokA); t('photo: saved, the address is a database photo address', r.s === 200 && new RegExp(`^/api/photos/consumer/${ua}\\?v=\\d+$`).test(r.j?.data?.photo_url || ''), r.s + JSON.stringify(r.j));
let pic = await show(r.j.data.photo_url); t('photo: shows without a login header (as an <img> needs), as image/png, same bytes', pic.status === 200 && pic.headers.get('content-type') === 'image/png' && Buffer.from(await pic.arrayBuffer()).equals(png), pic.status);
t('photo: nosniff and a locked-down content policy are sent', pic.headers.get('x-content-type-options') === 'nosniff' && /default-src 'none'/.test(pic.headers.get('content-security-policy') || ''));
t('photo: the bytes are in the database, not on disk', psql(`select count(*) from applicant_photos where kind='consumer' and owner_id='${ua}'`) === '1');
r = await A('GET', `/consumers/${ua}`); t('photo: the applicant detail carries the photo address', /\/api\/photos\/consumer\//.test(r.j.data.photo_url || ''), r.j.data.photo_url);
r = await up(`/consumers/${ua}/photo`, 'image/png', 'again.png', png, tokA); t('photo: uploading again replaces it (one row)', r.s === 200 && psql(`select count(*) from applicant_photos where owner_id='${ua}'`) === '1', r.s);
r = await up(`/consumers/${ua}/photo`, 'image/jpeg', 'x.jpg', jpg, tokA); pic = await show(r.j.data.photo_url); t('photo: replaced by a jpeg, now served as image/jpeg', pic.status === 200 && pic.headers.get('content-type') === 'image/jpeg', pic.status);
r = await up(`/consumers/${ua}/photo`, 'image/png', 'page.png', Buffer.from('<html><script>alert(1)</script></html>'), tokA); t('photo: HTML sent as "image/png" is refused (the file itself is checked) -> 400', r.s === 400, r.s + JSON.stringify(r.j));
r = await up(`/consumers/${ua}/photo`, 'text/html', 'a.png', png, tokA); t('photo: a real image whose declared type is wrong is stored under its true type', r.s === 200 && (await show(r.j.data.photo_url)).headers.get('content-type') === 'image/png', r.s);
for (const [n, ty, nm, buf] of [['svg', 'image/svg+xml', 'a.svg', Buffer.from('<svg onload=alert(1)/>')], ['pdf', 'application/pdf', 'a.pdf', Buffer.from('%PDF-1.4')], ['script', 'application/javascript', 'a.js', Buffer.from('alert(1)')], ['empty file', 'image/png', 'e.png', Buffer.alloc(0)], ['png signature missing', 'image/png', 'n.png', Buffer.from('not an image at all')]]) { r = await up(`/consumers/${ua}/photo`, ty, nm, buf, tokA); t(`photo: ${n} is refused (400)`, r.s === 400, r.s + JSON.stringify(r.j)); }
r = await up(`/consumers/${ua}/photo`, null, null, png, tokA); t('photo: no file -> 400', r.s === 400, r.s);
r = await up(`/consumers/${ua}/photo`, 'image/png', 'big.png', Buffer.concat([png, Buffer.alloc(5 * 1024 * 1024 + 10)]), tokA); t('photo: over 5 MB -> 400', r.s === 400, r.s);
r = await up(`/consumers/${NIL}/photo`, 'image/png', 'x.png', png, tokA); t('photo: unknown applicant -> 404 and nothing saved', r.s === 404 && psql(`select count(*) from applicant_photos where owner_id='${NIL}'`) === '0', r.s);
r = await up(`/consumers/..%2F..%2Fpwned/photo`, 'image/png', 'x.png', png, tokA); t('photo: path-traversal id -> 400', r.s === 400, r.s);
r = await up(`/consumers/${ua}/photo`, 'image/png', 'x.png', png, await login('read_only_viewer@test.local')); t('photo: read_only_viewer -> 403', r.s === 403, r.s);
r = await up(`/consumers/${ua}/co-applicant-photo`, 'image/png', 'x.png', png, tokA); t('photo: co-applicant photo for an applicant with no co-applicant -> 404', r.s === 404, r.s);
r = await up(`/consumers/${cm}/co-applicant-photo`, 'image/png', 'x.png', png, tokA); t('photo: co-applicant photo saved for the second applicant', r.s === 200 && (await show(r.j.data.photo_url)).status === 200, r.s + JSON.stringify(r.j));
for (const u of [`/photos/consumer/${NIL}`, `/photos/evil/${ua}`, '/photos/consumer/not-an-id', `/photos/co/${ua}`]) { pic = await fetch(B + u); t(`photo: ${u.replace(ua, '<id>')} -> 404`, pic.status === 404, pic.status); }

// ---------- links for new tabs (the login token never goes in a web address) ----------
const hs = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const forge = (claims, secret = 'test-secret') => { const h = hs({ alg: 'HS256', typ: 'JWT' }), p = hs(claims), sg = createHmac('sha256', secret).update(h + '.' + p).digest('base64url'); return `${h}.${p}.${sg}`; };
const rawGet = async (path) => (await fetch(B + path)).status;
const filePath = `/consumers/${ua}/applicant-file`;
t('link: the login token in a web address is refused -> 401', await rawGet(`${filePath}?token=${tokA}`) === 401);
r = await A('POST', '/auth/link-token', { path: '/api' + filePath }); const lt = r.j?.token; t('link: a link token is issued', r.s === 200 && !!lt, r.s);
const fs1 = await rawGet(`${filePath}?token=${lt}`); t('link: the link token opens that page (applicant file loads)', fs1 === 200, fs1);
t('link: the same token does not open another applicant\'s page -> 401', await rawGet(`/consumers/${ub}/applicant-file?token=${lt}`) === 401);
t('link: nor another kind of page -> 401', await rawGet(`/consumers/${ua}/remarks?token=${lt}`) === 401);
r = await fetch(B + `/consumers?pageSize=1`, { headers: { authorization: 'Bearer ' + lt } }); t('link: a link token is not accepted as a login (header) -> 401', r.status === 401, r.status);
const claims = JSON.parse(Buffer.from(lt.split('.')[1], 'base64url').toString());
t('link: it lives about 2 minutes', claims.exp - claims.iat === 120, claims.exp - claims.iat);
t('link: expired link token -> 401', await rawGet(`${filePath}?token=${forge({ ...claims, exp: Math.floor(Date.now() / 1000) - 5 })}`) === 401);
t('link: link token signed with another secret -> 401', await rawGet(`${filePath}?token=${forge(claims, 'wrong')}`) === 401);
t('link: link token with the page changed after signing -> 401', await rawGet(`/consumers/${ub}/applicant-file?token=${lt.split('.').slice(0, 2).join('.')}.${lt.split('.')[2]}`) === 401);
t('link: ordinary token forged to carry a purpose of "link" for a wrong page -> 401', await rawGet(`${filePath}?token=${forge({ ...claims, p: '/api/other' })}`) === 401);
for (const [n, path] of [['not a string', 5], ['empty', ''], ['outside /api', '/etc/passwd'], ['with ..', '/api/../x'], ['with a query', '/api/x?a=1'], ['with spaces', '/api/a b'], ['missing', undefined]]) { r = await A('POST', '/auth/link-token', { path }); t(`link: path ${n} -> 400`, r.s === 400, r.s); }
r = await fetch(B + '/auth/link-token', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: '/api/x' }) }); t('link: no login -> 401', r.status === 401, r.status);
r = await fetch(B + '/auth/link-token', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + lt }, body: JSON.stringify({ path: '/api/x' }) }); t('link: a link token cannot make another link token -> 401', r.status === 401, r.status);

// ---------- old records with values today\'s rules refuse ----------
const lg = await newOne({ name: 'Legacy Person' });
psql(`update consumers set present_pin='12', email='old-mail', mobile='12345', present_city='Old', dob='2015-01-01' where id='${lg}'`);
r = await A('PATCH', `/consumers/${lg}`, { present_pin: '12', email: 'old-mail', mobile: '12345', dob: '2015-01-01', present_city: 'New City' }); t('legacy: sending old bad values back unchanged while editing the city -> 200', r.s === 200 && psql(`select present_city from consumers where id='${lg}'`) === 'New City', r.s + JSON.stringify(r.j));
t('legacy: the old values were left as they were', psql(`select (present_pin='12' and email='old-mail' and mobile='12345')::text from consumers where id='${lg}'`) === 'true');
for (const [n, p] of [['a different bad PIN', { present_pin: '13' }], ['a different bad email', { email: 'old-mail2' }], ['a different bad mobile', { mobile: '12346' }], ['a new minor date of birth', { dob: '2016-01-01' }]]) { r = await A('PATCH', `/consumers/${lg}`, p); t(`legacy: ${n} is still refused -> 400`, r.s === 400, r.s); }
r = await A('PATCH', `/consumers/${lg}`, { present_pin: '122001', email: 'fixed@x.com', mobile: mob(), dob: '1990-01-01' }); t('legacy: replacing the old values with good ones works', r.s === 200, r.s + JSON.stringify(r.j));

// ---------- KYC and remarks ----------
const kb = (p) => ({ documentType: 'pan', fileUrl: 'https://files.example.com/pan.pdf', ...p });
for (const [n, p] of [['type unknown', { documentType: 'visa' }], ['type missing', { documentType: undefined }], ['type object', { documentType: {} }], ['url missing', { fileUrl: undefined }], ['url javascript:', { fileUrl: 'javascript:alert(1)' }], ['url http (not https)', { fileUrl: 'http://x.com/a.pdf' }], ['url with ..', { fileUrl: '/uploads/../../etc/passwd' }], ['url data:', { fileUrl: 'data:text/html,<script>1</script>' }], ['url with spaces', { fileUrl: 'https://x.com/a b' }], ['expiry not a date', { expiryDate: '31-12-2030' }]]) { r = await A('POST', `/consumers/${ua}/kyc-documents`, kb(p)); t(`kyc: ${n} -> 400`, r.s === 400, r.s + JSON.stringify(r.j).slice(0, 80)); }
r = await A('POST', `/consumers/${ua}/kyc-documents`, kb({ expiryDate: '2030-12-31' })); t('kyc: good document -> 201, plain expiry date', r.s === 201 && r.j.data.expiry_date === '2030-12-31', r.s + JSON.stringify(r.j));
r = await A('POST', `/consumers/${ua}/kyc-documents`, kb({ fileUrl: '/uploads/kyc/a-1.pdf' })); t('kyc: an uploaded path is accepted', r.s === 201, r.s);
r = await A('POST', `/consumers/${NIL}/kyc-documents`, kb()); t('kyc: unknown applicant -> 404', r.s === 404, r.s);
r = await A('GET', `/consumers/${ua}`); t('kyc: documents show on the applicant', r.j.data.kycDocuments.length === 2, r.j.data.kycDocuments?.length);
for (const [n, p] of [['notes missing', { notes: undefined }], ['notes blank', { notes: '  ' }], ['notes 5001 characters', { notes: 'n'.repeat(5001) }], ['tags not a list', { notes: 'x', tags: 'a,b' }], ['21 tags', { notes: 'x', tags: Array.from({ length: 21 }, (_, i) => 't' + i) }], ['tag as object', { notes: 'x', tags: [{}] }], ['follow-up date bad', { notes: 'x', followUpDate: '99/99/9999' }], ['channel 80 letters', { notes: 'x', channel: 'c'.repeat(80) }]]) { r = await A('POST', `/consumers/${ua}/remarks`, p); t(`remarks: ${n} -> 400`, r.s === 400, r.s + JSON.stringify(r.j).slice(0, 80)); }
r = await A('POST', `/consumers/${ua}/remarks`, { channel: 'call', subject: 'Follow up', notes: 'Spoke about the demand letter', followUpDate: '2026-12-01', tags: ['urgent', 'demand'] }); t('remarks: good remark with tags and date -> 201', r.s === 201, r.s + JSON.stringify(r.j));
r = await A('POST', `/consumers/${ua}/remarks`, { notes: 'No tags at all' }); t('remarks: a remark with no tags -> 201', r.s === 201, r.s + JSON.stringify(r.j));
r = await A('GET', `/consumers/${ua}/remarks`); t('remarks: list shows both, plain follow-up date, tags as a list', r.j.data.length === 2 && r.j.data.some(x => x.follow_up_date === '2026-12-01' && x.tags.join() === 'urgent,demand'), JSON.stringify(r.j).slice(0, 200));
r = await A('POST', `/consumers/${NIL}/remarks`, { notes: 'x' }); t('remarks: unknown applicant -> 404', r.s === 404, r.s);

// ---------- base rate (Pricing Matrix) ----------
const u1 = await mkUnit('BR'); const bc = await newOne({ name: 'Base Rate Buyer' }); psql(`update consumers set allocated_unit_id='${u1}' where id='${bc}'`);
r = await A('POST', `/consumers/${roTarget}/base-rate`, { baseRate: 5000 }); t('base rate: applicant without a unit -> 400', r.s === 400, r.s);
for (const v of [-1, 0, 'abc', '1e3', null, undefined, [5], 1e11, '5,000']) { r = await A('POST', `/consumers/${bc}/base-rate`, { baseRate: v }); t(`base rate: ${JSON.stringify(v)} -> 400`, r.s === 400, r.s + JSON.stringify(r.j).slice(0, 80)); }
r = await PM('POST', `/consumers/${bc}/base-rate`, { baseRate: 7500.5 }); t('base rate: project manager can set it on an unbooked unit', r.s === 200 && Number(psql(`select basic_price from units where id='${u1}'`)) === 7500.5, r.s + JSON.stringify(r.j));
t('base rate: change is audited', Number(psql(`select count(*) from audit_logs where resource_id='${u1}'`)) >= 1);
psql(`insert into booking_records(consumer_id, unit_id, status, booking_amount) values('${bc}','${u1}','active',1000)`);
r = await A('POST', `/consumers/${bc}/base-rate`, { baseRate: 1 }); t('base rate: unit with a booking keeps its price -> 409', r.s === 409 && Number(psql(`select basic_price from units where id='${u1}'`)) === 7500.5, r.s + JSON.stringify(r.j));

// ---------- additional applicants ----------
const ma = await newOne({ name: 'Multi Main', mobile: mob(), pan_no: pan(), aadhaar_no: aad() }); const mainRow = (await A('GET', `/consumers/${ma}`)).j.data;
const ap = (n, p = {}) => ({ first_name: 'Add' + n, last_name: 'Person', mobile: mob(), pan_no: pan(), relation: 'Son', dob: '1995-05-0' + (n % 9 + 1), ...p });
const ms = (list) => A('POST', `/consumers/${ma}/multi-applicants`, { applicants: list });
for (const [n, body] of [['applicants not a list', { applicants: 'x' }], ['applicants an object', { applicants: {} }], ['11 people', { applicants: Array.from({ length: 11 }, (_, i) => ap(i)) }], ['entry is a number', { applicants: [5] }], ['entry is a list', { applicants: [[1]] }]]) { r = await A('POST', `/consumers/${ma}/multi-applicants`, body); t(`additional: ${n} -> 400`, r.s === 400, r.s + JSON.stringify(r.j).slice(0, 80)); }
r = await ms([ap(1), ap(2)]); t('additional: two people saved, numbered 3 and 4', r.s === 201 && r.j.data.map(x => x.applicant_number).join() === '3,4', r.s + JSON.stringify(r.j));
for (const [n, list, rx] of [['first name missing', [ap(1), { ...ap(2), first_name: undefined }], /Applicant 4/], ['PAN invalid', [ap(1, { pan_no: 'bad' })], /Applicant 3/], ['mobile invalid', [ap(1), ap(2, { mobile: '12' })], /Applicant 4/], ['email invalid', [ap(1, { email: 'e' })], /Applicant 3/], ['dob minor', [ap(1, { dob: yrs(3) })], /Applicant 3/], ['same PAN as the main applicant', [ap(1, { pan_no: mainRow.pan_no })], /Applicant 3.*PAN/], ['same mobile as the main applicant', [ap(1, { mobile: mainRow.mobile })], /Applicant 3.*mobile/], ['same Aadhaar as the main applicant', [ap(1, { aadhaar_no: mainRow.aadhaar_no })], /Applicant 3.*Aadhaar/]]) { r = await ms(list); t(`additional: ${n} -> 400 naming the person`, r.s === 400 && rx.test(r.j?.error || ''), r.s + JSON.stringify(r.j).slice(0, 120)); }
const dupP = pan(); r = await ms([ap(1, { pan_no: dupP }), ap(2, { pan_no: dupP })]); t('additional: same PAN twice in the list -> 400', r.s === 400, r.s);
const dupM = mob(); r = await ms([ap(1, { mobile: dupM }), ap(2, { mobile: dupM })]); t('additional: same mobile twice in the list -> 400', r.s === 400, r.s);
r = await A('GET', `/consumers/${ma}/multi-applicants`); t('additional: after all the bad saves the two people are still there', r.j.data.length === 2 && r.j.data[0].first_name === 'Add1' && r.j.data[0].dob === '1995-05-02', JSON.stringify(r.j.data.map(x => x.first_name)));
r = await ms([ap(5), ap(6), ap(7)]); r2 = await A('GET', `/consumers/${ma}/multi-applicants`); t('additional: saving again replaces the list (3 people now)', r.s === 201 && r2.j.data.length === 3 && r2.j.data.every(x => /^Add[567]$/.test(x.first_name)), r2.j.data.length);
const ids = r2.j.data.map(x => x.id);
r = await A('DELETE', `/consumers/${ma}/multi-applicants/${ids[0]}`); r2 = await A('GET', `/consumers/${ma}/multi-applicants`); t('additional: deleting the first renumbers the rest from 3', r.s === 200 && r2.j.data.map(x => x.applicant_number).join() === '3,4' && r2.j.data[0].id === ids[1], r.s + ' ' + r2.j.data.map(x => x.applicant_number));
r = await A('DELETE', `/consumers/${ma}/multi-applicants/${ids[0]}`); t('additional: deleting the same person again -> 404', r.s === 404, r.s);
r = await A('DELETE', `/consumers/${ua}/multi-applicants/${ids[1]}`); t("additional: deleting through another applicant's id -> 404, person kept", r.s === 404 && (await A('GET', `/consumers/${ma}/multi-applicants`)).j.data.length === 2, r.s);
r = await A('DELETE', `/consumers/${ma}/multi-applicants/not-an-id`); t('additional: delete with an id that is not an id -> 400', r.s === 400, r.s);
r = await up(`/consumers/${ua}/multi-applicant-photo/${ids[1]}`, 'image/png', 'x.png', png, tokA); t("additional: photo for somebody else's additional applicant -> 404", r.s === 404, r.s);
r = await up(`/consumers/${ma}/multi-applicant-photo/${ids[1]}`, 'image/png', 'x.png', png, tokA); t('additional: photo saved for the right person', r.s === 200, r.s + JSON.stringify(r.j));
r = await ms([]); t('additional: saving an empty list clears them', r.s === 201 && (await A('GET', `/consumers/${ma}/multi-applicants`)).j.data.length === 0, r.s);
r = await A('POST', `/consumers/${NIL}/multi-applicants`, { applicants: [] }); t('additional: unknown applicant -> 404', r.s === 404, r.s);

// ---------- random input: never a 500, accepted data reads back ----------
const junk = () => pick([null, '', ' ', 0, -1, 1e30, true, false, [], {}, [1, 2], { a: 1 }, 'a'.repeat(ri(1, 400)), '<img src=x onerror=1>', "'; drop table consumers;--", '\u0000', '‮', '🙂🙂', '9'.repeat(ri(1, 30)), 'NaN', '-0', '1e999', '0x1F', '2020-02-30', '＜script＞']);
const fields = ['name', 'first_name', 'last_name', 'mobile', 'email', 'pan_no', 'aadhaar_no', 'dob', 'gender', 'annual_income', 'present_pin', 'present_city', 'income_category', 'lead_stage', 'no_of_children', 'nominee_share', 'has_poa', 'applicant_type', 'company_gstin', 'passport_no', 'project_id'];
let five = [], okRead = true, rndMade = 0;
for (let i = 0; i < 80; i++) {
  const b = { name: 'Rnd ' + ri(1, 1e6), mobile: mob(), project_id: P1 };
  for (let k = ri(1, 4); k > 0; k--) b[pick(fields)] = junk();
  const x = await A('POST', '/consumers', b); if (x.s >= 500) five.push(['POST', JSON.stringify(b).slice(0, 150), x.s]);
  if (x.s < 300) { rndMade++; made.push(x.j.data.id); const g = await A('GET', `/consumers/${x.j.data.id}`); if (g.s !== 200) okRead = false;
    const p = {}; for (let k = ri(1, 3); k > 0; k--) p[pick(fields.filter(f => f !== 'project_id'))] = junk();
    const y = await A('PATCH', `/consumers/${x.j.data.id}`, p); if (y.s >= 500) five.push(['PATCH', JSON.stringify(p).slice(0, 150), y.s]); }
  if (i % 8 === 0) await new Promise(r => setTimeout(r, 40));
}
t(`random: 80 random creates (${rndMade} accepted) and their random updates never gave a 500`, five.length === 0, JSON.stringify(five.slice(0, 3)));
t('random: every accepted applicant reads back', okRead);
five = []; for (let i = 0; i < 60; i++) { const q = pick(['search', 'mobile', 'pan', 'city', 'dob', 'page', 'pageSize', 'sortBy', 'sortOrder', 'projectId', 'leadStage', 'email', 'unitNo']) + '=' + encodeURIComponent(String(junk())); const x = await A('GET', '/consumers?' + q); if (x.s >= 500) five.push([q, x.s]); if (i % 10 === 0) await new Promise(r => setTimeout(r, 40)); }
t('random: 60 random list queries never gave a 500', five.length === 0, JSON.stringify(five.slice(0, 3)));
five = []; for (let i = 0; i < 40; i++) { const sub = pick(['remarks', 'kyc-documents', 'multi-applicants', 'base-rate']); const p = { notes: junk(), tags: junk(), documentType: junk(), fileUrl: junk(), applicants: junk(), baseRate: junk(), channel: junk() }; const x = await A('POST', `/consumers/${pick([ua, NIL, 'zz'])}/${sub}`, p); if (x.s >= 500) five.push([sub, x.s]); }
t('random: 40 random posts to remarks, KYC, additional applicants and base rate never gave a 500', five.length === 0, JSON.stringify(five.slice(0, 3)));

// ---------- clean up ----------
const ids2 = made.filter(Boolean).map(x => `'${x}'`).join(',');
for (const tbl of ['financial_audit_logs', 'remarks', 'kyc_documents', 'co_applicants', 'booking_records', 'allocations']) { try { psql(`delete from ${tbl} where consumer_id in (${ids2})`); } catch {} }
try { psql(`delete from consumers where id in (${ids2})`); } catch {}
try { psql(`delete from user_process_permissions where user_id='${seId}' and process_name in ('new_applicant','edit_applicant')`); } catch {}
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
