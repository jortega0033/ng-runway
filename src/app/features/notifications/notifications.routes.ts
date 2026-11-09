import type { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { NotificationsPage } from './pages/notifications.page';

export const NOTIFICATIONS_ROUTES: Routes = [
  {
    path: '',
    component: NotificationsPage,
    providers: [provideTranslocoScope('notifications')],
  },
];
