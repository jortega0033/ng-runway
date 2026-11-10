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
