import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormField, form } from '@angular/forms/signals';
import { DatePickerComponent } from './date-picker';
import { fromIso, toIso } from './date-utils';

@Component({
  imports: [DatePickerComponent],
  template: `<ui-date-picker
    [value]="date()"
    [min]="min()"
    [max]="max()"
    (valueChange)="date.set($event)"
  />`,
})
class Host {
  readonly date = signal('2026-11-09');
  readonly min = signal<string | undefined>(undefined);
  readonly max = signal<string | undefined>(undefined);
}

@Component({
  imports: [DatePickerComponent, FormField],
  template: `<ui-date-picker [formField]="f.start" />`,
})
class FormHost {
  readonly model = signal({ start: '2026-03-02' });
  readonly f = form(this.model);
}

function key(target: Element | null, name: string, init: KeyboardEventInit = {}): void {
  target?.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, ...init }));
}

describe('date picker', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    document.body.append(fixture.nativeElement);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      host: fixture.componentInstance,
      input: root.querySelector('input')!,
      toggle: root.querySelector<HTMLButtonElement>('button[aria-label="Choose date"]')!,
    };
  }
  const grid = () => document.querySelector<HTMLElement>('[role="grid"]');
  const active = () => document.activeElement as HTMLElement | null;

  it('formats the ISO value in the text box', async () => {
    const { input } = await setup();
    expect(input.value).toBe('2026-11-09');
  });

  it('opens a labelled grid with the selected day focused and today marked', async () => {
    const { fixture, toggle, input } = await setup();
    toggle.click();
    await fixture.whenStable();

    expect(grid()).not.toBeNull();
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(
      document.getElementById(grid()!.getAttribute('aria-labelledby')!)?.textContent,
    ).toContain('November 2026');
    expect(active()?.getAttribute('data-date')).toBe('2026-11-09');
    expect(active()?.getAttribute('aria-label')).toBe('Monday, 9 November 2026');
    expect(document.querySelectorAll('[role="gridcell"][aria-selected="true"]').length).toBe(1);
  });

  it('moves with arrow keys and writes the chosen date as an ISO string on Enter', async () => {
    const { fixture, host, toggle, input } = await setup();
    toggle.click();
    await fixture.whenStable();

    key(active(), 'ArrowRight');
    await fixture.whenStable();
    expect(active()?.getAttribute('data-date')).toBe('2026-11-10');

    key(active(), 'ArrowDown');
    await fixture.whenStable();
    expect(active()?.getAttribute('data-date')).toBe('2026-11-17');

    key(active(), 'Enter');
    await fixture.whenStable();

    expect(host.date()).toBe('2026-11-17');
    expect(input.value).toBe('2026-11-17');
    expect(grid()).toBeNull();
    expect(document.activeElement).toBe(toggle);
  });

  it('PageDown/PageUp change month, Home/End jump to week edges', async () => {
    const { fixture, toggle } = await setup();
    toggle.click();
    await fixture.whenStable();

    key(active(), 'PageDown');
    await fixture.whenStable();
    expect(active()?.getAttribute('data-date')).toBe('2026-12-09');
    expect(document.querySelector('[role="grid"]')!.getAttribute('aria-labelledby')).toBeTruthy();

    key(active(), 'Home');
    await fixture.whenStable();
    expect(active()?.getAttribute('data-date')).toBe('2026-12-07');
    key(active(), 'End');
    await fixture.whenStable();
    expect(active()?.getAttribute('data-date')).toBe('2026-12-13');

    key(active(), 'PageUp');
    await fixture.whenStable();
    expect(active()?.getAttribute('data-date')).toBe('2026-11-13');
  });

  it('closes on Escape without changing the value and returns focus', async () => {
    const { fixture, host, toggle } = await setup();
    toggle.focus();
    toggle.click();
    await fixture.whenStable();
    key(active(), 'ArrowRight');
    key(active(), 'Escape');
    await fixture.whenStable();

    expect(grid()).toBeNull();
    expect(host.date()).toBe('2026-11-09');
    expect(document.activeElement).toBe(toggle);
  });

  it('disables days outside min/max and never moves focus onto them', async () => {
    const { fixture, host, toggle } = await setup();
    host.min.set('2026-11-05');
    host.max.set('2026-11-12');
    await fixture.whenStable();
    toggle.click();
    await fixture.whenStable();

    const day = (iso: string) => document.querySelector<HTMLButtonElement>(`[data-date="${iso}"]`)!;
    expect(day('2026-11-04').disabled).toBe(true);
    expect(day('2026-11-13').disabled).toBe(true);
    expect(day('2026-11-12').disabled).toBe(false);

    key(active(), 'ArrowDown');
    await fixture.whenStable();
    expect(active()?.getAttribute('data-date')).toBe('2026-11-12');
  });

  it('commits a typed date on blur and rejects invalid or out-of-range text', async () => {
    const { fixture, host, input } = await setup();
    host.max.set('2026-12-31');
    await fixture.whenStable();

    input.value = '2026-12-24';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new FocusEvent('blur'));
    await fixture.whenStable();
    expect(host.date()).toBe('2026-12-24');

    input.value = '2027-01-05';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new FocusEvent('blur'));
    await fixture.whenStable();
    expect(host.date()).toBe('2026-12-24');
    expect(input.value).toBe('2026-12-24');

    input.value = 'tomorrow';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new FocusEvent('blur'));
    await fixture.whenStable();
    expect(input.value).toBe('2026-12-24');
  });

  it('opens with ArrowDown from the text box', async () => {
    const { fixture, input } = await setup();
    key(input, 'ArrowDown');
    await fixture.whenStable();
    expect(grid()).not.toBeNull();
  });

  it('binds to a Signal Forms field', async () => {
    const fixture = TestBed.createComponent(FormHost);
    document.body.append(fixture.nativeElement);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('input')!.value).toBe('2026-03-02');

    root.querySelector<HTMLButtonElement>('button[aria-label="Choose date"]')!.click();
    await fixture.whenStable();
    key(document.activeElement, 'ArrowLeft');
    await fixture.whenStable();
    key(document.activeElement, ' ');
    await fixture.whenStable();
    expect(fixture.componentInstance.model().start).toBe('2026-03-01');
  });
});

describe('date utils', () => {
  it('round-trips ISO dates and rejects impossible ones', () => {
    expect(toIso(fromIso('2026-02-28')!)).toBe('2026-02-28');
    expect(fromIso('2026-02-30')).toBeNull();
    expect(fromIso('09/11/2026')).toBeNull();
    expect(fromIso('')).toBeNull();
  });
});
