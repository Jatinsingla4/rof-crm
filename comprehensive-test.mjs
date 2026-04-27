import { chromium } from '@playwright/test';

async function runComprehensiveTest() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  const results = {
    login: { passed: false, details: '' },
    dashboard: { passed: false, details: '' },
    consumers: { passed: false, details: '' },
    units: { passed: false, details: '' },
    allotments: { passed: false, details: '' },
    payments: { passed: false, details: '' },
    documents: { passed: false, details: '' },
    communications: { passed: false, details: '' },
  };

  try {
    // TEST 1: LOGIN PAGE
    console.log('\n📋 TEST 1: LOGIN PAGE');
    console.log('═'.repeat(50));
    await page.goto('http://localhost:5185/login', { waitUntil: 'networkidle', timeout: 15000 });
    const emailInput = await page.$('input[type="email"]');
    const passwordInput = await page.$('input[type="password"]');
    const submitBtn = await page.$('button[type="submit"]');

    if (emailInput && passwordInput && submitBtn) {
      console.log('✅ Email field found');
      console.log('✅ Password field found');
      console.log('✅ Submit button found');

      await emailInput.fill('demo@example.com');
      await passwordInput.fill('password123');
      await submitBtn.click();

      await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 10000 });
      const currentUrl = page.url();

      if (currentUrl.includes('/dashboard')) {
        results.login.passed = true;
        results.login.details = 'Login successful, redirected to dashboard';
        console.log('✅ Login successful');
        console.log('✅ Redirected to dashboard');
      }
    }

    // TEST 2: DASHBOARD PAGE
    console.log('\n📋 TEST 2: DASHBOARD PAGE');
    console.log('═'.repeat(50));
    const dashboardContent = await page.textContent('main') || '';
    if (dashboardContent.length > 0) {
      results.dashboard.passed = true;
      results.dashboard.details = `Dashboard loaded with ${dashboardContent.length} characters`;
      console.log(`✅ Dashboard content found (${dashboardContent.length} chars)`);
      console.log('Content preview:', dashboardContent.substring(0, 100).trim());
    } else {
      results.dashboard.details = 'Dashboard content is empty';
      console.log('❌ Dashboard content is empty');
    }

    // TEST 3: CONSUMERS PAGE
    console.log('\n📋 TEST 3: CONSUMERS PAGE');
    console.log('═'.repeat(50));
    const consumersLink = await page.$('text=Consumers');
    if (consumersLink) {
      await consumersLink.click();
      await page.waitForTimeout(1500);
      const consumersContent = await page.textContent('main') || '';
      if (consumersContent.length > 0) {
        results.consumers.passed = true;
        results.consumers.details = `Consumers page loaded with ${consumersContent.length} characters`;
        console.log(`✅ Consumers content found (${consumersContent.length} chars)`);
        console.log('Content preview:', consumersContent.substring(0, 100).trim());
      } else {
        results.consumers.details = 'Consumers content is empty';
        console.log('❌ Consumers content is empty');
      }
    }

    // TEST 4: UNITS PAGE
    console.log('\n📋 TEST 4: UNITS PAGE');
    console.log('═'.repeat(50));
    const unitsLink = await page.$('text=Units');
    if (unitsLink) {
      await unitsLink.click();
      await page.waitForTimeout(1500);
      const unitsContent = await page.textContent('main') || '';
      if (unitsContent.length > 0) {
        results.units.passed = true;
        results.units.details = `Units page loaded with ${unitsContent.length} characters`;
        console.log(`✅ Units content found (${unitsContent.length} chars)`);
        console.log('Content preview:', unitsContent.substring(0, 100).trim());
      } else {
        results.units.details = 'Units content is empty';
        console.log('❌ Units content is empty');
      }
    }

    // TEST 5: ALLOTMENTS PAGE
    console.log('\n📋 TEST 5: ALLOTMENTS PAGE');
    console.log('═'.repeat(50));
    const allotmentsLink = await page.$('text=Allotments');
    if (allotmentsLink) {
      await allotmentsLink.click();
      await page.waitForTimeout(1500);
      const allotmentsContent = await page.textContent('main') || '';
      if (allotmentsContent.length > 0) {
        results.allotments.passed = true;
        results.allotments.details = `Allotments page loaded with ${allotmentsContent.length} characters`;
        console.log(`✅ Allotments content found (${allotmentsContent.length} chars)`);
        console.log('Content preview:', allotmentsContent.substring(0, 100).trim());
      } else {
        results.allotments.details = 'Allotments content is empty';
        console.log('❌ Allotments content is empty');
      }
    }

    // TEST 6: PAYMENTS PAGE
    console.log('\n📋 TEST 6: PAYMENTS PAGE');
    console.log('═'.repeat(50));
    const paymentsLink = await page.$('text=Payments');
    if (paymentsLink) {
      await paymentsLink.click();
      await page.waitForTimeout(1500);
      const paymentsContent = await page.textContent('main') || '';
      if (paymentsContent.length > 0) {
        results.payments.passed = true;
        results.payments.details = `Payments page loaded with ${paymentsContent.length} characters`;
        console.log(`✅ Payments content found (${paymentsContent.length} chars)`);
        console.log('Content preview:', paymentsContent.substring(0, 100).trim());
      } else {
        results.payments.details = 'Payments content is empty';
        console.log('❌ Payments content is empty');
      }
    }

    // TEST 7: DOCUMENTS PAGE
    console.log('\n📋 TEST 7: DOCUMENTS PAGE');
    console.log('═'.repeat(50));
    const documentsLink = await page.$('text=Documents');
    if (documentsLink) {
      await documentsLink.click();
      await page.waitForTimeout(1500);
      const documentsContent = await page.textContent('main') || '';
      if (documentsContent.length > 0) {
        results.documents.passed = true;
        results.documents.details = `Documents page loaded with ${documentsContent.length} characters`;
        console.log(`✅ Documents content found (${documentsContent.length} chars)`);
        console.log('Content preview:', documentsContent.substring(0, 100).trim());
      } else {
        results.documents.details = 'Documents content is empty';
        console.log('❌ Documents content is empty');
      }
    }

    // TEST 8: COMMUNICATIONS PAGE
    console.log('\n📋 TEST 8: COMMUNICATIONS PAGE');
    console.log('═'.repeat(50));
    const communicationsLink = await page.$('text=Communications');
    if (communicationsLink) {
      await communicationsLink.click();
      await page.waitForTimeout(1500);
      const communicationsContent = await page.textContent('main') || '';
      if (communicationsContent.length > 0) {
        results.communications.passed = true;
        results.communications.details = `Communications page loaded with ${communicationsContent.length} characters`;
        console.log(`✅ Communications content found (${communicationsContent.length} chars)`);
        console.log('Content preview:', communicationsContent.substring(0, 100).trim());
      } else {
        results.communications.details = 'Communications content is empty';
        console.log('❌ Communications content is empty');
      }
    }

  } catch (error) {
    console.error('Test error:', error.message);
  }

  // SUMMARY
  console.log('\n\n📊 TEST SUMMARY');
  console.log('═'.repeat(50));
  let passCount = 0;
  for (const [test, result] of Object.entries(results)) {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} | ${test.toUpperCase()}: ${result.details}`);
    if (result.passed) passCount++;
  }
  console.log('═'.repeat(50));
  console.log(`\nTotal: ${passCount}/${Object.keys(results).length} tests passed\n`);

  // Keep browser open for inspection
  console.log('🔍 Browser window is open for inspection. Close it manually when done.\n');
}

await runComprehensiveTest();
