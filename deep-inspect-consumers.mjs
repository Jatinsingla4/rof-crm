import { chromium } from '@playwright/test';

async function deepInspect() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Capture console logs
  const consoleLogs = [];
  page.on('console', msg => {
    if (msg.type() === 'log' || msg.type() === 'error') {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    }
  });

  try {
    await page.goto('http://localhost:5186', { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="email"]').fill('demo@example.com');
    await page.locator('input[type="password"]').fill('password');
    await page.locator('button', { hasText: 'Sign In' }).click();
    await page.waitForURL('**/dashboard');

    await page.goto('http://localhost:5186/consumers', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    const inspection = await page.evaluate(() => {
      const root = document.getElementById('root');
      
      return {
        rootHTML: root?.innerHTML.length || 0,
        tables: document.querySelectorAll('table').length,
        divs: document.querySelectorAll('div').length,
        // Look for any cell-like elements
        cells: document.querySelectorAll('[role="cell"], td, th').length,
        // Check for specific component strings
        hasSearchFilter: !!document.querySelector('[class*="search"], [class*="filter"]'),
        // All text in root
        rootText: root?.innerText.substring(0, 500) || '',
        // Check for React rendered elements
        hasReactContent: root?.innerHTML.includes('class=') && root.innerHTML.length > 500,
        // Check root structure
        rootChildren: root?.children.length || 0,
      };
    });

    console.log('DEEP INSPECTION OF CONSUMERS PAGE');
    console.log('═'.repeat(60));
    console.log(`Root HTML size: ${inspection.rootHTML} chars`);
    console.log(`Root children: ${inspection.rootChildren}`);
    console.log(`Tables found: ${inspection.tables}`);
    console.log(`Cells found: ${inspection.cells}`);
    console.log(`Has search filter: ${inspection.hasSearchFilter}`);
    console.log(`Has React content: ${inspection.hasReactContent}\n`);

    console.log('ROOT TEXT CONTENT:');
    console.log('─'.repeat(60));
    console.log(inspection.rootText || '(empty)');

    console.log('\nCONSOLE LOGS:');
    console.log('─'.repeat(60));
    if (consoleLogs.length > 0) {
      consoleLogs.slice(0, 20).forEach(log => {
        console.log(log.substring(0, 150));
      });
    } else {
      console.log('(no logs)');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }

  await browser.close();
}

await deepInspect();
