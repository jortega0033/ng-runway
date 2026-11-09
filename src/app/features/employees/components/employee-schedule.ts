import { rxResource } from '@angular/core/rxjs-interop';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Employee, Location, Shift, Team } from '@core/api/models';
import { ShiftsApi } from '@core/api/shifts.api';
import { formatDuration, weeklyScheduledMinutes } from '@core/domain/hours';
import { addDays, startOfWeek, todayIso, weekDates } from '@core/domain/time';
import { LanguageService } from '@core/i18n/i18n';
import {
  AlertComponent,
  BadgeComponent,
  ButtonComponent,
  EmptyStateComponent,
  SkeletonComponent,
} from '@ui/index';
import { formatDay, percentOf } from '../format';

/** The employee's shifts for the current week, with the scheduled total against the contract. */
@Component({
  selector: 'app-employee-schedule',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    BadgeComponent,
    ButtonComponent,
    EmptyStateComponent,
    SkeletonComponent,
    TranslocoPipe,
  ],
  template: `
    @if (shifts.status() === 'error') {
      <ui-alert variant="danger" [heading]="'common.errorTitle' | transloco">
        {{ 'common.errorText' | transloco }}
        <div class="mt-2">
          <button ui-button size="sm" variant="secondary" type="button" (click)="shifts.reload()">
            {{ 'common.retry' | transloco }}
          </button>
        </div>
      </ui-alert>
    } @else if (shifts.isLoading()) {
      <div class="flex flex-col gap-2" aria-busy="true">
        @for (n of placeholders; track n) {
          <ui-skeleton class="h-12 w-full" />
        }
      </div>
    } @else if (!hasShifts()) {
      <ui-empty-state
        icon="calendar"
        [title]="'employees.schedule.emptyTitle' | transloco"
        [message]="'employees.schedule.emptyText' | transloco"
      />
    } @else {
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1.5">
          <div class="flex items-baseline justify-between gap-3 text-base">
            <span class="font-medium">{{ 'employees.schedule.thisWeek' | transloco }}</span>
            <span class="text-foreground-subtle">
              {{
                'employees.schedule.total'
                  | transloco
                    : { scheduled: scheduledLabel(), contract: employee().contract.hoursPerWeek }
              }}
            </span>
          </div>
          <div
            role="progressbar"
            class="h-2 w-full overflow-hidden rounded-full bg-background-alt"
            aria-valuemin="0"
            aria-valuemax="100"
            [attr.aria-valuenow]="progress()"
            [attr.aria-label]="'employees.schedule.progressLabel' | transloco"
          >
            <div
              class="h-full rounded-full bg-background-primary"
              [style.width.%]="progress()"
            ></div>
          </div>
        </div>

        <ul class="m-0 flex list-none flex-col divide-y divide-border-subtle p-0">
          @for (day of days(); track day.date) {
            <li class="flex flex-wrap items-start gap-x-6 gap-y-1 py-3">
              <p
                class="w-32 shrink-0 text-base font-medium"
                [class.text-foreground-brand]="day.today"
              >
                {{ day.label }}
              </p>
              @if (day.shifts.length === 0) {
                <p class="text-base text-foreground-subtle">
                  {{ 'employees.schedule.noShift' | transloco }}
                </p>
              } @else {
                <ul class="m-0 flex min-w-0 flex-1 list-none flex-col gap-1 p-0">
                  @for (shift of day.shifts; track shift.id) {
                    <li class="flex flex-wrap items-center gap-x-3 gap-y-1 text-base">
                      <span class="font-medium">{{ shift.start }} - {{ shift.end }}</span>
                      <span class="text-foreground-subtle">
                        {{ teamName(shift.teamId) }}, {{ locationName(shift.locationId) }}
                      </span>
                      @if (shift.status === 'draft') {
                        <ui-badge variant="warning">{{
                          'employees.schedule.draft' | transloco
                        }}</ui-badge>
                      }
                    </li>
                  }
                </ul>
              }
            </li>
          }
        </ul>
      </div>
    }
  `,
})
export class EmployeeScheduleComponent {
  readonly employee = input.required<Employee>();
  readonly teams = input<readonly Team[]>([]);
  readonly locations = input<readonly Location[]>([]);

  private readonly api = inject(ShiftsApi);
  private readonly language = inject(LanguageService).language;

  protected readonly placeholders = [1, 2, 3, 4, 5];
  private readonly today = todayIso();
  private readonly weekStart = startOfWeek(this.today);

  protected readonly shifts = rxResource({
    params: () => this.employee().id,
    stream: ({ params }) =>
      this.api.list({
        employeeId: params,
        from: this.weekStart,
        to: addDays(this.weekStart, 6),
      }),
  });

  private readonly list = computed<readonly Shift[]>(() => this.shifts.value() ?? []);
  protected readonly hasShifts = computed(() => this.list().length > 0);

  protected readonly days = computed(() =>
    weekDates(this.weekStart).map((date) => ({
      date,
      label: formatDay(date, this.language()),
      today: date === this.today,
      shifts: this.list()
        .filter((shift) => shift.date === date)
        .sort((a, b) => a.start.localeCompare(b.start)),
    })),
  );

  private readonly scheduledMinutes = computed(() =>
    weeklyScheduledMinutes(this.list(), this.employee().id, this.weekStart),
  );
  protected readonly scheduledLabel = computed(() => formatDuration(this.scheduledMinutes()));
  protected readonly progress = computed(() =>
    percentOf(this.scheduledMinutes(), this.employee().contract.hoursPerWeek * 60),
  );

  protected teamName(id: string): string {
    return this.teams().find((team) => team.id === id)?.name ?? id;
  }

  protected locationName(id: string): string {
    return this.locations().find((location) => location.id === id)?.name ?? id;
  }
}
