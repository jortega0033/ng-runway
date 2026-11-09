/** Display formatting for times and dates. Clock entries are real instants, shown in local time. */

const pad = (n: number) => String(n).padStart(2, '0');

/** `HH:mm` in the viewer's time zone, empty for a missing value. */
export function formatTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A calendar date (`yyyy-MM-dd`) in the given locale. Noon avoids any day shift from DST. */
export function formatDate(
  date: string,
  locale: string,
  options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' },
): string {
  return new Intl.DateTimeFormat(locale, options).format(new Date(`${date}T12:00:00`));
}

/** "2 Nov - 8 Nov 2026" style label of a week. */
export function formatWeekRange(weekStart: string, weekEnd: string, locale: string): string {
  const short = formatDate(weekStart, locale, { day: 'numeric', month: 'short' });
  const long = formatDate(weekEnd, locale, { day: 'numeric', month: 'short', year: 'numeric' });
  return `${short} - ${long}`;
}
