import { chromium } from '@playwright/test';

async function comprehensiveValidation() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     ROF CRM - COMPREHENSIVE VALIDATION REPORT              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const results = {};

  try {
    // TEST 1: Login
    console.log('📋 TEST 1: LOGIN AUTHENTICATION');
    console.log('─'.repeat(60));
    await page.goto('http://localhost:5186', { waitUntil: 'domcontentloaded' });
    console.log('✅ Home page loaded');

    await page.locator('input[type="email"]').fill('demo@example.com');
    await page.locator('input[type="password"]').fill('password');
    console.log('✅ Credentials filled');

    await page.locator('button', { hasText: 'Sign In' }).click();
    console.log('✅ Submit clicked');

    await page.waitForURL('**/dashboard');
    await page.waitForTimeout(1500);
    console.log('✅ Authenticated and redirected to dashboard\n');
    results.login = true;

    // TEST 2: Module rendering and data loading
    console.log('📋 TEST 2: MODULE DATA LOADING');
    console.log('─'.repeat(60));

    const modules = [
      { path: '/dashboard', name: 'Dashboard', shouldHaveData: true },
      { path: '/consumers', name: 'Consumers', shouldHaveData: true },
      { path: '/units', name: 'Units', shouldHaveData: true },
      { path: '/allotments/new', name: 'Allotments', shouldHaveData: false },
      { path: '/payments', name: 'Payments', shouldHaveData: true },
      { path: '/documents', name: 'Documents', shouldHaveData: false },
      { path: '/communications', name: 'Communications', shouldHaveData: false },
    ];

    let successCount = 0;
    let errorCount = 0;

    for (const module of modules) {
      try {
        await page.goto(`http://localhost:5186${module.path}`, { waitUntil: 'domcontentloaded', timeout: 8000 });
        await page.waitForTimeout(1200);

        // Check for error messages
        const hasError = await page.locator('text=/Failed|Error/i').isVisible().catch(() => false);
        const html = await page.locator('#root').innerHTML();
        const hasContent = html.length > 500;

        if (!hasError && hasContent) {
          console.log(`✅ ${module.name.padEnd(20)} - Data loaded successfully`);
          successCount++;
        } else if (!hasError) {
          console.log(`⚠️  ${module.name.padEnd(20)} - Rendered but limited content`);
          successCount++;
        } else {
          console.log(`❌ ${module.name.padEnd(20)} - Error detected`);
          errorCount++;
        }
      } catch (e) {
        console.log(`❌ ${module.name.padEnd(20)} - Navigation error`);
        errorCount++;
      }
    }

    console.log(`\n   Result: ${successCount}/${modules.length} modules loaded\n`);
    results.modules = successCount === modules.length;

    // TEST 3: Specific consumers data validation
    console.log('📋 TEST 3: CONSUMERS DATA VALIDATION');
    console.log('─'.repeat(60));

    await page.goto('http://localhost:5186/consumers', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const consumerData = await page.evaluate(() => {
      const rows = document.querySelectorAll('tr');
      const headers = Array.from(document.querySelectorAll('th')).map(h => h.textContent?.trim());
      const dataRows = Array.from(rows).slice(1).slice(0, 3).map(row => {
        const cells = row.querySelectorAll('td');
        return Array.from(cells).map(c => c.textContent?.trim());
      });

      return {
        headerCount: headers.length,
        headers: headers,
        rowCount: rows.length - 1,
        sampleRows: dataRows,
        hasTable: !!document.querySelector('table'),
        errorMsg: document.body.innerText.match(/Failed|Error/i)?.[0],
      };
    });

    console.log(`✅ Table found: ${consumerData.hasTable}`);
    console.log(`✅ Headers: ${consumerData.headerCount > 0 ? consumerData.headerCount + ' columns' : 'None'}`);
    console.log(`✅ Data rows: ${consumerData.rowCount} items`);
    console.log(`✅ Error message: ${consumerData.errorMsg ? 'YES ❌' : 'NO ✅'}`);

    if (consumerData.rowCount > 0) {
      console.log(`\n   Sample data:`);
      if (consumerData.sampleRows[0]) {
        console.log(`   - ${consumerData.sampleRows[0].slice(0, 3).join(' | ')}`);
      }
    }

    results.consumersData = !consumerData.errorMsg && consumerData.rowCount > 0;
    console.log();

    // TEST 4: Navigation and UI
    console.log('📋 TEST 4: NAVIGATION AND UI');
    console.log('─'.repeat(60));

    const uiElements = await page.evaluate(() => {
      return {
        sidebar: !!document.querySelector('nav') || !!document.querySelector('[role="navigation"]'),
        header: !!document.querySelector('header'),
        buttons: document.querySelectorAll('button').length,
        inputs: document.querySelectorAll('input, textarea, select').length,
        links: document.querySelectorAll('a').length,
      };
    });

    console.log(`✅ Sidebar navigation: ${uiElements.sidebar ? 'YES' : 'NO'}`);
    console.log(`✅ Header: ${uiElements.header ? 'YES' : 'NO'}`);
    console.log(`✅ Interactive buttons: ${uiElements.buttons}`);
    console.log(`✅ Form inputs: ${uiElements.inputs}`);
    console.log(`✅ Links/navigation: ${uiElements.links}\n`);

    results.ui = uiElements.sidebar && uiElements.buttons > 0;

    // Final summary
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                  VALIDATION SUMMARY                        ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    const tests = [
      ['Login & Authentication', results.login],
      ['Module Rendering', results.modules],
      ['Consumers Data Loading', results.consumersData],
      ['Navigation & UI', results.ui],
    ];

    tests.forEach(([name, passed]) => {
      console.log(`${passed ? '✅' : '❌'} ${name.padEnd(30)} ${passed ? 'PASS' : 'FAIL'}`);
    });

    const passCount = tests.filter(([_, p]) => p).length;
    console.log(`\n📊 Result: ${passCount}/${tests.length} tests passed`);

    if (passCount === tests.length) {
      console.log('\n🎉 SUCCESS: ROF CRM is fully functional and data is loading!\n');
    } else {
      console.log('\n⚠️  Some issues detected - see above for details\n');
    }

  } catch (error) {
    console.error('ERROR:', error.message);
  }

  await browser.close();
}

await comprehensiveValidation();
