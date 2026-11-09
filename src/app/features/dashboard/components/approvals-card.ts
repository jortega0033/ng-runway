import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import type { AbsenceRequest, ClockEntry, Employee, Page } from '@core/api/models';
import { AuthService } from '@core/auth/auth.service';
import { LanguageService } from '@core/i18n/i18n';
import { EmptyStateComponent, LinkComponent } from '@ui/index';
import { apiResource } from '../dashboard.resources';
import { formatDay, formatPeriod } from '../format';
import { DashboardCardComponent } from './dashboard-card';

const EMPTY_PAGE: Page<Employee> = { items: [], total: 0, page: 1, pageSize: 100 };
const LIST_LIMIT = 3;

/**
 * For managers and admins: how many absence requests and submitted time entries wait for a
 * decision in their scope (their team for a manager, everyone for an admin).
 */
@Component({
  selector: 'app-approvals-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DashboardCardComponent, EmptyStateComponent, LinkComponent, RouterLink, TranslocoPipe],
  template: `
    <app-dashboard-card
      [title]="'dashboard.approvals.title' | transloco"
      [loading]="loading()"
      [failed]="failed()"
      (retry)="reload()"
    >
      @if (total() === 0) {
        <ui-empty-state
          icon="check-circle"
          [title]="'dashboard.approvals.emptyTitle' | transloco"
          [message]="'dashboard.approvals.emptyText' | transloco"
        />
      } @else {
        <div class="flex flex-col gap-4">
          <p class="text-base">
            <span class="font-title text-3xl font-semibold">{{ total() }}</span>
            <span class="ml-1 text-foreground-subtle">
              {{ 'dashboard.approvals.waiting' | transloco }}
            </span>
          </p>

          @if (absenceCount() > 0) {
            <section>
              <div class="mb-1 flex items-baseline justify-between gap-3">
                <h3 class="text-base font-medium">
                  {{ 'dashboard.approvals.absences' | transloco: { count: absenceCount() } }}
                </h3>
                <a ui-link class="text-base" routerLink="/absences">
                  {{ 'dashboard.approvals.reviewAbsences' | transloco }}
                </a>
              </div>
              <ul class="m-0 flex list-none flex-col p-0">
                @for (item of absenceItems(); track item.id) {
                  <li class="flex flex-wrap justify-between gap-x-3 py-1 text-base">
                    <span class="font-medium">{{ item.name }}</span>
                    <span class="text-foreground-subtle">{{ item.detail }}</span>
                  </li>
                }
              </ul>
            </section>
          }

          @if (entryCount() > 0) {
            <section>
              <div class="mb-1 flex items-baseline justify-between gap-3">
                <h3 class="text-base font-medium">
                  {{ 'dashboard.approvals.entries' | transloco: { count: entryCount() } }}
                </h3>
                <a ui-link class="text-base" routerLink="/timesheets">
                  {{ 'dashboard.approvals.reviewEntries' | transloco }}
                </a>
              </div>
              <ul class="m-0 flex list-none flex-col p-0">
                @for (item of entryItems(); track item.id) {
                  <li class="flex flex-wrap justify-between gap-x-3 py-1 text-base">
                    <span class="font-medium">{{ item.name }}</span>
                    <span class="text-foreground-subtle">{{ item.detail }}</span>
                  </li>
                }
              </ul>
            </section>
          }
        </div>
      }
    </app-dashboard-card>
  `,
})
export class ApprovalsCardComponent {
  private readonly user = inject(AuthService).user;
  private readonly language = inject(LanguageService).language;

  /** A manager approves for their own team; an admin for everyone. */
  private readonly scope = computed(() => {
    const user = this.user();
    return user?.role === 'manager' ? user.teamId : undefined;
  });

  protected readonly absences = apiResource<AbsenceRequest[]>(() => {
    return this.user()
      ? { path: '/absences', params: { status: 'pending', teamId: this.scope() } }
      : undefined;
  }, []);
  protected readonly entries = apiResource<ClockEntry[]>(() => {
    return this.user()
      ? { path: '/clock-entries', params: { status: 'submitted', teamId: this.scope() } }
      : undefined;
  }, []);
  protected readonly employees = apiResource<Page<Employee>>(() => {
    return this.user()
      ? { path: '/employees', params: { teamId: this.scope(), pageSize: 100 } }
      : undefined;
  }, EMPTY_PAGE);

  protected readonly loading = computed(
    () => this.absences.isLoading() || this.entries.isLoading() || this.employees.isLoading(),
  );
  protected readonly failed = computed(
    () => !!(this.absences.error() || this.entries.error() || this.employees.error()),
  );

  protected readonly absenceCount = computed(() => this.absences.value().length);
  protected readonly entryCount = computed(() => this.entries.value().length);
  protected readonly total = computed(() => this.absenceCount() + this.entryCount());

  protected readonly absenceItems = computed(() =>
    [...this.absences.value()]
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .slice(0, LIST_LIMIT)
      .map((request) => ({
        id: request.id,
        name: this.nameOf(request.employeeId),
        detail: formatPeriod(request.startDate, request.endDate, this.language()),
      })),
  );
  protected readonly entryItems = computed(() =>
    [...this.entries.value()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, LIST_LIMIT)
      .map((entry) => ({
        id: entry.id,
        name: this.nameOf(entry.employeeId),
        detail: formatDay(entry.date, this.language()),
      })),
  );

  protected reload(): void {
    this.absences.reload();
    this.entries.reload();
    this.employees.reload();
  }

  private nameOf(employeeId: string): string {
    const employee = this.employees.value().items.find((e) => e.id === employeeId);
    return employee ? `${employee.firstName} ${employee.lastName}` : employeeId;
  }
}
