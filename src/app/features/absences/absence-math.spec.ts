import type { AbsenceBalance, AbsenceRequest } from '@core/api/models';
import {
  balanceBar,
  isRangeValid,
  previewRequest,
  shortName,
  sortByStartDesc,
} from './absence-math';
import { buildMonthGrid, firstOfMonth, lastOfMonth, shiftMonth } from './month-grid';

const vacation: AbsenceBalance = {
  employeeId: 'emp-003',
  type: 'vacation',
  entitlementDays: 25,
  usedDays: 10,
  pendingDays: 5,
  remainingDays: 10,
};

function request(overrides: Partial<AbsenceRequest> = {}): AbsenceRequest {
  return {
    id: 'abs-1',
    employeeId: 'emp-003',
    type: 'vacation',
    startDate: '2026-11-09',
    endDate: '2026-11-11',
    status: 'approved',
    reason: '',
    comment: '',
    ...overrides,
  };
}

describe('previewRequest', () => {
  it('counts working days and the balance left afterwards', () => {
    // Monday to Friday, then the weekend is skipped.
    const preview = previewRequest('2026-11-09', '2026-11-16', vacation);
    expect(preview.days).toBe(6);
    expect(preview.remainingBefore).toBe(10);
    expect(preview.remainingAfter).toBe(4);
    expect(preview.entitlementDays).toBe(25);
    expect(preview.exceeds).toBe(false);
  });

  it('warns when the request is longer than the remaining balance', () => {
    const preview = previewRequest('2026-11-09', '2026-11-27', vacation);
    expect(preview.days).toBe(15);
    expect(preview.remainingAfter).toBe(-5);
    expect(preview.exceeds).toBe(true);
  });

  it('allows using exactly what is left', () => {
    const preview = previewRequest('2026-11-09', '2026-11-20', vacation);
    expect(preview.days).toBe(10);
    expect(preview.remainingAfter).toBe(0);
    expect(preview.exceeds).toBe(false);
  });

  it('shows no balance for types without an entitlement', () => {
    const preview = previewRequest('2026-11-09', '2026-11-10', null);
    expect(preview.days).toBe(2);
    expect(preview.remainingAfter).toBeNull();
    expect(preview.exceeds).toBe(false);
  });

  it('counts nothing while the dates are missing or reversed', () => {
    expect(previewRequest('', '', vacation).days).toBe(0);
    expect(previewRequest('2026-11-10', '2026-11-09', vacation).days).toBe(0);
    expect(previewRequest('2026-11-10', '2026-11-09', vacation).exceeds).toBe(false);
  });

  it('validates the date range: the end may be the same day, never earlier', () => {
    expect(isRangeValid('2026-11-09', '2026-11-09')).toBe(true);
    expect(isRangeValid('2026-11-09', '2026-11-08')).toBe(false);
    expect(isRangeValid('', '2026-11-08')).toBe(false);
  });
});

describe('balance bar and names', () => {
  it('splits the bar into used and pending shares', () => {
    expect(balanceBar(vacation)).toEqual({ usedPercent: 40, pendingPercent: 20 });
  });

  it('never overflows the bar when more is used than the entitlement', () => {
    const bar = balanceBar({ ...vacation, usedDays: 30, pendingDays: 5 });
    expect(bar.usedPercent).toBe(100);
    expect(bar.pendingPercent).toBe(0);
    expect(balanceBar({ ...vacation, entitlementDays: 0 })).toEqual({
      usedPercent: 0,
      pendingPercent: 0,
    });
  });

  it('shortens names for calendar chips', () => {
    expect(shortName({ firstName: 'Sara', lastName: 'Bakker' })).toBe('Sara B.');
    expect(shortName({ firstName: 'Cher', lastName: '' })).toBe('Cher');
  });

  it('sorts requests with the newest start date first', () => {
    const sorted = sortByStartDesc([
      request({ id: 'a', startDate: '2026-01-05' }),
      request({ id: 'b', startDate: '2026-11-05' }),
    ]);
    expect(sorted.map((r) => r.id)).toEqual(['b', 'a']);
  });
});

describe('buildMonthGrid', () => {
  it('builds full Monday-first weeks around the month', () => {
    // 1 November 2026 is a Sunday, 30 November a Monday.
    const grid = buildMonthGrid(2026, 11, [], { includePending: false });
    expect(grid.weeks).toHaveLength(6);
    expect(grid.weeks.every((w) => w.length === 7)).toBe(true);
    expect(grid.from).toBe('2026-10-26');
    expect(grid.to).toBe('2026-12-06');
    expect(grid.weeks[0]?.[0]?.date).toBe('2026-10-26');
    expect(grid.weeks[0]?.[0]?.inMonth).toBe(false);
    expect(grid.weeks[0]?.[6]).toMatchObject({
      date: '2026-11-01',
      inMonth: true,
      isWeekend: true,
    });
    expect(grid.weeks[5]?.[0]).toMatchObject({
      date: '2026-11-30',
      inMonth: true,
      isWeekend: false,
    });
  });

  it('uses exactly four weeks for a month that starts on Monday and ends on Sunday', () => {
    const grid = buildMonthGrid(2027, 2, [], { includePending: false });
    expect(grid.weeks).toHaveLength(4);
    expect(grid.from).toBe('2027-02-01');
    expect(grid.to).toBe('2027-02-28');
  });

  it('lists an absence on every day it covers, across the week boundary', () => {
    const grid = buildMonthGrid(
      2026,
      11,
      [request({ startDate: '2026-11-13', endDate: '2026-11-17' })],
      { includePending: false },
    );
    const days = grid.weeks.flat().filter((d) => d.entries.length > 0);
    expect(days.map((d) => d.date)).toEqual([
      '2026-11-13',
      '2026-11-14',
      '2026-11-15',
      '2026-11-16',
      '2026-11-17',
    ]);
  });

  it('shows pending requests only when asked and never rejected ones', () => {
    const absences = [
      request({ id: 'a', status: 'approved', startDate: '2026-11-09', endDate: '2026-11-09' }),
      request({ id: 'b', status: 'pending', startDate: '2026-11-09', endDate: '2026-11-09' }),
      request({ id: 'c', status: 'rejected', startDate: '2026-11-09', endDate: '2026-11-09' }),
    ];
    const monday = (includePending: boolean) =>
      buildMonthGrid(2026, 11, absences, { includePending })
        .weeks.flat()
        .find((d) => d.date === '2026-11-09')
        ?.entries.map((e) => e.requestId);
    expect(monday(false)).toEqual(['a']);
    expect(monday(true)).toEqual(['a', 'b']);
  });

  it('orders the entries of a day by employee', () => {
    const grid = buildMonthGrid(
      2026,
      11,
      [
        request({ id: 'x', employeeId: 'emp-009', startDate: '2026-11-09', endDate: '2026-11-09' }),
        request({ id: 'y', employeeId: 'emp-003', startDate: '2026-11-09', endDate: '2026-11-09' }),
      ],
      { includePending: false },
    );
    const entries = grid.weeks.flat().find((d) => d.date === '2026-11-09')?.entries;
    expect(entries?.map((e) => e.employeeId)).toEqual(['emp-003', 'emp-009']);
  });

  it('moves between months and across the year', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 11, 14)).toEqual({ year: 2028, month: 1 });
    expect(firstOfMonth(2026, 2)).toBe('2026-02-01');
    expect(lastOfMonth(2028, 2)).toBe('2028-02-29');
  });
});
