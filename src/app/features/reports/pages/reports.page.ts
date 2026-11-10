import { DOCUMENT } from '@angular/common';
import type { TemplateRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LookupsApi } from '@core/api/lookups.api';
import { ReportsApi } from '@core/api/reports.api';
import { todayIso } from '@core/domain/time';
import { LanguageService } from '@core/i18n/i18n';
import {
  ButtonComponent,
  CardComponent,
  DatePickerComponent,
  EmptyStateComponent,
  FieldComponent,
  IconComponent,
  LineChartComponent,
  BarChartComponent,
  MultiselectComponent,
  PageHeaderComponent,
  SkeletonComponent,
  TableComponent,
  type ChartSummaryFn,
  type ComboOption,
  type TableCellContext,
  type TableColumn,
} from '@ui/index';
import { downloadTextFile, toCsv, type CsvColumn } from '../csv';
import {
  buildTableRows,
  isEmptyReport,
  isValidRange,
  presetRange,
  reportFilename,
  type RangePreset,
  type ReportTableRow,
} from '../report-model';

const PRESETS: readonly RangePreset[] = ['this-week', 'last-4-weeks', 'this-month'];

/** Hours and labor cost per team for a period, with two charts and a CSV export. */
@Component({
  selector: 'app-reports-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BarChartComponent,
    ButtonComponent,
    CardComponent,
    DatePickerComponent,
    EmptyStateComponent,
    FieldComponent,
    IconComponent,
    LineChartComponent,
    MultiselectComponent,
    PageHeaderComponent,
    SkeletonComponent,
    TableComponent,
    TranslocoPipe,
  ],
  template: `
    <ui-page-header
      [title]="'reports.title' | transloco"
      [description]="'reports.description' | transloco"
    >
      <div actions>
        <button
          ui-button
          type="button"
          variant="secondary"
          [disabled]="!canExport()"
          (click)="exportCsv()"
        >
          <ui-icon name="download" [size]="16" />
          {{ 'reports.exportCsv' | transloco }}
        </button>
      </div>
    </ui-page-header>

    <ui-card class="mb-6">
      <form
        class="flex flex-wrap items-end gap-4"
        [attr.aria-label]="'reports.filters' | transloco"
        (submit)="$event.preventDefault()"
      >
        <ui-field [label]="'common.from' | transloco" [error]="rangeError()">
          <ui-date-picker
            [value]="from()"
            (valueChange)="from.set($event)"
            [max]="to() || undefined"
            [invalid]="!!rangeError()"
            [buttonLabel]="'reports.chooseDate' | transloco"
            [calendarLabel]="'reports.calendar' | transloco"
            [previousMonthLabel]="'common.previousMonth' | transloco"
            [nextMonthLabel]="'common.nextMonth' | transloco"
          />
        </ui-field>
        <ui-field [label]="'common.to' | transloco">
          <ui-date-picker
            [value]="to()"
            (valueChange)="to.set($event)"
            [min]="from() || undefined"
            [buttonLabel]="'reports.chooseDate' | transloco"
            [calendarLabel]="'reports.calendar' | transloco"
            [previousMonthLabel]="'common.previousMonth' | transloco"
            [nextMonthLabel]="'common.nextMonth' | transloco"
          />
        </ui-field>
        <div class="flex gap-2" role="group" [attr.aria-label]="'reports.presets' | transloco">
          @for (preset of presets; track preset) {
            <button ui-button type="button" variant="ghost" (click)="applyPreset(preset)">
              {{ 'reports.preset.' + preset | transloco }}
            </button>
          }
        </div>
        <ui-field [label]="'reports.teams' | transloco" class="min-w-64 flex-1">
          <ui-multiselect
            [options]="teamOptions()"
            [value]="teamIds()"
            (valueChange)="teamIds.set($event)"
            [placeholder]="'reports.allTeams' | transloco"
            [ariaLabel]="'reports.teams' | transloco"
            [emptyText]="'common.noResults' | transloco"
            [removeLabel]="'reports.removeTeam' | transloco"
          />
        </ui-field>
      </form>
    </ui-card>

    @if (report.isLoading()) {
      <div
        class="flex flex-col gap-4"
        role="status"
        [attr.aria-label]="'common.loading' | transloco"
      >
        <ui-skeleton class="h-48 w-full" />
        <ui-skeleton class="h-72 w-full" />
      </div>
    } @else if (report.error()) {
      <ui-card>
        <ui-empty-state
          icon="alert-circle"
          [title]="'common.errorTitle' | transloco"
          [message]="'common.errorText' | transloco"
        >
          <button empty-action ui-button type="button" (click)="report.reload()">
            {{ 'common.retry' | transloco }}
          </button>
        </ui-empty-state>
      </ui-card>
    } @else if (!report.hasValue()) {
      <ui-card>
        <ui-empty-state
          icon="calendar"
          [title]="'reports.pickPeriodTitle' | transloco"
          [message]="'reports.pickPeriodText' | transloco"
        />
      </ui-card>
    } @else if (empty()) {
      <ui-card>
        <ui-empty-state
          icon="list"
          [title]="'reports.emptyTitle' | transloco"
          [message]="'reports.emptyText' | transloco"
        />
      </ui-card>
    } @else {
      <ui-card padding="flush" class="mb-6">
        <ui-table
          [label]="'reports.tableLabel' | transloco"
          [columns]="columns()"
          [rows]="tableRows()"
          [trackBy]="byTeam"
        />
      </ui-card>

      <div class="grid gap-6 lg:grid-cols-2">
        <ui-card>
          <h2 card-header class="font-title text-lg font-semibold">
            {{ 'reports.hoursByTeam' | transloco }}
          </h2>
          <ui-bar-chart
            [label]="'reports.hoursByTeam' | transloco"
            [categories]="teamNames()"
            [series]="barSeries()"
            [format]="formatHoursUnit()"
            [summaryLabel]="chartSummary()"
            [totalLabel]="'reports.total' | transloco"
            [categoryHeader]="'reports.team' | transloco"
            [emptyText]="'reports.noChartData' | transloco"
          />
        </ui-card>
        <ui-card>
          <h2 card-header class="font-title text-lg font-semibold">
            {{ 'reports.dailyHours' | transloco }}
          </h2>
          <p class="mb-2 text-sm text-foreground-subtle">
            {{ 'reports.dailyNote' | transloco }}
          </p>
          <ui-line-chart
            [label]="'reports.dailyHours' | transloco"
            [categories]="dayLabels()"
            [series]="lineSeries()"
            [format]="formatHoursUnit()"
            [summaryLabel]="chartSummary()"
            [categoryHeader]="'reports.date' | transloco"
            [emptyText]="'reports.noChartData' | transloco"
          />
        </ui-card>
      </div>
    }

    <ng-template #cell let-row let-column="column">
      <span [class.font-semibold]="row.total" [class.tabular-nums]="column.key !== 'team'">
        {{ cellText(row, column.key) }}
      </span>
    </ng-template>
  `,
})
export class ReportsPage {
  private readonly api = inject(ReportsApi);
  private readonly lookups = inject(LookupsApi);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageService);
  private readonly document = inject(DOCUMENT);

  private readonly cell = viewChild.required<TemplateRef<TableCellContext<ReportTableRow>>>('cell');

  protected readonly presets = PRESETS;
  protected readonly from = signal(presetRange('last-4-weeks', todayIso()).from);
  protected readonly to = signal(presetRange('last-4-weeks', todayIso()).to);
  protected readonly teamIds = signal<string[]>([]);
  private readonly range = computed(() => ({ from: this.from(), to: this.to() }));

  protected readonly rangeError = computed(() =>
    isValidRange(this.range()) || (!this.from() && !this.to()) ? '' : this.t('reports.rangeError'),
  );

  protected readonly report = rxResource({
    params: () => (isValidRange(this.range()) ? this.range() : undefined),
    stream: ({ params }) => this.api.get(params),
  });

  private readonly teams = rxResource({ stream: () => this.lookups.teams() });
  protected readonly teamOptions = computed<ComboOption[]>(() =>
    (this.teams.value() ?? []).map((t) => ({ value: t.id, label: t.name })),
  );

  /** Number and date formats follow the active language. */
  private readonly locale = computed(() => this.language.language());
  /** Emits when the scope file is loaded and on every language change, so `t()` stays current. */
  private readonly scopeLoaded = toSignal(this.transloco.selectTranslation('reports'));
  private readonly t = (key: string) => {
    this.scopeLoaded();
    return this.transloco.translate(key);
  };

  protected readonly chartSummary = computed<ChartSummaryFn>(() => {
    this.scopeLoaded();
    return (info) => this.transloco.translate('reports.chartSummary', info);
  });

  protected readonly tableRows = computed<ReportTableRow[]>(() => {
    const result = this.report.value();
    if (!result) return [];
    const totalName = this.t('reports.total');
    return buildTableRows(result, this.teamIds()).map((r) =>
      r.total ? { ...r, teamName: totalName } : r,
    );
  });

  protected readonly empty = computed(() => isEmptyReport(this.tableRows()));
  protected readonly canExport = computed(
    () => this.report.hasValue() && !this.report.isLoading() && !this.empty(),
  );

  private readonly hoursFormat = computed(
    () =>
      new Intl.NumberFormat(this.locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  );
  private readonly signedHoursFormat = computed(
    () =>
      new Intl.NumberFormat(this.locale(), {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        signDisplay: 'exceptZero',
      }),
  );
  private readonly currencyFormat = computed(
    () => new Intl.NumberFormat(this.locale(), { style: 'currency', currency: 'EUR' }),
  );

  protected readonly formatHoursUnit = computed(() => {
    const fmt = this.hoursFormat();
    return (value: number) => `${fmt.format(value)} h`;
  });

  protected readonly columns = computed<TableColumn<ReportTableRow>[]>(() => {
    const cell = this.cell();
    const col = (key: string, header: string, align: 'start' | 'end') => ({
      key,
      header: this.t(header),
      align,
      cell,
    });
    return [
      col('team', 'reports.team', 'start'),
      col('worked', 'reports.workedHours', 'end'),
      col('scheduled', 'reports.scheduledHours', 'end'),
      col('difference', 'reports.difference', 'end'),
      col('cost', 'reports.laborCost', 'end'),
    ];
  });

  private readonly chartRows = computed(() => this.tableRows().filter((r) => !r.total));
  protected readonly teamNames = computed(() => this.chartRows().map((r) => r.teamName));
  protected readonly barSeries = computed(() => [
    { name: this.t('reports.workedHours'), values: this.chartRows().map((r) => r.workedHours) },
    {
      name: this.t('reports.scheduledHours'),
      values: this.chartRows().map((r) => r.scheduledHours),
    },
  ]);

  private readonly daily = computed(() => this.report.value()?.daily ?? []);
  protected readonly dayLabels = computed(() => {
    const fmt = new Intl.DateTimeFormat(this.locale(), { day: 'numeric', month: 'short' });
    return this.daily().map((d) => fmt.format(new Date(`${d.date}T12:00:00`)));
  });
  protected readonly lineSeries = computed(() => [
    { name: this.t('reports.workedHours'), values: this.daily().map((d) => d.hours) },
  ]);

  protected readonly byTeam = (row: ReportTableRow) => row.teamId;

  protected cellText(row: ReportTableRow, key: string): string {
    switch (key) {
      case 'team':
        return row.teamName;
      case 'worked':
        return this.hoursFormat().format(row.workedHours);
      case 'scheduled':
        return this.hoursFormat().format(row.scheduledHours);
      case 'difference':
        return this.signedHoursFormat().format(row.differenceHours);
      default:
        return this.currencyFormat().format(row.laborCostCents / 100);
    }
  }

  protected applyPreset(preset: RangePreset): void {
    const range = presetRange(preset, todayIso());
    this.from.set(range.from);
    this.to.set(range.to);
  }

  /** Same rows as the table. Hours with 2 decimals and cost in euros with 2 decimals, dot separated. */
  protected exportCsv(): void {
    const columns: CsvColumn<ReportTableRow>[] = [
      { header: this.t('reports.team'), value: (r) => r.teamName },
      { header: this.t('reports.workedHours'), value: (r) => r.workedHours.toFixed(2) },
      { header: this.t('reports.scheduledHours'), value: (r) => r.scheduledHours.toFixed(2) },
      { header: this.t('reports.difference'), value: (r) => r.differenceHours.toFixed(2) },
      { header: this.t('reports.laborCostEur'), value: (r) => (r.laborCostCents / 100).toFixed(2) },
    ];
    downloadTextFile(this.document, reportFilename(this.range()), toCsv(this.tableRows(), columns));
  }
}
