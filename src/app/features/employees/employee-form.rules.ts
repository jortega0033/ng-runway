/**
 * Validation rules shared by both form variants (Signal Forms and Reactive Forms), so the two
 * can never disagree. A rule takes the raw string from the input and returns an error code or
 * `null`. The code is also the i18n key suffix: `employees.form.errors.<code>`.
 */
export type RuleCode =
  | 'required'
  | 'email'
  | 'number'
  | 'hoursRange'
  | 'rateRange'
  | 'date'
  | 'timeRequired'
  | 'timeOrder';

export const HOURS_MIN = 0;
export const HOURS_MAX = 60;
export const RATE_MAX_EUROS = 500;

/** Pragmatic address check: something@something.tld without spaces. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Reads "12.5" or "12,5" (Dutch keyboards). Returns `NaN` for anything else. */
export function parseDecimal(value: string): number {
  const text = value.trim().replace(',', '.');
  return /^\d+(\.\d+)?$/.test(text) ? Number(text) : Number.NaN;
}

export function requiredRule(value: string): RuleCode | null {
  return value.trim() === '' ? 'required' : null;
}

export function emailRule(value: string): RuleCode | null {
  const text = value.trim();
  if (text === '') return 'required';
  return EMAIL_PATTERN.test(text) ? null : 'email';
}

export function hoursPerWeekRule(value: string): RuleCode | null {
  if (value.trim() === '') return 'required';
  const hours = parseDecimal(value);
  if (Number.isNaN(hours)) return 'number';
  return hours >= HOURS_MIN && hours <= HOURS_MAX ? null : 'hoursRange';
}

export function hourlyRateRule(value: string): RuleCode | null {
  if (value.trim() === '') return 'required';
  const rate = parseDecimal(value);
  if (Number.isNaN(rate)) return 'number';
  return rate <= RATE_MAX_EUROS ? null : 'rateRange';
}

/** A real calendar date in `yyyy-MM-dd`. */
export function startDateRule(value: string): RuleCode | null {
  if (value.trim() === '') return 'required';
  if (!ISO_DATE_PATTERN.test(value)) return 'date';
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? null
    : 'date';
}
