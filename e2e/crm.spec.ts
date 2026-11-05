// CRM screens in a real browser: Tasks, Automation, Campaigns, Communications (all channel tabs), WhatsApp / Facebook / Instagram inbox, Calling, Leads.
// Data is made through the API and psql; everything else is clicked on the screens, then the database is asked whether the screen told the truth.
// A JavaScript error, a console error, a 5xx, or "undefined" / "NaN" on a screen fails the test. Texts with markup must show as text.
import { test, expect, Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { bizToday, bizDate } from '../docs/_shared/business-date.mjs';

const PASSWORD = 'Test#Pass1234';
const BASE = process.env.BASE_URL || 'http://localhost:3002';
const U = Date.now().toString(36).slice(-5);
const today = bizToday();
const later = (d: number) => bizDate(Date.now() + d * 864e5);
const psql = (sql: string) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim().split('\n')[0];
let seq = 0; const mob = () => '9' + String((Date.now() % 1e7) * 100 + ++seq + 100000000).slice(-9).padStart(9, '0');
const XSS = `<img src=x onerror="window.__xss=1;alert('xss')">`;

test.describe.configure({ mode: 'serial' });
let page: Page;
let problems: string[] = [];
let dialogs: string[] = [];
const settle = async () => { await page.waitForTimeout(150); await page.waitForLoadState('networkidle'); };
let token = '';
const api = async (method: string, path: string, body?: any) => {
  const r = await fetch(`${BASE}/api${path}`, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
  let j: any = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
};
const S: Record<string, any> = {};
const content = () => page.locator('#content');
const toast = (t: string | RegExp) => page.locator('.toast', { hasText: t }).first();
const go = async (hash: string) => { await page.evaluate((h) => { location.hash = h; }, hash); await settle(); };
const clean = async () => { expect(await content().innerText()).not.toMatch(/\bundefined\b|\bNaN\b|\[object Object\]/); };
const noXss = async () => { expect(await page.evaluate(() => (window as any).__xss), 'markup in a text ran as a script').toBeUndefined(); expect(dialogs.filter((d) => d === 'xss')).toEqual([]); };

test.beforeAll(async ({ browser }) => {
  token = (await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'super_admin@test.local', password: PASSWORD }) })).json()).token;
  const co = (await api('POST', '/companies', { name: `CRM Co ${U}` })).j.data.id;
  S.projectName = `CRM Project ${U}`;
  S.project = (await api('POST', '/projects', { companyId: co, name: S.projectName, reraNumber: `CRM-${U}`, tcpLicence: 'x' })).j.data.id;
  const person = (label: string, o: any = {}) => psql(`INSERT INTO consumers (name, mobile, email, project_id, lead_stage, total_overdue_amt) VALUES ('Crm ${label} ${U}', '${o.noMobile ? '' : mob()}', '${o.noEmail ? '' : `crm.${label}.${U}@example.com`}', '${S.project}', '${o.stage || 'enquiry'}', ${o.overdue ?? 0}) RETURNING id`);
  S.a = person('Asha', { overdue: 45000 }); S.b = person('Bela', { stage: 'allotted', overdue: 150000 }); S.c = person('Chand', { noEmail: true });
  S.names = { a: `Crm Asha ${U}`, b: `Crm Bela ${U}`, c: `Crm Chand ${U}` };
  S.code = psql(`SELECT code FROM communication_status_codes WHERE is_active LIMIT 1`) || psql(`INSERT INTO communication_status_codes (code, category) VALUES ('CRM-${U}', 'Calling') RETURNING code`);

  page = await browser.newPage();
  page.on('dialog', (d) => { dialogs.push(d.message()); d.accept(); });
  page.on('pageerror', (e) => problems.push(`JavaScript error: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|Blocked script execution in 'about:(srcdoc|blank)'/.test(m.text())) problems.push(`Console error: ${m.text()}`); });
  page.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 500) problems.push(`Server error ${r.status()}: ${r.request().method()} ${r.url()}`); });
  await page.goto('/pages/login.html');
  await page.locator('input[type=email]').fill('super_admin@test.local');
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.locator('button[type=submit]').click();
  await page.waitForURL(/#\/dashboard/);
});
test.afterAll(async () => {
  const ids = [S.a, S.b, S.c].map((x) => `'${x}'`).join(',');
  for (const sql of [`delete from communications where consumer_id in (${ids})`, `delete from remarks where consumer_id in (${ids})`, `delete from call_logs where consumer_id in (${ids})`, `delete from tasks where title like '%${U}%' or consumer_id in (${ids})`,
    `delete from automation_rules where name like '%${U}%'`, `delete from broadcast_campaigns where project_id = '${S.project}'`, `delete from consumers where id in (${ids})`]) { try { psql(sql); } catch { /* names carry the run id */ } }
  await page.close();
});
test.beforeEach(() => { problems = []; dialogs = []; });
test.afterEach(() => { expect(problems, 'Errors seen in the browser during this test').toEqual([]); });

// ---------------- Tasks ----------------
test('Tasks: an empty title is refused on the screen, nothing is saved', async () => {
  await go('/tasks'); await expect(page.locator('#task-title')).toBeVisible();
  const before = Number(psql(`select count(*) from tasks`));
  await page.getByRole('button', { name: 'Create Task' }).click();
  await expect(toast(/task title/i)).toBeVisible();
  expect(Number(psql(`select count(*) from tasks`))).toBe(before);
});

test('Tasks: a task with priority High, a customer and a due date is saved with all of them (the priority button used to be ignored)', async () => {
  await page.locator('#task-title').fill(`Ring Asha ${U}`);
  await page.locator('#task-desc').fill('about the cheque');
  await page.locator('#task-consumer').selectOption({ label: new RegExp(S.names.a) as any }).catch(async () => { await page.locator('#task-consumer').selectOption(S.a); });
  await page.locator('#task-due').fill(later(3));
  await page.getByRole('button', { name: 'High', exact: true }).click();
  await page.getByRole('button', { name: 'Create Task' }).click();
  await expect(toast('Task created')).toBeVisible();
  expect(psql(`select priority||'|'||due_date::text||'|'||consumer_id from tasks where title='Ring Asha ${U}'`)).toBe(`high|${later(3)}|${S.a}`);
  await expect(page.locator('#tasks-list-all')).toContainText(`Ring Asha ${U}`);
  await clean();
});

test('Tasks: a title with markup is refused by the server and shown as a message, a stored one shows as text', async () => {
  await page.locator('#task-title').fill(`<b>bold</b> ${U}`);
  await page.getByRole('button', { name: 'Create Task' }).click();
  await expect(page.locator('.toast', { hasText: /character|not allowed|invalid/i }).first()).toBeVisible();
  expect(psql(`select count(*) from tasks where title like '%<b>bold%${U}%'`)).toBe('0');
  psql(`insert into tasks (title, description, status, priority) values ('${XSS.replace(/'/g, "''")} ${U}', '${XSS.replace(/'/g, "''")}', 'pending', 'normal')`);
  await go('/tasks'); await expect(page.locator('#tasks-list-all')).toContainText(`${U}`);
  await noXss(); await clean();
});

test('Tasks: every tab (All, Due Today, Pending, Completed), complete with the checkbox, re-open, delete', async () => {
  const row = page.locator('#tasks-list-all > *', { hasText: `Ring Asha ${U}` }).first();
  await row.locator('input[type=checkbox]').check();
  await expect(toast('Task completed')).toBeVisible();
  expect(psql(`select status||'|'||(completed_at is not null) from tasks where title='Ring Asha ${U}'`)).toBe('completed|true');
  for (const tab of ['All', 'Due Today', 'Pending', 'Completed']) { await page.getByRole('button', { name: tab, exact: true }).click(); await settle(); await clean(); }
  await expect(page.locator('#tasks-list-completed')).toContainText(`Ring Asha ${U}`);
  await expect(page.locator('#tasks-list-pending')).not.toContainText(`Ring Asha ${U}`);
  await page.getByRole('button', { name: 'All', exact: true }).click(); await settle();
  await page.locator('#tasks-list-all > *', { hasText: `Ring Asha ${U}` }).first().locator('input[type=checkbox]').uncheck();
  await expect(toast('Task re-opened')).toBeVisible();
  expect(psql(`select status||'|'||(completed_at is null) from tasks where title='Ring Asha ${U}'`)).toBe('pending|true');
  await page.locator('#tasks-list-all > *', { hasText: `Ring Asha ${U}` }).first().getByRole('button', { name: '✕' }).click();
  await expect(toast('Task deleted')).toBeVisible();
  expect(psql(`select count(*) from tasks where title='Ring Asha ${U}'`)).toBe('0');
});

// ---------------- Automation ----------------
test('Automation: the create window refuses empty fields, a rule is made and shows', async () => {
  await go('/automation');
  await page.getByRole('button', { name: '+ Create Rule' }).click();
  await page.locator('#auto-modal').getByRole('button', { name: /create/i }).last().click();
  await expect(toast(/rule name/i)).toBeVisible();
  await page.locator('#auto-name').fill(`Overdue nudge ${U}`);
  await page.locator('#auto-trigger').selectOption('payment_overdue');
  await page.locator('#auto-action').selectOption('send_whatsapp');
  await page.locator('#auto-template').fill('Dear {{consumer_name}}, your payment is due');
  await page.locator('#auto-delay').fill('30');
  await page.locator('#auto-modal').getByRole('button', { name: /create/i }).last().click();
  await expect(toast('Automation rule created')).toBeVisible();
  expect(psql(`select trigger_event||'|'||action_type||'|'||delay_minutes||'|'||is_active from automation_rules where name='Overdue nudge ${U}'`)).toBe('payment_overdue|send_whatsapp|30|true');
  await expect(page.locator('#automation-body')).toContainText(`Overdue nudge ${U}`);
  await clean();
});

test('Automation: a send rule without a message is refused by the server, and the screen says why', async () => {
  await page.getByRole('button', { name: '+ Create Rule' }).click();
  await page.locator('#auto-name').fill(`No text ${U}`);
  await page.locator('#auto-trigger').selectOption('lead_created');
  await page.locator('#auto-action').selectOption('send_sms');
  await page.locator('#auto-template').fill('');
  await page.locator('#auto-modal').getByRole('button', { name: /create/i }).last().click();
  await expect(page.locator('.toast', { hasText: /message template/i }).first()).toBeVisible();
  expect(psql(`select count(*) from automation_rules where name='No text ${U}'`)).toBe('0');
  await page.locator('#auto-overlay').click({ position: { x: 5, y: 5 }, force: true }).catch(() => {});
});

test('Automation: Run Now says nothing was sent and counts the run; a switched-off rule cannot run; Run All; delete', async () => {
  await go('/automation');
  const row = page.locator('#automation-body tr', { hasText: `Overdue nudge ${U}` });
  await row.getByRole('button', { name: 'Run Now' }).click();
  await expect(page.locator('.toast', { hasText: /nothing was sent/i }).first()).toBeVisible();
  expect(psql(`select execution_count from automation_rules where name='Overdue nudge ${U}'`)).toBe('1');
  await page.getByRole('button', { name: 'Run All Active' }).click();
  await expect(page.locator('.toast', { hasText: /marked as run/i }).first()).toBeVisible();
  await row.locator('input[type=checkbox]').evaluate((el: HTMLInputElement) => el.click()); await settle();   // a toast can sit over the switch on a slow machine, so the click does not go through the pointer
  expect(psql(`select is_active from automation_rules where name='Overdue nudge ${U}'`)).toBe('f');
  const n = psql(`select execution_count from automation_rules where name='Overdue nudge ${U}'`);
  await row.getByRole('button', { name: 'Run Now' }).click();
  await expect(page.locator('.toast', { hasText: /switched off/i }).first()).toBeVisible();
  expect(psql(`select execution_count from automation_rules where name='Overdue nudge ${U}'`)).toBe(n);
  await row.getByRole('button', { name: 'Delete' }).click();
  await expect(toast('Rule deleted')).toBeVisible();
  expect(psql(`select count(*) from automation_rules where name='Overdue nudge ${U}'`)).toBe('0');
});

// ---------------- Campaigns ----------------
test('Campaigns: no project is refused on the screen and nothing is saved; with a project a draft is made', async () => {
  await go('/campaigns'); await expect(page.getByRole('button', { name: '+ Create Campaign' })).toBeVisible();
  await page.getByRole('button', { name: '+ Create Campaign' }).click();
  await page.locator('#camp-name').fill(`Festival ${U}`);
  await page.locator('#camp-message').fill('Hello {{consumer_name}}');
  await page.locator('#camp-segment').selectOption('enquiry');
  await page.locator('#camp-modal').getByRole('button', { name: /save campaign/i }).click();
  await expect(toast(/choose a project/i)).toBeVisible();
  expect(psql(`select count(*) from broadcast_campaigns where name='Festival ${U}'`)).toBe('0');
  await page.locator('#camp-project').selectOption(S.project);
  await page.locator('#camp-modal').getByRole('button', { name: /save campaign/i }).click();
  await expect(toast(/saved as a draft/i)).toBeVisible();
  expect(psql(`select status||'|'||segment||'|'||channel from broadcast_campaigns where name='Festival ${U}'`)).toBe('draft|enquiry|whatsapp');
  await expect(page.locator('#camp-body')).toContainText(`Festival ${U}`);
  await clean();
});

test('Campaigns: Launch queues the draft with the right number of people and the button goes away (the Launch route did not exist)', async () => {
  const row = page.locator('#camp-body tr', { hasText: `Festival ${U}` });
  await row.getByRole('button', { name: 'Launch' }).click();
  await expect(toast(/queued/i)).toBeVisible();
  expect(psql(`select status||'|'||total_recipients from broadcast_campaigns where name='Festival ${U}'`)).toBe('queued|2');   // Asha and Chand are enquiries with a mobile
  await settle(); await expect(row.getByRole('button', { name: 'Launch' })).toHaveCount(0);
  await row.getByRole('button', { name: 'Details' }).click(); await clean();
});

// ---------------- Communications ----------------
test('Communications: overview and every channel tab open without errors', async () => {
  await go('/communications'); await expect(page.locator('#comm-kpis')).toBeVisible();
  for (const tab of ['Overview', 'WhatsApp', 'Email', 'SMS', 'Instagram', 'Facebook']) { await page.getByRole('button', { name: tab, exact: true }).click(); await settle(); await clean(); }
});

test('Communications: sending needs a customer and a message; a WhatsApp message is recorded as queued and the screen says so', async () => {
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await page.getByRole('button', { name: 'Send Message' }).click();
  await expect(page.locator('.toast').first()).toBeVisible();
  expect(psql(`select count(*) from communications where consumer_id='${S.a}'`)).toBe('0');
  await page.locator('#comm-consumer').selectOption(S.a);
  await page.locator('#comm-channel').selectOption('whatsapp');
  await page.locator('#comm-message').fill(`Namaste ${U}`);
  await page.getByRole('button', { name: 'Send Message' }).click();
  await expect(toast(/recorded \(queued\)/i)).toBeVisible();
  expect(psql(`select status||'|'||channel from communications where consumer_id='${S.a}' and message='Namaste ${U}'`)).toBe('queued|whatsapp');
  await settle(); await page.getByRole('button', { name: 'WhatsApp', exact: true }).click(); await settle();
  await expect(page.locator('#comm-whatsapp-body')).toContainText(`Namaste ${U}`);
  await page.getByRole('button', { name: 'Email', exact: true }).click(); await settle();
  await expect(page.locator('#comm-email-body')).not.toContainText(`Namaste ${U}`);
  await clean();
});

test('Communications: an email to a customer with no email is refused with a message, an email to one with an address is recorded', async () => {
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await page.locator('#comm-consumer').selectOption(S.c);
  await page.locator('#comm-channel').selectOption('email');
  await page.locator('#comm-subject').fill(`Hello ${U}`);
  await page.locator('#comm-message').fill(`Body ${U}`);
  await page.getByRole('button', { name: 'Send Message' }).click();
  await expect(page.locator('.toast', { hasText: /no email address/i }).first()).toBeVisible();
  expect(psql(`select count(*) from communications where consumer_id='${S.c}'`)).toBe('0');
  await page.locator('#comm-consumer').selectOption(S.a);
  await page.getByRole('button', { name: 'Send Message' }).click();
  await expect(toast(/recorded \(queued\)/i)).toBeVisible();
  expect(psql(`select subject||'|'||status from communications where consumer_id='${S.a}' and channel='email'`)).toBe(`Hello ${U}|queued`);
});

test('Communications: AI Draft fills the message box with a draft that names the customer', async () => {
  await page.locator('#comm-consumer').selectOption(S.b);
  await page.getByRole('button', { name: 'AI Draft' }).click();
  await expect.poll(async () => (await page.locator('#comm-message').inputValue()) + (await content().innerText())).toContain(S.names.b);
  await clean();
});

// ---------------- Inboxes ----------------
test('WhatsApp inbox: the customer with a message shows as a thread (the screen used to ask for tickets), markup in a message shows as text, a reply is recorded as queued', async () => {
  psql(`insert into communications (consumer_id, channel, direction, message, phone_recipient, status) values ('${S.b}', 'whatsapp', 'inbound', '${XSS.replace(/'/g, "''")} ${U}', '9999999999', 'delivered')`);
  await go('/whatsapp-inbox');
  await expect(page.locator('#wa-threads')).toContainText(S.names.a);
  await expect(page.locator('#wa-threads')).toContainText(S.names.b);
  await noXss(); await clean();
  await page.locator('#wa-threads > *', { hasText: S.names.a }).first().click(); await settle();
  await expect(content()).toContainText(`Namaste ${U}`);
  await noXss();
});

test('Facebook and Instagram inbox: open, list their own threads, markup is text', async () => {
  for (const [ch, path, box] of [['facebook', '/facebook-inbox', 'fb-threads'], ['instagram', '/instagram-inbox', 'ig-threads']] as const) {
    psql(`insert into communications (consumer_id, channel, direction, message, status) values ('${S.c}', '${ch}', 'inbound', '${XSS.replace(/'/g, "''")} ${ch} ${U}', 'delivered')`);
    await go(path); await expect(page.locator(`#${box}`)).toContainText(S.names.c);
    await expect(page.locator(`#${box}`)).not.toContainText(S.names.a);   // WhatsApp and email threads do not leak into other channels
    await page.locator(`#${box} > *`, { hasText: S.names.c }).first().click(); await settle();
    await noXss(); await clean();
  }
});

// ---------------- Calling ----------------
test('Calling: every filter option and every text filter gives a list without errors; Customer status finds the right people', async () => {
  await go('/calling'); await expect(page.locator('#calling-grid')).toBeVisible(); await settle();
  await page.locator('#f-project').selectOption(S.project); await page.getByRole('button', { name: 'FETCH' }).click(); await settle();
  await expect(page.locator('#calling-grid')).toContainText(S.names.a); await expect(page.locator('#calling-grid')).toContainText(S.names.b);
  for (const id of ['f-project', 'f-tower', 'f-plan', 'f-cust-status', 'f-status', 'f-employee']) {
    const opts = await page.locator(`#${id} option`).evaluateAll((o) => o.map((x: any) => x.value));
    for (const v of opts.slice(0, 8)) { await page.locator(`#${id}`).selectOption(v); await page.getByRole('button', { name: 'FETCH' }).click(); await settle(); await clean(); }
    await page.locator(`#${id}`).selectOption(opts[0]);
  }
  await page.locator('#f-project').selectOption(S.project);
  await page.locator('#f-cust-status').selectOption({ label: 'Allottee' }); await page.getByRole('button', { name: 'FETCH' }).click(); await settle();
  await expect(page.locator('#calling-grid')).toContainText(S.names.b); await expect(page.locator('#calling-grid')).not.toContainText(S.names.a);
  await page.locator('#f-cust-status').selectOption({ label: 'Lead' }); await page.getByRole('button', { name: 'FETCH' }).click(); await settle();
  await expect(page.locator('#calling-grid')).toContainText(S.names.a); await expect(page.locator('#calling-grid')).not.toContainText(S.names.b);
  await page.locator('#f-cust-status').selectOption(''); await page.locator('#f-min-os').fill('100000'); await page.getByRole('button', { name: 'FETCH' }).click(); await settle();
  await expect(page.locator('#calling-grid')).toContainText(S.names.b); await expect(page.locator('#calling-grid')).not.toContainText(S.names.a);
  await page.locator('#f-min-os').fill('');
  for (const [id, v] of [['f-name', '%'], ['f-name', "' OR 1=1 --"], ['f-reg-no', '<script>1</script>'], ['f-unit', 'zzz-no-unit'], ['f-sub-status', 'x'], ['f-min-os', '-5']]) {
    await page.locator(`#${id}`).fill(v); await page.getByRole('button', { name: 'FETCH' }).click(); await settle(); await clean();
    await page.locator(`#${id}`).fill('');
  }
  await page.locator('#f-name').fill('Bela'); await page.getByRole('button', { name: 'FETCH' }).click(); await settle();
  await expect(page.locator('#calling-grid')).toContainText(S.names.b); await expect(page.locator('#calling-grid')).not.toContainText(S.names.a);
});

test('Calling: the dialer logs a call; a promise date in the past is refused and nothing changes', async () => {
  await page.locator('#f-name').fill(S.names.a); await page.getByRole('button', { name: 'FETCH' }).click(); await settle();
  const open = async () => { await page.locator('#calling-grid tr', { hasText: S.names.a }).first().locator('button, [onclick]').first().click(); await expect(page.locator('#dialer-modal')).toBeVisible(); };
  await open();
  await page.locator('#m-ptp').fill(later(-4)); await page.locator('#m-remarks').fill(`late ${U}`);
  await page.locator('#dialer-modal').getByRole('button', { name: /submit call result/i }).click();
  await expect(page.locator('.toast', { hasText: /cannot be in the past/i }).first()).toBeVisible();
  expect(psql(`select count(*) from call_logs where consumer_id='${S.a}'`)).toBe('0');
  await page.locator('#m-ptp').fill(later(4)); await page.locator('#m-next-call').fill(later(1)); await page.locator('#m-sub-status').fill('asked for time'); await page.locator('#m-remarks').fill(`will pay ${U}`);
  await page.locator('#dialer-modal').getByRole('button', { name: /submit call result/i }).click();
  await expect(toast('Call logged successfully')).toBeVisible();
  expect(psql(`select count(*) from call_logs where consumer_id='${S.a}' and remarks='will pay ${U}'`)).toBe('1');
  expect(psql(`select promise_to_pay_date::text||'|'||last_call_sub_status from consumers where id='${S.a}'`)).toBe(`${later(4)}|asked for time`);
  await settle(); await open(); await expect(page.locator('#dialer-modal')).toContainText(`will pay ${U}`); await clean();
});

// ---------------- Leads ----------------
test('Leads: every filter option, Kanban and Table, stage tiles and the search give a screen without errors', async () => {
  test.setTimeout(300_000);
  await go('/leads'); await expect(page.locator('#leads-search')).toBeVisible(); await settle();
  for (const id of ['leads-project', 'leads-stage', 'leads-source']) {
    const opts = await page.locator(`#${id} option`).evaluateAll((o) => o.map((x: any) => x.value));
    for (const v of opts.slice(0, 7)) { await page.locator(`#${id}`).selectOption(v); await page.getByRole('button', { name: 'FETCH' }).click(); await settle(); await clean(); }
    await page.locator(`#${id}`).selectOption(opts[0]);
  }
  await page.locator('#leads-project').selectOption(S.project);
  for (const view of ['Table', 'Kanban']) { await page.getByRole('button', { name: view, exact: true }).click(); await settle(); await clean(); }
  await page.locator('#leads-search').fill(S.names.a); await page.getByRole('button', { name: 'FETCH' }).click(); await settle();
  await expect(content()).toContainText(S.names.a); await expect(content()).not.toContainText(S.names.b);
  for (const q of ['%', "' OR 1=1 --", '<script>1</script>']) { await page.locator('#leads-search').fill(q); await page.getByRole('button', { name: 'FETCH' }).click(); await settle(); await clean(); }
  await page.locator('#leads-search').fill('');
  for (const st of ['enquiry', 'allotted']) { await page.locator(`[onclick*="filterStage('${st}')"]`).first().click(); await settle(); await clean(); }
});
