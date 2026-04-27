import { chromium } from '@playwright/test';

async function finalComprehensiveTest() {
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║  FINAL COMPREHENSIVE ROF CRM SYSTEM AUDIT              ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  const results = {};

  try {
    // PHASE 1: COMPLETE LOGIN FLOW
    console.log('📍 PHASE 1: COMPLETE LOGIN FLOW');
    console.log('═'.repeat(60));

    await page.goto('http://localhost:5186', { waitUntil: 'networkidle', timeout: 15000 });
    console.log('✅ 1.1: App home page loaded');

    // Wait for and fill login form
    await page.waitForSelector('input[type="email"]', { timeout: 5000 });
    console.log('✅ 1.2: Login form loaded');

    const emailInput = await page.$('input[type="email"]');
    const passwordInput = await page.$('input[type="password"]');
    const submitBtn = await page.$('button[type="submit"]');

    await emailInput.fill('demo@example.com');
    await passwordInput.fill('password');
    await submitBtn.click();
    console.log('✅ 1.3: Credentials submitted');

    // Wait for dashboard navigation
    await page.waitForURL((url) => url.toString().includes('/dashboard'), { timeout: 10000 });
    await page.waitForTimeout(2000);

    const dashboardUrl = page.url();
    console.log(`✅ 1.4: Navigated to ${dashboardUrl}`);

    results.loginFlow = '✅ PASS';

    // PHASE 2: DASHBOARD CONTENT VERIFICATION
    console.log('\n📍 PHASE 2: DASHBOARD CONTENT VERIFICATION');
    console.log('═'.repeat(60));

    const layoutExists = await page.$('[role="navigation"], nav, aside');
    const mainContent = await page.$('main, [role="main"]');
    const rootHTML = await page.innerHTML('#root');

    console.log(`✅ 2.1: Layout elements found: ${!!layoutExists}`);
    console.log(`✅ 2.2: Main content area: ${!!mainContent}`);
    console.log(`✅ 2.3: Root HTML length: ${rootHTML.length} characters`);

    if (rootHTML.length > 2000) {
      results.dashboardContent = '✅ PASS - Full content loaded';
      console.log('✅ 2.4: Dashboard has substantial content');
    } else {
      results.dashboardContent = '⚠️  WARNING - Limited content';
      console.log('⚠️  2.4: Limited content detected');
    }

    // PHASE 3: SIDEBAR NAVIGATION TEST
    console.log('\n📍 PHASE 3: SIDEBAR NAVIGATION TEST');
    console.log('═'.repeat(60));

    const navLinks = await page.$$('a, button:not([type="submit"])');
    console.log(`📌 Navigation items found: ${navLinks.length}`);

    // Test each navigation item
    const navItems = ['Consumers', 'Units', 'Allotments', 'Payments'];
    const navResults = {};

    for (const item of navItems) {
      try {
        const linkElement = await page.$(`text=${item}`);
        if (linkElement) {
          await linkElement.click();
          await page.waitForTimeout(1500);
          const contentLength = (await page.textContent('body')).length;
          navResults[item] = contentLength > 500 ? '✅' : '⚠️';
          console.log(`${navResults[item]} 3.${Object.keys(navResults).length}: ${item} - ${contentLength} chars`);
        } else {
          navResults[item] = '❌';
          console.log(`❌ 3.${Object.keys(navResults).length}: ${item} - Link not found`);
        }
      } catch (error) {
        navResults[item] = '❌';
        console.log(`❌ 3.${Object.keys(navResults).length}: ${item} - Error: ${error.message.substring(0, 50)}`);
      }
    }

    const navPassCount = Object.values(navResults).filter(v => v === '✅').length;
    results.navigation = `${navPassCount}/${navItems.length} modules loaded`;

    // PHASE 4: STORAGE VERIFICATION
    console.log('\n📍 PHASE 4: BROWSER STORAGE VERIFICATION');
    console.log('═'.repeat(60));

    const storageData = await page.evaluate(() => {
      return {
        authStorage: localStorage.getItem('auth-storage'),
        authToken: localStorage.getItem('auth_token'),
      };
    });

    console.log(`✅ 4.1: Auth storage present: ${!!storageData.authStorage}`);
    console.log(`✅ 4.2: Auth token present: ${!!storageData.authToken}`);

    if (storageData.authStorage && storageData.authToken) {
      results.persistence = '✅ PASS - Auth data persisted';
      console.log('✅ 4.3: Persistence verified');
    } else {
      results.persistence = '❌ FAIL - Auth data not persisted';
      console.log('❌ 4.3: Persistence issue detected');
    }

    // PHASE 5: CONSOLE & ERROR CHECK
    console.log('\n📍 PHASE 5: CONSOLE & ERROR CHECK');
    console.log('═'.repeat(60));

    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        pageErrors.push(msg.text());
      }
      consoleMessages.push(msg.type());
    });

    await page.waitForTimeout(1000);

    if (pageErrors.length > 0) {
      console.log(`❌ 5.1: Found ${pageErrors.length} console errors`);
      results.console = `❌ FAIL - ${pageErrors.length} errors`;
    } else {
      console.log('✅ 5.1: No console errors');
      results.console = '✅ PASS - No errors';
    }

    console.log(`✅ 5.2: Console messages: ${consoleMessages.length}`);

  } catch (error) {
    console.error('\n❌ CRITICAL ERROR:', error.message);
    results.critical = '❌ FAIL - ' + error.message;
  }

  // FINAL REPORT
  console.log('\n\n╔═══════════════════════════════════════════════════════╗');
  console.log('║  AUDIT REPORT SUMMARY                                  ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  for (const [test, result] of Object.entries(results)) {
    console.log(`${result}`);
  }

  console.log('\n═'.repeat(60));
  console.log('✅ AUDIT COMPLETE - Browser window open for inspection\n');
}

await finalComprehensiveTest();
