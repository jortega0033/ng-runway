import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormField, form, required } from '@angular/forms/signals';
import { FieldComponent } from '../field/field';
import { ComboboxComponent } from './combobox';
import { MultiselectComponent } from './multiselect';
import type { ComboOption } from './option-list';

const TEAMS: ComboOption[] = [
  { value: 'ops', label: 'Operations' },
  { value: 'fin', label: 'Finance' },
  { value: 'hr', label: 'People and Culture', disabled: true },
  { value: 'eng', label: 'Engineering' },
];

@Component({
  imports: [FormField, FieldComponent, ComboboxComponent, MultiselectComponent],
  template: `
    <ui-field label="Team" [error]="error()">
      <ui-combobox
        [formField]="f.team"
        [options]="options()"
        [loading]="loading()"
        (query)="queries.push($event)"
      />
    </ui-field>
    <ui-field label="Skills">
      <ui-multiselect [formField]="f.skills" [options]="options()" />
    </ui-field>
  `,
})
class Host {
  readonly options = signal(TEAMS);
  readonly loading = signal(false);
  readonly queries: string[] = [];
  readonly model = signal({ team: '', skills: ['ops'] as string[] });
  readonly f = form(this.model, (p) => {
    required(p.team, { message: 'Team is required' });
  });
  readonly error = () =>
    this.f.team().touched() ? (this.f.team().errors()[0]?.message ?? '') : '';
}

/** Headless Chromium does not always fire focus events for programmatic focus. */
function focusIn(el: HTMLElement): void {
  el.focus();
  el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
}

function key(el: HTMLElement, k: string): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
}

function type(el: HTMLInputElement, text: string): void {
  el.value = text;
  el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
}

describe('ui-combobox', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
    const root = fixture.nativeElement as HTMLElement;
    const input = root.querySelectorAll<HTMLInputElement>('input[role=combobox]')[0];
    const options = () =>
      Array.from(document.body.querySelectorAll<HTMLElement>('[role=listbox] [role=option]'));
    const settle = async () => {
      for (let i = 0; i < 3; i++) {
        fixture.detectChanges();
        await fixture.whenStable();
      }
    };
    return { fixture, root, host: fixture.componentInstance, input, options, settle };
  }

  it('is labelled by ui-field and exposes combobox semantics', async () => {
    const { root, input } = await setup();
    expect(root.querySelector('label')?.getAttribute('for')).toBe(input.id);
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.getAttribute('aria-haspopup')).toBe('listbox');
  });

  it('opens on ArrowDown and lists all options', async () => {
    const { input, options, settle } = await setup();
    focusIn(input);
    key(input, 'ArrowDown');
    await settle();
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(options().map((o) => o.textContent?.trim())).toEqual([
      'Operations',
      'Finance',
      'People and Culture',
      'Engineering',
    ]);
  });

  it('filters by typed text, emits the raw query and shows the empty state', async () => {
    const { host, input, options, settle } = await setup();
    focusIn(input);
    type(input, 'fin');
    await settle();
    expect(options().map((o) => o.textContent?.trim())).toEqual(['Finance']);
    expect(host.queries).toEqual(['fin']);

    type(input, 'zzz');
    await settle();
    expect(options()).toHaveLength(0);
    expect(document.body.textContent).toContain('No results');
  });

  it('selects with the keyboard: arrows then Enter, and closes', async () => {
    const { host, input, settle } = await setup();
    focusIn(input);
    key(input, 'ArrowDown');
    await settle();
    key(input, 'ArrowDown');
    await settle();
    key(input, 'Enter');
    await settle();
    expect(host.model().team).toBe('fin');
    expect(input.value).toBe('Finance');
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  it('jumps to the last option with End and to the first with Home', async () => {
    const { host, input, settle } = await setup();
    focusIn(input);
    key(input, 'ArrowDown');
    await settle();
    key(input, 'End');
    await settle();
    key(input, 'Enter');
    await settle();
    expect(host.model().team).toBe('eng');

    key(input, 'ArrowDown');
    await settle();
    key(input, 'Home');
    await settle();
    await settle();
    key(input, 'Enter');
    await settle();
    expect(host.model().team).toBe('ops');
  });

  it('closes on Escape and restores the selected label', async () => {
    const { host, input, settle } = await setup();
    host.model.update((m) => ({ ...m, team: 'ops' }));
    await settle();
    expect(input.value).toBe('Operations');
    focusIn(input);
    type(input, 'xx');
    await settle();
    key(input, 'Escape');
    await settle();
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.value).toBe('Operations');
    expect(host.model().team).toBe('ops');
  });

  it('selects an option by click', async () => {
    const { host, input, options, settle } = await setup();
    focusIn(input);
    key(input, 'ArrowDown');
    await settle();
    options()[3].click();
    await settle();
    expect(host.model().team).toBe('eng');
    expect(input.value).toBe('Engineering');
  });

  it('does not select disabled options', async () => {
    const { host, input, options, settle } = await setup();
    focusIn(input);
    key(input, 'ArrowDown');
    await settle();
    const hr = options()[2];
    expect(hr.getAttribute('aria-disabled')).toBe('true');
    hr.click();
    await settle();
    expect(host.model().team).toBe('');
  });

  it('shows the loading row', async () => {
    const { host, input, settle } = await setup();
    host.loading.set(true);
    focusIn(input);
    key(input, 'ArrowDown');
    await settle();
    expect(document.body.querySelector('ui-option-list ui-spinner')).not.toBeNull();
  });

  it('clears the selection with the clear button', async () => {
    const { host, root, input, settle } = await setup();
    host.model.update((m) => ({ ...m, team: 'fin' }));
    await settle();
    const clear = root.querySelector<HTMLButtonElement>('ui-combobox button[aria-label=Clear]');
    clear?.click();
    await settle();
    expect(host.model().team).toBe('');
    expect(input.value).toBe('');
    expect(host.queries.at(-1)).toBe('');
  });

  it('marks the control invalid when the field has an error', async () => {
    const { host, input, settle } = await setup();
    host.f.team().markAsTouched();
    await settle();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBeTruthy();
  });
});

describe('ui-multiselect', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
    const root = fixture.nativeElement as HTMLElement;
    const input = root.querySelectorAll<HTMLInputElement>('input[role=combobox]')[1];
    const chips = () =>
      Array.from(root.querySelectorAll('ui-multiselect ui-tag')).map((t) => t.textContent?.trim());
    const options = () =>
      Array.from(document.body.querySelectorAll<HTMLElement>('[role=listbox] [role=option]'));
    const settle = async () => {
      for (let i = 0; i < 3; i++) {
        fixture.detectChanges();
        await fixture.whenStable();
      }
    };
    return { fixture, root, host: fixture.componentInstance, input, chips, options, settle };
  }

  it('renders selected values as chips', async () => {
    const { chips } = await setup();
    expect(chips()).toEqual(['Operations']);
  });

  it('adds a value by click and keeps the list open', async () => {
    const { host, input, options, settle } = await setup();
    focusIn(input);
    key(input, 'ArrowDown');
    await settle();
    options()[1].click();
    await settle();
    expect(host.model().skills).toEqual(['ops', 'fin']);
  });

  it('adds with the keyboard: arrows then Enter', async () => {
    const { host, input, settle } = await setup();
    focusIn(input);
    key(input, 'ArrowDown');
    await settle();
    key(input, 'ArrowDown');
    await settle();
    key(input, 'Enter');
    await settle();
    expect(host.model().skills).toEqual(['ops', 'fin']);
  });

  it('keeps selected values that are filtered out of the list', async () => {
    const { host, input, options, settle } = await setup();
    focusIn(input);
    type(input, 'eng');
    await settle();
    expect(options().map((o) => o.textContent?.trim())).toEqual(['Engineering']);
    options()[0].click();
    await settle();
    expect(host.model().skills).toEqual(['ops', 'eng']);
  });

  it('removes a chip with its button', async () => {
    const { host, root, settle } = await setup();
    root.querySelector<HTMLButtonElement>('ui-multiselect ui-tag button')?.click();
    await settle();
    expect(host.model().skills).toEqual([]);
  });

  it('removes the last chip with Backspace in the empty input', async () => {
    const { host, input, settle } = await setup();
    host.model.update((m) => ({ ...m, skills: ['ops', 'fin'] }));
    await settle();
    focusIn(input);
    key(input, 'Backspace');
    await settle();
    expect(host.model().skills).toEqual(['ops']);
  });

  it('does not remove a chip with Backspace while text is typed', async () => {
    const { host, input, settle } = await setup();
    focusIn(input);
    type(input, 'e');
    await settle();
    key(input, 'Backspace');
    await settle();
    expect(host.model().skills).toEqual(['ops']);
  });
});
