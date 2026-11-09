import type { ElementRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  booleanAttribute,
  computed,
  inject,
  input,
  linkedSignal,
  model,
  numberAttribute,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { FIELD_CONTEXT } from '../field/field';
import { IconComponent } from '../icon/icon';
import {
  CONTROL_BASE,
  CONTROL_INVALID,
  CONTROL_OK,
  CONTROL_SIZES,
  type ControlSize,
} from '../input/input';
import { PopoverTriggerDirective } from '../popover/popover';

const TIME = /^(\d{1,2})(?::?(\d{2}))?$/;

let nextId = 0;

/** Turns "9", "930", "9:30" or "09:30" into "09:30". Returns '' when it is not a valid time of day. */
export function normalizeTime(text: string): string {
  const match = TIME.exec(text.trim());
  if (!match) return '';
  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? '0');
  if (hours > 23 || minutes > 59) return '';
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Time field (24-hour `HH:mm`) with a list of times every `step` minutes. Focus stays in the text
 * box (combobox pattern): ArrowDown/ArrowUp move through the list, Enter picks, Escape closes.
 * Any valid time can also be typed. Works with Signal Forms: `<ui-time-picker [formField]="f.start" />`.
 */
@Component({
  selector: 'ui-time-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, PopoverTriggerDirective],
  host: { class: 'block' },
  template: `
    <div
      class="relative"
      [uiPopoverTrigger]="listTemplate"
      uiPopoverMode="manual"
      uiPopoverRole="none"
      [uiPopoverAutofocus]="false"
      [uiPopoverMatchWidth]="true"
      (uiPopoverClosed)="activeIndex.set(-1)"
      #popover="uiPopoverTrigger"
    >
      <input
        #control
        type="text"
        role="combobox"
        autocomplete="off"
        inputmode="numeric"
        aria-haspopup="listbox"
        aria-autocomplete="none"
        [class]="classes()"
        [id]="field?.controlId() ?? null"
        [value]="text()"
        [placeholder]="placeholder()"
        [disabled]="disabled()"
        [readOnly]="readonly()"
        [required]="required() || (field?.required() ?? false)"
        [attr.name]="name() || null"
        [attr.aria-expanded]="popover.isOpen()"
        [attr.aria-controls]="popover.isOpen() ? listId : null"
        [attr.aria-activedescendant]="popover.isOpen() ? activeId() : null"
        [attr.aria-invalid]="isInvalid() ? 'true' : null"
        [attr.aria-describedby]="field?.describedBy() ?? null"
        (input)="text.set(control.value)"
        (keydown)="onKeydown($event, popover)"
        (blur)="commit(); touch.emit()"
      />
      <button
        type="button"
        tabindex="-1"
        class="absolute inset-y-0 right-0 inline-flex w-9 items-center justify-center rounded-r-md text-foreground-subtle hover:text-foreground disabled:cursor-not-allowed disabled:text-foreground-disabled"
        [attr.aria-label]="buttonLabel()"
        [disabled]="disabled() || readonly()"
        (mousedown)="$event.preventDefault()"
        (click)="toggle(popover)"
      >
        <ui-icon name="clock" [size]="20" />
      </button>
    </div>
    <ng-template #listTemplate let-close="close">
      <div
        role="listbox"
        class="max-h-60 overflow-y-auto py-1"
        [id]="listId"
        [attr.aria-label]="listLabel()"
      >
        @for (option of options(); track option; let i = $index) {
          <button
            type="button"
            role="option"
            tabindex="-1"
            class="block w-full px-3 py-1.5 text-left text-base outline-none hover:bg-background-hover"
            [class]="optionClasses(option, i)"
            [id]="optionId(i)"
            [attr.aria-selected]="option === value()"
            (mousedown)="$event.preventDefault()"
            (click)="pick(option, close)"
          >
            {{ option }}
          </button>
        }
      </div>
    </ng-template>
  `,
})
export class TimePickerComponent implements FormValueControl<string> {
  protected readonly field = inject(FIELD_CONTEXT, { optional: true });
  private readonly injector = inject(Injector);
  private readonly control = viewChild.required<ElementRef<HTMLInputElement>>('control');

  /** `HH:mm` (24-hour), or empty. */
  readonly value = model('');
  /** Minutes between listed times. */
  readonly step = input(15, { transform: numberAttribute });
  /** Earliest time, `HH:mm`. */
  readonly min = input<string | undefined>('00:00');
  /** Latest time, `HH:mm`. */
  readonly max = input<string | undefined>('23:59');
  readonly placeholder = input('HH:mm');
  readonly name = input('');
  readonly size = input<ControlSize>('md');
  readonly buttonLabel = input('Choose time');
  readonly listLabel = input('Times');
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly required = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly touch = output();

  protected readonly listId = `ui-time-list-${nextId++}`;
  protected readonly activeIndex = signal(-1);
  protected readonly text = linkedSignal(() => this.value());

  protected readonly options = computed(() => {
    const step = Math.max(1, Math.floor(this.step()));
    const list: string[] = [];
    for (let minutes = 0; minutes < 24 * 60; minutes += step) {
      const time = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
      if (this.inRange(time)) list.push(time);
    }
    return list;
  });

  protected readonly isInvalid = computed(() => this.invalid() || (this.field?.invalid() ?? false));
  protected readonly classes = computed(
    () =>
      `${CONTROL_BASE} ${this.isInvalid() ? CONTROL_INVALID : CONTROL_OK} ${CONTROL_SIZES[this.size()]} pr-10`,
  );
  protected readonly activeId = computed(() =>
    this.activeIndex() >= 0 ? this.optionId(this.activeIndex()) : null,
  );

  focus(options?: FocusOptions): void {
    this.control().nativeElement.focus(options);
  }

  protected optionId(index: number): string {
    return `${this.listId}-${index}`;
  }

  protected optionClasses(option: string, index: number): string {
    if (option === this.value()) {
      return 'bg-background-selected text-foreground-selected font-medium';
    }
    return index === this.activeIndex() ? 'bg-background-hover' : '';
  }

  protected toggle(popover: PopoverTriggerDirective): void {
    if (popover.isOpen()) {
      popover.close();
    } else {
      this.openList(popover);
    }
    this.focus();
  }

  protected pick(time: string, close: () => void): void {
    this.value.set(time);
    close();
  }

  protected onKeydown(event: KeyboardEvent, popover: PopoverTriggerDirective): void {
    if (this.readonly()) return;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        if (!popover.isOpen()) {
          this.openList(popover);
          return;
        }
        const last = this.options().length - 1;
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        const next = this.activeIndex() + delta;
        this.setActive(Math.min(last, Math.max(0, next)));
        return;
      }
      case 'Enter': {
        const option = this.options()[this.activeIndex()];
        if (popover.isOpen() && option) {
          event.preventDefault();
          this.pick(option, () => popover.close());
        } else {
          this.commit();
        }
        return;
      }
      default:
        return;
    }
  }

  /** Turns the typed text into a value, or puts the last good value back. */
  protected commit(): void {
    const typed = this.text().trim();
    if (!typed) {
      this.value.set('');
    } else {
      const time = normalizeTime(typed);
      if (time && this.inRange(time)) this.value.set(time);
    }
    this.text.set(this.value());
    // The binding may not notice a revert to the previous text, so write the box directly.
    this.control().nativeElement.value = this.text();
  }

  private openList(popover: PopoverTriggerDirective): void {
    popover.open(this.control().nativeElement);
    const selected = this.options().indexOf(this.value());
    const start = selected >= 0 ? selected : this.options().findIndex((o) => o >= this.value());
    this.setActive(Math.max(0, start));
  }

  private setActive(index: number): void {
    this.activeIndex.set(index);
    afterNextRender(
      () => {
        const id = this.optionId(index);
        document.getElementById(id)?.scrollIntoView?.({ block: 'nearest' });
      },
      { injector: this.injector },
    );
  }

  private inRange(time: string): boolean {
    return time >= (this.min() ?? '00:00') && time <= (this.max() ?? '23:59');
  }
}
