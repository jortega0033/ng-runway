import { Dialog } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { AbsencesApi } from '@core/api/absences.api';
import type { AbsenceRequest, AbsenceTypeKey } from '@core/api/models';
import { addDays, startOfWeek, todayIso } from '@core/domain/time';
import { ToastService } from '@ui/index';
import { useMockApi } from '../../testing/msw-test-server';
import absencesEn from '../../../../public/i18n/absences/en.json';
import { AbsencesPage } from './absences.page';
import { AbsenceRequestsComponent } from './requests-approval';
import { MyAbsencesComponent } from './my-absences';
import { TeamCalendarComponent } from './team-calendar';

const api = useMockApi();

/** The app loads the global strings before the first screen (see `app.config.ts`); tests do it here. */
async function configure(): Promise<void> {
  TestBed.configureTestingModule({
    providers: [...api.providers({ absences: absencesEn }), provideTranslocoScope('absences')],
  });
  await firstValueFrom(TestBed.inject(TranslocoService).load('en'));
}

const year = new Date().getFullYear();
/** A Monday in March of the current year, so balance maths never crosses into another year. */
const MONDAY = addDays(startOfWeek(`${year}-03-04`), 7);

function absence(overrides: Partial<AbsenceRequest> & { employeeId: string }): AbsenceRequest {
  return {
    id: `abs-test-${Math.random().toString(36).slice(2, 8)}`,
    type: 'vacation' as AbsenceTypeKey,
    startDate: MONDAY,
    endDate: addDays(MONDAY, 4),
    status: 'approved',
    reason: '',
    comment: '',
    ...overrides,
  };
}

/** Replaces all absences of the given employees with known ones. */
function seed(employeeIds: string[], requests: AbsenceRequest[]): void {
  const state = api.db.state;
  state.absences = [
    ...state.absences.filter((a) => !employeeIds.includes(a.employeeId)),
    ...requests,
  ];
}

function buttonByName(root: ParentNode, name: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll('button')).find(
    (b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === name,
  );
}

function buttonStartingWith(root: ParentNode, prefix: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll('button')).find((b) =>
    (b.getAttribute('aria-label') ?? b.textContent ?? '').trim().startsWith(prefix),
  );
}

/** Finds the control inside the `ui-field` with this label. */
function fieldControl(root: ParentNode, label: string): HTMLElement {
  const found = Array.from(root.querySelectorAll('label')).find((l) =>
    l.textContent?.includes(label),
  );
  const control = found ? root.querySelector<HTMLElement>(`#${found.htmlFor}`) : null;
  if (!control) throw new Error(`No control for label "${label}"`);
  return control;
}

function typeDate(input: HTMLElement, iso: string): void {
  (input as HTMLInputElement).value = iso;
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('blur'));
}

afterEach(() => TestBed.inject(Dialog).closeAll());

describe('my absences', () => {
  it('shows balances with used, pending and remaining days and the own requests', async () => {
    const session = api.signIn('employee');
    const id = session.user.id;
    seed(
      [id],
      [
        absence({ employeeId: id, status: 'approved' }),
        absence({
          employeeId: id,
          startDate: addDays(MONDAY, 14),
          endDate: addDays(MONDAY, 15),
          status: 'pending',
          reason: 'Moving house',
        }),
        absence({
          employeeId: id,
          type: 'special-leave',
          startDate: addDays(MONDAY, 21),
          endDate: addDays(MONDAY, 21),
          status: 'rejected',
          comment: 'Please pick another day',
        }),
      ],
    );
    await configure();

    const fixture = TestBed.createComponent(MyAbsencesComponent);
    const root = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    await vi.waitFor(() => expect(root.textContent).toContain('days left'));

    // 25 days, 5 approved and 2 pending leaves 18.
    const vacation = Array.from(root.querySelectorAll('li')).find((li) =>
      li.textContent?.includes('Vacation'),
    );
    expect(vacation?.textContent).toContain('18 days left');
    expect(vacation?.textContent).toContain('5 used, 2 pending, of 25 days');

    // Types without an entitlement have no balance card.
    const rows = Array.from(root.querySelectorAll('[role=rowgroup]:last-child [role=row]')).map(
      (r) => r.textContent ?? '',
    );
    expect(rows).toHaveLength(3);
    expect(
      rows.some((r) => r.includes('Rejected') && r.includes('Manager: Please pick another day')),
    ).toBe(true);
    expect(rows.some((r) => r.includes('Pending') && r.includes('Moving house'))).toBe(true);
  });
});

describe('request flow', () => {
  async function openDialog(root: HTMLElement): Promise<HTMLElement> {
    buttonByName(root, 'Request time off')?.click();
    return vi.waitFor(() => {
      const dialog = document.querySelector<HTMLElement>('app-absence-request-dialog');
      expect(dialog?.querySelectorAll('button').length).toBeGreaterThanOrEqual(3);
      return dialog as HTMLElement;
    });
  }

  it('previews working days and the balance afterwards, then sends the request', async () => {
    const session = api.signIn('employee');
    const id = session.user.id;
    seed([id], [absence({ employeeId: id, status: 'approved' })]); // 5 of 25 used
    await configure();

    const fixture = TestBed.createComponent(AbsencesPage);
    const root = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    const dialog = await openDialog(root);

    typeDate(fieldControl(dialog, 'Start date'), addDays(MONDAY, 7));
    typeDate(fieldControl(dialog, 'End date'), addDays(MONDAY, 11));
    await vi.waitFor(() => {
      expect(dialog.textContent).toContain('Working days: 5');
      expect(dialog.textContent).toContain('Balance after this request: 15 of 25 days (now 20)');
    });
    expect(dialog.textContent).not.toContain('More than your balance');

    const reason = dialog.querySelector('textarea') as HTMLTextAreaElement;
    reason.value = 'Family visit';
    reason.dispatchEvent(new Event('input'));

    buttonByName(dialog, 'Send request')?.click();
    await vi.waitFor(() => {
      const created = api.db.state.absences.find((a) => a.reason === 'Family visit');
      expect(created).toMatchObject({
        employeeId: id,
        type: 'vacation',
        status: 'pending',
        startDate: addDays(MONDAY, 7),
        endDate: addDays(MONDAY, 11),
      });
    });
    expect(
      TestBed.inject(ToastService)
        .toasts()
        .map((t) => t.title),
    ).toContain('Request sent');
    await vi.waitFor(() => expect(document.querySelector('app-absence-request-dialog')).toBeNull());

    // The balance on the page was refreshed: 5 used and 5 pending leaves 15.
    await vi.waitFor(() => expect(root.textContent).toContain('15 days left'));
  });

  it('warns when the request is longer than the balance but does not block it', async () => {
    const session = api.signIn('employee');
    seed([session.user.id], []);
    await configure();
    const fixture = TestBed.createComponent(AbsencesPage);
    const root = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    const dialog = await openDialog(root);

    typeDate(fieldControl(dialog, 'Start date'), MONDAY);
    typeDate(fieldControl(dialog, 'End date'), addDays(MONDAY, 38)); // five and a half weeks: 29 working days
    await vi.waitFor(() => expect(dialog.textContent).toContain('More than your balance'));
    expect(dialog.textContent).toContain('Working days: 29');

    buttonByName(dialog, 'Send request')?.click();
    await vi.waitFor(() =>
      expect(
        api.db.state.absences.some(
          (a) => a.employeeId === session.user.id && a.status === 'pending',
        ),
      ).toBe(true),
    );
  });

  it('requires the dates and rejects an end date before the start date', async () => {
    const session = api.signIn('employee');
    seed([session.user.id], []);
    await configure();
    const fixture = TestBed.createComponent(AbsencesPage);
    const root = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    const dialog = await openDialog(root);

    buttonByName(dialog, 'Send request')?.click();
    await vi.waitFor(() => {
      expect(dialog.textContent).toContain('Choose a start date.');
      expect(dialog.textContent).toContain('Choose an end date.');
    });

    typeDate(fieldControl(dialog, 'Start date'), addDays(MONDAY, 7));
    typeDate(fieldControl(dialog, 'End date'), MONDAY);
    buttonByName(dialog, 'Send request')?.click();
    await vi.waitFor(() =>
      expect(dialog.textContent).toContain('The end date cannot be before the start date.'),
    );
    expect(api.db.state.absences.filter((a) => a.employeeId === session.user.id)).toHaveLength(0);
  });

  it('lets a manager request time off for an employee', async () => {
    api.signIn('manager');
    const manager = api.db.state.employees.find((e) => e.userRole === 'manager');
    const mate = api.db.state.employees.find(
      (e) => e.userRole === 'employee' && e.teamId === manager?.teamId,
    );
    expect(mate).toBeDefined();
    await configure();
    const fixture = TestBed.createComponent(AbsencesPage);
    const root = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    const dialog = await openDialog(root);

    const select = fieldControl(dialog, 'Employee') as HTMLSelectElement;
    select.value = mate?.id ?? '';
    select.dispatchEvent(new Event('change'));
    typeDate(fieldControl(dialog, 'Start date'), addDays(MONDAY, 7));
    typeDate(fieldControl(dialog, 'End date'), addDays(MONDAY, 7));
    buttonByName(dialog, 'Send request')?.click();

    await vi.waitFor(() =>
      expect(
        api.db.state.absences.some(
          (a) => a.employeeId === mate?.id && a.startDate === addDays(MONDAY, 7),
        ),
      ).toBe(true),
    );
  });
});

describe('approvals', () => {
  async function setup() {
    const session = api.signIn('manager');
    const mate = api.db.state.employees.find(
      (e) => e.userRole === 'employee' && e.teamId === session.user.teamId,
    );
    const id = mate?.id ?? '';
    seed(
      [id],
      [absence({ id: 'abs-review', employeeId: id, status: 'pending', reason: 'Wedding' })],
    );
    // No other team member has a pending request, so the list holds exactly this one.
    api.db.state.absences = api.db.state.absences.filter(
      (a) =>
        a.id === 'abs-review' ||
        a.status !== 'pending' ||
        api.db.state.employees.find((e) => e.id === a.employeeId)?.teamId !== session.user.teamId,
    );
    await configure();
    const fixture = TestBed.createComponent(AbsenceRequestsComponent);
    const root = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    await vi.waitFor(() => expect(root.textContent).toContain('Wedding'));
    return { fixture, root, id };
  }

  async function openReview(root: HTMLElement, prefix: string): Promise<HTMLElement> {
    buttonStartingWith(root, prefix)?.click();
    return vi.waitFor(() => {
      const dialog = document.querySelector<HTMLElement>('app-review-comment-dialog');
      expect(dialog?.querySelectorAll('button').length).toBeGreaterThanOrEqual(3);
      return dialog as HTMLElement;
    });
  }

  it('approves a request: it leaves the list and the balance moves from pending to used', async () => {
    const { root, id } = await setup();
    const balances = TestBed.inject(AbsencesApi);
    const before = (await firstValueFrom(balances.balances(id))).find((b) => b.type === 'vacation');
    expect(before).toMatchObject({ usedDays: 0, pendingDays: 5, remainingDays: 20 });

    const dialog = await openReview(root, 'Approve request of');
    const comment = dialog.querySelector('textarea') as HTMLTextAreaElement;
    comment.value = 'Enjoy';
    comment.dispatchEvent(new Event('input'));
    buttonByName(dialog, 'Approve')?.click();

    await vi.waitFor(() => expect(root.textContent).not.toContain('Wedding'));
    await vi.waitFor(() =>
      expect(api.db.state.absences.find((a) => a.id === 'abs-review')).toMatchObject({
        status: 'approved',
        comment: 'Enjoy',
      }),
    );
    const after = (await firstValueFrom(balances.balances(id))).find((b) => b.type === 'vacation');
    expect(after).toMatchObject({ usedDays: 5, pendingDays: 0, remainingDays: 20 });
    expect(
      TestBed.inject(ToastService)
        .toasts()
        .map((t) => t.title),
    ).toContain('Request approved');
  });

  it('rejects a request and gives the days back', async () => {
    const { root, id } = await setup();
    const dialog = await openReview(root, 'Reject request of');
    buttonByName(dialog, 'Reject')?.click();

    await vi.waitFor(() =>
      expect(api.db.state.absences.find((a) => a.id === 'abs-review')?.status).toBe('rejected'),
    );
    const after = (await firstValueFrom(TestBed.inject(AbsencesApi).balances(id))).find(
      (b) => b.type === 'vacation',
    );
    expect(after).toMatchObject({ pendingDays: 0, remainingDays: 25 });
  });

  it('brings the row back when the server refuses the review', async () => {
    const { root } = await setup();
    api.db.state.absences = api.db.state.absences.filter((a) => a.id !== 'abs-review');
    const dialog = await openReview(root, 'Approve request of');
    buttonByName(dialog, 'Approve')?.click();

    await vi.waitFor(() =>
      expect(
        TestBed.inject(ToastService)
          .toasts()
          .some((t) => t.title === 'Request failed'),
      ).toBe(true),
    );
    expect(root.textContent).toContain('Wedding');
  });
});

describe('team calendar', () => {
  const today = todayIso();

  function teammates() {
    const session = api.signIn('employee');
    const mate = api.db.state.employees.find(
      (e) =>
        e.id !== session.user.id && e.teamId === session.user.teamId && e.userRole === 'employee',
    );
    if (!mate) throw new Error('The seed has no teammate');
    seed(
      [mate.id],
      [
        absence({ employeeId: mate.id, startDate: today, endDate: today, status: 'approved' }),
        absence({
          employeeId: mate.id,
          type: 'sick',
          startDate: addDays(today, 1),
          endDate: addDays(today, 1),
          status: 'pending',
        }),
      ],
    );
    return { session, mate };
  }

  async function render() {
    await configure();
    const fixture = TestBed.createComponent(TeamCalendarComponent);
    document.body.append(fixture.nativeElement);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => expect(root.querySelector('[role=gridcell]')).not.toBeNull());
    return { fixture, root };
  }

  afterEach(() => document.body.replaceChildren());

  it('shows approved absences with the person, the type name and its abbreviation', async () => {
    const { mate } = teammates();
    const { root } = await render();

    const grid = root.querySelector('[role=grid]');
    expect(grid?.getAttribute('aria-label')).toContain('Team absences in');
    expect(root.querySelectorAll('[role=columnheader]')).toHaveLength(7);

    const cell = root.querySelector(`#cal-${today}`) as HTMLElement;
    const name = `${mate.firstName} ${mate.lastName}`;
    expect(cell.getAttribute('aria-label')).toContain(name);
    expect(cell.getAttribute('aria-label')).toContain('Vacation');
    expect(cell.textContent).toContain('VAC');
    expect(cell.getAttribute('aria-current')).toBe('date');
  });

  it('hides pending requests from employees but shows them to managers', async () => {
    teammates();
    const asEmployee = await render();
    const tomorrow = asEmployee.root.querySelector(`#cal-${addDays(today, 1)}`);
    expect(tomorrow?.getAttribute('aria-label')).toContain('Nobody away');
    asEmployee.fixture.destroy();
    TestBed.resetTestingModule();

    api.signIn('manager');
    const manager = api.db.state.employees.find((e) => e.userRole === 'manager');
    const mate = api.db.state.employees.find(
      (e) => e.userRole === 'employee' && e.teamId === manager?.teamId,
    );
    seed(
      [mate?.id ?? ''],
      [
        absence({
          employeeId: mate?.id ?? '',
          type: 'sick',
          startDate: addDays(today, 1),
          endDate: addDays(today, 1),
          status: 'pending',
        }),
      ],
    );
    const asManager = await render();
    const cell = asManager.root.querySelector(`#cal-${addDays(today, 1)}`);
    expect(cell?.getAttribute('aria-label')).toContain('Sick leave');
    expect(cell?.getAttribute('aria-label')).toContain('Pending');
  });

  it('moves the focus with the arrow keys and pages through months', async () => {
    teammates();
    const { fixture, root } = await render();

    const start = root.querySelector(`#cal-${today}`) as HTMLElement;
    expect(start.getAttribute('tabindex')).toBe('0');
    start.focus();
    start.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await vi.waitFor(() => expect(document.activeElement?.id).toBe(`cal-${addDays(today, 1)}`));

    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );
    await vi.waitFor(() => expect(document.activeElement?.id).toBe(`cal-${addDays(today, 8)}`));

    // Only one cell is in the tab order.
    expect(root.querySelectorAll('[role=gridcell][tabindex="0"]')).toHaveLength(1);

    const label = root.querySelector('h2')?.textContent;
    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }),
    );
    await fixture.whenStable();
    await vi.waitFor(() => expect(root.querySelector('h2')?.textContent).not.toBe(label));
  });

  it('lists the people away on the selected day as text', async () => {
    const { mate } = teammates();
    const { fixture, root } = await render();
    const cell = root.querySelector(`#cal-${today}`) as HTMLElement;
    cell.focus();
    cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await fixture.whenStable();
    const details = root.querySelector('ul');
    expect(details?.textContent).toContain(`${mate.firstName} ${mate.lastName}`);
    expect(details?.textContent).toContain('Vacation');
  });
});

describe('absences page', () => {
  it('shows the requests tab to managers only', async () => {
    api.signIn('employee');
    await configure();
    const employeePage = TestBed.createComponent(AbsencesPage);
    await employeePage.whenStable();
    const tabs = (page: typeof employeePage) =>
      Array.from((page.nativeElement as HTMLElement).querySelectorAll('[role=tab]')).map((t) =>
        t.textContent?.trim(),
      );
    expect(tabs(employeePage)).toEqual(['My absences', 'Team calendar']);
    employeePage.destroy();
    TestBed.resetTestingModule();

    api.signIn('manager');
    await configure();
    const managerPage = TestBed.createComponent(AbsencesPage);
    await managerPage.whenStable();
    await vi.waitFor(() =>
      expect(tabs(managerPage)).toEqual(['My absences', 'Requests', 'Team calendar']),
    );
  });
});
