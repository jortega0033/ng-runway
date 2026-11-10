import {
  CdkFixedSizeVirtualScroll,
  CdkVirtualForOf,
  CdkVirtualScrollViewport,
} from '@angular/cdk/scrolling';
import { NgTemplateOutlet } from '@angular/common';
import type { TemplateRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
  model,
  numberAttribute,
  output,
} from '@angular/core';
import { EmptyStateComponent } from '../empty-state/empty-state';
import { IconComponent, type IconName } from '../icon/icon';
import { SkeletonComponent } from '../skeleton/skeleton';

export type TableValue = string | number | boolean | Date | null | undefined;
export type SortDirection = 'asc' | 'desc';
export type TableAlign = 'start' | 'center' | 'end';

export interface TableSort {
  readonly key: string;
  readonly direction: SortDirection;
}

/** Context handed to a column's `cell` template: `let-row` or `let-row="row"`. */
export interface TableCellContext<T> {
  $implicit: T;
  row: T;
  column: TableColumn<T>;
  index: number;
}

export interface TableColumn<T> {
  /** Unique key. Also the default property read from the row and the key used in `sort`. */
  readonly key: string;
  readonly header: string;
  readonly sortable?: boolean;
  /** Custom cell content. Wins over `accessor`. */
  readonly cell?: TemplateRef<TableCellContext<T>>;
  /** Plain value for the cell and for client-side sorting. Defaults to `row[key]`. */
  readonly accessor?: (row: T) => TableValue;
  readonly align?: TableAlign;
  /** Any CSS grid track size, e.g. `8rem` or `minmax(0, 2fr)`. Defaults to an equal share. */
  readonly width?: string;
}

const ALIGN_TEXT: Record<TableAlign, string> = {
  start: 'text-left',
  center: 'text-center',
  end: 'text-right',
};
const ALIGN_FLEX: Record<TableAlign, string> = {
  start: 'justify-start text-left',
  center: 'justify-center text-center',
  end: 'justify-end text-right',
};

function readValue<T>(column: TableColumn<T>, row: T): TableValue {
  if (column.accessor) return column.accessor(row);
  const value = (row as Record<string, unknown>)[column.key];
  switch (typeof value) {
    case 'string':
    case 'number':
    case 'boolean':
      return value;
    default:
      return value instanceof Date ? value : null;
  }
}

function compareValues(a: TableValue, b: TableValue): number {
  const aEmpty = a === null || a === undefined;
  const bEmpty = b === null || b === undefined;
  if (aEmpty || bEmpty) return aEmpty ? (bEmpty ? 0 : -1) : 1;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

/** Next sort in the click cycle: ascending, descending, off. */
export function nextSort(current: TableSort | null, key: string): TableSort | null {
  if (current?.key !== key) return { key, direction: 'asc' };
  return current.direction === 'asc' ? { key, direction: 'desc' } : null;
}

/**
 * Typed data table built on ARIA table roles and CSS grid so the sticky header, the
 * selection column and the virtual-scroll body share one column layout.
 *
 * It sorts the rows it is given (set `manualSort` when the server sorts) and never pages:
 * pair it with `ui-pagination` and load the page yourself.
 */
@Component({
  selector: 'ui-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    CdkVirtualScrollViewport,
    CdkFixedSizeVirtualScroll,
    CdkVirtualForOf,
    EmptyStateComponent,
    IconComponent,
    SkeletonComponent,
  ],
  host: { class: 'block' },
  template: `
    <div
      role="table"
      class="rounded-lg border border-border-subtle bg-background-surface-page text-base text-foreground"
      [class]="virtual() ? 'flex flex-col overflow-hidden' : 'overflow-auto'"
      [style.max-height]="virtual() ? null : height()"
      [attr.aria-label]="label()"
      [attr.aria-busy]="loading() ? 'true' : null"
      [attr.aria-rowcount]="view().length + 1"
    >
      <div
        role="rowgroup"
        class="sticky top-0 z-10 border-b border-border-subtle bg-background-muted [scrollbar-gutter:stable] overflow-y-hidden"
      >
        <div
          role="row"
          aria-rowindex="1"
          class="grid items-center gap-x-3 px-3"
          [style.grid-template-columns]="template()"
          [style.height.px]="rowHeight()"
        >
          @if (selectable()) {
            <div role="columnheader" class="flex items-center">
              <input
                type="checkbox"
                class="size-4 accent-background-primary outline-offset-2 focus-visible:outline-2 focus-visible:outline-border-brand"
                [checked]="allSelected()"
                [indeterminate]="someSelected()"
                [disabled]="view().length === 0"
                [attr.aria-label]="selectAllLabel()"
                (change)="toggleAll()"
              />
            </div>
          }
          @for (column of columns(); track column.key) {
            <div
              role="columnheader"
              class="flex min-w-0 items-center text-sm font-medium text-foreground-subtle"
              [class]="alignFlex(column)"
              [attr.aria-sort]="ariaSort(column)"
            >
              @if (column.sortable) {
                <button
                  type="button"
                  class="inline-flex min-w-0 items-center gap-1 rounded-xs outline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-border-brand"
                  (click)="toggleSort(column)"
                >
                  <span class="truncate">{{ column.header }}</span>
                  <ui-icon
                    [name]="sortIcon(column)"
                    [size]="16"
                    [class.opacity-50]="sort()?.key !== column.key"
                  />
                </button>
              } @else {
                <span class="truncate">{{ column.header }}</span>
              }
            </div>
          }
        </div>
      </div>

      @if (loading()) {
        <div role="rowgroup">
          @for (n of skeletonIndexes(); track n) {
            <div
              role="row"
              class="grid items-center gap-x-3 border-b border-border-subtle px-3"
              [style.grid-template-columns]="template()"
              [style.height.px]="rowHeight()"
            >
              @if (selectable()) {
                <div role="cell"></div>
              }
              @for (column of columns(); track column.key) {
                <div role="cell"><ui-skeleton class="h-4 w-3/4" /></div>
              }
            </div>
          }
        </div>
      } @else if (view().length === 0) {
        <div role="rowgroup">
          <div role="row">
            <div role="cell" [attr.aria-colspan]="columnCount()">
              <ui-empty-state
                [title]="emptyTitle()"
                [message]="emptyMessage()"
                [icon]="emptyIcon()"
              >
                <ng-content select="[empty-action]" ngProjectAs="[empty-action]" />
              </ui-empty-state>
            </div>
          </div>
        </div>
      } @else if (virtual()) {
        <cdk-virtual-scroll-viewport
          role="rowgroup"
          tabindex="0"
          class="[scrollbar-gutter:stable] outline-offset-[-2px] focus-visible:outline-2 focus-visible:outline-border-brand"
          [itemSize]="rowHeight()"
          [style.height]="height() ?? '24rem'"
        >
          <ng-container *cdkVirtualFor="let row of view(); let i = index; trackBy: trackRow">
            <ng-container *ngTemplateOutlet="rowTemplate; context: { $implicit: row, index: i }" />
          </ng-container>
        </cdk-virtual-scroll-viewport>
      } @else {
        <div role="rowgroup">
          @for (row of view(); track trackBy()(row); let i = $index) {
            <ng-container *ngTemplateOutlet="rowTemplate; context: { $implicit: row, index: i }" />
          }
        </div>
      }
    </div>

    <ng-template #rowTemplate let-row let-i="index">
      <div
        role="row"
        class="grid items-center gap-x-3 border-b border-border-subtle px-3 outline-offset-[-2px] focus-visible:outline-2 focus-visible:outline-border-brand"
        [class]="rowClasses(row)"
        [style.grid-template-columns]="template()"
        [style.height.px]="rowHeight()"
        [attr.aria-rowindex]="i + 2"
        [attr.tabindex]="rowsClickable() ? 0 : null"
        (click)="onRowClick(row, $event)"
        (keydown)="onRowKeydown(row, $event)"
      >
        @if (selectable()) {
          <div role="cell" class="flex items-center">
            <input
              type="checkbox"
              class="size-4 accent-background-primary outline-offset-2 focus-visible:outline-2 focus-visible:outline-border-brand"
              [checked]="isSelected(row)"
              [attr.aria-label]="rowSelectLabel()(row)"
              (change)="toggleRow(row)"
            />
          </div>
        }
        @for (column of columns(); track column.key) {
          <div role="cell" class="min-w-0 truncate" [class]="alignText(column)">
            @if (column.cell; as cell) {
              <ng-container
                *ngTemplateOutlet="
                  cell;
                  context: { $implicit: row, row: row, column: column, index: i }
                "
              />
            } @else {
              {{ display(column, row) }}
            }
          </div>
        }
      </div>
    </ng-template>
  `,
})
export class TableComponent<T> {
  readonly columns = input.required<readonly TableColumn<T>[]>();
  readonly rows = input.required<readonly T[]>();
  /** Stable identity per row, used for tracking and for the selection. Defaults to the row itself. */
  readonly trackBy = input<(row: T) => unknown>((row) => row);
  /** Accessible name of the table. */
  readonly label = input.required<string>();

  /** Current sort, or `null`. Two-way bindable; changes when a sortable header is activated. */
  readonly sort = model<TableSort | null>(null);
  /** Skip the built-in client-side sort, e.g. when the server returns rows already sorted. */
  readonly manualSort = input(false, { transform: booleanAttribute });

  readonly loading = input(false, { transform: booleanAttribute });
  readonly skeletonRows = input(5, { transform: numberAttribute });
  readonly emptyTitle = input('Nothing to show');
  readonly emptyMessage = input('');
  readonly emptyIcon = input<IconName>('list');

  readonly selectable = input(false, { transform: booleanAttribute });
  readonly selected = model<readonly T[]>([]);
  readonly selectAllLabel = input('Select all rows');
  readonly rowSelectLabel = input<(row: T) => string>(() => 'Select row');

  /** Emitted when a row is clicked or activated with Enter or Space. Needs `rowClickable`. */
  readonly rowClick = output<T>();
  readonly rowClickable = input(false, { transform: booleanAttribute });

  readonly dense = input(false, { transform: booleanAttribute });
  /** Render only the visible window of rows (CDK virtual scroll). Use for 1000+ rows. */
  readonly virtual = input(false, { transform: booleanAttribute });
  /** Body height for `virtual` (default 24rem); max height of the scroll area otherwise. */
  readonly height = input<string | null>(null);

  protected readonly rowHeight = computed(() => (this.dense() ? 32 : 44));
  protected readonly rowsClickable = this.rowClickable;
  protected readonly columnCount = computed(
    () => this.columns().length + (this.selectable() ? 1 : 0),
  );
  protected readonly skeletonIndexes = computed(() =>
    Array.from({ length: Math.max(0, this.skeletonRows()) }, (_, i) => i),
  );

  protected readonly template = computed(() => {
    const tracks = this.columns().map((c) => c.width ?? 'minmax(0, 1fr)');
    return (this.selectable() ? ['1.25rem', ...tracks] : tracks).join(' ');
  });

  /** Rows as displayed: sorted unless `manualSort` is set. */
  protected readonly view = computed<readonly T[]>(() => {
    const rows = this.rows();
    const sort = this.sort();
    if (!sort || this.manualSort()) return rows;
    const column = this.columns().find((c) => c.key === sort.key);
    if (!column) return rows;
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...rows].sort(
      (a, b) => factor * compareValues(readValue(column, a), readValue(column, b)),
    );
  });

  private readonly selectedKeys = computed(() => new Set(this.selected().map(this.trackBy())));
  protected readonly allSelected = computed(
    () => this.view().length > 0 && this.view().every((row) => this.isSelected(row)),
  );
  protected readonly someSelected = computed(
    () => !this.allSelected() && this.view().some((row) => this.isSelected(row)),
  );

  /** `trackBy` in the shape cdkVirtualFor wants. */
  protected readonly trackRow = (_: number, row: T): unknown => this.trackBy()(row);

  protected display(column: TableColumn<T>, row: T): string {
    const value = readValue(column, row);
    if (value === null || value === undefined) return '';
    return value instanceof Date ? value.toLocaleDateString() : String(value);
  }

  protected alignText(column: TableColumn<T>): string {
    return ALIGN_TEXT[column.align ?? 'start'];
  }

  protected alignFlex(column: TableColumn<T>): string {
    return ALIGN_FLEX[column.align ?? 'start'];
  }

  protected ariaSort(column: TableColumn<T>): 'ascending' | 'descending' | 'none' | null {
    if (!column.sortable) return null;
    const sort = this.sort();
    if (sort?.key !== column.key) return 'none';
    return sort.direction === 'asc' ? 'ascending' : 'descending';
  }

  protected sortIcon(column: TableColumn<T>): IconName {
    const sort = this.sort();
    if (sort?.key !== column.key) return 'sort';
    return sort.direction === 'asc' ? 'arrow-up' : 'arrow-down';
  }

  protected toggleSort(column: TableColumn<T>): void {
    this.sort.set(nextSort(this.sort(), column.key));
  }

  protected isSelected(row: T): boolean {
    return this.selectedKeys().has(this.trackBy()(row));
  }

  protected toggleRow(row: T): void {
    const key = this.trackBy()(row);
    this.selected.set(
      this.isSelected(row)
        ? this.selected().filter((r) => this.trackBy()(r) !== key)
        : [...this.selected(), row],
    );
  }

  protected toggleAll(): void {
    const visible = this.view();
    if (this.allSelected()) {
      const hidden = new Set(visible.map(this.trackBy()));
      this.selected.set(this.selected().filter((r) => !hidden.has(this.trackBy()(r))));
    } else {
      this.selected.set([...this.selected(), ...visible.filter((r) => !this.isSelected(r))]);
    }
  }

  protected rowClasses(row: T): string {
    const parts = [this.isSelected(row) ? 'bg-background-brand-subtle' : ''];
    if (this.rowsClickable()) parts.push('cursor-pointer hover:bg-background-hover');
    return parts.join(' ');
  }

  protected onRowClick(row: T, event: Event): void {
    if (!this.rowsClickable()) return;
    const target = event.target as HTMLElement;
    // Clicks on controls inside the row (checkbox, links, buttons) are theirs, not a row activation.
    if (target.closest('button, a, input, select, textarea') !== null) return;
    this.rowClick.emit(row);
  }

  protected onRowKeydown(row: T, event: KeyboardEvent): void {
    if (!this.rowsClickable() || event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.rowClick.emit(row);
    }
  }
}
