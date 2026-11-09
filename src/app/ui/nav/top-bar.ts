import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Application header with three slots: `slot="start"` (brand, menu button), `slot="center"`
 * (search, page title) and `slot="end"` (actions). Height is the `component.layout.navbar-height` token (50px).
 *
 * ```html
 * <ui-top-bar>
 *   <button slot="start" ui-icon-button ...></button>
 *   <app-search slot="center" />
 *   <div slot="end">...</div>
 * </ui-top-bar>
 * ```
 */
@Component({
  selector: 'ui-top-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <header
      class="flex items-center gap-3 border-b border-border-subtle bg-background-surface-page px-4"
      style="height: var(--component-layout-navbar-height, 50px)"
    >
      <div class="flex shrink-0 items-center gap-2"><ng-content select="[slot=start]" /></div>
      <div class="flex min-w-0 flex-1 items-center justify-center">
        <ng-content select="[slot=center]" />
      </div>
      <div class="flex shrink-0 items-center gap-2"><ng-content select="[slot=end]" /></div>
    </header>
  `,
})
export class TopBarComponent {}
