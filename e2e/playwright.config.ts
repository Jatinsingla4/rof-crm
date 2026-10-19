import { defineConfig } from '@playwright/test';

// The CRM must already be running; BASE_URL says where (default: a local API on port 3002).
// The database needs the six test users from packages/api/scripts/make-test-db.sh.
export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts/,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['github']] : [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3002',
    viewport: { width: 1366, height: 850 },
    // SLOWMO=300 npx playwright test --headed  -> watch the run in a visible browser
    launchOptions: { slowMo: Number(process.env.SLOWMO || 0) },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
