/**
 * API contract. The mock handlers and the Angular services both use these types,
 * so the compiler keeps them in sync. Dates are ISO `yyyy-MM-dd`, times are `HH:mm`.
 */

export type UserRole = 'admin' | 'manager' | 'employee';

export interface Location {
  id: string;
  name: string;
  city: string;
}

export interface Team {
  id: string;
  name: string;
  locationId: string;
  /** Hex from the entity palette (data tokens). */
  color: string;
}

export type ContractType = 'permanent' | 'fixed-term' | 'flex' | 'intern';

export interface Contract {
  type: ContractType;
  hoursPerWeek: number;
  /** Hourly cost in euro cents, used for labor cost reports. */
  hourlyRateCents: number;
  startDate: string;
  endDate: string | null;
}

/** Availability for one weekday (0 = Monday). `null` means not available. */
export type DayAvailability = { from: string; to: string } | null;

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
  teamId: string;
  locationId: string;
  userRole: UserRole;
  contract: Contract;
  /** Seven entries, Monday first. */
  availability: DayAvailability[];
  active: boolean;
}

export type EmployeeInput = Omit<Employee, 'id'>;

export type ShiftStatus = 'draft' | 'published';

export interface Shift {
  id: string;
  /** `null` is an open shift that nobody has taken yet. */
  employeeId: string | null;
  teamId: string;
  locationId: string;
  date: string;
  start: string;
  end: string;
  breakMinutes: number;
  status: ShiftStatus;
  note: string;
}

export type ShiftInput = Omit<Shift, 'id'>;

export interface ShiftTemplate {
  id: string;
  name: string;
  start: string;
  end: string;
  breakMinutes: number;
}

export type TimesheetStatus = 'open' | 'submitted' | 'approved' | 'rejected';

export interface BreakEntry {
  start: string;
  /** ISO date-time, `null` while the break is running. */
  end: string | null;
}

export interface ClockEntry {
  id: string;
  employeeId: string;
  date: string;
  /** ISO date-times. */
  clockIn: string;
  clockOut: string | null;
  breaks: BreakEntry[];
  status: TimesheetStatus;
  comment: string;
}

export type AbsenceTypeKey =
  | 'vacation'
  | 'sick'
  | 'unavailable'
  | 'holiday'
  | 'special-leave'
  | 'maternity-leave'
  | 'short-term-care-leave'
  | 'long-term-care-leave'
  | 'parental-leave'
  | 'unpaid-leave';

export interface AbsenceType {
  key: AbsenceTypeKey;
  name: string;
  paid: boolean;
  /** Yearly entitlement in days, `null` when the type has no balance. */
  yearlyDays: number | null;
}

export type AbsenceStatus = 'pending' | 'approved' | 'rejected';

export interface AbsenceRequest {
  id: string;
  employeeId: string;
  type: AbsenceTypeKey;
  startDate: string;
  endDate: string;
  status: AbsenceStatus;
  reason: string;
  /** Manager comment on approve or reject. */
  comment: string;
}

export type AbsenceRequestInput = Pick<
  AbsenceRequest,
  'employeeId' | 'type' | 'startDate' | 'endDate' | 'reason'
>;

export interface AbsenceBalance {
  employeeId: string;
  type: AbsenceTypeKey;
  entitlementDays: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
}

export type NotificationKind = 'absence' | 'timesheet' | 'schedule' | 'system';

export interface AppNotification {
  id: string;
  /** Employee id this notification is for. */
  userId: string;
  kind: NotificationKind;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  teamId: string;
  locationId: string;
}

export interface LoginResponse {
  token: string;
  user: SessionUser;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type SortDirection = 'asc' | 'desc';

export interface ListQuery {
  page?: number;
  pageSize?: number;
  sort?: string;
  dir?: SortDirection;
  q?: string;
}

export interface EmployeeQuery extends ListQuery {
  teamId?: string;
  locationId?: string;
  userRole?: UserRole | '';
  active?: boolean;
}

export interface ReportRow {
  teamId: string;
  teamName: string;
  hours: number;
  laborCostCents: number;
  scheduledHours: number;
}

export interface ReportResult {
  from: string;
  to: string;
  rows: ReportRow[];
  /** Per-day totals across all teams for the chart. */
  daily: { date: string; hours: number; laborCostCents: number }[];
}

export interface ApiErrorBody {
  message: string;
  code?: string;
}
