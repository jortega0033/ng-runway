import type { EmployeeQuery, UserRole } from '@core/api/models';
import type { TableSort } from '@ui/table/table';

/** Sort keys the employees endpoint understands. Anything else in the URL is ignored. */
export const SORT_KEYS = ['name', 'jobTitle', 'team', 'hours'] as const;
export const PAGE_SIZES: readonly number[] = [10, 20, 50];
export const DEFAULT_PAGE_SIZE = 10;

/** Everything the list page shows, and everything that ends up in its URL. */
export interface EmployeeListState {
  q: string;
  teamId: string;
  locationId: string;
  role: UserRole | '';
  page: number;
  pageSize: number;
  sort: TableSort | null;
}

export const DEFAULT_LIST_STATE: EmployeeListState = {
  q: '',
  teamId: '',
  locationId: '',
  role: '',
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  sort: null,
};

interface ParamReader {
  get(name: string): string | null;
}

function positiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : fallback;
}

/** Reads the query string into a state. Bad or unknown values fall back to the defaults. */
export function parseListState(params: ParamReader): EmployeeListState {
  const sortKey = params.get('sort');
  const dir = params.get('dir');
  const role = params.get('role');
  const pageSize = positiveInt(params.get('pageSize'), DEFAULT_PAGE_SIZE);
  return {
    q: params.get('q') ?? '',
    teamId: params.get('team') ?? '',
    locationId: params.get('location') ?? '',
    role: role === 'admin' || role === 'manager' || role === 'employee' ? role : '',
    page: positiveInt(params.get('page'), 1),
    pageSize: PAGE_SIZES.includes(pageSize) ? pageSize : DEFAULT_PAGE_SIZE,
    sort:
      sortKey && (SORT_KEYS as readonly string[]).includes(sortKey)
        ? { key: sortKey, direction: dir === 'desc' ? 'desc' : 'asc' }
        : null,
  };
}

/** Query params for the router. Defaults are left out so the URL stays short; `null` clears a param. */
export function listStateToParams(state: EmployeeListState): Record<string, string | null> {
  return {
    q: state.q || null,
    team: state.teamId || null,
    location: state.locationId || null,
    role: state.role || null,
    page: state.page > 1 ? String(state.page) : null,
    pageSize: state.pageSize !== DEFAULT_PAGE_SIZE ? String(state.pageSize) : null,
    sort: state.sort?.key ?? null,
    dir: state.sort?.direction ?? null,
  };
}

export function toEmployeeQuery(state: EmployeeListState): EmployeeQuery {
  return {
    q: state.q,
    teamId: state.teamId,
    locationId: state.locationId,
    userRole: state.role,
    page: state.page,
    pageSize: state.pageSize,
    sort: state.sort?.key,
    dir: state.sort?.direction,
  };
}

export function hasActiveFilters(state: EmployeeListState): boolean {
  return state.q !== '' || state.teamId !== '' || state.locationId !== '' || state.role !== '';
}
