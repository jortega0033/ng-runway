import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TimePickerComponent, normalizeTime } from './time-picker';

@Component({
  imports: [TimePickerComponent],
  template: `<ui-time-picker
    [value]="time()"
    [step]="step()"
    [min]="min()"
    [max]="max()"
    (valueChange)="time.set($event)"
  />`,
})
class Host {
  readonly time = signal('08:00');
  readonly step = signal(15);
  readonly min = signal('00:00');
  readonly max = signal('23:59');
}

function key(target: Element | null, name: string): void {
  target?.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
}

describe('time picker', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    document.body.append(fixture.nativeElement);
    await fixture.whenStable();
    const input = (fixture.nativeElement as HTMLElement).querySelector('input')!;
    return { fixture, host: fixture.componentInstance, input };
  }
  const options = () =>
    [...document.querySelectorAll('[role="option"]')].map((o) => o.textContent?.trim());

  it('lists times every step minutes inside min/max', async () => {
    const { fixture, host, input } = await setup();
    host.step.set(30);
    host.min.set('08:00');
    host.max.set('09:30');
    await fixture.whenStable();
    key(input, 'ArrowDown');
    await fixture.whenStable();
    expect(options()).toEqual(['08:00', '08:30', '09:00', '09:30']);
  });

  it('offers 96 options at the default 15 minute step', async () => {
    const { fixture, input } = await setup();
    key(input, 'ArrowDown');
    await fixture.whenStable();
    expect(options().length).toBe(96);
  });

  it('is a combobox that opens on ArrowDown with the current time active', async () => {
    const { fixture, input } = await setup();
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-expanded')).toBe('false');

    key(input, 'ArrowDown');
    await fixture.whenStable();

    expect(input.getAttribute('aria-expanded')).toBe('true');
    const active = document.getElementById(input.getAttribute('aria-activedescendant')!);
    expect(active?.textContent?.trim()).toBe('08:00');
    expect(active?.getAttribute('aria-selected')).toBe('true');
  });

  it('moves with arrows and picks with Enter, writing HH:mm', async () => {
    const { fixture, host, input } = await setup();
    key(input, 'ArrowDown');
    await fixture.whenStable();
    key(input, 'ArrowDown');
    await fixture.whenStable();
    key(input, 'Enter');
    await fixture.whenStable();

    expect(host.time()).toBe('08:15');
    expect(input.value).toBe('08:15');
    expect(document.querySelector('[role="listbox"]')).toBeNull();
  });

  it('picks an option with the mouse', async () => {
    const { fixture, host, input } = await setup();
    key(input, 'ArrowDown');
    await fixture.whenStable();
    const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
      (o) => o.textContent?.trim() === '17:30',
    )!;
    option.click();
    await fixture.whenStable();
    expect(host.time()).toBe('17:30');
  });

  it('closes on Escape and keeps the value', async () => {
    const { fixture, host, input } = await setup();
    key(input, 'ArrowDown');
    await fixture.whenStable();
    key(input, 'ArrowDown');
    key(input, 'Escape');
    await fixture.whenStable();

    expect(document.querySelector('[role="listbox"]')).toBeNull();
    expect(host.time()).toBe('08:00');
  });

  it('normalizes typed times on blur and restores the last value for bad input', async () => {
    const { fixture, host, input } = await setup();
    input.value = '1730';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new FocusEvent('blur'));
    await fixture.whenStable();
    expect(host.time()).toBe('17:30');
    expect(input.value).toBe('17:30');

    input.value = '25:00';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new FocusEvent('blur'));
    await fixture.whenStable();
    expect(host.time()).toBe('17:30');
    expect(input.value).toBe('17:30');
  });

  it('normalizeTime accepts short forms only for real times', () => {
    expect(normalizeTime('9')).toBe('09:00');
    expect(normalizeTime('930')).toBe('09:30');
    expect(normalizeTime('9:05')).toBe('09:05');
    expect(normalizeTime('24:00')).toBe('');
    expect(normalizeTime('12:60')).toBe('');
    expect(normalizeTime('noon')).toBe('');
  });
});
