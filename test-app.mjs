import { chromium } from '@playwright/test';

async function testApp() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  console.log('\n📱 Opening localhost:5173...\n');

  try {
    // Navigate to the app
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 10000 });

    // Take a screenshot
    await page.screenshot({ path: 'screenshot-1.png' });
    console.log('✅ Screenshot saved: screenshot-1.png\n');

    // Check page title
    const title = await page.title();
    console.log(`📄 Page Title: "${title}"\n`);

    // Check for React root element
    const rootElement = await page.$('#root');
    if (rootElement) {
      console.log('✅ React root element found\n');
    } else {
      console.log('❌ React root element NOT found\n');
    }

    // Get page content
    const content = await page.content();
    console.log('📋 Page HTML (first 500 chars):\n');
    console.log(content.substring(0, 500));
    console.log('\n...\n');

    // Check for console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log(`🔴 Console Error: ${msg.text()}\n`);
      }
    });

    // Wait a bit for React to render
    await page.waitForTimeout(3000);

    // Check if login form exists
    const emailInput = await page.$('input[type="email"]');
    if (emailInput) {
      console.log('✅ Login form found - EMAIL input visible\n');

      // Try to interact with it
      await emailInput.fill('test@example.com');
      console.log('✅ Successfully filled email field\n');

      // Take another screenshot
      await page.screenshot({ path: 'screenshot-2.png' });
      console.log('✅ Screenshot saved: screenshot-2.png\n');
    } else {
      console.log('❌ Login form NOT found - EMAIL input missing\n');
    }

    // Check for any JavaScript errors in network
    const responses = [];
    page.on('response', (response) => {
      if (response.status() >= 400) {
        console.log(`⚠️  HTTP ${response.status()}: ${response.url()}\n`);
      }
    });

    console.log('✅ Test completed! Check screenshots for visual inspection.\n');
    console.log('📸 Screenshots saved:');
    console.log('   - screenshot-1.png (initial load)');
    console.log('   - screenshot-2.png (after interaction)\n');

  } catch (error) {
    console.error('❌ Error:', error.message, '\n');
  } finally {
    // Don't close - keep browser open for user inspection
    console.log('🔍 Browser window still open for inspection. Close it manually when done.\n');
    // await browser.close();
  }
}

testApp();
