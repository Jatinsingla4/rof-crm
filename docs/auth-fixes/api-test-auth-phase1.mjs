// Login & Authentication fix, phase 1. Each check fails on the code as it was before the fix.
//   AUTH-001 health diagnostics and stored template text are not public
//   AUTH-002 changing your own password always needs the current password (also super_admin, also through the edit form)
//   AUTH-008 current-password checks are throttled per account
// Run: BASE=http://localhost:3010/api node docs/auth-fixes/api-test-auth-phase1.mjs   (psql must reach the same database)
// Own synthetic logins and one synthetic template row per run; they are removed or deactivated at the end.
import { execFileSync } from 'node:child_process';
const B = process.env.BASE || 'http://localhost:3010/api';
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300))); };
const call = (tok) => async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); let j = null, text = ''; try { text = await r.text(); j = JSON.parse(text); } catch {} return { s: r.status, j, text, h: r.headers }; };
const login = async (e, pw = PW) => (await call()('POST', '/auth/login', { email: e, password: pw })).j?.token;
const psql = (sql) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const PW = 'Test#Pass1234', U = Date.now().toString(36).slice(-5);
const hash = psql(`select password_hash from users where email='super_admin@test.local'`);
const mk = (role, tag) => { const e = `smauth_${tag}_${U}@test.local`; const id = psql(`insert into users (email,name,role,password_hash,is_active,username) values ('${e}','smauth ${tag}','${role}','${hash}',true,'smauth_${tag}_${U}') returning id`).split('\n')[0]; return { e, id }; };
const sa1 = mk('super_admin', 'sa1'), sa2 = mk('super_admin', 'sa2'), se1 = mk('sales_executive', 'se1'), se2 = mk('sales_executive', 'se2'), se3 = mk('sales_executive', 'se3'), se4 = mk('sales_executive', 'se4'), fin = mk('accounts_finance', 'fin'), ro = mk('read_only_viewer', 'ro'), sa3 = mk('super_admin', 'sa3');
const A = (u, tok) => call(tok);
const NEW = 'Fresh#Phase1-77';

// ======================= AUTH-001 =======================
const marker = `CONFIDENTIAL-CLAUSE-${U}`;
psql(`insert into document_templates (document_type, name, body_html) values ('buyer_builder_agreement','SMAUTH template ${U}','<p>${marker}</p>')`);
const anon = call(), tSA = call(await login(sa1.e)), tSE = call(await login(se1.e)), tFIN = call(await login(fin.e)), tRO = call(await login(ro.e));
for (const p of ['/health/templates', '/health/debug']) {
  let r = await anon('GET', p); t(`AUTH-001: ${p} without a login is refused (401)`, r.s === 401, r.s); t(`AUTH-001: ${p} without a login shows no template text`, !r.text.includes(marker) && !r.text.includes('body_html'), r.text.slice(0, 120));
  for (const [who, c] of [['sales executive', tSE], ['accounts finance', tFIN], ['read only viewer', tRO]]) { r = await c('GET', p); t(`AUTH-001: ${p} for ${who} is 403`, r.s === 403 && !r.text.includes(marker), r.s); }
}
let r = await tSA('GET', '/health/templates');
t('AUTH-001: super admin still gets the template diagnostic (200)', r.s === 200 && r.j?.success === true, r.s);
t('AUTH-001: it lists the template by name but never returns its text', r.text.includes(`SMAUTH template ${U}`) && !r.text.includes(marker) && !r.text.includes('body_html'), r.text.slice(0, 200));
r = await tSA('GET', '/health/debug'); t('AUTH-001: super admin still gets /health/debug (200)', r.s === 200 && r.j?.success === true, r.s);
r = await anon('GET', '/health'); t('AUTH-001: the public deployment check /health stays open (200, status ok)', r.s === 200 && r.j?.status === 'ok', r.s);
t('AUTH-001: /health returns only status, timestamp and commit', JSON.stringify(Object.keys(r.j || {}).sort()) === JSON.stringify(['commit', 'status', 'timestamp']), Object.keys(r.j || {}));
for (const p of ['/health/templates', '/health/debug', '/health/anything']) { r = await anon('GET', p); t(`AUTH-001: ${p} gives an unauthenticated caller no environment or database detail`, !/nodeEnv|databaseUrl|lastMigrationLog|database_templates/.test(r.text), r.text.slice(0, 120)); }
psql(`delete from document_templates where name='SMAUTH template ${U}'`);

// ======================= AUTH-002 =======================
const body = (cur) => ({ newPassword: NEW, ...(cur === undefined ? {} : { currentPassword: cur }) });
const pwOk = async (e, pw) => !!(await login(e, pw));
for (const [who, u] of [['super admin', sa1], ['sales executive', se1]]) {
  const tok = call(await login(u.e));
  r = await tok('POST', `/users/${u.id}/change-password`, body()); t(`AUTH-002: ${who} changing their own password without the current one is 400`, r.s === 400 && /Current password is required/.test(r.j?.error || ''), r);
  r = await tok('POST', `/users/${u.id}/change-password`, body('')); t(`AUTH-002: ${who} with an empty current password is 400`, r.s === 400, r);
  r = await tok('POST', `/users/${u.id}/change-password`, { newPassword: NEW, currentPassword: 12345678 }); t(`AUTH-002: ${who} with a non-text current password is 400`, r.s === 400, r);
  t(`AUTH-002: ${who}'s password was not changed by those attempts`, await pwOk(u.e, PW) && !(await pwOk(u.e, NEW)));
}
{
  const tok = call(await login(sa1.e)), other = await login(sa1.e);
  r = await tok('POST', `/users/${sa1.id}/change-password`, body('wrong-guess1')); t('AUTH-002: super admin with a wrong current password is 401', r.s === 401, r);
  r = await tok('POST', `/users/${sa1.id}/change-password`, body(PW)); t('AUTH-002: super admin with the right current password changes it (200)', r.s === 200, r);
  t('AUTH-002: all of that super admin\'s earlier tokens stop working', (await call(other)('GET', '/users/me')).s === 401);
  t('AUTH-002: the new password signs in and the old one does not', await pwOk(sa1.e, NEW) && !(await pwOk(sa1.e, PW)));
  psql(`update users set password_hash='${hash}' where id='${sa1.id}'`);
}
{
  const tok = call(await login(se1.e));
  r = await tok('POST', `/users/${se1.id}/change-password`, body(PW)); t('AUTH-002: a sales executive with the right current password still changes it (200)', r.s === 200, r);
  psql(`update users set password_hash='${hash}' where id='${se1.id}'`);
}
// the edit form (PATCH) must not be a way around the check
for (const path of [`/users/${sa1.id}`, `/users/employee-login/${sa1.id}`]) {
  const tok = call(await login(sa1.e));
  r = await tok('PATCH', path, { password: NEW }); t(`AUTH-002: setting your own password through PATCH ${path.replace(sa1.id, ':id')} without the current one is 400`, r.s === 400 && /Current password is required/.test(r.j?.error || ''), r);
  r = await tok('PATCH', path, { password: NEW, currentPassword: 'wrong-guess2' }); t('AUTH-002: with a wrong current password it is 403 (not 401: the screens sign out on 401)', r.s === 403 && /Current password is incorrect/.test(r.j?.error || ''), r);
  t('AUTH-002: the password is unchanged after those refusals', await pwOk(sa1.e, PW));
  r = await tok('PATCH', path, { mobile: '9876543210' }); t('AUTH-002: editing other fields of your own login needs no password (200)', r.s === 200, r);
}
{
  const tok = call(await login(sa1.e));
  const r1 = await tok('PATCH', `/users/${sa1.id}`, { password: NEW, currentPassword: PW }); t('AUTH-002: with the right current password the edit form can set your own password (200)', r1.s === 200, r1);
  psql(`update users set password_hash='${hash}' where id='${sa1.id}'`);
}
// the separate admin reset of someone else keeps working
{
  const adm = call(await login(sa2.e)), victim = await login(se2.e);
  r = await adm('POST', `/users/${se2.id}/change-password`, { newPassword: NEW }); t('AUTH-002: super admin resets another user\'s password without the current one (200)', r.s === 200, r);
  t('AUTH-002: the other user\'s old sessions end and the new password works', (await call(victim)('GET', '/users/me')).s === 401 && await pwOk(se2.e, NEW));
  r = await adm('POST', `/users/${sa1.id}/change-password`, { newPassword: NEW }); t('AUTH-002: super admin may reset another super admin the same way (200)', r.s === 200 && await pwOk(sa1.e, NEW), r);
  r = await adm('PATCH', `/users/${se2.id}`, { password: PW }); t('AUTH-002: admin reset through the edit form needs no current password (200)', r.s === 200 && await pwOk(se2.e, PW), r);
  psql(`update users set password_hash='${hash}' where id in ('${sa1.id}','${se2.id}')`);
}
// unauthorized users
{
  const tok = call(await login(se1.e));
  for (const target of [se2, sa1]) { r = await tok('POST', `/users/${target.id}/change-password`, { newPassword: NEW, currentPassword: PW }); t(`AUTH-002: a sales executive cannot change another login's password (${target === sa1 ? 'super admin' : 'sales executive'}) (403)`, r.s === 403, r); }
  r = await tok('PATCH', `/users/${se2.id}`, { password: NEW }); t('AUTH-002: a sales executive cannot reset through the edit route (403)', r.s === 403, r);
  r = await call()('POST', `/users/${se1.id}/change-password`, { newPassword: NEW, currentPassword: PW }); t('AUTH-002: no login at all is 401', r.s === 401, r);
  t('AUTH-002: nobody\'s password changed in those attempts', await pwOk(se1.e, PW) && await pwOk(se2.e, PW) && await pwOk(sa1.e, PW));
}

// ======================= AUTH-008 =======================
{
  const tokA = await login(se3.e), tokB = await login(se3.e); const a = call(tokA), b = call(tokB);
  const wrong = (c, n) => c('POST', `/users/${se3.id}/change-password`, body('guess-' + n));
  const codes = [];
  for (let i = 1; i <= 4; i++) codes.push((await (i % 2 ? a : b)('POST', `/users/${se3.id}/change-password`, body('guess-' + i))).s);
  t('AUTH-008: the first four wrong guesses (two different tokens of the same account) are 401', codes.every((c) => c === 401), codes);
  r = await a('POST', `/users/${se3.id}/change-password`, body('guess-5')); t('AUTH-008: the fifth wrong guess is still answered 401', r.s === 401, r);
  r = await b('POST', `/users/${se3.id}/change-password`, body(PW)); t('AUTH-008: after five wrong guesses even the right password is refused (429)', r.s === 429 && /Too many wrong current passwords/.test(r.j?.error || ''), r);
  t('AUTH-008: the refusal carries a Retry-After header of at most 15 minutes', Number(r.h.get('retry-after')) > 0 && Number(r.h.get('retry-after')) <= 900, r.h.get('retry-after'));
  t('AUTH-008: the password was not changed while blocked', await pwOk(se3.e, PW));
  r = await a('GET', '/users/me'); t('AUTH-008: the blocked person can still use the system (200)', r.s === 200, r);
  t('AUTH-008: the blocked person can still sign in', !!(await login(se3.e)));
  r = await a('POST', '/auth/logout'); t('AUTH-008: the blocked person can still sign out normally (200)', r.s === 200, r);
  // another account is unaffected (counted per account)
  const other = call(await login(se4.e)); r = await other('POST', `/users/${se4.id}/change-password`, body('guess-x')); t('AUTH-008: another account is not affected (401, not 429)', r.s === 401, r);
  // an administrator can still reset the blocked person, and that clears the count
  const adm = call(await login(sa2.e)); r = await adm('POST', `/users/${se3.id}/change-password`, { newPassword: NEW }); t('AUTH-008: an administrator can still reset the blocked person (200)', r.s === 200, r);
  const fresh = call(await login(se3.e, NEW)); r = await fresh('POST', `/users/${se3.id}/change-password`, { newPassword: PW, currentPassword: NEW }); t('AUTH-008: after the reset the person can change their password again (no lingering block)', r.s === 200, r);
  psql(`update users set password_hash='${hash}' where id='${se3.id}'`);
}
{
  // a correct answer before the limit clears the count, so honest typing mistakes never add up
  const c = call(await login(se4.e));
  for (let i = 1; i <= 3; i++) await c('POST', `/users/${se4.id}/change-password`, body('typo-' + i));
  r = await c('POST', `/users/${se4.id}/change-password`, body(PW)); t('AUTH-008: three typos and then the right password works (200)', r.s === 200, r);
  const c2 = call(await login(se4.e, NEW));
  const codes = []; for (let i = 1; i <= 4; i++) codes.push((await c2('POST', `/users/${se4.id}/change-password`, { newPassword: PW, currentPassword: 'typo-' + i })).s);
  r = await c2('POST', `/users/${se4.id}/change-password`, { newPassword: PW, currentPassword: NEW }); t('AUTH-008: the count starts again after a success (four more typos, then the right password, is 200)', codes.every((x) => x === 401) && r.s === 200, { codes, last: r.s });
  psql(`update users set password_hash='${hash}' where id='${se4.id}'`);
}
{
  // the administrator reset path is not a guessing oracle and is not throttled
  const adm = call(await login(sa2.e)); const codes = [];
  for (let i = 0; i < 6; i++) codes.push((await adm('POST', `/users/${ro.id}/change-password`, { newPassword: NEW })).s);
  t('AUTH-008: repeated administrator resets of someone else are never throttled (200 each)', codes.every((x) => x === 200), codes);
  psql(`update users set password_hash='${hash}' where id='${ro.id}'`);
}

{
  // the edit-form route and change-password share one count per account (super admin is the only role that has the edit route)
  const c = call(await login(sa3.e)); const codes = [];
  for (let i = 1; i <= 3; i++) codes.push((await c('PATCH', `/users/${sa3.id}`, { password: NEW, currentPassword: 'guess-p' + i })).s);
  for (let i = 4; i <= 5; i++) codes.push((await c('POST', `/users/${sa3.id}/change-password`, body('guess-p' + i))).s);
  t('AUTH-008: five wrong guesses split between the edit form (403) and change-password (401) are all refused as wrong', JSON.stringify(codes) === JSON.stringify([403, 403, 403, 401, 401]), codes);
  r = await c('PATCH', `/users/${sa3.id}`, { password: NEW, currentPassword: PW }); t('AUTH-008: then the edit form is blocked (429) even with the right password', r.s === 429, r);
  r = await c('POST', `/users/${sa3.id}/change-password`, body(PW)); t('AUTH-008: and so is change-password (429)', r.s === 429, r);
  r = await c('PATCH', `/users/${sa3.id}`, { mobile: '9876500002' }); t('AUTH-008: a blocked super admin can still edit other details of their own login (200)', r.s === 200, r);
  t('AUTH-008: a blocked super admin can still sign in', !!(await login(sa3.e)));
}

// ---------- clean up ----------
for (const u of [sa1, sa2, sa3, se1, se2, se3, se4, fin, ro]) { try { psql(`update users set is_active=false where id='${u.id}'`); } catch {} }
console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
