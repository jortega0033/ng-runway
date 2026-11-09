import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { HasRoleDirective } from '@core/auth/has-role.directive';
import { PageHeaderComponent, TabComponent, TabContentDirective, TabsComponent } from '@ui/index';
import { TimesheetApprovalsComponent } from './approvals';
import { ClockWidgetComponent } from './clock-widget';
import { WeekViewComponent } from './week-view';

/** Clock widget for everyone, the own week for everyone, and approvals for managers and admins. */
@Component({
  selector: 'app-timesheets-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ClockWidgetComponent,
    HasRoleDirective,
    PageHeaderComponent,
    TabComponent,
    TabContentDirective,
    TabsComponent,
    TimesheetApprovalsComponent,
    TranslocoPipe,
    WeekViewComponent,
  ],
  template: `
    <ui-page-header
      [title]="'timesheets.title' | transloco"
      [description]="'timesheets.description' | transloco"
    />

    <app-clock-widget class="mb-6 block" (changed)="reloadWeek()" />

    <ui-tabs [(value)]="tab" [ariaLabel]="'timesheets.sections' | transloco">
      <ui-tab value="week" [label]="'timesheets.tabs.week' | transloco">
        <ng-template uiTabContent><app-week-view [reload]="reloadKey()" /></ng-template>
      </ui-tab>
      <ui-tab
        *hasRole="['admin', 'manager']"
        value="approvals"
        [label]="'timesheets.tabs.approvals' | transloco"
      >
        <ng-template uiTabContent><app-timesheet-approvals /></ng-template>
      </ui-tab>
    </ui-tabs>
  `,
})
export class TimesheetsPage {
  protected readonly tab = signal<string | undefined>('week');
  protected readonly reloadKey = signal(0);

  protected reloadWeek(): void {
    this.reloadKey.update((n) => n + 1);
  }
}
