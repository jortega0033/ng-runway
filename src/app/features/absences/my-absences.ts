import type { TemplateRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { dataTokens } from '@tokens';
import { AbsencesApi } from '@core/api/absences.api';
import type { AbsenceRequest, AbsenceStatus, AbsenceTypeKey } from '@core/api/models';
import { AuthService } from '@core/auth/auth.service';
import { workingDays } from '@core/domain/balances';
import { LanguageService } from '@core/i18n/i18n';
import {
  BadgeComponent,
  CardComponent,
  EmptyStateComponent,
  SkeletonComponent,
  TableComponent,
  TagComponent,
  ButtonComponent,
  type BadgeVariant,
  type TableCellContext,
  type TableColumn,
} from '@ui/index';
import { balanceBar, sortByStartDesc, STATUS_VARIANT } from './absence-math';
import { formatDateRange } from './absence-format';

/** Balances per absence type and the signed-in employee's own requests. */
@Component({
  selector: 'app-my-absences',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    SkeletonComponent,
    TableComponent,
    TagComponent,
    TranslocoPipe,
  ],
  template: `
    <h2 class="mb-3 font-title text-lg font-semibold">{{ 'absences.my.balances' | transloco }}</h2>
    @if (balances.isLoading()) {
      <div
        class="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        role="status"
        [attr.aria-label]="'common.loading' | transloco"
      >
        @for (n of [1, 2, 3, 4]; track n) {
          <ui-skeleton class="h-32 w-full" />
        }
      </div>
    } @else if (balances.error()) {
      <ui-card class="mb-6">
        <ui-empty-state
          icon="alert-circle"
          [title]="'common.errorTitle' | transloco"
          [message]="'common.errorText' | transloco"
        >
          <button empty-action ui-button type="button" (click)="balances.reload()">
            {{ 'common.retry' | transloco }}
          </button>
        </ui-empty-state>
      </ui-card>
    } @else if ((balances.value() ?? []).length === 0) {
      <ui-card class="mb-6">
        <ui-empty-state
          icon="calendar"
          [title]="'absences.my.noBalancesTitle' | transloco"
          [message]="'absences.my.noBalancesText' | transloco"
        />
      </ui-card>
    } @else {
      <ul class="mb-6 grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-4">
        @for (balance of balances.value(); track balance.type) {
          <li
            class="rounded-lg border border-border-subtle bg-background-surface-page p-4 shadow-xs"
          >
            <ui-tag [color]="color(balance.type)">
              {{ 'absences.types.' + balance.type | transloco }}
            </ui-tag>
            <p class="mt-3 font-title text-3xl font-semibold tabular-nums">
              {{ 'absences.my.remainingDays' | transloco: { count: balance.remainingDays } }}
            </p>
            <p class="text-sm text-foreground-subtle tabular-nums">
              {{
                'absences.my.breakdown'
                  | transloco
                    : {
                        used: balance.usedDays,
                        pending: balance.pendingDays,
                        total: balance.entitlementDays,
                      }
              }}
            </p>
            <div
              class="mt-3 flex h-2 overflow-hidden rounded-sm bg-background-alt"
              aria-hidden="true"
            >
              <div class="bg-background-primary" [style.width.%]="bar(balance).usedPercent"></div>
              <div
                class="bg-background-brand-subtle"
                [style.width.%]="bar(balance).pendingPercent"
              ></div>
            </div>
          </li>
        }
      </ul>
    }

    <h2 class="mb-3 font-title text-lg font-semibold">{{ 'absences.my.requests' | transloco }}</h2>
    @if (requests.error()) {
      <ui-card>
        <ui-empty-state
          icon="alert-circle"
          [title]="'common.errorTitle' | transloco"
          [message]="'common.errorText' | transloco"
        >
          <button empty-action ui-button type="button" (click)="requests.reload()">
            {{ 'common.retry' | transloco }}
          </button>
        </ui-empty-state>
      </ui-card>
    } @else {
      <ui-table
        [label]="'absences.my.tableLabel' | transloco"
        [columns]="columns()"
        [rows]="rows()"
        [trackBy]="byId"
        [loading]="requests.isLoading()"
        [emptyTitle]="'absences.my.emptyTitle' | transloco"
        [emptyMessage]="'absences.my.emptyText' | transloco"
        emptyIcon="calendar"
      />
    }

    <ng-template #cell let-row let-column="column">
      @switch (column.key) {
        @case ('type') {
          <ui-tag [color]="color(row.type)">{{ 'absences.types.' + row.type | transloco }}</ui-tag>
        }
        @case ('dates') {
          <span class="whitespace-nowrap">{{ dates(row) }}</span>
        }
        @case ('days') {
          <span class="tabular-nums">{{ days(row) }}</span>
        }
        @case ('status') {
          <ui-badge [variant]="variant(row.status)">
            {{ 'absences.status.' + row.status | transloco }}
          </ui-badge>
        }
        @default {
          {{ note(row) }}
        }
      }
    </ng-template>
  `,
})
export class MyAbsencesComponent {
  private readonly api = inject(AbsencesApi);
  private readonly auth = inject(AuthService);
  private readonly language = inject(LanguageService);
  private readonly transloco = inject(TranslocoService);

  /** Change this number to reload, for example after a request was sent or reviewed. */
  readonly reload = input(0);

  private readonly cell = viewChild.required<TemplateRef<TableCellContext<AbsenceRequest>>>('cell');
  private readonly locale = computed(() => this.language.language());
  /** Emits when the scope file is loaded and on language changes, so code-built text stays current. */
  private readonly scopeLoaded = toSignal(this.transloco.selectTranslation('absences'));
  private readonly t = (key: string, params?: Record<string, unknown>) => {
    this.scopeLoaded();
    return this.transloco.translate(key, params);
  };

  protected readonly balances = rxResource({
    params: () => ({ employeeId: this.auth.user()?.id, reload: this.reload() }),
    stream: ({ params }) => this.api.balances(params.employeeId),
  });

  protected readonly requests = rxResource({
    params: () => ({ employeeId: this.auth.user()?.id, reload: this.reload() }),
    stream: ({ params }) => this.api.list({ employeeId: params.employeeId }),
  });

  protected readonly rows = computed(() => sortByStartDesc(this.requests.value() ?? []));

  protected readonly columns = computed<TableColumn<AbsenceRequest>[]>(() => {
    const cell = this.cell();
    const col = (
      key: string,
      header: string,
      extra: Partial<TableColumn<AbsenceRequest>> = {},
    ): TableColumn<AbsenceRequest> => ({ key, header: this.t(header), cell, ...extra });
    return [
      col('type', 'absences.columns.type', { width: 'minmax(0, 1.2fr)' }),
      col('dates', 'absences.columns.dates', {
        sortable: true,
        accessor: (r) => r.startDate,
        width: 'minmax(0, 1.6fr)',
      }),
      col('days', 'absences.columns.days', { align: 'end', width: '5rem' }),
      col('status', 'absences.columns.status', { width: '7.5rem' }),
      col('note', 'absences.columns.note', { width: 'minmax(0, 2fr)' }),
    ];
  });

  protected readonly byId = (request: AbsenceRequest) => request.id;

  protected color(type: AbsenceTypeKey): string {
    return dataTokens.absence[type];
  }

  protected readonly bar = balanceBar;

  protected variant(status: AbsenceStatus): BadgeVariant {
    return STATUS_VARIANT[status];
  }

  protected dates(request: AbsenceRequest): string {
    return formatDateRange(request.startDate, request.endDate, this.locale());
  }

  protected days(request: AbsenceRequest): number {
    return workingDays(request.startDate, request.endDate);
  }

  /** The manager's answer if there is one, otherwise the employee's own reason. */
  protected note(request: AbsenceRequest): string {
    if (request.comment) return this.t('absences.my.managerNote', { comment: request.comment });
    return request.reason;
  }
}
