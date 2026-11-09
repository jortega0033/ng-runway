/* global localStorage */
/**
 * Takes the README screenshots (light and dark) from the production build.
 *
 *   npm run build && node scripts/screenshots.mjs
 *
 * It starts scripts/serve-dist.mjs on port 4310, signs in as the manager and writes PNG files
 * to docs/screenshots/. Uses Playwright, which is already a devDependency.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const port = 4310;
const base = `http://localhost:${port}`;
const outDir = 'docs/screenshots';
const pages = [
  { name: 'dashboard', path: '/dashboard' },
  { name: 'schedule', path: '/schedule' },
  { name: 'timesheets', path: '/timesheets' },
  { name: 'employees', path: '/employees' },
  { name: 'design-system', path: '/design-system' },
];

mkdirSync(outDir, { recursive: true });
const server = spawn(process.execPath, ['scripts/serve-dist.mjs', String(port)], {
  stdio: 'ignore',
});

try {
  await new Promise((r) => setTimeout(r, 1500));
  const browser = await chromium.launch();
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    });
    await context.addInitScript((t) => {
      localStorage.setItem('theme', t);
      localStorage.setItem('lang', 'en');
    }, theme);
    const page = await context.newPage();
    await page.goto(`${base}/login`);
    await page.getByRole('button', { name: 'Continue as Manager' }).click();
    await page.waitForURL(/dashboard/);
    for (const { name, path } of pages) {
      await page.goto(`${base}${path}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${outDir}/${name}-${theme}.png` });
      console.log(`${outDir}/${name}-${theme}.png`);
    }
    await context.close();
  }
  await browser.close();
} finally {
  server.kill();
}
