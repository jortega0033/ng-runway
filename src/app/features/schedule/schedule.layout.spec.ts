import type { AbsenceRequest, Employee, Shift, ShiftTemplate, Team } from '@core/api/models';
import {
  OPEN_ROW,
  axisHours,
  buildGrid,
  cellKey,
  dayAxis,
  deltaMinutesFromPixels,
  formatRange,
  groupAbsencesByCell,
  groupEmployeesByTeam,
  groupShiftsByCell,
  isOvernight,
  moveTimes,
  moveToTarget,
  offsetFromTime,
  resizeEnd,
  shareStructure,
  shiftBox,
  shiftFromTemplate,
  snapMinutes,
  snapTime,
  templateFor,
  timeFromOffset,
  unavailableBoxes,
  validateDraft,
} from './schedule.layout';

const WEEK = '2026-11-09'; // Monday

function employee(
  id: string,
  teamId: string,
  lastName: string,
  overrides: Partial<Employee> = {},
): Employee {
  return {
    id,
    firstName: 'Test',
    lastName,
    email: `${id}@example.com`,
    phone: '',
    jobTitle: 'Barista',
    teamId,
    locationId: 'loc-ams',
    userRole: 'employee',
    contract: {
      type: 'permanent',
      hoursPerWeek: 16,
      hourlyRateCents: 1500,
      startDate: '2024-01-01',
      endDate: null,
    },
    availability: [
      { from: '07:00', to: '19:00' },
      { from: '07:00', to: '19:00' },
      null,
      { from: '07:00', to: '19:00' },
      { from: '07:00', to: '19:00' },
      null,
      null,
    ],
    active: true,
    ...overrides,
  };
}

function shift(
  id: string,
  employeeId: string | null,
  date: string,
  start = '09:00',
  end = '17:00',
): Shift {
  return {
    id,
    employeeId,
    teamId: 'team-b',
    locationId: 'loc-ams',
    date,
    start,
    end,
    breakMinutes: 30,
    status: 'draft',
    note: '',
  };
}

const teams: Team[] = [
  { id: 'team-b', name: 'Bar', locationId: 'loc-ams', color: '#2a71b0' },
  { id: 'team-a', name: 'Floor', locationId: 'loc-ams', color: '#8cbb26' },
  { id: 'team-c', name: 'Kitchen', locationId: 'loc-ams', color: '#e32322' },
];

describe('snapping', () => {
  it('snaps minutes to 15', () => {
    expect(snapMinutes(7)).toBe(0);
    expect(snapMinutes(8)).toBe(15);
    expect(snapMinutes(22)).toBe(15);
    expect(snapMinutes(23)).toBe(30);
    expect(snapMinutes(-8)).toBe(-15);
  });

  it('snaps times', () => {
    expect(snapTime('09:07')).toBe('09:00');
    expect(snapTime('09:08')).toBe('09:15');
    expect(snapTime('23:59')).toBe('00:00');
  });

  it('converts pixels to snapped minutes', () => {
    expect(deltaMinutesFromPixels(48, 0.8)).toBe(60);
    expect(deltaMinutesFromPixels(10, 0.8)).toBe(15);
    expect(deltaMinutesFromPixels(-24, 0.8)).toBe(-30);
    expect(deltaMinutesFromPixels(3, 0.8)).toBe(0);
  });
});

describe('moveTimes', () => {
  it('keeps the length when moving', () => {
    expect(moveTimes({ start: '09:00', end: '17:00' }, 60)).toEqual({
      start: '10:00',
      end: '18:00',
    });
    expect(moveTimes({ start: '09:00', end: '17:00' }, -120)).toEqual({
      start: '07:00',
      end: '15:00',
    });
  });

  it('stays within the day', () => {
    expect(moveTimes({ start: '09:00', end: '17:00' }, -1000).start).toBe('00:00');
    expect(moveTimes({ start: '09:00', end: '17:00' }, 1000).start).toBe('23:45');
  });

  it('keeps an overnight shift overnight', () => {
    expect(moveTimes({ start: '22:00', end: '06:00' }, 30)).toEqual({
      start: '22:30',
      end: '06:30',
    });
    expect(isOvernight({ start: '22:00', end: '06:00' })).toBe(true);
    expect(isOvernight({ start: '09:00', end: '17:00' })).toBe(false);
  });
});

describe('resizeEnd', () => {
  const s = { start: '09:00', end: '17:00' };

  it('snaps to 15 minutes', () => {
    expect(resizeEnd(s, 60)).toBe('18:00');
    expect(resizeEnd(s, 20)).toBe('17:15');
    expect(resizeEnd(s, -50)).toBe('16:15');
  });

  it('keeps at least one step of length', () => {
    expect(resizeEnd(s, -10_000)).toBe('09:15');
  });

  it('stops at midnight', () => {
    expect(resizeEnd(s, 10_000)).toBe('00:00');
  });
});

describe('day axis', () => {
  it('defaults to 06:00-22:00 and widens for early and late shifts', () => {
    expect(dayAxis([])).toEqual({ startHour: 6, endHour: 22 });
    expect(dayAxis([shift('a', 'e', WEEK, '05:30', '13:00')])).toEqual({
      startHour: 5,
      endHour: 22,
    });
    expect(dayAxis([shift('a', 'e', WEEK, '14:00', '23:30')])).toEqual({
      startHour: 6,
      endHour: 24,
    });
    expect(dayAxis([shift('a', 'e', WEEK, '22:00', '06:00')])).toEqual({
      startHour: 6,
      endHour: 24,
    });
  });

  it('lists hours', () => {
    expect(axisHours({ startHour: 6, endHour: 9 })).toEqual([6, 7, 8]);
  });

  it('maps time to pixels and back', () => {
    const axis = { startHour: 6, endHour: 22 };
    const ppm = 0.8;
    expect(offsetFromTime('06:00', axis, ppm)).toBe(0);
    expect(offsetFromTime('08:00', axis, ppm)).toBeCloseTo(96);
    expect(timeFromOffset(96, axis, ppm)).toBe('08:00');
    expect(timeFromOffset(100, axis, ppm)).toBe('08:00');
    expect(timeFromOffset(-500, axis, ppm)).toBe('06:00');
    expect(timeFromOffset(99_999, axis, ppm)).toBe('23:45');
  });

  it('positions a chip and cuts overnight shifts at the end of the axis', () => {
    const axis = { startHour: 6, endHour: 22 };
    expect(shiftBox({ start: '08:00', end: '12:00' }, axis, 1)).toEqual({ left: 120, width: 240 });
    expect(shiftBox({ start: '20:00', end: '04:00' }, axis, 1)).toEqual({ left: 840, width: 120 });
  });

  it('hatches the hours outside the availability window', () => {
    const axis = { startHour: 6, endHour: 22 };
    expect(unavailableBoxes({ from: '08:00', to: '20:00' }, axis, 1)).toEqual([
      { left: 0, width: 120 },
      { left: 840, width: 120 },
    ]);
    expect(unavailableBoxes(undefined, axis, 1)).toEqual([{ left: 0, width: 960 }]);
    expect(unavailableBoxes({ from: '06:00', to: '22:00' }, axis, 1)).toEqual([]);
  });
});

describe('grouping', () => {
  it('groups shifts by cell, earliest first, with open shifts under their own row', () => {
    const map = groupShiftsByCell([
      shift('late', 'e1', WEEK, '14:00', '22:00'),
      shift('early', 'e1', WEEK, '07:00', '11:00'),
      shift('open', null, WEEK),
      shift('other-day', 'e1', '2026-11-10'),
    ]);
    expect(map.get(cellKey('e1', WEEK))?.map((s) => s.id)).toEqual(['early', 'late']);
    expect(map.get(cellKey(null, WEEK))?.map((s) => s.id)).toEqual(['open']);
    expect(cellKey(null, WEEK)).toBe(`${OPEN_ROW}|${WEEK}`);
    expect(map.get(cellKey('e1', '2026-11-10'))).toHaveLength(1);
  });

  it('spreads multi-day absences over the visible dates and skips rejected ones', () => {
    const absences: AbsenceRequest[] = [
      {
        id: 'a1',
        employeeId: 'e1',
        type: 'vacation',
        startDate: '2026-11-10',
        endDate: '2026-11-12',
        status: 'approved',
        reason: '',
        comment: '',
      },
      {
        id: 'a2',
        employeeId: 'e1',
        type: 'sick',
        startDate: '2026-11-09',
        endDate: '2026-11-09',
        status: 'rejected',
        reason: '',
        comment: '',
      },
    ];
    const dates = ['2026-11-09', '2026-11-10', '2026-11-11'];
    const map = groupAbsencesByCell(absences, dates);
    expect(map.get(cellKey('e1', '2026-11-09'))).toBeUndefined();
    expect(map.get(cellKey('e1', '2026-11-10'))?.[0]?.id).toBe('a1');
    expect(map.get(cellKey('e1', '2026-11-11'))?.[0]?.id).toBe('a1');
    expect(map.has(cellKey('e1', '2026-11-12'))).toBe(false);
  });

  it('groups employees by team name and last name, and drops empty teams', () => {
    const groups = groupEmployeesByTeam(
      [
        employee('e1', 'team-a', 'Zwart'),
        employee('e2', 'team-a', 'Bakker'),
        employee('e3', 'team-b', 'Smit'),
      ],
      teams,
    );
    expect(groups.map((g) => g.team.name)).toEqual(['Bar', 'Floor']);
    expect(groups[1]?.employees.map((e) => e.lastName)).toEqual(['Bakker', 'Zwart']);
  });
});

describe('buildGrid', () => {
  const e1 = employee('e1', 'team-a', 'Bakker');
  const dates = ['2026-11-09', '2026-11-10', '2026-11-11'];

  it('builds the open row, team groups, availability and weekly hours in one pass', () => {
    const grid = buildGrid({
      employees: [e1],
      teams,
      shifts: [
        shift('s1', 'e1', '2026-11-09'),
        shift('s2', 'e1', '2026-11-10'),
        shift('open', null, '2026-11-10'),
      ],
      absences: [],
      dates,
      weekStart: WEEK,
    });
    expect(grid.openRow.cells.map((c) => c.shifts.length)).toEqual([0, 1, 0]);
    expect(grid.groups).toHaveLength(1);
    const row = grid.groups[0]!.rows[0]!;
    expect(row.weeklyMinutes).toBe(2 * 450);
    expect(row.contractMinutes).toBe(16 * 60);
    expect(row.overContract).toBe(false);
    // Wednesday (index 2) is not available for this employee.
    expect(row.cells.map((c) => c.unavailable)).toEqual([false, false, true]);
    expect(row.cells[0]?.target).toEqual({ employeeId: 'e1', date: '2026-11-09' });
  });

  it('flags weekly hours above the contract', () => {
    const grid = buildGrid({
      employees: [e1],
      teams,
      shifts: [
        shift('s1', 'e1', '2026-11-09'),
        shift('s2', 'e1', '2026-11-10'),
        shift('s3', 'e1', '2026-11-12'),
      ],
      absences: [],
      dates,
      weekStart: WEEK,
    });
    expect(grid.groups[0]?.rows[0]?.overContract).toBe(true);
  });
});

describe('shareStructure', () => {
  const e1 = employee('e1', 'team-a', 'Bakker');
  const e2 = employee('e2', 'team-a', 'Jansen');
  const dates = ['2026-11-09', '2026-11-10'];
  const s1 = shift('s1', 'e1', '2026-11-09');
  const s2 = shift('s2', 'e2', '2026-11-10');
  const build = (shifts: Shift[]) =>
    buildGrid({ employees: [e1, e2], teams, shifts, absences: [], dates, weekStart: WEEK });

  it('returns the new grid when there is nothing to share with', () => {
    const next = build([]);
    expect(shareStructure(null, next)).toBe(next);
  });

  it('reuses unchanged rows and replaces only the changed one', () => {
    const prev = build([s1]);
    const next = shareStructure(prev, build([s1, s2]));
    const prevRows = prev.groups[0]!.rows;
    const nextRows = next.groups[0]!.rows;
    expect(nextRows[0]).toBe(prevRows[0]);
    expect(nextRows[1]).not.toBe(prevRows[1]);
    expect(next.all[1]).toBe(next.groups[0]);
    expect(next.openRow).toBe(next.all[0]!.rows[0]);
  });

  it('keeps the whole grid structure when nothing changed', () => {
    const prev = build([s1]);
    const next = shareStructure(prev, build([s1]));
    expect(next.groups[0]).toBe(prev.groups[0]);
    expect(next.openRow).toBe(prev.openRow);
  });
});

describe('drop results', () => {
  const e1 = employee('e1', 'team-a', 'Bakker', { locationId: 'loc-rtm' });
  const employees = new Map([[e1.id, e1]]);
  const s = shift('s1', null, WEEK);

  it('moves a shift to another employee and day, adopting their team and location', () => {
    const input = moveToTarget(s, { employeeId: 'e1', date: '2026-11-11' }, employees);
    expect(input).toMatchObject({
      employeeId: 'e1',
      date: '2026-11-11',
      teamId: 'team-a',
      locationId: 'loc-rtm',
      start: '09:00',
      end: '17:00',
    });
    expect('id' in input).toBe(false);
  });

  it('keeps team and location when the shift goes to the open row', () => {
    const assigned = shift('s2', 'e1', WEEK);
    const input = moveToTarget(assigned, { employeeId: null, date: WEEK }, employees);
    expect(input.employeeId).toBeNull();
    expect(input.teamId).toBe('team-b');
  });

  it('shifts the times on the day view', () => {
    const input = moveToTarget(s, { employeeId: null, date: WEEK }, employees, 90);
    expect([input.start, input.end]).toEqual(['10:30', '18:30']);
  });

  it('builds a draft from a template, optionally at a dropped time', () => {
    const template: ShiftTemplate = {
      id: 'tpl',
      name: 'Day',
      start: '09:00',
      end: '17:00',
      breakMinutes: 30,
    };
    const target = { employeeId: 'e1', date: WEEK };
    const context = { teamId: 'team-c', locationId: 'loc-utr' };
    const plain = shiftFromTemplate(template, target, employees, context);
    expect(plain).toMatchObject({
      start: '09:00',
      end: '17:00',
      breakMinutes: 30,
      status: 'draft',
      teamId: 'team-a',
    });
    const dropped = shiftFromTemplate(template, target, employees, { ...context, start: '12:15' });
    expect([dropped.start, dropped.end]).toEqual(['12:15', '20:15']);
    const open = shiftFromTemplate(template, { employeeId: null, date: WEEK }, employees, context);
    expect(open).toMatchObject({ employeeId: null, teamId: 'team-c', locationId: 'loc-utr' });
  });

  it('finds the template that matches a shift', () => {
    const templates: ShiftTemplate[] = [
      { id: 'a', name: 'Early', start: '07:00', end: '15:00', breakMinutes: 30 },
      { id: 'b', name: 'Day', start: '09:00', end: '17:00', breakMinutes: 30 },
    ];
    expect(templateFor(s, templates)?.name).toBe('Day');
    expect(templateFor({ ...s, breakMinutes: 0 }, templates)).toBeUndefined();
  });
});

describe('validateDraft', () => {
  const ok = { date: WEEK, start: '09:00', end: '17:00', breakMinutes: 30 };

  it('accepts a normal shift and an overnight shift', () => {
    expect(validateDraft(ok)).toEqual([]);
    expect(validateDraft({ ...ok, start: '22:00', end: '06:00' })).toEqual([]);
  });

  it('blocks missing date, bad times, equal times and too long a break', () => {
    expect(validateDraft({ ...ok, date: '' })).toContain('dateRequired');
    expect(validateDraft({ ...ok, start: '' })).toContain('timeRequired');
    expect(validateDraft({ ...ok, end: '25:00' })).toContain('timeRequired');
    expect(validateDraft({ ...ok, end: '09:00' })).toContain('sameTime');
    expect(validateDraft({ ...ok, start: '09:00', end: '09:30', breakMinutes: 45 })).toContain(
      'breakTooLong',
    );
    expect(validateDraft({ ...ok, breakMinutes: -5 })).toContain('breakTooLong');
  });
});

describe('formatRange', () => {
  it('formats a week and a single day', () => {
    expect(formatRange('2026-11-09', '2026-11-15', 'en-GB')).toBe('9 Nov - 15 Nov 2026');
    expect(formatRange('2026-11-09', '2026-11-09', 'en-GB')).toContain('9 November 2026');
  });
});
