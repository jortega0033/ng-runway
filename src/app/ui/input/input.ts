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

export type InputType = 'text' | 'email' | 'number' | 'password' | 'search' | 'tel' | 'url';
export type ControlSize = 'sm' | 'md' | 'lg';

/** Shared look for text-like controls so input, select and textarea stay identical. */
export const CONTROL_BASE =
  'block w-full rounded-md border bg-background-surface-page text-foreground ' +
  'placeholder:text-foreground-placeholder outline-offset-0 transition-colors ' +
  'focus-visible:outline-2 focus-visible:outline-border-brand ' +
  'read-only:bg-background-muted disabled:cursor-not-allowed disabled:bg-background-alt ' +
  'disabled:text-foreground-disabled';
export const CONTROL_OK = 'border-border hover:border-border-overlay-strong';
export const CONTROL_INVALID = 'border-border-danger bg-background-field-invalid';
export const CONTROL_SIZES: Record<ControlSize, string> = {
  sm: 'h-8 px-2.5 text-sm',
  md: 'h-9 px-3 text-base',
  lg: 'h-10 px-3.5 text-lg',
};

/** Text input that works with Signal Forms: `<ui-input [formField]="f.name" />`. */
@Component({
  selector: 'ui-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <input
      #control
      [class]="classes()"
      [id]="field?.controlId() ?? null"
      [type]="type()"
      [value]="value()"
      [placeholder]="placeholder()"
      [disabled]="disabled()"
      [readOnly]="readonly()"
      [required]="required() || (field?.required() ?? false)"
      [attr.name]="name() || null"
      [attr.autocomplete]="autocomplete() || null"
      [attr.aria-invalid]="isInvalid() ? 'true' : null"
      [attr.aria-describedby]="field?.describedBy() ?? null"
      (input)="value.set(control.value)"
      (blur)="touch.emit()"
    />
  `,
})
export class InputComponent implements FormValueControl<string> {
  protected readonly field = inject(FIELD_CONTEXT, { optional: true });
  private readonly control = viewChild.required<ElementRef<HTMLInputElement>>('control');

  readonly value = model('');
  readonly type = input<InputType>('text');
  readonly size = input<ControlSize>('md');
  readonly placeholder = input('');
  readonly name = input('');
  readonly autocomplete = input('');
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });
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
