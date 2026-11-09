import { rxResource } from '@angular/core/rxjs-interop';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { EmployeesApi } from '@core/api/employees.api';
import { LookupsApi } from '@core/api/lookups.api';
import {
  AlertComponent,
  BreadcrumbsComponent,
  ButtonComponent,
  PageHeaderComponent,
  SkeletonComponent,
  type BreadcrumbItem,
} from '@ui/index';
import { EmployeeFormReactiveComponent } from '../components/employee-form-reactive';
import { EmployeeFormComponent } from '../components/employee-form';
import { resolveFormVariant } from '../employee-form.config';
import { injectTranslate } from '../translate';

/**
 * Route page for `new` and `:id/edit`. It loads what the form needs (the employee when
 * editing, and the teams) and then renders the form variant chosen in `employee-form.config.ts`.
 * `?form=reactive` or `?form=signal` overrides that choice for one visit.
 */
@Component({
  selector: 'app-employee-form-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    BreadcrumbsComponent,
    ButtonComponent,
    EmployeeFormComponent,
    EmployeeFormReactiveComponent,
    PageHeaderComponent,
    SkeletonComponent,
    TranslocoPipe,
  ],
  template: `
    <div class="flex flex-col gap-6">
      <ui-page-header
        [title]="(isNew() ? 'employees.form.newTitle' : 'employees.form.editTitle') | transloco"
        [description]="subtitle()"
      >
        <ui-breadcrumbs
          breadcrumbs
          [label]="'employees.breadcrumb' | transloco"
          [items]="crumbs()"
        />
      </ui-page-header>

      @if (failed()) {
        <ui-alert variant="danger" [heading]="'common.errorTitle' | transloco">
          {{ 'common.errorText' | transloco }}
          <div class="mt-2">
            <button ui-button size="sm" variant="secondary" type="button" (click)="reload()">
              {{ 'common.retry' | transloco }}
            </button>
          </div>
        </ui-alert>
      } @else if (!ready()) {
        <div class="flex flex-col gap-4" aria-busy="true">
          <ui-skeleton class="h-40 w-full" />
          <ui-skeleton class="h-40 w-full" />
          <ui-skeleton class="h-56 w-full" />
        </div>
      } @else if (variant() === 'reactive') {
        <app-employee-form-reactive [employee]="current()" [teams]="teams()" />
      } @else {
        <app-employee-form [employee]="current()" [teams]="teams()" />
      }
    </div>
  `,
})
export class EmployeeFormPage {
  /** Route param, bound by `withComponentInputBinding`. Missing on `/employees/new`. */
  readonly id = input<string>();
  /** The `?form=` query param. */
  readonly form = input<string>();

  private readonly employees = inject(EmployeesApi);
  private readonly lookups = inject(LookupsApi);
  private readonly t = injectTranslate();

  protected readonly isNew = computed(() => !this.id());
  protected readonly variant = computed(() => resolveFormVariant(this.form()));

  private readonly employeeRes = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.employees.get(params),
  });
  private readonly teamsRes = rxResource({ stream: () => this.lookups.teams() });

  protected readonly current = computed(() =>
    this.isNew() ? null : (this.employeeRes.value() ?? null),
  );
  protected readonly teams = computed(() => this.teamsRes.value() ?? []);
  protected readonly failed = computed(
    () => this.teamsRes.status() === 'error' || this.employeeRes.status() === 'error',
  );
  protected readonly ready = computed(
    () => this.teamsRes.hasValue() && (this.isNew() || this.employeeRes.hasValue()),
  );

  protected readonly subtitle = computed(() => {
    const employee = this.current();
    return employee ? `${employee.firstName} ${employee.lastName}` : '';
  });
  protected readonly crumbs = computed<BreadcrumbItem[]>(() => {
    const employee = this.current();
    const items: BreadcrumbItem[] = [{ label: this.t('nav.employees'), link: '/employees' }];
    if (employee) {
      items.push({
        label: `${employee.firstName} ${employee.lastName}`,
        link: ['/employees', employee.id],
      });
    }
    items.push({
      label: this.t(this.isNew() ? 'employees.form.newTitle' : 'employees.form.editTitle'),
    });
    return items;
  });

  protected reload(): void {
    this.teamsRes.reload();
    this.employeeRes.reload();
  }
}
