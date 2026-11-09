import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  booleanAttribute,
  computed,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import {
  type Day,
  type Locale,
  addDays,
  addMonths,
  addYears,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { IconButtonComponent } from '../button/icon-button';
import { fromIso, toIso } from './date-utils';

interface DayCell {
  readonly date: Date;
  readonly iso: string;
  readonly label: string;
  readonly number: number;
  readonly outside: boolean;
  readonly disabled: boolean;
  readonly selected: boolean;
  readonly today: boolean;
}

let nextId = 0;

const DAY_BASE =
  'inline-flex size-8 items-center justify-center rounded-md text-base outline-offset-1 ' +
  'focus-visible:outline-2 focus-visible:outline-border-brand';

/**
 * Month grid following the ARIA date-picker grid pattern: one tab stop (the focused day), arrow
 * keys move by day and week, PageUp/PageDown by month (Shift: year), Home/End to week start/end,
 * Enter or Space selects. Days outside `min`/`max` are disabled and never receive focus.
 */
@Component({
  selector: 'ui-calendar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconButtonComponent],
  host: { class: 'block w-72 p-3' },
  template: `
    <div class="mb-2 flex items-center justify-between">
      <button
        ui-icon-button
        type="button"
        icon="chevron-left"
        size="sm"
        [label]="previousMonthLabel()"
        (click)="shiftMonth(-1)"
      ></button>
      <h2 [id]="headingId" class="font-title text-base font-semibold" aria-live="polite">
        {{ heading() }}
      </h2>

      <button
        ui-icon-button
        type="button"
        icon="chevron-right"
        size="sm"
        [label]="nextMonthLabel()"
        (click)="shiftMonth(1)"
      ></button>
    </div>
    <!-- eslint-disable-next-line @angular-eslint/template/interactive-supports-focus -->
    <table
      role="grid"
      class="w-full border-separate border-spacing-0.5 text-center"
      [attr.aria-labelledby]="headingId"
      (keydown)="onKeydown($event)"
    >
      <thead>
        <tr>
          @for (name of weekdays(); track name.full) {
            <th scope="col" class="pb-1 text-sm font-medium text-foreground-subtle">
              <abbr [attr.title]="name.full" class="no-underline">{{ name.short }}</abbr>
              <span class="sr-only">{{ name.full }}</span>
            </th>
          }
        </tr>
      </thead>
      <tbody>
        @for (week of weeks(); track week[0].iso) {
          <tr>
            @for (day of week; track day.iso) {
              <td role="gridcell" class="p-0" [attr.aria-selected]="day.selected">
                <button
                  type="button"
                  [class]="dayClasses(day)"
                  [attr.data-date]="day.iso"
                  [attr.aria-label]="day.label"
                  [attr.aria-current]="day.today ? 'date' : null"
                  [attr.aria-disabled]="day.disabled ? 'true' : null"
                  [disabled]="day.disabled"
                  [tabindex]="day.iso === focusIso() ? 0 : -1"
                  (click)="select(day)"
                >
                  {{ day.number }}
                </button>
              </td>
            }
          </tr>
        }
      </tbody>
    </table>
  `,
})
export class CalendarComponent {
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Selected date, `yyyy-MM-dd`, or empty. */
  readonly value = input('');
  readonly min = input('');
  readonly max = input('');
  /** 0 = Sunday, 1 = Monday. */
  readonly weekStartsOn = input<Day>(1);
  readonly locale = input<Locale | undefined>(undefined);
  /** Move focus to the active day once rendered (used when opened from a popover). */
  readonly autofocus = input(false, { transform: booleanAttribute });
  readonly previousMonthLabel = input('Previous month');
  readonly nextMonthLabel = input('Next month');
  readonly selected = output<string>();

  protected readonly headingId = `ui-calendar-${nextId++}`;
  private readonly today = startOfDay(new Date());

  private readonly minDate = computed(() => fromIso(this.min()));
  private readonly maxDate = computed(() => fromIso(this.max()));

  /** The day that owns the tab stop and the keyboard cursor. */
  private readonly focusDate = linkedSignal<Date>(() => {
    const date = fromIso(this.value()) ?? this.today;
    return this.clamp(date);
  });
  protected readonly focusIso = computed(() => toIso(this.focusDate()));
  private readonly viewMonth = computed(() => startOfMonth(this.focusDate()));

  protected readonly heading = computed(() =>
    format(this.viewMonth(), 'MMMM yyyy', { locale: this.locale() }),
  );

  protected readonly weekdays = computed(() => {
    const start = startOfWeek(this.today, {
      weekStartsOn: this.weekStartsOn(),
      locale: this.locale(),
    });
    return eachDayOfInterval({ start, end: addDays(start, 6) }).map((d) => ({
      short: format(d, 'EEEEEE', { locale: this.locale() }),
      full: format(d, 'EEEE', { locale: this.locale() }),
    }));
  });

  protected readonly weeks = computed<DayCell[][]>(() => {
    const options = { weekStartsOn: this.weekStartsOn(), locale: this.locale() };
    const month = this.viewMonth();
    const selected = fromIso(this.value());
    const days = eachDayOfInterval({
      start: startOfWeek(startOfMonth(month), options),
      end: endOfWeek(endOfMonth(month), options),
    });
    const cells = days.map<DayCell>((date) => ({
      date,
      iso: toIso(date),
      label: format(date, 'EEEE, d MMMM yyyy', { locale: this.locale() }),
      number: date.getDate(),
      outside: !isSameMonth(date, month),
      disabled: this.isDisabled(date),
      selected: selected !== null && isSameDay(date, selected),
      today: isSameDay(date, this.today),
    }));
    const rows: DayCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  });

  constructor() {
    afterNextRender(
      () => {
        if (this.autofocus()) this.focusActiveDay();
      },
      { injector: this.injector },
    );
  }

  /** Focuses the day button that owns the tab stop. */
  focusActiveDay(): void {
    this.host.nativeElement
      .querySelector<HTMLElement>(`button[data-date="${this.focusIso()}"]`)
      ?.focus();
  }

  protected dayClasses(day: DayCell): string {
    let state: string;
    if (day.disabled) {
      state = 'cursor-not-allowed text-foreground-disabled';
    } else if (day.selected) {
      state = 'bg-background-primary text-foreground-brand-inverted font-medium';
    } else {
      const tone = day.outside ? 'text-foreground-subtle' : 'text-foreground';
      state = `${tone} hover:bg-background-hover active:bg-background-press`;
    }
    const today = day.today && !day.selected ? ' border border-border-brand font-semibold' : '';
    return `${DAY_BASE} ${state}${today}`;
  }

  protected select(day: DayCell): void {
    if (day.disabled) return;
    this.selected.emit(day.iso);
  }

  protected shiftMonth(delta: number): void {
    this.moveTo(addMonths(this.focusDate(), delta), false);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const current = this.focusDate();
    const options = { weekStartsOn: this.weekStartsOn(), locale: this.locale() };
    let next: Date | null = null;
    switch (event.key) {
      case 'ArrowLeft':
        next = addDays(current, -1);
        break;
      case 'ArrowRight':
        next = addDays(current, 1);
        break;
      case 'ArrowUp':
        next = addDays(current, -7);
        break;
      case 'ArrowDown':
        next = addDays(current, 7);
        break;
      case 'PageUp':
        next = event.shiftKey ? addYears(current, -1) : addMonths(current, -1);
        break;
      case 'PageDown':
        next = event.shiftKey ? addYears(current, 1) : addMonths(current, 1);
        break;
      case 'Home':
        next = startOfWeek(current, options);
        break;
      case 'End':
        next = endOfWeek(current, options);
        break;
      case 'Enter':
      case ' ': {
        event.preventDefault();
        const cell = this.weeks()
          .flat()
          .find((d) => d.iso === this.focusIso());
        if (cell) this.select(cell);
        return;
      }
      default:
        return;
    }
    event.preventDefault();
    this.moveTo(next, true);
  }

  private moveTo(date: Date, focus: boolean): void {
    const target = this.clamp(date);
    this.focusDate.set(target);
    if (focus) afterNextRender(() => this.focusActiveDay(), { injector: this.injector });
  }

  private clamp(date: Date): Date {
    const min = this.minDate();
    const max = this.maxDate();
    if (min && date < min) return min;
    if (max && date > max) return max;
    return date;
  }

  private isDisabled(date: Date): boolean {
    const min = this.minDate();
    const max = this.maxDate();
    return (min !== null && date < min) || (max !== null && date > max);
  }
}
