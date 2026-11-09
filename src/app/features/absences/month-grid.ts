import type { AbsenceRequest, AbsenceStatus, AbsenceTypeKey } from '@core/api/models';
import { addDays, weekdayIndex } from '@core/domain/time';

/** One absence on one day of the calendar. */
export interface CalendarEntry {
  requestId: string;
  employeeId: string;
  type: AbsenceTypeKey;
  status: AbsenceStatus;
}

export interface CalendarDay {
  date: string;
  /** False for the leading and trailing days that only complete the first and last week. */
  inMonth: boolean;
  isWeekend: boolean;
  entries: CalendarEntry[];
}

export interface MonthGrid {
  year: number;
  /** 1 to 12. */
  month: number;
  /** Full weeks, Monday first. */
  weeks: CalendarDay[][];
  /** First and last date shown, for loading the absences that overlap the grid. */
  from: string;
  to: string;
}

export interface GridOptions {
  /** Pending requests are shown to managers; employees only see approved ones. */
  includePending: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function firstOfMonth(year: number, month: number): string {
  return `${year}-${pad(month)}-01`;
}

export function lastOfMonth(year: number, month: number): string {
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad(month)}-${pad(days)}`;
}

/** Month `delta` months away, wrapping the year. */
export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/**
 * Builds the month as full Monday-first weeks. Every absence that covers a day is listed on
 * that day, rejected requests are left out, and entries are ordered by employee so the cells
 * are stable between renders.
 */
export function buildMonthGrid(
  year: number,
  month: number,
  absences: readonly AbsenceRequest[],
  options: GridOptions,
): MonthGrid {
  const first = firstOfMonth(year, month);
  const last = lastOfMonth(year, month);
  const from = addDays(first, -weekdayIndex(first));
  const to = addDays(last, 6 - weekdayIndex(last));

  const visible = absences.filter(
    (a) => a.status === 'approved' || (options.includePending && a.status === 'pending'),
  );

  const weeks: CalendarDay[][] = [];
  for (let start = from; start <= to; start = addDays(start, 7)) {
    const week: CalendarDay[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(start, i);
      const entries = visible
        .filter((a) => a.startDate <= date && a.endDate >= date)
        .map<CalendarEntry>((a) => ({
          requestId: a.id,
          employeeId: a.employeeId,
          type: a.type,
          status: a.status,
        }))
        .sort(
          (a, b) =>
            a.employeeId.localeCompare(b.employeeId) || a.requestId.localeCompare(b.requestId),
        );
      week.push({
        date,
        inMonth: date >= first && date <= last,
        isWeekend: i >= 5,
        entries,
      });
    }
    weeks.push(week);
  }
  return { year, month, weeks, from, to };
}
