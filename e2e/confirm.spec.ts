// The in-page question (Utils.ask / Utils.confirm) that replaced the browser's native confirm() box. A native box cannot be answered by some
// test tools and phones, so Cancel Receipt, Cancel Allotment and Surrender Restore looked as if they did nothing.
import { test, expect, Page } from '@playwright/test';

const PASSWORD = 'Test#Pass1234';
test.describe.configure({ mode: 'serial' });
let page: Page;
let native: string[] = [];

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  page.on('dialog', (d) => { native.push(d.message()); d.dismiss(); });   // any native box is a failure below
  await page.goto('/pages/login.html');
  await page.locator('input[type=email]').fill('super_admin@test.local');
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.locator('button[type=submit]').click();
  await page.waitForURL(/#\/dashboard/);
});
test.afterAll(async () => { await page.close(); });
test.beforeEach(() => { native = []; });

// Utils is a top-level const of the page (not a window property), so these run as page-scope source text
const ask = (message: string) => page.evaluate(`(() => { window.__answer = undefined; Utils.ask(${JSON.stringify(message)}).then((a) => { window.__answer = a; }); })()`);
const answer = () => page.evaluate(() => (window as any).__answer);

test('the question is a box in the page, with the message and two buttons, and no native dialog', async () => {
  await ask('Cancel this allotment?\nThis cannot be undone.');
  const box = page.locator('#rof-ask');
  await expect(box).toBeVisible();
  await expect(box.locator('[data-ask-msg]')).toContainText('Cancel this allotment?');
  await expect(box.locator('[data-ask-msg]')).toContainText('This cannot be undone.');
  await expect(page.locator('#rof-ask-cancel')).toBeFocused();   // the safe answer has the focus
  await page.locator('#rof-ask-ok').click();
  await expect(box).toHaveCount(0);
  expect(await answer()).toBe(true);
  expect(native).toEqual([]);
});

test('Cancel, Escape and a click outside the box answer no; Tab then Enter on OK answers yes', async () => {
  await ask('one'); await page.locator('#rof-ask-cancel').click(); await expect(page.locator('#rof-ask')).toHaveCount(0); expect(await answer()).toBe(false);
  await ask('two'); await page.keyboard.press('Escape'); await expect(page.locator('#rof-ask')).toHaveCount(0); expect(await answer()).toBe(false);
  await ask('three'); await page.waitForTimeout(700); await page.locator('#rof-ask').click({ position: { x: 5, y: 5 } }); await expect(page.locator('#rof-ask')).toHaveCount(0); expect(await answer()).toBe(false);
  await ask('four'); await page.keyboard.press('Tab'); await page.keyboard.press('Enter'); await expect(page.locator('#rof-ask')).toHaveCount(0); expect(await answer()).toBe(true);
  expect(native).toEqual([]);
});

test('the message is shown as text, never as markup', async () => {
  await ask('<img src=x onerror="window.__xss=1"><b>bold</b>');
  await expect(page.locator('#rof-ask [data-ask-msg]')).toContainText('<b>bold</b>');
  expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
  await page.locator('#rof-ask-cancel').click();
});

test('Utils.confirm runs its action on OK only; a second question replaces the first (it counts as no)', async () => {
  await page.evaluate(`(() => { window.__ran = 0; Utils.confirm('Run it?', () => { window.__ran++; }); })()`);
  await page.locator('#rof-ask-cancel').click();
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => (window as any).__ran)).toBe(0);
  await page.evaluate(`(() => { Utils.confirm('Run it?', () => { window.__ran++; }); })()`);
  await page.locator('#rof-ask-ok').click();
  await expect.poll(() => page.evaluate(() => (window as any).__ran)).toBe(1);
  await ask('first'); await ask('second');
  await expect(page.locator('#rof-ask')).toHaveCount(1);
  await expect(page.locator('#rof-ask [data-ask-msg]')).toHaveText('second');
  await page.locator('#rof-ask-ok').click();
  expect(native).toEqual([]);
});
