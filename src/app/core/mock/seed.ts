import { faker } from '@faker-js/faker/locale/en';
import { dataTokens } from '@tokens';
import type {
  AbsenceRequest,
  AbsenceType,
  AbsenceTypeKey,
  AppNotification,
  ClockEntry,
  ContractType,
  DayAvailability,
  Employee,
  Location,
  Shift,
  ShiftTemplate,
  Team,
  UserRole,
} from '../api/models';
import { MOCK_FEATURES } from './features';
import { DB_SCHEMA_VERSION, type Db } from './db';
import { addDays, fromMinutes, spanMinutes, startOfWeek, toMinutes } from '../domain/time';

const SEED = 20260101;

const LOCATIONS: Location[] = [
  { id: 'loc-ams', name: 'Amsterdam Central', city: 'Amsterdam' },
  { id: 'loc-rtm', name: 'Rotterdam Harbour', city: 'Rotterdam' },
  { id: 'loc-utr', name: 'Utrecht Centrum', city: 'Utrecht' },
];

const palette = dataTokens.entityPalette;

function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`Missing ${what}`);
  return value;
}

const color = (i: number): string => must(palette[i], `palette color ${i}`);

const TEAMS: Team[] = [
  { id: 'team-ams-floor', name: 'Amsterdam Floor', locationId: 'loc-ams', color: color(3) },
  { id: 'team-ams-kitchen', name: 'Amsterdam Kitchen', locationId: 'loc-ams', color: color(8) },
  { id: 'team-rtm-floor', name: 'Rotterdam Floor', locationId: 'loc-rtm', color: color(1) },
  { id: 'team-rtm-kitchen', name: 'Rotterdam Kitchen', locationId: 'loc-rtm', color: color(5) },
  { id: 'team-utr-floor', name: 'Utrecht Floor', locationId: 'loc-utr', color: color(2) },
  { id: 'team-utr-office', name: 'Utrecht Back Office', locationId: 'loc-utr', color: color(6) },
];

const ABSENCE_TYPES: AbsenceType[] = [
  { key: 'vacation', name: 'Vacation', paid: true, yearlyDays: 25 },
  { key: 'sick', name: 'Sick leave', paid: true, yearlyDays: null },
  { key: 'unavailable', name: 'Unavailable', paid: false, yearlyDays: null },
  { key: 'holiday', name: 'Public holiday', paid: true, yearlyDays: null },
  { key: 'special-leave', name: 'Special leave', paid: true, yearlyDays: 5 },
  { key: 'maternity-leave', name: 'Maternity leave', paid: true, yearlyDays: null },
  { key: 'short-term-care-leave', name: 'Short-term care leave', paid: true, yearlyDays: 10 },
  { key: 'long-term-care-leave', name: 'Long-term care leave', paid: false, yearlyDays: null },
  { key: 'parental-leave', name: 'Parental leave', paid: false, yearlyDays: 20 },
  { key: 'unpaid-leave', name: 'Unpaid leave', paid: false, yearlyDays: null },
];

const SHIFT_TEMPLATES: ShiftTemplate[] = [
  { id: 'tpl-early', name: 'Early', start: '07:00', end: '15:00', breakMinutes: 30 },
  { id: 'tpl-day', name: 'Day', start: '09:00', end: '17:00', breakMinutes: 30 },
  { id: 'tpl-late', name: 'Late', start: '14:00', end: '22:00', breakMinutes: 30 },
  { id: 'tpl-half', name: 'Half day', start: '09:00', end: '13:00', breakMinutes: 0 },
];

const JOBS: Record<string, string[]> = {
  floor: ['Barista', 'Waiter', 'Host', 'Shift lead'],
  kitchen: ['Line cook', 'Prep cook', 'Dishwasher', 'Sous chef'],
  office: ['Planner', 'Bookkeeper', 'HR assistant', 'Office manager'],
};

/** Weeks of shifts around the anchor week: 3 back, the anchor, 4 forward = 8 weeks. */
const WEEKS_BACK = 3;
const WEEKS_FORWARD = 4;

function pick<T>(items: readonly T[]): T {
  return must(items[faker.number.int({ min: 0, max: items.length - 1 })], 'item to pick');
}

function availabilityFor(hoursPerWeek: number): DayAvailability[] {
  const days: DayAvailability[] = [];
  for (let i = 0; i < 7; i++) {
    const weekend = i >= 5;
    // Part-timers are free fewer days; weekends are mostly off.
    const free = weekend
      ? faker.number.int({ min: 0, max: 3 }) === 0
      : hoursPerWeek >= 32 || faker.number.int({ min: 0, max: 4 }) > 0;
    days.push(free ? { from: '07:00', to: '23:00' } : null);
  }
  return days;
}

function buildEmployees(): Employee[] {
  const employees: Employee[] = [];
  const contractTypes: ContractType[] = [
    'permanent',
    'permanent',
    'permanent',
    'fixed-term',
    'flex',
  ];
  const hourChoices = [16, 20, 24, 32, 36, 40];

  // Fixed demo logins first: one admin, one manager, one employee.
  const fixed: { role: UserRole; first: string; last: string; teamId: string; job: string }[] = [
    {
      role: 'admin',
      first: 'Anna',
      last: 'de Vries',
      teamId: 'team-utr-office',
      job: 'Operations lead',
    },
    {
      role: 'manager',
      first: 'Mark',
      last: 'Jansen',
      teamId: 'team-ams-floor',
      job: 'Store manager',
    },
    { role: 'employee', first: 'Sara', last: 'Bakker', teamId: 'team-ams-floor', job: 'Barista' },
  ];

  const make = (
    index: number,
    role: UserRole,
    first: string,
    last: string,
    teamId: string,
    job: string,
  ): Employee => {
    const team = must(
      TEAMS.find((t) => t.id === teamId),
      `team ${teamId}`,
    );
    const hoursPerWeek = role === 'employee' ? pick(hourChoices) : 40;
    return {
      id: `emp-${String(index + 1).padStart(3, '0')}`,
      firstName: first,
      lastName: last,
      email: `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '') + '@example.com',
      phone: faker.phone.number({ style: 'national' }),
      jobTitle: job,
      teamId,
      locationId: team.locationId,
      userRole: role,
      contract: {
        type: pick(contractTypes),
        hoursPerWeek,
        hourlyRateCents: faker.number.int({ min: 1450, max: 2600 }),
        startDate: faker.date.past({ years: 4, refDate: '2026-01-01' }).toISOString().slice(0, 10),
        endDate: null,
      },
      availability: availabilityFor(hoursPerWeek),
      active: true,
    };
  };

  fixed.forEach((f, i) => employees.push(make(i, f.role, f.first, f.last, f.teamId, f.job)));
  // Fixed logins always work the same: full availability on weekdays.
  for (const e of employees) {
    e.availability = [0, 1, 2, 3, 4, 5, 6].map((d) =>
      d < 6 ? { from: '07:00', to: '23:00' } : null,
    );
  }

  // One manager per remaining team, then employees spread over all teams.
  for (const team of TEAMS) {
    if (team.id === 'team-ams-floor') continue;
    const kind = team.name.includes('Kitchen')
      ? 'kitchen'
      : team.name.includes('Office')
        ? 'office'
        : 'floor';
    employees.push(
      make(
        employees.length,
        'manager',
        faker.person.firstName(),
        faker.person.lastName(),
        team.id,
        kind === 'floor' ? 'Shift lead' : kind === 'kitchen' ? 'Head cook' : 'Team lead',
      ),
    );
  }
  while (employees.length < 40) {
    const team = must(TEAMS[employees.length % TEAMS.length], 'team');
    const kind = team.name.includes('Kitchen')
      ? 'kitchen'
      : team.name.includes('Office')
        ? 'office'
        : 'floor';
    employees.push(
      make(
        employees.length,
        'employee',
        faker.person.firstName(),
        faker.person.lastName(),
        team.id,
        pick(must(JOBS[kind], 'job list')),
      ),
    );
  }
  return employees;
}

function buildShifts(employees: Employee[], anchorWeek: string): Shift[] {
  const shifts: Shift[] = [];
  let n = 0;
  const workers = employees.filter((e) => e.userRole !== 'admin');
  for (let w = -WEEKS_BACK; w <= WEEKS_FORWARD; w++) {
    const weekStart = addDays(anchorWeek, w * 7);
    // Weeks up to and including the current one are published; later weeks are drafts, except next week.
    const published = w <= 1;
    for (const employee of workers) {
      const daysToWork = Math.min(5, Math.max(2, Math.round(employee.contract.hoursPerWeek / 8)));
      const days = faker.helpers.arrayElements([0, 1, 2, 3, 4, 5, 6], daysToWork);
      for (const d of days) {
        const available = employee.availability[d];
        if (!available) continue;
        const tpl = pick(SHIFT_TEMPLATES.slice(0, 3));
        shifts.push({
          id: `shift-${++n}`,
          employeeId: employee.id,
          teamId: employee.teamId,
          locationId: employee.locationId,
          date: addDays(weekStart, d),
          start: tpl.start,
          end: tpl.end,
          breakMinutes: tpl.breakMinutes,
          status: published ? 'published' : 'draft',
          note: '',
        });
      }
    }
    // A few open shifts per week to claim or fill.
    for (let i = 0; i < 3; i++) {
      const team = pick(TEAMS);
      const tpl = pick(SHIFT_TEMPLATES);
      shifts.push({
        id: `shift-${++n}`,
        employeeId: null,
        teamId: team.id,
        locationId: team.locationId,
        date: addDays(weekStart, faker.number.int({ min: 0, max: 6 })),
        start: tpl.start,
        end: tpl.end,
        breakMinutes: tpl.breakMinutes,
        status: published ? 'published' : 'draft',
        note: 'Needs cover',
      });
    }
  }
  return shifts;
}

/** Wall-clock `yyyy-MM-dd` + `HH:mm` in the viewer's time zone as a real ISO instant. */
function localInstant(date: string, time: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, h ?? 0, min ?? 0).toISOString();
}

function buildClockEntries(shifts: Shift[], anchorWeek: string, today: string): ClockEntry[] {
  const entries: ClockEntry[] = [];
  let n = 0;
  const past = shifts.filter(
    (s) =>
      s.employeeId &&
      s.status === 'published' &&
      s.date < today &&
      s.date >= addDays(anchorWeek, -14),
  );
  for (const s of past) {
    const jitterIn = faker.number.int({ min: -5, max: 10 });
    const jitterOut = faker.number.int({ min: -10, max: 15 });
    const dateOf = (time: string, offset: number): string => {
      const minutes = toMinutes(time) + offset;
      return localInstant(s.date, fromMinutes(minutes));
    };
    const clockIn = dateOf(s.start, jitterIn);
    const endDate = toMinutes(s.end) <= toMinutes(s.start) ? addDays(s.date, 1) : s.date;
    const clockOut = localInstant(endDate, fromMinutes(toMinutes(s.end) + jitterOut));
    const breakStartMin = toMinutes(s.start) + Math.floor(spanMinutes(s.start, s.end) / 2);
    const week = startOfWeek(s.date);
    entries.push({
      id: `clock-${++n}`,
      employeeId: must(s.employeeId ?? undefined, 'employee'),
      date: s.date,
      clockIn,
      clockOut,
      breaks:
        s.breakMinutes > 0
          ? [
              {
                start: localInstant(s.date, fromMinutes(breakStartMin)),
                end: localInstant(s.date, fromMinutes(breakStartMin + s.breakMinutes)),
              },
            ]
          : [],
      // Older weeks are approved, last week waits for the manager.
      status: week < addDays(anchorWeek, -7) ? 'approved' : 'submitted',
      comment: '',
    });
  }
  return entries;
}

function buildAbsences(employees: Employee[], anchorWeek: string): AbsenceRequest[] {
  const requests: AbsenceRequest[] = [];
  let n = 0;
  const people = employees.filter((e) => e.userRole === 'employee');
  const kinds: AbsenceTypeKey[] = [
    'vacation',
    'vacation',
    'sick',
    'special-leave',
    'parental-leave',
    'unpaid-leave',
  ];
  for (const employee of people.slice(0, 18)) {
    const offsetWeeks = faker.number.int({ min: -4, max: 6 });
    const start = addDays(anchorWeek, offsetWeeks * 7 + faker.number.int({ min: 0, max: 4 }));
    const length = faker.number.int({ min: 0, max: 4 });
    const type = pick(kinds);
    const status =
      offsetWeeks < 0
        ? 'approved'
        : offsetWeeks < 2
          ? pick(['approved', 'pending'] as const)
          : 'pending';
    requests.push({
      id: `abs-${++n}`,
      employeeId: employee.id,
      type,
      startDate: start,
      endDate: addDays(start, length),
      status: type === 'sick' ? 'approved' : status,
      reason:
        type === 'sick'
          ? ''
          : faker.helpers.arrayElement(['Family trip', 'Moving house', 'Appointment', 'Rest']),
      comment: '',
    });
  }
  // The demo employee always has one pending request, so approvals show up for managers.
  requests.push({
    id: `abs-${++n}`,
    employeeId: 'emp-003',
    type: 'vacation',
    startDate: addDays(anchorWeek, 21),
    endDate: addDays(anchorWeek, 25),
    status: 'pending',
    reason: 'Summer break',
    comment: '',
  });
  return requests;
}

function buildNotifications(): AppNotification[] {
  return [
    {
      id: 'note-1',
      userId: 'emp-002',
      kind: 'absence',
      title: 'Absence request waiting',
      message: 'Sara Bakker asked for 5 days of vacation.',
      createdAt: new Date(Date.UTC(2026, 0, 1, 9, 0)).toISOString(),
      read: false,
    },
    {
      id: 'note-2',
      userId: 'emp-003',
      kind: 'schedule',
      title: 'New week published',
      message: 'Your shifts for next week are ready.',
      createdAt: new Date(Date.UTC(2026, 0, 1, 8, 0)).toISOString(),
      read: false,
    },
    {
      id: 'note-3',
      userId: 'emp-001',
      kind: 'system',
      title: 'Welcome to ng-runway',
      message: 'All data here is mocked and stored in your browser.',
      createdAt: new Date(Date.UTC(2026, 0, 1, 7, 0)).toISOString(),
      read: true,
    },
  ];
}

/** Builds the full demo data set. Same seed gives the same people; dates follow `today`. */
export function createSeed(today: string): Db {
  faker.seed(SEED);
  const anchorWeek = startOfWeek(today);
  const employees = buildEmployees();
  const shifts = buildShifts(employees, anchorWeek);
  return {
    schemaVersion: DB_SCHEMA_VERSION,
    anchorWeek,
    locations: structuredClone(LOCATIONS),
    teams: structuredClone(TEAMS),
    employees,
    shifts,
    shiftTemplates: structuredClone(SHIFT_TEMPLATES),
    clockEntries: buildClockEntries(shifts, anchorWeek, today),
    absenceTypes: structuredClone(ABSENCE_TYPES),
    absences: buildAbsences(employees, anchorWeek),
    notifications: buildNotifications(),
    collections: Object.fromEntries(MOCK_FEATURES.map((f) => [f.collection, f.seed()])),
  };
}
