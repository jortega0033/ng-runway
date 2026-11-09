# Basics

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
