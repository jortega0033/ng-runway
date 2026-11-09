import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '@core/auth/auth.service';
import { HasRoleDirective } from '@core/auth/has-role.directive';
import { CardComponent, PageHeaderComponent, SkeletonComponent } from '@ui/index';
import { ApprovalsCardComponent } from '../components/approvals-card';
import { HoursCardComponent } from '../components/hours-card';
import { NextShiftsCardComponent } from '../components/next-shifts-card';
import { PendingRequestsCardComponent } from '../components/pending-requests-card';
import { TeamTodayCardComponent } from '../components/team-today-card';

/**
 * "My overview". The first three cards load right away. The two lower cards sit in `@defer`
 * blocks: their code and their requests only start once the card scrolls into view, and a
 * skeleton holds the place until then.
 */
@Component({
  selector: 'app-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ApprovalsCardComponent,
    CardComponent,
    HasRoleDirective,
    HoursCardComponent,
    NextShiftsCardComponent,
    PageHeaderComponent,
    PendingRequestsCardComponent,
    SkeletonComponent,
    TeamTodayCardComponent,
    TranslocoPipe,
  ],
  template: `
    <div class="flex flex-col gap-6">
      <ui-page-header
        [title]="'dashboard.title' | transloco"
        [description]="'dashboard.greeting' | transloco: { name: firstName() }"
      />

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <app-next-shifts-card />
        <app-hours-card />
        <app-pending-requests-card />

        @defer (on viewport) {
          <app-team-today-card />
        } @placeholder {
          <ui-card aria-busy="true">
            <div class="flex flex-col gap-3">
              <ui-skeleton class="h-6 w-1/3" />
              <ui-skeleton class="h-5 w-full" />
              <ui-skeleton class="h-5 w-2/3" />
              <ui-skeleton class="h-5 w-1/2" />
            </div>
          </ui-card>
        }

        <ng-container *hasRole="['admin', 'manager']">
          @defer (on viewport) {
            <app-approvals-card class="lg:col-span-2" />
          } @placeholder {
            <ui-card class="lg:col-span-2" aria-busy="true">
              <div class="flex flex-col gap-3">
                <ui-skeleton class="h-6 w-1/4" />
                <ui-skeleton class="h-5 w-full" />
                <ui-skeleton class="h-5 w-1/2" />
              </div>
            </ui-card>
          }
        </ng-container>
      </div>
    </div>
  `,
})
export class DashboardPage {
  private readonly user = inject(AuthService).user;
  protected readonly firstName = computed(() => this.user()?.name.split(' ')[0] ?? '');
}
