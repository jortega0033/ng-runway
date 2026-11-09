import type { ElementRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  inject,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';
import type { FormCheckboxControl } from '@angular/forms/signals';
import { FIELD_CONTEXT } from '../field/field';

/** Checkbox with its label: `<ui-checkbox [formField]="f.accepted">Accept terms</ui-checkbox>`. */
@Component({
  selector: 'ui-checkbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  template: `
    <label
      class="inline-flex items-center gap-2 text-base text-foreground has-[:disabled]:cursor-not-allowed has-[:disabled]:text-foreground-disabled"
    >
      <input
        #control
        type="checkbox"
        class="size-4 rounded-xs border border-border accent-background-primary outline-offset-2 focus-visible:outline-2 focus-visible:outline-border-brand disabled:cursor-not-allowed aria-[invalid=true]:border-border-danger"
        [id]="field?.controlId() ?? null"
        [checked]="checked()"
        [indeterminate]="indeterminate()"
        [disabled]="disabled()"
        [attr.aria-invalid]="invalid() ? 'true' : null"
        [attr.aria-describedby]="field?.describedBy() ?? null"
        (change)="checked.set(control.checked)"
        (blur)="touch.emit()"
      />
      <span><ng-content /></span>
    </label>
  `,
})
export class CheckboxComponent implements FormCheckboxControl {
  protected readonly field = inject(FIELD_CONTEXT, { optional: true });
  private readonly control = viewChild.required<ElementRef<HTMLInputElement>>('control');

  readonly checked = model(false);
  readonly indeterminate = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly touch = output();

  focus(options?: FocusOptions): void {
    this.control().nativeElement.focus(options);
  }
}
