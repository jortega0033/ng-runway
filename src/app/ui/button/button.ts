import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  ElementRef,
  computed,
  inject,
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
    '[attr.disabled]': 'disabled() ? "" : null',
    '[attr.aria-disabled]': 'loading() && !disabled() ? "true" : null',
    '[attr.aria-busy]': 'loading() ? "true" : null',
  },
  imports: [SpinnerComponent],
  template: `
    @if (loading()) {
      <span aria-hidden="true" class="inline-flex"><ui-spinner size="xs" color="current" /></span>
    }
    <ng-content />
  `,
})
export class ButtonComponent {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  /**
   * Shows a spinner and suppresses clicks while true. The button stays focusable
   * (aria-disabled instead of the disabled attribute) so keyboard focus is not lost.
   */
  readonly loading = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });

  constructor() {
    // Capture phase on the host runs before the consumer's (click) listener, so a click made
    // while loading never reaches it. (The button is not `disabled`, to keep keyboard focus.)
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement.addEventListener(
      'click',
      (event) => {
        if (!this.loading()) return;
        event.preventDefault();
        event.stopImmediatePropagation();
      },
      { capture: true },
    );
  }

  protected readonly classes = computed(
    () => `${BASE} ${VARIANTS[this.variant()]} ${SIZES[this.size()]}`,
  );
}
