import type { ContractType, Employee, EmployeeInput, Team, UserRole } from '@core/api/models';
import { defaultWeek, formToWeek, weekToForm, type AvailabilityDayForm } from './availability';
import { parseDecimal } from './employee-form.rules';

export const CONTRACT_TYPES: readonly ContractType[] = [
  'permanent',
  'fixed-term',
  'flex',
  'intern',
];
export const USER_ROLES: readonly UserRole[] = ['employee', 'manager', 'admin'];

/**
 * What the form edits. Every text-like field is a string, because that is what inputs produce;
 * `toEmployeeInput` turns it into the API shape, `toFormModel` goes the other way.
 */
export interface EmployeeFormModel {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
  teamId: string;
  userRole: UserRole;
  contractType: ContractType;
  /** Decimal as typed, for example "32" or "37,5". */
  hoursPerWeek: string;
  /** Euros as typed, for example "18.50". The API stores cents. */
  hourlyRate: string;
  startDate: string;
  active: boolean;
  availability: AvailabilityDayForm[];
}

export function emptyEmployeeForm(today: string, teamId = ''): EmployeeFormModel {
  return {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    jobTitle: '',
    teamId,
    userRole: 'employee',
    contractType: 'permanent',
    hoursPerWeek: '40',
    hourlyRate: '',
    startDate: today,
    active: true,
    availability: defaultWeek(),
  };
}

export function centsToEuros(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function eurosToCents(euros: string): number {
  return Math.round(parseDecimal(euros) * 100);
}

export function toFormModel(employee: Employee): EmployeeFormModel {
  return {
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    phone: employee.phone,
    jobTitle: employee.jobTitle,
    teamId: employee.teamId,
    userRole: employee.userRole,
    contractType: employee.contract.type,
    hoursPerWeek: String(employee.contract.hoursPerWeek),
    hourlyRate: centsToEuros(employee.contract.hourlyRateCents),
    startDate: employee.contract.startDate,
    active: employee.active,
    availability: weekToForm(employee.availability),
  };
}

export interface InputContext {
  teams: readonly Team[];
  /** The record being edited. Its contract end date is kept, the form does not edit it. */
  existing?: Employee | null;
}

/** The location always follows the team, so the form only asks for the team. */
export function toEmployeeInput(model: EmployeeFormModel, context: InputContext): EmployeeInput {
  const team = context.teams.find((t) => t.id === model.teamId);
  return {
    firstName: model.firstName.trim(),
    lastName: model.lastName.trim(),
    email: model.email.trim(),
    phone: model.phone.trim(),
    jobTitle: model.jobTitle.trim(),
    teamId: model.teamId,
    locationId: team?.locationId ?? context.existing?.locationId ?? '',
    userRole: model.userRole,
    contract: {
      type: model.contractType,
      hoursPerWeek: parseDecimal(model.hoursPerWeek),
      hourlyRateCents: eurosToCents(model.hourlyRate),
      startDate: model.startDate,
      endDate: context.existing?.contract.endDate ?? null,
    },
    availability: formToWeek(model.availability),
    active: model.active,
  };
}
