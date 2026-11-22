# Architecture and roadmap status

How the app is put together today, one workflow traced through the code, and how the proposed offline timesheet workflow compares with it. Statements about current behavior were read from source at commit `3c83e48` (tag `v1.0.0`) and carry a file reference; the one statement that comes from running something says so. Decisions and their reasons are in [docs/adr](adr); this file does not repeat them.

Status words used below: **implemented** (in the code today), **planned** (described in an open issue, not in the code), **needs verification** (not confirmed from source or by a run).

## Shape

A single-page Angular app with no API server (`scripts/serve-dist.mjs` only serves the built files for tests). Three layers under `src/app/`:

| Layer       | Holds                                                                                                                                  | May import                |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `ui/`       | The component library. Copyable on its own ([ADR 0005](adr/0005-install-modes.md)).                                                    | Nothing from `features/`  |
| `core/`     | API clients (`core/api`), auth, HTTP interceptors, pure domain rules (`core/domain`), the mock API (`core/mock`), layout, i18n, theme. | `ui/`                     |
| `features/` | One lazy-loaded folder per screen group, each with `<name>.routes.ts` and its own i18n scope.                                          | `core/`, `ui/`, `@tokens` |

Only one boundary is enforced by a tool: ESLint forbids `ui/` from importing feature code (`eslint.config.mjs:75-87`). The other rows are conventions, with two known exceptions: the chart components in `ui/` import the theme service from `core/` ([docs/adapting.md](adapting.md)), and `core/mock/features.ts` imports the mock of each generated feature (`scripts/gen-feature.mjs:60`). No such import exists at `v1.0.0`, because no generated feature is checked in.

## Data path

`page component → API client → interceptors → MSW handler → MockDb → localStorage`

- **API clients** are thin typed `HttpClient` wrappers in `src/app/core/api/*.api.ts`. They build URLs from the `API_BASE_URL` token, which defaults to `<base href>api` on the same origin (`src/app/core/api/api-config.ts:11-18`).
- **Interceptors**: `authInterceptor` adds `Authorization: Bearer <token>` to calls to that base URL only, and `errorInterceptor` shows failures (`src/app/app.config.ts:24`, `src/app/core/auth/auth.interceptor.ts:7-15`).
- **Mock API**: `src/main.ts:8-12` always starts MSW before Angular boots. There is no startup mode switch. `src/app/core/mock/handlers.ts` defines 31 routes; request and response types are shared with the clients through `src/app/core/api/models.ts`.
- **Storage**: `MockDb` keeps one JSON document in `localStorage` under `ng-runway.db` and writes it after every mutation (`src/app/core/mock/db.ts:32-64`). It is thrown away and reseeded when the schema version changes or a new week starts (`src/app/core/mock/db.ts:72-85`). `POST /dev/reset` reseeds on demand and needs no session (`src/app/core/mock/handlers.ts:726-735`).
- **Seed**: `@faker-js/faker` with a fixed seed, built relative to the current week (`src/app/core/mock/seed.ts:395`, `src/app/core/mock/browser.ts:15-19`).
- **Session**: the login screen posts a role; the handler returns the first employee with that role and a token `mock-token-<employeeId>` (`src/app/core/mock/handlers.ts:135-148`). The session is kept in `localStorage` under `ng-runway.session` (`src/app/core/auth/auth.service.ts:8`). There are no credentials.
- **State**: component signals and `rxResource` per screen; signal services where state is shared; NgRx SignalStore only for the schedule ([ADR 0002](adr/0002-state-management.md)).

## Data ownership

| Data                           | Source of truth today                                                | Read by                                      |
| ------------------------------ | -------------------------------------------------------------------- | -------------------------------------------- |
| Clock entries, breaks, status  | `MockDb.clockEntries` behind the `/clock*` handlers                  | Clock widget, week view, approvals, reports  |
| Session and role               | `AuthService` (`localStorage` `ng-runway.session`)                   | Guards, `*hasRole`, `authInterceptor`        |
| Shifts, absences, employees    | `MockDb` behind their handlers                                       | Schedule store, absences, employees, reports |
| Hour and duration calculations | `src/app/core/domain/hours.ts`, `src/app/core/domain/time.ts` (pure) | Handlers and feature code                    |
| Report rows                    | Computed per request in the `/reports` handler                       | Reports page, CSV export                     |

Timesheet screens hold no store: each component loads what it shows and reloads after a write.

## Traced workflow: clock in, review, report

Status: **implemented**, against the mock API only.

1. **Route.** `/timesheets` is a lazy child of the shell behind `authGuard` (`src/app/app.routes.ts:13-35`) and renders `TimesheetsPage` (`src/app/features/timesheets/timesheets.routes.ts:5-10`). The route has no role guard; the approvals tab is hidden from employees with `*hasRole` (`src/app/features/timesheets/timesheets.page.ts:37`).
2. **Clock.** `ClockWidgetComponent` loads the open entry with `ClockApi.entries({ employeeId, status: 'open' })` (`src/app/features/timesheets/clock-widget.ts:162-165`) and calls `clockIn`, `startBreak`, `endBreak` or `clockOut` (`src/app/features/timesheets/clock-widget.ts:267-273`, `src/app/core/api/clock.api.ts:25-39`).
3. **Handlers.** `POST /clock/in` creates an entry with status `open` and refuses a second open entry with 409 `ALREADY_CLOCKED_IN` (`src/app/core/mock/handlers.ts:437-458`). `POST /clock/out` ends a running break, sets `clockOut` and sets the status to `submitted` (`src/app/core/mock/handlers.ts:459-474`). Clocking out is the only way an entry becomes submitted; there is no separate submit step.
4. **Week view.** The widget emits `changed`, the page bumps a reload key (`src/app/features/timesheets/timesheets.page.ts:30-51`) and `WeekViewComponent` reloads shifts and entries and builds the week with `buildWeek` (`src/app/features/timesheets/week-view.ts:300-320`).
5. **Review.** `TimesheetApprovalsComponent` lists entries filtered by team, status and week (`src/app/features/timesheets/approvals.ts:231-234`). `review()` updates the rows optimistically, sends one `POST /clock-entries/:id/review` per entry in parallel and restores the failed rows (`src/app/features/timesheets/approvals.ts:443-463`). The handler needs role admin or manager, status `submitted`, and a comment when rejecting; it then sets status and comment and adds a notification for the employee (`src/app/core/mock/handlers.ts:502-529`).
6. **Report.** `/reports` is limited to admin and manager by `roleGuard` (`src/app/app.routes.ts:49-55`). The page calls `GET /reports?from&to` (`src/app/core/api/reports.api.ts:13-15`). The handler sums `workedMinutes` per team for every entry that has a clock-out and is not rejected, so submitted entries count as well as approved ones, and returns hours as a number rounded to two decimals (`src/app/core/mock/handlers.ts:662-723`, `src/app/core/domain/hours.ts:30-40`).
7. **CSV.** The export is built in the browser from the table rows, one row per team (`src/app/features/reports/pages/reports.page.ts:364-372`, `src/app/features/reports/csv.ts:26-32`). Fields that look like formulas are escaped for spreadsheets (`src/app/features/reports/csv.ts:20-22`).

Covered by `e2e/timesheets.spec.ts` (clock in, break, clock out, approve) and `e2e/reports.spec.ts`, both against the production build with MSW.

## Invariants

Enforced today, all inside the mock handlers:

- One open entry per employee; break and clock-out calls need an open entry (`src/app/core/mock/handlers.ts:440-443`, `465`, `481-483`, `496`).
- Only submitted entries can be reviewed, only by admin or manager, and a rejection needs a comment (`src/app/core/mock/handlers.ts:512-515`, `527`).
- An employee's entry list contains only their own entries (`src/app/core/mock/handlers.ts:426`).
- Worked minutes are whole minutes, rounded down, never negative (`src/app/core/domain/hours.ts:22-36`).
- The bearer token is sent to the app's own API only (`src/app/core/auth/auth.interceptor.ts:10-13`).

Not enforced today (each is required by an open issue):

- No overlap check between entries, and no check that breaks lie inside their entry.
- No version field on `ClockEntry` (`src/app/core/api/models.ts:88-98`), so two reviewers are separated only by the `submitted` status check inside one browser tab.
- A manager can review entries of any team: the review handler checks the role, not the team (`src/app/core/mock/handlers.ts:502-528`). Only the screen filters by team (`src/app/features/timesheets/approvals.ts:208`).
- No audit history. A review overwrites `status` and `comment` and adds a notification.
- No business time zone. An entry's `date` is the browser's local date at clock-in (`src/app/core/domain/time.ts:40-45`, `src/app/core/mock/handlers.ts:447`), so a shift that crosses midnight stays on its start date and the result depends on the device.
- Report totals are fractional hours, not minutes (`src/app/core/api/models.ts:199-205`).

## Roadmap drift: offline timesheet workflow

The roadmap is the six open issues [#1](https://github.com/jortega0033/ng-runway/issues/1) to [#6](https://github.com/jortega0033/ng-runway/issues/6). There is no PRD file in the repository; the issues and the epic that groups them are the requirements.

| Roadmap item                                         | Status                                                                                                                                                                                     | What has to change                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reproducible offline Linux build (#1)                | **Needs verification.** A lockfile, `.nvmrc` and `npm ci --ignore-scripts` exist and CI builds on Linux. No offline install or blocked-network browser run is recorded in the repository.  | Document the staging of an npm cache and a browser, and record the run. `tokens/tokens.css:14-15` imports Satoshi and Parkinsans from two external hosts, and that file may not be edited; offline, the fallbacks in the same file apply. Whether the production build contacts those hosts at build time needs verification. |
| Explicit local mode with a SQLite API (#2)           | **Planned.** MSW always starts (`src/main.ts:8-12`). `scripts/serve-dist.mjs` serves static files only. Nothing in the repository uses SQLite.                                             | A startup mode switch in `src/main.ts`, a loopback server for the app and `/api`, migrations and a deterministic seed. `API_BASE_URL` already defaults to the same origin.                                                                                                                                                    |
| Persisted clock, breaks and submission (#3)          | **Partly implemented.** Clock and break calls exist and persist to `localStorage`. Submission happens at clock-out. No overlap rule, no business time zone.                                | Server-side rules for overlaps, break bounds and the entry's business date; a decision on whether submission stays implicit.                                                                                                                                                                                                  |
| Review with version check, team scope and audit (#4) | **Partly implemented.** Approve and reject exist with role and status checks. No version, no team check, no audit history.                                                                 | A `version` on entries, a conflict response and a screen path for it (bulk approve sends parallel requests), team-scoped authorization in the API, an audit table written in the same transaction.                                                                                                                            |
| Approved-only summary and CSV that agree (#5)        | **Planned.** The report counts every non-rejected entry and exports one row per team in fractional hours.                                                                                  | An approved-only summary in whole minutes and a per-entry export that share one query. The existing report keeps its meaning.                                                                                                                                                                                                 |
| End-to-end acceptance run (#6)                       | **Partly implemented.** Playwright covers the clock, approval and report flows against the mock build. Nothing runs against a local API, across a restart or with two competing reviewers. | An acceptance run for local mode on Linux, alongside the existing mock checks.                                                                                                                                                                                                                                                |

### Things an implementer should know first

- **Repository rules meet the server.** `package.json` may not have `dependencies`, `prepare` or `postinstall`, and installs run with `--ignore-scripts`, which rules out a SQLite package that compiles on install. Node 22 ships `node:sqlite`; in a run on Node 22.23.4 on Windows it opened an in-memory database without a flag and printed an experimental warning (run on 2026-11-22; a file database and Linux were not tried). The choice is not made yet and belongs in an ADR.
- **The mock API has 31 routes.** Local mode needs the ones the in-scope screens call. Besides the clock, review and report routes, the timesheet and report screens read shifts, employees and teams (`src/app/features/timesheets/week-view.ts:301-316`, `src/app/features/timesheets/approvals.ts:245-247`, `src/app/features/reports/pages/reports.page.ts:250`). Which routes are in scope, and what the other screens do in local mode, is undecided.
- **Dates are device-local.** The seed builds timestamps with the browser's time zone (`src/app/core/mock/seed.ts:262`) and reseeds every week, and the e2e tests rely on seeded entries from last week (`e2e/timesheets.spec.ts`). A fixed roster, clock and time zone are needed before totals can be asserted to the minute.
- **Sharing the domain rules with a Node server needs verification.** `core/domain` is plain TypeScript but imports without file extensions, so whether a Node process can load it directly is not confirmed.
- **Sign-in picks a role, not a person.** The login screen sends only a role (`src/app/core/pages/login.ts:56-58`) and the handler returns the first employee with that role; it also accepts an `employeeId` that no screen sends (`src/app/core/mock/handlers.ts:138-141`). A test that needs a manager of a particular team, or a manager of a different team, needs a way to choose the account.
- **The static server is not a loopback API host yet.** `scripts/serve-dist.mjs:65` listens without a host, so on all interfaces, and it answers any unknown path without a file extension with `index.html` and status 200 (`scripts/serve-dist.mjs:54-63`). An API path that is not implemented would return the app's HTML.
- **A rejected entry cannot be corrected.** No route lets an employee edit or resubmit one. The roadmap does not ask for it.
