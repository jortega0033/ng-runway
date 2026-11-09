import { ChangeDetectionStrategy, Component, booleanAttribute, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon';

/** Removable chip for filters and multi-select values. `color` is a data token (team or entity color). */
@Component({
  selector: 'ui-tag',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: {
    class:
      'inline-flex items-center gap-1 rounded-sm border border-border bg-background-surface-page px-2 py-0.5 text-sm text-foreground',
  },
  template: `
    @if (color()) {
      <span
        class="size-2 rounded-full"
        [style.background-color]="color()"
        aria-hidden="true"
      ></span>
    }
    <ng-content />
    @if (removable()) {
      <button
        type="button"
        class="-mr-1 inline-flex size-4 items-center justify-center rounded-xs text-foreground-subtle outline-offset-2 hover:bg-background-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-border-brand"
        [attr.aria-label]="removeLabel()"
        (click)="removed.emit()"
      >
        <ui-icon name="x" [size]="16" />
      </button>
    }
  `,
})
export class TagComponent {
  readonly color = input<string | null>(null);
  readonly removable = input(false, { transform: booleanAttribute });
  readonly removeLabel = input('Remove');
  readonly removed = output();
}
