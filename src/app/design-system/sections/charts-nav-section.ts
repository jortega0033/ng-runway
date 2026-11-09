import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  BarChartComponent,
  IconComponent,
  LineChartComponent,
  SidebarNavComponent,
  TopBarComponent,
  type ChartSeries,
  type NavItem,
} from '@ui/index';

@Component({
  selector: 'app-ds-charts-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BarChartComponent,
    LineChartComponent,
    SidebarNavComponent,
    TopBarComponent,
    IconComponent,
  ],
  template: `
    <section class="flex flex-col gap-8">
      <h2 class="font-title text-3xl text-foreground">Charts</h2>

      <div class="grid gap-8 lg:grid-cols-2">
        <div class="flex flex-col gap-2">
          <h3 class="font-title text-xl text-foreground">Bar chart, single series</h3>
          <ui-bar-chart
            label="Open shifts per weekday"
            [series]="openShifts"
            [categories]="weekdays"
          />
        </div>
        <div class="flex flex-col gap-2">
          <h3 class="font-title text-xl text-foreground">Bar chart, grouped</h3>
          <ui-bar-chart
            label="Planned and worked hours per weekday"
            [series]="hours"
            [categories]="weekdays"
            [format]="hoursFormat"
          />
        </div>
        <div class="flex flex-col gap-2">
          <h3 class="font-title text-xl text-foreground">Bar chart, stacked</h3>
          <ui-bar-chart
            label="Absence days by type per month"
            [series]="absences"
            [categories]="months"
            stacked
          />
        </div>
        <div class="flex flex-col gap-2">
          <h3 class="font-title text-xl text-foreground">Bar chart, empty</h3>
          <ui-bar-chart
            label="Overtime hours"
            [series]="[]"
            [categories]="weekdays"
            emptyText="No overtime recorded this period"
          />
        </div>
        <div class="flex flex-col gap-2">
          <h3 class="font-title text-xl text-foreground">Line chart, multi series</h3>
          <ui-line-chart label="Headcount by site" [series]="headcount" [categories]="months" />
        </div>
        <div class="flex flex-col gap-2">
          <h3 class="font-title text-xl text-foreground">Line chart, single series with area</h3>
          <ui-line-chart
            label="Berlin Mitte headcount"
            [series]="[headcount[0]]"
            [categories]="months"
            area
          />
        </div>
      </div>

      <h2 class="font-title text-3xl text-foreground">Top bar</h2>
      <div class="overflow-hidden rounded-lg border border-border">
        <ui-top-bar>
          <button
            slot="start"
            type="button"
            class="inline-flex size-8 items-center justify-center rounded-md hover:bg-background-hover outline-offset-2 focus-visible:outline-2 focus-visible:outline-border-brand"
            aria-label="Open menu"
          >
            <ui-icon name="menu" />
          </button>
          <span slot="start" class="font-title text-lg text-foreground">Runway</span>
          <span slot="center" class="text-base text-foreground-subtle">Week 46, Berlin Mitte</span>
          <button
            slot="end"
            type="button"
            class="inline-flex size-8 items-center justify-center rounded-md hover:bg-background-hover outline-offset-2 focus-visible:outline-2 focus-visible:outline-border-brand"
            aria-label="Notifications"
          >
            <ui-icon name="bell" />
          </button>
        </ui-top-bar>
      </div>

      <h2 class="font-title text-3xl text-foreground">Sidebar nav</h2>
      <div class="flex flex-wrap items-start gap-8">
        <div class="flex flex-col gap-2">
          <h3 class="font-title text-xl text-foreground">Expanded</h3>
          <ui-sidebar-nav
            class="w-60 rounded-lg border border-border p-2"
            [items]="items"
            label="Expanded navigation"
          />
        </div>
        <div class="flex flex-col gap-2">
          <h3 class="font-title text-xl text-foreground">Collapsed (icon only)</h3>
          <ui-sidebar-nav
            class="w-14 rounded-lg border border-border p-2"
            [items]="openItems"
            [collapsed]="true"
            label="Collapsed navigation"
          />
        </div>
      </div>
    </section>
  `,
})
export class DsChartsNavComponent {
  protected readonly weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  protected readonly months = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];
  protected readonly hoursFormat = (v: number) => `${v} h`;

  protected readonly openShifts: ChartSeries[] = [
    { name: 'Open shifts', values: [4, 2, 3, 6, 9, 12, 7] },
  ];
  protected readonly hours: ChartSeries[] = [
    { name: 'Planned', values: [212, 208, 214, 220, 230, 160, 96] },
    { name: 'Worked', values: [218, 204, 210, 231, 226, 171, 90] },
  ];
  protected readonly absences: ChartSeries[] = [
    { name: 'Vacation', values: [42, 88, 120, 64, 30, 22] },
    { name: 'Sick leave', values: [18, 14, 12, 20, 28, 34] },
    { name: 'Parental leave', values: [10, 10, 10, 12, 12, 12] },
  ];
  protected readonly headcount: ChartSeries[] = [
    { name: 'Berlin Mitte', values: [118, 121, 125, 124, 128, 131] },
    { name: 'Hamburg Hafen', values: [74, 76, 75, 79, 82, 83] },
    { name: 'Leipzig', values: [41, 40, 44, 46, 45, 49] },
  ];

  protected readonly items: NavItem[] = [
    { label: 'Dashboard', icon: 'home', link: '/dashboard', badge: 3 },
    { label: 'Schedule', icon: 'calendar', link: '/schedule' },
    {
      label: 'People',
      icon: 'users',
      children: [
        { label: 'Employees', link: '/people/employees' },
        { label: 'Teams', link: '/people/teams' },
      ],
    },
    { label: 'Settings', icon: 'settings', link: '/settings' },
  ];
  protected readonly openItems: NavItem[] = this.items.map((item) =>
    item.children ? { ...item, expanded: true } : item,
  );
}
