import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { SidebarNavComponent, type NavItem } from './sidebar-nav';
import { TopBarComponent } from './top-bar';

@Component({ template: '' })
class Page {}

const ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: 'home', link: '/dashboard', badge: 3 },
  {
    label: 'People',
    icon: 'users',
    children: [
      { label: 'Employees', link: '/people/employees' },
      { label: 'Teams', link: '/people/teams' },
    ],
  },
  { label: 'Schedule', icon: 'calendar', link: '/schedule' },
];

@Component({
  imports: [SidebarNavComponent],
  template: `<ui-sidebar-nav [items]="items" [collapsed]="collapsed()" label="Primary" />`,
})
class NavHost {
  readonly items = ITEMS;
  readonly collapsed = input(false);
}

@Component({
  imports: [TopBarComponent],
  template: `
    <ui-top-bar>
      <button slot="start">Menu</button>
      <span slot="center">Search</span>
      <span slot="end">Profile</span>
    </ui-top-bar>
  `,
})
class BarHost {}

describe('navigation', () => {
  async function setup(collapsed = false) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'dashboard', component: Page },
          { path: 'schedule', component: Page },
          { path: 'people/employees', component: Page },
          { path: 'people/teams', component: Page },
        ]),
      ],
    });
    const harness = await RouterTestingHarness.create();
    const fixture = TestBed.createComponent(NavHost);
    fixture.componentRef.setInput('collapsed', collapsed);
    await fixture.whenStable();
    return { harness, fixture, root: fixture.nativeElement as HTMLElement };
  }

  const link = (root: HTMLElement, name: string) =>
    [...root.querySelectorAll('a')].find((a) => a.textContent?.includes(name))!;

  it('renders a labelled nav landmark', async () => {
    const { root } = await setup();
    expect(root.querySelector('nav')?.getAttribute('aria-label')).toBe('Primary');
  });

  it('marks only the active route with aria-current=page', async () => {
    const { harness, fixture, root } = await setup();
    await harness.navigateByUrl('/schedule');
    await fixture.whenStable();
    expect(link(root, 'Schedule').getAttribute('aria-current')).toBe('page');
    expect(link(root, 'Dashboard').hasAttribute('aria-current')).toBe(false);

    await harness.navigateByUrl('/dashboard');
    await fixture.whenStable();
    expect(link(root, 'Dashboard').getAttribute('aria-current')).toBe('page');
    expect(link(root, 'Schedule').hasAttribute('aria-current')).toBe(false);
  });

  it('shows badges next to the label', async () => {
    const { root } = await setup();
    expect(link(root, 'Dashboard').querySelector('ui-badge')?.textContent?.trim()).toBe('3');
  });

  it('toggles a group with the keyboard-operable disclosure button', async () => {
    const { fixture, root } = await setup();
    const button = root.querySelector<HTMLButtonElement>('button[aria-expanded]')!;
    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(root.textContent).not.toContain('Employees');

    // Enter / Space on a native button fire click; this is the same path.
    button.click();
    await fixture.whenStable();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('aria-controls')).toBe(root.querySelector('ul ul')?.id);
    expect(link(root, 'Employees')).toBeTruthy();

    button.click();
    await fixture.whenStable();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(root.textContent).not.toContain('Employees');
  });

  it('marks a child link active inside an open group', async () => {
    const { harness, fixture, root } = await setup();
    root.querySelector<HTMLButtonElement>('button[aria-expanded]')!.click();
    await harness.navigateByUrl('/people/teams');
    await fixture.whenStable();
    expect(link(root, 'Teams').getAttribute('aria-current')).toBe('page');
  });

  it('collapsed mode keeps accessible names but hides the visible labels and adds tooltips', async () => {
    const { root } = await setup(true);
    const dashboard = link(root, 'Dashboard');
    const label = [...dashboard.querySelectorAll('span')].find(
      (s) => s.textContent === 'Dashboard',
    );
    expect(label?.classList.contains('sr-only')).toBe(true);
    expect(dashboard.querySelector('ui-badge')).toBeNull();
    expect(dashboard.textContent).toContain('3');
    const tip = dashboard.querySelector('[aria-hidden="true"]:not(ui-icon)');
    expect(tip?.textContent?.trim()).toBe('Dashboard');
    expect(root.querySelector('button[aria-expanded]')?.getAttribute('aria-label')).toBe('People');
  });

  it('top bar exposes a header with three slots', async () => {
    const fixture = TestBed.createComponent(BarHost);
    await fixture.whenStable();
    const header = (fixture.nativeElement as HTMLElement).querySelector('header')!;
    expect(header).toBeTruthy();
    expect(header.style.height).toContain('navbar-height');
    const text = [...header.children].map((c) => c.textContent?.trim());
    expect(text).toEqual(['Menu', 'Search', 'Profile']);
  });
});
