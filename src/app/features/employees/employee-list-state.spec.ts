import { convertToParamMap } from '@angular/router';
import {
  DEFAULT_LIST_STATE,
  hasActiveFilters,
  listStateToParams,
  parseListState,
  toEmployeeQuery,
} from './employee-list-state';
import { formatDate, formatDay, formatEuro, percentOf } from './format';

describe('employee list state', () => {
  it('uses the defaults for an empty query string', () => {
    expect(parseListState(convertToParamMap({}))).toEqual(DEFAULT_LIST_STATE);
  });

  it('reads filters, paging and sort from the URL', () => {
    const state = parseListState(
      convertToParamMap({
        q: 'sara',
        team: 'team-a',
        location: 'loc-ams',
        role: 'manager',
        page: '3',
        pageSize: '20',
        sort: 'hours',
        dir: 'desc',
      }),
    );
    expect(state).toEqual({
      q: 'sara',
      teamId: 'team-a',
      locationId: 'loc-ams',
      role: 'manager',
      page: 3,
      pageSize: 20,
      sort: { key: 'hours', direction: 'desc' },
    });
  });

  it('ignores values the endpoint would not understand', () => {
    const state = parseListState(
      convertToParamMap({ role: 'owner', page: '-2', pageSize: '7', sort: 'salary', dir: 'up' }),
    );
    expect(state.role).toBe('');
    expect(state.page).toBe(1);
    expect(state.pageSize).toBe(10);
    expect(state.sort).toBeNull();
  });

  it('writes a short URL: defaults become null so the router removes them', () => {
    expect(listStateToParams(DEFAULT_LIST_STATE)).toEqual({
      q: null,
      team: null,
      location: null,
      role: null,
      page: null,
      pageSize: null,
      sort: null,
      dir: null,
    });
    expect(
      listStateToParams({
        ...DEFAULT_LIST_STATE,
        q: 'a',
        page: 2,
        sort: { key: 'name', direction: 'asc' },
      }),
    ).toMatchObject({ q: 'a', page: '2', sort: 'name', dir: 'asc' });
  });

  it('maps the state to the API query', () => {
    expect(
      toEmployeeQuery({
        ...DEFAULT_LIST_STATE,
        teamId: 'team-a',
        sort: { key: 'team', direction: 'desc' },
      }),
    ).toMatchObject({ teamId: 'team-a', page: 1, pageSize: 10, sort: 'team', dir: 'desc' });
  });

  it('tells whether any filter is on (paging and sort are not filters)', () => {
    expect(hasActiveFilters(DEFAULT_LIST_STATE)).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_LIST_STATE, page: 4, pageSize: 50 })).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_LIST_STATE, role: 'admin' })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_LIST_STATE, q: 'x' })).toBe(true);
  });
});

describe('format helpers', () => {
  it('formats ISO dates in the given locale without time zone shifts', () => {
    expect(formatDate('2026-11-09', 'en')).toBe('Nov 9, 2026');
    expect(formatDay('2026-11-09', 'en')).toBe('Mon, Nov 9');
    expect(formatDate('', 'en')).toBe('');
  });

  it('formats euros from cents', () => {
    expect(formatEuro(1850, 'en')).toContain('18.50');
    expect(formatEuro(1850, 'nl')).toContain('18,50');
  });

  it('clamps percentages', () => {
    expect(percentOf(5, 10)).toBe(50);
    expect(percentOf(15, 10)).toBe(100);
    expect(percentOf(1, 0)).toBe(0);
    expect(percentOf(-3, 10)).toBe(0);
  });
});
