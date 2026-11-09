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
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { FIELD_CONTEXT } from '../field/field';
import {
  CONTROL_BASE,
  CONTROL_INVALID,
  CONTROL_OK,
  CONTROL_SIZES,
  type ControlSize,
} from '../input/input';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

/** Single choice from a short list. Uses the native select: best keyboard and screen reader support. */
@Component({
  selector: 'ui-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <select
      #control
      [class]="classes()"
      [id]="field?.controlId() ?? null"
      [disabled]="disabled()"
      [required]="required() || (field?.required() ?? false)"
      [attr.aria-invalid]="isInvalid() ? 'true' : null"
      [attr.aria-describedby]="field?.describedBy() ?? null"
      (change)="value.set(control.value)"
      (blur)="touch.emit()"
    >
      @if (placeholder()) {
        <option value="" [selected]="value() === ''">{{ placeholder() }}</option>
      }
      @for (option of options(); track option.value) {
        <option
          [value]="option.value"
          [disabled]="option.disabled ?? false"
          [selected]="option.value === value()"
        >
          {{ option.label }}
        </option>
      }
    </select>
  `,
})
export class SelectComponent implements FormValueControl<string> {
  protected readonly field = inject(FIELD_CONTEXT, { optional: true });
  private readonly control = viewChild.required<ElementRef<HTMLSelectElement>>('control');

  readonly value = model('');
  readonly options = input.required<readonly SelectOption[]>();
  readonly placeholder = input('');
  readonly size = input<ControlSize>('md');
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly required = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly touch = output();

  protected readonly isInvalid = computed(() => this.invalid() || (this.field?.invalid() ?? false));
  protected readonly classes = computed(
    () =>
      `${CONTROL_BASE} ${this.isInvalid() ? CONTROL_INVALID : CONTROL_OK} ${CONTROL_SIZES[this.size()]}`,
  );

  focus(options?: FocusOptions): void {
    this.control().nativeElement.focus(options);
  }
}
