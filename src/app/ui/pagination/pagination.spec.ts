import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PaginationComponent, pageCount, pageItems } from './pagination';

describe('pagination math', () => {
  it('computes page counts with a minimum of one', () => {
    expect(pageCount(143, 20)).toBe(8);
    expect(pageCount(140, 20)).toBe(7);
    expect(pageCount(0, 20)).toBe(1);
  });

  it('shows every page when there are seven or fewer', () => {
    expect(pageItems(1, 1)).toEqual([1]);
    expect(pageItems(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('puts the ellipsis on the correct side near the boundaries', () => {
    expect(pageItems(1, 20)).toEqual([1, 2, 3, 4, 5, 'ellipsis', 20]);
    expect(pageItems(4, 20)).toEqual([1, 2, 3, 4, 5, 'ellipsis', 20]);
    expect(pageItems(17, 20)).toEqual([1, 'ellipsis', 16, 17, 18, 19, 20]);
    expect(pageItems(20, 20)).toEqual([1, 'ellipsis', 16, 17, 18, 19, 20]);
  });

  it('shows two ellipses in the middle', () => {
    expect(pageItems(10, 20)).toEqual([1, 'ellipsis', 9, 10, 11, 'ellipsis', 20]);
  });
});

@Component({
  imports: [PaginationComponent],
  template: `<ui-pagination [total]="total()" [(page)]="page" [(pageSize)]="pageSize" />`,
})
class Host {
  total = signal(143);
  page = signal(1);
  pageSize = signal(20);
}

describe('PaginationComponent', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const settle = async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    };
    const button = (label: string) =>
      root.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
    return { host: fixture.componentInstance, root, settle, button };
  }

  it('is a labelled navigation landmark with a range summary', async () => {
    const { root } = await setup();
    expect(root.querySelector('nav')!.getAttribute('aria-label')).toBe('Pagination');
    expect(root.querySelector('p')!.textContent).toBe('1-20 of 143');
  });

  it('marks the current page and moves with next and previous', async () => {
    const { host, root, settle, button } = await setup();
    expect(button('Page 1').getAttribute('aria-current')).toBe('page');
    expect(button('Previous page').disabled).toBe(true);

    button('Next page').click();
    await settle();
    expect(host.page()).toBe(2);
    expect(root.querySelector('p')!.textContent).toBe('21-40 of 143');
    expect(button('Page 2').getAttribute('aria-current')).toBe('page');

    button('Page 5').click();
    await settle();
    expect(host.page()).toBe(5);
  });

  it('disables next on the last page and shows a partial final range', async () => {
    const { host, root, settle, button } = await setup();
    host.page.set(8);
    await settle();
    expect(button('Next page').disabled).toBe(true);
    expect(root.querySelector('p')!.textContent).toBe('141-143 of 143');
  });

  it('returns to page 1 when the page size changes', async () => {
    const { host, root, settle } = await setup();
    host.page.set(4);
    await settle();
    const select = root.querySelector<HTMLSelectElement>('select')!;
    select.value = '50';
    select.dispatchEvent(new Event('change'));
    await settle();
    expect(host.pageSize()).toBe(50);
    expect(host.page()).toBe(1);
    expect(root.querySelector('p')!.textContent).toBe('1-50 of 143');
  });

  it('handles an empty list', async () => {
    const { host, root, settle, button } = await setup();
    host.total.set(0);
    await settle();
    expect(root.querySelector('p')!.textContent).toBe('0 of 0');
    expect(button('Next page').disabled).toBe(true);
  });
});
