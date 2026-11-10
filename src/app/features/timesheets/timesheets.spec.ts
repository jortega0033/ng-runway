import { Dialog } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { TranslocoService, provideTranslocoScope } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import type { ClockEntry, Shift } from '@core/api/models';
import { startOfWeek, todayIso } from '@core/domain/time';
import { useMockApi } from '../../testing/msw-test-server';
import { ToastService } from '@ui/index';
import timesheetsEn from '../../../../public/i18n/timesheets/en.json';
import { TimesheetApprovalsComponent } from './approvals';
import { ClockWidgetComponent } from './clock-widget';
import { TimesheetsPage } from './timesheets.page';
import { WeekViewComponent } from './week-view';

const api = useMockApi();

/** The app loads the global strings before the first screen (see `app.config.ts`); tests do it here. */
async function configure(): Promise<void> {
  TestBed.configureTestingModule({
    providers: [
      ...api.providers({ timesheets: timesheetsEn }),
      provideTranslocoScope('timesheets'),
    ],
  });
  await firstValueFrom(TestBed.inject(TranslocoService).load('en'));
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

describe('clock widget', () => {
  beforeEach(async () => {
    api.signIn('employee');
    await configure();
  });
  afterEach(() => vi.useRealTimers());

  it('runs the clock in, break and clock out flow with a live counter', async () => {
    // Fake only the interval and the clock: the mock API and Angular keep real timers.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'], now: Date.now() });

    const fixture = TestBed.createComponent(ClockWidgetComponent);
    const root = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();

    // The scoped translations are loaded.
    expect(root.textContent).toContain('You are not clocked in.');
    const clockIn = buttonByName(root, 'Clock in');
    expect(clockIn?.disabled).toBe(false);
    expect(buttonByName(root, 'Clock out')?.disabled).toBe(true);
    expect(buttonByName(root, 'Start break')?.disabled).toBe(true);

    clockIn?.click();
    await fixture.whenStable();
    expect(root.textContent).toContain('Working since');
    expect(root.querySelector('[role=timer]')?.textContent?.trim()).toBe('00:00:00');
    expect(buttonByName(root, 'Clock in')?.disabled).toBe(true);

    vi.advanceTimersByTime(61_000);
    fixture.detectChanges();
    expect(root.querySelector('[role=timer]')?.textContent?.trim()).toBe('00:01:01');

    buttonByName(root, 'Start break')?.click();
    await fixture.whenStable();
    expect(root.textContent).toContain('On break since');
    expect(buttonByName(root, 'End break')?.disabled).toBe(false);

    // While the break runs the worked counter stands still and the break counter moves.
    vi.advanceTimersByTime(30_000);
    fixture.detectChanges();
    expect(root.querySelector('[role=timer]')?.textContent?.trim()).toBe('00:01:01');
    expect(root.textContent).toContain('Break running: 00:00:30');

    buttonByName(root, 'End break')?.click();
    await fixture.whenStable();
    expect(root.textContent).toContain('Working since');

    buttonByName(root, 'Clock out')?.click();
    await fixture.whenStable();
    expect(root.textContent).toContain('You are not clocked in.');
    expect(root.querySelector('[role=timer]')?.textContent?.trim()).toBe('00:00:00');
    expect(buttonByName(root, 'Clock in')?.disabled).toBe(false);

    const saved = api.db.state.clockEntries.filter(
      (e) => e.clockOut !== null && e.status === 'submitted',
    );
    expect(saved.some((e) => e.breaks.length === 1 && e.breaks[0]?.end !== null)).toBe(true);
    expect(
      TestBed.inject(ToastService)
        .toasts()
        .map((t) => t.title),
    ).toContain('Clocked out');
  });

  it('stops its timer when destroyed', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'], now: Date.now() });
    const fixture = TestBed.createComponent(ClockWidgetComponent);
    await fixture.whenStable();
    buttonByName(fixture.nativeElement as HTMLElement, 'Clock in')?.click();
    await fixture.whenStable();
    expect(vi.getTimerCount()).toBe(1);
    fixture.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('week view', () => {
  it('shows scheduled against worked hours with signed differences', async () => {
    const session = api.signIn('employee');
    const id = session.user.id;
    const monday = startOfWeek(todayIso());
    const state = api.db.state;
    state.shifts = state.shifts.filter((s) => s.employeeId !== id);
    state.clockEntries = state.clockEntries.filter((e) => e.employeeId !== id);
    const shift: Shift = {
      id: 'shift-test',
      employeeId: id,
      teamId: session.user.teamId,
      locationId: session.user.locationId,
      date: monday,
      start: '08:00',
      end: '16:00',
      breakMinutes: 30,
      status: 'published',
      note: '',
    };
    const entry: ClockEntry = {
      id: 'clock-test',
      employeeId: id,
      date: monday,
      clockIn: `${monday}T08:00:00.000Z`,
      clockOut: `${monday}T16:30:00.000Z`,
      breaks: [{ start: `${monday}T12:00:00.000Z`, end: `${monday}T12:30:00.000Z` }],
      status: 'rejected',
      comment: 'Break was not registered',
    };
    state.shifts.push(shift);
    state.clockEntries.push(entry);
    await configure();

    const fixture = TestBed.createComponent(WeekViewComponent);
    const root = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();

    expect(root.querySelectorAll('tbody tr')).toHaveLength(7);
    const first = root.querySelector('tbody tr')?.textContent ?? '';
    expect(first).toContain('08:00 - 16:00');
    expect(first).toContain('7h 30m');
    expect(first).toContain('Rejected');
    expect(first).toContain('Manager comment: Break was not registered');
    // Rejected hours do not count as worked.
    expect(root.querySelector('tfoot')?.textContent).toContain('7h 30m');
    expect(root.querySelector('tfoot')?.textContent).toContain('-7h 30m');

    // Paging to an empty week shows the empty state.
    buttonByName(root, 'Next week')?.click();
    await fixture.whenStable();
    expect(root.textContent).toContain('No hours this week');
  });
});

describe('approvals', () => {
  beforeEach(async () => {
    api.signIn('manager');
    await configure();
  });
  afterEach(() => TestBed.inject(Dialog).closeAll());

  function submittedForTeam(): ClockEntry[] {
    const manager = api.db.state.employees.find((e) => e.userRole === 'manager');
    const team = new Set(
      api.db.state.employees.filter((e) => e.teamId === manager?.teamId).map((e) => e.id),
    );
    return api.db.state.clockEntries.filter(
      (e) => e.status === 'submitted' && team.has(e.employeeId),
    );
  }

  async function render() {
    const fixture = TestBed.createComponent(TimesheetApprovalsComponent);
    const root = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    await vi.waitFor(() => expect(root.querySelectorAll('[role=row]').length).toBeGreaterThan(1));
    return { fixture, root };
  }

  /** Clicks a row button and waits until the dialog has rendered its footer buttons. */
  async function openReview(root: HTMLElement, rowButton: string): Promise<HTMLElement> {
    buttonStartingWith(root, rowButton)?.click();
    return vi.waitFor(() => {
      const dialog = document.querySelector<HTMLElement>('app-review-comment-dialog');
      expect(dialog?.querySelectorAll('button').length).toBeGreaterThanOrEqual(3);
      return dialog as HTMLElement;
    });
  }

  const dataRows = (root: HTMLElement) =>
    root.querySelectorAll('[role=rowgroup]:last-child [role=row]');

  it('lists the submitted entries of the manager team and approves one with a comment dialog', async () => {
    const expected = submittedForTeam();
    expect(expected.length).toBeGreaterThan(1);
    const { root } = await render();
    expect(dataRows(root)).toHaveLength(expected.length);

    const dialog = await openReview(root, 'Approve hours of');
    buttonByName(dialog, 'Approve')?.click();
    await vi.waitFor(() => expect(dataRows(root)).toHaveLength(expected.length - 1));
    await vi.waitFor(() => expect(submittedForTeam()).toHaveLength(expected.length - 1));
    expect(
      TestBed.inject(ToastService)
        .toasts()
        .map((t) => t.title),
    ).toContain('Hours approved');
  });

  it('does not reject without a comment and sends the comment when given', async () => {
    const before = submittedForTeam();
    const { root } = await render();

    const dialog = await openReview(root, 'Reject hours of');

    buttonByName(dialog, 'Reject')?.click();
    await vi.waitFor(() =>
      expect(dialog.textContent).toContain('Add a comment so the employee knows what to fix.'),
    );
    expect(submittedForTeam()).toHaveLength(before.length);

    const textarea = dialog.querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = 'Break is missing';
    textarea.dispatchEvent(new Event('input'));
    buttonByName(dialog, 'Reject')?.click();

    await vi.waitFor(() => expect(submittedForTeam()).toHaveLength(before.length - 1));
    const rejected = api.db.state.clockEntries.find(
      (e) => e.status === 'rejected' && e.comment === 'Break is missing',
    );
    expect(rejected).toBeDefined();
  });

  it('approves the selected rows in one go', async () => {
    const before = submittedForTeam();
    const { root, fixture } = await render();
    const boxes = root.querySelectorAll<HTMLInputElement>(
      '[role=rowgroup]:last-child input[type=checkbox]',
    );
    boxes[0]?.click();
    boxes[1]?.click();
    await fixture.whenStable();

    const bulk = buttonStartingWith(root, 'Approve selected');
    expect(bulk?.textContent).toContain('(2)');
    bulk?.click();

    await vi.waitFor(() => expect(submittedForTeam()).toHaveLength(before.length - 2));
    expect(dataRows(root)).toHaveLength(before.length - 2);
  });

  it('clears the selection when a filter changes and never approves rows that are gone', async () => {
    const { root, fixture } = await render();
    const boxes = root.querySelectorAll<HTMLInputElement>(
      '[role=rowgroup]:last-child input[type=checkbox]',
    );
    boxes[0]?.click();
    await fixture.whenStable();
    expect(buttonStartingWith(root, 'Approve selected')?.textContent).toContain('(1)');

    const statusSelect = root.querySelectorAll<HTMLSelectElement>('select')[1]!;
    statusSelect.value = 'approved';
    statusSelect.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    const bulk = buttonStartingWith(root, 'Approve selected')!;
    expect(bulk.textContent).toContain('(0)');
    expect(bulk.disabled).toBe(true);
  });

  it('moves focus to the next row and announces how many are left after a review', async () => {
    const expected = submittedForTeam();
    const { root } = await render();
    const first = root.querySelector<HTMLButtonElement>('button[data-entry-id]')!;
    const firstId = first.dataset['entryId'];
    first.focus();

    const dialog = await openReview(root, 'Approve hours of');
    buttonByName(dialog, 'Approve')?.click();
    await vi.waitFor(() => expect(dataRows(root)).toHaveLength(expected.length - 1));

    await vi.waitFor(() => {
      const active = document.activeElement as HTMLElement;
      expect(active.dataset['entryId']).toBeTruthy();
      expect(active.dataset['entryId']).not.toBe(firstId);
    });
    expect(root.querySelector('[role=status]')?.textContent).toContain(
      `Entries waiting for review: ${expected.length - 1}`,
    );
  });

  it('rolls the list back when the server refuses the review', async () => {
    const before = submittedForTeam();
    const { root } = await render();
    // Another reviewer already handled this entry, so the server answers with 422 on reject only.
    // Simulate a refusal by removing the entry on the server before approving it.
    const target = before[0];
    api.db.state.clockEntries = api.db.state.clockEntries.filter((e) => e.id !== target?.id);

    const dialog = await openReview(root, 'Approve hours of');
    buttonByName(dialog, 'Approve')?.click();

    // 404 from the server: the row comes back.
    await vi.waitFor(() =>
      expect(
        TestBed.inject(ToastService)
          .toasts()
          .some((t) => t.title === 'Request failed'),
      ).toBe(true),
    );
    expect(dataRows(root)).toHaveLength(before.length);
  });
});

describe('timesheets page', () => {
  it('shows the clock to employees but not the approvals tab', async () => {
    api.signIn('employee');
    await configure();
    const fixture = TestBed.createComponent(TimesheetsPage);
    const root = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    expect(buttonByName(root, 'Clock in')).toBeDefined();
    const tabs = Array.from(root.querySelectorAll('[role=tab]')).map((t) => t.textContent?.trim());
    expect(tabs).toEqual(['My week']);
  });

  it('adds the approvals tab for managers', async () => {
    api.signIn('manager');
    await configure();
    const fixture = TestBed.createComponent(TimesheetsPage);
    const root = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    await vi.waitFor(() => {
      const tabs = Array.from(root.querySelectorAll('[role=tab]')).map((t) =>
        t.textContent?.trim(),
      );
      expect(tabs).toEqual(['My week', 'Approvals']);
    });
  });
});
