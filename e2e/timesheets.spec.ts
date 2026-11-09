import { expect, test } from '@playwright/test';
import { openTab, prepare, signIn } from './helpers';

test.describe('employee time clock', () => {
  test('clocks in, takes a break, clocks out and the entry is submitted', async ({ page }) => {
    await prepare(page);
    await signIn(page, 'employee');
    await page.goto('/timesheets');

    const clockIn = page.getByRole('button', { name: 'Clock in' });
    const startBreak = page.getByRole('button', { name: 'Start break' });
    const endBreak = page.getByRole('button', { name: 'End break' });
    const clockOut = page.getByRole('button', { name: 'Clock out' });

    await expect(page.getByText('You are not clocked in.')).toBeVisible();
    await expect(clockIn).toBeEnabled();
    await expect(clockOut).toBeDisabled();

    await clockIn.click();
    await expect(page.getByText('Working since')).toBeVisible();
    await expect(clockIn).toBeDisabled();
    await expect(startBreak).toBeEnabled();

    await startBreak.click();
    await expect(page.getByText('On break since')).toBeVisible();
    await expect(endBreak).toBeEnabled();
    await expect(startBreak).toBeDisabled();

    await endBreak.click();
    await expect(page.getByText('Working since')).toBeVisible();

    await clockOut.click();
    await expect(page.getByText('You are not clocked in.')).toBeVisible();
    await expect(clockIn).toBeEnabled();

    // The finished entry shows in the week table, waiting for approval.
    await expect(page.getByText('Submitted', { exact: true }).first()).toBeVisible();
  });
});

test.describe('manager approvals', () => {
  test('approves a seeded submitted entry from last week', async ({ page }) => {
    await prepare(page);
    await signIn(page, 'manager');
    await page.goto('/timesheets');
    await openTab(page, 'Approvals');

    const table = page.getByRole('table', { name: 'Time entries to review' });
    const approveButtons = table.getByRole('button', { name: /^Approve hours of / });
    await expect(approveButtons.first()).toBeVisible();
    const before = await approveButtons.count();

    const label = await approveButtons.first().getAttribute('aria-label');
    await approveButtons.first().click();

    const dialog = page.getByRole('dialog', { name: 'Approve hours' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Approve', exact: true }).click();

    await expect(page.getByText('Hours approved')).toBeVisible();
    await expect(approveButtons).toHaveCount(before - 1);
    await expect(table.getByRole('button', { name: label ?? '' })).toHaveCount(0);

    // The approved entry is listed under the approved status filter.
    await page.getByLabel('Status', { exact: true }).selectOption('approved');
    await expect(table.getByText('Approved', { exact: true }).first()).toBeVisible();
  });

  test('rejecting needs a comment', async ({ page }) => {
    await prepare(page);
    await signIn(page, 'manager');
    await page.goto('/timesheets');
    await openTab(page, 'Approvals');

    const table = page.getByRole('table', { name: 'Time entries to review' });
    const rejectButtons = table.getByRole('button', { name: /^Reject hours of / });
    await expect(rejectButtons.first()).toBeVisible();
    const before = await rejectButtons.count();
    await rejectButtons.first().click();

    const dialog = page.getByRole('dialog', { name: 'Reject hours' });
    await dialog.getByRole('button', { name: 'Reject', exact: true }).click();
    await expect(
      dialog.getByText('Add a comment so the employee knows what to fix.'),
    ).toBeVisible();

    await dialog.getByLabel('Reason for rejection').fill('Break missing');
    await dialog.getByRole('button', { name: 'Reject', exact: true }).click();

    await expect(page.getByText('Hours rejected')).toBeVisible();
    await expect(rejectButtons).toHaveCount(before - 1);
  });
});
