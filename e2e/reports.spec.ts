import { expect, test } from '@playwright/test';
import { prepare, signIn } from './helpers';

test('a manager exports the report as CSV', async ({ page }) => {
  await prepare(page);
  await signIn(page, 'manager');
  await page.goto('/reports');

  const table = page.getByRole('table', { name: 'Hours and labor cost per team' });
  await expect(table).toBeVisible();
  const firstCells = table.getByRole('row').getByRole('cell').first();
  await expect(firstCells).toBeVisible();
  const rows = table.getByRole('row');
  const teamNames: string[] = [];
  for (let i = 0; i < (await rows.count()); i++) {
    const cells = rows.nth(i).getByRole('cell');
    if ((await cells.count()) > 0) teamNames.push(await cells.first().innerText());
  }
  expect(teamNames.length).toBeGreaterThan(1);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(
    /^ng-runway-report-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.csv$/,
  );

  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString('utf8').replace(/^﻿/, '');
  const lines = text.trim().split(/\r?\n/);

  expect(lines[0]).toBe('Team,Worked hours,Scheduled hours,Difference,Labor cost (EUR)');
  expect(lines.length).toBeGreaterThan(2);
  // Every team shown in the table is in the file.
  for (const name of teamNames.map((n) => n.trim()).filter((n) => n && n !== 'Team')) {
    expect(text).toContain(name);
  }
});

test('the period presets change the exported filename', async ({ page }) => {
  await prepare(page);
  await signIn(page, 'manager');
  await page.goto('/reports');
  await expect(page.getByRole('table', { name: 'Hours and labor cost per team' })).toBeVisible();

  const first = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const firstName = (await first).suggestedFilename();

  await page.getByRole('button', { name: 'This week' }).click();
  await expect(page.getByRole('table', { name: 'Hours and labor cost per team' })).toBeVisible();
  const second = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const secondName = (await second).suggestedFilename();

  expect(secondName).toMatch(/^ng-runway-report-.*\.csv$/);
  expect(secondName).not.toBe(firstName);
});
