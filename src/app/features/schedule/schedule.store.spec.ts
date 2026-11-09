import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { setupServer } from 'msw/node';
import { API_BASE_URL } from '@core/api/api-config';
import type { LoginResponse, Shift, UserRole } from '@core/api/models';
import { authInterceptor } from '@core/auth/auth.interceptor';
import { SESSION_STORAGE_KEY } from '@core/auth/auth.service';
import { addDays, startOfWeek } from '@core/domain/time';
import { errorInterceptor } from '@core/http/error.interceptor';
import { MockDb, type DbStorage } from '@core/mock/db';
import { DEFAULT_DEV_CONTROLS, type DevControls } from '@core/mock/dev-controls';
import { TOKEN_PREFIX, createHandlers } from '@core/mock/handlers';
import { createSeed } from '@core/mock/seed';
import { provideTestTransloco } from '../../testing/transloco-testing';
import { ToastService } from '@ui/toast/toast';
import scheduleEn from '../../../../public/i18n/schedule/en.json';
import { moveToTarget } from './schedule.layout';
import { SCHEDULE_TODAY, ScheduleStore } from './schedule.store';

const BASE = 'http://localhost/api';
const TODAY = '2026-11-09'; // a Monday; the seed has published shifts up to the week of 16 Nov

function memoryStorage(): DbStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe('ScheduleStore', () => {
  const server = setupServer();
  let db: MockDb;
  let controls: DevControls;

  beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
  afterAll(() => server.close());

  beforeEach(() => {
    localStorage.clear();
    db = new MockDb(
      () => createSeed(TODAY),
      memoryStorage(),
      () => startOfWeek(TODAY),
    );
    controls = { ...DEFAULT_DEV_CONTROLS };
    server.resetHandlers(...createHandlers({ baseUrl: BASE, db, controls: () => controls }));
  });
  afterEach(() => localStorage.clear());

  /** Signs in (session in localStorage, before AuthService exists) and creates the store. */
  function createStore(role: UserRole = 'manager') {
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
        ScheduleStore,
      ],
    });
    return TestBed.inject(ScheduleStore);
  }

  /** Lets effects run and waits for pending requests until the store has finished loading. */
  async function loaded(store: InstanceType<typeof ScheduleStore>): Promise<void> {
    await vi.waitFor(() => {
      TestBed.tick();
      expect(store.lookupsLoaded()).toBe(true);
      expect(store.loadingWeek()).toBe(false);
      expect(store.query().from).toBe(store.weekStart());
      expect(store.shifts().length).toBeGreaterThan(0);
    });
  }

  async function idle(): Promise<void> {
    TestBed.tick();
    await TestBed.inject(ApplicationRef).whenStable();
  }

  function assignedShift(store: InstanceType<typeof ScheduleStore>): Shift {
    return store.shifts().find((s) => s.employeeId !== null)!;
  }

  it('loads lookups, the week and the absences', async () => {
    const store = createStore();
    await loaded(store);

    expect(store.weekStart()).toBe(TODAY);
    expect(store.teams()).toHaveLength(6);
    expect(store.locations()).toHaveLength(3);
    expect(store.templates()).toHaveLength(4);
    expect(store.employees()).toHaveLength(40);
    const dates = new Set(store.visibleDates());
    expect(dates.size).toBe(7);
    expect(store.shifts().every((s) => dates.has(s.date))).toBe(true);
    expect(store.shiftsByEmployee().size).toBeGreaterThan(5);
    expect(store.grid().groups.length).toBeGreaterThan(0);
    const inCells = [store.grid().openRow, ...store.grid().groups.flatMap((g) => g.rows)]
      .flatMap((r) => r.cells)
      .reduce((sum, c) => sum + c.shifts.length, 0);
    expect(inCells).toBe(store.shifts().length);
    expect(store.canEdit()).toBe(true);
    // The current week is published in the seed.
    expect(store.draftCount()).toBe(0);
    expect(store.publishedCount()).toBe(store.shifts().length);
  });

  it('reloads when the week or the team filter changes', async () => {
    const store = createStore();
    await loaded(store);

    store.next();
    expect(store.weekStart()).toBe(addDays(TODAY, 7));
    await vi.waitFor(() => {
      TestBed.tick();
      expect(store.shifts().length).toBeGreaterThan(0);
      expect(store.shifts().every((s) => s.date >= addDays(TODAY, 7))).toBe(true);
    });

    store.setTeam('team-ams-floor');
    await vi.waitFor(() => {
      TestBed.tick();
      expect(store.shifts().length).toBeGreaterThan(0);
      expect(store.shifts().every((s) => s.teamId === 'team-ams-floor')).toBe(true);
    });
    expect(store.visibleEmployees().every((e) => e.teamId === 'team-ams-floor')).toBe(true);
  });

  it('moves the day view with previous and next', async () => {
    const store = createStore();
    await loaded(store);
    store.setView('day');
    store.next();
    expect(store.selectedDay()).toBe('2026-11-10');
    expect(store.visibleDates()).toEqual(['2026-11-10']);
    store.previous();
    store.previous();
    expect(store.selectedDay()).toBe('2026-11-08');
    expect(store.weekStart()).toBe('2026-11-02');
    store.goToToday();
    expect(store.weekStart()).toBe(TODAY);
  });

  it('moves a shift optimistically and keeps it when the server accepts', async () => {
    const store = createStore();
    await loaded(store);
    const shift = assignedShift(store);
    const target = store.employees().find((e) => e.id !== shift.employeeId && e.active)!;
    const input = moveToTarget(
      shift,
      { employeeId: target.id, date: addDays(shift.date, 1) },
      store.employeesById(),
    );

    const saving = store.moveShift(shift.id, input);
    // Before the response arrives, the grid already shows the new place.
    expect(store.entityMap()[shift.id]).toMatchObject({
      employeeId: target.id,
      date: addDays(shift.date, 1),
    });
    expect(store.savingIds()).toContain(shift.id);

    expect(await saving).toBe(true);
    expect(store.savingIds()).not.toContain(shift.id);
    expect(db.state.shifts.find((s) => s.id === shift.id)).toMatchObject({
      employeeId: target.id,
      date: addDays(shift.date, 1),
    });
    expect(store.announcement()).not.toBe('');
  });

  it('puts the shift back and says so when the server fails (500)', async () => {
    const store = createStore();
    await loaded(store);
    const toasts = TestBed.inject(ToastService);
    const shift = assignedShift(store);
    const target = store.employees().find((e) => e.id !== shift.employeeId && e.active)!;
    const input = moveToTarget(
      shift,
      { employeeId: target.id, date: addDays(shift.date, 2) },
      store.employeesById(),
    );

    controls = { ...controls, errorRate: 1 };
    const saving = store.moveShift(shift.id, input);
    expect(store.entityMap()[shift.id]?.employeeId).toBe(target.id);

    expect(await saving).toBe(false);
    expect(store.entityMap()[shift.id]).toEqual(shift);
    expect(db.state.shifts.find((s) => s.id === shift.id)).toMatchObject({
      employeeId: shift.employeeId,
      date: shift.date,
    });
    expect(store.savingIds()).toEqual([]);
    expect(toasts.toasts().some((t) => t.variant === 'warning')).toBe(true);
  });

  it('resizes the end of a shift and rolls back on failure', async () => {
    const store = createStore();
    await loaded(store);
    const shift = store.shifts().find((s) => s.employeeId && s.end === '15:00')!;

    const ok = store.resizeShift(shift.id, '15:45');
    expect(store.entityMap()[shift.id]?.end).toBe('15:45');
    expect(await ok).toBe(true);

    controls = { ...controls, errorRate: 1 };
    expect(await store.resizeShift(shift.id, '18:00')).toBe(false);
    expect(store.entityMap()[shift.id]?.end).toBe('15:45');
  });

  it('creates a shift with a temporary id, then swaps in the saved one', async () => {
    const store = createStore();
    await loaded(store);
    const before = store.shifts().length;

    const saving = store.applyTemplate('tpl-day', { employeeId: null, date: TODAY });
    expect(store.shifts()).toHaveLength(before + 1);
    expect(store.shifts().some((s) => s.id.startsWith('tmp-'))).toBe(true);

    const saved = await saving;
    expect(saved).toMatchObject({
      employeeId: null,
      start: '09:00',
      end: '17:00',
      status: 'draft',
    });
    expect(store.shifts()).toHaveLength(before + 1);
    expect(store.shifts().some((s) => s.id.startsWith('tmp-'))).toBe(false);
    expect(store.openShifts().some((s) => s.id === saved?.id)).toBe(true);
    expect(db.state.shifts.some((s) => s.id === saved?.id)).toBe(true);
  });

  it('drops a created shift again when the server fails', async () => {
    const store = createStore();
    await loaded(store);
    const before = store.shifts().length;
    controls = { ...controls, errorRate: 1 };
    expect(await store.applyTemplate('tpl-day', { employeeId: null, date: TODAY })).toBeNull();
    expect(store.shifts()).toHaveLength(before);
  });

  it('deletes optimistically and restores the shift on failure', async () => {
    const store = createStore();
    await loaded(store);
    const shift = assignedShift(store);

    controls = { ...controls, errorRate: 1 };
    const failing = store.deleteShift(shift.id);
    expect(store.entityMap()[shift.id]).toBeUndefined();
    expect(await failing).toBe(false);
    expect(store.entityMap()[shift.id]).toEqual(shift);

    controls = { ...DEFAULT_DEV_CONTROLS };
    expect(await store.deleteShift(shift.id)).toBe(true);
    expect(store.entityMap()[shift.id]).toBeUndefined();
    expect(db.state.shifts.some((s) => s.id === shift.id)).toBe(false);
  });

  it('computes conflicts per shift with detectConflicts', async () => {
    const store = createStore();
    await loaded(store);
    const shift = assignedShift(store);

    // A second shift on the same person and time overlaps the first.
    const copy = await store.createShift({
      employeeId: shift.employeeId,
      teamId: shift.teamId,
      locationId: shift.locationId,
      date: shift.date,
      start: shift.start,
      end: shift.end,
      breakMinutes: shift.breakMinutes,
      status: 'draft',
      note: '',
    });
    const first = store.conflictsByShift().get(shift.id);
    expect(first?.some((c) => c.type === 'overlap')).toBe(true);
    expect(
      store
        .conflictsByShift()
        .get(copy!.id)
        ?.some((c) => c.type === 'overlap'),
    ).toBe(true);
    // Open shifts never have conflicts.
    const open = await store.applyTemplate('tpl-day', { employeeId: null, date: TODAY });
    expect(store.conflictsByShift().has(open!.id)).toBe(false);
  });

  it('publishes the drafts of the week', async () => {
    const store = createStore();
    await loaded(store);
    store.goToDate('2026-11-23'); // first draft week in the seed
    await vi.waitFor(() => {
      TestBed.tick();
      expect(store.draftCount()).toBeGreaterThan(0);
    });
    const drafts = store.draftCount();
    const total = store.shifts().length;

    expect(await store.publishWeek()).toBe(drafts);
    expect(store.draftCount()).toBe(0);
    expect(store.publishedCount()).toBe(total);
    expect(store.publishing()).toBe(false);
    expect(
      db.state.shifts.filter(
        (s) => s.status === 'draft' && s.date >= '2026-11-23' && s.date <= '2026-11-29',
      ),
    ).toHaveLength(0);
  });

  it('copies the previous week as drafts', async () => {
    const store = createStore();
    await loaded(store);
    store.goToDate('2026-12-07'); // last week of the seed, all drafts
    await vi.waitFor(() => {
      TestBed.tick();
      expect(store.draftCount()).toBeGreaterThan(0);
    });
    const before = store.shifts().length;
    const previousWeek = db.state.shifts.filter(
      (s) => s.date >= '2026-11-30' && s.date <= '2026-12-06',
    );

    expect(await store.copyPreviousWeek()).toBe(previousWeek.length);
    expect(store.shifts()).toHaveLength(before + previousWeek.length);
    expect(store.copying()).toBe(false);
    const copied = store.shifts().filter((s) => !db.state.shifts.some((d) => d.id === s.id));
    expect(copied).toHaveLength(0); // every copy exists on the server too
    expect(store.shifts().filter((s) => s.date >= '2026-12-07').length).toBe(
      before + previousWeek.length,
    );
  });

  it('is read-only for employees, who only see published shifts', async () => {
    const store = createStore('employee');
    await loaded(store);
    expect(store.canEdit()).toBe(false);
    expect(store.shifts().every((s) => s.status === 'published')).toBe(true);

    store.goToDate('2026-11-30'); // a draft week for managers
    await idle();
    await vi.waitFor(() => {
      TestBed.tick();
      expect(store.loadingWeek()).toBe(false);
      expect(store.query().from).toBe('2026-11-30');
    });
    expect(store.shifts()).toHaveLength(0);
    expect(store.isEmpty()).toBe(true);

    expect(await store.createShift({ ...assignedShiftInput(), employeeId: null })).toBeNull();
    expect(await store.publishWeek()).toBeNull();
  });

  it('shows the error state and recovers on retry', async () => {
    controls = { ...controls, errorRate: 1 };
    const store = createStore();
    await vi.waitFor(() => {
      TestBed.tick();
      expect(store.error()).toBe(true);
      expect(store.loading()).toBe(false);
    });

    controls = { ...DEFAULT_DEV_CONTROLS };
    store.retry();
    await loaded(store);
    expect(store.error()).toBe(false);
  });
});

function assignedShiftInput() {
  return {
    employeeId: 'emp-003',
    teamId: 'team-ams-floor',
    locationId: 'loc-ams',
    date: TODAY,
    start: '09:00',
    end: '17:00',
    breakMinutes: 30,
    status: 'draft' as const,
    note: '',
  };
}
