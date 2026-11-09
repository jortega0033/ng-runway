/** "Mon 9 Nov" / "ma 9 nov." from an ISO `yyyy-MM-dd` date. Pure: the locale is passed in. */
export function formatDay(iso: string, locale: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)));
}

/** A period like "9 Nov - 13 Nov", or a single day when both ends are the same. */
export function formatPeriod(start: string, end: string, locale: string): string {
  const short = (iso: string): string => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)));
  };
  return start === end ? short(start) : `${short(start)} - ${short(end)}`;
}
