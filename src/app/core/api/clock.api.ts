import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { toParams } from './http-params';
import type { ClockEntry } from './models';

export interface ClockQuery {
  from?: string;
  to?: string;
  employeeId?: string;
  teamId?: string;
  status?: string;
}

@Injectable({ providedIn: 'root' })
export class ClockApi {
  private readonly http = inject(HttpClient);
  private readonly root = inject(API_BASE_URL);

  entries(query: ClockQuery = {}): Observable<ClockEntry[]> {
    return this.http.get<ClockEntry[]>(`${this.root}/clock-entries`, { params: toParams(query) });
  }

  clockIn(): Observable<ClockEntry> {
    return this.http.post<ClockEntry>(`${this.root}/clock/in`, {});
  }

  clockOut(): Observable<ClockEntry> {
    return this.http.post<ClockEntry>(`${this.root}/clock/out`, {});
  }

  startBreak(): Observable<ClockEntry> {
    return this.http.post<ClockEntry>(`${this.root}/clock/break/start`, {});
  }

  endBreak(): Observable<ClockEntry> {
    return this.http.post<ClockEntry>(`${this.root}/clock/break/end`, {});
  }

  review(id: string, status: 'approved' | 'rejected', comment = ''): Observable<ClockEntry> {
    return this.http.post<ClockEntry>(`${this.root}/clock-entries/${id}/review`, {
      status,
      comment,
    });
  }
}
