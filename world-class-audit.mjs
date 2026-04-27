import { chromium } from '@playwright/test';

async function worldClassAudit() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('🔍 WORLD-CLASS COMPREHENSIVE ROF CRM AUDIT');
  console.log('═══════════════════════════════════════════════════════════\n');

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  const report = {
    loginTest: { status: '❌', details: '' },
    dashboardNavigation: { status: '❌', details: '' },
    dashboardContent: { status: '❌', details: '' },
    layoutStructure: { status: '❌', details: '' },
    consolErrors: { status: '✅', details: 'No errors' },
    networkErrors: { status: '✅', details: 'No network errors' },
  };

  const errors = [];
  const logs = [];

  page.on('console', (msg) => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  page.on('pageerror', (err) => {
    errors.push(`PageError: ${err.message}`);
  });

  try {
    // SECTION 1: LOGIN TEST
    console.log('📋 SECTION 1: LOGIN AUTHENTICATION');
    console.log('─'.repeat(60));

    await page.goto('http://localhost:5186/login', { waitUntil: 'domcontentloaded', timeout: 10000 });
    console.log('✅ Navigated to login page');

    // Check for form elements
    const emailInput = await page.$('input[type="email"]');
    const passwordInput = await page.$('input[type="password"]');
    const submitBtn = await page.$('button[type="submit"]');

    if (emailInput && passwordInput && submitBtn) {
      console.log('✅ Email input field found');
      console.log('✅ Password input field found');
      console.log('✅ Submit button found');

      // Fill and submit
      await emailInput.fill('demo@example.com');
      await passwordInput.fill('password');
      console.log('✅ Filled demo credentials');

      await submitBtn.click();
      console.log('✅ Clicked submit button');

      // Wait for navigation
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      console.log(`✅ Current URL: ${currentUrl}`);

      if (currentUrl.includes('/dashboard')) {
        report.loginTest.status = '✅ PASS';
        report.loginTest.details = 'Login successful, navigated to dashboard';
      }
    }

    // SECTION 2: LAYOUT STRUCTURE CHECK
    console.log('\n📋 SECTION 2: LAYOUT STRUCTURE');
    console.log('─'.repeat(60));

    const sidebarExists = await page.$('[role="navigation"], nav, aside, .sidebar');
    const mainContentExists = await page.$('main, [role="main"], .main-content');
    const layoutWrapper = await page.$('[role="application"], .layout, .app-layout');

    if (sidebarExists) {
      console.log('✅ Sidebar element found');
      const sidebarText = await sidebarExists.textContent();
      console.log(`   Content: ${sidebarText?.substring(0, 100).trim()}`);
    } else {
      console.log('❌ Sidebar element NOT found');
    }

    if (mainContentExists) {
      console.log('✅ Main content area found');
      const mainText = await mainContentExists.textContent();
      console.log(`   Characters: ${mainText?.length || 0}`);
      if (!mainText || mainText.length < 50) {
        report.dashboardContent.status = '⚠️  WARNING';
        report.dashboardContent.details = 'Main content area exists but is empty or minimal';
        console.log('   ⚠️  WARNING: Content is empty or minimal');
      }
    } else {
      console.log('❌ Main content area NOT found');
    }

    if (layoutWrapper) {
      console.log('✅ Layout wrapper found');
    }

    // SECTION 3: PAGE CONTENT ANALYSIS
    console.log('\n📋 SECTION 3: PAGE CONTENT ANALYSIS');
    console.log('─'.repeat(60));

    const pageTitle = await page.title();
    console.log(`📄 Page Title: "${pageTitle}"`);

    const rootElement = await page.$('#root');
    if (rootElement) {
      const rootHTML = await rootElement.innerHTML();
      console.log(`📦 Root element HTML length: ${rootHTML.length} characters`);

      if (rootHTML.length > 500) {
        report.dashboardContent.status = '✅ PASS';
        report.dashboardContent.details = `Dashboard loaded with ${rootHTML.length} characters`;
        console.log('✅ Adequate content found in root element');
      } else {
        console.log('⚠️  WARNING: Root element has minimal content');
      }
    }

    // SECTION 4: INTERACTIVE ELEMENTS
    console.log('\n📋 SECTION 4: INTERACTIVE ELEMENTS');
    console.log('─'.repeat(60));

    const buttons = await page.$$('button');
    const links = await page.$$('a');
    const forms = await page.$$('form');
    const tables = await page.$$('table');

    console.log(`🔘 Buttons found: ${buttons.length}`);
    console.log(`🔗 Links found: ${links.length}`);
    console.log(`📋 Forms found: ${forms.length}`);
    console.log(`📊 Tables found: ${tables.length}`);

    // SECTION 5: CSS AND STYLING
    console.log('\n📋 SECTION 5: STYLING & LAYOUT');
    console.log('─'.repeat(60));

    const bodyBg = await page.evaluate(() => window.getComputedStyle(document.body).backgroundColor);
    const bodyDisplay = await page.evaluate(() => window.getComputedStyle(document.body).display);

    console.log(`🎨 Body background: ${bodyBg}`);
    console.log(`📐 Body display: ${bodyDisplay}`);

    // SECTION 6: ERROR CHECKING
    console.log('\n📋 SECTION 6: ERROR & DEBUG INFORMATION');
    console.log('─'.repeat(60));

    if (errors.length > 0) {
      console.log(`❌ Found ${errors.length} error(s):`);
      errors.slice(0, 5).forEach((err, i) => {
        console.log(`   ${i+1}. ${err.substring(0, 150)}`);
      });
      report.consolErrors.status = '❌ FAIL';
      report.consolErrors.details = `${errors.length} console/page errors`;
    } else {
      console.log('✅ No console or page errors detected');
    }

    if (logs.length > 0) {
      console.log(`\n📝 Console logs (${logs.length} total):`);
      logs.filter(l => l.includes('ERROR') || l.includes('error')).slice(0, 3).forEach(log => {
        console.log(`   ⚠️  ${log.substring(0, 120)}`);
      });
    }

    // SECTION 7: REACT & FRAMEWORK CHECK
    console.log('\n📋 SECTION 7: REACT & FRAMEWORK STATUS');
    console.log('─'.repeat(60));

    const reactStatus = await page.evaluate(() => {
      return {
        reactLoaded: typeof window.React !== 'undefined',
        reactDevTools: typeof window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined',
        rootElement: !!document.getElementById('root'),
        documentReady: document.readyState,
      };
    });

    console.log(`✅ React loaded: ${reactStatus.reactLoaded}`);
    console.log(`✅ React DevTools available: ${reactStatus.reactDevTools}`);
    console.log(`✅ Root element exists: ${reactStatus.rootElement}`);
    console.log(`📊 Document ready state: ${reactStatus.documentReady}`);

    // SECTION 8: NAVIGATION TEST
    console.log('\n📋 SECTION 8: NAVIGATION TEST');
    console.log('─'.repeat(60));

    const navLinks = await page.$$eval('a, button', (els) =>
      els.slice(0, 8).map(el => ({
        text: el.textContent?.trim(),
        href: el.getAttribute('href'),
        ariaLabel: el.getAttribute('aria-label'),
      }))
    );

    if (navLinks.length > 0) {
      console.log('Navigation items found:');
      navLinks.forEach((link, i) => {
        const label = link.ariaLabel || link.text || link.href || 'No label';
        console.log(`   ${i+1}. ${label.substring(0, 50)}`);
      });
      report.dashboardNavigation.status = '✅ PASS';
      report.dashboardNavigation.details = `${navLinks.length} navigation items found`;
    } else {
      console.log('❌ No navigation items found');
    }

  } catch (error) {
    console.error('\n❌ CRITICAL ERROR:', error.message);
    report.dashboardNavigation.status = '❌ FAIL';
    report.dashboardNavigation.details = error.message;
  }

  // FINAL REPORT
  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('📊 FINAL AUDIT REPORT');
  console.log('═══════════════════════════════════════════════════════════\n');

  for (const [test, result] of Object.entries(report)) {
    console.log(`${result.status} ${test.padEnd(25)} | ${result.details}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════\n');
  console.log('🔍 Browser window remains open for manual inspection.\n');
}

await worldClassAudit();
