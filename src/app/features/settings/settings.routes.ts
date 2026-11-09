import type { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { SettingsPage } from './pages/settings.page';

export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    component: SettingsPage,
    providers: [provideTranslocoScope('settings')],
  },
];
