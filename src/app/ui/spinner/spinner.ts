import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type SpinnerColor = 'current' | 'grey' | 'inherit' | 'primary' | 'white';

/**
 * Size and color come from the component tokens in tokens.css, which target
 * `ui-spinner[size=...]` and `ui-spinner[color=...]`, so both are reflected as attributes.
 */
@Component({
  selector: 'ui-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-flex',
    role: 'status',
    '[attr.size]': 'size()',
    '[attr.color]': 'color()',
    '[attr.aria-label]': 'label()',
  },
  template: `
    <svg
      class="animate-spin motion-reduce:animate-none"
      style="width: var(--spinner-size); height: var(--spinner-size); color: var(--spinner-color)"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" opacity="0.25" />
      <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
    </svg>
  `,
})
export class SpinnerComponent {
  readonly size = input<SpinnerSize>('md');
  readonly color = input<SpinnerColor>('grey');
  /** Announced by screen readers. */
  readonly label = input('Loading');
}
