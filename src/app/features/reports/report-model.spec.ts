import type { ReportResult } from '@core/api/models';
import {
  buildTableRows,
  isEmptyReport,
  isValidRange,
  presetRange,
  reportFilename,
} from './report-model';

const result: ReportResult = {
  from: '2026-11-02',
  to: '2026-11-08',
  rows: [
    { teamId: 'a', teamName: 'Floor', hours: 100.456, scheduledHours: 96, laborCostCents: 150_050 },
    { teamId: 'b', teamName: 'Kitchen', hours: 40, scheduledHours: 44.5, laborCostCents: 60_000 },
  ],
  daily: [],
};

describe('presetRange', () => {
  it('returns Monday to Sunday for this week', () => {
    expect(presetRange('this-week', '2026-11-11')).toEqual({
      from: '2026-11-09',
      to: '2026-11-15',
    });
  });

  it('returns the 28 days that end today', () => {
    expect(presetRange('last-4-weeks', '2026-11-09')).toEqual({
      from: '2026-10-13',
      to: '2026-11-09',
    });
  });

  it('returns the whole calendar month, also in February of a leap year', () => {
    expect(presetRange('this-month', '2026-11-09')).toEqual({
      from: '2026-11-01',
      to: '2026-11-30',
    });
    expect(presetRange('this-month', '2028-02-10')).toEqual({
      from: '2028-02-01',
      to: '2028-02-29',
    });
  });
});

describe('isValidRange', () => {
  it('needs both dates in order', () => {
    expect(isValidRange({ from: '2026-11-01', to: '2026-11-01' })).toBe(true);
    expect(isValidRange({ from: '2026-11-02', to: '2026-11-01' })).toBe(false);
    expect(isValidRange({ from: '', to: '2026-11-01' })).toBe(false);
  });
});

describe('buildTableRows', () => {
  it('rounds hours, computes the difference and appends totals', () => {
    const rows = buildTableRows(result);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      workedHours: 100.46,
      scheduledHours: 96,
      differenceHours: 4.46,
    });
    expect(rows[1]).toMatchObject({ differenceHours: -4.5 });
    expect(rows[2]).toMatchObject({
      total: true,
      workedHours: 140.46,
      scheduledHours: 140.5,
      differenceHours: -0.04,
      laborCostCents: 210_050,
    });
  });

  it('limits the rows and totals to the chosen teams', () => {
    const rows = buildTableRows(result, ['b']);
    expect(rows.map((r) => r.teamId)).toEqual(['b', 'total']);
    expect(rows[1]).toMatchObject({ workedHours: 40, laborCostCents: 60_000 });
  });
});

describe('isEmptyReport / reportFilename', () => {
  it('detects a report without hours or cost', () => {
    const empty = buildTableRows({
      ...result,
      rows: [{ ...result.rows[0]!, hours: 0, scheduledHours: 0, laborCostCents: 0 }],
    });
    expect(isEmptyReport(empty)).toBe(true);
    expect(isEmptyReport(buildTableRows(result))).toBe(false);
  });

  it('names the file after the period', () => {
    expect(reportFilename({ from: '2026-11-02', to: '2026-11-08' })).toBe(
      'ng-runway-report-2026-11-02-2026-11-08.csv',
    );
  });
});
