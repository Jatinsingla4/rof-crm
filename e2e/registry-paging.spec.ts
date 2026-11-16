// Registry screen: the "Consumer (Allotted)" dropdown reads every page of GET /consumers (E-11), in a real browser.
// The consumers API is answered by the test (synthetic data, no database set-up), so page sizes, repeated rows and a changing list can be played exactly.
// What is asserted is the number of UNIQUE consumers in the dropdown, not only that nobody appears twice.
import { test, expect, Page } from '@playwright/test';

const PASSWORD = 'Test#Pass1234';
let page: Page;
const SYN = Array.from({ length: 450 }, (_, i) => ({ id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, name: `Syn ${i}`, unit_number: `U${i}` }));   // pages of 200: 200 + 200 + 50

const opts = () => page.locator('#reg-consumer option');
const optValues = async () => (await opts().evaluateAll((els) => els.map((e) => (e as HTMLOptionElement).value))).filter(Boolean);
const open = async () => { await page.evaluate(() => { location.hash = '/dashboard'; }); await page.waitForLoadState('networkidle'); await page.evaluate(() => { location.hash = '/registry'; }); await page.waitForLoadState('networkidle'); };
// answer GET /api/consumers?... with rows(page), and the given total; after(page) runs once the answer is sent
const serve = (rows: (p: number) => any[], total: () => number, after?: (p: number) => void) =>
  page.route('**/api/consumers?*', (route) => {
    const p = Number(new URL(route.request().url()).searchParams.get('page'));
    const r = route.fulfill({ json: { success: true, data: rows(p), pagination: { page: p, pageSize: 200, total: total() } } });
    if (after) after(p);
    return r;
  });
const unserve = () => page.unroute('**/api/consumers?*');

test.describe.configure({ mode: 'serial' });
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  page.on('dialog', (d) => d.accept());
  await page.goto('/pages/login.html');
  await page.locator('input[type=email]').fill('super_admin@test.local');
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.locator('button[type=submit]').click();
  await page.waitForURL(/#\/dashboard/);
});
test.afterEach(async () => { await unserve(); });
test.afterAll(async () => { await page.close(); });

test('three pages (200 + 200 + 50): all 450 unique consumers, pages 1 to 3 asked in order, a last-page option can be picked', async () => {
  const asked: string[] = [];
  page.on('request', (r) => { const u = new URL(r.url()); if (u.pathname === '/api/consumers') asked.push(`${u.searchParams.get('page')}/${u.searchParams.get('pageSize')}/${u.searchParams.get('leadStage')}`); });
  await serve((p) => SYN.slice((p - 1) * 200, p * 200), () => SYN.length);
  await open();
  await expect.poll(async () => await opts().count()).toBe(451);       // placeholder + 450
  expect(new Set(await optValues()).size).toBe(450);
  expect(asked).toEqual(['1/200/allotted', '2/200/allotted', '3/200/allotted']);
  await page.locator('#reg-consumer').selectOption(SYN[449].id);
  expect(await page.locator('#reg-consumer').inputValue()).toBe(SYN[449].id);
  page.removeAllListeners('request');
});

test('a page that repeats consumers is listed once, and the repeats do not end the loop early: still 450 unique', async () => {
  // page 2 carries 60 consumers of page 1 again, so 460 rows arrive for a total of 450
  await serve((p) => p === 1 ? SYN.slice(0, 200) : p === 2 ? [...SYN.slice(200, 400), ...SYN.slice(0, 60)] : p === 3 ? SYN.slice(400) : [], () => 450);
  await open();
  await expect.poll(async () => await opts().count()).toBe(451);
  const values = await optValues();
  expect(new Set(values).size).toBe(450);
  expect(values.length).toBe(450);
});

test('the list changes while it is read (10 consumers added after page 1 shift page 2): every one of the original 450 is listed exactly once', async () => {
  const ds = [...SYN], added = Array.from({ length: 10 }, (_, i) => ({ id: `99999999-0000-4000-8000-${String(i).padStart(12, '0')}`, name: `New ${i}`, unit_number: 'N' }));
  await serve((p) => ds.slice((p - 1) * 200, p * 200), () => ds.length, (p) => { if (p === 1) ds.unshift(...added); });   // the API total then says 460
  await open();
  await expect.poll(async () => await opts().count()).toBeGreaterThan(1);
  await page.waitForTimeout(500);
  const values = await optValues();
  expect(values.length).toBe(450);                                      // the 450 seen; the 10 added after page 1 are not
  expect(new Set(values).size).toBe(450);
  expect(SYN.every((c) => values.includes(c.id))).toBe(true);
});

test('empty result: only the placeholder option, no error, the registry list still loads', async () => {
  await serve(() => [], () => 0);
  await open();
  await expect(page.locator('#reg-list-body table')).toBeVisible();
  expect(await opts().count()).toBe(1);
  await expect(page.locator('.toast-error')).toHaveCount(0);
});

test('page 2 fails: the error is shown and the dropdown is not half filled', async () => {
  await page.route('**/api/consumers?*', (route) => {
    const p = Number(new URL(route.request().url()).searchParams.get('page'));
    return p === 2 ? route.fulfill({ status: 500, json: { error: 'boom-page-2' } }) : route.fulfill({ json: { success: true, data: SYN.slice(0, 200), pagination: { page: p, pageSize: 200, total: 450 } } });
  });
  await open();
  await expect(page.locator('.toast-error').first()).toBeVisible();
  expect(await page.locator('.toast-error').first().innerText()).toMatch(/boom-page-2|Failed to load/);
  expect(await opts().count()).toBe(1);
});

test('no pagination block means one request; a total that is too high ends on an empty page', async () => {
  let n = 0;
  await page.route('**/api/consumers?*', (route) => { n++; return route.fulfill({ json: { success: true, data: [SYN[0]] } }); });
  await open();
  await expect.poll(async () => await opts().count()).toBe(2);
  expect(n).toBe(1);
  await unserve(); n = 0;
  await page.route('**/api/consumers?*', (route) => { n++; const p = Number(new URL(route.request().url()).searchParams.get('page')); return route.fulfill({ json: { success: true, data: p === 1 ? [SYN[0]] : [], pagination: { page: p, pageSize: 200, total: 5000 } } }); });
  await open();
  await expect.poll(async () => await opts().count()).toBe(2);
  expect(n).toBe(2);
});
