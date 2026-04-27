import { chromium } from '@playwright/test';

async function debugConsumersLive() {
  console.log('\n🔍 LIVE CONSUMERS PAGE DEBUG\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const networkLogs = [];
  const consoleErrors = [];

  // Capture all network activity
  page.on('request', req => {
    if (req.url().includes('/consumers')) {
      networkLogs.push({ type: 'REQUEST', url: req.url(), method: req.method() });
    }
  });

  page.on('response', res => {
    if (res.url().includes('/consumers')) {
      networkLogs.push({ type: 'RESPONSE', url: res.url(), status: res.status() });
      // Try to get response body
      res.text().then(text => {
        networkLogs.push({ type: 'BODY', text: text.substring(0, 200) });
      }).catch(() => {});
    }
  });

  // Capture console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  try {
    console.log('Step 1: Login...');
    await page.goto('http://localhost:5186', { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="email"]').fill('demo@example.com');
    await page.locator('input[type="password"]').fill('password');
    await page.locator('button', { hasText: 'Sign In' }).click();
    await page.waitForURL('**/dashboard');
    console.log('✅ Logged in\n');

    console.log('Step 2: Navigate to Consumers page...');
    await page.goto('http://localhost:5186/consumers', { waitUntil: 'domcontentloaded' });
    console.log('✅ Page loaded\n');

    console.log('Step 3: Wait for API calls and content...');
    await page.waitForTimeout(3000);

    console.log('Step 4: Check page state...');
    const pageState = await page.evaluate(() => {
      return {
        url: window.location.href,
        bodyText: document.body.innerText.substring(0, 500),
        errorMsg: !!document.body.innerText.includes('Failed to load consumers'),
        h1Text: document.querySelector('h1')?.textContent,
        rootHTML: document.getElementById('root')?.innerHTML.length || 0,
      };
    });

    console.log(`URL: ${pageState.url}`);
    console.log(`H1: ${pageState.h1Text}`);
    console.log(`Error visible: ${pageState.errorMsg}`);
    console.log(`Root HTML: ${pageState.rootHTML} chars\n`);

    console.log('NETWORK ACTIVITY:');
    console.log('─'.repeat(60));
    networkLogs.forEach((log, i) => {
      if (log.type === 'REQUEST') {
        console.log(`${i}. REQUEST: ${log.method} ${log.url.substring(log.url.indexOf('/api'))}`);
      } else if (log.type === 'RESPONSE') {
        console.log(`${i}. RESPONSE: ${log.status}`);
      } else if (log.type === 'BODY') {
        console.log(`${i}. BODY: ${log.text}`);
      }
    });

    console.log('\nCONSOLE ERRORS:');
    console.log('─'.repeat(60));
    if (consoleErrors.length > 0) {
      consoleErrors.slice(0, 5).forEach((err, i) => {
        console.log(`${i+1}. ${err.substring(0, 150)}`);
      });
    } else {
      console.log('(no errors)');
    }

    console.log('\nPAGE CONTENT PREVIEW:');
    console.log('─'.repeat(60));
    console.log(pageState.bodyText);

  } catch (error) {
    console.error('Error:', error.message);
  }

  await browser.close();
}

await debugConsumersLive();
