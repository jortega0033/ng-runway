import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Use on an anchor or a `routerLink` anchor: `<a ui-link routerLink="/x">Text</a>`. */
@Component({
  selector: 'a[ui-link]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'text-foreground-brand underline-offset-2 hover:text-foreground-brand-hover hover:underline ' +
      'outline-offset-2 focus-visible:outline-2 focus-visible:outline-border-brand rounded-xs ' +
      'aria-[current=page]:font-medium',
  },
  template: '<ng-content />',
})
export class LinkComponent {}
