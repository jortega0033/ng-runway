import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideTranslocoScope } from '@jsverse/transloco';
import { API_BASE_URL } from '@core/api/api-config';
import type { Employee, Location, LoginResponse, Page, Team, UserRole } from '@core/api/models';
import { SESSION_STORAGE_KEY } from '@core/auth/auth.service';
import { provideTestTransloco } from '../../../testing/transloco-testing';
import employeesEn from '../../../../../public/i18n/employees/en.json';
import { EmployeeListPage, SEARCH_DEBOUNCE_MS } from './employee-list.page';

const BASE = 'http://localhost/api';

const TEAMS: Team[] = [
  { id: 'team-a', name: 'Amsterdam Floor', locationId: 'loc-ams', color: 'team-color' },
  { id: 'team-b', name: 'Rotterdam Kitchen', locationId: 'loc-rtm', color: 'team-color' },
];
const LOCATIONS: Location[] = [
  { id: 'loc-ams', name: 'Amsterdam Central', city: 'Amsterdam' },
  { id: 'loc-rtm', name: 'Rotterdam Harbour', city: 'Rotterdam' },
];

function employee(n: number, overrides: Partial<Employee> = {}): Employee {
  return {
    id: `emp-${n}`,
    firstName: `First${n}`,
    lastName: `Last${n}`,
    email: `person${n}@example.com`,
    phone: '',
    jobTitle: 'Barista',
    teamId: 'team-a',
    locationId: 'loc-ams',
    userRole: 'employee',
    contract: {
      type: 'permanent',
      hoursPerWeek: 32,
      hourlyRateCents: 1800,
      startDate: '2025-01-01',
      endDate: null,
    },
    availability: [null, null, null, null, null, null, null],
    active: true,
    ...overrides,
  };
}

function pageOf(items: Employee[], total: number, page = 1, pageSize = 10): Page<Employee> {
  return { items, total, page, pageSize };
}

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

describe('EmployeeListPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    signIn('manager');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'employees', component: EmployeeListPage },
          { path: 'employees/new', component: ProfileStub },
          { path: 'employees/:id', component: ProfileStub },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
        provideTestTransloco({ employees: employeesEn }),
        provideTranslocoScope('employees'),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  /** Opens the page and answers the lookups and the first page of employees. */
  async function open(url = '/employees', firstPage = pageOf([employee(1), employee(2)], 2)) {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl(url, EmployeeListPage);
    http.expectOne(`${BASE}/teams`).flush(TEAMS);
    http.expectOne(`${BASE}/locations`).flush(LOCATIONS);
    harness.detectChanges();
    http.expectOne((r) => r.url === `${BASE}/employees`).flush(firstPage);
    harness.detectChanges();
    return { harness, component, root: harness.routeNativeElement as HTMLElement };
  }

  const employeeRequests = () => http.match((r) => r.url === `${BASE}/employees`);

  it('renders translated scope texts and the rows of the first page', async () => {
    const { root } = await open();
    expect(root.querySelector('h1')?.textContent).toContain('Employees');
    expect(root.textContent).toContain('First1 Last1');
    expect(root.textContent).toContain('First2 Last2');
    expect(root.querySelectorAll('[role=row]').length).toBe(3); // header + 2 rows
    expect(root.textContent).toContain('Amsterdam Floor');
  });

  it('shows the New employee button to managers', async () => {
    const { root } = await open();
    const labels = Array.from(root.querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(labels).toContain('New employee');
  });

  it('shows skeleton rows while loading', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/employees', EmployeeListPage);
    http.expectOne(`${BASE}/teams`).flush(TEAMS);
    http.expectOne(`${BASE}/locations`).flush(LOCATIONS);
    harness.detectChanges();
    const table = (harness.routeNativeElement as HTMLElement).querySelector('[role=table]');
    expect(table?.getAttribute('aria-busy')).toBe('true');
    http.expectOne((r) => r.url === `${BASE}/employees`).flush(pageOf([], 0));
  });

  it('sends one request after the user stops typing, not one per key', async () => {
    const { harness, root } = await open();
    vi.useFakeTimers();
    const input = root.querySelector<HTMLInputElement>('input[type=search]');
    expect(input).not.toBeNull();
    const type = (text: string) => {
      input!.value = text;
      input!.dispatchEvent(new Event('input'));
    };

    type('s');
    vi.advanceTimersByTime(100);
    type('sa');
    vi.advanceTimersByTime(100);
    type('sara');
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1);
    harness.detectChanges();
    expect(employeeRequests()).toHaveLength(0);

    vi.advanceTimersByTime(1);
    harness.detectChanges();
    const requests = employeeRequests();
    expect(requests).toHaveLength(1);
    expect(requests[0]?.request.params.get('q')).toBe('sara');
    expect(requests[0]?.request.params.get('page')).toBe('1');
    requests[0]?.flush(pageOf([employee(3)], 1));
  });

  it('does not search again when the pause ends on the same text', async () => {
    const { harness, root } = await open();
    vi.useFakeTimers();
    const input = root.querySelector<HTMLInputElement>('input[type=search]')!;
    const type = (text: string) => {
      input.value = text;
      input.dispatchEvent(new Event('input'));
    };
    type('sara');
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    harness.detectChanges();
    employeeRequests()[0]?.flush(pageOf([employee(3)], 1));

    type('saraa');
    vi.advanceTimersByTime(100);
    type('sara');
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    harness.detectChanges();
    expect(employeeRequests()).toHaveLength(0);
  });

  it('asks the server for the next page and keeps it in the URL', async () => {
    const { harness, root } = await open(
      '/employees',
      pageOf(
        Array.from({ length: 10 }, (_, i) => employee(i + 1)),
        25,
      ),
    );
    const next = root.querySelector<HTMLButtonElement>('button[aria-label="Next page"]');
    expect(next?.disabled).toBe(false);
    next!.click();
    harness.detectChanges();

    const requests = employeeRequests();
    expect(requests).toHaveLength(1);
    expect(requests[0]?.request.params.get('page')).toBe('2');
    requests[0]?.flush(pageOf([employee(11)], 25, 2));
    harness.detectChanges();

    const router = TestBed.inject(Router);
    await vi.waitFor(() => expect(router.url).toContain('page=2'));
    expect(root.textContent).toContain('First11 Last11');
  });

  it('sorts on the server when a column header is clicked and flips on a second click', async () => {
    const { harness, root } = await open();
    const header = Array.from(
      root.querySelectorAll<HTMLButtonElement>('[role=columnheader] button'),
    ).find((b) => b.textContent?.includes('Name'));
    expect(header).toBeDefined();

    header!.click();
    harness.detectChanges();
    let [request] = employeeRequests();
    expect(request?.request.params.get('sort')).toBe('name');
    expect(request?.request.params.get('dir')).toBe('asc');
    request?.flush(pageOf([employee(1), employee(2)], 2));
    harness.detectChanges();

    header!.click();
    harness.detectChanges();
    [request] = employeeRequests();
    expect(request?.request.params.get('dir')).toBe('desc');
    request?.flush(pageOf([employee(2), employee(1)], 2));
  });

  it('filters by team and goes back to page 1', async () => {
    const { harness, root } = await open('/employees?page=3', pageOf([employee(21)], 25, 3));
    const select = Array.from(root.querySelectorAll<HTMLSelectElement>('ui-select select')).find(
      (s) => Array.from(s.options).some((o) => o.textContent?.includes('Amsterdam Floor')),
    );
    expect(select).toBeDefined();
    select!.value = 'team-b';
    select!.dispatchEvent(new Event('change'));
    harness.detectChanges();

    const [request] = employeeRequests();
    expect(request?.request.params.get('teamId')).toBe('team-b');
    expect(request?.request.params.has('page')).toBe(true);
    expect(request?.request.params.get('page')).toBe('1');
    request?.flush(pageOf([], 0));
  });

  it('starts from the filters in the URL so a reload shows the same list', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(
      '/employees?q=sara&role=manager&sort=hours&dir=desc&page=2&pageSize=20',
      EmployeeListPage,
    );
    http.expectOne(`${BASE}/teams`).flush(TEAMS);
    http.expectOne(`${BASE}/locations`).flush(LOCATIONS);
    harness.detectChanges();
    const [request] = employeeRequests();
    const params = request!.request.params;
    expect(params.get('q')).toBe('sara');
    expect(params.get('userRole')).toBe('manager');
    expect(params.get('sort')).toBe('hours');
    expect(params.get('dir')).toBe('desc');
    expect(params.get('page')).toBe('2');
    expect(params.get('pageSize')).toBe('20');
    request!.flush(pageOf([], 0, 2, 20));
  });

  it('shows an empty state with a way back when the filters match nobody', async () => {
    const { harness, root } = await open('/employees?q=zzz', pageOf([], 0));
    expect(root.textContent).toContain('No employees found');
    const clear = Array.from(root.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Clear filters'),
    );
    expect(clear).toBeDefined();
    clear!.click();
    harness.detectChanges();
    const [request] = employeeRequests();
    expect(request?.request.params.has('q')).toBe(false);
    request?.flush(pageOf([employee(1)], 1));
  });

  it('shows an error with a retry that asks again', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/employees', EmployeeListPage);
    http.expectOne(`${BASE}/teams`).flush(TEAMS);
    http.expectOne(`${BASE}/locations`).flush(LOCATIONS);
    harness.detectChanges();
    http
      .expectOne((r) => r.url === `${BASE}/employees`)
      .flush({ message: 'Boom' }, { status: 500, statusText: 'Server Error' });
    harness.detectChanges();

    const root = harness.routeNativeElement as HTMLElement;
    expect(root.querySelector('[role=alert]')?.textContent).toContain('Could not load this');
    const retry = Array.from(root.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Try again'),
    );
    retry!.click();
    harness.detectChanges();
    const requests = employeeRequests();
    expect(requests).toHaveLength(1);
    requests[0]?.flush(pageOf([employee(1)], 1));
    harness.detectChanges();
    expect(root.textContent).toContain('First1 Last1');
  });

  it('opens the profile when a row is clicked', async () => {
    const { harness, root } = await open();
    const row = root.querySelectorAll<HTMLElement>('[role=row]')[1];
    row?.click();
    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/employees/emp-1'));
    harness.detectChanges();
  });
});
