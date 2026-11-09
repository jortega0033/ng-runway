/** Display formatting for calendar dates (`yyyy-MM-dd`). Noon avoids any day shift from DST. */

function date(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

export function formatDay(
  value: string,
  locale: string,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
): string {
  return new Intl.DateTimeFormat(locale, options).format(date(value));
}

/** "9 Nov - 13 Nov 2026", or a single date when the request is for one day. */
export function formatDateRange(start: string, end: string, locale: string): string {
  if (start === end) return formatDay(start, locale);
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const from = formatDay(
    start,
    locale,
    sameYear
      ? { day: 'numeric', month: 'short' }
      : { day: 'numeric', month: 'short', year: 'numeric' },
  );
  return `${from} - ${formatDay(end, locale)}`;
}

export function formatMonth(year: number, month: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, 1, 12),
  );
}
