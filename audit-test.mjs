import { chromium } from '@playwright/test';

async function auditApp() {
  console.log('\n🔍 COMPREHENSIVE ROF CRM MODULE AUDIT\n');

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // STEP 1: Navigate to app
    console.log('📍 Navigating to http://localhost:5185...');
    await page.goto('http://localhost:5185', { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Check if on login page
    const onLoginPage = page.url().includes('/login');
    console.log(onLoginPage ? '✅ On login page' : '❌ Not on login page');

    // STEP 2: Login
    console.log('\n📍 Logging in with demo@example.com...');
    const emailField = await page.$('input[type="email"]');
    const passwordField = await page.$('input[type="password"]');
    const submitButton = await page.$('button[type="submit"]');

    if (emailField && passwordField && submitButton) {
      await emailField.fill('demo@example.com');
      await passwordField.fill('password');
      await submitButton.click();

      // Wait for redirect
      await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 10000 });
      console.log('✅ Login successful');
      console.log(`✅ Now on: ${page.url()}`);
    } else {
      console.log('❌ Login form elements not found');
      return;
    }

    // Wait for layout to fully load
    await page.waitForTimeout(2000);

    // STEP 3: Check sidebar navigation
    console.log('\n📍 Checking sidebar navigation...');
    const navItems = await page.$$eval('[role="link"], button', els =>
      els.map(el => el.textContent).filter(text => text)
    );
    console.log('Navigation items found:', navItems.slice(0, 8).join(', '));

    // STEP 4-11: Test each module
    const modules = [
      { name: 'Dashboard', selector: 'text=Dashboard' },
      { name: 'Consumers', selector: 'text=Consumers' },
      { name: 'Units', selector: 'text=Units' },
      { name: 'Allotments', selector: 'text=Allotments' },
      { name: 'Payments', selector: 'text=Payments' },
      { name: 'Documents', selector: 'text=Documents' },
      { name: 'Communications', selector: 'text=Communications' },
    ];

    for (const module of modules) {
      console.log(`\n📋 Testing: ${module.name}`);
      console.log('─'.repeat(40));

      try {
        // Click the module link
        const link = await page.$(module.selector);
        if (link) {
          await link.click();
          await page.waitForTimeout(1500);

          // Get page content
          const pageText = await page.textContent('body');
          const hasContent = pageText && pageText.length > 100;

          if (hasContent) {
            console.log(`✅ ${module.name} has content`);

            // Extract heading or title
            const heading = await page.$eval('h1, h2, h3, [role="heading"]', el => el.textContent).catch(() => 'N/A');
            console.log(`   Title/Heading: ${heading}`);

            // Look for data elements
            const hasTable = await page.$('table').catch(() => null);
            const hasForm = await page.$('form').catch(() => null);
            const hasCards = await page.$$('[role="article"], .card, [class*="Card"]').catch(() => []);

            if (hasTable) console.log('   ✓ Contains table');
            if (hasForm) console.log('   ✓ Contains form');
            if (hasCards && hasCards.length > 0) console.log(`   ✓ Contains ${hasCards.length} card(s)`);

            console.log(`   📊 Total characters: ${pageText.length}`);
          } else {
            console.log(`❌ ${module.name} appears to be empty or not fully loaded`);
          }
        } else {
          console.log(`⚠️  ${module.name} link not found in sidebar`);
        }
      } catch (error) {
        console.log(`❌ Error testing ${module.name}: ${error.message.split('\n')[0]}`);
      }
    }

    // STEP 12: Test logout
    console.log(`\n📋 Testing: Logout`);
    console.log('─'.repeat(40));
    const logoutBtn = await page.$('button:has-text("Logout"), a:has-text("Logout"), text=Logout');
    if (logoutBtn) {
      await logoutBtn.click();
      await page.waitForURL((url) => url.toString().includes('/login'), { timeout: 5000 }).catch(() => {});
      console.log('✅ Logout successful');
    } else {
      console.log('⚠️  Logout button not found');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }

  console.log('\n\n🔍 Audit complete. Browser window remains open for inspection.\n');
}

await auditApp();
