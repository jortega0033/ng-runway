import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  AlertComponent,
  ButtonComponent,
  CardComponent,
  LinkComponent,
  SkeletonComponent,
} from '@ui/index';

/**
 * Shared frame of the dashboard cards: title, optional "see all" link, and the loading and
 * error states, so every card handles them the same way. The card content goes in the body.
 */
@Component({
  selector: 'app-dashboard-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonComponent,
    CardComponent,
    LinkComponent,
    RouterLink,
    SkeletonComponent,
    TranslocoPipe,
  ],
  host: { class: 'block' },
  template: `
    <ui-card class="h-full">
      <div card-header class="flex items-center justify-between gap-3">
        <h2 class="font-title text-lg font-semibold">{{ title() }}</h2>
        @if (linkTo()) {
          <a ui-link class="text-base" [routerLink]="linkTo()">{{ linkLabel() }}</a>
        }
      </div>
      @if (failed()) {
        <ui-alert variant="danger" [heading]="'common.errorTitle' | transloco">
          {{ 'common.errorText' | transloco }}
          <div class="mt-2">
            <button ui-button size="sm" variant="secondary" type="button" (click)="retry.emit()">
              {{ 'common.retry' | transloco }}
            </button>
          </div>
        </ui-alert>
      } @else if (loading()) {
        <div class="flex flex-col gap-3" aria-busy="true">
          <ui-skeleton class="h-5 w-2/3" />
          <ui-skeleton class="h-5 w-full" />
          <ui-skeleton class="h-5 w-1/2" />
        </div>
      } @else {
        <ng-content />
      }
    </ui-card>
  `,
})
export class DashboardCardComponent {
  readonly title = input.required<string>();
  readonly loading = input(false);
  readonly failed = input(false);
  /** Router link for the "see all" link in the header. */
  readonly linkTo = input<string | null>(null);
  readonly linkLabel = input('');
  readonly retry = output();
}
