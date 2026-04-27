import { chromium } from '@playwright/test';

async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  
  page.on('console', (msg) => {
    console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`);
    if (msg.type() === 'error') errors.push(msg.text());
  });
  
  try {
    await page.goto('http://localhost:5180', { waitUntil: 'networkidle', timeout: 10000 });
    const rootHTML = await page.innerHTML('#root');
    const rootLength = rootHTML ? rootHTML.length : 0;
    
    console.log(`Root HTML length: ${rootLength}`);
    if (rootLength > 0) {
      console.log('Content:', rootHTML.substring(0, 500));
    }
    
    if (errors.length > 0) {
      console.log(`\nConsole errors: ${errors.length}`);
      errors.forEach(e => console.log(`  - ${e}`));
    }
  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
  }
}

test();
