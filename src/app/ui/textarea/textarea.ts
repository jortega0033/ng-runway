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
import { CONTROL_BASE, CONTROL_INVALID, CONTROL_OK } from '../input/input';

@Component({
  selector: 'ui-textarea',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <textarea
      #control
      [class]="classes()"
      [id]="field?.controlId() ?? null"
      [value]="value()"
      [rows]="rows()"
      [placeholder]="placeholder()"
      [disabled]="disabled()"
      [readOnly]="readonly()"
      [required]="required() || (field?.required() ?? false)"
      [attr.aria-invalid]="isInvalid() ? 'true' : null"
      [attr.aria-describedby]="field?.describedBy() ?? null"
      (input)="value.set(control.value)"
      (blur)="touch.emit()"
    ></textarea>
  `,
})
export class TextareaComponent implements FormValueControl<string> {
  protected readonly field = inject(FIELD_CONTEXT, { optional: true });
  private readonly control = viewChild.required<ElementRef<HTMLTextAreaElement>>('control');

  readonly value = model('');
  readonly rows = input(4);
  readonly placeholder = input('');
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly required = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly touch = output();

  protected readonly isInvalid = computed(() => this.invalid() || (this.field?.invalid() ?? false));
  protected readonly classes = computed(
    () => `${CONTROL_BASE} ${this.isInvalid() ? CONTROL_INVALID : CONTROL_OK} px-3 py-2 text-base`,
  );

  focus(options?: FocusOptions): void {
    this.control().nativeElement.focus(options);
  }
}
