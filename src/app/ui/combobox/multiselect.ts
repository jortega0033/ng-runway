import { Combobox, ComboboxPopup } from '@angular/aria/combobox';
import { CdkConnectedOverlay, CdkOverlayOrigin } from '@angular/cdk/overlay';
import type { ElementRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { FIELD_CONTEXT } from '../field/field';
import { CONTROL_INVALID, CONTROL_OK, type ControlSize } from '../input/input';
import { IconComponent } from '../icon/icon';
import { TagComponent } from '../tag/tag';
import { POPUP_POSITIONS } from './combobox';
import {
  type ComboOption,
  OptionListComponent,
  filterOptions,
  mergeSelection,
} from './option-list';

const SIZES: Record<ControlSize, string> = {
  sm: 'min-h-8 text-sm',
  md: 'min-h-9 text-base',
  lg: 'min-h-10 text-lg',
};

/**
 * Searchable multi select. Selected values are shown as removable chips in front of the
 * search input; Backspace in the empty input removes the last chip.
 */
@Component({
  selector: 'ui-multiselect',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Combobox,
    ComboboxPopup,
    CdkConnectedOverlay,
    CdkOverlayOrigin,
    OptionListComponent,
    IconComponent,
    TagComponent,
  ],
  host: { class: 'block' },
  template: `
    <div
      class="relative flex flex-wrap items-center gap-1.5 rounded-md border bg-background-surface-page py-1 pl-2 pr-9 transition-colors focus-within:outline-2 focus-within:outline-border-brand"
      [class]="wrapperClasses()"
      cdkOverlayOrigin
      #origin="cdkOverlayOrigin"
    >
      @for (item of chips(); track item.value) {
        <ui-tag
          [removable]="!disabled() && !readonly()"
          [removeLabel]="removeLabel() + ' ' + item.label"
          (removed)="remove(item.value)"
        >
          {{ item.label }}
        </ui-tag>
      }
      <input
        ngCombobox
        #cb="ngCombobox"
        #control
        type="text"
        autocomplete="off"
        class="h-6 min-w-24 flex-1 bg-transparent px-1 text-foreground outline-none placeholder:text-foreground-placeholder disabled:cursor-not-allowed disabled:text-foreground-disabled"
        [id]="field?.controlId() ?? null"
        [placeholder]="value().length ? '' : placeholder()"
        [disabled]="disabled()"
        [readonly]="readonly()"
        [required]="(required() || (field?.required() ?? false)) && value().length === 0"
        [attr.aria-label]="ariaLabel() || null"
        [attr.aria-invalid]="isInvalid() ? 'true' : null"
        [attr.aria-describedby]="field?.describedBy() ?? null"
        [softDisabled]="false"
        [expanded]="open()"
        (expandedChange)="setOpen($event)"
        [(value)]="text"
        (input)="onInput(control.value)"
        (click)="openList()"
        (keydown.backspace)="onBackspace()"
        (blur)="onBlur()"
      />
      <ui-icon
        name="chevron-down"
        [size]="16"
        class="pointer-events-none absolute right-2.5 top-2.5 text-foreground-subtle"
      />
    </div>
    <ng-template ngComboboxPopup [combobox]="cb">
      <ng-template
        [cdkConnectedOverlay]="{ origin, usePopover: 'inline', matchWidth: true }"
        [cdkConnectedOverlayOpen]="true"
        [cdkConnectedOverlayPositions]="positions"
      >
        <ui-option-list
          multi
          [options]="visibleOptions()"
          [selected]="value()"
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
export class MultiselectComponent implements FormValueControl<string[]> {
  protected readonly field = inject(FIELD_CONTEXT, { optional: true });
  private readonly control = viewChild.required<ElementRef<HTMLInputElement>>('control');

  readonly value = model<string[]>([]);
  readonly options = input.required<readonly ComboOption[]>();
  readonly placeholder = input('');
  readonly ariaLabel = input('');
  readonly size = input<ControlSize>('md');
  readonly emptyText = input('No results');
  readonly loadingText = input('Loading');
  /** Prefix of each chip's remove button label, followed by the option label. */
  readonly removeLabel = input('Remove');
  readonly loading = input(false, { transform: booleanAttribute });
  /** Skip the built-in label filter when the caller filters on the server through `query`. */
  readonly externalFilter = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly required = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly touch = output();
  /** Raw text as typed, without debounce. */
  readonly query = output<string>();

  protected readonly positions = POPUP_POSITIONS;
  protected readonly open = signal(false);
  protected readonly text = signal('');
  private readonly filterTerm = signal('');

  protected readonly chips = computed(() =>
    this.value().map((v) => ({
      value: v,
      label: this.options().find((o) => o.value === v)?.label ?? v,
    })),
  );
  protected readonly visibleOptions = computed(() =>
    this.externalFilter() ? this.options() : filterOptions(this.options(), this.filterTerm()),
  );

  protected readonly isInvalid = computed(() => this.invalid() || (this.field?.invalid() ?? false));
  protected readonly wrapperClasses = computed(
    () =>
      `${this.isInvalid() ? CONTROL_INVALID : CONTROL_OK} ${SIZES[this.size()]} ${this.disabled() ? 'cursor-not-allowed bg-background-alt' : ''}`,
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
    if (!expanded) this.resetText();
  }

  protected onInput(text: string): void {
    this.filterTerm.set(text);
    this.query.emit(text);
  }

  protected onBlur(): void {
    if (!this.open()) this.touch.emit();
  }

  protected onSelect(values: string[]): void {
    this.value.set(mergeSelection(this.value(), values, this.visibleOptions()));
    this.resetText();
  }

  protected remove(value: string): void {
    this.value.update((current) => current.filter((v) => v !== value));
    this.focus();
  }

  protected onBackspace(): void {
    if (this.control().nativeElement.value === '' && this.value().length > 0 && !this.readonly()) {
      this.value.update((current) => current.slice(0, -1));
    }
  }

  private resetText(): void {
    this.text.set('');
    this.filterTerm.set('');
    this.control().nativeElement.value = '';
  }
}
