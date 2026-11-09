import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Location, Shift, Team } from '@core/api/models';
import { AuthService } from '@core/auth/auth.service';
import { addDays, todayIso } from '@core/domain/time';
import { LanguageService } from '@core/i18n/i18n';
import { EmptyStateComponent } from '@ui/index';
import { dayRelation, timeRange, upcomingShifts } from '../dashboard.logic';
import { apiResource } from '../dashboard.resources';
import { formatDay } from '../format';
import { injectTranslate } from '../translate';
import { DashboardCardComponent } from './dashboard-card';

/** The signed-in user's next five published shifts. */
@Component({
  selector: 'app-next-shifts-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DashboardCardComponent, EmptyStateComponent, TranslocoPipe],
  template: `
    <app-dashboard-card
      [title]="'dashboard.nextShifts.title' | transloco"
      [loading]="loading()"
      [failed]="failed()"
      linkTo="/schedule"
      [linkLabel]="'dashboard.nextShifts.seeAll' | transloco"
      (retry)="reload()"
    >
      @if (items().length === 0) {
        <ui-empty-state
          icon="calendar"
          [title]="'dashboard.nextShifts.emptyTitle' | transloco"
          [message]="'dashboard.nextShifts.emptyText' | transloco"
        />
      } @else {
        <ul class="m-0 flex list-none flex-col divide-y divide-border-subtle p-0">
          @for (item of items(); track item.id) {
            <li class="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 py-2.5 first:pt-0 last:pb-0">
              <span class="w-28 shrink-0 text-base font-medium">{{ item.day }}</span>
              <span class="text-base">{{ item.time }}</span>
              <span class="min-w-0 text-base text-foreground-subtle">{{ item.where }}</span>
            </li>
          }
        </ul>
      }
    </app-dashboard-card>
  `,
})
export class NextShiftsCardComponent {
  private readonly user = inject(AuthService).user;
  private readonly language = inject(LanguageService).language;
  private readonly t = injectTranslate();

  protected readonly shifts = apiResource<Shift[]>(() => {
    const user = this.user();
    if (!user) return undefined;
    // Two months ahead is plenty to find five upcoming shifts.
    const today = todayIso();
    return {
      path: '/shifts',
      params: { employeeId: user.id, from: today, to: addDays(today, 60) },
    };
  }, []);
  protected readonly teams = apiResource<Team[]>(() => ({ path: '/teams' }), []);
  protected readonly locations = apiResource<Location[]>(() => ({ path: '/locations' }), []);

  protected readonly loading = computed(
    () => this.shifts.isLoading() || this.teams.isLoading() || this.locations.isLoading(),
  );
  protected readonly failed = computed(
    () => !!(this.shifts.error() || this.teams.error() || this.locations.error()),
  );

  protected readonly items = computed(() => {
    const user = this.user();
    if (!user) return [];
    const now = new Date();
    return upcomingShifts(this.shifts.value(), user.id, now).map((shift) => {
      const relation = dayRelation(shift.date, now);
      return {
        id: shift.id,
        day:
          relation === 'later'
            ? formatDay(shift.date, this.language())
            : this.t(`dashboard.${relation}`),
        time: timeRange(shift),
        where: [
          this.teams.value().find((t) => t.id === shift.teamId)?.name,
          this.locations.value().find((l) => l.id === shift.locationId)?.name,
        ]
          .filter(Boolean)
          .join(', '),
      };
    });
  });

  protected reload(): void {
    this.shifts.reload();
    this.teams.reload();
    this.locations.reload();
  }
}
