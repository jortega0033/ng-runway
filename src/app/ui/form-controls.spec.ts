import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormField, form, required } from '@angular/forms/signals';
import { CheckboxComponent } from './checkbox/checkbox';
import { FieldComponent } from './field/field';
import { InputComponent } from './input/input';
import { RadioGroupComponent } from './radio-group/radio-group';
import { SegmentedComponent } from './segmented/segmented';
import { SelectComponent, type SelectOption } from './select/select';
import { SwitchComponent } from './switch/switch';
import { TextareaComponent } from './textarea/textarea';

const OPTIONS: SelectOption[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
];

@Component({
  imports: [
    FormField,
    FieldComponent,
    InputComponent,
    TextareaComponent,
    SelectComponent,
    CheckboxComponent,
    SwitchComponent,
    RadioGroupComponent,
    SegmentedComponent,
  ],
  template: `
    <ui-field label="Name" hint="As on the contract" [error]="nameError()" required>
      <ui-input [formField]="f.name" />
    </ui-field>
    <ui-field label="Notes"><ui-textarea [formField]="f.notes" /></ui-field>
    <ui-field label="View"><ui-select [formField]="f.view" [options]="options" /></ui-field>
    <ui-checkbox [formField]="f.accepted">Accept terms</ui-checkbox>
    <ui-switch [formField]="f.alerts">Email alerts</ui-switch>
    <ui-radio-group label="Mode" [formField]="f.mode" [options]="options" />
    <ui-segmented label="Range" [formField]="f.range" [options]="options" />
  `,
})
class Host {
  readonly options = OPTIONS;
  readonly model = signal({
    name: '',
    notes: '',
    view: 'day',
    accepted: false,
    alerts: false,
    mode: 'day',
    range: 'day',
  });
  readonly f = form(this.model, (p) => {
    required(p.name, { message: 'Name is required' });
  });
  readonly nameError = () => {
    const state = this.f.name();
    return state.touched() ? (state.errors()[0]?.message ?? '') : '';
  };
}

describe('form controls with Signal Forms', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    return { fixture, root, host: fixture.componentInstance };
  }

  it('labels the input through ui-field and wires the hint', async () => {
    const { root } = await setup();
    const input = root.querySelector<HTMLInputElement>('input[type=text]')!;
    const label = root.querySelector('label')!;
    expect(label.getAttribute('for')).toBe(input.id);
    expect(input.getAttribute('aria-describedby')).toBeTruthy();
    expect(root.querySelector(`#${input.getAttribute('aria-describedby')}`)?.textContent).toContain(
      'As on the contract',
    );
  });

  it('writes typed text into the form model', async () => {
    const { fixture, root, host } = await setup();
    const input = root.querySelector<HTMLInputElement>('input[type=text]')!;
    input.value = 'Lotte';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(host.model().name).toBe('Lotte');
  });

  it('shows the validation error after blur and marks the input invalid', async () => {
    const { fixture, root } = await setup();
    const input = root.querySelector<HTMLInputElement>('input[type=text]')!;
    input.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(root.textContent).toContain('Name is required');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('syncs textarea, select, checkbox, switch, radio and segmented', async () => {
    const { fixture, root, host } = await setup();

    const textarea = root.querySelector('textarea')!;
    textarea.value = 'late shift';
    textarea.dispatchEvent(new Event('input'));

    const select = root.querySelector('select')!;
    select.value = 'week';
    select.dispatchEvent(new Event('change'));

    root.querySelector<HTMLInputElement>('input[type=checkbox]:not([role=switch])')!.click();
    root.querySelector<HTMLInputElement>('input[role=switch]')!.click();

    const radios = root.querySelectorAll<HTMLInputElement>('ui-radio-group input[type=radio]');
    radios[1].click();
    const segments = root.querySelectorAll<HTMLInputElement>('ui-segmented input[type=radio]');
    segments[1].click();
    await fixture.whenStable();

    expect(host.model()).toMatchObject({
      notes: 'late shift',
      view: 'week',
      accepted: true,
      alerts: true,
      mode: 'week',
      range: 'week',
    });
  });

  it('exposes radio groups with an accessible name', async () => {
    const { root } = await setup();
    expect(root.querySelector('ui-radio-group')?.getAttribute('role')).toBe('radiogroup');
    expect(root.querySelector('ui-radio-group')?.getAttribute('aria-label')).toBe('Mode');
  });
});
