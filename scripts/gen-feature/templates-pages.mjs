// File templates for `npm run gen:feature`, part 2: the three pages (list, detail, form).
// Same escape rules as templates.mjs: \` and \${ inside a template mean "write a backtick /
// dollar-brace into the generated file".
//
// The pages follow the employees feature, simplified:
//   list   server-side paging, sorting, status filter and debounced search; loading, empty, error
//   detail one record with edit and delete
//   form   create and edit with Signal Forms

/** Returns `{ path, content }` entries; paths are relative to the feature folder. */
export function pagesTemplates(n) {
  return [
    { path: `pages/${n.singular}-list.page.ts`, content: listPageTemplate(n) },
    { path: `pages/${n.singular}-detail.page.ts`, content: detailPageTemplate(n) },
    { path: `pages/${n.singular}-form.page.ts`, content: formPageTemplate(n) },
  ];
}

// ---------------------------------------------------------------------------------------------
// List page
// ---------------------------------------------------------------------------------------------
export function listPageTemplate(n) {
  const S = n.pascalSingular;
  const scope = n.plural;
  // Transloco turns a kebab-case scope into camelCase keys: scope "order-items" gives "orderItems.list.title".
  const key = n.camel;
  return `import {
  ChangeDetectionStrategy,
  Component,
  type TemplateRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Subject, catchError, debounceTime, map, of, startWith, switchMap } from 'rxjs';
import type { Page } from '@core/api/models';
import { HasRoleDirective } from '@core/auth/has-role.directive';
import { LanguageService } from '@core/i18n/i18n';
import {
  AlertComponent,
  BadgeComponent,
  ButtonComponent,
  FieldComponent,
  InputComponent,
  LinkComponent,
  PageHeaderComponent,
  PaginationComponent,
  SelectComponent,
  TableComponent,
  type BadgeVariant,
  type SelectOption,
  type TableCellContext,
  type TableColumn,
  type TableSort,
} from '@ui/index';
import { ${n.pascal}Api } from '../${scope}.api';
import {
  ${n.constant}_STATUSES,
  ${n.constant}_STATUS_BADGE,
  formatAmount,
  formatDate,
  type ${S},
  type ${S}Query,
  type ${S}Status,
} from '../${scope}.model';
import { injectTranslate } from '../translate';

/** Wait this long after the last key press before asking the server. */
export const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZES: readonly number[] = [10, 20, 50];

type ListResult =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; page: Page<${S}> };

/** Everything the user can change on this page. One object, so one request per change. */
interface ListState {
  q: string;
  status: ${S}Status | '';
  page: number;
  pageSize: number;
  sort: TableSort | null;
}

const DEFAULT_STATE: ListState = { q: '', status: '', page: 1, pageSize: 10, sort: null };

function toQuery(state: ListState): ${S}Query {
  return {
    q: state.q,
    status: state.status,
    page: state.page,
    pageSize: state.pageSize,
    sort: state.sort?.key,
    dir: state.sort?.direction,
  };
}

/** Narrows a select value to a status; anything else means "all". */
function asStatus(value: string): ${S}Status | '' {
  return ${n.constant}_STATUSES.find((status) => status === value) ?? '';
}

/**
 * ${n.title} list with server-side search, status filter, sorting and paging.
 *
 * The \`state\` signal holds what the user chose. Each new state becomes one request; \`switchMap\`
 * cancels a request that is still running when a newer one starts, so a slow answer can never
 * replace a fresh one.
 */
@Component({
  selector: 'app-${n.singular}-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    BadgeComponent,
    ButtonComponent,
    FieldComponent,
    HasRoleDirective,
    InputComponent,
    LinkComponent,
    PageHeaderComponent,
    PaginationComponent,
    RouterLink,
    SelectComponent,
    TableComponent,
    TranslocoPipe,
  ],
  template: \`
    <ng-template #nameCell let-row>
      <a ui-link class="truncate" [routerLink]="['/${scope}', row.id]">{{ row.name }}</a>
    </ng-template>
    <ng-template #statusCell let-row>
      <ui-badge [variant]="badgeOf(row.status)">
        {{ '${key}.status.' + row.status | transloco }}
      </ui-badge>
    </ng-template>

    <div class="flex flex-col gap-6">
      <ui-page-header
        [title]="'${key}.list.title' | transloco"
        [description]="'${key}.list.description' | transloco"
      >
        <ng-container actions>
          <button *hasRole="['admin', 'manager']" ui-button type="button" (click)="create()">
            {{ '${key}.list.new' | transloco }}
          </button>
        </ng-container>
      </ui-page-header>

      <div role="search" class="flex flex-wrap items-end gap-3">
        <ui-field class="w-full sm:w-72" [label]="'${key}.list.search' | transloco">
          <ui-input
            type="search"
            [value]="searchText()"
            [placeholder]="'${key}.list.searchPlaceholder' | transloco"
            (valueChange)="onSearch($event)"
          />
        </ui-field>
        <ui-field class="w-44" [label]="'${key}.list.status' | transloco">
          <ui-select
            [options]="statusOptions()"
            [placeholder]="'${key}.list.allStatuses' | transloco"
            [value]="state().status"
            (valueChange)="patch({ status: asStatus($event) })"
          />
        </ui-field>
        @if (filtersActive()) {
          <button ui-button type="button" variant="ghost" (click)="clearFilters()">
            {{ '${key}.list.clear' | transloco }}
          </button>
        }
      </div>

      <p class="sr-only" aria-live="polite">{{ summary() }}</p>

      @if (result().status === 'error') {
        <ui-alert variant="danger" [heading]="'common.errorTitle' | transloco">
          {{ 'common.errorText' | transloco }}
          <div class="mt-2">
            <button ui-button size="sm" variant="secondary" type="button" (click)="retry()">
              {{ 'common.retry' | transloco }}
            </button>
          </div>
        </ui-alert>
      } @else {
        <div class="flex flex-col gap-3">
          <ui-table
            [label]="'${key}.list.tableLabel' | transloco"
            [columns]="columns()"
            [rows]="rows()"
            [trackBy]="byId"
            [sort]="state().sort"
            (sortChange)="patch({ sort: $event })"
            manualSort
            rowClickable
            [loading]="result().status === 'loading'"
            [skeletonRows]="state().pageSize"
            [emptyTitle]="
              (filtersActive() ? '${key}.list.noMatchTitle' : '${key}.list.emptyTitle')
                | transloco
            "
            [emptyMessage]="
              (filtersActive() ? 'common.noResults' : '${key}.list.emptyText') | transloco
            "
            emptyIcon="list"
            (rowClick)="open($event)"
          >
            @if (filtersActive()) {
              <button
                empty-action
                ui-button
                type="button"
                variant="secondary"
                (click)="clearFilters()"
              >
                {{ '${key}.list.clear' | transloco }}
              </button>
            }
          </ui-table>
          <ui-pagination
            [total]="total()"
            [page]="state().page"
            [pageSize]="state().pageSize"
            [pageSizeOptions]="pageSizes"
            [label]="'${key}.list.pagination.label' | transloco"
            [previousLabel]="'${key}.list.pagination.previous' | transloco"
            [nextLabel]="'${key}.list.pagination.next' | transloco"
            [pageSizeLabel]="'${key}.list.pagination.pageSize' | transloco"
            [pageLabel]="pageLabel"
            (pageChange)="patch({ page: $event })"
            (pageSizeChange)="patch({ pageSize: $event })"
          />
        </div>
      }
    </div>
  \`,
})
export class ${S}ListPage {
  private readonly router = inject(Router);
  private readonly api = inject(${n.pascal}Api);
  private readonly language = inject(LanguageService).language;
  private readonly t = injectTranslate();

  protected readonly pageSizes = PAGE_SIZES;
  protected readonly asStatus = asStatus;

  protected badgeOf(status: ${S}Status): BadgeVariant {
    return ${n.constant}_STATUS_BADGE[status];
  }


  protected readonly state = signal<ListState>(DEFAULT_STATE);
  /** What is typed in the search box. \`state.q\` only gets it after the debounce. */
  protected readonly searchText = signal('');

  private readonly nameCell = viewChild.required<TemplateRef<TableCellContext<${S}>>>('nameCell');
  private readonly statusCell =
    viewChild.required<TemplateRef<TableCellContext<${S}>>>('statusCell');

  protected readonly statusOptions = computed<SelectOption[]>(() =>
    ${n.constant}_STATUSES.map((status) => ({
      value: status,
      label: this.t(\`${key}.status.\${status}\`),
    })),
  );
  protected readonly filtersActive = computed(
    () => this.state().q !== '' || this.state().status !== '',
  );

  // --- RxJS on purpose ------------------------------------------------------------------
  // Typing is a stream of events over time, which is what RxJS is for: \`debounceTime\` waits
  // until the user pauses. Signals hold the state; RxJS handles timing and cancellation.
  private readonly search$ = new Subject<string>();
  private readonly attempt = signal(0);

  protected readonly result = toSignal(
    toObservable(computed(() => ({ state: this.state(), attempt: this.attempt() }))).pipe(
      switchMap(({ state }) =>
        this.api.list(toQuery(state)).pipe(
          map((page): ListResult => ({ status: 'ready', page })),
          catchError(() => of<ListResult>({ status: 'error' })),
          startWith<ListResult>({ status: 'loading' }),
        ),
      ),
    ),
    { initialValue: { status: 'loading' } as ListResult },
  );

  protected readonly rows = computed(() => {
    const result = this.result();
    return result.status === 'ready' ? result.page.items : [];
  });
  protected readonly total = computed(() => {
    const result = this.result();
    return result.status === 'ready' ? result.page.total : 0;
  });
  /** Read out by screen readers when the list changes. */
  protected readonly summary = computed(() => {
    const result = this.result();
    return result.status === 'ready'
      ? this.t('${key}.list.summary', { count: result.page.total })
      : '';
  });

  protected readonly columns = computed<TableColumn<${S}>[]>(() => [
    {
      key: 'name',
      header: this.t('${key}.list.columns.name'),
      sortable: true,
      cell: this.nameCell(),
      width: 'minmax(0, 2fr)',
    },
    {
      key: 'owner',
      header: this.t('${key}.list.columns.owner'),
      sortable: true,
      accessor: (row) => row.owner,
      width: 'minmax(0, 1.5fr)',
    },
    {
      key: 'status',
      header: this.t('${key}.list.columns.status'),
      sortable: true,
      cell: this.statusCell(),
      width: '8rem',
    },
    {
      key: 'amount',
      header: this.t('${key}.list.columns.amount'),
      sortable: true,
      accessor: (row) => formatAmount(row.amount, this.language()),
      align: 'end',
      width: '8rem',
    },
    {
      key: 'createdAt',
      header: this.t('${key}.list.columns.createdAt'),
      sortable: true,
      accessor: (row) => formatDate(row.createdAt, this.language()),
      width: '9rem',
    },
  ]);

  protected readonly byId = (row: ${S}): string => row.id;
  protected readonly pageLabel = (page: number): string =>
    this.t('${key}.list.pagination.page', { page });

  constructor() {
    this.search$
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), takeUntilDestroyed())
      .subscribe((text) => this.patch({ q: text.trim() }));
  }

  protected onSearch(text: string): void {
    this.searchText.set(text);
    this.search$.next(text);
  }

  /** Changes part of the state. Anything but a page change goes back to page 1. */
  protected patch(change: Partial<ListState>): void {
    const next = { ...this.state(), ...change };
    if (!('page' in change)) next.page = 1;
    if (JSON.stringify(next) !== JSON.stringify(this.state())) this.state.set(next);
  }

  protected clearFilters(): void {
    this.searchText.set('');
    this.state.update((state) => ({ ...DEFAULT_STATE, pageSize: state.pageSize, sort: state.sort }));
  }

  protected retry(): void {
    this.attempt.update((count) => count + 1);
  }

  protected open(row: ${S}): void {
    void this.router.navigate(['/${scope}', row.id]);
  }

  protected create(): void {
    void this.router.navigate(['/${scope}', 'new']);
  }
}
`;
}

// ---------------------------------------------------------------------------------------------
// Detail page
// ---------------------------------------------------------------------------------------------
export function detailPageTemplate(n) {
  const S = n.pascalSingular;
  const scope = n.plural;
  // Transloco turns a kebab-case scope into camelCase keys: scope "order-items" gives "orderItems.list.title".
  const key = n.camel;
  return `import { rxResource } from '@angular/core/rxjs-interop';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { HasRoleDirective } from '@core/auth/has-role.directive';
import { LanguageService } from '@core/i18n/i18n';
import {
  AlertComponent,
  BadgeComponent,
  BreadcrumbsComponent,
  ButtonComponent,
  CardComponent,
  DialogService,
  PageHeaderComponent,
  SkeletonComponent,
  ToastService,
  type BreadcrumbItem,
} from '@ui/index';
import { ${n.pascal}Api } from '../${scope}.api';
import { ${n.constant}_STATUS_BADGE, formatAmount, formatDate } from '../${scope}.model';
import { injectTranslate } from '../translate';

/** One ${n.lowerSingular}: header with edit and delete, then its details. */
@Component({
  selector: 'app-${n.singular}-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    BadgeComponent,
    BreadcrumbsComponent,
    ButtonComponent,
    CardComponent,
    HasRoleDirective,
    PageHeaderComponent,
    SkeletonComponent,
    TranslocoPipe,
  ],
  template: \`
    @if (data.status() === 'error') {
      <ui-alert variant="danger" [heading]="'${key}.detail.errorTitle' | transloco">
        {{ 'common.errorText' | transloco }}
        <div class="mt-2 flex gap-2">
          <button ui-button size="sm" variant="secondary" type="button" (click)="data.reload()">
            {{ 'common.retry' | transloco }}
          </button>
          <button ui-button size="sm" variant="ghost" type="button" (click)="backToList()">
            {{ '${key}.detail.backToList' | transloco }}
          </button>
        </div>
      </ui-alert>
    } @else if (${n.camelSingular}(); as item) {
      <div class="flex flex-col gap-6">
        <ui-page-header [title]="item.name" [description]="item.owner">
          <ui-breadcrumbs
            breadcrumbs
            [label]="'${key}.breadcrumb' | transloco"
            [items]="crumbs()"
          />
          <ng-container actions>
            <button
              *hasRole="['admin', 'manager']"
              ui-button
              variant="secondary"
              type="button"
              (click)="edit()"
            >
              {{ 'common.edit' | transloco }}
            </button>
            <button
              *hasRole="['admin', 'manager']"
              ui-button
              variant="danger"
              type="button"
              [loading]="deleting()"
              (click)="remove()"
            >
              {{ 'common.delete' | transloco }}
            </button>
          </ng-container>
        </ui-page-header>

        <ui-card>
          <dl class="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <div>
              <dt class="text-sm text-foreground-subtle">
                {{ '${key}.fields.status' | transloco }}
              </dt>
              <dd class="text-base">
                <ui-badge [variant]="badge[item.status]">
                  {{ '${key}.status.' + item.status | transloco }}
                </ui-badge>
              </dd>
            </div>
            <div>
              <dt class="text-sm text-foreground-subtle">
                {{ '${key}.fields.owner' | transloco }}
              </dt>
              <dd class="text-base">{{ item.owner }}</dd>
            </div>
            <div>
              <dt class="text-sm text-foreground-subtle">
                {{ '${key}.fields.amount' | transloco }}
              </dt>
              <dd class="text-base">{{ amount() }}</dd>
            </div>
            <div>
              <dt class="text-sm text-foreground-subtle">
                {{ '${key}.fields.createdAt' | transloco }}
              </dt>
              <dd class="text-base">{{ createdAt() }}</dd>
            </div>
          </dl>
        </ui-card>
      </div>
    } @else {
      <div class="flex flex-col gap-4" aria-busy="true">
        <ui-skeleton class="h-10 w-72" />
        <ui-skeleton class="h-40 w-full" />
      </div>
    }
  \`,
})
export class ${S}DetailPage {
  /** Route param, bound by \`withComponentInputBinding\`. */
  readonly id = input.required<string>();

  private readonly api = inject(${n.pascal}Api);
  private readonly router = inject(Router);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly language = inject(LanguageService).language;
  private readonly t = injectTranslate();

  protected readonly badge = ${n.constant}_STATUS_BADGE;
  protected readonly deleting = signal(false);

  protected readonly data = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.api.get(params),
  });

  protected readonly ${n.camelSingular} = computed(() => (this.data.hasValue() ? this.data.value() : null));
  protected readonly amount = computed(() =>
    formatAmount(this.${n.camelSingular}()?.amount ?? 0, this.language()),
  );
  protected readonly createdAt = computed(() =>
    formatDate(this.${n.camelSingular}()?.createdAt ?? '', this.language()),
  );
  protected readonly crumbs = computed<BreadcrumbItem[]>(() => [
    { label: this.t('nav.${n.camel}'), link: '/${scope}' },
    { label: this.${n.camelSingular}()?.name ?? '' },
  ]);

  protected edit(): void {
    void this.router.navigate(['/${scope}', this.id(), 'edit']);
  }

  protected backToList(): void {
    void this.router.navigate(['/${scope}']);
  }

  protected async remove(): Promise<void> {
    const item = this.${n.camelSingular}();
    if (!item) return;
    const confirmed = await this.dialogs.confirm({
      title: this.t('${key}.delete.title'),
      message: this.t('${key}.delete.message', { name: item.name }),
      confirmLabel: this.t('common.delete'),
      cancelLabel: this.t('common.cancel'),
      danger: true,
    });
    if (!confirmed) return;
    this.deleting.set(true);
    try {
      await firstValueFrom(this.api.remove(item.id));
      this.toasts.show({
        variant: 'success',
        title: this.t('${key}.delete.done'),
        message: item.name,
      });
      await this.router.navigate(['/${scope}']);
    } catch {
      // The error interceptor already showed a toast with the server message.
      this.deleting.set(false);
    }
  }
}
`;
}

// ---------------------------------------------------------------------------------------------
// Form page (create and edit) on Signal Forms
// ---------------------------------------------------------------------------------------------
export function formPageTemplate(n) {
  const S = n.pascalSingular;
  const scope = n.plural;
  // Transloco turns a kebab-case scope into camelCase keys: scope "order-items" gives "orderItems.list.title".
  const key = n.camel;
  return `import { HttpErrorResponse } from '@angular/common/http';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { FormField, form, submit } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import type { ApiErrorBody } from '@core/api/models';
import {
  AlertComponent,
  BreadcrumbsComponent,
  ButtonComponent,
  CardComponent,
  FieldComponent,
  InputComponent,
  PageHeaderComponent,
  SelectComponent,
  SkeletonComponent,
  ToastService,
  type BreadcrumbItem,
  type SelectOption,
} from '@ui/index';
import { ${n.pascal}Api } from '../${scope}.api';
import {
  empty${S}Form,
  ${n.camelSingular}Schema,
  to${S}FormModel,
  to${S}Input,
  type ${S}FormModel,
} from '../${scope}.form';
import { ${n.constant}_STATUSES } from '../${scope}.model';
import { injectTranslate } from '../translate';

/** What the template needs from a field to show its first error once it has been touched. */
type ErrorSource = () => {
  touched(): boolean;
  errors(): readonly { kind: string; message?: string }[];
};

/**
 * Route page for \`new\` and \`:id/edit\`. The form model is a plain signal, \`form()\` wraps it in a
 * field tree and each \`ui-*\` control binds to one field with \`[formField]\`. The validation rules
 * live in \`${scope}.form.ts\`.
 */
@Component({
  selector: 'app-${n.singular}-form-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    BreadcrumbsComponent,
    ButtonComponent,
    CardComponent,
    FieldComponent,
    FormField,
    InputComponent,
    PageHeaderComponent,
    SelectComponent,
    SkeletonComponent,
    TranslocoPipe,
  ],
  template: \`
    <div class="flex flex-col gap-6">
      <ui-page-header
        [title]="(isNew() ? '${key}.form.newTitle' : '${key}.form.editTitle') | transloco"
        [description]="subtitle()"
      >
        <ui-breadcrumbs
          breadcrumbs
          [label]="'${key}.breadcrumb' | transloco"
          [items]="crumbs()"
        />
      </ui-page-header>

      @if (loadFailed()) {
        <ui-alert variant="danger" [heading]="'common.errorTitle' | transloco">
          {{ 'common.errorText' | transloco }}
          <div class="mt-2">
            <button ui-button size="sm" variant="secondary" type="button" (click)="existing.reload()">
              {{ 'common.retry' | transloco }}
            </button>
          </div>
        </ui-alert>
      } @else if (!ready()) {
        <div class="flex flex-col gap-4" aria-busy="true">
          <ui-skeleton class="h-56 w-full" />
        </div>
      } @else {
        <form class="flex flex-col gap-6" novalidate (submit)="onSubmit($event)">
          <fieldset class="m-0 flex min-w-0 flex-col gap-6 border-0 p-0" [disabled]="saving()">
            @if (attempted() && f().invalid()) {
              <ui-alert variant="danger" [heading]="'${key}.form.fixErrors' | transloco">
                {{ '${key}.form.fixErrorsText' | transloco }}
              </ui-alert>
            }
            @for (message of serverErrors(); track $index) {
              <ui-alert variant="danger" [heading]="'${key}.form.saveFailed' | transloco">
                {{ message }}
              </ui-alert>
            }

            <ui-card>
              <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                <ui-field
                  [label]="'${key}.form.name' | transloco"
                  required
                  [error]="errorOf(f.name)"
                >
                  <ui-input [formField]="f.name" />
                </ui-field>
                <ui-field
                  [label]="'${key}.form.owner' | transloco"
                  required
                  [error]="errorOf(f.owner)"
                >
                  <ui-input [formField]="f.owner" autocomplete="name" />
                </ui-field>
                <ui-field [label]="'${key}.form.status' | transloco">
                  <ui-select [formField]="f.status" [options]="statusOptions()" />
                </ui-field>
                <ui-field
                  [label]="'${key}.form.amount' | transloco"
                  [hint]="'${key}.form.amountHint' | transloco"
                  required
                  [error]="errorOf(f.amount)"
                >
                  <ui-input [formField]="f.amount" type="text" />
                </ui-field>
              </div>
            </ui-card>

            <div class="flex items-center justify-end gap-2">
              <button ui-button type="button" variant="secondary" (click)="cancel()">
                {{ 'common.cancel' | transloco }}
              </button>
              <button ui-button type="submit" [loading]="saving()" [disabled]="saving()">
                {{ 'common.save' | transloco }}
              </button>
            </div>
          </fieldset>
        </form>
      }
    </div>
  \`,
})
export class ${S}FormPage {
  /** Route param, bound by \`withComponentInputBinding\`. Missing on \`/${scope}/new\`. */
  readonly id = input<string>();

  private readonly api = inject(${n.pascal}Api);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly t = injectTranslate();

  protected readonly isNew = computed(() => !this.id());

  /** The ${n.lowerSingular} being edited. Not loaded at all on \`new\`. */
  protected readonly existing = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.api.get(params),
  });
  protected readonly current = computed(() =>
    !this.isNew() && this.existing.hasValue() ? this.existing.value() : null,
  );
  protected readonly loadFailed = computed(() => !this.isNew() && this.existing.status() === 'error');
  protected readonly ready = computed(() => this.isNew() || this.existing.hasValue());

  /** Follows the loaded ${n.lowerSingular}, and can still be edited freely. */
  protected readonly model = linkedSignal<${S}FormModel>(() => {
    const item = this.current();
    return item ? to${S}FormModel(item) : empty${S}Form();
  });
  protected readonly f = form(this.model, ${n.camelSingular}Schema);

  protected readonly attempted = signal(false);
  protected readonly saving = computed(() => this.f().submitting());

  protected readonly statusOptions = computed<SelectOption[]>(() =>
    ${n.constant}_STATUSES.map((status) => ({
      value: status,
      label: this.t(\`${key}.status.\${status}\`),
    })),
  );

  /** Errors the server sent back for the whole form. */
  protected readonly serverErrors = computed(() =>
    this.f()
      .errors()
      .filter((error) => error.kind === 'server')
      .map((error) => error.message ?? ''),
  );

  protected readonly subtitle = computed(() => this.current()?.name ?? '');
  protected readonly crumbs = computed<BreadcrumbItem[]>(() => {
    const items: BreadcrumbItem[] = [{ label: this.t('nav.${n.camel}'), link: '/${scope}' }];
    const item = this.current();
    if (item) items.push({ label: item.name, link: ['/${scope}', item.id] });
    items.push({ label: this.t(this.isNew() ? '${key}.form.newTitle' : '${key}.form.editTitle') });
    return items;
  });

  protected cancel(): void {
    const item = this.current();
    void this.router.navigate(item ? ['/${scope}', item.id] : ['/${scope}']);
  }

  /** The first error of a field, translated, once the user has touched it or tried to submit. */
  protected errorOf(field: ErrorSource): string {
    const state = field();
    const first = state.touched() ? state.errors()[0] : undefined;
    if (!first) return '';
    return first.kind === 'server'
      ? (first.message ?? '')
      : this.t(\`${key}.form.errors.\${first.kind}\`);
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.attempted.set(true);
    // submit() marks every field as touched, skips the action while the form is invalid and
    // blocks a second submit while the first one runs. Returning an error shows it on the form.
    await submit(this.f, async () => {
      const input = to${S}Input(this.model());
      const item = this.current();
      try {
        const saved = await firstValueFrom(
          item ? this.api.update(item.id, input) : this.api.create(input),
        );
        this.toasts.show({
          variant: 'success',
          title: this.t(item ? '${key}.form.updated' : '${key}.form.created'),
          message: saved.name,
        });
        await this.router.navigate(['/${scope}', saved.id]);
        return undefined;
      } catch (error) {
        return { kind: 'server', message: this.messageOf(error) };
      }
    });
  }

  private messageOf(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as Partial<ApiErrorBody> | null;
      if (body?.message) return body.message;
    }
    return this.t('errors.unknown');
  }
}
`;
}
