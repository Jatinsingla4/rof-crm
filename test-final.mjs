import { chromium } from '@playwright/test';

async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const logs = [];
  
  page.on('console', (msg) => {
    logs.push(`[${msg.type().toUpperCase()}] ${msg.text()}`);
  });
  
  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 15000 });
    
    const rootHTML = await page.innerHTML('#root');
    const rootLength = rootHTML ? rootHTML.length : 0;
    
    console.log(`\n✅ Page loaded successfully`);
    console.log(`📦 Root HTML length: ${rootLength} characters\n`);
    
    if (rootLength > 0) {
      console.log('✅ React IS rendering content!');
      console.log('First 300 chars:', rootHTML.substring(0, 300));
      
      const emailInput = await page.$('input[type="email"]');
      if (emailInput) {
        console.log('✅ Email input found - LoginPage rendering!');
      }
    } else {
      console.log('❌ Root element is empty');
    }
    
    if (logs.length > 0) {
      console.log('\nConsole messages:');
      logs.slice(0, 5).forEach(log => console.log(`  ${log}`));
    }
  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
  }
}

test();
