import { autoAsk } from './_ask';
// Documents in a real browser: every tab of the Documents screen, History "Open", template Preview, applicant document upload and download,
// unit document upload; the database is asked whether the screen told the truth.
// A JavaScript error, console error, 5xx or "undefined" / "NaN" on a screen fails the test.
import { test, expect, Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const PASSWORD = 'Test#Pass1234';
const BASE = process.env.BASE_URL || 'http://localhost:3010';
const U = Date.now().toString(36).slice(-5);
const psql = (sql: string) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim().split('\n')[0];

test.describe.configure({ mode: 'serial' });
let page: Page;
let problems: string[] = [];
let token = '';
const S: Record<string, string> = {};
const settle = async () => { await page.waitForTimeout(150); await page.waitForLoadState('networkidle'); };
const content = () => page.locator('#content');
const toast = (t: string | RegExp) => page.locator('.toast', { hasText: t }).first();
const go = async (hash: string) => { await page.evaluate((h) => { location.hash = h; }, hash); await settle(); };
const clean = async () => { expect(await content().innerText()).not.toMatch(/\bundefined\b|\bNaN\b|\[object Object\]/); };
const api = async (method: string, p: string, body?: any) => {
  const r = await fetch(`${BASE}/api${p}`, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
  let j: any = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
};
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('browser-test-image-' + U)]);

test.beforeAll(async ({ browser }) => {
  token = (await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'super_admin@test.local', password: PASSWORD }) })).json()).token;
  const co = (await api('POST', '/companies', { name: `DC Co ${U}` })).j.data.id;
  S.projectName = `Doc Project ${U}`;
  S.project = (await api('POST', '/projects', { companyId: co, name: S.projectName, reraNumber: `DC-${U}`, tcpLicence: 'x' })).j.data.id;
  S.tower = (await api('POST', `/projects/${S.project}/towers`, { towerName: `DT${U}` })).j.data.id;
  S.unitNo = `DU-${U}`;
  S.unit = (await api('POST', '/units', { projectId: S.project, towerId: S.tower, unitNumber: S.unitNo, floor: 2, bhkType: '2BHK', carpetAreaSqft: 900, superAreaSqft: 1100, basePriceInr: 5000000, totalPriceInr: 5500000 })).j.data.id;
  S.company = co;
  S.name = `Doc Buyer ${U}`;
  S.consumer = (await api('POST', '/consumers', { name: S.name, mobile: '98' + String(Date.now()).slice(-8), project_id: S.project })).j.data.id;
  // a letter template and a generated document to look at (demand-letter shell needs no template)
  psql(`insert into document_templates (name, document_type, body_html) values ('DC template ${U}', 'payment_receipt', $q$<html><body><p>${'x'.repeat(100)}</p><b>Preview words ${U}</b><script>window.__ran=1</script></body></html>$q$)`);
  S.doc = (await api('POST', '/documents/generate', { consumerId: S.consumer, documentType: 'check_list' })).j?.data?.documentId;
  page = await browser.newPage();
  page.on('dialog', (d) => d.accept());
  await autoAsk(page);
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
  const c = S.consumer, rm = (q: string) => { try { psql(q); } catch { /* names carry the run id */ } };
  rm(`delete from audit_logs where resource_id in (select id from document_vault where consumer_id='${c}' or unit_id='${S.unit}')`);
  rm(`delete from document_vault where consumer_id='${c}' or unit_id='${S.unit}'`); rm(`delete from documents where consumer_id='${c}'`);
  rm(`delete from document_templates where name='DC template ${U}'`); rm(`delete from consumers where id='${c}'`);
  rm(`delete from units where id='${S.unit}'`); rm(`delete from towers where project_id='${S.project}'`); rm(`delete from projects where id='${S.project}'`); rm(`delete from companies where id='${S.company}'`);
  await page.close();
});
test.beforeEach(() => { problems = []; });
test.afterEach(() => { expect(problems, 'Errors seen in the browser during this test').toEqual([]); });

test('every tab of the Documents screen opens clean (12 tabs)', async () => {
  for (const tab of ['print-welcome', 'demand-printing', 'ats', 'tpa', 'applicant-ledger', 'user-letters', 'address-labels', 'conveyance-deed']) {
    await go(`/documents?tab=${tab}`); await clean(); await expect(content()).toContainText('Documents');
  }
  for (const name of ['Templates', 'History', 'Vault']) { await go('/documents'); await page.locator('#content button', { hasText: name }).first().click(); await settle(); await clean(); }
});

test('History: the generated document is listed with its real status and Open shows the page (it used to open a missing /pdf address)', async () => {
  await go('/documents'); await page.locator('#content button', { hasText: 'History' }).first().click(); await settle();
  const row = page.locator('#content tr', { hasText: S.name }).first();
  await expect(row).toBeVisible(); await expect(row).toContainText('check list');
  const [pop] = await Promise.all([page.waitForEvent('popup'), row.getByRole('button', { name: 'Open' }).click()]);
  await pop.waitForLoadState();
  await expect(pop.locator('body')).toContainText(/check list/i);
  expect(pop.url()).toContain(`/api/documents/${S.doc}/html`);
  await pop.close();
});

test('Templates: Preview shows the template in a frame that cannot run scripts', async () => {
  await go('/documents'); await page.locator('#content button', { hasText: 'Templates' }).first().click(); await settle();
  const row = page.locator('#content tr', { hasText: `DC template ${U}` });
  await expect(row).toBeVisible();
  const [pop] = await Promise.all([page.waitForEvent('popup'), row.getByRole('button', { name: 'Preview' }).click()]);
  await pop.waitForLoadState();
  await expect(pop.frameLocator('iframe').locator('b')).toContainText(`Preview words ${U}`);
  expect(await pop.frameLocator('iframe').locator('body').evaluate(() => (window as any).__ran ?? null)).toBeNull();
  await pop.close();
});

test('applicant documents: upload a real image, it is listed, stored in the database, and Download opens it', async () => {
  await go(`/consumer?id=${S.consumer}`);
  await page.locator('[data-tab="documents"]').first().click(); await settle();
  mkdirSync('test-results', { recursive: true }); const f = `test-results/dc-${U}.png`; writeFileSync(f, PNG);
  await page.locator('#doc-file').setInputFiles(f);
  await page.locator('#doc-cat-sel').selectOption('PAN Card');
  await page.locator('#doc-remarks').fill('front side & back');
  await page.getByRole('button', { name: 'Upload Document' }).click();
  await expect(toast('Document uploaded')).toBeVisible(); await settle();
  const row = page.locator(`#docs-vault-${S.consumer} tr`, { hasText: 'PAN Card' });
  await expect(row).toBeVisible(); await expect(row).toContainText(`dc-${U}.png`);
  expect(psql(`select length(file_data)||'/'||content_type||'/'||remarks from document_vault where consumer_id='${S.consumer}'`)).toBe(`${PNG.length}/image/png/front side & back`);
  const [pop] = await Promise.all([page.waitForEvent('popup'), row.getByRole('button', { name: 'Download' }).click()]);
  await pop.waitForLoadState();
  await expect.poll(() => pop.url()).toContain('/api/documents/vault/file/');
  await pop.close();
  // a file that is not an image or pdf is refused with a message and saves nothing
  const bad = `test-results/dc-${U}.png.txt`; writeFileSync(bad, 'just text'); await page.locator('#doc-file').setInputFiles(bad);
  await page.getByRole('button', { name: 'Upload Document' }).click();
  await expect(toast(/Only jpeg, png, gif and pdf/)).toBeVisible();
  expect(psql(`select count(*) from document_vault where consumer_id='${S.consumer}'`)).toBe('1');
});

test('unit documents: choose project, tower and unit, upload a pdf, see it listed', async () => {
  await go('/unit-documents');
  await page.locator('#ud-project').selectOption(S.project); await settle();
  await page.locator('#ud-tower').selectOption({ label: `DT${U}` }); await settle();
  await page.locator('#ud-unit').selectOption(S.unit); await settle();
  mkdirSync('test-results', { recursive: true }); const f = `test-results/dc-${U}.pdf`; writeFileSync(f, '%PDF-1.4 unit plan ' + U);
  await page.locator('#ud-upload-file').setInputFiles(f);
  await page.locator('#ud-upload-category').selectOption({ index: 0 });
  await page.getByRole('button', { name: /Upload/ }).last().click();
  await expect(toast('Document uploaded')).toBeVisible(); await settle();
  await expect(page.locator('#ud-docs-list tr', { hasText: `dc-${U}.pdf` })).toBeVisible();
  expect(psql(`select content_type from document_vault where unit_id='${S.unit}'`)).toBe('application/pdf');
  await clean();
});
