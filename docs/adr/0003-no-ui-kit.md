# 0003. Build the UI library on Angular Aria and CDK, no UI kit

Status: accepted (owner decision; critic concerns reconciled below)
Date: 2026-11-09

## Context

The product has a fixed design system (tokens) and one accent color. A candidate in a timed assessment must be able to explain every line. Third-party kits bring their own theming, bundle weight and APIs that the tokens would have to fight.

## Decision

Build the components in `src/app/ui/` from `@angular/aria` (accessible interaction patterns) and `@angular/cdk` (overlay, drag and drop, virtual scroll, a11y utilities), styled with Tailwind utilities that resolve to semantic tokens only. No Material, PrimeNG or similar.

## Options considered

| Option                           | Benefits                               | Costs / risks                                      |
| -------------------------------- | -------------------------------------- | -------------------------------------------------- |
| Aria + CDK + own styles (chosen) | Full control, explainable, token-exact | More code to write and test; accessibility is ours |
| Angular Material                 | Complete, tested                       | Theme fights the tokens; large surface to explain  |
| PrimeNG or Spartan               | Fast to assemble                       | Third-party API and styling model                  |

## Consequences

- Every component needs variants, states and keyboard behavior documented in `docs/components.md` and shown on `/design-system`.
- Hard rule: reuse existing components and semantic tokens; do not invent new ones.
- Accessibility is verified with axe in both themes.

## Assumptions and not verified

- `@angular/aria` covers combobox, listbox, tabs, menu and similar patterns well enough. Where it does not, the CDK or a small custom directive fills the gap (checked per component while building the library).

## Revisit when

The component count or maintenance load makes a kit cheaper than the library.

## Critic reconciliation

Component inventory. The library in `src/app/ui/` followed this plan; no gap blocked the decision.

| Needs                                                                                                                                    | Built on                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| tabs, listbox, combobox, select, multiselect, menu, switch-like toggles                                                                  | `@angular/aria` patterns                                                            |
| dialog, drawer, popover, tooltip, toast container                                                                                        | CDK overlay and a11y (focus trap, live announcer)                                   |
| table with sort, pagination, virtual scroll                                                                                              | semantic table markup, CDK scrolling                                                |
| date picker, time picker                                                                                                                 | custom (calendar grid with roving focus, native `input type=time` fallback allowed) |
| charts                                                                                                                                   | custom SVG                                                                          |
| button, input, textarea, checkbox, radio, badge, avatar, tag, card, alert, spinner, skeleton, breadcrumbs, page header, sidebar, top bar | plain components                                                                    |

- Accessibility cost is accepted. Axe in both themes is a baseline; complex widgets also get keyboard tests and a short manual checklist in `docs/components.md`.
- If a widget cannot be built on Aria or the CDK in reasonable time, a headless fallback or a simpler native element is allowed. It must still use semantic tokens.
- The "do not invent components" rule applies to feature code: features reuse `ui/` components. Adding a component to `ui/` is allowed with a `/design-system` entry and a `docs/components.md` entry.
- Revisit threshold: if more than 3 widgets need non-trivial custom accessibility work after the library was built, reconsider a headless library.
