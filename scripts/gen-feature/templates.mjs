// File templates for `npm run gen:feature`, part 1: model, mock backend, API service, form rules,
// routes and the translation helper. The pages are in templates-pages.mjs, the specs in
// templates-specs.mjs and the i18n texts in templates-i18n.mjs.
//
// How to read a template: it is a function that gets the derived names (see names.mjs) and returns
// the file text. `${n.pascalSingular}` is filled in by the generator ("Order").
//
// Two escapes you will see inside the generated TypeScript:
//   \`   a backtick that belongs to the GENERATED file
//   \${  a dollar-brace that belongs to the GENERATED file
// Without the backslash JavaScript would fill them in while generating.

import { pagesTemplates } from './templates-pages.mjs';
import { i18nTemplate } from './templates-i18n.mjs';
import { specTemplates } from './templates-specs.mjs';

/** Where a generated feature lives, relative to the repo root. */
export const featureDir = (n) => `src/app/features/${n.plural}`;

// ---------------------------------------------------------------------------------------------
// Model: the entity type, its input type and display helpers.
// ---------------------------------------------------------------------------------------------
export function modelTemplate(n) {
  return `import type { ListQuery } from '@core/api/models';

export type ${n.pascalSingular}Status = 'draft' | 'active' | 'archived';
export const ${n.constant}_STATUSES: readonly ${n.pascalSingular}Status[] = [
  'draft',
  'active',
  'archived',
];

/** One ${n.lowerSingular} as the API returns it. */
export interface ${n.pascalSingular} {
  id: string;
  name: string;
  status: ${n.pascalSingular}Status;
  owner: string;
  /** Money amount in euros. */
  amount: number;
  /** Calendar date, \`yyyy-MM-dd\`. Set by the server. */
  createdAt: string;
}

/** What the create / edit form sends. The server adds \`id\` and \`createdAt\`. */
export interface ${n.pascalSingular}Input {
  name: string;
  status: ${n.pascalSingular}Status;
  owner: string;
  amount: number;
}

/** Query string of the list endpoint. */
export interface ${n.pascalSingular}Query extends ListQuery {
  status?: ${n.pascalSingular}Status | '';
}

/** Sort keys the list endpoint understands (they match the table column keys). */
export const ${n.constant}_SORT_KEYS = ['name', 'owner', 'status', 'amount', 'createdAt'] as const;

/** Badge colour per status. */
export const ${n.constant}_STATUS_BADGE = {
  draft: 'neutral',
  active: 'success',
  archived: 'warning',
} as const;

/** "1,234.50" in euros, in the style of the locale (\`en\` or \`nl\`). */
export function formatAmount(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(amount);
}

/** "9 Nov 2026" from an ISO \`yyyy-MM-dd\` date. */
export function formatDate(iso: string, locale: string): string {
  if (!iso) return '';
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
`;
}

// ---------------------------------------------------------------------------------------------
// Mock backend: seed rows plus the five endpoints, served by MSW.
// ---------------------------------------------------------------------------------------------
export function mockTemplate(n) {
  const S = n.pascalSingular;
  return `import { faker } from '@faker-js/faker/locale/en';
import { http, HttpResponse } from 'msw';
import type { Page } from '@core/api/models';
import type { HandlerKit, MockFeature } from '@core/mock/features';
import { matchesSearch, paginate, readListQuery, sortItems } from '@core/mock/query';
import {
  ${n.constant}_STATUSES,
  type ${S},
  type ${S}Input,
} from '../${n.plural}.model';

/** Key in \`Db.collections\`. */
const COLLECTION = '${n.plural}';
/** Fixed seed: every reload (and every test) starts from the same rows. */
const SEED = 42;
const ROW_COUNT = 30;

function seed${n.pascal}(): ${S}[] {
  faker.seed(SEED);
  return Array.from({ length: ROW_COUNT }, (_, index) => ({
    id: \`${n.singular}-\${String(index + 1).padStart(3, '0')}\`,
    name: faker.commerce.productName(),
    status: faker.helpers.arrayElement(${n.constant}_STATUSES),
    owner: faker.person.fullName(),
    amount: faker.number.float({ min: 25, max: 4800, fractionDigits: 2 }),
    createdAt: faker.date.past({ years: 1, refDate: '2026-11-01' }).toISOString().slice(0, 10),
  }));
}

/** Returns an error message when the body cannot be saved, otherwise \`null\`. */
function validate(input: Partial<${S}Input>): string | null {
  if (typeof input.name !== 'string' || input.name.trim().length < 2) {
    return 'Name must have at least 2 characters.';
  }
  if (typeof input.owner !== 'string' || input.owner.trim() === '') return 'Owner is required.';
  if (!${n.constant}_STATUSES.some((status) => status === input.status)) return 'Status is not valid.';
  if (typeof input.amount !== 'number' || !Number.isFinite(input.amount) || input.amount < 0) {
    return 'Amount must be a number of 0 or more.';
  }
  return null;
}

const failure = (status: number, message: string, code: string) =>
  HttpResponse.json({ message, code }, { status });

function ${n.camel}Handlers(kit: HandlerKit) {
  /**
   * The rows. They are created on first use, so a browser that saved its mock data before this
   * feature existed still works.
   */
  const rows = (): ${S}[] => (kit.state().collections[COLLECTION] ??= seed${n.pascal}()) as ${S}[];
  const notFound = () => failure(404, '${n.titleSingular} not found.', 'NOT_FOUND');
  const writers = { roles: ['admin' as const, 'manager' as const] };

  return [
    // List: ?page&pageSize&sort&dir&q&status. Answers with a Page, like the employees endpoint.
    http.get(
      kit.url('/${n.plural}'),
      kit.route(({ url }) => {
        const query = readListQuery(url);
        const status = url.searchParams.get('status');
        const matching = rows().filter(
          (row) =>
            (!status || row.status === status) && matchesSearch(query.q, row.name, row.owner),
        );
        const sorted = sortItems(matching, query.sort, query.dir, {
          name: (row) => row.name,
          owner: (row) => row.owner,
          status: (row) => row.status,
          amount: (row) => row.amount,
          createdAt: (row) => row.createdAt,
        });
        return HttpResponse.json<Page<${S}>>(paginate(sorted, query));
      }),
    ),

    http.get(
      kit.url('/${n.plural}/:id'),
      kit.route<{ id: string }>(({ params }) => {
        const found = rows().find((row) => row.id === params.id);
        return found ? HttpResponse.json(found) : notFound();
      }),
    ),

    // Writes: only admins and managers (the helper answers 403 for everybody else).
    http.post(
      kit.url('/${n.plural}'),
      kit.route(async ({ request }) => {
        const input = (await request.json()) as ${S}Input;
        const problem = validate(input);
        if (problem) return failure(400, problem, 'VALIDATION');
        const created: ${S} = {
          id: \`${n.singular}-\${crypto.randomUUID().slice(0, 8)}\`,
          name: input.name.trim(),
          status: input.status,
          owner: input.owner.trim(),
          amount: input.amount,
          createdAt: new Date().toISOString().slice(0, 10),
        };
        rows().push(created);
        kit.save();
        return HttpResponse.json(created, { status: 201 });
      }, writers),
    ),

    http.put(
      kit.url('/${n.plural}/:id'),
      kit.route<{ id: string }>(async ({ request, params }) => {
        const index = rows().findIndex((row) => row.id === params.id);
        const existing = rows()[index];
        if (!existing) return notFound();
        const input = (await request.json()) as ${S}Input;
        const problem = validate(input);
        if (problem) return failure(400, problem, 'VALIDATION');
        const updated: ${S} = {
          ...existing,
          name: input.name.trim(),
          status: input.status,
          owner: input.owner.trim(),
          amount: input.amount,
        };
        rows()[index] = updated;
        kit.save();
        return HttpResponse.json(updated);
      }, writers),
    ),

    http.delete(
      kit.url('/${n.plural}/:id'),
      kit.route<{ id: string }>(({ params }) => {
        const index = rows().findIndex((row) => row.id === params.id);
        if (index < 0) return notFound();
        rows().splice(index, 1);
        kit.save();
        return new HttpResponse(null, { status: 204 });
      }, writers),
    ),
  ];
}

/** Registered in \`src/app/core/mock/features.ts\`. Delete that line to remove this mock API. */
export const ${n.constant}_MOCK: MockFeature = {
  collection: COLLECTION,
  seed: seed${n.pascal},
  handlers: ${n.camel}Handlers,
};
`;
}

// ---------------------------------------------------------------------------------------------
// API service: typed HttpClient calls. No state, no UI.
// ---------------------------------------------------------------------------------------------
export function apiTemplate(n) {
  const S = n.pascalSingular;
  return `import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from '@core/api/api-config';
import { toParams } from '@core/api/http-params';
import type { Page } from '@core/api/models';
import type { ${S}, ${S}Input, ${S}Query } from './${n.plural}.model';

@Injectable({ providedIn: 'root' })
export class ${n.pascal}Api {
  private readonly http = inject(HttpClient);
  private readonly base = \`\${inject(API_BASE_URL)}/${n.plural}\`;

  list(query: ${S}Query = {}): Observable<Page<${S}>> {
    return this.http.get<Page<${S}>>(this.base, { params: toParams(query) });
  }

  get(id: string): Observable<${S}> {
    return this.http.get<${S}>(\`\${this.base}/\${id}\`);
  }

  create(input: ${S}Input): Observable<${S}> {
    return this.http.post<${S}>(this.base, input);
  }

  update(id: string, input: ${S}Input): Observable<${S}> {
    return this.http.put<${S}>(\`\${this.base}/\${id}\`, input);
  }

  remove(id: string): Observable<null> {
    return this.http.delete<null>(\`\${this.base}/\${id}\`);
  }
}
`;
}

// ---------------------------------------------------------------------------------------------
// Form rules: the form model, its validation schema and the mapping to the API input.
// Plain functions, so they are easy to unit test without a component.
// ---------------------------------------------------------------------------------------------
export function formTemplate(n) {
  const S = n.pascalSingular;
  return `import type { SchemaFn } from '@angular/forms/signals';
import { minLength, required, validate } from '@angular/forms/signals';
import type { ${S}, ${S}Input, ${S}Status } from './${n.plural}.model';

/**
 * What the form edits. Inputs produce text, so the amount is a string here
 * and becomes a number in \`to${S}Input\`.
 */
export interface ${S}FormModel {
  name: string;
  owner: string;
  status: ${S}Status;
  /** As typed, for example "125.50" or "125,50". */
  amount: string;
}

/** Error kinds the schema can produce. Each one has a text under \`${n.camel}.form.errors\`. */
export type ${S}ErrorKind = 'required' | 'minLength' | 'number' | 'range';

export const MAX_AMOUNT = 1_000_000;

export function empty${S}Form(): ${S}FormModel {
  return { name: '', owner: '', status: 'draft', amount: '' };
}

export function to${S}FormModel(${n.camelSingular}: ${S}): ${S}FormModel {
  return {
    name: ${n.camelSingular}.name,
    owner: ${n.camelSingular}.owner,
    status: ${n.camelSingular}.status,
    amount: String(${n.camelSingular}.amount),
  };
}

/** Reads "125.50" or "125,50". Returns NaN for anything that is not a plain non-negative number. */
export function parseAmount(text: string): number {
  const cleaned = text.trim().replace(',', '.');
  if (!/^\\d+(\\.\\d+)?$/.test(cleaned)) return Number.NaN;
  return Number(cleaned);
}

/** The problem with an amount text, or \`null\` when it is fine. */
export function amountRule(text: string): ${S}ErrorKind | null {
  if (text.trim() === '') return 'required';
  const amount = parseAmount(text);
  if (Number.isNaN(amount)) return 'number';
  return amount > MAX_AMOUNT ? 'range' : null;
}

export function to${S}Input(model: ${S}FormModel): ${S}Input {
  return {
    name: model.name.trim(),
    owner: model.owner.trim(),
    status: model.status,
    amount: parseAmount(model.amount),
  };
}

/**
 * Validation rules, written once. \`form(model, ${n.camelSingular}Schema)\` applies them: \`required\` and
 * \`minLength\` come with Angular, \`validate\` takes our own function and returns an error
 * (\`{ kind }\`) or \`null\`.
 */
export const ${n.camelSingular}Schema: SchemaFn<${S}FormModel> = (path) => {
  required(path.name);
  minLength(path.name, 2);
  required(path.owner);
  validate(path.amount, (context) => {
    const kind = amountRule(context.value());
    return kind ? { kind } : null;
  });
};
`;
}

// ---------------------------------------------------------------------------------------------
// Translation helper for TypeScript code, plus routes.
// ---------------------------------------------------------------------------------------------
export function translateTemplate() {
  return `import { inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';
import { asapScheduler, observeOn, scan } from 'rxjs';

type Params = Record<string, string | number>;

/**
 * \`t('<feature>.title')\` for TypeScript code (column headers, toast text, select options).
 *
 * Reading the version signal inside the function makes any computed that calls it update when
 * a scope finishes loading or the language changes, which \`TranslocoService.translate\` alone
 * does not do. The events arrive in a microtask because the \`transloco\` pipe loads a scope
 * while a template renders, and signals must not be written then.
 * Templates should keep using the pipe.
 */
export function injectTranslate(): (key: string, params?: Params) => string {
  const transloco = inject(TranslocoService);
  const version = toSignal(
    transloco.events$.pipe(
      observeOn(asapScheduler),
      scan((count) => count + 1, 0),
    ),
    { initialValue: 0 },
  );
  return (key, params) => {
    version();
    return transloco.translate(key, params);
  };
}
`;
}

export function routesTemplate(n) {
  return `import type { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { roleGuard } from '@core/auth/guards';

/** \`new\` comes before \`:id\` so it is not read as an id. */
export const ${n.constant}_ROUTES: Routes = [
  {
    path: '',
    // Loads public/i18n/${n.plural}/<lang>.json when this feature opens.
    providers: [provideTranslocoScope('${n.plural}')],
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/${n.singular}-list.page').then((m) => m.${n.pascalSingular}ListPage),
      },
      {
        path: 'new',
        canActivate: [roleGuard('admin', 'manager')],
        loadComponent: () => import('./pages/${n.singular}-form.page').then((m) => m.${n.pascalSingular}FormPage),
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./pages/${n.singular}-detail.page').then((m) => m.${n.pascalSingular}DetailPage),
      },
      {
        path: ':id/edit',
        canActivate: [roleGuard('admin', 'manager')],
        loadComponent: () => import('./pages/${n.singular}-form.page').then((m) => m.${n.pascalSingular}FormPage),
      },
    ],
  },
];
`;
}

/**
 * Every file to create: { path, content } with forward-slash paths relative to the repo root.
 */
export function buildFiles(n) {
  const dir = featureDir(n);
  return [
    { path: `${dir}/${n.plural}.model.ts`, content: modelTemplate(n) },
    { path: `${dir}/mock/${n.plural}.mock.ts`, content: mockTemplate(n) },
    { path: `${dir}/${n.plural}.api.ts`, content: apiTemplate(n) },
    { path: `${dir}/${n.plural}.form.ts`, content: formTemplate(n) },
    { path: `${dir}/translate.ts`, content: translateTemplate() },
    { path: `${dir}/${n.plural}.routes.ts`, content: routesTemplate(n) },
    ...pagesTemplates(n).map((file) => ({ ...file, path: `${dir}/${file.path}` })),
    ...specTemplates(n).map((file) => ({ ...file, path: `${dir}/${file.path}` })),
    { path: `public/i18n/${n.plural}/en.json`, content: i18nTemplate(n, 'en') },
    { path: `public/i18n/${n.plural}/nl.json`, content: i18nTemplate(n, 'nl') },
  ];
}
