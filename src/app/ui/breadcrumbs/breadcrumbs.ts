import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../icon/icon';

export interface BreadcrumbItem {
  readonly label: string;
  /** Router link. Items without a link are plain text; the last item is always the current page. */
  readonly link?: string | readonly string[];
}

/** Breadcrumb trail. The last item is the current page (`aria-current="page"`). */
@Component({
  selector: 'ui-breadcrumbs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent],
  host: { class: 'block' },
  template: `
    <nav [attr.aria-label]="label()">
      <ol class="flex flex-wrap items-center gap-1 text-base text-foreground-subtle">
        @for (item of items(); track $index; let last = $last) {
          <li class="inline-flex items-center gap-1">
            @if (last) {
              <span aria-current="page" class="font-medium text-foreground">{{ item.label }}</span>
            } @else if (item.link) {
              <a
                [routerLink]="item.link"
                class="rounded-xs underline-offset-2 outline-offset-2 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-border-brand"
                >{{ item.label }}</a
              >
            } @else {
              <span>{{ item.label }}</span>
            }
            @if (!last) {
              <ui-icon name="chevron-right" [size]="16" />
            }
          </li>
        }
      </ol>
    </nav>
  `,
})
export class BreadcrumbsComponent {
  readonly items = input.required<readonly BreadcrumbItem[]>();
  readonly label = input('Breadcrumb');
}
