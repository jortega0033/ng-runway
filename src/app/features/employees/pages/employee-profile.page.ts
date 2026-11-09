import { rxResource } from '@angular/core/rxjs-interop';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { forkJoin, firstValueFrom } from 'rxjs';
import { EmployeesApi } from '@core/api/employees.api';
import { LookupsApi } from '@core/api/lookups.api';
import type { UserRole } from '@core/api/models';
import { HasRoleDirective } from '@core/auth/has-role.directive';
import { LanguageService } from '@core/i18n/i18n';
import {
  AlertComponent,
  AvatarComponent,
  BadgeComponent,
  BreadcrumbsComponent,
  ButtonComponent,
  CardComponent,
  DialogService,
  PageHeaderComponent,
  SkeletonComponent,
  TabComponent,
  TabContentDirective,
  TabsComponent,
  ToastService,
  type BadgeVariant,
  type BreadcrumbItem,
} from '@ui/index';
import { WEEKDAY_KEYS, availableDays, dayLabel } from '../availability';
import { EmployeeAbsencesComponent } from '../components/employee-absences';
import { EmployeeScheduleComponent } from '../components/employee-schedule';
import { formatDate, formatEuro } from '../format';
import { injectTranslate } from '../translate';

const ROLE_VARIANT: Record<UserRole, BadgeVariant> = {
  admin: 'brand',
  manager: 'brand',
  employee: 'neutral',
};

/** One employee: header with actions, then Details, Contract, Schedule and Absences tabs. */
@Component({
  selector: 'app-employee-profile-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    AvatarComponent,
    BadgeComponent,
    BreadcrumbsComponent,
    ButtonComponent,
    CardComponent,
    EmployeeAbsencesComponent,
    EmployeeScheduleComponent,
    HasRoleDirective,
    PageHeaderComponent,
    SkeletonComponent,
    TabComponent,
    TabContentDirective,
    TabsComponent,
    TranslocoPipe,
  ],
  template: `
    @if (data.status() === 'error') {
      <div class="flex flex-col gap-4">
        <ui-alert variant="danger" [heading]="'employees.profile.errorTitle' | transloco">
          {{ 'common.errorText' | transloco }}
          <div class="mt-2 flex gap-2">
            <button ui-button size="sm" variant="secondary" type="button" (click)="data.reload()">
              {{ 'common.retry' | transloco }}
            </button>
            <button ui-button size="sm" variant="ghost" type="button" (click)="backToList()">
              {{ 'employees.profile.backToList' | transloco }}
            </button>
          </div>
        </ui-alert>
      </div>
    } @else if (employee(); as e) {
      <div class="flex flex-col gap-6">
        <ui-page-header [title]="fullName()" [description]="e.jobTitle">
          <ui-breadcrumbs
            breadcrumbs
            [label]="'employees.breadcrumb' | transloco"
            [items]="crumbs()"
          />
          <ng-container actions>
            <button
              *hasRole="['admin', 'manager']"
              ui-button
              variant="secondary"
              type="button"
              (click)="edit()"
            >
              {{ 'common.edit' | transloco }}
            </button>
            <button
              *hasRole="['admin']"
              ui-button
              variant="danger"
              type="button"
              [loading]="deleting()"
              (click)="remove()"
            >
              {{ 'common.delete' | transloco }}
            </button>
          </ng-container>
        </ui-page-header>

        <ui-card>
          <div class="flex flex-wrap items-center gap-4">
            <ui-avatar [name]="fullName()" size="lg" />
            <div class="flex min-w-0 flex-col gap-1">
              <div class="flex flex-wrap items-center gap-2">
                <ui-badge [variant]="roleVariant()">{{
                  'roles.' + e.userRole | transloco
                }}</ui-badge>
                @if (!e.active) {
                  <ui-badge variant="warning">{{
                    'employees.profile.inactive' | transloco
                  }}</ui-badge>
                }
              </div>
              <p class="text-base text-foreground-subtle">
                {{ teamName() }}<span aria-hidden="true"> / </span>{{ locationName() }}
              </p>
            </div>
          </div>
        </ui-card>

        <ui-tabs [(value)]="tab" [ariaLabel]="'employees.profile.sections' | transloco">
          <ui-tab value="details" [label]="'employees.profile.tabs.details' | transloco">
            <ui-card>
              <dl class="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <div>
                  <dt class="text-sm text-foreground-subtle">
                    {{ 'employees.form.email' | transloco }}
                  </dt>
                  <dd class="text-base">{{ e.email }}</dd>
                </div>
                <div>
                  <dt class="text-sm text-foreground-subtle">
                    {{ 'employees.form.phone' | transloco }}
                  </dt>
                  <dd class="text-base">{{ e.phone || '-' }}</dd>
                </div>
                <div>
                  <dt class="text-sm text-foreground-subtle">
                    {{ 'employees.form.team' | transloco }}
                  </dt>
                  <dd class="text-base">{{ teamName() }}</dd>
                </div>
                <div>
                  <dt class="text-sm text-foreground-subtle">
                    {{ 'employees.profile.location' | transloco }}
                  </dt>
                  <dd class="text-base">{{ locationName() }}</dd>
                </div>
              </dl>
              <h3 class="mt-6 mb-2 font-title text-lg font-semibold">
                {{ 'employees.form.sections.availability' | transloco }}
              </h3>
              <p class="mb-2 text-base text-foreground-subtle">
                {{ 'employees.profile.availableDays' | transloco: { days: availableCount() } }}
              </p>
              <dl class="m-0 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                @for (key of weekdayKeys; track key; let i = $index) {
                  <div class="flex justify-between gap-4 border-b border-border-subtle py-1.5">
                    <dt class="text-base">{{ 'employees.weekdays.' + key | transloco }}</dt>
                    <dd class="text-base text-foreground-subtle">
                      {{ availabilityText(i) }}
                    </dd>
                  </div>
                }
              </dl>
            </ui-card>
          </ui-tab>

          <ui-tab value="contract" [label]="'employees.profile.tabs.contract' | transloco">
            <ui-card>
              <dl class="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <div>
                  <dt class="text-sm text-foreground-subtle">
                    {{ 'employees.form.contractType' | transloco }}
                  </dt>
                  <dd class="text-base">
                    {{ 'employees.contract.' + e.contract.type | transloco }}
                  </dd>
                </div>
                <div>
                  <dt class="text-sm text-foreground-subtle">
                    {{ 'employees.form.hoursPerWeek' | transloco }}
                  </dt>
                  <dd class="text-base">{{ e.contract.hoursPerWeek }}</dd>
                </div>
                <div>
                  <dt class="text-sm text-foreground-subtle">
                    {{ 'employees.form.hourlyRate' | transloco }}
                  </dt>
                  <dd class="text-base">{{ rate() }}</dd>
                </div>
                <div>
                  <dt class="text-sm text-foreground-subtle">
                    {{ 'employees.form.startDate' | transloco }}
                  </dt>
                  <dd class="text-base">{{ startDate() }}</dd>
                </div>
                <div>
                  <dt class="text-sm text-foreground-subtle">
                    {{ 'employees.profile.endDate' | transloco }}
                  </dt>
                  <dd class="text-base">
                    {{ endDate() || ('employees.profile.openEnded' | transloco) }}
                  </dd>
                </div>
              </dl>
            </ui-card>
          </ui-tab>

          <ui-tab value="schedule" [label]="'employees.profile.tabs.schedule' | transloco">
            <ng-template uiTabContent>
              <ui-card>
                <app-employee-schedule
                  [employee]="e"
                  [teams]="lookups.value()?.teams ?? []"
                  [locations]="lookups.value()?.locations ?? []"
                />
              </ui-card>
            </ng-template>
          </ui-tab>

          <ui-tab value="absences" [label]="'employees.profile.tabs.absences' | transloco">
            <ng-template uiTabContent>
              <ui-card>
                <app-employee-absences [employee]="e" />
              </ui-card>
            </ng-template>
          </ui-tab>
        </ui-tabs>
      </div>
    } @else {
      <div class="flex flex-col gap-4" aria-busy="true">
        <ui-skeleton class="h-10 w-72" />
        <ui-skeleton class="h-20 w-full" />
        <ui-skeleton class="h-64 w-full" />
      </div>
    }
  `,
})
export class EmployeeProfilePage {
  /** Route param, bound by `withComponentInputBinding`. */
  readonly id = input.required<string>();

  private readonly employees = inject(EmployeesApi);
  private readonly lookupsApi = inject(LookupsApi);
  private readonly router = inject(Router);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly language = inject(LanguageService).language;
  private readonly t = injectTranslate();

  protected readonly lookups = rxResource({
    stream: () =>
      forkJoin({ teams: this.lookupsApi.teams(), locations: this.lookupsApi.locations() }),
  });
  protected readonly data = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.employees.get(params),
  });

  protected readonly employee = computed(() => this.data.value() ?? null);
  protected readonly tab = signal('details');
  protected readonly deleting = signal(false);
  protected readonly weekdayKeys = WEEKDAY_KEYS;

  protected readonly fullName = computed(() => {
    const e = this.employee();
    return e ? `${e.firstName} ${e.lastName}` : '';
  });
  protected readonly roleVariant = computed(
    () => ROLE_VARIANT[this.employee()?.userRole ?? 'employee'],
  );
  protected readonly teamName = computed(
    () => this.lookups.value()?.teams.find((t) => t.id === this.employee()?.teamId)?.name ?? '',
  );
  protected readonly locationName = computed(
    () =>
      this.lookups.value()?.locations.find((l) => l.id === this.employee()?.locationId)?.name ?? '',
  );
  protected readonly availableCount = computed(() =>
    availableDays(this.employee()?.availability ?? []),
  );
  protected readonly rate = computed(() =>
    formatEuro(this.employee()?.contract.hourlyRateCents ?? 0, this.language()),
  );
  protected readonly startDate = computed(() =>
    formatDate(this.employee()?.contract.startDate ?? '', this.language()),
  );
  protected readonly endDate = computed(() =>
    formatDate(this.employee()?.contract.endDate ?? '', this.language()),
  );
  protected readonly crumbs = computed<BreadcrumbItem[]>(() => [
    { label: this.t('nav.employees'), link: '/employees' },
    { label: this.fullName() },
  ]);

  protected availabilityText(index: number): string {
    return dayLabel(this.employee()?.availability[index], this.t('employees.profile.notAvailable'));
  }

  protected edit(): void {
    void this.router.navigate(['/employees', this.id(), 'edit']);
  }

  protected backToList(): void {
    void this.router.navigate(['/employees']);
  }

  protected async remove(): Promise<void> {
    const e = this.employee();
    if (!e) return;
    const confirmed = await this.dialogs.confirm({
      title: this.t('employees.delete.title'),
      message: this.t('employees.delete.message', { name: this.fullName() }),
      confirmLabel: this.t('common.delete'),
      cancelLabel: this.t('common.cancel'),
      danger: true,
    });
    if (!confirmed) return;
    this.deleting.set(true);
    try {
      await firstValueFrom(this.employees.remove(e.id));
      this.toasts.show({
        variant: 'success',
        title: this.t('employees.delete.done'),
        message: this.fullName(),
      });
      await this.router.navigate(['/employees']);
    } catch {
      // The error interceptor already showed a toast with the server message.
      this.deleting.set(false);
    }
  }
}
