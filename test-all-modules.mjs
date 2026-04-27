import { chromium } from '@playwright/test';

async function testAllModules() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const results = {};

  try {
    // Login
    console.log('🔐 LOGGING IN...\n');
    await page.goto('http://localhost:5186', { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="email"]').fill('demo@example.com');
    await page.locator('input[type="password"]').fill('password');
    await page.locator('button', { hasText: 'Sign In' }).click();
    await page.waitForURL('**/dashboard');
    await page.waitForTimeout(1500);

    // Test each module
    const modules = [
      { name: 'Dashboard', url: '/dashboard', selector: 'Reports & Analytics' },
      { name: 'Consumers', url: '/consumers', selector: 'Consumers' },
      { name: 'Units', url: '/units', selector: 'Unit Inventory' },
      { name: 'Allotments', url: '/allotments/new', selector: 'Create Allotment' },
      { name: 'Payments', url: '/payments', selector: 'Payments' },
      { name: 'Documents', url: '/documents', selector: 'Document Vault' },
      { name: 'Communications', url: '/communications', selector: 'Communications' }
    ];

    for (const module of modules) {
      try {
        await page.goto(`http://localhost:5186${module.url}`, { waitUntil: 'domcontentloaded', timeout: 8000 });
        await page.waitForTimeout(1000);
        
        const content = await page.evaluate(() => document.body.innerText.substring(0, 100));
        const hasContent = content.length > 20;
        const pageTitle = await page.title();
        
        results[module.name] = {
          status: hasContent ? '✅' : '⚠️',
          message: hasContent ? 'Rendering' : 'Limited content',
          contentSize: content.length,
          title: pageTitle
        };
        
        console.log(`${results[module.name].status} ${module.name.padEnd(18)} - ${results[module.name].message} (${content.length} chars)`);
      } catch (error) {
        results[module.name] = { status: '❌', message: error.message.substring(0, 50) };
        console.log(`❌ ${module.name.padEnd(18)} - ${error.message.substring(0, 50)}`);
      }
    }

    console.log('\n📊 FINAL STATUS');
    console.log('═'.repeat(60));
    const passed = Object.values(results).filter(r => r.status === '✅').length;
    console.log(`✅ Passed: ${passed}/${modules.length}`);

  } catch (error) {
    console.error('Critical error:', error.message);
  }

  await browser.close();
}

await testAllModules();
