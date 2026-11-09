import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { dataTokens } from '@tokens';
import { AbsencesApi } from '@core/api/absences.api';
import { EmployeesApi } from '@core/api/employees.api';
import { LookupsApi } from '@core/api/lookups.api';
import type { AbsenceRequest, AbsenceTypeKey, Employee } from '@core/api/models';
import { AuthService } from '@core/auth/auth.service';
import { addDays, todayIso, weekdayIndex } from '@core/domain/time';
import { LanguageService } from '@core/i18n/i18n';
import {
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
  FieldComponent,
  IconButtonComponent,
  SelectComponent,
  SkeletonComponent,
  TagComponent,
  type SelectOption,
} from '@ui/index';
import { shortName } from './absence-math';
import { formatDay, formatMonth } from './absence-format';
import {
  buildMonthGrid,
  lastOfMonth,
  shiftMonth,
  type CalendarDay,
  type CalendarEntry,
} from './month-grid';

const MAX_CHIPS = 3;

/**
 * Month calendar of who is away. It is an ARIA grid with one tab stop: arrow keys move by day
 * and week, Home and End to the ends of the week, PageUp and PageDown by month, Enter selects.
 * The selected day is also listed as text below the grid.
 */
@Component({
  selector: 'app-team-calendar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    FieldComponent,
    IconButtonComponent,
    SelectComponent,
    SkeletonComponent,
    TagComponent,
    TranslocoPipe,
  ],
  template: `
    <div class="mb-4 flex flex-wrap items-end gap-4">
      <ui-field [label]="'absences.calendar.team' | transloco" class="w-56">
        <ui-select
          [options]="teamOptions()"
          [value]="teamId()"
          (valueChange)="teamId.set($event)"
        />
      </ui-field>
      <ui-field [label]="'absences.calendar.location' | transloco" class="w-56">
        <ui-select
          [options]="locationOptions()"
          [value]="locationId()"
          (valueChange)="locationId.set($event)"
        />
      </ui-field>
      <div class="ml-auto flex items-center gap-2">
        <button
          ui-icon-button
          type="button"
          icon="chevron-left"
          [label]="'absences.calendar.previousMonth' | transloco"
          (click)="move(-1)"
        ></button>
        <button
          ui-icon-button
          type="button"
          icon="chevron-right"
          [label]="'absences.calendar.nextMonth' | transloco"
          (click)="move(1)"
        ></button>

        <button ui-button type="button" variant="secondary" size="sm" (click)="goToToday()">
          {{ 'absences.calendar.thisMonth' | transloco }}
        </button>
        <h2 class="min-w-40 font-title text-lg font-semibold capitalize" aria-live="polite">
          {{ monthLabel() }}
        </h2>
      </div>
    </div>

    @if (absences.error()) {
      <ui-card>
        <ui-empty-state
          icon="alert-circle"
          [title]="'common.errorTitle' | transloco"
          [message]="'common.errorText' | transloco"
        >
          <button empty-action ui-button type="button" (click)="absences.reload()">
            {{ 'common.retry' | transloco }}
          </button>
        </ui-empty-state>
      </ui-card>
    } @else if (latest() === undefined) {
      <div role="status" [attr.aria-label]="'common.loading' | transloco">
        <ui-skeleton class="h-96 w-full" />
      </div>
    } @else {
      <div
        role="grid"
        [attr.aria-busy]="absences.isLoading() ? 'true' : null"
        class="overflow-hidden rounded-lg border border-border-subtle bg-background-surface-page"
        [attr.aria-label]="'absences.calendar.gridLabel' | transloco: { month: monthLabel() }"
        [attr.aria-readonly]="true"
      >
        <div role="row" class="grid grid-cols-7 border-b border-border-subtle bg-background-muted">
          @for (name of weekdays(); track name.long) {
            <div
              role="columnheader"
              class="px-2 py-2 text-sm font-medium text-foreground-subtle"
              [attr.aria-label]="name.long"
            >
              {{ name.short }}
            </div>
          }
        </div>
        @for (week of grid().weeks; track week[0]?.date) {
          <div role="row" class="grid grid-cols-7">
            @for (day of week; track day.date) {
              <div
                role="gridcell"
                class="min-h-24 min-w-0 cursor-pointer border-r border-b border-border-subtle p-1.5 outline-offset-[-2px] last:border-r-0 focus-visible:outline-2 focus-visible:outline-border-brand"
                [class]="cellClass(day)"
                [id]="'cal-' + day.date"
                [attr.tabindex]="day.date === activeDate() ? 0 : -1"
                [attr.aria-label]="cellLabel(day)"
                [attr.aria-selected]="selectedDate() === day.date"
                [attr.aria-current]="day.date === today ? 'date' : null"
                (click)="select(day.date)"
                (keydown)="onKeydown($event, day.date)"
                (focus)="focusDate.set(day.date)"
              >
                <span
                  aria-hidden="true"
                  class="mb-1 inline-flex size-6 items-center justify-center rounded-full text-sm"
                  [class]="
                    day.date === today
                      ? 'bg-background-primary font-medium text-foreground-brand-inverted'
                      : ''
                  "
                  >{{ dayNumber(day.date) }}</span
                >
                <div class="flex flex-col gap-1" aria-hidden="true">
                  @for (entry of day.entries.slice(0, maxChips); track entry.requestId) {
                    <ui-tag
                      class="max-w-full"
                      [color]="color(entry.type)"
                      [class.border-dashed]="entry.status === 'pending'"
                    >
                      <span class="truncate">{{ chipText(entry) }}</span>
                    </ui-tag>
                  }
                  @if (day.entries.length > maxChips) {
                    <span class="text-sm text-foreground-subtle">
                      {{
                        'absences.calendar.more'
                          | transloco: { count: day.entries.length - maxChips }
                      }}
                    </span>
                  }
                </div>
              </div>
            }
          </div>
        }
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-2 text-sm text-foreground-subtle">
        <span>{{ 'absences.calendar.legend' | transloco }}</span>
        @for (type of legendTypes(); track type) {
          <ui-tag [color]="color(type)">
            {{ 'absences.types.' + type | transloco }} ({{
              'absences.typeShort.' + type | transloco
            }})
          </ui-tag>
        }
        @if (isManager) {
          <ui-tag class="border-dashed">{{ 'absences.calendar.pendingLegend' | transloco }}</ui-tag>
        }
      </div>

      <ui-card class="mt-4">
        <h3 card-header class="font-title text-base font-semibold">
          @if (selectedDate(); as date) {
            {{ longDate(date) }}
          } @else {
            {{ 'absences.calendar.detailsTitle' | transloco }}
          }
        </h3>
        @if (selectedDay(); as day) {
          @if (day.entries.length === 0) {
            <p class="text-base text-foreground-subtle">
              {{ 'absences.calendar.nobodyAway' | transloco }}
            </p>
          } @else {
            <ul class="m-0 flex list-none flex-col gap-2 p-0">
              @for (entry of day.entries; track entry.requestId) {
                <li class="flex flex-wrap items-center gap-2 text-base">
                  <span class="font-medium">{{ fullName(entry.employeeId) }}</span>
                  <ui-tag [color]="color(entry.type)">{{
                    'absences.types.' + entry.type | transloco
                  }}</ui-tag>
                  @if (entry.status === 'pending') {
                    <span class="text-sm text-foreground-subtle">
                      {{ 'absences.status.pending' | transloco }}
                    </span>
                  }
                </li>
              }
            </ul>
          }
        } @else {
          <p class="text-base text-foreground-subtle">
            {{ 'absences.calendar.pickDay' | transloco }}
          </p>
        }
      </ui-card>

      @if (isEmpty()) {
        <p class="mt-3 text-base text-foreground-subtle" role="status">
          {{ 'absences.calendar.emptyMonth' | transloco }}
        </p>
      }
    }
  `,
})
export class TeamCalendarComponent {
  private readonly absencesApi = inject(AbsencesApi);
  private readonly employeesApi = inject(EmployeesApi);
  private readonly lookups = inject(LookupsApi);
  private readonly auth = inject(AuthService);
  private readonly language = inject(LanguageService);
  private readonly transloco = inject(TranslocoService);
  private readonly injector = inject(Injector);

  /** Change this number to reload, for example after a request was reviewed. */
  readonly reload = input(0);

  protected readonly maxChips = MAX_CHIPS;
  protected readonly today = todayIso();
  protected readonly isManager = this.auth.isManager();

  private readonly start = this.today.split('-').map(Number);
  protected readonly year = signal(this.start[0] ?? 1970);
  protected readonly month = signal(this.start[1] ?? 1);
  protected readonly teamId = signal(this.auth.user()?.teamId ?? '');
  protected readonly locationId = signal('');
  protected readonly selectedDate = signal<string | null>(null);
  protected readonly focusDate = signal(this.today);

  private readonly locale = computed(() => this.language.language());
  /** Emits when the scope file is loaded and on language changes, so code-built text stays current. */
  private readonly scopeLoaded = toSignal(this.transloco.selectTranslation('absences'));
  private readonly t = (key: string, params?: Record<string, unknown>) => {
    this.scopeLoaded();
    return this.transloco.translate(key, params);
  };

  /** Only needed for the first and last date that the month grid shows. */
  private readonly frame = computed(() =>
    buildMonthGrid(this.year(), this.month(), [], { includePending: false }),
  );

  protected readonly absences = rxResource({
    params: () => ({
      from: this.frame().from,
      to: this.frame().to,
      teamId: this.teamId(),
      reload: this.reload(),
    }),
    stream: ({ params }) =>
      this.absencesApi.list({ from: params.from, to: params.to, teamId: params.teamId }),
  });

  /** Keeps the last loaded list while the next month loads, so the grid (and keyboard focus) stays put. */
  protected readonly latest = linkedSignal<
    AbsenceRequest[] | undefined,
    AbsenceRequest[] | undefined
  >({
    source: this.absences.value,
    computation: (value, previous) => value ?? previous?.value,
  });

  private readonly employees = rxResource({
    stream: () => this.employeesApi.list({ pageSize: 100 }),
  });
  private readonly people = computed(
    () => new Map<string, Employee>((this.employees.value()?.items ?? []).map((e) => [e.id, e])),
  );

  private readonly teams = rxResource({ stream: () => this.lookups.teams() });
  private readonly locations = rxResource({ stream: () => this.lookups.locations() });

  protected readonly teamOptions = computed<SelectOption[]>(() => [
    { value: '', label: this.t('absences.calendar.allTeams') },
    ...(this.teams.value() ?? []).map((team) => ({ value: team.id, label: team.name })),
  ]);
  protected readonly locationOptions = computed<SelectOption[]>(() => [
    { value: '', label: this.t('absences.calendar.allLocations') },
    ...(this.locations.value() ?? []).map((loc) => ({ value: loc.id, label: loc.name })),
  ]);

  /** The server filters by team; the location is filtered here through the employee. */
  private readonly visibleAbsences = computed(() => {
    const location = this.locationId();
    const all = this.latest() ?? [];
    return location
      ? all.filter((a) => this.people().get(a.employeeId)?.locationId === location)
      : all;
  });

  protected readonly grid = computed(() =>
    buildMonthGrid(this.year(), this.month(), this.visibleAbsences(), {
      includePending: this.isManager,
    }),
  );

  protected readonly isEmpty = computed(() =>
    this.grid().weeks.every((week) =>
      week.every((day) => !day.inMonth || day.entries.length === 0),
    ),
  );

  protected readonly monthLabel = computed(() =>
    formatMonth(this.year(), this.month(), this.locale()),
  );

  protected readonly weekdays = computed(() => {
    const monday = '2026-11-02';
    return Array.from({ length: 7 }, (_, i) => ({
      short: formatDay(addDays(monday, i), this.locale(), { weekday: 'short' }),
      long: formatDay(addDays(monday, i), this.locale(), { weekday: 'long' }),
    }));
  });

  protected readonly legendTypes = computed<AbsenceTypeKey[]>(() => {
    const seen = new Set<AbsenceTypeKey>();
    for (const week of this.grid().weeks) {
      for (const day of week) for (const entry of day.entries) seen.add(entry.type);
    }
    return [...seen];
  });

  /** The one cell in the tab order: the focused day, or a sensible default when it left the grid. */
  protected readonly activeDate = computed(() => {
    const focus = this.focusDate();
    const days = this.grid().weeks.flat();
    if (days.some((d) => d.date === focus)) return focus;
    const first = `${this.year()}-${String(this.month()).padStart(2, '0')}-01`;
    return days.some((d) => d.date === this.today) && this.today.startsWith(first.slice(0, 7))
      ? this.today
      : first;
  });

  protected readonly selectedDay = computed<CalendarDay | null>(() => {
    const date = this.selectedDate();
    return date
      ? (this.grid()
          .weeks.flat()
          .find((d) => d.date === date) ?? null)
      : null;
  });

  protected color(type: AbsenceTypeKey): string {
    return dataTokens.absence[type];
  }

  protected dayNumber(date: string): number {
    return Number(date.slice(8));
  }

  protected longDate(date: string): string {
    return formatDay(date, this.locale(), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  protected fullName(employeeId: string): string {
    const e = this.people().get(employeeId);
    return e ? `${e.firstName} ${e.lastName}` : employeeId;
  }

  protected chipText(entry: CalendarEntry): string {
    const e = this.people().get(entry.employeeId);
    return `${e ? shortName(e) : entry.employeeId} · ${this.t(`absences.typeShort.${entry.type}`)}`;
  }

  protected cellClass(day: CalendarDay): string {
    if (this.selectedDate() === day.date) return 'bg-background-brand-subtle';
    if (!day.inMonth) return 'bg-background-muted text-foreground-subtle';
    if (day.isWeekend) return 'bg-background-muted';
    return 'hover:bg-background-hover';
  }

  /** Full text for screen readers: the date and everyone who is away that day. */
  protected cellLabel(day: CalendarDay): string {
    const date = this.longDate(day.date);
    if (day.entries.length === 0) return this.t('absences.calendar.cellNobody', { date });
    const people = day.entries
      .map((entry) => {
        const type = this.t(`absences.types.${entry.type}`);
        const pending = entry.status === 'pending' ? ` (${this.t('absences.status.pending')})` : '';
        return `${this.fullName(entry.employeeId)}, ${type}${pending}`;
      })
      .join('; ');
    return this.t('absences.calendar.cellAway', { date, count: day.entries.length, people });
  }

  protected move(delta: number): void {
    const next = shiftMonth(this.year(), this.month(), delta);
    this.year.set(next.year);
    this.month.set(next.month);
    this.selectedDate.set(null);
    this.focusDate.set(`${next.year}-${String(next.month).padStart(2, '0')}-01`);
  }

  protected goToToday(): void {
    const [y, m] = this.today.split('-').map(Number);
    this.year.set(y ?? 1970);
    this.month.set(m ?? 1);
    this.selectedDate.set(null);
    this.focusDate.set(this.today);
  }

  protected select(date: string): void {
    this.selectedDate.set(date);
  }

  protected onKeydown(event: KeyboardEvent, date: string): void {
    const steps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    let target: string | null = null;
    const step = steps[event.key];
    if (step !== undefined) {
      target = addDays(date, step);
    } else if (event.key === 'Home') {
      target = addDays(date, -weekdayIndex(date));
    } else if (event.key === 'End') {
      target = addDays(date, 6 - weekdayIndex(date));
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      target = this.sameDayInMonth(date, event.key === 'PageUp' ? -1 : 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.select(date);
      return;
    }
    if (target) {
      event.preventDefault();
      this.moveTo(target);
    }
  }

  private sameDayInMonth(date: string, delta: number): string {
    const [y, m, d] = date.split('-').map(Number);
    const next = shiftMonth(y ?? 1970, m ?? 1, delta);
    const last = Number(lastOfMonth(next.year, next.month).slice(8));
    const day = String(Math.min(d ?? 1, last)).padStart(2, '0');
    return `${next.year}-${String(next.month).padStart(2, '0')}-${day}`;
  }

  /** Moves the focus to a day, switching month when the day belongs to another one. */
  private moveTo(date: string): void {
    const [y, m] = date.split('-').map(Number);
    if (y !== this.year() || m !== this.month()) {
      this.year.set(y ?? 1970);
      this.month.set(m ?? 1);
      this.selectedDate.set(null);
    }
    this.focusDate.set(date);
    afterNextRender(() => document.getElementById(`cal-${date}`)?.focus(), {
      injector: this.injector,
    });
  }
}
