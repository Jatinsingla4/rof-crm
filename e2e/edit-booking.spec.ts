// Edit Booking Form in a real browser: search, open a booking, change applicant and booking fields, save, bad values, cancelled booking.
// Set-up through the API; after each save the database is asked whether it did what the screen said.
import { test, expect, Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { bizToday, bizDate } from '../docs/_shared/business-date.mjs';

const PASSWORD = 'Test#Pass1234';
const BASE = process.env.BASE_URL || 'http://localhost:3002';
const U = Date.now().toString(36).slice(-5);
const today = bizToday();
const later = (d: number) => bizDate(Date.now() + d * 864e5);
let seq = 0;
const mob = () => '9' + String((Date.now() % 1e7) * 100 + ++seq + 300000000).slice(-9).padStart(9, '0');
const sql = (q: string) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8' }).trim();

test.describe.configure({ mode: 'serial' });
test.use({ actionTimeout: 15_000 });
let page: Page;
let problems: string[] = [];
let token = '';
const api = async (method: string, path: string, body?: any) => {
  const r = await fetch(`${BASE}/api${path}`, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
  let j: any = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
};
const must = async (label: string, p: Promise<{ s: number; j: any }>) => { const x = await p; if (x.s >= 300) throw new Error(`${label}: ${x.s} ${JSON.stringify(x.j).slice(0, 300)}`); return x.j.data ?? x.j; };
const S: Record<string, any> = {};

test.beforeAll(async ({ browser }) => {
  token = (await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'super_admin@test.local', password: PASSWORD }) })).json()).token;
  const co = (await must('company', api('POST', '/companies', { name: `EB Co ${U}` }))).id;
  S.projectName = `EB Project ${U}`;
  S.project = (await must('project', api('POST', '/projects', { companyId: co, name: S.projectName, reraNumber: `EBX-${U}`, tcpLicence: 'x' }))).id;
  const tower = (await must('tower', api('POST', `/projects/${S.project}/towers`, { towerName: `EBT-${U}` }))).id;
  S.plan = `EB Plan ${U}`; let k = 0;
  for (const pc of [20, 30, 50]) await must('plan', api('POST', `/projects/${S.project}/plan-templates`, { plan_name: S.plan, installment_name: `Row ${++k}`, installment_type: k === 1 ? 'booking' : 'installment', percentage: pc, due_date_offset_days: k * 30, installment_index: k }));
  let slab = (await api('GET', '/gst-configuration/gst-slabs')).j.data.find((x: any) => x.from_date <= today && x.to_date >= today)?.id;
  if (!slab) slab = (await must('slab', api('POST', '/gst-configuration/gst-slabs', { fromDate: later(-3), toDate: later(60) }))).id;
  const tax = (await must('tax', api('POST', '/gst-configuration/gst-tax-setup', { slabId: slab, gstCode: `EB ${U}`, type: 'INTRA', cgstPct: 2.5, sgstPct: 2.5 }))).id;
  for (const ct of ['BASIC', 'PLC', 'OTHER CHARGE']) await api('POST', '/gst-configuration/gst-charge-mapping', { projectId: S.project, slabId: slab, gstTaxId: tax, chargeType: ct });
  S.people = [];
  for (const i of [1, 2]) {
    const c = (await must('applicant', api('POST', '/consumers', { first_name: 'Editme', last_name: `Person${i} ${U}`, mobile: mob(), project_id: S.project }))).id;
    const u = (await must('unit', api('POST', '/units', { projectId: S.project, towerId: tower, unitNumber: `EU${i}-${U}`, floor: 2, bhkType: '2BHK', carpetAreaSqft: 1000, superAreaSqft: 1200, basePriceInr: 9000000, totalPriceInr: 9500000 }))).id;
    const b = await must('booking', api('POST', '/booking', { consumer_id: c, project_id: S.project, unit_id: u, selected_plan_name: S.plan, booking_date: today }));
    S.people.push({ c, b: b.id, unit: `EU${i}-${U}` });
  }
  page = await browser.newPage();
  page.on('dialog', d => { S.lastDialog = d.message(); d.accept(); });
  page.on('pageerror', e => problems.push(`JavaScript error: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) problems.push(`Console error: ${m.text()}`); });
  page.on('response', r => { if (r.url().includes('/api/') && r.status() >= 500) problems.push(`Server error ${r.status()}: ${r.request().method()} ${r.url()}`); });
  await page.goto('/pages/login.html');
  await page.locator('input[type=email]').fill('super_admin@test.local');
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.locator('button[type=submit]').click();
  await page.waitForURL(/#\/dashboard/);
});
test.afterAll(async () => { await page.close(); });
test.beforeEach(() => { problems = []; });
test.afterEach(async () => {
  const text = await page.locator('#content').innerText().catch(() => '');
  if (/\bundefined\b|\bNaN\b/.test(text)) problems.push(`The screen shows "undefined" or "NaN": ${text.match(/.{0,40}(undefined|NaN).{0,40}/)?.[0]}`);
  expect(problems, 'Errors seen in the browser during this test').toEqual([]);
});

const open = async (unit: string) => {
  await page.evaluate(() => { location.hash = '/dashboard'; });
  await expect(page.locator('#eb-project')).toHaveCount(0);
  await page.evaluate(() => { location.hash = '/edit-booking'; });
  await expect(page.locator('#eb-project option', { hasText: S.projectName }).first()).toBeAttached();
  await page.locator('#eb-project').selectOption({ label: S.projectName });
  await page.locator('#eb-unitno').fill(unit);
  await page.locator('#eb-fetch-btn').click();
  await expect(page.locator('#eb-tbody tr')).toHaveCount(1);
  await page.locator('.eb-edit-link').click();
  await expect(page.locator('#eb-first-name')).toBeVisible();
};

test('Edit Booking: search finds the booking, the form shows the saved values', async () => {
  await open(S.people[0].unit);
  const row = sql(`select c.mobile from consumers c where c.id = '${S.people[0].c}'`);
  await expect(page.locator('#eb-mobile')).toHaveValue(row);
  await expect(page.locator('#eb-booking-date')).toHaveValue(today);
});

test('Edit Booking: change name, mobile, address and remarks, save, database matches', async () => {
  await open(S.people[0].unit);
  const m = mob();
  await page.locator('#eb-first-name').fill('Renamed');
  await page.locator('#eb-last-name').fill(`Buyer${U}`);
  await page.locator('#eb-mobile').fill(m);
  await page.locator('#eb-present-address').fill('Flat 4, Green Park');
  await page.locator('#eb-remarks').fill('edited by browser test');
  await page.locator('.eb-btn', { hasText: 'SAVE' }).click();
  await expect(page.locator('#eb-banner')).toContainText(/saved/i);
  expect(sql(`select first_name || '|' || mobile || '|' || present_address from consumers where id = '${S.people[0].c}'`)).toBe(`Renamed|${m}|Flat 4, Green Park`);
  expect(sql(`select remarks from booking_records where id = '${S.people[0].b}'`)).toBe('edited by browser test');
  expect(Number(sql(`select count(*) from audit_logs where resource_id = '${S.people[0].b}' and action = 'update'`))).toBeGreaterThan(0);
});

test('Edit Booking: bad values are refused and nothing changes', async () => {
  await open(S.people[0].unit);
  const before = sql(`select mobile from consumers where id = '${S.people[0].c}'`);
  await page.locator('#eb-mobile').fill('12345');
  await page.locator('.eb-btn', { hasText: 'SAVE' }).click();
  await expect(page.locator('#eb-banner')).toContainText(/error/i);
  expect(sql(`select mobile from consumers where id = '${S.people[0].c}'`)).toBe(before);
  await page.locator('#eb-mobile').fill(before);
  await page.locator('#eb-rebate-pct').fill('150');
  await page.locator('.eb-btn', { hasText: 'SAVE' }).click();
  await expect(page.locator('#eb-banner')).toContainText(/error/i);
  await page.locator('#eb-rebate-pct').fill('');
  S.lastDialog = ''; await page.locator('#eb-first-name').fill('');
  await page.locator('.eb-btn', { hasText: 'SAVE' }).click();
  expect(S.lastDialog).toMatch(/first name/i);
});

test('Edit Booking: mobile of another applicant in the project is refused', async () => {
  await open(S.people[1].unit);
  const other = sql(`select mobile from consumers where id = '${S.people[0].c}'`);
  const mine = sql(`select mobile from consumers where id = '${S.people[1].c}'`);
  await page.locator('#eb-mobile').fill(other);
  await page.locator('.eb-btn', { hasText: 'SAVE' }).click();
  await expect(page.locator('#eb-banner')).toContainText(/error/i);
  expect(sql(`select mobile from consumers where id = '${S.people[1].c}'`)).toBe(mine);
});

test('Edit Booking: a cancelled booking cannot be edited', async () => {
  await open(S.people[1].unit);
  await must('cancel', api('POST', `/booking/${S.people[1].b}/cancel`, { reason: 'browser test' }));
  await page.locator('#eb-remarks').fill('after cancel');
  await page.locator('.eb-btn', { hasText: 'SAVE' }).click();
  await expect(page.locator('#eb-banner')).toContainText(/cancelled/i);
  expect(sql(`select coalesce(remarks,'') from booking_records where id = '${S.people[1].b}'`)).not.toBe('after cancel');
});
