import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { IconComponent } from '../icon/icon';
import { CONTROL_BASE, CONTROL_OK, CONTROL_SIZES } from '../input/input';

export type PageItem = number | 'ellipsis';

/** Number of pages for `total` items. Always at least 1 so the control never shows "page 1 of 0". */
export function pageCount(total: number, pageSize: number): number {
  if (total <= 0 || pageSize <= 0) return 1;
  return Math.ceil(total / pageSize);
}

/**
 * Page buttons to show. Up to 7 slots: first, last, the current page with one neighbour each side
 * and ellipses for the gaps. The slot count stays constant so the control does not jump around.
 */
export function pageItems(page: number, count: number): PageItem[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const current = Math.min(Math.max(page, 1), count);
  if (current <= 4) return [1, 2, 3, 4, 5, 'ellipsis', count];
  if (current >= count - 3)
    return [1, 'ellipsis', count - 4, count - 3, count - 2, count - 1, count];
  return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', count];
}

const NAV_BUTTON =
  'inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-base text-foreground ' +
  'outline-offset-2 transition-colors hover:bg-background-hover active:bg-background-press ' +
  'focus-visible:outline-2 focus-visible:outline-border-brand ' +
  'aria-disabled:cursor-not-allowed aria-disabled:text-foreground-disabled aria-disabled:hover:bg-transparent';

/**
 * Page controls for server-side or client-side lists. It only edits `page` and `pageSize`;
 * the host loads the data. Changing the page size returns to page 1.
 */
@Component({
  selector: 'ui-pagination',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: { class: 'flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-base' },
  template: `
    <p class="text-foreground-subtle" aria-live="polite">{{ summary() }}</p>
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
      @if (pageSizeOptions().length > 0) {
        <div class="flex items-center gap-2">
          <label class="text-foreground-subtle" [for]="sizeId">{{ pageSizeLabel() }}</label>
          <div class="w-20">
            <select #size [id]="sizeId" [class]="sizeClasses" (change)="onSizeChange(size.value)">
              @for (option of pageSizeOptions(); track option) {
                <option [value]="option" [selected]="option === pageSize()">{{ option }}</option>
              }
            </select>
          </div>
        </div>
      }
      <nav [attr.aria-label]="label()">
        <ul class="flex items-center gap-1">
          <li>
            <button
              type="button"
              [class]="navButton"
              [attr.aria-disabled]="current() <= 1 ? 'true' : null"
              [attr.aria-label]="previousLabel()"
              (click)="go(current() - 1)"
            >
              <ui-icon name="chevron-left" [size]="16" />
            </button>
          </li>
          @for (item of items(); track $index) {
            <li>
              @if (item === 'ellipsis') {
                <span
                  class="inline-flex h-8 min-w-8 items-center justify-center text-foreground-subtle"
                  >&hellip;</span
                >
              } @else {
                <button
                  type="button"
                  [class]="
                    navButton +
                    (item === current()
                      ? ' bg-background-brand-subtle font-medium text-foreground-brand'
                      : '')
                  "
                  [attr.aria-label]="pageLabel()(item)"
                  [attr.aria-current]="item === current() ? 'page' : null"
                  (click)="go(item)"
                >
                  {{ item }}
                </button>
              }
            </li>
          }
          <li>
            <button
              type="button"
              [class]="navButton"
              [attr.aria-disabled]="current() >= count() ? 'true' : null"
              [attr.aria-label]="nextLabel()"
              (click)="go(current() + 1)"
            >
              <ui-icon name="chevron-right" [size]="16" />
            </button>
          </li>
        </ul>
      </nav>
    </div>
  `,
})
export class PaginationComponent {
  private static nextId = 0;

  /** Current page, starting at 1. */
  readonly page = model(1);
  readonly pageSize = model(20);
  /** Total number of items across all pages. */
  readonly total = input.required<number>();
  readonly pageSizeOptions = input<readonly number[]>([10, 20, 50, 100]);
  readonly label = input('Pagination');
  readonly previousLabel = input('Previous page');
  readonly nextLabel = input('Next page');
  readonly pageSizeLabel = input('Rows per page');
  readonly pageLabel = input<(page: number) => string>((page) => `Page ${page}`);
  /** Range text, e.g. "1-20 of 143". Callers pass a translated function. `start` and `end` are 0 when empty. */
  readonly summaryLabel = input<(range: { start: number; end: number; total: number }) => string>(
    ({ start, end, total }) => (total <= 0 ? '0 of 0' : `${start}-${end} of ${total}`),
  );

  protected readonly sizeId = `ui-pagination-size-${PaginationComponent.nextId++}`;
  protected readonly navButton = NAV_BUTTON;
  protected readonly sizeClasses = `${CONTROL_BASE} ${CONTROL_OK} ${CONTROL_SIZES.sm}`;

  protected readonly count = computed(() => pageCount(this.total(), this.pageSize()));
  /** Page clamped into range, in case `total` shrank after a filter. */
  protected readonly current = computed(() => Math.min(Math.max(this.page(), 1), this.count()));
  protected readonly items = computed(() => pageItems(this.current(), this.count()));
  protected readonly summary = computed(() => {
    const total = this.total();
    if (total <= 0) return this.summaryLabel()({ start: 0, end: 0, total: 0 });
    const start = (this.current() - 1) * this.pageSize() + 1;
    const end = Math.min(start + this.pageSize() - 1, total);
    return this.summaryLabel()({ start, end, total });
  });

  protected go(page: number): void {
    // Prev/next use aria-disabled (stay focusable), so out-of-range clicks land here and are clamped.
    const next = Math.min(Math.max(page, 1), this.count());
    if (next !== this.page()) this.page.set(next);
  }

  protected onSizeChange(value: string): void {
    const size = Number(value);
    if (!Number.isFinite(size) || size <= 0) return;
    this.pageSize.set(size);
    this.page.set(1);
  }
}
