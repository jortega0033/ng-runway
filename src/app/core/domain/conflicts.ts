import type { AbsenceRequest, Employee, Shift } from '../api/models';
import { shiftNetMinutes } from './hours';
import { absoluteRange, addDays, startOfWeek, toMinutes, weekdayIndex } from './time';

export type ConflictType = 'overlap' | 'absence' | 'unavailable' | 'over-hours';

export interface Conflict {
  type: ConflictType;
  /** Transloco key suffix under `schedule.conflicts.*`. */
  messageKey: string;
  /** Other shift or absence involved, when there is one. */
  relatedId?: string;
}

export interface ConflictInput {
  /** The shift being created or moved. */
  shift: Pick<Shift, 'id' | 'employeeId' | 'date' | 'start' | 'end' | 'breakMinutes'>;
  employee: Employee | undefined;
  /** All known shifts (the shift itself may be in here; it is ignored by id). */
  shifts: readonly Shift[];
  absences: readonly AbsenceRequest[];
}

/** Do two [start, end) ranges overlap? Touching ranges do not overlap. */
function overlaps(a: [number, number], b: [number, number]): boolean {
  return a[0] < b[1] && b[0] < a[1];
}

/**
 * Finds problems with putting `shift` on `employee`. Open shifts (no employee) have no conflicts.
 * Pure function: the schedule store calls it, and so do tests.
 */
export function detectConflicts({ shift, employee, shifts, absences }: ConflictInput): Conflict[] {
  if (!shift.employeeId || !employee) return [];
  const result: Conflict[] = [];
  const mine = absoluteRange(shift.date, shift.start, shift.end);

  // 1. Overlap with another shift of the same person.
  for (const other of shifts) {
    if (other.id === shift.id || other.employeeId !== shift.employeeId) continue;
    if (overlaps(mine, absoluteRange(other.date, other.start, other.end))) {
      result.push({ type: 'overlap', messageKey: 'overlap', relatedId: other.id });
    }
  }

  // 2. Approved or pending absence covering that date.
  const absence = absences.find(
    (a) =>
      a.employeeId === shift.employeeId &&
      a.status !== 'rejected' &&
      a.startDate <= shift.date &&
      a.endDate >= shift.date,
  );
  if (absence) result.push({ type: 'absence', messageKey: 'absence', relatedId: absence.id });

  // 3. Outside the weekday availability window.
  const availability = employee.availability[weekdayIndex(shift.date)];
  if (!availability) {
    result.push({ type: 'unavailable', messageKey: 'unavailableDay' });
  } else if (
    toMinutes(shift.start) < toMinutes(availability.from) ||
    toMinutes(shift.end) > toMinutes(availability.to) ||
    toMinutes(shift.end) <= toMinutes(shift.start)
  ) {
    result.push({ type: 'unavailable', messageKey: 'unavailableHours' });
  }

  // 4. Weekly hours above the contract.
  const weekStart = startOfWeek(shift.date);
  const weekEnd = addDays(weekStart, 6);
  const others = shifts.filter(
    (s) =>
      s.id !== shift.id &&
      s.employeeId === shift.employeeId &&
      s.date >= weekStart &&
      s.date <= weekEnd,
  );
  const minutes = others.reduce((sum, s) => sum + shiftNetMinutes(s), 0) + shiftNetMinutes(shift);
  if (minutes > employee.contract.hoursPerWeek * 60) {
    result.push({ type: 'over-hours', messageKey: 'overHours' });
  }

  return result;
}
