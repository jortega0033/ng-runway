import type { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from '@core/auth/guards';
import { ShellComponent } from '@core/layout/shell';

/** Every feature is a lazy chunk with its own routes file. */
export const routes: Routes = [
  {
    path: 'login',
    title: 'titles.login',
    canActivate: [guestGuard],
    loadComponent: () => import('@core/pages/login').then((m) => m.LoginPage),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'nav.dashboard',
        loadChildren: () =>
          import('@features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
      },
      {
        path: 'schedule',
        loadChildren: () =>
          import('@features/schedule/schedule.routes').then((m) => m.SCHEDULE_ROUTES),
      },
      {
        path: 'timesheets',
        title: 'nav.timesheets',
        loadChildren: () =>
          import('@features/timesheets/timesheets.routes').then((m) => m.TIMESHEETS_ROUTES),
      },
      {
        path: 'absences',
        title: 'nav.absences',
        loadChildren: () =>
          import('@features/absences/absences.routes').then((m) => m.ABSENCES_ROUTES),
      },
      {
        path: 'employees',
        title: 'nav.employees',
        canActivate: [roleGuard('admin', 'manager')],
        loadChildren: () =>
          import('@features/employees/employees.routes').then((m) => m.EMPLOYEES_ROUTES),
      },
      {
        path: 'reports',
        title: 'nav.reports',
        canActivate: [roleGuard('admin', 'manager')],
        loadChildren: () =>
          import('@features/reports/reports.routes').then((m) => m.REPORTS_ROUTES),
      },
      {
        path: 'notifications',
        title: 'nav.notifications',
        loadChildren: () =>
          import('@features/notifications/notifications.routes').then(
            (m) => m.NOTIFICATIONS_ROUTES,
          ),
      },
      {
        path: 'settings',
        title: 'nav.settings',
        loadChildren: () =>
          import('@features/settings/settings.routes').then((m) => m.SETTINGS_ROUTES),
      },
      // gen:feature:routes
      {
        path: 'design-system',
        title: 'nav.designSystem',
        loadComponent: () =>
          import('./design-system/design-system.page').then((m) => m.DesignSystemPage),
      },
    ],
  },
  {
    path: 'forbidden',
    title: 'errors.forbiddenTitle',
    loadComponent: () => import('@core/pages/error-pages').then((m) => m.ForbiddenPage),
  },
  {
    path: '**',
    title: 'errors.notFoundTitle',
    loadComponent: () => import('@core/pages/error-pages').then((m) => m.NotFoundPage),
  },
];
