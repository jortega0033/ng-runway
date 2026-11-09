import { inject } from '@angular/core';
import type { Routes } from '@angular/router';
import { provideTranslocoScope, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { SchedulePage } from './pages/schedule.page';
import { ScheduleStore } from './schedule.store';

/**
 * The store is provided here, on the route, so it is created when the schedule opens and dropped
 * when the user leaves (state is reloaded from the API on the next visit).
 */
export const SCHEDULE_ROUTES: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('schedule'), ScheduleStore],
    // Wait for the schedule texts before the page opens: it builds some labels in code, and those
    // would show raw keys if they were read before the texts arrive.
    resolve: {
      texts: () => firstValueFrom(inject(TranslocoService).selectTranslation('schedule')),
    },
    component: SchedulePage,
  },
];
