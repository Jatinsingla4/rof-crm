// Parking, Import, Customer Folders and Unit Documents in a real browser: every tab, filter option and button.
// Data is made through the API and psql; the rest is clicked, then the database is asked whether the screen told the truth.
// A JavaScript error, console error, 5xx or "undefined" / "NaN" on a screen fails the test.
import { test, expect, Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PASSWORD = 'Test#Pass1234';
const BASE = process.env.BASE_URL || 'http://localhost:3002';
const U = Date.now().toString(36).slice(-5);
const psql = (sql: string) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim().split('\n')[0];
let seq = 0; const mob = () => '9' + String((Date.now() % 1e7) * 100 + ++seq + 100000000).slice(-9).padStart(9, '0');

test.describe.configure({ mode: 'serial' });
let page: Page;
let problems: string[] = [];
let dialogs: string[] = [];
let promptAnswer = '';
const settle = async () => { await page.waitForTimeout(150); await page.waitForLoadState('networkidle'); };
let token = '';
const api = async (method: string, p: string, body?: any) => {
  const r = await fetch(`${BASE}/api${p}`, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
  let j: any = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
};
const S: Record<string, any> = {};
const content = () => page.locator('#content');
const toast = (t: string | RegExp) => page.locator('.toast', { hasText: t }).first();
const go = async (hash: string) => { await page.evaluate((h) => { location.hash = h; }, hash); await settle(); };
const clean = async () => { expect(await content().innerText()).not.toMatch(/\bundefined\b|\bNaN\b|\[object Object\]/); };
const tab = async (name: string) => { await page.getByRole('button', { name, exact: true }).click(); await settle(); };
const csvFile = (name: string, text: string) => { const f = path.join(os.tmpdir(), `${name}-${U}.csv`); fs.writeFileSync(f, text); return f; };

test.beforeAll(async ({ browser }) => {
  token = (await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'super_admin@test.local', password: PASSWORD }) })).json()).token;
  const co = (await api('POST', '/companies', { name: `PI Co ${U}` })).j.data.id;
  S.projectName = `PI Project ${U}`;
  S.project = (await api('POST', '/projects', { companyId: co, name: S.projectName, reraNumber: `PI-${U}`, tcpLicence: 'x' })).j.data.id;
  S.tower = (await api('POST', `/projects/${S.project}/towers`, { towerName: `PT${U}` })).j.data.id;
  S.emptyProject = (await api('POST', '/projects', { companyId: co, name: `PI Empty ${U}`, reraNumber: `PE-${U}`, tcpLicence: 'x' })).j.data.id;   // no unit at all
  const unit = async (n: number) => (await api('POST', '/units', { projectId: S.project, towerId: S.tower, unitNumber: `PU${n}-${U}`, floor: n, bhkType: '2BHK', carpetAreaSqft: 900, superAreaSqft: 1100, basePriceInr: 3000000, totalPriceInr: 3300000 })).j.data.id;
  const person = (label: string) => psql(`INSERT INTO consumers (name, mobile, project_id, lead_stage) VALUES ('PI ${label} ${U}', '${mob()}', '${S.project}', 'enquiry') RETURNING id`);
  S.holder = person('Holder'); S.holderUnit = await unit(1);
  const al = await api('POST', '/allocations', { consumerId: S.holder, unitId: S.holderUnit, projectId: S.project }); if (al.s !== 201) throw new Error('allot ' + JSON.stringify(al));
  S.enquiry = person('Enquiry'); S.names = { holder: `PI Holder ${U}`, enquiry: `PI Enquiry ${U}` };
  S.unit2 = await unit(2);

  page = await browser.newPage();
  page.on('dialog', (d) => { dialogs.push(d.message()); if (d.type() === 'prompt') d.accept(promptAnswer); else d.accept(); });
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
  const ps = `'${S.project}','${S.emptyProject}'`;
  for (const sql of [`delete from parking_slots where project_id in (${ps})`, `delete from parking_prices where project_id in (${ps})`, `delete from import_history where file_name like '%${U}%'`, `delete from allocations where project_id in (${ps})`,
    `delete from consumers where project_id in (${ps})`, `delete from units where project_id in (${ps})`, `delete from towers where project_id in (${ps})`]) { try { psql(sql); } catch { /* names carry the run id */ } }
  await page.close();
});
test.beforeEach(() => { problems = []; dialogs = []; promptAnswer = ''; });
test.afterEach(() => { expect(problems, 'Errors seen in the browser during this test').toEqual([]); });

// ---------------- Parking ----------------
test('Parking: the project picker lists a project that has no unit (it used to be built from units)', async () => {
  await go('/parking');
  await tab('Parking Type Master');
  await expect(page.locator('#ptm-project option', { hasText: `PI Empty ${U}` })).toHaveCount(1);
  await expect(page.locator('#ptm-project option', { hasText: S.projectName })).toHaveCount(1);
  await clean();
});

test('Parking Type Master: needs a project and a price; a saved price is in the database for everyone (not in this browser), edit and delete work', async () => {
  await page.getByRole('button', { name: 'Save Type' }).click();
  await expect(page.locator('#ptm-result')).toContainText(/select a project/i);
  await page.locator('#ptm-project').selectOption(S.project);
  await page.getByRole('button', { name: 'Save Type' }).click();
  await expect(page.locator('#ptm-result')).toContainText(/price is required/i);
  await page.locator('#ptm-name').selectOption('stilt'); await page.locator('#ptm-price').fill('-5'); await page.getByRole('button', { name: 'Save Type' }).click();
  await expect(page.locator('#ptm-result')).toContainText(/price|number/i);
  expect(psql(`select count(*) from parking_prices where project_id='${S.project}'`)).toBe('0');
  await page.locator('#ptm-price').fill('75000'); await page.locator('#ptm-desc').fill(`stilt floor ${U}`); await page.getByRole('button', { name: 'Save Type' }).click();
  await expect(page.locator('#ptm-result')).toContainText(/saved/i);
  expect(psql(`select parking_type||'|'||price_inr||'|'||description from parking_prices where project_id='${S.project}'`)).toBe(`stilt|75000.00|stilt floor ${U}`);
  expect(await page.evaluate(() => localStorage.getItem('rof_parking_types'))).toBeNull();
  await expect(page.locator('#ptm-list-body')).toContainText(S.projectName);
  await page.locator('#ptm-list-body tr', { hasText: `stilt floor ${U}` }).getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('#ptm-price')).toHaveValue('75000');
  await page.locator('#ptm-price').fill('80000.50'); await page.getByRole('button', { name: 'Save Type' }).click(); await settle();
  expect(psql(`select count(*)||'|'||max(price_inr) from parking_prices where project_id='${S.project}'`)).toBe('1|80000.50');
  await page.locator('#ptm-list-body tr', { hasText: `stilt floor ${U}` }).getByRole('button', { name: 'Delete' }).click();
  await expect(toast('Price deleted')).toBeVisible();
  expect(psql(`select count(*) from parking_prices where project_id='${S.project}'`)).toBe('0');
});

test('Inventory Master: a slot needs project, number and a price (no invented default price); a duplicate number is refused', async () => {
  await tab('Inventory Master');
  await page.getByRole('button', { name: 'Add Slot', exact: true }).click();
  await expect(page.locator('#pim-result')).toContainText(/select a project/i);
  await page.locator('#pim-project').selectOption(S.project);
  await page.getByRole('button', { name: 'Add Slot', exact: true }).click();
  await expect(page.locator('#pim-result')).toContainText(/slot number is required/i);
  await page.locator('#pim-slot').fill(`PS1-${U}`); await page.locator('#pim-type').selectOption('open');
  await page.getByRole('button', { name: 'Add Slot', exact: true }).click();
  await expect(page.locator('#pim-result')).toContainText(/enter a price/i);
  expect(psql(`select count(*) from parking_slots where project_id='${S.project}'`)).toBe('0');
  await page.locator('#pim-price').fill('50000'); await page.locator('#pim-floor').fill('-1');
  await page.getByRole('button', { name: 'Add Slot', exact: true }).click();
  await expect(page.locator('#pim-result')).toContainText(/created/i);
  expect(psql(`select parking_type||'|'||floor||'|'||amount_inr||'|'||status from parking_slots where slot_number='PS1-${U}'`)).toBe('open|-1|50000.00|available');
  await page.locator('#pim-slot').fill(`PS1-${U}`); await page.getByRole('button', { name: 'Add Slot', exact: true }).click();
  await expect(page.locator('#pim-result')).toContainText(/already exists/i);
  expect(psql(`select count(*) from parking_slots where slot_number='PS1-${U}'`)).toBe('1');
  await page.locator('#pim-slot').fill(`<b>x</b>${U}`); await page.getByRole('button', { name: 'Add Slot', exact: true }).click();
  await expect(page.locator('#pim-result .alert-error')).toBeVisible();
  await clean();
});

test('Inventory Master: Bulk Add makes the slots in one call and says how many were new; a wrong count is refused', async () => {
  const pre = `P${U.slice(0, 2).toUpperCase()}`;
  await page.locator('#pim-slot').fill('');
  promptAnswer = 'abc'; await page.getByRole('button', { name: 'Bulk Add (1-N)' }).click();
  await expect(page.locator('#pim-result .alert-error')).toBeVisible();
  promptAnswer = '12'; await page.getByRole('button', { name: 'Bulk Add (1-N)' }).click();
  await expect(page.locator('#pim-result')).toContainText(/created 12 of 12/i);
  expect(psql(`select count(*) from parking_slots where project_id='${S.project}' and slot_number ~ '^P[0-9]{3}$'`)).toBe('12');
  promptAnswer = '15'; await page.getByRole('button', { name: 'Bulk Add (1-N)' }).click();
  await expect(page.locator('#pim-result')).toContainText(/created 3 of 15.*12 already existed/i);
  expect(psql(`select count(*) from parking_slots where project_id='${S.project}' and slot_number ~ '^P[0-9]{3}$'`)).toBe('15');
  void pre;
});

test('Inventory Master: every filter option of the slot list, then Release and Delete buttons', async () => {
  for (const id of ['pim-filter-project', 'pim-filter-type', 'pim-filter-status']) {
    const opts = await page.locator(`#${id} option`).evaluateAll((o) => o.map((x: any) => x.value));
    for (const v of opts.slice(0, 12)) { await page.locator(`#${id}`).selectOption(v); await settle(); await clean(); }
    await page.locator(`#${id}`).selectOption(opts[0]);
  }
  await page.locator('#pim-filter-project').selectOption(S.project); await settle();
  await expect(page.locator('#pim-slot-list')).toContainText(`PS1-${U}`);
  await page.locator('#pim-filter-status').selectOption('allotted'); await settle();
  await expect(page.locator('#pim-slot-list')).not.toContainText(`PS1-${U}`);
  await page.locator('#pim-filter-status').selectOption('available'); await settle();
  await page.locator('#pim-slot-list tr', { hasText: `PS1-${U}` }).getByRole('button', { name: 'Delete' }).click();
  await expect(toast('Slot deleted')).toBeVisible();
  expect(psql(`select count(*) from parking_slots where slot_number='PS1-${U}'`)).toBe('0');
});

test('Assign Parking: only customers of the chosen project who hold a unit are offered; the price comes from the slot; the slot is allotted with the unit; then Release', async () => {
  await tab('Assign Parking');
  await page.locator('#pas-project').selectOption(S.project); await settle();
  await expect(page.locator('#pas-consumer option', { hasText: S.names.holder })).toHaveCount(1);
  await expect(page.locator('#pas-consumer option', { hasText: S.names.enquiry })).toHaveCount(0);
  await page.getByRole('button', { name: 'Assign Parking', exact: true }).last().click();
  await expect(page.locator('#pas-result')).toContainText(/consumer/i);
  await page.locator('#pas-consumer').selectOption(S.holder);
  await page.locator('#pas-slot').selectOption({ index: 1 }); await settle();
  await page.getByRole('button', { name: 'Assign Parking', exact: true }).last().click();
  await expect(page.locator('#pas-result')).toContainText(/assigned/i);
  const row = psql(`select status||'|'||allotted_to_consumer_id||'|'||coalesce(allotted_unit_id::text,'') from parking_slots where allotted_to_consumer_id='${S.holder}'`);
  expect(row).toBe(`allotted|${S.holder}|${S.holderUnit}`);
  await expect(page.locator('#pas-recent-body')).toContainText(S.names.holder);
  await clean();
  await tab('Inventory Master'); await page.locator('#pim-filter-project').selectOption(S.project); await page.locator('#pim-filter-status').selectOption('allotted'); await settle();
  await page.locator('#pim-slot-list tr', { hasText: S.names.holder }).getByRole('button', { name: 'Release' }).click();
  await expect(toast('Slot released')).toBeVisible();
  expect(psql(`select count(*) from parking_slots where allotted_to_consumer_id='${S.holder}'`)).toBe('0');
});

test('Inventory Report: every filter option, FETCH, the totals match the database, Export downloads a file', async () => {
  await tab('Inventory Report');
  for (const id of ['pir-project', 'pir-type', 'pir-status']) {
    const opts = await page.locator(`#${id} option`).evaluateAll((o) => o.map((x: any) => x.value));
    for (const v of opts.slice(0, 12)) { await page.locator(`#${id}`).selectOption(v); await page.getByRole('button', { name: 'FETCH', exact: true }).click(); await settle(); await clean(); }
    await page.locator(`#${id}`).selectOption(opts[0]);
  }
  await page.locator('#pir-project').selectOption(S.project); await page.getByRole('button', { name: 'FETCH', exact: true }).click(); await settle();
  const total = psql(`select count(*) from parking_slots where project_id='${S.project}'`);
  await expect(page.locator('#pir-kpis')).toContainText(total);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export' }).click()]);
  expect(dl.suggestedFilename()).toBe('parking_inventory_report.csv');
  await clean();
});

// ---------------- Import ----------------
test('Import: the data type is only Units (the other types did nothing), the project list has the empty project, a non-CSV file is refused', async () => {
  await go('/import'); await expect(page.locator('#imp-type')).toBeVisible();
  expect(await page.locator('#imp-type option').evaluateAll((o) => o.map((x: any) => x.value))).toEqual(['units']);
  await expect(page.locator('#imp-project option', { hasText: `PI Empty ${U}` })).toHaveCount(1);
  const bad = path.join(os.tmpdir(), `bad-${U}.xlsx`); fs.writeFileSync(bad, 'x');
  await page.locator('#imp-file').setInputFiles(bad);
  await expect(toast(/csv file/i)).toBeVisible();
  await expect(page.locator('#imp-preview-btn')).toBeDisabled();
  await clean();
});

const hdr = 'unitNumber,tower,floor,bhkType,totalPriceInr,carpetAreaSqft,superAreaSqft,basePriceInr,facing';
test('Import: Preview names every bad row; nothing is saved by a preview', async () => {
  const f = csvFile('mixed', [hdr, `IMP1-${U},PIT${U},1,2BHK,3500000,650,900,3000000,East`, `IMP2-${U},PIT${U},x,2BHK,3500000,,,,`, `IMP3-${U},PIT${U},1,2BHK,-9,,,,`, `IMP1-${U},PIT${U},2,2BHK,3500000,,,,`].join('\n'));
  await page.locator('#imp-file').setInputFiles(f);
  await page.locator('#imp-project').selectOption(S.project);
  await page.getByRole('button', { name: 'Preview Data' }).click();
  await expect(page.locator('#imp-preview')).toContainText(/4 rows read · 1 good · 3 with problems/);
  await expect(page.locator('#imp-preview')).toContainText('Row 3'); await expect(page.locator('#imp-preview')).toContainText('Row 4'); await expect(page.locator('#imp-preview')).toContainText('Row 5');
  expect(psql(`select count(*) from units where project_id='${S.project}' and unit_number like 'IMP%'`)).toBe('0');
  await clean();
});

test('Import: Confirm needs a project; one bad row stops the whole file and the screen says which row; nothing is saved', async () => {
  await page.locator('#imp-project').selectOption('');
  await page.getByRole('button', { name: 'Confirm Import' }).click();
  await expect(toast(/choose a project/i)).toBeVisible();
  await page.locator('#imp-project').selectOption(S.project);
  await page.getByRole('button', { name: 'Confirm Import' }).click();
  await expect(page.locator('#imp-result')).toContainText(/nothing was imported/i);
  await expect(page.locator('#imp-result')).toContainText('Row 3');
  expect(psql(`select count(*) from units where project_id='${S.project}' and unit_number like 'IMP%'`)).toBe('0');
  expect(psql(`select count(*) from towers where project_id='${S.project}' and tower_name='PIT${U}'`)).toBe('0');
});

test('Import: a good file is imported (units and tower in the database), the same file again skips every unit, History shows both', async () => {
  const f = csvFile('good', [hdr, `IMP1-${U},PIT${U},1,2BHK,3500000,650,900,3000000,East`, `IMP2-${U},PIT${U},2,3BHK,4500000,800,1000,4000000,West`, `IMP3-${U},PIT2${U},3,2BHK,3600000,,,,`].join('\n'));
  await page.locator('#imp-file').setInputFiles(f);
  await page.locator('#imp-project').selectOption(S.project);
  await page.getByRole('button', { name: 'Preview Data' }).click();
  await expect(page.locator('#imp-preview')).toContainText(/3 rows read · 3 good · 0 with problems/);
  await expect(page.locator('#imp-preview')).toContainText(/0 already in this project/);
  await page.getByRole('button', { name: 'Confirm Import' }).click();
  await expect(page.locator('#imp-result')).toContainText(/Created: 3/);
  expect(psql(`select count(*) from units where project_id='${S.project}' and unit_number like 'IMP%'`)).toBe('3');
  expect(psql(`select status||'|'||floor||'|'||total_price_inr::bigint from units where unit_number='IMP2-${U}'`)).toBe('available|2|4500000');
  expect(psql(`select count(*) from towers where project_id='${S.project}' and tower_name in ('PIT${U}','PIT2${U}')`)).toBe('2');
  await page.locator('#imp-file').setInputFiles(f); await page.getByRole('button', { name: 'Preview Data' }).click();
  await expect(page.locator('#imp-preview')).toContainText(/3 already in this project/);
  await page.getByRole('button', { name: 'Confirm Import' }).click();
  await expect(page.locator('#imp-result')).toContainText(/Created: 0.*Skipped \(already there\): 3/);
  expect(psql(`select count(*) from units where project_id='${S.project}' and unit_number like 'IMP%'`)).toBe('3');
  await tab('Import History');
  await expect(page.locator('#imp-history-body')).toContainText(`good-${U}.csv`);
  await expect(page.locator('#imp-history-body')).toContainText(`mixed-${U}.csv`);   // the refused file is there too, as failed
  await expect(page.locator('#imp-history-body')).not.toContainText('unknown');
  await clean();
});

test('Import: Download Template gives a CSV with the columns the import reads', async () => {
  await tab('Upload');
  const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download Template CSV' }).click()]);
  expect(file.suggestedFilename()).toBe('units-template.csv');
  const chunks: Buffer[] = []; for await (const c of (await file.createReadStream())!) chunks.push(c as Buffer);
  expect(Buffer.concat(chunks).toString().split('\n')[0]).toBe('unitNumber,tower,floor,unitType,location,facing');
});

// ---------------- Customer Folders ----------------
test('Customer Folders: the project filter, the stage filter and the search each go to the server and each changes the list', async () => {
  await go('/customer-folders'); await expect(page.locator('#cf-grid')).toBeVisible(); await settle();
  await page.locator('#cf-project').selectOption(S.project); await settle();
  await expect(page.locator('#cf-grid')).toContainText(new RegExp(S.names.holder, 'i')); await expect(page.locator('#cf-grid')).toContainText(new RegExp(S.names.enquiry, 'i'));
  await expect(page.locator('#cf-count')).toHaveText(/^2 folders?$/);
  await page.locator('#cf-stage').selectOption('enquiry'); await settle();
  await expect(page.locator('#cf-grid')).toContainText(new RegExp(S.names.enquiry, 'i')); await expect(page.locator('#cf-grid')).not.toContainText(new RegExp(S.names.holder, 'i'));
  await page.locator('#cf-stage').selectOption(''); await settle();
  await page.locator('#cf-search').fill(`Holder ${U}`); await page.waitForTimeout(700); await settle();
  await expect(page.locator('#cf-grid')).toContainText(new RegExp(S.names.holder, 'i')); await expect(page.locator('#cf-grid')).not.toContainText(new RegExp(S.names.enquiry, 'i'));
  await page.locator('#cf-search').fill('%'); await page.waitForTimeout(700); await settle(); await clean();
  await page.locator('#cf-search').fill('<script>1</script>'); await page.waitForTimeout(700); await settle(); await clean();
  await page.locator('#cf-search').fill(''); await page.waitForTimeout(700); await settle();
  for (const id of ['cf-project', 'cf-stage']) {
    const opts = await page.locator(`#${id} option`).evaluateAll((o) => o.map((x: any) => x.value));
    for (const v of opts.slice(0, 12)) { await page.locator(`#${id}`).selectOption(v); await settle(); await clean(); }
  }
});

// ---------------- Unit Documents ----------------
test('Unit Documents: the units come from the chosen project, the tower filter works, a unit opens its documents panel', async () => {
  await go('/unit-documents'); await expect(page.locator('#ud-project')).toBeVisible(); await settle();
  await expect(page.locator('#ud-project option', { hasText: `PI Empty ${U}` })).toHaveCount(1);
  await page.locator('#ud-project').selectOption(S.project); await settle();
  await expect(page.locator('#ud-unit option', { hasText: `PU1-${U}` })).toHaveCount(1);
  await expect(page.locator('#ud-unit option', { hasText: `PU2-${U}` })).toHaveCount(1);
  const towers = await page.locator('#ud-tower option').evaluateAll((o) => o.map((x: any) => x.value));
  expect(towers).toContain(`PT${U}`);
  await page.locator('#ud-tower').selectOption(`PT${U}`);
  await expect(page.locator('#ud-unit option', { hasText: `PU1-${U}` })).toHaveCount(1);
  await page.locator('#ud-unit').selectOption(S.holderUnit); await settle();
  await expect(page.locator('#ud-docs-panel')).toBeVisible(); await clean();
  await page.locator('#ud-project').selectOption(S.emptyProject); await settle();
  await expect(page.locator('#ud-unit option', { hasText: `PU1-${U}` })).toHaveCount(0);
  await clean();
});
