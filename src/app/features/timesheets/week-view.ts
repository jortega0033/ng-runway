import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TranslocoPipe } from '@jsverse/transloco';
import { forkJoin } from 'rxjs';
import { ClockApi } from '@core/api/clock.api';
import { EmployeesApi } from '@core/api/employees.api';
import type { ClockEntry, TimesheetStatus } from '@core/api/models';
import { ShiftsApi } from '@core/api/shifts.api';
import { AuthService } from '@core/auth/auth.service';
import { formatDuration } from '@core/domain/hours';
import { addDays, startOfWeek, todayIso } from '@core/domain/time';
import { LanguageService } from '@core/i18n/i18n';
import {
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
  IconButtonComponent,
  SkeletonComponent,
  type BadgeVariant,
} from '@ui/index';
import { formatDate, formatTime, formatWeekRange } from './timesheet-format';
import {
  breakMinutes,
  buildWeek,
  formatSignedDuration,
  shiftWeek,
  STATUS_VARIANT,
  type DayRow,
} from './timesheet-math';

/** One week of the signed-in employee: scheduled shifts against clocked hours, day by day. */
@Component({
  selector: 'app-week-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    IconButtonComponent,
    SkeletonComponent,
    TranslocoPipe,
  ],
  template: `
    <div class="mb-4 flex flex-wrap items-center gap-2">
      <button
        ui-icon-button
        type="button"
        icon="chevron-left"
        [label]="'timesheets.week.previous' | transloco"
        (click)="move(-1)"
      ></button>
      <button
        ui-icon-button
        type="button"
        icon="chevron-right"
        [label]="'timesheets.week.next' | transloco"
        (click)="move(1)"
      ></button>

      <button ui-button type="button" variant="secondary" size="sm" (click)="goToToday()">
        {{ 'timesheets.week.thisWeek' | transloco }}
      </button>
      <h2 class="font-title text-lg font-semibold" aria-live="polite">{{ rangeLabel() }}</h2>
    </div>

    @if (data.isLoading()) {
      <div
        class="flex flex-col gap-3"
        role="status"
        [attr.aria-label]="'common.loading' | transloco"
      >
        <ui-skeleton class="h-20 w-full" />
        <ui-skeleton class="h-64 w-full" />
      </div>
    } @else if (data.error()) {
      <ui-card>
        <ui-empty-state
          icon="alert-circle"
          [title]="'common.errorTitle' | transloco"
          [message]="'common.errorText' | transloco"
        >
          <button empty-action ui-button type="button" (click)="data.reload()">
            {{ 'common.retry' | transloco }}
          </button>
        </ui-empty-state>
      </ui-card>
    } @else {
      <dl class="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div class="rounded-lg border border-border-subtle bg-background-surface-page p-4">
          <dt class="text-sm text-foreground-subtle">
            {{ 'timesheets.week.scheduled' | transloco }}
          </dt>
          <dd class="font-title text-2xl font-semibold tabular-nums">
            {{ duration(summary().scheduledMinutes) }}
          </dd>
        </div>
        <div class="rounded-lg border border-border-subtle bg-background-surface-page p-4">
          <dt class="text-sm text-foreground-subtle">{{ 'timesheets.week.worked' | transloco }}</dt>
          <dd class="font-title text-2xl font-semibold tabular-nums">
            {{ duration(summary().workedMinutes) }}
          </dd>
        </div>
        <div class="rounded-lg border border-border-subtle bg-background-surface-page p-4">
          <dt class="text-sm text-foreground-subtle">
            {{ 'timesheets.week.difference' | transloco }}
          </dt>
          <dd class="font-title text-2xl font-semibold tabular-nums">
            {{ signed(summary().differenceMinutes) }}
          </dd>
          <dd class="text-sm text-foreground-subtle">
            {{ 'timesheets.week.differenceHint' | transloco }}
          </dd>
        </div>
        <div class="rounded-lg border border-border-subtle bg-background-surface-page p-4">
          <dt class="text-sm text-foreground-subtle">
            {{ 'timesheets.week.contract' | transloco }}
          </dt>
          <dd class="font-title text-2xl font-semibold tabular-nums">
            {{ duration(summary().contractMinutes) }}
          </dd>
          <dd class="text-sm text-foreground-subtle">
            {{
              'timesheets.week.contractDifference'
                | transloco: { value: signed(summary().contractDifferenceMinutes) }
            }}
          </dd>
        </div>
      </dl>

      @if (isEmpty()) {
        <ui-card>
          <ui-empty-state
            icon="clock"
            [title]="'timesheets.week.emptyTitle' | transloco"
            [message]="'timesheets.week.emptyText' | transloco"
          />
        </ui-card>
      } @else {
        <ui-card padding="flush">
          <div class="overflow-x-auto">
            <table class="w-full min-w-[44rem] border-collapse text-left text-base">
              <caption class="sr-only">
                {{
                  'timesheets.week.tableLabel' | transloco: { range: rangeLabel() }
                }}
              </caption>
              <thead>
                <tr
                  class="border-b border-border-subtle bg-background-muted text-sm text-foreground-subtle"
                >
                  <th scope="col" class="px-4 py-2 font-medium">
                    {{ 'timesheets.week.day' | transloco }}
                  </th>
                  <th scope="col" class="px-4 py-2 font-medium">
                    {{ 'timesheets.week.scheduled' | transloco }}
                  </th>
                  <th scope="col" class="px-4 py-2 font-medium">
                    {{ 'timesheets.week.worked' | transloco }}
                  </th>
                  <th scope="col" class="px-4 py-2 text-right font-medium">
                    {{ 'timesheets.week.difference' | transloco }}
                  </th>
                </tr>
              </thead>
              <tbody>
                @for (day of summary().days; track day.date) {
                  <tr
                    class="border-b border-border-subtle align-top last:border-b-0"
                    [class.bg-background-brand-subtle]="day.date === today"
                    [attr.aria-current]="day.date === today ? 'date' : null"
                  >
                    <th scope="row" class="px-4 py-3 font-medium whitespace-nowrap">
                      {{ dayLabel(day.date) }}
                      @if (day.date === today) {
                        <span class="ml-1 text-sm font-normal text-foreground-brand-strong">
                          ({{ 'common.today' | transloco }})
                        </span>
                      }
                    </th>
                    <td class="px-4 py-3">
                      @for (shift of day.shifts; track shift.id) {
                        <p class="tabular-nums">{{ shift.start }} - {{ shift.end }}</p>
                      }
                      @if (day.shifts.length > 0) {
                        <p class="text-sm text-foreground-subtle tabular-nums">
                          {{ duration(day.scheduledMinutes) }}
                        </p>
                      } @else {
                        <span class="text-foreground-subtle">{{
                          'timesheets.week.noShift' | transloco
                        }}</span>
                      }
                    </td>
                    <td class="px-4 py-3">
                      @for (entry of day.entries; track entry.id) {
                        <div class="mb-2 last:mb-0">
                          <p class="flex flex-wrap items-center gap-2">
                            <span class="tabular-nums">
                              {{ time(entry.clockIn) }} -
                              {{
                                entry.clockOut
                                  ? time(entry.clockOut)
                                  : ('timesheets.week.running' | transloco)
                              }}
                            </span>
                            <ui-badge [variant]="variant(entry.status)">
                              {{ 'timesheets.status.' + entry.status | transloco }}
                            </ui-badge>
                          </p>
                          <p class="text-sm text-foreground-subtle tabular-nums">
                            {{
                              'timesheets.week.breakTotal' | transloco: { time: breakText(entry) }
                            }}
                          </p>
                          @if (entry.status === 'rejected' && entry.comment) {
                            <p class="mt-1 text-sm text-foreground-danger">
                              {{
                                'timesheets.week.managerComment'
                                  | transloco: { comment: entry.comment }
                              }}
                            </p>
                          }
                        </div>
                      } @empty {
                        <span class="text-foreground-subtle">{{
                          'timesheets.week.noEntry' | transloco
                        }}</span>
                      }
                      @if (day.entries.length > 0) {
                        <p class="text-sm font-medium tabular-nums">
                          {{ duration(day.workedMinutes) }}
                        </p>
                      }
                    </td>
                    <td class="px-4 py-3 text-right tabular-nums">{{ dayDifference(day) }}</td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr class="border-t border-border bg-background-muted font-medium">
                  <th scope="row" class="px-4 py-3">{{ 'timesheets.week.total' | transloco }}</th>
                  <td class="px-4 py-3 tabular-nums">{{ duration(summary().scheduledMinutes) }}</td>
                  <td class="px-4 py-3 tabular-nums">{{ duration(summary().workedMinutes) }}</td>
                  <td class="px-4 py-3 text-right tabular-nums">
                    {{ signed(summary().differenceMinutes) }}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </ui-card>
      }
    }
  `,
})
export class WeekViewComponent {
  private readonly auth = inject(AuthService);
  private readonly shiftsApi = inject(ShiftsApi);
  private readonly clockApi = inject(ClockApi);
  private readonly employeesApi = inject(EmployeesApi);
  private readonly language = inject(LanguageService);

  /** Change this number to reload the week, for example after a clock action. */
  readonly reload = input(0);

  protected readonly today = todayIso();
  protected readonly weekStart = signal(startOfWeek(this.today));
  private readonly weekEnd = computed(() => addDays(this.weekStart(), 6));
  private readonly locale = computed(() => this.language.language());

  protected readonly data = rxResource({
    params: () => ({
      employeeId: this.auth.user()?.id,
      from: this.weekStart(),
      to: this.weekEnd(),
      reload: this.reload(),
    }),
    stream: ({ params }) =>
      forkJoin({
        shifts: this.shiftsApi.list({
          employeeId: params.employeeId,
          from: params.from,
          to: params.to,
        }),
        entries: this.clockApi.entries({
          employeeId: params.employeeId,
          from: params.from,
          to: params.to,
        }),
      }),
  });

  private readonly employee = rxResource({
    params: () => this.auth.user()?.id,
    stream: ({ params }) => this.employeesApi.get(params),
  });

  protected readonly summary = computed(() =>
    buildWeek(
      this.weekStart(),
      this.data.value()?.shifts ?? [],
      this.data.value()?.entries ?? [],
      this.employee.value()?.contract.hoursPerWeek ?? 0,
    ),
  );

  protected readonly isEmpty = computed(() =>
    this.summary().days.every((d) => d.shifts.length === 0 && d.entries.length === 0),
  );

  protected readonly rangeLabel = computed(() =>
    formatWeekRange(this.weekStart(), this.weekEnd(), this.locale()),
  );

  protected move(offset: number): void {
    this.weekStart.update((week) => shiftWeek(week, offset));
  }

  protected goToToday(): void {
    this.weekStart.set(startOfWeek(this.today));
  }

  protected dayLabel(date: string): string {
    return formatDate(date, this.locale());
  }

  protected time(iso: string): string {
    return formatTime(iso);
  }

  protected duration(minutes: number): string {
    return formatDuration(minutes);
  }

  protected signed(minutes: number): string {
    return formatSignedDuration(minutes);
  }

  protected variant(status: TimesheetStatus): BadgeVariant {
    return STATUS_VARIANT[status];
  }

  protected dayDifference(day: DayRow): string {
    return day.shifts.length === 0 && day.entries.length === 0
      ? ''
      : formatSignedDuration(day.differenceMinutes);
  }

  protected breakText(entry: ClockEntry): string {
    return formatDuration(breakMinutes(entry));
  }
}
