import { chromium } from '@playwright/test';

async function checkDashboard() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:5186', { waitUntil: 'domcontentloaded', timeout: 10000 });
    
    // Login
    await page.waitForSelector('input[type="email"]', { timeout: 5000 });
    const emailInput = await page.$('input[type="email"]');
    const passwordInput = await page.$('input[type="password"]');
    const submitBtn = await page.$('button[type="submit"]');

    await emailInput.fill('demo@example.com');
    await passwordInput.fill('password');
    await submitBtn.click();

    // Wait for dashboard
    await page.waitForURL(url => url.toString().includes('/dashboard'), { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Check dashboard structure
    const dashboardContent = await page.evaluate(() => {
      return {
        title: document.querySelector('h1')?.textContent,
        cards: document.querySelectorAll('[class*="Card"], [class*="card"]').length,
        mainContent: document.querySelector('main')?.innerHTML.length || 0,
        rootHTML: document.getElementById('root')?.innerHTML.length || 0,
        headings: document.querySelectorAll('h1, h2, h3').length,
        textContent: document.body.textContent.trim().substring(0, 200),
      };
    });

    console.log('\n📊 DASHBOARD STRUCTURE CHECK');
    console.log('═'.repeat(60));
    console.log(`✅ URL: ${page.url()}`);
    console.log(`✅ Page Title: "${dashboardContent.title}"`);
    console.log(`✅ Headings found: ${dashboardContent.headings}`);
    console.log(`✅ Card components: ${dashboardContent.cards}`);
    console.log(`✅ Root HTML size: ${dashboardContent.rootHTML} chars`);
    console.log(`✅ Main content size: ${dashboardContent.mainContent} chars`);
    console.log(`✅ Body text preview: ${dashboardContent.textContent.substring(0, 100)}...`);

  } catch (error) {
    console.error('Error:', error.message);
  }

  await browser.close();
}

await checkDashboard();
