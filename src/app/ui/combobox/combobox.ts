import { Combobox, ComboboxPopup } from '@angular/aria/combobox';
import {
  CdkConnectedOverlay,
  CdkOverlayOrigin,
  type ConnectedPosition,
} from '@angular/cdk/overlay';
import type { ElementRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  inject,
  input,
  linkedSignal,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { FIELD_CONTEXT } from '../field/field';
import { CONTROL_BASE, CONTROL_INVALID, CONTROL_OK, type ControlSize } from '../input/input';
import { IconComponent } from '../icon/icon';
import { type ComboOption, OptionListComponent, filterOptions } from './option-list';

const SIZES: Record<ControlSize, string> = {
  sm: 'h-8 text-sm',
  md: 'h-9 text-base',
  lg: 'h-10 text-lg',
};

export const POPUP_POSITIONS: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
];

/**
 * Searchable single select built on the @angular/aria combobox and listbox.
 * `query` emits the raw typed text so the caller can debounce and load options asynchronously
 * (pass the result back through `options` and show `loading` meanwhile).
 */
@Component({
  selector: 'ui-combobox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Combobox,
    ComboboxPopup,
    CdkConnectedOverlay,
    CdkOverlayOrigin,
    OptionListComponent,
    IconComponent,
  ],
  host: { class: 'block' },
  template: `
    <div class="relative" cdkOverlayOrigin #origin="cdkOverlayOrigin">
      <input
        ngCombobox
        #cb="ngCombobox"
        #control
        type="text"
        autocomplete="off"
        [class]="classes()"
        [id]="field?.controlId() ?? null"
        [placeholder]="placeholder()"
        [disabled]="disabled()"
        [readonly]="readonly()"
        [required]="required() || (field?.required() ?? false)"
        [attr.name]="name() || null"
        [attr.aria-label]="ariaLabel() || null"
        [attr.aria-invalid]="isInvalid() ? 'true' : null"
        [attr.aria-describedby]="field?.describedBy() ?? null"
        [softDisabled]="false"
        [expanded]="open()"
        (expandedChange)="setOpen($event)"
        [(value)]="text"
        (input)="onInput(control.value)"
        (click)="openList()"
        (blur)="onBlur()"
      />
      <span class="absolute inset-y-0 right-1 flex items-center gap-0.5">
        @if (clearable() && !disabled() && !readonly() && (value() || text())) {
          <button
            type="button"
            class="inline-flex size-6 items-center justify-center rounded-sm text-foreground-subtle outline-offset-0 hover:bg-background-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-border-brand"
            [attr.aria-label]="clearLabel()"
            (click)="clear()"
          >
            <ui-icon name="x" [size]="16" />
          </button>
        }
        <ui-icon name="chevron-down" [size]="16" class="mr-1.5 text-foreground-subtle" />
      </span>
    </div>
    <ng-template ngComboboxPopup [combobox]="cb">
      <ng-template
        [cdkConnectedOverlay]="{ origin, usePopover: 'inline', matchWidth: true }"
        [cdkConnectedOverlayOpen]="true"
        [cdkConnectedOverlayPositions]="positions"
      >
        <ui-option-list
          [options]="visibleOptions()"
          [selected]="selectedList()"
          [loading]="loading()"
          [emptyText]="emptyText()"
          [loadingText]="loadingText()"
          [label]="ariaLabel()"
          (selectedChange)="onSelect($event)"
        />
      </ng-template>
    </ng-template>
  `,
})
export class ComboboxComponent implements FormValueControl<string> {
  protected readonly field = inject(FIELD_CONTEXT, { optional: true });
  private readonly control = viewChild.required<ElementRef<HTMLInputElement>>('control');

  /** Selected option value. An empty string means nothing is selected. */
  readonly value = model('');
  readonly options = input.required<readonly ComboOption[]>();
  readonly placeholder = input('');
  readonly name = input('');
  readonly ariaLabel = input('');
  readonly size = input<ControlSize>('md');
  readonly emptyText = input('No results');
  readonly loadingText = input('Loading');
  readonly clearLabel = input('Clear');
  /** Show a loading row in the list, for options that arrive asynchronously. */
  readonly loading = input(false, { transform: booleanAttribute });
  readonly clearable = input(true, { transform: booleanAttribute });
  /**
   * Skip the built-in label filter. Use it when the caller filters on the server through `query`.
   */
  readonly externalFilter = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly required = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly touch = output();
  /** Raw text as typed, without debounce. Emits an empty string when the text is cleared. */
  readonly query = output<string>();

  protected readonly positions = POPUP_POSITIONS;
  protected readonly open = signal(false);
  private readonly filterTerm = signal('');

  private readonly selectedLabel = computed(
    () => this.options().find((o) => o.value === this.value())?.label ?? '',
  );
  /** Text shown in the input: the selected label until the user types. */
  protected readonly text = linkedSignal(() => this.selectedLabel());
  protected readonly selectedList = computed(() => (this.value() ? [this.value()] : []));
  protected readonly visibleOptions = computed(() =>
    this.externalFilter() ? this.options() : filterOptions(this.options(), this.filterTerm()),
  );

  protected readonly isInvalid = computed(() => this.invalid() || (this.field?.invalid() ?? false));
  protected readonly classes = computed(
    () =>
      `${CONTROL_BASE} ${this.isInvalid() ? CONTROL_INVALID : CONTROL_OK} ${SIZES[this.size()]} pl-3 pr-14`,
  );

  focus(options?: FocusOptions): void {
    this.control().nativeElement.focus(options);
  }

  /** Open the option list, for example from a button next to the control. */
  openList(): void {
    if (!this.disabled() && !this.readonly()) this.open.set(true);
  }

  protected setOpen(expanded: boolean): void {
    this.open.set(expanded);
    if (!expanded) {
      // Leaving without a pick restores the selected label.
      this.filterTerm.set('');
      this.text.set(this.selectedLabel());
    }
  }

  protected onInput(text: string): void {
    this.filterTerm.set(text);
    this.query.emit(text);
  }

  protected onBlur(): void {
    if (!this.open()) this.touch.emit();
  }

  protected onSelect(values: string[]): void {
    const next = values.find((v) => v !== this.value()) ?? this.value();
    this.value.set(next);
    this.text.set(this.options().find((o) => o.value === next)?.label ?? '');
    this.setOpen(false);
    this.focus();
    this.touch.emit();
  }

  protected clear(): void {
    this.value.set('');
    this.text.set('');
    this.filterTerm.set('');
    this.query.emit('');
    this.focus();
  }
}
