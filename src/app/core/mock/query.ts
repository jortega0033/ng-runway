import type { ListQuery, Page, SortDirection } from '../api/models';

/** Case-insensitive "all words appear somewhere" search over a few text fields. */
export function matchesSearch(q: string | undefined, ...fields: (string | undefined)[]): boolean {
  const words = (q ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = fields.join(' ').toLowerCase();
  return words.every((w) => haystack.includes(w));
}

export function sortItems<T>(
  items: readonly T[],
  sort: string | undefined,
  dir: SortDirection | undefined,
  accessors: Record<string, (item: T) => string | number>,
): T[] {
  const get = sort ? accessors[sort] : undefined;
  if (!get) return [...items];
  const sign = dir === 'desc' ? -1 : 1;
  return [...items].sort((a, b) => {
    const x = get(a);
    const y = get(b);
    if (typeof x === 'number' && typeof y === 'number') return (x - y) * sign;
    return String(x).localeCompare(String(y)) * sign;
  });
}

export function paginate<T>(
  items: readonly T[],
  query: Pick<ListQuery, 'page' | 'pageSize'>,
): Page<T> {
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 10));
  const lastPage = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(lastPage, Math.max(1, query.page ?? 1));
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    total: items.length,
    page,
    pageSize,
  };
}

/** Reads a `?page=2&sort=name` style query string into a typed object. */
export function readListQuery(url: URL): ListQuery {
  const p = url.searchParams;
  const dir = p.get('dir');
  return {
    page: p.has('page') ? Number(p.get('page')) : undefined,
    pageSize: p.has('pageSize') ? Number(p.get('pageSize')) : undefined,
    sort: p.get('sort') ?? undefined,
    dir: dir === 'asc' || dir === 'desc' ? dir : undefined,
    q: p.get('q') ?? undefined,
  };
}
