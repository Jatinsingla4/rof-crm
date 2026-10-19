// Browser flow checks for the modules that have been verified one by one:
//   Set Master: Set Up (lists, banks, locations, companies and their bank accounts and logo)
//   Set Projects: Project Set Up (project, tower, unit type, unit, CSV upload, unit location, reminder)
//   the Set Master menu, and what each role sees.
// Add a section here when another module has been checked.
import { test, expect, Page } from '@playwright/test';

const PASSWORD = 'Test#Pass1234';
const U = Date.now().toString(36).slice(-5);
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

const names = {
  prof: `E2E Prof ${U}`,
  bank: `E2E Bank ${U}`,
  country: `E2E Land ${U}`,
  state: `E2E State ${U}`,
  city: `E2E City ${U}`,
  company: `E2E Co ${U}`,
  project: `E2E Project ${U}`,
  tower: `E2T-${U}`,
  unitType: `E2E Type ${U}`,
  location: `E2E Park Facing ${U}`,
  reminder: `E2E Reminder ${U}`,
};

test.describe.configure({ mode: 'serial' });

let page: Page;
let problems: string[] = [];

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  page.on('dialog', d => d.accept()); // the old confirm() boxes
  page.on('pageerror', e => problems.push(`JavaScript error: ${e.message}`));
  page.on('console', m => {
    // a 4xx the test expects shows up here as "Failed to load resource"; real script errors do not
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) problems.push(`Console error: ${m.text()}`);
  });
  page.on('response', r => {
    if (r.url().includes('/api/') && r.status() >= 500) problems.push(`Server error ${r.status()}: ${r.request().method()} ${r.url()}`);
  });
});
test.afterAll(async () => { await page.close(); });
test.beforeEach(() => { problems = []; });
test.afterEach(() => { expect(problems, 'Errors seen in the browser during this test').toEqual([]); });

// ── helpers ────────────────────────────────────────────────────────────────
const content = () => page.locator('#content');
const toast = (text: string | RegExp) => page.locator('.toast', { hasText: text }).first();
const go = (hash: string) => page.evaluate((h) => { location.hash = h; }, hash);
const drawer = () => page.locator('#sm-drawer-host aside[role=dialog]');
const rowOf = (text: string) => content().locator('tr, [data-row]').filter({ hasText: text }).first();

async function login(role: string) {
  await page.goto('/pages/login.html');
  await page.locator('input[type=email]').fill(`${role}@test.local`);
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.locator('button[type=submit]').click();
  await page.waitForURL(/#\/dashboard/);
  await expect(page.locator('#tb-user')).toContainText(role);
}
async function logout() {
  await page.locator('a, button').filter({ hasText: /^Logout$/ }).first().click();
  await page.waitForURL(/login\.html/);
}
async function fillDrawer(values: Record<string, string>) {
  await expect(drawer()).toBeVisible();
  for (const [name, value] of Object.entries(values)) await drawer().locator(`[name=${name}]`).fill(value);
}
async function saveDrawer() { await drawer().locator('button[type=submit]').click(); }
async function rowAction(text: string, action: 'Edit' | 'Delete') {
  const r = rowOf(text);
  await expect(r).toBeVisible();
  await r.hover();
  await r.getByRole('button', { name: action, exact: true }).click();
}
async function confirmDelete() {
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
}

// ── 1. menu ────────────────────────────────────────────────────────────────
test('Set Master menu has four groups and every entry opens', async () => {
  await login('super_admin');
  const nav = page.locator('.nav-item').filter({ has: page.locator('.nav-btn', { hasText: 'Set Master' }) });
  const groups = await nav.locator('.dd > .dd-link.has-sub').evaluateAll(els => els.map(e => (e.childNodes[0].textContent || '').trim()));
  expect(groups).toEqual(['Set Up', 'Employees', 'Documents', 'Security']);
  const links = await nav.locator('a.dd-link').evaluateAll(els => els.map(e => ({ label: (e.textContent || '').trim(), onclick: e.getAttribute('onclick') || '' })));
  expect(links.length).toBe(23);
  for (const link of links) {
    const standalone = link.onclick.match(/window\.location\.href='([^']+)'/);
    if (standalone) {
      const res = await page.request.get(standalone[1]);
      expect(res.status(), `${link.label} page`).toBe(200);
      continue;
    }
    await page.evaluate((code) => { new Function(code)(); }, link.onclick);
    await expect(content(), `${link.label} opens`).not.toContainText('Access Denied');
    await expect(content(), `${link.label} shows something`).toContainText(/\S{3,}/);
  }
});

// ── 2. Set Up: applicant lists ─────────────────────────────────────────────
test('Set Up: applicant list (add, duplicate, edit, in-use rules, delete)', async () => {
  await go('#/set-master?screen=lists&list=professions');
  const add = () => content().getByRole('button', { name: 'Add', exact: true }).click();
  const box = page.getByPlaceholder(/^New profession/);
  await box.fill(names.prof); await add();
  await expect(toast('Profession added')).toBeVisible();
  await box.fill(names.prof.toUpperCase()); await add();
  await expect(toast('A record with this name already exists')).toBeVisible();

  await rowAction(names.prof, 'Edit');
  await fillDrawer({ name: `${names.prof} 2` }); await saveDrawer();
  await expect(toast('Saved')).toBeVisible();
  await expect(rowOf(`${names.prof} 2`)).toBeVisible();

  // "Salaried" is used by the sample consumer: it cannot be deleted or renamed
  const salaried = rowOf('Salaried');
  await expect(salaried.getByRole('button', { name: 'Delete', exact: true })).toBeDisabled();
  await rowAction('Salaried', 'Edit');
  await fillDrawer({ name: 'Salaried Renamed' }); await saveDrawer();
  await expect(drawer().locator('#sm-form-err')).toContainText('is used on');
  await drawer().getByRole('button', { name: 'Cancel' }).click();

  await rowAction(`${names.prof} 2`, 'Delete'); await confirmDelete();
  await expect(toast('Deleted')).toBeVisible();
});

// ── 3. Set Up: banks ───────────────────────────────────────────────────────
test('Set Up: banks (add, edit, delete with Cancel and confirm)', async () => {
  await go('#/set-master?screen=banks');
  await content().locator('[name=name]').fill(names.bank);
  await content().locator('[name=ifsc_prefix]').fill('E2EB');
  await content().locator('[name=branch]').fill('Sector 1');
  await content().getByRole('button', { name: 'Add', exact: true }).click();
  await expect(toast('Bank added')).toBeVisible();

  await rowAction(names.bank, 'Edit');
  await fillDrawer({ branch: 'Sector 2' }); await saveDrawer();
  await expect(toast('Saved')).toBeVisible();
  await expect(rowOf(names.bank)).toContainText('Sector 2');

  await rowAction(names.bank, 'Delete');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();
  await expect(rowOf(names.bank)).toBeVisible();
  await rowAction(names.bank, 'Delete'); await confirmDelete();
  await expect(toast('Deleted')).toBeVisible();
  await expect(content().locator('tr', { hasText: names.bank })).toHaveCount(0);
});

// ── 4. Set Up: locations ───────────────────────────────────────────────────
test('Set Up: locations (country, state, city, parent delete is blocked)', async () => {
  await go('#/set-master?screen=locations');
  await content().getByRole('button', { name: 'Add country' }).click();
  await fillDrawer({ name: names.country, code: 'EL' }); await saveDrawer();
  await expect(rowOf(names.country)).toBeVisible();

  await rowOf(names.country).click();
  await content().getByRole('button', { name: 'Add state' }).click();
  await fillDrawer({ name: names.state, code: 'ES' }); await saveDrawer();
  await expect(rowOf(names.state)).toBeVisible();

  await rowOf(names.state).click();
  await content().getByRole('button', { name: 'Add city' }).click();
  await fillDrawer({ name: names.city }); await saveDrawer();
  await expect(rowOf(names.city)).toBeVisible();

  await rowAction(names.country, 'Delete'); await confirmDelete();
  await expect(toast('This country has 1 state(s). Delete them first.')).toBeVisible();

  for (const name of [names.city, names.state, names.country]) {
    await rowAction(name, 'Delete'); await confirmDelete();
    await expect(rowOf(name)).toHaveCount(0);
  }
});

// ── 5. Set Up: companies ───────────────────────────────────────────────────
test('Set Up: company, bank account and logo', async () => {
  await go('#/set-master?screen=companies');
  await content().getByRole('button', { name: 'New company' }).click();
  await page.locator('#co-name').fill(names.company);
  await content().getByRole('button', { name: 'Create company' }).click();
  await expect(content().locator('.sm-panel-t', { hasText: names.company })).toBeVisible();

  await content().getByRole('button', { name: 'Add bank account' }).click();
  await fillDrawer({ bank_name: 'HDFC Bank', account_name: names.company, account_number: '50100123456789', ifsc_code: 'BAD' });
  await saveDrawer();
  await expect(drawer().locator('#sm-form-err')).toContainText('IFSC must be 11 characters');
  await fillDrawer({ ifsc_code: 'hdfc0001234' }); await saveDrawer();
  await expect(toast('Bank account added')).toBeVisible();
  await expect(content()).toContainText('Primary');
  await expect(content()).toContainText('XXXX6789');

  await page.setInputFiles('#co-logo', { name: 'logo.png', mimeType: 'image/png', buffer: PNG });
  await page.locator('#co-logo-up').click();
  await expect(toast('Logo uploaded')).toBeVisible();
  await expect(content().locator('.sm-logo img')).toBeVisible();

  await page.setInputFiles('#co-logo', { name: 'evil.png', mimeType: 'image/png', buffer: Buffer.from('<html><script>alert(1)</script></html>') });
  await page.locator('#co-logo-up').click();
  await expect(toast(/not a valid PNG/)).toBeVisible();
});

// ── 6. Project Set Up ──────────────────────────────────────────────────────
test('Project Set Up: project, tower, unit type, unit, CSV upload, location, reminder', async () => {
  // project
  await go('#/set-projects?tab=new-project');
  const np = page.locator('#spj-new-project-form');
  const createProject = async () => {
    await np.locator('[name=name]').fill(names.project);
    await np.locator('#spj-new-proj-company').selectOption({ label: names.company });
    await np.locator('[name=reraNumber]').fill(`RERA-${U}-${Math.random().toString(36).slice(2, 6)}`);
    await np.locator('[name=tcpLicence]').fill(`TCP-${U}`);
    await np.getByRole('button', { name: 'Save Project' }).click();
  };
  await createProject();
  await expect(toast(`Project "${names.project}" created`)).toBeVisible();
  await createProject();
  await expect(toast('A project with this name already exists')).toBeVisible();

  // tower
  await go('#/set-projects?tab=add-tower');
  const tf = page.locator('#spj-tower-form');
  const addTower = async (name: string) => {
    await tf.locator('#spj-tower-project').selectOption({ label: names.project });
    await tf.locator('[name=towerName]').fill(name);
    await tf.getByRole('button', { name: 'Add Tower' }).click();
  };
  await addTower(names.tower);
  await expect(toast(`Tower "${names.tower}" added`)).toBeVisible();
  await expect(tf.locator('#spj-tower-project').locator('option:checked')).toHaveText(names.project); // stays selected
  await addTower(names.tower.toLowerCase());
  await expect(toast('A tower with this name already exists in this project')).toBeVisible();
  await addTower('<b>x');
  await expect(toast('Tower name cannot contain < or >')).toBeVisible();

  // unit type
  await go('#/set-projects?tab=unit-address');
  const uf = page.locator('#spj-unit-type-form');
  const addType = async (name: string) => {
    await uf.locator('#spj-ut-project').selectOption({ label: names.project });
    await uf.locator('[name=name]').fill(name);
    await uf.getByRole('button', { name: 'Add Unit Type' }).click();
  };
  await addType(names.unitType);
  await expect(toast('Unit type added')).toBeVisible();
  await addType(names.unitType.toLowerCase());
  await expect(toast('A record with this name already exists')).toBeVisible();

  // unit, with a unit type and a price
  await go('#/set-projects?tab=add-unit');
  const unit = page.locator('#spj-unit-form');
  const addUnit = async (number: string) => {
    await unit.locator('#spj-unit-project').selectOption({ label: names.project });
    await expect(unit.locator('#spj-unit-tower option', { hasText: names.tower })).toHaveCount(1);
    await unit.locator('#spj-unit-tower').selectOption({ label: names.tower });
    await unit.locator('#spj-unit-type').selectOption({ label: names.unitType });
    await unit.locator('[name=unit_number]').fill(number);
    await unit.locator('[name=floor]').fill('1');
    await unit.locator('[name=bhk_type]').selectOption('2BHK');
    await unit.locator('#spj-unit-carpet').fill('500');
    await unit.locator('#spj-unit-balcony').fill('50');
    await unit.locator('[name=total_price_inr]').fill('4500000');
    await unit.getByRole('button', { name: 'Add Unit' }).click();
  };
  await addUnit('E2E-101');
  await expect(toast('Unit E2E-101 added')).toBeVisible();
  await addUnit('E2E-101');
  await expect(toast('A unit with this number already exists in this tower')).toBeVisible();

  // CSV upload: 1 new unit, 1 duplicate, 1 without a floor
  await page.locator('#spj-bulk-project').selectOption({ label: names.project });
  const csv = 'tower,floor,unitNumber,bhkType,carpetAreaSqft,superAreaSqft,balconyAreaSqft,basePriceInr,totalPriceInr,facing\n'
    + `${names.tower},2,E2E-201,2BHK,650,750,100,5000000,5000000,North\n`
    + `${names.tower},1,E2E-101,2BHK,650,750,100,5000000,5000000,North\n`
    + `${names.tower},,E2E-301,2BHK,650,750,100,5000000,5000000,North\n`;
  await page.setInputFiles('#spj-bulk-file', { name: 'units.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await page.locator('[data-panel="add-unit"]').getByRole('button', { name: 'Upload' }).click();
  await expect(page.locator('#spj-bulk-result')).toContainText('1 units added · 2 skipped');

  // unit location
  await go('#/set-projects?tab=unit-location');
  const lf = page.locator('#spj-uloc-form');
  const addLocation = async (name: string) => {
    await lf.locator('#spj-uloc-project').selectOption({ label: names.project });
    await lf.locator('[name=name]').fill(name);
    await lf.getByRole('button', { name: 'Add Location' }).click();
  };
  await addLocation(names.location);
  await expect(toast('Location added')).toBeVisible();
  await addLocation(names.location.toLowerCase());
  await expect(toast('A unit location with this name already exists in this project')).toBeVisible();

  // reminder, including a same-day (0 days) reminder
  await go('#/set-projects?tab=reminder-master');
  const rf = page.locator('#spj-reminder-form');
  const addReminder = async () => {
    await rf.locator('[name=name]').fill(names.reminder);
    await rf.locator('[name=days_before]').fill('0');
    await rf.getByRole('button', { name: 'Add Reminder' }).click();
  };
  await addReminder();
  await expect(toast('Reminder rule added')).toBeVisible();
  await addReminder();
  await expect(toast('A reminder with this name and days already exists')).toBeVisible();
  const reminderRow = page.locator('#spj-reminder-list tr', { hasText: names.reminder });
  await reminderRow.getByRole('button', { name: '✕' }).click();
  await expect(reminderRow).toHaveCount(0);
});

// ── 7. roles ───────────────────────────────────────────────────────────────
const WRITE = /^(Add|Edit|Delete|New company|Upload logo|Save changes|Set as active)/;

test('read_only_viewer: no write controls in Set Master, writes refused in Set Projects', async () => {
  await logout();
  await login('read_only_viewer');
  for (const hash of ['locations', 'lists&list=professions', 'banks', 'companies']) {
    await go(`#/set-master?screen=${hash}`);
    await expect(content().locator('.sm-rail, .sm-nav, [data-screen], button').first()).toBeVisible();
    await expect(content().getByRole('button', { name: WRITE }), `write buttons on ${hash}`).toHaveCount(0);
  }
  // The page may open (page access is not configured in the test database), but the server refuses every write
  await go('#/set-projects?tab=add-tower');
  const tf = page.locator('#spj-tower-form');
  await tf.locator('#spj-tower-project').selectOption({ label: names.project });
  await tf.locator('[name=towerName]').fill('RO-try');
  await tf.getByRole('button', { name: 'Add Tower' }).click();
  await expect(toast(/permission|forbidden|denied/i)).toBeVisible();
});

test('project_manager: can add and edit, cannot delete, no company editing', async () => {
  await logout();
  await login('project_manager');
  await go('#/set-master?screen=banks');
  await expect(content().getByRole('button', { name: 'Add', exact: true })).toBeVisible();
  await expect(content().getByRole('button', { name: 'Edit', exact: true }).first()).toBeAttached();
  await expect(content().getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
  await go('#/set-master?screen=companies');
  await expect(content().getByRole('button', { name: 'New company' })).toHaveCount(0);

  await go('#/set-projects?tab=add-tower');
  await expect(content()).not.toContainText('Access Denied');
  await page.locator('#spj-tower-list-project').selectOption({ label: names.project });
  await expect(page.locator('#spj-towers-list tr', { hasText: names.tower })).toBeVisible();
  await expect(page.locator('#spj-towers-list').getByRole('button', { name: '✕' })).toHaveCount(0);
});
