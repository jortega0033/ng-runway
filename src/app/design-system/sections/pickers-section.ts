import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { DatePickerComponent, FieldComponent, TimePickerComponent } from '@ui/index';

@Component({
  selector: 'app-ds-pickers',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePickerComponent, TimePickerComponent, FieldComponent, FormField],
  template: `
    <section class="space-y-10">
      <div class="space-y-3">
        <h2 class="font-title text-2xl">Date picker</h2>
        <p class="text-base text-foreground-subtle">
          Type a date or open the calendar. Arrow keys move by day and week, PageUp and PageDown by
          month, Home and End to the week edges, Enter selects, Escape closes.
        </p>
        <div class="grid max-w-3xl gap-4 sm:grid-cols-2">
          <ui-field label="Start date" hint="Format yyyy-MM-dd" required>
            <ui-date-picker [formField]="f.start" />
          </ui-field>
          <ui-field label="Empty">
            <ui-date-picker />
          </ui-field>
          <ui-field label="Limited range" hint="Only 1 to 20 November 2026">
            <ui-date-picker value="2026-11-09" min="2026-11-01" max="2026-11-20" />
          </ui-field>
          <ui-field label="Week starts on Sunday">
            <ui-date-picker value="2026-11-09" [weekStartsOn]="0" />
          </ui-field>
          <ui-field label="Disabled">
            <ui-date-picker value="2026-11-09" disabled />
          </ui-field>
          <ui-field label="Read only">
            <ui-date-picker value="2026-11-09" readonly />
          </ui-field>
          <ui-field label="End date" error="End date is required">
            <ui-date-picker invalid />
          </ui-field>
          <ui-field label="Small">
            <ui-date-picker size="sm" value="2026-11-09" />
          </ui-field>
        </div>
        <p class="text-base text-foreground-subtle">Form value: {{ model().start || 'empty' }}</p>
      </div>

      <div class="space-y-3">
        <h2 class="font-title text-2xl">Time picker</h2>
        <p class="text-base text-foreground-subtle">
          Type a time (930 becomes 09:30) or use ArrowDown, ArrowUp and Enter in the list.
        </p>
        <div class="grid max-w-3xl gap-4 sm:grid-cols-2">
          <ui-field label="Shift start (15 min)" required>
            <ui-time-picker [formField]="f.shiftStart" />
          </ui-field>
          <ui-field label="Break (30 min)">
            <ui-time-picker value="12:30" [step]="30" />
          </ui-field>
          <ui-field label="Day shift only" hint="06:00 to 18:00">
            <ui-time-picker value="08:00" min="06:00" max="18:00" [step]="30" />
          </ui-field>
          <ui-field label="Empty">
            <ui-time-picker />
          </ui-field>
          <ui-field label="Disabled">
            <ui-time-picker value="08:00" disabled />
          </ui-field>
          <ui-field label="Shift end" error="Shift end is required">
            <ui-time-picker invalid />
          </ui-field>
        </div>
        <p class="text-base text-foreground-subtle">
          Form value: {{ model().shiftStart || 'empty' }}
        </p>
      </div>
    </section>
  `,
})
export class PickersSectionComponent {
  protected readonly model = signal({ start: '2026-11-09', shiftStart: '06:00' });
  protected readonly f = form(this.model);
}
