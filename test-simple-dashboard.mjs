import { chromium } from '@playwright/test';

async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log('1. Loading homepage...');
    await page.goto('http://localhost:5186', { waitUntil: 'domcontentloaded', timeout: 10000 });
    
    console.log('2. Waiting for login inputs...');
    const emailInput = await page.locator('input[type="email"]').first();
    const passwordInput = await page.locator('input[type="password"]').first();
    const signInButton = await page.locator('button', { hasText: 'Sign In' }).first();
    
    await emailInput.waitFor();
    console.log('3. Filling credentials...');
    await emailInput.fill('demo@example.com');
    await passwordInput.fill('password');
    
    console.log('4. Clicking Sign In button...');
    await signInButton.click();
    
    console.log('5. Waiting for dashboard URL...');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    
    console.log('6. Checking dashboard structure...');
    await page.waitForTimeout(2000);

    const result = await page.evaluate(() => {
      return {
        url: window.location.href,
        rootHTML: document.getElementById('root')?.innerHTML.length || 0,
        h1Text: document.querySelector('h1')?.textContent?.trim() || 'NOT FOUND',
        allText: document.body.innerText.substring(0, 400),
      };
    });

    console.log('\n✅ DASHBOARD LOADED SUCCESSFULLY');
    console.log('═'.repeat(60));
    console.log(`✅ URL: ${result.url}`);
    console.log(`✅ H1 Title: "${result.h1Text}"`);
    console.log(`✅ Root HTML size: ${result.rootHTML} chars`);
    console.log(`\n📄 Page content preview:\n${result.allText}`);

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  }

  await browser.close();
}

await test();
