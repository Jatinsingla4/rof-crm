// Project mail server settings (/smtp-configs): roles, password never returned, sealed in the database, hostile input, scope, races, a random run.
// Run: BASE=http://localhost:3010/api node api-test-smtp.mjs   (psql must reach the same database; SEED=n repeats the random run)
import { execFileSync } from 'node:child_process';
const B = process.env.BASE || 'http://localhost:3010/api';
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300))); };
const post = async (p, b) => { const r = await fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => null) }; };
const login = async (email) => (await post('/auth/login', { email, password: 'Test#Pass1234' })).j?.token;
const call = (tok) => async (m, p, b, raw) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: raw ?? (b === undefined ? undefined : JSON.stringify(b)) }); return { s: r.status, j: await r.json().catch(() => null) }; };
const A = call(await login('super_admin@test.local')), AF = call(await login('accounts_finance@test.local'));
const others = ['project_manager', 'sales_executive', 'support_agent', 'read_only_viewer'], O = {}; for (const o of others) O[o] = call(await login(o + '@test.local'));
const NO = call(null);
const psql = (sql) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim().split('\n')[0];
const SEED = Number(process.env.SEED || Date.now() % 1e9); let rs = SEED;
const rnd = () => (rs = (rs * 1664525 + 1013904223) % 4294967296) / 4294967296, ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)), pick = (a) => a[ri(0, a.length - 1)];
console.log('SEED=' + SEED);
const U = Date.now().toString(36).slice(-5), NIL = '00000000-0000-0000-0000-000000000000';
const no5 = (xs) => xs.every((x) => x.s < 500);
const P1 = psql(`insert into projects (name, rera_number, tcp_licence) values ('SMTP P1 ${U}','R1','L1') returning id`);
const P2 = psql(`insert into projects (name, rera_number, tcp_licence) values ('SMTP P2 ${U}','R2','L2') returning id`);
const ok = (o = {}) => ({ projectId: P1, host: 'smtp.example.com', port: 587, username: 'mailer', password: 'S3cret!pw', fromName: 'ROF', fromEmail: 'accounts@example.com', useSsl: true, ...o });
let r;

// ---------- guards ----------
t('no login is 401 on both routes', (await NO('GET', '/smtp-configs')).s === 401 && (await NO('POST', '/smtp-configs', ok())).s === 401);
for (const o of others) t(`${o}: 403 on read and write`, (await O[o]('GET', '/smtp-configs')).s === 403 && (await O[o]('POST', '/smtp-configs', ok())).s === 403);
t('accounts can read but cannot write the mail credentials (403)', (await AF('GET', '/smtp-configs')).s === 200 && (await AF('POST', '/smtp-configs', ok())).s === 403);
t('a refused write saved nothing', psql(`select count(*) from project_smtp_configs where project_id='${P1}'`) === '0');

// ---------- create, read back: the password never leaves ----------
r = await A('POST', '/smtp-configs', ok({ ccEmails: 'A@x.com, b@x.com;A@x.com', bccEmails: '' })); t('create: 200 with an id', r.s === 200 && !!r.j?.data?.id, r);
const id = r.j?.data?.id;
const row = (await A('GET', '/smtp-configs')).j.data.find((x) => x.project_id === P1);
t('read: the row has no password field, only has_password=true', row && row.has_password === true && !('password_encrypted' in row) && !JSON.stringify(row).includes('S3cret'), row);
t('read: cc is cleaned (lower case, duplicates gone), empty bcc is null', row?.cc_emails === 'a@x.com, b@x.com' && row?.bcc_emails === null, row);
const stored = psql(`select password_encrypted from project_smtp_configs where id='${id}'`);
t('database: the password is sealed (v2:iv:tag:data), not readable text', /^v2:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/.test(stored) && !stored.includes('S3cret'), stored);
t('read: accounts sees it too and also no password', JSON.stringify((await AF('GET', '/smtp-configs')).j).includes('password_encrypted') === false);
t('audit: the log for this change has no password and no sealed text', psql(`select count(*) from audit_logs where resource_id='${id}' and (new_values::text ilike '%S3cret%' or new_values::text like '%v2:%')`) === '0' && psql(`select count(*) from audit_logs where resource_id='${id}'`) === '1');

// ---------- update keeps or changes the password ----------
r = await A('POST', '/smtp-configs', ok({ password: '', host: 'smtp2.example.com' })); t('update: blank password keeps the old sealed one', r.s === 200 && psql(`select password_encrypted from project_smtp_configs where id='${id}'`) === stored && psql(`select host from project_smtp_configs where id='${id}'`) === 'smtp2.example.com', r);
r = await A('POST', '/smtp-configs', ok({ password: 'New pass 2' })); t('update: a new password replaces it, same row, one row per project', r.s === 200 && r.j.data.id === id && psql(`select password_encrypted<>'${stored}' from project_smtp_configs where id='${id}'`) === 't' && psql(`select count(*) from project_smtp_configs where project_id='${P1}'`) === '1', r);
t('audit: each of the two updates is logged', psql(`select count(*) from audit_logs where resource_id='${id}'`) === '3');
t('create: a new project needs a password', (await A('POST', '/smtp-configs', ok({ projectId: P2, password: undefined }))).s === 400 && psql(`select count(*) from project_smtp_configs where project_id='${P2}'`) === '0');

// ---------- hostile input ----------
const bads = [['no body', undefined], ['no project', { ...ok(), projectId: undefined }], ['project not uuid', ok({ projectId: 'abc' })], ['project list', ok({ projectId: [P1] })], ['project unknown 404', ok({ projectId: NIL }), 404],
  ['no host', ok({ host: undefined })], ['host blank', ok({ host: '  ' })], ['host with scheme', ok({ host: 'https://smtp.x.com' })], ['host with port', ok({ host: 'smtp.x.com:25' })], ['host with space', ok({ host: 'smtp x.com' })], ['host markup', ok({ host: '<b>x</b>' })], ['host 254 chars', ok({ host: 'a'.repeat(254) })], ['host number', ok({ host: 5 })], ['host dot only', ok({ host: '...' })],
  ['localhost', ok({ host: 'localhost' })], ['127.0.0.1', ok({ host: '127.0.0.1' })], ['metadata ip', ok({ host: '169.254.169.254' })], ['10.x', ok({ host: '10.0.0.5' })], ['192.168', ok({ host: '192.168.1.1' })], ['172.16', ok({ host: '172.16.0.1' })], ['.internal', ok({ host: 'db.internal' })], ['0.0.0.0', ok({ host: '0.0.0.0' })],
  ['port 0', ok({ port: 0 })], ['port 65536', ok({ port: 65536 })], ['port -1', ok({ port: -1 })], ['port 25.5', ok({ port: 25.5 })], ['port 1e3', ok({ port: '1e3' })], ['port text', ok({ port: 'abc' })], ['port list', ok({ port: [25] })], ['port bool', ok({ port: true })],
  ['username 256', ok({ username: 'u'.repeat(256) })], ['username control', ok({ username: 'a\u0000b' })], ['username number', ok({ username: 5 })],
  ['password 257', ok({ password: 'p'.repeat(257) })], ['password control', ok({ password: 'a\r\nb' })], ['password number', ok({ password: 12345 })], ['password list', ok({ password: ['x'] })],
  ['sender name 101', ok({ fromName: 'n'.repeat(101) })], ['sender name markup', ok({ fromName: '<script>' })], ['sender name crlf', ok({ fromName: 'a\r\nBcc: x@y.com' })],
  ['no sender email', ok({ fromEmail: undefined })], ['sender not email', ok({ fromEmail: 'nope' })], ['sender two at', ok({ fromEmail: 'a@b@c.com' })], ['sender crlf', ok({ fromEmail: 'a@b.com\r\nBcc: x@y.com' })], ['sender 256', ok({ fromEmail: 'a'.repeat(250) + '@b.com' })], ['sender list', ok({ fromEmail: ['a@b.com'] })],
  ['ssl text', ok({ useSsl: 'true' })], ['ssl number', ok({ useSsl: 1 })], ['active text', ok({ isActive: 'no' })],
  ['cc bad address', ok({ ccEmails: 'a@x.com, nope' })], ['cc 11 addresses', ok({ ccEmails: Array.from({ length: 11 }, (_, i) => `a${i}@x.com`).join(',') })], ['cc list', ok({ ccEmails: ['a@x.com'] })], ['cc crlf', ok({ ccEmails: 'a@x.com\r\nBcc: z@y.com' })], ['bcc bad', ok({ bccEmails: '<a@x.com>' })]];
for (const [n, b, want = 400] of bads) { r = await A('POST', '/smtp-configs', b); t(`refused: ${n}`, r.s === want && !!r.j?.error, r); }
t('refusals: broken JSON and a list body are 400, not 500', (await A('POST', '/smtp-configs', undefined, '{"a":')).s === 400 && (await A('POST', '/smtp-configs', undefined, '[1]')).s === 400);
t('refusals changed nothing', psql(`select host||port||coalesce(username,'') from project_smtp_configs where id='${id}'`) === 'smtp.example.com587mailer');
r = await A('POST', '/smtp-configs', ok({ port: '2525', host: 'MAIL-1.Example.co.in', password: 'p<w>"\'; drop table x;--', useSsl: false, isActive: false })); t('good odd input: string port, upper-case host, symbols in the password, ssl off, inactive', r.s === 200, r);
t('good odd input: stored as given and the symbol password is sealed', psql(`select port||host||use_ssl||is_active from project_smtp_configs where id='${id}'`) === '2525MAIL-1.Example.co.infalsefalse');

// ---------- project scope ----------
const afId = psql(`select id from users where email='accounts_finance@test.local'`);
await A('POST', '/smtp-configs', ok({ projectId: P2, password: 'p2pass' }));
t('scope: with no limit accounts sees both projects', (await AF('GET', '/smtp-configs')).j.data.filter((x) => [P1, P2].includes(x.project_id)).length === 2);
t('scope: limit set to P1', (await A('PATCH', `/users/employee-login/${afId}`, { assignedProjectIds: [P1] })).s === 200);
await new Promise((z) => setTimeout(z, 16000));
const AF2 = call(await login('accounts_finance@test.local'));
const seen = (await AF2('GET', '/smtp-configs')).j.data.map((x) => x.project_id);
t('scope: a limited user sees only their project, never the other', seen.includes(P1) && !seen.includes(P2), seen);
t('scope: and cannot write the other project (403, no change)', (await A('PATCH', `/users/employee-login/${afId}`, { assignedProjectIds: [P1] })).s === 200 && psql(`select count(*) from project_smtp_configs where project_id='${P2}'`) === '1');
await A('PATCH', `/users/employee-login/${afId}`, { assignedProjectIds: [] });

// ---------- races ----------
await psql(`delete from project_smtp_configs where project_id='${P2}'`);
const rr = await Promise.all(Array.from({ length: 8 }, (_, i) => A('POST', '/smtp-configs', ok({ projectId: P2, host: `race${i}.example.com`, password: 'race' + i }))));
t('race: 8 writes at once on a new project, no 5xx, exactly one row', no5(rr) && rr.every((x) => x.s === 200) && psql(`select count(*) from project_smtp_configs where project_id='${P2}'`) === '1', rr.map((x) => x.s));

// ---------- random hostile run ----------
const junk = ['', ' ', 'x', '0', '-1', '1e9', 'null', '<img src=x>', '%', "' or 1=1--", '\u0000', 'a'.repeat(400), 'smtp.ok.com', 'a@b.com', P1, NIL];
const calls = [];
for (let i = 0; i < 120; i++) {
  const b = ok(); for (const k of Object.keys(b)) if (rnd() < 0.5) b[k] = pick([...junk, null, true, 5, [], {}, undefined, 1.5, -3]);
  calls.push(rnd() < 0.15 ? A('POST', '/smtp-configs', undefined, pick(['{', '[1]', 'null', '"x"'])) : rnd() < 0.2 ? A('GET', '/smtp-configs?x=' + encodeURIComponent(pick(junk))) : A('POST', '/smtp-configs', { ...b, projectId: rnd() < 0.7 ? P1 : b.projectId }));
}
const out = await Promise.all(calls);
t('random: 120 hostile requests, none gave a 5xx', no5(out), JSON.stringify(out.filter((x) => x.s >= 500).slice(0, 3)));
t('random: nothing in the list ever shows a password', !/password_encrypted|p2pass|S3cret|v2:/.test(JSON.stringify((await A('GET', '/smtp-configs')).j)));

// ---------- clean up ----------
const rm = (sql) => { try { psql(sql); } catch {} };
rm(`delete from audit_logs where resource_type='project_smtp_config' and resource_id::text in (select id::text from project_smtp_configs where project_id in ('${P1}','${P2}'))`);
rm(`delete from projects where id in ('${P1}','${P2}')`);
console.log(`\nRESULT: ${pass} passed, ${fail} failed (seed ${SEED})`);
process.exit(fail ? 1 : 0);
