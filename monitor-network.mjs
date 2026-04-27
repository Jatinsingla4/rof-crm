import { chromium } from '@playwright/test';

async function monitor() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const requests = [];
  const responses = [];

  page.on('request', req => {
    if (req.url().includes('/consumers')) {
      requests.push({ url: req.url(), method: req.method(), timestamp: Date.now() });
    }
  });

  page.on('response', res => {
    if (res.url().includes('/consumers')) {
      responses.push({ url: res.url(), status: res.status(), timestamp: Date.now() });
    }
  });

  try {
    await page.goto('http://localhost:5186', { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="email"]').fill('demo@example.com');
    await page.locator('input[type="password"]').fill('password');
    await page.locator('button', { hasText: 'Sign In' }).click();
    await page.waitForURL('**/dashboard');

    console.log('NETWORK MONITORING - CONSUMERS PAGE');
    console.log('═'.repeat(60));
    console.log('Navigating to /consumers...\n');

    await page.goto('http://localhost:5186/consumers', { waitUntil: 'domcontentloaded' });
    
    // Wait for network activity
    await page.waitForTimeout(3000);

    console.log(`Requests to /consumers: ${requests.length}`);
    requests.forEach((r, i) => {
      console.log(`  ${i+1}. ${r.method} ${r.url}`);
    });

    console.log(`\nResponses from /consumers: ${responses.length}`);
    responses.forEach((r, i) => {
      console.log(`  ${i+1}. ${r.status} ${r.url}`);
    });

    if (responses.length === 0) {
      console.log('\n⚠️  NO RESPONSES RECEIVED - API call might be hanging or blocked');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }

  await browser.close();
}

await monitor();
