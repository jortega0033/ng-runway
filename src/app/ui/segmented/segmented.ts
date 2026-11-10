import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { FIELD_CONTEXT } from '../field/field';
import type { SelectOption } from '../select/select';

let nextGroup = 0;

/** Compact switch between 2-4 views or modes (for example week / day). Radios underneath. */
@Component({
  selector: 'ui-segmented',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'radiogroup',
    class: 'inline-flex rounded-md border border-border bg-background-muted p-0.5',
    '[attr.id]': 'field?.controlId() ?? null',
    '[attr.aria-label]': 'label() || null',
    '[attr.aria-labelledby]': 'field?.labelId ?? null',
    '[attr.aria-describedby]': 'field?.describedBy() ?? null',
    '[attr.aria-invalid]': 'field?.invalid() ? "true" : null',
  },
  template: `
    @for (option of options(); track option.value) {
      <label
        class="relative inline-flex h-8 cursor-pointer items-center rounded-sm px-3 text-base text-foreground-subtle transition-colors hover:text-foreground has-[:checked]:bg-background-surface-page has-[:checked]:text-foreground has-[:checked]:shadow-xs has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-border-brand has-[:disabled]:cursor-not-allowed has-[:disabled]:text-foreground-disabled"
      >
        <input
          type="radio"
          class="sr-only"
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
export class SegmentedComponent implements FormValueControl<string> {
  protected readonly field = inject(FIELD_CONTEXT, { optional: true });
  protected readonly groupName = `ui-segmented-${nextGroup++}`;

  readonly value = model('');
  readonly options = input.required<readonly SelectOption[]>();
  readonly label = input('');
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly touch = output();
}
