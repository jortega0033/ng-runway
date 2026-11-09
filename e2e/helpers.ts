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
