// CRM: tasks, automation rules, communications (messages, remarks, tickets, calling list and log-call, broadcast and campaigns, AI draft).
// Roles, hostile input, project scope, races, honest status of a message, a random run.
// Run against a local test API:  BASE=http://localhost:3010/api node api-test-crm.mjs   (psql must reach the same database; SEED=n repeats the random run)
import { execFileSync } from 'node:child_process';
const B = process.env.BASE || 'http://localhost:3010/api';
let pass = 0, fail = 0;
const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' -> ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300))); };
const post = async (p, b) => { const r = await fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => null) }; };
const login = async (email, password = 'Test#Pass1234') => (await post('/auth/login', { email, password })).j?.token;
const call = (tok) => async (m, p, b, raw) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: raw ?? (b === undefined ? undefined : JSON.stringify(b)) }); return { s: r.status, j: await r.json().catch(() => null) }; };
const A = call(await login('super_admin@test.local')), PM = call(await login('project_manager@test.local')), SE = call(await login('sales_executive@test.local'));
const AF = call(await login('accounts_finance@test.local')), RO = call(await login('read_only_viewer@test.local')), NO = call(null);
const psql = (sql) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim().split('\n')[0];
const SEED = Number(process.env.SEED || Date.now() % 1e9); let rs = SEED;
const rnd = () => (rs = (rs * 1664525 + 1013904223) % 4294967296) / 4294967296, ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)), pick = (a) => a[ri(0, a.length - 1)];
console.log('SEED=' + SEED);
const U = Date.now().toString(36).slice(-5), NIL = '00000000-0000-0000-0000-000000000000';
const today = new Date().toISOString().slice(0, 10), later = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
const par = (n, f) => Promise.all(Array.from({ length: n }, (_, i) => f(i)));
const no5 = (xs) => xs.every((x) => x.s < 500);
let seq = 0; const mob = () => '9' + String((Date.now() % 1e7) * 100 + ++seq + 100000000).slice(-9).padStart(9, '0');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let r;

// ---------- set-up: two projects, buyers with and without contacts, a scoped login, a status code ----------
const co = (await A('POST', '/companies', { name: 'CRM Co ' + U })).j.data.id;
const mkProj = async (tag) => (await A('POST', '/projects', { companyId: co, name: `Crm ${tag} ${U}`, reraNumber: `CR${tag}-${U}`, tcpLicence: 'x' })).j.data.id;
const P1 = await mkProj('A'), P2 = await mkProj('B');
const tower = async (P) => (await A('POST', `/projects/${P}/towers`, { towerName: 'T' + U })).j.data.id;
const T1 = await tower(P1);
const person = (P, label, o = {}) => psql(`INSERT INTO consumers (name, mobile, email, project_id, lead_stage, total_overdue_amt) VALUES ('Crm ${label} ${U}', '${o.mobile === null ? '' : mob()}', '${o.email === null ? '' : `crm.${label}.${U}@example.com`}', '${P}', '${o.stage || 'enquiry'}', ${o.overdue ?? 0}) RETURNING id`);
const C1 = person(P1, 'one', { overdue: 50000 }), C2 = person(P1, 'two', { stage: 'allotted', overdue: 120000 }), CNOMAIL = person(P1, 'nomail', { email: null }), CNOMOB = person(P1, 'nomob', { mobile: null }), CP2 = person(P2, 'other');
const code = psql(`SELECT code FROM communication_status_codes WHERE is_active LIMIT 1`) || (psql(`INSERT INTO communication_status_codes (code, category) VALUES ('CRM-${U}', 'Calling') RETURNING code`));
const PW = 'Crm#Pass' + U.replace(/\D/g, '') + '1';
const newUser = async (tag, role, projectIds) => { const email = `crm.${tag}.${U}@example.com`; const x = await A('POST', '/users/employee-login', { username: `crm_${tag}_${U}`, email, password: PW, confirmPassword: PW, role, assignedProjectIds: projectIds }); return { id: x.j?.data?.userId, call: call(await login(email, PW)) }; };
const only1 = await newUser('p1', 'sales_executive', [P1]), only2 = await newUser('p2', 'sales_executive', [P2]);
t('setup: people, project logins and a status code exist', !!(C1 && CP2 && code && only1.id && only2.id));
const tid = []; const ruleIds = [], campIds = [], ticketIds = [];

// ================= TASKS =================
r = await SE('POST', '/tasks', { title: `Call ${U}`, consumerId: C1, dueDate: later(2), priority: 'high', description: 'ring about the cheque' }); const T = r.j?.data?.id; tid.push(T);
t('task: sales creates one', r.s === 201 && T && r.j.data.status === 'pending', r);
t('task: viewer cannot create (403)', (await RO('POST', '/tasks', { title: 'x' })).s === 403);
t('task: accounts_finance cannot create (403)', (await AF('POST', '/tasks', { title: 'x' })).s === 403);
t('task: no login is 401', (await NO('GET', '/tasks')).s === 401 && (await NO('POST', '/tasks', { title: 'x' })).s === 401);
for (const [who, f] of [['viewer', RO], ['sales', SE], ['pm', PM], ['accounts', AF], ['admin', A]]) t(`task list: ${who} can read`, (await f('GET', '/tasks')).s === 200);
for (const [n, b] of [['no title', {}], ['blank title', { title: '   ' }], ['title number', { title: 5 }], ['title list', { title: ['a'] }], ['title 256', { title: 'a'.repeat(256) }], ['title script', { title: '<script>alert(1)</script>' }], ['title zero width only', { title: '​‍' }],
  ['description object', { title: 'ok', description: {} }], ['description 5001', { title: 'ok', description: 'd'.repeat(5001) }],
  ['bad priority', { title: 'ok', priority: 'urgentest' }], ['priority number', { title: 'ok', priority: 1 }], ['bad date', { title: 'ok', dueDate: '2026-02-30' }], ['date text', { title: 'ok', dueDate: 'tomorrow' }], ['date 1e3', { title: 'ok', dueDate: '1e3' }],
  ['assignee not uuid', { title: 'ok', assignedTo: 'abc' }], ['assignee unknown', { title: 'ok', assignedTo: NIL }], ['customer not uuid', { title: 'ok', consumerId: '1 OR 1=1' }], ['customer unknown', { title: 'ok', consumerId: NIL }]]) {
  r = await A('POST', '/tasks', b); t(`task create refused: ${n}`, r.s >= 400 && r.s < 500 && !!r.j?.error, r);
}
t('task create: a list body is refused, not a 500', (await A('POST', '/tasks', undefined, '[1,2]')).s === 400);
t('task create: broken JSON is a 4xx', (await A('POST', '/tasks', undefined, '{"title":')).s < 500);
r = await A('POST', '/tasks', { title: `Minimal ${U}` }); tid.push(r.j?.data?.id); t('task create: only a title is enough, priority normal', r.s === 201 && r.j.data.priority === 'normal', r);
r = await A('POST', '/tasks', { title: `Full ${U}`, description: 'x', assignedTo: psql(`select id from users where email='sales_executive@test.local'`), consumerId: C2, dueDate: today, priority: 'urgent' }); tid.push(r.j?.data?.id); t('task create: every field filled', r.s === 201, r);
t('task create: a customer of another project is not found for a scoped user', (await only1.call('POST', '/tasks', { title: 'x', consumerId: CP2 })).s === 404);
for (const q of ['status=done', 'status[]=pending', 'dueDate=2026-13-45', 'assignedTo=abc', 'consumerId=abc', 'pageSize=0', 'pageSize=501', 'pageSize=1;DROP TABLE tasks', 'page=-1', 'page=1e3', 'pageSize=5&pageSize=6']) {
  r = await A('GET', '/tasks?' + q); t(`task list refused: ${q}`, r.s === 400, r);
}
t('task list: the tasks table is still there after the injection tries', Number(psql(`select count(*) from tasks`)) > 0);
r = await A('GET', `/tasks?consumerId=${C1}&status=pending&pageSize=5`); t('task list: filters work and carry the customer name', r.s === 200 && r.j.data.length >= 1 && r.j.data.every((x) => x.consumer_name === `Crm one ${U}`), r);
r = await A('GET', `/tasks?dueDate=${later(2)}&consumerId=${C1}`); t('task list: due date filter', r.s === 200 && r.j.data.some((x) => x.id === T), r);
r = await A('GET', `/tasks?pageSize=1&page=2`); t('task list: paging', r.s === 200 && r.j.data.length <= 1, r);
t('task patch: bad id is 400, unknown 404', (await A('PATCH', '/tasks/abc', { status: 'completed' })).s === 400 && (await A('PATCH', '/tasks/' + NIL, { status: 'completed' })).s === 404);
t('task patch: bad status refused', (await A('PATCH', '/tasks/' + T, { status: 'done' })).s === 400);
t('task patch: empty change refused', (await A('PATCH', '/tasks/' + T, {})).s === 400);
t('task patch: viewer 403', (await RO('PATCH', '/tasks/' + T, { status: 'completed' })).s === 403);
r = await SE('PATCH', '/tasks/' + T, { status: 'completed' }); const done1 = psql(`select completed_at from tasks where id='${T}'`);
t('task complete: sets the completed time', r.s === 200 && r.j.data.status === 'completed' && !!done1, r);
await sleep(1100); await SE('PATCH', '/tasks/' + T, { status: 'completed' });
t('task complete twice: the first completed time is kept', psql(`select completed_at from tasks where id='${T}'`) === done1);
r = await SE('PATCH', '/tasks/' + T, { status: 'pending' }); t('task reopen: completed time cleared', r.s === 200 && psql(`select completed_at is null from tasks where id='${T}'`) === 't', r);
r = await SE('PATCH', '/tasks/' + T, { title: `Renamed ${U}`, priority: 'normal' }); t('task patch: title and priority change, status stays', r.s === 200 && r.j.data.title === `Renamed ${U}` && r.j.data.status === 'pending', r);
t('task delete: sales and pm cannot (403)', (await SE('DELETE', '/tasks/' + T)).s === 403 && (await PM('DELETE', '/tasks/' + T)).s === 403);
t('task delete: bad id 400', (await A('DELETE', '/tasks/abc')).s === 400);
r = await A('DELETE', '/tasks/' + tid[1]); t('task delete: admin deletes', r.s === 200, r); t('task delete twice: 404', (await A('DELETE', '/tasks/' + tid[1])).s === 404);
const rc = await par(6, () => A('PATCH', '/tasks/' + T, { status: 'completed' })); t('task: six parallel completes, no 5xx', no5(rc) && rc.every((x) => x.s === 200));

// ================= AUTOMATION =================
r = await PM('POST', '/automation', { name: `Rule ${U}`, triggerEvent: 'payment_overdue', actionType: 'send_whatsapp', messageTemplate: 'Dear {{consumer_name}}, your payment is due', delayMinutes: 30 }); const R = r.j?.data?.id; ruleIds.push(R);
t('rule: pm creates one', r.s === 201 && R, r);
t('rule: viewer 403 and accounts_finance 403 on create', (await RO('POST', '/automation', { name: 'x', triggerEvent: 'lead_created', actionType: 'create_task' })).s === 403 && (await AF('POST', '/automation', { name: 'x', triggerEvent: 'lead_created', actionType: 'create_task' })).s === 403);
t('rule: no login 401', (await NO('GET', '/automation')).s === 401);
t('rule list: sales and viewer can read', (await SE('GET', '/automation')).s === 200 && (await RO('GET', '/automation')).s === 200);
for (const [n, b] of [['no name', { triggerEvent: 'lead_created', actionType: 'create_task' }], ['unknown trigger', { name: 'x', triggerEvent: 'moon_phase', actionType: 'create_task' }], ['unknown action', { name: 'x', triggerEvent: 'lead_created', actionType: 'launch_rocket' }],
  ['trigger list', { name: 'x', triggerEvent: ['lead_created'], actionType: 'create_task' }], ['send without template', { name: 'x', triggerEvent: 'lead_created', actionType: 'send_sms' }], ['template 2001', { name: 'x', triggerEvent: 'lead_created', actionType: 'send_sms', messageTemplate: 't'.repeat(2001) }],
  ['template script', { name: 'x', triggerEvent: 'lead_created', actionType: 'send_sms', messageTemplate: '<img src=x onerror=alert(1)>' }], ['delay negative', { name: 'x', triggerEvent: 'lead_created', actionType: 'create_task', delayMinutes: -5 }],
  ['delay 1e3', { name: 'x', triggerEvent: 'lead_created', actionType: 'create_task', delayMinutes: '1e3' }], ['delay fraction', { name: 'x', triggerEvent: 'lead_created', actionType: 'create_task', delayMinutes: 1.5 }], ['delay a year and a day', { name: 'x', triggerEvent: 'lead_created', actionType: 'create_task', delayMinutes: 525601 }],
  ['name 256', { name: 'n'.repeat(256), triggerEvent: 'lead_created', actionType: 'create_task' }]]) {
  r = await A('POST', '/automation', b); t(`rule create refused: ${n}`, r.s === 400 && !!r.j?.error, r);
}
r = await A('POST', '/automation', { name: `NoSend ${U}`, triggerEvent: 'lead_created', actionType: 'create_task' }); ruleIds.push(r.j?.data?.id); t('rule create: a non-send action needs no template', r.s === 201, r);
for (const q of ['isActive=yes', 'isActive[]=true', 'pageSize=0', 'pageSize=1;select 1', 'page=0']) t(`rule list refused: ${q}`, (await A('GET', '/automation?' + q)).s === 400);
r = await A('GET', '/automation?isActive=true&pageSize=500'); t('rule list: active filter', r.s === 200 && r.j.data.every((x) => x.is_active), r);
t('rule patch: sales cannot (403)', (await SE('PATCH', '/automation/' + R, { isActive: false })).s === 403);
t('rule patch: isActive must be a real boolean', (await PM('PATCH', '/automation/' + R, { isActive: 'false' })).s === 400);
t('rule patch: bad id / unknown / empty', (await PM('PATCH', '/automation/abc', { isActive: true })).s === 400 && (await PM('PATCH', '/automation/' + NIL, { isActive: true })).s === 404 && (await PM('PATCH', '/automation/' + R, {})).s === 400);
t('rule patch: bad trigger refused', (await PM('PATCH', '/automation/' + R, { triggerEvent: 'nope' })).s === 400);
r = await PM('POST', `/automation/${R}/run`); t('rule run: counts the run and says nothing was sent', r.s === 200 && /nothing was sent/i.test(r.j?.data?.message || '') && Number(psql(`select execution_count from automation_rules where id='${R}'`)) === 1, r);
const runs = await par(5, () => PM('POST', `/automation/${R}/run`)); t('rule run: five parallel runs count exactly five more', no5(runs) && Number(psql(`select execution_count from automation_rules where id='${R}'`)) === 6);
await PM('PATCH', '/automation/' + R, { isActive: false }); r = await PM('POST', `/automation/${R}/run`);
t('rule run: a switched-off rule is refused (409) and not counted', r.s === 409 && Number(psql(`select execution_count from automation_rules where id='${R}'`)) === 6, r);
t('rule run: bad id / unknown', (await PM('POST', '/automation/abc/run')).s === 400 && (await PM('POST', `/automation/${NIL}/run`)).s === 404);
await PM('PATCH', '/automation/' + R, { isActive: true, delayMinutes: 0, messageTemplate: 'changed' }); t('rule patch: switch on and edit', psql(`select is_active||'|'||delay_minutes||'|'||message_template from automation_rules where id='${R}'`) === 'true|0|changed');
t('rule delete: pm 403, admin 200, again 404, bad id 400', (await PM('DELETE', '/automation/' + R)).s === 403 && (await A('DELETE', '/automation/' + R)).s === 200 && (await A('DELETE', '/automation/' + R)).s === 404 && (await A('DELETE', '/automation/abc')).s === 400);

// ================= SENDING (messages) =================
r = await SE('POST', `/communications/${C1}/send`, { channel: 'whatsapp', message: `Hello ${U}` }); const M1 = r.j?.data?.id;
t('send: a message is recorded as queued, not sent, and says nothing left the system', r.s === 201 && r.j.data.status === 'queued' && /nothing has left/i.test(r.j.message || ''), r);
t('send: the number comes from the customer record', psql(`select phone_recipient = (select mobile from consumers where id='${C1}') from communications where id='${M1}'`) === 't');
r = await SE('POST', `/communications/${C1}/send`, { channel: 'whatsapp', message: `Hello ${U}` }); t('send: the same text again within 15 s is refused as a double click (409)', r.s === 409, r);
const dbl = await par(5, () => SE('POST', `/communications/${C2}/send`, { channel: 'sms', message: `Burst ${U}` })); t('send: five parallel identical sends record exactly one', dbl.filter((x) => x.s === 201).length === 1 && no5(dbl), dbl.map((x) => x.s));
t('send: a different text goes through', (await SE('POST', `/communications/${C1}/send`, { channel: 'whatsapp', message: `Second ${U}` })).s === 201);
r = await SE('POST', `/communications/${C1}/send`, { message: `Mail ${U}`, subject: 'Hi' }); t('send: channel defaults to email, subject kept', r.s === 201 && r.j.data.channel === 'email' && r.j.data.subject === 'Hi', r);
t('send: viewer 403, accounts_finance 403, no login 401', (await RO('POST', `/communications/${C1}/send`, { message: 'x' })).s === 403 && (await AF('POST', `/communications/${C1}/send`, { message: 'x' })).s === 403 && (await NO('POST', `/communications/${C1}/send`, { message: 'x' })).s === 401);
for (const [n, id, b] of [['no message', C1, { channel: 'sms' }], ['blank', C1, { message: '  ' }], ['channel instagram', C1, { channel: 'instagram', message: 'x' }], ['channel list', C1, { channel: ['sms'], message: 'x' }], ['message object', C1, { message: {} }],
  ['sms 1601', C1, { channel: 'sms', message: 's'.repeat(1601) }], ['whatsapp 4097', C1, { channel: 'whatsapp', message: 'w'.repeat(4097) }], ['script', C1, { message: '<script>1</script>' }], ['subject 256', C1, { message: 'x', subject: 's'.repeat(256) }],
  ['bad customer id', 'abc', { message: 'x' }], ['unknown customer', NIL, { message: 'x' }]]) {
  r = await A('POST', `/communications/${id}/send`, b); t(`send refused: ${n}`, r.s >= 400 && r.s < 500, r);
}
t('send: an email to a customer with no email is refused (409)', (await A('POST', `/communications/${CNOMAIL}/send`, { channel: 'email', message: 'x' })).s === 409);
t('send: a text to a customer with no mobile is refused (409)', (await A('POST', `/communications/${CNOMOB}/send`, { channel: 'sms', message: 'x' })).s === 409);
t('send: a scoped login cannot send to a customer of another project (404)', (await only1.call('POST', `/communications/${CP2}/send`, { channel: 'sms', message: 'x' })).s === 404);
r = await A('POST', '/communications/emails', { consumerId: C1, recipientEmail: 'a@b.co', subject: 'S', htmlBody: 'Body ' + U }); t('emails: recorded as queued', r.s === 201 && r.j.data.status === 'queued', r);
for (const [n, b] of [['bad email', { recipientEmail: 'nope', subject: 'S', htmlBody: 'b' }], ['no subject', { recipientEmail: 'a@b.co', htmlBody: 'b' }], ['no body', { recipientEmail: 'a@b.co', subject: 'S' }], ['email with space', { recipientEmail: 'a b@c.co', subject: 'S', htmlBody: 'b' }], ['html body', { recipientEmail: 'a@b.co', subject: 'S', htmlBody: '<b onmouseover=1>x</b>' }], ['email list', { recipientEmail: ['a@b.co'], subject: 'S', htmlBody: 'b' }], ['template only', { recipientEmail: 'a@b.co', templateId: NIL }]]) {
  r = await A('POST', '/communications/emails', { consumerId: C1, ...b }); t(`emails refused: ${n}`, r.s === 400, r);
}
r = await A('POST', '/communications/whatsapp', { consumerId: C1, recipientPhone: '+91 98765-43210', message: 'W ' + U }); t('whatsapp: spaces and dashes in the number are cleaned', r.s === 201 && psql(`select phone_recipient from communications where id='${r.j.data.id}'`) === '+919876543210', r);
r = await A('POST', '/communications/sms', { consumerId: C1, recipientPhone: mob(), message: 'S ' + U }); t('sms: recorded as queued', r.s === 201 && r.j.data.status === 'queued', r);
for (const [p, ph] of [['whatsapp', '12345'], ['sms', 'abc1234567'], ['sms', '1'.repeat(16)], ['whatsapp', '98765 43210; drop'], ['sms', ['9876543210']]]) t(`${p} refused: phone ${JSON.stringify(ph)}`, (await A('POST', '/communications/' + p, { consumerId: C1, recipientPhone: ph, message: 'x' })).s === 400);
t('whatsapp: no message / templateId only refused', (await A('POST', '/communications/whatsapp', { consumerId: C1, recipientPhone: mob() })).s === 400 && (await A('POST', '/communications/whatsapp', { consumerId: C1, recipientPhone: mob(), templateId: 'tpl' })).s === 400);
r = await A('GET', `/communications/messages?pageSize=500`); t('messages: lists with the customer name', r.s === 200 && r.j.data.some((x) => x.id === M1 && x.consumer_name === `Crm one ${U}` && x.message === `Hello ${U}`), r);
r = await A('GET', `/communications/messages?channel=sms&pageSize=500`); t('messages: channel filter', r.s === 200 && r.j.data.length > 0 && r.j.data.every((x) => x.channel === 'sms'), r);
for (const q of ['channel=fax', 'channel[]=sms', 'pageSize=0', 'pageSize=501', 'page=abc', 'pageSize=1;select 1']) t(`messages refused: ${q}`, (await A('GET', '/communications/messages?' + q)).s === 400);
r = await only2.call('GET', '/communications/messages?pageSize=500'); t('messages: a scoped login sees nothing of another project', r.s === 200 && r.j.data.every((x) => x.consumer_id !== C1), r);
r = await A('GET', `/communications/${C1}?pageSize=3`); t('thread of one customer: paging', r.s === 200 && r.j.data.length <= 3 && r.j.data.length >= 1, r);
t('thread: bad id 400, bad channel 400, bad paging 400', (await A('GET', '/communications/abc')).s === 400 && (await A('GET', `/communications/${C1}?channel=x`)).s === 400 && (await A('GET', `/communications/${C1}?pageSize=1;x`)).s === 400);
t('thread: unknown customer is an empty list, a scoped login gets nothing for another project', (await A('GET', '/communications/' + NIL)).j?.data?.length === 0 && (await only1.call('GET', '/communications/' + C1)).j?.data?.length >= 0 && (await only2.call('GET', '/communications/' + C1)).j?.data?.length === 0);

// ================= REMARKS =================
r = await SE('POST', '/communications/remarks', { consumerId: C1, channel: 'call', subject: 'Spoke', notes: 'will pay Friday', followUpDate: later(3), tags: ['ptp', 'friday'] }); const RM = r.j?.data?.id;
t('remark: sales writes one with every field', r.s === 201 && RM, r);
t('remark: only a subject or only notes is enough', (await SE('POST', '/communications/remarks', { consumerId: C1, channel: 'meeting', subject: 'Only subject' })).s === 201 && (await SE('POST', '/communications/remarks', { consumerId: C1, channel: 'other', notes: 'Only notes' })).s === 201);
t('remark: viewer 403, accounts_finance 403, no login 401', (await RO('POST', '/communications/remarks', { consumerId: C1, channel: 'call', notes: 'x' })).s === 403 && (await AF('POST', '/communications/remarks', { consumerId: C1, channel: 'call', notes: 'x' })).s === 403 && (await NO('POST', '/communications/remarks', {})).s === 401);
for (const [n, b] of [['no customer', { channel: 'call', notes: 'x' }], ['bad customer', { consumerId: 'x', channel: 'call', notes: 'x' }], ['unknown customer', { consumerId: NIL, channel: 'call', notes: 'x' }], ['no channel', { consumerId: C1, notes: 'x' }], ['bad channel', { consumerId: C1, channel: 'pigeon', notes: 'x' }],
  ['nothing written', { consumerId: C1, channel: 'call' }], ['notes 5001', { consumerId: C1, channel: 'call', notes: 'n'.repeat(5001) }], ['subject 256', { consumerId: C1, channel: 'call', subject: 's'.repeat(256) }], ['notes script', { consumerId: C1, channel: 'call', notes: '<img src=x onerror=1>' }],
  ['bad follow-up date', { consumerId: C1, channel: 'call', notes: 'x', followUpDate: '2026-02-30' }], ['tags text', { consumerId: C1, channel: 'call', notes: 'x', tags: 'ptp' }], ['11 tags', { consumerId: C1, channel: 'call', notes: 'x', tags: Array.from({ length: 11 }, (_, i) => 't' + i) }], ['tag object', { consumerId: C1, channel: 'call', notes: 'x', tags: [{}] }], ['tag 31', { consumerId: C1, channel: 'call', notes: 'x', tags: ['t'.repeat(31)] }]]) {
  r = await A('POST', '/communications/remarks', b); t(`remark refused: ${n}`, r.s >= 400 && r.s < 500, r);
}
t('remark: a scoped login cannot write on a customer of another project', (await only1.call('POST', '/communications/remarks', { consumerId: CP2, channel: 'call', notes: 'x' })).s === 404);
r = await A('GET', `/communications/remarks/${C1}`); t('remarks: timeline lists them newest first', r.s === 200 && r.j.data.length >= 3 && r.j.data[0].timestamp >= r.j.data[r.j.data.length - 1].timestamp, r);
r = await A('GET', `/communications/remarks/${C1}?channel=call`); t('remarks: channel filter', r.s === 200 && r.j.data.length >= 1 && r.j.data.every((x) => x.channel === 'call'), r);
t('remarks: bad id / channel / paging refused', (await A('GET', '/communications/remarks/abc')).s === 400 && (await A('GET', `/communications/remarks/${C1}?channel=x`)).s === 400 && (await A('GET', `/communications/remarks/${C1}?pageSize=5;x`)).s === 400);
t('remarks: another project is hidden from a scoped login', (await only2.call('GET', `/communications/remarks/${C1}`)).j?.data?.length === 0);

// ================= TICKETS =================
r = await SE('POST', '/communications/tickets', { consumerId: C1, subject: `Leak ${U}`, description: 'water in the flat', priority: 'high', assignedToUserId: psql(`select id from users where email='project_manager@test.local'`) }); const TK = r.j?.data?.id; ticketIds.push(TK);
t('ticket: sales opens one with every field', r.s === 201 && r.j.data.status === 'open', r);
r = await SE('POST', '/communications/tickets', { consumerId: C2, subject: `Min ${U}`, description: 'd' }); ticketIds.push(r.j?.data?.id); t('ticket: priority defaults to medium', r.s === 201 && r.j.data.priority === 'medium', r);
t('ticket: viewer 403, accounts_finance 403', (await RO('POST', '/communications/tickets', { consumerId: C1, subject: 's', description: 'd' })).s === 403 && (await AF('POST', '/communications/tickets', { consumerId: C1, subject: 's', description: 'd' })).s === 403);
for (const [n, b] of [['no subject', { consumerId: C1, description: 'd' }], ['no description', { consumerId: C1, subject: 's' }], ['bad priority', { consumerId: C1, subject: 's', description: 'd', priority: 'now' }], ['bad customer', { consumerId: 'x', subject: 's', description: 'd' }], ['unknown customer', { consumerId: NIL, subject: 's', description: 'd' }],
  ['assignee unknown', { consumerId: C1, subject: 's', description: 'd', assignedToUserId: NIL }], ['assignee not uuid', { consumerId: C1, subject: 's', description: 'd', assignedToUserId: 'x' }], ['subject script', { consumerId: C1, subject: '<b>x</b>', description: 'd' }], ['description 5001', { consumerId: C1, subject: 's', description: 'd'.repeat(5001) }]]) {
  r = await A('POST', '/communications/tickets', b); t(`ticket refused: ${n}`, r.s >= 400 && r.s < 500, r);
}
r = await A('GET', '/communications/tickets?pageSize=500'); t('tickets: list carries the customer name', r.s === 200 && r.j.data.some((x) => x.id === TK && x.consumer_name === `Crm one ${U}`), r);
r = await A('GET', '/communications/tickets?status=open&priority=high&pageSize=500'); t('tickets: status and priority filters', r.s === 200 && r.j.data.length >= 1 && r.j.data.every((x) => x.status === 'open' && x.priority === 'high'), r);
for (const q of ['status=fixed', 'priority=asap', 'assignedToUserId=x', 'pageSize=0', 'pageSize=1;x', 'status[]=open']) t(`tickets refused: ${q}`, (await A('GET', '/communications/tickets?' + q)).s === 400);
r = await PM('PATCH', '/communications/tickets/' + TK, { status: 'resolved' }); t('ticket resolve: sets the resolved time', r.s === 200 && psql(`select resolved_at is not null from support_tickets where id='${TK}'`) === 't', r);
r = await PM('PATCH', '/communications/tickets/' + TK, { status: 'open' }); t('ticket reopen: clears the resolved time', r.s === 200 && psql(`select resolved_at is null from support_tickets where id='${TK}'`) === 't', r);
t('ticket patch: sales 403 (edit needs pm), viewer 403', (await SE('PATCH', '/communications/tickets/' + TK, { status: 'closed' })).s === 403 && (await RO('PATCH', '/communications/tickets/' + TK, { status: 'closed' })).s === 403);
t('ticket patch: bad status / empty / bad id / unknown / unknown assignee', (await PM('PATCH', '/communications/tickets/' + TK, { status: 'x' })).s === 400 && (await PM('PATCH', '/communications/tickets/' + TK, {})).s === 400 && (await PM('PATCH', '/communications/tickets/abc', { status: 'open' })).s === 400 && (await PM('PATCH', '/communications/tickets/' + NIL, { status: 'open' })).s === 404 && (await PM('PATCH', '/communications/tickets/' + TK, { assignedToUserId: NIL })).s === 404);
const tp = await par(5, (i) => PM('PATCH', '/communications/tickets/' + TK, { status: pick(['open', 'in_progress', 'resolved', 'closed']) })); t('ticket: five parallel status changes, no 5xx and state is valid', no5(tp) && ['open', 'in_progress', 'resolved', 'closed'].includes(psql(`select status from support_tickets where id='${TK}'`)));
{ const st = psql(`select status||'|'||(resolved_at is not null) from support_tickets where id='${TK}'`); const [s, has] = st.split('|'); t('ticket: resolved time agrees with the status after the race', (['resolved', 'closed'].includes(s)) === (has === 'true'), st); }

// ================= CALLING =================
r = await AF('GET', '/communications/status-codes'); t('calling: finance (calling permission) reads status codes', r.s === 200 && r.j.data.length > 0, r);
r = await AF('GET', '/communications/calling-list'); t('calling: finance opens the list', r.s === 200 && Array.isArray(r.j.data), r);
r = await AF('POST', '/communications/log-call', { consumerId: C1, statusCode: code, subStatusCode: 'asked time', ptpDate: later(5), nextCallDate: later(2), remarks: 'will pay' }); t('calling: finance logs a call', r.s === 200, r);
t('calling: the call also shows in the remarks timeline (the dialer history reads remarks)', psql(`select count(*) from remarks where consumer_id='${C1}' and channel='call' and notes='will pay'`) === '1');
t('calling: the consumer record carries the last call', psql(`select last_call_status||'|'||last_call_sub_status from consumers where id='${C1}'`) === `${code}|asked time` && psql(`select count(*) from call_logs where consumer_id='${C1}'`) === '1');
t('calling: sales may log a call too, viewer may not, no login 401', (await SE('POST', '/communications/log-call', { consumerId: C2, statusCode: code })).s === 200 && (await RO('POST', '/communications/log-call', { consumerId: C2, statusCode: code })).s === 403 && (await NO('POST', '/communications/log-call', {})).s === 401);
t('calling: viewer and sales can read the list, no login 401', (await RO('GET', '/communications/calling-list')).s === 200 && (await SE('GET', '/communications/status-codes')).s === 200 && (await NO('GET', '/communications/calling-list')).s === 401);
t('calling: finance cannot write remarks or send (403)', (await AF('POST', '/communications/remarks', { consumerId: C1, channel: 'call', notes: 'x' })).s === 403);
for (const [n, b] of [['no customer', { statusCode: code }], ['bad customer', { consumerId: 'x', statusCode: code }], ['unknown customer', { consumerId: NIL, statusCode: code }], ['no status', { consumerId: C1 }], ['unknown status', { consumerId: C1, statusCode: 'NOT-A-CODE' }], ['status list', { consumerId: C1, statusCode: [code] }],
  ['promise in the past', { consumerId: C1, statusCode: code, ptpDate: later(-3) }], ['next call in the past', { consumerId: C1, statusCode: code, nextCallDate: later(-1) }], ['bad date', { consumerId: C1, statusCode: code, ptpDate: '2026-02-30' }], ['remarks 2001', { consumerId: C1, statusCode: code, remarks: 'r'.repeat(2001) }],
  ['remarks script', { consumerId: C1, statusCode: code, remarks: '<script>x</script>' }], ['sub status 101', { consumerId: C1, statusCode: code, subStatusCode: 's'.repeat(101) }]]) {
  r = await A('POST', '/communications/log-call', b); t(`log-call refused: ${n}`, r.s >= 400 && r.s < 500, r);
}
t('log-call: a refused call changed nothing', psql(`select last_call_status||'|'||last_call_sub_status from consumers where id='${C1}'`) === `${code}|asked time` && psql(`select count(*) from call_logs where consumer_id='${C1}'`) === '1');
t('log-call: a scoped login cannot log a call on another project (404)', (await only1.call('POST', '/communications/log-call', { consumerId: CP2, statusCode: code })).s === 404);
const lc = await par(6, (i) => A('POST', '/communications/log-call', { consumerId: C2, statusCode: code, subStatusCode: 'race ' + i }));
t('log-call: six parallel calls on one customer, no 5xx, the record matches the last log', no5(lc) && psql(`select c.last_call_sub_status = (select sub_status_code from call_logs where consumer_id=c.id order by call_date desc, id desc limit 1) from consumers c where id='${C2}'`) === 't');
r = await A('GET', `/communications/calling-list?projectId=${P1}&pageSize=3`); t('calling list: project filter (customers of this project only)', r.s === 200 && r.j.data.length >= 4 && r.j.data.every((x) => x.project_name === `Crm A ${U}`), r);
r = await A('GET', `/communications/calling-list?projectId=${P1}&employeeId=${psql(`select id from users where email='accounts_finance@test.local'`)}`); t('calling list: employee filter finds the customers this employee called', r.s === 200 && r.j.data.length === 1 && r.j.data[0].id === C1, r);
t('calling list: employee filter, bad id refused', (await A('GET', '/communications/calling-list?employeeId=x')).s === 400);
r = await A('GET', `/communications/calling-list?projectId=${P1}&customerStatus=Allottee`); t('calling list: customer status "Allottee" finds the allotted customer', r.s === 200 && r.j.data.length === 1 && r.j.data[0].id === C2, r);
r = await A('GET', `/communications/calling-list?projectId=${P1}&customerStatus=Lead`); t('calling list: customer status "Lead" finds the enquiry customers, not the allotted one', r.s === 200 && r.j.data.length === 3 && !r.j.data.some((x) => x.id === C2), r);
r = await A('GET', `/communications/calling-list?projectId=${P1}&minOsAmount=100000`); t('calling list: minimum outstanding', r.s === 200 && r.j.data.length === 1 && r.j.data[0].id === C2, r);
r = await A('GET', `/communications/calling-list?projectId=${P1}&customerName=%25`); t('calling list: a % in the name search is a letter, not everything', r.s === 200 && r.j.data.length === 0, r);
r = await A('GET', `/communications/calling-list?projectId=${P1}&customerName=NOMAIL`); t('calling list: name search is case-free', r.s === 200 && r.j.data.length === 1, r);
r = await A('GET', `/communications/calling-list?projectId=${P1}&statusCode=${encodeURIComponent(code)}`); t('calling list: last call status filter', r.s === 200 && r.j.data.length >= 1 && r.j.data.every((x) => x.last_call_status === code), r);
for (const q of ['minOsAmount=-1', 'minOsAmount=abc', 'minOsAmount=1e3', 'projectId=x', 'towerId=x', 'customerName[]=a', 'regNo[]=a']) t(`calling list refused: ${q}`, (await A('GET', '/communications/calling-list?' + q)).s === 400);
t('calling list: injection in a filter is just text', (await A('GET', "/communications/calling-list?customerName=' OR 1=1 --")).s === 200 && (await A('GET', "/communications/calling-list?unitNo=');drop table consumers;--")).s === 200 && Number(psql(`select count(*) from consumers`)) > 0);
r = await only2.call('GET', `/communications/calling-list`); t('calling list: a scoped login sees only the customers of its own project', r.s === 200 && r.j.data.every((x) => x.id !== C1 && x.id !== C2), r);

// ================= BROADCAST AND CAMPAIGNS =================
r = await SE('POST', '/communications/campaigns', { name: `Diwali ${U}`, channel: 'whatsapp', message: 'Hello {{consumer_name}}', segment: 'enquiry', projectId: P1 }); const CMP = r.j?.data?.id; campIds.push(CMP);
t('campaign: sales makes a draft', r.s === 201 && r.j.data.status === 'draft' && r.j.data.segment === 'enquiry', r);
r = await A('POST', '/communications/campaigns', { name: `Min ${U}`, channel: 'sms', message: 'm', projectId: P1 }); campIds.push(r.j?.data?.id); t('campaign: segment defaults to all', r.s === 201 && r.j.data.segment === 'all', r);
t('campaign: viewer 403, accounts_finance 403, no login 401', (await RO('POST', '/communications/campaigns', { name: 'x', channel: 'sms', message: 'm', projectId: P1 })).s === 403 && (await AF('POST', '/communications/campaigns', { name: 'x', channel: 'sms', message: 'm', projectId: P1 })).s === 403 && (await NO('GET', '/communications/campaigns')).s === 401);
for (const [n, b] of [['no project (it used to pick any project)', { name: 'x', channel: 'sms', message: 'm' }], ['bad project', { name: 'x', channel: 'sms', message: 'm', projectId: 'x' }], ['unknown project', { name: 'x', channel: 'sms', message: 'm', projectId: NIL }], ['no name', { channel: 'sms', message: 'm', projectId: P1 }],
  ['no message', { name: 'x', channel: 'sms', projectId: P1 }], ['bad channel', { name: 'x', channel: 'fax', message: 'm', projectId: P1 }], ['no channel', { name: 'x', message: 'm', projectId: P1 }], ['bad segment', { name: 'x', channel: 'sms', message: 'm', projectId: P1, segment: 'vip' }],
  ['message 4097', { name: 'x', channel: 'sms', message: 'm'.repeat(4097), projectId: P1 }], ['name script', { name: '<b>x</b>', channel: 'sms', message: 'm', projectId: P1 }]]) {
  r = await A('POST', '/communications/campaigns', b); t(`campaign refused: ${n}`, r.s >= 400 && r.s < 500, r);
}
t('campaign: a scoped login cannot make one for another project (404)', (await only1.call('POST', '/communications/campaigns', { name: 'x', channel: 'sms', message: 'm', projectId: P2 })).s === 404);
r = await A('GET', `/communications/campaigns?projectId=${P1}&channel=whatsapp`); t('campaign list: filters, shows the project name', r.s === 200 && r.j.data.length === 1 && r.j.data[0].project_name === `Crm A ${U}`, r);
for (const q of ['projectId=x', 'channel=fax', 'pageSize=0', 'pageSize=1;x']) t(`campaign list refused: ${q}`, (await A('GET', '/communications/campaigns?' + q)).s === 400);
t('campaign list: a scoped login sees no campaign of another project', (await only2.call('GET', `/communications/campaigns?pageSize=500`)).j?.data?.every((x) => x.id !== CMP));
const ln = await par(5, () => SE('POST', `/communications/campaigns/${CMP}/launch`));
t('launch: five parallel launches, exactly one wins, the others are 409', ln.filter((x) => x.s === 200).length === 1 && ln.filter((x) => x.s === 409).length === 4, ln.map((x) => x.s));
t('launch: status queued and recipients are the 3 enquiry customers with a mobile (one has none)', psql(`select status||'|'||total_recipients from broadcast_campaigns where id='${CMP}'`) === 'queued|2');
t('launch: bad id 400, unknown 404, viewer 403', (await A('POST', '/communications/campaigns/abc/launch')).s === 400 && (await A('POST', `/communications/campaigns/${NIL}/launch`)).s === 404 && (await RO('POST', `/communications/campaigns/${CMP}/launch`)).s === 403);
r = await A('POST', '/communications/campaigns', { name: `Empty ${U}`, channel: 'email', message: 'm', projectId: P2, segment: 'allotted' }); campIds.push(r.j?.data?.id);
t('launch: a campaign that would reach nobody is refused (409) and stays a draft', (await A('POST', `/communications/campaigns/${r.j.data.id}/launch`)).s === 409 && psql(`select status from broadcast_campaigns where id='${r.j.data.id}'`) === 'draft');
t('delete: a queued campaign is kept (409)', (await A('DELETE', '/communications/campaigns/' + CMP)).s === 409);
t('delete: viewer 403, bad id 400', (await RO('DELETE', `/communications/campaigns/${campIds[1]}`)).s === 403 && (await A('DELETE', '/communications/campaigns/abc')).s === 400);
t('delete: a draft is deleted, the same again is 404', (await A('DELETE', `/communications/campaigns/${campIds[1]}`)).s === 200 && (await A('DELETE', `/communications/campaigns/${campIds[1]}`)).s === 404);
r = await A('POST', '/communications/broadcast', { projectId: P1, channel: 'sms', message: 'Hi all ' + U, consumerIds: [C1, C2, CNOMOB, C1] }); campIds.push(r.j?.data?.id);
t('broadcast: listed customers, duplicates and no-mobile ones are not counted (2 reached)', r.s === 201 && r.j.data.total_recipients === 2 && r.j.data.status === 'queued', r);
r = await A('POST', '/communications/broadcast', { projectId: P1, channel: 'email', message: 'Seg ' + U, segmentFilter: 'enquiry' }); campIds.push(r.j?.data?.id); t('broadcast: by segment (enquiry customers with an email: 2)', r.s === 201 && r.j.data.total_recipients === 2, r);
r = await A('POST', '/communications/broadcast', { projectId: P1, channel: 'sms', message: 'Other project ' + U, consumerIds: [CP2] }); t('broadcast: a customer of another project is not counted, so nobody to send to (409)', r.s === 409, r);
for (const [n, b] of [['no recipients given', { projectId: P1, channel: 'sms', message: 'm' }], ['empty list', { projectId: P1, channel: 'sms', message: 'm', consumerIds: [] }], ['list of text', { projectId: P1, channel: 'sms', message: 'm', consumerIds: 'a' }], ['bad id inside', { projectId: P1, channel: 'sms', message: 'm', consumerIds: [C1, 'x'] }],
  ['5001 ids', { projectId: P1, channel: 'sms', message: 'm', consumerIds: Array.from({ length: 5001 }, () => NIL) }], ['no channel (used to be saved empty)', { projectId: P1, message: 'm', consumerIds: [C1] }], ['no message', { projectId: P1, channel: 'sms', consumerIds: [C1] }], ['bad project', { projectId: 'x', channel: 'sms', message: 'm', consumerIds: [C1] }],
  ['unknown project', { projectId: NIL, channel: 'sms', message: 'm', consumerIds: [C1] }], ['bad segment', { projectId: P1, channel: 'sms', message: 'm', segmentFilter: 'vip' }]]) {
  r = await A('POST', '/communications/broadcast', b); t(`broadcast refused: ${n}`, r.s >= 400 && r.s < 500, r);
}
t('broadcast: viewer 403, accounts_finance 403', (await RO('POST', '/communications/broadcast', { projectId: P1, channel: 'sms', message: 'm', consumerIds: [C1] })).s === 403 && (await AF('POST', '/communications/broadcast', { projectId: P1, channel: 'sms', message: 'm', consumerIds: [C1] })).s === 403);

// ================= AI DRAFT =================
r = await SE('POST', `/communications/${C1}/ai-draft`, {}); t('ai-draft: three suggestions with the customer name', r.s === 200 && r.j.data.suggestions.length === 3 && r.j.data.suggestions[0].includes(`Crm one ${U}`), r);
t('ai-draft: bad id 400, unknown 404, viewer 403 (it is a POST)', (await A('POST', '/communications/abc/ai-draft', {})).s === 400 && (await A('POST', `/communications/${NIL}/ai-draft`, {})).s === 404 && (await RO('POST', `/communications/${C1}/ai-draft`, {})).s === 403);
r = await SE('POST', '/communications/ai-suggestions', { consumerId: C1, consumerQuery: 'when is my possession?', channel: 'sms' }); t('ai-suggestions: suggestions come back (fallback when no key)', r.s === 200 && r.j.data.suggestions.length >= 1, r);
for (const [n, b] of [['no query', { consumerId: C1 }], ['query 2001', { consumerId: C1, consumerQuery: 'q'.repeat(2001) }], ['bad customer', { consumerId: 'x', consumerQuery: 'q' }], ['unknown customer', { consumerId: NIL, consumerQuery: 'q' }], ['bad channel', { consumerId: C1, consumerQuery: 'q', channel: 'fax' }], ['context 2001', { consumerId: C1, consumerQuery: 'q', context: 'c'.repeat(2001) }]]) {
  r = await A('POST', '/communications/ai-suggestions', b); t(`ai-suggestions refused: ${n}`, r.s >= 400 && r.s < 500, r);
}

// ================= RANDOM RUN: any route, any junk, never a 5xx =================
const junk = () => pick([undefined, null, '', ' ', 'x', 'a'.repeat(300), 0, -1, 1.5, 1e21, true, [], {}, ['a'], { a: 1 }, '<script>1</script>', "' OR 1=1 --", NIL, 'abc', '2026-02-30', '​', '%', '\u0000']);
const ids = [C1, C2, CNOMAIL, CNOMOB, CP2, NIL, 'abc'];
const rnd5 = [];
for (let i = 0; i < 160; i++) {
  const who = pick([A, SE, PM, AF, only1.call]);
  const j = () => (rnd() < 0.4 ? junk() : undefined);
  const cases = [
    () => who('POST', '/tasks', { title: pick(['T', junk()]), description: j(), assignedTo: j(), consumerId: pick([...ids, j()]), dueDate: j(), priority: j() }),
    () => who('PATCH', '/tasks/' + pick([T, NIL, 'abc']), { status: j(), title: j(), priority: j(), dueDate: j(), description: j() }),
    () => who('GET', `/tasks?status=${encodeURIComponent(String(junk()))}&pageSize=${encodeURIComponent(String(junk()))}`),
    () => who('POST', '/automation', { name: pick(['N', junk()]), triggerEvent: pick(['lead_created', junk()]), actionType: pick(['create_task', 'send_sms', junk()]), messageTemplate: j(), delayMinutes: j() }),
    () => who('PATCH', '/automation/' + pick([NIL, 'abc', ruleIds[1]]), { isActive: j(), delayMinutes: j(), name: j() }),
    () => who('POST', '/communications/remarks', { consumerId: pick(ids), channel: pick(['call', junk()]), subject: j(), notes: pick(['n', junk()]), followUpDate: j(), tags: j() }),
    () => who('POST', '/communications/log-call', { consumerId: pick(ids), statusCode: pick([code, junk()]), subStatusCode: j(), ptpDate: j(), nextCallDate: j(), remarks: j() }),
    () => who('POST', `/communications/${pick(ids)}/send`, { channel: pick(['sms', 'email', junk()]), message: pick(['m' + i, junk()]), subject: j() }),
    () => who('POST', '/communications/tickets', { consumerId: pick(ids), subject: pick(['s', junk()]), description: pick(['d', junk()]), priority: j(), assignedToUserId: j() }),
    () => who('PATCH', '/communications/tickets/' + pick([TK, NIL, 'abc']), { status: j(), priority: j(), assignedToUserId: j() }),
    () => who('POST', '/communications/campaigns', { name: pick(['c', junk()]), channel: pick(['sms', junk()]), message: pick(['m', junk()]), projectId: pick([P1, P2, junk()]), segment: j() }),
    () => who('POST', '/communications/broadcast', { projectId: pick([P1, junk()]), channel: pick(['sms', junk()]), message: pick(['b' + i, junk()]), consumerIds: pick([[C1], junk()]), segmentFilter: j() }),
    () => who('GET', `/communications/calling-list?minOsAmount=${encodeURIComponent(String(junk()))}&customerName=${encodeURIComponent(String(junk()))}&customerStatus=${encodeURIComponent(String(junk()))}`),
    () => who('GET', `/communications/messages?channel=${encodeURIComponent(String(junk()))}&page=${encodeURIComponent(String(junk()))}`),
    () => who('POST', '/communications/ai-suggestions', { consumerId: pick(ids), consumerQuery: pick(['q', junk()]), channel: j(), context: j() }),
  ];
  rnd5.push(...(await Promise.all(Array.from({ length: ri(1, 4) }, () => pick(cases)()))));
}
t(`random run: ${rnd5.length} requests with junk in every field, none is a 5xx (SEED=${SEED})`, no5(rnd5), rnd5.filter((x) => x.s >= 500).slice(0, 3));
t('random run: no task made in this run has a status or priority outside the list', psql(`select count(*) from tasks where created_at > now() - interval '1 hour' and (status not in ('pending','completed') or priority not in ('normal','high','urgent'))`) === '0');
t('database: no new communications row has a status outside the list', psql(`select count(*) from communications where created_at > now() - interval '1 hour' and status not in ('queued','sent','delivered','read','failed')`) === '0');

// ---------- clean up what this run made ----------
{
  const ids2 = [C1, C2, CNOMAIL, CNOMOB, CP2].map((x) => `'${x}'`).join(',');
  for (const sql of [
    `delete from communications where consumer_id in (${ids2})`, `delete from remarks where consumer_id in (${ids2})`, `delete from call_logs where consumer_id in (${ids2})`, `delete from support_tickets where consumer_id in (${ids2})`,
    `delete from tasks where consumer_id in (${ids2}) or title like '%${U}%' or created_at > now() - interval '30 minutes' and title in ('T','Minimal ${U}')`,
    `delete from automation_rules where name like '%${U}%'`, `delete from broadcast_campaigns where project_id in ('${P1}','${P2}')`,
    `delete from consumers where id in (${ids2})`,
  ]) { try { psql(sql); } catch { /* leftovers are harmless, names carry the run id */ } }
}
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
