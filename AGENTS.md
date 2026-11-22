# ng-runway

Angular 22 admin dashboard boilerplate (workforce management). UI only, mocked API (MSW). This file is for any coding agent; humans can read it too.

## Run and test

- `npm ci --ignore-scripts`, then `npm start` (dev server), `npm run build`.
- `npm test -- --watch=false` (Vitest through the Angular builder), `npm run lint`, `npm run format:check`, `npm run typecheck`.
- `npm run tokens:build` regenerates `tokens/tailwind-theme.css` and `tokens/tokens.ts`; `npm run tokens:check` must pass.
- `npm run hooks:install` sets up Husky (lint-staged, commitlint). Use conventional commits.
- CLI tests: `npm run cli:test`.

## Structure

- `tokens/`: `tokens.css` and `tokens.json` are the source of truth. Never edit their values. The other files there are generated.
- `src/app/core/` app-wide services, `src/app/ui/` UI library, `src/app/features/` feature folders. Path aliases: `@core/*`, `@ui/*`, `@features/*`, `@tokens`.
- `docs/adr/` decisions (MSW mock API, state, no UI kit, token pipeline, install modes). `docs/components/` documentation of the UI components.
- `cli/` the zero-dependency installer CLI. `drills/` practice material, not part of the app.

## Conventions

- Standalone components, zoneless, signals, `inject()`, new control flow (`@if`, `@for` with `track`, `@switch`).
- Tailwind v4 with semantic tokens only.
- State: signal services by default; NgRx SignalStore only for the schedule (ADR 0002).
- No UI kit. Hard rule: reuse existing components in `src/app/ui` and semantic tokens (`--colors-*`); never invent new ones. If something is missing, say so instead of adding a one-off.
- User-visible text in features goes through Transloco keys.

## Forbidden

- Raw hex values or `--palette-*` in components. Gradients, glass or blur cards, emoji icons, lorem text.
- Font files in the repo. Editing values in `tokens/tokens.css` or `tokens/tokens.json`.
- `dependencies` entries (everything is a devDependency), and `prepare` or `postinstall` scripts.

## Before you start

- Requirements live in the GitHub issues and their epic. Architecture, one traced workflow and the roadmap status are in [docs/architecture.md](docs/architecture.md).
- `v1.0.0` is tagged: work on a branch and open a small pull request ([CONTRIBUTING.md](CONTRIBUTING.md)). Do not commit to `main`.
- Project agent roles and the report-only triage loop are described in [docs/agents-and-loop.md](docs/agents-and-loop.md) and [LOOP.md](LOOP.md). The loop never edits source, labels, pushes or merges.
- Ticket work follows one playbook for every coding agent: [.claude/skills/implement-ticket/SKILL.md](.claude/skills/implement-ticket/SKILL.md) (steps, roles, a review gate and an acceptance gate on every ticket). An agent that cannot start the roles in `.claude/agents/` does those steps itself, uses the "In this repository" section at the top of each role file as its checklist, and says so in the pull request.

## Delivery workflow

The owner starts ticket work with `/next-ticket`; a run counts as the owner's request to push the ticket branch and open the pull request for that ticket. Push or open a pull request only when the owner asked for it in the current session. Never merge or release: only the owner does. A review gate hook blocks opening a pull request until Code Reviewer and Reality Checker ran. Details: the "Delivery workflow" part of [CLAUDE.md](CLAUDE.md), [docs/ui-quality.md](docs/ui-quality.md) and [docs/owner-decisions.md](docs/owner-decisions.md).

## Before you finish

Run `npm run lint`, `npm run typecheck`, `npm test -- --watch=false` and `npm run build`. Report what you ran and what you did not. For a ticket, show the evidence for each acceptance criterion and the commit it belongs to.
