import { expect, test } from '@playwright/test';
import { openFromNav, prepare, signIn, signOut } from './helpers';

test('theme and language survive a reload', async ({ page }) => {
  await prepare(page);
  await signIn(page, 'employee');
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();

  await page.getByRole('radio', { name: 'Dark' }).check();
  await expect(page.locator('html')).toHaveClass(/theme-dark/);

  await page.getByRole('radio', { name: 'Nederlands' }).check();
  await expect(page.getByRole('navigation', { name: 'Hoofdnavigatie' })).toBeVisible();

  await page.reload();
  await expect(page.locator('html')).toHaveClass(/theme-dark/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'nl');
  await expect(page.getByRole('navigation', { name: 'Hoofdnavigatie' })).toBeVisible();
});

test('only an admin or manager sees reference data, and only an admin the reset', async ({
  page,
}) => {
  await prepare(page);
  await signIn(page, 'manager');
  await openFromNav(page, 'Settings');
  await expect(page.getByRole('heading', { name: 'Teams' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset demo data' })).toHaveCount(0);
});

test('an admin resets the demo data and lands on the login page', async ({ page }) => {
  await prepare(page);

  // The employee changes some data: clocks in.
  await signIn(page, 'employee');
  await page.goto('/timesheets');
  await page.getByRole('button', { name: 'Clock in' }).click();
  await expect(page.getByText('Working since')).toBeVisible();
  await signOut(page);

  // The admin changes their mind once, then resets for real.
  await signIn(page, 'admin');
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Reset demo data' }).click();
  const dialog = page.getByRole('dialog', { name: 'Reset demo data?' });
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/settings/);

  await page.getByRole('button', { name: 'Reset demo data' }).click();
  await dialog.getByRole('button', { name: 'Reset and sign out' }).click();
  await expect(page).toHaveURL(/\/login/);

  // The clock-in is gone.
  await signIn(page, 'employee');
  await page.goto('/timesheets');
  await expect(page.getByText('You are not clocked in.')).toBeVisible();
});
