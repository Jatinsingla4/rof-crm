// Dashboard: the numbers on the Demand Status and Daily Status cards open the list they count. Own project, bookings and logins (new every run);
// the second login is deactivated at the end. The CRM must be running (BASE_URL) and psql must reach the same database (PG* variables).
import { test, expect, Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';

const PASSWORD = 'Test#Pass1234';
const U = Date.now().toString(36).slice(-5);
const BASE = process.env.BASE_URL || 'http://localhost:3002';
const psql = (sql: string) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' }).trim();
const hash = () => psql(`select password_hash from users where email='super_admin@test.local'`);
const projectName = 'E2E DashList ' + U;
const buyer = (n: number) => new RegExp(`Dashlist Buyer ${n} ${U}`, 'i');       // the CRM title-cases names
let checker = '';

async function api(token: string, method: string, path: string, body?: unknown) {
  const r = await fetch(BASE + '/api' + path, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j: any = await r.json().catch(() => null);
  if (r.status >= 300) throw new Error(`${method} ${path} -> ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
  return j.data ?? j;
}
const tokenOf = async (email: string) => (await (await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }) })).json() as any).token as string;

test.beforeAll(async () => {
  checker = `e2edash_${U}@test.local`;
  psql(`insert into users (email,name,role,password_hash,is_active,username) values ('${checker}','E2E dash ${U}','super_admin','${hash()}',true,'e2edash_${U}')`);
  const A = await tokenOf('super_admin@test.local'), C = await tokenOf(checker), today = psql(`select (now() at time zone 'Asia/Kolkata')::date`);
  const co = (await api(A, 'POST', '/companies', { name: 'E2E DashList Co ' + U })).id;
  const proj = (await api(A, 'POST', '/projects', { companyId: co, name: projectName, reraNumber: 'ED-' + U, tcpLicence: 'x', totalUnits: 5, landAreaSqft: 20000 })).id;
  const tw = (await api(A, 'POST', `/projects/${proj}/towers`, { towerName: 'ED ' + U })).id;
  const plan = 'E2E DashList Plan ' + U;
  for (const [i, p] of [50, 50].entries()) await api(A, 'POST', `/projects/${proj}/plan-templates`, { plan_name: plan, installment_name: `Row ${i + 1}`, installment_type: i === 0 ? 'booking' : 'installment', percentage: p, due_date_offset_days: i * 30, installment_index: i + 1 });
  let slab = (await api(A, 'GET', '/gst-configuration/gst-slabs')).find((s: any) => s.from_date <= today && s.to_date >= today)?.id;
  if (!slab) slab = (await api(A, 'POST', '/gst-configuration/gst-slabs', { fromDate: psql(`select ('${today}'::date - 3)`), toDate: psql(`select ('${today}'::date + 5)`) })).id;
  const tax = (await api(A, 'POST', '/gst-configuration/gst-tax-setup', { slabId: slab, gstCode: 'ED' + U, type: 'INTRA', cgstPct: 2.5, sgstPct: 2.5 })).id;
  for (const ct of ['BASIC', 'PLC', 'OTHER CHARGE']) await api(A, 'POST', '/gst-configuration/gst-charge-mapping', { projectId: proj, slabId: slab, gstTaxId: tax, chargeType: ct });
  const made: { cons: string; id: string }[] = [];
  for (const n of [1, 2]) {
    const unit = (await api(A, 'POST', '/units', { projectId: proj, towerId: tw, unitNumber: `ED${U}${n}`, floor: 1, bhkType: '2BHK', carpetAreaSqft: 500, superAreaSqft: 600, basePriceInr: 3000000 })).id;
    const cons = (await api(A, 'POST', '/consumers', { name: `Dashlist Buyer ${n} ${U}`, mobile: '9' + String(Math.random()).slice(2, 11), project_id: proj })).id;
    const b = await api(A, 'POST', '/booking', { consumer_id: cons, project_id: proj, unit_id: unit, selected_plan_name: plan, booking_date: today, booking_amount: 10000, payment_mode: 'cash' });
    await api(A, 'PATCH', `/booking/${b.id}`, { booking_amount: 10000, payment_mode: 'cash' });
    made.push({ cons, id: b.id });
  }
  psql(`update demands set delivery_status='sent' where consumer_id='${made[1].cons}' and installment_index=1`);       // booking 2: its first demand was sent; booking 1: not sent
  const r = await api(A, 'POST', '/payments/receipts', { consumerId: made[0].cons, bookingId: made[0].id, amountReceivedInr: 40000, paymentMode: 'neft', referenceNumber: 'ED' + U, paymentDate: today });
  await api(C, 'PATCH', `/payments/receipts/${r.id}/approve`, {});
  await api(C, 'PATCH', `/payments/receipts/${r.id}/deposit`, { deposit_date: today });
  await api(C, 'PATCH', `/payments/receipts/${r.id}/clear`, { clearing_date: today });
});
test.afterAll(() => { try { psql(`update users set is_active=false where email='${checker}'`); } catch {} });

async function openDashboard(page: Page) {
  await page.goto('/pages/login.html');
  await page.evaluate(() => localStorage.removeItem('rof-jwt'));
  await page.goto('/pages/login.html');
  await page.locator('input[type=email]').fill('super_admin@test.local');
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.locator('button[type=submit]').click();
  await page.waitForURL((u) => !u.pathname.includes('login'));
  await page.evaluate(() => { location.hash = '#/dashboard'; });
  await expect(page.locator('#dash-demand-status')).toContainText(projectName);
  await expect(page.locator('#dash-daily-status')).toContainText(projectName);
}
const demandRow = (page: Page) => page.locator('#dash-demand-status tbody tr').filter({ hasText: projectName });
const dailyRow = (page: Page) => page.locator('#dash-daily-status tbody tr').filter({ hasText: projectName });
const modal = (page: Page) => page.locator('#dash-list-overlay');

test('Demand Status: the UnSend and Send numbers open the matching lists; a zero is plain text', async ({ page }) => {
  await openDashboard(page);
  const unsend = demandRow(page).locator('td').nth(1).locator('a.dash-num'), send = demandRow(page).locator('td').nth(2).locator('a.dash-num');
  await expect(unsend).toHaveText('1');
  await expect(send).toHaveText('1');
  await expect(demandRow(page).locator('td').nth(3).locator('a')).toHaveCount(0);      // Reminder 1 UnSend is 0: no link
  await unsend.click();
  await expect(modal(page)).toBeVisible();
  await expect(modal(page)).toContainText('Demand letters, UnSent');
  await expect(modal(page)).toContainText('1 row');
  await expect(modal(page).locator('tbody tr')).toHaveCount(1);
  await expect(modal(page).locator('tbody tr')).toContainText(buyer(1));
  await modal(page).getByRole('button', { name: 'Close' }).click();
  await expect(modal(page)).toHaveCount(0);
  await send.click();
  await expect(modal(page).locator('tbody tr')).toHaveCount(1);
  await expect(modal(page).locator('tbody tr')).toContainText(buyer(2));
  await page.keyboard.press('Escape');
  await expect(modal(page)).toHaveCount(0);
});

test('Daily Status: the Sales and Collection numbers open their lists, the Total row opens all projects', async ({ page }) => {
  await openDashboard(page);
  await dailyRow(page).locator('td').nth(1).locator('a.dash-num').click();            // Sales (today)
  await expect(modal(page)).toContainText('Sales, today');
  await expect(modal(page).locator('tbody tr')).toHaveCount(2);
  await expect(modal(page)).toContainText(buyer(1));
  await expect(modal(page)).toContainText(buyer(2));
  await modal(page).getByRole('button', { name: 'Close' }).click();
  await dailyRow(page).locator('td').nth(2).locator('a.dash-num').click();            // Collection (today)
  await expect(modal(page)).toContainText('Collection, today');
  await expect(modal(page).locator('tbody tr')).toHaveCount(1);
  await expect(modal(page)).toContainText('total ₹40,000');
  await expect(modal(page).locator('tbody tr')).toContainText('₹40,000');
  await modal(page).click({ position: { x: 5, y: 5 } });                              // a click on the dark backdrop closes it
  await expect(modal(page)).toHaveCount(0);
  // the Total row covers every project in the database
  const totalSales = await page.locator('#dash-daily-status tfoot td').nth(1).innerText();
  await page.locator('#dash-daily-status tfoot td').nth(1).locator('a.dash-num').click();
  await expect(modal(page)).toContainText('Sales, today');
  await expect(modal(page)).toContainText(`${totalSales.trim()} row`);
});

test('the list opens as a dialog over the dashboard and the customer name goes to the applicant', async ({ page }) => {
  await openDashboard(page);
  await dailyRow(page).locator('td').nth(5).locator('a.dash-num').click();            // Sales (in all)
  await expect(modal(page)).toBeVisible();
  await modal(page).locator('tbody tr').filter({ hasText: buyer(1) }).locator('a').first().click();
  await expect(modal(page)).toHaveCount(0);
  await expect(page).toHaveURL(/#\/consumer\?id=/);
});
