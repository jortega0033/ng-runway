import type { AbsenceBalance, AbsenceStatus, AbsenceTypeKey, Employee } from '@core/api/models';
import { workingDays } from '@core/domain/balances';
import type { BadgeVariant } from '@ui/badge/badge';

/** Pure helpers for the absences feature: no Angular, no HTTP, fully unit-tested. */

export const STATUS_VARIANT: Record<AbsenceStatus, BadgeVariant> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
};

/** Types an employee can ask for. Public holidays and availability are managed elsewhere. */
export const REQUESTABLE_TYPES: readonly AbsenceTypeKey[] = [
  'vacation',
  'sick',
  'special-leave',
  'maternity-leave',
  'parental-leave',
  'short-term-care-leave',
  'long-term-care-leave',
  'unpaid-leave',
];

export function isRangeValid(startDate: string, endDate: string): boolean {
  return !!startDate && !!endDate && endDate >= startDate;
}

export interface RequestPreview {
  /** Working days (Monday to Friday) the request would use. `0` while the dates are incomplete. */
  days: number;
  /** `null` when the type has no yearly entitlement. */
  remainingBefore: number | null;
  remainingAfter: number | null;
  entitlementDays: number | null;
  /** True when the request is longer than what is left. A warning, not a blocker. */
  exceeds: boolean;
}

/**
 * What a request would cost: its working days and the balance that would remain afterwards.
 * `balance` is the employee's balance for the chosen type, or `null` for types without one.
 * Pending requests already reserve their days in `balance.remainingDays`.
 */
export function previewRequest(
  startDate: string,
  endDate: string,
  balance: AbsenceBalance | null | undefined,
): RequestPreview {
  const days = isRangeValid(startDate, endDate) ? workingDays(startDate, endDate) : 0;
  if (!balance) {
    return {
      days,
      remainingBefore: null,
      remainingAfter: null,
      entitlementDays: null,
      exceeds: false,
    };
  }
  const remainingAfter = balance.remainingDays - days;
  return {
    days,
    remainingBefore: balance.remainingDays,
    remainingAfter,
    entitlementDays: balance.entitlementDays,
    exceeds: remainingAfter < 0,
  };
}

export interface BalanceBar {
  usedPercent: number;
  pendingPercent: number;
}

/** Widths for the balance bar as percentages of the entitlement, capped so the bar never overflows. */
export function balanceBar(balance: AbsenceBalance): BalanceBar {
  if (balance.entitlementDays <= 0) return { usedPercent: 0, pendingPercent: 0 };
  const percent = (days: number) =>
    Math.min(100, Math.max(0, (days / balance.entitlementDays) * 100));
  const usedPercent = percent(balance.usedDays);
  const pendingPercent = Math.min(100 - usedPercent, percent(balance.pendingDays));
  return { usedPercent, pendingPercent };
}

/** "Sara B." for chips in a crowded calendar cell. */
export function shortName(employee: Pick<Employee, 'firstName' | 'lastName'>): string {
  const initial = employee.lastName.trim().charAt(0);
  return initial ? `${employee.firstName} ${initial}.` : employee.firstName;
}

/** Newest first, so upcoming and recent requests come before old ones. */
export function sortByStartDesc<T extends { startDate: string; id: string }>(
  items: readonly T[],
): T[] {
  return [...items].sort(
    (a, b) => b.startDate.localeCompare(a.startDate) || a.id.localeCompare(b.id),
  );
}
