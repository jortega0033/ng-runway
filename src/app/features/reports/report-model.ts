import type { ReportResult } from '@core/api/models';
import { addDays, startOfWeek } from '@core/domain/time';

export type RangePreset = 'this-week' | 'last-4-weeks' | 'this-month';

export interface DateRange {
  from: string;
  to: string;
}

/** One line of the report table. Hours are rounded to 2 decimals, cost stays in euro cents. */
export interface ReportTableRow {
  teamId: string;
  teamName: string;
  workedHours: number;
  scheduledHours: number;
  differenceHours: number;
  laborCostCents: number;
  total: boolean;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** `yyyy-MM-dd` of the last day of the month that contains `date`. */
function endOfMonth(date: string): string {
  const [y, m] = date.split('-').map(Number);
  const last = new Date(Date.UTC(y ?? 1970, m ?? 1, 0)).getUTCDate();
  return `${date.slice(0, 7)}-${String(last).padStart(2, '0')}`;
}

export function presetRange(preset: RangePreset, today: string): DateRange {
  switch (preset) {
    case 'this-week': {
      const from = startOfWeek(today);
      return { from, to: addDays(from, 6) };
    }
    case 'last-4-weeks':
      return { from: addDays(today, -27), to: today };
    case 'this-month':
      return { from: `${today.slice(0, 7)}-01`, to: endOfMonth(today) };
  }
}

export function isValidRange(range: DateRange): boolean {
  return range.from !== '' && range.to !== '' && range.from <= range.to;
}

/** Team rows (optionally limited to some teams) followed by one totals row. */
export function buildTableRows(
  result: ReportResult,
  teamIds: readonly string[] = [],
): ReportTableRow[] {
  const selected = teamIds.length ? new Set(teamIds) : null;
  const rows = result.rows
    .filter((row) => !selected || selected.has(row.teamId))
    .map<ReportTableRow>((row) => ({
      teamId: row.teamId,
      teamName: row.teamName,
      workedHours: round2(row.hours),
      scheduledHours: round2(row.scheduledHours),
      differenceHours: round2(row.hours - row.scheduledHours),
      laborCostCents: row.laborCostCents,
      total: false,
    }));
  const sum = (pick: (row: ReportTableRow) => number) => rows.reduce((s, r) => s + pick(r), 0);
  const worked = round2(sum((r) => r.workedHours));
  const scheduled = round2(sum((r) => r.scheduledHours));
  return [
    ...rows,
    {
      teamId: 'total',
      teamName: '',
      workedHours: worked,
      scheduledHours: scheduled,
      differenceHours: round2(worked - scheduled),
      laborCostCents: sum((r) => r.laborCostCents),
      total: true,
    },
  ];
}

/** True when a report has no hours and no cost at all. */
export function isEmptyReport(rows: readonly ReportTableRow[]): boolean {
  return rows.every((r) => r.workedHours === 0 && r.scheduledHours === 0 && r.laborCostCents === 0);
}

export function reportFilename(range: DateRange): string {
  return `ng-runway-report-${range.from}-${range.to}.csv`;
}
