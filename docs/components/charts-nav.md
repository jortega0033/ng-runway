# Charts and navigation

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
