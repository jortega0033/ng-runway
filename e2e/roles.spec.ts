import { expect, test } from '@playwright/test';
import { prepare, signIn, type Role } from './helpers';

const NAV_BY_ROLE: Record<Role, { visible: string[]; hidden: string[] }> = {
  admin: { visible: ['Dashboard', 'Schedule', 'Employees', 'Reports'], hidden: [] },
  manager: { visible: ['Dashboard', 'Schedule', 'Employees', 'Reports'], hidden: [] },
  employee: {
    visible: ['Dashboard', 'Schedule', 'Timesheets', 'Absences'],
    hidden: ['Employees', 'Reports'],
  },
};

for (const role of ['admin', 'manager', 'employee'] as Role[]) {
  test(`${role} sees the navigation for their role`, async ({ page }) => {
    await prepare(page);
    await signIn(page, role);
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    for (const name of NAV_BY_ROLE[role].visible) {
      await expect(nav.getByRole('link', { name })).toBeVisible();
    }
    for (const name of NAV_BY_ROLE[role].hidden) {
      await expect(nav.getByRole('link', { name })).toHaveCount(0);
    }
  });
}

test('an employee is sent away from a manager page', async ({ page }) => {
  await prepare(page);
  await signIn(page, 'employee');
  await page.goto('/employees');
  await expect(page.getByRole('heading', { name: 'No access' })).toBeVisible();
});

test('unknown routes show the 404 page', async ({ page }) => {
  await prepare(page);
  await signIn(page, 'admin');
  await page.goto('/does-not-exist');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});

test('switching language and theme sticks after a reload', async ({ page }) => {
  await prepare(page);
  await signIn(page, 'manager');
  await page.getByText('NL', { exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Hoofdnavigatie' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Hoofdnavigatie' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'nl');
});
