import type { AbsenceRequest, AbsenceType, ClockEntry, Employee, Shift } from '../api/models';
import { computeBalance, workingDays } from './balances';
import { detectConflicts } from './conflicts';
import { formatDuration, shiftNetMinutes, weeklyScheduledMinutes, workedMinutes } from './hours';
import { addDays, spanMinutes, startOfWeek, weekdayIndex } from './time';

const worker: Employee = {
  id: 'e1',
  firstName: 'Noor',
  lastName: 'Bakker',
  email: 'noor@example.com',
  phone: '',
  jobTitle: 'Barista',
  teamId: 't1',
  locationId: 'l1',
  userRole: 'employee',
  contract: {
    type: 'permanent',
    hoursPerWeek: 16,
    hourlyRateCents: 1500,
    startDate: '2024-01-01',
    endDate: null,
  },
  // Monday to Friday 08:00-18:00, weekend off.
  availability: [...Array.from({ length: 5 }, () => ({ from: '08:00', to: '18:00' })), null, null],
  active: true,
};

function shift(partial: Partial<Shift> & Pick<Shift, 'id'>): Shift {
  return {
    employeeId: 'e1',
    teamId: 't1',
    locationId: 'l1',
    date: '2026-11-09', // a Monday
    start: '09:00',
    end: '13:00',
    breakMinutes: 0,
    status: 'draft',
    note: '',
    ...partial,
  };
}

describe('time helpers', () => {
  it('knows weekdays and week starts', () => {
    expect(weekdayIndex('2026-11-09')).toBe(0);
    expect(weekdayIndex('2026-11-15')).toBe(6);
    expect(startOfWeek('2026-11-12')).toBe('2026-11-09');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });

  it('spans overnight shifts', () => {
    expect(spanMinutes('22:00', '06:00')).toBe(480);
    expect(spanMinutes('09:00', '17:30')).toBe(510);
  });
});

describe('hour calculations', () => {
  it('subtracts the unpaid break from a shift', () => {
    expect(shiftNetMinutes({ start: '09:00', end: '17:30', breakMinutes: 30 })).toBe(480);
  });

  it('never returns negative paid minutes', () => {
    expect(shiftNetMinutes({ start: '09:00', end: '09:30', breakMinutes: 60 })).toBe(0);
  });

  it('sums a single week only', () => {
    const shifts = [
      shift({ id: 'a', date: '2026-11-09' }),
      shift({ id: 'b', date: '2026-11-15' }),
      shift({ id: 'c', date: '2026-11-16' }), // next week
      shift({ id: 'd', date: '2026-11-10', employeeId: 'other' }),
    ];
    expect(weeklyScheduledMinutes(shifts, 'e1', '2026-11-09')).toBe(480);
  });

  it('counts worked time minus breaks, and open entries up to now', () => {
    const entry: ClockEntry = {
      id: 'c1',
      employeeId: 'e1',
      date: '2026-11-09',
      clockIn: '2026-11-09T08:00:00.000Z',
      clockOut: null,
      breaks: [{ start: '2026-11-09T10:00:00.000Z', end: '2026-11-09T10:30:00.000Z' }],
      status: 'open',
      comment: '',
    };
    expect(workedMinutes(entry, new Date('2026-11-09T12:00:00.000Z'))).toBe(210);
    expect(workedMinutes({ ...entry, clockOut: '2026-11-09T16:00:00.000Z' })).toBe(450);
  });

  it('formats durations', () => {
    expect(formatDuration(450)).toBe('7h 30m');
    expect(formatDuration(480)).toBe('8h');
  });
});

describe('conflict detection', () => {
  const none: AbsenceRequest[] = [];

  it('accepts a clean shift', () => {
    const s = shift({ id: 'new' });
    expect(detectConflicts({ shift: s, employee: worker, shifts: [s], absences: none })).toEqual(
      [],
    );
  });

  it('flags overlapping shifts but not touching ones', () => {
    const existing = shift({ id: 'old', start: '09:00', end: '13:00' });
    const touching = shift({ id: 'n1', start: '13:00', end: '15:00' });
    const overlapping = shift({ id: 'n2', start: '12:00', end: '15:00' });
    const run = (s: Shift) =>
      detectConflicts({ shift: s, employee: worker, shifts: [existing, s], absences: none });
    expect(run(touching).map((c) => c.type)).not.toContain('overlap');
    expect(run(overlapping)).toContainEqual(
      expect.objectContaining({ type: 'overlap', relatedId: 'old' }),
    );
  });

  it('flags a shift during an approved or pending absence, but not a rejected one', () => {
    const s = shift({ id: 'n' });
    const absence = (status: AbsenceRequest['status']): AbsenceRequest => ({
      id: 'a1',
      employeeId: 'e1',
      type: 'vacation',
      startDate: '2026-11-08',
      endDate: '2026-11-10',
      status,
      reason: '',
      comment: '',
    });
    const run = (status: AbsenceRequest['status']) =>
      detectConflicts({ shift: s, employee: worker, shifts: [s], absences: [absence(status)] });
    expect(run('approved').map((c) => c.type)).toContain('absence');
    expect(run('pending').map((c) => c.type)).toContain('absence');
    expect(run('rejected').map((c) => c.type)).not.toContain('absence');
  });

  it('flags unavailable days and hours', () => {
    const sunday = shift({ id: 'n', date: '2026-11-15' });
    const early = shift({ id: 'n2', start: '06:00', end: '10:00' });
    const run = (s: Shift) =>
      detectConflicts({ shift: s, employee: worker, shifts: [s], absences: none });
    expect(run(sunday)).toContainEqual(
      expect.objectContaining({ type: 'unavailable', messageKey: 'unavailableDay' }),
    );
    expect(run(early)).toContainEqual(
      expect.objectContaining({ type: 'unavailable', messageKey: 'unavailableHours' }),
    );
  });

  describe('overnight shifts', () => {
    const allDay: Employee = {
      ...worker,
      availability: Array.from({ length: 7 }, () => ({ from: '00:00', to: '24:00' })),
    };
    const run = (s: Shift, employee: Employee = allDay, absences: AbsenceRequest[] = none) =>
      detectConflicts({ shift: s, employee, shifts: [s], absences }).map((c) => c.messageKey);

    it('accepts one when both days are open around midnight', () => {
      expect(run(shift({ id: 'n', start: '22:00', end: '06:00' }))).not.toContain(
        'unavailableHours',
      );
    });

    it('flags one when the start day closes before midnight', () => {
      expect(run(shift({ id: 'n', start: '22:00', end: '06:00' }), worker)).toContain(
        'unavailableHours',
      );
    });

    it('flags one that ends after the next day window', () => {
      // Monday 2026-11-09 into Tuesday (index 1), where the worker is only free until 05:00.
      const tuesdayShort: Employee = {
        ...allDay,
        availability: allDay.availability.map((d, i) =>
          i === 1 ? { from: '00:00', to: '05:00' } : d,
        ),
      };
      expect(run(shift({ id: 'n', start: '22:00', end: '06:00' }), tuesdayShort)).toContain(
        'unavailableHours',
      );
    });

    it('flags one that runs into an unavailable next day', () => {
      // Friday 2026-11-13 into Saturday, where the worker is not available at all.
      const friday = shift({ id: 'n', date: '2026-11-13', start: '22:00', end: '06:00' });
      expect(
        run(friday, {
          ...worker,
          availability: [
            ...worker.availability.slice(0, 4),
            { from: '00:00', to: '24:00' },
            null,
            null,
          ],
        }),
      ).toContain('unavailableDay');
    });

    it('flags an absence that starts the next day', () => {
      const absence: AbsenceRequest = {
        id: 'a2',
        employeeId: 'e1',
        type: 'vacation',
        startDate: '2026-11-10',
        endDate: '2026-11-12',
        status: 'approved',
        reason: '',
        comment: '',
      };
      expect(run(shift({ id: 'n', start: '22:00', end: '06:00' }), allDay, [absence])).toContain(
        'absence',
      );
      expect(
        run(shift({ id: 'n', start: '08:00', end: '16:00' }), allDay, [absence]),
      ).not.toContain('absence');
    });
  });

  it('flags weekly hours above the contract (16h)', () => {
    const existing = [
      shift({ id: 'a', date: '2026-11-09', start: '08:00', end: '16:00' }),
      shift({ id: 'b', date: '2026-11-10', start: '08:00', end: '16:00' }),
    ];
    const extra = shift({ id: 'c', date: '2026-11-11', start: '08:00', end: '10:00' });
    expect(
      detectConflicts({
        shift: extra,
        employee: worker,
        shifts: [...existing, extra],
        absences: none,
      }),
    ).toContainEqual(expect.objectContaining({ type: 'over-hours' }));
  });

  it('ignores open shifts', () => {
    const open = shift({ id: 'o', employeeId: null });
    expect(
      detectConflicts({ shift: open, employee: undefined, shifts: [open], absences: none }),
    ).toEqual([]);
  });
});

describe('absence balances', () => {
  const vacation: AbsenceType = { key: 'vacation', name: 'Vacation', paid: true, yearlyDays: 25 };
  const request = (partial: Partial<AbsenceRequest>): AbsenceRequest => ({
    id: 'r',
    employeeId: 'e1',
    type: 'vacation',
    startDate: '2026-07-06',
    endDate: '2026-07-10',
    status: 'approved',
    reason: '',
    comment: '',
    ...partial,
  });

  it('counts working days only', () => {
    expect(workingDays('2026-11-06', '2026-11-10')).toBe(3); // Fri, Mon, Tue
    expect(workingDays('2026-11-14', '2026-11-15')).toBe(0);
    expect(workingDays('2026-11-10', '2026-11-09')).toBe(0);
  });

  it('separates approved, pending and rejected requests', () => {
    const balance = computeBalance(
      'e1',
      vacation,
      [
        request({ id: '1' }), // 5 approved
        request({ id: '2', startDate: '2026-08-03', endDate: '2026-08-04', status: 'pending' }),
        request({ id: '3', status: 'rejected' }),
        request({ id: '4', employeeId: 'other' }),
      ],
      2026,
    );
    expect(balance).toMatchObject({
      entitlementDays: 25,
      usedDays: 5,
      pendingDays: 2,
      remainingDays: 18,
    });
  });

  it('counts only the part of a request that falls in the year', () => {
    const balance = computeBalance(
      'e1',
      vacation,
      [request({ startDate: '2025-12-29', endDate: '2026-01-02' })], // Mon-Fri, 2 days in 2026
      2026,
    );
    expect(balance.usedDays).toBe(2);
  });
});
