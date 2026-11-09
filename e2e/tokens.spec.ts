import { expect, test } from '@playwright/test';
import { colorTokens } from '../tokens/tokens';
import { prepare, type Theme } from './helpers';

/**
 * The tokens file is the source of truth. This checks the RUNNING app: the browser's computed
 * value of every --colors-* variable must equal the value in tokens.css in both themes.
 */
for (const theme of ['light', 'dark'] as Theme[]) {
  test(`every --colors-* token matches tokens.css in the ${theme} theme`, async ({ page }) => {
    await prepare(page, { theme });
    await page.goto('/login');
    await expect(page.locator('html')).toHaveClass(new RegExp(`theme-${theme}`));

    const expected = colorTokens[theme];
    const names = Object.keys(expected);
    const actual = await page.evaluate((list) => {
      const style = getComputedStyle(document.documentElement);
      return Object.fromEntries(
        list.map((name) => [name, style.getPropertyValue(`--colors-${name}`).trim().toLowerCase()]),
      );
    }, names);

    const mismatches = names.filter(
      (name) => actual[name] !== String(expected[name as keyof typeof expected]).toLowerCase(),
    );
    expect(mismatches, `tokens that differ in the ${theme} theme`).toEqual([]);
    expect(names.length).toBeGreaterThan(100);
  });
}
