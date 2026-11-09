import type { DayAvailability } from '@core/api/models';
import { toMinutes } from '@core/domain/time';

/** Keys of the seven weekdays, Monday first. They match `employees.weekdays.<key>` in the i18n file. */
export const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

/** One weekday in the form: a toggle plus the two times, which are kept while the toggle is off. */
export interface AvailabilityDayForm {
  available: boolean;
  from: string;
  to: string;
}

export const DEFAULT_FROM = '09:00';
export const DEFAULT_TO = '17:00';

/** Monday to Friday 09:00-17:00, weekend off. The starting point for a new employee. */
export function defaultWeek(): AvailabilityDayForm[] {
  return WEEKDAY_KEYS.map((_, index) => ({
    available: index < 5,
    from: DEFAULT_FROM,
    to: DEFAULT_TO,
  }));
}

export function dayToForm(day: DayAvailability | undefined): AvailabilityDayForm {
  return day
    ? { available: true, from: day.from, to: day.to }
    : { available: false, from: DEFAULT_FROM, to: DEFAULT_TO };
}

export function formToDay(day: AvailabilityDayForm): DayAvailability {
  return day.available ? { from: day.from, to: day.to } : null;
}

/** Always seven entries, Monday first, even when the API sends fewer. */
export function weekToForm(week: readonly DayAvailability[]): AvailabilityDayForm[] {
  return WEEKDAY_KEYS.map((_, index) => dayToForm(week[index]));
}

export function formToWeek(week: readonly AvailabilityDayForm[]): DayAvailability[] {
  return WEEKDAY_KEYS.map((_, index) => {
    const day = week[index];
    return day ? formToDay(day) : null;
  });
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

/** An available day needs two valid times and the end after the start (no overnight availability). */
export function dayError(day: AvailabilityDayForm): 'timeRequired' | 'timeOrder' | null {
  if (!day.available) return null;
  if (!isValidTime(day.from) || !isValidTime(day.to)) return 'timeRequired';
  return toMinutes(day.to) > toMinutes(day.from) ? null : 'timeOrder';
}

/** "09:00 - 17:00", or `fallback` when the employee is not available that day. */
export function dayLabel(day: DayAvailability | undefined, fallback: string): string {
  return day ? `${day.from} - ${day.to}` : fallback;
}

/** How many days of the week the employee can work. */
export function availableDays(week: readonly DayAvailability[]): number {
  return week.filter((day) => day !== null).length;
}
