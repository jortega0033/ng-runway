import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, type Type } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { API_BASE_URL } from '@core/api/api-config';
import type { Employee, LoginResponse, Team, UserRole } from '@core/api/models';
import { SESSION_STORAGE_KEY } from '@core/auth/auth.service';
import { ToastService } from '@ui/toast/toast';
import { provideTestTransloco } from '../../../testing/transloco-testing';
import employeesEn from '../../../../../public/i18n/employees/en.json';
import { EmployeeFormReactiveComponent } from './employee-form-reactive';
import { EmployeeFormComponent } from './employee-form';

const BASE = 'http://localhost/api';

const TEAMS: Team[] = [
  { id: 'team-a', name: 'Amsterdam Floor', locationId: 'loc-ams', color: 'team-color' },
  { id: 'team-b', name: 'Rotterdam Kitchen', locationId: 'loc-rtm', color: 'team-color' },
];

const EXISTING: Employee = {
  id: 'emp-9',
  firstName: 'Sara',
  lastName: 'Bakker',
  email: 'sara@example.com',
  phone: '',
  jobTitle: 'Barista',
  teamId: 'team-a',
  locationId: 'loc-ams',
  userRole: 'employee',
  contract: {
    type: 'permanent',
    hoursPerWeek: 32,
    hourlyRateCents: 1850,
    startDate: '2025-03-01',
    endDate: null,
  },
  availability: [{ from: '08:00', to: '16:00' }, null, null, null, null, null, null],
  active: true,
};

@Component({ template: 'profile' })
class ProfileStub {}

function signIn(role: UserRole): void {
  const session: LoginResponse = {
    token: 'mock-token-test',
    user: {
      id: 'emp-x',
      name: 'Test User',
      email: 't@example.com',
      role,
      teamId: 'team-a',
      locationId: 'loc-ams',
    },
  };
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

/** The control that belongs to a label, found the way a user finds it. */
function control(root: HTMLElement, label: string): HTMLInputElement | HTMLSelectElement {
  const found = Array.from(root.querySelectorAll('label')).find((l) =>
    l.textContent?.trim().startsWith(label),
  );
  const element = found ? root.querySelector(`#${found.htmlFor}`) : null;
  if (!element) throw new Error(`No control labelled "${label}"`);
  return element as HTMLInputElement | HTMLSelectElement;
}

function type(root: HTMLElement, label: string, text: string): void {
  const input = control(root, label);
  input.value = text;
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('blur'));
}

function choose(root: HTMLElement, label: string, value: string): void {
  const select = control(root, label);
  select.value = value;
  select.dispatchEvent(new Event('change'));
}

const submitButton = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLButtonElement>('button[type=submit]'))[0]!;

describe.each<[string, Type<unknown>]>([
  ['Signal Forms', EmployeeFormComponent],
  ['Reactive Forms', EmployeeFormReactiveComponent],
])('employee form (%s)', (_name, component) => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    signIn('manager');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'employees/:id', component: ProfileStub }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
        provideTestTransloco({ employees: employeesEn }),
        provideTranslocoScope('employees'),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => localStorage.clear());

  async function create(employee: Employee | null = null) {
    const fixture: ComponentFixture<unknown> = TestBed.createComponent(component);
    fixture.componentRef.setInput('teams', TEAMS);
    fixture.componentRef.setInput('employee', employee);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  /** Fills every required field with valid values. */
  function fillValid(root: HTMLElement) {
    type(root, 'First name', 'Noor');
    type(root, 'Last name', 'Visser');
    type(root, 'Email', 'noor@example.com');
    choose(root, 'Team', 'team-b');
    type(root, 'Hourly rate', '19,50');
  }

  it('renders the scoped English texts', async () => {
    const { root } = await create();
    expect(root.textContent).toContain('Personal details');
    expect(root.textContent).toContain('Availability');
    expect(control(root, 'First name')).toBeTruthy();
  });

  it('shows what is missing and sends nothing when an empty form is saved', async () => {
    const { fixture, root } = await create();
    submitButton(root).click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.textContent).toContain('This field is required.');
    expect(root.querySelector('[role=alert]')?.textContent).toContain('Check the form');
    expect(control(root, 'First name').getAttribute('aria-invalid')).toBe('true');
    http.expectNone(`${BASE}/employees`);
  });

  it('flags a malformed email', async () => {
    const { fixture, root } = await create();
    type(root, 'Email', 'not-an-email');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root.textContent).toContain('Enter a valid email address.');
  });

  it('keeps hours per week between 0 and 60', async () => {
    const { fixture, root } = await create();
    type(root, 'Hours per week', '61');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root.textContent).toContain('Hours per week must be between 0 and 60.');

    type(root, 'Hours per week', '60');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root.textContent).not.toContain('Hours per week must be between 0 and 60.');
  });

  it('creates the employee, shows a toast and opens the profile', async () => {
    const { fixture, root } = await create();
    fillValid(root);
    fixture.detectChanges();
    submitButton(root).click();

    const request = await vi.waitFor(() =>
      http.expectOne({ method: 'POST', url: `${BASE}/employees` }),
    );
    expect(request.request.body).toMatchObject({
      firstName: 'Noor',
      lastName: 'Visser',
      email: 'noor@example.com',
      teamId: 'team-b',
      locationId: 'loc-rtm',
      userRole: 'employee',
      contract: { type: 'permanent', hoursPerWeek: 40, hourlyRateCents: 1950, endDate: null },
      active: true,
    });
    expect((request.request.body as Employee).availability).toHaveLength(7);
    request.flush(
      { ...(request.request.body as Employee), id: 'emp-new' },
      { status: 201, statusText: 'Created' },
    );

    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/employees/emp-new'));
    expect(TestBed.inject(ToastService).toasts()[0]?.title).toBe('Employee added');
  });

  it('disables saving while the request runs', async () => {
    const { fixture, root } = await create();
    fillValid(root);
    fixture.detectChanges();
    submitButton(root).click();
    const request = await vi.waitFor(() =>
      http.expectOne({ method: 'POST', url: `${BASE}/employees` }),
    );
    fixture.detectChanges();
    expect(submitButton(root).disabled).toBe(true);
    request.flush({ message: 'Nope' }, { status: 500, statusText: 'Server Error' });
  });

  it('shows the server message and lets the user try again', async () => {
    const { fixture, root } = await create();
    fillValid(root);
    fixture.detectChanges();
    submitButton(root).click();
    const request = await vi.waitFor(() =>
      http.expectOne({ method: 'POST', url: `${BASE}/employees` }),
    );
    request.flush(
      { message: 'That email address is already in use.' },
      { status: 409, statusText: 'Conflict' },
    );
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(root.textContent).toContain('That email address is already in use.');
    });
    expect(root.textContent).toContain('Could not save the employee');
    expect(submitButton(root).disabled).toBe(false);
  });

  it('fills the form from an existing employee and saves with PUT', async () => {
    const { fixture, root } = await create(EXISTING);
    expect(control(root, 'First name').value).toBe('Sara');
    expect(control(root, 'Hours per week').value).toBe('32');
    expect(control(root, 'Hourly rate').value).toBe('18.50');
    expect(control(root, 'Team').value).toBe('team-a');

    type(root, 'Job title', 'Shift lead');
    fixture.detectChanges();
    submitButton(root).click();

    const request = await vi.waitFor(() =>
      http.expectOne({ method: 'PUT', url: `${BASE}/employees/emp-9` }),
    );
    expect(request.request.body).toMatchObject({
      jobTitle: 'Shift lead',
      contract: { hoursPerWeek: 32, hourlyRateCents: 1850, startDate: '2025-03-01' },
    });
    expect((request.request.body as Employee).availability[0]).toEqual({
      from: '08:00',
      to: '16:00',
    });
    request.flush({ ...EXISTING, jobTitle: 'Shift lead' });
    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/employees/emp-9'));
    expect(TestBed.inject(ToastService).toasts()[0]?.title).toBe('Employee updated');
  });

  it('shows time pickers only for the days that are switched on', async () => {
    const { fixture, root } = await create(EXISTING);
    // Monday is on in the fixture, the other six days are off.
    expect(root.querySelectorAll('ui-time-picker')).toHaveLength(2);
    const sunday = Array.from(root.querySelectorAll<HTMLInputElement>('input[role=switch]')).find(
      (s) => s.closest('label')?.textContent?.includes('Sunday'),
    );
    sunday!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root.querySelectorAll('ui-time-picker')).toHaveLength(4);
  });

  it('rejects an availability day that ends before it starts', async () => {
    const { fixture, root } = await create(EXISTING);
    // Monday: 08:00-16:00. Move the end to 07:00.
    const end = root.querySelectorAll<HTMLInputElement>('ui-time-picker input[type=text]')[1];
    end!.value = '07:00';
    end!.dispatchEvent(new Event('input'));
    end!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    end!.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root.textContent).toContain('The end time must be after the start time.');

    submitButton(root).click();
    fixture.detectChanges();
    await fixture.whenStable();
    http.expectNone({ method: 'PUT', url: `${BASE}/employees/emp-9` });
  });

  it('lets only admins assign the admin role', async () => {
    const asManager = await create();
    const adminOption = (root: HTMLElement) =>
      Array.from(control(root, 'Role').querySelectorAll('option')).find((o) => o.value === 'admin');
    expect(adminOption(asManager.root)?.disabled).toBe(true);
    expect(asManager.root.textContent).toContain('Only admins can assign the admin role.');
  });
});

describe('employee form as admin', () => {
  it('can assign the admin role', async () => {
    localStorage.clear();
    signIn('admin');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
        provideTestTransloco({ employees: employeesEn }),
        provideTranslocoScope('employees'),
      ],
    });
    const fixture = TestBed.createComponent(EmployeeFormComponent);
    fixture.componentRef.setInput('teams', TEAMS);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const option = Array.from(control(root, 'Role').querySelectorAll('option')).find(
      (o) => o.value === 'admin',
    );
    expect(option?.disabled).toBe(false);
    localStorage.clear();
  });
});
