import {
  ChangeDetectionStrategy,
  Component,
  InjectionToken,
  type Signal,
  booleanAttribute,
  computed,
  input,
} from '@angular/core';

/** What a control needs from its surrounding `ui-field` to be labelled and described. */
export interface FieldContext {
  readonly controlId: Signal<string>;
  /** Id of the visible label, for grouped controls that use aria-labelledby. */
  readonly labelId: string;
  readonly describedBy: Signal<string | null>;
  readonly invalid: Signal<boolean>;
  readonly required: Signal<boolean>;
}

export const FIELD_CONTEXT = new InjectionToken<FieldContext>('FIELD_CONTEXT');

let nextId = 0;

/**
 * Label, hint and error message around one control. The control (ui-input, ui-select, ...)
 * picks up its id and aria-describedby from this component through FIELD_CONTEXT.
 */
@Component({
  selector: 'ui-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: FIELD_CONTEXT, useExisting: FieldComponent }],
  host: { class: 'flex flex-col gap-1.5' },
  template: `
    <label [id]="labelId" [attr.for]="controlId()" class="text-base font-medium text-foreground">
      {{ label() }}
      @if (required()) {
        <span aria-hidden="true" class="text-foreground-danger">*</span>
      }
    </label>
    <ng-content />
    @if (hint() && !error()) {
      <p [id]="hintId" class="text-sm text-foreground-subtle">{{ hint() }}</p>
    }
    <!-- Always rendered so screen readers register the live region before an error appears. -->
    <div aria-live="polite" [class.-mt-1.5]="!error()">
      @if (error()) {
        <p [id]="errorId" class="text-sm text-foreground-danger">{{ error() }}</p>
      }
    </div>
  `,
})
export class FieldComponent implements FieldContext {
  readonly label = input.required<string>();
  readonly hint = input('');
  /** Message to show. An empty or null value means the field is valid. */
  readonly error = input<string | null>('');
  readonly required = input(false, { transform: booleanAttribute });
  /** Override when the control id is not generated (for example a radio group). */
  readonly forId = input<string | null>(null);

  private readonly uid = `ui-field-${nextId++}`;
  readonly labelId = `${this.uid}-label`;
  protected readonly hintId = `${this.uid}-hint`;
  protected readonly errorId = `${this.uid}-error`;

  readonly controlId = computed(() => this.forId() ?? `${this.uid}-control`);
  readonly invalid = computed(() => !!this.error());
  readonly describedBy = computed(() =>
    this.error() ? this.errorId : this.hint() ? this.hintId : null,
  );
}
