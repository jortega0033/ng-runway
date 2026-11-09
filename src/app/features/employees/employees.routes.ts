import type { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';

/** `new` comes before `:id` so it is not read as an employee id. */
export const EMPLOYEES_ROUTES: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('employees')],
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/employee-list.page').then((m) => m.EmployeeListPage),
      },
      {
        path: 'new',
        loadComponent: () => import('./pages/employee-form.page').then((m) => m.EmployeeFormPage),
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./pages/employee-profile.page').then((m) => m.EmployeeProfilePage),
      },
      {
        path: ':id/edit',
        loadComponent: () => import('./pages/employee-form.page').then((m) => m.EmployeeFormPage),
      },
    ],
  },
];
