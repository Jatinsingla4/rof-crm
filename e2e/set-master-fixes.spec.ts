// Browser checks for the Set Master audit fixes: document stage "On Transfer" (SM-005), area type usage (SM-001),
// the dispatch date control (SM-015), and the cache and error banner (SM-014). Own data, removed at the end.
// The CRM must be running (BASE_URL); psql must reach the same database (PG* variables), as in the other specs.
import { test, expect, Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';

declare const Api: any; // the page's own API helper (a global of the CRM page, used inside page.evaluate)
const PASSWORD = 'Test#Pass1234';
const U = Date.now().toString(36).slice(-5);
const psql = (sql: string) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' }).trim();

test.describe.configure({ mode: 'serial' });
let page: Page;
let projectId = '';
const docName = `E2E Transfer Doc ${U}`, areaName = `E2E Area ${U}`, bankName = `E2E Cache Bank ${U}`;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  projectId = psql(`insert into projects (name, rera_number, tcp_licence) values ('E2E SMFIX ${U}','R${U}','T${U}') returning id`).split('\n')[0];
  await page.goto('/pages/login.html');
  await page.locator('input[type=email]').fill('super_admin@test.local');
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.locator('button[type=submit]').click();
  await page.waitForURL(/#|index|\/$/);
});
test.afterAll(async () => {
  try { psql(`delete from document_types where name='${docName}'; delete from unit_types where project_id='${projectId}'; delete from banks where name='${bankName}'; delete from area_types where name='${areaName}'; delete from projects where id='${projectId}'`); } catch {}
  await page.close();
});

const content = () => page.locator('#content');
const drawer = () => page.locator('#sm-drawer-host aside[role=dialog]');
const toast = (text: string | RegExp) => page.locator('.toast', { hasText: text }).first();
const go = (hash: string) => page.evaluate((h) => { location.hash = h; }, hash);
const rowOf = (text: string) => content().locator('tr').filter({ hasText: text }).first();

test('SM-005: a document with stage On Transfer can be created, shown, opened and saved without losing its stage', async () => {
  await go('#/set-master?screen=checklist');
  await content().getByRole('button', { name: 'Add document' }).click();
  await drawer().locator('[name=name]').fill(docName);
  await expect(drawer().locator('[name=required_at] option', { hasText: 'On Transfer' })).toHaveCount(1);
  await drawer().locator('[name=required_at]').selectOption('On Transfer');
  await drawer().locator('button[type=submit]').click();
  await expect(toast('Document added')).toBeVisible();
  await expect(rowOf(docName)).toContainText('On Transfer');
  await rowOf(docName).hover();
  await rowOf(docName).getByRole('button', { name: 'Edit' }).click();
  await expect(drawer().locator('[name=required_at]')).toHaveValue('On Transfer');
  await drawer().locator('[name=description]').fill('edited');
  await drawer().locator('button[type=submit]').click();
  await expect(toast('Saved')).toBeVisible();
  await expect(rowOf(docName)).toContainText('On Transfer');
});

test('SM-001: an area type that a unit type uses shows its count, cannot be deleted, and the server refuses a rename', async () => {
  psql(`insert into area_types (name) values ('${areaName}')`);
  psql(`insert into unit_types (project_id, name, unit_of_measurement) values ('${projectId}','E2E UT ${U}','${areaName}')`);
  await go('#/set-master?screen=lists&list=areaTypes');
  await page.evaluate(() => { (window as any).SM.loadedAt = 0; });
  await go('#/set-master?screen=banks'); await go('#/set-master?screen=lists&list=areaTypes');
  const row = rowOf(areaName);
  await expect(row).toContainText('1 record');
  await row.hover();
  await expect(row.getByRole('button', { name: 'Delete', exact: true })).toBeDisabled();
  await row.getByRole('button', { name: 'Edit' }).click();
  await drawer().locator('[name=name]').fill(`${areaName} renamed`);
  await drawer().locator('button[type=submit]').click();
  await expect(drawer().locator('#sm-form-err')).toContainText('is used on 1 record');
  await drawer().getByRole('button', { name: 'Cancel' }).click();
  psql(`delete from unit_types where project_id='${projectId}'`);
  await page.evaluate(() => { (window as any).SM.loadedAt = 0; });
  await go('#/set-master?screen=banks'); await go('#/set-master?screen=lists&list=areaTypes');
  await expect(rowOf(areaName).getByRole('button', { name: 'Delete', exact: true })).toBeEnabled();
});

test('SM-015: the dispatch edit form has a date picker and keeps the future-date rule', async () => {
  await page.evaluate(async () => { await Api.post('/master/document-dispatch', { document_type: 'E2E notice', dispatch_mode: 'Email', tracking_no: 'E2ETRK' }); });
  await go('#/set-master?screen=dispatch');
  await page.locator('#df-q').fill('E2ETRK'); await page.locator('#df-go').click();
  await rowOf('E2ETRK').hover();
  await rowOf('E2ETRK').getByRole('button', { name: 'Edit' }).click();
  await expect(drawer().locator('[name=dispatched_at]')).toHaveAttribute('type', 'date');
  await drawer().locator('[name=dispatched_at]').fill('2999-01-01');
  await drawer().locator('button[type=submit]').click();
  await expect(drawer().locator('#sm-form-err')).toContainText('future');
  await drawer().getByRole('button', { name: 'Cancel' }).click();
  await page.evaluate(async () => { const rows = (await Api.get('/master/document-dispatch', { params: { q: 'E2ETRK' } })).data; for (const r of rows) await Api.delete('/master/document-dispatch/' + r.id); });
});

test('SM-014: data older than the cache time is reloaded, and the load-error banner goes away once the data loads', async () => {
  // cache expiry: a bank added behind the screen's back shows up once the cache time has passed
  await go('#/set-master?screen=banks');
  await expect(content()).toContainText('Banks');
  const cacheMs = await page.evaluate(() => (window as any).SM.CACHE_MS);
  expect(cacheMs).toBeLessThanOrEqual(10000);
  await page.evaluate(async (n) => { await Api.post('/master/banks', { name: n }); }, bankName);
  await page.evaluate(() => { (window as any).SM.loadedAt = Date.now() - 20000; });
  await go('#/set-master?screen=locations'); await go('#/set-master?screen=banks');
  await expect(rowOf(bankName)).toBeVisible();
  // error recovery: the banks request fails once, the banner appears, the next full load clears it
  let failed = false;
  await page.route('**/api/master/banks', async (route) => { if (!failed) { failed = true; await route.abort(); } else await route.continue(); });
  await page.evaluate(() => { (window as any).SM.loadedAt = 0; });
  await go('#/set-master?screen=locations');
  await expect(content()).toContainText('Some data could not be loaded');
  await page.evaluate(() => { (window as any).SM.loadedAt = 0; });
  await go('#/set-master?screen=banks');
  await expect(rowOf(bankName)).toBeVisible();
  await expect(content()).not.toContainText('Some data could not be loaded');
  // a single reload of one list also clears its own failure
  await page.evaluate(() => { const S = (window as any).SM; S.failed = ['/master/banks']; });
  await page.evaluate(async () => { await (window as any).SM.reload('banks'); });
  await expect(content()).not.toContainText('Some data could not be loaded');
});
