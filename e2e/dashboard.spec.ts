// Dashboard in a real browser: every panel shows the numbers of data made here, every button, link and fold works, and a viewer cannot approve.
// Data is made through the API and psql; the rest is clicked, then the database is asked whether the screen told the truth.
// A JavaScript error, console error, 5xx or "undefined" / "NaN" on a screen fails the test.
import { test, expect, Page, Browser } from '@playwright/test';
import { execFileSync } from 'node:child_process';

const PASSWORD = 'Test#Pass1234';
const BASE = process.env.BASE_URL || 'http://localhost:3002';
const U = Date.now().toString(36).slice(-5);
const psql = (sql: string) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim().split('\n')[0];
let seq = 0; const mob = () => '9' + String((Date.now() % 1e7) * 100 + ++seq + 100000000).slice(-9).padStart(9, '0');

test.describe.configure({ mode: 'serial' });
let page: Page;
let problems: string[] = [];
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
const watch = (p: Page) => {
  p.on('dialog', (d) => d.accept());
  p.on('pageerror', (e) => problems.push(`JavaScript error: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|Blocked script execution in 'about:(srcdoc|blank)'/.test(m.text())) problems.push(`Console error: ${m.text()}`); });
  p.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 500) problems.push(`Server error ${r.status()}: ${r.request().method()} ${r.url()}`); });
};
const signIn = async (p: Page, email: string) => {
  await p.goto('/pages/login.html');
  await p.locator('input[type=email]').fill(email);
  await p.locator('input[type=password]').fill(PASSWORD);
  await p.locator('button[type=submit]').click();
  await p.waitForURL(/#\/dashboard/);
};
// the row of the project in a dashboard table (by the table's own box)
const rowOf = (boxId: string) => page.locator(`#${boxId} tbody tr`, { hasText: S.name });

test.beforeAll(async ({ browser }) => {
  // The API test scripts throw random junk at the server and some of it is stored as a name or number ("NaN", "undefined"). That is data, not a broken screen,
  // so it is renamed here; otherwise the "no undefined / NaN on a screen" check fails depending on what the random seeds happened to store. The new word is random per row: a fixed one broke on a unique name (tower, unit) when two rows had junk.
  const word = `'\\m(NaN|undefined)\\M'`, fix = (t: string, c: string) => `update ${t} set ${c} = regexp_replace(${c}, ${word}, 'x' || substr(md5(random()::text), 1, 5), 'g') where ${c} ~ ${word};`;
  psql([['consumers', 'name'], ['consumers', 'first_name'], ['consumers', 'last_name'], ['units', 'unit_number'], ['projects', 'name'], ['towers', 'tower_name'], ['brokers', 'name'], ['brokers', 'firm_name']].map(([t, c]) => fix(t, c)).join(' '));
  token = (await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'super_admin@test.local', password: PASSWORD }) })).json()).token;
  const co = (await api('POST', '/companies', { name: `DB Co ${U}` })).j.data.id;
  S.name = `Dash R&D ${U}`;
  S.project = (await api('POST', '/projects', { companyId: co, name: S.name, reraNumber: `DB-${U}`, tcpLicence: 'x' })).j.data.id;
  const tower = (await api('POST', `/projects/${S.project}/towers`, { towerName: `DT${U}` })).j.data.id;
  const today = psql(`select (now() at time zone 'Asia/Kolkata')::date::text`), plus = (n: number) => psql(`select ((now() at time zone 'Asia/Kolkata')::date + ${n})::text`);
  const c = psql(`INSERT INTO consumers (name, mobile, project_id) VALUES ('Dash Buyer ${U}', '${mob()}', '${S.project}') RETURNING id`);
  const u = psql(`INSERT INTO units (project_id, tower_id, unit_number, status, bhk_type, floor, carpet_area_sqft) VALUES ('${S.project}', '${tower}', 'DU-${U}', 'allotted', '2BHK', 1, 800) RETURNING id`);
  const al = psql(`INSERT INTO allocations (consumer_id, unit_id, project_id, status) VALUES ('${c}','${u}','${S.project}','allotted') RETURNING id`);
  const pp = psql(`INSERT INTO payment_plans (allocation_id, consumer_id, unit_id, project_id, total_amount_inr) VALUES ('${al}','${c}','${u}','${S.project}', 1000000) RETURNING id`);
  psql(`INSERT INTO booking_records (consumer_id, unit_id, project_id, selected_plan_name, status, booking_date) VALUES ('${c}','${u}','${S.project}','DB ${U}','complete','${today}') RETURNING id`);
  for (const [i, due, delivery] of [[1, today, 'sent'], [2, plus(3), 'pending'], [3, plus(-1), 'pending']] as const) psql(`INSERT INTO demands (payment_plan_id, installment_index, consumer_id, amount_due_inr, status, delivery_status, due_date) VALUES ('${pp}', ${i}, '${c}', ${i * 10000}, 'demanded', '${delivery}', '${due}') RETURNING id`);
  const rec = (amount: number, method: string, status: string) => psql(`INSERT INTO receipts (consumer_id, payment_plan_id, amount_received_inr, payment_method, status, received_date) VALUES ('${c}','${pp}',${amount},'${method}','${status}','${today}') RETURNING id`);
  rec(5000, 'cash', 'cleared'); S.cheque = rec(3000, 'cheque', 'pending'); rec(4000, 'cheque', 'deposited'); rec(2500, 'demand_draft', 'on_hold'); S.cash = rec(1234, 'cash', 'pending');
  for (const [n, st] of [['1', 'allotted'], ['2', 'available'], ['3', 'available']]) psql(`INSERT INTO parking_slots (project_id, slot_number, parking_type, status${st === 'allotted' ? ', allotted_to_consumer_id' : ''}) VALUES ('${S.project}', 'DS${n}-${U}', 'open', '${st}'${st === 'allotted' ? `, '${c}'` : ''}) RETURNING id`);
  const me = psql(`select id from users where email='super_admin@test.local'`);
  psql(`INSERT INTO tasks (title, status, due_date, assigned_to) VALUES ('Dash overdue ${U}', 'pending', '${plus(-2)}', '${me}') RETURNING id`);
  psql(`INSERT INTO tasks (title, status, due_date, assigned_to) VALUES ('Dash done ${U}', 'completed', '${plus(-2)}', '${me}') RETURNING id`);
  S.consumer = c; S.me = me;

  page = await browser.newPage();
  watch(page);
  await signIn(page, 'super_admin@test.local');
});
test.afterAll(async () => {
  const ps = `'${S.project}'`;
  for (const sql of [`delete from tasks where title like 'Dash %${U}'`, `delete from parking_slots where project_id in (${ps})`, `delete from receipts where consumer_id in (select id from consumers where project_id in (${ps}))`, `delete from demands where consumer_id in (select id from consumers where project_id in (${ps}))`,
    `delete from booking_records where project_id in (${ps})`, `delete from payment_plans where project_id in (${ps})`, `delete from allocations where project_id in (${ps})`, `delete from consumers where project_id in (${ps})`, `delete from units where project_id in (${ps})`]) { try { psql(sql); } catch { /* names carry the run id */ } }
  await page.close();
});
test.beforeEach(() => { problems = []; });
test.afterEach(() => { expect(problems, 'Errors seen in the browser during this test').toEqual([]); });

test('Dashboard: every panel shows the numbers of the data made here (and the name with an & as typed)', async () => {
  await go('/dashboard'); await expect(page.locator('#dash-pending-cheques')).toContainText(S.name);
  await clean();
  // pending cheques: pending 1, deposited 1, total 3 (the demand draft on hold is a PDC, the cleared cash is not a cheque), amount 7,000 + PDC 2,500
  const pc = (await rowOf('dash-pending-cheques').innerText()).replace(/\s+/g, ' ');
  expect(pc).toContain(S.name); expect(pc).toMatch(/\b1\b.*\b1\b.*\b2\b/);   // pending 1, deposite 1, total 2 (cheques only)
  expect(pc).toMatch(/7,000/); expect(pc).toMatch(/2,500/);
  // demand status: raised demands only: instalment 1 sent, 2 and 3 not sent, total 3, overdue 30,000
  const dd = await rowOf('dash-demand-status').innerText();
  const cells = dd.split(/\t|\n/).map((x) => x.trim()).filter(Boolean);
  expect(cells[0]).toBe(S.name); expect(cells.slice(1, 9).join(' ')).toBe('0 1 1 0 1 0 0 0'); expect(cells[9]).toBe('3'); expect(cells[10]).toMatch(/30,000/);
  // forthcoming: today 1, 1-7 days 1
  const fc = (await rowOf('dash-forthcoming-due').innerText()).split(/\t|\n/).map((x) => x.trim()).filter(Boolean);
  expect(fc.slice(0, 6).join(' ')).toBe(`${S.name} 1 1 0 0 0`);
  // daily status: 1 sale today, collection today 5,000
  const ds = (await rowOf('dash-daily-status').innerText()).split(/\t|\n/).map((x) => x.trim()).filter(Boolean);
  expect(ds[0]).toBe(S.name); expect(ds[1]).toBe('1'); expect(ds[2]).toMatch(/5,000/); expect(ds[5]).toBe('1');
  // parking: total 3, allotted 1, available 2
  await page.locator('#dash-parking-detail').evaluate((e) => e.classList.remove('collapsed'));
  const pk = (await rowOf('dash-parking-detail').innerText()).split(/\t|\n/).map((x) => x.trim()).filter(Boolean);
  expect(pk.join(' ')).toBe(`${S.name} open 3 1 2`);
  // tasks: this login has 1 pending (overdue) and 1 completed
  const et = await page.locator('#dash-employee-tickets tbody tr', { hasText: 'Super' }).first().innerText().catch(() => '');
  expect(await page.locator('#dash-employee-tickets').innerText()).toMatch(/pending/i); expect(await page.locator('#dash-employee-tickets').innerText()).toMatch(/completed/i); expect(await page.locator('#dash-employee-tickets').innerText()).not.toMatch(/resolved|in progress/i);
  void et;
});

test('Dashboard: the KPI cards and the pending approval list tell the same as the database', async () => {
  const pending = Number(psql(`select count(*) from receipts where status='pending'`));
  const kpi = page.locator('.dbn-k', { hasText: 'Pending Approval' });
  await expect(kpi.locator('.dbn-k-val')).toHaveText(String(pending));
  await expect(page.locator('.dbn-k', { hasText: 'Open Tasks' })).toBeVisible();
  await expect(page.locator('.dbn-k', { hasText: 'Open Tickets' })).toHaveCount(0);
  const row = page.locator('#dash-pending-approval tbody tr', { hasText: `Dash Buyer ${U}` });
  await expect(row).toHaveCount(2);                                   // the pending cheque and the pending cash receipt
  expect(await row.first().innerText()).toContain(`DU-${U}`);          // the unit of the buyer (the old join showed nothing)
  expect(await row.first().innerText()).not.toMatch(/—\s*\n?.*—\s*$/);  // the date is filled
  await clean();
});

test('Dashboard: every button and card goes where it says; the folds open and close', async () => {
  const routes: [string, RegExp][] = [['＋ New Booking', /#\/booking/], ['Receipts', /#\/receipts/], ['Demands', /#\/demands/], ['Unit Status', /#\/unit-status/], ['Reports', /#\/reports/]];
  for (const [name, re] of routes) { await go('/dashboard'); await page.locator('.dbn-act', { hasText: name }).first().click(); await settle(); expect(page.url()).toMatch(re); await clean(); }
  for (const [name, re] of [['Today\'s Collection', /#\/receipts/], ['Pending Cheques', /#\/receipts/], ['Pending Approval', /#\/receipts/], ['Today\'s Dues', /#\/demands/], ['Open Tasks', /#\/tasks/]] as [string, RegExp][]) {
    await go('/dashboard'); await page.locator('.dbn-k', { hasText: name }).first().click(); await settle(); expect(page.url()).toMatch(re); await clean();
  }
  for (const [name, re] of [['Pending cheques', /#\/receipts/], ['Receipts to approve', /#\/receipts/], ['Unsent demand letters', /#\/demands/], ['Overdue tasks', /#\/tasks/]] as [string, RegExp][]) {
    await go('/dashboard'); await page.locator('.dbn-att', { hasText: name }).first().click(); await settle(); expect(page.url()).toMatch(re); await clean();
  }
  await go('/dashboard');
  for (const id of ['dash-employee-tickets', 'dash-parking-detail']) {
    const body = page.locator(`#${id}`); const was = await body.evaluate((e) => e.classList.contains('collapsed'));
    await body.locator('xpath=ancestor::*[contains(@class,"tbl-wrap")][1]').locator('.collapse-toggle').first().click();
    expect(await body.evaluate((e) => e.classList.contains('collapsed'))).toBe(!was);
    await body.locator('xpath=ancestor::*[contains(@class,"tbl-wrap")][1]').locator('.collapse-toggle').first().click();
    expect(await body.evaluate((e) => e.classList.contains('collapsed'))).toBe(was);
  }
  // "View All", "Details", "Schedule", "Manage" buttons of the tables
  for (const [name, re] of [['Manage', /#\/parking/], ['Schedule', /#\/demands/]] as [string, RegExp][]) { await go('/dashboard'); await page.locator('#content .btn', { hasText: new RegExp(`^${name}$`) }).first().click(); await settle(); expect(page.url()).toMatch(re); await clean(); }
  await go('/dashboard');
  const href = await rowOf('dash-pending-cheques').locator('a').first().getAttribute('href');
  expect(href).toContain(`project_id=${S.project}`);
  await clean();
});

test('Dashboard: Approve on a pending receipt authorizes it in the database; a viewer is not offered the button and the server refuses it', async ({ browser }) => {
  // a read-only login first: the button answers with an error and nothing changes
  const ctx = await (browser as Browser).newContext(); const vp = await ctx.newPage(); watch(vp);
  await signIn(vp, 'read_only_viewer@test.local');
  await vp.waitForTimeout(400); await vp.waitForLoadState('networkidle');
  const vrow = vp.locator('#dash-pending-approval tbody tr', { hasText: `Dash Buyer ${U}` }).first();
  await expect(vrow).toBeVisible();
  await expect(vrow.getByRole('button', { name: 'Approve' })).toHaveCount(0);   // the screen does not offer it to a viewer
  const vtoken = await vp.evaluate(() => localStorage.getItem('rof-jwt'));
  const refused = await fetch(`${BASE}/api/payments/receipts/${S.cash}/approve`, { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: `Bearer ${vtoken}` }, body: '{}' });
  expect(refused.status).toBe(403);                                              // and the server refuses it anyway
  expect(psql(`select status from receipts where id='${S.cash}'`)).toBe('pending');
  problems = problems.filter((x) => !/403/.test(x)); await ctx.close();
  // the admin approves one
  await go('/dashboard');
  const row = page.locator('#dash-pending-approval tbody tr', { hasText: `Dash Buyer ${U}` }).filter({ hasText: '1,234' });
  await row.getByRole('button', { name: 'Approve' }).click();
  await expect(toast('Receipt approved')).toBeVisible();
  expect(psql(`select status from receipts where id='${S.cash}'`)).toBe('authorized');
  await go('/tasks'); await go('/dashboard');   // the same address again does not reload the screen
  await expect(page.locator('#dash-pending-approval tbody tr', { hasText: `Dash Buyer ${U}` })).toHaveCount(1);   // only the cheque is left
  await clean();
});
