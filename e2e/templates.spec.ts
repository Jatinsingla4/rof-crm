// Documents > Templates: a letter template is made and changed on the screen (the New Template button used to say "contact admin").
import { test, expect, Page } from '@playwright/test';
import { autoAsk } from './_ask';

const PASSWORD = 'Test#Pass1234';
const U = Date.now().toString(36).slice(-5);
test.describe.configure({ mode: 'serial' });
let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  await autoAsk(page);
  await page.goto('/pages/login.html');
  await page.locator('input[type=email]').fill('super_admin@test.local');
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.locator('button[type=submit]').click();
  await page.waitForURL(/#\/dashboard/);
  await page.evaluate(() => { location.hash = '#/documents'; });
  await page.locator('[data-tab="templates"]').click();
});
test.afterAll(async () => { await page.close(); });

test('New Template: needs a name and a text, then the template is listed with its type', async () => {
  await page.getByRole('button', { name: '+ New Template' }).click();
  await expect(page.locator('#tpl-overlay')).toBeVisible();
  await page.locator('#tpl-save').click();
  await expect(page.locator('.toast', { hasText: /template name/i }).first()).toBeVisible();
  await page.locator('#tpl-name').fill(`NOC ${U}`);
  await page.locator('#tpl-type').selectOption('noc');
  await page.locator('#tpl-body').fill('<p>No objection for {{consumerName}}, unit {{unitNumber}}</p>');
  await page.locator('#tpl-save').click();
  await expect(page.locator('#tpl-overlay')).toHaveCount(0);
  await expect(page.locator('#doc-templates-body tr', { hasText: `NOC ${U}` })).toBeVisible();
  await expect(page.locator('#doc-templates-body tr', { hasText: `NOC ${U}` })).toContainText(/noc/i);
});

test('Edit: the text comes back in the box, a change is saved, the type cannot be changed', async () => {
  const row = page.locator('#doc-templates-body tr', { hasText: `NOC ${U}` });
  await row.getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('#tpl-body')).toHaveValue(/No objection for/);
  await expect(page.locator('#tpl-type')).toBeDisabled();
  await page.locator('#tpl-name').fill(`NOC ${U} v2`);
  await page.locator('#tpl-save').click();
  await expect(page.locator('#doc-templates-body tr', { hasText: `NOC ${U} v2` })).toBeVisible();
});

test('markup in the letter text is kept as text in the editor box, not run', async () => {
  await page.getByRole('button', { name: '+ New Template' }).click();
  await page.locator('#tpl-name').fill(`Markup ${U}`);
  await page.locator('#tpl-type').selectOption('welcome_letter');
  await page.locator('#tpl-body').fill('<b>hello</b><img src=x onerror="window.__tplxss=1">');
  await page.locator('#tpl-save').click();
  await expect(page.locator('#doc-templates-body tr', { hasText: `Markup ${U}` })).toBeVisible();
  await page.locator('#doc-templates-body tr', { hasText: `Markup ${U}` }).getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('#tpl-body')).toHaveValue(/<b>hello<\/b>/);
  expect(await page.evaluate(() => (window as any).__tplxss)).toBeUndefined();
  await page.locator('#tpl-overlay button', { hasText: 'Cancel' }).click();
});
