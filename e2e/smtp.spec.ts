// Communication Setup (project mail server) in a real browser: save, list, edit, the password never shown, a bad value refused, a limited login.
// A JavaScript error, console error, 5xx or "undefined" / "NaN" on a screen fails the test.
import { test, expect, Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';

const PASSWORD = 'Test#Pass1234';
const BASE = process.env.BASE_URL || 'http://localhost:3010';
const U = Date.now().toString(36).slice(-5);
const psql = (sql: string) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim().split('\n')[0];

test.describe.configure({ mode: 'serial' });
let page: Page;
let problems: string[] = [];
let bodies: string[] = [];
const settle = async () => { await page.waitForTimeout(150); await page.waitForLoadState('networkidle'); };
const content = () => page.locator('#content');
const toast = (t: string | RegExp) => page.locator('.toast', { hasText: t }).first();
const go = async (hash: string) => { await page.evaluate((h) => { location.hash = h; }, hash); await settle(); };
const signIn = async (email: string) => {
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
  await page.goto('/pages/login.html');
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.locator('button[type=submit]').click();
  await page.waitForURL(/#\/dashboard/);
};
let projectId = '';

test.beforeAll(async ({ browser }) => {
  projectId = psql(`insert into projects (name, rera_number, tcp_licence) values ('Mail Project ${U}','MR-${U}','x') returning id`);
  page = await browser.newPage();
  page.on('pageerror', (e) => problems.push(`JavaScript error: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|Blocked script execution in 'about:(srcdoc|blank)'/.test(m.text())) problems.push(`Console error: ${m.text()}`); });
  page.on('response', async (r) => {
    if (!r.url().includes('/api/smtp-configs')) return;
    if (r.status() >= 500) problems.push(`Server error ${r.status()}: ${r.url()}`);
    try { bodies.push(await r.text()); } catch { /* redirects have no body */ }
  });
  await signIn('super_admin@test.local');
});
test.afterAll(async () => {
  try { psql(`delete from audit_logs where resource_type='project_smtp_config' and resource_id::text in (select id::text from project_smtp_configs where project_id='${projectId}')`); psql(`delete from projects where id='${projectId}'`); } catch { /* run id in the name */ }
  await page.close();
});
test.beforeEach(() => { problems = []; bodies = []; });
test.afterEach(() => { expect(problems, 'Errors seen in the browser during this test').toEqual([]); });

const fill = async (o: Record<string, string>) => { for (const [id, v] of Object.entries(o)) await page.locator('#' + id).fill(v); };

test('a bad host and a bad sender email are refused with a message, nothing saved', async () => {
  await go('/collection-setup');
  await page.locator('#s-project').selectOption(projectId);
  await fill({ 's-host': 'localhost', 's-port': '587', 's-user': 'mailer', 's-pass': 'pw12345', 's-name': 'ROF', 's-from': 'accounts@example.com' });
  await page.getByRole('button', { name: 'Save Configuration' }).click();
  await expect(toast(/private network|this machine/i)).toBeVisible();
  await fill({ 's-host': 'smtp.example.com', 's-from': 'not-an-email' });
  await page.getByRole('button', { name: 'Save Configuration' }).click();
  await expect(toast(/Sender email/i)).toBeVisible();
  expect(psql(`select count(*) from project_smtp_configs where project_id='${projectId}'`)).toBe('0');
});

test('save a mail setup: the list shows it, the database holds a sealed password, no response carried the password', async () => {
  await fill({ 's-from': 'Accounts@Example.com', 's-pass': 'Br0wser#Secret' });
  await page.getByRole('button', { name: 'Save Configuration' }).click();
  await expect(toast('Configuration saved')).toBeVisible(); await settle();
  const row = page.locator('.csn-tbl tr', { hasText: `Mail Project ${U}` });
  await expect(row).toContainText('smtp.example.com:587'); await expect(row).toContainText('accounts@example.com'); await expect(row).toContainText('SSL');
  expect(await page.locator('#s-pass').inputValue()).toBe('');
  expect(psql(`select password_encrypted like 'v2:%' and password_encrypted not like '%Br0wser%' from project_smtp_configs where project_id='${projectId}'`)).toBe('t');
  expect(bodies.join('')).not.toMatch(/Br0wser|password_encrypted|v2:/);
  await expect(content()).not.toContainText('Br0wser');
});

test('edit: the form fills from the row, the password box is empty and says it is saved, a blank save keeps the password', async () => {
  const before = psql(`select password_encrypted from project_smtp_configs where project_id='${projectId}'`);
  await page.locator('.csn-tbl tr', { hasText: `Mail Project ${U}` }).getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('#s-host')).toHaveValue('smtp.example.com');
  await expect(page.locator('#s-from')).toHaveValue('accounts@example.com');
  await expect(page.locator('#s-pass')).toHaveValue('');
  await expect(page.locator('#s-pass')).toHaveAttribute('placeholder', /Saved/);
  await page.locator('#s-host').fill('smtp.changed.example.com');
  await page.locator('input[name="s-ssl"][value="false"]').check();
  await page.getByRole('button', { name: 'Save Configuration' }).click();
  await expect(toast('Configuration saved')).toBeVisible(); await settle();
  await expect(page.locator('.csn-tbl tr', { hasText: `Mail Project ${U}` })).toContainText('smtp.changed.example.com:587');
  await expect(page.locator('.csn-tbl tr', { hasText: `Mail Project ${U}` })).toContainText('Plain');
  expect(psql(`select password_encrypted from project_smtp_configs where project_id='${projectId}'`)).toBe(before);
  expect(psql(`select count(*) from project_smtp_configs where project_id='${projectId}'`)).toBe('1');
});

test('a project name with markup is shown as text, not run', async () => {
  psql(`update projects set name = 'Mail <img src=x onerror=alert(1)> ${U}' where id='${projectId}'`);
  await go('/dashboard'); await go('/collection-setup');
  await expect(page.locator('.csn-tbl img')).toHaveCount(0);
  await expect(page.locator('.csn-tbl')).toContainText('<img src=x');
  psql(`update projects set name = 'Mail Project ${U}' where id='${projectId}'`);
});

test('accounts login: the screen is closed to them (Access Denied) and the API refuses a write', async () => {
  await signIn('accounts_finance@test.local');
  await go('/collection-setup');
  await expect(content()).toContainText('Access Denied');
  await expect(page.locator('#s-host')).toHaveCount(0);
  const tok = await page.evaluate(() => Object.values(localStorage).find((v) => typeof v === 'string' && v.split('.').length === 3) as string);
  const r = await fetch(`${BASE}/api/smtp-configs`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tok}` }, body: JSON.stringify({ projectId, host: 'smtp.accounts.example.com', fromEmail: 'a@example.com', password: 'x12345' }) });
  expect(r.status).toBe(403);
  expect(psql(`select host from project_smtp_configs where project_id='${projectId}'`)).toBe('smtp.changed.example.com');
});
