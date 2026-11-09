import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type CardPadding = 'padded' | 'flush';

/**
 * Surface with a border and the lightest shadow.
 * Slots: `[card-header]`, default content (body) and `[card-footer]`.
 * Use `padding="flush"` when the body is a table or list that should touch the edges.
 */
@Component({
  selector: 'ui-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'block overflow-hidden rounded-lg border border-border-subtle bg-background-surface-page text-foreground shadow-xs ' +
      '[&>[card-header]]:border-b [&>[card-header]]:border-border-subtle [&>[card-header]]:px-4 [&>[card-header]]:py-3 ' +
      '[&>[card-footer]]:border-t [&>[card-footer]]:border-border-subtle [&>[card-footer]]:px-4 [&>[card-footer]]:py-3',
  },
  template: `
    <ng-content select="[card-header]" />
    <div [class]="padding() === 'padded' ? 'p-4' : ''"><ng-content /></div>
    <ng-content select="[card-footer]" />
  `,
})
export class CardComponent {
  readonly padding = input<CardPadding>('padded');
}
