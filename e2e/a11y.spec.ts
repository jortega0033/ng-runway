import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { prepare, signIn, type Role, type Theme } from './helpers';

interface Target {
  path: string;
  /** Who is signed in; `null` for pages shown to anonymous visitors. */
  role: Role | null;
}

const TARGETS: Target[] = [
  { path: '/login', role: null },
  { path: '/dashboard', role: 'employee' },
  { path: '/timesheets', role: 'employee' },
  { path: '/absences', role: 'employee' },
  { path: '/notifications', role: 'employee' },
  { path: '/settings', role: 'employee' },
  { path: '/design-system', role: 'employee' },
  { path: '/employees', role: 'manager' },
  { path: '/reports', role: 'manager' },
];

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const BLOCKING = new Set(['serious', 'critical']);

/** Waits until the page title is shown and no loading skeleton is left, so axe sees real content. */
async function waitForContent(page: Page, path: string): Promise<void> {
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  // The design system page shows skeletons on purpose, as a demo of that component.
  if (path !== '/design-system') await expect(page.locator('ui-skeleton')).toHaveCount(0);
}

for (const theme of ['light', 'dark'] as Theme[]) {
  for (const { path, role } of TARGETS) {
    test(`${path} has no serious accessibility violations (${theme}, ${role ?? 'signed out'})`, async ({
      page,
    }, testInfo) => {
      // The design system page is huge: axe alone needs 10-20 seconds there.
      test.slow(path === '/design-system');
      // Reduced motion keeps transitions from showing half-faded colors to axe's contrast check.
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await prepare(page, { theme });
      if (role) {
        await signIn(page, role);
        await page.goto(path);
      } else {
        await page.goto(path);
      }
      await expect(page.locator('html')).toHaveClass(new RegExp(`theme-${theme}`));
      await waitForContent(page, path);

      const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

      // Minor and moderate findings are reported but do not fail the test.
      for (const v of violations.filter((x) => !BLOCKING.has(x.impact ?? ''))) {
        testInfo.annotations.push({
          type: `axe ${v.impact}`,
          description: `${v.id}: ${v.help} (${v.nodes.length} nodes)`,
        });
      }

      const blocking = violations
        .filter((v) => BLOCKING.has(v.impact ?? ''))
        .map((v) => ({
          rule: v.id,
          impact: v.impact,
          help: v.help,
          nodes: v.nodes.slice(0, 5).map((n) => ({
            target: n.target.join(' '),
            summary: n.failureSummary?.split('\n').slice(0, 3).join(' | '),
          })),
        }));
      expect(blocking, 'serious or critical axe violations').toEqual([]);
    });
  }
}
