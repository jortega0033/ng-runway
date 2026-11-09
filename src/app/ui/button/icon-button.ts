import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
} from '@angular/core';
import { IconComponent, type IconName } from '../icon/icon';
import { SpinnerComponent } from '../spinner/spinner';
import type { ButtonVariant } from './button';

const BASE =
  'inline-flex items-center justify-center rounded-md outline-offset-2 transition-colors ' +
  'focus-visible:outline-2 focus-visible:outline-border-brand disabled:cursor-not-allowed ' +
  'disabled:text-foreground-disabled';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-background-primary text-foreground-brand-inverted hover:bg-background-primary-hover disabled:bg-background-alt',
  secondary:
    'border border-border bg-background-surface-page text-foreground hover:bg-background-hover active:bg-background-press',
  ghost:
    'text-foreground-subtle hover:bg-background-hover hover:text-foreground active:bg-background-press',
  danger:
    'bg-background-danger text-foreground-danger-inverted hover:bg-background-danger-hover disabled:bg-background-alt',
};

/** Icon-only button. `label` is required because there is no visible text. */
@Component({
  selector: 'button[ui-icon-button]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'classes()',
    '[attr.aria-label]': 'label()',
    '[attr.disabled]': 'blocked() ? "" : null',
    '[attr.aria-busy]': 'loading() ? "true" : null',
  },
  imports: [IconComponent, SpinnerComponent],
  template: `
    @if (loading()) {
      <ui-spinner size="xs" color="current" label="Loading" />
    } @else {
      <ui-icon [name]="icon()" [size]="size() === 'sm' ? 16 : 20" />
    }
  `,
})
export class IconButtonComponent {
  readonly icon = input.required<IconName>();
  readonly label = input.required<string>();
  readonly variant = input<ButtonVariant>('ghost');
  readonly size = input<'sm' | 'md'>('md');
  readonly loading = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });

  protected readonly blocked = computed(() => this.disabled() || this.loading());
  protected readonly classes = computed(
    () => `${BASE} ${VARIANTS[this.variant()]} ${this.size() === 'sm' ? 'size-8' : 'size-9'}`,
  );
}
