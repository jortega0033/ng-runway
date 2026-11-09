import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
} from '@angular/core';
import { SpinnerComponent } from '../spinner/spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium select-none ' +
  'transition-colors outline-offset-2 focus-visible:outline-2 focus-visible:outline-border-brand ' +
  'disabled:cursor-not-allowed';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-background-primary text-foreground-brand-inverted hover:bg-background-primary-hover ' +
    'active:bg-background-primary-hover disabled:bg-background-alt disabled:text-foreground-disabled',
  secondary:
    'border border-border bg-background-surface-page text-foreground hover:bg-background-hover ' +
    'active:bg-background-press disabled:text-foreground-disabled',
  ghost:
    'text-foreground hover:bg-background-hover active:bg-background-press ' +
    'disabled:text-foreground-disabled',
  danger:
    'bg-background-danger text-foreground-danger-inverted hover:bg-background-danger-hover ' +
    'active:bg-background-danger-hover disabled:bg-background-alt disabled:text-foreground-disabled',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-9 px-4 text-base',
  lg: 'h-10 px-5 text-lg',
};

/** Use on a native element: `<button ui-button variant="primary">Save</button>`. */
@Component({
  selector: 'button[ui-button]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'classes()',
    '[attr.disabled]': 'blocked() ? "" : null',
    '[attr.aria-busy]': 'loading() ? "true" : null',
  },
  imports: [SpinnerComponent],
  template: `
    @if (loading()) {
      <ui-spinner size="xs" color="current" label="Loading" />
    }
    <ng-content />
  `,
})
export class ButtonComponent {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  /** Shows a spinner and blocks clicks while true. */
  readonly loading = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });

  protected readonly blocked = computed(() => this.disabled() || this.loading());
  protected readonly classes = computed(
    () => `${BASE} ${VARIANTS[this.variant()]} ${SIZES[this.size()]}`,
  );
}
