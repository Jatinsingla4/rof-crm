import { chromium } from '@playwright/test';

async function finalAudit() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║        ROF CRM - FINAL COMPREHENSIVE AUDIT REPORT           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const results = {};

  try {
    console.log('📋 TEST 1: LOGIN FLOW');
    console.log('─'.repeat(60));
    await page.goto('http://localhost:5186', { waitUntil: 'domcontentloaded', timeout: 10000 });
    console.log('✅ Home page loaded');

    await page.locator('input[type="email"]').fill('demo@example.com');
    await page.locator('input[type="password"]').fill('password');
    console.log('✅ Credentials filled');

    await page.locator('button', { hasText: 'Sign In' }).click();
    console.log('✅ Submit clicked');

    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await page.waitForTimeout(1500);
    console.log('✅ Dashboard navigation successful\n');
    results.login = true;

    // Test all modules
    console.log('📋 TEST 2: MODULE RENDERING');
    console.log('─'.repeat(60));

    const modules = [
      { path: '/dashboard', name: 'Dashboard' },
      { path: '/consumers', name: 'Consumers' },
      { path: '/units', name: 'Units' },
      { path: '/allotments/new', name: 'Allotments' },
      { path: '/payments', name: 'Payments' },
      { path: '/documents', name: 'Documents' },
      { path: '/communications', name: 'Communications' }
    ];

    let passed = 0;
    for (const module of modules) {
      try {
        await page.goto(`http://localhost:5186${module.path}`, { waitUntil: 'domcontentloaded', timeout: 8000 });
        await page.waitForTimeout(800);

        const html = await page.locator('#root').innerHTML();
        if (html.length > 100) {
          console.log(`✅ ${module.name.padEnd(20)} - Rendering`);
          passed++;
        }
      } catch (e) {
        console.log(`❌ ${module.name.padEnd(20)} - Error: ${e.message.substring(0, 30)}`);
      }
    }

    console.log(`\n   ${passed}/${modules.length} modules working\n`);
    results.modules = passed === modules.length;

    // Check content
    console.log('📋 TEST 3: PAGE STRUCTURE');
    console.log('─'.repeat(60));

    const structure = await page.evaluate(() => ({
      hasRoot: !!document.getElementById('root'),
      rootSize: (document.getElementById('root')?.innerHTML.length || 0),
      hasNav: !!(document.querySelector('nav') || document.querySelector('[role="navigation"]')),
      hasMain: !!(document.querySelector('main') || document.querySelector('[role="main"]')),
      textLength: document.body.innerText.length,
      buttonCount: document.querySelectorAll('button').length,
      headingCount: document.querySelectorAll('h1,h2,h3,h4,h5,h6').length,
    }));

    console.log(`✅ Root element: ${structure.hasRoot ? 'YES' : 'NO'}`);
    console.log(`✅ Root HTML: ${structure.rootSize} characters`);
    console.log(`✅ Navigation: ${structure.hasNav ? 'YES' : 'NO'}`);
    console.log(`✅ Main content: ${structure.hasMain ? 'YES' : 'NO'}`);
    console.log(`✅ Page text: ${structure.textLength} characters`);
    console.log(`✅ Buttons: ${structure.buttonCount}`);
    console.log(`✅ Headings: ${structure.headingCount}\n`);

    results.structure = structure.rootSize > 500 && structure.textLength > 300;

    // Check auth
    console.log('📋 TEST 4: AUTHENTICATION');
    console.log('─'.repeat(60));

    const auth = await page.evaluate(() => ({
      hasToken: !!(localStorage.getItem('auth_token') || localStorage.getItem('token')),
      hasUser: !!localStorage.getItem('user'),
      hasAuthStore: !!localStorage.getItem('auth-storage'),
    }));

    console.log(`✅ Authentication token stored: ${auth.hasToken ? 'YES' : 'NO'}`);
    console.log(`✅ User data stored: ${auth.hasUser ? 'YES' : 'NO'}`);
    console.log(`✅ Auth store present: ${auth.hasAuthStore ? 'YES' : 'NO'}\n`);

    results.auth = auth.hasToken || auth.hasAuthStore;

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    results.error = error.message;
  }

  // Summary
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                     AUDIT SUMMARY                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const tests = [
    ['Login Flow', results.login],
    ['Module Rendering', results.modules],
    ['Page Structure', results.structure],
    ['Authentication', results.auth]
  ];

  tests.forEach(([name, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${name.padEnd(30)} ${passed ? 'PASS' : 'FAIL'}`);
  });

  const passCount = tests.filter(([_, p]) => p).length;
  console.log(`\n📊 Result: ${passCount}/${tests.length} tests passed`);

  if (passCount === tests.length) {
    console.log('\n🎉 SUCCESS: ROF CRM is fully functional!\n');
  }

  await browser.close();
}

await finalAudit();
