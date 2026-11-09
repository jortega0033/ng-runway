import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import type { EnvironmentProviders, Provider } from '@angular/core';
import { setupServer } from 'msw/node';
import type { Translation } from '@jsverse/transloco';
import { API_BASE_URL } from '@core/api/api-config';
import type { LoginResponse, UserRole } from '@core/api/models';
import { authInterceptor } from '@core/auth/auth.interceptor';
import { SESSION_STORAGE_KEY } from '@core/auth/auth.service';
import { startOfWeek, todayIso } from '@core/domain/time';
import { errorInterceptor } from '@core/http/error.interceptor';
import { MockDb, type DbStorage } from '@core/mock/db';
import { DEFAULT_DEV_CONTROLS } from '@core/mock/dev-controls';
import { TOKEN_PREFIX, createHandlers } from '@core/mock/handlers';
import { createSeed } from '@core/mock/seed';
import { provideTestTransloco } from './transloco-testing';

export const TEST_API_BASE = 'http://localhost/api';

function memoryStorage(): DbStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

/**
 * Runs the real mock handlers (MSW in Node) for a spec file. Call it once at the top of a
 * `describe`. Each test starts with a fresh seeded database and no signed-in user.
 *
 *   const api = useMockApi();
 *   beforeEach(() => api.signIn('manager'));
 *   TestBed.configureTestingModule({ providers: api.providers({ reports: reportsEn }) });
 */
export function useMockApi() {
  const server = setupServer();
  let db: MockDb;

  beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
  afterAll(() => server.close());
  beforeEach(() => {
    localStorage.clear();
    const today = todayIso();
    db = new MockDb(
      () => createSeed(today),
      memoryStorage(),
      () => startOfWeek(today),
    );
    server.resetHandlers(
      ...createHandlers({
        baseUrl: TEST_API_BASE,
        db,
        controls: () => ({ ...DEFAULT_DEV_CONTROLS }),
      }),
    );
  });
  afterEach(() => localStorage.clear());

  return {
    get db(): MockDb {
      return db;
    },
    /** Writes a session to localStorage. Call it before `AuthService` is created. */
    signIn(role: UserRole): LoginResponse {
      const employee = db.state.employees.find((e) => e.userRole === role);
      if (!employee) throw new Error(`No seeded ${role}`);
      const session: LoginResponse = {
        token: `${TOKEN_PREFIX}${employee.id}`,
        user: {
          id: employee.id,
          name: `${employee.firstName} ${employee.lastName}`,
          email: employee.email,
          role: employee.userRole,
          teamId: employee.teamId,
          locationId: employee.locationId,
        },
      };
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      return session;
    },
    /** HttpClient with the app interceptors against the mock, plus English strings. */
    providers(scopes: Record<string, Translation> = {}): (Provider | EnvironmentProviders)[] {
      return [
        provideHttpClient(withFetch(), withInterceptors([authInterceptor, errorInterceptor])),
        { provide: API_BASE_URL, useValue: TEST_API_BASE },
        provideTestTransloco(scopes),
      ];
    },
  };
}
