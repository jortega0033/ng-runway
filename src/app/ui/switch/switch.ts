import type { ElementRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';
import type { FormCheckboxControl } from '@angular/forms/signals';

/** On/off setting that applies immediately. Uses a native checkbox with role switch. */
@Component({
  selector: 'ui-switch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  template: `
    <label
      class="inline-flex items-center gap-3 text-base text-foreground has-[:disabled]:cursor-not-allowed has-[:disabled]:text-foreground-disabled"
    >
      <input
        #control
        type="checkbox"
        role="switch"
        class="peer sr-only"
        [checked]="checked()"
        [disabled]="disabled()"
        (change)="checked.set(control.checked)"
        (blur)="touch.emit()"
      />
      <span
        aria-hidden="true"
        class="relative h-5 w-9 shrink-0 rounded-full bg-background-neutral-subtle transition-colors outline-offset-2 peer-checked:bg-background-primary peer-focus-visible:outline-2 peer-focus-visible:outline-border-brand peer-disabled:bg-background-alt after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-background-surface-page after:transition-transform peer-checked:after:translate-x-4 motion-reduce:transition-none motion-reduce:after:transition-none"
      ></span>
      <span><ng-content /></span>
    </label>
  `,
})
export class SwitchComponent implements FormCheckboxControl {
  private readonly control = viewChild.required<ElementRef<HTMLInputElement>>('control');

  readonly checked = model(false);
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly touch = output();

  focus(options?: FocusOptions): void {
    this.control().nativeElement.focus(options);
  }
}
