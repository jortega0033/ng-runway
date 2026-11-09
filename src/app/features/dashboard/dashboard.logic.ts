import type { Employee, Shift } from '@core/api/models';
import { addDays, todayIso } from '@core/domain/time';

/** "14:05" from a Date, in local time. */
export function timeOfDay(now: Date): string {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/**
 * Whether a shift is already over. A shift that ends after midnight (end <= start) counts as
 * running for the whole day it starts on, which is good enough for a "next shifts" list.
 */
export function shiftIsOver(shift: Pick<Shift, 'date' | 'start' | 'end'>, now: Date): boolean {
  const today = todayIso(now);
  if (shift.date !== today) return shift.date < today;
  return shift.end > shift.start && shift.end <= timeOfDay(now);
}

function byStart(a: Pick<Shift, 'date' | 'start'>, b: Pick<Shift, 'date' | 'start'>): number {
  return a.date.localeCompare(b.date) || a.start.localeCompare(b.start);
}

/** The employee's next published shifts that are not over yet, soonest first. */
export function upcomingShifts(
  shifts: readonly Shift[],
  employeeId: string,
  now: Date,
  limit = 5,
): Shift[] {
  return shifts
    .filter((s) => s.employeeId === employeeId && s.status === 'published' && !shiftIsOver(s, now))
    .sort(byStart)
    .slice(0, limit);
}

export type DayRelation = 'today' | 'tomorrow' | 'later';

export function dayRelation(date: string, now: Date): DayRelation {
  const today = todayIso(now);
  if (date === today) return 'today';
  return date === addDays(today, 1) ? 'tomorrow' : 'later';
}

export interface WeekProgress {
  /** 0-100, capped. The bar never overflows. */
  percent: number;
  /** More planned than the contract says. */
  over: boolean;
  scheduledMinutes: number;
  contractMinutes: number;
}

export function weekProgress(scheduledMinutes: number, contractHours: number): WeekProgress {
  const contractMinutes = Math.max(0, Math.round(contractHours * 60));
  const percent =
    contractMinutes === 0
      ? 0
      : Math.min(100, Math.round((scheduledMinutes / contractMinutes) * 100));
  return {
    percent,
    over: contractMinutes > 0 && scheduledMinutes > contractMinutes,
    scheduledMinutes,
    contractMinutes,
  };
}

export interface MemberOnShift {
  employee: Employee;
  shifts: Shift[];
}

/** Team members who have a published shift in `shifts`, ordered by when they start. */
export function teamOnShift(
  employees: readonly Employee[],
  shifts: readonly Shift[],
): MemberOnShift[] {
  const byId = new Map(employees.map((e) => [e.id, e]));
  const grouped = new Map<string, MemberOnShift>();
  for (const shift of [...shifts].sort(byStart)) {
    if (shift.status !== 'published' || !shift.employeeId) continue;
    const employee = byId.get(shift.employeeId);
    if (!employee) continue;
    const entry = grouped.get(employee.id) ?? { employee, shifts: [] };
    entry.shifts.push(shift);
    grouped.set(employee.id, entry);
  }
  return [...grouped.values()];
}

/** "08:00 - 16:30" for one shift. */
export function timeRange(shift: Pick<Shift, 'start' | 'end'>): string {
  return `${shift.start} - ${shift.end}`;
}
