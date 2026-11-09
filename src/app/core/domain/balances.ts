import type { AbsenceBalance, AbsenceRequest, AbsenceType } from '../api/models';
import { addDays, dayNumber, weekdayIndex } from './time';

/** Working days (Monday to Friday) between two dates, both included. */
export function workingDays(startDate: string, endDate: string): number {
  if (endDate < startDate) return 0;
  const total = dayNumber(endDate) - dayNumber(startDate) + 1;
  let count = 0;
  for (let i = 0; i < total; i++) {
    if (weekdayIndex(addDays(startDate, i)) < 5) count++;
  }
  return count;
}

/** Working days of a request that fall inside `year`. */
function daysInYear(request: Pick<AbsenceRequest, 'startDate' | 'endDate'>, year: number): number {
  const from = request.startDate > `${year}-01-01` ? request.startDate : `${year}-01-01`;
  const to = request.endDate < `${year}-12-31` ? request.endDate : `${year}-12-31`;
  return workingDays(from, to);
}

/**
 * Balance for one employee and absence type in one year.
 * remaining = entitlement - approved - pending, so a pending request already reserves its days.
 * Types without a yearly entitlement report 0 entitlement and a negative remaining only as "used".
 */
export function computeBalance(
  employeeId: string,
  type: AbsenceType,
  requests: readonly AbsenceRequest[],
  year: number,
): AbsenceBalance {
  const mine = requests.filter((r) => r.employeeId === employeeId && r.type === type.key);
  const usedDays = mine
    .filter((r) => r.status === 'approved')
    .reduce((sum, r) => sum + daysInYear(r, year), 0);
  const pendingDays = mine
    .filter((r) => r.status === 'pending')
    .reduce((sum, r) => sum + daysInYear(r, year), 0);
  const entitlementDays = type.yearlyDays ?? 0;
  return {
    employeeId,
    type: type.key,
    entitlementDays,
    usedDays,
    pendingDays,
    remainingDays: entitlementDays - usedDays - pendingDays,
  };
}
