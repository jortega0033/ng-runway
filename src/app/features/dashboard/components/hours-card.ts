import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Employee, Shift } from '@core/api/models';
import { AuthService } from '@core/auth/auth.service';
import { formatDuration, weeklyScheduledMinutes } from '@core/domain/hours';
import { addDays, startOfWeek, todayIso } from '@core/domain/time';
import { weekProgress } from '../dashboard.logic';
import { apiResource } from '../dashboard.resources';
import { DashboardCardComponent } from './dashboard-card';

/** Planned hours this week against the contract hours, as a progress bar. */
@Component({
  selector: 'app-hours-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DashboardCardComponent, TranslocoPipe],
  template: `
    <app-dashboard-card
      [title]="'dashboard.hours.title' | transloco"
      [loading]="employee.isLoading() || shifts.isLoading()"
      [failed]="!!(employee.error() || shifts.error())"
      linkTo="/timesheets"
      [linkLabel]="'dashboard.hours.seeAll' | transloco"
      (retry)="reload()"
    >
      <div class="flex flex-col gap-3">
        <p class="text-base">
          <span class="font-title text-3xl font-semibold">{{ scheduledLabel() }}</span>
          <span class="ml-1 text-foreground-subtle">
            {{ 'dashboard.hours.ofContract' | transloco: { hours: contractHours() } }}
          </span>
        </p>
        <div
          role="progressbar"
          class="h-2 w-full overflow-hidden rounded-full bg-background-alt"
          aria-valuemin="0"
          aria-valuemax="100"
          [attr.aria-valuenow]="progress().percent"
          [attr.aria-label]="'dashboard.hours.progressLabel' | transloco"
        >
          <div
            class="h-full rounded-full"
            [class]="progress().over ? 'bg-background-warning' : 'bg-background-primary'"
            [style.width.%]="progress().percent"
          ></div>
        </div>
        <p class="text-sm text-foreground-subtle">
          @if (progress().over) {
            {{ 'dashboard.hours.over' | transloco }}
          } @else {
            {{ 'dashboard.hours.remaining' | transloco: { time: remainingLabel() } }}
          }
        </p>
      </div>
    </app-dashboard-card>
  `,
})
export class HoursCardComponent {
  private readonly user = inject(AuthService).user;
  private readonly weekStart = startOfWeek(todayIso());

  protected readonly employee = apiResource<Employee | null>(() => {
    const user = this.user();
    return user ? { path: `/employees/${user.id}` } : undefined;
  }, null);

  protected readonly shifts = apiResource<Shift[]>(() => {
    const user = this.user();
    return user
      ? {
          path: '/shifts',
          params: {
            employeeId: user.id,
            from: this.weekStart,
            to: addDays(this.weekStart, 6),
          },
        }
      : undefined;
  }, []);

  protected readonly contractHours = computed(
    () => this.employee.value()?.contract.hoursPerWeek ?? 0,
  );

  private readonly scheduledMinutes = computed(() => {
    const user = this.user();
    if (!user) return 0;
    // Drafts are not final yet, so they do not count towards the planned hours.
    const published = this.shifts.value().filter((s) => s.status === 'published');
    return weeklyScheduledMinutes(published, user.id, this.weekStart);
  });

  protected readonly progress = computed(() =>
    weekProgress(this.scheduledMinutes(), this.contractHours()),
  );
  protected readonly scheduledLabel = computed(() => formatDuration(this.scheduledMinutes()));
  protected readonly remainingLabel = computed(() =>
    formatDuration(Math.max(0, this.progress().contractMinutes - this.scheduledMinutes())),
  );

  protected reload(): void {
    this.employee.reload();
    this.shifts.reload();
  }
}
