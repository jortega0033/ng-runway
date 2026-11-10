import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ButtonComponent } from './button';
import { IconButtonComponent } from './icon-button';

@Component({
  imports: [ButtonComponent, IconButtonComponent],
  template: `
    <button
      ui-button
      [variant]="variant()"
      [loading]="loading()"
      [disabled]="disabled()"
      (click)="clicks.set(clicks() + 1)"
    >
      Save
    </button>
    <button ui-icon-button icon="trash" label="Delete shift"></button>
  `,
})
class Host {
  readonly variant = signal<'primary' | 'danger'>('primary');
  readonly loading = signal(false);
  readonly disabled = signal(false);
  readonly clicks = signal(0);
}

describe('ButtonComponent', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const button = () => root.querySelector<HTMLButtonElement>('button[ui-button]')!;
    return { fixture, root, button };
  }

  it('renders the label as an accessible button', async () => {
    const { root } = await setup();
    expect(root.querySelector('button[ui-button]')?.textContent?.trim()).toBe('Save');
  });

  it('applies the variant classes', async () => {
    const { fixture, button } = await setup();
    expect(button().className).toContain('bg-background-primary');
    fixture.componentInstance.variant.set('danger');
    await fixture.whenStable();
    expect(button().className).toContain('bg-background-danger');
  });

  it('is aria-disabled and busy while loading, keeps focus and swallows clicks', async () => {
    const { fixture, button } = await setup();
    button().focus();
    fixture.componentInstance.loading.set(true);
    await fixture.whenStable();
    expect(button().disabled).toBe(false);
    expect(button().getAttribute('aria-disabled')).toBe('true');
    expect(button().getAttribute('aria-busy')).toBe('true');
    expect(button().querySelector('ui-spinner')).not.toBeNull();
    expect(document.activeElement).toBe(button());
    button().click();
    expect(fixture.componentInstance.clicks()).toBe(0);
  });

  it('keeps the real disabled attribute for [disabled]', async () => {
    const { fixture, button } = await setup();
    fixture.componentInstance.disabled.set(true);
    await fixture.whenStable();
    expect(button().disabled).toBe(true);
    expect(button().getAttribute('aria-disabled')).toBeNull();
  });

  it('does not fire click when disabled', async () => {
    const { fixture, button } = await setup();
    fixture.componentInstance.disabled.set(true);
    await fixture.whenStable();
    button().click();
    expect(fixture.componentInstance.clicks()).toBe(0);
  });

  it('icon button exposes its label as the accessible name', async () => {
    const { root } = await setup();
    expect(root.querySelector('[aria-label="Delete shift"]')).not.toBeNull();
  });
});
