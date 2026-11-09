import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CheckboxComponent } from '@ui/checkbox/checkbox';
import { FieldComponent } from '@ui/field/field';
import { InputComponent } from '@ui/input/input';
import { RadioGroupComponent } from '@ui/radio-group/radio-group';
import { SegmentedComponent } from '@ui/segmented/segmented';
import { SelectComponent, type SelectOption } from '@ui/select/select';
import { SwitchComponent } from '@ui/switch/switch';
import { TextareaComponent } from '@ui/textarea/textarea';

@Component({
  selector: 'app-ds-forms',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CheckboxComponent,
    FieldComponent,
    InputComponent,
    RadioGroupComponent,
    SegmentedComponent,
    SelectComponent,
    SwitchComponent,
    TextareaComponent,
  ],
  template: `
    <div class="grid max-w-3xl gap-6 md:grid-cols-2">
      <ui-field label="Name" hint="As on the contract">
        <ui-input [(value)]="name" />
      </ui-field>
      <ui-field label="Email" error="Enter a valid email address" required>
        <ui-input type="email" invalid [(value)]="email" />
      </ui-field>
      <ui-field label="Disabled">
        <ui-input disabled value="Not editable" />
      </ui-field>
      <ui-field label="Team">
        <ui-select [options]="teams" [(value)]="team" placeholder="Choose a team" />
      </ui-field>
      <ui-field label="Note">
        <ui-textarea [(value)]="note" />
      </ui-field>
      <div class="flex flex-col gap-3">
        <ui-checkbox [(checked)]="agree">Send me a weekly summary</ui-checkbox>
        <ui-checkbox indeterminate>Some teams selected</ui-checkbox>
        <ui-switch [(checked)]="notify">Push notifications</ui-switch>
        <ui-radio-group label="Contract" [options]="contracts" [(value)]="contract" />
        <ui-segmented label="View" [options]="views" [(value)]="view" />
      </div>
    </div>
  `,
})
export class FormsSectionComponent {
  protected readonly name = signal('Sara Bakker');
  protected readonly email = signal('sara');
  protected readonly team = signal('');
  protected readonly note = signal('');
  protected readonly agree = signal(true);
  protected readonly notify = signal(false);
  protected readonly contract = signal('permanent');
  protected readonly view = signal('week');

  protected readonly teams: SelectOption[] = [
    { value: 'floor', label: 'Amsterdam Floor' },
    { value: 'kitchen', label: 'Amsterdam Kitchen' },
  ];
  protected readonly contracts: SelectOption[] = [
    { value: 'permanent', label: 'Permanent' },
    { value: 'fixed-term', label: 'Fixed term' },
    { value: 'flex', label: 'Flex' },
  ];
  protected readonly views: SelectOption[] = [
    { value: 'day', label: 'Day' },
    { value: 'week', label: 'Week' },
  ];
}
