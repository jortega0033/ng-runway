import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Loading placeholder block. Size it from outside with width and height utilities. */
@Component({
  selector: 'ui-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block animate-pulse rounded-md bg-background-alt-contrast motion-reduce:animate-none',
    'aria-hidden': 'true',
  },
  template: '',
})
export class SkeletonComponent {}
