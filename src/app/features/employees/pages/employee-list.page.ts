import {
  ChangeDetectionStrategy,
  Component,
  type TemplateRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  of,
  skip,
  startWith,
  switchMap,
} from 'rxjs';
import { EmployeesApi } from '@core/api/employees.api';
import { LookupsApi } from '@core/api/lookups.api';
import type { Employee, Location, Page, Team, UserRole } from '@core/api/models';
import { HasRoleDirective } from '@core/auth/has-role.directive';
import {
  AlertComponent,
  AvatarComponent,
  BadgeComponent,
  ButtonComponent,
  FieldComponent,
  InputComponent,
  LinkComponent,
  PageHeaderComponent,
  PaginationComponent,
  SelectComponent,
  TableComponent,
  type SelectOption,
  type TableCellContext,
  type TableColumn,
  type TableSort,
} from '@ui/index';
import {
  DEFAULT_LIST_STATE,
  PAGE_SIZES,
  hasActiveFilters,
  listStateToParams,
  parseListState,
  toEmployeeQuery,
  type EmployeeListState,
} from '../employee-list-state';
import { injectTranslate } from '../translate';

/** Debounce for the search box. Long enough to skip most keystrokes, short enough to feel live. */
export const SEARCH_DEBOUNCE_MS = 300;

type ListResult =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; page: Page<Employee> };

function asRole(value: string): UserRole | '' {
  return value === 'admin' || value === 'manager' || value === 'employee' ? value : '';
}

/**
 * Employee list with server-side search, filters, sorting and paging.
 *
 * Everything the user can change lives in one `state` signal. The state is read from the URL
 * once on load and written back to it on every change, so a reload or a shared link shows the
 * same list. A second stream turns each new state into a request.
 */
@Component({
  selector: 'app-employee-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    AvatarComponent,
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
  template: `
    <ng-template #nameCell let-row>
      <span class="flex min-w-0 items-center gap-2">
        <ui-avatar [name]="fullName(row)" size="sm" />
        <a ui-link class="truncate" [routerLink]="['/employees', row.id]">{{ fullName(row) }}</a>
      </span>
    </ng-template>
    <ng-template #roleCell let-row>
      <ui-badge [variant]="row.userRole === 'employee' ? 'neutral' : 'brand'">
        {{ 'roles.' + row.userRole | transloco }}
      </ui-badge>
    </ng-template>

    <div class="flex flex-col gap-6">
      <ui-page-header
        [title]="'employees.list.title' | transloco"
        [description]="'employees.list.description' | transloco"
      >
        <ng-container actions>
          <button *hasRole="['admin', 'manager']" ui-button type="button" (click)="create()">
            {{ 'employees.list.new' | transloco }}
          </button>
        </ng-container>
      </ui-page-header>

      <div role="search" class="flex flex-wrap items-end gap-3">
        <ui-field class="w-full sm:w-72" [label]="'employees.list.search' | transloco">
          <ui-input
            type="search"
            [value]="searchText()"
            [placeholder]="'employees.list.searchPlaceholder' | transloco"
            (valueChange)="onSearch($event)"
          />
        </ui-field>
        <ui-field class="w-44" [label]="'employees.list.team' | transloco">
          <ui-select
            [options]="teamOptions()"
            [placeholder]="'employees.list.allTeams' | transloco"
            [value]="state().teamId"
            (valueChange)="patch({ teamId: $event })"
          />
        </ui-field>
        <ui-field class="w-44" [label]="'employees.list.location' | transloco">
          <ui-select
            [options]="locationOptions()"
            [placeholder]="'employees.list.allLocations' | transloco"
            [value]="state().locationId"
            (valueChange)="patch({ locationId: $event })"
          />
        </ui-field>
        <ui-field class="w-40" [label]="'employees.list.role' | transloco">
          <ui-select
            [options]="roleOptions()"
            [placeholder]="'employees.list.allRoles' | transloco"
            [value]="state().role"
            (valueChange)="patch({ role: asRole($event) })"
          />
        </ui-field>
        @if (filtersActive()) {
          <button ui-button type="button" variant="ghost" (click)="clearFilters()">
            {{ 'employees.list.clear' | transloco }}
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
            [label]="'employees.list.tableLabel' | transloco"
            [columns]="columns()"
            [rows]="rows()"
            [trackBy]="byId"
            [sort]="state().sort"
            (sortChange)="setSort($event)"
            manualSort
            rowClickable
            [loading]="result().status === 'loading'"
            [skeletonRows]="state().pageSize"
            [emptyTitle]="
              (filtersActive() ? 'employees.list.noMatchTitle' : 'employees.list.emptyTitle')
                | transloco
            "
            [emptyMessage]="
              (filtersActive() ? 'common.noResults' : 'employees.list.emptyText') | transloco
            "
            emptyIcon="users"
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
                {{ 'employees.list.clear' | transloco }}
              </button>
            }
          </ui-table>
          <ui-pagination
            [total]="total()"
            [page]="state().page"
            [pageSize]="state().pageSize"
            [pageSizeOptions]="pageSizes"
            [label]="'employees.list.pagination.label' | transloco"
            [previousLabel]="'employees.list.pagination.previous' | transloco"
            [nextLabel]="'employees.list.pagination.next' | transloco"
            [pageSizeLabel]="'employees.list.pagination.pageSize' | transloco"
            [pageLabel]="pageLabel"
            (pageChange)="setPage($event)"
            (pageSizeChange)="setPageSize($event)"
          />
        </div>
      }
    </div>
  `,
})
export class EmployeeListPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(EmployeesApi);
  private readonly lookups = inject(LookupsApi);
  private readonly t = injectTranslate();

  protected readonly pageSizes = PAGE_SIZES;

  protected readonly state = signal<EmployeeListState>(
    parseListState(this.route.snapshot.queryParamMap),
  );
  /** What is typed in the search box. The state only gets it after the debounce. */
  protected readonly searchText = signal(this.state().q);

  private readonly nameCell =
    viewChild.required<TemplateRef<TableCellContext<Employee>>>('nameCell');
  private readonly roleCell =
    viewChild.required<TemplateRef<TableCellContext<Employee>>>('roleCell');

  private readonly teams = toSignal(this.lookups.teams(), { initialValue: [] as Team[] });
  private readonly locations = toSignal(this.lookups.locations(), {
    initialValue: [] as Location[],
  });

  protected readonly teamOptions = computed<SelectOption[]>(() =>
    this.teams().map((team) => ({ value: team.id, label: team.name })),
  );
  protected readonly locationOptions = computed<SelectOption[]>(() =>
    this.locations().map((location) => ({ value: location.id, label: location.name })),
  );
  protected readonly roleOptions = computed<SelectOption[]>(() =>
    (['employee', 'manager', 'admin'] as const).map((role) => ({
      value: role,
      label: this.t(`roles.${role}`),
    })),
  );

  protected readonly filtersActive = computed(() => hasActiveFilters(this.state()));

  // --- RxJS on purpose -----------------------------------------------------------------
  // Typing is a stream of events over time, which is what RxJS operators are for:
  // `debounceTime` waits until the user pauses, `distinctUntilChanged` drops a pause that
  // ends on the same text as before, and `switchMap` below cancels the request that is still
  // in flight when a newer one starts, so a slow answer can never overwrite a fresh one.
  // Signals hold the *state*; RxJS handles the *timing and cancellation*.
  private readonly search$ = new Subject<string>();

  private readonly retrySignal = signal(0);

  protected readonly result = toSignal(
    toObservable(computed(() => ({ state: this.state(), attempt: this.retrySignal() }))).pipe(
      switchMap(({ state }) =>
        this.api.list(toEmployeeQuery(state)).pipe(
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
  protected readonly summary = computed(() => {
    const result = this.result();
    return result.status === 'ready'
      ? this.t('employees.list.summary', { count: result.page.total })
      : '';
  });

  protected readonly columns = computed<TableColumn<Employee>[]>(() => [
    {
      key: 'name',
      header: this.t('employees.list.columns.name'),
      sortable: true,
      cell: this.nameCell(),
      width: 'minmax(0, 2fr)',
    },
    {
      key: 'jobTitle',
      header: this.t('employees.list.columns.jobTitle'),
      sortable: true,
      accessor: (row) => row.jobTitle,
      width: 'minmax(0, 1.5fr)',
    },
    {
      key: 'team',
      header: this.t('employees.list.columns.team'),
      sortable: true,
      accessor: (row) => this.teams().find((team) => team.id === row.teamId)?.name ?? '',
    },
    {
      key: 'location',
      header: this.t('employees.list.columns.location'),
      accessor: (row) =>
        this.locations().find((location) => location.id === row.locationId)?.name ?? '',
    },
    {
      key: 'role',
      header: this.t('employees.list.columns.role'),
      cell: this.roleCell(),
      width: '7rem',
    },
    {
      key: 'hours',
      header: this.t('employees.list.columns.hours'),
      sortable: true,
      accessor: (row) => row.contract.hoursPerWeek,
      align: 'end',
      width: '6rem',
    },
  ]);

  protected readonly byId = (row: Employee): string => row.id;
  protected readonly pageLabel = (page: number): string =>
    this.t('employees.list.pagination.page', { page });

  constructor() {
    const initial = this.state().q;
    this.search$
      .pipe(
        map((text) => text.trim()),
        debounceTime(SEARCH_DEBOUNCE_MS),
        // Seed with the text from the URL so a pause that ends on it is not seen as a change.
        startWith(initial),
        distinctUntilChanged(),
        skip(1),
        takeUntilDestroyed(),
      )
      .subscribe((q) => this.patch({ q }));

    // State to URL. `replaceUrl` keeps the back button for real navigation, not for keystrokes.
    effect(() => {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: listStateToParams(this.state()),
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });
  }

  protected onSearch(text: string): void {
    this.searchText.set(text);
    this.search$.next(text);
  }

  /** Changes part of the state. Anything but a page change goes back to page 1. */
  protected patch(change: Partial<EmployeeListState>): void {
    const next = { ...this.state(), ...change };
    if (!('page' in change)) next.page = 1;
    if (JSON.stringify(next) !== JSON.stringify(this.state())) this.state.set(next);
  }

  protected setPage(page: number): void {
    this.patch({ page });
  }

  protected setPageSize(pageSize: number): void {
    this.patch({ pageSize });
  }

  protected setSort(sort: TableSort | null): void {
    this.patch({ sort });
  }

  protected clearFilters(): void {
    this.searchText.set('');
    this.state.update((s) => ({ ...DEFAULT_LIST_STATE, pageSize: s.pageSize, sort: s.sort }));
  }

  protected retry(): void {
    this.retrySignal.update((n) => n + 1);
  }

  protected fullName(employee: Employee): string {
    return `${employee.firstName} ${employee.lastName}`;
  }

  protected asRole = asRole;

  protected open(employee: Employee): void {
    void this.router.navigate(['/employees', employee.id]);
  }

  protected create(): void {
    void this.router.navigate(['/employees', 'new']);
  }
}
