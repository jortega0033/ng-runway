import { expect, test } from '@playwright/test';
import { prepare, signIn } from './helpers';

test('Ctrl+K opens the palette and Enter goes to the first match', async ({ page }) => {
  await prepare(page);
  await signIn(page, 'employee');

  await page.keyboard.press('Control+K');
  const box = page.getByRole('combobox', { name: 'Search commands' });
  await expect(box).toBeFocused();

  await box.fill('time');
  await expect(page.getByRole('option', { name: /Timesheets/ }).first()).toBeVisible();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/\/timesheets/);
  await expect(page.getByRole('heading', { name: 'Timesheets', level: 1 })).toBeVisible();
  await expect(box).toHaveCount(0);
});

test('Escape closes the palette and an unknown search shows no commands', async ({ page }) => {
  await prepare(page);
  await signIn(page, 'employee');

  await page.keyboard.press('Control+K');
  const box = page.getByRole('combobox', { name: 'Search commands' });
  await box.fill('zzzz');
  await expect(page.getByText('No commands match your search.').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(box).toHaveCount(0);
});
