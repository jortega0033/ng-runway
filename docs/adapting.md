# Adapting ng-runway to an existing project

Two parts can be dropped into another project: the design tokens and the UI library. Both are copied as source files, nothing is installed from npm.

```bash
# tokens only
npx github:jortega0033/ng-runway#v1.0.0 tokens
# UI library + tokens (add --docs to also copy docs/components)
npx github:jortega0033/ng-runway#v1.0.0 ui
```

Existing files are never overwritten unless you pass `--force`; the CLI lists what it skipped.

## 1. Tokens only

`tokens/` contains four files (`--format css|json|tailwind|ts|all`):

| File                 | Use                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| `tokens.css`         | Plain CSS custom properties. Works in any framework. Defines `.theme-light` and `.theme-dark`. |
| `tokens.json`        | The same tokens as W3C design tokens (DTCG).                                                   |
| `tailwind-theme.css` | Tailwind v4 `@theme` mapping (generated).                                                      |
| `tokens.ts`          | Typed constants for TypeScript, for example data colors for charts (generated).                |

Plain CSS, no Tailwind: import `tokens.css` once and use `var(--colors-foreground)` and friends. Put `theme-light` or `theme-dark` on `<html>` (this repo does it in `src/app/core/theme/theme.service.ts`).

Fonts: the tokens reference Satoshi and Parkinsans but no font files are shipped. Load them yourself (self-host or a font service you are licensed for), otherwise the fallbacks in the token file are used.

## 2. Tailwind v4 or v3

The UI library uses Tailwind v4 utilities that map to the semantic tokens. In your global stylesheet, as in this repo's `src/styles.css`:

```css
@import '../tokens/tokens.css';
@import 'tailwindcss';
@import '../tokens/tailwind-theme.css';
```

Adjust the relative paths to where your stylesheet and `tokens/` live. Tailwind v4 also needs PostCSS wired up. This repo uses `.postcssrc.json` containing `{ "plugins": { "@tailwindcss/postcss": {} } }` and the packages `tailwindcss` and `@tailwindcss/postcss`.

`tailwind-theme.css` removes the default Tailwind palette (`--color-*: initial`), so only the semantic colors exist (`bg-background-muted`, `text-foreground-subtle`, `border-border`). Utilities such as `bg-blue-500` will not generate.

Tailwind v3 is not supported by `tailwind-theme.css` (it relies on v4 `@theme`). Options: upgrade to v4, or stay on v3 and map the CSS variables yourself in `tailwind.config`, for example `colors: { foreground: 'var(--colors-foreground)' }`. Then the UI library class names (`bg-background-hover` and so on) have to exist in your config under the same names. That is real work; upgrading is usually cheaper.

## 3. UI library requirements

Copy puts the library in `src/app/ui` (with `index.ts` as the public barrel). The host project needs:

- Angular 22. The code is written for signals and the new control flow (see the Angular 17-19 notes below).
- `@angular/cdk` (overlay, dialog, portal, scrolling, keycodes) and `@angular/aria` (combobox, listbox, tabs). Both at the same major as Angular.
- `date-fns` for the date picker.
- `@angular/forms` Signal Forms (`@angular/forms/signals`): the form controls implement `FormValueControl` and `FormCheckboxControl`, so `[formField]` works on them.
- `@angular/router`: `breadcrumbs` and `sidebar-nav` use `routerLink`.
- Charts: `chart/chart-core.ts` imports `@tokens` and `@core/theme/theme.service`. Add the `@tokens` alias and a `ThemeService` (copy `src/app/core/theme/theme.service.ts` from the repo), or delete the `chart` folder and its lines in `index.ts`.

### Path aliases

In `tsconfig.json` (not the app or spec files):

```json
{
  "compilerOptions": {
    "paths": {
      "@ui/*": ["./src/app/ui/*"],
      "@tokens": ["./tokens/tokens.ts"]
    }
  }
}
```

Add `@core/*` too if you keep the chart. Inside `src/app/ui` files use relative imports, so the `@ui/*` alias is only for your own code: `import { ButtonComponent } from '@ui/index';`. The barrel is a convenience; you can also import from a component file directly.

## 4. Older Angular versions (17-19)

The library as shipped targets Angular 22. A downgrade is possible for part of it, but it is a port, not a switch.

| Feature in the code                              | Since      | If your version is older                                                                                      |
| ------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------- |
| Standalone components                            | 14         | NgModule projects import the standalone components directly in `imports: [...]`. No module wrapper is needed. |
| `@if`, `@for`, `@switch`                         | 17         | Required. On 16 or older use `*ngIf` and `*ngFor`.                                                            |
| `input()`, `viewChild()` (signal inputs/queries) | 17.1+      | Required. Below 17.1 convert to `@Input()` and `@ViewChild()`.                                                |
| `model()` (two-way signal input)                 | 17.2+      | Required. Below 17.2 use an `@Input()` plus an `@Output() valueChange`.                                       |
| `output()`                                       | 17.3+      | Below that use `@Output()` with `EventEmitter`.                                                               |
| `inject()`                                       | 14         | Fine.                                                                                                         |
| Zoneless change detection                        | stable 20+ | Not needed. Components are `OnPush` and signal based, so they work in zone.js apps too.                       |
| Signal Forms (`@angular/forms/signals`)          | 21         | Not available before 21 (check the release notes for your version). See below.                                |
| `@angular/aria`                                  | 21         | Not available before 21. See below.                                                                           |

Rules of thumb:

- Do not mix: converting `input()` back to `@Input()` changes how the template reads the value (`name()` becomes `name`). Convert a component completely or not at all.
- zone.js apps: nothing in the library requires removing zone.js. Signals and `OnPush` update correctly with zones. The repo itself is zoneless; the library does not depend on that.
- Version numbers above come from Angular release history and were not re-verified against each release here. The versions in this repo (22.2) are verified from `package.json`.

### Signal Forms

Eleven files in `src/app/ui` import `@angular/forms/signals` (the form controls: input, textarea, select, checkbox, switch, radio group, segmented, combobox, multiselect, date picker, time picker). Without it, those components do not compile. Before Angular 21 either skip them and keep your own form controls, or rework the `value`/`checked` models to a `ControlValueAccessor`.

Components that do not use Signal Forms (button, badge, alert, card, table, pagination, dialog, drawer, popover, tooltip, toast, tabs and so on) have no such dependency.

### Components built on `@angular/aria`

From `docs/components` and the imports in `src/app/ui`, these four files use `@angular/aria`:

| File                      | Aria entry point         |
| ------------------------- | ------------------------ |
| `combobox/combobox.ts`    | `@angular/aria/combobox` |
| `combobox/multiselect.ts` | `@angular/aria/combobox` |
| `combobox/option-list.ts` | `@angular/aria/listbox`  |
| `tabs/tabs.ts`            | `@angular/aria/tabs`     |

`@angular/aria` 22.2 in this repo declares a peer dependency of `@angular/core` `^22 || ^23`. On an older Angular, either install the `@angular/aria` release that matches your Angular major (its directive API may differ from what these files use; not checked), or replace these four with your own components, or with the CDK primitives (`@angular/cdk/listbox`, `@angular/cdk/menu`) that exist in older CDK releases. The date and time pickers use `ui-popover` (CDK overlay) and the calendar is a hand-built ARIA grid, so they do not need `@angular/aria`.

## 5. Check after copying

1. The app compiles: `ng build`. Missing alias or package errors point to the list in section 3.
2. Fonts load and a `<button ui-button>` looks right in light and dark (`theme-light` / `theme-dark` on `<html>`).
3. Do not edit values in the copied `tokens.css` or `tokens.json`. If you change them, regenerate `tailwind-theme.css` and `tokens.ts` with `scripts/tokens-build.mjs` (copy it from the repo, it needs only Node).
