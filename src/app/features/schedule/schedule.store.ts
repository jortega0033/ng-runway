import { InjectionToken, computed, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import {
  addEntities,
  addEntity,
  removeEntity,
  setAllEntities,
  setEntity,
  updateEntities,
  updateEntity,
  withEntities,
} from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, catchError, firstValueFrom, forkJoin, pipe, switchMap, tap } from 'rxjs';
import { AbsencesApi } from '@core/api/absences.api';
import { EmployeesApi } from '@core/api/employees.api';
import { LookupsApi } from '@core/api/lookups.api';
import type {
  AbsenceRequest,
  AbsenceType,
  Employee,
  Location,
  Shift,
  ShiftInput,
  ShiftTemplate,
  Team,
} from '@core/api/models';
import { ShiftsApi } from '@core/api/shifts.api';
import { AuthService } from '@core/auth/auth.service';
import { detectConflicts, type Conflict } from '@core/domain/conflicts';
import { addDays, startOfWeek, todayIso, weekDates } from '@core/domain/time';
import { ToastService } from '@ui/toast/toast';
import {
  buildGrid,
  formatDay,
  groupShiftsByEmployee,
  shareStructure,
  shiftFromTemplate,
  toInput,
  weekRange,
  type DropTarget,
  type GridModel,
  type ScheduleView,
} from './schedule.layout';

/** Today's date as `yyyy-MM-dd`. A token so tests can pin the calendar. */
export const SCHEDULE_TODAY = new InjectionToken<() => string>('SCHEDULE_TODAY', {
  providedIn: 'root',
  factory: () => () => todayIso(),
});

export type WriteKind = 'create' | 'move' | 'resize' | 'edit' | 'delete';

export interface ScheduleState {
  weekStart: string;
  view: ScheduleView;
  selectedDay: string;
  /** Empty string means all. */
  locationId: string;
  teamId: string;
  activeTemplateId: string;
  employees: Employee[];
  teams: Team[];
  locations: Location[];
  templates: ShiftTemplate[];
  absenceTypes: AbsenceType[];
  absences: AbsenceRequest[];
  lookupsLoaded: boolean;
  loadingLookups: boolean;
  loadingWeek: boolean;
  /** The lookups (people, teams, templates) failed to load. */
  lookupsError: boolean;
  /** The shifts of the week failed to load. */
  weekError: boolean;
  /** Bumped by `retry()` so the week is fetched again with the same filters. */
  reloadToken: number;
  savingIds: string[];
  publishing: boolean;
  copying: boolean;
  /** Text for the live region (moves, saves, publish). */
  announcement: string;
}

function initialState(today: string): ScheduleState {
  return {
    weekStart: startOfWeek(today),
    view: 'week',
    selectedDay: today,
    locationId: '',
    teamId: '',
    activeTemplateId: '',
    employees: [],
    teams: [],
    locations: [],
    templates: [],
    absenceTypes: [],
    absences: [],
    lookupsLoaded: false,
    loadingLookups: false,
    loadingWeek: false,
    lookupsError: false,
    weekError: false,
    reloadToken: 0,
    savingIds: [],
    publishing: false,
    copying: false,
    announcement: '',
  };
}

interface WeekQuery {
  from: string;
  to: string;
  teamId: string;
  locationId: string;
  token: number;
}

let nextTempId = 0;

/**
 * State of the schedule page. Provided on the route (not in root), so it lives and dies with the page.
 *
 * Shifts are an entity collection. Writes are optimistic: the grid changes at once, the request runs,
 * and on failure the previous version is restored and a toast says so.
 */
export const ScheduleStore = signalStore(
  withState<ScheduleState>(() => initialState(inject(SCHEDULE_TODAY)())),
  withEntities<Shift>(),

  withComputed((store) => {
    const auth = inject(AuthService);
    const visibleDates = computed(() =>
      store.view() === 'week' ? weekDates(store.weekStart()) : [store.selectedDay()],
    );
    const visibleEmployees = computed(() =>
      store
        .employees()
        .filter(
          (e) =>
            e.active &&
            (!store.locationId() || e.locationId === store.locationId()) &&
            (!store.teamId() || e.teamId === store.teamId()),
        ),
    );
    const employeesById = computed(() => new Map(store.employees().map((e) => [e.id, e])));
    const teamsById = computed(() => new Map(store.teams().map((t) => [t.id, t])));
    const weekEnd = computed(() => addDays(store.weekStart(), 6));
    /** Shifts of the loaded week only: entities of other weeks (edited away, in flight) never count. */
    const shifts = computed(() => {
      const from = store.weekStart();
      const to = weekEnd();
      return store.entities().filter((s) => s.date >= from && s.date <= to);
    });
    /** The loaded week within the team and location filter: what the counts and Publish refer to. */
    const scopedShifts = computed(() =>
      shifts().filter(
        (s) =>
          (!store.teamId() || s.teamId === store.teamId()) &&
          (!store.locationId() || s.locationId === store.locationId()),
      ),
    );
    const shiftsByEmployee = computed(() => groupShiftsByEmployee(shifts()));

    /** Conflicts per shift id (only shifts that have some). One pass per employee, not per cell. */
    const conflictsByShift = computed(() => {
      const result = new Map<string, Conflict[]>();
      const absences = store.absences();
      const employees = employeesById();
      for (const [employeeId, own] of shiftsByEmployee()) {
        const employee = employees.get(employeeId);
        if (!employee) continue;
        for (const shift of own) {
          const conflicts = detectConflicts({ shift, employee, shifts: own, absences });
          if (conflicts.length > 0) result.set(shift.id, conflicts);
        }
      }
      return result;
    });

    // Keeps the objects of rows that did not change between two builds (see `shareStructure`).
    let previousGrid: GridModel | null = null;
    const grid = computed(() => {
      const next = shareStructure(
        previousGrid,
        buildGrid({
          employees: visibleEmployees(),
          teams: store.teams(),
          shifts: shifts(),
          absences: store.absences(),
          dates: visibleDates(),
          weekStart: store.weekStart(),
        }),
      );
      previousGrid = next;
      return next;
    });

    return {
      canEdit: computed(() => auth.isManager()),
      visibleDates,
      visibleEmployees,
      employeesById,
      teamsById,
      shifts,
      scopedShifts,
      shiftsByEmployee,
      conflictsByShift,
      grid,
      openShifts: computed(() => scopedShifts().filter((s) => s.employeeId === null)),
      draftCount: computed(() => scopedShifts().filter((s) => s.status === 'draft').length),
      publishedCount: computed(() => scopedShifts().filter((s) => s.status === 'published').length),
      error: computed(() => store.lookupsError() || store.weekError()),
      loading: computed(() => store.loadingLookups() || store.loadingWeek()),
      weekRange: computed(() => weekRange(store.weekStart())),
      query: computed<WeekQuery>(() => ({
        from: store.weekStart(),
        to: weekEnd(),
        teamId: store.teamId(),
        locationId: store.locationId(),
        token: store.reloadToken(),
      })),
      teamsInLocation: computed(() =>
        store.teams().filter((t) => !store.locationId() || t.locationId === store.locationId()),
      ),
    };
  }),

  withComputed((store) => ({
    /** Drafts waiting to be published in the loaded week. */
    unpublishedCount: computed(() => store.draftCount()),
    isEmpty: computed(
      () => !store.loading() && !store.error() && store.scopedShifts().length === 0,
    ),
  })),

  withMethods((store) => {
    const shiftsApi = inject(ShiftsApi);
    const employeesApi = inject(EmployeesApi);
    const absencesApi = inject(AbsencesApi);
    const lookups = inject(LookupsApi);
    const toasts = inject(ToastService);
    const transloco = inject(TranslocoService);
    const today = inject(SCHEDULE_TODAY);
    /** Shifts with a request in flight. A second edit of the same shift waits for the first. */
    const inFlight = new Set<string>();

    const t = (key: string, params?: Record<string, unknown>) => transloco.translate(key, params);
    const announce = (message: string) => patchState(store, { announcement: message });
    const markSaving = (id: string, on: boolean) =>
      patchState(store, (s) => ({
        savingIds: on ? [...s.savingIds, id] : s.savingIds.filter((x) => x !== id),
      }));

    const personName = (employeeId: string | null) => {
      const employee = employeeId ? store.employeesById().get(employeeId) : undefined;
      return employee
        ? `${employee.firstName} ${employee.lastName}`
        : t('schedule.grid.openShifts');
    };
    const dayName = (date: string) =>
      formatDay(date, transloco.getActiveLang(), {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
      });

    /** Puts the previous version back and tells the user the change did not stick. */
    const undone = (kind: WriteKind) => {
      toasts.show({
        variant: 'warning',
        title: t('schedule.toast.undoneTitle'),
        message: t(`schedule.toast.undone.${kind}`),
      });
      announce(t(`schedule.toast.undone.${kind}`));
    };

    /** Is this date inside the week on screen? Results for other weeks are not merged. */
    const inLoadedWeek = (date: string) =>
      date >= store.weekStart() && date <= addDays(store.weekStart(), 6);

    const scope = () => ({
      teamId: store.teamId() || undefined,
      locationId: store.locationId() || undefined,
    });

    // `void` is how rxMethod models a trigger without a value.
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
    const loadLookups = rxMethod<void>(
      pipe(
        tap(() => patchState(store, { loadingLookups: true, lookupsError: false })),
        switchMap(() =>
          forkJoin({
            employees: employeesApi.list({ pageSize: 100, sort: 'name', dir: 'asc' }),
            teams: lookups.teams(),
            locations: lookups.locations(),
            templates: lookups.shiftTemplates(),
            absenceTypes: lookups.absenceTypes(),
          }).pipe(
            tap((data) =>
              patchState(store, {
                employees: data.employees.items,
                teams: data.teams,
                locations: data.locations,
                templates: data.templates,
                absenceTypes: data.absenceTypes,
                lookupsLoaded: true,
                loadingLookups: false,
              }),
            ),
            catchError(() => {
              patchState(store, { loadingLookups: false, lookupsError: true });
              return EMPTY;
            }),
          ),
        ),
      ),
    );

    const createShift = async (input: ShiftInput): Promise<Shift | null> => {
      if (!store.canEdit()) return null;
      const tempId = `tmp-${nextTempId++}`;
      patchState(store, addEntity({ ...input, id: tempId }));
      markSaving(tempId, true);
      try {
        const saved = await firstValueFrom(shiftsApi.create(input));
        patchState(store, removeEntity(tempId));
        if (inLoadedWeek(saved.date)) patchState(store, addEntity(saved));
        announce(
          t('schedule.announce.created', {
            who: personName(saved.employeeId),
            day: dayName(saved.date),
            start: saved.start,
            end: saved.end,
          }),
        );
        return saved;
      } catch {
        patchState(store, removeEntity(tempId));
        undone('create');
        return null;
      } finally {
        markSaving(tempId, false);
      }
    };

    /** Replaces the editable fields of a shift. Used by drag, resize and the editor. */
    const updateShift = async (
      id: string,
      input: ShiftInput,
      kind: WriteKind = 'edit',
    ): Promise<boolean> => {
      const before = store.entityMap()[id];
      if (!before || !store.canEdit() || inFlight.has(id)) return false;
      inFlight.add(id);
      markSaving(id, true);
      patchState(store, updateEntity({ id, changes: input }));
      try {
        const saved = await firstValueFrom(shiftsApi.update(id, input));
        patchState(store, inLoadedWeek(saved.date) ? setEntity(saved) : removeEntity(id));
        announce(
          kind === 'resize'
            ? t('schedule.announce.resized', { end: saved.end })
            : t('schedule.announce.moved', {
                who: personName(saved.employeeId),
                day: dayName(saved.date),
                start: saved.start,
                end: saved.end,
              }),
        );
        return true;
      } catch {
        patchState(store, setEntity(before));
        undone(kind);
        return false;
      } finally {
        inFlight.delete(id);
        markSaving(id, false);
      }
    };

    return {
      // ---- navigation and filters ----
      setView(view: ScheduleView): void {
        patchState(store, { view });
      },
      goToDate(date: string): void {
        patchState(store, { selectedDay: date, weekStart: startOfWeek(date) });
      },
      goToToday(): void {
        const date = today();
        patchState(store, { selectedDay: date, weekStart: startOfWeek(date) });
      },
      previous(): void {
        const date = addDays(store.selectedDay(), store.view() === 'week' ? -7 : -1);
        patchState(store, { selectedDay: date, weekStart: startOfWeek(date) });
      },
      next(): void {
        const date = addDays(store.selectedDay(), store.view() === 'week' ? 7 : 1);
        patchState(store, { selectedDay: date, weekStart: startOfWeek(date) });
      },
      setLocation(locationId: string): void {
        const teamStillValid = store
          .teams()
          .some(
            (team) => team.id === store.teamId() && (!locationId || team.locationId === locationId),
          );
        patchState(store, { locationId, teamId: teamStillValid ? store.teamId() : '' });
      },
      setTeam(teamId: string): void {
        patchState(store, { teamId });
      },
      setActiveTemplate(activeTemplateId: string): void {
        patchState(store, { activeTemplateId });
      },
      announce,

      // ---- loading (rxMethod: a new request cancels the one still running) ----
      loadLookups,
      loadWeek: rxMethod<WeekQuery>(
        pipe(
          tap(() => patchState(store, { loadingWeek: true, weekError: false })),
          switchMap((q) =>
            forkJoin({
              shifts: shiftsApi.list({
                from: q.from,
                to: q.to,
                teamId: q.teamId,
                locationId: q.locationId,
              }),
              absences: absencesApi.list({ from: q.from, to: q.to }),
            }).pipe(
              tap((data) =>
                patchState(store, setAllEntities(data.shifts), {
                  absences: data.absences,
                  loadingWeek: false,
                }),
              ),
              catchError(() => {
                patchState(store, { loadingWeek: false, weekError: true });
                return EMPTY;
              }),
            ),
          ),
        ),
      ),
      retry(): void {
        patchState(store, (s) => ({ reloadToken: s.reloadToken + 1 }));
        if (!store.lookupsLoaded()) loadLookups();
      },

      // ---- writes: optimistic, with rollback ----
      createShift,
      updateShift,

      moveShift(id: string, input: ShiftInput): Promise<boolean> {
        return updateShift(id, input, 'move');
      },

      resizeShift(id: string, end: string): Promise<boolean> {
        const shift = store.entityMap()[id];
        if (!shift) return Promise.resolve(false);
        return updateShift(id, { ...toInput(shift), end }, 'resize');
      },

      async deleteShift(id: string): Promise<boolean> {
        const before = store.entityMap()[id];
        if (!before || !store.canEdit() || inFlight.has(id)) return false;
        inFlight.add(id);
        patchState(store, removeEntity(id));
        try {
          await firstValueFrom(shiftsApi.remove(id));
          announce(t('schedule.announce.deleted'));
          return true;
        } catch {
          patchState(store, addEntity(before));
          undone('delete');
          return false;
        } finally {
          inFlight.delete(id);
        }
      },

      /** Creates a draft shift from a template on a cell (palette drop, or the template picker). */
      applyTemplate(templateId: string, target: DropTarget, start?: string): Promise<Shift | null> {
        const template = store.templates().find((x) => x.id === templateId);
        if (!template) return Promise.resolve(null);
        const input = shiftFromTemplate(template, target, store.employeesById(), {
          teamId: store.teamId() || store.teamsInLocation()[0]?.id || store.teams()[0]?.id || '',
          locationId:
            store.locationId() ||
            store.teamsInLocation()[0]?.locationId ||
            store.locations()[0]?.id ||
            '',
          start,
        });
        return createShift(input);
      },

      // ---- week actions ----
      /** Publishes the drafts of the loaded week (within the team and location filter). */
      async publishWeek(): Promise<number | null> {
        if (!store.canEdit() || store.publishing()) return null;
        const { from, to } = store.weekRange();
        const { teamId, locationId } = scope();
        patchState(store, { publishing: true });
        try {
          const result = await firstValueFrom(shiftsApi.publish({ from, to, ...scope() }));
          patchState(
            store,
            updateEntities({
              predicate: (s) =>
                s.status === 'draft' &&
                s.date >= from &&
                s.date <= to &&
                (!teamId || s.teamId === teamId) &&
                (!locationId || s.locationId === locationId),
              changes: { status: 'published' },
            }),
            { publishing: false },
          );
          announce(t('schedule.announce.published', { count: result.published }));
          return result.published;
        } catch {
          patchState(store, { publishing: false });
          return null;
        }
      },

      /** Copies last week's shifts into the loaded week as drafts. */
      async copyPreviousWeek(): Promise<number | null> {
        if (!store.canEdit() || store.copying()) return null;
        patchState(store, { copying: true });
        try {
          const copies = await firstValueFrom(
            shiftsApi.copyWeek({
              fromWeek: addDays(store.weekStart(), -7),
              toWeek: store.weekStart(),
              ...scope(),
            }),
          );
          patchState(store, addEntities(copies.filter((c) => inLoadedWeek(c.date))), {
            copying: false,
          });
          announce(t('schedule.announce.copied', { count: copies.length }));
          return copies.length;
        } catch {
          patchState(store, { copying: false });
          return null;
        }
      },
    };
  }),

  withHooks({
    onInit(store) {
      store.loadLookups();
      store.loadWeek(store.query);
    },
  }),
);

export type ScheduleStoreType = InstanceType<typeof ScheduleStore>;
