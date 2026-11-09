import { format, isValid, parse } from 'date-fns';

export const ISO_DATE = 'yyyy-MM-dd';

/** Local calendar date to `yyyy-MM-dd`. */
export function toIso(date: Date): string {
  return format(date, ISO_DATE);
}

/** Parses `yyyy-MM-dd` strictly. Returns null for empty, malformed or impossible dates (2026-02-30). */
export function fromIso(text: string | null | undefined): Date | null {
  if (!text) return null;
  const date = parse(text, ISO_DATE, new Date(0));
  return isValid(date) && toIso(date) === text ? date : null;
}
