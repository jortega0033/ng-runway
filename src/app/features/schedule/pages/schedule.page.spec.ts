import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { setupServer } from 'msw/node';
import { API_BASE_URL } from '@core/api/api-config';
import type { LoginResponse, Shift, UserRole } from '@core/api/models';
import { authInterceptor } from '@core/auth/auth.interceptor';
import { SESSION_STORAGE_KEY } from '@core/auth/auth.service';
import { startOfWeek } from '@core/domain/time';
import { errorInterceptor } from '@core/http/error.interceptor';
import { MockDb, type DbStorage } from '@core/mock/db';
import { DEFAULT_DEV_CONTROLS } from '@core/mock/dev-controls';
import { TOKEN_PREFIX, createHandlers } from '@core/mock/handlers';
import { createSeed } from '@core/mock/seed';
import { provideTestTransloco } from '../../../testing/transloco-testing';
import scheduleEn from '../../../../../public/i18n/schedule/en.json';
import { SCHEDULE_TODAY, ScheduleStore } from '../schedule.store';
import { SchedulePage } from './schedule.page';

const BASE = 'http://localhost/api';
const TODAY = '2026-11-09';

function memoryStorage(): DbStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

// The page renders a full week grid, which is slow on a busy CI machine.
vi.setConfig({ testTimeout: 20_000 });

describe('SchedulePage', () => {
  const server = setupServer();
  let db: MockDb;

  beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
  afterAll(() => server.close());

  beforeEach(() => {
    localStorage.clear();
    db = new MockDb(
      () => createSeed(TODAY),
      memoryStorage(),
      () => startOfWeek(TODAY),
    );
    server.resetHandlers(
      ...createHandlers({ baseUrl: BASE, db, controls: () => ({ ...DEFAULT_DEV_CONTROLS }) }),
    );
  });
  afterEach(() => localStorage.clear());

  async function render(role: UserRole = 'manager') {
    const employee = db.state.employees.find((e) => e.userRole === role)!;
    const session: LoginResponse = {
      token: `${TOKEN_PREFIX}${employee.id}`,
      user: {
        id: employee.id,
        name: `${employee.firstName} ${employee.lastName}`,
        email: employee.email,
        role,
        teamId: employee.teamId,
        locationId: employee.locationId,
      },
    };
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withFetch(), withInterceptors([authInterceptor, errorInterceptor])),
        { provide: API_BASE_URL, useValue: BASE },
        { provide: SCHEDULE_TODAY, useValue: () => TODAY },
        provideTestTransloco({ schedule: scheduleEn }),
        provideTranslocoScope('schedule'),
        ScheduleStore,
      ],
    });
    const fixture = TestBed.createComponent(SchedulePage);
    const store = TestBed.inject(ScheduleStore);
    await vi.waitFor(
      async () => {
        await fixture.whenStable();
        expect(chips(fixture).length).toBeGreaterThan(0);
      },
      { timeout: 10_000 },
    );
    return { fixture, store, root: fixture.nativeElement as HTMLElement };
  }

  /** Shift chips are buttons whose accessible name starts with the time range. */
  function chips(
    fixture: Pick<ComponentFixture<SchedulePage>, 'nativeElement'>,
  ): HTMLButtonElement[] {
    const root = fixture.nativeElement as HTMLElement;
    return Array.from(root.querySelectorAll<HTMLButtonElement>('td button')).filter((b) =>
      /\d\d:\d\d-\d\d:\d\d,/.test(b.textContent ?? ''),
    );
  }

  function dialog(): HTMLElement | null {
    return document.querySelector<HTMLElement>('[role="dialog"]');
  }

  function typeTime(input: HTMLInputElement, value: string): void {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
  }

  it('renders the roster with labelled shifts, team groups and the open shifts row', async () => {
    const { root, store } = await render();

    expect(root.querySelector('h1')?.textContent).toContain('Schedule');
    expect(root.querySelector('caption')?.textContent).toContain(
      'Weekly roster, Nov 9 - Nov 15, 2026',
    );
    const headers = Array.from(root.querySelectorAll('th[scope="col"]')).map(
      (th) => th.textContent,
    );
    expect(headers.filter((t) => /Mon|Tue|Wed|Thu|Fri|Sat|Sun/.test(t ?? ''))).toHaveLength(7);
    expect(root.querySelector('th[scope="rowgroup"]')).not.toBeNull();
    expect(root.textContent).toContain('Open shifts');

    // Full accessible name: time range, hours, person, day and status.
    const all = chips({ nativeElement: root });
    expect(all[0]?.textContent).toMatch(/\d\d:\d\d-\d\d:\d\d, \d+h( \d\dm)?, .+, .+, published/);
    expect(all).toHaveLength(store.shifts().length);
  });

  it('shows a conflict on the chip, with text and not only color', async () => {
    const { fixture, store, root } = await render();
    const original = store.shifts().find((s) => s.employeeId !== null)!;
    await store.createShift({
      employeeId: original.employeeId,
      teamId: original.teamId,
      locationId: original.locationId,
      date: original.date,
      start: original.start,
      end: original.end,
      breakMinutes: original.breakMinutes,
      status: 'draft',
      note: '',
    });
    await fixture.whenStable();

    const conflicted = chips(fixture).filter((b) => /\d conflicts?/.test(b.textContent ?? ''));
    expect(conflicted.length).toBeGreaterThanOrEqual(2);
    const draft = conflicted.find((b) => /draft/.test(b.textContent ?? ''))!;
    expect(draft.getAttribute('aria-description')).toContain('Overlaps with another shift');
    expect(root.querySelector('ui-icon[name="alert-triangle"]')).not.toBeNull();
    // Drafts also say so in words.
    expect(draft.textContent).toContain('Draft');
  });

  it('edits a shift in the editor, warns about conflicts live and saves', async () => {
    const { fixture, store } = await render();
    const original = store.shifts().find((s) => s.employeeId !== null && s.status === 'published')!;
    const copy = (await store.createShift({
      employeeId: original.employeeId,
      teamId: original.teamId,
      locationId: original.locationId,
      date: original.date,
      start: original.start,
      end: original.end,
      breakMinutes: original.breakMinutes,
      status: 'draft',
      note: '',
    })) as Shift;
    await fixture.whenStable();

    const draftChip = chips(fixture).find(
      (b) => /draft/.test(b.textContent ?? '') && /conflict/.test(b.textContent ?? ''),
    )!;
    draftChip.click();
    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(dialog()).not.toBeNull();
    });

    const editor = dialog()!;
    expect(editor.textContent).toContain('Edit shift');
    expect(editor.textContent).toContain('Overlaps with another shift of this employee.');

    // Move the times away from the overlap: the warning list updates without saving.
    // Pickers in DOM order: date, start, end.
    const [date, start, end] = Array.from(
      editor.querySelectorAll<HTMLInputElement>('input[role="combobox"]'),
    );
    expect(date!.value).toBe(copy.date);
    expect(start!.value).toBe(copy.start);
    typeTime(start!, '03:00');
    typeTime(end!, '05:00');
    await fixture.whenStable();
    expect(editor.textContent).not.toContain('Overlaps with another shift');

    // An invalid range blocks saving, conflicts alone do not.
    typeTime(end!, '03:00');
    await fixture.whenStable();
    expect(editor.textContent).toContain('Start and end time cannot be the same.');
    const save = () =>
      Array.from(editor.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
        /Save shift/.test(b.textContent ?? ''),
      )!;
    expect(save().disabled).toBe(true);

    typeTime(end!, '05:00');
    await fixture.whenStable();
    expect(save().disabled).toBe(false);
    save().click();

    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(dialog()).toBeNull();
      expect(store.entityMap()[copy.id]).toMatchObject({ start: '03:00', end: '05:00' });
      expect(db.state.shifts.find((s) => s.id === copy.id)).toMatchObject({
        start: '03:00',
        end: '05:00',
      });
    });
  });

  it('adds a shift for a row from the keyboard-reachable Add shift button', async () => {
    const { fixture, store, root } = await render();
    const before = store.shifts().length;
    const add = Array.from(root.querySelectorAll<HTMLButtonElement>('th[scope="row"] button')).find(
      (b) => b.getAttribute('aria-label')?.startsWith('Add shift for Open shifts'),
    )!;
    expect(add).toBeDefined();
    add.click();
    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(dialog()?.textContent).toContain('Add shift');
    });
    const button = Array.from(dialog()!.querySelectorAll<HTMLButtonElement>('footer button')).find(
      (b) => b.textContent?.trim() === 'Add shift',
    )!;
    button.click();
    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(store.shifts()).toHaveLength(before + 1);
      expect(store.openShifts().length).toBeGreaterThan(0);
    });
  });

  it('gives employees a read-only roster without edit controls', async () => {
    const { root, fixture } = await render('employee');

    expect(root.textContent).not.toContain('Publish week');
    expect(root.textContent).not.toContain('Copy previous week');
    expect(root.textContent).not.toContain('Shift templates');
    expect(root.querySelector('th[scope="row"] button')).toBeNull();
    expect(chips(fixture).every((b) => /published/.test(b.textContent ?? ''))).toBe(true);

    // The chip still opens the details, but only to read them.
    chips(fixture)[0]!.click();
    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(dialog()?.textContent).toContain('Shift details');
    });
    expect(dialog()!.textContent).not.toContain('Delete shift');
    expect(dialog()!.querySelector('input[role="combobox"]')?.hasAttribute('disabled')).toBe(true);
  });
});
