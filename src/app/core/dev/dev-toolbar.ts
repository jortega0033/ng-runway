import { ChangeDetectionStrategy, Component, inject, isDevMode, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { DevApi } from '../api/dev.api';
import {
  DEFAULT_DEV_CONTROLS,
  readDevControls,
  writeDevControls,
  type DevControls,
} from '../mock/dev-controls';
import { ButtonComponent } from '@ui/button/button';
import { FieldComponent } from '@ui/field/field';
import { SelectComponent, type SelectOption } from '@ui/select/select';
import { SwitchComponent } from '@ui/switch/switch';

/** Set `localStorage['ng-runway.devtools'] = '1'` to show the toolbar in a production build (e2e does). */
export const DEVTOOLS_FLAG_KEY = 'ng-runway.devtools';

export function devToolbarEnabled(): boolean {
  try {
    return isDevMode() || localStorage.getItem(DEVTOOLS_FLAG_KEY) === '1';
  } catch {
    return isDevMode();
  }
}

/** Makes the mock API slow, flaky or empty on purpose, to try loading, error and empty states. */
@Component({
  selector: 'app-dev-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, FieldComponent, SelectComponent, SwitchComponent, TranslocoPipe],
  host: { class: 'fixed bottom-4 left-4 z-50' },
  template: `
    <button
      ui-button
      variant="secondary"
      size="sm"
      type="button"
      aria-controls="dev-toolbar-panel"
      [attr.aria-expanded]="open()"
      (click)="open.set(!open())"
    >
      {{ 'shell.devToolbar' | transloco }}
    </button>
    @if (open()) {
      <div
        id="dev-toolbar-panel"
        role="group"
        [attr.aria-label]="'shell.devToolbar' | transloco"
        class="mt-2 flex w-64 flex-col gap-3 rounded-lg border border-border bg-background-surface-page p-4 shadow-lg"
      >
        <ui-field [label]="'dev.slow' | transloco">
          <ui-select [value]="slow()" [options]="slowOptions" (valueChange)="setSlow($event)" />
        </ui-field>
        <ui-field [label]="'dev.errors' | transloco">
          <ui-select
            [value]="errors()"
            [options]="errorOptions"
            (valueChange)="setErrors($event)"
          />
        </ui-field>
        <ui-switch [checked]="controls().empty" (checkedChange)="setEmpty($event)">
          {{ 'dev.empty' | transloco }}
        </ui-switch>
        <button ui-button variant="danger" size="sm" type="button" (click)="reset()">
          {{ 'dev.reset' | transloco }}
        </button>
      </div>
    }
  `,
})
export class DevToolbarComponent {
  private readonly api = inject(DevApi);
  protected readonly open = signal(false);
  protected readonly controls = signal<DevControls>(readDevControls(localStorage));

  protected readonly slowOptions: SelectOption[] = [
    { value: '0', label: 'Off' },
    { value: '800', label: '800 ms' },
    { value: '3000', label: '3 s' },
  ];
  protected readonly errorOptions: SelectOption[] = [
    { value: '0', label: 'Off' },
    { value: '0.3', label: '30%' },
    { value: '1', label: '100%' },
  ];

  protected slow = () => String(this.controls().slowMs);
  protected errors = () => String(this.controls().errorRate);

  protected setSlow(value: string): void {
    this.update({ slowMs: Number(value) });
  }

  protected setErrors(value: string): void {
    this.update({ errorRate: Number(value) });
  }

  protected setEmpty(empty: boolean): void {
    this.update({ empty });
  }

  protected reset(): void {
    writeDevControls(localStorage, DEFAULT_DEV_CONTROLS);
    this.api.resetDemoData().subscribe({ complete: () => location.reload() });
  }

  private update(patch: Partial<DevControls>): void {
    const next = { ...this.controls(), ...patch };
    this.controls.set(next);
    writeDevControls(localStorage, next);
  }
}
