import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
  output,
} from '@angular/core';
import { IconComponent, type IconName } from '../icon/icon';

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

const STYLES: Record<AlertVariant, { box: string; icon: IconName }> = {
  info: {
    box: 'border-border-info-subtle bg-background-info-subtle text-foreground-brand-strong',
    icon: 'info',
  },
  success: {
    box: 'border-border-success-subtle bg-background-success-subtle text-foreground-success-strong',
    icon: 'check-circle',
  },
  warning: {
    box: 'border-border-warning-subtle bg-background-warning-subtle text-foreground-warning-strong',
    icon: 'alert-triangle',
  },
  danger: {
    box: 'border-border-danger-subtle bg-background-danger-subtle text-foreground-danger-strong',
    icon: 'alert-circle',
  },
};

/** Inline message. Danger and warning interrupt (role alert); info and success are polite (role status). */
@Component({
  selector: 'ui-alert',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: {
    '[class]': 'classes()',
    '[attr.role]': 'variant() === "danger" || variant() === "warning" ? "alert" : "status"',
  },
  template: `
    <ui-icon [name]="icon()" />
    <div class="min-w-0 flex-1">
      @if (heading()) {
        <p class="font-medium">{{ heading() }}</p>
      }
      <div class="text-base"><ng-content /></div>
    </div>
    @if (dismissible()) {
      <button
        type="button"
        class="inline-flex size-6 items-center justify-center rounded-xs outline-offset-2 hover:bg-background-hover focus-visible:outline-2 focus-visible:outline-border-brand"
        [attr.aria-label]="dismissLabel()"
        (click)="dismissed.emit()"
      >
        <ui-icon name="x" [size]="16" />
      </button>
    }
  `,
})
export class AlertComponent {
  readonly variant = input<AlertVariant>('info');
  readonly heading = input('');
  readonly dismissible = input(false, { transform: booleanAttribute });
  readonly dismissLabel = input('Dismiss');
  readonly dismissed = output();

  protected readonly icon = computed(() => STYLES[this.variant()].icon);
  protected readonly classes = computed(
    () => `flex items-start gap-3 rounded-md border p-3 ${STYLES[this.variant()].box}`,
  );
}
