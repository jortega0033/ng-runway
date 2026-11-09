import { expect, test } from '@playwright/test';
import { futureWorkdays, openTab, prepare, signIn, signOut } from './helpers';

test('a request goes from employee to manager approval and back', async ({ page }) => {
  const reason = 'E2E autumn break';
  const { start, end } = futureWorkdays(5);

  await prepare(page);

  // 1. The employee asks for three days of vacation.
  await signIn(page, 'employee');
  await page.goto('/absences');
  const myTable = page.getByRole('table', { name: 'My absence requests' });
  await expect(myTable).toBeVisible();

  const vacationCard = page.getByRole('listitem').filter({ hasText: 'Vacation' }).first();
  await expect(vacationCard).toContainText('days left');
  const balanceBefore = await vacationCard.textContent();

  await page.getByRole('button', { name: 'Request time off' }).click();
  const dialog = page.getByRole('dialog', { name: 'Request time off' });
  await dialog.getByLabel('Start date').fill(start);
  await dialog.getByLabel('End date').fill(end);
  await dialog.getByLabel('Reason').fill(reason);
  await expect(dialog.getByText('Working days: 3')).toBeVisible();
  await expect(dialog.getByText('Balance after this request:')).toBeVisible();
  await dialog.getByRole('button', { name: 'Send request' }).click();

  await expect(page.getByText('Request sent')).toBeVisible();
  const myRow = myTable.getByRole('row').filter({ hasText: reason });
  await expect(myRow).toContainText('Pending');
  // The balances cover the current year, so pending days only show up there for dates in it.
  if (start.startsWith(String(new Date().getFullYear()))) {
    await expect(vacationCard).not.toHaveText(balanceBefore ?? '');
  }
  await signOut(page);

  // 2. The manager approves it.
  await signIn(page, 'manager');
  await page.goto('/absences');
  await openTab(page, 'Requests');
  const requests = page.getByRole('table', { name: 'Pending absence requests' });
  const request = requests.getByRole('row').filter({ hasText: reason });
  await expect(request).toContainText('Sara Bakker');
  await request.getByRole('button', { name: /^Approve request of Sara Bakker/ }).click();

  const approve = page.getByRole('dialog', { name: 'Approve request' });
  await approve.getByLabel('Comment (optional)').fill('Enjoy');
  await approve.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(page.getByText('Request approved')).toBeVisible();
  await expect(request).toHaveCount(0);
  await signOut(page);

  // 3. The employee sees it approved, with the manager note.
  await signIn(page, 'employee');
  await page.goto('/absences');
  // Once reviewed, the note column shows the manager's comment instead of the reason.
  const approvedRow = myTable.getByRole('row').filter({ hasText: 'Manager: Enjoy' });
  await expect(approvedRow).toContainText('Approved');
});

test('the seeded request of Sara Bakker can be rejected with a comment', async ({ page }) => {
  await prepare(page);
  await signIn(page, 'manager');
  await page.goto('/absences');
  await openTab(page, 'Requests');

  const requests = page.getByRole('table', { name: 'Pending absence requests' });
  const row = requests.getByRole('row').filter({ hasText: 'Summer break' });
  await expect(row).toContainText('Sara Bakker');
  await row.getByRole('button', { name: /^Reject request of Sara Bakker/ }).click();

  const dialog = page.getByRole('dialog', { name: 'Reject request' });
  await dialog.getByLabel('Comment (optional)').fill('Too busy that week');
  await dialog.getByRole('button', { name: 'Reject', exact: true }).click();
  await expect(page.getByText('Request rejected')).toBeVisible();
  await expect(row).toHaveCount(0);
});

test('the request form validates the date range', async ({ page }) => {
  await prepare(page);
  await signIn(page, 'employee');
  await page.goto('/absences');
  await page.getByRole('button', { name: 'Request time off' }).click();

  const dialog = page.getByRole('dialog', { name: 'Request time off' });
  await dialog.getByRole('button', { name: 'Send request' }).click();
  await expect(dialog.getByText('Choose a start date.')).toBeVisible();

  await dialog.getByLabel('Start date').fill('2030-05-10');
  await dialog.getByLabel('End date').fill('2030-05-08');
  await dialog.getByRole('button', { name: 'Send request' }).click();
  await expect(dialog.getByText('The end date cannot be before the start date.')).toBeVisible();
});
