import type { ClockEntry, Shift, TimesheetStatus } from '@core/api/models';
import { formatDuration, shiftNetMinutes, workedMinutes } from '@core/domain/hours';
import { addDays, weekDates } from '@core/domain/time';
import type { BadgeVariant } from '@ui/badge/badge';

/** Pure helpers for the timesheets feature: no Angular, no HTTP, fully unit-tested. */

export type ClockStatus = 'out' | 'working' | 'break';

export const STATUS_VARIANT: Record<TimesheetStatus, BadgeVariant> = {
  open: 'neutral',
  submitted: 'warning',
  approved: 'success',
  rejected: 'danger',
};

/** Where the employee is right now, derived from their open clock entry. */
export function clockStatus(entry: ClockEntry | null): ClockStatus {
  if (!entry || entry.clockOut !== null) return 'out';
  return entry.breaks.some((b) => b.end === null) ? 'break' : 'working';
}

function secondsBetween(fromMs: number, toMs: number): number {
  return Math.max(0, Math.floor((toMs - fromMs) / 1000));
}

/**
 * Seconds on the clock minus breaks. A running break counts up to `nowMs`, so while the
 * employee is on break this value stays constant: the live counter pauses by itself.
 */
export function workedSeconds(entry: ClockEntry, nowMs: number): number {
  const end = entry.clockOut ? Date.parse(entry.clockOut) : nowMs;
  const total = secondsBetween(Date.parse(entry.clockIn), end);
  const breaks = entry.breaks.reduce(
    (sum, b) => sum + secondsBetween(Date.parse(b.start), b.end ? Date.parse(b.end) : end),
    0,
  );
  return Math.max(0, total - breaks);
}

/** Seconds the running break has lasted, `0` when no break is running. */
export function runningBreakSeconds(entry: ClockEntry, nowMs: number): number {
  const running = entry.breaks.find((b) => b.end === null);
  return running ? secondsBetween(Date.parse(running.start), nowMs) : 0;
}

/** Total break time of an entry in whole minutes. */
export function breakMinutes(entry: ClockEntry, now: Date = new Date()): number {
  const end = entry.clockOut ? Date.parse(entry.clockOut) : now.getTime();
  const seconds = entry.breaks.reduce(
    (sum, b) => sum + secondsBetween(Date.parse(b.start), b.end ? Date.parse(b.end) : end),
    0,
  );
  return Math.floor(seconds / 60);
}

/** `HH:mm:ss` for the live counter. Hours are not capped at 24. */
export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

/** "+1h 30m", "-0h 45m" or "0h". The sign is text, so it never relies on color. */
export function formatSignedDuration(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded === 0) return '0h';
  return `${rounded > 0 ? '+' : '-'}${formatDuration(Math.abs(rounded))}`;
}

/**
 * "Now" as seen by one entry. An entry that is still open counts up to `now`, but never past the
 * end of its own day: a clock-out that was forgotten yesterday must not keep adding hours today.
 * Closed entries do not use `now`, so they get it back unchanged.
 */
export function cappedNow(entry: ClockEntry, now: Date): Date {
  if (entry.clockOut !== null) return now;
  const endOfDay = new Date(`${addDays(entry.date, 1)}T00:00:00`);
  return endOfDay.getTime() < now.getTime() ? endOfDay : now;
}

export interface DayRow {
  date: string;
  shifts: Shift[];
  entries: ClockEntry[];
  scheduledMinutes: number;
  /** Rejected entries are listed but do not count as worked time. */
  workedMinutes: number;
  /** Worked minus scheduled. */
  differenceMinutes: number;
}

export interface WeekSummary {
  days: DayRow[];
  scheduledMinutes: number;
  workedMinutes: number;
  contractMinutes: number;
  /** Worked minus scheduled. */
  differenceMinutes: number;
  /** Worked minus contract hours. */
  contractDifferenceMinutes: number;
}

/**
 * One employee's week: scheduled time from published shifts against worked time from clock
 * entries, per day and in total. `shifts` and `entries` may contain other dates; they are
 * filtered to the week here.
 */
export function buildWeek(
  weekStart: string,
  shifts: readonly Shift[],
  entries: readonly ClockEntry[],
  contractHoursPerWeek: number,
  now: Date = new Date(),
): WeekSummary {
  const days = weekDates(weekStart).map<DayRow>((date) => {
    const dayShifts = shifts
      .filter((s) => s.date === date && s.status === 'published')
      .sort((a, b) => a.start.localeCompare(b.start));
    const dayEntries = entries
      .filter((e) => e.date === date)
      .sort((a, b) => a.clockIn.localeCompare(b.clockIn));
    const scheduled = dayShifts.reduce((sum, s) => sum + shiftNetMinutes(s), 0);
    const worked = dayEntries
      .filter((e) => e.status !== 'rejected')
      .reduce((sum, e) => sum + workedMinutes(e, cappedNow(e, now)), 0);
    return {
      date,
      shifts: dayShifts,
      entries: dayEntries,
      scheduledMinutes: scheduled,
      workedMinutes: worked,
      differenceMinutes: worked - scheduled,
    };
  });
  const scheduledMinutes = days.reduce((sum, d) => sum + d.scheduledMinutes, 0);
  const worked = days.reduce((sum, d) => sum + d.workedMinutes, 0);
  const contractMinutes = Math.round(contractHoursPerWeek * 60);
  return {
    days,
    scheduledMinutes,
    workedMinutes: worked,
    contractMinutes,
    differenceMinutes: worked - scheduledMinutes,
    contractDifferenceMinutes: worked - contractMinutes,
  };
}

/** Monday of the week `offset` weeks away from `weekStart`. */
export function shiftWeek(weekStart: string, offset: number): string {
  return addDays(weekStart, offset * 7);
}

/**
 * Optimistic result of reviewing entries: the reviewed rows take the new status and comment,
 * then rows that no longer match the status filter drop out of the list.
 */
export function applyReview(
  entries: readonly ClockEntry[],
  ids: ReadonlySet<string>,
  status: 'approved' | 'rejected',
  comment: string,
  statusFilter: TimesheetStatus | '',
): ClockEntry[] {
  return entries
    .map((e) => (ids.has(e.id) ? { ...e, status, comment } : e))
    .filter((e) => !statusFilter || e.status === statusFilter);
}

/**
 * Puts entries whose review failed back into the list after an optimistic update,
 * in the order they had before. Rows that are still in the list are reset to their old state.
 * `matches` is the filter that applies now (it may differ from the one the review started
 * under): an entry that no longer belongs in the list is not put back.
 */
export function restoreEntries(
  current: readonly ClockEntry[],
  before: readonly ClockEntry[],
  failedIds: ReadonlySet<string>,
  matches: (entry: ClockEntry) => boolean = () => true,
): ClockEntry[] {
  if (failedIds.size === 0) return [...current];
  const original = new Map(before.map((e) => [e.id, e]));
  const merged = new Map(current.map((e) => [e.id, e]));
  for (const id of failedIds) {
    const entry = original.get(id);
    if (entry && matches(entry)) merged.set(id, entry);
  }
  const order = new Map(before.map((e, i) => [e.id, i]));
  return [...merged.values()].sort(
    (a, b) =>
      (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  );
}
