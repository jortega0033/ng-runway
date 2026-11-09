import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TableComponent, nextSort, type TableColumn, type TableSort } from './table';

interface Employee {
  id: number;
  name: string;
  hours: number;
}

const DATA: Employee[] = [
  { id: 1, name: 'Maria van der Berg', hours: 38 },
  { id: 2, name: 'Aiko Tanaka', hours: 24 },
  { id: 3, name: 'Chidi Okafor', hours: 40 },
];

const COLUMNS: TableColumn<Employee>[] = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'hours', header: 'Hours', sortable: true, align: 'end' },
];

@Component({
  imports: [TableComponent],
  template: `
    <ui-table
      label="Employees"
      [columns]="columns"
      [rows]="rows()"
      [trackBy]="trackBy"
      [loading]="loading()"
      [selectable]="selectable()"
      [rowClickable]="true"
      [virtual]="virtual()"
      height="200px"
      emptyTitle="No employees"
      emptyMessage="Add someone to get started."
      [(sort)]="sort"
      [(selected)]="selected"
      (sortChange)="sortEvents.push($event)"
      (rowClick)="clicked.push($event.id)"
    >
      <button empty-action type="button">Add employee</button>
    </ui-table>
  `,
})
class Host {
  columns = COLUMNS;
  trackBy = (row: Employee) => row.id;
  rows = signal<Employee[]>(DATA);
  loading = signal(false);
  selectable = signal(false);
  virtual = signal(false);
  sort = signal<TableSort | null>(null);
  selected = signal<readonly Employee[]>([]);
  sortEvents: (TableSort | null)[] = [];
  clicked: number[] = [];
}

describe('TableComponent', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const settle = async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    };
    const bodyRows = () =>
      Array.from(root.querySelectorAll<HTMLElement>('[role="row"]')).filter(
        (r) => !r.querySelector('[role="columnheader"]'),
      );
    const header = (name: string) =>
      Array.from(root.querySelectorAll<HTMLElement>('[role="columnheader"]')).find((h) =>
        h.textContent?.includes(name),
      )!;
    return { fixture, host: fixture.componentInstance, root, settle, bodyRows, header };
  }

  it('renders a table with named columns and one row per item', async () => {
    const { root, bodyRows } = await setup();
    expect(root.querySelector('[role="table"]')!.getAttribute('aria-label')).toBe('Employees');
    expect(
      bodyRows().map((r) => r.querySelectorAll('[role="cell"]')[0].textContent?.trim()),
    ).toEqual(['Maria van der Berg', 'Aiko Tanaka', 'Chidi Okafor']);
  });

  it('toggles sort on header click, updates aria-sort, sorts rows and emits', async () => {
    const { host, settle, header, bodyRows } = await setup();
    expect(header('Name').getAttribute('aria-sort')).toBe('none');

    header('Name').querySelector('button')!.click();
    await settle();
    expect(header('Name').getAttribute('aria-sort')).toBe('ascending');
    expect(bodyRows()[0].textContent).toContain('Aiko Tanaka');

    header('Name').querySelector('button')!.click();
    await settle();
    expect(header('Name').getAttribute('aria-sort')).toBe('descending');
    expect(bodyRows()[0].textContent).toContain('Maria van der Berg');

    header('Name').querySelector('button')!.click();
    await settle();
    expect(header('Name').getAttribute('aria-sort')).toBe('none');

    expect(host.sortEvents).toEqual([
      { key: 'name', direction: 'asc' },
      { key: 'name', direction: 'desc' },
      null,
    ]);
    expect(host.sort()).toBeNull();
  });

  it('sorts numbers numerically and only one column carries a sort', async () => {
    const { host, settle, header, bodyRows } = await setup();
    host.sort.set({ key: 'hours', direction: 'desc' });
    await settle();
    expect(
      bodyRows().map((r) => r.querySelectorAll('[role="cell"]')[1].textContent?.trim()),
    ).toEqual(['40', '38', '24']);
    expect(header('Hours').getAttribute('aria-sort')).toBe('descending');
    expect(header('Name').getAttribute('aria-sort')).toBe('none');
  });

  it('nextSort cycles asc, desc, off and resets on another key', () => {
    expect(nextSort(null, 'a')).toEqual({ key: 'a', direction: 'asc' });
    expect(nextSort({ key: 'a', direction: 'asc' }, 'a')).toEqual({ key: 'a', direction: 'desc' });
    expect(nextSort({ key: 'a', direction: 'desc' }, 'a')).toBeNull();
    expect(nextSort({ key: 'a', direction: 'desc' }, 'b')).toEqual({ key: 'b', direction: 'asc' });
  });

  it('shows skeleton rows and aria-busy while loading', async () => {
    const { host, root, settle, bodyRows } = await setup();
    host.loading.set(true);
    await settle();
    expect(root.querySelector('[role="table"]')!.getAttribute('aria-busy')).toBe('true');
    expect(root.querySelectorAll('ui-skeleton').length).toBeGreaterThan(0);
    expect(bodyRows().length).toBe(5);
    expect(root.textContent).not.toContain('Aiko Tanaka');
  });

  it('renders the empty state with the action slot when there are no rows', async () => {
    const { host, root, settle } = await setup();
    host.rows.set([]);
    await settle();
    expect(root.querySelector('ui-empty-state')!.textContent).toContain('No employees');
    expect(root.textContent).toContain('Add someone to get started.');
    expect(root.querySelector('button[empty-action]')).not.toBeNull();
  });

  it('selects rows, supports select all with an indeterminate header, and keeps the model in sync', async () => {
    const { host, root, settle } = await setup();
    host.selectable.set(true);
    await settle();
    const boxes = () =>
      Array.from(root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
    const [all, first] = boxes();

    first.click();
    await settle();
    expect(host.selected().map((r) => r.id)).toEqual([1]);
    expect(all.indeterminate).toBe(true);
    expect(root.querySelectorAll('[role="row"][aria-selected="true"]').length).toBe(1);

    all.click();
    await settle();
    expect(host.selected().length).toBe(3);
    expect(all.checked).toBe(true);
    expect(all.indeterminate).toBe(false);

    all.click();
    await settle();
    expect(host.selected()).toEqual([]);
  });

  it('emits rowClick on click and on Enter/Space, but not for clicks on inner controls', async () => {
    const { host, root, settle, bodyRows } = await setup();
    const row = bodyRows()[1];
    expect(row.getAttribute('tabindex')).toBe('0');

    row.click();
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    row.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(host.clicked).toEqual([2, 2, 2]);

    host.selectable.set(true);
    await settle();
    root.querySelectorAll<HTMLInputElement>('[role="row"] input[type="checkbox"]')[1].click();
    expect(host.clicked.length).toBe(3);
  });

  it('renders only a window of rows in virtual mode', async () => {
    const { host, settle, bodyRows } = await setup();
    // jsdom has no layout: give the viewport a 200px height so CDK can compute a window.
    const height = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(200);
    host.rows.set(
      Array.from({ length: 5000 }, (_, i) => ({ id: i, name: `Person ${i}`, hours: i % 40 })),
    );
    host.virtual.set(true);
    // CDK computes the window over a few microtask/render passes.
    for (let i = 0; i < 4; i++) await settle();
    height.mockRestore();
    const rendered = bodyRows().length;
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(100);
    expect(document.body.querySelector('[role="table"]')!.getAttribute('aria-rowcount')).toBe(
      '5001',
    );
  });
});
