import type { ClockEntry, Shift } from '../api/models';
import { addDays, spanMinutes } from './time';

/** Paid minutes of a shift: the span minus the unpaid break. Never negative. */
export function shiftNetMinutes(shift: Pick<Shift, 'start' | 'end' | 'breakMinutes'>): number {
  return Math.max(0, spanMinutes(shift.start, shift.end) - shift.breakMinutes);
}

/** Scheduled minutes for one employee in the week starting at `weekStart` (Monday). */
export function weeklyScheduledMinutes(
  shifts: readonly Shift[],
  employeeId: string,
  weekStart: string,
): number {
  const weekEnd = addDays(weekStart, 6);
  return shifts
    .filter((s) => s.employeeId === employeeId && s.date >= weekStart && s.date <= weekEnd)
    .reduce((sum, s) => sum + shiftNetMinutes(s), 0);
}

/** Minutes between two ISO date-times, rounded down. */
function minutesBetween(startIso: string, endIso: string): number {
  return Math.max(0, Math.floor((Date.parse(endIso) - Date.parse(startIso)) / 60_000));
}

/**
 * Worked minutes of a clock entry: time on the clock minus breaks.
 * Open entries and open breaks count up to `now`.
 */
export function workedMinutes(entry: ClockEntry, now: Date = new Date()): number {
  const nowIso = now.toISOString();
  const out = entry.clockOut ?? nowIso;
  const total = minutesBetween(entry.clockIn, out);
  const breaks = entry.breaks.reduce((sum, b) => sum + minutesBetween(b.start, b.end ?? out), 0);
  return Math.max(0, total - breaks);
}

export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

/** "7h 30m" style label for tables. */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, '0')}m`;
}
