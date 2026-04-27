import { chromium } from '@playwright/test';

async function rootCauseDiagnostic() {
  console.log('\n🔥 ROOT CAUSE DIAGNOSTIC - DEEP ANALYSIS\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const diagnostics = {
    errors: [],
    warnings: [],
    logs: [],
    networkErrors: [],
    domState: {},
  };

  // Capture all console messages
  page.on('console', (msg) => {
    const entry = `[${msg.type().toUpperCase()}] ${msg.text()}`;
    diagnostics.logs.push(entry);
    if (msg.type() === 'error') {
      diagnostics.errors.push(msg.text());
    } else if (msg.type() === 'warning') {
      diagnostics.warnings.push(msg.text());
    }
  });

  // Capture page errors
  page.on('pageerror', (err) => {
    diagnostics.errors.push(`PageError: ${err.message}`);
  });

  // Capture network errors
  page.on('requestfailed', (request) => {
    diagnostics.networkErrors.push(`${request.failure().errorText}: ${request.url()}`);
  });

  try {
    console.log('📍 Step 1: Navigate to home page');
    await page.goto('http://localhost:5186', { waitUntil: 'domcontentloaded', timeout: 15000 });
    console.log('✅ Home page loaded\n');

    console.log('📍 Step 2: Wait for and interact with login form');
    await page.waitForSelector('input[type="email"]', { timeout: 5000 });
    console.log('✅ Login form elements found');

    const emailField = await page.$('input[type="email"]');
    const passField = await page.$('input[type="password"]');

    if (!emailField || !passField) {
      throw new Error('Login form fields not found');
    }

    await emailField.fill('demo@example.com');
    await passField.fill('password');
    console.log('✅ Credentials filled\n');

    console.log('📍 Step 3: Find and click submit button');
    const buttons = await page.$$('button');
    console.log(`Found ${buttons.length} buttons on page`);

    let submitBtn = null;
    for (const btn of buttons) {
      const type = await btn.getAttribute('type');
      const text = await btn.textContent();
      console.log(`  - Button type="${type}", text="${text?.trim()}"`);
      if (type === 'submit' || text?.includes('Sign In')) {
        submitBtn = btn;
        break;
      }
    }

    if (!submitBtn) {
      throw new Error('Submit button not found');
    }

    await submitBtn.click();
    console.log('✅ Submit button clicked\n');

    console.log('📍 Step 4: Wait for navigation and page load');
    await page.waitForTimeout(3000); // Give page time to load

    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}\n`);

    console.log('📍 Step 5: Analyze DOM state');
    const domAnalysis = await page.evaluate(() => {
      const root = document.getElementById('root');
      const body = document.body;
      const main = document.querySelector('main');
      const sidebar = document.querySelector('[role="navigation"], nav, aside');

      return {
        rootElement: {
          exists: !!root,
          htmlLength: root?.innerHTML.length || 0,
          textLength: root?.textContent.length || 0,
          children: root?.children.length || 0,
        },
        bodyElement: {
          htmlLength: body?.innerHTML.length || 0,
          textLength: body?.textContent.length || 0,
          classes: body?.className || 'no classes',
        },
        mainElement: {
          exists: !!main,
          htmlLength: main?.innerHTML.length || 0,
          textLength: main?.textContent.length || 0,
        },
        sidebarElement: {
          exists: !!sidebar,
          htmlLength: sidebar?.innerHTML.length || 0,
        },
        documentState: {
          readyState: document.readyState,
          title: document.title,
        },
        reactStatus: {
          reactLoaded: typeof window.React !== 'undefined',
          reactDOMLoaded: typeof window.ReactDOM !== 'undefined',
          createRootFunction: typeof window.ReactDOM?.createRoot !== 'undefined',
        },
        appElement: {
          appElements: document.querySelectorAll('[class*="app"], [id*="app"]').length,
          layoutElements: document.querySelectorAll('[class*="layout"], [role*="layout"]').length,
        },
        errorBoundary: {
          errorElements: document.querySelectorAll('[class*="error"]').length,
          scripts: document.querySelectorAll('script').length,
        },
      };
    });

    diagnostics.domState = domAnalysis;

    console.log('DOM ANALYSIS:');
    console.log('─'.repeat(60));
    console.log('Root Element:');
    console.log(`  Exists: ${domAnalysis.rootElement.exists}`);
    console.log(`  HTML: ${domAnalysis.rootElement.htmlLength} chars`);
    console.log(`  Text: ${domAnalysis.rootElement.textLength} chars`);
    console.log(`  Children: ${domAnalysis.rootElement.children}`);

    console.log('\nMain Content:');
    console.log(`  Main exists: ${domAnalysis.mainElement.exists}`);
    console.log(`  Main HTML: ${domAnalysis.mainElement.htmlLength} chars`);
    console.log(`  Main text: ${domAnalysis.mainElement.textLength} chars`);

    console.log('\nSidebar:');
    console.log(`  Sidebar exists: ${domAnalysis.sidebarElement.exists}`);
    console.log(`  Sidebar HTML: ${domAnalysis.sidebarElement.htmlLength} chars`);

    console.log('\nReact Status:');
    console.log(`  React loaded: ${domAnalysis.reactStatus.reactLoaded}`);
    console.log(`  ReactDOM loaded: ${domAnalysis.reactStatus.reactDOMLoaded}`);

    console.log('\nDocument:');
    console.log(`  Ready state: ${domAnalysis.documentState.readyState}`);
    console.log(`  Title: ${domAnalysis.documentState.title}`);

  } catch (error) {
    diagnostics.errors.push(`Test Error: ${error.message}`);
    console.error('\n❌ Error during test:', error.message);
  }

  // Print full diagnostic report
  console.log('\n\n📊 FULL DIAGNOSTIC REPORT');
  console.log('═'.repeat(60));

  if (diagnostics.errors.length > 0) {
    console.log('\n❌ ERRORS FOUND:');
    diagnostics.errors.forEach((err, i) => {
      console.log(`${i + 1}. ${err}`);
    });
  } else {
    console.log('\n✅ No errors detected');
  }

  if (diagnostics.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    diagnostics.warnings.forEach((warn, i) => {
      console.log(`${i + 1}. ${warn}`);
    });
  }

  if (diagnostics.networkErrors.length > 0) {
    console.log('\n🌐 NETWORK ERRORS:');
    diagnostics.networkErrors.forEach((err, i) => {
      console.log(`${i + 1}. ${err}`);
    });
  }

  if (diagnostics.logs.length > 0) {
    console.log(`\n📝 CONSOLE LOGS (${diagnostics.logs.length} total):`);
    diagnostics.logs.slice(0, 10).forEach((log, i) => {
      console.log(`${i + 1}. ${log.substring(0, 150)}`);
    });
  }

  console.log('\n\n🔍 ROOT CAUSE ANALYSIS:');
  console.log('═'.repeat(60));

  const root = diagnostics.domState.rootElement;
  const main = diagnostics.domState.mainElement;

  if (!root.exists) {
    console.log('❌ ROOT CAUSE: #root element does not exist!');
  } else if (root.htmlLength === 0 && root.textLength === 0) {
    console.log('❌ ROOT CAUSE: Root element is completely empty!');
  } else if (root.htmlLength < 100) {
    console.log('❌ ROOT CAUSE: Root element has minimal content (rendering issue)');
  } else if (!main.exists && root.htmlLength > 500) {
    console.log('❌ ROOT CAUSE: Layout structure missing - main content area not found');
  } else if (diagnostics.errors.length > 0) {
    console.log('❌ ROOT CAUSE: JavaScript/React errors preventing render');
    diagnostics.errors.forEach(err => {
      console.log(`   → ${err.substring(0, 100)}`);
    });
  } else {
    console.log('✅ App appears to be rendering correctly');
  }

  await browser.close();

  return diagnostics;
}

const results = await rootCauseDiagnostic();
console.log('\n✅ Diagnostic complete\n');
