import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { AbsenceRequest, AbsenceType } from '@core/api/models';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/i18n';
import { BadgeComponent, EmptyStateComponent } from '@ui/index';
import { apiResource } from '../dashboard.resources';
import { formatPeriod } from '../format';
import { DashboardCardComponent } from './dashboard-card';

/** The signed-in user's own absence requests that still wait for an answer. */
@Component({
  selector: 'app-pending-requests-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, DashboardCardComponent, EmptyStateComponent, TranslocoPipe],
  template: `
    <app-dashboard-card
      [title]="'dashboard.pending.title' | transloco"
      [loading]="requests.isLoading() || types.isLoading()"
      [failed]="!!(requests.error() || types.error())"
      linkTo="/absences"
      [linkLabel]="'dashboard.pending.seeAll' | transloco"
      (retry)="reload()"
    >
      @if (items().length === 0) {
        <ui-empty-state
          icon="check-circle"
          [title]="'dashboard.pending.emptyTitle' | transloco"
          [message]="'dashboard.pending.emptyText' | transloco"
        />
      } @else {
        <ul class="m-0 flex list-none flex-col divide-y divide-border-subtle p-0">
          @for (item of items(); track item.id) {
            <li
              class="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
            >
              <div class="min-w-0">
                <p class="text-base font-medium">{{ item.type }}</p>
                <p class="text-sm text-foreground-subtle">{{ item.period }}</p>
              </div>
              <ui-badge variant="warning">{{ 'dashboard.pending.badge' | transloco }}</ui-badge>
            </li>
          }
        </ul>
      }
    </app-dashboard-card>
  `,
})
export class PendingRequestsCardComponent {
  private readonly user = inject(AuthService).user;
  private readonly language = inject(LanguageService).language;

  protected readonly requests = apiResource<AbsenceRequest[]>(() => {
    const user = this.user();
    return user
      ? { path: '/absences', params: { employeeId: user.id, status: 'pending' } }
      : undefined;
  }, []);
  protected readonly types = apiResource<AbsenceType[]>(() => ({ path: '/absence-types' }), []);

  protected readonly items = computed(() =>
    [...this.requests.value()]
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .map((request) => ({
        id: request.id,
        type: this.types.value().find((t) => t.key === request.type)?.name ?? request.type,
        period: formatPeriod(request.startDate, request.endDate, this.language()),
      })),
  );

  protected reload(): void {
    this.requests.reload();
    this.types.reload();
  }
}
