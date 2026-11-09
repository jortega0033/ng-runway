import { setupWorker } from 'msw/browser';
import { defaultApiBaseUrl } from '../api/api-config';
import { todayIso, startOfWeek } from '../domain/time';
import { MockDb } from './db';
import { readDevControls } from './dev-controls';
import { createHandlers } from './handlers';
import { createSeed } from './seed';

/**
 * Starts the mock API in the browser. Call it before bootstrapping Angular so the first request
 * is already answered. Remove this call (and `public/mockServiceWorker.js`) to use a real API.
 */
export async function startMockApi(): Promise<void> {
  const storage = typeof localStorage === 'undefined' ? null : localStorage;
  const db = new MockDb(
    () => createSeed(todayIso()),
    storage,
    () => startOfWeek(todayIso()),
  );
  db.save();

  const worker = setupWorker(
    ...createHandlers({
      baseUrl: defaultApiBaseUrl(),
      db,
      controls: () => readDevControls(storage),
    }),
  );

  await worker.start({
    // The worker file lives next to index.html, so it also works under a sub-path like /ng-runway/.
    serviceWorker: { url: new URL('mockServiceWorker.js', document.baseURI).toString() },
    onUnhandledFrame: 'bypass',
    quiet: true,
  });
}
