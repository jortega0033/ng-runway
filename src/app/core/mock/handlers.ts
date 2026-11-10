import { delay, http, HttpResponse, type HttpHandler, type PathParams } from 'msw';
import type {
  AbsenceBalance,
  AbsenceRequest,
  AbsenceRequestInput,
  AbsenceStatus,
  ClockEntry,
  Employee,
  EmployeeInput,
  LoginResponse,
  ReportResult,
  SessionUser,
  Shift,
  ShiftInput,
  UserRole,
} from '../api/models';
import { computeBalance } from '../domain/balances';
import { shiftNetMinutes, workedMinutes, minutesToHours } from '../domain/hours';
import { addDays, startOfWeek, todayIso } from '../domain/time';
import type { MockDb } from './db';
import type { DevControls } from './dev-controls';
import { MOCK_FEATURES, type HandlerKit } from './features';
import { matchesSearch, paginate, readListQuery, sortItems } from './query';

export const TOKEN_PREFIX = 'mock-token-';

export interface HandlerOptions {
  /** Prefix of every route, for example `/api` or `https://host/app/api`. */
  baseUrl: string;
  db: MockDb;
  /** Read on every request, so the dev toolbar can change it live. */
  controls: () => DevControls;
  now?: () => Date;
}

const error = (status: number, message: string, code?: string) =>
  HttpResponse.json({ message, code }, { status });

const fullName = (e: Employee) => `${e.firstName} ${e.lastName}`;

function toSessionUser(e: Employee): SessionUser {
  return {
    id: e.id,
    name: fullName(e),
    email: e.email,
    role: e.userRole,
    teamId: e.teamId,
    locationId: e.locationId,
  };
}

/** All mock routes. The same list runs in the browser worker and in unit tests (`msw/node`). */
export function createHandlers({
  baseUrl,
  db,
  controls,
  now = () => new Date(),
}: HandlerOptions): HttpHandler[] {
  const url = (path: string) => `${baseUrl}${path}`;
  const state = () => db.state;
  const today = () => todayIso(now());

  /** Applies the dev toolbar: delay and random failures. Returns a response to short-circuit. */
  async function chaos(request: Request) {
    const c = controls();
    if (c.slowMs > 0) await delay(c.slowMs);
    if (c.errorRate > 0 && Math.random() < c.errorRate && !request.url.includes('/dev/')) {
      return error(500, 'Simulated server error from the dev toolbar.', 'DEV_ERROR');
    }
    return undefined;
  }

  function userOf(request: Request): Employee | undefined {
    const header = request.headers.get('authorization') ?? '';
    const id = header.startsWith(`Bearer ${TOKEN_PREFIX}`)
      ? header.slice(`Bearer ${TOKEN_PREFIX}`.length)
      : '';
    return state().employees.find((e) => e.id === id);
  }

  /** Wraps a handler: chaos first, then auth, then the real work. */
  function route<P extends Record<string, string | readonly string[]>>(
    work: (ctx: {
      request: Request;
      params: P;
      user: Employee;
      url: URL;
    }) => Response | Promise<Response>,
    options: { roles?: UserRole[]; public?: boolean } = {},
  ) {
    return async ({ request, params }: { request: Request; params: PathParams }) => {
      const failed = await chaos(request);
      if (failed) return failed;
      const user = userOf(request);
      if (!options.public && !user) return error(401, 'Sign in to continue.', 'UNAUTHENTICATED');
      if (options.roles && user && !options.roles.includes(user.userRole)) {
        return error(403, 'You do not have access to this.', 'FORBIDDEN');
      }
      return work({
        request,
        params: params as P,
        user: user as Employee,
        url: new URL(request.url),
      });
    };
  }

  const save = () => db.save();
  const isManager = (u: Employee) => u.userRole !== 'employee';

  function notify(
    userId: string,
    kind: 'absence' | 'timesheet' | 'schedule' | 'system',
    title: string,
    message: string,
  ) {
    state().notifications.unshift({
      id: crypto.randomUUID(),
      userId,
      kind,
      title,
      message,
      createdAt: now().toISOString(),
      read: false,
    });
  }

  const managersOf = (employee: Employee) =>
    state().employees.filter(
      (m) => m.userRole === 'admin' || (m.userRole === 'manager' && m.teamId === employee.teamId),
    );

  const core: HttpHandler[] = [
    // ---- auth ----
    http.post(url('/auth/login'), async ({ request }) => {
      const failed = await chaos(request);
      if (failed) return failed;
      const body = (await request.json()) as { role?: UserRole; employeeId?: string };
      const employee = body.employeeId
        ? state().employees.find((e) => e.id === body.employeeId)
        : state().employees.find((e) => e.userRole === body.role);
      if (!employee) return error(404, 'No demo user for that role.');
      const response: LoginResponse = {
        token: `${TOKEN_PREFIX}${employee.id}`,
        user: toSessionUser(employee),
      };
      return HttpResponse.json(response);
    }),

    // ---- lookups ----
    http.get(
      url('/locations'),
      route(() => HttpResponse.json(state().locations)),
    ),
    http.get(
      url('/teams'),
      route(() => HttpResponse.json(state().teams)),
    ),
    http.get(
      url('/absence-types'),
      route(() => HttpResponse.json(state().absenceTypes)),
    ),
    http.get(
      url('/shift-templates'),
      route(() => HttpResponse.json(state().shiftTemplates)),
    ),

    // ---- employees ----
    http.get(
      url('/employees'),
      route(({ url: u }) => {
        const q = readListQuery(u);
        const p = u.searchParams;
        const teamId = p.get('teamId');
        const locationId = p.get('locationId');
        const role = p.get('userRole');
        const active = p.get('active');
        const teamName = (e: Employee) => state().teams.find((t) => t.id === e.teamId)?.name ?? '';
        let items = state().employees.filter(
          (e) =>
            (!teamId || e.teamId === teamId) &&
            (!locationId || e.locationId === locationId) &&
            (!role || e.userRole === role) &&
            (active === null || String(e.active) === active) &&
            matchesSearch(q.q, fullName(e), e.email, e.jobTitle, teamName(e)),
        );
        if (controls().empty) items = [];
        items = sortItems(items, q.sort, q.dir, {
          name: (e) => `${e.lastName} ${e.firstName}`,
          jobTitle: (e) => e.jobTitle,
          team: teamName,
          hours: (e) => e.contract.hoursPerWeek,
        });
        return HttpResponse.json(paginate(items, q));
      }),
    ),
    http.get(
      url('/employees/:id'),
      route<{ id: string }>(({ params }) => {
        const employee = state().employees.find((e) => e.id === params.id);
        return employee ? HttpResponse.json(employee) : error(404, 'Employee not found.');
      }),
    ),
    http.post(
      url('/employees'),
      route(
        async ({ request, user }) => {
          const input = (await request.json()) as EmployeeInput;
          if (input.userRole === 'admin' && user.userRole !== 'admin')
            return error(403, 'Only an admin can give the admin role.', 'FORBIDDEN');
          const created: Employee = { ...input, id: `emp-${crypto.randomUUID().slice(0, 8)}` };
          state().employees.push(created);
          save();
          return HttpResponse.json(created, { status: 201 });
        },
        { roles: ['admin', 'manager'] },
      ),
    ),
    http.put(
      url('/employees/:id'),
      route<{ id: string }>(
        async ({ request, params, user }) => {
          const index = state().employees.findIndex((e) => e.id === params.id);
          if (index < 0) return error(404, 'Employee not found.');
          const input = (await request.json()) as EmployeeInput;
          // Only an admin can hand out or take away the admin role.
          const current = state().employees[index];
          if (user.userRole !== 'admin' && input.userRole !== current?.userRole) {
            if (input.userRole === 'admin' || current?.userRole === 'admin')
              return error(403, 'Only an admin can change the admin role.', 'FORBIDDEN');
          }
          const updated: Employee = { ...input, id: params.id };
          state().employees[index] = updated;
          save();
          return HttpResponse.json(updated);
        },
        { roles: ['admin', 'manager'] },
      ),
    ),
    http.delete(
      url('/employees/:id'),
      route<{ id: string }>(
        ({ params }) => {
          const s = state();
          const before = s.employees.length;
          s.employees = s.employees.filter((e) => e.id !== params.id);
          if (s.employees.length === before) return error(404, 'Employee not found.');
          // Their shifts become open shifts; history that points at them is removed.
          s.shifts.forEach((x) => {
            if (x.employeeId === params.id) x.employeeId = null;
          });
          s.absences = s.absences.filter((a) => a.employeeId !== params.id);
          s.clockEntries = s.clockEntries.filter((c) => c.employeeId !== params.id);
          save();
          return new HttpResponse(null, { status: 204 });
        },
        { roles: ['admin'] },
      ),
    ),

    // ---- shifts ----
    http.get(
      url('/shifts'),
      route(({ url: u, user }) => {
        const p = u.searchParams;
        const from = p.get('from') ?? '0000-00-00';
        const to = p.get('to') ?? '9999-99-99';
        const teamId = p.get('teamId');
        const locationId = p.get('locationId');
        const employeeId = p.get('employeeId');
        let items = state().shifts.filter(
          (s) =>
            s.date >= from &&
            s.date <= to &&
            (!teamId || s.teamId === teamId) &&
            (!locationId || s.locationId === locationId) &&
            (!employeeId || s.employeeId === employeeId) &&
            // Employees only see published shifts.
            (isManager(user) || s.status === 'published'),
        );
        if (controls().empty) items = [];
        return HttpResponse.json(items);
      }),
    ),
    http.post(
      url('/shifts'),
      route(
        async ({ request }) => {
          const input = (await request.json()) as ShiftInput;
          const created: Shift = { ...input, id: `shift-${crypto.randomUUID().slice(0, 8)}` };
          state().shifts.push(created);
          save();
          return HttpResponse.json(created, { status: 201 });
        },
        { roles: ['admin', 'manager'] },
      ),
    ),
    http.put(
      url('/shifts/:id'),
      route<{ id: string }>(
        async ({ request, params }) => {
          const index = state().shifts.findIndex((s) => s.id === params.id);
          if (index < 0) return error(404, 'Shift not found.');
          const input = (await request.json()) as ShiftInput;
          const updated: Shift = { ...input, id: params.id };
          state().shifts[index] = updated;
          save();
          return HttpResponse.json(updated);
        },
        { roles: ['admin', 'manager'] },
      ),
    ),
    http.delete(
      url('/shifts/:id'),
      route<{ id: string }>(
        ({ params }) => {
          const s = state();
          const before = s.shifts.length;
          s.shifts = s.shifts.filter((x) => x.id !== params.id);
          if (s.shifts.length === before) return error(404, 'Shift not found.');
          save();
          return new HttpResponse(null, { status: 204 });
        },
        { roles: ['admin', 'manager'] },
      ),
    ),
    http.post(
      url('/shifts/publish'),
      route(
        async ({ request }) => {
          const { from, to, teamId, locationId } = (await request.json()) as {
            from: string;
            to: string;
            teamId?: string;
            locationId?: string;
          };
          let count = 0;
          for (const s of state().shifts) {
            if (
              s.status === 'draft' &&
              s.date >= from &&
              s.date <= to &&
              (!teamId || s.teamId === teamId) &&
              (!locationId || s.locationId === locationId)
            ) {
              s.status = 'published';
              count++;
              if (s.employeeId)
                notify(
                  s.employeeId,
                  'schedule',
                  'Schedule published',
                  `Your shifts from ${from} are ready.`,
                );
            }
          }
          save();
          return HttpResponse.json({ published: count });
        },
        { roles: ['admin', 'manager'] },
      ),
    ),
    http.post(
      url('/shifts/copy-week'),
      route(
        async ({ request }) => {
          const { fromWeek, toWeek, teamId, locationId } = (await request.json()) as {
            fromWeek: string;
            toWeek: string;
            teamId?: string;
            locationId?: string;
          };
          const offset = (Date.parse(toWeek) - Date.parse(fromWeek)) / 86_400_000;
          const source = state().shifts.filter(
            (s) =>
              s.date >= fromWeek &&
              s.date <= addDays(fromWeek, 6) &&
              (!teamId || s.teamId === teamId) &&
              (!locationId || s.locationId === locationId),
          );
          // Copying twice must not double the week: a shift is skipped when the target week already
          // has one for the same person on that day (open shifts: same day, team, start and end).
          const taken = (s: Shift) =>
            s.employeeId
              ? `${s.employeeId}|${s.date}`
              : `open|${s.date}|${s.teamId}|${s.start}|${s.end}`;
          const existing = new Set(
            state()
              .shifts.filter((s) => s.date >= toWeek && s.date <= addDays(toWeek, 6))
              .map(taken),
          );
          const copies: Shift[] = [];
          for (const s of source) {
            const copy: Shift = {
              ...s,
              id: `shift-${crypto.randomUUID().slice(0, 8)}`,
              date: addDays(s.date, offset),
              status: 'draft',
            };
            if (existing.has(taken(copy))) continue;
            existing.add(taken(copy));
            copies.push(copy);
          }
          state().shifts.push(...copies);
          save();
          return HttpResponse.json(copies, { status: 201 });
        },
        { roles: ['admin', 'manager'] },
      ),
    ),

    // ---- clock and timesheets ----
    http.get(
      url('/clock-entries'),
      route(({ url: u, user }) => {
        const p = u.searchParams;
        const from = p.get('from') ?? '0000-00-00';
        const to = p.get('to') ?? '9999-99-99';
        const employeeId = p.get('employeeId');
        const status = p.get('status');
        const teamId = p.get('teamId');
        let items = state().clockEntries.filter((c) => {
          if (c.date < from || c.date > to) return false;
          if (employeeId && c.employeeId !== employeeId) return false;
          if (status && c.status !== status) return false;
          if (!isManager(user) && c.employeeId !== user.id) return false;
          if (teamId) {
            const owner = state().employees.find((e) => e.id === c.employeeId);
            if (owner?.teamId !== teamId) return false;
          }
          return true;
        });
        if (controls().empty) items = [];
        return HttpResponse.json(items);
      }),
    ),
    http.post(
      url('/clock/in'),
      route(({ user }) => {
        const open = state().clockEntries.find(
          (c) => c.employeeId === user.id && c.clockOut === null,
        );
        if (open) return error(409, 'You are already clocked in.', 'ALREADY_CLOCKED_IN');
        const entry: ClockEntry = {
          id: `clock-${crypto.randomUUID().slice(0, 8)}`,
          employeeId: user.id,
          date: today(),
          clockIn: now().toISOString(),
          clockOut: null,
          breaks: [],
          status: 'open',
          comment: '',
        };
        state().clockEntries.push(entry);
        save();
        return HttpResponse.json(entry, { status: 201 });
      }),
    ),
    http.post(
      url('/clock/out'),
      route(({ user }) => {
        const entry = state().clockEntries.find(
          (c) => c.employeeId === user.id && c.clockOut === null,
        );
        if (!entry) return error(409, 'You are not clocked in.', 'NOT_CLOCKED_IN');
        const nowIso = now().toISOString();
        const running = entry.breaks.find((b) => b.end === null);
        if (running) running.end = nowIso;
        entry.clockOut = nowIso;
        entry.status = 'submitted';
        save();
        return HttpResponse.json(entry);
      }),
    ),
    http.post(
      url('/clock/break/start'),
      route(({ user }) => {
        const entry = state().clockEntries.find(
          (c) => c.employeeId === user.id && c.clockOut === null,
        );
        if (!entry) return error(409, 'You are not clocked in.', 'NOT_CLOCKED_IN');
        if (entry.breaks.some((b) => b.end === null))
          return error(409, 'A break is already running.');
        entry.breaks.push({ start: now().toISOString(), end: null });
        save();
        return HttpResponse.json(entry);
      }),
    ),
    http.post(
      url('/clock/break/end'),
      route(({ user }) => {
        const entry = state().clockEntries.find(
          (c) => c.employeeId === user.id && c.clockOut === null,
        );
        const running = entry?.breaks.find((b) => b.end === null);
        if (!entry || !running) return error(409, 'No break is running.');
        running.end = now().toISOString();
        save();
        return HttpResponse.json(entry);
      }),
    ),
    http.post(
      url('/clock-entries/:id/review'),
      route<{ id: string }>(
        async ({ request, params, user }) => {
          const { status, comment } = (await request.json()) as {
            status: 'approved' | 'rejected';
            comment?: string;
          };
          const entry = state().clockEntries.find((c) => c.id === params.id);
          if (!entry) return error(404, 'Time entry not found.');
          if (entry.status !== 'submitted')
            return error(409, 'Only submitted hours can be reviewed.', 'NOT_SUBMITTED');
          if (status === 'rejected' && !comment?.trim())
            return error(422, 'Add a comment when you reject.');
          entry.status = status;
          entry.comment = comment ?? '';
          notify(
            entry.employeeId,
            'timesheet',
            `Timesheet ${status}`,
            `${fullName(user)} ${status} your hours for ${entry.date}.`,
          );
          save();
          return HttpResponse.json(entry);
        },
        { roles: ['admin', 'manager'] },
      ),
    ),

    // ---- absences ----
    http.get(
      url('/absences'),
      route(({ url: u, user }) => {
        const p = u.searchParams;
        const employeeId = p.get('employeeId');
        const status = p.get('status') as AbsenceStatus | null;
        const teamId = p.get('teamId');
        const from = p.get('from') ?? '0000-00-00';
        const to = p.get('to') ?? '9999-99-99';
        let items = state().absences.filter((a) => {
          if (a.endDate < from || a.startDate > to) return false;
          if (employeeId && a.employeeId !== employeeId) return false;
          if (status && a.status !== status) return false;
          if (teamId) {
            const owner = state().employees.find((e) => e.id === a.employeeId);
            if (owner?.teamId !== teamId) return false;
          }
          // Employees see the team calendar (approved) plus their own requests.
          if (!isManager(user) && a.employeeId !== user.id && a.status !== 'approved') return false;
          return true;
        });
        if (controls().empty) items = [];
        return HttpResponse.json(items);
      }),
    ),
    http.get(
      url('/absences/balances'),
      route(({ url: u, user }) => {
        // Employees only see their own balances.
        const employeeId = isManager(user)
          ? (u.searchParams.get('employeeId') ?? user.id)
          : user.id;
        const requestedYear = Number(u.searchParams.get('year') ?? now().getFullYear());
        const year = Number.isInteger(requestedYear) ? requestedYear : now().getFullYear();
        const balances: AbsenceBalance[] = state()
          .absenceTypes.filter((t) => t.yearlyDays !== null)
          .map((t) => computeBalance(employeeId, t, state().absences, year));
        return HttpResponse.json(balances);
      }),
    ),
    http.post(
      url('/absences'),
      route(async ({ request, user }) => {
        const input = (await request.json()) as AbsenceRequestInput;
        if (input.endDate < input.startDate)
          return error(422, 'The end date is before the start date.');
        if (!state().absenceTypes.some((t) => t.key === input.type))
          return error(422, 'Unknown absence type.');
        const owner = isManager(user)
          ? (state().employees.find((e) => e.id === input.employeeId) ?? user)
          : user;
        const created: AbsenceRequest = {
          ...input,
          employeeId: owner.id,
          id: `abs-${crypto.randomUUID().slice(0, 8)}`,
          status: 'pending',
          comment: '',
        };
        state().absences.push(created);
        managersOf(owner).forEach((m) =>
          notify(
            m.id,
            'absence',
            'Absence request waiting',
            `${fullName(owner)} asked for time off from ${created.startDate}.`,
          ),
        );
        save();
        return HttpResponse.json(created, { status: 201 });
      }),
    ),
    http.post(
      url('/absences/:id/review'),
      route<{ id: string }>(
        async ({ request, params, user }) => {
          const { status, comment } = (await request.json()) as {
            status: 'approved' | 'rejected';
            comment?: string;
          };
          const absence = state().absences.find((a) => a.id === params.id);
          if (!absence) return error(404, 'Request not found.');
          if (absence.status !== 'pending')
            return error(409, 'This request was already reviewed.', 'NOT_PENDING');
          // The reject dialog in the UI treats the comment as optional, so the mock does too.
          absence.status = status;
          absence.comment = comment ?? '';
          notify(
            absence.employeeId,
            'absence',
            `Absence ${status}`,
            `${fullName(user)} ${status} your request from ${absence.startDate}.`,
          );
          save();
          return HttpResponse.json(absence);
        },
        { roles: ['admin', 'manager'] },
      ),
    ),

    // ---- notifications ----
    http.get(
      url('/notifications'),
      route(({ user }) => {
        const items = controls().empty
          ? []
          : state().notifications.filter((n) => n.userId === user.id);
        return HttpResponse.json(items);
      }),
    ),
    http.post(
      url('/notifications/read-all'),
      route(({ user }) => {
        state()
          .notifications.filter((n) => n.userId === user.id)
          .forEach((n) => (n.read = true));
        save();
        return new HttpResponse(null, { status: 204 });
      }),
    ),
    http.post(
      url('/notifications/:id/read'),
      route<{ id: string }>(({ params }) => {
        const note = state().notifications.find((n) => n.id === params.id);
        if (note) note.read = true;
        save();
        return new HttpResponse(null, { status: 204 });
      }),
    ),

    // ---- reports ----
    http.get(
      url('/reports'),
      route(({ url: u }) => {
        const p = u.searchParams;
        const thisWeek = startOfWeek(today());
        const from = p.get('from') ?? addDays(thisWeek, -28);
        const to = p.get('to') ?? addDays(thisWeek, 6);
        const empty = controls().empty;
        const byEmployee = new Map(state().employees.map((e) => [e.id, e]));
        const daily = new Map<string, { hours: number; laborCostCents: number }>();
        const rows = state().teams.map((team) => {
          const scheduledMinutes = state()
            .shifts.filter(
              (s) =>
                s.teamId === team.id &&
                s.employeeId &&
                s.status === 'published' &&
                s.date >= from &&
                s.date <= to,
            )
            .reduce((sum, s) => sum + shiftNetMinutes(s), 0);
          let workedMin = 0;
          let costCents = 0;
          for (const entry of state().clockEntries) {
            const owner = byEmployee.get(entry.employeeId);
            if (!owner || owner.teamId !== team.id || entry.date < from || entry.date > to)
              continue;
            if (entry.status === 'rejected' || entry.clockOut === null) continue;
            const minutes = workedMinutes(entry);
            workedMin += minutes;
            const cost = Math.round((minutes / 60) * owner.contract.hourlyRateCents);
            costCents += cost;
            const day = daily.get(entry.date) ?? { hours: 0, laborCostCents: 0 };
            day.hours += minutes / 60;
            day.laborCostCents += cost;
            daily.set(entry.date, day);
          }
          return {
            teamId: team.id,
            teamName: team.name,
            hours: empty ? 0 : minutesToHours(workedMin),
            laborCostCents: empty ? 0 : costCents,
            scheduledHours: empty ? 0 : minutesToHours(scheduledMinutes),
          };
        });
        const result: ReportResult = {
          from,
          to,
          rows,
          daily: empty
            ? []
            : [...daily.entries()]
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, d]) => ({
                  date,
                  hours: Math.round(d.hours * 100) / 100,
                  laborCostCents: d.laborCostCents,
                })),
        };
        return HttpResponse.json(result);
      }),
    ),

    // ---- dev ----
    http.post(
      url('/dev/reset'),
      route(
        () => {
          db.reset();
          return new HttpResponse(null, { status: 204 });
        },
        { public: true },
      ),
    ),
  ];

  // Features made with `npm run gen:feature` register their own routes in features.ts.
  const kit: HandlerKit = { url, route, state, save };
  return [...core, ...MOCK_FEATURES.flatMap((feature) => feature.handlers(kit))];
}
