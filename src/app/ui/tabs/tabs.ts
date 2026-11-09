import { Tab, TabContent, TabList, TabPanel, Tabs } from '@angular/aria/tabs';
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  TemplateRef,
  booleanAttribute,
  computed,
  contentChild,
  contentChildren,
  input,
  model,
  viewChild,
} from '@angular/core';

/** Marks an `<ng-template>` inside `ui-tab` whose content is only created once the tab is opened. */
// eslint-disable-next-line @angular-eslint/directive-selector -- UI library prefix is `ui`
@Directive({ selector: 'ng-template[uiTabContent]' })
export class TabContentDirective {}

/** One tab: `label` goes in the tab list, the content in the panel. */
@Component({
  selector: 'ui-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-template #body><ng-content /></ng-template>`,
})
export class TabComponent {
  readonly value = input.required<string>();
  readonly label = input.required<string>();
  readonly disabled = input(false, { transform: booleanAttribute });

  private readonly body = viewChild.required<TemplateRef<unknown>>('body');
  private readonly lazy = contentChild(TabContentDirective, { read: TemplateRef });

  /** The lazy template when one is given, otherwise the projected content. */
  readonly content = computed(() => this.lazy() ?? this.body());
}

/**
 * Tab list and panels on top of the @angular/aria tabs. Arrow keys move between tabs
 * (and select them when `selectionMode` is "follow"), Home and End jump to the ends.
 *
 * ```html
 * <ui-tabs [(value)]="tab" ariaLabel="Employee sections">
 *   <ui-tab value="overview" label="Overview"> ... </ui-tab>
 *   <ui-tab value="leave" label="Leave"><ng-template uiTabContent>...</ng-template></ui-tab>
 * </ui-tabs>
 * ```
 */
@Component({
  selector: 'ui-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Tabs, TabList, Tab, TabPanel, TabContent, NgTemplateOutlet],
  host: {
    class: 'flex',
    '[class.flex-col]': 'orientation() === "horizontal"',
    '[class.flex-row]': 'orientation() === "vertical"',
    '[class.gap-4]': 'orientation() === "vertical"',
  },
  template: `
    <div ngTabs class="contents">
      <div
        ngTabList
        [orientation]="orientation()"
        [softDisabled]="false"
        [selectionMode]="selectionMode()"
        [selectedTab]="current()"
        [attr.aria-label]="ariaLabel() || null"
        (selectedTabChange)="value.set($event)"
        class="flex shrink-0 gap-1 border-border"
        [class]="orientation() === 'horizontal' ? 'flex-row border-b' : 'flex-col border-r pr-2'"
      >
        @for (t of tabs(); track t.value()) {
          <button
            ngTab
            type="button"
            [value]="t.value()"
            [disabled]="t.disabled()"
            class="inline-flex items-center whitespace-nowrap px-3 text-base text-foreground-subtle outline-offset-[-2px] transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-border-brand aria-disabled:cursor-not-allowed aria-disabled:text-foreground-disabled aria-disabled:hover:text-foreground-disabled aria-selected:font-medium aria-selected:text-foreground"
            [class]="
              orientation() === 'horizontal'
                ? 'h-10 aria-selected:shadow-tab-active'
                : 'h-9 rounded-md aria-selected:bg-background-brand-subtle aria-selected:text-foreground-brand-strong'
            "
          >
            {{ t.label() }}
          </button>
        }
      </div>
      @for (t of tabs(); track t.value()) {
        <div
          ngTabPanel
          [value]="t.value()"
          class="min-w-0 flex-1 pt-4 outline-offset-2 focus-visible:outline-2 focus-visible:outline-border-brand"
        >
          <ng-template ngTabContent>
            <ng-container [ngTemplateOutlet]="t.content()" />
          </ng-template>
        </div>
      }
    </div>
  `,
})
export class TabsComponent {
  protected readonly tabs = contentChildren(TabComponent);

  /** Value of the selected tab. Defaults to the first enabled tab. */
  readonly value = model<string>();
  readonly orientation = input<'horizontal' | 'vertical'>('horizontal');
  readonly selectionMode = input<'follow' | 'explicit'>('follow');
  readonly ariaLabel = input('');

  protected readonly current = computed(
    () =>
      this.value() ??
      this.tabs()
        .find((t) => !t.disabled())
        ?.value(),
  );
}
