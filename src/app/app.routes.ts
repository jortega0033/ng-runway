import type { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from '@core/auth/guards';
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
      {
        path: 'dashboard',
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
        loadChildren: () =>
          import('@features/timesheets/timesheets.routes').then((m) => m.TIMESHEETS_ROUTES),
      },
      {
        path: 'absences',
        loadChildren: () =>
          import('@features/absences/absences.routes').then((m) => m.ABSENCES_ROUTES),
      },
      {
        path: 'employees',
        canActivate: [roleGuard('admin', 'manager')],
        loadChildren: () =>
          import('@features/employees/employees.routes').then((m) => m.EMPLOYEES_ROUTES),
      },
      {
        path: 'reports',
        canActivate: [roleGuard('admin', 'manager')],
        loadChildren: () =>
          import('@features/reports/reports.routes').then((m) => m.REPORTS_ROUTES),
      },
      {
        path: 'notifications',
        loadChildren: () =>
          import('@features/notifications/notifications.routes').then(
            (m) => m.NOTIFICATIONS_ROUTES,
          ),
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
