import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TooltipDirective } from './tooltip';

@Component({
  imports: [TooltipDirective],
  template: `<button type="button" uiTooltip="Copy shift link" [uiTooltipDelay]="300">
    Copy
  </button>`,
})
class Host {}

describe('tooltip', () => {
  afterEach(() => vi.useRealTimers());

  function setup() {
    const fixture = TestBed.createComponent(Host);
    document.body.append(fixture.nativeElement);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    return { fixture, button };
  }
  const bubble = () => document.querySelector<HTMLElement>('[role="tooltip"]');

  it('shows immediately on keyboard focus and describes the host', () => {
    const { fixture, button } = setup();
    button.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    fixture.detectChanges();

    expect(bubble()?.textContent).toContain('Copy shift link');
    expect(button.getAttribute('aria-describedby')).toBe(bubble()?.id);
  });

  it('hides on blur and removes the description', () => {
    const { fixture, button } = setup();
    button.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    button.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    fixture.detectChanges();

    expect(bubble()).toBeNull();
    expect(button.hasAttribute('aria-describedby')).toBe(false);
  });

  it('shows on hover only after the delay', () => {
    vi.useFakeTimers();
    const { button } = setup();
    button.dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(299);
    expect(bubble()).toBeNull();
    vi.advanceTimersByTime(1);
    expect(bubble()).not.toBeNull();

    button.dispatchEvent(new MouseEvent('mouseleave'));
    expect(bubble()).toBeNull();
  });

  it('is dismissed by Escape', () => {
    const { button } = setup();
    button.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(bubble()).not.toBeNull();

    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(bubble()).toBeNull();
  });
});
