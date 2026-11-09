import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { colorTokenNames, dataTokens } from '@tokens';
import { ThemeService, type ThemePreference } from '@core/theme/theme.service';
import { PageHeaderComponent } from '@ui/page-header/page-header';
import { SegmentedComponent } from '@ui/segmented/segmented';
import { DsChartsNavComponent } from './sections/charts-nav-section';
import { BasicsSectionComponent } from './sections/basics-section';
import { DataSectionComponent } from './sections/data-section';
import { FormsSectionComponent } from './sections/forms-section';
import { OverlaysSectionComponent } from './sections/overlays-section';
import { PickersSectionComponent } from './sections/pickers-section';

/** Groups the semantic color tokens by their first word, for the swatch grid. */
function group(names: readonly string[]): { title: string; names: string[] }[] {
  const map = new Map<string, string[]>();
  for (const name of names) {
    const key = name.split('-')[0] ?? name;
    map.set(key, [...(map.get(key) ?? []), name]);
  }
  return [...map.entries()].map(([title, list]) => ({ title, names: list }));
}

/** Every token and every component state in one place. Use the toggle to check both themes. */
@Component({
  selector: 'app-design-system-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BasicsSectionComponent,
    DataSectionComponent,
    DsChartsNavComponent,
    FormsSectionComponent,
    OverlaysSectionComponent,
    PageHeaderComponent,
    PickersSectionComponent,
    SegmentedComponent,
  ],
  template: `
    <div class="flex flex-col gap-10">
      <ui-page-header
        title="Design system"
        description="Tokens and components. Switch the theme to check both."
      >
        <ui-segmented
          actions
          label="Theme"
          [options]="themes"
          [value]="theme.preference()"
          (valueChange)="theme.set($any($event))"
        />
      </ui-page-header>

      <section aria-labelledby="ds-colors">
        <h2 id="ds-colors" class="mb-4 text-2xl font-semibold">Colors</h2>
        @for (g of colorGroups; track g.title) {
          <h3 class="mt-4 mb-2 text-sm font-medium text-foreground-subtle capitalize">
            {{ g.title }}
          </h3>
          <ul class="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            @for (name of g.names; track name) {
              <li class="flex items-center gap-2 text-xs">
                <span
                  class="size-8 shrink-0 rounded-md border border-border"
                  [style.background-color]="'var(--colors-' + name + ')'"
                ></span>
                <code class="break-all">{{ name }}</code>
              </li>
            }
          </ul>
        }
      </section>

      <section aria-labelledby="ds-data">
        <h2 id="ds-data-colors" class="mb-4 text-2xl font-semibold">Data colors</h2>
        <h3 id="ds-data" class="mb-2 text-sm font-medium text-foreground-subtle">Absence types</h3>
        <ul class="flex flex-wrap gap-3">
          @for (entry of absence; track entry[0]) {
            <li class="flex items-center gap-2 text-xs">
              <span
                class="size-5 rounded-sm border border-border"
                [style.background-color]="entry[1]"
              ></span>
              {{ entry[0] }}
            </li>
          }
        </ul>
        <h3 class="mt-4 mb-2 text-sm font-medium text-foreground-subtle">Entity palette</h3>
        <ul class="flex flex-wrap gap-2">
          @for (hex of palette; track hex) {
            <li class="size-6 rounded-sm border border-border" [style.background-color]="hex"></li>
          }
        </ul>
      </section>

      <section aria-labelledby="ds-type">
        <h2 id="ds-type" class="mb-4 text-2xl font-semibold">Typography</h2>
        <p class="font-title text-4xl font-semibold">Parkinsans title 36</p>
        <p class="font-title text-2xl font-semibold">Parkinsans title 24</p>
        <p class="text-base">Satoshi body 16. Shifts, hours and balances.</p>
        <p class="text-sm text-foreground-subtle">Satoshi small 14, subtle.</p>
      </section>

      <section aria-labelledby="ds-basics">
        <h2 id="ds-basics" class="mb-4 text-2xl font-semibold">Basics</h2>
        <app-ds-basics />
      </section>
      <section aria-labelledby="ds-forms">
        <h2 id="ds-forms" class="mb-4 text-2xl font-semibold">Forms</h2>
        <app-ds-forms />
      </section>
      <section aria-labelledby="ds-pickers">
        <h2 id="ds-pickers" class="mb-4 text-2xl font-semibold">Pickers and selects</h2>
        <app-ds-pickers />
      </section>
      <section aria-labelledby="ds-data-display">
        <h2 id="ds-data-display" class="mb-4 text-2xl font-semibold">Data display</h2>
        <app-ds-data />
      </section>
      <section aria-labelledby="ds-overlays">
        <h2 id="ds-overlays" class="mb-4 text-2xl font-semibold">Overlays and toasts</h2>
        <app-ds-overlays />
      </section>
      <section aria-labelledby="ds-charts">
        <h2 id="ds-charts" class="mb-4 text-2xl font-semibold">Charts and navigation</h2>
        <app-ds-charts-nav />
      </section>
    </div>
  `,
})
export class DesignSystemPage {
  protected readonly theme = inject(ThemeService);
  protected readonly colorGroups = group(colorTokenNames);
  protected readonly absence = Object.entries(dataTokens.absence);
  protected readonly palette = dataTokens.entityPalette;
  protected readonly themes: { value: ThemePreference; label: string }[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
  ];
}
