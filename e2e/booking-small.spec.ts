// Three small things on the booking screens, in a real browser:
//  1. the unit list says which area it shows (the price is made from the CARPET area, not the super area),
//  2. a name keeps a capital after a hyphen or an apostrophe (Qa-Alok, O'Brien),
//  3. an amount that cannot be saved (0) is said so next to the box on the payment screen, and the GST the server quotes for a good amount is shown.
import { test, expect, Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';

const PASSWORD = 'Test#Pass1234';
const BASE = process.env.BASE_URL || 'http://localhost:3002';
const U = Date.now().toString(36).slice(-5);
const psql = (sql: string) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim().split('\n')[0];
const today = psql(`select (now() at time zone 'Asia/Kolkata')::date`);
let seq = 0; const mob = () => '9' + String((Date.now() % 1e7) * 100 + ++seq + 100000000).slice(-9).padStart(9, '0');

test.describe.configure({ mode: 'serial' });
let page: Page;
let token = '';
const api = async (method: string, p: string, body?: any) => {
  const r = await fetch(`${BASE}/api${p}`, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
  let j: any = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
};
const S: Record<string, any> = {};

test.beforeAll(async ({ browser }) => {
  const r = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'super_admin@test.local', password: PASSWORD }) });
  token = (await r.json()).token;
  S.co = (await api('POST', '/companies', { name: `BS Co ${U}` })).j.data.id;
  S.pn = `BS Proj ${U}`;
  S.p = (await api('POST', '/projects', { companyId: S.co, name: S.pn, reraNumber: `BS${U}`, tcpLicence: 'x' })).j.data.id;
  S.tw = (await api('POST', `/projects/${S.p}/towers`, { towerName: `BT${U}` })).j.data.id;
  S.plan = `BS Plan ${U}`;
  await api('POST', `/projects/${S.p}/plan-templates`, { plan_name: S.plan, installment_name: 'Row 1', installment_type: 'booking', percentage: 100, due_date_offset_days: 0, installment_index: 1 });
  S.un = `BU${U}`;
  S.u = (await api('POST', '/units', { projectId: S.p, towerId: S.tw, unitNumber: S.un, floor: 1, bhkType: '2BHK', carpetAreaSqft: 500, superAreaSqft: 600, basePriceInr: 3000000 })).j.data.id;
  // GST (a booking is refused without it): a slab that covers today, 5% intra-state, mapped to the three charge heads
  let slab = (await api('GET', '/gst-configuration/gst-slabs')).j.data.find((x: any) => x.from_date <= today && x.to_date >= today)?.id;
  if (!slab) slab = (await api('POST', '/gst-configuration/gst-slabs', { fromDate: psql(`select ('${today}'::date - 3)`), toDate: psql(`select ('${today}'::date + 400)`) })).j.data.id;
  const tax = (await api('POST', '/gst-configuration/gst-tax-setup', { slabId: slab, gstCode: `BS${U}`, type: 'INTRA', cgstPct: 2.5, sgstPct: 2.5 })).j.data.id;
  for (const ct of ['BASIC', 'PLC', 'OTHER CHARGE']) await api('POST', '/gst-configuration/gst-charge-mapping', { projectId: S.p, slabId: slab, gstTaxId: tax, chargeType: ct });
  S.c = (await api('POST', '/consumers', { name: 'qa-alok one', mobile: mob(), project_id: S.p })).j.data;
  const b = await api('POST', '/booking', { consumer_id: S.c.id, project_id: S.p, unit_id: S.u, selected_plan_name: S.plan, booking_date: today, basic_price: 6000, carpet_area_sqft: 500 });
  if (b.s !== 201) throw new Error('booking setup: ' + b.s + ' ' + JSON.stringify(b.j));
  S.b = b.j.data;
  page = await browser.newPage({ baseURL: BASE });
  await page.goto('/pages/login.html');
  await page.locator('input[type=email]').fill('super_admin@test.local');
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.locator('button[type=submit]').click();
  await page.waitForURL(/index\.html|#\//, { timeout: 15000 }).catch(() => {});
});
test.afterAll(async () => { await page?.close(); });

const go = async (hash: string) => { await page.goto('/'); await page.evaluate((h) => { location.hash = h; }, hash); await page.waitForLoadState('networkidle'); await page.waitForTimeout(400); };

test('the unit list says "Carpet 500 sqft", the area the price is made from, not the 600 super area', async () => {
  await go('#/booking');
  await page.locator('select').filter({ has: page.locator('option', { hasText: S.pn }) }).first().selectOption({ label: S.pn });
  await page.waitForTimeout(800);
  const opt = page.locator('#bk-unit-select option', { hasText: S.un });
  await expect(opt).toHaveCount(1);
  const text = await opt.innerText();
  expect(text).toMatch(/Carpet 500(\.0+)? sqft/);
  expect(text).not.toMatch(/600/);
});

test('a name keeps a capital after a hyphen (server and browser)', async () => {
  expect(S.c.name).toBe('Qa-Alok One');
  const o = await api('POST', '/consumers', { name: "d'souza o'brien", mobile: mob(), project_id: S.p });
  expect(o.j.data.name).toBe("D'Souza O'Brien");
  const shown = await page.evaluate(() => (0, eval)("Utils").toTitleCase("mary-jane o'neil"));
  expect(shown).toBe("Mary-Jane O'Neil");
  // two capitals in a row (QA, AK) stay as typed on both sides; a long shout (RAM) is normalised
  const qa = await api('POST', '/consumers', { name: 'QA-Alok RAM', mobile: mob(), project_id: S.p });
  expect(qa.j.data.name).toBe('QA-Alok Ram');
  expect(await page.evaluate(() => (0, eval)("Utils").toTitleCase("QA-Alok RAM"))).toBe('QA-Alok Ram');
  // the customer card shows the same normalised name as the other screens
  await go(`#/consumer?id=${S.c.id}`);
  await expect(page.locator('.cdn h1').first()).toHaveText('Qa-Alok One');
});

test('payment screen: a zero amount is flagged next to the box, a good one is not and shows the GST the server works out, and the server refuses to save it', async () => {
  await go(`#/booking-payment?id=${S.b.id}&reg=${encodeURIComponent(S.b.registration_no || 'X')}`);
  const amt = page.locator('#bkp-amt-cheque');
  await expect(amt).toBeVisible();
  await amt.fill('0');
  await amt.dispatchEvent('input');
  await expect(page.locator('#bkp-amt-hint')).toContainText('more than 0');
  await amt.fill('105000');
  await amt.dispatchEvent('input');
  await expect(page.locator('#bkp-amt-hint')).toHaveCount(0);
  await expect.poll(async () => (await page.locator('#bkp-cgst-amount').inputValue()) + '/' + (await page.locator('#bkp-sgst-amount').inputValue()), { timeout: 8000 }).toBe('2500.00/2500.00');   // the GST is the server's: 5% inside 1,05,000
  const save = await api('PATCH', `/booking/${S.b.id}`, { booking_amount: 0, payment_mode: 'cash' });
  expect(save.s).toBeGreaterThanOrEqual(400);   // and the server refuses to save it
});
