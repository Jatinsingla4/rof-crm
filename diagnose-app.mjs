import { chromium } from '@playwright/test';

async function diagnoseApp() {
  console.log('\n🔍 COMPREHENSIVE APP DIAGNOSTIC\n');
  console.log('=' .repeat(60));

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Capture all console messages
  const consoleLogs = [];
  page.on('console', (msg) => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`);
    }
  });

  // Capture page crashes
  let pageError = null;
  page.on('error', (err) => {
    pageError = err;
    console.log(`[PAGE ERROR] ${err.message}`);
  });

  try {
    console.log('\n📡 Navigating to localhost:5173...\n');
    await page.goto('http://localhost:5173', {
      waitUntil: 'networkidle',
      timeout: 15000
    });

    console.log('✅ Page loaded\n');

    // Get page title
    const title = await page.title();
    console.log(`📄 Page Title: "${title}"`);

    // Check root element
    const rootHTML = await page.innerHTML('#root');
    const rootLength = rootHTML ? rootHTML.length : 0;
    console.log(`📦 Root element HTML length: ${rootLength} characters\n`);

    if (rootHTML && rootLength > 100) {
      console.log('✅ React HAS rendered content inside #root\n');
      console.log('📋 First 300 chars of root HTML:');
      console.log(rootHTML.substring(0, 300));
      console.log('\n');
    } else {
      console.log('❌ Root element is EMPTY or has minimal content\n');
    }

    // Look for specific elements
    console.log('🔎 Checking for UI elements:\n');

    const checks = [
      { selector: 'input[type="email"]', label: 'Email Input' },
      { selector: 'input[type="password"]', label: 'Password Input' },
      { selector: 'button', label: 'Button Elements' },
      { selector: '[role="button"]', label: 'ARIA Buttons' },
      { selector: 'form', label: 'Form Elements' },
      { selector: 'h1', label: 'Headings' },
      { selector: 'div', label: 'Divs' },
    ];

    for (const check of checks) {
      const count = await page.locator(check.selector).count();
      const symbol = count > 0 ? '✅' : '❌';
      console.log(`${symbol} ${check.label}: ${count} found`);
    }

    console.log('\n');

    // Check window errors
    console.log('🛑 Checking for JavaScript errors:\n');

    const jsErrors = consoleLogs.filter(log => log.type === 'error');
    if (jsErrors.length > 0) {
      console.log(`❌ Found ${jsErrors.length} JavaScript errors:\n`);
      jsErrors.forEach((err, i) => {
        console.log(`   ${i + 1}. ${err.text}`);
      });
      console.log('\n');
    } else {
      console.log('✅ No JavaScript errors in console\n');
    }

    // Check React state
    console.log('⚛️  Checking React status:\n');
    const reactPresent = await page.evaluate(() => {
      return typeof window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined' ||
             typeof window.React !== 'undefined';
    });
    console.log(`${reactPresent ? '✅' : '❌'} React detected: ${reactPresent}\n`);

    // Try to evaluate React root
    const reactRoot = await page.evaluate(() => {
      const container = document.getElementById('root');
      if (!container) return 'NO_ROOT';
      if (container.innerHTML.length === 0) return 'EMPTY';
      if (container.innerHTML.includes('React')) return 'REACT_ERROR';
      return 'HAS_CONTENT';
    });
    console.log(`⚙️  React root state: ${reactRoot}\n`);

    // Get all warnings
    const warnings = consoleLogs.filter(log => log.type === 'warning');
    if (warnings.length > 0) {
      console.log(`⚠️  Warnings (${warnings.length}):\n`);
      warnings.slice(0, 5).forEach((warn, i) => {
        console.log(`   ${i + 1}. ${warn.text.substring(0, 100)}`);
      });
      if (warnings.length > 5) {
        console.log(`   ... and ${warnings.length - 5} more\n`);
      }
    }

    console.log('=' .repeat(60));
    console.log('\n📊 DIAGNOSIS SUMMARY:\n');

    if (rootLength === 0) {
      console.log('🔴 CRITICAL: React root is empty - nothing rendered');
      console.log('   → Likely cause: Error in App.tsx or component import');
      console.log('   → Check: Design-system imports, authStore, Router setup\n');
    } else if (rootLength < 500 && !rootHTML.includes('email')) {
      console.log('🟠 WARNING: Root has content but LoginPage not visible');
      console.log('   → Likely cause: LoginPage component not rendering');
      console.log('   → Check: Design-system components (Button, Card)\n');
    } else if (rootHTML.includes('email')) {
      console.log('🟢 SUCCESS: LoginPage IS rendering');
      console.log('   → Email and password inputs found\n');
    }

    // Take final screenshot
    await page.screenshot({ path: 'diagnostic-screenshot.png' });
    console.log('📸 Screenshot saved: diagnostic-screenshot.png\n');

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
  } finally {
    await browser.close();
  }
}

diagnoseApp();
