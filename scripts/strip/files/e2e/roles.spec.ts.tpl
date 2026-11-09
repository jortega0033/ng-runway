import { expect, test } from '@playwright/test';
import { prepare, signIn, signOut, type Role } from './helpers';

// Sign-in, role and shell smoke test. Add a role-based nav check here when a feature is limited
// to some roles (see `roles` in src/app/core/layout/nav-items.ts).
for (const role of ['admin', 'manager', 'employee'] as Role[]) {
  test(`${role} can sign in, sees the navigation and can sign out`, async ({ page }) => {
    await prepare(page);
    await signIn(page, role);
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    for (const name of ['Home', 'Items', 'Settings', 'Design system']) {
      await expect(nav.getByRole('link', { name })).toBeVisible();
    }
    await signOut(page);
  });
}

test('signed-out visitors are sent to the login page', async ({ page }) => {
  await prepare(page);
  await page.goto('/settings');
  await expect(page).toHaveURL(/\/login/);
});

test('unknown routes show the 404 page', async ({ page }) => {
  await prepare(page);
  await signIn(page, 'admin');
  await page.goto('/does-not-exist');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});

test('switching language sticks after a reload', async ({ page }) => {
  await prepare(page);
  await signIn(page, 'manager');
  await page.getByText('NL', { exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Hoofdnavigatie' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Hoofdnavigatie' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'nl');
});
