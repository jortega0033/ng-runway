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

@Component({
  imports: [FieldComponent, RadioGroupComponent, SegmentedComponent],
  template: `
    <ui-field label="Mode" hint="Pick one" [error]="error()">
      <ui-radio-group [options]="options" />
    </ui-field>
    <ui-field label="Range"><ui-segmented [options]="options" /></ui-field>
  `,
})
class GroupHost {
  readonly options = OPTIONS;
  readonly error = signal('');
}

describe('grouped controls inside ui-field', () => {
  it('label the group, describe it and flag it invalid', async () => {
    const fixture = TestBed.createComponent(GroupHost);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const groups = root.querySelectorAll<HTMLElement>('[role="radiogroup"]');
    const label = root.querySelector('ui-field > label')!;

    expect(groups[0].getAttribute('aria-labelledby')).toBe(label.id);
    expect(groups[0].id).toBe(label.getAttribute('for'));
    expect(groups[1].getAttribute('aria-labelledby')).toBe(
      root.querySelectorAll('ui-field > label')[1]?.id,
    );
    expect(groups[0].getAttribute('aria-invalid')).toBeNull();

    fixture.componentInstance.error.set('Choose a mode');
    await fixture.whenStable();
    expect(groups[0].getAttribute('aria-invalid')).toBe('true');
    expect(root.querySelector(`#${groups[0].getAttribute('aria-describedby')}`)?.textContent).toBe(
      'Choose a mode',
    );
  });

  it('renders the error inside a live region that exists before the error does', async () => {
    const fixture = TestBed.createComponent(GroupHost);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const live = root.querySelector('ui-field [aria-live="polite"]');
    expect(live).not.toBeNull();
    expect(live?.textContent?.trim()).toBe('');
    fixture.componentInstance.error.set('Choose a mode');
    await fixture.whenStable();
    expect(root.querySelector('ui-field [aria-live="polite"]')).toBe(live);
    expect(live?.textContent?.trim()).toBe('Choose a mode');
  });
});

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
    const label = root.querySelector('ui-field > label')!;
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
