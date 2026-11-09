import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type BadgeVariant = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';

const VARIANTS: Record<BadgeVariant, string> = {
  neutral: 'bg-background-alt text-foreground-subtle',
  brand: 'bg-background-brand-subtle text-foreground-brand-strong',
  success: 'bg-background-success-subtle text-foreground-success-strong',
  warning: 'bg-background-warning-subtle text-foreground-warning-strong',
  danger: 'bg-background-danger-subtle text-foreground-danger-strong',
};

/** Small status label. Use sparingly: one badge per row at most. */
@Component({
  selector: 'ui-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()' },
  template: '<ng-content />',
})
export class BadgeComponent {
  readonly variant = input<BadgeVariant>('neutral');
  protected readonly classes = computed(
    () =>
      `inline-flex items-center rounded-sm px-2 py-0.5 text-sm font-medium ${VARIANTS[this.variant()]}`,
  );
}
