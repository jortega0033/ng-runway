# Data display

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
