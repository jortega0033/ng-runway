import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { AppNotification } from '@core/api/models';
import { NotificationsApi } from '@core/api/notifications.api';
import { LanguageService } from '@core/i18n/i18n';
import {
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
  IconComponent,
  PageHeaderComponent,
  SegmentedComponent,
  SkeletonComponent,
  ToastService,
} from '@ui/index';
import { NOTIFICATION_KINDS } from '../notification-kinds';
import { relativeTime } from '../relative-time';
import { UnreadNotificationsService } from '../unread-notifications.service';

type Filter = 'all' | 'unread';
type Status = 'loading' | 'error' | 'ready';

/** The signed-in user's notifications, newest first. */
@Component({
  selector: 'app-notifications-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    IconComponent,
    PageHeaderComponent,
    RouterLink,
    SegmentedComponent,
    SkeletonComponent,
    TranslocoPipe,
  ],
  template: `
    <ui-page-header
      [title]="'notifications.title' | transloco"
      [description]="'notifications.description' | transloco"
    >
      <div actions>
        <button
          ui-button
          type="button"
          variant="secondary"
          [disabled]="unreadCount() === 0 || busy()"
          (click)="markAllRead()"
        >
          {{ 'notifications.markAllRead' | transloco }}
        </button>
      </div>
    </ui-page-header>

    <div class="mb-4">
      <ui-segmented
        [label]="'notifications.filter' | transloco"
        [options]="filterOptions()"
        [value]="filter()"
        (valueChange)="setFilter($event)"
      />
    </div>

    <ui-card padding="flush">
      @switch (status()) {
        @case ('loading') {
          <div
            class="flex flex-col gap-4 p-4"
            role="status"
            [attr.aria-label]="'common.loading' | transloco"
          >
            @for (i of placeholders; track i) {
              <ui-skeleton class="h-12 w-full" />
            }
          </div>
        }
        @case ('error') {
          <ui-empty-state
            icon="alert-circle"
            [title]="'common.errorTitle' | transloco"
            [message]="'common.errorText' | transloco"
          >
            <button empty-action ui-button type="button" (click)="load()">
              {{ 'common.retry' | transloco }}
            </button>
          </ui-empty-state>
        }
        @default {
          @if (visible().length === 0) {
            <ui-empty-state
              icon="bell"
              [title]="
                (filter() === 'unread' ? 'notifications.noUnreadTitle' : 'notifications.emptyTitle')
                  | transloco
              "
              [message]="
                (filter() === 'unread' ? 'notifications.noUnreadText' : 'notifications.emptyText')
                  | transloco
              "
            />
          } @else {
            <ul class="divide-y divide-border-subtle">
              @for (item of visible(); track item.id) {
                <li class="flex items-start gap-3 p-4">
                  <span
                    class="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-background-alt text-foreground-subtle"
                  >
                    <ui-icon [name]="kind(item).icon" [size]="20" />
                  </span>
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                      @if (kind(item).link; as link) {
                        <a
                          [routerLink]="link"
                          class="rounded-sm text-base text-foreground outline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-border-brand"
                          [class.font-semibold]="!item.read"
                          [class.font-normal]="item.read"
                          (click)="markRead(item)"
                        >
                          {{ item.title }}
                        </a>
                      } @else {
                        <span
                          class="text-base text-foreground"
                          [class.font-semibold]="!item.read"
                          [class.font-normal]="item.read"
                        >
                          {{ item.title }}
                        </span>
                      }
                      @if (!item.read) {
                        <ui-badge variant="brand">{{ 'notifications.new' | transloco }}</ui-badge>
                      }
                    </div>
                    <p class="text-base text-foreground-subtle">{{ item.message }}</p>
                    <p class="mt-1 text-sm text-foreground-subtle">
                      <time [attr.datetime]="item.createdAt">{{ timeAgo(item) }}</time>
                    </p>
                  </div>
                  @if (!item.read) {
                    <button
                      ui-button
                      type="button"
                      size="sm"
                      variant="ghost"
                      [attr.aria-label]="('notifications.markRead' | transloco) + ': ' + item.title"
                      (click)="markRead(item)"
                    >
                      {{ 'notifications.markRead' | transloco }}
                    </button>
                  }
                </li>
              }
            </ul>
          }
        }
      }
    </ui-card>
  `,
})
export class NotificationsPage {
  private readonly api = inject(NotificationsApi);
  private readonly unread = inject(UnreadNotificationsService);
  private readonly toasts = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageService);
  private readonly scopeLoaded = toSignal(this.transloco.selectTranslation('notifications'));

  protected readonly placeholders = [1, 2, 3, 4];
  protected readonly status = signal<Status>('loading');
  protected readonly filter = signal<Filter>('all');
  protected readonly busy = signal(false);
  private readonly items = signal<readonly AppNotification[]>([]);
  private readonly now = signal(new Date());

  protected readonly unreadCount = computed(() => this.items().filter((n) => !n.read).length);
  protected readonly visible = computed(() => {
    const list = this.filter() === 'unread' ? this.items().filter((n) => !n.read) : this.items();
    return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });
  protected readonly filterOptions = computed(() => [
    { value: 'all', label: this.t('notifications.filterAll') },
    { value: 'unread', label: `${this.t('notifications.filterUnread')} (${this.unreadCount()})` },
  ]);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.status.set('loading');
    this.api.list().subscribe({
      next: (list) => {
        this.items.set(list);
        this.now.set(new Date());
        this.status.set('ready');
        this.unread.set(this.unreadCount());
      },
      error: () => this.status.set('error'),
    });
  }

  protected setFilter(value: string): void {
    this.filter.set(value === 'unread' ? 'unread' : 'all');
  }

  protected kind(item: AppNotification) {
    return NOTIFICATION_KINDS[item.kind];
  }

  protected timeAgo(item: AppNotification): string {
    return relativeTime(item.createdAt, this.now(), this.language.language());
  }

  protected markRead(item: AppNotification): void {
    if (item.read) return;
    this.api.markRead(item.id).subscribe(() => {
      this.items.update((list) => list.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
      this.unread.set(this.unreadCount());
    });
  }

  protected markAllRead(): void {
    this.busy.set(true);
    this.api.markAllRead().subscribe({
      next: () => {
        this.items.update((list) => list.map((n) => ({ ...n, read: true })));
        this.unread.set(0);
        this.busy.set(false);
        this.toasts.show({ variant: 'success', title: this.t('notifications.allReadToast') });
      },
      error: () => this.busy.set(false),
    });
  }

  private t(key: string): string {
    this.scopeLoaded();
    return this.transloco.translate(key);
  }
}
