import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Page title block. Slots: `[breadcrumbs]` above the title and `[actions]` on the right. */
@Component({
  selector: 'ui-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-2' },
  template: `
    <ng-content select="[breadcrumbs]" />
    <div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div class="min-w-0">
        <h1 class="font-title text-4xl font-semibold text-foreground">{{ title() }}</h1>
        @if (description()) {
          <p class="mt-1 text-base text-foreground-subtle">{{ description() }}</p>
        }
      </div>
      <div class="flex shrink-0 items-center gap-2 empty:hidden">
        <ng-content select="[actions]" />
      </div>
    </div>
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly description = input('');
}
