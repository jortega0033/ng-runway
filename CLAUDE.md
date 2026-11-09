# ng-runway

Angular 22 admin dashboard boilerplate (workforce management). UI only, mocked API. M0 bootstrap in progress; this file grows with each milestone.

## Run and test

- `npm ci --ignore-scripts`, then `npm start` (dev), `npm run build`.
- `npm test -- --watch=false` (Vitest through the Angular builder), `npm run lint`, `npm run format:check`, `npm run typecheck`.
- `npm run tokens:build` regenerates `tokens/tailwind-theme.css` and `tokens/tokens.ts`; `npm run tokens:check` must pass.
- `npm run hooks:install` sets up Husky (lint-staged, commitlint). Conventional commits.

## Structure

- `tokens/`: `tokens.css` and `tokens.json` are the source of truth, never edit values. Other files there are generated.
- `src/app/core/` (app-wide services), `src/app/ui/` (UI library), `src/app/features/` (feature folders). Aliases: `@core/*`, `@ui/*`, `@features/*`, `@tokens`.
- `docs/adr/`: decisions (MSW mock API, state, no UI kit, token pipeline, install modes).

## Conventions

- Standalone, zoneless, signals, `inject()`, new control flow. Tailwind v4 with semantic tokens only.
- State: signal services by default; NgRx SignalStore only for the schedule (ADR 0002).
- No UI kit. Reuse components in `src/app/ui/` and semantic tokens (`--colors-*`); do not invent new ones.

## Forbidden

- Raw hex values or `--palette-*` in components. Gradients, glass or blur cards, emoji icons, lorem text.
- Font files in the repo. Editing `tokens/tokens.css` or `tokens/tokens.json` values.
- `dependencies` entries (everything is a devDependency), `prepare` or `postinstall` scripts.

## Skill routing (angular-engineer plugin)

Vague or large ticket: `angular-refine`. Before merge or on review comments: `angular-review`. New to the repo: `angular-onboard`. Sizing a change or PR: `angular-small-pr`. Building or fixing a feature: `angular-engineer`.
