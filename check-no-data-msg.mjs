import { chromium } from '@playwright/test';

async function check() {
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

    const text = await page.evaluate(() => document.body.innerText);

    console.log('CHECKING FOR EXPECTED MESSAGES:');
    console.log('═'.repeat(60));
    console.log(`"No consumers found": ${text.includes('No consumers found') ? 'YES' : 'NO'}`);
    console.log(`"Loading": ${text.includes('Loading') ? 'YES' : 'NO'}`);
    console.log(`Any table content: ${text.includes('Name') || text.includes('Rajesh') ? 'YES' : 'NO'}`);
    
    console.log('\nDEBUG - Checking React rendering:');
    const html = await page.evaluate(() => {
      const root = document.getElementById('root');
      return {
        rootExists: !!root,
        rootChildCount: root?.children.length || 0,
        rootInnerHTMLSize: root?.innerHTML.length || 0,
        rootInnerHTML: root?.innerHTML.substring(0, 300) || '',
      };
    });

    console.log(`Root element exists: ${html.rootExists}`);
    console.log(`Root children: ${html.rootChildCount}`);
    console.log(`Root HTML size: ${html.rootInnerHTMLSize}`);
    console.log(`\nRoot HTML preview:\n${html.rootInnerHTML}`);

  } catch (error) {
    console.error('Error:', error.message);
  }

  await browser.close();
}

await check();
