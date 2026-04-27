import { chromium } from '@playwright/test';

async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log('Loading homepage...');
    await page.goto('http://localhost:5186', { waitUntil: 'networkidle', timeout: 15000 });
    
    console.log('Waiting for login form...');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    
    console.log('Filling login...');
    await page.fill('input[type="email"]', 'demo@example.com');
    await page.fill('input[type="password"]', 'password');
    
    console.log('Clicking submit...');
    await page.click('button[type="submit"]');
    
    console.log('Waiting for navigation...');
    await page.waitForURL(url => url.includes('/dashboard'), { timeout: 10000 });
    
    console.log('Waiting for content...');
    await page.waitForTimeout(1500);

    const result = await page.evaluate(() => {
      const root = document.getElementById('root');
      return {
        url: window.location.href,
        rootHTML: root?.innerHTML.length || 0,
        h1Text: document.querySelector('h1')?.textContent || 'NOT FOUND',
        cardElements: document.querySelectorAll('[class*="Card"]').length,
        tableElements: document.querySelectorAll('table').length,
        divElements: document.querySelectorAll('div').length,
        bodyText: document.body.innerText.substring(0, 300),
      };
    });

    console.log('\n✅ SUCCESS - Dashboard loaded');
    console.log('═'.repeat(60));
    console.log(`URL: ${result.url}`);
    console.log(`H1: ${result.h1Text}`);
    console.log(`Root HTML chars: ${result.rootHTML}`);
    console.log(`Card elements: ${result.cardElements}`);
    console.log(`Table elements: ${result.tableElements}`);
    console.log(`Div elements: ${result.divElements}`);
    console.log(`\nPage text preview:\n${result.bodyText}`);

  } catch (error) {
    console.error('❌ ERROR:', error.message);
  }

  await browser.close();
}

await test();
