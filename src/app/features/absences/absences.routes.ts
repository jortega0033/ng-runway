import type { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { AbsencesPage } from './absences.page';

export const ABSENCES_ROUTES: Routes = [
  {
    path: '',
    component: AbsencesPage,
    providers: [provideTranslocoScope('absences')],
  },
];
