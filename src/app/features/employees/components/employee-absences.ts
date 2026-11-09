import { rxResource } from '@angular/core/rxjs-interop';
import {
  ChangeDetectionStrategy,
  Component,
  type TemplateRef,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { forkJoin } from 'rxjs';
import { TranslocoPipe } from '@jsverse/transloco';
import { AbsencesApi } from '@core/api/absences.api';
import { LookupsApi } from '@core/api/lookups.api';
import type {
  AbsenceBalance,
  AbsenceRequest,
  AbsenceStatus,
  AbsenceTypeKey,
  Employee,
} from '@core/api/models';
import { LanguageService } from '@core/i18n/i18n';
import {
  AlertComponent,
  BadgeComponent,
  ButtonComponent,
  SkeletonComponent,
  TableComponent,
  type BadgeVariant,
  type TableCellContext,
  type TableColumn,
} from '@ui/index';
import { formatDate, percentOf } from '../format';
import { injectTranslate } from '../translate';

const STATUS_VARIANT: Record<AbsenceStatus, BadgeVariant> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
};

/** One employee's absence requests and yearly balances. */
@Component({
  selector: 'app-employee-absences',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    BadgeComponent,
    ButtonComponent,
    SkeletonComponent,
    TableComponent,
    TranslocoPipe,
  ],
  template: `
    <ng-template #statusCell let-row>
      <ui-badge [variant]="statusVariant(row.status)">
        {{ 'employees.absences.status.' + row.status | transloco }}
      </ui-badge>
    </ng-template>

    @if (data.status() === 'error') {
      <ui-alert variant="danger" [heading]="'common.errorTitle' | transloco">
        {{ 'common.errorText' | transloco }}
        <div class="mt-2">
          <button ui-button size="sm" variant="secondary" type="button" (click)="data.reload()">
            {{ 'common.retry' | transloco }}
          </button>
        </div>
      </ui-alert>
    } @else if (data.isLoading()) {
      <div class="flex flex-col gap-3" aria-busy="true">
        <ui-skeleton class="h-16 w-full" />
        <ui-skeleton class="h-32 w-full" />
      </div>
    } @else {
      <div class="flex flex-col gap-6">
        <section aria-labelledby="balances-heading">
          <h3 id="balances-heading" class="mb-3 font-title text-lg font-semibold">
            {{ 'employees.absences.balances' | transloco }}
          </h3>
          @if (balances().length === 0) {
            <p class="text-base text-foreground-subtle">
              {{ 'employees.absences.noBalances' | transloco }}
            </p>
          } @else {
            <ul class="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2">
              @for (balance of balances(); track balance.type) {
                <li class="flex flex-col gap-1.5 rounded-lg border border-border-subtle p-3">
                  <div class="flex items-baseline justify-between gap-3">
                    <span class="text-base font-medium">{{ typeName(balance.type) }}</span>
                    <span class="text-base text-foreground-subtle">
                      {{
                        'employees.absences.remaining'
                          | transloco
                            : { days: balance.remainingDays, total: balance.entitlementDays }
                      }}
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    class="h-2 w-full overflow-hidden rounded-full bg-background-alt"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    [attr.aria-valuenow]="used(balance)"
                    [attr.aria-label]="typeName(balance.type)"
                  >
                    <div
                      class="h-full rounded-full bg-background-primary"
                      [style.width.%]="used(balance)"
                    ></div>
                  </div>
                  <p class="text-sm text-foreground-subtle">
                    {{
                      'employees.absences.usage'
                        | transloco: { used: balance.usedDays, pending: balance.pendingDays }
                    }}
                  </p>
                </li>
              }
            </ul>
          }
        </section>

        <section aria-labelledby="requests-heading">
          <h3 id="requests-heading" class="mb-3 font-title text-lg font-semibold">
            {{ 'employees.absences.requests' | transloco }}
          </h3>
          <ui-table
            [label]="'employees.absences.requests' | transloco"
            [columns]="columns()"
            [rows]="requests()"
            [trackBy]="byId"
            [emptyTitle]="'employees.absences.emptyTitle' | transloco"
            [emptyMessage]="'employees.absences.emptyText' | transloco"
            emptyIcon="calendar"
            dense
          />
        </section>
      </div>
    }
  `,
})
export class EmployeeAbsencesComponent {
  readonly employee = input.required<Employee>();

  private readonly absences = inject(AbsencesApi);
  private readonly lookups = inject(LookupsApi);
  private readonly language = inject(LanguageService).language;
  private readonly t = injectTranslate();

  private readonly statusCell =
    viewChild.required<TemplateRef<TableCellContext<AbsenceRequest>>>('statusCell');

  protected readonly data = rxResource({
    params: () => this.employee().id,
    stream: ({ params }) =>
      forkJoin({
        requests: this.absences.list({ employeeId: params }),
        balances: this.absences.balances(params),
        types: this.lookups.absenceTypes(),
      }),
  });

  protected readonly requests = computed<AbsenceRequest[]>(() =>
    [...(this.data.value()?.requests ?? [])].sort((a, b) => b.startDate.localeCompare(a.startDate)),
  );
  protected readonly balances = computed<AbsenceBalance[]>(() => this.data.value()?.balances ?? []);

  protected readonly columns = computed<TableColumn<AbsenceRequest>[]>(() => [
    {
      key: 'type',
      header: this.t('employees.absences.columns.type'),
      accessor: (row) => this.typeName(row.type),
    },
    {
      key: 'period',
      header: this.t('employees.absences.columns.period'),
      accessor: (row) => this.period(row),
    },
    {
      key: 'status',
      header: this.t('employees.absences.columns.status'),
      cell: this.statusCell(),
      width: '8rem',
    },
    {
      key: 'reason',
      header: this.t('employees.absences.columns.reason'),
      accessor: (row) => row.reason,
    },
  ]);

  protected readonly byId = (row: AbsenceRequest): string => row.id;

  protected statusVariant(status: AbsenceStatus): BadgeVariant {
    return STATUS_VARIANT[status];
  }

  protected typeName(key: AbsenceTypeKey): string {
    return this.data.value()?.types.find((type) => type.key === key)?.name ?? key;
  }

  protected used(balance: AbsenceBalance): number {
    return percentOf(balance.usedDays + balance.pendingDays, balance.entitlementDays);
  }

  private period(request: AbsenceRequest): string {
    const locale = this.language();
    const start = formatDate(request.startDate, locale);
    return request.endDate === request.startDate
      ? start
      : `${start} - ${formatDate(request.endDate, locale)}`;
  }
}
