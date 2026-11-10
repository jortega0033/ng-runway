import type { ClockEntry, Shift } from '@core/api/models';
import {
  applyReview,
  breakMinutes,
  buildWeek,
  cappedNow,
  clockStatus,
  formatClock,
  formatSignedDuration,
  restoreEntries,
  runningBreakSeconds,
  shiftWeek,
  workedSeconds,
} from './timesheet-math';

const WEEK = '2026-11-09'; // a Monday

function entry(overrides: Partial<ClockEntry> = {}): ClockEntry {
  return {
    id: 'c1',
    employeeId: 'emp-003',
    date: '2026-11-09',
    clockIn: '2026-11-09T08:00:00.000Z',
    clockOut: '2026-11-09T16:30:00.000Z',
    breaks: [{ start: '2026-11-09T12:00:00.000Z', end: '2026-11-09T12:30:00.000Z' }],
    status: 'submitted',
    comment: '',
    ...overrides,
  };
}

function shift(overrides: Partial<Shift> = {}): Shift {
  return {
    id: 's1',
    employeeId: 'emp-003',
    teamId: 'team-ams-floor',
    locationId: 'loc-ams',
    date: '2026-11-09',
    start: '08:00',
    end: '16:00',
    breakMinutes: 30,
    status: 'published',
    note: '',
    ...overrides,
  };
}

describe('clock status and counters', () => {
  it('derives out, working and break from the open entry', () => {
    expect(clockStatus(null)).toBe('out');
    expect(clockStatus(entry())).toBe('out');
    expect(clockStatus(entry({ clockOut: null, breaks: [] }))).toBe('working');
    expect(
      clockStatus(
        entry({ clockOut: null, breaks: [{ start: '2026-11-09T12:00:00.000Z', end: null }] }),
      ),
    ).toBe('break');
  });

  it('counts worked seconds without break time and freezes during a break', () => {
    const open = entry({
      clockOut: null,
      breaks: [{ start: '2026-11-09T12:00:00.000Z', end: null }],
    });
    const at = (iso: string) => Date.parse(iso);
    // 08:00 to 12:00 worked, then the break runs.
    expect(workedSeconds(open, at('2026-11-09T12:10:00.000Z'))).toBe(4 * 3600);
    expect(workedSeconds(open, at('2026-11-09T12:20:00.000Z'))).toBe(4 * 3600);
    expect(runningBreakSeconds(open, at('2026-11-09T12:20:00.000Z'))).toBe(20 * 60);
  });

  it('subtracts finished breaks from a closed entry', () => {
    expect(workedSeconds(entry(), 0)).toBe((8 * 60 + 30 - 30) * 60);
    expect(breakMinutes(entry())).toBe(30);
  });

  it('never goes negative when the clock is behind the clock-in', () => {
    const open = entry({ clockOut: null, breaks: [] });
    expect(workedSeconds(open, Date.parse('2026-11-09T07:00:00.000Z'))).toBe(0);
  });

  it('formats the elapsed time as HH:mm:ss', () => {
    expect(formatClock(0)).toBe('00:00:00');
    expect(formatClock(59)).toBe('00:00:59');
    expect(formatClock(3661)).toBe('01:01:01');
    expect(formatClock(100 * 3600)).toBe('100:00:00');
    expect(formatClock(-5)).toBe('00:00:00');
  });

  it('writes differences with an explicit sign', () => {
    expect(formatSignedDuration(90)).toBe('+1h 30m');
    expect(formatSignedDuration(-45)).toBe('-0h 45m');
    expect(formatSignedDuration(0)).toBe('0h');
    expect(formatSignedDuration(120)).toBe('+2h');
  });
});

describe('buildWeek', () => {
  const now = new Date('2026-11-15T12:00:00.000Z');

  it('totals scheduled against worked time and contract hours', () => {
    const week = buildWeek(
      WEEK,
      [shift(), shift({ id: 's2', date: '2026-11-10' })],
      [entry(), entry({ id: 'c2', date: '2026-11-10' })],
      32,
      now,
    );
    expect(week.days).toHaveLength(7);
    // 8h shift minus a 30 min break is 7.5h, worked is 8h (8h30 on the clock minus 30 min).
    expect(week.days[0]?.scheduledMinutes).toBe(450);
    expect(week.days[0]?.workedMinutes).toBe(480);
    expect(week.days[0]?.differenceMinutes).toBe(30);
    expect(week.scheduledMinutes).toBe(900);
    expect(week.workedMinutes).toBe(960);
    expect(week.contractMinutes).toBe(1920);
    expect(week.differenceMinutes).toBe(60);
    expect(week.contractDifferenceMinutes).toBe(960 - 1920);
  });

  it('ignores draft shifts and shifts or entries from other weeks', () => {
    const week = buildWeek(
      WEEK,
      [shift({ status: 'draft' }), shift({ id: 's9', date: '2026-11-16' })],
      [entry({ id: 'c9', date: '2026-11-16' })],
      40,
      now,
    );
    expect(week.scheduledMinutes).toBe(0);
    expect(week.workedMinutes).toBe(0);
  });

  it('lists rejected entries but does not count their hours', () => {
    const week = buildWeek(
      WEEK,
      [],
      [entry({ status: 'rejected', comment: 'Wrong day' })],
      40,
      now,
    );
    expect(week.days[0]?.entries).toHaveLength(1);
    expect(week.days[0]?.workedMinutes).toBe(0);
  });

  it('counts an open entry up to now', () => {
    const today = new Date('2026-11-09T10:00:00.000Z');
    const week = buildWeek(WEEK, [], [entry({ clockOut: null, breaks: [] })], 40, today);
    expect(week.days[0]?.workedMinutes).toBe(120);
  });

  it('moves between weeks', () => {
    expect(shiftWeek(WEEK, 1)).toBe('2026-11-16');
    expect(shiftWeek(WEEK, -2)).toBe('2026-10-26');
  });
});

describe('applyReview', () => {
  const a = entry({ id: 'a' });
  const b = entry({ id: 'b' });

  it('removes reviewed rows from a submitted-only list', () => {
    const next = applyReview([a, b], new Set(['a']), 'approved', '', 'submitted');
    expect(next.map((e) => e.id)).toEqual(['b']);
  });

  it('keeps reviewed rows with their new status when no status filter is set', () => {
    const next = applyReview([a, b], new Set(['b']), 'rejected', 'Missing break', '');
    expect(next).toHaveLength(2);
    expect(next[1]).toMatchObject({ status: 'rejected', comment: 'Missing break' });
  });
});

describe('restoreEntries', () => {
  it('brings back failed rows in their old position and old state', () => {
    const before = [entry({ id: 'a' }), entry({ id: 'b' }), entry({ id: 'c' })];
    const ids = new Set(['a', 'b']);
    const optimistic = applyReview(before, ids, 'approved', '', 'submitted');
    expect(optimistic.map((e) => e.id)).toEqual(['c']);
    const restored = restoreEntries(optimistic, before, new Set(['a']));
    expect(restored.map((e) => e.id)).toEqual(['a', 'c']);
    expect(restored[0]?.status).toBe('submitted');
  });

  it('does not bring back a failed row that the current filter excludes', () => {
    const before = [entry({ id: 'a' }), entry({ id: 'b' })];
    const optimistic = applyReview(before, new Set(['a']), 'approved', '', 'submitted');
    const restored = restoreEntries(optimistic, before, new Set(['a']), (e) => e.id !== 'a');
    expect(restored.map((e) => e.id)).toEqual(['b']);
  });
});

describe('open entries from earlier days', () => {
  const open = entry({ id: 'open', date: '2026-11-09', clockOut: null, breaks: [] });

  it('stop counting at the end of their own day', () => {
    const now = new Date('2026-11-12T10:00:00');
    const capped = cappedNow(open, now);
    expect(capped.getTime()).toBe(new Date('2026-11-10T00:00:00').getTime());
    const week = buildWeek(WEEK, [], [open], 40, now);
    const day = week.days.find((d) => d.date === '2026-11-09');
    // 08:00Z clock-in against local midnight: far less than the three days since.
    expect(day?.workedMinutes).toBeLessThan(24 * 60);
  });

  it('keep counting up to now on the same day, and leave closed entries alone', () => {
    const now = new Date('2026-11-09T23:00:00');
    expect(cappedNow(open, now)).toBe(now);
    expect(cappedNow(entry(), new Date('2026-12-01T00:00:00'))).toEqual(
      new Date('2026-12-01T00:00:00'),
    );
  });
});
