import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent, type IconName } from '../icon/icon';

/** Placeholder for "nothing here yet". Slot `[empty-action]` takes the call to action. */
@Component({
  selector: 'ui-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: { class: 'flex flex-col items-center gap-2 px-6 py-10 text-center' },
  template: `
    <span
      class="mb-1 inline-flex size-10 items-center justify-center rounded-full bg-background-alt text-foreground-subtle"
    >
      <ui-icon [name]="icon()" [size]="24" />
    </span>
    <p class="font-title text-lg font-semibold text-foreground">{{ title() }}</p>
    @if (message()) {
      <p class="max-w-md text-base text-foreground-subtle">{{ message() }}</p>
    }
    <div class="mt-2 empty:hidden"><ng-content select="[empty-action]" /></div>
  `,
})
export class EmptyStateComponent {
  readonly icon = input<IconName>('list');
  readonly title = input.required<string>();
  readonly message = input('');
}
