import { setupServer } from 'msw/node';
import type { LoginResponse } from '../api/models';
import { startOfWeek } from '../domain/time';
import { MockDb, type DbStorage } from './db';
import { DEFAULT_DEV_CONTROLS, type DevControls } from './dev-controls';
import { createHandlers } from './handlers';
import { createSeed } from './seed';

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
    server.resetHandlers(...createHandlers({ baseUrl: BASE, db, controls: () => controls }));
  });

  const login = (role: string) =>
    fetch(`${BASE}/auth/login`, { method: 'POST', body: JSON.stringify({ role }) });

  it('seeds the three demo users, the same every time', () => {
    const a = createSeed(TODAY);
    const b = createSeed(TODAY);
    expect(a.employees.map((e) => e.userRole)).toEqual(['admin', 'manager', 'employee']);
    expect(a.employees.map((e) => e.email)).toEqual(b.employees.map((e) => e.email));
    expect(a.anchorWeek).toBe(TODAY);
  });

  it('signs in as each demo role', async () => {
    for (const role of ['admin', 'manager', 'employee']) {
      const res = await login(role);
      expect(res.status).toBe(200);
      const body = (await res.json()) as LoginResponse;
      expect(body.user.role).toBe(role);
      expect(body.token).toContain(body.user.id);
    }
  });

  it('refuses an unknown role', async () => {
    expect((await login('nobody')).status).toBe(404);
  });

  it('applies the dev toolbar: random errors never hit the dev routes', async () => {
    controls = { ...controls, errorRate: 1 };
    expect((await login('admin')).status).toBe(500);
    expect((await fetch(`${BASE}/dev/reset`, { method: 'POST' })).status).toBe(204);
  });

  it('resets to the seed', async () => {
    db.state.employees.pop();
    expect(db.state.employees).toHaveLength(2);
    await fetch(`${BASE}/dev/reset`, { method: 'POST' });
    expect(db.state.employees).toHaveLength(3);
  });
});
