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
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { format, isValid, parse } from 'date-fns';
import { FIELD_CONTEXT } from '../field/field';
import {
  CONTROL_BASE,
  CONTROL_INVALID,
  CONTROL_OK,
  CONTROL_SIZES,
  type ControlSize,
} from '../input/input';
import { IconComponent } from '../icon/icon';
import { PopoverTriggerDirective } from '../popover/popover';
import { CalendarComponent } from './calendar';
import { fromIso, toIso } from './date-utils';

/**
 * Date field with a calendar popover. The value is always an ISO date (`yyyy-MM-dd`) or an empty
 * string; the text box shows `displayFormat` and accepts typed dates (committed on Enter or blur).
 * Works with Signal Forms: `<ui-date-picker [formField]="f.startDate" />`.
 */
@Component({
  selector: 'ui-date-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, PopoverTriggerDirective, CalendarComponent],
  host: { class: 'block' },
  template: `
    <div
      class="relative"
      [uiPopoverTrigger]="calendarTemplate"
      uiPopoverMode="manual"
      uiPopoverRole="dialog"
      [uiPopoverLabel]="calendarLabel()"
      [uiPopoverAutofocus]="false"
      #popover="uiPopoverTrigger"
    >
      <input
        #control
        type="text"
        role="combobox"
        autocomplete="off"
        aria-haspopup="dialog"
        [class]="classes()"
        [id]="field?.controlId() ?? null"
        [value]="text()"
        [placeholder]="placeholder() || displayFormat()"
        [disabled]="disabled()"
        [readOnly]="readonly()"
        [required]="required() || (field?.required() ?? false)"
        [attr.name]="name() || null"
        [attr.aria-expanded]="popover.isOpen()"
        [attr.aria-controls]="popover.isOpen() ? popover.panelId : null"
        [attr.aria-invalid]="isInvalid() ? 'true' : null"
        [attr.aria-describedby]="field?.describedBy() ?? null"
        (input)="text.set(control.value)"
        (keydown)="onKeydown($event, popover, control)"
        (blur)="commit(); touch.emit()"
      />
      <button
        #toggleButton
        type="button"
        class="absolute inset-y-0 right-0 inline-flex w-9 items-center justify-center rounded-r-md text-foreground-subtle outline-offset-0 hover:text-foreground focus-visible:outline-2 focus-visible:outline-border-brand disabled:cursor-not-allowed disabled:text-foreground-disabled"
        [attr.aria-label]="buttonLabel()"
        [disabled]="disabled() || readonly()"
        (click)="popover.toggle(toggleButton)"
      >
        <ui-icon name="calendar" [size]="20" />
      </button>
    </div>
    <ng-template #calendarTemplate let-close="close">
      <ui-calendar
        autofocus
        [value]="value()"
        [min]="min() ?? ''"
        [max]="max() ?? ''"
        [weekStartsOn]="weekStartsOn()"
        (selected)="pick($event, close)"
      />
    </ng-template>
  `,
})
export class DatePickerComponent implements FormValueControl<string> {
  protected readonly field = inject(FIELD_CONTEXT, { optional: true });
  private readonly control = viewChild.required<ElementRef<HTMLInputElement>>('control');

  /** ISO date `yyyy-MM-dd`, or empty. */
  readonly value = model('');
  /** Earliest selectable date, `yyyy-MM-dd`. */
  readonly min = input<string | undefined>(undefined);
  /** Latest selectable date, `yyyy-MM-dd`. */
  readonly max = input<string | undefined>(undefined);
  readonly displayFormat = input('yyyy-MM-dd');
  readonly placeholder = input('');
  readonly name = input('');
  readonly size = input<ControlSize>('md');
  /** 0 = Sunday, 1 = Monday. */
  readonly weekStartsOn = input<0 | 1 | 2 | 3 | 4 | 5 | 6>(1);
  readonly buttonLabel = input('Choose date');
  readonly calendarLabel = input('Calendar');
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly required = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly touch = output();

  protected readonly text = linkedSignal(() => this.display(this.value()));
  protected readonly isInvalid = computed(() => this.invalid() || (this.field?.invalid() ?? false));
  protected readonly classes = computed(
    () =>
      `${CONTROL_BASE} ${this.isInvalid() ? CONTROL_INVALID : CONTROL_OK} ${CONTROL_SIZES[this.size()]} pr-10`,
  );

  focus(options?: FocusOptions): void {
    this.control().nativeElement.focus(options);
  }

  protected pick(iso: string, close: () => void): void {
    this.value.set(iso);
    close();
  }

  protected onKeydown(
    event: KeyboardEvent,
    popover: PopoverTriggerDirective,
    control: HTMLInputElement,
  ): void {
    if (event.key === 'ArrowDown' && !popover.isOpen() && !this.readonly()) {
      event.preventDefault();
      popover.open(control);
    } else if (event.key === 'Enter') {
      this.commit();
    }
  }

  /** Turns the typed text into a value, or puts the last good value back. */
  protected commit(): void {
    const typed = this.text().trim();
    if (!typed) {
      this.value.set('');
      return;
    }
    const parsed = parse(typed, this.displayFormat(), new Date(0));
    const iso = isValid(parsed) ? toIso(parsed) : '';
    if (iso && this.inRange(iso)) {
      this.value.set(iso);
    }
    this.text.set(this.display(this.value()));
    // The binding may not notice a revert to the previous text, so write the box directly.
    this.control().nativeElement.value = this.text();
  }

  private inRange(iso: string): boolean {
    const min = this.min() ?? '';
    const max = this.max() ?? '';
    return (!fromIso(min) || iso >= min) && (!fromIso(max) || iso <= max);
  }

  private display(iso: string): string {
    const date = fromIso(iso);
    return date ? format(date, this.displayFormat()) : '';
  }
}
