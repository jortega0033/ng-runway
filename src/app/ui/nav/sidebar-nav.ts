import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { BadgeComponent } from '../badge/badge';
import { IconComponent, type IconName } from '../icon/icon';

/** Plain navigation data. Role filtering is the caller's job: pass only the items the user may see. */
export interface NavItem {
  label: string;
  /** Required for the collapsed (icon-only) mode; child items may omit it. */
  icon?: IconName;
  /** Router path. Omit on a group header. */
  link?: string;
  /** Count or short status shown at the end of the row. */
  badge?: string | number;
  children?: readonly NavItem[];
  /** Carried for the caller's own filtering; the component does not read it. */
  roles?: readonly string[];
  /** Initial state of a group. */
  expanded?: boolean;
  /** Match the link exactly (use for '/' or a section root). */
  exact?: boolean;
}

let nextNav = 0;

const TIP =
  'pointer-events-none absolute left-full z-10 ml-2 hidden whitespace-nowrap rounded-md bg-background-inverted ' +
  'px-2 py-1 text-sm text-foreground-inverted shadow-md group-hover/row:block group-focus-visible/row:block';

const ROW =
  'group/row relative flex h-9 w-full items-center gap-3 rounded-md px-3 text-base text-foreground-subtle ' +
  'hover:bg-background-hover hover:text-foreground outline-offset-2 focus-visible:outline-2 ' +
  'focus-visible:outline-border-brand motion-reduce:transition-none';

const LINK_ACTIVE =
  ' aria-[current=page]:bg-background-brand-subtle aria-[current=page]:font-medium aria-[current=page]:text-foreground-brand-strong';

/**
 * Vertical navigation landmark. Links get `aria-current="page"` through routerLinkActive, groups are
 * disclosure buttons (Enter / Space), and `collapsed` shrinks every row to an icon with a tooltip.
 */
@Component({
  selector: 'ui-sidebar-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, RouterLink, RouterLinkActive, IconComponent, BadgeComponent],
  host: { class: 'block' },
  template: `
    <nav [attr.aria-label]="label()">
      <ul class="m-0 flex list-none flex-col gap-0.5 p-0">
        @for (item of items(); track item.label) {
          <li>
            @if (item.children?.length) {
              <button
                type="button"
                [class]="rowClass"
                [attr.aria-expanded]="isOpen(item)"
                [attr.aria-controls]="groupId + '-' + $index"
                [attr.aria-label]="collapsed() ? item.label : null"
                (click)="toggle(item)"
              >
                @if (item.icon) {
                  <ui-icon [name]="item.icon" />
                }
                @if (!collapsed()) {
                  <span class="min-w-0 flex-1 truncate text-left">{{ item.label }}</span>
                  <ui-icon [name]="isOpen(item) ? 'chevron-up' : 'chevron-down'" [size]="16" />
                } @else {
                  <span [class]="tipClass" aria-hidden="true">{{ item.label }}</span>
                }
              </button>
              @if (isOpen(item)) {
                <ul
                  [id]="groupId + '-' + $index"
                  class="m-0 mt-0.5 flex list-none flex-col gap-0.5 p-0"
                  [class.pl-4]="!collapsed()"
                >
                  @for (child of item.children; track child.label) {
                    <li>
                      <ng-container
                        *ngTemplateOutlet="leaf; context: { $implicit: child, fallback: item.icon }"
                      />
                    </li>
                  }
                </ul>
              }
            } @else {
              <ng-container *ngTemplateOutlet="leaf; context: { $implicit: item }" />
            }
          </li>
        }
      </ul>
    </nav>

    <ng-template #leaf let-item let-fallback="fallback">
      <a
        [class]="linkClass"
        [routerLink]="item.link"
        routerLinkActive="is-active"
        ariaCurrentWhenActive="page"
        [routerLinkActiveOptions]="{ exact: item.exact ?? false }"
      >
        @if (item.icon ?? fallback) {
          <ui-icon [name]="item.icon ?? fallback" />
        }
        <span [class]="collapsed() ? 'sr-only' : 'min-w-0 flex-1 truncate'">{{ item.label }}</span>
        @if (item.badge !== undefined) {
          @if (collapsed()) {
            <span class="sr-only">, {{ item.badge }}</span>
          } @else {
            <ui-badge variant="brand">{{ item.badge }}</ui-badge>
          }
        }
        @if (collapsed()) {
          <span [class]="tipClass" aria-hidden="true">{{ item.label }}</span>
        }
      </a>
    </ng-template>
  `,
})
export class SidebarNavComponent {
  protected readonly rowClass = ROW;
  protected readonly linkClass = ROW + LINK_ACTIVE;
  protected readonly tipClass = TIP;
  protected readonly groupId = `ui-nav-${nextNav++}`;
  private readonly toggled = signal<ReadonlyMap<string, boolean>>(new Map());

  readonly items = input.required<readonly NavItem[]>();
  /** Icon-only rows with a tooltip on hover and focus. */
  readonly collapsed = input(false);
  /** Accessible name of the nav landmark. */
  readonly label = input('Main navigation');

  protected isOpen(item: NavItem): boolean {
    return this.toggled().get(item.label) ?? item.expanded ?? false;
  }

  protected toggle(item: NavItem): void {
    this.toggled.update((map) => new Map(map).set(item.label, !this.isOpen(item)));
  }
}
