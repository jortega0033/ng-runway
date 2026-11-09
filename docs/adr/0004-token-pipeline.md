# 0004. Token pipeline: CSS and DTCG JSON are the source, the rest is generated

Status: accepted (owner decision; critic concerns reconciled below)
Date: 2026-11-09

## Context

The design tokens arrive as `tokens.css` and `tokens.json` (W3C DTCG). Values must stay exactly as given. Components may use only semantic tokens (`--colors-*`, spacing, typography, radius, shadow, motion). Tokens must work in any framework as plain CSS custom properties, and Tailwind v4 needs a `@theme` definition.

## Decision

`tokens/tokens.css` and `tokens/tokens.json` are owned by hand and never edited by tooling. A dependency-free Node script (`scripts/tokens-build.mjs`) generates `tokens/tailwind-theme.css` and `tokens/tokens.ts`. The default Tailwind palette is removed, and semantic colors are aliases (`@theme inline`) of the live CSS variables, so utilities follow `.theme-light` and `.theme-dark`. A Vitest spec fails if the two themes define different semantic tokens, if CSS and JSON disagree, or if the generated files are stale. An e2e test compares computed values in the running app to `tokens.css`.

## Options considered

| Option                                | Benefits                             | Costs / risks                           |
| ------------------------------------- | ------------------------------------ | --------------------------------------- |
| Own generator, no dependency (chosen) | Works with `npx`, nothing to install | We maintain a small CSS parser          |
| Style Dictionary                      | Standard tool, many outputs          | Heavy dependency; DTCG plus CSS mapping |
| Hand-written Tailwind theme           | No script                            | Drifts silently                         |

## Consequences

- Prettier and ESLint ignore `tokens/` so values stay byte-exact.
- The parser handles the current file shape only (`:root`, `.theme-light`, `.theme-dark` blocks of simple declarations). A format change needs a parser change.
- The `ui` and `tokens` install modes copy `tokens/` unchanged.

## Assumptions and not verified

- Tailwind v4 `@theme inline` with `--color-*: initial` produces only semantic color utilities. Checked in the production build output so far; a test that scans for raw palette utilities is still to add.

## Revisit when

Tokens come from a design tool export that needs a richer transform than this script covers.

## Critic reconciliation

- Silent drops: the generator now throws on any root custom property outside the known token families, so a new family fails the build until the script handles it.
- The e2e computed-value test is not built yet. It is planned for M2 and listed as a verification item; the ADR text above is a plan, not a claim.
- CI runs `npm run tokens:check` as well as the Vitest spec.
- Parser limits (no nested at-rules in `:root` blocks, no `}` inside values) are documented in the script header. The spec fails if `tokens.css` yields no tokens or an unexpected block shape.
- The spec compares colors, spacing and radius between CSS and JSON. Typography, shadow and motion comparison is added to the spec in M1.
- Install modes copy `tokens/` as it is in the checkout; the `tokens:check` step in CI is what keeps it current.
