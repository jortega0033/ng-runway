import type { Employee, Team } from '@core/api/models';
import { resolveFormVariant } from './employee-form.config';
import {
  centsToEuros,
  emptyEmployeeForm,
  eurosToCents,
  toEmployeeInput,
  toFormModel,
} from './employee-form.model';

const TEAMS: Team[] = [
  { id: 'team-a', name: 'Amsterdam Floor', locationId: 'loc-ams', color: 'team-color' },
  { id: 'team-b', name: 'Rotterdam Kitchen', locationId: 'loc-rtm', color: 'team-color' },
];

const EMPLOYEE: Employee = {
  id: 'emp-9',
  firstName: 'Sara',
  lastName: 'Bakker',
  email: 'sara@example.com',
  phone: '+31 6 1234 5678',
  jobTitle: 'Barista',
  teamId: 'team-a',
  locationId: 'loc-ams',
  userRole: 'employee',
  contract: {
    type: 'fixed-term',
    hoursPerWeek: 32,
    hourlyRateCents: 1850,
    startDate: '2025-03-01',
    endDate: '2026-12-31',
  },
  availability: [{ from: '08:00', to: '16:00' }, null, null, null, null, null, null],
  active: true,
};

describe('employee form model', () => {
  it('converts euros and cents without rounding drift', () => {
    expect(centsToEuros(1850)).toBe('18.50');
    expect(eurosToCents('18,50')).toBe(1850);
    expect(eurosToCents('0.1')).toBe(10);
    expect(eurosToCents('19.99')).toBe(1999);
  });

  it('starts a new employee with sensible defaults', () => {
    const model = emptyEmployeeForm('2026-11-09');
    expect(model).toMatchObject({
      firstName: '',
      userRole: 'employee',
      contractType: 'permanent',
      hoursPerWeek: '40',
      startDate: '2026-11-09',
      active: true,
    });
    expect(model.availability).toHaveLength(7);
  });

  it('maps an employee to the form and back without losing anything', () => {
    const input = toEmployeeInput(toFormModel(EMPLOYEE), { teams: TEAMS, existing: EMPLOYEE });
    expect({ ...input, id: EMPLOYEE.id }).toEqual(EMPLOYEE);
  });

  it('derives the location from the chosen team', () => {
    const model = { ...toFormModel(EMPLOYEE), teamId: 'team-b' };
    expect(toEmployeeInput(model, { teams: TEAMS, existing: EMPLOYEE }).locationId).toBe('loc-rtm');
  });

  it('trims text and parses typed numbers', () => {
    const model = {
      ...emptyEmployeeForm('2026-11-09', 'team-a'),
      firstName: '  Noor ',
      lastName: 'Visser  ',
      email: ' noor@example.com ',
      hoursPerWeek: '36,5',
      hourlyRate: '21,75',
    };
    const input = toEmployeeInput(model, { teams: TEAMS });
    expect(input).toMatchObject({
      firstName: 'Noor',
      lastName: 'Visser',
      email: 'noor@example.com',
      contract: { hoursPerWeek: 36.5, hourlyRateCents: 2175, endDate: null },
    });
  });
});

describe('form variant switch', () => {
  it('lets the query param win over the constant', () => {
    expect(resolveFormVariant('reactive')).toBe('reactive');
    expect(resolveFormVariant('signal', 'reactive')).toBe('signal');
  });

  it('ignores unknown values and uses the fallback', () => {
    expect(resolveFormVariant(undefined)).toBe('signal');
    expect(resolveFormVariant('template')).toBe('signal');
    expect(resolveFormVariant(null, 'reactive')).toBe('reactive');
  });
});
