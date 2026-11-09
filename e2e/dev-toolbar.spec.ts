import { expect, test, type Page } from '@playwright/test';
import { openFromNav, prepare, signIn } from './helpers';

async function openToolbar(page: Page) {
  await page.getByRole('button', { name: 'Dev toolbar' }).click();
  return page.getByRole('group', { name: 'Dev toolbar' });
}

test.beforeEach(async ({ page }) => {
  await prepare(page);
  await signIn(page, 'manager');
});

test('random errors show an error state with retry, and turning them off recovers', async ({
  page,
}) => {
  const toolbar = await openToolbar(page);
  await toolbar.getByLabel('Random errors').selectOption({ label: '100%' });

  await openFromNav(page, 'Employees');
  const alert = page.getByRole('alert').filter({ hasText: 'Could not load this' });
  await expect(alert).toBeVisible();

  await toolbar.getByLabel('Random errors').selectOption({ label: 'Off' });
  await alert.getByRole('button', { name: 'Try again' }).click();

  await expect(alert).toHaveCount(0);
  await expect(page.getByRole('table', { name: 'Employees' })).toBeVisible();
});

test('empty responses show the empty state', async ({ page }) => {
  const toolbar = await openToolbar(page);
  await toolbar.getByText('Empty responses').click();
  await expect(toolbar.getByRole('switch', { name: 'Empty responses' })).toBeChecked();

  await openFromNav(page, 'Employees');
  await expect(
    page.getByRole('table', { name: 'Employees' }).getByText('No employees yet'),
  ).toBeVisible();

  await toolbar.getByText('Empty responses').click();
  await page.reload();
  await expect(page.getByRole('table', { name: 'Employees' })).toBeVisible();
});
