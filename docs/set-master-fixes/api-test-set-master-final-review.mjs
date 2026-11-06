// Set Master independent review follow-up (five items). Each check fails on the code as it was before these changes.
//   1 SM-004 company bank account numbers masked in Payments and Reports too; Custom Letters and Documents stay limited to roles that create documents
//   2 SM-001 area type and list usage is counted over all projects, so a login limited to Project A cannot rename or delete what Project B uses
//   3 SM-002 migration 144 preflight for duplicate reminders (never deletes anything)
//   4 SM-009 tax slab names unique ignoring letter case in the database (migration 145), concurrent requests, preflight
//   5 SM-008 active company remembered by id, so renaming it does not lose it
// Run: BASE=http://localhost:3010/api node docs/set-master-fixes/api-test-set-master-final-review.mjs   (psql must reach the same database)
// Own data per run, removed at the end. Index changes made for the preflight checks are put back before the script ends.
import { execFileSync } from 'node:child_process';
import { unlinkSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const B = process.env.BASE || 'http://localhost:3010/api';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MIG = join(ROOT, 'packages/api/src/db/migrations');
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300))); };
const call = (tok) => async (m, p, b, raw) => { const r = await fetch(B + p, { method: m, headers: { ...(raw ? {} : { 'content-type': 'application/json' }), ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: raw ? raw : b === undefined ? undefined : JSON.stringify(b) }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const login = async (e) => (await call()('POST', '/auth/login', { email: e, password: 'Test#Pass1234' })).j?.token;
const psqlRaw = (args) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const psql = (sql) => psqlRaw(['-c', sql]);
// runs a migration file; returns { ok, err }
const runFile = (file) => { try { psqlRaw(['-f', join(MIG, file)]); return { ok: true, err: '' }; } catch (e) { return { ok: false, err: String(e.stderr || e.message) }; } };
const U = Date.now().toString(36).slice(-5);
const A = call(await login('super_admin@test.local')), SE = call(await login('sales_executive@test.local')), RO = call(await login('read_only_viewer@test.local'));
const SUP = call(await login('support_agent@test.local')), FIN = call(await login('accounts_finance@test.local')), PMu = call(await login('project_manager@test.local'));
const hash = psql(`select password_hash from users where email='project_manager@test.local'`);
const pA = psql(`insert into projects (name, rera_number, tcp_licence) values ('SMFR A ${U}','FA${U}','TA${U}') returning id`).split('\n')[0];
const pB = psql(`insert into projects (name, rera_number, tcp_licence) values ('SMFR B ${U}','FB${U}','TB${U}') returning id`).split('\n')[0];
const mkUser = (role, tag) => { const e = `smfr_${tag}_${U}@test.local`; psql(`insert into users (email,name,role,password_hash,is_active,assigned_project_ids) values ('${e}','smfr ${tag}','${role}','${hash}',true,'["${pA}"]'::jsonb)`); return e; };
const scopedPmEmail = mkUser('project_manager', 'pm'), scopedSaEmail = mkUser('super_admin', 'sa');
const SPM = call(await login(scopedPmEmail)), SSA = call(await login(scopedSaEmail));
const gsKeys = ['active_company_id', 'company_name', 'company_logo_url'];
const gsSaved = Object.fromEntries(gsKeys.map((k) => [k, psql(`select coalesce((select value from global_settings where key='${k}'),'(none)')`)]));
const made = { companies: [], banks: [], area: [], reminders: [], tax: [] };

// ======================= 1. SM-004 other endpoints =======================
const FULL = '123456789012', MASKED = 'XXXX9012', FULL2 = '555566667777';
let r = await A('POST', '/companies', { name: `SMFR Co ${U}`, gstin: '06ABCDE1234F1Z5' }); const CO = r.j?.data?.id; made.companies.push(CO);
r = await A('POST', `/companies/${CO}/bank-accounts`, { bankName: 'HDFC Bank', accountNumber: FULL, ifscCode: 'HDFC0001234', isPrimary: true });
t('SM-004: company with a bank account is set up', r.s === 200 || r.s === 201, r);
psql(`update projects set company_id='${CO}' where id='${pA}'`);
const roles = { 'super admin': [A, true], 'accounts finance': [FIN, true], 'project manager': [PMu, false], 'sales executive': [SE, false], 'read only viewer': [RO, false], 'support agent': [SUP, false] };
for (const [who, [c, full]] of Object.entries(roles)) {
  r = await c('GET', `/payments/clearing-banks/${pA}`);
  const num = r.j?.data?.[0]?.account_number;
  t(`SM-004 payments clearing-banks: ${who} gets ${full ? 'the full' : 'a masked'} account number`, r.s === 200 && num === (full ? FULL : MASKED), { s: r.s, num });
  t(`SM-004 payments clearing-banks: ${who} response has no full number unless allowed`, full || !JSON.stringify(r.j).includes(FULL));
}
// project with no company: the older project-level bank_accounts table is the fallback
psql(`insert into bank_accounts (project_id, bank_name, account_number, ifsc_code) values ('${pB}','Legacy Bank','${FULL2}','LEGA0000001')`);
for (const [who, [c, full]] of Object.entries(roles)) {
  r = await c('GET', `/payments/clearing-banks/${pB}`);
  const num = r.j?.data?.[0]?.account_number;
  t(`SM-004 payments clearing-banks (legacy table): ${who} gets ${full ? 'the full' : 'a masked'} account number`, r.s === 200 && num === (full ? FULL2 : 'XXXX7777'), { s: r.s, num });
}
for (const [who, [c, full]] of Object.entries(roles)) {
  r = await c('GET', `/reports/cash-bank-summary?companyId=${CO}`);
  if (who === 'support agent') { t('SM-004 cash-bank-summary: support agent has no reports access (403)', r.s === 403, r); continue; }
  const row = r.j?.data?.find((x) => x.account_number && x.account_number.endsWith('9012'));
  t(`SM-004 cash-bank-summary: ${who} gets ${full ? 'the full' : 'a masked'} account number`, r.s === 200 && row?.account_number === (full ? FULL : MASKED), { s: r.s, n: row?.account_number });
  t(`SM-004 cash-bank-summary: ${who} response has no full number unless allowed`, full || !JSON.stringify(r.j).includes(FULL));
}
// letters print the number on purpose; only roles that can create documents may generate one
const NIL = '00000000-0000-0000-0000-000000000000';
for (const [who, c] of [['read only viewer', RO], ['support agent', SUP]]) {
  r = await c('POST', `/custom-letters/${NIL}/generate`, { consumer_id: NIL }); t(`SM-004 custom letters: ${who} cannot generate a letter (403)`, r.s === 403, r);
  r = await c('POST', '/documents/generate', { template_id: NIL, consumer_id: NIL }); t(`SM-004 documents generate: ${who} cannot generate (403)`, r.s === 403, r);
}
for (const [who, c] of [['sales executive', SE], ['project manager', PMu], ['accounts finance', FIN], ['super admin', A]]) {
  r = await c('POST', `/custom-letters/${NIL}/generate`, { consumer_id: NIL }); t(`SM-004 custom letters: ${who} passes the role check (404 for an unknown template, not 403)`, r.s === 404, r);
}

// ======================= 2. SM-001 usage across projects =======================
r = await A('POST', '/master/area-types', { name: `SMFR Area ${U}` }); const AT = r.j?.data?.id; made.area.push(AT);
psql(`insert into unit_types (project_id, name, unit_of_measurement) values ('${pB}','SMFR UT B ${U}','SMFR Area ${U}')`);
r = await SPM('GET', '/master/unit-types'); t('SM-001 setup: the limited manager cannot see Project B unit types', r.s === 200 && !r.j.data.some((u) => u.name.includes('SMFR UT B')), r);
r = await SPM('GET', '/master/usage'); t('SM-001: /usage for the limited manager still counts the Project B use', r.s === 200 && r.j.data.areaTypes?.[`SMFR Area ${U}`] === 1, r.j?.data?.areaTypes);
r = await SPM('PUT', `/master/area-types/${AT}`, { name: `SMFR Area2 ${U}` }); t('SM-001: manager limited to Project A cannot rename an area type Project B uses (409)', r.s === 409 && /is used on 1 record/.test(r.j?.error || ''), r);
r = await SSA('DELETE', `/master/area-types/${AT}`); t('SM-001: a super admin limited to Project A cannot delete an area type Project B uses (409)', r.s === 409, r);
r = await SPM('DELETE', `/master/area-types/${AT}`); t('SM-001: manager limited to Project A cannot delete it either (403, no delete right)', r.s === 403, r);
t('SM-001: area type and the Project B unit type are unchanged', psql(`select count(*) from area_types where id='${AT}' and name='SMFR Area ${U}'`) === '1' && psql(`select unit_of_measurement from unit_types where project_id='${pB}'`) === `SMFR Area ${U}`);
r = await A('PUT', `/master/area-types/${AT}`, { name: `SMFR Area3 ${U}` }); t('SM-001: an unlimited super admin is refused as well while Project B uses it (409)', r.s === 409, r);
psql(`delete from unit_types where project_id='${pB}'`);
r = await SPM('PUT', `/master/area-types/${AT}`, { name: `SMFR Area4 ${U}` }); t('SM-001: once nothing uses it the limited manager can rename it', r.s === 200, r);
// the same root cause for the applicant lists (consumers sit behind project scope)
r = await A('POST', '/master/salutations', { name: `SMFR${U}` }); const SAL = r.j?.data?.id;
psql(`update consumers set salutation='SMFR${U}', project_id='${pB}' where id=(select id from consumers order by created_at limit 1)`);
r = await SPM('PUT', `/master/salutations/${SAL}`, { name: `SMFRX${U}` }); t('SM-001 (same cause): limited manager cannot rename a salutation a Project B applicant carries', r.s === 409, r);
r = await SSA('DELETE', `/master/salutations/${SAL}`); t('SM-001 (same cause): limited super admin cannot delete it', r.s === 409, r);
r = await SPM('GET', '/master/usage'); t('SM-001 (same cause): /usage shows the Project B applicant', r.j?.data?.salutations?.[`SMFR${U}`] === 1, r.j?.data?.salutations);
psql(`update consumers set salutation=null, project_id=null where salutation='SMFR${U}'`);
r = await A('DELETE', `/master/salutations/${SAL}`); t('SM-001 (same cause): free again, super admin deletes it', r.s === 200, r);

// ======================= 3. SM-002 migration 144 preflight =======================
const idxExists = () => psql(`select count(*) from pg_indexes where indexname='uq_reminder_name_days_project'`) === '1';
psql(`drop index if exists uq_reminder_name_days_project`);
psql(`insert into reminder_master (reminder_name, days, project_id) values ('SMFR dup ${U}', 5, '${pA}'), ('smfr DUP ${U}', 5, '${pA}'), ('SMFR ok ${U}', 5, '${pA}'), ('SMFR ok ${U}', 5, '${pB}'), ('SMFR gl ${U}', 7, null), ('smfr GL ${U}', 7, null)`);
const before = psql(`select count(*) from reminder_master where reminder_name ilike 'smfr%${U}'`);
let m = runFile('144_reminder_unique_per_project.sql');
t('SM-002 preflight: duplicates stop the migration', !m.ok && /Migration 144 stopped, nothing was changed/.test(m.err), m.err.slice(0, 200));
t('SM-002 preflight: the report names both conflicting groups (project and global) with row ids and a remediation', /project [0-9a-f-]{36} \| name "SMFR dup/i.test(m.err) && /GLOBAL \(no project\) \| name "SMFR gl/i.test(m.err) && /ids [0-9a-f-]{36}, [0-9a-f-]{36}/.test(m.err) && /Remediation/.test(m.err), m.err.slice(0, 400));
t('SM-002 preflight: the same name and days in two projects is not reported as a conflict', !/SMFR ok/.test(m.err), m.err.slice(0, 300));
t('SM-002 preflight: nothing was deleted or changed and no index was created', psql(`select count(*) from reminder_master where reminder_name ilike 'smfr%${U}'`) === before && !idxExists());
psql(`delete from reminder_master where reminder_name = 'smfr DUP ${U}' or reminder_name = 'smfr GL ${U}'`);
m = runFile('144_reminder_unique_per_project.sql');
t('SM-002 preflight: with the duplicates resolved by hand the migration builds the index', m.ok && idxExists(), m.err.slice(0, 200));
m = runFile('144_reminder_unique_per_project.sql'); t('SM-002 preflight: and runs a second time without error', m.ok, m.err.slice(0, 200));
t('SM-002 preflight: the reminders left are exactly the ones kept', psql(`select count(*) from reminder_master where reminder_name ilike 'smfr%${U}'`) === '4');
psql(`delete from reminder_master where reminder_name ilike 'smfr%${U}'`);

// ======================= 4. SM-009 tax slab uniqueness =======================
const taxIdx = () => psql(`select count(*) from pg_indexes where indexname='uq_tax_slabs_name_ci'`) === '1';
t('SM-009: the database has the case-insensitive unique index', taxIdx());
let dbRefused = false; psql(`insert into tax_slabs (name) values ('SMFR Tax ${U}')`); try { psql(`insert into tax_slabs (name) values ('smfr TAX ${U}')`); } catch { dbRefused = true; }
t('SM-009: the database itself refuses a name that differs only by case', dbRefused);
psql(`delete from tax_slabs where lower(name) = lower('SMFR Tax ${U}')`);
const names = Array.from({ length: 12 }, (_, i) => [`SMFR Race ${U}`, `smfr race ${U}`, `SMFR RACE ${U}`][i % 3]);
const res = await Promise.all(names.map((n) => A('POST', '/master/tax-slabs', { name: n })));
res.forEach((x) => x.j?.data?.id && made.tax.push(x.j.data.id));
t('SM-009: 12 parallel requests with case variants create exactly one row', res.filter((x) => x.s === 201).length === 1 && psql(`select count(*) from tax_slabs where lower(name)=lower('SMFR Race ${U}')`) === '1', res.map((x) => x.s));
t('SM-009: every refused request is a clear 409, not a 500', res.filter((x) => x.s !== 201).every((x) => x.s === 409 && /already exists/.test(x.j?.error || '')), res.map((x) => x.s + ' ' + (x.j?.error || '')));
r = await A('POST', '/master/tax-slabs', { name: `SMFR Two ${U}` }); const TX = r.j?.data?.id; made.tax.push(TX);
r = await A('PUT', `/master/tax-slabs/${TX}`, { name: `smfr race ${U}` }); t('SM-009: renaming onto another slab name (other case) is 409', r.s === 409, r);
// preflight
psql(`drop index if exists uq_tax_slabs_name_ci`);
psql(`delete from tax_slabs where name ilike 'smfr%${U}'`); made.tax = [];
psql(`insert into tax_slabs (name, cgst_percent) values ('SMFR Pre ${U}', 9), ('smfr PRE ${U}', 6), ('SMFR Solo ${U}', 1)`);
const taxBefore = psql(`select count(*) from tax_slabs where name ilike 'smfr%${U}'`);
m = runFile('145_tax_slabs_name_unique_ci.sql');
t('SM-009 preflight: case-variant duplicates stop the migration with a report', !m.ok && /Migration 145 stopped, nothing was changed/.test(m.err) && /name "SMFR Pre/i.test(m.err) && /ids [0-9a-f-]{36}, [0-9a-f-]{36}/.test(m.err) && /Remediation/.test(m.err) && !/SMFR Solo/i.test(m.err), m.err.slice(0, 300));
t('SM-009 preflight: nothing was deleted or renamed and no index was created', psql(`select count(*) from tax_slabs where name ilike 'smfr%${U}'`) === taxBefore && !taxIdx());
psql(`delete from tax_slabs where name = 'smfr PRE ${U}'`);
m = runFile('145_tax_slabs_name_unique_ci.sql'); t('SM-009 preflight: after the manual fix the migration builds the index', m.ok && taxIdx(), m.err.slice(0, 200));
m = runFile('145_tax_slabs_name_unique_ci.sql'); t('SM-009 preflight: and runs a second time without error', m.ok, m.err.slice(0, 200));
psql(`delete from tax_slabs where name ilike 'smfr%${U}'`);

// ======================= 5. SM-008 renaming the active company =======================
const gs = (k) => psql(`select coalesce((select value from global_settings where key='${k}'),'(none)')`);
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const adminTok = await login('super_admin@test.local'); const logoFiles = [];
const upload = async (id) => { const fd = new FormData(); fd.append('logo', new Blob([PNG], { type: 'image/png' }), 'logo.png'); logoFiles.push(id); return call(adminTok)('POST', `/companies/${id}/logo`, undefined, fd); };
const origName = `SMFR Active ${U}`, newName = `SMFR Renamed ${U}`;
r = await A('POST', '/companies', { name: origName }); const C1 = r.j?.data?.id; made.companies.push(C1);
r = await A('PUT', `/companies/${C1}`, { write_to_global_settings: true }); t('SM-008: company is made active (stores its id and its printed name)', r.s === 200 && gs('active_company_id') === C1 && gs('company_name') === origName, { id: gs('active_company_id'), n: gs('company_name') });
r = await A('PUT', `/companies/${C1}`, { name: newName }); t('SM-008: the active company is renamed without switching active-company settings', r.s === 200 && gs('active_company_id') === C1, r);
t('SM-008: the printed company name setting is untouched by the rename (it changes only with "Set as active")', gs('company_name') === origName);
r = await upload(C1); t('SM-008: a logo uploaded after the rename still updates the active company logo', r.s === 200 && r.j?.active_logo_updated === true && gs('company_logo_url').includes(C1), { r: r.j, now: gs('company_logo_url') });
r = await A('POST', '/companies', { name: origName }); const C2 = r.j?.data?.id; made.companies.push(C2);
const logoBefore = gs('company_logo_url');
r = await upload(C2); t('SM-008: a new company that reuses the old name is not mistaken for the active one', r.s === 200 && r.j?.active_logo_updated === false && gs('company_logo_url') === logoBefore, { r: r.j, now: gs('company_logo_url') });
t('SM-008: the active company id is still the renamed company', gs('active_company_id') === C1);
// a database from before the id existed: only the printed name is stored, a rename must not lose the active company
r = await A('PUT', `/companies/${C1}`, { write_to_global_settings: true }); psql(`delete from global_settings where key='active_company_id'`);
t('SM-008 legacy: only the printed name is stored (id removed to mimic an older database)', gs('active_company_id') === '(none)' && gs('company_name') === newName);
r = await A('PUT', `/companies/${C1}`, { name: `${newName} two` }); t('SM-008 legacy: renaming upgrades the settings first (the id is stored before the name changes)', r.s === 200 && gs('active_company_id') === C1, { id: gs('active_company_id') });
r = await upload(C1); t('SM-008 legacy: the logo upload after that rename still updates the active logo', r.j?.active_logo_updated === true, r.j);
r = await upload(C2); t('SM-008: an inactive company still leaves the active logo alone', r.j?.active_logo_updated === false, r.j);
r = await A('PUT', `/companies/${C2}`, { write_to_global_settings: true }); t('SM-008: switching the active company explicitly still works', r.s === 200 && gs('active_company_id') === C2 && gs('company_logo_url').includes(C2), { id: gs('active_company_id') });

// ---------- put everything back ----------
for (const k of gsKeys) psql(gsSaved[k] === '(none)' ? `delete from global_settings where key='${k}'` : `update global_settings set value='${gsSaved[k].replace(/'/g, "''")}' where key='${k}'`);
for (const k of gsKeys) if (gsSaved[k] !== '(none)') psql(`insert into global_settings (key, value) values ('${k}', '${gsSaved[k].replace(/'/g, "''")}') on conflict (key) do update set value = excluded.value`);
for (const id of logoFiles) for (const ext of ['png', 'jpg', 'gif']) { const f = join(process.env.UPLOADS_DIR || join(ROOT, 'packages/api/uploads/company-logos'), `${id}.${ext}`); if (existsSync(f)) try { unlinkSync(f); } catch {} }
const soft = (q) => { try { psql(q); } catch {} };
if (!idxExists()) runFile('144_reminder_unique_per_project.sql');
if (!taxIdx()) runFile('145_tax_slabs_name_unique_ci.sql');
for (const id of made.tax) soft(`delete from tax_slabs where id='${id}'`);
for (const id of made.area) soft(`delete from area_types where id='${id}'`);
soft(`delete from reminder_master where reminder_name ilike 'smfr%${U}'; delete from tax_slabs where name ilike 'smfr%${U}'`);
soft(`delete from bank_accounts where project_id in ('${pA}','${pB}'); delete from unit_types where project_id in ('${pA}','${pB}')`);
soft(`update projects set company_id=null where id in ('${pA}','${pB}')`);
for (const id of made.companies) soft(`delete from company_bank_accounts where company_id='${id}'; delete from companies where id='${id}'`);
soft(`update users set is_active=false where email in ('${scopedPmEmail}','${scopedSaEmail}')`);
soft(`delete from projects where id in ('${pA}','${pB}')`);
console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
