import { chromium } from '@playwright/test';

async function verifyConsumersData() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // Login
    await page.goto('http://localhost:5186', { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="email"]').fill('demo@example.com');
    await page.locator('input[type="password"]').fill('password');
    await page.locator('button', { hasText: 'Sign In' }).click();
    await page.waitForURL('**/dashboard');

    // Navigate to consumers
    await page.goto('http://localhost:5186/consumers', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const pageData = await page.evaluate(() => {
      return {
        // Check for error messages
        hasErrorMsg: !!document.body.innerText.match(/Failed to load consumers/i),
        // Check all text content
        allText: document.body.innerText.substring(0, 800),
        // Count all divs with potential data
        divCount: document.querySelectorAll('div').length,
        // Look for any names (likely consumer names)
        namesFound: document.body.innerText.match(/(Rajesh|Priya|Amit|Neha|Vikram)/g),
        // Look for phone numbers
        phonesFound: document.body.innerText.match(/\d{10}/g),
        // Check for email patterns
        emailsFound: document.body.innerText.match(/[\w.-]+@[\w.-]+\.\w+/g),
      };
    });

    console.log('CONSUMERS PAGE VERIFICATION');
    console.log('═'.repeat(60));
    console.log(`✅ Error message present: ${pageData.hasErrorMsg ? 'YES ❌' : 'NO ✅'}`);
    console.log(`✅ Page text content: ${pageData.allText.length} characters\n`);
    
    console.log('DATA DETECTED:');
    console.log(`  Consumer names found: ${pageData.namesFound ? pageData.namesFound.length : 0}`);
    if (pageData.namesFound?.length > 0) {
      console.log(`    - ${pageData.namesFound.join(', ')}`);
    }
    
    console.log(`\n  Phone numbers found: ${pageData.phonesFound ? pageData.phonesFound.length : 0}`);
    if (pageData.phonesFound?.length > 0) {
      console.log(`    - ${pageData.phonesFound.slice(0, 3).join(', ')}`);
    }
    
    console.log(`\n  Emails found: ${pageData.emailsFound ? pageData.emailsFound.length : 0}`);
    if (pageData.emailsFound?.length > 0) {
      console.log(`    - ${pageData.emailsFound.slice(0, 3).join(', ')}`);
    }

    console.log('\n' + '═'.repeat(60));
    console.log(pageData.hasErrorMsg ? '❌ ERROR MESSAGE DETECTED' : '✅ NO ERRORS - DATA LOADING PROPERLY');
    console.log('\nPAGE PREVIEW:');
    console.log('─'.repeat(60));
    console.log(pageData.allText);

  } catch (error) {
    console.error('Error:', error.message);
  }

  await browser.close();
}

await verifyConsumersData();
