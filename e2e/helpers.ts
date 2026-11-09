import { expect, type Page } from '@playwright/test';

export type Role = 'admin' | 'manager' | 'employee';
export type Theme = 'light' | 'dark';

const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  manager: 'Manager',
  employee: 'Employee',
};

/** Starts a test with a theme, English UI and the dev toolbar visible, before any page script runs. */
export async function prepare(
  page: Page,
  options: { theme?: Theme; lang?: 'en' | 'nl' } = {},
): Promise<void> {
  await page.addInitScript(
    ({ theme, lang }) => {
      // Only set once, so a reload inside a test keeps what the test changed.
      if (!sessionStorage.getItem('e2e-prepared')) {
        localStorage.setItem('theme', theme);
        localStorage.setItem('lang', lang);
        localStorage.setItem('ng-runway.devtools', '1');
        sessionStorage.setItem('e2e-prepared', '1');
      }
    },
    { theme: options.theme ?? 'light', lang: options.lang ?? 'en' },
  );
}

/** Opens the login page and continues as the given demo role. */
export async function signIn(page: Page, role: Role): Promise<void> {
  await page.goto('/login');
  await page.getByRole('button', { name: `Continue as ${ROLE_LABEL[role]}` }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

/** Navigates with the sidebar like a user would. */
export async function openFromNav(page: Page, name: string): Promise<void> {
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name })
    .click();
}

/** Signs out with the shell button and waits for the login page. */
export async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login/);
}

/** Opens a page tab (for example "Approvals") on pages that use the tabs component. */
export async function openTab(page: Page, name: string): Promise<void> {
  await page.getByRole('tab', { name }).click();
  await expect(page.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true');
}

/** Formats a date like the date pickers expect (yyyy-MM-dd), in local time. */
export function isoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The Monday-Wednesday of a week `weeksAhead` weeks from now, as ISO dates (3 working days). */
export function futureWorkdays(weeksAhead: number): { start: string; end: string } {
  const monday = new Date();
  monday.setHours(12, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + weeksAhead * 7);
  const wednesday = new Date(monday);
  wednesday.setDate(monday.getDate() + 2);
  return { start: isoDate(monday), end: isoDate(wednesday) };
}
