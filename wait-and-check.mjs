import { chromium } from '@playwright/test';

async function waitAndCheck() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:5186', { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="email"]').fill('demo@example.com');
    await page.locator('input[type="password"]').fill('password');
    await page.locator('button', { hasText: 'Sign In' }).click();
    await page.waitForURL('**/dashboard');

    console.log('🔍 CONSUMERS PAGE - DETAILED CHECK');
    console.log('═'.repeat(60));

    // Wait to see if there's an API call happening
    console.log('Navigating to /consumers...');
    const navigationStart = Date.now();
    await page.goto('http://localhost:5186/consumers', { waitUntil: 'domcontentloaded' });
    console.log(`Navigation took: ${Date.now() - navigationStart}ms\n`);

    // Wait progressively longer and check at intervals
    for (let wait = 1000; wait <= 5000; wait += 1000) {
      await page.waitForTimeout(1000);

      const state = await page.evaluate(() => {
        const root = document.getElementById('root');
        const htmlSize = root?.innerHTML.length || 0;
        const text = root?.innerText || '';
        
        return {
          htmlSize,
          hasErrorMsg: text.includes('Failed'),
          hasLoadingMsg: text.includes('Loading') || htmlSize > 2000 && htmlSize < 1000,
          hasDataMsg: text.includes('Rajesh') || text.includes('Priya') || text.includes('Consumers'),
          textSnippet: text.substring(0, 150),
          htmlSnippet: root?.innerHTML.substring(0, 150) || '',
        };
      });

      console.log(`After ${wait}ms:`);
      console.log(`  HTML size: ${state.htmlSize} chars`);
      console.log(`  Has error: ${state.hasErrorMsg}`);
      console.log(`  Has loading: ${state.hasLoadingMsg}`);
      console.log(`  Has data names: ${state.hasDataMsg}`);
      console.log(`  Text: ${state.textSnippet.substring(0, 80)}\n`);

      if (state.hasDataMsg || state.hasErrorMsg) break;
    }

  } catch (error) {
    console.error('Error:', error.message);
  }

  await browser.close();
}

await waitAndCheck();
