import type { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
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
    component: SchedulePage,
  },
];
