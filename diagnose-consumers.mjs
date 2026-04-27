import { chromium } from '@playwright/test';

async function diagnoseConsumers() {
  console.log('\n🔍 CONSUMER ENDPOINT DIAGNOSTIC\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const errors = [];
  const networkErrors = [];
  const logs = [];

  page.on('console', msg => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  page.on('response', response => {
    if (response.url().includes('/consumers') && response.status() >= 400) {
      networkErrors.push(`${response.status()}: ${response.url()}`);
    }
  });

  try {
    // Login
    console.log('1. Logging in...');
    await page.goto('http://localhost:5186', { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="email"]').fill('demo@example.com');
    await page.locator('input[type="password"]').fill('password');
    await page.locator('button', { hasText: 'Sign In' }).click();
    await page.waitForURL('**/dashboard');
    console.log('✅ Logged in\n');

    // Navigate to consumers
    console.log('2. Navigating to Consumers page...');
    await page.goto('http://localhost:5186/consumers', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    console.log('✅ Page loaded\n');

    // Check error message
    console.log('3. Checking page content...');
    const errorMsg = await page.locator('text=Failed to load consumers').isVisible().catch(() => false);
    const successMsg = await page.locator('text=Consumers').first().isVisible().catch(() => false);
    
    console.log(`   Error message visible: ${errorMsg}`);
    console.log(`   Success content visible: ${successMsg}\n`);

    // Check network requests
    console.log('4. Network requests made:');
    const requests = await page.evaluate(() => {
      return (window.__networkRequests || []).filter(r => r.url.includes('/consumers'));
    }).catch(() => []);

    console.log('   (Network request monitoring not available in this context)\n');

    // Check browser console
    console.log('5. Console output:');
    if (logs.length > 0) {
      logs.filter(l => l.includes('consumers') || l.includes('error')).slice(0, 10).forEach(log => {
        console.log(`   ${log.substring(0, 120)}`);
      });
    } else {
      console.log('   (No relevant logs)');
    }

    // Check page structure
    console.log('\n6. Page structure:');
    const structure = await page.evaluate(() => ({
      hasErrorCard: !!document.querySelector('[style*="error"]'),
      h1Text: document.querySelector('h1')?.textContent,
      errorText: document.body.innerText.match(/Failed to load/i),
    }));

    console.log(`   Error displayed: ${structure.hasErrorCard || structure.errorText ? 'YES' : 'NO'}`);
    console.log(`   H1 text: ${structure.h1Text}`);

    // Try direct API call
    console.log('\n7. Testing direct API call...');
    const authToken = await page.evaluate(() => localStorage.getItem('auth_token') || localStorage.getItem('token'));
    
    if (authToken) {
      console.log(`   ✅ Auth token found: ${authToken.substring(0, 20)}...`);
      
      try {
        const response = await fetch('http://localhost:3001/api/consumers?page=1&pageSize=20', {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          }
        });
        
        console.log(`   Response status: ${response.status}`);
        const data = await response.json();
        console.log(`   Response: ${JSON.stringify(data).substring(0, 150)}`);
      } catch (err) {
        console.log(`   ❌ Fetch error: ${err.message}`);
      }
    } else {
      console.log('   ❌ No auth token found');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }

  await browser.close();
}

await diagnoseConsumers();
