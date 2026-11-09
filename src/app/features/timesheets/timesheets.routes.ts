import type { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { TimesheetsPage } from './timesheets.page';

export const TIMESHEETS_ROUTES: Routes = [
  {
    path: '',
    component: TimesheetsPage,
    providers: [provideTranslocoScope('timesheets')],
  },
];
