// Company rebate approval in the browser (QA-007, Q10 and Q11): the Edit Booking screen shows the status, the person who entered a rebate
// cannot approve it (the API says so and the screen shows the error), and a different authorised user approves it and the price drops.
// Own project, unit and logins (new every run); the logins are deactivated at the end. The CRM must be running (BASE_URL) and psql must reach
// the same database (PG* variables), as in the other specs.
import { test, expect, Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';

declare const Auth: any;   // the page's own global, used inside page.evaluate
const PASSWORD = 'Test#Pass1234';
const U = Date.now().toString(36).slice(-5);
const psql = (sql: string) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' }).trim();
const hash = () => psql(`select password_hash from users where email='super_admin@test.local'`);
const mk = (tag: string) => { const email = `e2ereb_${tag}_${U}@test.local`; psql(`insert into users (email,name,role,password_hash,is_active,username) values ('${email}','E2E rebate ${tag} ${U}','super_admin','${hash()}',true,'e2ereb_${tag}_${U}')`); return email; };
const BASE = process.env.BASE_URL || 'http://localhost:3002';

test.describe.configure({ mode: 'serial' });
let maker = '', checker = '', bookingId = '', consumerId = '';
const PICK = { user: 'e2erebpick' + U, email: `e2erebpick_${U}@test.local`, name: 'E2E rebate picker ' + U, pw: 'Rebate#Pass-4821' };
let noPerm = '';

async function api(token: string, method: string, path: string, body?: unknown) {
  const r = await fetch(BASE + '/api' + path, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j: any = await r.json().catch(() => null);
  if (r.status >= 300) throw new Error(`${method} ${path} -> ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
  return j.data ?? j;
}
async function tokenOf(email: string) { const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }) }); return (await r.json() as any).token as string; }
async function signIn(page: Page, email: string, pw = PASSWORD) {
  await page.goto('/pages/login.html');
  await page.evaluate(() => localStorage.removeItem('rof-jwt'));
  await page.goto('/pages/login.html');
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill(pw);
  await page.locator('button[type=submit]').click();
  await page.waitForURL((u) => !u.pathname.includes('login'));
}

test.beforeAll(async () => {
  maker = mk('maker'); checker = mk('checker');
  noPerm = `e2ereb_noperm_${U}@test.local`; psql(`insert into users (email,name,role,password_hash,is_active,username) values ('${noPerm}','E2E rebate noperm ${U}','accounts_finance','${hash()}',true,'e2ereb_noperm_${U}')`);
  const t = await tokenOf(maker), today = new Date().toISOString().slice(0, 10);
  const co = (await api(t, 'POST', '/companies', { name: 'E2E Rebate Co ' + U })).id;
  const proj = (await api(t, 'POST', '/projects', { companyId: co, name: 'E2E Rebate ' + U, reraNumber: 'ER-' + U, tcpLicence: 'x', totalUnits: 5, landAreaSqft: 20000 })).id;
  const tw = (await api(t, 'POST', `/projects/${proj}/towers`, { towerName: 'ER ' + U })).id;
  const plan = 'E2E Rebate Plan ' + U;
  for (const [i, p] of [50, 50].entries()) await api(t, 'POST', `/projects/${proj}/plan-templates`, { plan_name: plan, installment_name: `Row ${i + 1}`, installment_type: i === 0 ? 'booking' : 'installment', percentage: p, due_date_offset_days: i * 30, installment_index: i + 1 });
  let slab = (await api(t, 'GET', '/gst-configuration/gst-slabs')).find((s: any) => s.from_date <= today && s.to_date >= today)?.id;
  if (!slab) slab = (await api(t, 'POST', '/gst-configuration/gst-slabs', { fromDate: new Date(Date.now() - 864e5).toISOString().slice(0, 10), toDate: new Date(Date.now() + 864e5 * 5).toISOString().slice(0, 10) })).id;
  const tax = (await api(t, 'POST', '/gst-configuration/gst-tax-setup', { slabId: slab, gstCode: 'ER' + U, type: 'INTRA', cgstPct: 2.5, sgstPct: 2.5 })).id;
  for (const ct of ['BASIC', 'PLC', 'OTHER CHARGE']) await api(t, 'POST', '/gst-configuration/gst-charge-mapping', { projectId: proj, slabId: slab, gstTaxId: tax, chargeType: ct });
  const unit = (await api(t, 'POST', '/units', { projectId: proj, towerId: tw, unitNumber: 'ER' + U, floor: 2, bhkType: '2BHK', carpetAreaSqft: 500, superAreaSqft: 600, basePriceInr: 3000000 })).id;
  consumerId = (await api(t, 'POST', '/consumers', { name: 'E2E Rebate Buyer ' + U, mobile: '9' + String(Math.random()).slice(2, 11) })).id;
  psql(`update consumers set first_name='E2E', last_name='Rebate Buyer', name='E2E Rebate Buyer' where id='${consumerId}'`);   // the Edit Booking form requires a first and a last name
  bookingId = (await api(t, 'POST', '/booking', { consumer_id: consumerId, project_id: proj, unit_id: unit, selected_plan_name: plan, booking_date: today, booking_amount: 10000, payment_mode: 'cash', company_rebate_pct: 5 })).id;
  await api(t, 'PATCH', `/booking/${bookingId}`, { booking_amount: 10000, payment_mode: 'cash' });
});
test.afterAll(() => { try { psql(`update users set is_active=false where email in ('${maker}','${checker}','${noPerm}','${PICK.email}')`); } catch {} });

const openEdit = async (page: Page) => {
  await page.goto('/');
  await page.evaluate(([b, c]) => { location.hash = '#/edit-booking'; setTimeout(() => (window as any).EditBooking.loadEdit(b, c), 800); }, [bookingId, consumerId]);
  await expect(page.locator('#eb-rebate-box')).toBeVisible();
};

test('the maker sees the rebate as pending and cannot approve it', async ({ page }) => {
  await signIn(page, maker);
  await openEdit(page);
  await expect(page.locator('#eb-rebate-box')).toContainText('Pending approval');
  await page.getByRole('button', { name: 'Approve rebate' }).click();
  await expect(page.locator('#eb-banner')).toContainText('You entered this rebate yourself');
  expect(psql(`select company_rebate_status||'|'||approved_rebate_amount from booking_records where id='${bookingId}'`)).toBe('pending|0.00');
  expect(psql(`select total_amount_inr from payment_plans where consumer_id='${consumerId}'`)).toBe('3000000');
});

test('a different authorised user approves it and the price drops by the 5% rebate', async ({ page }) => {
  await signIn(page, checker);
  await openEdit(page);
  await page.getByRole('button', { name: 'Approve rebate' }).click();
  await expect(page.locator('#eb-rebate-box')).toContainText('Approved');
  await expect(page.locator('#eb-rebate-box')).toContainText('1,50,000');
  expect(psql(`select company_rebate_status||'|'||approved_rebate_amount from booking_records where id='${bookingId}'`)).toBe('approved|150000.00');
  expect(psql(`select total_amount_inr from payment_plans where consumer_id='${consumerId}'`)).toBe('2850000');
  expect(psql(`select string_agg(amount_due_inr::text, ',' order by installment_index) from demands where consumer_id='${consumerId}'`)).toBe('1425000,1425000');
});

test('changing the rebate after approval sends it back to pending in the screen and the price returns', async ({ page }) => {
  await signIn(page, maker);
  await openEdit(page);
  await page.locator('#eb-rebate-pct').fill('4');
  await page.getByRole('button', { name: /save/i }).first().click();
  await expect(page.locator('#eb-rebate-box')).toContainText('Pending approval');
  expect(psql(`select total_amount_inr from payment_plans where consumer_id='${consumerId}'`)).toBe('3000000');
});

// ---------- the company_rebate permission picker (Users screen) ----------
const content = (page: Page) => page.locator('#content');
const drawer = (page: Page) => page.locator('#sec-drawer-host aside[role=dialog]');
const rowOf = (page: Page, email: string) => content(page).locator('tr').filter({ hasText: email }).first();
const openUsers = async (page: Page) => { await page.evaluate(() => { location.hash = '#/users?tab=permissions'; }); await expect(content(page)).toContainText('Logins'); };
const callApprove = async (page: Page, what: 'approve' | 'reject') => { await page.waitForLoadState('load'); await page.waitForFunction(() => typeof Auth !== 'undefined' && !!Auth.getToken()); return page.evaluate(async ([id, w]) => { const r = await fetch(`/api/booking/${id}/rebate/${w}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + Auth.getToken() }, body: JSON.stringify({ reason: 'e2e' }) }); return r.status; }, [bookingId, what] as const); };
const rebateRow = () => psql(`select company_rebate_status||'|'||approved_rebate_amount||'|'||coalesce(rebate_decided_by::text,'') from booking_records where id='${bookingId}'`);

test('picker: a super admin grants the Company Rebate checker right when creating a login; only a checker box exists for it', async ({ page }) => {
  await signIn(page, checker);
  await openUsers(page);
  await content(page).getByRole('button', { name: 'New login' }).click();
  await expect(drawer(page)).toBeVisible();
  await expect(drawer(page).locator('input[name=ck][value=company_rebate]')).toHaveCount(1);
  await expect(drawer(page).locator('input[name=mk][value=company_rebate]')).toHaveCount(0);
  await drawer(page).locator('[name=username]').fill(PICK.user);
  await drawer(page).locator('[name=name]').fill(PICK.name);
  await drawer(page).locator('[name=email]').fill(PICK.email);
  await drawer(page).locator('[name=role]').selectOption('accounts_finance');
  await drawer(page).locator('input[name=ck][value=company_rebate]').check();
  await drawer(page).locator('[name=password]').fill(PICK.pw);
  await drawer(page).locator('#sf-pw2').fill(PICK.pw);
  await drawer(page).getByRole('button', { name: 'Create login' }).click();
  await expect(page.locator('.toast', { hasText: 'Login created' }).first()).toBeVisible();
  await expect(rowOf(page, PICK.email)).toContainText('Company Rebate C');
  expect(psql(`select is_checker::text||'/'||is_maker::text from user_process_permissions where process_name='company_rebate' and user_id=(select id from users where email='${PICK.email}')`)).toBe('true/false');
});

test('picker: the right is still there after a page reload and in the form', async ({ page }) => {
  await signIn(page, checker);
  await openUsers(page);
  await page.reload();
  await openUsers(page);
  await expect(rowOf(page, PICK.email)).toContainText('Company Rebate C');
  await rowOf(page, PICK.email).hover();
  await rowOf(page, PICK.email).getByRole('button', { name: 'Edit' }).click();
  await expect(drawer(page)).toBeVisible();
  await expect(drawer(page).locator('input[name=ck][value=company_rebate]')).toBeChecked();
});

test('picker: the login holding the right approves a rebate entered by someone else; the API records who', async ({ page }) => {
  expect(rebateRow().startsWith('pending|0.00')).toBe(true);
  await signIn(page, PICK.email, PICK.pw);
  const me = await page.evaluate(async () => (await (await fetch('/api/users/me', { headers: { authorization: 'Bearer ' + Auth.getToken() } })).json()).data);
  expect(me.processPermissions.company_rebate).toEqual(['checker']);
  expect(await callApprove(page, 'approve')).toBe(200);
  expect(rebateRow()).toBe(`approved|120000.00|${psql(`select id from users where email='${PICK.email}'`)}`);
});

test('picker: logins without the right cannot approve or reject (API refuses), and nothing changes', async ({ browser }) => {
  const t = await tokenOf(maker);
  await api(t, 'PATCH', `/booking/${bookingId}/edit`, { company_rebate_pct: 3 });          // a new request: pending again, price back to full
  expect(rebateRow().startsWith('pending|0.00')).toBe(true);
  const before = psql(`select total_amount_inr from payment_plans where consumer_id='${consumerId}'`);
  for (const who of [noPerm, 'sales_executive@test.local', 'project_manager@test.local']) {
    const ctx = await browser.newContext({ baseURL: BASE }), page = await ctx.newPage();      // a clean browser per login
    await signIn(page, who);
    expect(await callApprove(page, 'approve')).toBe(403);
    expect(await callApprove(page, 'reject')).toBe(403);
    await ctx.close();
  }
  expect(rebateRow().startsWith('pending|0.00')).toBe(true);
  expect(psql(`select total_amount_inr from payment_plans where consumer_id='${consumerId}'`)).toBe(before);
});

test('picker: removing the right in the form takes it away at once', async ({ page, browser }) => {
  await signIn(page, checker);
  await openUsers(page);
  await rowOf(page, PICK.email).hover();
  await rowOf(page, PICK.email).getByRole('button', { name: 'Edit' }).click();
  await expect(drawer(page)).toBeVisible();
  await drawer(page).locator('input[name=ck][value=company_rebate]').uncheck();
  await drawer(page).getByRole('button', { name: 'Save changes' }).click();
  await expect(page.locator('.toast', { hasText: 'Login updated' }).first()).toBeVisible();
  await page.reload();
  await openUsers(page);
  await expect(rowOf(page, PICK.email)).not.toContainText('Company Rebate');
  const ctx = await browser.newContext({ baseURL: BASE }), pg = await ctx.newPage();
  await signIn(pg, PICK.email, PICK.pw);
  expect(await callApprove(pg, 'approve')).toBe(403);
  await ctx.close();
  expect(rebateRow().startsWith('pending|0.00')).toBe(true);
});
