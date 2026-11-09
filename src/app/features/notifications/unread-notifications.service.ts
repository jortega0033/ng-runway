import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { API_BASE_URL } from '@core/api/api-config';
import type { AppNotification } from '@core/api/models';
import { AuthService } from '@core/auth/auth.service';
import { SKIP_ERROR_TOAST } from '@core/http/error.interceptor';

/**
 * How many notifications the signed-in user has not read. Loaded when someone signs in and
 * whenever `refresh()` is called (the notifications page does after each change).
 *
 * To show it in the nav, read `count()` where the nav is built, for example as the badge of the
 * "Notifications" item.
 */
@Injectable({ providedIn: 'root' })
export class UnreadNotificationsService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  private readonly auth = inject(AuthService);
  private readonly unread = signal(0);

  readonly count = this.unread.asReadonly();

  constructor() {
    effect(() => {
      if (this.auth.isAuthenticated()) untracked(() => this.refresh());
      else this.unread.set(0);
    });
  }

  refresh(): void {
    // Same endpoint as NotificationsApi.list, but a failing badge must not show an error toast.
    this.http
      .get<AppNotification[]>(`${this.base}/notifications`, {
        context: new HttpContext().set(SKIP_ERROR_TOAST, true),
      })
      .subscribe({
        next: (items) => this.unread.set(items.filter((n) => !n.read).length),
        error: () => undefined,
      });
  }

  /** For callers that already know the new number and want to skip a request. */
  set(count: number): void {
    this.unread.set(Math.max(0, count));
  }
}
