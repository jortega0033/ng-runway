# ng-runway

Angular 22 admin dashboard boilerplate (workforce management). UI only, mocked API (MSW in the browser, real `HttpClient` calls). Node 22 (`.nvmrc`).

## Run and test

- `npm ci --ignore-scripts`, then `npm start` (dev), `npm run build`.
- `npm test -- --watch=false` (Vitest through the Angular builder), `npm run lint`, `npm run format:check`, `npm run typecheck`.
- `npm run tokens:build` regenerates `tokens/tailwind-theme.css` and `tokens/tokens.ts`; `npm run tokens:check` must pass.
- `npm run e2e` runs Playwright (flows per role plus axe, both themes) against `dist/`, so run `npm run build` first. `npm run verify` runs every gate in CI order.
- `npm run strip` removes the workforce demo and keeps the shell plus one example feature (destructive, use a copy). `npm run gen:feature <name>` scaffolds a feature (model, mock API, service, list/detail/form pages, routes, i18n, tests).
- `npm run docs:components` rebuilds `docs/components.md` from `docs/components/*.md`. `node scripts/screenshots.mjs` refreshes README screenshots (needs a build).
- `npm run hooks:install` sets up Husky (lint-staged, commitlint, header max 100 chars). Conventional commits.

## Structure

- `tokens/`: `tokens.css` and `tokens.json` are the source of truth, never edit values. Other files there are generated.
- `src/app/core/` (app-wide services), `src/app/ui/` (UI library), `src/app/features/` (feature folders). Aliases: `@core/*`, `@ui/*`, `@features/*`, `@tokens`.
- `src/app/core/mock/`: MSW handlers, `MockDb` (localStorage `ng-runway.db`), seed. Generated features register in `core/mock/features.ts`; the generator edits only the `gen:feature` marker comments there, in `app.routes.ts` and in `core/layout/nav-items.ts`. Keep them.
- Features live in `src/app/features/<name>/` with `<name>.routes.ts`. Texts: global `public/i18n/{en,nl}.json`, one scope per feature in `public/i18n/<name>/` (`provideTranslocoScope` on the route). Every new string needs EN and NL.
- `e2e/` (Playwright), `cli/` (zero-dependency `npx` CLI), `scripts/` (tokens, strip, gen-feature, docs), `drills/`, `docs/adapting.md`.
- `docs/adr/`: decisions (MSW mock API, state, no UI kit, token pipeline, install modes).

## Conventions

- Standalone, zoneless, signals, `inject()`, new control flow. Tailwind v4 with semantic tokens only.
- State: signal services by default; NgRx SignalStore only for the schedule (ADR 0002).
- Forms: Signal Forms (`@angular/forms/signals`); one Reactive Forms example in employees. Code-built labels (`transloco.translate`) can show raw keys if read before a scope loads; the schedule route awaits its texts in a resolver.
- No UI kit. Reuse components in `src/app/ui/` and semantic tokens (`--colors-*`); do not invent new ones.

## Forbidden

- Raw hex values or `--palette-*` in components. Gradients, glass or blur cards, emoji icons, lorem text.
- Font files in the repo. Editing `tokens/tokens.css` or `tokens/tokens.json` values.
- `dependencies` entries (everything is a devDependency), `prepare` or `postinstall` scripts.

## Skill routing (angular-engineer plugin)

Vague or large ticket: `angular-refine`. Before merge or on review comments: `angular-review`. New to the repo: `angular-onboard`. Sizing a change or PR: `angular-small-pr`. Building or fixing a feature: `angular-engineer`.

These skills help the session with its own work. They do not replace the roles and the two gates in "Agent roles, ticket work and triage loop": `angular-review` is not the review gate.

## Sources of truth

- Requirements: the GitHub issues of `jortega0033/ng-runway` and the epic that groups them. There is no PRD file. Read the issue before the code.
- Architecture, the traced clock-to-report workflow, the invariants and the roadmap status: [docs/architecture.md](docs/architecture.md). Update it in the same pull request when a change makes a statement there untrue.
- Decisions: [docs/adr](docs/adr). A new runtime, storage or startup mode needs an ADR before code.
- Contract between app and API: `src/app/core/api/models.ts` and `src/app/core/mock/handlers.ts`.

## Boundaries

- `ui/` never imports `features/` (ESLint enforces it). `core/` does not import `features/`, with one designed exception: `core/mock/features.ts`, where the generator registers the mock of a generated feature. Features do not import each other.
- Screens reach data only through `src/app/core/api/*.api.ts` and `API_BASE_URL`. No `fetch`, no direct `localStorage` access for API data.
- Rules about hours, dates, conflicts and balances are pure functions in `src/app/core/domain/`. Call them from components and handlers instead of writing them again. A second implementation, for example in a server process, needs an ADR and tests that hold the two equal.
- The mock demo (MSW, GitHub Pages) must keep working when another mode is added. The repository has no API server and does not use SQLite today; `scripts/serve-dist.mjs` only serves the built files.

## Git workflow

- `v1.0.0` is tagged, so every change goes through a small pull request ([CONTRIBUTING.md](CONTRIBUTING.md)). Do not commit to `main`.
- Work on a branch, in your own worktree when another checkout has local changes. Leave other people's uncommitted files alone.
- Conventional commits, header at most 100 characters. A merge to `main` deploys the demo to GitHub Pages.
- One issue per pull request where possible; name the issue in the description.

## Evidence before calling a ticket done

- The commands you ran and their real results. `npm run verify` runs, in order: `tokens:check`, `cli:test`, `lint`, `format:check`, `typecheck`, `test -- --watch=false`, `build`, `e2e`. Say which steps you skipped and why.
- For each acceptance criterion of the issue: the test, command output or screenshot that shows it. A criterion without evidence is not done.
- For screen changes: both themes, EN and NL, keyboard use, and the axe run in `e2e/a11y.spec.ts`.
- The commit SHA the evidence belongs to.

## Agent roles, ticket work and triage loop

- **Where the roles live.** Eight project subagents in `.claude/agents/`: pinned copies from Agency Agents with local changes. Each role file starts with an "In this repository" section written for this project (what the role owns here, its commands, its checklist, what to ignore in the generic text, what to hand back). That section and this file override the generic text below it. The list, the pin, the license and the local changes are in [docs/agents-and-loop.md](docs/agents-and-loop.md).
- **Playbook.** When asked to implement, continue or finish a GitHub issue, follow [`.claude/skills/implement-ticket/SKILL.md`](.claude/skills/implement-ticket/SKILL.md). Claude Code loads it on its own for ticket work; `/implement-ticket <issue number>` starts it by hand. Delegate to the roles without waiting to be asked; the "Use proactively" sentence that ends each role `description` is what triggers the delegation.
- **Before coding:** Codebase Onboarding Engineer for an unfamiliar area, and Software Architect when a boundary, data model, storage schema, public API or dependency changes. Both are read-only.
- **While coding:** the implementing role that matches the files: Frontend Developer (browser-side code), Backend Architect (contract, mock API, domain rules, the planned local-mode server), Test Automation Engineer (tests and the Playwright harness).
- **After coding:** Accessibility Auditor when user-facing UI, keyboard handling, focus order or markup changed.
- **Gates on every ticket, whatever its size:** Code Reviewer on the full diff (review gate), then Reality Checker on the acceptance criteria and the evidence (acceptance gate). Both are read-only and cannot run commands: give them the diff, the criteria and the recorded command output. The session that wrote a change does not count as its reviewer.
- **Pull request.** List each role that ran, what it was asked and its verdict under "Agent roles run", and any step done without a role.
- **Triage loop.** The issue-triage loop is L1 report-only and started by hand ([LOOP.md](LOOP.md)). Do not add a scheduler, automated fixes or auto-merge.
- **Skills in git.** The four loop skills and `implement-ticket` are tracked. Everything else in `.claude/skills/` is ignored; keep other skills local.
