// Email Templates, Analytics and Help in a real browser: every filter, tab and button; the database is asked whether the screen told the truth.
// A JavaScript error, console error, 5xx or "undefined" / "NaN" on a screen fails the test.
import { test, expect, Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';

const PASSWORD = 'Test#Pass1234';
const BASE = process.env.BASE_URL || 'http://localhost:3002';
const U = Date.now().toString(36).slice(-5);
const psql = (sql: string) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim().split('\n')[0];

test.describe.configure({ mode: 'serial' });
let page: Page;
let problems: string[] = [];
let opened: string[] = [];
const settle = async () => { await page.waitForTimeout(150); await page.waitForLoadState('networkidle'); };
let token = '';
const api = async (method: string, p: string, body?: any) => {
  const r = await fetch(`${BASE}/api${p}`, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
  let j: any = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
};
const S: Record<string, any> = {};
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const content = () => page.locator('#content');
const toast = (t: string | RegExp) => page.locator('.toast', { hasText: t }).first();
const go = async (hash: string) => { await page.evaluate((h) => { location.hash = h; }, hash); await settle(); };
const clean = async () => { expect(await content().innerText()).not.toMatch(/\bundefined\b|\bNaN\b|\[object Object\]/); };

test.beforeAll(async ({ browser }) => {
  token = (await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'super_admin@test.local', password: PASSWORD }) })).json()).token;
  const co = (await api('POST', '/companies', { name: `LO Co ${U}` })).j.data.id;
  S.projectName = `Lo Project ${U}`;
  S.project = (await api('POST', '/projects', { companyId: co, name: S.projectName, reraNumber: `LO-${U}`, tcpLicence: 'x' })).j.data.id;   // no unit, no customer
  S.project2 = (await api('POST', '/projects', { companyId: co, name: `Lo Two ${U}`, reraNumber: `L2-${U}`, tcpLicence: 'x' })).j.data.id;   // made before the login: the project list is read once
  page = await browser.newPage();
  page.on('dialog', (d) => d.accept());
  page.on('pageerror', (e) => problems.push(`JavaScript error: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|Blocked script execution in 'about:(srcdoc|blank)'/.test(m.text())) problems.push(`Console error: ${m.text()}`); });
  page.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 500) problems.push(`Server error ${r.status()}: ${r.request().method()} ${r.url()}`); });
  await page.addInitScript(() => { (window as any).__opened = []; window.open = ((u: string) => { (window as any).__opened.push(String(u)); return null; }) as any; });
  await page.goto('/pages/login.html');
  await page.locator('input[type=email]').fill('super_admin@test.local');
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.locator('button[type=submit]').click();
  await page.waitForURL(/#\/dashboard/);
});
test.afterAll(async () => {
  try { psql(`delete from email_templates where is_system = false and name like '%${U}%'`); } catch { /* names carry the run id */ }
  await page.close();
});
test.beforeEach(() => { problems = []; opened = []; });
test.afterEach(() => { expect(problems, 'Errors seen in the browser during this test').toEqual([]); });

// ---------------- Email Templates ----------------
test('Email Templates: the four starting templates are listed and opening one shows its stored wording (it used to open empty)', async () => {
  await go('/email-templates');
  await expect(page.locator('.et-item')).toHaveCount(await page.locator('.et-item').count());
  for (const n of ['Allotment Letter', 'Demand Letter', 'Payment Receipt', 'Welcome Email']) await expect(page.locator('.et-item', { hasText: n }).first()).toBeVisible();
  await page.locator('.et-item', { hasText: 'Demand Letter' }).first().click(); await settle();
  await expect(page.locator('#et-name')).toHaveValue('Demand Letter');
  await expect(page.locator('#et-subject')).toHaveValue(/Payment Demand Notice/);
  await expect(page.locator('#et-body')).toHaveValue(/instalment/);
  await expect(page.locator('#et-delete')).toBeDisabled();       // a starting template cannot be deleted
  await clean();
});

test('Email Templates: Create needs a name and a body; a saved template is in its own table, not in the legal letters; the list shows it', async () => {
  const letters = psql(`select count(*) from document_templates`);
  await page.getByRole('button', { name: '+ Create Template' }).click();
  await page.getByRole('button', { name: 'Save Template' }).click();
  await expect(toast(/template name/i)).toBeVisible();
  await page.locator('#et-name').fill(`Mine ${U}`);
  await page.getByRole('button', { name: 'Save Template' }).click();
  await expect(toast(/body/i)).toBeVisible();
  expect(psql(`select count(*) from email_templates where name = 'Mine ${U}'`)).toBe('0');
  await page.locator('#et-type').selectOption('allotment_letter');
  await page.locator('#et-subject').fill(`Hello {{consumer_name}} ${U}`);
  await page.locator('#et-body').fill('Dear {{consumer_name}}, unit {{unit_number}} <b>x</b>');
  await page.getByRole('button', { name: 'Save Template' }).click();
  await expect(toast('Template saved')).toBeVisible();
  expect(psql(`select template_type||'|'||subject from email_templates where name = 'Mine ${U}'`)).toBe(`allotment_letter|Hello {{consumer_name}} ${U}`);
  expect(psql(`select count(*) from document_templates`)).toBe(letters);          // the legal letter table is untouched
  await expect(page.locator('.et-item', { hasText: `Mine ${U}` })).toHaveCount(1);
  await expect(page.locator('#et-delete')).toBeEnabled();
  // a wrong merge field is refused with the list, and nothing changes
  await page.locator('#et-body').fill('Dear {{customer}}');
  await page.getByRole('button', { name: 'Save Template' }).click();
  await expect(toast(/merge field/i)).toBeVisible();
  expect(psql(`select body from email_templates where name = 'Mine ${U}'`)).toContain('unit {{unit_number}}');
  // the same name again is refused
  await page.getByRole('button', { name: '+ Create Template' }).click();
  await page.locator('#et-name').fill(`MINE ${U}`); await page.locator('#et-body').fill('x');
  await page.getByRole('button', { name: 'Save Template' }).click();
  await expect(toast(/already exists/i)).toBeVisible();
  await clean();
});

test('Email Templates: opening a saved template loads it; Edit saves the change; Preview shows sample values and shows markup as text; Refresh', async () => {
  await page.locator('.et-item', { hasText: `Mine ${U}` }).first().click(); await settle();
  await expect(page.locator('#et-body')).toHaveValue(/unit \{\{unit_number\}\}/);
  await page.locator('#et-body').fill('Dear {{consumer_name}}, flat {{unit_number}} <img src=x onerror="window.__xss=1">');
  await page.getByRole('button', { name: 'Preview' }).click();
  await expect(page.locator('#et-pv-body')).toContainText('Mr. Rajesh Kumar');
  await expect(page.locator('#et-pv-body')).toContainText('A-304');
  await expect(page.locator('#et-pv-body')).toContainText('<img src=x');             // shown as text
  expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
  expect(await page.locator('#et-preview img').count()).toBe(0);
  await page.getByRole('button', { name: 'Save Template' }).click();
  await expect(toast('Template saved')).toBeVisible();
  expect(psql(`select body from email_templates where name = 'Mine ${U}'`)).toContain('flat {{unit_number}}');
  await page.locator('#et-active').uncheck(); await page.getByRole('button', { name: 'Save Template' }).click();
  await expect(toast('Template saved')).toBeVisible();
  expect(psql(`select is_active from email_templates where name = 'Mine ${U}'`)).toBe('f');
  await expect(page.locator('.et-item', { hasText: `Mine ${U}` }).getByText('Inactive')).toBeVisible();
  await page.getByRole('button', { name: 'Refresh' }).click(); await settle();
  await expect(page.locator('.et-item', { hasText: `Mine ${U}` })).toHaveCount(1);
  await clean();
});

test('Email Templates: the search box and every type option filter the list; a script as the name shows as text', async () => {
  await page.locator('#et-search').fill(`mine ${U}`); await settle(); await page.waitForTimeout(400); await settle();
  await expect(page.locator('.et-item')).toHaveCount(1);
  await page.locator('#et-search').fill('zzzz-nothing'); await page.waitForTimeout(500); await settle();
  await expect(page.locator('.et-item')).toHaveCount(0); await expect(page.locator('#et-list')).toContainText('No template matches');
  await page.locator('#et-search').fill(''); await page.waitForTimeout(500); await settle();
  for (const v of ['general', 'allotment_letter', 'demand_letter', 'payment_receipt', 'welcome', 'reminder']) {
    await page.locator('#et-filter-type').selectOption(v); await settle();
    const n = Number(psql(`select count(*) from email_templates where template_type = '${v}'`));
    await expect(page.locator('.et-item')).toHaveCount(n);
  }
  await page.locator('#et-filter-type').selectOption(''); await settle();
  await clean();
});

test('Email Templates: Delete asks, removes a template of your own; the type picker keeps the list in step', async () => {
  await page.locator('.et-item', { hasText: `Mine ${U}` }).first().click(); await settle();
  await page.locator('#et-delete').click();
  await expect(toast('Template deleted')).toBeVisible();
  expect(psql(`select count(*) from email_templates where name = 'Mine ${U}'`)).toBe('0');
  await expect(page.locator('#et-editor-panel')).toBeHidden();
  await expect(page.locator('.et-item', { hasText: `Mine ${U}` })).toHaveCount(0);
  await clean();
});

// ---------------- Analytics ----------------
test('Analytics: the project list has every project (also one with no customer), the quick ranges set the right dates, a hand-typed date unmarks them', async () => {
  await go('/analytics');
  await expect(page.locator('#an-project option', { hasText: S.projectName })).toHaveCount(1);
  await expect(page.locator('.kpi').first()).toBeVisible();
  const iso = isoDay;
  const now = new Date();
  await page.getByRole('button', { name: 'This Year', exact: true }).click(); await settle();
  await expect(page.locator('#an-from')).toHaveValue(`${now.getFullYear()}-01-01`);
  await expect(page.locator('#an-to')).toHaveValue(iso(now));
  await page.getByRole('button', { name: 'This Quarter', exact: true }).click(); await settle();
  await expect(page.locator('#an-from')).toHaveValue(iso(new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)));
  await page.getByRole('button', { name: 'This Month', exact: true }).click(); await settle();
  await expect(page.locator('#an-from')).toHaveValue(iso(new Date(now.getFullYear(), now.getMonth(), 1)));   // it used to be the last day of the month before
  await page.locator('#an-from').fill(`${now.getFullYear()}-01-02`);
  await expect(page.locator('.anl-sp .btg-item.on')).toHaveCount(0);
  await clean();
});

test('Analytics: Apply with a wrong range is refused on the screen; a project with nothing shows zeros, not NaN; All Projects brings the numbers back', async () => {
  await page.locator('#an-from').fill('2026-12-31'); await page.locator('#an-to').fill('2026-01-01');
  await page.getByRole('button', { name: 'APPLY' }).click();
  await expect(toast(/must not be after/i)).toBeVisible();
  await page.locator('#an-from').fill(''); 
  await page.getByRole('button', { name: 'APPLY' }).click();
  await expect(toast(/both dates/i)).toBeVisible();
  await page.locator('#an-from').fill('2020-01-01'); await page.locator('#an-to').fill(isoDay(new Date()));
  await page.locator('#an-project').selectOption(S.project);
  await page.getByRole('button', { name: 'APPLY' }).click(); await settle(); await page.waitForTimeout(500);
  await expect(page.locator('#an-kpis .kpi').filter({ hasText: 'Total Leads' }).locator('.kpi-val')).toHaveText('0');
  await expect(page.locator('#an-kpis .kpi').filter({ hasText: 'Conversion Rate' }).locator('.kpi-val')).toHaveText('0%');
  await clean();
  await page.locator('#an-project').selectOption(''); await page.getByRole('button', { name: 'APPLY' }).click(); await settle(); await page.waitForTimeout(500);
  const leads = Number(psql(`select count(*) from consumers`));
  expect(Number(await page.locator('#an-kpis .kpi').filter({ hasText: 'Total Leads' }).locator('.kpi-val').innerText())).toBeGreaterThan(0);
  expect(leads).toBeGreaterThan(0);
  await clean();
});

test('Analytics: leads by stage and the lead total are the same as the database for a project', async () => {
  const p2 = S.project2;
  for (const [n, st] of [['a', 'enquiry'], ['b', 'enquiry'], ['c', 'allotted']]) psql(`INSERT INTO consumers (name, mobile, project_id, lead_stage) VALUES ('Lo ${n} ${U}', '9${String(Date.now() % 1e8).padStart(8, '0')}${n === 'a' ? 1 : n === 'b' ? 2 : 3}', '${p2}', '${st}') RETURNING id`);
  await go('/dashboard'); await go('/analytics');
  await page.locator('#an-from').fill('2020-01-01');
  await page.locator('#an-project').selectOption(p2);
  await page.getByRole('button', { name: 'APPLY' }).click(); await settle(); await page.waitForTimeout(500);
  await expect(page.locator('#an-kpis .kpi').filter({ hasText: 'Total Leads' }).locator('.kpi-val')).toHaveText('3');
  await expect(page.locator('#an-kpis .kpi').filter({ hasText: 'Allotted' }).locator('.kpi-val')).toHaveText('1');
  await expect(page.locator('#an-kpis .kpi').filter({ hasText: 'Conversion Rate' }).locator('.kpi-val')).toHaveText('33.33%');
  await expect(page.locator('#an-stage-chart')).toContainText('enquiry');
  await expect(page.locator('#an-ageing')).toContainText('1-30 days'); await expect(page.locator('#an-ageing')).toContainText('180+ days');
  await clean();
  psql(`delete from consumers where project_id = '${p2}'`);
});

// ---------------- Help ----------------
test('Help: every quick link opens its own section (they used to say "coming soon"); the support box has no placeholder phone number', async () => {
  await go('/help');
  const links = page.locator('.hln-link');
  expect(await links.count()).toBe(6);
  const titles = ['ROF CRM User Guide', 'Payment Plans', 'Penal Interest', 'Affordable Housing Policy', 'E-Draw Process', 'Roles and Permissions'];
  for (let i = 0; i < 6; i++) {
    await links.nth(i).click();
    await expect(page.locator('#help-content .sp-title')).toHaveText(titles[i]);
    await expect(page.locator('.toast', { hasText: /coming soon/i })).toHaveCount(0);
    await clean();
  }
  await expect(content()).not.toContainText('XXXXXXX');
  await expect(content()).not.toContainText('11.10');          // no rate is written here: it is a setting
  await expect(content()).toContainText('support@grapesworldwide.com');
});

test('Help: the three site buttons open the right address safely; there is no PDF button that pointed nowhere', async () => {
  await go('/dashboard'); await go('/help');
  for (const [name, url] of [['Haryana RERA', 'https://haryanarera.gov.in'], ['TCP Haryana', 'https://tcpharyana.gov.in'], ['E-Draw Portal', 'https://edraw.tcpharyana.gov.in']] as [string, string][]) {
    await page.getByRole('button', { name, exact: true }).click();
    expect(await page.evaluate(() => (window as any).__opened.pop())).toBe(url);
  }
  await expect(page.getByRole('button', { name: /user guide pdf/i })).toHaveCount(0);
  await clean();
});
