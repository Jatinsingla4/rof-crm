import { chromium } from '@playwright/test';

async function checkHeaders() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:5186', { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="email"]').fill('demo@example.com');
    await page.locator('input[type="password"]').fill('password');
    await page.locator('button', { hasText: 'Sign In' }).click();
    await page.waitForURL('**/dashboard');

    await page.goto('http://localhost:5186/consumers', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const pageInfo = await page.evaluate(() => {
      const body = document.body.innerText;
      return {
        hasNameHeader: body.includes('Name'),
        hasMobileHeader: body.includes('Mobile'),
        hasEmailHeader: body.includes('Email'),
        hasLeadStage: body.includes('Lead Stage') || body.includes('Lead') ,
        hasProject: body.includes('Project'),
        fullText: body,
      };
    });

    console.log('TABLE HEADERS CHECK');
    console.log('═'.repeat(60));
    console.log(`Has "Name" header: ${pageInfo.hasNameHeader}`);
    console.log(`Has "Mobile" header: ${pageInfo.hasMobileHeader}`);
    console.log(`Has "Email" header: ${pageInfo.hasEmailHeader}`);
    console.log(`Has "Lead Stage" header: ${pageInfo.hasLeadStage}`);
    console.log(`Has "Project" header: ${pageInfo.hasProject}`);

    console.log('\nFULL PAGE TEXT:');
    console.log('─'.repeat(60));
    console.log(pageInfo.fullText);

  } catch (error) {
    console.error('Error:', error.message);
  }

  await browser.close();
}

await checkHeaders();
