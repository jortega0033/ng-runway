# Overlays

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
