import type { HttpHandler } from 'msw';
import type { Employee, UserRole } from '../api/models';
import type { Db } from './db';
// gen:feature:imports:start
// gen:feature:imports:end

/** The small toolbox that `createHandlers` hands to every feature's mock routes. */
export interface HandlerKit {
  /** Full URL for a path, for example `url('/orders')`. */
  url: (path: string) => string;
  /**
   * Wraps a handler with the dev toolbar (slow / errors), the sign-in check and optional roles.
   * `work` gets the request, route params, the signed-in user and the parsed URL.
   */
  route: <P extends Record<string, string | readonly string[]>>(
    work: (ctx: {
      request: Request;
      params: P;
      user: Employee;
      url: URL;
    }) => Response | Promise<Response>,
    options?: { roles?: UserRole[]; public?: boolean },
  ) => (info: {
    request: Request;
    params: Record<string, string | readonly string[] | undefined>;
  }) => Promise<Response>;
  /** The in-memory database. Your data lives in `state().collections[<collection>]`. */
  state: () => Db;
  /** Persist after every write so a reload keeps the change. */
  save: () => void;
}

/** One generated feature's mock backend: its seed rows and its routes. */
export interface MockFeature {
  /** Key in `Db.collections`. */
  collection: string;
  seed: () => unknown[];
  handlers: (kit: HandlerKit) => HttpHandler[];
}

/**
 * Registry of generated features. `npm run gen:feature <name>` adds a line to the array below
 * (between the markers). Delete a line to remove a feature's mock API.
 */
export const MOCK_FEATURES: readonly MockFeature[] = [
  // gen:feature:list:start
  // gen:feature:list:end
];
