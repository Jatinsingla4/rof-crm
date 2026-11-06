// Demands screen: Print opens the demand letter of a raised demand. It said "No HTML content returned" every time, because the screen read the
// letter page as JSON. Also: a consumer with nothing raised is refused with the message, not a blank letter.
import { test, expect, Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';

const PASSWORD = 'Test#Pass1234';
const BASE = process.env.BASE_URL || 'http://localhost:3010';
const U = Date.now().toString(36).slice(-5);
const psql = (sql: string) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' }).trim().split('\n')[0];
const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
test.describe.configure({ mode: 'serial' });
let page: Page, token = '';
const S: Record<string, string> = {};
const api = async (method: string, p: string, body?: any) => {
  const r = await fetch(`${BASE}/api${p}`, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
  let j: any = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
};

test.beforeAll(async ({ browser }) => {
  token = (await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'super_admin@test.local', password: PASSWORD }) })).json()).token;
  const co = (await api('POST', '/companies', { name: `DP Co ${U}` })).j.data.id;
  const P = (await api('POST', '/projects', { companyId: co, name: `DP Project ${U}`, reraNumber: `DP-2026-${U}`, tcpLicence: 'x' })).j.data.id;
  const T = (await api('POST', `/projects/${P}/towers`, { towerName: `DT${U}` })).j.data.id;
  let i = 0; for (const pc of [20, 30, 50]) await api('POST', `/projects/${P}/plan-templates`, { plan_name: `DP Plan ${U}`, installment_name: `Row ${++i}`, installment_type: i === 1 ? 'booking' : 'installment', percentage: pc, due_date_offset_days: i * 30, installment_index: i });
  const slab = (await api('GET', '/gst-configuration/gst-slabs')).j.data.find((s: any) => s.from_date <= today && s.to_date >= today)?.id;
  const tax = (await api('POST', '/gst-configuration/gst-tax-setup', { slabId: slab, gstCode: `DP ${U}`, type: 'INTRA', cgstPct: 2.5, sgstPct: 2.5 })).j.data.id;
  for (const ct of ['BASIC', 'PLC', 'OTHER CHARGE']) await api('POST', '/gst-configuration/gst-charge-mapping', { projectId: P, slabId: slab, gstTaxId: tax, chargeType: ct });
  const mk = async (no: string) => {
    const unit = (await api('POST', '/units', { projectId: P, towerId: T, unitNumber: no, floor: 1, bhkType: '2BHK', carpetAreaSqft: 1000, superAreaSqft: 1200, basePriceInr: 5000000, totalPriceInr: 5000000 })).j.data.id;
    const c = (await api('POST', '/consumers', { name: `DP Buyer ${no}`, mobile: '98' + String(Date.now()).slice(-8) + '', project_id: P })).j.data.id;
    const b = (await api('POST', '/booking', { consumer_id: c, project_id: P, unit_id: unit, selected_plan_name: `DP Plan ${U}`, booking_date: today, carpet_area_sqft: 1000, basic_price: 5000 })).j.data.id;
    await api('PATCH', `/booking/${b}`, { booking_amount: 10000, payment_mode: 'cash' });
    return c;
  };
  S.raised = await mk(`DPR-${U}`);
  psql(`update demands set status = 'demanded', due_date = '${today}' where consumer_id = '${S.raised}' and installment_index = 1`);
  page = await browser.newPage();
  await page.goto('/pages/login.html');
  await page.locator('input[type=email]').fill('super_admin@test.local');
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.locator('button[type=submit]').click();
  await page.waitForURL(/#\/dashboard/);
});
test.afterAll(async () => { await page.close(); });

test('Print on a raised demand opens the letter (no "No HTML content returned")', async () => {
  await page.evaluate(() => { location.hash = '#/demands'; });
  const row = page.locator('tr', { hasText: `DPR-${U}` }).first();
  await expect(row).toBeVisible({ timeout: 30000 });
  const [popup] = await Promise.all([page.waitForEvent('popup'), row.getByRole('button', { name: 'Print' }).click()]);
  await popup.waitForLoadState('domcontentloaded');
  await expect(popup.locator('body')).toContainText(/Demand/i);
  await expect(popup.locator('body')).toContainText(new RegExp(`DPR-${U}`, "i"));
  await expect(page.locator('.toast', { hasText: /Print failed|No HTML/i })).toHaveCount(0);
  await popup.close();
});

test('a consumer with nothing raised gets the refusal from the API, not a blank letter', async () => {
  const r = await api('POST', '/documents/generate', { consumerId: S.raised, documentType: 'demand_letter', dueDate: '2000-01-01' });
  expect(r.s === 201 || (r.s === 409 && /No raised demands/.test(r.j?.error || ''))).toBe(true);
  psql(`update demands set status = 'pending' where consumer_id = '${S.raised}'`);
  const r2 = await api('POST', '/documents/generate', { consumerId: S.raised, documentType: 'demand_letter' });
  expect(r2.s).toBe(409);
  expect(r2.j?.error).toMatch(/No raised demands/);
});
