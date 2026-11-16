// SEC-01: the login token (JWT) must never be put in a web address. A page opens files through a link token: 60 seconds, for one page only.
import { test, expect, Page } from '@playwright/test';

const PASSWORD = 'Test#Pass1234';
let page: Page;
let access = '';
const claims = (jwt: string) => JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());
const origin = () => new URL(page.url()).origin;
const get = (url: string, headers: Record<string, string> = {}) => page.request.get(origin() + url, { headers });
const linkFor = async (path: string) => {
  const r = await page.request.post(origin() + '/api/auth/link-token', { headers: { Authorization: 'Bearer ' + access }, data: { path } });
  expect(r.status()).toBe(200);
  return (await r.json()).token as string;
};

test.describe.configure({ mode: 'default' });
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  await page.goto('/pages/login.html');
  await page.locator('input[type=email]').fill('super_admin@test.local');
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.locator('button[type=submit]').click();
  await page.waitForURL(/#\/dashboard/);
  access = await page.evaluate(() => localStorage.getItem('rof-jwt') || '');
  expect(access.split('.').length).toBe(3);
});
test.afterAll(async () => { await page.close(); });

test('the login token in a web address is refused', async () => {
  expect((await get('/api/consumers?token=' + access)).status()).toBe(401);
  expect((await get('/api/consumers', { Authorization: 'Bearer ' + access })).status()).toBe(200);   // the header still works
});

test('a link token lives 60 seconds, names no person or role, and opens only its own page', async () => {
  const lt = await linkFor('/api/consumers');
  const c = claims(lt);
  expect(c.purpose).toBe('link');
  expect(c.exp - c.iat).toBe(60);
  for (const k of ['email', 'name', 'role', 'permissions']) expect(c[k]).toBeUndefined();
  expect((await get('/api/consumers?token=' + lt)).status()).toBe(200);
  expect((await get('/api/projects?token=' + lt)).status()).toBe(401);                                  // another page
  expect((await get('/api/consumers', { Authorization: 'Bearer ' + lt })).status()).toBe(401);          // never a login token
});

test('a page link that carries token= is swapped for a link token when clicked; the login token never leaves the browser in a URL', async () => {
  await page.evaluate(() => { location.hash = '/dashboard'; });
  await page.evaluate(() => {
    const a = document.createElement('a');
    a.id = 'sec01-link'; a.target = '_blank'; a.href = '/api/consumers?token=1'; a.textContent = 'open';
    document.body.appendChild(a);
  });
  await expect.poll(async () => await page.locator('#sec01-link').getAttribute('href')).toBe('javascript:void(0)');   // the address is hidden until the click
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.locator('#sec01-link').click()]);
  await popup.waitForURL(/\/api\/consumers\?token=/, { timeout: 15_000 });
  const t = new URL(popup.url()).searchParams.get('token') || '';
  expect(t).not.toBe(access);
  expect(t).not.toBe('1');
  expect(claims(t).purpose).toBe('link');
  await popup.close();
});
