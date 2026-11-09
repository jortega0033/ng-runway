/** Small, pure time helpers. Dates are `yyyy-MM-dd`, times are `HH:mm`. No Angular, no Date locale. */

export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function fromMinutes(total: number): string {
  const wrapped = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Days since 1970-01-01 for a `yyyy-MM-dd` string (UTC, so no DST surprises). */
export function dayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / 86_400_000);
}

export function addDays(date: string, days: number): string {
  const d = new Date((dayNumber(date) + days) * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** 0 = Monday ... 6 = Sunday. */
export function weekdayIndex(date: string): number {
  // 1970-01-01 was a Thursday (index 3).
  return (((dayNumber(date) + 3) % 7) + 7) % 7;
}

export function startOfWeek(date: string): string {
  return addDays(date, -weekdayIndex(date));
}

export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Minutes between start and end on the same schedule day. An end at or before the start means the next day. */
export function spanMinutes(start: string, end: string): number {
  const s = toMinutes(start);
  const e = toMinutes(end);
  return e > s ? e - s : e + 1440 - s;
}

/** Absolute [start, end) minute range of a shift, counted from 1970-01-01. */
export function absoluteRange(date: string, start: string, end: string): [number, number] {
  const from = dayNumber(date) * 1440 + toMinutes(start);
  return [from, from + spanMinutes(start, end)];
}
