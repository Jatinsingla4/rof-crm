import { chromium } from '@playwright/test';

async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
      console.log(`ERROR: ${msg.text()}`);
    }
  });
  
  try {
    await page.goto('http://localhost:5182', { waitUntil: 'networkidle', timeout: 10000 });
    const rootHTML = await page.innerHTML('#root');
    const rootLength = rootHTML ? rootHTML.length : 0;
    
    console.log(`\nRoot HTML length: ${rootLength}`);
    if (rootLength > 0) {
      console.log('✅ Content rendered');
      console.log('First 200 chars:', rootHTML.substring(0, 200));
    } else {
      console.log('❌ Root is empty');
    }
  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
  }
}

test();
