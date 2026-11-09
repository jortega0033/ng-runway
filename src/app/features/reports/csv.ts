export interface CsvColumn<T> {
  readonly header: string;
  readonly value: (row: T) => string | number | null | undefined;
}

/** Excel needs this marker at the start to read the file as UTF-8 (names with accents). */
export const CSV_BOM = '﻿';

const FORMULA_START = /^[=+\-@\t\r]/;
// A signed number written as text ("-1.50", "+2") is data, not a formula.
const PLAIN_NUMBER = /^[+-]?\d+(\.\d+)?$/;

/**
 * Wraps a field in quotes when it holds a delimiter, a quote or a line break. Quotes are doubled.
 * Text that starts with = + - @ (or a tab or CR) gets a leading apostrophe, so a spreadsheet shows
 * it as text instead of running it as a formula. Numbers are left alone (-1.5 stays a number).
 */
export function escapeCsvField(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (typeof value === 'string' && FORMULA_START.test(text) && !PLAIN_NUMBER.test(text))
    text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Builds CSV text (comma separated, CRLF line ends, UTF-8 BOM) from rows and column definitions. */
export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const lines = [
    columns.map((c) => escapeCsvField(c.header)).join(','),
    ...rows.map((row) => columns.map((c) => escapeCsvField(c.value(row))).join(',')),
  ];
  return CSV_BOM + lines.join('\r\n') + '\r\n';
}

/** Saves text as a file through a temporary link. Browser only. */
export function downloadTextFile(
  doc: Document,
  filename: string,
  content: string,
  type = 'text/csv;charset=utf-8',
): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = doc.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  doc.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
