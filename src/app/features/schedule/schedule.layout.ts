import type {
  AbsenceRequest,
  DayAvailability,
  Employee,
  Shift,
  ShiftInput,
  ShiftTemplate,
  Team,
} from '@core/api/models';
import { shiftNetMinutes, weeklyScheduledMinutes } from '@core/domain/hours';
import { addDays, fromMinutes, spanMinutes, toMinutes, weekdayIndex } from '@core/domain/time';

/**
 * Pure layout helpers of the schedule: grouping, snapping, drag-and-drop target math.
 * No Angular in here, so everything is unit-tested as plain functions.
 */

export const SNAP_MINUTES = 15;
/** Key of the row that holds shifts without an employee. */
export const OPEN_ROW = 'open';
/** Latest start time the editor and drag math produce (a shift needs at least one snap step). */
const LAST_START = 1440 - SNAP_MINUTES;

export type ScheduleView = 'week' | 'day';

export interface DropTarget {
  /** `null` is the open shifts row. */
  employeeId: string | null;
  date: string;
}

// ---------------------------------------------------------------- snapping and time math

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function snapMinutes(minutes: number, step = SNAP_MINUTES): number {
  return Math.round(minutes / step) * step;
}

/** Rounds a `HH:mm` time to the nearest step. 23:59 snaps to `00:00` (midnight). */
export function snapTime(time: string, step = SNAP_MINUTES): string {
  return fromMinutes(snapMinutes(toMinutes(time), step));
}

/** An end at or before the start means the shift ends the next day. */
export function isOvernight(shift: Pick<Shift, 'start' | 'end'>): boolean {
  return toMinutes(shift.end) <= toMinutes(shift.start);
}

/** Moves a shift in time by `deltaMinutes` (snapped), keeping its length. The start stays within the day. */
export function moveTimes(
  shift: Pick<Shift, 'start' | 'end'>,
  deltaMinutes: number,
): { start: string; end: string } {
  const span = spanMinutes(shift.start, shift.end);
  const start = clamp(snapMinutes(toMinutes(shift.start) + deltaMinutes), 0, LAST_START);
  return { start: fromMinutes(start), end: fromMinutes(start + span) };
}

/**
 * New end time after dragging the end handle by `deltaMinutes`. Snaps to 15 minutes, keeps at least
 * one step of length and stops at midnight (`00:00`, the next day's start).
 */
export function resizeEnd(shift: Pick<Shift, 'start' | 'end'>, deltaMinutes: number): string {
  const start = toMinutes(shift.start);
  const span = spanMinutes(shift.start, shift.end);
  const next = clamp(snapMinutes(span + deltaMinutes), SNAP_MINUTES, 1440 - start);
  return fromMinutes(start + next);
}

/** Pixels moved by the pointer to minutes on the day axis, snapped to 15 minutes. */
export function deltaMinutesFromPixels(deltaPx: number, pxPerMinute: number): number {
  return snapMinutes(deltaPx / pxPerMinute);
}

export interface DayAxis {
  /** First hour on the axis (0-23). */
  startHour: number;
  /** Hour after the last one (1-24). */
  endHour: number;
}

/** Hours shown on the day view: 06:00-22:00 by default, wider when a shift falls outside. */
export function dayAxis(
  shifts: readonly Pick<Shift, 'start' | 'end'>[],
  defaults: DayAxis = { startHour: 6, endHour: 22 },
): DayAxis {
  let startHour = defaults.startHour;
  let endHour = defaults.endHour;
  for (const shift of shifts) {
    startHour = Math.min(startHour, Math.floor(toMinutes(shift.start) / 60));
    // Overnight shifts are cut at midnight on this day.
    const end = isOvernight(shift) ? 1440 : toMinutes(shift.end);
    endHour = Math.max(endHour, Math.ceil(end / 60));
  }
  return { startHour: clamp(startHour, 0, 23), endHour: clamp(endHour, startHour + 1, 24) };
}

export function axisHours(axis: DayAxis): number[] {
  return Array.from({ length: axis.endHour - axis.startHour }, (_, i) => axis.startHour + i);
}

/** Pixel offset of a time from the left edge of the day track. */
export function offsetFromTime(time: string, axis: DayAxis, pxPerMinute: number): number {
  return (toMinutes(time) - axis.startHour * 60) * pxPerMinute;
}

/** Time (snapped, within the axis) under a pixel offset of the day track. */
export function timeFromOffset(offsetPx: number, axis: DayAxis, pxPerMinute: number): string {
  const minutes = axis.startHour * 60 + offsetPx / pxPerMinute;
  const snapped = clamp(snapMinutes(minutes), axis.startHour * 60, LAST_START);
  return fromMinutes(snapped);
}

export interface ShiftBox {
  left: number;
  width: number;
}

/** Position and width of a shift chip on the day track, cut to the axis. */
export function shiftBox(
  shift: Pick<Shift, 'start' | 'end'>,
  axis: DayAxis,
  pxPerMinute: number,
): ShiftBox {
  const from = Math.max(toMinutes(shift.start), axis.startHour * 60);
  const to = Math.min(isOvernight(shift) ? 1440 : toMinutes(shift.end), axis.endHour * 60);
  return {
    left: (from - axis.startHour * 60) * pxPerMinute,
    width: Math.max(SNAP_MINUTES, to - from) * pxPerMinute,
  };
}

/** Unavailable stretches of the day track as `[left, width]` boxes (hatched in the UI). */
export function unavailableBoxes(
  availability: DayAvailability | undefined,
  axis: DayAxis,
  pxPerMinute: number,
): ShiftBox[] {
  const axisFrom = axis.startHour * 60;
  const axisTo = axis.endHour * 60;
  if (!availability) return [{ left: 0, width: (axisTo - axisFrom) * pxPerMinute }];
  const boxes: ShiftBox[] = [];
  const from = clamp(toMinutes(availability.from), axisFrom, axisTo);
  const to = clamp(toMinutes(availability.to), axisFrom, axisTo);
  if (from > axisFrom) boxes.push({ left: 0, width: (from - axisFrom) * pxPerMinute });
  if (to < axisTo)
    boxes.push({ left: (to - axisFrom) * pxPerMinute, width: (axisTo - to) * pxPerMinute });
  return boxes;
}

// ---------------------------------------------------------------- keys and grouping

export function cellKey(employeeId: string | null, date: string): string {
  return `${employeeId ?? OPEN_ROW}|${date}`;
}

export function toInput(shift: Shift): ShiftInput {
  return {
    employeeId: shift.employeeId,
    teamId: shift.teamId,
    locationId: shift.locationId,
    date: shift.date,
    start: shift.start,
    end: shift.end,
    breakMinutes: shift.breakMinutes,
    status: shift.status,
    note: shift.note,
  };
}

function byTime(a: Shift, b: Shift): number {
  return a.start.localeCompare(b.start) || a.end.localeCompare(b.end) || a.id.localeCompare(b.id);
}

/** Shifts per cell (employee or open row, and date), earliest first. */
export function groupShiftsByCell(shifts: readonly Shift[]): Map<string, Shift[]> {
  const map = new Map<string, Shift[]>();
  for (const shift of shifts) {
    const key = cellKey(shift.employeeId, shift.date);
    const list = map.get(key);
    if (list) list.push(shift);
    else map.set(key, [shift]);
  }
  for (const list of map.values()) list.sort(byTime);
  return map;
}

export function groupShiftsByEmployee(shifts: readonly Shift[]): Map<string, Shift[]> {
  const map = new Map<string, Shift[]>();
  for (const shift of shifts) {
    if (!shift.employeeId) continue;
    const list = map.get(shift.employeeId);
    if (list) list.push(shift);
    else map.set(shift.employeeId, [shift]);
  }
  return map;
}

/** Absences (pending and approved) per employee and date, for the dates that are on screen. */
export function groupAbsencesByCell(
  absences: readonly AbsenceRequest[],
  dates: readonly string[],
): Map<string, AbsenceRequest[]> {
  const map = new Map<string, AbsenceRequest[]>();
  for (const absence of absences) {
    if (absence.status === 'rejected') continue;
    for (const date of dates) {
      if (date < absence.startDate || date > absence.endDate) continue;
      const key = cellKey(absence.employeeId, date);
      const list = map.get(key);
      if (list) list.push(absence);
      else map.set(key, [absence]);
    }
  }
  return map;
}

export interface TeamGroup {
  team: Team;
  employees: Employee[];
}

/** Employees grouped by team (teams by name, people by last name). Empty teams are left out. */
export function groupEmployeesByTeam(
  employees: readonly Employee[],
  teams: readonly Team[],
): TeamGroup[] {
  const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));
  const groups: TeamGroup[] = [];
  for (const team of sortedTeams) {
    const members = employees
      .filter((e) => e.teamId === team.id)
      .sort(
        (a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName),
      );
    if (members.length > 0) groups.push({ team, employees: members });
  }
  return groups;
}

// ---------------------------------------------------------------- grid model

export interface GridCell {
  date: string;
  target: DropTarget;
  shifts: Shift[];
  absences: AbsenceRequest[];
  /** The person cannot work this weekday at all (or has no availability set). */
  unavailable: boolean;
  availability: DayAvailability | null;
}

export interface GridRow {
  /** Employee id, or `open`. */
  id: string;
  employee: Employee | null;
  cells: GridCell[];
  weeklyMinutes: number;
  contractMinutes: number;
  overContract: boolean;
}

export interface GridGroup {
  key: string;
  team: Team | null;
  rows: GridRow[];
}

export interface GridModel {
  openRow: GridRow;
  /** One group per team. */
  groups: GridGroup[];
  /** The open shifts row as a group without a team, followed by `groups`. This is what the table loops over. */
  all: GridGroup[];
}

export interface GridInput {
  employees: readonly Employee[];
  teams: readonly Team[];
  shifts: readonly Shift[];
  absences: readonly AbsenceRequest[];
  /** Dates on screen: seven for the week view, one for the day view. */
  dates: readonly string[];
  /** Monday of the loaded week, for the hours per week. */
  weekStart: string;
}

/**
 * Builds everything the grid renders in one pass, so the template does no per-cell work:
 * cells with their shifts, absences and availability, plus weekly hours against the contract.
 */
export function buildGrid({
  employees,
  teams,
  shifts,
  absences,
  dates,
  weekStart,
}: GridInput): GridModel {
  const cellShifts = groupShiftsByCell(shifts);
  const cellAbsences = groupAbsencesByCell(absences, dates);
  const byEmployee = groupShiftsByEmployee(shifts);

  const openRow: GridRow = {
    id: OPEN_ROW,
    employee: null,
    cells: dates.map((date) => ({
      date,
      target: { employeeId: null, date },
      shifts: cellShifts.get(cellKey(null, date)) ?? [],
      absences: [],
      unavailable: false,
      availability: null,
    })),
    weeklyMinutes: 0,
    contractMinutes: 0,
    overContract: false,
  };

  const rowFor = (employee: Employee): GridRow => {
    const weeklyMinutes = weeklyScheduledMinutes(
      byEmployee.get(employee.id) ?? [],
      employee.id,
      weekStart,
    );
    const contractMinutes = employee.contract.hoursPerWeek * 60;
    return {
      id: employee.id,
      employee,
      cells: dates.map((date) => {
        const availability = employee.availability[weekdayIndex(date)] ?? null;
        return {
          date,
          target: { employeeId: employee.id, date },
          shifts: cellShifts.get(cellKey(employee.id, date)) ?? [],
          absences: cellAbsences.get(cellKey(employee.id, date)) ?? [],
          unavailable: availability === null,
          availability,
        };
      }),
      weeklyMinutes,
      contractMinutes,
      overContract: weeklyMinutes > contractMinutes,
    };
  };

  const groups = groupEmployeesByTeam(employees, teams).map(({ team, employees: members }) => ({
    key: team.id,
    team,
    rows: members.map(rowFor),
  }));
  return { openRow, groups, all: [{ key: OPEN_ROW, team: null, rows: [openRow] }, ...groups] };
}

function sameList<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

function sameCell(a: GridCell, b: GridCell): boolean {
  return (
    a.date === b.date &&
    a.unavailable === b.unavailable &&
    a.availability === b.availability &&
    sameList(a.shifts, b.shifts) &&
    sameList(a.absences, b.absences)
  );
}

function sameRow(a: GridRow, b: GridRow): boolean {
  return (
    a.employee === b.employee &&
    a.weeklyMinutes === b.weeklyMinutes &&
    a.contractMinutes === b.contractMinutes &&
    a.cells.length === b.cells.length &&
    a.cells.every((cell, i) => sameCell(cell, b.cells[i] as GridCell))
  );
}

/**
 * Keeps the objects of rows and groups that did not change. The table tracks rows and groups by
 * identity, so a move only rebuilds the rows it touched instead of the whole table. (Angular's
 * `@for` does not refresh views of an item that keeps its key but arrives as a new object.)
 */
export function shareStructure(prev: GridModel | null, next: GridModel): GridModel {
  if (!prev) return next;
  const prevRows = new Map<string, GridRow>();
  for (const group of prev.all) for (const row of group.rows) prevRows.set(row.id, row);
  const prevGroups = new Map(prev.all.map((group) => [group.key, group]));

  const shareRow = (row: GridRow): GridRow => {
    const old = prevRows.get(row.id);
    return old && sameRow(old, row) ? old : row;
  };
  const shareGroup = (group: GridGroup): GridGroup => {
    const rows = group.rows.map(shareRow);
    const old = prevGroups.get(group.key);
    return old && old.team === group.team && sameList(old.rows, rows) ? old : { ...group, rows };
  };

  const openGroup = shareGroup(next.all[0] as GridGroup);
  const groups = next.groups.map(shareGroup);
  return { openRow: openGroup.rows[0] as GridRow, groups, all: [openGroup, ...groups] };
}

// ---------------------------------------------------------------- drag and drop results

/**
 * The shift as it looks after a drop on `target`. A new person brings their team and location; the
 * open row keeps the shift's own. `deltaMinutes` shifts the times (day view), 0 keeps them.
 */
export function moveToTarget(
  shift: Shift,
  target: DropTarget,
  employees: ReadonlyMap<string, Employee>,
  deltaMinutes = 0,
): ShiftInput {
  const employee = target.employeeId ? employees.get(target.employeeId) : undefined;
  const times =
    deltaMinutes === 0 ? { start: shift.start, end: shift.end } : moveTimes(shift, deltaMinutes);
  return {
    ...toInput(shift),
    ...times,
    employeeId: target.employeeId,
    date: target.date,
    teamId: employee?.teamId ?? shift.teamId,
    locationId: employee?.locationId ?? shift.locationId,
  };
}

export interface NewShiftContext {
  /** Used when the target has no employee (open shift). */
  teamId: string;
  locationId: string;
  /** Start dropped on the day view track; the template's own start otherwise. */
  start?: string;
}

/** A draft shift made from a template and a drop target. */
export function shiftFromTemplate(
  template: ShiftTemplate,
  target: DropTarget,
  employees: ReadonlyMap<string, Employee>,
  context: NewShiftContext,
): ShiftInput {
  const employee = target.employeeId ? employees.get(target.employeeId) : undefined;
  const start = context.start ?? template.start;
  const span = spanMinutes(template.start, template.end);
  return {
    employeeId: target.employeeId,
    teamId: employee?.teamId ?? context.teamId,
    locationId: employee?.locationId ?? context.locationId,
    date: target.date,
    start,
    end: fromMinutes(toMinutes(start) + span),
    breakMinutes: template.breakMinutes,
    status: 'draft',
    note: '',
  };
}

/** Template whose times match the shift exactly, for labels. */
export function templateFor(
  shift: Pick<Shift, 'start' | 'end' | 'breakMinutes'>,
  templates: readonly ShiftTemplate[],
): ShiftTemplate | undefined {
  return templates.find(
    (t) => t.start === shift.start && t.end === shift.end && t.breakMinutes === shift.breakMinutes,
  );
}

// ---------------------------------------------------------------- draft validation

export type DraftProblem = 'dateRequired' | 'timeRequired' | 'sameTime' | 'breakTooLong';

export interface ShiftDraft {
  date: string;
  start: string;
  end: string;
  breakMinutes: number;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Problems that block saving. Conflicts are different: they warn but never block. */
export function validateDraft(draft: ShiftDraft): DraftProblem[] {
  const problems: DraftProblem[] = [];
  if (!draft.date) problems.push('dateRequired');
  if (!TIME.test(draft.start) || !TIME.test(draft.end)) {
    problems.push('timeRequired');
    return problems;
  }
  if (draft.start === draft.end) {
    problems.push('sameTime');
    return problems;
  }
  if (!Number.isFinite(draft.breakMinutes) || draft.breakMinutes < 0) {
    problems.push('breakTooLong');
  } else if (shiftNetMinutes(draft) <= 0 && draft.breakMinutes > 0) {
    problems.push('breakTooLong');
  }
  return problems;
}

// ---------------------------------------------------------------- dates for display

export function weekRange(weekStart: string): { from: string; to: string } {
  return { from: weekStart, to: addDays(weekStart, 6) };
}

const formatters = new Map<string, Intl.DateTimeFormat>();

/** Formats a `yyyy-MM-dd` date as a calendar day, whatever the machine time zone is. */
export function formatDay(
  date: string,
  locale: string,
  options: Intl.DateTimeFormatOptions,
): string {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...options });
    formatters.set(key, formatter);
  }
  return formatter.format(new Date(`${date}T00:00:00Z`));
}

/** "9 Nov - 15 Nov 2026" for a week, or the single day when `from` equals `to`. */
export function formatRange(from: string, to: string, locale: string): string {
  if (from === to) {
    return formatDay(from, locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
  const start = formatDay(from, locale, { day: 'numeric', month: 'short' });
  const end = formatDay(to, locale, { day: 'numeric', month: 'short', year: 'numeric' });
  return `${start} - ${end}`;
}
