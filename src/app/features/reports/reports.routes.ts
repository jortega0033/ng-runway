import type { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { ReportsPage } from './pages/reports.page';

export const REPORTS_ROUTES: Routes = [
  {
    path: '',
    component: ReportsPage,
    providers: [provideTranslocoScope('reports')],
  },
];
