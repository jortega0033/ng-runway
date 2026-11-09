/** Display helpers. Pure: pass the locale (`en`, `nl`) in, nothing is read from the environment. */

function utcDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}

/** "9 Nov 2026" / "9 nov. 2026" from an ISO `yyyy-MM-dd` date. */
export function formatDate(
  iso: string,
  locale: string,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(utcDate(iso));
}

/** "Mon 9 Nov" for the week list. */
export function formatDay(iso: string, locale: string): string {
  return formatDate(iso, locale, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Euro amount from cents: 1850 becomes "EUR 18.50" in the locale's own style. */
export function formatEuro(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

/** Percent of `part` in `whole`, clamped to 0-100. An empty whole counts as 0. */
export function percentOf(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((part / whole) * 100)));
}
