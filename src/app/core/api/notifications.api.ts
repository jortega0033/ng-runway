import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import type { AppNotification } from './models';

@Injectable({ providedIn: 'root' })
export class NotificationsApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/notifications`;

  list(): Observable<AppNotification[]> {
    return this.http.get<AppNotification[]>(this.base);
  }

  markRead(id: string): Observable<null> {
    return this.http.post<null>(`${this.base}/${id}/read`, {});
  }

  markAllRead(): Observable<null> {
    return this.http.post<null>(`${this.base}/read-all`, {});
  }
}
