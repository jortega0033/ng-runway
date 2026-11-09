import type { Routes } from '@angular/router';
import { authGuard, guestGuard } from '@core/auth/guards';
import { ShellComponent } from '@core/layout/shell';

/** Every feature is a lazy chunk with its own routes file. */
export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('@core/pages/login').then((m) => m.LoginPage),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      // The home page keeps the path "dashboard": the login redirect, the guards and the e2e
      // helpers all point there. Rename it everywhere at once if you prefer another name.
      {
        path: 'dashboard',
        loadChildren: () => import('@features/home/home.routes').then((m) => m.HOME_ROUTES),
      },
      {
        path: 'settings',
        loadChildren: () =>
          import('@features/settings/settings.routes').then((m) => m.SETTINGS_ROUTES),
      },
      // gen:feature:routes
      {
        path: 'design-system',
        loadComponent: () =>
          import('./design-system/design-system.page').then((m) => m.DesignSystemPage),
      },
    ],
  },
  {
    path: 'forbidden',
    loadComponent: () => import('@core/pages/error-pages').then((m) => m.ForbiddenPage),
  },
  {
    path: '**',
    loadComponent: () => import('@core/pages/error-pages').then((m) => m.NotFoundPage),
  },
];
