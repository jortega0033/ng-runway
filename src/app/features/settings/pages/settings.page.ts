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
import { forkJoin } from 'rxjs';
import { LookupsApi } from '@core/api/lookups.api';
import type { AbsenceType, Location, Team } from '@core/api/models';
import { AuthService } from '@core/auth/auth.service';
import { DemoDataService } from '@core/dev/demo-data.service';
import { LANGUAGES, LanguageService, type Language } from '@core/i18n/i18n';
import { ThemeService, type ThemePreference } from '@core/theme/theme.service';
import { dataTokens } from '@tokens';
import {
  AlertComponent,
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
  PageHeaderComponent,
  RadioGroupComponent,
  SkeletonComponent,
  TableComponent,
  type SelectOption,
  type TableCellContext,
  type TableColumn,
} from '@ui/index';

const THEMES: readonly ThemePreference[] = ['light', 'dark', 'system'];

interface LocationRow extends Location {
  teamCount: number;
}

/** Appearance and language for everyone, reference data for managers, demo data for admins. */
@Component({
  selector: 'app-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    PageHeaderComponent,
    RadioGroupComponent,
    SkeletonComponent,
    TableComponent,
    TranslocoPipe,
  ],
  template: `
    <ui-page-header
      [title]="'settings.title' | transloco"
      [description]="'settings.description' | transloco"
    />

    <div class="flex max-w-5xl flex-col gap-6">
      <ui-card>
        <h2 card-header class="font-title text-lg font-semibold">
          {{ 'settings.appearance' | transloco }}
        </h2>
        <ui-radio-group
          [label]="'theme.label' | transloco"
          [options]="themeOptions()"
          [value]="theme.preference()"
          (valueChange)="setTheme($event)"
        />
      </ui-card>

      <ui-card>
        <h2 card-header class="font-title text-lg font-semibold">
          {{ 'settings.language' | transloco }}
        </h2>
        <ui-radio-group
          [label]="'settings.language' | transloco"
          [options]="languageOptions()"
          [value]="language.language()"
          (valueChange)="setLanguage($event)"
        />
      </ui-card>

      @if (auth.isManager()) {
        <ui-alert variant="info">{{ 'settings.readOnly' | transloco }}</ui-alert>

        @if (lookups.isLoading()) {
          <div
            class="flex flex-col gap-4"
            role="status"
            [attr.aria-label]="'common.loading' | transloco"
          >
            <ui-skeleton class="h-40 w-full" />
            <ui-skeleton class="h-40 w-full" />
          </div>
        } @else if (lookups.error()) {
          <ui-card>
            <ui-empty-state
              icon="alert-circle"
              [title]="'common.errorTitle' | transloco"
              [message]="'common.errorText' | transloco"
            >
              <button empty-action ui-button type="button" (click)="lookups.reload()">
                {{ 'common.retry' | transloco }}
              </button>
            </ui-empty-state>
          </ui-card>
        } @else {
          <ui-card padding="flush">
            <h2 card-header class="font-title text-lg font-semibold">
              {{ 'settings.teams' | transloco }}
            </h2>
            <ui-table
              [label]="'settings.teams' | transloco"
              [columns]="teamColumns()"
              [rows]="teams()"
              [trackBy]="byId"
              [emptyTitle]="'common.emptyTitle' | transloco"
              dense
            />
          </ui-card>

          <ui-card padding="flush">
            <h2 card-header class="font-title text-lg font-semibold">
              {{ 'settings.locations' | transloco }}
            </h2>
            <ui-table
              [label]="'settings.locations' | transloco"
              [columns]="locationColumns()"
              [rows]="locations()"
              [trackBy]="byId"
              [emptyTitle]="'common.emptyTitle' | transloco"
              dense
            />
          </ui-card>

          <ui-card padding="flush">
            <h2 card-header class="font-title text-lg font-semibold">
              {{ 'settings.absenceTypes' | transloco }}
            </h2>
            <ui-table
              [label]="'settings.absenceTypes' | transloco"
              [columns]="absenceColumns()"
              [rows]="absenceTypes()"
              [trackBy]="byKey"
              [emptyTitle]="'common.emptyTitle' | transloco"
              dense
            />
          </ui-card>
        }
      }

      @if (auth.role() === 'admin') {
        <ui-card>
          <h2 card-header class="font-title text-lg font-semibold">
            {{ 'settings.demoData' | transloco }}
          </h2>
          <p class="mb-4 text-base text-foreground-subtle">
            {{ 'settings.demoDataText' | transloco }}
          </p>
          <button
            ui-button
            type="button"
            variant="danger"
            [loading]="resetting()"
            (click)="resetDemoData()"
          >
            {{ 'dev.reset' | transloco }}
          </button>
        </ui-card>
      }
    </div>

    <ng-template #teamCell let-team>
      <span class="inline-flex items-center gap-2">
        <span
          class="inline-block size-3 shrink-0 rounded-full border border-border"
          aria-hidden="true"
          [style.background-color]="team.color"
        ></span>
        {{ team.name }}
      </span>
    </ng-template>
    <ng-template #absenceCell let-type>
      <span class="inline-flex items-center gap-2">
        <span
          class="inline-block size-3 shrink-0 rounded-full border border-border"
          aria-hidden="true"
          [style.background-color]="absenceColor(type.key)"
        ></span>
        {{ type.name }}
      </span>
    </ng-template>
  `,
})
export class SettingsPage {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  protected readonly language = inject(LanguageService);
  private readonly transloco = inject(TranslocoService);
  private readonly api = inject(LookupsApi);
  private readonly demo = inject(DemoDataService);
  private readonly scopeLoaded = toSignal(this.transloco.selectTranslation('settings'));

  private readonly teamCell = viewChild.required<TemplateRef<TableCellContext<Team>>>('teamCell');
  private readonly absenceCell =
    viewChild.required<TemplateRef<TableCellContext<AbsenceType>>>('absenceCell');

  protected readonly resetting = signal(false);

  protected readonly lookups = rxResource({
    params: () => (this.auth.isManager() ? true : undefined),
    stream: () =>
      forkJoin({
        teams: this.api.teams(),
        locations: this.api.locations(),
        absenceTypes: this.api.absenceTypes(),
      }),
  });

  protected readonly teams = computed(() => this.lookups.value()?.teams ?? []);
  protected readonly absenceTypes = computed(() => this.lookups.value()?.absenceTypes ?? []);
  protected readonly locations = computed<LocationRow[]>(() => {
    const value = this.lookups.value();
    return (value?.locations ?? []).map((l) => ({
      ...l,
      teamCount: value?.teams.filter((t) => t.locationId === l.id).length ?? 0,
    }));
  });

  protected readonly themeOptions = computed<SelectOption[]>(() =>
    THEMES.map((value) => ({ value, label: this.t(`theme.${value}`) })),
  );
  protected readonly languageOptions = computed<SelectOption[]>(() =>
    LANGUAGES.map((value) => ({ value, label: this.t(`settings.languages.${value}`) })),
  );

  protected readonly teamColumns = computed<TableColumn<Team>[]>(() => {
    const locationName = new Map(
      (this.lookups.value()?.locations ?? []).map((l) => [l.id, l.name]),
    );
    return [
      { key: 'name', header: this.t('settings.name'), cell: this.teamCell() },
      {
        key: 'location',
        header: this.t('settings.location'),
        accessor: (team) => locationName.get(team.locationId) ?? '',
      },
    ];
  });

  protected readonly locationColumns = computed<TableColumn<LocationRow>[]>(() => [
    { key: 'name', header: this.t('settings.name') },
    { key: 'city', header: this.t('settings.city') },
    {
      key: 'teamCount',
      header: this.t('settings.teamCount'),
      align: 'end',
    },
  ]);

  protected readonly absenceColumns = computed<TableColumn<AbsenceType>[]>(() => [
    { key: 'name', header: this.t('settings.name'), cell: this.absenceCell() },
    {
      key: 'paid',
      header: this.t('settings.paid'),
      accessor: (type) => this.t(type.paid ? 'common.yes' : 'common.no'),
    },
    {
      key: 'yearlyDays',
      header: this.t('settings.yearlyDays'),
      align: 'end',
      accessor: (type) => type.yearlyDays ?? '-',
    },
  ]);

  protected readonly byId = (row: { id: string }) => row.id;
  protected readonly byKey = (row: AbsenceType) => row.key;

  protected absenceColor(key: AbsenceType['key']): string {
    return dataTokens.absence[key];
  }

  protected setTheme(value: string): void {
    const preference = THEMES.find((t) => t === value);
    if (preference) this.theme.set(preference);
  }

  protected setLanguage(value: string): void {
    const next = LANGUAGES.find((l): l is Language => l === value);
    if (next) this.language.set(next);
  }

  protected async resetDemoData(): Promise<void> {
    this.resetting.set(true);
    try {
      await this.demo.reset({
        confirm: {
          title: this.t('settings.resetTitle'),
          message: this.t('settings.resetMessage'),
          confirmLabel: this.t('settings.resetConfirm'),
          cancelLabel: this.t('common.cancel'),
        },
        done: this.t('settings.resetDone'),
      });
    } finally {
      this.resetting.set(false);
    }
  }

  private t(key: string): string {
    this.scopeLoaded();
    return this.transloco.translate(key);
  }
}
