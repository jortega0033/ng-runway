import { delay, http, HttpResponse, type HttpHandler, type PathParams } from 'msw';
import type { Employee, LoginResponse, SessionUser, UserRole } from '../api/models';
import type { MockDb } from './db';
import type { DevControls } from './dev-controls';
import { MOCK_FEATURES, type HandlerKit } from './features';

export const TOKEN_PREFIX = 'mock-token-';

export interface HandlerOptions {
  /** Prefix of every route, for example `/api` or `https://host/app/api`. */
  baseUrl: string;
  db: MockDb;
  /** Read on every request, so the dev toolbar can change it live. */
  controls: () => DevControls;
}

const error = (status: number, message: string, code?: string) =>
  HttpResponse.json({ message, code }, { status });

const fullName = (e: Employee) => `${e.firstName} ${e.lastName}`;

function toSessionUser(e: Employee): SessionUser {
  return { id: e.id, name: fullName(e), email: e.email, role: e.userRole };
}

/** All mock routes. The same list runs in the browser worker and in unit tests (`msw/node`). */
export function createHandlers({ baseUrl, db, controls }: HandlerOptions): HttpHandler[] {
  const url = (path: string) => `${baseUrl}${path}`;
  const state = () => db.state;

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
