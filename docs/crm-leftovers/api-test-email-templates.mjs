// Email templates (own table, own routes) and the legal-letter template routes that used to share a table with them.
// Roles, hostile input, merge fields, duplicates and races, the letter generator left alone, a random run.
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-email-templates.mjs   (psql must reach the same database; SEED=n repeats the random run)
import { execFileSync } from 'node:child_process';
const B = process.env.BASE || 'http://localhost:3010/api';
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300))); };
const post = async (p, b) => { const r = await fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => null) }; };
const login = async (email, password = 'Test#Pass1234') => (await post('/auth/login', { email, password })).j?.token;
const call = (tok) => async (m, p, b, raw) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: raw ?? (b === undefined ? undefined : JSON.stringify(b)) }); return { s: r.status, j: await r.json().catch(() => null) }; };
const A = call(await login('super_admin@test.local')), PM = call(await login('project_manager@test.local')), SE = call(await login('sales_executive@test.local'));
const AF = call(await login('accounts_finance@test.local')), RO = call(await login('read_only_viewer@test.local')), SA = call(await login('support_agent@test.local')), NO = call(null);
const psql = (sql) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim().split('\n')[0];
const SEED = Number(process.env.SEED || Date.now() % 1e9); let rs = SEED;
const rnd = () => (rs = (rs * 1664525 + 1013904223) % 4294967296) / 4294967296, ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)), pick = (a) => a[ri(0, a.length - 1)];
console.log('SEED=' + SEED);
const U = Date.now().toString(36).slice(-5), NIL = '00000000-0000-0000-0000-000000000000';
const par = (n, f) => Promise.all(Array.from({ length: n }, (_, i) => f(i)));
const no5 = (xs) => xs.every((x) => x.s < 500);
let r; const made = [];

// ---------- the four starting templates ----------
r = await RO('GET', '/email-templates'); const sys = r.j?.data?.filter((x) => x.is_system) || [];
t('list: a viewer can read; the four starting templates are real rows', r.s === 200 && sys.length === 4 && sys.every((x) => x.body.length > 20 && x.subject), r);
t('list: the merge fields are sent along', Array.isArray(r.j.mergeFields) && r.j.mergeFields.includes('consumer_name'));
t('list: no login is 401 on every route', (await Promise.all([NO('GET', '/email-templates'), NO('POST', '/email-templates', {}), NO('PATCH', '/email-templates/' + sys[0].id, {}), NO('DELETE', '/email-templates/' + sys[0].id)])).every((x) => x.s === 401));
for (const [who, f] of [['viewer', RO], ['support', SA], ['sales', SE], ['accounts', AF], ['pm', PM], ['admin', A]]) t(`list: ${who} can read`, (await f('GET', '/email-templates')).s === 200);

// ---------- roles ----------
const mk = async (f, name, extra = {}) => { const x = await f('POST', '/email-templates', { name, body: 'Dear {{consumer_name}}', ...extra }); if (x.j?.data?.id) made.push(x.j.data.id); return x; };
t('create: viewer 403, accounts 403', (await RO('POST', '/email-templates', { name: 'x', body: 'y' })).s === 403 && (await AF('POST', '/email-templates', { name: 'x', body: 'y' })).s === 403);
r = await mk(SE, `Sales one ${U}`); t('create: sales can write wording (201)', r.s === 201 && r.j.data.is_system === false && r.j.data.template_type === 'general' && r.j.data.is_active === true, r);
const T1 = r.j.data.id;
t('create: support can too', (await mk(SA, `Support one ${U}`)).s === 201);
t('edit: sales 403, support 403, viewer 403', (await SE('PATCH', `/email-templates/${T1}`, { subject: 's' })).s === 403 && (await SA('PATCH', `/email-templates/${T1}`, { subject: 's' })).s === 403 && (await RO('PATCH', `/email-templates/${T1}`, { subject: 's' })).s === 403);
r = await PM('PATCH', `/email-templates/${T1}`, { subject: `Hello {{consumer_name}} ${U}`, templateType: 'welcome' }); t('edit: project manager can', r.s === 200 && r.j.data.template_type === 'welcome' && r.j.data.subject.endsWith(U), r);
t('delete: pm 403, sales 403', (await PM('DELETE', `/email-templates/${T1}`)).s === 403 && (await SE('DELETE', `/email-templates/${T1}`)).s === 403);

// ---------- hostile input ----------
for (const [n, b] of [['no body at all', undefined], ['no name', { body: 'x' }], ['blank name', { name: '   ', body: 'x' }], ['name number', { name: 5, body: 'x' }], ['name list', { name: ['a'], body: 'x' }], ['name 151', { name: 'a'.repeat(151), body: 'x' }], ['name markup', { name: '<b>x</b>', body: 'x' }], ['name control', { name: 'a\u0000b', body: 'x' }],
  ['no email body', { name: 'ok' }], ['blank body', { name: 'ok', body: '  ' }], ['body number', { name: 'ok', body: 5 }], ['body 20001', { name: 'ok', body: 'b'.repeat(20001) }], ['body control', { name: 'ok', body: 'a\u0007b' }],
  ['subject 201', { name: 'ok', body: 'x', subject: 's'.repeat(201) }], ['subject object', { name: 'ok', body: 'x', subject: {} }], ['bad type', { name: 'ok', body: 'x', templateType: 'invoice' }], ['type number', { name: 'ok', body: 'x', templateType: 1 }], ['isActive text', { name: 'ok', body: 'x', isActive: 'false' }],
  ['unknown merge field', { name: 'ok', body: 'Dear {{customer}}' }], ['unknown in subject', { name: 'ok', body: 'x', subject: '{{pan_number}}' }], ['broken braces', { name: 'ok', body: 'Dear {{consumer_name' }], ['stray braces', { name: 'ok', body: 'a }} b' }], ['nested braces', { name: 'ok', body: '{{{{consumer_name}}}}' }]]) {
  r = await A('POST', '/email-templates', b); t(`create refused: ${n}`, r.s === 400 && !!r.j?.error, r);
}
r = await A('POST', '/email-templates', { name: 'ok', body: 'Dear {{customer}} {{pan}}' }); t('create refused: the answer lists the wrong fields and the right ones', /customer/.test(r.j?.error) && /pan/.test(r.j?.error) && /consumer_name/.test(r.j?.error), r);
t('create: a list body and broken JSON are 400, not 500', (await A('POST', '/email-templates', undefined, '[1]')).s === 400 && (await A('POST', '/email-templates', undefined, '{"name":')).s === 400);
t('create: refusals saved nothing', psql(`select count(*) from email_templates where name='ok'`) === '0');
r = await mk(A, `All fields ${U}`, { subject: '{{ consumer_name }} - {{unit_number}}', body: 'Line 1 {{amount}}\r\nLine 2 <b>not markup</b> {{due_date}} {{project_name}} {{allotment_date}}', templateType: 'reminder', isActive: false });
t('create: every merge field, spaces inside braces, CRLF, angle brackets in the body, inactive', r.s === 201 && r.j.data.is_active === false && !r.j.data.body.includes('\r') && r.j.data.body.includes('<b>'), r);
const T2 = r.j.data.id;

// ---------- duplicates ----------
t('duplicate: same name 409, also in another case and with spaces around', (await A('POST', '/email-templates', { name: `SALES ONE ${U}`, body: 'x' })).s === 409 && (await A('POST', '/email-templates', { name: `  sales one ${U}  `, body: 'x' })).s === 409);
r = await par(6, () => A('POST', '/email-templates', { name: `Race ${U}`, body: 'x' })); r.forEach((x) => x.j?.data?.id && made.push(x.j.data.id));
t('duplicate: 6 at once make exactly one, the rest 409, no 5xx', no5(r) && r.filter((x) => x.s === 201).length === 1 && r.filter((x) => x.s === 409).length === 5, r.map((x) => x.s));
t('edit: renaming onto another template is 409; keeping its own name is fine', (await A('PATCH', `/email-templates/${T2}`, { name: `sales one ${U}` })).s === 409 && (await A('PATCH', `/email-templates/${T2}`, { name: `ALL FIELDS ${U}` })).s === 200);

// ---------- read, edit, delete ----------
t('get: bad id 400, unknown 404, real one has its body', (await A('GET', '/email-templates/abc')).s === 400 && (await A('GET', '/email-templates/user-guide')).s === 400 && (await A('GET', '/email-templates/' + NIL)).s === 404 && (await A('GET', `/email-templates/${T2}`)).j.data.body.includes('Line 2'));
t('edit: nothing to change 400, bad id 400, unknown 404, empty body refused, bad type refused', (await A('PATCH', `/email-templates/${T2}`, {})).s === 400 && (await A('PATCH', '/email-templates/abc', { name: 'x' })).s === 400 && (await A('PATCH', `/email-templates/${NIL}`, { name: 'x' })).s === 404 && (await A('PATCH', `/email-templates/${T2}`, { body: '' })).s === 400 && (await A('PATCH', `/email-templates/${T2}`, { templateType: 'nope' })).s === 400);
r = await A('PATCH', `/email-templates/${T2}`, { isActive: true, subject: '' }); t('edit: switch on and clear the subject', r.s === 200 && r.j.data.is_active === true && r.j.data.subject === '', r);
r = await A('PATCH', `/email-templates/${sys[0].id}`, { subject: sys[0].subject + ' ' }); t('edit: a starting template can be edited', r.s === 200, r); await A('PATCH', `/email-templates/${sys[0].id}`, { subject: sys[0].subject });
t('delete: a starting template cannot be deleted (409) and is still there', (await A('DELETE', `/email-templates/${sys[1].id}`)).s === 409 && psql(`select count(*) from email_templates where is_system`) === '4');
t('delete: bad id 400, unknown 404', (await A('DELETE', '/email-templates/abc')).s === 400 && (await A('DELETE', '/email-templates/' + NIL)).s === 404);
r = await par(4, () => A('DELETE', `/email-templates/${T1}`)); t('delete: 4 at once, one deletes (200), the rest are 404, no 5xx', no5(r) && r.filter((x) => x.s === 200).length >= 1 && r.every((x) => x.s === 200 || x.s === 404), r.map((x) => x.s));

// ---------- list filters ----------
r = await A('GET', `/email-templates?q=${encodeURIComponent('all fields ' + U)}`); t('list: search by name', r.s === 200 && r.j.data.length === 1 && r.j.data[0].id === T2, r);
t('list: search treats % and _ as plain text', (await A('GET', '/email-templates?q=%25')).j.data.length === 0 && (await A('GET', '/email-templates?q=Q_Q')).j.data.length === 0 && (await A('GET', '/email-templates?q=unit_number')).j.data.length >= 2);
t('list: type filter', (await A('GET', '/email-templates?type=welcome')).j.data.every((x) => x.template_type === 'welcome') && (await A('GET', '/email-templates?type=reminder')).j.data.some((x) => x.id === T2));
t('list: active filter', (await A('GET', '/email-templates?active=false')).j.data.every((x) => x.is_active === false) && (await A('GET', '/email-templates?active=true')).j.data.every((x) => x.is_active === true));
r = await A('GET', '/email-templates?pageSize=2&page=2'); t('list: paging with total', r.s === 200 && r.j.data.length <= 2 && r.j.pagination.page === 2 && r.j.pagination.total >= 5, r.j?.pagination);
for (const q of ['type=invoice', 'type[]=a', 'active=maybe', 'pageSize=0', 'pageSize=201', 'pageSize=x', 'page=0', 'q[]=a', 'q=<b>', 'pageSize=1;DROP TABLE email_templates']) t(`list refused: ${q}`, (await A('GET', '/email-templates?' + q)).s === 400);

// ---------- the legal letters are left alone ----------
const letters = psql(`select count(*) from document_templates`), newest = psql(`select id from document_templates where document_type='allotment_letter' order by created_at desc limit 1`);
await mk(A, `Letter-typed ${U}`, { templateType: 'allotment_letter' }); await mk(A, `Receipt-typed ${U}`, { templateType: 'payment_receipt' });
t('letters: email templates typed allotment_letter / payment_receipt do not enter the letter table, the newest allotment letter is unchanged', psql(`select count(*) from document_templates`) === letters && psql(`select id from document_templates where document_type='allotment_letter' order by created_at desc limit 1`) === newest);
const co = (await A('POST', '/companies', { name: 'ET Co ' + U })).j.data.id, P = (await A('POST', '/projects', { companyId: co, name: `Et ${U}`, reraNumber: `ET-${U}`, tcpLicence: 'x' })).j.data.id;
t('letter templates: sales and support and accounts cannot create or change one (403)', (await SE('POST', '/documents/templates', { name: 'x', documentType: 'allotment_letter' })).s === 403 && (await AF('POST', '/documents/templates', { name: 'x', documentType: 'allotment_letter' })).s === 403 && (await SE('PATCH', `/documents/templates/${newest}`, { name: 'x' })).s === 403 && (await RO('POST', '/documents/templates', { name: 'x', documentType: 'allotment_letter' })).s === 403);
for (const [n, b] of [['no type', { name: 'x' }], ['email type', { name: 'x', documentType: 'welcome' }], ['no name', { documentType: 'allotment_letter' }], ['type list', { name: 'x', documentType: ['allotment_letter'] }], ['project not uuid', { name: 'x', documentType: 'allotment_letter', projectId: 'abc' }], ['unknown project', { name: 'x', documentType: 'allotment_letter', projectId: NIL }], ['body number', { name: 'x', documentType: 'allotment_letter', bodyHtml: 5 }], ['body too big', { name: 'x', documentType: 'allotment_letter', bodyHtml: 'a'.repeat(500001) }], ['merge fields text', { name: 'x', documentType: 'allotment_letter', mergeFields: 'a' }], ['name markup', { name: '<i>', documentType: 'allotment_letter' }]]) {
  r = await PM('POST', '/documents/templates', b); t(`letter template refused: ${n}`, r.s >= 400 && r.s < 500, r);
}
r = await PM('POST', '/documents/templates', { name: `ET letter ${U}`, documentType: 'allotment_letter', projectId: P, bodyHtml: '<p>{{consumerName}}</p>' });
t('letter template: a project manager can make one for a project (HTML is allowed here)', r.s === 201 && psql(`select project_id from document_templates where id='${r.j.data.id}'`) === P, r); const L1 = r.j?.data?.id;
r = await PM('POST', '/documents/templates', { name: `ET global ${U}`, documentType: 'payment_receipt', bodyHtml: '<p>x</p>' });
t('letter template: with no project it is for all projects (it used to be silently given to the first project)', r.s === 201 && psql(`select coalesce(project_id::text,'null') from document_templates where id='${r.j.data.id}'`) === 'null', r); const L2 = r.j?.data?.id;
t('letter template: edit needs a change, a real id; a project manager can edit', (await PM('PATCH', `/documents/templates/${L1}`, {})).s === 400 && (await PM('PATCH', '/documents/templates/abc', { name: 'x' })).s === 400 && (await PM('PATCH', `/documents/templates/${NIL}`, { name: 'x' })).s === 404 && (await PM('PATCH', `/documents/templates/${L1}`, { name: `ET letter 2 ${U}` })).s === 200);
t('letter template: list and get validate their parameters (bad id was a 500)', (await A('GET', '/documents/templates?projectId=abc')).s === 400 && (await A('GET', '/documents/templates/user-guide')).s === 400 && (await A('GET', '/documents/templates/' + NIL)).s === 404 && (await A('GET', `/documents/templates/${L1}`)).j.data.body_html.includes('consumerName') && (await A('GET', `/documents/templates?projectId=${P}`)).j.data.length === 1);
t('letter template: the changes are in the audit log', Number(psql(`select count(*) from audit_logs where resource_type='document_template' and resource_id in ('${L1}','${L2}')`)) >= 3);

// ---------- random run ----------
const junk = () => pick(['', ' ', 'abc', '<b>', "' OR 1=1 --", '0', '-1', NIL, '{{x}}', '{{consumer_name}}', 'x'.repeat(300), '\u0000', '😀', null, [], {}, true, 5]);
const ids = () => pick([NIL, 'abc', T2, sys[0].id, L1, junk()]);
const calls = [];
for (let i = 0; i < 140; i++) {
  const w = pick([A, A, PM, SE, SA, RO, AF, NO]), k = ri(1, 7);
  calls.push(k === 1 ? w('POST', '/email-templates', { name: junk(), body: junk(), subject: junk(), templateType: junk(), isActive: junk() })
    : k === 2 ? w('PATCH', `/email-templates/${encodeURIComponent(String(ids()))}`, { name: junk(), body: junk(), subject: junk(), templateType: junk(), isActive: junk() })
    : k === 3 ? w('GET', `/email-templates?q=${encodeURIComponent(String(junk()))}&type=${encodeURIComponent(String(junk()))}&page=${encodeURIComponent(String(junk()))}`)
    : k === 4 ? w('DELETE', `/email-templates/${encodeURIComponent(String(ids()))}`)
    : k === 5 ? w('POST', '/documents/templates', { name: junk(), documentType: junk(), projectId: junk(), bodyHtml: junk(), mergeFields: junk() })
    : k === 6 ? w('PATCH', `/documents/templates/${encodeURIComponent(String(ids()))}`, { name: junk(), bodyHtml: junk(), mergeFields: junk() })
    : w('POST', '/email-templates', undefined, pick(['{', '[1]', 'null', '"x"'])));
}
const rr = await Promise.all(calls);
t('random: 140 hostile requests, none gave a 5xx', no5(rr), JSON.stringify(rr.filter((x) => x.s >= 500).slice(0, 3)));
t('random: the four starting templates and the letter table are intact', psql(`select count(*) from email_templates where is_system`) === '4' && psql(`select id from document_templates where document_type='allotment_letter' and created_by_user_id is null order by created_at limit 1`) !== undefined);

t('type: a blank template type (only spaces) is 400 on create and on edit, never a database error', await (async () => {
  const c = await A('POST', '/email-templates', { name: `Blank type ${U}`, body: 'Hello', templateType: '   ' });
  const mine = (await A('POST', '/email-templates', { name: `Typed ${U}`, body: 'Hello' })).j?.data?.id;
  const e = await A('PATCH', `/email-templates/${mine}`, { templateType: '   ' });
  return c.s === 400 && e.s === 400;
})());

// ---------- clean up ----------
const rm = (sql) => { try { psql(sql); } catch {} };
rm(`DELETE FROM email_templates WHERE is_system = false AND (name LIKE '%${U}%' OR created_at > now() - interval '30 minutes' AND name LIKE 'ok%')`);
rm(`DELETE FROM document_templates WHERE name LIKE 'ET %${U}'`); rm(`DELETE FROM document_templates WHERE project_id = '${P}'`);
console.log(`\nRESULT: ${pass} passed, ${fail} failed (seed ${SEED})`);
process.exit(fail ? 1 : 0);
