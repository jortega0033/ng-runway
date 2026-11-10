# 0002. State: signal services by default, NgRx SignalStore for the schedule

Status: accepted (owner decision; critic concerns reconciled below)
Date: 2026-11-09

## Context

Most features are list, detail and form screens with simple state. The schedule is different: many interacting pieces (week and day views, drag and drop, drafts, conflicts, copy week, publish) share one evolving model. State management is also a common interview topic, and the repo should show both a plain and a structured approach.

## Decision

- Local UI state: component `signal()`.
- Feature state: injectable services that hold signals and `computed`.
- Server reads: the api services in `core/api/` return Observables over `HttpClient`. `httpResource` is used only in `features/dashboard/dashboard.resources.ts`.
- The schedule feature only uses an NgRx SignalStore (`@ngrx/signals`).
- RxJS stays for event streams, such as the debounced search with `switchMap`.

## Options considered

| Option                    | Benefits                     | Costs / risks                          |
| ------------------------- | ---------------------------- | -------------------------------------- |
| Signal services (default) | Little code, easy to explain | Conventions are left to the team       |
| SignalStore everywhere    | One consistent pattern       | Boilerplate for trivial screens        |
| Classic NgRx Store        | Devtools, strict events      | Heaviest; not justified for a template |

## Consequences

- The repo contains two patterns on purpose. `CLAUDE.md` and the docs must say which one is the default and why the schedule differs.
- Conflict detection and hour calculations are pure functions, so they test without Angular.
- `strip` keeps one signal-service example feature and drops the schedule store.

## Assumptions and not verified

- `@ngrx/signals` 22.x (installed) works with Angular 22 zoneless. Checked when the schedule store was built.

## Revisit when

Another feature develops schedule-like complexity, or the signal-service convention drifts between features.

## Critic reconciliation

- Version: the installed `@ngrx/signals` is 22.x; the assumption above is corrected.
- Why SignalStore for the schedule: it holds shifts as an entity collection (`withEntities`), supports undo of drag edits through snapshots with `patchState`, and runs publish and copy-week through `rxMethod` with optimistic update and rollback. A plain signal service could do this too; the owner chose SignalStore here as the one structured-store example. It works under zoneless, so the fallback to a signal service is not needed.
- `httpResource` is limited to the dashboard resources; every other read uses the Observables from the api services, which keeps the API layer easy to swap.
- Drift between the two patterns is limited by one example feature per pattern and a note in CLAUDE.md. `strip` keeps the signal-service example; a SignalStore example stays in the schedule feature only.
