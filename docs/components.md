# UI component catalog

Every component in `src/app/ui/`. **Reuse these and the semantic tokens (`--colors-*`); do not invent new components or colors.**
Import from `@ui/index`. Each group below is also a live section on the `/design-system` page.

## Basics

Import from the barrel: `import { ButtonComponent, BadgeComponent } from '@ui/index'`. Every component uses semantic tokens only and supports both themes.

## `button[ui-button]`

| Input      | Type                                              | Default     |
| ---------- | ------------------------------------------------- | ----------- |
| `variant`  | `'primary' \| 'secondary' \| 'ghost' \| 'danger'` | `'primary'` |
| `size`     | `'sm' \| 'md' \| 'lg'`                            | `'md'`      |
| `loading`  | boolean (shows a spinner, blocks clicks)          | `false`     |
| `disabled` | boolean                                           | `false`     |

```html
<button ui-button variant="secondary" type="button" (click)="save()">Save</button>
```

## `button[ui-icon-button]`

Icon-only button. `icon` and `label` are required; the label becomes the accessible name. Also takes `loading` and `disabled`.

```html
<button ui-icon-button icon="edit" label="Edit shift" type="button"></button>
```

## `a[ui-link]`

Styled anchor. Use it with `href` or `routerLink`.

## `ui-icon`

`name` (required, see `ICON_NAMES`), `size` (`16 | 20 | 24`, default 20), `label` (accessible name; leave empty for decorative icons).

## `ui-badge`

`variant`: `'neutral' | 'brand' | 'success' | 'warning' | 'danger'`. Use for a status next to text, not on every row.

## `ui-avatar`

`name` (required, becomes the accessible name, initials are drawn), `size`: `'sm' | 'md' | 'lg'`.

## `ui-tag`

Small label or removable chip. Inputs: `color` (hex or null), `removable`, `removeLabel`. Output: `removed`.

## `ui-spinner`

`size`, `color`, `label` (default "Loading"). It has `role="status"`.

## `ui-skeleton`

Loading placeholder. Size it with classes: `<ui-skeleton class="h-4 w-48" />`.

## `ui-alert`

Inline message. Inputs: `variant` (`info | success | warning | danger`), `heading`, `dismissible`, `dismissLabel`. Output: `dismissed`. Danger and warning use `role="alert"`, the others `role="status"`.

## Form controls

All controls work with Signal Forms (`[formField]="form.name"`) and with plain `[(value)]` / `[(checked)]` bindings. Wrap a control in `ui-field` for the label, hint and error text.

```html
<ui-field label="Email" hint="Work address" [error]="emailError()">
  <ui-input type="email" [formField]="f.email" />
</ui-field>
```

## `ui-field`

| Input              | Notes                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------- |
| `label` (required) | Visible label, linked to the control                                                         |
| `hint`             | Helper text under the control                                                                |
| `error`            | Error text. A non-empty value marks the control invalid and links it with `aria-describedby` |
| `required`         | Adds the required marker                                                                     |
| `forId`            | Use only when the control is not a direct child                                              |

## `ui-input`

`value` (model), `type` (`text | email | password | number | tel | search | url`), `size`, `placeholder`, `name`, `autocomplete`, `disabled`, `readonly`, `required`, `invalid`.

## `ui-textarea`

`value` (model), `rows` (4), `placeholder`, `disabled`, `readonly`, `required`, `invalid`.

## `ui-select`

Native `<select>`. `value` (model), `options` (`{ value, label, disabled? }[]`), `placeholder`, `disabled`, `required`, `invalid`. For long lists with search use `ui-combobox`.

## `ui-checkbox`

`checked` (model), `indeterminate`, `disabled`, `invalid`. Content is the label.

## `ui-switch`

`checked` (model), `disabled`. Applies immediately, so use it for settings, not for form fields that need Save. Content is the label.

## `ui-radio-group`

`value` (model), `options`, `orientation` (`vertical | horizontal`), `label`, `disabled`.

## `ui-segmented`

Small exclusive choice such as Day / Week. `value` (model), `options`, `label`, `disabled`.

## Selection components

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

## Pickers

Date and time fields for Signal Forms. Both implement `FormValueControl<string>`, sit inside `ui-field` for label, hint and error, and use the popover overlay. Import from `@ui/index`.

## Date picker

```html
<ui-field label="Start date">
  <ui-date-picker [formField]="f.startDate" min="2026-01-01" />
</ui-field>
```

The value is an ISO date `yyyy-MM-dd` (local calendar date, no time zone) or an empty string.

| Input                                         | Default      | Notes                                             |
| --------------------------------------------- | ------------ | ------------------------------------------------- |
| `value` (model)                               | `''`         | `yyyy-MM-dd`                                      |
| `min`, `max`                                  |              | `yyyy-MM-dd`; days outside are disabled           |
| `displayFormat`                               | `yyyy-MM-dd` | date-fns format of the text box (value stays ISO) |
| `weekStartsOn`                                | `1`          | 0 = Sunday, 1 = Monday                            |
| `size`                                        | `md`         | `sm` `md` `lg`                                    |
| `placeholder`, `name`                         |              |                                                   |
| `disabled`, `readonly`, `required`, `invalid` | `false`      |                                                   |
| `buttonLabel`, `calendarLabel`                | English      | aria-labels, override for translation             |

Output `touch`. Method `focus()`.

Typing: the text is committed on Enter or blur. Invalid text, impossible dates (2026-02-30) and dates outside `min`/`max` are rejected and the last good value is restored.

Keyboard (text box): ArrowDown opens the calendar. Calendar: arrows move by day and week, PageUp/PageDown by month (Shift: year), Home/End to the start and end of the week, Enter or Space selects, Escape closes and returns focus. Disabled days never receive focus.

`ui-calendar` (the grid) is exported on its own: inputs `value`, `min`, `max`, `weekStartsOn`, `locale`, `autofocus`, labels; output `selected`. It is an ARIA grid with one tab stop; today has `aria-current="date"` and a border, the selected day is filled.

## Time picker

```html
<ui-time-picker [formField]="f.start" [step]="30" min="06:00" max="22:00" />
```

The value is `HH:mm` (24-hour) or an empty string.

| Input                                         | Default       | Notes                                     |
| --------------------------------------------- | ------------- | ----------------------------------------- |
| `value` (model)                               | `''`          | `HH:mm`                                   |
| `step`                                        | `15`          | minutes between listed times              |
| `min`, `max`                                  | whole day     | `HH:mm`; limits the list and typed values |
| `size`, `placeholder`, `name`                 | `md`, `HH:mm` |                                           |
| `disabled`, `readonly`, `required`, `invalid` | `false`       |                                           |
| `buttonLabel`, `listLabel`                    | English       | aria-labels                               |

It is a combobox: focus stays in the text box; ArrowDown opens the list (current time active), ArrowUp/ArrowDown move, Enter picks, Escape closes. Any valid time can be typed: `930`, `9:30` and `09:30` all become `09:30`, committed on Enter or blur. Anything else restores the last value. Typed times between steps are accepted.

## Data display

Import from the barrel: `import { TableComponent, PaginationComponent } from '@ui/index'`.

## `ui-table`

Typed table built on ARIA table roles and CSS grid. It sorts the rows it is given, never pages them.

| Input                                     | Type                      | Notes                                                                                                                                       |
| ----------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `columns` (required)                      | `TableColumn<T>[]`        | `{ key, header, sortable?, cell?, accessor?, align?, width? }`                                                                              |
| `rows` (required)                         | `T[]`                     |                                                                                                                                             |
| `label` (required)                        | `string`                  | Accessible name of the table                                                                                                                |
| `trackBy`                                 | `(row: T) => unknown`     | Row identity for tracking and selection. Default: the row itself                                                                            |
| `sort` (model)                            | `TableSort \| null`       | `{ key, direction: 'asc' \| 'desc' }`. Header click cycles asc, desc, off                                                                   |
| `manualSort`                              | boolean                   | Skip the built-in sort when the server sorts                                                                                                |
| `loading`, `skeletonRows`                 | boolean, number (5)       | Skeleton rows and `aria-busy`                                                                                                               |
| `emptyTitle`, `emptyMessage`, `emptyIcon` |                           | Rendered with `ui-empty-state` when there are no rows                                                                                       |
| `selectable`, `selected` (model)          | boolean, `T[]`            | Checkbox column; header checkbox is indeterminate for partial selection                                                                     |
| `selectAllLabel`, `rowSelectLabel`        | string, `(row) => string` | Accessible names for the checkboxes                                                                                                         |
| `rowClickable`                            | boolean                   | Rows get `tabindex=0`; Enter, Space and click emit `rowClick` (clicks on inner controls do not)                                             |
| `dense`                                   | boolean                   | 32px rows instead of 44px                                                                                                                   |
| `virtual`, `height`                       | boolean, CSS length       | CDK virtual scroll for 1000+ rows. `height` is the body height (default `24rem`); without `virtual` it is the max height of the scroll area |

Outputs: `rowClick(row)`, plus `sortChange` and `selectedChange` from the models.
Slot: `[empty-action]` is shown inside the empty state.

Cells: pass `accessor: (row) => value` for plain values (also used for sorting), or `cell: TemplateRef` for custom markup. The template context is `{ $implicit: row, row, column, index }`.

```html
<ng-template #status let-row><ui-badge>{{ row.status }}</ui-badge></ng-template>

<ui-table
  label="Employees"
  [columns]="columns"
  [rows]="rows()"
  [trackBy]="byId"
  [(sort)]="sort"
  [(selected)]="selected"
  selectable
  rowClickable
  (rowClick)="open($event)"
/>
```

Sticky header: scroll the table itself (set `height`) and the header stays put. In `virtual` mode the header sits outside the viewport and both reserve the same scrollbar gutter, so columns stay aligned.

Server-side flow: set `manualSort`, react to `sort` and `ui-pagination` changes, load the page, pass it as `rows`.

## `ui-pagination`

`page` and `pageSize` are models (page starts at 1); `total` is required. Shows `1-20 of 143`, previous/next, up to 7 page slots with ellipses (first and last always visible), and a page-size select. Changing the size returns to page 1. Wrapped in `<nav aria-label="Pagination">`; the current page has `aria-current="page"`.

Inputs: `pageSizeOptions` (`[10, 20, 50, 100]`, empty array hides the select), `label`, `previousLabel`, `nextLabel`, `pageSizeLabel`, `pageLabel` (`(page) => string`). Helpers `pageCount()` and `pageItems()` are exported.

```html
<ui-pagination [total]="total()" [(page)]="page" [(pageSize)]="pageSize" />
```

## `ui-card`

Border and `shadow-xs` only. `padding`: `padded` (default) or `flush` (for tables and lists). Slots: `[card-header]`, default content, `[card-footer]`.

## `ui-page-header`

`title` (required, rendered as `h1` in the title font) and `description`. Slots: `[breadcrumbs]` above the title and `[actions]` at the right.

## `ui-breadcrumbs`

`items: { label, link? }[]` and `label` (default `Breadcrumb`). Renders a `nav` with an ordered list; items with a `link` use `routerLink`, the last item is plain text with `aria-current="page"`.

## `ui-empty-state`

`title` (required), `message`, `icon` (default `list`). Slot `[empty-action]` for the call to action.

## Overlays

Dialog, drawer, popover, tooltip and toast. Dialog and drawer sit on the CDK Dialog (focus trap, Escape and backdrop close, scroll lock, focus restore). Popover and tooltip sit on the CDK Overlay. Import everything from `@ui/index`.

## Dialog

`DialogService.open(Component | TemplateRef, config)` returns the CDK `DialogRef`. The content uses `ui-dialog` for title, body and footer.

```ts
const ref = inject(DialogService).open(ShiftDialog, { size: 'sm', data: { id: 7 } });
ref.closed.subscribe((result) => ...);
```

```html
<!-- ShiftDialog template -->
<ui-dialog title="Swap shift">
  Body text.
  <ng-container uiDialogFooter>
    <button ui-button variant="secondary" (click)="ref.close()">Decline</button>
    <button ui-button (click)="ref.close(true)">Approve</button>
  </ng-container>
</ui-dialog>
```

| Config         | Default | Notes                                                |
| -------------- | ------- | ---------------------------------------------------- |
| `size`         | `md`    | `sm` 24rem, `md` 32rem, `lg` 44rem                   |
| `data`         |         | read with `inject(DIALOG_DATA)`                      |
| `ariaLabel`    |         | only when the content has no `ui-dialog` title       |
| `disableClose` | `false` | blocks Escape and backdrop (for example when saving) |

`ui-dialog` inputs: `title` (required), `closable` (default true), `closeLabel` (default "Close"). Output: `closeRequested`.

The CDK container provides `role="dialog"`, `aria-modal` and `aria-labelledby` (the title). Focus moves to the first tabbable element and returns to the opener on close.

### Confirm

```ts
const ok = await dialogs.confirm({
  title: 'Delete shift?',
  message: 'This cannot be undone.',
  confirmLabel: 'Delete',
  cancelLabel: 'Cancel', // optional
  danger: true,
});
```

Resolves `true` only for the confirm button. Escape, backdrop and Cancel resolve `false`. Focus starts on Cancel.

## Drawer

Same mechanics, full-height panel on the right. `DrawerService.open(content, { size, data, ariaLabel, disableClose })`; content uses `ui-drawer` (`title`, `closable`, `closeLabel`, footer slot `uiDrawerFooter`).

## Popover

Directive `uiPopoverTrigger` anchors a template to its host.

```html
<button ui-button [uiPopoverTrigger]="menu">Filters</button>
<ng-template #menu let-close="close">
  <div class="p-3">... <button ui-button (click)="close()">Done</button></div>
</ng-template>
```

| Input                 | Default        | Notes                                                       |
| --------------------- | -------------- | ----------------------------------------------------------- |
| `uiPopoverTrigger`    | required       | `TemplateRef`; context has `close()`                        |
| `uiPopoverPosition`   | `bottom-start` | `bottom-end`, `top-start`, `top-end`; flips when no room    |
| `uiPopoverMode`       | `click`        | `manual`: host is only the anchor, call `open/close/toggle` |
| `uiPopoverRole`       | `dialog`       | `listbox`, `menu` or `none` for the panel                   |
| `uiPopoverLabel`      |                | `aria-label` of the panel                                   |
| `uiPopoverAutofocus`  | `true`         | turn off when focus must stay in an input                   |
| `uiPopoverMatchWidth` | `false`        | panel at least as wide as the host                          |

Outputs `uiPopoverOpened`, `uiPopoverClosed`. Export as `#p="uiPopoverTrigger"` for `isOpen()`, `open(restoreFocusTo?)`, `close()`, `toggle()`. In click mode the host gets `aria-haspopup`, `aria-expanded`, `aria-controls`. Escape closes and returns focus to where it was; a click outside closes without moving focus.

## Tooltip

```html
<button ui-icon-button icon="download" label="Export" uiTooltip="Export roster as CSV"></button>
```

Inputs: `uiTooltip` (text), `uiTooltipPosition` (`top` | `bottom`, default `top`), `uiTooltipDelay` (hover delay in ms, default 300). Shows on hover after the delay and immediately on focus; hides on leave, blur, click or Escape. While visible the host has `aria-describedby` pointing at the `role="tooltip"` bubble. Supplementary text only: never the only place for essential information, and not for disabled controls (they receive no focus or hover).

## Toast

Put `<ui-toast-container />` once in the app shell, then:

```ts
const toasts = inject(ToastService);
const id = toasts.show({
  variant: 'success',
  title: 'Roster published',
  message: 'Week 46 is live.',
});
toasts.dismiss(id);
```

`show({ variant, title, message?, durationMs? })` returns the id. `durationMs` defaults to 5000; `0` keeps the toast until dismissed. `toasts()` is a readonly signal (oldest first); `clear()` removes all.

Each `ui-toast` is a live region: `role="alert"` for danger and warning, `role="status"` for info and success. The timer pauses while the pointer is over the toast or focus is inside it and resumes with the time left. The container is fixed bottom-right with the newest toast in front; older ones peek out behind it using the `--index` custom property and the stack hooks in `tokens.css` (`--stack-gap`, `--min-scale`). The container is a labelled region (`label` input, default "Notifications").

## Charts and navigation

All components are standalone and imported from `@ui/index`.

## `ui-bar-chart`

Hand-built SVG, no chart library. One series gives single bars, several give grouped bars, `stacked` stacks them (values must be non-negative).

| Input                   | Type                                                      | Default                |
| ----------------------- | --------------------------------------------------------- | ---------------------- |
| `series` (required)     | `{ name: string; color?: string; values: number[] }[]`    |                        |
| `categories` (required) | `string[]`                                                |                        |
| `label`                 | accessible name and table caption                         | `'Bar chart'`          |
| `format`                | `(value: number) => string` for axis, tooltip and table   | locale number          |
| `height`                | viewBox height (width is fixed at 640 and scales to 100%) | `280`                  |
| `stacked`               | boolean                                                   | `false`                |
| `showLegend`            | boolean                                                   | `true`                 |
| `emptyText`             | shown instead of the chart when there is no data          | `'No data to display'` |
| `categoryHeader`        | first column header of the hidden table                   | `'Category'`           |

```html
<ui-bar-chart
  label="Open shifts per weekday"
  [series]="series"
  [categories]="days"
  [format]="fmt"
/>
```

## `ui-line-chart`

Same inputs as the bar chart plus `area` (boolean, default `false`) to fill below each line. Points are focusable; series are separated by dash pattern as well as color.

```html
<ui-line-chart label="Headcount by site" [series]="headcount" [categories]="months" />
```

### Chart behavior shared by both

- Colors come from `dataTokens.chart` (`@tokens`): the CSS custom property is read at runtime, the JSON fallback is used when it is missing, and values are re-read when `ThemeService.resolved()` changes. Default series colors: brand, warning, then entity palette picks. A series `color` overrides.
- Gridlines use `chart.gridline`, axis text `chart.support`, the tooltip `chart.tooltip-background` / `chart.tooltip-foreground`.
- Tooltip opens on hover and on keyboard focus of a bar or point (Tab moves through marks).
- Not color alone: bars use solid / hatch / dots, lines use solid / dashed / dotted, and the legend repeats them.
- The `svg` has `role="img"` and an `aria-label`. A visually hidden table (`sr-only`) lists every category and formatted value.
- Marks carry `role="graphics-symbol"` with an `aria-label` like "Mon, Worked: 9 h".

## `ui-sidebar-nav`

Vertical `nav` landmark. Items are plain data; filter by role before passing them in.

```ts
interface NavItem {
  label: string;
  icon?: IconName; // needed for collapsed mode (children fall back to the group icon)
  link?: string; // router path; omit on a group
  badge?: string | number;
  children?: NavItem[]; // makes the row a collapsible group
  roles?: string[]; // for the caller's own filtering, not read by the component
  expanded?: boolean; // initial group state
  exact?: boolean; // exact route match for the active state
}
```

| Input              | Default                                                   |
| ------------------ | --------------------------------------------------------- |
| `items` (required) |                                                           |
| `collapsed`        | `false`, icon-only rows with a tooltip on hover and focus |
| `label`            | `'Main navigation'`                                       |

Active links get `aria-current="page"` through `routerLinkActive`. Groups are `button[aria-expanded]` (Enter and Space toggle). In collapsed mode labels stay available to screen readers (`sr-only`), badges are read after the label.

```html
<ui-sidebar-nav [items]="items" [collapsed]="collapsed()" />
```

## `ui-top-bar`

`header` with three slots, height from `component.layout.navbar-height` (50px).

```html
<ui-top-bar>
  <button slot="start" ui-icon-button ...></button>
  <app-search slot="center" />
  <div slot="end">...</div>
</ui-top-bar>
```
