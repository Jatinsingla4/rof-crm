// Broker and Investor / Hold, clicked through the real screens in a real browser: the Broker menu (Application Form, Broker List, Commission Setup, Broker Setup,
// Sold-Unit Report) and the Investor / Hold menu (Inventory Governance: Active Holds, Hold History, New Hold).
// One real flow: register a broker, approve it, set its tax, book a unit through it, check the commission on screen and in the database, pay it,
// cancel the booking and see what happens to the commission; hold a unit, try to book it as someone else, release it, let a hold expire.
// The set-up (project, plan, units) is made through the API; the screens are used like a person would, and after a screen acts the database is asked
// whether it did what it showed. A JavaScript error, a console error, a 5xx or the words "undefined" / "NaN" on the page fail the test.
import { test, expect, Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { bizToday, bizDate } from '../docs/_shared/business-date.mjs';

const PASSWORD = 'Test#Pass1234';
const BASE = process.env.BASE_URL || 'http://localhost:3002';
const U = Date.now().toString(36).slice(-5);
const today = bizToday();
const later = (d: number) => bizDate(Date.now() + d * 864e5);
let seq = 0;
const mob = () => '9' + String((Date.now() % 1e7) * 100 + ++seq + 100000000).slice(-9).padStart(9, '0');
const LET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const PAN = Array.from({ length: 5 }, () => LET[Math.floor(Math.random() * LET.length)]).join('') + String(1000 + Math.floor(Math.random() * 9000)) + LET[Math.floor(Math.random() * LET.length)];
const sql = (q: string) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8' }).trim();

test.describe.configure({ mode: 'serial' });
test.use({ actionTimeout: 15_000 });   // a click on something hidden fails in 15 s, not at the end of the test
let page: Page;
let problems: string[] = [];
let dialogs: string[] = [];
let token = '';
const api = async (method: string, path: string, body?: any) => {
  const r = await fetch(`${BASE}/api${path}`, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
  let j: any = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
};
const must = async (label: string, p: Promise<{ s: number; j: any }>) => { const x = await p; if (x.s >= 300) throw new Error(`${label}: ${x.s} ${JSON.stringify(x.j).slice(0, 300)}`); return x.j.data ?? x.j; };
const S: Record<string, any> = {};
const TOWER = `BHT-${U}`;

test.beforeAll(async ({ browser }) => {
  token = (await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'super_admin@test.local', password: PASSWORD }) })).json()).token;
  const co = (await must('company', api('POST', '/companies', { name: `BH Co ${U}` }))).id;
  S.projectName = `BH Project ${U}`;
  S.project = (await must('project', api('POST', '/projects', { companyId: co, name: S.projectName, reraNumber: `BHX-${U}`, tcpLicence: 'x' }))).id;
  S.tower = (await must('tower', api('POST', `/projects/${S.project}/towers`, { towerName: TOWER }))).id;
  S.plan = `BH Plan ${U}`; let k = 0;
  for (const pc of [20, 30, 50]) await must('plan', api('POST', `/projects/${S.project}/plan-templates`, { plan_name: S.plan, installment_name: `Row ${++k}`, installment_type: k === 1 ? 'booking' : 'installment', percentage: pc, due_date_offset_days: k * 30, installment_index: k }));
  let slab = (await api('GET', '/gst-configuration/gst-slabs')).j.data.find((x: any) => x.from_date <= today && x.to_date >= today)?.id;
  if (!slab) slab = (await must('slab', api('POST', '/gst-configuration/gst-slabs', { fromDate: later(-3), toDate: later(60) }))).id;
  const tax = (await must('tax', api('POST', '/gst-configuration/gst-tax-setup', { slabId: slab, gstCode: `BH ${U}`, type: 'INTRA', cgstPct: 2.5, sgstPct: 2.5 }))).id;
  for (const ct of ['BASIC', 'PLC', 'OTHER CHARGE']) await api('POST', '/gst-configuration/gst-charge-mapping', { projectId: S.project, slabId: slab, gstTaxId: tax, chargeType: ct });
  S.units = [];
  for (let i = 1; i <= 6; i++) S.units.push((await must('unit', api('POST', '/units', { projectId: S.project, towerId: S.tower, unitNumber: `BU${i}-${U}`, floor: i, bhkType: '2BHK', carpetAreaSqft: 1000, superAreaSqft: 1200, basePriceInr: 9000000, totalPriceInr: 9500000 }))).id);

  page = await browser.newPage();
  page.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
  page.on('pageerror', e => problems.push(`JavaScript error: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|Blocked script execution in 'about:(srcdoc|blank)'/.test(m.text())) problems.push(`Console error: ${m.text()}`); });
  page.on('response', r => { if (r.url().includes('/api/') && r.status() >= 500) problems.push(`Server error ${r.status()}: ${r.request().method()} ${r.url()}`); });
  await page.goto('/pages/login.html');
  await page.locator('input[type=email]').fill('super_admin@test.local');
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.locator('button[type=submit]').click();
  await page.waitForURL(/#\/dashboard/);
});
test.afterAll(async () => { await page.close(); });
test.beforeEach(() => { problems = []; dialogs = []; });
test.afterEach(async () => {
  const text = await page.locator('#content').innerText().catch(() => '');
  if (/\bundefined\b|\bNaN\b/.test(text)) problems.push(`The screen shows "undefined" or "NaN": ${text.match(/.{0,40}(undefined|NaN).{0,40}/)?.[0]}`);
  expect(problems, 'Errors seen in the browser during this test').toEqual([]);
});

// the same address again re-opens the screen (a change of the address alone would not)
const go = (hash: string) => page.evaluate((h) => { if (location.hash === '#' + h) (window as any).Router ? (window as any).Router.dispatch() : eval('Router.dispatch()'); else location.hash = h; }, hash);
const content = () => page.locator('#content');
const toast = (t: string | RegExp) => page.locator('.toast', { hasText: t }).first();
const money = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const tab = (name: string) => content().locator('.tab-line', { hasText: name }).first().click();
const menu = async (top: string, item: string, sub?: string) => {
  await page.locator('.nav-btn', { hasText: new RegExp('^' + top) }).click();
  if (sub) { await page.locator('.dd-link.has-sub', { hasText: item }).click(); await page.locator('.sub-dd .dd-link', { hasText: sub }).click(); }
  else await page.locator('.dd-link', { hasText: item }).first().click();
};

// ---------------------------------------------------------------- menus
test('Menus: every Broker and Investor / Hold entry opens its screen', async () => {
  await menu('Broker', 'Broker Application Form');
  await expect(content()).toContainText('Broker Application Form'); await expect(page.locator('.tab-line.active')).toHaveText('Application Form');
  await menu('Broker', 'Broker List');
  await expect(page.locator('.tab-line.active')).toHaveText('Broker List'); await expect(page.locator('#brk-list-body')).toBeVisible();
  await menu('Broker', 'Commission Setup');
  await expect(page.locator('.tab-line.active')).toHaveText('Commission Setup'); await expect(page.locator('#brk-comm-kpis')).toBeVisible();
  await menu('Broker', 'Broker Setup');
  await expect(content()).toContainText('Broker Tax Configuration'); await expect(page.locator('#broker-tax-table')).toBeVisible();
  await menu('Broker', 'Broker Reports', 'Broker Sold-Unit Report');
  await expect(page.locator('.tab-line.active')).toHaveText('Sold-Unit Report'); await expect(page.locator('#brk-rpt-kpis')).toBeVisible();
  await menu('Investor / Hold', 'Inventory Governance');
  await expect(content()).toContainText('Inventory Governance'); await expect(page.locator('.tab-line.active')).toHaveText('Active Holds');
});

// ---------------------------------------------------------------- Application form
test('Application Form: a bad form is refused with a message, a good one registers a pending broker that is stored as typed', async () => {
  await go('/brokers?tab=form');
  const form = page.locator('#brk-app-form');
  await expect(form).toBeVisible();
  S.firm = `Shree Estates ${U}`; S.bmob = mob();
  await form.locator('[name=firm_name]').fill(S.firm);
  await form.locator('[name=mobile]').fill('12345');
  await form.getByRole('button', { name: 'Register Broker' }).click();
  await expect(page.locator('#brk-form-result .alert-danger')).toContainText(/mobile/i);
  expect(sql(`select count(*) from brokers where firm_name = '${S.firm}'`)).toBe('0');
  await form.locator('[name=mobile]').fill(S.bmob);
  await form.locator('[name=pan_no]').fill('ABC123'); await form.getByRole('button', { name: 'Register Broker' }).click();
  await expect(page.locator('#brk-form-result .alert-danger')).toContainText(/PAN/i);
  await form.locator('[name=pan_no]').fill(PAN.toLowerCase());
  await form.locator('[name=commission_rate]').fill('150'); await form.getByRole('button', { name: 'Register Broker' }).click();   // the box holds at most 100 (browser check) or the server says no
  expect(sql(`select count(*) from brokers where firm_name = '${S.firm}'`)).toBe('0');
  await form.locator('[name=commission_rate]').fill('1.75');
  await form.locator('[name=contact_person]').fill('Ramesh Kumar'); await form.locator('[name=alt_mobile]').fill(mob());
  await form.locator('[name=email]').fill(`broker${U}@mail.test`); await form.locator('[name=rera_no]').fill(`RERA-AG-${U}`);
  await form.locator('[name=address]').fill('Plot 4, Sector 14'); await form.locator('[name=city]').fill('Gurugram');
  await form.locator('[name=state]').selectOption('Haryana'); await form.locator('[name=pin_code]').fill('122001');
  await form.locator('[name=bank_account_name]').fill('Shree Estates'); await form.locator('[name=bank_account_no]').fill('123456789012');
  await form.locator('[name=bank_ifsc]').fill('HDFC0001234'); await form.locator('[name=bank_branch]').fill('Sector 14');
  await form.locator('[name=remarks]').fill('first broker ' + U);
  await form.getByRole('button', { name: 'No', exact: true }).click();
  await expect(form.locator('[name=gst_on_commission]')).toHaveValue('no');
  await form.getByRole('button', { name: 'Yes (18%)' }).click();
  await expect(form.locator('[name=gst_on_commission]')).toHaveValue('yes');
  await form.getByRole('button', { name: 'Register Broker' }).click();
  await expect(page.locator('#brk-form-result'), 'the result box').toContainText(/registered.*pending/i);
  const r = sql(`select status, commission_pct, pan, city, state, pin_code, contact_person, rera_number, bank_account_details->>'accountNo', bank_account_details->>'ifsc', email, remarks from brokers where firm_name = '${S.firm}'`);
  expect(r).toBe(`pending|1.75|${PAN}|Gurugram|Haryana|122001|Ramesh Kumar|RERA-AG-${U}|123456789012|HDFC0001234|broker${U}@mail.test|first broker ${U}`);
  expect(sql(`select count(*) from broker_tax_config where broker_id = (select id from brokers where firm_name = '${S.firm}')`)).toBe('0');   // GST "Yes": default setup
  S.broker = sql(`select id from brokers where firm_name = '${S.firm}'`);
  await expect(form.locator('[name=firm_name]')).toHaveValue('');   // the form is cleared after saving
  // the same mobile again
  await form.locator('[name=firm_name]').fill('Second ' + U); await form.locator('[name=mobile]').fill(S.bmob);
  await form.getByRole('button', { name: 'Register Broker' }).click();
  await expect(page.locator('#brk-form-result .alert-danger')).toContainText(/already exists/i);
  // GST "No" is saved as a GST exempt tax setup; Clear empties the form
  await form.locator('[name=mobile]').fill(mob()); await form.getByRole('button', { name: 'No', exact: true }).click();
  await form.getByRole('button', { name: 'Register Broker' }).click();
  await expect(page.locator('#brk-form-result .alert-success')).toBeVisible();
  expect(sql(`select is_gst_exempt from broker_tax_config where broker_id = (select id from brokers where firm_name = 'Second ${U}')`)).toBe('t');
  S.second = sql(`select id from brokers where firm_name = 'Second ${U}'`);
  await form.locator('[name=firm_name]').fill('to be cleared'); await form.getByRole('button', { name: 'Clear' }).click();
  await expect(form.locator('[name=firm_name]')).toHaveValue('');
  await expect(form.locator('[name=gst_on_commission]')).toHaveValue('yes');
});

// ---------------------------------------------------------------- Broker List
test('Broker List: search, approve, reject, view, suspend, deactivate and activate', async () => {
  await go('/brokers?tab=list');
  const body = page.locator('#brk-list-body');
  const row = (name: string) => body.locator('tr', { hasText: name });
  await expect(row(S.firm)).toHaveCount(1);
  await expect(row(S.firm)).toContainText('Pending'); await expect(row(S.firm)).toContainText('1.75%'); await expect(row(S.firm)).toContainText('Gurugram'); await expect(row(S.firm)).toContainText('Ramesh Kumar');
  await expect(row(S.firm).getByRole('button', { name: 'Approve' })).toBeVisible(); await expect(row(S.firm).getByRole('button', { name: 'Reject' })).toBeVisible();
  await page.locator('#brk-search').fill('zzz-no-such-broker'); await expect(body).toContainText('No brokers match');
  await page.locator('#brk-search').fill(S.bmob); await expect(body.locator('tbody tr')).toHaveCount(1); await expect(row(S.firm)).toHaveCount(1);
  await page.locator('#brk-search').fill(''); await expect(row(S.firm)).toHaveCount(1);
  // approve
  await row(S.firm).getByRole('button', { name: 'Approve' }).click();
  await expect(toast(/Broker approved/i)).toBeVisible();
  await expect(row(S.firm)).toContainText('Active');
  expect(sql(`select status || '|' || (approved_by is not null) from brokers where id = '${S.broker}'`)).toBe('active|true');
  // reject the second one
  await row('Second ' + U).getByRole('button', { name: 'Reject' }).click();
  await expect(toast(/Broker rejected/i)).toBeVisible(); await expect(row('Second ' + U)).toContainText('Rejected');
  expect(sql(`select status from brokers where id = '${S.second}'`)).toBe('rejected');
  await expect(row('Second ' + U).getByRole('button')).toHaveCount(0);   // nothing more to do with a rejected broker
  // view
  await row(S.firm).getByRole('button', { name: 'View' }).click();
  await expect.poll(() => dialogs.join('\n')).toContain(`RERA-AG-${U}`);
  expect(dialogs.join('\n')).toMatch(/Gurugram, Haryana/); expect(dialogs.join('\n')).toMatch(/Commission: 1.75%/); expect(dialogs.join('\n')).toMatch(new RegExp('PAN: ' + PAN));
  // suspend, activate, deactivate, activate
  await row(S.firm).getByRole('button', { name: 'Suspend' }).click();
  await expect(toast(/suspended/i)).toBeVisible(); await expect(row(S.firm)).toContainText('Suspended');
  expect(sql(`select status from brokers where id = '${S.broker}'`)).toBe('suspended');
  await row(S.firm).getByRole('button', { name: 'Activate' }).click(); await expect(row(S.firm)).toContainText('Active');
  await row(S.firm).getByRole('button', { name: 'Deactivate' }).click(); await expect(toast(/deactivated/i)).toBeVisible(); await expect(row(S.firm)).toContainText('Inactive');
  expect(sql(`select status from brokers where id = '${S.broker}'`)).toBe('inactive');
  await row(S.firm).getByRole('button', { name: 'Activate' }).click(); await expect(row(S.firm)).toContainText('Active');
  expect(sql(`select status from brokers where id = '${S.broker}'`)).toBe('active');
  // projects: tick one, save, it is stored; another project is then refused for this broker; clearing frees it again
  await row(S.firm).getByRole('button', { name: 'Projects' }).click();
  const box = page.locator(`#brk-map-list label`, { hasText: S.projectName }).locator('input');
  await expect(box).not.toBeChecked(); await box.check(); await page.getByRole('button', { name: 'Save projects' }).click();
  await expect(toast(/Projects saved/i)).toBeVisible();
  expect(sql(`select count(*) from broker_project_mapping where broker_id = '${S.broker}' and project_id = '${S.project}'`)).toBe('1');
  await row(S.firm).getByRole('button', { name: 'Projects' }).click();
  await expect(page.locator(`#brk-map-list label`, { hasText: S.projectName }).locator('input')).toBeChecked();
  await page.locator(`#brk-map-list label`, { hasText: S.projectName }).locator('input').uncheck(); await page.getByRole('button', { name: 'Save projects' }).click();
  await expect(toast(/every project/i)).toBeVisible();
  expect(sql(`select count(*) from broker_project_mapping where broker_id = '${S.broker}'`)).toBe('0');
  await row(S.firm).getByRole('button', { name: 'Projects' }).click(); await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('#brk-map-panel')).toBeEmpty();
  // the Register Broker button opens the form, the tab buttons switch back
  await page.getByRole('button', { name: '+ Register Broker' }).click();
  await expect(page.locator('.tab-line.active')).toHaveText('Application Form'); await expect(page.locator('#brk-app-form')).toBeVisible();
  await tab('Broker List'); await expect(body).toBeVisible();
  // another tab and back keeps the list
  await tab('Commission Setup'); await tab('Broker List'); await expect(row(S.firm)).toHaveCount(1);
});

// ---------------------------------------------------------------- Broker Setup (tax)
test('Broker Setup: a new broker shows Not set (no default rates), Edit saves TDS and GST, a bad rate is refused, Cancel changes nothing', async () => {
  await go('/broker-setup');
  const row = page.locator('#broker-tax-body tr', { hasText: S.firm });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Not set'); await expect(row).not.toContainText('5%'); await expect(row).not.toContainText('18%'); await expect(row).toContainText('cannot be paid until set');
  await row.getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('#bs-tds')).toHaveValue(''); await expect(page.locator('#bs-gst')).toHaveValue('');
  await page.locator('#bs-tds').fill('150'); await page.locator('#bs-gst').fill('18'); await page.getByRole('button', { name: 'Save' }).click();
  await expect(toast(/TDS rate/i)).toBeVisible();
  expect(sql(`select count(*) from broker_tax_config where broker_id = '${S.broker}'`)).toBe('0');
  await page.locator('#bs-tds').fill(''); await page.getByRole('button', { name: 'Save' }).click();
  await expect(toast(/both rates/i)).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(row).toContainText('Not set');
  await row.getByRole('button', { name: 'Edit' }).click();
  await page.locator('#bs-tds').fill('10'); await page.locator('#bs-gst').fill('12'); await page.locator('#bs-exempt').selectOption('no');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(toast(/Tax setup saved/i)).toBeVisible();
  await expect(row).toContainText('10%'); await expect(row).toContainText('12%'); await expect(row).not.toContainText('cannot be paid until set');
  expect(sql(`select tds_rate_pct || '|' || gst_rate_pct || '|' || is_gst_exempt from broker_tax_config where broker_id = '${S.broker}'`)).toBe('10.00|12.00|false');
  // the rejected broker is not offered
  await expect(page.locator('#broker-tax-body tr', { hasText: 'Second ' + U })).toHaveCount(0);
});

// ---------------------------------------------------------------- booking through the broker
test('Booking: book a unit through the broker (2% of the basic price), the form lists only active brokers', async () => {
  await go('/booking');
  await expect(content()).toContainText(/unit information/i);
  // a broker who is not active (the rejected one) is not on the list; the active one is
  await expect(page.locator('#bk-broker-id option', { hasText: S.firm })).toHaveCount(1);
  await expect(page.locator('#bk-broker-id option', { hasText: 'Second ' + U })).toHaveCount(0);
  await content().locator('select[name=project_id]').selectOption({ label: S.projectName });
  await page.waitForTimeout(500);
  await content().locator('select[name=bhk_type]').selectOption({ index: 1 });
  await page.waitForTimeout(300);
  await page.locator('#bk-tower').selectOption({ label: TOWER });
  await page.locator('#bk-floor').selectOption({ label: /^1/ as any }).catch(async () => { await page.locator('#bk-floor').selectOption({ index: 1 }); });
  await page.locator('#bk-unit-select').selectOption({ index: 1 });
  S.mobile = mob();
  await page.locator('#bk-indiv-fields input[name=first_name]').fill(`Broker${U}`);
  await page.locator('#bk-indiv-fields input[name=last_name]').fill('Buyer');
  await page.locator('#bk-indiv-fields input[name=mobile]').fill(S.mobile);
  await page.locator('#bk-payment-plan').selectOption({ label: new RegExp(S.plan) as any }).catch(async () => { await page.locator('#bk-payment-plan').selectOption({ index: 1 }); });
  await page.locator('#bk-indiv-fields input[name=email]').fill(`bk${U}@mail.test`);
  await page.locator('textarea[name=present_address_line1]').fill('12 Test Road, Sector 9');
  await page.locator('#bk-broker-id').selectOption({ label: S.firm });
  await page.locator('#bk-broker-commission-type').selectOption('percent');
  await page.locator('#bk-broker-commission').fill('2');
  await page.locator('#bk-proceed-btn').click();
  await page.waitForTimeout(2500);
  await expect(page).toHaveURL(/#\/booking-payment\?id=/);
  S.booking = new URL(page.url().replace('#/', '')).searchParams.get('id');
  const b = (await api('GET', `/booking/${S.booking}`)).j.data;
  S.consumer = b.consumer_id; S.unit = b.unit_id;
  expect(b.broker_id).toBe(S.broker); expect(b.booking_type).toBe('broker');
  S.commission = sql(`select id from broker_commissions where consumer_id = '${S.consumer}' and unit_id = '${S.unit}'`);
  expect(S.commission).not.toBe('');
  // 2% of the basic price, to the paisa
  S.amount = Number(sql(`select commission_amount_inr from broker_commissions where id = '${S.commission}'`));
  expect(sql(`select (round((case when br.basic_rate_inr_sqft > 0 and u.carpet_area_sqft > 0 then br.basic_rate_inr_sqft * u.carpet_area_sqft else u.base_price_inr end) * 2) / 100) = ${S.amount} from booking_records br join units u on u.id = br.unit_id where br.id = '${S.booking}'`)).toBe('t');
  expect(S.amount).toBeGreaterThan(0);
  expect(sql(`select status from broker_commissions where id = '${S.commission}'`)).toBe('pending');
});

test('Commission Setup: nothing is paid before the booking amount is in; after the payment step the commission is paid once, with GST and TDS', async () => {
  // the booking is still waiting for its payment: the commission is on the list, paying it is refused
  await go('/brokers?tab=commission');
  const row = () => page.locator('#brk-comm-body tr', { hasText: S.firm }).filter({ hasText: `Broker${U}` });
  await expect(row()).toHaveCount(1);
  await expect(row()).toContainText(money(S.amount)); await expect(row()).toContainText('2%'); await expect(row()).toContainText('Pending');
  await row().getByRole('button', { name: 'Mark Paid' }).click();
  await expect(toast(/booking amount/i)).toBeVisible();
  expect(sql(`select status from broker_commissions where id = '${S.commission}'`)).toBe('pending');
  // the booking payment step
  await go(`/booking-payment?id=${S.booking}`);
  await expect(content()).toContainText(/Record payment for booking/);
  await page.locator('#bkp-ptab-cash').click();
  await page.locator('#bkp-amt-cash').fill('25000');
  await page.locator('#bkp-confirm-btn').click();
  await expect(page.getByText('Payment Confirmed!')).toBeVisible();
  await go('/brokers?tab=commission');   // leaving the page closes the confirmation
  await expect(page.getByText('Payment Confirmed!')).toHaveCount(0);
  expect(sql(`select status from booking_records where id = '${S.booking}'`)).toBe('complete');
  // on the commission screen
  await go('/brokers?tab=commission');
  await expect(row()).toHaveCount(1);
  // filters: this broker only (the totals are then this broker's), then the status filters
  await page.locator('#brk-comm-broker').selectOption({ label: S.firm });
  await page.getByRole('button', { name: 'FETCH' }).click();
  const kpi = (label: string) => page.locator('#brk-comm-kpis .brkn-kpi', { hasText: label }).locator('.brkn-kpi-v');
  await expect(kpi('Total Commissions')).toHaveText('1'); await expect(kpi('Total Amount')).toHaveText(money(S.amount));
  await expect(kpi('Pending Payout')).toHaveText(money(S.amount)); await expect(kpi('Total Paid')).toHaveText(money(0));
  await page.locator('#brk-comm-status').selectOption('paid'); await page.getByRole('button', { name: 'FETCH' }).click();
  await expect(page.locator('#brk-comm-body')).toContainText('No commission records');
  await page.locator('#brk-comm-status').selectOption('cancelled'); await page.getByRole('button', { name: 'FETCH' }).click();
  await expect(page.locator('#brk-comm-body')).toContainText('No commission records');
  await page.locator('#brk-comm-status').selectOption('pending'); await page.getByRole('button', { name: 'FETCH' }).click();
  await expect(row()).toHaveCount(1);
  // pay it
  await row().getByRole('button', { name: 'Mark Paid' }).click();
  await expect(toast(/marked as paid/i)).toBeVisible();
  expect(dialogs.join('\n')).toMatch(/GST and TDS/);
  const gst = Math.round(S.amount * 12) / 100, tds = Math.round(S.amount * 10) / 100, net = Math.round((S.amount + gst - tds) * 100) / 100;
  await page.locator('#brk-comm-status').selectOption(''); await page.getByRole('button', { name: 'FETCH' }).click();
  await expect(row()).toContainText('Paid');
  await expect(row()).toContainText(money(gst)); await expect(row()).toContainText(money(tds)); await expect(row()).toContainText(money(net));
  await expect(row().getByRole('button', { name: 'Mark Paid' })).toHaveCount(0);
  expect(sql(`select status || '|' || gst_amount || '|' || tds_amount || '|' || net_amount_inr || '|' || (paid_by is not null) from broker_commissions where id = '${S.commission}'`)).toBe(`paid|${gst.toFixed(2)}|${tds.toFixed(2)}|${net.toFixed(2)}|true`);
  await expect(kpi('Total Paid')).toHaveText(money(S.amount)); await expect(kpi('Pending Payout')).toHaveText(money(0)); await expect(kpi('Total Amount')).toHaveText(money(S.amount));
  // a second payment (another screen, a double click) is refused
  expect((await api('PATCH', `/brokers/commission/${S.commission}`, { status: 'paid' })).s).toBe(409);
  expect(sql(`select count(*) from audit_logs where resource_type = 'broker_commission' and resource_id = '${S.commission}'`)).toBe('1');
  // the broker list shows what was paid
  await tab('Broker List');
  await expect(page.locator('#brk-list-body tr', { hasText: S.firm })).toContainText(money(S.amount));
});

test('Sold-Unit Report: filters by broker, project and dates, the totals match the commission', async () => {
  await go('/brokers?tab=sold-unit-report');
  await page.locator('#brk-rpt-broker').selectOption({ label: S.firm });
  await page.locator('#brk-rpt-project').selectOption({ label: S.projectName });
  await page.locator('#brk-rpt-from').fill(today); await page.locator('#brk-rpt-to').fill(today);
  await page.getByRole('button', { name: 'FETCH' }).last().click();
  const row = page.locator('#brk-rpt-body tr', { hasText: `Broker${U}` });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(S.firm); await expect(row).toContainText(money(S.amount)); await expect(row).toContainText(money(25000)); await expect(row).toContainText('Paid');
  await expect(page.locator('#brk-rpt-total')).toHaveText('1');
  await expect(page.locator('#brk-rpt-comm')).toHaveText(money(S.amount)); await expect(page.locator('#brk-rpt-paid')).toHaveText(money(S.amount)); await expect(page.locator('#brk-rpt-pending')).toHaveText(money(0));
  // tomorrow onwards: nothing
  await page.locator('#brk-rpt-from').fill(later(1)); await page.locator('#brk-rpt-to').fill(later(3));
  await page.getByRole('button', { name: 'FETCH' }).last().click();
  await expect(page.locator('#brk-rpt-body')).toContainText('No broker-sold units');
  await expect(page.locator('#brk-rpt-total')).toHaveText('0');
  await page.locator('#brk-rpt-from').fill(''); await page.locator('#brk-rpt-to').fill('');
  await page.locator('#brk-rpt-project').selectOption({ index: 0 }); await page.locator('#brk-rpt-broker').selectOption({ index: 0 });
  await page.getByRole('button', { name: 'FETCH' }).last().click();
  await expect(row).toHaveCount(1);
});

// ---------------------------------------------------------------- cancelling a booking
test('Cancel: a booking cancelled before it is paid cancels its commission; a paid commission stays paid and says so', async () => {
  // the booking made on the screen is complete and paid: it is cancelled through its allotment (a cancellation with forfeiture)
  const alloc = (await api('GET', `/allocations?consumerId=${S.consumer}&status=all`)).j.data.find((a: any) => a.unit_id === S.unit);
  expect(alloc, 'the booking made an allotment').toBeTruthy();
  expect((await api('POST', `/booking/${S.booking}/cancel`, { reason: 'x' })).s, 'a complete booking is cancelled through Surrender').toBe(409);
  const c = await api('POST', `/allocations/${alloc.id}/cancel`, {});
  expect(c.s, JSON.stringify(c.j)).toBeLessThan(300);
  expect(sql(`select status from booking_records where id = '${S.booking}'`)).toBe('cancelled');
  expect(sql(`select status || '|' || (notes like '%recover it from the broker%') from broker_commissions where id = '${S.commission}'`)).toBe('paid|true');
  expect(sql(`select status from units where id = '${S.unit}'`)).toBe('available');
  await go('/brokers?tab=commission');
  const row = page.locator('#brk-comm-body tr', { hasText: S.firm }).filter({ hasText: `Broker${U}` });
  await expect(row).toContainText('Paid');
  // a second booking, cancelled before any payment: the commission is cancelled and cannot be paid
  const c2 = (await must('applicant', api('POST', '/consumers', { name: `Cancel Buyer ${U}`, mobile: mob(), project_id: S.project }))).id;
  const bk = await must('booking', api('POST', '/booking', { consumer_id: c2, project_id: S.project, unit_id: S.units[1], selected_plan_name: S.plan, booking_date: today, booking_type: 'broker', broker_id: S.broker, broker_commission: 7000.5, broker_commission_type: 'flat' }));
  const cm2 = sql(`select id from broker_commissions where consumer_id = '${c2}'`);
  expect(sql(`select commission_amount_inr from broker_commissions where id = '${cm2}'`)).toBe('7000.50');
  expect((await api('POST', `/booking/${bk.id}/cancel`, { reason: 'changed mind ' + U })).s).toBe(200);
  expect(sql(`select status from broker_commissions where id = '${cm2}'`)).toBe('cancelled');
  expect((await api('PATCH', `/brokers/commission/${cm2}`, { status: 'paid' })).s).toBe(409);
  await go('/brokers?tab=commission');
  await page.locator('#brk-comm-status').selectOption('cancelled'); await page.getByRole('button', { name: 'FETCH' }).click();
  const row2 = page.locator('#brk-comm-body tr', { hasText: `Cancel Buyer ${U}` });
  await expect(row2).toHaveCount(1); await expect(row2).toContainText('Cancelled'); await expect(row2).toContainText(money(7000.5));
  await expect(row2.getByRole('button', { name: 'Mark Paid' })).toHaveCount(0);
  // the cancelled one is not counted as a sale or as money owed
  await go('/brokers?tab=sold-unit-report');
  await page.locator('#brk-rpt-broker').selectOption({ label: S.firm }); await page.getByRole('button', { name: 'FETCH' }).last().click();
  await expect(page.locator('#brk-rpt-body tr', { hasText: `Cancel Buyer ${U}` })).toHaveCount(0);
  await expect(page.locator('#brk-rpt-pending')).toHaveText(money(0));
});

// ---------------------------------------------------------------- Inventory Governance (holds)
test('Inventory Governance: New Hold needs a unit and a broker, then holds the unit; it shows under Active Holds with the broker and client', async () => {
  await go('/inventory-hold');
  await expect(page.locator('#active-holds-body')).toBeVisible();
  await tab('New Hold');
  await page.getByRole('button', { name: 'Create Hold' }).click();
  await expect(toast(/Unit and Broker are required/i)).toBeVisible();
  await page.locator('#hold-project').selectOption({ label: S.projectName });
  await expect(page.locator('#hold-tower option', { hasText: TOWER })).toHaveCount(1);
  await page.locator('#hold-tower').selectOption({ label: TOWER });
  await expect(page.locator('#hold-unit option', { hasText: `BU3-${U}` })).toHaveCount(1);
  await page.locator('#hold-unit').selectOption({ label: `BU3-${U} (3F)` });
  await page.getByRole('button', { name: 'Create Hold' }).click();
  await expect(toast(/Unit and Broker are required/i)).toBeVisible();
  await expect(page.locator('#hold-broker option', { hasText: 'Second ' + U })).toHaveCount(0);   // a rejected broker is not offered
  await page.locator('#hold-broker').selectOption({ label: S.firm });
  await page.locator('#hold-client-name').fill(`Hold Client ${U}`); await page.locator('#hold-client-mobile').fill('12');
  await page.getByRole('button', { name: 'Create Hold' }).click();
  await expect(toast(/mobile/i)).toBeVisible();
  expect(sql(`select count(*) from unit_holds where unit_id = '${S.units[2]}'`)).toBe('0');
  await page.locator('#hold-client-mobile').fill(mob()); await page.locator('#hold-duration').selectOption('48');
  await page.locator('#hold-notes').fill('note ' + U);
  await page.getByRole('button', { name: 'Create Hold' }).dblclick();
  await expect(toast(/Unit held successfully/i)).toBeVisible();
  // back on Active Holds
  const row = page.locator('#active-holds-body tr', { hasText: `BU3-${U}` });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(S.firm); await expect(row).toContainText(`Hold Client ${U}`); await expect(row).toContainText(S.projectName); await expect(row).toContainText(TOWER);
  expect(sql(`select count(*) from unit_holds where unit_id = '${S.units[2]}' and status = 'active'`), 'the double click made one hold').toBe('1');
  expect(sql(`select status from units where id = '${S.units[2]}'`)).toBe('held');
  expect(sql(`select abs(extract(epoch from (expires_at - held_at)) - 172800) < 5 from unit_holds where unit_id = '${S.units[2]}'`)).toBe('t');
  S.holdId = sql(`select id from unit_holds where unit_id = '${S.units[2]}' and status = 'active'`);
  // a held unit is no longer offered for a new hold
  await tab('New Hold'); await page.locator('#hold-project').selectOption({ label: S.projectName });
  await expect(page.locator('#hold-tower option', { hasText: TOWER })).toHaveCount(1);
  await page.locator('#hold-tower').selectOption({ label: TOWER });
  await expect(page.locator('#hold-unit option', { hasText: `BU4-${U}` })).toHaveCount(1);
  await expect(page.locator('#hold-unit option', { hasText: `BU3-${U}` })).toHaveCount(0);
});

test('A held unit cannot be booked or held by someone else, the booking screen shows it as Held and does not let it be picked, the holder can book it', async () => {
  // the API refuses another broker, a direct sale, and a second hold
  const c = (await must('applicant', api('POST', '/consumers', { name: `Rival Buyer ${U}`, mobile: mob(), project_id: S.project }))).id;
  const mk = (extra: any) => api('POST', '/booking', { consumer_id: c, project_id: S.project, unit_id: S.units[2], selected_plan_name: S.plan, booking_date: today, booking_amount: 20000, payment_mode: 'cash', ...extra });
  const other = (await must('broker', api('POST', '/brokers', { firmName: `Rival Brokers ${U}`, mobile: mob() }))).id; S.other = other;
  await must('approve', api('PATCH', `/brokers/${other}/approve`, {}));
  let x = await mk({ booking_type: 'broker', broker_id: other, broker_commission: 1, broker_commission_type: 'percent' }); expect(x.s, JSON.stringify(x.j)).toBe(409); expect(x.j.error).toMatch(/held by/i);
  x = await mk({ booking_type: 'direct' }); expect(x.s).toBe(409);
  expect((await api('POST', '/inventory-hold', { unitId: S.units[2], brokerId: other })).s).toBe(409);
  expect(sql(`select status from units where id = '${S.units[2]}'`)).toBe('held');
  expect(sql(`select count(*) from booking_records where unit_id = '${S.units[2]}'`)).toBe('0');
  // on the booking screen the held unit is not in the list of units
  await go('/booking');
  await content().locator('select[name=project_id]').selectOption({ label: S.projectName });
  await page.waitForTimeout(500);
  await content().locator('select[name=bhk_type]').selectOption({ index: 1 });
  await page.waitForTimeout(300);
  await page.locator('#bk-tower').selectOption({ label: TOWER });
  await page.locator('#bk-floor').selectOption({ label: /^3/ as any }).catch(() => {});
  const heldOpt = page.locator('#bk-unit-select option', { hasText: `BU3-${U}` });
  await expect(heldOpt).toHaveCount(1); await expect(heldOpt).toBeDisabled(); await expect(heldOpt).toContainText('Held');
  // the broker who holds it books it: the hold becomes converted
  x = await mk({ booking_type: 'broker', broker_id: S.broker, broker_commission: 1, broker_commission_type: 'percent' });
  expect(x.s, JSON.stringify(x.j)).toBe(201);
  expect(sql(`select status from unit_holds where id = '${S.holdId}'`)).toBe('converted');
  expect(sql(`select count(*) from unit_holds where unit_id = '${S.units[2]}' and status = 'active'`)).toBe('0');
  expect(sql(`select status from units where id = '${S.units[2]}'`)).not.toMatch(/available|held/);
  await go('/inventory-hold');
  await expect(page.locator('#active-holds-body tr', { hasText: `BU3-${U}` })).toHaveCount(0);
  await tab('Hold History');
  const hist = page.locator('#history-holds-body tr', { hasText: `BU3-${U}` });
  await expect(hist).toHaveCount(1); await expect(hist).toContainText('Converted'); await expect(hist).toContainText(`Hold Client ${U}`);
});

test('Release: Unhold frees the unit and moves the hold to Hold History; a second release is refused; the unit can be held again', async () => {
  const u = S.units[3];
  const h = await must('hold', api('POST', '/inventory-hold', { unitId: u, brokerId: S.broker, clientName: `Release Client ${U}`, holdHours: 24 }));
  await go('/inventory-hold');
  const row = page.locator('#active-holds-body tr', { hasText: `BU4-${U}` });
  await expect(row).toHaveCount(1);
  await row.getByRole('button', { name: 'Unhold' }).click();
  await expect(toast(/Hold released/i)).toBeVisible();
  expect(dialogs.join('\n')).toMatch(/release this unit hold/i);
  await expect(row).toHaveCount(0);
  expect(sql(`select status from units where id = '${u}'`)).toBe('available');
  expect(sql(`select status || '|' || (released_by is not null) from unit_holds where id = '${h.id}'`)).toBe('cancelled|true');
  await tab('Hold History');
  const hist = page.locator('#history-holds-body tr', { hasText: `BU4-${U}` });
  await expect(hist).toHaveCount(1); await expect(hist).toContainText('Cancelled');
  expect((await api('POST', `/inventory-hold/${h.id}/unhold`)).s).toBe(409);
  // held and released again: it used to fail the second time
  for (let i = 0; i < 2; i++) { const x = await api('POST', '/inventory-hold', { unitId: u, brokerId: S.broker }); expect(x.s, JSON.stringify(x.j)).toBe(201); expect((await api('POST', `/inventory-hold/${x.j.data.id}/unhold`)).s).toBe(200); }
  await go('/inventory-hold'); await tab('Hold History');
  await expect(page.locator('#history-holds-body tr', { hasText: `BU4-${U}` })).toHaveCount(3);
});

test('Expiry: a hold whose time is up disappears from Active Holds, shows as Expired in Hold History, and the unit is free', async () => {
  const u = S.units[4];
  const h = await must('hold', api('POST', '/inventory-hold', { unitId: u, brokerId: S.broker, clientName: `Expiry Client ${U}`, holdHours: 1 }));
  await go('/inventory-hold');
  await expect(page.locator('#active-holds-body tr', { hasText: `BU5-${U}` })).toHaveCount(1);
  sql(`update unit_holds set expires_at = now() - interval '2 minutes' where id = '${h.id}'`);
  await go('/brokers?tab=list'); await go('/inventory-hold');
  await expect(page.locator('#active-holds-body tr', { hasText: `BU5-${U}` })).toHaveCount(0);
  await expect.poll(() => sql(`select status from units where id = '${u}'`)).toBe('available');   // the sweep runs beside the list, so the database is polled
  await expect.poll(() => sql(`select status from unit_holds where id = '${h.id}'`)).toBe('expired');
  await tab('Hold History');
  const hist = page.locator('#history-holds-body tr', { hasText: `Expiry Client ${U}` });
  await expect(hist).toHaveCount(1); await expect(hist).toContainText('Expired');
  // a deactivated broker loses its holds
  const u2 = S.units[5];
  await must('hold', api('POST', '/inventory-hold', { unitId: u2, brokerId: S.other, clientName: `Rival Client ${U}` }));
  await go('/inventory-hold'); await expect(page.locator('#active-holds-body tr', { hasText: `BU6-${U}` })).toHaveCount(1);
  await must('suspend', api('PATCH', `/brokers/${S.other}/status`, { status: 'suspended' }));
  await go('/brokers?tab=list'); await go('/inventory-hold');
  await expect(page.locator('#active-holds-body tr', { hasText: `BU6-${U}` })).toHaveCount(0);
  await expect.poll(() => sql(`select status from units where id = '${u2}'`)).toBe('available');
  // the hold screen offers only active brokers
  await tab('New Hold');
  await expect(page.locator('#hold-broker option', { hasText: `Rival Brokers ${U}` })).toHaveCount(0);
  await expect(page.locator('#hold-broker option', { hasText: S.firm })).toHaveCount(1);
});
