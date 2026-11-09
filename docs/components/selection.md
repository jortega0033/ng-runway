# Selection components

Import from `@ui/index`. Built on `@angular/aria` (combobox, listbox, tabs) and the CDK overlay.

## ui-combobox

Searchable single select. Works with Signal Forms (`FormValueControl<string>`) and picks up the id,
description and invalid state from a surrounding `ui-field`.

| Input                                         | Type                            | Notes                                                    |
| --------------------------------------------- | ------------------------------- | -------------------------------------------------------- |
| `value`                                       | `model<string>`                 | Selected option value, `''` for none.                    |
| `options`                                     | `{ value, label, disabled? }[]` | Required.                                                |
| `placeholder`, `name`, `ariaLabel`            | `string`                        | `ariaLabel` is needed when there is no `ui-field` label. |
| `size`                                        | `sm` / `md` / `lg`              | Default `md`.                                            |
| `loading`                                     | `boolean`                       | Shows a loading row in the list.                         |
| `externalFilter`                              | `boolean`                       | Skip the built-in label filter (server side search).     |
| `clearable`                                   | `boolean`                       | Default `true`.                                          |
| `emptyText`, `loadingText`, `clearLabel`      | `string`                        | Text defaults are English and overridable.               |
| `disabled`, `readonly`, `required`, `invalid` | `boolean`                       | Set automatically by Signal Forms.                       |

| Output  | Notes                                                                                      |
| ------- | ------------------------------------------------------------------------------------------ |
| `query` | Raw typed text on every input, no debounce. Debounce in the caller, then update `options`. |
| `touch` | Blur or pick, for Signal Forms touched state.                                              |

Keyboard: ArrowDown opens, ArrowUp and ArrowDown move, Home and End jump, Enter picks, Escape closes
and restores the selected label. The public method `openList()` opens the list from code.

```html
<ui-field label="Team" [error]="teamError()" required>
  <ui-combobox [formField]="f.team" [options]="teams" placeholder="Search teams" />
</ui-field>

<!-- async: the caller debounces and loads -->
<ui-combobox [options]="found()" [loading]="searching()" externalFilter (query)="search($event)" />
```

## ui-multiselect

Same engine and inputs as the combobox (minus `clearable`), value is `string[]`
(`FormValueControl<string[]>`). Picked values are shown as `ui-tag` chips with remove buttons, and the
list stays open while picking. Backspace in the empty input removes the last chip. Extra input
`removeLabel` (default `Remove`) prefixes each chip's remove button label.

```html
<ui-field label="Skills">
  <ui-multiselect [formField]="f.skills" [options]="skills" />
</ui-field>
```

Selected values that the current filter hides stay selected.

## ui-tabs and ui-tab

```html
<ui-tabs [(value)]="tab" ariaLabel="Employee sections">
  <ui-tab value="overview" label="Overview">Eager content</ui-tab>
  <ui-tab value="docs" label="Documents">
    <ng-template uiTabContent><app-documents /></ng-template>
  </ui-tab>
</ui-tabs>
```

| Input (`ui-tabs`) | Notes                                                             |
| ----------------- | ----------------------------------------------------------------- |
| `value`           | `model<string>`, defaults to the first enabled tab.               |
| `orientation`     | `horizontal` (top bar on the selected tab) or `vertical`.         |
| `selectionMode`   | `follow` (arrows select, default) or `explicit` (Enter or Space). |
| `ariaLabel`       | Name of the tab list.                                             |

`ui-tab` takes `value` (required), `label` (required) and `disabled`. Content wrapped in
`<ng-template uiTabContent>` is only created once the tab is opened; plain content is created up
front but shown only when selected. Arrow keys, Home and End move between tabs and skip disabled ones.
