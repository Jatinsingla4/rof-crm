// Charge Master and Broker Tax Setup screens in a real browser: refused values show a message, good saves reach the database, markup is shown as text, a viewer is shut out.
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
let brokerId = '';
let rateBefore = '';
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

test.beforeAll(async ({ browser }) => {
  brokerId = psql(`insert into brokers (name, mobile, firm_name) values ('SR Browser Broker ${U}','9${String(Math.floor(100000000 + Math.random() * 899999999))}','Firm <b>${U}</b>') returning id`);
  rateBefore = psql(`select rate_value from charge_master_config where charge_key='balcony_charge'`);
  page = await browser.newPage();
  page.on('pageerror', (e) => problems.push(`JavaScript error: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|Blocked script execution in 'about:(srcdoc|blank)'/.test(m.text())) problems.push(`Console error: ${m.text()}`); });
  page.on('response', (r) => { if (r.status() >= 500) problems.push(`Server error ${r.status()}: ${r.url()}`); });
  await signIn('super_admin@test.local');
});
test.afterAll(async () => {
  try {
    psql(`update charge_master_config set rate_value=${rateBefore} where charge_key='balcony_charge'`);
    psql(`delete from audit_logs where resource_id::text in (select id::text from broker_tax_config where broker_id='${brokerId}')`);
    psql(`delete from broker_tax_config where broker_id='${brokerId}'`); psql(`delete from brokers where id='${brokerId}'`);
  } catch { /* run id in the name */ }
  await page.close();
});
test.beforeEach(() => { problems = []; });
test.afterEach(async () => {
  const text = await content().innerText().catch(() => '');
  expect(text, 'a screen showed undefined or NaN').not.toMatch(/\bundefined\b|\bNaN\b/);
  expect(problems, 'Errors seen in the browser during this test').toEqual([]);
});

test('charge master: a bad rate is refused with a message and the stored rate does not move', async () => {
  await go('/charge-master');
  const input = page.locator('input[id^="cm-rate-"]').first();
  await expect(input).toBeVisible();
  for (const bad of ['-5', '1.234', '2000000']) {
    await input.fill(bad);
    await page.getByRole('button', { name: 'SAVE' }).click();
    await expect(page.locator('#cm-msg')).toContainText(/Rate must be/);
  }
  expect(psql(`select rate_value from charge_master_config where charge_key='balcony_charge'`)).toBe(rateBefore);
});

test('charge master: a good rate with paise is saved, shown again after reload, and written to the audit log', async () => {
  const input = page.locator('input[id^="cm-rate-"]').first();
  await input.fill('123.45');
  await page.getByRole('button', { name: 'SAVE' }).click();
  await expect(page.locator('#cm-msg')).toContainText('Rate updated successfully');
  await settle();
  await expect(page.locator('input[id^="cm-rate-"]').first()).toHaveValue('123.45');
  expect(psql(`select rate_value from charge_master_config where charge_key='balcony_charge'`)).toBe('123.45');
  expect(psql(`select count(*) from audit_logs where resource_type='charge_master_config' and new_values->>'rate_value'='123.45'`)).not.toBe('0');
});

test('charge master: a charge name with markup is shown as text', async () => {
  psql(`update charge_master_config set charge_name='Balcony <img src=x onerror=alert(1)>' where charge_key='balcony_charge'`);
  try {
    await go('/dashboard'); await go('/charge-master');
    await expect(page.locator('.cm-table img')).toHaveCount(0);
    await expect(page.locator('.cm-table')).toContainText('<img src=x');
  } finally { psql(`update charge_master_config set charge_name='Balcony Charge' where charge_key='balcony_charge'`); }
});

test('broker setup: the new broker shows "Not set", a missing rate is stopped, a good save shows the rates, markup in the firm name is text', async () => {
  await go('/broker-setup');
  const row = page.locator(`tr[data-broker="${brokerId}"]`);
  await expect(row).toContainText('Not set');
  await expect(row.locator('b')).toHaveCount(0);
  await expect(row).toContainText(`Firm <b>${U}</b>`);
  await row.getByRole('button', { name: 'Edit' }).click();
  await page.locator('#bs-tds').fill('2');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(toast('Enter both rates')).toBeVisible();
  expect(psql(`select count(*) from broker_tax_config where broker_id='${brokerId}'`)).toBe('0');
  await page.locator('#bs-gst').fill('18.5');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(toast('Tax setup saved')).toBeVisible(); await settle();
  await expect(page.locator(`tr[data-broker="${brokerId}"]`)).toContainText('2%');
  await expect(page.locator(`tr[data-broker="${brokerId}"]`)).toContainText('18.5%');
  expect(psql(`select tds_rate_pct||'/'||gst_rate_pct from broker_tax_config where broker_id='${brokerId}'`)).toBe('2.00/18.50');
});

test('broker setup: a rate over 100 is refused with the server message and nothing changes', async () => {
  await page.locator(`tr[data-broker="${brokerId}"]`).getByRole('button', { name: 'Edit' }).click();
  await page.locator('#bs-tds').evaluate((el: HTMLInputElement) => { el.removeAttribute('max'); });
  await page.locator('#bs-tds').fill('150');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(toast(/TDS rate must be/)).toBeVisible();
  expect(psql(`select tds_rate_pct from broker_tax_config where broker_id='${brokerId}'`)).toBe('2.00');
});

test('read-only viewer: broker setup is closed (Access Denied) and the API refuses a rate change', async () => {
  await signIn('read_only_viewer@test.local');
  await go('/broker-setup');
  await expect(content()).toContainText('Access Denied');
  const tok = await page.evaluate(() => Object.values(localStorage).find((v) => typeof v === 'string' && v.split('.').length === 3) as string);
  const r = await fetch(`${BASE}/api/charge-master/config/balcony_charge`, { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: `Bearer ${tok}` }, body: JSON.stringify({ rate_value: 1 }) });
  expect(r.status).toBe(403);
  expect(psql(`select rate_value from charge_master_config where charge_key='balcony_charge'`)).toBe('123.45');
});
