import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AlertComponent } from './alert/alert';
import { AvatarComponent } from './avatar/avatar';
import { SpinnerComponent } from './spinner/spinner';
import { TagComponent } from './tag/tag';

@Component({
  imports: [AlertComponent, AvatarComponent, SpinnerComponent, TagComponent],
  template: `
    <ui-alert variant="danger" heading="Save failed" dismissible (dismissed)="dismissed = true"
      >Try again.</ui-alert
    >
    <ui-alert variant="info">Heads up</ui-alert>
    <ui-avatar name="Maria van der Berg" />
    <ui-spinner size="lg" color="primary" />
    <ui-tag removable removeLabel="Remove Night" (removed)="removed = true">Night</ui-tag>
  `,
})
class Host {
  dismissed = false;
  removed = false;
}

describe('feedback and display components', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  it('alert uses role alert for danger and role status for info', async () => {
    const { root } = await setup();
    const alerts = root.querySelectorAll('ui-alert');
    expect(alerts[0].getAttribute('role')).toBe('alert');
    expect(alerts[1].getAttribute('role')).toBe('status');
  });

  it('alert emits dismissed from its labelled button', async () => {
    const { fixture, root } = await setup();
    root.querySelector<HTMLButtonElement>('button[aria-label="Dismiss"]')!.click();
    expect(fixture.componentInstance.dismissed).toBe(true);
  });

  it('avatar shows two initials and is named after the person', async () => {
    const { root } = await setup();
    const avatar = root.querySelector('ui-avatar')!;
    expect(avatar.textContent?.trim()).toBe('MV');
    expect(avatar.getAttribute('aria-label')).toBe('Maria van der Berg');
  });

  it('spinner reflects size and color as attributes for the component tokens', async () => {
    const { root } = await setup();
    const spinner = root.querySelector('ui-spinner')!;
    expect(spinner.getAttribute('size')).toBe('lg');
    expect(spinner.getAttribute('color')).toBe('primary');
    expect(spinner.getAttribute('role')).toBe('status');
  });

  it('tag emits removed from its labelled button', async () => {
    const { fixture, root } = await setup();
    root.querySelector<HTMLButtonElement>('button[aria-label="Remove Night"]')!.click();
    expect(fixture.componentInstance.removed).toBe(true);
  });
});
