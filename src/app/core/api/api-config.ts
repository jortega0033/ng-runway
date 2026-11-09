import { InjectionToken } from '@angular/core';

/**
 * Root URL of the API. The demo points it at the in-browser mock (MSW), which listens on
 * `<base href>api`. To use a real backend, provide a different value in `app.config.ts`:
 *
 *   { provide: API_BASE_URL, useValue: 'https://api.example.com' }
 *
 * and remove `startMockApi()` from `main.ts`. Nothing else changes.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => defaultApiBaseUrl(),
});

export function defaultApiBaseUrl(): string {
  return new URL('api', document.baseURI).toString().replace(/\/$/, '');
}
