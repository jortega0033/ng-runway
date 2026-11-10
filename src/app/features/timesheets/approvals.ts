import type { TemplateRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { catchError, forkJoin, map, of } from 'rxjs';
import { ClockApi } from '@core/api/clock.api';
import { EmployeesApi } from '@core/api/employees.api';
import { LookupsApi } from '@core/api/lookups.api';
import type { ClockEntry, TimesheetStatus } from '@core/api/models';
import { AuthService } from '@core/auth/auth.service';
import { formatDuration, workedMinutes } from '@core/domain/hours';
import { addDays, startOfWeek, todayIso } from '@core/domain/time';
import { LanguageService } from '@core/i18n/i18n';
import {
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  DialogService,
  EmptyStateComponent,
  FieldComponent,
  SelectComponent,
  TableComponent,
  ToastService,
  type BadgeVariant,
  type SelectOption,
  type TableCellContext,
  type TableColumn,
} from '@ui/index';
import { askReviewComment } from './review-comment-dialog';
import { formatDate, formatTime, formatWeekRange } from './timesheet-format';
import {
  applyReview,
  breakMinutes,
  restoreEntries,
  shiftWeek,
  STATUS_VARIANT,
} from './timesheet-math';

type StatusFilter = TimesheetStatus | '';
const STATUS_FILTERS: readonly TimesheetStatus[] = ['submitted', 'approved', 'rejected', 'open'];
const WEEKS_BACK = 8;

/** Manager and admin view: review submitted hours for a team, one by one or in bulk. */
@Component({
  selector: 'app-timesheet-approvals',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    FieldComponent,
    SelectComponent,
    TableComponent,
    TranslocoPipe,
  ],
  template: `
    <div class="mb-4 flex flex-wrap items-end gap-4">
      <ui-field [label]="'timesheets.approvals.team' | transloco" class="w-56">
        <ui-select
          [options]="teamOptions()"
          [value]="teamId()"
          [disabled]="!isAdmin"
          (valueChange)="teamId.set($event)"
        />
      </ui-field>
      <ui-field [label]="'timesheets.approvals.status' | transloco" class="w-48">
        <ui-select
          [options]="statusOptions()"
          [value]="status()"
          (valueChange)="setStatus($event)"
        />
      </ui-field>
      <ui-field [label]="'timesheets.approvals.week' | transloco" class="w-64">
        <ui-select [options]="weekOptions()" [value]="week()" (valueChange)="week.set($event)" />
      </ui-field>
      <div class="ml-auto">
        <button
          ui-button
          type="button"
          [disabled]="approvableSelection().length === 0"
          (click)="approveSelected()"
        >
          {{
            'timesheets.approvals.approveSelected'
              | transloco: { count: approvableSelection().length }
          }}
        </button>
      </div>
    </div>

    <!-- Live region: tells screen reader users how much work is left after a review. -->
    <p role="status" class="sr-only">{{ announcement() }}</p>

    @if (entries.error()) {
      <ui-card>
        <ui-empty-state
          icon="alert-circle"
          [title]="'common.errorTitle' | transloco"
          [message]="'common.errorText' | transloco"
        >
          <button empty-action ui-button type="button" (click)="entries.reload()">
            {{ 'common.retry' | transloco }}
          </button>
        </ui-empty-state>
      </ui-card>
    } @else {
      <div #tableWrap tabindex="-1" class="outline-none">
        <ui-table
          [label]="'timesheets.approvals.tableLabel' | transloco"
          [columns]="columns()"
          [rows]="rows()"
          [trackBy]="byId"
          [loading]="entries.isLoading()"
          [emptyTitle]="'timesheets.approvals.emptyTitle' | transloco"
          [emptyMessage]="'timesheets.approvals.emptyText' | transloco"
          emptyIcon="check-circle"
          selectable
          [(selected)]="selected"
          [selectAllLabel]="'timesheets.approvals.selectAll' | transloco"
          [rowSelectLabel]="selectLabel"
        />
      </div>
    }

    <ng-template #cell let-row let-column="column">
      @switch (column.key) {
        @case ('date') {
          <span class="whitespace-nowrap">{{ dateLabel(row.date) }}</span>
        }
        @case ('times') {
          <span class="tabular-nums">{{ timeRange(row) }}</span>
        }
        @case ('breaks') {
          <span class="tabular-nums">{{ breakText(row) }}</span>
        }
        @case ('worked') {
          <span class="font-medium tabular-nums">{{ workedText(row) }}</span>
        }
        @case ('status') {
          <ui-badge [variant]="variant(row.status)">
            {{ 'timesheets.status.' + row.status | transloco }}
          </ui-badge>
        }
        @case ('actions') {
          @if (row.status === 'submitted') {
            <div class="flex justify-end gap-2">
              <button
                ui-button
                type="button"
                size="sm"
                variant="secondary"
                [attr.data-entry-id]="row.id"
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
                [attr.data-entry-id]="row.id"
                [attr.aria-label]="actionLabel('reject', row)"
                (click)="reject(row)"
              >
                {{ 'common.reject' | transloco }}
              </button>
            </div>
          }
        }
        @default {
          {{ nameOf(row.employeeId) }}
        }
      }
    </ng-template>
  `,
})
export class TimesheetApprovalsComponent {
  private readonly api = inject(ClockApi);
  private readonly employeesApi = inject(EmployeesApi);
  private readonly lookups = inject(LookupsApi);
  private readonly auth = inject(AuthService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageService);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly cell = viewChild.required<TemplateRef<TableCellContext<ClockEntry>>>('cell');
  private readonly tableWrap = viewChild<ElementRef<HTMLElement>>('tableWrap');

  /** Admins see every team, managers only their own. */
  protected readonly isAdmin = this.auth.role() === 'admin';
  protected readonly teamId = signal(this.isAdmin ? '' : (this.auth.user()?.teamId ?? ''));
  protected readonly status = signal<StatusFilter>('submitted');
  /** Monday of the chosen week, or an empty string for all weeks. */
  protected readonly week = signal('');
  /** Cleared whenever a filter changes, so a bulk action never reaches rows that left the list. */
  protected readonly selected = linkedSignal<ClockEntry[]>(() => {
    this.teamId();
    this.status();
    this.week();
    return [];
  });
  /** Text of the live region, set after each review. */
  protected readonly announcement = signal('');

  private readonly locale = computed(() => this.language.language());
  /** Emits when the scope file is loaded and on language changes, so code-built text stays current. */
  private readonly scopeLoaded = toSignal(this.transloco.selectTranslation('timesheets'));
  private readonly t = (key: string, params?: Record<string, unknown>) => {
    this.scopeLoaded();
    return this.transloco.translate(key, params);
  };

  protected readonly entries = rxResource({
    params: () => ({ teamId: this.teamId(), status: this.status(), week: this.week() }),
    stream: ({ params }) =>
      this.api.entries({
        teamId: params.teamId,
        status: params.status,
        from: params.week || undefined,
        to: params.week ? addDays(params.week, 6) : undefined,
      }),
  });

  /** The list on screen: the loaded entries, changed optimistically while a review is in flight. */
  protected readonly rows = linkedSignal<ClockEntry[]>(() => this.entries.value() ?? []);

  private readonly employees = rxResource({
    stream: () => this.employeesApi.list({ pageSize: 100 }),
  });
  private readonly teams = rxResource({ stream: () => this.lookups.teams() });

  private readonly names = computed(
    () =>
      new Map(
        (this.employees.value()?.items ?? []).map((e) => [e.id, `${e.firstName} ${e.lastName}`]),
      ),
  );

  protected readonly teamOptions = computed<SelectOption[]>(() => {
    const teams = (this.teams.value() ?? []).map((t) => ({ value: t.id, label: t.name }));
    return this.isAdmin
      ? [{ value: '', label: this.t('timesheets.approvals.allTeams') }, ...teams]
      : teams.filter((t) => t.value === this.teamId());
  });

  protected readonly statusOptions = computed<SelectOption[]>(() => [
    { value: '', label: this.t('timesheets.approvals.allStatuses') },
    ...STATUS_FILTERS.map((s) => ({ value: s, label: this.t(`timesheets.status.${s}`) })),
  ]);

  protected readonly weekOptions = computed<SelectOption[]>(() => {
    const current = startOfWeek(todayIso());
    const locale = this.locale();
    return [
      { value: '', label: this.t('timesheets.approvals.allWeeks') },
      ...Array.from({ length: WEEKS_BACK }, (_, i) => {
        const start = shiftWeek(current, -i);
        return { value: start, label: formatWeekRange(start, addDays(start, 6), locale) };
      }),
    ];
  });

  protected readonly columns = computed<TableColumn<ClockEntry>[]>(() => {
    const cell = this.cell();
    const col = (
      key: string,
      header: string,
      extra: Partial<TableColumn<ClockEntry>> = {},
    ): TableColumn<ClockEntry> => ({ key, header: this.t(header), cell, ...extra });
    return [
      col('employee', 'timesheets.approvals.employee', {
        sortable: true,
        accessor: (e) => this.nameOf(e.employeeId),
        width: 'minmax(0, 1.4fr)',
      }),
      col('date', 'timesheets.approvals.date', { sortable: true, accessor: (e) => e.date }),
      col('times', 'timesheets.approvals.inOut', { width: 'minmax(0, 1fr)' }),
      col('breaks', 'timesheets.approvals.breaks', { width: '6rem' }),
      col('worked', 'timesheets.approvals.worked', {
        sortable: true,
        accessor: (e) => workedMinutes(e),
        align: 'end',
        width: '6rem',
      }),
      col('status', 'timesheets.approvals.statusColumn', { width: '7rem' }),
      col('actions', 'common.actions', { align: 'end', width: '13rem' }),
    ];
  });

  /** Only selected rows that are still on screen and submitted can be approved in bulk. */
  protected readonly approvableSelection = computed(() => {
    const ids = new Set(this.selected().map((e) => e.id));
    return this.rows().filter((e) => ids.has(e.id) && e.status === 'submitted');
  });

  protected readonly byId = (entry: ClockEntry) => entry.id;
  protected readonly selectLabel = (entry: ClockEntry) =>
    this.t('timesheets.approvals.selectRow', {
      name: this.nameOf(entry.employeeId),
      date: this.dateLabel(entry.date),
    });

  protected nameOf(employeeId: string): string {
    return this.names().get(employeeId) ?? employeeId;
  }

  protected dateLabel(date: string): string {
    return formatDate(date, this.locale());
  }

  protected timeRange(entry: ClockEntry): string {
    return `${formatTime(entry.clockIn)} - ${entry.clockOut ? formatTime(entry.clockOut) : this.t('timesheets.week.running')}`;
  }

  protected breakText(entry: ClockEntry): string {
    return formatDuration(breakMinutes(entry));
  }

  protected workedText(entry: ClockEntry): string {
    return formatDuration(workedMinutes(entry));
  }

  protected variant(status: TimesheetStatus): BadgeVariant {
    return STATUS_VARIANT[status];
  }

  protected actionLabel(action: 'approve' | 'reject', entry: ClockEntry): string {
    return this.t(`timesheets.approvals.${action}Label`, {
      name: this.nameOf(entry.employeeId),
      date: this.dateLabel(entry.date),
    });
  }

  protected setStatus(value: string): void {
    this.status.set(value as StatusFilter);
  }

  protected async approve(entry: ClockEntry): Promise<void> {
    const comment = await askReviewComment(this.dialogs, {
      title: this.t('timesheets.approvals.approveTitle'),
      message: this.t('timesheets.approvals.approveMessage', {
        name: this.nameOf(entry.employeeId),
        date: this.dateLabel(entry.date),
      }),
      confirmLabel: this.t('common.approve'),
      cancelLabel: this.t('common.cancel'),
      closeLabel: this.t('common.close'),
      commentLabel: this.t('timesheets.approvals.commentOptional'),
      variant: 'primary',
    });
    if (comment !== null) this.review([entry], 'approved', comment);
  }

  protected async reject(entry: ClockEntry): Promise<void> {
    const comment = await askReviewComment(this.dialogs, {
      title: this.t('timesheets.approvals.rejectTitle'),
      message: this.t('timesheets.approvals.rejectMessage', {
        name: this.nameOf(entry.employeeId),
        date: this.dateLabel(entry.date),
      }),
      confirmLabel: this.t('common.reject'),
      cancelLabel: this.t('common.cancel'),
      closeLabel: this.t('common.close'),
      commentLabel: this.t('timesheets.approvals.commentRequired'),
      commentHint: this.t('timesheets.approvals.commentHint'),
      requiredError: this.t('timesheets.approvals.commentMissing'),
      variant: 'danger',
    });
    if (comment !== null) this.review([entry], 'rejected', comment);
  }

  protected approveSelected(): void {
    const targets = this.approvableSelection();
    if (targets.length > 0) this.review(targets, 'approved', '');
  }

  /** The filters as they are now: used to decide whether a failed review's row belongs back. */
  private matchesFilters(entry: ClockEntry): boolean {
    const status = this.status();
    if (status && entry.status !== status) return false;
    const week = this.week();
    if (week && (entry.date < week || entry.date > addDays(week, 6))) return false;
    const team = this.teamId();
    if (team) {
      const employee = this.employees.value()?.items.find((e) => e.id === entry.employeeId);
      if (employee?.teamId !== team) return false;
    }
    return true;
  }

  /** Focus the next row that still has review buttons, else the table. */
  private focusAfterReview(index: number): void {
    const wrap = this.tableWrap()?.nativeElement;
    if (!wrap) return;
    const rows = this.rows();
    for (const entry of [...rows.slice(index), ...rows.slice(0, index).reverse()]) {
      if (entry.status !== 'submitted') continue;
      const button = wrap.querySelector<HTMLElement>(
        `button[data-entry-id="${CSS.escape(entry.id)}"]`,
      );
      if (button) {
        button.focus();
        return;
      }
    }
    wrap.focus();
  }

  /**
   * Updates the list right away, then sends the reviews. Entries the server refuses go back
   * to the list where they were; the error toast comes from the interceptor.
   */
  private review(targets: ClockEntry[], status: 'approved' | 'rejected', comment: string): void {
    const ids = new Set(targets.map((e) => e.id));
    const before = this.rows();
    // Focus is lost when the reviewed row (or the bulk button) stops being actionable; move it on.
    const active = document.activeElement;
    const hadFocus =
      !(active instanceof HTMLElement) ||
      active === document.body ||
      this.host.nativeElement.contains(active);
    const index = Math.max(
      0,
      Math.min(...targets.map((t) => before.findIndex((e) => e.id === t.id))),
    );
    this.rows.set(applyReview(before, ids, status, comment, this.status()));
    this.selected.update((current) => current.filter((e) => !ids.has(e.id)));
    this.announcement.set(
      this.t('timesheets.approvals.remaining', {
        count: this.rows().filter((e) => e.status === 'submitted').length,
      }),
    );
    if (hadFocus) afterNextRender(() => this.focusAfterReview(index), { injector: this.injector });

    forkJoin(
      targets.map((target) =>
        this.api.review(target.id, status, comment).pipe(
          map((saved) => ({ id: target.id, saved })),
          catchError(() => of({ id: target.id, saved: null })),
        ),
      ),
    ).subscribe((results) => {
      const failed = new Set(results.filter((r) => r.saved === null).map((r) => r.id));
      if (failed.size > 0) {
        this.rows.update((current) =>
          restoreEntries(current, before, failed, (e) => this.matchesFilters(e)),
        );
      }
      const done = results.length - failed.size;
      if (done > 0) {
        this.toasts.show({
          variant: 'success',
          title: this.t(
            status === 'approved'
              ? 'timesheets.approvals.approvedTitle'
              : 'timesheets.approvals.rejectedTitle',
          ),
          message: this.t(
            done === 1 ? 'timesheets.approvals.doneOne' : 'timesheets.approvals.doneMany',
            { count: done },
          ),
        });
      }
    });
  }
}
