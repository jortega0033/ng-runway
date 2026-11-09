import {
  CdkDrag,
  CdkDragHandle,
  CdkDragPlaceholder,
  CdkDropList,
  CdkDropListGroup,
  type CdkDragDrop,
} from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { dataTokens } from '@tokens';
import type { AbsenceRequest, Employee, Shift, ShiftInput, ShiftTemplate } from '@core/api/models';
import { formatDuration, shiftNetMinutes } from '@core/domain/hours';
import { toMinutes } from '@core/domain/time';
import { IconButtonComponent, IconComponent } from '@ui/index';
import {
  axisHours,
  dayAxis,
  deltaMinutesFromPixels,
  formatDay,
  formatRange,
  isOvernight,
  moveToTarget,
  resizeEnd,
  shiftBox,
  templateFor,
  timeFromOffset,
  unavailableBoxes,
  type DropTarget,
  type GridCell,
  type GridRow,
  type ShiftBox,
} from '../schedule.layout';
import { SCHEDULE_TODAY, ScheduleStore } from '../schedule.store';

/** Width of one minute on the day view: 48 px per hour. */
const PX_PER_MINUTE = 0.8;
const HOUR_PX = 60 * PX_PER_MINUTE;

// Availability is drawn with the data tokens: a light tint where the person can work, a hatch where not.
const AVAILABLE_TINT = `color-mix(in srgb, ${dataTokens.schedule.available} 9%, transparent)`;
const HATCH = 'repeating-linear-gradient(135deg, var(--colors-border) 0 1px, transparent 1px 7px)';
const HOUR_LINES = `repeating-linear-gradient(to right, var(--colors-border-subtle) 0 1px, transparent 1px ${HOUR_PX}px)`;

function isShift(data: Shift | ShiftTemplate): data is Shift {
  return 'employeeId' in data;
}

/**
 * The roster grid. Rows are employees grouped by team (open shifts first), columns are the seven days
 * of the week, or one day with an hourly axis. Everything the template needs comes precomputed from
 * the store, so a drag only re-renders what changed.
 *
 * Mouse: drag a chip to move it, drag a template from the palette to create, drag the handle at the
 * end of a chip (day view) to resize. Keyboard: every chip opens the editor, every row has an
 * Add shift button, and the resize handle answers to the arrow keys.
 */
@Component({
  selector: 'app-schedule-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CdkDrag,
    CdkDragHandle,
    CdkDragPlaceholder,
    CdkDropList,
    CdkDropListGroup,
    IconButtonComponent,
    IconComponent,
    TranslocoPipe,
  ],
  template: `
    <div cdkDropListGroup class="flex flex-col gap-3">
      @if (canEdit()) {
        <section
          class="flex flex-wrap items-center gap-2 rounded-lg border border-border-subtle bg-background-muted px-3 py-2"
          [attr.aria-label]="'schedule.palette.title' | transloco"
        >
          <h2 class="text-base font-medium text-foreground">
            {{ 'schedule.palette.title' | transloco }}
          </h2>
          <div
            cdkDropList
            [cdkDropListData]="templates()"
            [cdkDropListSortingDisabled]="true"
            [cdkDropListEnterPredicate]="never"
            class="flex flex-wrap gap-2"
          >
            @for (template of templates(); track template) {
              <div
                cdkDrag
                [cdkDragData]="template"
                class="cursor-grab rounded-md border border-border bg-background-surface-page px-2.5 py-1 text-base text-foreground shadow-xs active:cursor-grabbing"
                [attr.title]="'schedule.palette.dragLabel' | transloco: paletteParams(template)"
              >
                <span class="font-medium">{{ template.name }}</span>
                <span class="ml-1.5 text-sm text-foreground-subtle tabular-nums">
                  {{ template.start }}-{{ template.end }}
                </span>
                <div
                  *cdkDragPlaceholder
                  class="h-8 w-28 rounded-md border border-dashed border-border-brand bg-background-brand-subtle"
                ></div>
              </div>
            }
          </div>
          <p class="basis-full text-sm text-foreground-subtle">
            {{ 'schedule.palette.hint' | transloco }}
          </p>
        </section>
      }

      <div
        class="max-h-[calc(100dvh-16rem)] min-h-64 overflow-auto rounded-lg border border-border bg-background-surface-page"
        role="region"
        tabindex="0"
        [attr.aria-label]="tableLabel()"
      >
        <table
          class="w-full border-separate border-spacing-0 text-base"
          [class.min-w-[68rem]]="!isDay()"
        >
          <caption class="sr-only">
            {{
              tableLabel()
            }}
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                class="sticky top-0 left-0 z-30 min-w-52 border-r border-b border-border bg-background-muted px-3 py-2 text-left text-sm font-medium text-foreground-subtle"
              >
                {{ 'schedule.grid.employee' | transloco }}
              </th>
              @if (isDay()) {
                <th
                  scope="col"
                  class="sticky top-0 z-20 border-b border-border bg-background-muted p-0 text-left"
                >
                  <span class="sr-only">{{ dayHeaders()[0]?.long }}</span>
                  <div class="relative h-9" aria-hidden="true" [style.width.px]="trackWidth()">
                    @for (tick of hourTicks(); track tick) {
                      <span
                        class="absolute top-2 -translate-x-1/2 text-sm text-foreground-subtle tabular-nums"
                        [style.left.px]="tick.left"
                      >
                        {{ 'schedule.grid.hourLabel' | transloco: { hour: tick.hour } }}
                      </span>
                    }
                  </div>
                </th>
              } @else {
                @for (day of dayHeaders(); track day.date + day.long) {
                  <th
                    scope="col"
                    class="sticky top-0 z-20 min-w-32 border-b border-border bg-background-muted px-3 py-2 text-left"
                    [attr.aria-current]="day.today ? 'date' : null"
                  >
                    <span
                      class="block text-sm font-medium"
                      [class]="day.today ? 'text-foreground-brand' : 'text-foreground-subtle'"
                    >
                      {{ day.weekday }}
                    </span>
                    <span class="block text-base text-foreground">{{ day.dayMonth }}</span>
                  </th>
                }
              }
            </tr>
          </thead>

          @for (group of displayGroups(); track group) {
            <tbody>
              @if (group.team) {
                <tr>
                  <th
                    scope="rowgroup"
                    [attr.colspan]="isDay() ? 2 : 8"
                    class="sticky left-0 border-b border-border-subtle bg-background-muted px-3 py-1.5 text-left text-sm font-medium text-foreground"
                  >
                    <span class="inline-flex items-center gap-2">
                      <span
                        class="size-2.5 rounded-full"
                        aria-hidden="true"
                        [style.background-color]="group.team.color"
                      ></span>
                      {{ group.team.name }}
                    </span>
                  </th>
                </tr>
              }
              @for (row of group.rows; track row) {
                <tr>
                  <th
                    scope="row"
                    class="sticky left-0 z-10 border-r border-b border-border-subtle bg-background-surface-page px-3 py-2 text-left align-top font-normal"
                  >
                    <div class="flex items-start justify-between gap-2">
                      <div class="min-w-0">
                        @if (!row.employee) {
                          <p class="font-medium text-foreground">
                            {{ 'schedule.grid.openShifts' | transloco }}
                          </p>
                          <p class="text-sm text-foreground-subtle">
                            {{ 'schedule.grid.openShiftsHint' | transloco }}
                          </p>
                        } @else {
                          <p class="truncate font-medium text-foreground">
                            {{ nameOf(row.employee) }}
                          </p>
                          <p class="truncate text-sm text-foreground-subtle">
                            {{ row.employee.jobTitle }}
                          </p>
                          <p
                            class="mt-0.5 flex items-center gap-1 text-sm tabular-nums"
                            [class]="
                              row.overContract
                                ? 'text-foreground-warning-strong'
                                : 'text-foreground-subtle'
                            "
                          >
                            @if (row.overContract) {
                              <ui-icon name="alert-triangle" [size]="16" />
                              <span class="sr-only"
                                >{{ 'schedule.grid.overContract' | transloco }}.</span
                              >
                            }
                            <span
                              [attr.aria-label]="
                                'schedule.grid.hoursLabel' | transloco: hoursParams(row)
                              "
                              >{{ 'schedule.grid.hours' | transloco: hoursParams(row) }}</span
                            >
                          </p>
                        }
                      </div>
                      @if (canEdit()) {
                        <button
                          ui-icon-button
                          type="button"
                          icon="plus"
                          size="sm"
                          [label]="'schedule.grid.addShiftRow' | transloco: { who: rowName(row) }"
                          (click)="addForRow(row)"
                        ></button>
                      }
                    </div>
                  </th>

                  @if (isDay()) {
                    @let cell = row.cells[0];
                    <td class="border-b border-border-subtle p-0 align-top">
                      <div
                        cdkDropList
                        [cdkDropListData]="cell.target"
                        [cdkDropListDisabled]="!canEdit()"
                        [cdkDropListSortingDisabled]="true"
                        (cdkDropListDropped)="onDayDrop($event)"
                        class="relative h-16 [&.cdk-drop-list-dragging]:bg-background-brand-subtle [&.cdk-drop-list-receiving]:bg-background-brand-subtle"
                        [style.width.px]="trackWidth()"
                        [style.background-image]="hourLines"
                      >
                        @let boxes = unavailable(row, cell);
                        <div
                          class="absolute inset-y-0"
                          aria-hidden="true"
                          [hidden]="!boxes[0]"
                          [style.left.px]="boxes[0]?.left"
                          [style.width.px]="boxes[0]?.width"
                          [style.background-image]="hatch"
                        ></div>
                        <div
                          class="absolute inset-y-0"
                          aria-hidden="true"
                          [hidden]="!boxes[1]"
                          [style.left.px]="boxes[1]?.left"
                          [style.width.px]="boxes[1]?.width"
                          [style.background-image]="hatch"
                        ></div>
                        @if (cell.unavailable) {
                          <span class="absolute top-1 left-2 text-sm text-foreground-subtle">
                            {{ 'schedule.grid.unavailable' | transloco }}
                          </span>
                        } @else if (cell.availability) {
                          <span class="sr-only">
                            {{
                              'schedule.grid.availableWindow'
                                | transloco
                                  : { from: cell.availability.from, to: cell.availability.to }
                            }}
                          </span>
                        }
                        @for (absence of cell.absences; track absence) {
                          <div
                            class="absolute inset-x-0 top-0 z-10 flex h-5 items-center gap-1.5 border-b border-border bg-background-surface-page px-2 text-sm text-foreground"
                          >
                            <span
                              class="size-2 shrink-0 rounded-full"
                              aria-hidden="true"
                              [style.background-color]="absenceColor(absence)"
                            ></span>
                            <span class="truncate">{{ absenceText(absence) }}</span>
                          </div>
                        }
                        @for (shift of cell.shifts; track shift) {
                          <div
                            cdkDrag
                            [cdkDragData]="shift"
                            [cdkDragDisabled]="!canMove(shift)"
                            (cdkDragEnded)="dragEnded()"
                            class="absolute top-6 bottom-1.5 z-20 rounded-md border text-sm shadow-xs"
                            [class]="chipClasses(shift)"
                            [style.left.px]="box(shift).left"
                            [style.width.px]="box(shift).width"
                            [attr.aria-busy]="isSaving(shift) ? 'true' : null"
                          >
                            <button
                              cdkDragHandle
                              type="button"
                              class="flex h-full w-full min-w-0 flex-col justify-center rounded-md px-2 pr-3 text-left outline-offset-2 focus-visible:outline-2 focus-visible:outline-border-brand"
                              [attr.aria-description]="conflictText(shift) || null"
                              (click)="open(shift)"
                            >
                              <span class="sr-only">{{ shiftLabel(shift) }}</span>
                              <span aria-hidden="true" class="flex min-w-0 items-center gap-1.5">
                                <span
                                  class="size-2 shrink-0 rounded-full"
                                  [style.background-color]="teamColor(shift.teamId)"
                                ></span>
                                <span class="truncate font-medium text-foreground tabular-nums">
                                  {{ shift.start }}-{{ endOf(shift) }}
                                </span>
                                @if (conflictCount(shift) > 0) {
                                  <ui-icon
                                    name="alert-triangle"
                                    [size]="16"
                                    class="shrink-0 text-foreground-warning-strong"
                                    [attr.title]="conflictText(shift)"
                                  />
                                }
                              </span>
                              <span
                                aria-hidden="true"
                                class="flex min-w-0 items-center gap-1 text-sm text-foreground-subtle"
                              >
                                <span class="shrink-0 tabular-nums">{{ netLabel(shift) }}</span>
                                @if (shift.status === 'draft') {
                                  <span class="truncate">{{
                                    'schedule.shift.draft' | transloco
                                  }}</span>
                                }
                                @if (false) {
                                  <span class="truncate">{{ teamName(shift.teamId) }}</span>
                                }
                              </span>
                            </button>
                            @if (canResize(shift)) {
                              <span
                                role="slider"
                                tabindex="0"
                                class="absolute inset-y-0 right-0 flex w-2.5 cursor-ew-resize items-center justify-center rounded-r-md bg-background-alt-contrast outline-offset-2 hover:bg-background-press focus-visible:outline-2 focus-visible:outline-border-brand"
                                [attr.aria-label]="
                                  'schedule.shift.resizeHandle'
                                    | transloco: { name: chipName(shift) }
                                "
                                aria-orientation="horizontal"
                                [attr.aria-valuemin]="minutesOf(shift.start)"
                                aria-valuemax="1440"
                                [attr.aria-valuenow]="minutesOf(endOf(shift), true)"
                                [attr.aria-valuetext]="
                                  'schedule.shift.resizeValue' | transloco: { end: endOf(shift) }
                                "
                                (pointerdown)="startResize($event, shift)"
                                (pointermove)="moveResize($event)"
                                (pointerup)="endResize()"
                                (pointercancel)="cancelResize()"
                                (keydown)="resizeKey($event, shift)"
                              ></span>
                            }
                            <div
                              *cdkDragPlaceholder
                              class="absolute top-6 bottom-1.5 rounded-md border border-dashed border-border-brand bg-background-brand-subtle"
                              [style.left.px]="box(shift).left"
                              [style.width.px]="box(shift).width"
                            ></div>
                          </div>
                        }
                      </div>
                    </td>
                  } @else {
                    @for (cell of row.cells; track cell) {
                      <td
                        class="group border-r border-b border-border-subtle p-0 align-top"
                        [style.background-color]="
                          !row.employee || cell.unavailable ? null : availableTint
                        "
                        [style.background-image]="cell.unavailable ? hatch : null"
                      >
                        <div
                          cdkDropList
                          [cdkDropListData]="cell.target"
                          [cdkDropListDisabled]="!canEdit()"
                          [cdkDropListSortingDisabled]="true"
                          (cdkDropListDropped)="onWeekDrop($event)"
                          class="flex min-h-20 flex-col gap-1 p-1 [&.cdk-drop-list-dragging]:bg-background-brand-subtle [&.cdk-drop-list-receiving]:bg-background-brand-subtle"
                        >
                          @for (absence of cell.absences; track absence) {
                            <div
                              class="flex items-center gap-1.5 rounded-sm border border-border bg-background-surface-page px-1.5 py-0.5 text-sm text-foreground"
                            >
                              <span
                                class="size-2 shrink-0 rounded-full"
                                aria-hidden="true"
                                [style.background-color]="absenceColor(absence)"
                              ></span>
                              <span class="truncate">{{ absenceText(absence) }}</span>
                            </div>
                          }
                          @for (shift of cell.shifts; track shift) {
                            <div
                              cdkDrag
                              [cdkDragData]="shift"
                              [cdkDragDisabled]="!canMove(shift)"
                              (cdkDragEnded)="dragEnded()"
                              class="rounded-md border text-sm shadow-xs"
                              [class]="chipClasses(shift)"
                              [attr.aria-busy]="isSaving(shift) ? 'true' : null"
                            >
                              <button
                                type="button"
                                class="flex w-full min-w-0 flex-col rounded-md px-2 py-1 text-left outline-offset-2 focus-visible:outline-2 focus-visible:outline-border-brand"
                                [attr.aria-description]="conflictText(shift) || null"
                                (click)="open(shift)"
                              >
                                <span class="sr-only">{{ shiftLabel(shift) }}</span>
                                <span aria-hidden="true" class="flex min-w-0 items-center gap-1.5">
                                  <span
                                    class="size-2 shrink-0 rounded-full"
                                    [style.background-color]="teamColor(shift.teamId)"
                                  ></span>
                                  <span class="truncate font-medium text-foreground tabular-nums">
                                    {{ shift.start }}-{{ endOf(shift) }}
                                  </span>
                                  @if (conflictCount(shift) > 0) {
                                    <ui-icon
                                      name="alert-triangle"
                                      [size]="16"
                                      class="shrink-0 text-foreground-warning-strong"
                                      [attr.title]="conflictText(shift)"
                                    />
                                  }
                                </span>
                                <span
                                  aria-hidden="true"
                                  class="flex min-w-0 items-center gap-1 text-sm text-foreground-subtle"
                                >
                                  <span class="shrink-0 tabular-nums">{{ netLabel(shift) }}</span>
                                  @if (shift.status === 'draft') {
                                    <span class="truncate">{{
                                      'schedule.shift.draft' | transloco
                                    }}</span>
                                  }
                                  @if (!shift.employeeId) {
                                    <span class="truncate">{{ teamName(shift.teamId) }}</span>
                                  }
                                </span>
                              </button>
                              <div
                                *cdkDragPlaceholder
                                class="h-12 rounded-md border border-dashed border-border-brand bg-background-brand-subtle"
                              ></div>
                            </div>
                          }
                          @if (cell.unavailable && cell.shifts.length === 0) {
                            <span class="text-sm text-foreground-subtle">
                              {{ 'schedule.grid.unavailable' | transloco }}
                            </span>
                          }
                          @if (canEdit()) {
                            <button
                              type="button"
                              tabindex="-1"
                              class="mt-auto inline-flex size-6 items-center justify-center self-start rounded-sm text-foreground-subtle opacity-0 outline-offset-2 group-hover:opacity-100 hover:bg-background-hover focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-border-brand motion-reduce:transition-none"
                              [attr.aria-label]="
                                'schedule.grid.addShiftFor'
                                  | transloco: { who: rowName(row), day: dayLong(cell.date) }
                              "
                              (click)="add(cell)"
                            >
                              <ui-icon name="plus" [size]="16" />
                            </button>
                          }
                        </div>
                      </td>
                    }
                  }
                </tr>
              }
            </tbody>
          }
        </table>
      </div>
    </div>
  `,
})
export class ScheduleGridComponent {
  protected readonly store = inject(ScheduleStore);
  private readonly transloco = inject(TranslocoService);
  private readonly today = inject(SCHEDULE_TODAY);

  readonly editShift = output<Shift>();
  /** Starting values for the editor when someone presses an Add shift button. */
  readonly addShift = output<Partial<ShiftInput>>();

  protected readonly availableTint = AVAILABLE_TINT;
  protected readonly hatch = HATCH;
  protected readonly hourLines = HOUR_LINES;
  protected readonly noColor = dataTokens.schedule['no-color'];

  protected readonly grid = this.store.grid;
  /** The open shifts row first, as a group without a team header, then one group per team. */
  protected readonly displayGroups = computed(() => this.grid().all);
  protected readonly canEdit = this.store.canEdit;
  protected readonly templates = this.store.templates;
  protected readonly isDay = computed(() => this.store.view() === 'day');

  private readonly activeLang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });
  // A new object arrives whenever the 'schedule' texts load, so reading it makes labels built in
  // code refresh once the texts exist instead of showing a raw key.
  private readonly scopeLoaded = toSignal(this.transloco.selectTranslation('schedule'));
  private readonly lang = computed(() => {
    this.scopeLoaded();
    return this.activeLang();
  });

  protected readonly dayHeaders = computed(() => {
    const lang = this.lang();
    const today = this.today();
    return this.store.visibleDates().map((date) => ({
      date,
      weekday: formatDay(date, lang, { weekday: 'short' }),
      dayMonth: formatDay(date, lang, { day: 'numeric', month: 'short' }),
      long: formatDay(date, lang, { weekday: 'long', day: 'numeric', month: 'long' }),
      today: date === today,
    }));
  });

  protected readonly tableLabel = computed(() => {
    const lang = this.lang();
    const dates = this.store.visibleDates();
    const first = dates[0] ?? this.store.weekStart();
    const last = dates[dates.length - 1] ?? first;
    return this.isDay()
      ? this.transloco.translate('schedule.grid.dayLabel', { day: formatRange(first, last, lang) })
      : this.transloco.translate('schedule.grid.weekLabel', {
          range: formatRange(first, last, lang),
        });
  });

  // ---- day view axis ----
  protected readonly axis = computed(() =>
    dayAxis(this.store.shifts().filter((s) => s.date === this.store.selectedDay())),
  );
  protected readonly trackWidth = computed(
    () => (this.axis().endHour - this.axis().startHour) * HOUR_PX,
  );
  protected readonly hourTicks = computed(() =>
    axisHours(this.axis()).map((hour) => ({
      hour,
      left: (hour - this.axis().startHour) * HOUR_PX,
    })),
  );

  /** Shift being resized with the pointer, with the end time shown so far. */
  private readonly resizing = signal<{ id: string; end: string } | null>(null);
  private resizeOrigin: { x: number; shift: Shift } | null = null;
  private lastDragEnd = 0;

  protected readonly never = (): boolean => false;

  // ---- text helpers used by the template ----
  protected nameOf(employee: Employee): string {
    return `${employee.firstName} ${employee.lastName}`;
  }

  protected rowName(row: GridRow): string {
    return row.employee
      ? this.nameOf(row.employee)
      : this.transloco.translate('schedule.grid.openShifts');
  }

  protected dayLong(date: string): string {
    return formatDay(date, this.lang(), { weekday: 'long', day: 'numeric', month: 'short' });
  }

  protected hoursParams(row: GridRow): { scheduled: string; contract: string } {
    return {
      scheduled: formatDuration(row.weeklyMinutes),
      contract: formatDuration(row.contractMinutes),
    };
  }

  protected paletteParams(template: ShiftTemplate): Record<string, string> {
    return { name: template.name, start: template.start, end: template.end };
  }

  protected teamColor(teamId: string): string {
    return this.store.teamsById().get(teamId)?.color ?? this.noColor;
  }

  protected teamName(teamId: string): string {
    return this.store.teamsById().get(teamId)?.name ?? '';
  }

  protected absenceColor(absence: AbsenceRequest): string {
    return dataTokens.absence[absence.type];
  }

  protected absenceText(absence: AbsenceRequest): string {
    const type =
      this.store.absenceTypes().find((t) => t.key === absence.type)?.name ?? absence.type;
    return this.transloco.translate(
      absence.status === 'pending' ? 'schedule.grid.absencePending' : 'schedule.grid.absence',
      { type },
    );
  }

  protected netLabel(shift: Shift): string {
    return formatDuration(shiftNetMinutes(shift));
  }

  protected endOf(shift: Shift): string {
    const resizing = this.resizing();
    return resizing?.id === shift.id ? resizing.end : shift.end;
  }

  protected chipName(shift: Shift): string {
    const template = templateFor(shift, this.store.templates());
    const times = `${shift.start}-${shift.end}`;
    return template ? `${template.name} ${times}` : times;
  }

  /** Minutes since midnight, for slider values. `00:00` as an end means midnight (1440). */
  protected minutesOf(time: string, isEnd = false): number {
    const minutes = toMinutes(time);
    return isEnd && minutes === 0 ? 1440 : minutes;
  }

  protected conflictCount(shift: Shift): number {
    return this.store.conflictsByShift().get(shift.id)?.length ?? 0;
  }

  protected conflictText(shift: Shift): string {
    return (this.store.conflictsByShift().get(shift.id) ?? [])
      .map((c) => this.transloco.translate(`schedule.conflicts.${c.messageKey}`))
      .join(' ');
  }

  /** "Early 07:00-15:00, 7h 30m, Sara Bakker, Monday 9 Nov, published, 1 conflict" */
  protected shiftLabel(shift: Shift): string {
    const t = (key: string, params?: Record<string, unknown>) =>
      this.transloco.translate(key, params);
    const employee = shift.employeeId
      ? this.store.employeesById().get(shift.employeeId)
      : undefined;
    const count = this.conflictCount(shift);
    const parts = [
      this.chipName(shift),
      formatDuration(shiftNetMinutes(shift)),
      employee ? this.nameOf(employee) : t('schedule.shift.openShift'),
      this.dayLong(shift.date),
      t(`schedule.shift.${shift.status}`).toLocaleLowerCase(this.lang()),
    ];
    if (count > 0) {
      parts.push(
        count === 1 ? t('schedule.shift.conflictOne') : t('schedule.shift.conflictMany', { count }),
      );
    }
    return parts.join(', ');
  }

  protected chipClasses(shift: Shift): string {
    return shift.status === 'draft'
      ? 'border-dashed border-border-overlay-strong bg-background-muted'
      : 'border-border bg-background-surface-page';
  }

  protected isSaving(shift: Shift): boolean {
    return this.store.savingIds().includes(shift.id);
  }

  protected canMove(shift: Shift): boolean {
    return this.canEdit() && !this.isSaving(shift);
  }

  protected canResize(shift: Shift): boolean {
    return this.canMove(shift) && !isOvernight(shift);
  }

  // ---- day view geometry ----
  protected box(shift: Shift): ShiftBox {
    const resizing = this.resizing();
    const shown = resizing?.id === shift.id ? { start: shift.start, end: resizing.end } : shift;
    return shiftBox(shown, this.axis(), PX_PER_MINUTE);
  }

  protected unavailable(row: GridRow, cell: GridCell): ShiftBox[] {
    if (!row.employee) return [];
    return unavailableBoxes(cell.availability ?? undefined, this.axis(), PX_PER_MINUTE);
  }

  // ---- opening the editor ----
  protected open(shift: Shift): void {
    // A click right after a drag ends is the end of the drag, not a request to edit.
    if (performance.now() - this.lastDragEnd < 250) return;
    this.editShift.emit(shift);
  }

  protected add(cell: GridCell): void {
    this.addShift.emit({ employeeId: cell.target.employeeId, date: cell.target.date });
  }

  protected addForRow(row: GridRow): void {
    const dates = this.store.visibleDates();
    const today = this.today();
    const date = this.isDay()
      ? (dates[0] ?? today)
      : dates.includes(today)
        ? today
        : (dates[0] ?? today);
    this.addShift.emit({ employeeId: row.employee?.id ?? null, date });
  }

  protected dragEnded(): void {
    this.lastDragEnd = performance.now();
  }

  // ---- drag and drop ----
  protected onWeekDrop(event: CdkDragDrop<DropTarget, unknown, Shift | ShiftTemplate>): void {
    const data = event.item.data;
    const target = event.container.data;
    event.item.reset();
    if (!event.isPointerOverContainer) return;
    if (isShift(data)) {
      if (event.previousContainer === event.container) return;
      void this.store.moveShift(data.id, moveToTarget(data, target, this.store.employeesById()));
    } else {
      void this.store.applyTemplate(data.id, target);
    }
  }

  protected onDayDrop(event: CdkDragDrop<DropTarget, unknown, Shift | ShiftTemplate>): void {
    const data = event.item.data;
    const target = event.container.data;
    event.item.reset();
    if (!event.isPointerOverContainer) return;
    if (isShift(data)) {
      const delta = deltaMinutesFromPixels(event.distance.x, PX_PER_MINUTE);
      const moved = moveToTarget(data, target, this.store.employeesById(), delta);
      const unchanged =
        moved.employeeId === data.employeeId &&
        moved.date === data.date &&
        moved.start === data.start &&
        moved.end === data.end;
      if (!unchanged) void this.store.moveShift(data.id, moved);
    } else {
      const track = event.container.element.nativeElement.getBoundingClientRect();
      const start = timeFromOffset(event.dropPoint.x - track.left, this.axis(), PX_PER_MINUTE);
      void this.store.applyTemplate(data.id, target, start);
    }
  }

  // ---- resizing the end of a shift ----
  protected startResize(event: PointerEvent, shift: Shift): void {
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    this.resizeOrigin = { x: event.clientX, shift };
    this.resizing.set({ id: shift.id, end: shift.end });
  }

  protected moveResize(event: PointerEvent): void {
    const origin = this.resizeOrigin;
    if (!origin) return;
    const delta = deltaMinutesFromPixels(event.clientX - origin.x, PX_PER_MINUTE);
    this.resizing.set({ id: origin.shift.id, end: resizeEnd(origin.shift, delta) });
  }

  protected endResize(): void {
    const origin = this.resizeOrigin;
    const preview = this.resizing();
    this.cancelResize();
    if (origin && preview && preview.end !== origin.shift.end) {
      void this.store.resizeShift(origin.shift.id, preview.end);
    }
  }

  protected cancelResize(): void {
    this.resizeOrigin = null;
    this.resizing.set(null);
  }

  /** Arrow keys change the end by 15 minutes, the same step as dragging. */
  protected resizeKey(event: KeyboardEvent, shift: Shift): void {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowUp'
        ? 15
        : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
          ? -15
          : 0;
    if (step === 0) return;
    event.preventDefault();
    void this.store.resizeShift(shift.id, resizeEnd(shift, step));
  }
}
