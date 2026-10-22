// Adds demo data for the CRM screens to the LOCAL demo database: tasks (pending, completed, urgent, due today), automation rules (on and off),
// messages on every channel, remarks, tickets, calls with promises to pay, and campaigns (a draft and a queued one).
// Needs the Grapes Greens project with applicants that have a mobile (demo-seed*.mjs).
// Run:  BASE=http://localhost:3020/api node docs/demo-seed-crm.mjs     (never against live; EMAIL / PASSWORD pick another login)
const B = process.env.BASE || 'http://localhost:3020/api';
if (!/localhost|127\.0\.0\.1/.test(B)) throw new Error('demo seed runs on a local API only');
let tok = '', bad = 0;
const call = async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: b === undefined ? undefined : JSON.stringify(b) }); const j = await r.json().catch(() => null); if (r.status >= 300) { bad++; console.log('  ! ' + m + ' ' + p + ' -> ' + r.status + ' ' + JSON.stringify(j).slice(0, 120)); } return j; };
tok = (await (await fetch(B + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: process.env.EMAIL || 'super_admin@demo.local', password: process.env.PASSWORD || 'Demo#Pass1234' }) })).json()).token;
const today = new Date().toISOString().slice(0, 10), later = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
const proj = (await call('GET', '/projects')).data.find((p) => /Grapes Greens/.test(p.name))?.id;
const list = (await call('GET', `/consumers?project_id=${proj}&limit=40`))?.data;
const people = (list?.consumers || list || []).filter((c) => c.mobile).slice(0, 8);
if (people.length < 4) throw new Error('needs at least 4 applicants with a mobile in Grapes Greens');
let codes = ((await call('GET', '/communications/status-codes'))?.data || []).map((c) => c.code);
if (!codes.length && process.env.PGDATABASE) {   // a database built from the baseline has none; migration 035 seeds them on a migrated one
  const { execFileSync } = await import('node:child_process');
  execFileSync('psql', ['-qAt', '-c', `INSERT INTO communication_status_codes (code, category) VALUES ('Call Again','Calling'),('Next Followup','Calling'),('Promise to Pay','Calling'),('Not Reachable','Calling'),('Disconnected','Calling'),('Wrong Number','Calling'),('Interested','Calling'),('Not Interested','Calling') ON CONFLICT DO NOTHING`]);
  codes = ((await call('GET', '/communications/status-codes'))?.data || []).map((c) => c.code);
}
const tag = Date.now().toString(36).slice(-4).toUpperCase();

// tasks
const t1 = await call('POST', '/tasks', { title: `Collect cheque from ${people[0].name} (${tag})`, consumerId: people[0].id, dueDate: today, priority: 'urgent', description: 'Customer promised a cheque for the second instalment' });
await call('POST', '/tasks', { title: `Send possession checklist (${tag})`, consumerId: people[1].id, dueDate: later(5), priority: 'high' });
await call('POST', '/tasks', { title: `Update the brochure folder (${tag})`, dueDate: later(10) });
const t4 = await call('POST', '/tasks', { title: `Verify KYC of ${people[2].name} (${tag})`, consumerId: people[2].id, dueDate: later(-1), priority: 'high' });
await call('PATCH', `/tasks/${t4.data.id}`, { status: 'completed' });

// automation rules (nothing runs them yet; the screen says so)
await call('POST', '/automation', { name: `Payment overdue reminder (${tag})`, triggerEvent: 'payment_overdue', actionType: 'send_whatsapp', messageTemplate: 'Dear {{consumer_name}}, your instalment is overdue. Please pay at the earliest.', delayMinutes: 60 });
await call('POST', '/automation', { name: `Welcome new lead (${tag})`, triggerEvent: 'lead_created', actionType: 'send_email', messageTemplate: 'Welcome to ROF Group, {{consumer_name}}.', delayMinutes: 0 });
const off = await call('POST', '/automation', { name: `Allotment congratulation (${tag})`, triggerEvent: 'unit_allotted', actionType: 'send_sms', messageTemplate: 'Congratulations on your allotment, {{consumer_name}}!', delayMinutes: 15 });
await call('PATCH', `/automation/${off.data.id}`, { isActive: false });
await call('POST', '/automation', { name: `Create task on task due (${tag})`, triggerEvent: 'task_due', actionType: 'notify_manager' });

// messages on every channel (recorded as queued, nothing is sent), remarks, tickets
await call('POST', `/communications/${people[0].id}/send`, { channel: 'whatsapp', message: `Namaste ${people[0].name}, your demand letter is ready.` });
await call('POST', `/communications/${people[1].id}/send`, { channel: 'sms', message: 'Your payment of Rs 25,000 is due on the 10th.' });
await call('POST', `/communications/${people[0].id}/send`, { channel: 'email', subject: 'Demand letter', message: 'Please find your demand letter attached.' });
await call('POST', '/communications/remarks', { consumerId: people[0].id, channel: 'call', subject: 'Spoke to customer', notes: 'Will visit the office on Friday', followUpDate: later(3), tags: ['visit'] });
await call('POST', '/communications/remarks', { consumerId: people[1].id, channel: 'site_visit', notes: 'Customer saw the tower, liked the 12th floor' });
await call('POST', '/communications/tickets', { consumerId: people[0].id, subject: 'Seepage in the balcony', description: 'Water marks on the balcony wall after rain', priority: 'high' });
const tk = await call('POST', '/communications/tickets', { consumerId: people[3].id, subject: 'Name spelling on the allotment letter', description: 'Please correct the spelling', priority: 'low' });
await call('PATCH', `/communications/tickets/${tk.data.id}`, { status: 'resolved' });

// calls
if (codes.length) {
  await call('POST', '/communications/log-call', { consumerId: people[0].id, statusCode: codes[0], subStatusCode: 'Will pay on Friday', ptpDate: later(4), nextCallDate: later(2), remarks: 'Customer asked for 4 days' });
  await call('POST', '/communications/log-call', { consumerId: people[1].id, statusCode: codes[codes.length - 1], subStatusCode: 'Phone switched off', nextCallDate: later(1) });
} else console.log('  (no calling status codes in this database, calls not seeded)');

// campaigns: one draft, one queued
const c1 = await call('POST', '/communications/campaigns', { name: `Festival offer (${tag})`, channel: 'whatsapp', segment: 'all', projectId: proj, message: 'Hello {{consumer_name}}, visit our site office this weekend for a special offer.' });
await call('POST', '/communications/campaigns', { name: `Possession update (${tag})`, channel: 'sms', segment: 'allotted', projectId: proj, message: 'Dear {{consumer_name}}, possession dates are now confirmed.' });
if (c1?.data?.id) await call('POST', `/communications/campaigns/${c1.data.id}/launch`, {});
console.log(bad ? `demo CRM data added with ${bad} problem(s)` : 'demo CRM data added: 4 tasks, 4 rules, messages, remarks, 2 tickets, 2 calls, 2 campaigns (one queued)');
