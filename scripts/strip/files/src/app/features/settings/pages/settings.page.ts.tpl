import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '@core/auth/auth.service';
import { DemoDataService } from '@core/dev/demo-data.service';
import { LANGUAGES, LanguageService, type Language } from '@core/i18n/i18n';
import { ThemeService, type ThemePreference } from '@core/theme/theme.service';
import {
  ButtonComponent,
  CardComponent,
  PageHeaderComponent,
  RadioGroupComponent,
  type SelectOption,
} from '@ui/index';

const THEMES: readonly ThemePreference[] = ['light', 'dark', 'system'];

/** Appearance and language for everyone, demo data for admins. */
@Component({
  selector: 'app-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, CardComponent, PageHeaderComponent, RadioGroupComponent, TranslocoPipe],
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
  `,
})
export class SettingsPage {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  protected readonly language = inject(LanguageService);
  private readonly transloco = inject(TranslocoService);
  private readonly demo = inject(DemoDataService);
  private readonly scopeLoaded = toSignal(this.transloco.selectTranslation('settings'));

  protected readonly resetting = signal(false);

  protected readonly themeOptions = computed<SelectOption[]>(() =>
    THEMES.map((value) => ({ value, label: this.t(`theme.${value}`) })),
  );
  protected readonly languageOptions = computed<SelectOption[]>(() =>
    LANGUAGES.map((value) => ({ value, label: this.t(`settings.languages.${value}`) })),
  );

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
