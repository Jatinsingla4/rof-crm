import { chromium } from '@playwright/test';

async function extract() {
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

    const html = await page.evaluate(() => {
      return {
        rootHTML: document.getElementById('root')?.innerHTML || '',
        mainContent: document.querySelector('main')?.innerHTML || '',
      };
    });

    // Save to file for easier inspection
    console.log('ROOT HTML (first 2000 chars):');
    console.log(html.rootHTML.substring(0, 2000));
    
    console.log('\n\nLOOKING FOR CONSUMERS SECTION:');
    const consumersSectionStart = html.rootHTML.indexOf('Consumers');
    if (consumersSectionStart > -1) {
      console.log(html.rootHTML.substring(consumersSectionStart, consumersSectionStart + 500));
    } else {
      console.log('(consumers section not found)');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }

  await browser.close();
}

await extract();
