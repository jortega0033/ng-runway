import { expect, test, type Page } from '@playwright/test';
import { futureWorkdays, openTab, prepare, signIn, signOut } from './helpers';

async function openSchedule(page: Page): Promise<void> {
  await page.goto('/schedule');
  await expect(page.getByRole('table', { name: /^Weekly roster/ })).toBeVisible();
}

test('a manager copies a week as drafts and publishes it', async ({ page }) => {
  await prepare(page);
  await signIn(page, 'manager');
  await openSchedule(page);

  // The current week is fully published, so there is nothing to publish yet.
  await expect(page.getByRole('button', { name: 'Publish week, 0 drafts' })).toBeDisabled();

  // Next week is empty: copy this week into it as drafts.
  await page.getByRole('button', { name: 'Next week' }).click();
  await page.getByRole('button', { name: 'Copy previous week' }).click();
  const copy = page.getByRole('dialog', { name: 'Copy the previous week?' });
  await copy.getByRole('button', { name: 'Copy shifts' }).click();
  await expect(page.getByText('Previous week copied')).toBeVisible();

  const publish = page.getByRole('button', { name: /^Publish week, \d+ drafts$/ });
  await expect(publish).toBeEnabled();
  await expect(page.getByRole('button', { name: /, draft(,|$)/ }).first()).toBeVisible();

  await publish.click();
  const confirm = page.getByRole('dialog', { name: 'Publish this week?' });
  await confirm.getByRole('button', { name: 'Publish', exact: true }).click();

  await expect(page.getByText('Week published')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publish week, 0 drafts' })).toBeDisabled();
  await expect(page.getByRole('button', { name: /, draft(,|$)/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /, published(,|$)/ }).first()).toBeVisible();
});

test('an approved absence shows on the schedule in the employee row', async ({ page }) => {
  const weeksAhead = 5;
  const { start, end } = futureWorkdays(weeksAhead);
  const reason = 'E2E schedule absence';

  await prepare(page);

  // The employee asks for Monday to Wednesday off.
  await signIn(page, 'employee');
  await page.goto('/absences');
  await page.getByRole('button', { name: 'Request time off' }).click();
  const dialog = page.getByRole('dialog', { name: 'Request time off' });
  await dialog.getByLabel('Start date').fill(start);
  await dialog.getByLabel('End date').fill(end);
  await dialog.getByLabel('Reason').fill(reason);
  await dialog.getByRole('button', { name: 'Send request' }).click();
  await expect(page.getByText('Request sent')).toBeVisible();
  await signOut(page);

  // The manager approves it.
  await signIn(page, 'manager');
  await page.goto('/absences');
  await openTab(page, 'Requests');
  const request = page
    .getByRole('table', { name: 'Pending absence requests' })
    .getByRole('row')
    .filter({ hasText: reason });
  await request.getByRole('button', { name: /^Approve request of Sara Bakker/ }).click();
  await page
    .getByRole('dialog', { name: 'Approve request' })
    .getByRole('button', { name: 'Approve', exact: true })
    .click();
  await expect(page.getByText('Request approved')).toBeVisible();

  // On the schedule, Sara's row shows the vacation in that week.
  await openSchedule(page);
  for (let i = 0; i < weeksAhead; i++) {
    await page.getByRole('button', { name: 'Next week' }).click();
  }
  const saraRow = page.getByRole('row').filter({ hasText: 'Sara Bakker' });
  await expect(saraRow).toContainText('Vacation');
  await expect(saraRow).not.toContainText('(requested)');
});

test('overlapping shifts show a conflict warning', async ({ page }) => {
  await prepare(page);
  await signIn(page, 'manager');
  await openSchedule(page);

  const addOnWednesday = page.getByRole('button', {
    name: /^Add shift for Sara Bakker on Wednesday/,
  });
  const editor = page.getByRole('dialog', { name: 'Add shift' });
  const saveShift = editor.getByRole('button', { name: 'Add shift', exact: true });

  // First shift: no overlap yet.
  await addOnWednesday.click();
  await editor.getByLabel('Start').fill('10:00');
  await editor.getByLabel('End').fill('12:00');
  await expect(editor.getByText('Overlaps with another shift of this employee.')).toHaveCount(0);
  await saveShift.click();
  await expect(editor).toHaveCount(0);

  // Second shift overlaps the first: the editor warns while typing, saving is still allowed.
  await addOnWednesday.click();
  await editor.getByLabel('Start').fill('11:00');
  await editor.getByLabel('End').fill('13:00');
  await expect(editor.getByText('Overlaps with another shift of this employee.')).toBeVisible();
  await saveShift.click();
  await expect(editor).toHaveCount(0);

  // Both chips on the grid are flagged.
  await expect(
    page.getByRole('button', { name: /Sara Bakker, Wednesday.*, draft, \d+ conflicts?$/ }),
  ).toHaveCount(2);
});
