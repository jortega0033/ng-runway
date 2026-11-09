import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  input,
  model,
  output,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import type { SelectOption } from '../select/select';

let nextGroup = 0;

/** One choice from a few visible options. Native radios share a name, so arrow keys work. */
@Component({
  selector: 'ui-radio-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'radiogroup',
    class: 'flex gap-4 data-[orientation=vertical]:flex-col',
    '[attr.data-orientation]': 'orientation()',
    '[attr.aria-label]': 'label() || null',
  },
  template: `
    @for (option of options(); track option.value) {
      <label
        class="inline-flex items-center gap-2 text-base text-foreground has-[:disabled]:cursor-not-allowed has-[:disabled]:text-foreground-disabled"
      >
        <input
          type="radio"
          class="size-4 accent-background-primary outline-offset-2 focus-visible:outline-2 focus-visible:outline-border-brand disabled:cursor-not-allowed"
          [name]="groupName"
          [value]="option.value"
          [checked]="option.value === value()"
          [disabled]="disabled() || (option.disabled ?? false)"
          (change)="value.set(option.value)"
          (blur)="touch.emit()"
        />
        {{ option.label }}
      </label>
    }
  `,
})
export class RadioGroupComponent implements FormValueControl<string> {
  protected readonly groupName = `ui-radio-${nextGroup++}`;

  readonly value = model('');
  readonly options = input.required<readonly SelectOption[]>();
  readonly orientation = input<'horizontal' | 'vertical'>('vertical');
  /** Accessible name when no ui-field label is used. */
  readonly label = input('');
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly touch = output();
}
