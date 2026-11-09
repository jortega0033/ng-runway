import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BreadcrumbsComponent, type BreadcrumbItem } from './breadcrumbs/breadcrumbs';
import { CardComponent } from './card/card';
import { EmptyStateComponent } from './empty-state/empty-state';
import { PageHeaderComponent } from './page-header/page-header';

@Component({
  imports: [BreadcrumbsComponent, CardComponent, EmptyStateComponent, PageHeaderComponent],
  template: `
    <ui-page-header title="Employees" description="Everyone on the roster.">
      <ui-breadcrumbs breadcrumbs [items]="items" />
      <button actions type="button">Invite</button>
    </ui-page-header>
    <ui-card padding="flush">
      <h2 card-header>Roster</h2>
      <p>Body</p>
      <span card-footer>Footer</span>
    </ui-card>
    <ui-empty-state title="No shifts" message="Create the first shift.">
      <button empty-action type="button">New shift</button>
    </ui-empty-state>
  `,
})
class Host {
  items: BreadcrumbItem[] = [
    { label: 'Home', link: '/' },
    { label: 'Staff', link: '/staff' },
    { label: 'Employees' },
  ];
}

describe('layout and data-display components', () => {
  async function setup() {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('breadcrumbs: labelled nav, links for parents, aria-current on the last item', async () => {
    const root = await setup();
    const nav = root.querySelector('nav')!;
    expect(nav.getAttribute('aria-label')).toBe('Breadcrumb');
    expect(nav.querySelectorAll('a').length).toBe(2);
    const current = nav.querySelectorAll('[aria-current="page"]');
    expect(current.length).toBe(1);
    expect(current[0].textContent?.trim()).toBe('Employees');
  });

  it('page header renders title, description and both slots', async () => {
    const root = await setup();
    expect(root.querySelector('h1')!.textContent).toBe('Employees');
    expect(root.textContent).toContain('Everyone on the roster.');
    expect(root.querySelector('ui-page-header nav')).not.toBeNull();
    expect(root.querySelector('ui-page-header button[actions]')).not.toBeNull();
  });

  it('card projects header, body and footer', async () => {
    const root = await setup();
    const card = root.querySelector('ui-card')!;
    expect(card.querySelector('[card-header]')!.textContent).toBe('Roster');
    expect(card.textContent).toContain('Body');
    expect(card.querySelector('[card-footer]')!.textContent).toBe('Footer');
  });

  it('empty state renders title, message and action', async () => {
    const root = await setup();
    const empty = root.querySelector('ui-empty-state')!;
    expect(empty.textContent).toContain('No shifts');
    expect(empty.textContent).toContain('Create the first shift.');
    expect(empty.querySelector('button')!.textContent).toBe('New shift');
  });
});
