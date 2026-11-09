// File templates for `npm run gen:feature`, part 3: the spec files.
// The generated specs avoid backticks and dollar-braces, so you will not see escapes here.
// They run the REAL mock handlers through `useMockApi()` (MSW in Node), so they test the same
// contract the browser uses.

/** Returns `{ path, content }` entries; paths are relative to the feature folder. */
export function specTemplates(n) {
  return [
    { path: `${n.plural}.api.spec.ts`, content: apiSpecTemplate(n) },
    { path: `${n.plural}.form.spec.ts`, content: formSpecTemplate(n) },
    { path: `${n.plural}.i18n.spec.ts`, content: i18nSpecTemplate(n) },
    { path: `pages/${n.singular}-list.page.spec.ts`, content: listSpecTemplate(n) },
    { path: `pages/${n.singular}-detail.page.spec.ts`, content: detailSpecTemplate(n) },
    { path: `pages/${n.singular}-form.page.spec.ts`, content: formPageSpecTemplate(n) },
  ];
}

// ---------------------------------------------------------------------------------------------
// API + mock handlers
// ---------------------------------------------------------------------------------------------
export function apiSpecTemplate(n) {
  const S = n.pascalSingular;
  return `import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import type { UserRole } from '@core/api/models';
import { useMockApi } from '../../testing/msw-test-server';
import { ${n.pascal}Api } from './${n.plural}.api';
import type { ${S}, ${S}Input } from './${n.plural}.model';

const INPUT: ${S}Input = {
  name: 'Spring uniform restock',
  status: 'draft',
  owner: 'Anna de Vries',
  amount: 125.5,
};

describe('${n.pascal}Api against the mock backend', () => {
  const mock = useMockApi();
  let api: ${n.pascal}Api;

  /** Signs in as \`role\` (or nobody) and creates the service. */
  function setup(role?: UserRole): void {
    if (role) mock.signIn(role);
    TestBed.configureTestingModule({ providers: mock.providers() });
    api = TestBed.inject(${n.pascal}Api);
  }

  const seeded = () => mock.db.state.collections['${n.plural}'] as ${S}[];
  const status = async (request: Promise<unknown>): Promise<number> => {
    try {
      await request;
      return 200;
    } catch (error) {
      return error instanceof HttpErrorResponse ? error.status : -1;
    }
  };

  describe('as a manager', () => {
    beforeEach(() => setup('manager'));

    it('is seeded with 30 rows and answers the first page', async () => {
      const page = await firstValueFrom(api.list());
      expect(seeded()).toHaveLength(30);
      expect(page.total).toBe(30);
      expect(page.page).toBe(1);
      expect(page.items).toHaveLength(10);
    });

    it('pages with page and pageSize', async () => {
      const first = await firstValueFrom(api.list({ page: 1, pageSize: 10 }));
      const second = await firstValueFrom(api.list({ page: 2, pageSize: 10 }));
      expect(second.page).toBe(2);
      expect(second.items).toHaveLength(10);
      expect(second.items[0]?.id).not.toBe(first.items[0]?.id);
    });

    it('filters by status', async () => {
      const expected = seeded().filter((row) => row.status === 'active').length;
      const page = await firstValueFrom(api.list({ status: 'active', pageSize: 50 }));
      expect(page.total).toBe(expected);
      expect(page.items.every((row) => row.status === 'active')).toBe(true);
    });

    it('searches name and owner, ignoring case', async () => {
      const target = seeded()[4];
      const page = await firstValueFrom(api.list({ q: target?.owner.toUpperCase(), pageSize: 50 }));
      expect(page.items.map((row) => row.id)).toContain(target?.id);
      expect(page.total).toBeLessThan(30);
    });

    it('sorts by amount in both directions', async () => {
      const desc = await firstValueFrom(
        api.list({ sort: 'amount', dir: 'desc', pageSize: 50 }),
      );
      const amounts = desc.items.map((row) => row.amount);
      expect(amounts).toEqual([...amounts].sort((a, b) => b - a));
      const asc = await firstValueFrom(api.list({ sort: 'amount', dir: 'asc', pageSize: 50 }));
      expect(asc.items[0]?.amount).toBe(Math.min(...amounts));
    });

    it('reads one ${n.lowerSingular} and answers 404 for an unknown id', async () => {
      const row = seeded()[0];
      expect(await firstValueFrom(api.get(row?.id ?? ''))).toEqual(row);
      expect(await status(firstValueFrom(api.get('${n.singular}-missing')))).toBe(404);
    });

    it('creates, updates and deletes', async () => {
      const created = await firstValueFrom(api.create(INPUT));
      expect(created.id).toMatch(/^${n.singular}-/);
      expect(created.createdAt).toMatch(/^\\d{4}-\\d{2}-\\d{2}$/);
      expect(seeded()).toHaveLength(31);

      const updated = await firstValueFrom(
        api.update(created.id, { ...INPUT, status: 'active', amount: 99 }),
      );
      expect(updated).toMatchObject({ id: created.id, status: 'active', amount: 99 });
      expect(updated.createdAt).toBe(created.createdAt);

      await firstValueFrom(api.remove(created.id));
      expect(seeded()).toHaveLength(30);
      expect(await status(firstValueFrom(api.get(created.id)))).toBe(404);
    });

    it('rejects a body that does not pass validation', async () => {
      expect(await status(firstValueFrom(api.create({ ...INPUT, name: 'x' })))).toBe(400);
      expect(await status(firstValueFrom(api.create({ ...INPUT, amount: -1 })))).toBe(400);
      expect(seeded()).toHaveLength(30);
    });

    it('answers 404 when updating or deleting something that is not there', async () => {
      expect(await status(firstValueFrom(api.update('${n.singular}-missing', INPUT)))).toBe(404);
      expect(await status(firstValueFrom(api.remove('${n.singular}-missing')))).toBe(404);
    });
  });

  describe('as an employee', () => {
    beforeEach(() => setup('employee'));

    it('can read but not write', async () => {
      expect((await firstValueFrom(api.list())).total).toBe(30);
      expect(await status(firstValueFrom(api.create(INPUT)))).toBe(403);
      const id = seeded()[0]?.id ?? '';
      expect(await status(firstValueFrom(api.update(id, INPUT)))).toBe(403);
      expect(await status(firstValueFrom(api.remove(id)))).toBe(403);
      expect(seeded()).toHaveLength(30);
    });
  });

  it('answers 401 when nobody is signed in', async () => {
    setup();
    expect(await status(firstValueFrom(api.list()))).toBe(401);
  });
});
`;
}

// ---------------------------------------------------------------------------------------------
// Form rules (pure) and the Signal Forms schema
// ---------------------------------------------------------------------------------------------
export function formSpecTemplate(n) {
  const S = n.pascalSingular;
  return `import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import {
  MAX_AMOUNT,
  amountRule,
  empty${S}Form,
  ${n.camelSingular}Schema,
  parseAmount,
  to${S}FormModel,
  to${S}Input,
  type ${S}FormModel,
} from './${n.plural}.form';

const VALID: ${S}FormModel = {
  name: 'Spring uniform restock',
  owner: 'Anna de Vries',
  status: 'active',
  amount: '125,50',
};

/** Builds the real Signal Form around a model, the way the form page does. */
function makeForm(model: ${S}FormModel) {
  return TestBed.runInInjectionContext(() => form(signal(model), ${n.camelSingular}Schema));
}

describe('${n.camelSingular} form rules', () => {
  it('reads amounts with a dot or a comma and rejects everything else', () => {
    expect(parseAmount('125.5')).toBe(125.5);
    expect(parseAmount(' 125,50 ')).toBe(125.5);
    expect(parseAmount('0')).toBe(0);
    expect(parseAmount('abc')).toBeNaN();
    expect(parseAmount('-4')).toBeNaN();
    expect(parseAmount('1.2.3')).toBeNaN();
    expect(parseAmount('')).toBeNaN();
  });

  it('checks the amount', () => {
    expect(amountRule('')).toBe('required');
    expect(amountRule('lots')).toBe('number');
    expect(amountRule(String(MAX_AMOUNT + 1))).toBe('range');
    expect(amountRule('125,50')).toBeNull();
  });

  it('maps between the API shape and the form model', () => {
    expect(to${S}Input(VALID)).toEqual({
      name: 'Spring uniform restock',
      owner: 'Anna de Vries',
      status: 'active',
      amount: 125.5,
    });
    const input = to${S}Input({ ...VALID, name: '  Padded  ', owner: ' Sara ' });
    expect(input.name).toBe('Padded');
    expect(input.owner).toBe('Sara');
    expect(
      to${S}FormModel({
        id: '${n.singular}-1',
        createdAt: '2026-11-09',
        name: 'A',
        owner: 'B',
        status: 'draft',
        amount: 10,
      }),
    ).toEqual({ name: 'A', owner: 'B', status: 'draft', amount: '10' });
  });
});

describe('${n.camelSingular} form validation (Signal Forms)', () => {
  const kinds = (errors: readonly { kind: string }[]) => errors.map((error) => error.kind);

  it('is invalid when empty and names every missing field', () => {
    const f = makeForm(empty${S}Form());
    expect(f().valid()).toBe(false);
    expect(kinds(f.name().errors())).toContain('required');
    expect(kinds(f.owner().errors())).toContain('required');
    expect(kinds(f.amount().errors())).toEqual(['required']);
  });

  it('wants at least 2 characters in the name', () => {
    const f = makeForm({ ...VALID, name: 'A' });
    expect(kinds(f.name().errors())).toEqual(['minLength']);
  });

  it('reports a bad amount on the amount field only', () => {
    const f = makeForm({ ...VALID, amount: 'abc' });
    expect(kinds(f.amount().errors())).toEqual(['number']);
    expect(f.name().errors()).toHaveLength(0);
    expect(f().valid()).toBe(false);
  });

  it('is valid with good values and reacts to edits', () => {
    const model = signal<${S}FormModel>({ ...VALID, amount: '' });
    const f = TestBed.runInInjectionContext(() => form(model, ${n.camelSingular}Schema));
    expect(f().valid()).toBe(false);
    model.update((value) => ({ ...value, amount: '99' }));
    expect(f().valid()).toBe(true);
  });
});
`;
}

// ---------------------------------------------------------------------------------------------
// English and Dutch files must have the same keys
// ---------------------------------------------------------------------------------------------
export function i18nSpecTemplate(n) {
  return `import en from '../../../../public/i18n/${n.plural}/en.json';
import nl from '../../../../public/i18n/${n.plural}/nl.json';
import globalEn from '../../../../public/i18n/en.json';
import globalNl from '../../../../public/i18n/nl.json';

/** "list.columns.name" style paths of every text in a nested object. */
function paths(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    paths(child, prefix ? prefix + '.' + key : key),
  );
}

function texts(value: unknown, prefix = ''): [string, string][] {
  if (typeof value === 'string') return [[prefix, value]];
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) =>
    texts(child, prefix ? prefix + '.' + key : key),
  );
}

/** The {{ placeholders }} a text uses, so we can check both languages fill the same ones. */
const placeholders = (text: string) => (text.match(/{{\\s*\\w+\\s*}}/g) ?? []).sort();

describe('${n.plural} i18n files', () => {
  it('has the same keys in English and Dutch', () => {
    expect(paths(nl).sort()).toEqual(paths(en).sort());
  });

  it('has no empty texts and uses the same placeholders in both languages', () => {
    const dutch = new Map(texts(nl));
    for (const [key, text] of texts(en)) {
      expect(text.trim(), key).not.toBe('');
      expect(placeholders(dutch.get(key) ?? ''), key).toEqual(placeholders(text));
    }
  });

  it('has a sidebar label in the global files', () => {
    expect(globalEn.nav).toHaveProperty('${n.camel}');
    expect(globalNl.nav).toHaveProperty('${n.camel}');
  });
});
`;
}

// ---------------------------------------------------------------------------------------------
// Shared test helpers for the page specs (written into each spec, so every file stands alone)
// ---------------------------------------------------------------------------------------------
const PAGE_SPEC_HELPERS = `
const button = (root: ParentNode, text: string) =>
  Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
    b.textContent?.trim().includes(text),
  );
`;

// ---------------------------------------------------------------------------------------------
// List page
// ---------------------------------------------------------------------------------------------
export function listSpecTemplate(n) {
  const S = n.pascalSingular;
  return `import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideTranslocoScope } from '@jsverse/transloco';
import { API_BASE_URL } from '@core/api/api-config';
import type { Page } from '@core/api/models';
import { provideTestTransloco } from '../../../testing/transloco-testing';
import { useMockApi } from '../../../testing/msw-test-server';
import ${n.camel}En from '../../../../../public/i18n/${n.plural}/en.json';
import type { ${S} } from '../${n.plural}.model';
import { SEARCH_DEBOUNCE_MS, ${S}ListPage } from './${n.singular}-list.page';

@Component({ template: 'stub' })
class StubPage {}

const ROUTES = [
  { path: '${n.plural}', component: ${S}ListPage },
  { path: '${n.plural}/new', component: StubPage },
  { path: '${n.plural}/:id', component: StubPage },
];
${PAGE_SPEC_HELPERS}
/**
 * Real data rows of the table: not the header, not the loading skeleton rows and not the
 * "nothing found" row.
 */
const dataRows = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>('[role=row]'))
    .slice(1)
    .filter((row) => !row.querySelector('ui-skeleton, [aria-colspan]'));

describe('${S}ListPage with the mock backend', () => {
  const mock = useMockApi();
  const seeded = () => mock.db.state.collections['${n.plural}'] as ${S}[];

  async function open(role: 'manager' | 'employee' = 'manager') {
    mock.signIn(role);
    TestBed.configureTestingModule({
      providers: [
        provideRouter(ROUTES),
        ...mock.providers({ '${n.plural}': ${n.camel}En }),
        provideTranslocoScope('${n.plural}'),
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/${n.plural}');
    const root = harness.routeNativeElement as HTMLElement;
    /** Re-checks until the page shows what you expect (the mock answers asynchronously). */
    const settle = (assertion: () => void) =>
      vi.waitFor(
        () => {
          harness.detectChanges();
          assertion();
        },
        { timeout: 3000 },
      );
    return { harness, root, settle };
  }

  it('shows the heading, a loading state and then the first page of rows', async () => {
    const { harness, root, settle } = await open();
    harness.detectChanges();
    expect(root.querySelector('h1')?.textContent).toContain('${n.title}');
    expect(root.querySelector('[role=table]')?.getAttribute('aria-busy')).toBe('true');

    await settle(() => expect(dataRows(root)).toHaveLength(10));
    expect(root.querySelector('[role=table]')?.getAttribute('aria-busy')).not.toBe('true');
    expect(root.textContent).toContain(seeded()[0]?.name);
  });

  it('shows the add button to managers but not to employees', async () => {
    const manager = await open('manager');
    await manager.settle(() => expect(button(manager.root, 'New ${n.lowerSingular}')).toBeDefined());
    TestBed.resetTestingModule();

    const employee = await open('employee');
    await employee.settle(() => expect(dataRows(employee.root)).toHaveLength(10));
    expect(button(employee.root, 'New ${n.lowerSingular}')).toBeUndefined();
  });

  it('asks the server for the next page', async () => {
    const { root, settle } = await open();
    await settle(() => expect(dataRows(root)).toHaveLength(10));
    root.querySelector<HTMLButtonElement>('button[aria-label="Next page"]')?.click();
    await settle(() => expect(root.textContent).toContain(seeded()[10]?.name));
    expect(root.textContent).not.toContain(seeded()[0]?.name);
  });

  it('sorts on the server when a column header is clicked', async () => {
    const { root, settle } = await open();
    await settle(() => expect(dataRows(root)).toHaveLength(10));
    const header = Array.from(
      root.querySelectorAll<HTMLButtonElement>('[role=columnheader] button'),
    ).find((b) => b.textContent?.includes('Name'));
    header?.click();
    const first = [...seeded()].sort((a, b) => a.name.localeCompare(b.name))[0]?.name ?? '';
    await settle(() => expect(dataRows(root)[0]?.textContent).toContain(first));
  });

  it('filters by status and goes back to page 1', async () => {
    const { root, settle } = await open();
    await settle(() => expect(dataRows(root)).toHaveLength(10));
    const select = Array.from(root.querySelectorAll<HTMLSelectElement>('ui-select select')).find(
      (s) => Array.from(s.options).some((o) => o.textContent?.includes('All statuses')),
    );
    expect(select).toBeDefined();
    select!.value = 'archived';
    select!.dispatchEvent(new Event('change'));

    const archived = seeded().filter((row) => row.status === 'archived').length;
    await settle(() => expect(dataRows(root)).toHaveLength(Math.min(10, archived)));
    for (const row of dataRows(root)) expect(row.textContent).toContain('Archived');
  });

  it('searches after the user stops typing and offers a way back when nothing matches', async () => {
    const { root, settle } = await open();
    await settle(() => expect(dataRows(root)).toHaveLength(10));
    const input = root.querySelector<HTMLInputElement>('input[type=search]')!;
    const type = (text: string) => {
      input.value = text;
      input.dispatchEvent(new Event('input'));
    };

    const owner = seeded()[7]?.owner ?? '';
    type(owner);
    await settle(() => expect(dataRows(root)[0]?.textContent).toContain(owner));
    expect(dataRows(root).length).toBeLessThan(10);
    expect(SEARCH_DEBOUNCE_MS).toBeGreaterThan(0);

    type('zzzzqq');
    await settle(() => expect(root.textContent).toContain('No ${n.lower} found'));
    expect(dataRows(root)).toHaveLength(0);

    button(root, 'Clear filters')?.click();
    await settle(() => expect(dataRows(root)).toHaveLength(10));
  });

  it('shows an empty state when there is no data at all', async () => {
    mock.db.state.collections['${n.plural}'] = [];
    const { root, settle } = await open();
    await settle(() => expect(root.textContent).toContain('No ${n.lower} yet'));
  });

  it('opens the ${n.lowerSingular} when a row is clicked', async () => {
    const { root, settle } = await open();
    await settle(() => expect(dataRows(root)).toHaveLength(10));
    dataRows(root)[0]?.click();
    await vi.waitFor(() =>
      expect(TestBed.inject(Router).url).toBe('/${n.plural}/' + seeded()[0]?.id),
    );
  });
});

describe('${S}ListPage when the server fails', () => {
  const BASE = 'http://localhost/api';
  const page = (items: ${S}[]): Page<${S}> => ({ items, total: items.length, page: 1, pageSize: 10 });
  const row: ${S} = {
    id: '${n.singular}-1',
    name: 'Spring uniform restock',
    status: 'active',
    owner: 'Anna de Vries',
    amount: 125.5,
    createdAt: '2026-11-01',
  };

  it('shows an error with a retry that asks again', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(ROUTES),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
        provideTestTransloco({ '${n.plural}': ${n.camel}En }),
        provideTranslocoScope('${n.plural}'),
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/${n.plural}');
    const root = harness.routeNativeElement as HTMLElement;
    harness.detectChanges();

    http
      .expectOne((r) => r.url === BASE + '/${n.plural}')
      .flush({ message: 'Boom' }, { status: 500, statusText: 'Server Error' });
    harness.detectChanges();
    expect(root.querySelector('[role=alert]')?.textContent).toContain('Could not load this');

    button(root, 'Try again')?.click();
    harness.detectChanges();
    http.expectOne((r) => r.url === BASE + '/${n.plural}').flush(page([row]));
    harness.detectChanges();
    expect(root.textContent).toContain('Spring uniform restock');
    expect(root.querySelector('[role=alert]')).toBeNull();
  });
});
`;
}

// ---------------------------------------------------------------------------------------------
// Detail page
// ---------------------------------------------------------------------------------------------
export function detailSpecTemplate(n) {
  const S = n.pascalSingular;
  return `import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideTranslocoScope } from '@jsverse/transloco';
import { useMockApi } from '../../../testing/msw-test-server';
import ${n.camel}En from '../../../../../public/i18n/${n.plural}/en.json';
import type { ${S} } from '../${n.plural}.model';
import { ${S}DetailPage } from './${n.singular}-detail.page';

@Component({ template: 'stub' })
class StubPage {}
${PAGE_SPEC_HELPERS}
describe('${S}DetailPage with the mock backend', () => {
  const mock = useMockApi();
  const first = () => (mock.db.state.collections['${n.plural}'] as ${S}[])[0]!;

  async function open(id: string, role: 'manager' | 'employee' = 'manager') {
    mock.signIn(role);
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            { path: '${n.plural}', component: StubPage },
            { path: '${n.plural}/:id', component: ${S}DetailPage },
            { path: '${n.plural}/:id/edit', component: StubPage },
          ],
          withComponentInputBinding(),
        ),
        ...mock.providers({ '${n.plural}': ${n.camel}En }),
        provideTranslocoScope('${n.plural}'),
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/${n.plural}/' + id);
    const root = harness.routeNativeElement as HTMLElement;
    const settle = (assertion: () => void) =>
      vi.waitFor(
        () => {
          harness.detectChanges();
          assertion();
        },
        { timeout: 3000 },
      );
    return { harness, root, settle };
  }

  it('shows the details of the ${n.lowerSingular}', async () => {
    const item = first();
    const { root, settle } = await open(item.id);
    await settle(() => expect(root.querySelector('h1')?.textContent).toContain(item.name));
    expect(root.textContent).toContain(item.owner);
    expect(root.querySelector('dl')?.textContent).toContain('Created on');
  });

  it('shows Edit and Delete to a manager, and Edit opens the form route', async () => {
    const { root, settle } = await open(first().id);
    await settle(() => expect(button(root, 'Edit')).toBeDefined());
    expect(button(root, 'Delete')).toBeDefined();
    button(root, 'Edit')?.click();
    await vi.waitFor(() =>
      expect(TestBed.inject(Router).url).toBe('/${n.plural}/' + first().id + '/edit'),
    );
  });

  it('hides Edit and Delete from an employee', async () => {
    const { root, settle } = await open(first().id, 'employee');
    await settle(() => expect(root.querySelector('h1')?.textContent).toContain(first().name));
    expect(button(root, 'Edit')).toBeUndefined();
    expect(button(root, 'Delete')).toBeUndefined();
  });

  it('deletes after the user confirms', async () => {
    const item = first();
    const { root, settle } = await open(item.id);
    await settle(() => expect(button(root, 'Delete')).toBeDefined());
    button(root, 'Delete')?.click();

    // The confirmation opens in an overlay outside the page element.
    const overlay = () => document.body.querySelector<HTMLElement>('.cdk-overlay-container')!;
    await vi.waitFor(() => expect(button(overlay(), 'Delete')).toBeDefined(), { timeout: 3000 });
    button(overlay(), 'Delete')?.click();

    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/${n.plural}'), { timeout: 3000 });
    const rows = mock.db.state.collections['${n.plural}'] as ${S}[];
    expect(rows.some((row) => row.id === item.id)).toBe(false);
  });

  it('shows an error with a way back for an unknown id', async () => {
    const { root, settle } = await open('${n.singular}-missing');
    await settle(() => expect(root.querySelector('[role=alert]')?.textContent).toContain('Could not load'));
    expect(button(root, 'Try again')).toBeDefined();
    expect(button(root, 'Back to ${n.lower}')).toBeDefined();
  });
});
`;
}

// ---------------------------------------------------------------------------------------------
// Form page: create flow and validation on screen
// ---------------------------------------------------------------------------------------------
export function formPageSpecTemplate(n) {
  const S = n.pascalSingular;
  return `import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideTranslocoScope } from '@jsverse/transloco';
import { useMockApi } from '../../../testing/msw-test-server';
import ${n.camel}En from '../../../../../public/i18n/${n.plural}/en.json';
import type { ${S} } from '../${n.plural}.model';
import { ${S}FormPage } from './${n.singular}-form.page';

@Component({ template: 'stub' })
class StubPage {}
${PAGE_SPEC_HELPERS}
describe('${S}FormPage with the mock backend', () => {
  const mock = useMockApi();
  const rows = () => mock.db.state.collections['${n.plural}'] as ${S}[];

  async function open(url: string) {
    mock.signIn('manager');
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            { path: '${n.plural}/new', component: ${S}FormPage },
            { path: '${n.plural}/:id/edit', component: ${S}FormPage },
            { path: '${n.plural}/:id', component: StubPage },
          ],
          withComponentInputBinding(),
        ),
        ...mock.providers({ '${n.plural}': ${n.camel}En }),
        provideTranslocoScope('${n.plural}'),
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    const root = harness.routeNativeElement as HTMLElement;
    const settle = (assertion: () => void) =>
      vi.waitFor(
        () => {
          harness.detectChanges();
          assertion();
        },
        { timeout: 3000 },
      );
    const fill = (input: HTMLInputElement, text: string) => {
      input.value = text;
      input.dispatchEvent(new Event('input'));
      harness.detectChanges();
    };
    return { harness, root, settle, fill };
  }

  it('shows the field errors and saves nothing when the form is empty', async () => {
    const { root, settle } = await open('/${n.plural}/new');
    await settle(() => expect(root.querySelector('form')).not.toBeNull());
    button(root, 'Save')?.click();
    await settle(() => expect(root.textContent).toContain('Check the form'));
    expect(root.textContent).toContain('This field is required.');
    expect(rows()).toHaveLength(30);
  });

  it('creates a ${n.lowerSingular} and opens it', async () => {
    const { root, settle, fill } = await open('/${n.plural}/new');
    await settle(() => expect(root.querySelector('form')).not.toBeNull());
    const [name, owner, amount] = Array.from(root.querySelectorAll<HTMLInputElement>('input'));
    fill(name!, 'Spring uniform restock');
    fill(owner!, 'Anna de Vries');
    fill(amount!, '125,50');
    const status = root.querySelector<HTMLSelectElement>('select')!;
    status.value = 'active';
    status.dispatchEvent(new Event('change'));

    button(root, 'Save')?.click();
    await vi.waitFor(() => expect(rows()).toHaveLength(31), { timeout: 3000 });
    const created = rows().at(-1);
    expect(created).toMatchObject({
      name: 'Spring uniform restock',
      owner: 'Anna de Vries',
      status: 'active',
      amount: 125.5,
    });
    await vi.waitFor(() =>
      expect(TestBed.inject(Router).url).toBe('/${n.plural}/' + created?.id),
    );
  });

  it('loads an existing ${n.lowerSingular} into the form and saves the change', async () => {
    const item = rows()[0]!;
    const { root, settle, fill } = await open('/${n.plural}/' + item.id + '/edit');
    await settle(() =>
      expect(root.querySelector<HTMLInputElement>('input')?.value).toBe(item.name),
    );
    fill(root.querySelector<HTMLInputElement>('input')!, 'Renamed on purpose');
    button(root, 'Save')?.click();
    await vi.waitFor(() => expect(rows()[0]?.name).toBe('Renamed on purpose'), { timeout: 3000 });
    expect(rows()).toHaveLength(30);
  });
});
`;
}
