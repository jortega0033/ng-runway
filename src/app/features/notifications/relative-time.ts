const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

type Unit = Intl.RelativeTimeFormatUnit;

/** The unit that reads best for a distance in seconds, and the value in that unit (rounded down). */
function pick(seconds: number): { value: number; unit: Unit } {
  const abs = Math.abs(seconds);
  const sign = Math.sign(seconds);
  if (abs < 45) return { value: 0, unit: 'second' };
  if (abs < HOUR) return { value: sign * Math.max(1, Math.floor(abs / MINUTE)), unit: 'minute' };
  if (abs < DAY) return { value: sign * Math.floor(abs / HOUR), unit: 'hour' };
  if (abs < 7 * DAY) return { value: sign * Math.floor(abs / DAY), unit: 'day' };
  if (abs < 30 * DAY) return { value: sign * Math.floor(abs / (7 * DAY)), unit: 'week' };
  if (abs < 365 * DAY) return { value: sign * Math.floor(abs / (30 * DAY)), unit: 'month' };
  return { value: sign * Math.floor(abs / (365 * DAY)), unit: 'year' };
}

/**
 * "5 minutes ago", "yesterday", "in 2 hours". Pure: pass `now` and the language so the result is
 * the same in tests and follows the active language in the app.
 */
export function relativeTime(iso: string, now: Date, locale: string): string {
  const seconds = (new Date(iso).getTime() - now.getTime()) / 1000;
  const { value, unit } = pick(seconds);
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(value, unit);
}
