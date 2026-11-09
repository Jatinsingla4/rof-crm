import { autoAsk } from './_ask';
// Browser flow checks for the modules that have been verified one by one:
//   Set Master: Set Up (lists, banks, locations, companies and their bank accounts and logo)
//   Set Projects: Project Set Up (project, tower, unit type, unit, CSV upload, unit location, reminder)
//   the Set Master menu, what each role sees, Security (logins, roles, role menu access, audit log),
//   Documents (checklist, dispatch log, Customized Letters), and Employees (departments, employees, teams, org chart).
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
  await autoAsk(page);
  page.on('pageerror', e => problems.push(`JavaScript error: ${e.message}`));
  page.on('console', m => {
    // a 4xx the test expects shows up here as "Failed to load resource"; real script errors do not
    // The letter preview frame cannot run scripts on purpose; the browser logs that when the test tool reads the frame
    if (m.type() === 'error' && !/Failed to load resource|Blocked script execution in 'about:(srcdoc|blank)'/.test(m.text())) problems.push(`Console error: ${m.text()}`);
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
  expect(links.length).toBe(20);   // 19 plus GST Configuration, which is now also under Set Up (it was only four levels down in Set Projects)
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
  await expect(content().getByText(names.prof, { exact: true })).toBeVisible(); // the list has re-drawn; typing earlier is wiped by it
  await expect(box).toHaveValue('');
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
  await fillDrawer({ name: names.country, abbreviation: 'El', iso_code: 'EL', isd_code: '999', mobile_digits: '10', code: 'EL' }); await saveDrawer();
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
  // the next step opens by itself: the Towers tab, with this project chosen in the guide and in the tower form
  await expect(page.locator('#spj-tower-form')).toBeVisible();
  await expect(page.locator('#spj-tower-project').locator('option:checked')).toHaveText(names.project);
  await page.getByRole('button', { name: 'New Project', exact: true }).click();
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
  await page.getByRole('button', { name: 'One unit' }).click();
  const unit = page.locator('#spj-unit-form');
  const addUnit = async (number: string) => {
    await unit.locator('#spj-unit-project').selectOption({ label: names.project });
    await expect(unit.locator('#spj-unit-tower option', { hasText: names.tower })).toHaveCount(1);
    await unit.locator('#spj-unit-tower').selectOption({ label: names.tower });
    await unit.locator('#spj-unit-type').selectOption({ label: names.unitType });
    await unit.locator('[name=unit_number]').fill(number);
    await unit.locator('[name=floor]').fill('1');
    await unit.locator('#spj-unit-carpet').fill('500');
    await unit.locator('#spj-unit-balcony').fill('50');
    await unit.locator('[name=total_price_inr]').fill('4500000');
    await unit.getByRole('button', { name: 'Add Unit' }).click();
  };
  await addUnit('E2E-101');
  await expect(toast('Unit E2E-101 added')).toBeVisible();
  // after a unit is added the number field holds the suggested next number (E2E-101 -> E2E-102) and the place and type stay
  await expect(unit.locator('[name=unit_number]')).toHaveValue('E2E-102');
  await expect(unit.locator('#spj-unit-type').locator('option:checked')).toHaveText(names.unitType);
  await addUnit('E2E-101');
  await expect(toast('A unit with this number already exists in this tower')).toBeVisible();

  // CSV upload: a file with a row that has no floor is refused as a whole; the corrected file adds 1 new unit and skips 1 that exists
  await page.getByRole('button', { name: 'From a CSV file' }).click();
  await page.locator('#spj-bulk-project').selectOption({ label: names.project });
  const csv = 'tower,floor,unitNumber,bhkType,carpetAreaSqft,superAreaSqft,balconyAreaSqft,basePriceInr,totalPriceInr,facing\n'
    + `${names.tower},2,E2E-201,2BHK,650,750,100,5000000,5000000,North\n`
    + `${names.tower},1,E2E-101,2BHK,650,750,100,5000000,5000000,North\n`
    + `${names.tower},,E2E-301,2BHK,650,750,100,5000000,5000000,North\n`;
  await page.setInputFiles('#spj-bulk-file', { name: 'units.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await page.locator('[data-panel="add-unit"]').getByRole('button', { name: 'Upload' }).click();
  await expect(page.locator('#spj-bulk-result')).toContainText(/nothing was imported.*Row 4 \(E2E-301\)/);
  const fixed = csv.split('\n').filter((l) => !l.includes('E2E-301')).join('\n');
  await page.setInputFiles('#spj-bulk-file', { name: 'units.csv', mimeType: 'text/csv', buffer: Buffer.from(fixed) });
  await page.locator('[data-panel="add-unit"]').getByRole('button', { name: 'Upload' }).click();
  await expect(page.locator('#spj-bulk-result')).toContainText('1 units added · 1 skipped');

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

test('read_only_viewer: Set Master and Set Projects are closed, writes are refused by the server', async () => {
  await logout();
  await login('read_only_viewer');
  for (const hash of ['#/set-master?screen=banks', '#/set-projects?tab=add-tower']) {
    await go(hash);
    await expect(content()).toContainText('Access Denied');
  }
  // the menu does not offer them either
  await expect(page.locator('#navbar .dd-link', { hasText: /^Banks/ })).toHaveCSS('display', 'none');
  const status = await page.evaluate(async () => (await fetch('/api/master/banks', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + Auth.getToken() }, body: JSON.stringify({ name: 'x' }),
  })).status);
  expect(status).toBe(403);
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

// ── 8. Security ────────────────────────────────────────────────────────────
const sec = { role: `e2e_role_${U}`, label: `E2E Role ${U}`, user: `e2e_${U}`, name: `E2E Person ${U}`, email: `e2e.${U}@example.com`, pw: `Pass#${U}9` };
const secDrawer = () => page.locator('#sec-drawer-host aside[role=dialog]');
const userRow = () => page.locator('#sm-main tr', { hasText: sec.email });
const roleRow = () => page.locator('#sm-main tr', { hasText: sec.role });
async function signInAs(email: string, password: string) {
  await page.goto('/pages/login.html');
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill(password);
  await page.locator('button[type=submit]').click();
}

test('security: create a login with process rights, weak password refused', async () => {
  await logout();
  await login('super_admin');
  await go('#/users?tab=permissions');
  await content().getByRole('button', { name: 'New login' }).click();
  await expect(secDrawer()).toBeVisible();
  await secDrawer().locator('[name=username]').fill(sec.user);
  await secDrawer().locator('[name=name]').fill(sec.name);
  await secDrawer().locator('[name=email]').fill(sec.email.toUpperCase());
  await secDrawer().locator('[name=role]').selectOption('accounts_finance');
  await secDrawer().locator('input[name=mk][value=receipt]').check();
  await secDrawer().locator('input[name=ck][value=receipt]').check();
  await secDrawer().locator('[name=password]').fill('short');
  await secDrawer().locator('#sf-pw2').fill('short');
  await secDrawer().getByRole('button', { name: 'Create login' }).click();
  await expect(secDrawer().locator('#sec-form-err')).toContainText('at least 8');
  await secDrawer().locator('[name=password]').fill(sec.pw);
  await secDrawer().locator('#sf-pw2').fill('Different#1');
  await secDrawer().getByRole('button', { name: 'Create login' }).click();
  await expect(secDrawer().locator('#sec-form-err')).toContainText('do not match');
  await secDrawer().locator('#sf-pw2').fill(sec.pw);
  await secDrawer().getByRole('button', { name: 'Create login' }).click();
  await expect(toast('Login created')).toBeVisible();
  await expect(userRow()).toContainText('Receipt MC');
  await expect(userRow()).toContainText('Active');
});

test('security: the new login signs in (email in any letter case) and has only its rights', async () => {
  await logout();
  await signInAs(sec.email.toUpperCase(), sec.pw);
  await page.waitForURL(/#\/dashboard/);
  const me = await page.evaluate(async () => (await (await fetch('/api/users/me', { headers: { authorization: 'Bearer ' + Auth.getToken() } })).json()).data);
  expect(me.role).toBe('accounts_finance');
  expect(me.processPermissions.receipt).toEqual(['maker', 'checker']);
  // not a super admin: no Security menu, and the page itself is closed
  await go('#/users?tab=permissions');
  await expect(content()).toContainText('Access Denied');
  await expect(page.locator('#navbar .dd-link', { hasText: /^Logins and Permissions/ })).toHaveCSS('display', 'none');
});

test('security: edit a login, disable it, and it cannot sign in', async () => {
  await logout();
  await login('super_admin');
  await go('#/users?tab=permissions');
  await userRow().hover();
  await userRow().getByRole('button', { name: 'Edit' }).click();
  await expect(secDrawer()).toBeVisible();
  await secDrawer().locator('[name=mobile]').fill('98765 43210');
  await secDrawer().locator('input[name=mk][value=receipt]').uncheck();
  await secDrawer().locator('input[name=ck][value=receipt]').uncheck();
  await secDrawer().locator('input[name=mk][value=jv_refund_drcr]').check();
  await secDrawer().getByRole('button', { name: 'Save changes' }).click();
  await expect(toast('Login updated')).toBeVisible();
  await expect(userRow()).toContainText('JV/Refund/DrCr M');
  await expect(userRow()).not.toContainText('Receipt');
  // a bad IP address is refused in the IP list
  await userRow().hover();
  await userRow().getByRole('button', { name: 'Edit' }).click();
  await secDrawer().locator('#sec-ip-new').fill('999.1.1.1');
  await secDrawer().getByRole('button', { name: 'Add', exact: true }).click();
  await expect(toast('valid IPv4 or IPv6')).toBeVisible();
  await secDrawer().getByRole('button', { name: 'Cancel' }).click();
  // disable with a confirm
  await userRow().hover();
  await userRow().getByRole('button', { name: 'Disable' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Disable' }).click();
  await expect(toast('Login disabled')).toBeVisible();
  await expect(userRow()).toContainText('Inactive');
  // enabling shows what the login still holds and needs a confirm (UR-011)
  await userRow().hover();
  await userRow().getByRole('button', { name: 'Enable' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('It currently holds');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Enable' }).click();
  await expect(toast('Login enabled')).toBeVisible();
  await expect(userRow()).toContainText('Active');
  // revoke all: disables and removes every grant
  await userRow().hover();
  await userRow().getByRole('button', { name: 'Revoke all' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('cannot be undone');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Revoke all' }).click();
  await expect(toast('All access revoked')).toBeVisible();
  await expect(userRow()).toContainText('Inactive');
  await expect(userRow()).toContainText('None');
  await logout();
  await signInAs(sec.email, sec.pw);
  await expect(page.locator('body')).toContainText(/Invalid email or password/i);
  await page.goto('/');
});

test('security: create a role, give it menu access in the grid, see it persist, delete it', async () => {
  await login('super_admin');
  await go('#/users?tab=roles');
  await content().getByRole('button', { name: 'New role' }).click();
  await expect(secDrawer()).toBeVisible();
  await secDrawer().locator('[name=name]').fill('Bad Name');
  await secDrawer().locator('[name=label]').fill(sec.label);
  await secDrawer().getByRole('button', { name: 'Create role' }).click();
  await expect(secDrawer().locator('#sec-form-err')).toContainText('lowercase');
  await secDrawer().locator('[name=name]').fill(sec.role);
  await secDrawer().locator('[name=baseRole]').selectOption('support_agent');
  await secDrawer().locator('[name=copy]').selectOption('read_only_viewer');
  await secDrawer().getByRole('button', { name: 'Create role' }).click();
  await expect(toast('Role created')).toBeVisible();
  await expect(roleRow()).toContainText('Custom');
  await expect(roleRow()).toContainText('Support Agent');
  // the same name again is refused
  await content().getByRole('button', { name: 'New role' }).click();
  await secDrawer().locator('[name=name]').fill(sec.role);
  await secDrawer().locator('[name=label]').fill('Again');
  await secDrawer().getByRole('button', { name: 'Create role' }).click();
  await expect(secDrawer().locator('#sec-form-err')).toContainText('already exists');
  await secDrawer().getByRole('button', { name: 'Cancel' }).click();
  // menu access: open the grid from the role row, tick Set Master, save
  await roleRow().hover();
  await roleRow().getByRole('button', { name: 'Menu access' }).click();
  await expect(page.locator('#sec-grid')).toBeVisible();
  const box = page.getByRole('checkbox', { name: `${sec.label}: Set Master`, exact: true });
  await expect(box).not.toBeChecked();
  await expect(content().getByRole('button', { name: 'Save changes' })).toBeDisabled();
  await box.check();
  await expect(content().locator('#sec-dirty')).toContainText('1 change');
  await content().getByRole('button', { name: 'Save changes' }).click();
  await expect(toast('Menu access saved')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: `${sec.label}: Set Master`, exact: true })).toBeChecked();
  // delete
  await go('#/users?tab=roles');
  await roleRow().hover();
  await roleRow().getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(toast('Role deleted')).toBeVisible();
  await expect(roleRow()).toHaveCount(0);
});

test('security: giving a role a screen in the grid opens it for that role, taking it away closes it', async () => {
  const cb = () => page.getByRole('checkbox', { name: 'Read Only Viewer: Set Master', exact: true });
  const setGrid = async (on: boolean) => {
    await go('#/users?tab=role-menu');
    await expect(cb()).toBeVisible();
    await (on ? cb().check() : cb().uncheck());
    await content().getByRole('button', { name: 'Save changes' }).click();
    await expect(toast('Menu access saved')).toBeVisible();
  };
  await setGrid(true);
  await logout();
  await login('read_only_viewer');
  await go('#/set-master?screen=banks');
  await expect(content()).not.toContainText('Access Denied');
  await expect(content().getByRole('button', { name: WRITE })).toHaveCount(0); // opened, but still read only
  await logout();
  await login('super_admin');
  await setGrid(false);
  await logout();
  await login('read_only_viewer');
  await go('#/set-master?screen=banks');
  await expect(content()).toContainText('Access Denied');
});

test('security: the audit log shows sign ins and the changes made above', async () => {
  await logout();
  await login('super_admin');
  await go('#/users?tab=audit');
  await expect(page.locator('#au-body table')).toBeVisible();
  await expect(page.locator('#au-body tr', { hasText: 'sign in' }).first()).toBeVisible();
  await page.locator('#au-type').selectOption('role');
  await page.locator('#au-go').click();
  await expect(page.locator('#au-body tr', { hasText: 'delete' }).first()).toBeVisible();
  await expect(page.locator('#au-body')).not.toContainText(sec.pw);
});

// ── 9. Documents ───────────────────────────────────────────────────────────
const doc = { name: `E2E Doc ${U}`, letter: `E2E Letter ${U}`, track: `E2E-TRK-${U}` };
const smRow = (text: string) => page.locator('#sm-main tr[data-row], #sm-main tbody tr', { hasText: text }).last();
async function docRowAction(text: string, action: 'Edit' | 'Delete') {
  const r = smRow(text);
  await expect(r).toBeVisible();
  await r.hover();
  await r.getByRole('button', { name: action, exact: true }).click();
}

test('Document checklist: add, duplicate refused, edit, delete', async () => {
  await logout();
  await login('super_admin');
  await go('#/set-master?screen=checklist');
  await content().getByRole('button', { name: 'Add document' }).click();
  await fillDrawer({ name: doc.name });
  await drawer().locator('[name=required_at]').selectOption('On Agreement');
  await drawer().locator('[name=is_mandatory]').selectOption('yes');
  await saveDrawer();
  await expect(toast('Document added')).toBeVisible();
  await expect(smRow(doc.name)).toContainText('On Agreement');
  await expect(smRow(doc.name)).toContainText('Mandatory');
  await content().getByRole('button', { name: 'Add document' }).click();
  await fillDrawer({ name: doc.name.toLowerCase() });
  await drawer().locator('[name=required_at]').selectOption('On Booking');
  await saveDrawer();
  await expect(drawer().locator('#sm-form-err')).toContainText('already exists');
  await drawer().getByRole('button', { name: 'Cancel' }).click();
  await docRowAction(doc.name, 'Edit');
  await drawer().locator('[name=is_mandatory]').selectOption('no');
  await saveDrawer();
  await expect(toast('Saved')).toBeVisible();
  await expect(smRow(doc.name)).toContainText('Optional');
});

test('Dispatch log: log, search, edit, bad date refused, delete', async () => {
  await go('#/set-master?screen=dispatch');
  const form = page.locator('#sm-dispatch-form');
  await form.locator('[name=document_type]').fill(doc.name);
  await form.getByRole('button', { name: 'Log dispatch' }).click();
  await expect(form.locator('#dd-err')).toContainText('required');
  await form.locator('[name=dispatch_mode]').selectOption('Courier');
  await form.locator('[name=tracking_no]').fill(doc.track);
  await form.getByRole('button', { name: 'Log dispatch' }).click();
  await expect(toast('Dispatch logged')).toBeVisible();
  await expect(smRow(doc.track)).toContainText('Courier');
  // search
  await page.locator('#df-q').fill('no-such-' + U);
  await page.locator('#df-go').click();
  await expect(content()).toContainText('No dispatches found');
  await page.locator('#df-q').fill(doc.track);
  await page.locator('#df-go').click();
  await expect(smRow(doc.track)).toBeVisible();
  // edit
  await docRowAction(doc.track, 'Edit');
  await drawer().locator('[name=dispatch_mode]').selectOption('Speed Post');
  await drawer().locator('[name=dispatched_at]').fill('2999-01-01');
  await saveDrawer();
  await expect(drawer().locator('#sm-form-err')).toContainText('future');
  await drawer().locator('[name=dispatched_at]').fill('');
  await saveDrawer();
  await expect(toast('Saved')).toBeVisible();
  await expect(smRow(doc.track)).toContainText('Speed Post');
  // a document that the log uses cannot be deleted from the checklist
  await go('#/set-master?screen=checklist');
  await docRowAction(doc.name, 'Delete');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(toast(/cannot be deleted|used in/i)).toBeVisible();
  // delete the dispatch entry, then the document
  await go('#/set-master?screen=dispatch');
  await page.locator('#df-q').fill(doc.track);
  await page.locator('#df-go').click();
  await docRowAction(doc.track, 'Delete');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(toast('Deleted')).toBeVisible();
  await go('#/set-master?screen=checklist');
  await docRowAction(doc.name, 'Delete');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(toast('Deleted')).toBeVisible();
  await expect(smRow(doc.name)).toHaveCount(0);
});

test('Customized Letters: make a template, make a numbered letter for an applicant, see it in the register, delete', async () => {
  await go('#/custom-letters?tab=letters');
  await expect(content()).toContainText('Customized Letters');
  await content().getByRole('button', { name: 'New letter' }).click();
  await expect(page.locator('#cle-save')).toBeVisible();
  await page.locator('#cle-project').selectOption({ label: names.project });
  await page.locator('#cle-name').fill(doc.letter);
  await page.locator('#cle-subject').fill('Welcome to {{projectName}}');
  await page.locator('[data-seg=is_ref_no] button', { hasText: 'Yes' }).click();
  await page.locator('#cle-prefix').fill(`E2E/W${U}`);
  // empty letter is refused
  await page.locator('#cle-save').click();
  await expect(page.locator('#cle-err')).toContainText(/content/i);
  // the letter text: the rich editor when it loaded, else the plain box
  const rich = page.locator('.ck-editor__editable');
  if (await rich.count()) { await rich.click(); await page.keyboard.type('Dear '); } else { await page.locator('#cle-body').fill('Dear '); }
  await page.locator('#cle-vars [data-var=consumerName]').click();
  if (await rich.count()) await page.keyboard.type(', welcome.'); else await page.locator('#cle-body').pressSequentially(', welcome.');
  await page.locator('#cle-save').click();
  await expect(toast('Letter created')).toBeVisible();
  await expect(smRow(doc.letter)).toContainText('Ref. no.');
  // the same name again is refused
  await content().getByRole('button', { name: 'New letter' }).click();
  await page.locator('#cle-project').selectOption({ label: names.project });
  await page.locator('#cle-name').fill(doc.letter);
  await page.locator('#cle-subject').fill('x');
  if (await page.locator('.ck-editor__editable').count()) { await page.locator('.ck-editor__editable').click(); await page.keyboard.type('Hello'); } else { await page.locator('#cle-body').fill('Hello'); }
  await page.locator('#cle-save').click();
  await expect(page.locator('#cle-err')).toContainText('already exists');
  await page.locator('#cle-cancel').click();
  // make the letter for the seeded applicant
  await smRow(doc.letter).getByRole('button', { name: 'Make letter' }).click();
  await expect(page.locator('#mk-letter')).toHaveValue(/.+/);
  await page.locator('#mk-go').click();
  await expect(page.locator('#mk-err')).toContainText('applicant');
  // an applicant with no project yet, so the letter's project does not matter
  const who = await page.evaluate(async (nm) => {
    const r = await fetch('/api/consumers', { method: 'POST', headers: { authorization: 'Bearer ' + Auth.getToken(), 'content-type': 'application/json' }, body: JSON.stringify({ name: nm, mobile: '9' + String(Date.now()).slice(-9) }) });
    const j = await r.json();
    return { ok: r.ok, id: j.id || (j.data && j.data.id), name: nm, err: j.error };
  }, `Raj Letter ${U}`);
  expect(who.ok, `test applicant not created: ${who.err}`).toBe(true);
  await page.locator('#mk-cons').fill(`Raj Letter ${U}`);
  await page.locator(`#mk-sug [data-id="${who.id}"]`).click();
  await page.locator('#mk-go').click();
  const frame = page.frameLocator('#mk-frame');
  await expect(frame.locator('body')).toContainText(new RegExp(`Dear ${who.name}, welcome\\.`, 'i')) // the applicant's name is stored with capitals;
  await expect(frame.locator('body')).toContainText(new RegExp(`Ref\\. No\\.: E2E/W${U}/\\d{4}-\\d{2}/0001`));
  // a second letter runs on to 0002
  await page.locator('#mk-go').click();
  await expect(frame.locator('body')).toContainText(/\/0002/);
  // register
  await go('#/custom-letters?tab=register');
  await page.locator('#rg-q').fill(`E2E/W${U}`);
  await page.locator('#rg-go').click();
  await expect(page.locator('#rg-body tr', { hasText: doc.letter })).toHaveCount(2);
  // delete the template; the register keeps its rows
  await go('#/custom-letters?tab=letters');
  await smRow(doc.letter).getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(toast('Letter deleted')).toBeVisible();
  await go('#/custom-letters?tab=register');
  await page.locator('#rg-q').fill(`E2E/W${U}`);
  await page.locator('#rg-go').click();
  await expect(page.locator('#rg-body tr', { hasText: doc.letter })).toHaveCount(2);
});

test('Customized Letters: roles see only what they may use', async () => {
  await logout();
  await login('support_agent');
  await go('#/custom-letters?tab=letters');
  await expect(content().getByRole('button', { name: 'New letter' })).toHaveCount(0);
  await go('#/custom-letters?tab=make');
  await expect(content()).toContainText('cannot make letters');
  await logout();
  await login('sales_executive');
  await go('#/custom-letters?tab=letters');
  await expect(content().getByRole('button', { name: 'New letter' })).toHaveCount(0);
  await expect(page.locator('#mk-go')).toHaveCount(0);
});

// ── 10. Employees ──────────────────────────────────────────────────────────
const emp = { dept: `E2E Dept ${U}`, team: `E2E Team ${U}`, user: `e2e_emp_${U}`, code: `E2E-${U}`, boss: `e2e_boss_${U}`, member: `e2e_mem_${U}` };
const mkLogin = (username: string) => page.evaluate(async ({ username, pw }) => {
  const r = await fetch('/api/users/employee-login', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + Auth.getToken() },
    body: JSON.stringify({ username, email: `${username}@example.com`, password: pw, confirmPassword: pw, role: 'sales_executive' }) });
  return r.status;
}, { username, pw: `Pass#${U}9` });

test('Employees: department add, duplicate refused, edit, head kept', async () => {
  await logout();
  await login('super_admin');
  expect(await mkLogin(emp.user)).toBe(201);
  expect(await mkLogin(emp.boss)).toBe(201);
  expect(await mkLogin(emp.member)).toBe(201);
  await go('#/employees?tab=departments');
  await content().getByRole('button', { name: 'New department' }).click();
  await fillDrawer({ name: emp.dept });
  await drawer().locator('[name=head_user_id]').selectOption({ label: emp.boss });
  await saveDrawer();
  await expect(toast('Department added')).toBeVisible();
  await expect(smRow(emp.dept)).toContainText(emp.boss);
  await content().getByRole('button', { name: 'New department' }).click();
  await fillDrawer({ name: emp.dept.toUpperCase() });
  await saveDrawer();
  await expect(drawer().locator('#sm-form-err')).toContainText('already exists');
  await drawer().getByRole('button', { name: 'Cancel' }).click();
  await docRowAction(emp.dept, 'Edit');
  await drawer().locator('[name=description]').fill('Sales and bookings');
  await saveDrawer();
  await expect(toast('Saved')).toBeVisible();
  await expect(smRow(emp.dept)).toContainText('Sales and bookings');
  await expect(smRow(emp.dept)).toContainText(emp.boss); // editing did not clear the head
});

test('Employees: add an employee, set the manager, a loop is refused, leaving switches the login off', async () => {
  await go('#/employees?tab=employees');
  await content().getByRole('button', { name: 'New employee' }).click();
  await drawer().locator('[name=user_id]').selectOption({ label: emp.boss });
  await drawer().locator('[name=employee_code]').fill(emp.code + 'B');
  await drawer().locator('[name=designation]').fill('Sales Head');
  await saveDrawer();
  await expect(toast('Employee added')).toBeVisible();
  await content().getByRole('button', { name: 'New employee' }).click();
  await drawer().locator('[name=user_id]').selectOption({ label: emp.user });
  await drawer().locator('[name=employee_code]').fill(emp.code);
  await drawer().locator('[name=designation]').fill('Executive');
  await drawer().locator('[name=department_id]').selectOption({ label: emp.dept });
  await drawer().locator('[name=manager_id]').selectOption({ label: emp.boss });
  await drawer().locator('[name=joining_date]').fill('2024-04-01');
  await drawer().locator('[name=mobile_office]').fill('abc');
  await saveDrawer();
  await expect(drawer().locator('#sm-form-err')).toContainText(/mobile/i);
  await drawer().locator('[name=mobile_office]').fill('98765 43210');
  await saveDrawer();
  await expect(toast('Employee added')).toBeVisible();
  await expect(smRow(emp.code)).toContainText(emp.boss);
  // the boss cannot be made to report to the executive
  await docRowAction(emp.code + 'B', 'Edit');
  await drawer().locator('[name=manager_id]').selectOption({ label: emp.user });
  await saveDrawer();
  await expect(drawer().locator('#sm-form-err')).toContainText('loop');
  await drawer().getByRole('button', { name: 'Cancel' }).click();
  // the org chart shows the executive under the boss
  await go('#/employees?tab=tree');
  await expect(page.locator('.org-li', { hasText: emp.boss }).first().locator('.org-li', { hasText: emp.user })).toBeVisible();
  // leaving: the employee is switched off and the login stops
  await go('#/employees?tab=employees');
  await docRowAction(emp.code, 'Edit');
  await drawer().locator('[name=is_active]').selectOption('no');
  await saveDrawer();
  await expect(toast('Saved')).toBeVisible();
  await expect(smRow(emp.code)).toContainText('Inactive');
  await go('#/users?tab=permissions');
  await expect(page.locator('#sm-main tr', { hasText: `${emp.user}@example.com` })).toContainText('Inactive');
});

test('Employees: team with a head and members, then delete', async () => {
  await go('#/employees?tab=teams');
  await content().getByRole('button', { name: 'New team' }).click();
  await fillDrawer({ name: emp.team });
  await drawer().locator('[name=department_id]').selectOption({ label: emp.dept });
  await drawer().locator('[name=team_head_id]').selectOption({ label: emp.boss });
  await saveDrawer();
  await expect(toast('Team added')).toBeVisible();
  await expect(smRow(emp.team)).toContainText(emp.boss);
  await expect(smRow(emp.team)).toContainText('1'); // the head is a member
  await smRow(emp.team).hover();
  await smRow(emp.team).getByRole('button', { name: 'Members' }).click();
  const dr = page.locator('#sec-drawer-host aside[role=dialog]');
  await expect(dr).toContainText(emp.boss);
  await dr.locator('#mb-user').selectOption({ label: emp.member });
  await dr.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(toast('Added')).toBeVisible();
  await expect(dr).toContainText(emp.member);
  await dr.locator('tr', { hasText: emp.member }).getByRole('button', { name: 'Make head' }).click();
  await expect(toast('Head set')).toBeVisible();
  await expect(dr.locator('tr', { hasText: emp.member })).toContainText('Head');
  await dr.getByRole('button', { name: 'Close' }).click();
  // a department that has employees and teams cannot be deleted
  await go('#/employees?tab=departments');
  await docRowAction(emp.dept, 'Delete');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(toast(/use this department/)).toBeVisible();
  await go('#/employees?tab=teams');
  await docRowAction(emp.team, 'Delete');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(toast('Deleted')).toBeVisible();
  await expect(smRow(emp.team)).toHaveCount(0);
});

test('Employees: only super_admin can open it (UR-001); project_manager is denied the page and the API', async () => {
  await logout();
  await login('project_manager');
  for (const tab of ['employees', 'departments']) {
    await go(`#/employees?tab=${tab}`);
    // the route-level guard stops a login that is not super_admin before the screen loads
    await expect(content()).toContainText('Access Denied');
    await expect(content()).toContainText("You don't have permission to view this page");
    await expect(content().getByRole('button', { name: 'New employee' })).toHaveCount(0);
    await expect(content().locator('tr[data-row]')).toHaveCount(0);
  }
  // and the server refuses the data itself, whatever the screen does
  const statuses = await page.evaluate(async () => {
    const out: Record<string, number> = {};
    for (const p of ['/api/employees', '/api/employees/departments', '/api/employees/teams', '/api/employees/report']) out[p] = (await fetch(p, { headers: { authorization: 'Bearer ' + Auth.getToken() } })).status;
    return out;
  });
  expect(statuses).toEqual({ '/api/employees': 403, '/api/employees/departments': 403, '/api/employees/teams': 403, '/api/employees/report': 403 });
  await logout();
  await login('sales_executive');
  await go('#/employees?tab=employees');
  await expect(content()).toContainText('Access Denied');
});

// ── 11. Payment plans ───────────────────────────────────────────────────
const plan = { name: `E2E Plan ${U}`, copy: `E2E Copy ${U} 30+70 & "q" 'x'`, own: `E2E Own ${U}` };
const planRow = (name: string) => content().locator('tr').filter({ hasText: name }).first();

test('Payment Plans: standard plan, a row over 100% is refused, total shows, copy, delete', async () => {
  await logout();
  await login('super_admin');
  await go('#/payment-plans');
  await expect(content()).toContainText('Payment Plans');
  await content().locator('#plx-project').selectOption({ label: names.project });
  // a new plan from the usual 9-row schedule
  await content().getByRole('button', { name: 'New plan' }).click();
  await fillDrawer({ plan_name: plan.name });
  await drawer().locator('[name=start]').selectOption('standard');
  await saveDrawer();
  await expect(content()).toContainText('100% of 100%');
  await expect(content()).toContainText('complete');
  await expect(content().locator('tbody tr')).toHaveCount(9);
  // take a row away: the plan is no longer complete
  await rowAction('1st Half-Yearly', 'Delete');
  await confirmDelete();
  await expect(toast('Row deleted')).toBeVisible();
  await expect(content()).toContainText('12.5% still to add');
  // a row that goes past 100% is refused with the reason
  await content().getByRole('button', { name: 'Add row' }).click();
  await fillDrawer({ installment_name: 'Too big', percentage: '40', installment_index: '20' });
  await drawer().locator('[name=installment_type]').selectOption('installment');
  await saveDrawer();
  await expect(drawer().locator('#sm-form-err')).toContainText('100% at most');
  // a bad percentage and a duplicate name are refused
  await fillDrawer({ percentage: 'abc' });
  await saveDrawer();
  await expect(drawer().locator('#sm-form-err')).toContainText('Percentage');
  await fillDrawer({ installment_name: 'on allotment', percentage: '12.5' });
  await saveDrawer();
  await expect(drawer().locator('#sm-form-err')).toContainText('already has a row');
  // the right row completes the plan
  await fillDrawer({ installment_name: '1st Half-Yearly', percentage: '12.5', installment_index: '3' });
  await saveDrawer();
  await expect(toast('Row added')).toBeVisible();
  await expect(content()).toContainText('100% of 100%');
  // copy the plan, see both in the list, delete the copy
  await content().getByRole('button', { name: 'Copy plan' }).click();
  await fillDrawer({ to: plan.copy });
  await saveDrawer();
  await expect(content()).toContainText(plan.copy);
  await content().getByRole('link', { name: 'Plans' }).click();
  await expect(planRow(plan.name)).toContainText('Complete');
  await expect(planRow(plan.copy)).toContainText('Complete');
  await rowAction(plan.copy, 'Delete');
  await confirmDelete();
  await expect(toast('Plan deleted')).toBeVisible();
  await expect(content()).not.toContainText(plan.copy);
});

test('Payment Plans: old Set Projects plan links land on the new page; the booking form lists only complete plans', async () => {
  await go('#/set-projects?tab=plan-view');
  await expect(content()).toContainText('Payment Plans');
  await expect(page.locator('#navbar')).toContainText('Payment Plan Setup');
  // an incomplete plan is not offered while booking
  await go('#/payment-plans');
  await content().locator('#plx-project').selectOption({ label: names.project });
  await content().getByRole('button', { name: 'New plan' }).click();
  await fillDrawer({ plan_name: plan.own });
  await saveDrawer();
  await content().getByRole('button', { name: 'Add row' }).click();
  await fillDrawer({ installment_name: 'Booking', percentage: '10' });
  await drawer().locator('[name=installment_type]').selectOption('booking');
  await saveDrawer();
  await expect(content()).toContainText('90% still to add');
  await go('#/booking');
  await expect(page.locator('#bk-payment-plan')).toBeAttached();
  const offered = await page.evaluate(async (project) => {
    const list = (await (await fetch('/api/projects', { headers: { authorization: 'Bearer ' + Auth.getToken() } })).json()).data;
    await (window as any).BookingPage.loadPaymentPlans(list.find((p: any) => p.name === project).id);
    return Array.from((document.getElementById('bk-payment-plan') as HTMLSelectElement).options).map((o) => o.textContent).join('|');
  }, names.project);
  expect(offered).toContain(plan.name);
  expect(offered).not.toContain(plan.own);
});

test('Payment Plans: project_manager adds but cannot delete; sales_executive only looks', async () => {
  await logout();
  await login('project_manager');
  await go('#/payment-plans');
  await content().locator('#plx-project').selectOption({ label: names.project });
  await expect(content().getByRole('button', { name: 'New plan' })).toBeVisible();
  await expect(content().locator('[data-act=del]')).toHaveCount(0);
  await logout();
  await login('sales_executive');
  await go('#/payment-plans');
  await expect(content()).toContainText('Access Denied'); // same as Set Projects: the page is for project managers and admins
  const status = await page.evaluate(async () => (await fetch('/api/projects/00000000-0000-0000-0000-000000000000/plans/standard', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + Auth.getToken() }, body: JSON.stringify({ plan_name: 'x' }),
  })).status);
  expect(status).toBe(403); // and the server says no even if the page is skipped
});

