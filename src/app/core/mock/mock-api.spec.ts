import { setupServer } from 'msw/node';
import type {
  AbsenceBalance,
  AbsenceRequest,
  ClockEntry,
  Employee,
  LoginResponse,
  Page,
  ReportResult,
  Shift,
} from '../api/models';
import { MockDb, type DbStorage } from './db';
import { DEFAULT_DEV_CONTROLS, type DevControls } from './dev-controls';
import { createHandlers } from './handlers';
import { createSeed } from './seed';
import { startOfWeek } from '../domain/time';

const BASE = 'http://localhost/api';
const TODAY = '2026-11-09'; // a Monday

function memoryStorage(): DbStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe('mock API', () => {
  let db: MockDb;
  let controls: DevControls;
  const server = setupServer();

  beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
  afterAll(() => server.close());

  beforeEach(() => {
    db = new MockDb(
      () => createSeed(TODAY),
      memoryStorage(),
      () => startOfWeek(TODAY),
    );
    controls = { ...DEFAULT_DEV_CONTROLS };
    server.resetHandlers(
      ...createHandlers({
        baseUrl: BASE,
        db,
        controls: () => controls,
        now: () => new Date(`${TODAY}T10:00:00.000Z`),
      }),
    );
  });

  async function login(role: 'admin' | 'manager' | 'employee'): Promise<Record<string, string>> {
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
    const body = (await res.json()) as LoginResponse;
    return { authorization: `Bearer ${body.token}`, 'content-type': 'application/json' };
  }

  it('seeds the documented amount of data, the same every time', () => {
    const a = createSeed(TODAY);
    const b = createSeed(TODAY);
    expect(a.locations).toHaveLength(3);
    expect(a.teams).toHaveLength(6);
    expect(a.employees).toHaveLength(40);
    expect(a.employees.map((e) => e.email)).toEqual(b.employees.map((e) => e.email));
    const weeks = new Set(a.shifts.map((s) => startOfWeek(s.date)));
    expect(weeks.size).toBe(8);
    expect(a.clockEntries.length).toBeGreaterThan(0);
    expect(new Set(a.absences.map((r) => r.type)).size).toBeGreaterThan(2);
  });

  it('rejects requests without a token', async () => {
    const res = await fetch(`${BASE}/employees`);
    expect(res.status).toBe(401);
  });

  it('paginates, sorts and searches employees on the server', async () => {
    const headers = await login('manager');
    const first = (await (
      await fetch(`${BASE}/employees?page=1&pageSize=10&sort=name&dir=asc`, { headers })
    ).json()) as Page<Employee>;
    expect(first.items).toHaveLength(10);
    expect(first.total).toBe(40);
    const names = first.items.map((e) => `${e.lastName} ${e.firstName}`);
    expect(names).toEqual([...names].sort((x, y) => x.localeCompare(y)));

    const found = (await (
      await fetch(`${BASE}/employees?q=bakker%20sara`, { headers })
    ).json()) as Page<Employee>;
    expect(found.items.some((e) => e.firstName === 'Sara')).toBe(true);
  });

  it('keeps employees out of write endpoints', async () => {
    const headers = await login('employee');
    const res = await fetch(`${BASE}/shifts`, { method: 'POST', headers, body: '{}' });
    expect(res.status).toBe(403);
  });

  it('shows employees only published shifts', async () => {
    const employee = await login('employee');
    const manager = await login('manager');
    const range = `from=${TODAY}&to=2026-12-31`;
    const mine = (await (
      await fetch(`${BASE}/shifts?${range}`, { headers: employee })
    ).json()) as Shift[];
    const all = (await (
      await fetch(`${BASE}/shifts?${range}`, { headers: manager })
    ).json()) as Shift[];
    expect(mine.every((s) => s.status === 'published')).toBe(true);
    expect(all.some((s) => s.status === 'draft')).toBe(true);
  });

  it('publishes drafts for a week', async () => {
    const headers = await login('manager');
    const draftWeek = '2026-12-07';
    const before = db.state.shifts.filter(
      (s) => s.status === 'draft' && s.date >= draftWeek && s.date <= '2026-12-13',
    );
    expect(before.length).toBeGreaterThan(0);
    const res = await fetch(`${BASE}/shifts/publish`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ from: draftWeek, to: '2026-12-13' }),
    });
    expect(((await res.json()) as { published: number }).published).toBe(before.length);
    expect(
      db.state.shifts.filter(
        (s) => s.status === 'draft' && s.date >= draftWeek && s.date <= '2026-12-13',
      ),
    ).toHaveLength(0);
  });

  it('clocks in and out, and a manager approves the entry', async () => {
    const employee = await login('employee');
    const manager = await login('manager');
    const clockIn = await fetch(`${BASE}/clock/in`, { method: 'POST', headers: employee });
    expect(clockIn.status).toBe(201);
    expect((await fetch(`${BASE}/clock/in`, { method: 'POST', headers: employee })).status).toBe(
      409,
    );
    await fetch(`${BASE}/clock/break/start`, { method: 'POST', headers: employee });
    await fetch(`${BASE}/clock/break/end`, { method: 'POST', headers: employee });
    const out = (await (
      await fetch(`${BASE}/clock/out`, { method: 'POST', headers: employee })
    ).json()) as ClockEntry;
    expect(out.status).toBe('submitted');

    const reject = await fetch(`${BASE}/clock-entries/${out.id}/review`, {
      method: 'POST',
      headers: manager,
      body: JSON.stringify({ status: 'rejected' }),
    });
    expect(reject.status).toBe(422);
    const approve = await fetch(`${BASE}/clock-entries/${out.id}/review`, {
      method: 'POST',
      headers: manager,
      body: JSON.stringify({ status: 'approved', comment: 'Looks right' }),
    });
    expect(((await approve.json()) as ClockEntry).status).toBe('approved');
  });

  it('runs the absence flow and updates balances', async () => {
    const employee = await login('employee');
    const manager = await login('manager');
    const balance = async () =>
      (
        (await (
          await fetch(`${BASE}/absences/balances?employeeId=emp-003&year=2026`, {
            headers: employee,
          })
        ).json()) as AbsenceBalance[]
      ).find((b) => b.type === 'vacation')!;
    const before = await balance();

    const created = (await (
      await fetch(`${BASE}/absences`, {
        method: 'POST',
        headers: employee,
        body: JSON.stringify({
          employeeId: 'emp-003',
          type: 'vacation',
          startDate: '2026-11-16',
          endDate: '2026-11-18',
          reason: 'Trip',
        }),
      })
    ).json()) as AbsenceRequest;
    expect(created.status).toBe('pending');
    expect((await balance()).pendingDays).toBe(before.pendingDays + 3);

    const approved = (await (
      await fetch(`${BASE}/absences/${created.id}/review`, {
        method: 'POST',
        headers: manager,
        body: JSON.stringify({ status: 'approved', comment: 'Enjoy' }),
      })
    ).json()) as AbsenceRequest;
    expect(approved.status).toBe('approved');
    const after = await balance();
    expect(after.usedDays).toBe(before.usedDays + 3);
    expect(after.pendingDays).toBe(before.pendingDays);
  });

  it('only reviews pending absences and submitted time entries', async () => {
    const manager = await login('manager');
    const approved = db.state.absences.find((a) => a.status === 'approved')!;
    const absenceRes = await fetch(`${BASE}/absences/${approved.id}/review`, {
      method: 'POST',
      headers: manager,
      body: JSON.stringify({ status: 'rejected', comment: 'Changed my mind' }),
    });
    expect(absenceRes.status).toBe(409);
    expect(db.state.absences.find((a) => a.id === approved.id)?.status).toBe('approved');

    const done = db.state.clockEntries.find((c) => c.status === 'approved')!;
    const entryRes = await fetch(`${BASE}/clock-entries/${done.id}/review`, {
      method: 'POST',
      headers: manager,
      body: JSON.stringify({ status: 'rejected', comment: 'Too late' }),
    });
    expect(entryRes.status).toBe(409);
    expect(db.state.clockEntries.find((c) => c.id === done.id)?.status).toBe('approved');
  });

  it('shows employees their own balances and rejects unknown absence types', async () => {
    const employee = await login('employee');
    const me = db.state.employees.find((e) => e.userRole === 'employee')!;
    const other = db.state.employees.find((e) => e.id !== me.id && e.userRole === 'employee')!;
    const balances = (await (
      await fetch(`${BASE}/absences/balances?employeeId=${other.id}&year=abc`, {
        headers: employee,
      })
    ).json()) as AbsenceBalance[];
    expect(balances.length).toBeGreaterThan(0);
    expect(balances.every((b) => b.employeeId === me.id)).toBe(true);

    const res = await fetch(`${BASE}/absences`, {
      method: 'POST',
      headers: employee,
      body: JSON.stringify({
        employeeId: me.id,
        type: 'sabbatical-on-mars',
        startDate: '2026-11-16',
        endDate: '2026-11-17',
        reason: '',
      }),
    });
    expect(res.status).toBe(422);
  });

  it('lets only an admin hand out the admin role', async () => {
    const manager = await login('manager');
    const admin = await login('admin');
    const template = db.state.employees.find((e) => e.userRole === 'employee')!;
    const base: Partial<Employee> = { ...template };
    delete base.id;
    const asAdmin = { ...base, email: 'new.admin@example.com', userRole: 'admin' as const };

    const denied = await fetch(`${BASE}/employees`, {
      method: 'POST',
      headers: manager,
      body: JSON.stringify(asAdmin),
    });
    expect(denied.status).toBe(403);
    const promote = await fetch(`${BASE}/employees/${template.id}`, {
      method: 'PUT',
      headers: manager,
      body: JSON.stringify({ ...base, userRole: 'admin' }),
    });
    expect(promote.status).toBe(403);
    expect(db.state.employees.find((e) => e.id === template.id)?.userRole).toBe('employee');

    const allowed = await fetch(`${BASE}/employees`, {
      method: 'POST',
      headers: admin,
      body: JSON.stringify(asAdmin),
    });
    expect(allowed.status).toBe(201);
  });

  it('copies a week once: a second copy adds nothing', async () => {
    const headers = await login('manager');
    const body = JSON.stringify({ fromWeek: '2026-11-09', toWeek: '2026-12-21' });
    const first = (await (
      await fetch(`${BASE}/shifts/copy-week`, { method: 'POST', headers, body })
    ).json()) as Shift[];
    expect(first.length).toBeGreaterThan(0);
    const count = db.state.shifts.length;
    const second = (await (
      await fetch(`${BASE}/shifts/copy-week`, { method: 'POST', headers, body })
    ).json()) as Shift[];
    expect(second).toHaveLength(0);
    expect(db.state.shifts).toHaveLength(count);
  });

  it('builds a report per team', async () => {
    const headers = await login('admin');
    const report = (await (
      await fetch(`${BASE}/reports?from=2026-10-12&to=2026-11-08`, { headers })
    ).json()) as ReportResult;
    expect(report.rows).toHaveLength(6);
    expect(report.rows.some((r) => r.hours > 0 && r.laborCostCents > 0)).toBe(true);
    expect(report.daily.length).toBeGreaterThan(0);
  });

  it('applies the dev toolbar: errors and empty lists', async () => {
    const headers = await login('manager');
    controls = { ...controls, errorRate: 1 };
    const failed = await fetch(`${BASE}/teams`, { headers });
    expect(failed.status).toBe(500);

    controls = { ...DEFAULT_DEV_CONTROLS, empty: true };
    const page = (await (await fetch(`${BASE}/employees`, { headers })).json()) as Page<Employee>;
    expect(page.total).toBe(0);
  });

  it('saves changes and resets to the seed', async () => {
    const headers = await login('manager');
    await fetch(`${BASE}/shifts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        employeeId: null,
        teamId: 'team-ams-floor',
        locationId: 'loc-ams',
        date: TODAY,
        start: '10:00',
        end: '12:00',
        breakMinutes: 0,
        status: 'draft',
        note: '',
      }),
    });
    const count = db.state.shifts.length;
    await fetch(`${BASE}/dev/reset`, { method: 'POST' });
    expect(db.state.shifts.length).toBeLessThan(count);
  });
});
