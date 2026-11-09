import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { AppNotification } from '@core/api/models';
import { ToastService } from '@ui/index';
import { useMockApi } from '../../../testing/msw-test-server';
import notificationsEn from '../../../../../public/i18n/notifications/en.json';
import { UnreadNotificationsService } from '../unread-notifications.service';
import { NotificationsPage } from './notifications.page';

describe('NotificationsPage', () => {
  const api = useMockApi();

  beforeEach(() => {
    const session = api.signIn('employee');
    const mine = (partial: Partial<AppNotification> & Pick<AppNotification, 'id' | 'title'>) => ({
      userId: session.user.id,
      kind: 'schedule' as const,
      message: 'Details follow on the schedule page.',
      createdAt: new Date().toISOString(),
      read: false,
      ...partial,
    });
    api.db.state.notifications = [
      mine({
        id: 'n-old',
        title: 'Timesheet approved',
        kind: 'timesheet',
        read: true,
        createdAt: '2026-01-01T09:00:00.000Z',
      }),
      mine({
        id: 'n-new',
        title: 'Shift swapped',
        createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
      }),
      mine({
        id: 'n-mid',
        title: 'Vacation approved',
        kind: 'absence',
        createdAt: '2026-06-01T09:00:00.000Z',
      }),
      { ...mine({ id: 'n-other', title: 'Not mine' }), userId: 'someone-else' },
    ];
    TestBed.configureTestingModule({
      providers: [...api.providers({ notifications: notificationsEn }), provideRouter([])],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(NotificationsPage);
    await fixture.whenStable();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('li')).not.toBeNull();
    });
    return fixture;
  }

  const titles = (root: HTMLElement) =>
    Array.from(root.querySelectorAll('li')).map(
      (li) => li.querySelector('a, span.text-base')?.textContent?.trim() ?? '',
    );
  const badges = (root: HTMLElement) =>
    Array.from(root.querySelectorAll('ui-badge')).map((b) => b.textContent?.trim());
  const button = (root: HTMLElement, name: RegExp) =>
    Array.from(root.querySelectorAll('button')).find((b) =>
      name.test((b.getAttribute('aria-label') ?? b.textContent ?? '').trim()),
    );

  it('lists only my notifications, newest first, with a text badge on unread ones', async () => {
    const fixture = await render();
    const root: HTMLElement = fixture.nativeElement;

    expect(root.querySelector('h1')?.textContent).toContain('Notifications');
    expect(titles(root)).toEqual(['Shift swapped', 'Vacation approved', 'Timesheet approved']);
    expect(badges(root)).toEqual(['New', 'New']);
    expect(root.querySelector('a[href="/absences"]')?.textContent).toContain('Vacation approved');
    expect(root.textContent).toContain('5 minutes ago');
  });

  it('marks one notification as read and updates the unread count', async () => {
    const fixture = await render();
    const root: HTMLElement = fixture.nativeElement;
    const unread = TestBed.inject(UnreadNotificationsService);
    await vi.waitFor(() => expect(unread.count()).toBe(2));

    button(root, /^Mark as read: Shift swapped$/)?.click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(button(root, /^Mark as read: Shift swapped$/)).toBeUndefined();
    });
    expect(badges(root)).toEqual(['New']);
    expect(unread.count()).toBe(1);
    expect(api.db.state.notifications.find((n) => n.id === 'n-new')?.read).toBe(true);
  });

  it('marks everything as read with a toast, and filters unread', async () => {
    const fixture = await render();
    const root: HTMLElement = fixture.nativeElement;
    const toasts = TestBed.inject(ToastService);

    const unreadOption = Array.from(
      root.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
    ).find((r) => r.value === 'unread');
    unreadOption?.click();
    fixture.detectChanges();
    expect(titles(root)).toEqual(['Shift swapped', 'Vacation approved']);

    button(root, /^Mark all as read$/)?.click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(toasts.toasts().map((t) => t.title)).toContain('All notifications marked as read');
    });
    expect(root.textContent).toContain('You are all caught up');
    expect(TestBed.inject(UnreadNotificationsService).count()).toBe(0);
  });
});
