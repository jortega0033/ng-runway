import type { TemplateRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  viewChild,
} from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { dataTokens } from '@tokens';
import { AbsencesApi } from '@core/api/absences.api';
import { EmployeesApi } from '@core/api/employees.api';
import type { AbsenceRequest, AbsenceTypeKey } from '@core/api/models';
import { AuthService } from '@core/auth/auth.service';
import { workingDays } from '@core/domain/balances';
import { LanguageService } from '@core/i18n/i18n';
import {
  ButtonComponent,
  CardComponent,
  DialogService,
  EmptyStateComponent,
  TableComponent,
  TagComponent,
  ToastService,
  type TableCellContext,
  type TableColumn,
} from '@ui/index';
import { askReviewComment } from '../timesheets/review-comment-dialog';
import { formatDateRange } from './absence-format';

/** Pending requests of the manager's team (all teams for admins) with approve and reject. */
@Component({
  selector: 'app-absence-requests',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    TableComponent,
    TagComponent,
    TranslocoPipe,
  ],
  template: `
    @if (pending.error()) {
      <ui-card>
        <ui-empty-state
          icon="alert-circle"
          [title]="'common.errorTitle' | transloco"
          [message]="'common.errorText' | transloco"
        >
          <button empty-action ui-button type="button" (click)="pending.reload()">
            {{ 'common.retry' | transloco }}
          </button>
        </ui-empty-state>
      </ui-card>
    } @else {
      <ui-table
        [label]="'absences.requests.tableLabel' | transloco"
        [columns]="columns()"
        [rows]="rows()"
        [trackBy]="byId"
        [loading]="pending.isLoading()"
        [emptyTitle]="'absences.requests.emptyTitle' | transloco"
        [emptyMessage]="'absences.requests.emptyText' | transloco"
        emptyIcon="check-circle"
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
        @case ('reason') {
          <span [title]="row.reason">{{ row.reason }}</span>
        }
        @case ('actions') {
          <div class="flex justify-end gap-2">
            <button
              ui-button
              type="button"
              size="sm"
              variant="secondary"
              [attr.aria-label]="actionLabel('approve', row)"
              (click)="approve(row)"
            >
              {{ 'common.approve' | transloco }}
            </button>
            <button
              ui-button
              type="button"
              size="sm"
              variant="secondary"
              [attr.aria-label]="actionLabel('reject', row)"
              (click)="reject(row)"
            >
              {{ 'common.reject' | transloco }}
            </button>
          </div>
        }
        @default {
          {{ nameOf(row.employeeId) }}
        }
      }
    </ng-template>
  `,
})
export class AbsenceRequestsComponent {
  private readonly api = inject(AbsencesApi);
  private readonly employeesApi = inject(EmployeesApi);
  private readonly auth = inject(AuthService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly language = inject(LanguageService);
  private readonly transloco = inject(TranslocoService);

  /** Change this number to reload, for example after the user sent a request on behalf of someone. */
  readonly reload = input(0);
  /** Emitted after a review was saved, so balances and calendars elsewhere can reload. */
  readonly reviewed = output();

  private readonly cell = viewChild.required<TemplateRef<TableCellContext<AbsenceRequest>>>('cell');
  private readonly locale = computed(() => this.language.language());
  /** Emits when the scope file is loaded and on language changes, so code-built text stays current. */
  private readonly scopeLoaded = toSignal(this.transloco.selectTranslation('absences'));
  private readonly t = (key: string, params?: Record<string, unknown>) => {
    this.scopeLoaded();
    return this.transloco.translate(key, params);
  };

  protected readonly pending = rxResource({
    params: () => ({ role: this.auth.role(), reload: this.reload() }),
    stream: ({ params }) =>
      this.api.list({
        status: 'pending',
        // Managers review their own team; admins review everyone.
        teamId: params.role === 'manager' ? this.auth.user()?.teamId : undefined,
      }),
  });

  /** The list on screen: loaded requests, changed optimistically while a review is in flight. */
  protected readonly rows = linkedSignal<AbsenceRequest[]>(() =>
    [...(this.pending.value() ?? [])].sort((a, b) => a.startDate.localeCompare(b.startDate)),
  );

  private readonly employees = rxResource({
    stream: () => this.employeesApi.list({ pageSize: 100 }),
  });
  private readonly names = computed(
    () =>
      new Map(
        (this.employees.value()?.items ?? []).map((e) => [e.id, `${e.firstName} ${e.lastName}`]),
      ),
  );

  protected readonly columns = computed<TableColumn<AbsenceRequest>[]>(() => {
    const cell = this.cell();
    const col = (
      key: string,
      header: string,
      extra: Partial<TableColumn<AbsenceRequest>> = {},
    ): TableColumn<AbsenceRequest> => ({ key, header: this.t(header), cell, ...extra });
    return [
      col('employee', 'absences.columns.employee', {
        sortable: true,
        accessor: (r) => this.nameOf(r.employeeId),
        width: 'minmax(0, 1.4fr)',
      }),
      col('type', 'absences.columns.type', { width: 'minmax(0, 1.2fr)' }),
      col('dates', 'absences.columns.dates', {
        sortable: true,
        accessor: (r) => r.startDate,
        width: 'minmax(0, 1.6fr)',
      }),
      col('days', 'absences.columns.days', { align: 'end', width: '5rem' }),
      col('reason', 'absences.columns.reason', { width: 'minmax(0, 1.6fr)' }),
      col('actions', 'common.actions', { align: 'end', width: '13rem' }),
    ];
  });

  protected readonly byId = (request: AbsenceRequest) => request.id;

  protected nameOf(employeeId: string): string {
    return this.names().get(employeeId) ?? employeeId;
  }

  protected color(type: AbsenceTypeKey): string {
    return dataTokens.absence[type];
  }

  protected dates(request: AbsenceRequest): string {
    return formatDateRange(request.startDate, request.endDate, this.locale());
  }

  protected days(request: AbsenceRequest): number {
    return workingDays(request.startDate, request.endDate);
  }

  protected actionLabel(action: 'approve' | 'reject', request: AbsenceRequest): string {
    return this.t(`absences.requests.${action}Label`, {
      name: this.nameOf(request.employeeId),
      dates: this.dates(request),
    });
  }

  protected async approve(request: AbsenceRequest): Promise<void> {
    const comment = await askReviewComment(this.dialogs, {
      title: this.t('absences.requests.approveTitle'),
      message: this.t('absences.requests.approveMessage', this.describe(request)),
      confirmLabel: this.t('common.approve'),
      cancelLabel: this.t('common.cancel'),
      closeLabel: this.t('common.close'),
      commentLabel: this.t('absences.requests.commentOptional'),
      variant: 'primary',
    });
    if (comment !== null) this.review(request, 'approved', comment);
  }

  protected async reject(request: AbsenceRequest): Promise<void> {
    const comment = await askReviewComment(this.dialogs, {
      title: this.t('absences.requests.rejectTitle'),
      message: this.t('absences.requests.rejectMessage', this.describe(request)),
      confirmLabel: this.t('common.reject'),
      cancelLabel: this.t('common.cancel'),
      closeLabel: this.t('common.close'),
      commentLabel: this.t('absences.requests.commentOptional'),
      commentHint: this.t('absences.requests.rejectHint'),
      variant: 'danger',
    });
    if (comment !== null) this.review(request, 'rejected', comment);
  }

  private describe(request: AbsenceRequest) {
    return {
      name: this.nameOf(request.employeeId),
      type: this.t(`absences.types.${request.type}`),
      dates: this.dates(request),
    };
  }

  /** Takes the row off the list right away; it returns if the server refuses the review. */
  private review(request: AbsenceRequest, status: 'approved' | 'rejected', comment: string): void {
    const before = this.rows();
    this.rows.set(before.filter((r) => r.id !== request.id));
    this.api.review(request.id, status, comment).subscribe({
      next: () => {
        this.toasts.show({
          variant: 'success',
          title: this.t(
            status === 'approved'
              ? 'absences.requests.approvedTitle'
              : 'absences.requests.rejectedTitle',
          ),
          message: this.t('absences.requests.doneText', this.describe(request)),
        });
        this.reviewed.emit();
      },
      // The error toast comes from the interceptor.
      error: () => this.rows.update((current) => this.withRestored(current, before, request.id)),
    });
  }

  private withRestored(
    current: AbsenceRequest[],
    before: AbsenceRequest[],
    id: string,
  ): AbsenceRequest[] {
    const original = before.find((r) => r.id === id);
    if (!original || current.some((r) => r.id === id)) return current;
    const order = new Map(before.map((r, i) => [r.id, i]));
    return [...current, original].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }
}
