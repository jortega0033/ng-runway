import { defineConfig, devices } from '@playwright/test';

const port = 4300;

/**
 * End-to-end tests run against the PRODUCTION build (`npm run build` first, or use `npm run e2e`).
 * Every test gets a fresh browser context, so each starts with fresh demo data.
 */
export default defineConfig({
  testDir: '.',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
    serviceWorkers: 'allow',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `node scripts/serve-dist.mjs ${port}`,
    // Playwright runs this from the config folder by default; the script needs the repo root.
    cwd: '..',
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env['CI'],
  },
});
