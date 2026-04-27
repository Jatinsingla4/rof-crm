import fetch from 'node-fetch';

async function testAPI() {
  console.log('Testing API endpoints directly...\n');

  const endpoints = [
    '/consumers?search=&page=1&pageSize=20',
    '/consumers',
    '/health',
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`Testing: ${endpoint}`);
      const response = await fetch(`http://localhost:3001/api${endpoint}`, {
        headers: {
          'Authorization': 'Bearer mock-jwt-token',
          'Content-Type': 'application/json',
          'Origin': 'http://localhost:5186',
        }
      });

      console.log(`  Status: ${response.status}`);
      console.log(`  Headers: ${response.headers.get('access-control-allow-origin')}`);

      const data = await response.json();
      console.log(`  Response: ${JSON.stringify(data).substring(0, 200)}`);
      console.log();
    } catch (error) {
      console.log(`  ERROR: ${error.message}\n`);
    }
  }
}

testAPI();
