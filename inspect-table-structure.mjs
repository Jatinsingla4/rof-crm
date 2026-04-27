import { chromium } from '@playwright/test';

async function inspect() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:5186', { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="email"]').fill('demo@example.com');
    await page.locator('input[type="password"]').fill('password');
    await page.locator('button', { hasText: 'Sign In' }).click();
    await page.waitForURL('**/dashboard');

    await page.goto('http://localhost:5186/consumers', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const structure = await page.evaluate(() => {
      const root = document.getElementById('root');
      const html = root?.innerHTML || '';
      
      // Look for table elements
      const tables = document.querySelectorAll('table');
      const divs = document.querySelectorAll('div');
      
      // Check for specific text
      const hasRajesh = html.includes('Rajesh');
      const hasLoadingSkeleton = html.includes('Loading') || html.includes('height: 400px');
      const hasNoDataMsg = html.includes('No consumers found');
      
      // Look for specific data-related divs
      const bodyText = document.body.innerText;
      
      return {
        totalHTML: html.length,
        tableCount: tables.length,
        divCount: divs.length,
        hasRajesh,
        hasLoadingSkeleton,
        hasNoDataMsg,
        bodyText: bodyText.substring(0, 600),
        // Get a sample of HTML around where table might be
        htmlSample: html.substring(html.indexOf('Consumers'), html.indexOf('Consumers') + 1000),
      };
    });

    console.log('TABLE STRUCTURE INSPECTION');
    console.log('═'.repeat(60));
    console.log(`Total HTML: ${structure.totalHTML} chars`);
    console.log(`Tables found: ${structure.tableCount}`);
    console.log(`Divs found: ${structure.divCount}`);
    console.log(`Has "Rajesh" text: ${structure.hasRajesh}`);
    console.log(`Has loading skeleton: ${structure.hasLoadingSkeleton}`);
    console.log(`Has "No data" message: ${structure.hasNoDataMsg}\n`);

    console.log('HTML SAMPLE (around Consumers):');
    console.log('─'.repeat(60));
    console.log(structure.htmlSample.substring(0, 500));

  } catch (error) {
    console.error('Error:', error.message);
  }

  await browser.close();
}

await inspect();
