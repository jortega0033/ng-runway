import type { Employee, Shift } from '@core/api/models';
import {
  dayRelation,
  shiftIsOver,
  teamOnShift,
  timeOfDay,
  timeRange,
  upcomingShifts,
  weekProgress,
} from './dashboard.logic';
import { formatDay, formatPeriod } from './format';

/** Monday 9 November 2026, 14:30 local time. */
const NOW = new Date(2026, 10, 9, 14, 30);

function shift(overrides: Partial<Shift> & Pick<Shift, 'id'>): Shift {
  return {
    employeeId: 'emp-1',
    teamId: 'team-a',
    locationId: 'loc-ams',
    date: '2026-11-09',
    start: '16:00',
    end: '22:00',
    breakMinutes: 0,
    status: 'published',
    note: '',
    ...overrides,
  };
}

function employee(id: string): Employee {
  return {
    id,
    firstName: id,
    lastName: 'Test',
    email: `${id}@example.com`,
    phone: '',
    jobTitle: '',
    teamId: 'team-a',
    locationId: 'loc-ams',
    userRole: 'employee',
    contract: {
      type: 'permanent',
      hoursPerWeek: 32,
      hourlyRateCents: 1500,
      startDate: '2025-01-01',
      endDate: null,
    },
    availability: [null, null, null, null, null, null, null],
    active: true,
  };
}

describe('dashboard logic', () => {
  it('reads the local time of day', () => {
    expect(timeOfDay(NOW)).toBe('14:30');
    expect(timeOfDay(new Date(2026, 0, 1, 7, 5))).toBe('07:05');
  });

  describe('shiftIsOver', () => {
    it('counts earlier days as over and later days as not over', () => {
      expect(shiftIsOver(shift({ id: 'a', date: '2026-11-08' }), NOW)).toBe(true);
      expect(shiftIsOver(shift({ id: 'b', date: '2026-11-10' }), NOW)).toBe(false);
    });

    it('uses the end time on the same day', () => {
      expect(shiftIsOver(shift({ id: 'c', start: '08:00', end: '14:00' }), NOW)).toBe(true);
      expect(shiftIsOver(shift({ id: 'd', start: '08:00', end: '14:30' }), NOW)).toBe(true);
      expect(shiftIsOver(shift({ id: 'e', start: '08:00', end: '18:00' }), NOW)).toBe(false);
    });

    it('keeps a shift past midnight alive for the day it starts', () => {
      expect(shiftIsOver(shift({ id: 'f', start: '22:00', end: '06:00' }), NOW)).toBe(false);
    });
  });

  describe('upcomingShifts', () => {
    const shifts = [
      shift({ id: 'late', date: '2026-11-11', start: '09:00', end: '17:00' }),
      shift({ id: 'past', date: '2026-11-09', start: '08:00', end: '12:00' }),
      shift({ id: 'draft', date: '2026-11-10', status: 'draft' }),
      shift({ id: 'other', date: '2026-11-10', employeeId: 'emp-2' }),
      shift({ id: 'open', date: '2026-11-10', employeeId: null }),
      shift({ id: 'tonight', date: '2026-11-09', start: '16:00', end: '22:00' }),
      shift({ id: 'tomorrow-early', date: '2026-11-10', start: '06:00', end: '14:00' }),
    ];

    it('keeps own, published, not-yet-over shifts in time order', () => {
      expect(upcomingShifts(shifts, 'emp-1', NOW).map((s) => s.id)).toEqual([
        'tonight',
        'tomorrow-early',
        'late',
      ]);
    });

    it('stops at the limit', () => {
      const many = Array.from({ length: 9 }, (_, i) =>
        shift({ id: `s${i}`, date: `2026-11-${String(10 + i).padStart(2, '0')}` }),
      );
      expect(upcomingShifts(many, 'emp-1', NOW)).toHaveLength(5);
      expect(upcomingShifts(many, 'emp-1', NOW, 2).map((s) => s.id)).toEqual(['s0', 's1']);
    });

    it('returns an empty list when there is nothing to show', () => {
      expect(upcomingShifts([], 'emp-1', NOW)).toEqual([]);
    });
  });

  it('names today and tomorrow', () => {
    expect(dayRelation('2026-11-09', NOW)).toBe('today');
    expect(dayRelation('2026-11-10', NOW)).toBe('tomorrow');
    expect(dayRelation('2026-11-12', NOW)).toBe('later');
  });

  describe('weekProgress', () => {
    it('is the share of the contract that is planned', () => {
      expect(weekProgress(16 * 60, 32)).toMatchObject({ percent: 50, over: false });
    });

    it('caps the bar and flags overtime', () => {
      expect(weekProgress(40 * 60, 32)).toMatchObject({ percent: 100, over: true });
    });

    it('handles a contract without hours', () => {
      expect(weekProgress(120, 0)).toMatchObject({ percent: 0, over: false, contractMinutes: 0 });
    });
  });

  describe('teamOnShift', () => {
    const team = [employee('emp-1'), employee('emp-2'), employee('emp-3')];

    it('lists published shifts of team members ordered by start, one entry per person', () => {
      const result = teamOnShift(team, [
        shift({ id: 'a', employeeId: 'emp-2', start: '12:00', end: '20:00' }),
        shift({ id: 'b', employeeId: 'emp-1', start: '08:00', end: '12:00' }),
        shift({ id: 'c', employeeId: 'emp-1', start: '13:00', end: '17:00' }),
      ]);
      expect(result.map((m) => m.employee.id)).toEqual(['emp-1', 'emp-2']);
      expect(result[0]?.shifts.map((s) => s.id)).toEqual(['b', 'c']);
    });

    it('skips drafts, open shifts and people outside the team', () => {
      const result = teamOnShift(team, [
        shift({ id: 'draft', employeeId: 'emp-1', status: 'draft' }),
        shift({ id: 'open', employeeId: null }),
        shift({ id: 'stranger', employeeId: 'emp-99' }),
      ]);
      expect(result).toEqual([]);
    });
  });

  it('formats a shift range', () => {
    expect(timeRange({ start: '08:00', end: '16:30' })).toBe('08:00 - 16:30');
  });
});

describe('dashboard formatting', () => {
  it('formats days and periods without shifting the date', () => {
    expect(formatDay('2026-11-09', 'en')).toBe('Mon, Nov 9');
    expect(formatPeriod('2026-11-09', '2026-11-09', 'en')).toBe('Nov 9');
    expect(formatPeriod('2026-11-09', '2026-11-13', 'en')).toBe('Nov 9 - Nov 13');
  });
});
