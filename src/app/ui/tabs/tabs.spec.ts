import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TabComponent, TabContentDirective, TabsComponent } from './tabs';

let lazyCreated = 0;

@Component({
  selector: 'app-probe',
  template: 'probe',
})
class Probe {
  constructor() {
    lazyCreated++;
  }
}

@Component({
  imports: [TabsComponent, TabComponent, TabContentDirective, Probe],
  template: `
    <ui-tabs [(value)]="tab" ariaLabel="Employee sections" [orientation]="orientation()">
      <ui-tab value="overview" label="Overview">Overview panel</ui-tab>
      <ui-tab value="leave" label="Leave" [disabled]="leaveDisabled()">Leave panel</ui-tab>
      <ui-tab value="docs" label="Documents">
        <ng-template uiTabContent><app-probe /></ng-template>
      </ui-tab>
    </ui-tabs>
  `,
})
class Host {
  readonly tab = signal<string | undefined>(undefined);
  readonly orientation = signal<'horizontal' | 'vertical'>('horizontal');
  readonly leaveDisabled = signal(false);
}

function key(el: HTMLElement, k: string): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
}

describe('ui-tabs', () => {
  async function setup() {
    lazyCreated = 0;
    const fixture = TestBed.createComponent(Host);
    const settle = async () => {
      for (let i = 0; i < 3; i++) {
        fixture.detectChanges();
        await fixture.whenStable();
      }
    };
    await settle();
    const root = fixture.nativeElement as HTMLElement;
    const tabs = () => Array.from(root.querySelectorAll<HTMLElement>('[role=tab]'));
    const panel = () => root.querySelector<HTMLElement>('[role=tabpanel]:not([inert])');
    return { fixture, host: fixture.componentInstance, root, tabs, panel, settle };
  }

  it('renders a tablist with the first tab selected by default', async () => {
    const { root, tabs, panel } = await setup();
    expect(root.querySelector('[role=tablist]')?.getAttribute('aria-label')).toBe(
      'Employee sections',
    );
    expect(tabs().map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    expect(panel()?.textContent).toContain('Overview panel');
  });

  it('selects a tab by click and reports it through the value model', async () => {
    const { host, tabs, panel, settle } = await setup();
    tabs()[1].click();
    await settle();
    expect(host.tab()).toBe('leave');
    expect(tabs()[1].getAttribute('aria-selected')).toBe('true');
    expect(panel()?.textContent).toContain('Leave panel');
  });

  it('follows the value model set from outside', async () => {
    const { host, tabs, settle } = await setup();
    host.tab.set('docs');
    await settle();
    expect(tabs()[2].getAttribute('aria-selected')).toBe('true');
  });

  it('moves and selects with the arrow keys, Home and End', async () => {
    const { host, tabs, settle } = await setup();
    tabs()[0].focus();
    key(tabs()[0].parentElement as HTMLElement, 'ArrowRight');
    await settle();
    expect(host.tab()).toBe('leave');
    key(tabs()[1].parentElement as HTMLElement, 'End');
    await settle();
    expect(host.tab()).toBe('docs');
    key(tabs()[2].parentElement as HTMLElement, 'Home');
    await settle();
    expect(host.tab()).toBe('overview');
  });

  it('skips disabled tabs', async () => {
    const { host, tabs, settle } = await setup();
    host.leaveDisabled.set(true);
    await settle();
    expect(tabs()[1].getAttribute('aria-disabled')).toBe('true');
    tabs()[0].focus();
    key(tabs()[0].parentElement as HTMLElement, 'ArrowRight');
    await settle();
    expect(host.tab()).toBe('docs');
  });

  it('creates lazy content only once its tab is opened', async () => {
    const { tabs, settle } = await setup();
    expect(lazyCreated).toBe(0);
    tabs()[2].click();
    await settle();
    expect(lazyCreated).toBe(1);
  });

  it('uses the vertical arrow keys when the orientation is vertical', async () => {
    const { host, tabs, settle } = await setup();
    host.orientation.set('vertical');
    await settle();
    expect(tabs()[0].parentElement?.getAttribute('aria-orientation')).toBe('vertical');
    tabs()[0].focus();
    key(tabs()[0].parentElement as HTMLElement, 'ArrowDown');
    await settle();
    expect(host.tab()).toBe('leave');
  });
});
