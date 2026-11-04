// Set Master audit fixes SM-001 to SM-015: regression checks. Each check fails on the code as it was before the fix.
// Run: BASE=http://localhost:3010/api node docs/set-master-fixes/api-test-set-master-fixes.mjs   (psql must reach the same database)
// Own data per run (projects, a limited login, companies, banks), removed at the end. Logo files are written under the server's
// working directory (uploads/company-logos) and removed again.
import { execFileSync } from 'node:child_process';
import { readFileSync, unlinkSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const B = process.env.BASE || 'http://localhost:3010/api';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300))); };
const call = (tok) => async (m, p, b, raw) => { const r = await fetch(B + p, { method: m, headers: { ...(raw ? {} : { 'content-type': 'application/json' }), ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: raw ? raw : b === undefined ? undefined : JSON.stringify(b) }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const login = async (e) => (await call()('POST', '/auth/login', { email: e, password: 'Test#Pass1234' })).j?.token;
// SMFIX_SOFT=1 lets the script run to the end against code that does not have the fixes (a failed statement then gives an empty answer)
const psql = (sql) => { try { return execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); } catch (e) { if (process.env.SMFIX_SOFT) return ''; throw e; } };
const U = Date.now().toString(36).slice(-5);
const A = call(await login('super_admin@test.local')), PM = call(await login('project_manager@test.local')), SE = call(await login('sales_executive@test.local'));
const RO = call(await login('read_only_viewer@test.local')), SUP = call(await login('support_agent@test.local')), FIN = call(await login('accounts_finance@test.local'));

// own projects and a login limited to the first one
const pA = psql(`insert into projects (name, rera_number, tcp_licence) values ('SMFIX A ${U}','RA${U}','TA${U}') returning id`).split('\n')[0];
const pB = psql(`insert into projects (name, rera_number, tcp_licence) values ('SMFIX B ${U}','RB${U}','TB${U}') returning id`).split('\n')[0];
const hash = psql(`select password_hash from users where email='project_manager@test.local'`);
const scopedEmail = `smfix_scoped_${U}@test.local`;
psql(`insert into users (email,name,role,password_hash,is_active,assigned_project_ids) values ('${scopedEmail}','smfix scoped','project_manager','${hash}',true,'["${pA}"]'::jsonb)`);
const SC = call(await login(scopedEmail));
const made = { area: [], cur: [], rem: [], dt: [], dm: [], banks: [], companies: [], disp: [], tax: [], towers: [], unitTypes: [], lists: [], countries: [] };

// ---------- SM-001: area types and currencies in use ----------
let r = await A('POST', '/master/area-types', { name: `SMFIX Acre ${U}` }); const AT = r.j?.data?.id; made.area.push(AT);
r = await A('POST', '/master/area-types', { name: `SMFIX Unused ${U}` }); const AT2 = r.j?.data?.id; made.area.push(AT2);
r = await A('POST', '/master/unit-types', { project_id: pA, name: `SMFIX UT ${U}`, carpet_area_sqft: 800, unit_of_measurement: `SMFIX Acre ${U}` }); const UT = r.j?.data?.id; made.unitTypes.push(UT);
t('SM-001: unit type created with the new area type', r.s === 201, r);
r = await A('GET', '/master/usage');
t('SM-001: /usage lists areaTypes with a count for the area type a unit type holds', r.s === 200 && r.j.data.areaTypes?.[`SMFIX Acre ${U}`] === 1 && r.j.data.areaTypes?.[`SMFIX Unused ${U}`] === undefined, r.j?.data?.areaTypes);
t('SM-001: /usage lists currencies', typeof r.j?.data?.currencies === 'object');
r = await A('PUT', `/master/area-types/${AT}`, { name: `SMFIX Acre2 ${U}` }); t('SM-001: rename of an area type in use is 409 with a reason', r.s === 409 && /used on 1 record/.test(r.j?.error || ''), r);
r = await A('DELETE', `/master/area-types/${AT}`); t('SM-001: delete of an area type in use is 409', r.s === 409 && /Change them before deleting/.test(r.j?.error || ''), r);
t('SM-001: the area type and the unit type are unchanged', psql(`select count(*) from area_types where id='${AT}'`) === '1' && psql(`select unit_of_measurement from unit_types where id='${UT}'`) === `SMFIX Acre ${U}`);
r = await A('PUT', `/master/area-types/${AT2}`, { name: `SMFIX Unused2 ${U}` }); t('SM-001: rename of an unused area type works', r.s === 200, r);
r = await A('DELETE', `/master/area-types/${AT2}`); t('SM-001: delete of an unused area type works', r.s === 200, r); made.area = made.area.filter((x) => x !== AT2);
psql(`update projects set land_area_unit='smfix acre ${U}' where id='${pA}'`);
await A('DELETE', `/master/unit-types/${UT}`); made.unitTypes = [];
r = await A('DELETE', `/master/area-types/${AT}`); t('SM-001: a project land area unit counts too (letter case ignored)', r.s === 409, r);
psql(`update projects set land_area_unit=null where id='${pA}'`);
r = await A('DELETE', `/master/area-types/${AT}`); t('SM-001: delete works once nothing uses it', r.s === 200, r); made.area = [];
r = await A('POST', '/master/currencies', { name: `SMFIX Cur ${U}` }); const CU = r.j?.data?.id;
r = await A('DELETE', `/master/currencies/${CU}`); t('SM-001: a currency (held by no table) can be deleted', r.s === 200, r);

// ---------- SM-002: reminders per project ----------
const rem = (b) => A('POST', '/master/reminder-master', b);
r = await rem({ name: `SMFIX Rem ${U}`, days_before: 10, project_id: pA }); made.rem.push(r.j?.data?.id); t('SM-002: reminder created in project A', r.s === 201, r);
r = await rem({ name: `smfix rem ${U}`, days_before: 10, project_id: pB }); made.rem.push(r.j?.data?.id); t('SM-002: same name (other letter case) and days in project B is allowed', r.s === 201, r);
r = await rem({ name: `SMFIX REM ${U}`, days_before: 10, project_id: pA }); t('SM-002: same name and days again in project A is 409', r.s === 409, r);
r = await rem({ name: `SMFIX Rem ${U}`, days_before: 10 }); made.rem.push(r.j?.data?.id); t('SM-002: a global reminder (no project) with the same name and days is allowed', r.s === 201, r);
r = await rem({ name: `smfix rem ${U}`, days_before: 10 }); t('SM-002: a second global reminder with the same name and days is 409', r.s === 409, r);
t('SM-002: the database key includes the project', /project_id/.test(psql(`select indexdef from pg_indexes where indexname='uq_reminder_name_days_project'`)) && psql(`select count(*) from pg_indexes where indexname='uq_reminder_name_days'`) === '0');
let dupSql = true; try { psql(`insert into reminder_master (reminder_name, days, project_id) values ('smfix rem ${U}', 10, '${pA}')`); dupSql = false; } catch {}
t('SM-002: the database itself refuses a duplicate in one project (case-insensitive)', dupSql);

// ---------- SM-003 and SM-012: a login limited to project A ----------
r = await A('POST', '/master/document-types', { name: `SMFIX Global ${U}`, required_at: 'On Booking' }); const GD = r.j?.data?.id; made.dt.push(GD);
r = await A('POST', '/master/document-types', { name: `SMFIX DocA ${U}`, required_at: 'On Booking', project_id: pA }); const DA = r.j?.data?.id; made.dt.push(DA);
r = await A('POST', '/master/document-types', { name: `SMFIX DocB ${U}`, required_at: 'On Booking', project_id: pB }); const DB = r.j?.data?.id; made.dt.push(DB);
r = await SC('POST', '/master/document-types', { name: `SMFIX ScGlobal ${U}`, required_at: 'Other' }); t('SM-003: limited login cannot create a global document type', r.s === 403, r); if (r.j?.data?.id) made.dt.push(r.j.data.id);
r = await SC('PUT', `/master/document-types/${GD}`, { description: 'x' }); t('SM-003: limited login cannot edit a global document type', r.s === 403, r);
r = await SC('DELETE', `/master/document-types/${GD}`); t('SM-003: limited login cannot delete a global document type', r.s === 403, r);
r = await SC('PUT', `/master/document-types/${DA}`, { project_id: null }); t('SM-003: limited login cannot turn its own project document into a global one', r.s === 403, r);
r = await SC('PUT', `/master/document-types/${DA}`, { description: 'own project' }); t('SM-003: limited login can edit a document of its own project', r.s === 200, r);
r = await SC('POST', '/master/document-types', { name: `SMFIX DocA2 ${U}`, required_at: 'Other', project_id: pA }); t('SM-003: limited login can create a document in its own project', r.s === 201, r); if (r.j?.data?.id) made.dt.push(r.j.data.id);
r = await SC('PUT', `/master/document-types/${DB}`, { description: 'x' }); t('SM-003: limited login cannot edit another project document (not found)', r.s === 404, r);
r = await SC('DELETE', `/master/document-types/${DB}`); t('SM-003: limited login cannot delete another project document (a project manager has no delete right at all)', r.s === 403, r);
t('SM-003: the other project document is still there', psql(`select count(*) from document_types where id='${DB}'`) === '1');
r = await SC('POST', '/master/document-types', { name: `SMFIX DocB2 ${U}`, required_at: 'Other', project_id: pB }); t('SM-003: limited login cannot create in another project', r.s >= 400 && r.s < 500, r);
t('SM-003: global document is unchanged', psql(`select coalesce(description,'-') from document_types where id='${GD}'`) === '-');
const [remA, remB, remG] = made.rem;
r = await SC('PATCH', `/master/reminder-master/${remG}`, { days_before: 99 }); t('SM-003: limited login cannot change a global reminder', r.s === 403, r);
r = await SC('DELETE', `/master/reminder-master/${remG}`); t('SM-003: limited login cannot delete a global reminder', r.s === 403, r);
r = await SC('POST', '/master/reminder-master', { name: `SMFIX ScRem ${U}`, days_before: 3 }); t('SM-003: limited login cannot create a global reminder', r.s === 403, r);
r = await SC('PATCH', `/master/reminder-master/${remA}`, { days_before: 11 }); t('SM-003: limited login can change a reminder of its own project', r.s === 200, r);
r = await SC('PATCH', `/master/reminder-master/${remB}`, { days_before: 11 }); t('SM-003: limited login cannot change another project reminder', r.s === 404, r);
t('SM-003: the global reminder still has 10 days', psql(`select days from reminder_master where id='${remG}'`) === '10');
r = await SC('POST', '/master/document-dispatch-master', { name: `SMFIX Dm ${U}` }); t('SM-003: limited login cannot create a global dispatch master entry', r.s === 403, r); if (r.j?.data?.id) made.dm.push(r.j.data.id);
r = await A('POST', '/master/document-dispatch-master', { name: `SMFIX DmG ${U}` }); const DMG = r.j?.data?.id; made.dm.push(DMG);
r = await SC('DELETE', `/master/document-dispatch-master/${DMG}`); t('SM-003: limited login cannot delete a global dispatch master entry', r.s === 403, r);
r = await A('PUT', `/master/document-types/${GD}`, { description: 'by super admin' }); t('SM-003: super admin can still edit a global document type', r.s === 200, r);
r = await PM('PUT', `/master/document-types/${GD}`, { description: 'by unlimited manager' }); t('SM-003: a manager with no project limit can still edit a global document type', r.s === 200, r);

// ---------- SM-006 and SM-012: banks ----------
r = await A('POST', '/master/banks', { name: `SMFIX Bank ${U}`, ifsc_prefix: 'smfx', is_customer_bank: true, is_loan_bank: true }); const BK = r.j?.data?.id; made.banks.push(BK);
t('SM-006: bank created, IFSC prefix stored in capitals', r.s === 201 && r.j.data.ifsc_prefix === 'SMFX', r);
r = await A('PUT', `/master/banks/${BK}`, { is_customer_bank: false, is_loan_bank: false }); t('SM-006: edit to neither customer nor loan is 400', r.s === 400 && /customer bank, a loan bank or both/.test(r.j?.error || ''), r);
r = await A('PUT', `/master/banks/${BK}`, { is_customer_bank: false }); t('SM-006: edit of one flag is judged on the final state (loan stays, so it passes)', r.s === 200, r);
r = await A('PUT', `/master/banks/${BK}`, { is_loan_bank: false }); t('SM-006: the other flag cannot then be switched off (final state would be neither)', r.s === 400, r);
r = await A('PUT', `/master/banks/${BK}`, { is_customer_bank: true }); t('SM-006: customer and loan again', r.s === 200, r);
r = await A('PUT', `/master/banks/${BK}/projects`, { projectIds: [pA, pB] }); t('SM-006: approvals saved for two projects', r.s === 200 && psql(`select count(*) from loan_bank_projects where bank_id='${BK}'`) === '2', r);
const auditBefore = Number(psql(`select count(*) from audit_logs where resource_id='${BK}'`));
r = await A('PUT', `/master/banks/${BK}`, { is_loan_bank: false }); t('SM-006: customer-only is allowed', r.s === 200, r);
t('SM-006: the approvals are removed when the bank stops being a loan bank', psql(`select count(*) from loan_bank_projects where bank_id='${BK}'`) === '0');
t('SM-006: the change and the removed approvals are audited', Number(psql(`select count(*) from audit_logs where resource_id='${BK}'`)) >= auditBefore + 2);
r = await A('PUT', `/master/banks/${BK}/projects`, { projectIds: [] }); t('SM-006: a customer-only bank cannot take approvals', r.s === 400, r);
psql(`insert into loan_bank_projects (bank_id, project_id) values ('${BK}','${pB}')`); // a stale row left by the old behaviour
r = await A('PUT', `/master/banks/${BK}`, { is_loan_bank: true }); t('SM-006: made a loan bank again it starts with no stale approvals', r.s === 200 && psql(`select count(*) from loan_bank_projects where bank_id='${BK}'`) === '0', r);
r = await A('POST', '/master/banks', { name: `SMFIX Bad ${U}`, is_customer_bank: false }); t('SM-006: create with neither flag is 400', r.s === 400, r);
r = await A('PUT', `/master/banks/${BK}`, { is_customer_bank: 'yes' }); t('SM-006: a flag that is not true or false is 400', r.s === 400, r);
r = await A('PUT', `/master/banks/${BK}/projects`, { projectIds: [pA, pB] });
r = await SC('PUT', `/master/banks/${BK}/projects`, { projectIds: [] }); t('SM-012: limited login cannot replace the approvals', r.s === 403, r);
t('SM-012: both approvals are still there', psql(`select count(*) from loan_bank_projects where bank_id='${BK}'`) === '2');
r = await SC('PUT', `/master/banks/${BK}`, { is_loan_bank: false }); t('SM-012: limited login cannot switch a bank off as a loan bank', r.s === 403, r);
r = await SC('PUT', `/master/banks/${BK}`, { branch: 'Main' }); t('SM-012: limited login can still edit other bank details', r.s === 200, r);
r = await A('PUT', `/master/banks/${BK}/projects`, { projectIds: [pA] }); t('SM-012: super admin replaces the list in one step', r.s === 200 && psql(`select string_agg(project_id::text, ',') from loan_bank_projects where bank_id='${BK}'`) === pA, r);
const race = await Promise.all([1, 2, 3, 4].map((i) => A('PUT', `/master/banks/${BK}/projects`, { projectIds: i % 2 ? [pA, pB] : [pA] })));
t('SM-012: concurrent replacements all succeed and leave one consistent list', race.every((x) => x.s === 200) && ['1', '2'].includes(psql(`select count(*) from loan_bank_projects where bank_id='${BK}'`)), race.map((x) => x.s));

// ---------- SM-013: field checks ----------
r = await A('POST', '/master/banks', { name: `SMFIX Ifsc ${U}`, ifsc_prefix: '!!!' }); t('SM-013: IFSC prefix of symbols is 400', r.s === 400 && /IFSC prefix/.test(r.j?.error || ''), r); if (r.j?.data?.id) made.banks.push(r.j.data.id);
r = await A('POST', '/master/banks', { name: `SMFIX Ifsc2 ${U}`, ifsc_prefix: 'HD' }); t('SM-013: IFSC prefix of 2 characters is 400', r.s === 400, r); if (r.j?.data?.id) made.banks.push(r.j.data.id);
r = await A('POST', '/master/banks', { name: `SMFIX Ifsc3 ${U}`, ifsc_prefix: 'E2EB' }); t('SM-013: letters and digits are accepted (existing e2e data uses E2EB)', r.s === 201 && r.j.data.ifsc_prefix === 'E2EB', r); if (r.j?.data?.id) made.banks.push(r.j.data.id);
r = await A('POST', '/master/banks', { name: 'B'.repeat(201) }); t('SM-013: bank name over 200 characters names the field', r.s === 400 && /Name can be at most 200/.test(r.j?.error || ''), r);
r = await A('POST', '/master/banks', { name: `SMFIX Br ${U}`, branch: 'x'.repeat(201) }); t('SM-013: branch over 200 characters names the field', r.s === 400 && /Branch can be at most 200/.test(r.j?.error || ''), r);
r = await A('POST', '/master/professions', { name: 'P'.repeat(101) }); t('SM-013: profession over 100 characters names the field', r.s === 400 && /at most 100/.test(r.j?.error || ''), r);
r = await A('POST', '/master/sources-of-enquiry', { name: `SMFIX Src ${U}`, description: 'd'.repeat(1001) }); t('SM-013: source description over 1000 characters is 400', r.s === 400 && /Description can be at most 1000/.test(r.j?.error || ''), r);
r = await A('POST', '/master/sources-of-enquiry', { name: `SMFIX Src ${U}`, description: 'walk in' }); t('SM-013: a normal source is accepted', r.s === 201, r); if (r.j?.data?.id) made.lists.push(['sources-of-enquiry', r.j.data.id]);
r = await A('POST', '/master/countries', { name: `SMFIX C ${U}`, abbreviation: 'SF', iso_code: 'SF', isd_code: '12345', mobile_digits: 10 }); t('SM-013: ISD code of 5 digits is 400 (1 to 4)', r.s === 400 && /ISD code/.test(r.j?.error || ''), r);
r = await A('POST', '/master/countries', { name: 'C'.repeat(151), abbreviation: 'SF', iso_code: 'SF', isd_code: '1', mobile_digits: 10 }); t('SM-013: country name over 150 characters names the field', r.s === 400 && /Name can be at most 150/.test(r.j?.error || ''), r);
r = await A('POST', '/master/countries', { name: `SMFIX Ok ${U}`, abbreviation: 'SF', iso_code: 'sf', isd_code: '+998', mobile_digits: 9 }); t('SM-013: a plus before the ISD code is still accepted and removed', r.s === 201 && r.j.data.isd_code === '998', r); if (r.j?.data?.id) made.countries.push(r.j.data.id);

// ---------- SM-010: direction control characters ----------
for (const [n, ch] of [['U+202E override', '‮'], ['U+202A embedding', '‪'], ['U+2066 isolate', '⁦'], ['U+2069 isolate end', '⁩']]) {
  r = await A('POST', '/master/nationalities', { name: `SMFIX ${n[0]}${ch}evil ${U}` }); t(`SM-010: ${n} in a list name is 400`, r.s === 400 && /not allowed/.test(r.j?.error || ''), r); if (r.j?.data?.id) made.lists.push(['nationalities', r.j.data.id]);
}
for (const [label, name] of [['Arabic', `العربية ${U}`], ['Hebrew', `עברית ${U}`], ['Hindi', `हिन्दी ${U}`], ['punctuation', `O'Neil & Sons, Ltd. (${U})`], ['right-to-left mark', `SMFIX‏ mark ${U}`]]) {
  r = await A('POST', '/master/professions', { name }); t(`SM-010: ${label} text is accepted`, r.s === 201 && r.j.data.name.includes(name.slice(0, 4)), r); if (r.j?.data?.id) made.lists.push(['professions', r.j.data.id]);
}
r = await A('POST', '/master/document-types', { name: `SMFIX ‮evil ${U}`, required_at: 'Other' }); t('SM-010: document type name with an override is 400', r.s === 400, r);
r = await A('POST', '/master/reminder-master', { name: `SMFIX ‮evil ${U}`, days_before: 1 }); t('SM-010: reminder name with an override is 400 (shared text helper)', r.s === 400, r);
r = await A('POST', '/companies', { name: `SMFIX ‮Co ${U}` }); t('SM-010: company name with an override is 400', r.s === 400, r);

// ---------- SM-005: document stages ----------
const stages = ['On Booking', 'On Allotment', 'On Agreement', 'On Possession', 'On Transfer', 'On Demand', 'Other'];
const fe = readFileSync(join(ROOT, 'packages/web/public/js/pages/set-master-docs.js'), 'utf8');
const feStages = (fe.match(/const STAGES = \[([^\]]*)\]/)?.[1] || '').split(',').map((x) => x.trim().replace(/^'|'$/g, '')).filter(Boolean);
for (const st of stages) {
  r = await A('POST', '/master/document-types', { name: `SMFIX Stage ${st} ${U}`, required_at: st }); if (r.j?.data?.id) made.dt.push(r.j.data.id);
  const id = r.j?.data?.id;
  t(`SM-005: stage "${st}" can be created and is offered by the screen`, r.s === 201 && feStages.includes(st), { api: r.s, feStages });
  r = await A('PUT', `/master/document-types/${id}`, { description: 'edited', required_at: st }); t(`SM-005: stage "${st}" survives an edit`, r.s === 200 && r.j.data.required_at === st, r);
  r = await A('GET', '/master/document-types'); t(`SM-005: stage "${st}" is listed`, r.j.data.some((d) => d.id === id && d.required_at === st));
}

// ---------- SM-011: history is not rewritten ----------
r = await A('POST', '/master/document-types', { name: `SMFIX Hist ${U}`, required_at: 'Other' }); const HD = r.j?.data?.id; made.dt.push(HD);
r = await A('POST', '/master/document-dispatch', { document_type: `SMFIX Hist ${U}`, dispatch_mode: 'Courier', tracking_no: `T${U}` }); made.disp.push(r.j?.data?.id);
const dispAudit = Number(psql(`select count(*) from audit_logs where resource_type='master.document_dispatch'`));
r = await A('PUT', `/master/document-types/${HD}`, { name: `SMFIX Hist Renamed ${U}` }); t('SM-011: renaming a document type that history uses is refused', r.s === 409 && /cannot be renamed/.test(r.j?.error || ''), r);
t('SM-011: the dispatch entry still carries the name it was saved with', psql(`select document_type from document_dispatch where id='${made.disp[0]}'`) === `SMFIX Hist ${U}`);
t('SM-011: the document type keeps its name', psql(`select name from document_types where id='${HD}'`) === `SMFIX Hist ${U}`);
r = await A('PUT', `/master/document-types/${HD}`, { name: `smfix hist ${U}`, description: 'case only' }); t('SM-011: a change of letter case only is allowed (history still matches the name without regard to case)', r.s === 200 && psql(`select document_type from document_dispatch where id='${made.disp[0]}'`) === `SMFIX Hist ${U}`, r);
await A('PUT', `/master/document-types/${HD}`, { name: `SMFIX Hist ${U}` });
r = await A('PUT', `/master/document-types/${HD}`, { description: 'other fields still editable' }); t('SM-011: other fields of that document type can still be edited', r.s === 200, r);
r = await A('DELETE', `/master/document-types/${HD}`); t('SM-011: delete is refused while history uses the name', r.s === 409, r);
r = await A('POST', '/master/document-types', { name: `SMFIX Hist ${U}`, required_at: 'Other', project_id: pA }); const HD2 = r.j?.data?.id; made.dt.push(HD2);
r = await A('DELETE', `/master/document-types/${HD2}`); t('SM-011: one of two same-name types can be deleted while the other keeps the name', r.s === 200, r);
r = await A('POST', '/master/document-types', { name: `SMFIX Fresh ${U}`, required_at: 'Other' }); const FD = r.j?.data?.id; made.dt.push(FD);
r = await A('PUT', `/master/document-types/${FD}`, { name: `SMFIX Fresh Renamed ${U}` }); t('SM-011: a document type with no history can be renamed', r.s === 200, r);
t('SM-011: no dispatch audit rows were added by those renames', Number(psql(`select count(*) from audit_logs where resource_type='master.document_dispatch'`)) === dispAudit);

// ---------- SM-009: tax slabs and floors ----------
const tx = (b) => A('POST', '/master/tax-slabs', b);
r = await tx({ name: `SMFIX Tax ${U}`, cgst_percent: 9, sgst_percent: 9, igst_percent: 18, effective_from: '2026-04-01' }); const TS = r.j?.data?.id; if (TS) made.tax.push(TS); t('SM-009: a valid tax slab is created', r.s === 201 && Number(r.j.data.igst_percent) === 18, r);
for (const [label, body, re] of [['negative CGST', { name: `SMFIX T1 ${U}`, cgst_percent: -5 }, /CGST percent/], ['CGST over 100', { name: `SMFIX T2 ${U}`, cgst_percent: 101 }, /CGST percent/], ['SGST text', { name: `SMFIX T3 ${U}`, sgst_percent: 'abc' }, /SGST percent/],
  ['IGST 3 decimals', { name: `SMFIX T4 ${U}`, igst_percent: 9.125 }, /IGST percent/], ['bad date', { name: `SMFIX T5 ${U}`, effective_from: '2026-02-30' }, /Effective from/], ['is_active text', { name: `SMFIX T6 ${U}`, is_active: 'maybe' }, /Is active/],
  ['no name', { cgst_percent: 9 }, /Name is required/], ['name over 100', { name: 'T'.repeat(101) }, /Name can be at most 100/]]) {
  r = await tx(body); if (r.j?.data?.id) made.tax.push(r.j.data.id); t(`SM-009: tax slab ${label} is 400 and names the field`, r.s === 400 && re.test(r.j?.error || ''), r);
}
r = await tx({ name: `smfix tax ${U}` }); if (r.j?.data?.id) made.tax.push(r.j.data.id); t('SM-009: tax slab name differing only by case is 409', r.s === 409, r);
r = await A('PUT', `/master/tax-slabs/${TS}`, { cgst_percent: 6 }); t('SM-009: a tax slab edit changes only what was sent', r.s === 200 && Number(r.j.data.cgst_percent) === 6 && Number(r.j.data.igst_percent) === 18 && r.j.data.effective_from?.slice(0, 10) === '2026-04-01', r);
r = await A('PUT', `/master/tax-slabs/${TS}`, { sgst_percent: 200 }); t('SM-009: tax slab edit over 100 is 400', r.s === 400, r);
r = await A('PUT', '/master/tax-slabs/not-an-id', { cgst_percent: 6 }); t('SM-009: tax slab edit with a bad id is 400', r.s === 400 && /Tax slab id/.test(r.j?.error || ''), r);
const TW = psql(`insert into towers (project_id, tower_name) values ('${pA}','SMFIX Tower ${U}') returning id`).split('\n')[0]; made.towers.push(TW);
const fl = (b) => A('POST', '/master/floors', b);
r = await fl({ tower_id: TW, floor_number: 3, floor_name: 'Third' }); const FL = r.j?.data?.id; t('SM-009: a valid floor is created', r.s === 201, r);
r = await fl({ tower_id: TW, floor_number: 3 }); t('SM-009: the same floor number in the same tower is 409', r.s === 409, r);
for (const [label, body, re] of [['no tower', { floor_number: 4 }, /Tower/], ['tower id not valid', { tower_id: 'abc', floor_number: 4 }, /Tower is not valid/], ['unknown tower', { tower_id: '00000000-0000-0000-0000-000000000000', floor_number: 4 }, /Tower not found/],
  ['no number', { tower_id: TW }, /Floor number is required/], ['number 1.5', { tower_id: TW, floor_number: 1.5 }, /whole number/], ['number 301', { tower_id: TW, floor_number: 301 }, /-5 to 300/], ['number text', { tower_id: TW, floor_number: 'two' }, /whole number/],
  ['name over 50', { tower_id: TW, floor_number: 5, floor_name: 'F'.repeat(51) }, /Floor name can be at most 50/]]) {
  r = await fl(body); t(`SM-009: floor ${label} is rejected with a field message`, r.s >= 400 && r.s < 500 && re.test(r.j?.error || ''), r);
}
r = await A('PUT', `/master/floors/${FL}`, { floor_name: 'Third floor' }); t('SM-009: a floor edit keeps tower and number', r.s === 200 && r.j.data.floor_number === 3 && r.j.data.floor_name === 'Third floor', r);
r = await A('PUT', `/master/floors/${FL}`, { floor_number: 400 }); t('SM-009: a floor edit to a number out of range is 400', r.s === 400, r);
r = await PM('DELETE', `/master/floors/${FL}`); t('SM-009: only super admin deletes floors', r.s === 403, r);
r = await A('DELETE', `/master/floors/${FL}`); t('SM-009: super admin deletes the floor', r.s === 200, r);

// ---------- SM-015: JSON errors, dispatch date control ----------
r = await A('GET', '/master/not-a-route'); t('SM-015: an unknown path under /master answers in JSON', r.s === 404 && r.j?.error === 'Not found', r);
r = await A('GET', '/not-a-module'); t('SM-015: an unknown API path answers in JSON', r.s === 404 && r.j?.error === 'Not found', r);
r = await A('POST', '/master/countries', undefined, '{bad json'); t('SM-015: malformed JSON is a 400 with a JSON body', r.s === 400 && typeof r.j?.error === 'string', r);
r = await A('POST', '/master/document-dispatch', { document_type: 'Notice', dispatch_mode: 'Email', dispatched_at: '2030-01-01' }); t('SM-015: the server still refuses a future dispatch date', r.s === 400, r);
t('SM-015: the dispatch edit form uses a date input', /key: 'dispatched_at', label: 'Date dispatched', type: 'date'/.test(fe));
r = await A('POST', '/master/document-dispatch', { document_type: `Free text ${U}`, dispatch_mode: 'Email' }); made.disp.push(r.j?.data?.id); t('SM-015: free-text dispatch document names are still accepted (dispatch master is not connected, left as it was)', r.s === 201, r);

// ---------- SM-004 and SM-008: companies ----------
const FULL = '123456789012345', MASK = 'XXXX2345';
r = await A('POST', '/companies', { name: `SMFIX Co ${U}`, gstin: '06ABCDE1234F1Z5', bank_account_no: FULL }); const C1 = r.j?.data?.id; made.companies.push(C1);
t('SM-004: company with a legacy bank account number is created', r.s === 201, r);
r = await A('POST', `/companies/${C1}/bank-accounts`, { bankName: 'HDFC Bank', accountNumber: '987654321098', ifscCode: 'HDFC0001234', isPrimary: true }); t('SM-004: a bank account is added', r.s === 200 || r.s === 201, r);
for (const [who, call_] of [['sales executive', SE], ['read only viewer', RO], ['support agent', SUP], ['project manager', PM]]) {
  const l = await call_('GET', '/companies'); const d = await call_('GET', `/companies/${C1}`); const b = await call_('GET', `/companies/${C1}/bank-accounts`);
  const row = l.j?.data?.find((c) => c.id === C1);
  t(`SM-004: ${who} gets the legacy account number masked in the list`, l.s === 200 && row?.bank_account_no === MASK, row?.bank_account_no);
  t(`SM-004: ${who} gets the legacy account number masked in the detail`, d.s === 200 && d.j.data.bank_account_no === MASK, d.j?.data?.bank_account_no);
  t(`SM-004: ${who} gets bank account numbers masked`, b.s === 200 && b.j.data.length === 1 && b.j.data[0].account_number === 'XXXX1098', b.j?.data);
  t(`SM-004: the full numbers appear nowhere in ${who}'s responses`, !JSON.stringify([l.j, d.j, b.j]).includes(FULL) && !JSON.stringify([l.j, d.j, b.j]).includes('987654321098'));
}
for (const [who, call_] of [['super admin', A], ['accounts finance', FIN]]) {
  const d = await call_('GET', `/companies/${C1}`); const b = await call_('GET', `/companies/${C1}/bank-accounts`); const l = await call_('GET', '/companies');
  t(`SM-004: ${who} still gets full account numbers`, d.j?.data?.bank_account_no === FULL && b.j?.data?.[0]?.account_number === '987654321098' && l.j?.data?.find((c) => c.id === C1)?.bank_account_no === FULL, { d: d.s, b: b.s });
}
r = await RO('GET', '/companies/00000000-0000-0000-0000-000000000000'); t('SM-004: an unknown company is still 404', r.s === 404, r);

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const upload = async (id) => { const fd = new FormData(); fd.append('logo', new Blob([png], { type: 'image/png' }), 'logo.png'); return call(await login('super_admin@test.local'))('POST', `/companies/${id}/logo`, undefined, fd); };
const gs = (k) => psql(`select coalesce((select value from global_settings where key='${k}'),'(none)')`);
const logoFiles = [];
r = await A('POST', '/companies', { name: `SMFIX Co2 ${U}`, gstin: '06ABCDE1234F1Z5' }); const C2 = r.j?.data?.id; made.companies.push(C2);
const saved = { name: gs('company_name'), logo: gs('company_logo_url') };
r = await A('PUT', `/companies/${C1}`, { write_to_global_settings: true }); t('SM-008: company 1 is made the active company', r.s === 200 && gs('company_name') === `SMFIX Co ${U}`, r);
const activeLogoBefore = gs('company_logo_url');
r = await upload(C2); logoFiles.push(C2); t('SM-008: a logo for the inactive company is saved on that company', r.s === 200 && psql(`select logo_url from companies where id='${C2}'`).includes(C2), r);
t('SM-008: the active company logo setting did not change', gs('company_logo_url') === activeLogoBefore && r.j?.active_logo_updated === false, { was: activeLogoBefore, now: gs('company_logo_url') });
r = await upload(C1); logoFiles.push(C1); t('SM-008: a logo for the active company updates the printed logo', r.s === 200 && r.j?.active_logo_updated === true && gs('company_logo_url').includes(C1), r);
r = await A('PUT', `/companies/${C2}`, { write_to_global_settings: true }); t('SM-008: making company 2 active copies its own logo', r.s === 200 && gs('company_name') === `SMFIX Co2 ${U}` && gs('company_logo_url').includes(C2), r);
r = await upload(C1); t('SM-008: a logo for company 1 (now inactive) leaves company 2 logo alone', r.s === 200 && gs('company_logo_url').includes(C2), gs('company_logo_url'));
// put the global settings back the way they were
for (const [k, v] of [['company_name', saved.name], ['company_logo_url', saved.logo]]) psql(v === '(none)' ? `delete from global_settings where key='${k}'` : `update global_settings set value='${v.replace(/'/g, "''")}' where key='${k}'`);
for (const id of logoFiles) for (const ext of ['png', 'jpg', 'gif']) { const f = join(process.env.UPLOADS_DIR || join(ROOT, 'packages/api/uploads/company-logos'), `${id}.${ext}`); if (existsSync(f)) try { unlinkSync(f); } catch {} }

// ---------- clean up ----------
for (const id of made.rem) if (id) psql(`delete from reminder_master where id='${id}'`);
for (const id of made.disp) if (id) psql(`delete from document_dispatch where id='${id}'`);
for (const id of made.dt) if (id) psql(`delete from document_types where id='${id}'`);
for (const id of made.dm) if (id) psql(`delete from document_dispatch_master where id='${id}'`);
for (const id of made.tax) psql(`delete from tax_slabs where id='${id}'`);
for (const id of made.towers) psql(`delete from towers where id='${id}'`);
for (const id of made.banks) psql(`delete from banks where id='${id}'`);
for (const id of made.countries) psql(`delete from countries where id='${id}'`);
for (const [p, id] of made.lists) await A('DELETE', `/master/${p}/${id}`);
for (const id of made.companies) psql(`delete from company_bank_accounts where company_id='${id}'; delete from companies where id='${id}'`);
psql(`delete from unit_types where project_id in ('${pA}','${pB}'); delete from reminder_master where project_id in ('${pA}','${pB}'); delete from loan_bank_projects where project_id in ('${pA}','${pB}')`);
const soft = (q) => { try { psql(q); } catch {} };
soft(`update users set is_active=false where email='${scopedEmail}'`); // kept, not deleted: audit rows point at it
soft(`delete from projects where id in ('${pA}','${pB}')`);
console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
