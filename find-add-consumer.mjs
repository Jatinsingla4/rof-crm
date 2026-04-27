import { chromium } from '@playwright/test';

async function find() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:5186', { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="email"]').fill('demo@example.com');
    await page.locator('input[type="password"]').fill('password');
    await page.locator('button', { hasText: 'Sign In' }).click();
    await page.waitForURL('**/dashboard');

    await page.goto('http://localhost:5186/consumers', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    const html = await page.evaluate(() => document.getElementById('root')?.innerHTML || '');

    const addConsumerIndex = html.indexOf('Add Consumer');
    if (addConsumerIndex > -1) {
      const start = Math.max(0, addConsumerIndex - 500);
      const end = Math.min(html.length, addConsumerIndex + 1000);
      console.log('CONTENT AROUND "Add Consumer":');
      console.log('─'.repeat(60));
      console.log(html.substring(start, end));
    } else {
      console.log('Add Consumer button not found');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }

  await browser.close();
}

await find();
