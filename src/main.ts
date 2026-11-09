import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// The demo has no backend: MSW answers API calls in the browser. It is loaded as its own chunk
// (MSW + faker are demo-only). To use a real API, delete the `startMock` lines below and set
// API_BASE_URL (see core/api/api-config.ts).
const startMock = () => import('@core/mock/browser').then((m) => m.startMockApi());

startMock()
  .then(() => bootstrapApplication(App, appConfig))
  .catch((err: unknown) => console.error(err));
