# 0001. Mock the API with MSW in the browser

Status: accepted (owner decision; critic concerns reconciled below)
Date: 2026-11-09

## Context

ng-runway is UI-only, but it must teach and demonstrate real data flow: `HttpClient`, interceptors, loading and error states, pagination and server-side filtering. The demo is a static site on GitHub Pages, so there is no server. People who copy the repo need to swap in a real API with little effort.

## Decision

Use Mock Service Worker (MSW) in the browser. Handlers sit on an in-memory database seeded by `@faker-js/faker` with a fixed seed and persisted to `localStorage`. The app calls `HttpClient` against a configurable `API_BASE_URL`; swapping to a real backend means changing that value and not starting the worker. `mockServiceWorker.js` is committed so that no install step is needed.

## Options considered

| Option                           | Benefits                                         | Costs / risks                                              |
| -------------------------------- | ------------------------------------------------ | ---------------------------------------------------------- |
| MSW in the browser (chosen)      | Real network calls, same code path as production | Service worker lifecycle, Pages base-href, extra handlers  |
| Angular `HttpInterceptor` fakes  | No service worker                                | Code path differs from production; fakes leak into the app |
| `json-server` or a local backend | Closest to a real API                            | Needs a server; no static demo                             |
| Static JSON assets               | Trivial                                          | No writes, filtering or pagination                         |

## Consequences

- Positive: the app code is production-shaped; the same handlers can serve Vitest and Playwright.
- Negative: the worker must start before the first request, and the Pages deploy needs the worker URL to respect the base href.
- A dev toolbar (dev builds only) can inject latency, random errors and empty responses at the handler layer.
- Reset demo data clears the persisted database and reseeds it.

## Assumptions and not verified

- MSW works with the Angular application builder's asset pipeline and a non-root base href. To verify in M2.

## Revisit when

A real backend exists and the mock layer becomes a maintenance cost rather than a teaching aid.

## Critic reconciliation

- Service worker scope and base href: accepted risk. Mitigation: the app bootstraps after `worker.start()` resolves (app initializer), and if registration fails it logs a warning and continues. The Pages subpath is checked early in M2.1 and again after deploy in M7.
- Faker bundle size and drift: accepted. Seeding runs lazily, only when the persisted database is missing, and tests assert on structure and counts rather than faker-generated values. Fixed seed plus pinned version keeps data stable.
- Storage schema: accepted. The persisted database has a `schemaVersion`. A mismatch, a corrupt value or a full quota triggers a reseed with a toast.
- Contract drift: accepted. API request and response types live in one shared `models` file used by handlers and services, so the compiler enforces the contract. No OpenAPI is generated.
- `mockServiceWorker.js` drift: accepted. A unit test compares its embedded version with the installed `msw` version.
- Unit and component tests reuse the handlers through `msw/node`.
- Interceptor-based fakes: rejected. A worker shows the real network path, which is the lesson the demo teaches.
