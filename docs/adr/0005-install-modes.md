# 0005. Three install modes through a zero-dependency GitHub CLI

Status: accepted (owner decision; critic concerns reconciled below)
Date: 2026-11-09

## Context

Different users need different amounts: only the tokens, the UI library with tokens, or the whole boilerplate. The audience works under time pressure, so installs must be fast and must not run lifecycle scripts. The package is not published to npm; it is used straight from GitHub.

## Decision

A plain Node CLI in `cli/` exposed through `bin`, used as `npx github:jortega0033/ng-runway <tokens|ui|create>`. `dependencies` stays empty and everything is in `devDependencies`, with no `prepare` or `postinstall`, so `npx` fetches and runs without installing the build toolchain. Husky is installed explicitly with `npm run hooks:install`. `mockServiceWorker.js` is committed. The repo works after `npm ci --ignore-scripts`.

- `tokens [dir] [--format css|json|tailwind|ts|all]` copies token files.
- `ui [dir]` copies the UI library and tokens and prints what the host project must provide.
- `create <app-name>` copies the full boilerplate, renames it, creates a fresh git repository and installs.

## Options considered

| Option                    | Benefits                          | Costs / risks                                   |
| ------------------------- | --------------------------------- | ----------------------------------------------- |
| GitHub `npx` CLI (chosen) | No registry, always matches a tag | Downloads the repo tarball each run             |
| Publish to npm            | Faster, versioned                 | Extra publishing process; out of scope          |
| Template repository only  | Simplest                          | No partial installs                             |
| `degit` or `giget`        | Familiar                          | Extra dependency; no rename or format selection |

## Consequences

- The CLI uses only Node built-ins and is tested on Windows, macOS and Linux.
- Files copied by `ui` must stay self-contained; an ESLint `no-restricted-imports` rule keeps `ui/` from importing feature code (`@core` and `@tokens` are allowed).
- `strip` and `gen:feature` are repo scripts and are not part of the CLI.

## Assumptions and not verified

- `npx github:` runs a `bin` entry from a repo with a large `devDependencies` list without installing it. Measured: it works with a devDependencies-only package and installs no dependencies into the npx cache (only ng-runway itself). The first run took about 2 minutes (git fetch); a cached run took 17 seconds.

## Revisit when

The project is published to npm, or `npx github:` becomes slow because of repo size.

## Critic reconciliation

- Core mechanism: whether `npx github:` installs only runtime dependencies (devDependencies are not installed for a git dependency without a `prepare` script) was measured, not assumed; the result is recorded under assumptions above.
- Documented commands pin a tag: `npx github:jortega0033/ng-runway#v1.0.0 <mode>`. The unpinned form follows the default branch and is documented as such.
- `"private": true` must not block this; checked in the same measurement and does not block it.
- File selection is manifest-driven (`cli/manifest.mjs`) with a test that fails when files listed there are missing.
- Overwrite policy: `tokens` and `ui` refuse to overwrite existing files unless `--force` is passed; `create` refuses a non-empty target directory. `create` runs `npm ci --ignore-scripts` unless `--no-install` is given, and reports git or install failures without leaving a half-renamed project.
