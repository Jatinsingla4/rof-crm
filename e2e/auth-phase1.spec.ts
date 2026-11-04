// Login & Authentication fix, phase 1, in the browser: a super admin editing their own login must give the current password
// (AUTH-002), while setting someone else's password needs none. Own synthetic logins, deactivated at the end.
// The CRM must be running (BASE_URL); psql must reach the same database (PG* variables), as in the other specs.
import { test, expect, Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';

const PASSWORD = 'Test#Pass1234', NEWPW = 'Fresh#Phase1-77';
const U = Date.now().toString(36).slice(-5);
const psql = (sql: string) => execFileSync('psql', ['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' }).trim();
const hash = () => psql(`select password_hash from users where email='super_admin@test.local'`);
const mk = (role: string, tag: string) => { const email = `e2eauth_${tag}_${U}@test.local`; psql(`insert into users (email,name,role,password_hash,is_active,username) values ('${email}','E2E auth ${tag} ${U}','${role}','${hash()}',true,'e2eauth_${tag}_${U}')`); return email; };

test.describe.configure({ mode: 'serial' });
let page: Page; let admin = '', other = '';
const content = () => page.locator('#content');
const drawer = () => page.locator('#sec-drawer-host aside[role=dialog]');
const toast = (text: string | RegExp) => page.locator('.toast', { hasText: text }).first();
const go = (hash: string) => page.evaluate((h) => { location.hash = h; }, hash);
const rowOf = (email: string) => content().locator('tr').filter({ hasText: email }).first();

test.beforeAll(async ({ browser }) => {
  admin = mk('super_admin', 'adm'); other = mk('sales_executive', 'oth');
  page = await browser.newPage();
  await page.goto('/pages/login.html');
  await page.locator('input[type=email]').fill(admin);
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.locator('button[type=submit]').click();
  await page.waitForURL((u) => !u.pathname.includes('login'));
});
test.afterAll(async () => { try { psql(`update users set is_active=false where email in ('${admin}','${other}')`); } catch {} await page.close(); });

async function openEdit(email: string) {
  await go('#/users?tab=permissions');
  await rowOf(email).hover();
  await rowOf(email).getByRole('button', { name: 'Edit' }).click();
  await expect(drawer()).toBeVisible();
}

test('AUTH-002: editing your own login shows a current password box and refuses a new password without it', async () => {
  await openEdit(admin);
  await expect(drawer().locator('#sf-pw0')).toBeVisible();
  await drawer().locator('[name=password]').fill(NEWPW);
  await drawer().locator('#sf-pw2').fill(NEWPW);
  await drawer().getByRole('button', { name: 'Save changes' }).click();
  await expect(drawer().locator('#sec-form-err')).toContainText('Current password is required');
  await drawer().locator('#sf-pw0').fill('not-my-password1');
  await drawer().getByRole('button', { name: 'Save changes' }).click();
  await expect(drawer().locator('#sec-form-err')).toContainText('Current password is incorrect');
  expect(psql(`select password_hash = '${hash()}' from users where email='${admin}'`)).toBe('t');
});

test('AUTH-002: with the right current password the new password is saved', async () => {
  await drawer().locator('#sf-pw0').fill(PASSWORD);
  await drawer().getByRole('button', { name: 'Save changes' }).click();
  // changing your own password ends your sessions (the form says so), so the app sends you back to the sign-in page
  await page.waitForURL(/login/);
  expect(psql(`select password_hash = '${hash()}' from users where email='${admin}'`)).toBe('f');
});

test('AUTH-002: setting another person\'s password needs no current password (the administrator reset)', async () => {
  const adminTwo = mk('super_admin', 'adm2');
  await page.evaluate(() => localStorage.removeItem('rof-jwt'));
  await page.goto('/pages/login.html');
  await page.locator('input[type=email]').fill(adminTwo);
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.locator('button[type=submit]').click();
  await page.waitForURL((u) => !u.pathname.includes('login'));
  await openEdit(other);
  await expect(drawer().locator('#sf-pw0')).toHaveCount(0);
  await drawer().locator('[name=password]').fill(NEWPW);
  await drawer().locator('#sf-pw2').fill(NEWPW);
  await drawer().getByRole('button', { name: 'Save changes' }).click();
  await expect(toast('Login updated')).toBeVisible();
  expect(psql(`select password_hash = '${hash()}' from users where email='${other}'`)).toBe('f');
  psql(`update users set is_active=false where email='${adminTwo}'`);
});
