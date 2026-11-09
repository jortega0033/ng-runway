import type { TemplateRef } from '@angular/core';
import { ChangeDetectionStrategy, Component, computed, signal, viewChild } from '@angular/core';
import {
  BadgeComponent,
  BreadcrumbsComponent,
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
  PageHeaderComponent,
  PaginationComponent,
  TableComponent,
  type BadgeVariant,
  type BreadcrumbItem,
  type TableCellContext,
  type TableColumn,
  type TableSort,
} from '@ui/index';

type Status = 'Active' | 'On leave' | 'Onboarding';

interface Employee {
  readonly id: number;
  readonly name: string;
  readonly role: string;
  readonly location: string;
  readonly hours: number;
  readonly status: Status;
}

const FIRST = [
  'Maria',
  'Aiko',
  'Chidi',
  'Lars',
  'Priya',
  'Tomas',
  'Amara',
  'Jonas',
  'Sofia',
  'Kenji',
];
const LAST = [
  'van der Berg',
  'Tanaka',
  'Okafor',
  'Nilsson',
  'Raman',
  'Novak',
  'Diallo',
  'Weber',
  'Rossi',
  'Sato',
];
const ROLES = [
  'Shift lead',
  'Barista',
  'Line cook',
  'Host',
  'Driver',
  'Warehouse picker',
  'Cashier',
];
const LOCATIONS = ['Rotterdam', 'Utrecht', 'Antwerp', 'Ghent', 'Eindhoven'];
const STATUSES: readonly Status[] = ['Active', 'Active', 'Active', 'On leave', 'Onboarding'];
const STATUS_VARIANT: Record<Status, BadgeVariant> = {
  Active: 'success',
  'On leave': 'warning',
  Onboarding: 'brand',
};

/** Deterministic fake roster so the demo looks the same on every load. */
function generate(count: number): Employee[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`,
    role: ROLES[(i * 3) % ROLES.length],
    location: LOCATIONS[(i * 5) % LOCATIONS.length],
    hours: 16 + ((i * 11) % 25),
    status: STATUSES[(i * 13) % STATUSES.length],
  }));
}

const trackById = (row: Employee): number => row.id;

@Component({
  selector: 'app-ds-data',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BadgeComponent,
    BreadcrumbsComponent,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    PageHeaderComponent,
    PaginationComponent,
    TableComponent,
  ],
  template: `
    <section class="flex flex-col gap-8" aria-labelledby="ds-data-title">
      <h2 id="ds-data-title" class="font-title text-3xl font-semibold">Data display</h2>

      <ng-template #statusCell let-row>
        <ui-badge [variant]="statusVariant(row.status)">{{ row.status }}</ui-badge>
      </ng-template>

      <div class="flex flex-col gap-3">
        <h3 class="font-title text-xl font-semibold">Page header and breadcrumbs</h3>
        <ui-card>
          <ui-page-header
            title="Employees"
            description="Everyone on the roster across all locations."
          >
            <ui-breadcrumbs breadcrumbs [items]="crumbs" />
            <button actions ui-button variant="secondary" type="button">Export</button>
            <button actions ui-button type="button">Add employee</button>
          </ui-page-header>
        </ui-card>
      </div>

      <div class="flex flex-col gap-3">
        <h3 class="font-title text-xl font-semibold">Card</h3>
        <div class="grid gap-4 md:grid-cols-2">
          <ui-card>
            <h4 card-header class="font-title text-lg font-semibold">Padded</h4>
            <p class="text-base text-foreground-subtle">
              Week 46 coverage is at 94% of planned hours.
            </p>
            <div card-footer class="text-sm text-foreground-subtle">Updated 09:15</div>
          </ui-card>
          <ui-card padding="flush">
            <h4 card-header class="font-title text-lg font-semibold">Flush</h4>
            <ul class="divide-y divide-border-subtle text-base">
              <li class="px-4 py-2">Rotterdam: 42 scheduled</li>
              <li class="px-4 py-2">Utrecht: 31 scheduled</li>
            </ul>
          </ui-card>
        </div>
      </div>

      <div class="flex flex-col gap-3">
        <h3 class="font-title text-xl font-semibold">Empty state</h3>
        <ui-card>
          <ui-empty-state
            icon="calendar"
            title="No shifts this week"
            message="Create the first shift or copy last week's schedule."
          >
            <button empty-action ui-button type="button">Copy last week</button>
          </ui-empty-state>
        </ui-card>
      </div>

      <div class="flex flex-col gap-3">
        <h3 class="font-title text-xl font-semibold">Table: default with pagination</h3>
        <p class="text-base text-foreground-subtle">
          Sorting and paging are done by the host (here in memory), as they would be with a server.
        </p>
        <ui-card padding="flush">
          <ui-table
            label="Employees, paged"
            [columns]="columns()"
            [rows]="pageRows()"
            [trackBy]="trackById"
            [manualSort]="true"
            [(sort)]="pagedSort"
          />
          <div card-footer>
            <ui-pagination [total]="roster.length" [(page)]="page" [(pageSize)]="pageSize" />
          </div>
        </ui-card>
      </div>

      <div class="flex flex-col gap-3">
        <h3 class="font-title text-xl font-semibold">Table: loading</h3>
        <ui-card padding="flush">
          <ui-table label="Employees, loading" [columns]="columns()" [rows]="[]" loading />
        </ui-card>
      </div>

      <div class="flex flex-col gap-3">
        <h3 class="font-title text-xl font-semibold">Table: empty</h3>
        <ui-card padding="flush">
          <ui-table
            label="Employees, empty"
            [columns]="columns()"
            [rows]="[]"
            emptyTitle="No employees match"
            emptyMessage="Try a different location or clear the filters."
            emptyIcon="search"
          >
            <button empty-action ui-button variant="secondary" type="button">Clear filters</button>
          </ui-table>
        </ui-card>
      </div>

      <div class="flex flex-col gap-3">
        <h3 class="font-title text-xl font-semibold">Table: sorted, dense</h3>
        <ui-card padding="flush">
          <ui-table
            label="Employees, sorted by hours"
            [columns]="columns()"
            [rows]="smallRoster"
            [trackBy]="trackById"
            [sort]="hoursDesc"
            dense
          />
        </ui-card>
      </div>

      <div class="flex flex-col gap-3">
        <h3 class="font-title text-xl font-semibold">Table: selectable, clickable rows</h3>
        <p class="text-base text-foreground-subtle" aria-live="polite">
          {{ selected().length }} selected{{ lastOpened() ? '. Opened ' + lastOpened() : '' }}
        </p>
        <ui-card padding="flush">
          <ui-table
            label="Employees, selectable"
            [columns]="columns()"
            [rows]="smallRoster"
            [trackBy]="trackById"
            selectable
            rowClickable
            [(selected)]="selected"
            [rowSelectLabel]="selectLabel"
            (rowClick)="lastOpened.set($event.name)"
          />
        </ui-card>
      </div>

      <div class="flex flex-col gap-3">
        <h3 class="font-title text-xl font-semibold">Table: virtual, 5000 rows</h3>
        <ui-card padding="flush">
          <ui-table
            label="Employees, virtual"
            [columns]="columns()"
            [rows]="bigRoster"
            [trackBy]="trackById"
            virtual
            dense
            height="20rem"
          />
        </ui-card>
      </div>
    </section>
  `,
})
export class DataSectionComponent {
  protected readonly roster = generate(143);
  protected readonly smallRoster = generate(6);
  protected readonly bigRoster = generate(5000);
  protected readonly trackById = trackById;
  protected readonly hoursDesc: TableSort = { key: 'hours', direction: 'desc' };
  protected readonly crumbs: BreadcrumbItem[] = [
    { label: 'Home', link: '/' },
    { label: 'People', link: '/people' },
    { label: 'Employees' },
  ];

  private readonly statusCell =
    viewChild.required<TemplateRef<TableCellContext<Employee>>>('statusCell');

  protected readonly columns = computed<TableColumn<Employee>[]>(() => [
    { key: 'name', header: 'Name', sortable: true, width: 'minmax(0, 2fr)' },
    { key: 'role', header: 'Role', sortable: true },
    { key: 'location', header: 'Location', sortable: true },
    { key: 'hours', header: 'Hours / week', sortable: true, align: 'end', width: '8rem' },
    { key: 'status', header: 'Status', cell: this.statusCell(), width: '8rem' },
  ]);

  protected readonly page = signal(1);
  protected readonly pageSize = signal(10);
  protected readonly pagedSort = signal<TableSort | null>(null);
  protected readonly selected = signal<readonly Employee[]>([
    this.smallRoster[1],
    this.smallRoster[3],
  ]);
  protected readonly lastOpened = signal('');
  protected readonly selectLabel = (row: Employee): string => `Select ${row.name}`;

  protected readonly pageRows = computed(() => {
    const sort = this.pagedSort();
    const sorted = sort ? [...this.roster].sort((a, b) => compare(a, b, sort)) : this.roster;
    const start = (this.page() - 1) * this.pageSize();
    return sorted.slice(start, start + this.pageSize());
  });

  protected statusVariant(status: Status): BadgeVariant {
    return STATUS_VARIANT[status];
  }
}

function compare(a: Employee, b: Employee, sort: TableSort): number {
  const key = sort.key as keyof Employee;
  const x = a[key];
  const y = b[key];
  const result =
    typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
  return sort.direction === 'asc' ? result : -result;
}
