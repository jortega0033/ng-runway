import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { finalize, forkJoin, map, of } from 'rxjs';
import { EmployeesApi } from '@core/api/employees.api';
import { LookupsApi } from '@core/api/lookups.api';
import type { Employee } from '@core/api/models';
import { AuthService } from '@core/auth/auth.service';
import { HasRoleDirective } from '@core/auth/has-role.directive';
import {
  ButtonComponent,
  DialogService,
  IconComponent,
  PageHeaderComponent,
  TabComponent,
  TabContentDirective,
  TabsComponent,
} from '@ui/index';
import { AbsenceRequestsComponent } from './requests-approval';
import { MyAbsencesComponent } from './my-absences';
import { AbsenceRequestDialog, type RequestDialogData } from './request-dialog';
import { TeamCalendarComponent } from './team-calendar';

/** Own balances and requests, approvals for managers, and the team calendar for everyone. */
@Component({
  selector: 'app-absences-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AbsenceRequestsComponent,
    ButtonComponent,
    HasRoleDirective,
    IconComponent,
    MyAbsencesComponent,
    PageHeaderComponent,
    TabComponent,
    TabContentDirective,
    TabsComponent,
    TeamCalendarComponent,
    TranslocoPipe,
  ],
  template: `
    <ui-page-header
      [title]="'absences.title' | transloco"
      [description]="'absences.description' | transloco"
    >
      <div actions>
        <button ui-button type="button" [loading]="opening()" (click)="openRequest()">
          <ui-icon name="plus" [size]="16" />
          {{ 'absences.request.open' | transloco }}
        </button>
      </div>
    </ui-page-header>

    <ui-tabs [(value)]="tab" [ariaLabel]="'absences.sections' | transloco">
      <ui-tab value="mine" [label]="'absences.tabs.mine' | transloco">
        <ng-template uiTabContent><app-my-absences [reload]="reloadKey()" /></ng-template>
      </ui-tab>
      <ui-tab
        *hasRole="['admin', 'manager']"
        value="requests"
        [label]="'absences.tabs.requests' | transloco"
      >
        <ng-template uiTabContent>
          <app-absence-requests [reload]="reloadKey()" (reviewed)="reloadAll()" />
        </ng-template>
      </ui-tab>
      <ui-tab value="calendar" [label]="'absences.tabs.calendar' | transloco">
        <ng-template uiTabContent><app-team-calendar [reload]="reloadKey()" /></ng-template>
      </ui-tab>
    </ui-tabs>
  `,
})
export class AbsencesPage {
  private readonly auth = inject(AuthService);
  private readonly lookups = inject(LookupsApi);
  private readonly employeesApi = inject(EmployeesApi);
  private readonly dialogs = inject(DialogService);

  protected readonly tab = signal<string | undefined>('mine');
  protected readonly reloadKey = signal(0);
  protected readonly opening = signal(false);

  protected reloadAll(): void {
    this.reloadKey.update((n) => n + 1);
  }

  /** Loads what the form needs, then opens it. Managers can pick the employee. */
  protected openRequest(): void {
    const user = this.auth.user();
    if (!user || this.opening()) return;
    this.opening.set(true);
    forkJoin({
      types: this.lookups.absenceTypes(),
      employees: this.auth.isManager()
        ? this.employeesApi
            .list({ pageSize: 100, active: true })
            .pipe(
              map((page) =>
                page.items
                  .filter((e) => this.auth.role() === 'admin' || e.teamId === user.teamId)
                  .sort((a, b) => this.byName(a, b)),
              ),
            )
        : of(null),
    })
      .pipe(finalize(() => this.opening.set(false)))
      .subscribe(({ types, employees }) => {
        const data: RequestDialogData = { employeeId: user.id, employees, types };
        const ref = this.dialogs.open<unknown, RequestDialogData, AbsenceRequestDialog>(
          AbsenceRequestDialog,
          { size: 'md', data },
        );
        ref.closed.subscribe((created) => {
          if (created) this.reloadAll();
        });
      });
  }

  private byName(a: Employee, b: Employee): number {
    return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
  }
}
