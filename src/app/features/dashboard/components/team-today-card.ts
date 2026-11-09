import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Employee, Page, Shift } from '@core/api/models';
import { AuthService } from '@core/auth/auth.service';
import { todayIso } from '@core/domain/time';
import { AvatarComponent, EmptyStateComponent } from '@ui/index';
import { teamOnShift, timeRange } from '../dashboard.logic';
import { apiResource } from '../dashboard.resources';
import { DashboardCardComponent } from './dashboard-card';

const EMPTY_PAGE: Page<Employee> = { items: [], total: 0, page: 1, pageSize: 100 };

/** Colleagues in the user's team who have a published shift today. */
@Component({
  selector: 'app-team-today-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, DashboardCardComponent, EmptyStateComponent, TranslocoPipe],
  template: `
    <app-dashboard-card
      [title]="'dashboard.team.title' | transloco"
      [loading]="employees.isLoading() || shifts.isLoading()"
      [failed]="!!(employees.error() || shifts.error())"
      linkTo="/schedule"
      [linkLabel]="'dashboard.team.seeAll' | transloco"
      (retry)="reload()"
    >
      @if (members().length === 0) {
        <ui-empty-state
          icon="users"
          [title]="'dashboard.team.emptyTitle' | transloco"
          [message]="'dashboard.team.emptyText' | transloco"
        />
      } @else {
        <ul class="m-0 flex list-none flex-col divide-y divide-border-subtle p-0">
          @for (member of members(); track member.id) {
            <li class="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
              <ui-avatar [name]="member.name" size="md" />
              <span class="min-w-0 flex-1 truncate text-base font-medium">{{ member.name }}</span>
              <span class="text-base text-foreground-subtle">{{ member.time }}</span>
            </li>
          }
        </ul>
      }
    </app-dashboard-card>
  `,
})
export class TeamTodayCardComponent {
  private readonly user = inject(AuthService).user;
  private readonly today = todayIso();

  protected readonly employees = apiResource<Page<Employee>>(() => {
    const user = this.user();
    return user
      ? { path: '/employees', params: { teamId: user.teamId, active: true, pageSize: 100 } }
      : undefined;
  }, EMPTY_PAGE);

  protected readonly shifts = apiResource<Shift[]>(() => {
    const user = this.user();
    return user
      ? { path: '/shifts', params: { teamId: user.teamId, from: this.today, to: this.today } }
      : undefined;
  }, []);

  protected readonly members = computed(() =>
    teamOnShift(this.employees.value().items, this.shifts.value()).map(({ employee, shifts }) => ({
      id: employee.id,
      name: `${employee.firstName} ${employee.lastName}`,
      time: shifts.map(timeRange).join(', '),
    })),
  );

  protected reload(): void {
    this.employees.reload();
    this.shifts.reload();
  }
}
